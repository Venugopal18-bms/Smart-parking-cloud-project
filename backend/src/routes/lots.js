import { Router } from "express";
import { ParkingLot } from "../models/ParkingLot.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { getSlotAllocation, getSlotType } from "../slotRules.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const lots = await ParkingLot.find().sort({ zone: 1, name: 1 }).lean();
    const activeCounts = await ParkingSession.aggregate([
      { $match: { exitTime: null } },
      { $group: { _id: "$lot", occupied: { $sum: 1 } } }
    ]);
    const activeSlots = await ParkingSession.find({ exitTime: null })
      .select("lot slotNumber vehicleNumber vehicleType paymentStatus")
      .lean();
    const occupiedByLot = new Map(activeCounts.map((item) => [String(item._id), item.occupied]));
    const slotsByLot = new Map();

    activeSlots.forEach((session) => {
      const lotId = String(session.lot);
      const current = slotsByLot.get(lotId) || [];
      current.push({
        slotNumber: session.slotNumber,
        vehicleNumber: session.vehicleNumber,
        vehicleType: session.vehicleType,
        paymentStatus: session.paymentStatus,
        sessionId: session._id
      });
      slotsByLot.set(lotId, current);
    });

    res.json(
      lots.map((lot) => {
        const occupied = occupiedByLot.get(String(lot._id)) || 0;
        const slotAllocation = getSlotAllocation(lot.capacity);
        return {
          ...lot,
          occupied,
          available: Math.max(lot.capacity - occupied, 0),
          occupancyRate: lot.capacity ? Math.round((occupied / lot.capacity) * 100) : 0,
          slotAllocation,
          slots: Array.from({ length: lot.capacity }, (_, index) => {
            const slotNumber = index + 1;
            const occupiedSlot = (slotsByLot.get(String(lot._id)) || []).find(
              (slot) => slot.slotNumber === slotNumber
            );
            const section = getSlotType(lot.capacity, slotNumber);
            return {
              slotNumber,
              reservedFor: section.type,
              reservedLabel: section.label,
              occupied: Boolean(occupiedSlot),
              occupant: occupiedSlot || null
            };
          }),
          occupiedSlots: slotsByLot.get(String(lot._id)) || []
        };
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const lot = await ParkingLot.create(req.body);
    res.status(201).json(lot);
  } catch (error) {
    next(error);
  }
});

export default router;
