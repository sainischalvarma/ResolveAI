import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authenticate } from "../middleware/auth.js";
import { googleLoginUser, loginUser, registerUser } from "../services/authService.js";
import { UserModel, toAuthenticatedUser } from "../models/User.js";

const googleSchema = z.object({
  credential: z.string().optional(),
  googleId: z.string().optional(),
  email: z.string().trim().email().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  profileImage: z.string().optional(),
  role: z.enum(["USER", "STAFF", "TECHNICIAN", "ADMIN"]).optional(),
  department: z.string().trim().optional(),
  passkey: z.string().optional()
});

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["USER", "STAFF", "TECHNICIAN", "ADMIN"]).default("USER"),
  department: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(7).max(30).optional()
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  passkey: z.string().optional()
});

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  department: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(7).max(30).optional()
});

export const authRouter = Router();

authRouter.post("/google", async (req, res, next) => {
  try {
    const input = googleSchema.parse(req.body);
    const session = await googleLoginUser(input);
    res.json(session);
  } catch (error) {
    next(error);
  }
});


authRouter.post("/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const session = await registerUser(input);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const session = await loginUser(input);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", authenticate, (req, res) => {
  res.json({ user: req.authUser });
});

authRouter.put("/profile", authenticate, async (req, res, next) => {
  try {
    const user = req.authUser!;
    const input = profileUpdateSchema.parse(req.body);

    if (mongoose.connection.readyState !== 1) {
      // Dev mode: return user with updated fields
      const updated = { ...user, ...input };
      res.json({ user: updated });
      return;
    }

    const updateFields: Record<string, unknown> = {};
    if (input.name) updateFields.name = input.name;
    if (input.department) updateFields.department = input.department;
    if (input.phone) updateFields.phone = input.phone;

    const updatedUser = await UserModel.findByIdAndUpdate(
      user.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user: toAuthenticatedUser(updatedUser) });
  } catch (error) {
    next(error);
  }
});

