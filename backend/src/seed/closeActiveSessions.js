import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import "../models/ParkingLot.js";
import { ParkingSession } from "../models/ParkingSession.js";

function calculateFee(entryTime, exitTime, hourlyRate = 20) {
  const hours = Math.max((exitTime.getTime() - entryTime.getTime()) / 36e5, 0.25);
  return Math.ceil(hours * hourlyRate);
}

async function closeActiveSessions() {
  await connectDb();

  const activeSessions = await ParkingSession.find({ exitTime: null }).populate("lot");
  const exitTime = new Date();

  for (const session of activeSessions) {
    session.exitTime = exitTime;
    session.paymentStatus = "paid";
    session.amountPaid = calculateFee(session.entryTime, exitTime, session.lot?.hourlyRate);
    await session.save();
  }

  console.log(`Closed ${activeSessions.length} active sessions`);
  await mongoose.disconnect();
}

closeActiveSessions().catch((error) => {
  console.error(error);
  process.exit(1);
});
