import { Router } from "express";
import { ParkingLot } from "../models/ParkingLot.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { getSlotAllocation, vehicleTypes } from "../slotRules.js";

const router = Router();

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

router.get("/summary", async (req, res, next) => {
  try {
    const dateMatch = getDateMatch(req.query);
    const [lots, activeSessions, revenueAgg, completedSessions, violations] = await Promise.all([
      ParkingLot.find().lean(),
      ParkingSession.countDocuments({ exitTime: null }),
      ParkingSession.aggregate([
        { $match: dateMatch },
        { $group: { _id: null, revenue: { $sum: "$amountPaid" } } }
      ]),
      ParkingSession.countDocuments({ ...dateMatch, exitTime: { $ne: null } }),
      ParkingSession.countDocuments({ ...dateMatch, isViolation: true })
    ]);

    const totalCapacity = lots.reduce((sum, lot) => sum + lot.capacity, 0);
    const revenue = revenueAgg[0]?.revenue || 0;

    res.json({
      totalLots: lots.length,
      totalCapacity,
      activeSessions,
      availableSlots: Math.max(totalCapacity - activeSessions, 0),
      occupancyRate: totalCapacity ? Math.round((activeSessions / totalCapacity) * 100) : 0,
      revenue,
      completedSessions,
      violations,
      sensorHealthRate: lots.length
        ? Math.round((lots.filter((lot) => lot.sensorHealthy).length / lots.length) * 100)
        : 0
    });
  } catch (error) {
    next(error);
  }
});

router.get("/peak-hours", async (req, res, next) => {
  try {
    const dateMatch = getDateMatch(req.query);
    const data = await ParkingSession.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: { $hour: { date: "$entryTime", timezone: "+05:30" } },
          checkIns: { $sum: 1 },
          revenue: { $sum: "$amountPaid" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(
      Array.from({ length: 24 }, (_, hour) => {
        const row = data.find((item) => item._id === hour);
        const currentHour = new Date().getHours();
        return {
          hour,
          label: `${String(hour).padStart(2, "0")}:00`,
          checkIns: row?.checkIns || 0,
          revenue: row?.revenue || 0,
          isCurrentHour: hour === currentHour
        };
      })
    );
  } catch (error) {
    next(error);
  }
});

router.get("/lot-performance", async (req, res, next) => {
  try {
    const dateMatch = getDateMatch(req.query);
    const lots = await ParkingLot.find().lean();
    const rows = await ParkingSession.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: "$lot",
          sessions: { $sum: 1 },
          revenue: { $sum: "$amountPaid" },
          violations: { $sum: { $cond: ["$isViolation", 1, 0] } },
          avgDurationMs: {
            $avg: {
              $cond: [
                "$exitTime",
                { $subtract: ["$exitTime", "$entryTime"] },
                { $subtract: [new Date(), "$entryTime"] }
              ]
            }
          }
        }
      }
    ]);
    const byLot = new Map(rows.map((row) => [String(row._id), row]));

    res.json(
      lots.map((lot) => {
        const row = byLot.get(String(lot._id));
        return {
          lotId: lot._id,
          name: lot.name,
          zone: lot.zone,
          capacity: lot.capacity,
          sessions: row?.sessions || 0,
          revenue: row?.revenue || 0,
          violations: row?.violations || 0,
          avgDurationHours: row?.avgDurationMs ? Number((row.avgDurationMs / 36e5).toFixed(2)) : 0
        };
      })
    );
  } catch (error) {
    next(error);
  }
});

router.get("/vehicle-mix", async (req, res, next) => {
  try {
    const dateMatch = getDateMatch(req.query);
    const rows = await ParkingSession.aggregate([
      { $match: dateMatch },
      { $group: { _id: "$vehicleType", value: { $sum: 1 } } },
      { $sort: { value: -1 } }
    ]);
    res.json(rows.map((row) => ({ type: row._id, value: row.value })));
  } catch (error) {
    next(error);
  }
});

