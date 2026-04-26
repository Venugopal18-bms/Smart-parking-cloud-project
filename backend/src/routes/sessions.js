import { Router } from "express";
import { ParkingLot } from "../models/ParkingLot.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { User } from "../models/User.js";
import { getSlotType, vehicleTypes } from "../slotRules.js";

const router = Router();

function calculateFee(entryTime, exitTime, hourlyRate) {
  const hours = Math.max((exitTime.getTime() - entryTime.getTime()) / 36e5, 0.25);
  return Math.ceil(hours * hourlyRate);
}

function getDateMatch(query) {
  if (query.date) {
    const start = new Date(`${query.date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { entryTime: { $gte: start, $lt: end } };
  }

  if (query.month) {
    const start = new Date(`${query.month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return { entryTime: { $gte: start, $lt: end } };
  }

  return {};
}

router.get("/", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 0);
    const filters = {
      ...getDateMatch(req.query),
      ...(req.query.userId ? { user: req.query.userId } : {})
    };
    let query = ParkingSession.find(filters)
      .populate("lot", "name location zone hourlyRate capacity")
      .populate("user", "name username")
      .sort({ exitTime: 1, entryTime: -1 });
    if (limit > 0) query = query.limit(limit);
    const sessions = await query;
    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

router.post("/check-in", async (req, res, next) => {
  try {
    const { lotId, vehicleNumber, vehicleType = "four_wheeler", slotNumber, userId } = req.body;
    const lot = await ParkingLot.findById(lotId);
    if (!lot) return res.status(404).json({ message: "Parking lot not found" });
    if (!vehicleTypes.includes(vehicleType)) {
      return res.status(400).json({ message: "Select a valid vehicle type" });
    }

    let user = null;
    if (userId) {
      user = await User.findOne({ _id: userId, role: "user" });
      if (!user) {
        return res.status(404).json({ message: "User account not found" });
      }
    }

    const selectedSlot = Number(slotNumber);
    if (!Number.isInteger(selectedSlot) || selectedSlot < 1 || selectedSlot > lot.capacity) {
      return res.status(400).json({ message: "Select a valid parking slot" });
    }
    const slotSection = getSlotType(lot.capacity, selectedSlot);
    if (slotSection.type !== vehicleType) {
      return res.status(400).json({
        message: `Slot ${selectedSlot} is reserved for ${slotSection.label}`
      });
    }

    const occupied = await ParkingSession.countDocuments({ lot: lotId, exitTime: null });
    if (occupied >= lot.capacity) {
      return res.status(409).json({ message: "Parking lot is full" });
    }

    const existingActive = await ParkingSession.findOne({
      vehicleNumber: vehicleNumber.toUpperCase(),
      exitTime: null
    });
    if (existingActive) {
      return res.status(409).json({ message: "Vehicle already checked in" });
    }

    if (user) {
      const activeUserSession = await ParkingSession.findOne({
        user: user._id,
        exitTime: null
      });
      if (activeUserSession) {
        return res.status(409).json({ message: "This user already has an active parking session" });
      }
    }

    const occupiedSlot = await ParkingSession.findOne({
      lot: lotId,
      slotNumber: selectedSlot,
      exitTime: null
    });
    if (occupiedSlot) {
      return res.status(409).json({ message: `Slot ${selectedSlot} is already occupied` });
    }

    const session = await ParkingSession.create({
      lot: lotId,
      user: user?._id,
      vehicleNumber: vehicleNumber.toUpperCase(),
      vehicleType,
      slotNumber: selectedSlot,
      entryTime: new Date()
    });
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/check-out", async (req, res, next) => {
  try {
    const session = await ParkingSession.findById(req.params.id).populate("lot");
    if (!session) return res.status(404).json({ message: "Parking session not found" });
    if (session.exitTime) return res.status(409).json({ message: "Vehicle already checked out" });

    const exitTime = new Date();
    const amountPaid = calculateFee(session.entryTime, exitTime, session.lot.hourlyRate);
    session.exitTime = exitTime;
    session.amountPaid = amountPaid;
    session.paymentStatus = "paid";
    session.isViolation = amountPaid === 0 || session.durationHours > 12;
    await session.save();

    res.json(session);
  } catch (error) {
    next(error);
  }
});

export default router;
