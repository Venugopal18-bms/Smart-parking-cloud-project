import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { connectDb } from "./db.js";
import lotsRouter from "./routes/lots.js";
import sessionsRouter from "./routes/sessions.js";
import analyticsRouter from "./routes/analytics.js";
import authRouter from "./routes/auth.js";

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "smart-parking-backend" });
});

app.use("/api/lots", lotsRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/auth", authRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || "Unexpected server error"
  });
});

connectDb()
  .then(() => {
    app.listen(port, () => console.log(`API running on port ${port}`));
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  });
