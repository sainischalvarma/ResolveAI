import { beforeEach, describe, expect, it } from "vitest";
import {
  getUserFromToken,
  googleLoginUser,
  loginUser,
  registerUser,
  resetDevelopmentAuthStore
} from "./authService.js";

describe("authService authentication & Google OAuth flow", () => {
  beforeEach(() => {
    resetDevelopmentAuthStore();
  });

  it("registers, logs in, and resolves the current user without a database connection", async () => {
    const registered = await registerUser({
      name: "Demo User",
      email: "Demo.User@example.com",
      password: "password123",
      role: "TECHNICIAN",
      department: "Support"
    });

    expect(registered.user.email).toBe("demo.user@example.com");
    expect(registered.user.role).toBe("TECHNICIAN");
    expect(registered.token).toBeTruthy();

    const loggedIn = await loginUser({
      email: "demo.user@example.com",
      password: "password123"
    });

    expect("user" in loggedIn).toBe(true);
    if (!("user" in loggedIn)) throw new Error("Expected session");
    expect(loggedIn.user.id).toBe(registered.user.id);

    const currentUser = await getUserFromToken(loggedIn.token);
    expect(currentUser).toMatchObject({
      id: registered.user.id,
      email: "demo.user@example.com",
      department: "Support"
    });
  });

  describe("Google Authentication", () => {
    it("creates a new Google user with role USER by default", async () => {
      const session = await googleLoginUser({
        googleId: "google-uid-12345",
        email: "newuser@example.com",
        name: "New Google User",
        profileImage: "https://example.com/avatar.png"
      });

      expect(session.user).toMatchObject({
        email: "newuser@example.com",
        name: "New Google User",
        role: "USER",
        googleId: "google-uid-12345",
        profileImage: "https://example.com/avatar.png"
      });
      expect(session.token).toBeTruthy();

      // Session can be restored via getUserFromToken (used by /api/auth/me)
      const restored = await getUserFromToken(session.token);
      expect(restored.id).toBe(session.user.id);
      expect(restored.role).toBe("USER");
    });

    it("prevents new Google user from self-assigning ADMIN or STAFF roles", async () => {
      const session = await googleLoginUser({
        googleId: "google-uid-hacker",
        email: "attacker@example.com",
        name: "Attacker",
        role: "ADMIN" // Attempt to self-elevate
      });

      // Strict enforcement: new Google users MUST be USER
      expect(session.user.role).toBe("USER");
    });

    it("preserves existing role for existing STAFF and ADMIN users logging in via Google", async () => {
      // Create an existing staff user
      const existingStaff = await registerUser({
        name: "Staff Member",
        email: "staff.member@resolveai.com",
        password: "staffPassword123!",
        role: "STAFF",
        department: "IT Operations"
      });
      expect(existingStaff.user.role).toBe("STAFF");

      // Staff logs in via Google with 6-digit passkey
      const googleSession = await googleLoginUser({
        googleId: "google-uid-staff-999",
        email: "staff.member@resolveai.com",
        name: "Staff Member",
        profileImage: "https://example.com/staff-pic.png",
        passkey: "123456"
      });

      // Existing STAFF role is preserved
      expect(googleSession.user.id).toBe(existingStaff.user.id);
      expect(googleSession.user.role).toBe("STAFF");
      expect(googleSession.user.googleId).toBe("google-uid-staff-999");
      expect(googleSession.user.lastLogin).toBeTruthy();
    });

    it("prevents duplicate user creation on repeated Google logins", async () => {
      const login1 = await googleLoginUser({
        googleId: "google-uid-repeat",
        email: "repeat@example.com",
        name: "Repeat User"
      });

      const login2 = await googleLoginUser({
        googleId: "google-uid-repeat",
        email: "repeat@example.com",
        name: "Repeat User"
      });

      // Same user ID, no duplicates
      expect(login1.user.id).toBe(login2.user.id);
      expect(login2.user.lastLogin).toBeTruthy();
    });

    it("updates lastLogin timestamp on each authentication", async () => {
      const session = await googleLoginUser({
        googleId: "google-uid-timestamp",
        email: "time@example.com",
        name: "Time User"
      });

      expect(session.user.lastLogin).toBeTruthy();
    });
  });

  describe("Admin Security Passkey Flow", () => {
    it("requires passkey for ADMIN only after verifying email and password", async () => {
      await registerUser({
        name: "Admin User",
        email: "admin.sec@example.com",
        password: "adminPassword123!",
        role: "ADMIN"
      });

      // Step 1: Login with email & password without passkey
      const step1 = await loginUser({
        email: "admin.sec@example.com",
        password: "adminPassword123!"
      });

      expect("requirePasskey" in step1).toBe(true);
      if ("requirePasskey" in step1) {
        expect(step1.requirePasskey).toBe(true);
        expect(step1.email).toBe("admin.sec@example.com");
        expect(step1.role).toBe("ADMIN");
      }

      // Step 2: Complete login with 6-digit passkey
      const step2 = await loginUser({
        email: "admin.sec@example.com",
        password: "adminPassword123!",
        passkey: "654321"
      });

      expect("user" in step2).toBe(true);
      if ("user" in step2) {
        expect(step2.user.role).toBe("ADMIN");
        expect(step2.token).toBeTruthy();
      }
    });

    it("does not require passkey for USER or STAFF login", async () => {
      await registerUser({
        name: "Normal Staff",
        email: "staff@resolveai.com",
        password: "staffPassword123!",
        role: "STAFF"
      });

      const staffLogin = await loginUser({
        email: "staff@resolveai.com",
        password: "staffPassword123!"
      });

      expect("user" in staffLogin).toBe(true);
      if ("user" in staffLogin) {
        expect(staffLogin.user.role).toBe("STAFF");
      }
    });
  });
});

