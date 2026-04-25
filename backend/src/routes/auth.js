import { Router } from "express";
import { User } from "../models/User.js";

const router = Router();

const adminAccount = {
  username: process.env.ADMIN_USERNAME || "admin",
  password: process.env.ADMIN_PASSWORD || "admin123"
};

router.post("/register", async (req, res, next) => {
  try {
    const { name, username, password, phone } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ message: "Name, username, and password are required" });
    }

    const normalizedUsername = username.toLowerCase().trim();
    const existing = await User.findOne({ username: normalizedUsername });
    if (existing || normalizedUsername === adminAccount.username) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const user = await User.create({
      name,
      username: normalizedUsername,
      password,
      phone,
      role: "user"
    });

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { username, password, role = "user" } = req.body;
    const normalizedUsername = String(username || "").toLowerCase().trim();

    if (role === "admin") {
      if (normalizedUsername === adminAccount.username && password === adminAccount.password) {
        return res.json({
          user: { id: "admin", name: "Admin", username: adminAccount.username, role: "admin" }
        });
      }
      return res.status(401).json({ message: "Invalid admin login" });
    }

    const user = await User.findOne({ username: normalizedUsername, role: "user" }).lean();
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
