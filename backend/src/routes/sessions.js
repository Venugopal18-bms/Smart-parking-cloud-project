import { Router } from "express";
import { ParkingLot } from "../models/ParkingLot.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { getSlotType, vehicleTypes } from "../slotRules.js";

const router = Router();

function calculateFee(entryTime, exitTime, hourlyRate) {
  const hours = Math.max((exitTime.getTime() - entryTime.getTime()) / 36e5, 0.25);
  return Math.ceil(hours * hourlyRate);
}

router.get("/", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 0);
    let query = ParkingSession.find()
      .populate("lot", "name location zone hourlyRate")
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
    const { lotId, vehicleNumber, vehicleType = "four_wheeler", slotNumber } = req.body;
    const lot = await ParkingLot.findById(lotId);
    if (!lot) return res.status(404).json({ message: "Parking lot not found" });
    if (!vehicleTypes.includes(vehicleType)) {
      return res.status(400).json({ message: "Select a valid vehicle type" });
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
