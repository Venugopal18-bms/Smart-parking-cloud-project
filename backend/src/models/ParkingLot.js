import mongoose from "mongoose";

const parkingLotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    location: { type: String, required: true },
    zone: { type: String, required: true },
    capacity: { type: Number, required: true, min: 1 },
    hourlyRate: { type: Number, required: true, min: 0 },
    sensorHealthy: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const ParkingLot = mongoose.model("ParkingLot", parkingLotSchema);
