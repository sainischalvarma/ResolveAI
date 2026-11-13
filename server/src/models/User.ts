import mongoose, { Schema, type InferSchemaType } from "mongoose";
import type { AuthenticatedUser, UserRole } from "@resolveai/shared";

const userRoles: UserRole[] = ["USER", "STAFF", "TECHNICIAN", "ADMIN"];

const userSchema = new Schema(
  {
    googleId: { type: String, sparse: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: false, select: false },
    profileImage: { type: String, trim: true },
    role: { type: String, enum: userRoles, default: "USER", required: true },
    department: { type: String, trim: true },
    phone: { type: String, trim: true },
    active: { type: Boolean, default: true, required: true },
    status: { type: String, enum: ["ACTIVE", "DISABLED", "PENDING_APPROVAL", "REJECTED"], default: "ACTIVE" },
    staffRequestedAt: { type: Date },
    staffReviewedAt: { type: Date },
    staffReviewedBy: { type: String },
    lastLogin: { type: Date }
  },
  { timestamps: true }
);

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const UserModel = mongoose.model("User", userSchema);

export function toAuthenticatedUser(user: UserDocument): AuthenticatedUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    googleId: (user as any).googleId ?? undefined,
    profileImage: (user as any).profileImage ?? undefined,
    status: (user as any).status ?? "ACTIVE",
    department: user.department ?? undefined,
    phone: user.phone ?? undefined,
    active: user.active,
    lastLogin: (user as any).lastLogin ? new Date((user as any).lastLogin).toISOString() : undefined
  };
}
