import mongoose from "mongoose";

const parkingSessionSchema = new mongoose.Schema(
  {
    lot: { type: mongoose.Schema.Types.ObjectId, ref: "ParkingLot", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    vehicleNumber: { type: String, required: true },
    vehicleType: {
      type: String,
      enum: ["two_wheeler", "three_wheeler", "four_wheeler"],
      default: "four_wheeler"
    },
    slotNumber: { type: Number, required: true, min: 1 },
    entryTime: { type: Date, required: true },
    exitTime: { type: Date },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending"
    },
    amountPaid: { type: Number, default: 0 },
    isViolation: { type: Boolean, default: false }
  },
  { timestamps: true }
);

parkingSessionSchema.virtual("durationHours").get(function durationHours() {
  const end = this.exitTime || new Date();
  return Math.max((end.getTime() - this.entryTime.getTime()) / 36e5, 0);
});

parkingSessionSchema.set("toJSON", { virtuals: true });

export const ParkingSession = mongoose.model("ParkingSession", parkingSessionSchema);
