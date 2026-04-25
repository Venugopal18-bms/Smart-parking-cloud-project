import "dotenv/config";
import { connectDb } from "../db.js";
import { ParkingLot } from "../models/ParkingLot.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { getSlotAllocation } from "../slotRules.js";
import mongoose from "mongoose";

const lots = [
  { name: "Metro Gate A", location: "MG Road", zone: "Central", capacity: 90, hourlyRate: 20 },
  { name: "Tech Park East", location: "Whitefield", zone: "IT Corridor", capacity: 140, hourlyRate: 25 },
  { name: "Airport Express", location: "Hebbal", zone: "Transit", capacity: 180, hourlyRate: 30 },
  { name: "Mall Basement", location: "Indiranagar", zone: "Commercial", capacity: 120, hourlyRate: 22 },
  { name: "Hospital Block", location: "Jayanagar", zone: "Public Service", capacity: 75, hourlyRate: 15 }
];

const seedVehicleTypes = ["two_wheeler", "three_wheeler", "four_wheeler"];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function makeVehicleNumber(index) {
  return `KA${String(1 + (index % 20)).padStart(2, "0")}AB${String(1000 + index)}`;
}

function pickSlotForType(lot, vehicleType, usedActiveSlots, isActive) {
  const section = getSlotAllocation(lot.capacity).find((item) => item.type === vehicleType);
  const candidates = Array.from(
    { length: section.end - section.start + 1 },
    (_, index) => section.start + index
  );
  const available = candidates.filter((slot) => !usedActiveSlots.has(`${lot._id}:${slot}`));
  const slotNumber = randomItem(available.length ? available : candidates);
  if (isActive) usedActiveSlots.add(`${lot._id}:${slotNumber}`);
  return slotNumber;
}

async function seed() {
  await connectDb();
  await ParkingSession.deleteMany({});
  await ParkingLot.deleteMany({});

  const createdLots = await ParkingLot.insertMany(lots);
  const sessions = [];
  const usedActiveSlots = new Set();
  const now = new Date();

  for (let i = 0; i < 240; i += 1) {
    const lot = randomItem(createdLots);
    const daysAgo = Math.floor(Math.random() * 21);
    const hour = Math.floor(6 + Math.random() * 16);
    const entryTime = new Date(now);
    entryTime.setDate(now.getDate() - daysAgo);
    entryTime.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

    const isActive = false;
    const durationHours = 0.5 + Math.random() * 8;
    const exitTime = isActive ? null : new Date(entryTime.getTime() + durationHours * 36e5);
    const amountPaid = exitTime ? Math.ceil(durationHours * lot.hourlyRate) : 0;
    const vehicleType = randomItem(seedVehicleTypes);
    const slotNumber = pickSlotForType(lot, vehicleType, usedActiveSlots, isActive);

    sessions.push({
      lot: lot._id,
      vehicleNumber: makeVehicleNumber(i),
      vehicleType,
      slotNumber,
      entryTime,
      exitTime,
      paymentStatus: exitTime ? "paid" : "pending",
      amountPaid,
      isViolation: durationHours > 7.5 || (exitTime && Math.random() < 0.06)
    });
  }

  await ParkingSession.insertMany(sessions);
  console.log(`Seeded ${createdLots.length} lots and ${sessions.length} sessions`);
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
