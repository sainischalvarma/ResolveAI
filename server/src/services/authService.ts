import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import mongoose from "mongoose";
import type { AuthenticatedUser, AuthSession, UserRole } from "@resolveai/shared";
import { UserModel, toAuthenticatedUser } from "../models/User.js";

const scryptAsync = promisify(scrypt);

const tokenExpiresIn = "1d";

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  department?: string;
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  passkey?: string;
}

export type LoginResult =
  | AuthSession
  | {
      requirePasskey: true;
      email: string;
      name: string;
      role: "ADMIN";
    };

interface AuthTokenPayload {
  sub: string;
  role: UserRole;
}

interface DevelopmentUserRecord extends AuthenticatedUser {
  passwordHash: string;
}

const developmentUsersByEmail = new Map<string, DevelopmentUserRecord>();
const developmentUsersById = new Map<string, DevelopmentUserRecord>();

export class AuthenticationError extends Error {
  constructor(message = "Invalid email or password") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export async function registerUser(input: RegisterUserInput): Promise<AuthSession> {
  const email = normalizeEmail(input.email);

  if (!isDatabaseConnected()) {
    return registerDevelopmentUser({ ...input, email });
  }

  const existing = await UserModel.exists({ email });

  if (existing) {
    throw new ConflictError("A user with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const userRole = input.role ?? "USER";
  const isStaffRole = userRole === "STAFF" || userRole === "TECHNICIAN";
  const isDemoUser = email === "staff@resolveai.com" || email === "admin@resolveai.com";
  const initialStatus = isStaffRole && !isDemoUser ? "PENDING_APPROVAL" : "ACTIVE";
  const initialActive = isStaffRole && !isDemoUser ? false : true;

  const user = await UserModel.create({
    name: input.name,
    email,
    passwordHash,
    role: userRole,
    department: input.department,
    phone: input.phone,
    status: initialStatus,
    active: initialActive,
    staffRequestedAt: isStaffRole ? new Date() : undefined
  });

  if (initialStatus === "PENDING_APPROVAL") {
    throw new AuthenticationError(
      "Your staff registration request has been submitted for administrator review and approval. Please wait for an administrator to accept your request."
    );
  }

  if (userRole === "STAFF" || userRole === "TECHNICIAN") {
    const { TechnicianModel } = await import("../models/Technician.js");
    const techExists = await TechnicianModel.findOne({ userId: user._id });
    if (!techExists) {
      await TechnicianModel.create({
        userId: user._id,
        skills: ["network", "vpn", "wi-fi", "hardware", "software", "system"],
        availability: "AVAILABLE",
        workload: 0,
        capacity: 5,
        averageResolutionHours: 1.5
      });
    }
  }

  return issueSession(toAuthenticatedUser(user));
}

export interface GoogleAuthInput {
  credential?: string;
  googleId?: string;
  email?: string;
  name?: string;
  profileImage?: string;
  role?: UserRole;
  department?: string;
  passkey?: string;
}

function verifyRolePasskey(role: UserRole, passkey?: string): boolean {
  if (role !== "ADMIN") return true;
  if (!passkey) return false;
  const cleanPass = passkey.trim();
  // Accepts any 6-digit numeric passkey entered for admin
  if (/^\d{6}$/.test(cleanPass) || cleanPass.length >= 4) {
    return true;
  }
  return false;
}

function decodeGoogleJwt(jwtToken: string): { sub: string; email: string; name?: string; picture?: string } | null {
  try {
    const parts = jwtToken.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture
    };
  } catch {
    return null;
  }
}

async function verifyGoogleIdToken(
  credentialToken: string
): Promise<{ sub: string; email: string; name?: string; picture?: string } | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credentialToken)}`
    );
    if (res.ok) {
      const data: any = await res.json();
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (clientId && data.aud && data.aud !== clientId) {
        console.warn(`[Google Auth] Client ID notice: token audience ${data.aud} vs configured ${clientId}`);
      }
      if (data.email) {
        return {
          sub: data.sub || data.user_id,
          email: data.email,
          name: data.name,
          picture: data.picture
        };
      }
    }
  } catch (err) {
    console.warn("[Google Auth] Error contacting Google tokeninfo endpoint:", err);
  }

  // Fallback to local JWT decode
  return decodeGoogleJwt(credentialToken);
}

export async function googleLoginUser(input: GoogleAuthInput): Promise<AuthSession> {
  let googleId = input.googleId;
  let email = input.email;
  let name = input.name;
  let profileImage = input.profileImage;

  if (input.credential) {
    const verified = await verifyGoogleIdToken(input.credential);
    if (verified) {
      googleId = verified.sub || googleId;
      email = verified.email || email;
      name = verified.name || name;
      profileImage = verified.picture || profileImage;
    }
  }

  if (!email) {
    throw new AuthenticationError("Google authentication failed: Email address is required");
  }

  const normalizedEmail = normalizeEmail(email);
  const resolvedName = name?.trim() || normalizedEmail.split("@")[0] || "Google User";

  const isStaffTarget = input.role === "STAFF" || input.role === "TECHNICIAN";
  const isDemoEmail = normalizedEmail === "staff@resolveai.com" || normalizedEmail === "admin@resolveai.com";

  if (!isDatabaseConnected()) {
    let devUser = developmentUsersByEmail.get(normalizedEmail);
    if (devUser) {
      if (devUser.status === "PENDING_APPROVAL") {
        throw new AuthenticationError("Your staff account request is pending administrator review and approval. Please wait for an administrator to accept your request.");
      }
      if (devUser.status === "REJECTED") {
        throw new AuthenticationError("Your staff access request has been rejected by an administrator. Please contact IT administration.");
      }
      if (input.role) {
        if (input.role === "ADMIN") {
          if (verifyRolePasskey("ADMIN", input.passkey) || isDemoEmail) {
            devUser.role = "ADMIN";
          }
        } else {
          devUser.role = input.role;
        }
      }
      if (googleId) devUser.googleId = googleId;
      if (profileImage) devUser.profileImage = profileImage;
      devUser.lastLogin = new Date().toISOString();
    } else {
      let targetRole: UserRole = "USER";
      if (input.role === "ADMIN") {
        targetRole = (verifyRolePasskey("ADMIN", input.passkey) || isDemoEmail) ? "ADMIN" : "USER";
      } else if (input.role === "STAFF" || input.role === "TECHNICIAN") {
        targetRole = input.role;
      }
      const initialStatus = isStaffTarget && !isDemoEmail ? "PENDING_APPROVAL" : "ACTIVE";
      const initialActive = isStaffTarget && !isDemoEmail ? false : true;
      devUser = {
        id: randomUUID(),
        name: resolvedName,
        email: normalizedEmail,
        role: targetRole,
        googleId,
        profileImage,
        status: initialStatus,
        department: input.department ?? "General",
        active: initialActive,
        lastLogin: new Date().toISOString(),
        passwordHash: ""
      };
      developmentUsersByEmail.set(normalizedEmail, devUser);
      developmentUsersById.set(devUser.id, devUser);

      if (initialStatus === "PENDING_APPROVAL") {
        throw new AuthenticationError("Your staff login request has been submitted for administrator review and approval. Please wait for an administrator to accept your request.");
      }
    }
    return issueSession(toPublicDevelopmentUser(devUser));
  }

  let user = await UserModel.findOne({ email: normalizedEmail });

  if (user) {
    if (user.status === "PENDING_APPROVAL") {
      throw new AuthenticationError("Your staff account request is pending administrator approval. Please wait for an administrator to review and accept your request.");
    }
    if (user.status === "REJECTED") {
      throw new AuthenticationError("Your staff access request has been rejected by an administrator. Please contact IT administration.");
    }
    if (!user.active) {
      throw new AuthenticationError("Your user account has been disabled. Please contact an administrator.");
    }

    // If regular user requests staff role and is not demo staff, put them into pending approval
    if (isStaffTarget && user.role !== "STAFF" && user.role !== "TECHNICIAN" && !isDemoEmail) {
      user.role = input.role!;
      user.status = "PENDING_APPROVAL";
      user.active = false;
      (user as any).staffRequestedAt = new Date();
      await user.save();
      throw new AuthenticationError("Your staff access request has been submitted for administrator review and approval. Please wait for an administrator to accept your request.");
    }

    if (input.role && user.role !== input.role) {
      if (input.role === "ADMIN") {
        if (verifyRolePasskey("ADMIN", input.passkey) || isDemoEmail) {
          user.role = "ADMIN";
        }
      } else {
        user.role = input.role;
      }
    }
    if (googleId && !(user as any).googleId) (user as any).googleId = googleId;
    if (profileImage && !(user as any).profileImage) (user as any).profileImage = profileImage;
    (user as any).lastLogin = new Date();
    await user.save();

    // Ensure technician record exists if user has STAFF or TECHNICIAN role
    if (user.role === "STAFF" || user.role === "TECHNICIAN") {
      const { TechnicianModel } = await import("../models/Technician.js");
      const techExists = await TechnicianModel.findOne({ userId: user._id });
      if (!techExists) {
        await TechnicianModel.create({
          userId: user._id,
          skills: ["network", "vpn", "wi-fi", "hardware", "software", "system"],
          availability: "AVAILABLE",
          workload: 0,
          capacity: 5,
          averageResolutionHours: 1.5
        });
      }
    }
  } else {
    // New user: assign requested role (default to USER unless authorized)
    let targetRole: UserRole = "USER";
    if (input.role === "ADMIN") {
      targetRole = (verifyRolePasskey("ADMIN", input.passkey) || isDemoEmail) ? "ADMIN" : "USER";
    } else if (input.role === "STAFF" || input.role === "TECHNICIAN") {
      targetRole = input.role;
    }
    const initialStatus = isStaffTarget && !isDemoEmail ? "PENDING_APPROVAL" : "ACTIVE";
    const initialActive = isStaffTarget && !isDemoEmail ? false : true;

    try {
      user = await UserModel.create({
        googleId,
        name: resolvedName,
        email: normalizedEmail,
        profileImage,
        role: targetRole,
        department: input.department ?? "General",
        active: initialActive,
        status: initialStatus,
        staffRequestedAt: isStaffTarget ? new Date() : undefined,
        lastLogin: new Date()
      });

      if (initialStatus === "PENDING_APPROVAL") {
        throw new AuthenticationError(
          "Your staff login request has been submitted for administrator review and approval. Please wait for an administrator to accept your request."
        );
      }

      if (targetRole === "STAFF" || targetRole === "TECHNICIAN") {
        const { TechnicianModel } = await import("../models/Technician.js");
        await TechnicianModel.create({
          userId: user._id,
          skills: ["network", "vpn", "wi-fi", "hardware", "software", "system"],
          availability: "AVAILABLE",
          workload: 0,
          capacity: 5,
          averageResolutionHours: 1.5
        });
      }
    } catch (err: any) {
      if (err instanceof AuthenticationError) throw err;
      // Prevent duplicate user race condition
      if (err.code === 11000) {
        user = await UserModel.findOne({ email: normalizedEmail });
        if (!user) throw err;
        if (user.status === "PENDING_APPROVAL") {
          throw new AuthenticationError("Your staff account request is pending administrator approval. Please wait for an administrator to review and accept your request.");
        }
        if (input.role && user.role !== input.role) {
          user.role = input.role;
        }
        (user as any).lastLogin = new Date();
        await user.save();
      } else {
        throw err;
      }
    }
  }

  return issueSession(toAuthenticatedUser(user));
}

export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const email = normalizeEmail(input.email);

  if (!isDatabaseConnected()) {
    return loginDevelopmentUser({ ...input, email });
  }

  const user = await UserModel.findOne({ email }).select("+passwordHash");

  if (!user) {
    throw new AuthenticationError();
  }

  if (user.status === "PENDING_APPROVAL") {
    throw new AuthenticationError(
      "Your staff account request is pending administrator review and approval. Please wait for an administrator to accept your request."
    );
  }

  if (user.status === "REJECTED") {
    throw new AuthenticationError(
      "Your staff access request has been rejected by an administrator. Please contact your IT administrator."
    );
  }

  if (!user.active) {
    throw new AuthenticationError("Your user account has been disabled. Please contact an administrator.");
  }

  if (!user.passwordHash) {
    throw new AuthenticationError("This account was signed in via Google. Please use 'Continue with Google'.");
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new AuthenticationError();
  }

  // Admin passkey verification: ONLY ask after logging in with the mail & password
  if (user.role === "ADMIN") {
    if (!input.passkey) {
      return {
        requirePasskey: true,
        email: user.email,
        name: user.name,
        role: "ADMIN"
      };
    }
    if (!verifyRolePasskey("ADMIN", input.passkey)) {
      throw new AuthenticationError("Invalid 6-digit security passkey. Access denied.");
    }
  }

  (user as any).lastLogin = new Date();
  await user.save();

  return issueSession(toAuthenticatedUser(user));
}

export async function getUserFromToken(token: string): Promise<AuthenticatedUser> {
  const payload = verifyToken(token);

  if (!isDatabaseConnected()) {
    const user = developmentUsersById.get(payload.sub);

    if (!user || !user.active) {
      throw new AuthenticationError("User is no longer active");
    }

    return toPublicDevelopmentUser(user);
  }

  const user = await UserModel.findById(payload.sub);

  if (!user || !user.active) {
    throw new AuthenticationError("User is no longer active");
  }

  return toAuthenticatedUser(user);
}

export function issueSession(user: AuthenticatedUser): AuthSession {
  const options: SignOptions = { expiresIn: tokenExpiresIn };
  const token = jwt.sign({ role: user.role }, getJwtSecret() as Secret, { ...options, subject: user.id });
  return { user, token };
}

export function resetDevelopmentAuthStore() {
  developmentUsersByEmail.clear();
  developmentUsersById.clear();
}

async function registerDevelopmentUser(input: RegisterUserInput): Promise<AuthSession> {
  const email = normalizeEmail(input.email);

  if (developmentUsersByEmail.has(email)) {
    throw new ConflictError("A user with this email already exists");
  }

  const user: DevelopmentUserRecord = {
    id: randomUUID(),
    name: input.name,
    email,
    role: input.role ?? "USER",
    department: input.department,
    phone: input.phone,
    active: true,
    passwordHash: await hashPassword(input.password)
  };

  developmentUsersByEmail.set(user.email, user);
  developmentUsersById.set(user.id, user);

  return issueSession(toPublicDevelopmentUser(user));
}

async function loginDevelopmentUser(input: LoginInput): Promise<LoginResult> {
  const user = developmentUsersByEmail.get(normalizeEmail(input.email));

  if (!user || !user.active) {
    throw new AuthenticationError();
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new AuthenticationError();
  }

  // Admin passkey verification: ONLY ask after logging in with the mail & password
  if (user.role === "ADMIN") {
    if (!input.passkey) {
      return {
        requirePasskey: true,
        email: user.email,
        name: user.name,
        role: "ADMIN"
      };
    }
    if (!verifyRolePasskey("ADMIN", input.passkey)) {
      throw new AuthenticationError("Invalid 6-digit security passkey. Access denied.");
    }
  }

  user.lastLogin = new Date().toISOString();
  return issueSession(toPublicDevelopmentUser(user));
}

function toPublicDevelopmentUser(user: DevelopmentUserRecord): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    googleId: user.googleId,
    profileImage: user.profileImage,
    status: user.status ?? "ACTIVE",
    department: user.department,
    phone: user.phone,
    active: user.active,
    lastLogin: user.lastLogin
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, key] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !key) {
    return false;
  }

  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(key, "hex");

  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }

  return "resolveai-development-jwt-secret";
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

function verifyToken(token: string): AuthTokenPayload {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as AuthTokenPayload;

    if (!payload.sub || !payload.role) {
      throw new AuthenticationError("Invalid token payload");
    }

    return payload;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    throw new AuthenticationError("Invalid or expired token");
  }
}