router.get("/zone-occupancy", async (req, res, next) => {
  try {
    const dateMatch = getDateMatch(req.query);
    const hasDateFilter = Object.keys(dateMatch).length > 0;
    const lots = await ParkingLot.find().lean();
    const active = await ParkingSession.aggregate([
      { $match: hasDateFilter ? dateMatch : { exitTime: null } },
      { $group: { _id: "$lot", occupied: { $sum: 1 } } }
    ]);
    const occupiedByLot = new Map(active.map((row) => [String(row._id), row.occupied]));
    const zones = new Map();

    lots.forEach((lot) => {
      const existing = zones.get(lot.zone) || { zone: lot.zone, capacity: 0, occupied: 0 };
      existing.capacity += lot.capacity;
      existing.occupied += occupiedByLot.get(String(lot._id)) || 0;
      zones.set(lot.zone, existing);
    });

    res.json(
      Array.from(zones.values()).map((zone) => ({
        ...zone,
        available: zone.capacity - zone.occupied,
        occupancyRate: zone.capacity ? Math.round((zone.occupied / zone.capacity) * 100) : 0,
        mode: hasDateFilter ? "filtered utilization" : "live occupancy"
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.get("/payment-status", async (req, res, next) => {
  try {
    const dateMatch = getDateMatch(req.query);
    const rows = await ParkingSession.aggregate([
      { $match: dateMatch },
      { $group: { _id: "$paymentStatus", value: { $sum: 1 } } },
      { $sort: { value: -1 } }
    ]);
    res.json(rows.map((row) => ({ status: row._id, value: row.value })));
  } catch (error) {
    next(error);
  }
});

router.get("/duration-buckets", async (req, res, next) => {
  try {
    const dateMatch = getDateMatch(req.query);
    const rows = await ParkingSession.aggregate([
      { $match: dateMatch },
      {
        $project: {
          durationHours: {
            $divide: [
              {
                $subtract: [{ $ifNull: ["$exitTime", new Date()] }, "$entryTime"]
              },
              36e5
            ]
          }
        }
      },
      {
        $bucket: {
          groupBy: "$durationHours",
          boundaries: [0, 1, 2, 4, 8, 13],
          default: "13+",
          output: { sessions: { $sum: 1 } }
        }
      }
    ]);
    const labels = {
      0: "0-1 hr",
      1: "1-2 hr",
      2: "2-4 hr",
      4: "4-8 hr",
      8: "8-13 hr",
      "13+": "13+ hr"
    };
    res.json(rows.map((row) => ({ bucket: labels[row._id] || row._id, sessions: row.sessions })));
  } catch (error) {
    next(error);
  }
});

router.get("/live-slot-pressure", async (req, res, next) => {
  try {
    const lots = await ParkingLot.find().lean();
    const active = await ParkingSession.aggregate([
      { $match: { exitTime: null } },
      { $group: { _id: "$lot", occupied: { $sum: 1 } } }
    ]);
    const occupiedByLot = new Map(active.map((row) => [String(row._id), row.occupied]));

    res.json(
      lots.map((lot) => {
        const occupied = occupiedByLot.get(String(lot._id)) || 0;
        return {
          name: lot.name,
          occupied,
          available: lot.capacity - occupied,
          capacity: lot.capacity,
          pressure: lot.capacity ? Math.round((occupied / lot.capacity) * 100) : 0
        };
      })
    );
  } catch (error) {
    next(error);
  }
});

router.get("/vehicle-type-utilization", async (req, res, next) => {
  try {
    const lots = await ParkingLot.find().lean();
    const active = await ParkingSession.aggregate([
      { $match: { exitTime: null } },
      { $group: { _id: "$vehicleType", occupied: { $sum: 1 } } }
    ]);
    const occupiedByType = new Map(active.map((row) => [row._id, row.occupied]));
    const capacityByType = new Map(vehicleTypes.map((type) => [type, 0]));

    lots.forEach((lot) => {
      getSlotAllocation(lot.capacity).forEach((section) => {
        capacityByType.set(
          section.type,
          (capacityByType.get(section.type) || 0) + section.end - section.start + 1
        );
      });
    });

    res.json(
      vehicleTypes.map((type) => {
        const capacity = capacityByType.get(type) || 0;
        const occupied = occupiedByType.get(type) || 0;
        return {
          type,
          label: type.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
          capacity,
          occupied,
          available: capacity - occupied,
          utilizationRate: capacity ? Math.round((occupied / capacity) * 100) : 0
        };
      })
    );
  } catch (error) {
    next(error);
  }
});

router.get("/revenue-by-vehicle-type", async (req, res, next) => {
  try {
    const dateMatch = getDateMatch(req.query);
    const rows = await ParkingSession.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: "$vehicleType",
          revenue: { $sum: "$amountPaid" },
          sessions: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]);
    res.json(
      rows.map((row) => ({
        type: row._id,
        label: row._id.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        revenue: row.revenue,
        sessions: row.sessions
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.get("/daily-trend", async (req, res, next) => {
  try {
    const dateMatch = getDateMatch(req.query);
    const rows = await ParkingSession.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$entryTime", timezone: "+05:30" }
          },
          checkIns: { $sum: 1 },
          revenue: { $sum: "$amountPaid" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json(rows.map((row) => ({ date: row._id, checkIns: row.checkIns, revenue: row.revenue })));
  } catch (error) {
    next(error);
  }
});

router.get("/turnover", async (req, res, next) => {
  try {
    const dateMatch = getDateMatch(req.query);
    const lots = await ParkingLot.find().lean();
    const rows = await ParkingSession.aggregate([
      { $match: dateMatch },
      { $group: { _id: "$lot", sessions: { $sum: 1 }, revenue: { $sum: "$amountPaid" } } }
    ]);
    const byLot = new Map(rows.map((row) => [String(row._id), row]));

    res.json(
      lots.map((lot) => {
        const row = byLot.get(String(lot._id));
        const sessions = row?.sessions || 0;
        return {
          name: lot.name,
          sessions,
          revenue: row?.revenue || 0,
          turnoverRate: lot.capacity ? Number((sessions / lot.capacity).toFixed(2)) : 0
        };
      })
    );
  } catch (error) {
    next(error);
  }
});

router.get("/zero-occupancy", async (req, res, next) => {
  try {
    const lots = await ParkingLot.find().lean();
    const active = await ParkingSession.aggregate([
      { $match: { exitTime: null } },
      { $group: { _id: "$lot", occupied: { $sum: 1 } } }
    ]);
    const occupiedByLot = new Map(active.map((row) => [String(row._id), row.occupied]));

    res.json(
      lots
        .filter((lot) => (occupiedByLot.get(String(lot._id)) || 0) === 0)
        .map((lot) => ({
          lotId: lot._id,
          name: lot.name,
          location: lot.location,
          zone: lot.zone,
          capacity: lot.capacity,
          hourlyRate: lot.hourlyRate
        }))
    );
  } catch (error) {
    next(error);
  }
});

router.get("/outliers", async (req, res, next) => {
  try {
    const dateMatch = getDateMatch(req.query);
    const now = new Date();
    const sessions = await ParkingSession.find(dateMatch)
      .populate("lot", "name location hourlyRate")
      .sort({ entryTime: -1 })
      .limit(500)
      .lean();

    const completedDurations = sessions
      .filter((session) => session.exitTime)
      .map((session) => (new Date(session.exitTime).getTime() - new Date(session.entryTime).getTime()) / 36e5);
    const avgDuration =
      completedDurations.reduce((sum, duration) => sum + duration, 0) / (completedDurations.length || 1);
    const highValue = Math.max(...sessions.map((session) => session.amountPaid || 0), 0) * 0.75;

    const outliers = sessions
      .map((session) => {
        const end = session.exitTime ? new Date(session.exitTime) : now;
        const durationHours = (end.getTime() - new Date(session.entryTime).getTime()) / 36e5;
        const reasons = [];

        if (!session.exitTime && durationHours > 6) reasons.push("Long active stay");
        if (session.exitTime && durationHours > Math.max(avgDuration * 2.2, 8)) reasons.push("Unusually long duration");
        if ((session.amountPaid || 0) >= highValue && highValue > 0) reasons.push("High-value payment");
        if (session.isViolation) reasons.push("Violation flagged");
        if (session.paymentStatus !== "paid" && durationHours > 2) reasons.push("Delayed payment");

        return {
          sessionId: session._id,
          vehicleNumber: session.vehicleNumber,
          lotName: session.lot?.name || "Unknown",
          slotNumber: session.slotNumber,
          entryTime: session.entryTime,
          exitTime: session.exitTime,
          amountPaid: session.amountPaid,
          durationHours: Number(durationHours.toFixed(2)),
          reasons
        };
      })
      .filter((session) => session.reasons.length > 0)
      .slice(0, 20);

    res.json({
      avgDurationHours: Number(avgDuration.toFixed(2)),
      totalOutliers: outliers.length,
      outliers
    });
  } catch (error) {
    next(error);
  }
});

export default router;
