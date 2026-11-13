import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { buildApp } from "../app.js";
import { resetDevelopmentAuthStore, registerUser } from "../services/authService.js";

describe("Auth Routes & Role Authorization API Tests", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = buildApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === "object" && addr) {
          baseUrl = `http://127.0.0.1:${addr.port}/api`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    resetDevelopmentAuthStore();
  });

  describe("POST /api/auth/google", () => {
    it("authenticates a new Google user and assigns role USER by default", async () => {
      const res = await fetch(`${baseUrl}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleId: "google-10101",
          email: "google.employee@example.com",
          name: "Google Employee",
          profileImage: "https://example.com/avatar.jpg"
        })
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.user).toBeDefined();
      expect(data.token).toBeDefined();
      expect(data.user.email).toBe("google.employee@example.com");
      expect(data.user.role).toBe("USER");
      expect(data.user.googleId).toBe("google-10101");
      expect(data.user.profileImage).toBe("https://example.com/avatar.jpg");
    });

    it("prevents new Google user from self-elevating to STAFF or ADMIN", async () => {
      const res = await fetch(`${baseUrl}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleId: "google-attacker",
          email: "attacker@example.com",
          name: "Attacker",
          role: "ADMIN"
        })
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      // Role MUST remain USER
      expect(data.user.role).toBe("USER");
    });

    it("preserves existing role for STAFF and ADMIN users", async () => {
      // Register an existing staff member first
      await registerUser({
        name: "Dev Staff",
        email: "staff.ops@resolveai.com",
        password: "StaffPassword123!",
        role: "STAFF",
        department: "Operations"
      });

      // Staff member signs in via Google with passkey
      const res = await fetch(`${baseUrl}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleId: "google-staff-id",
          email: "staff.ops@resolveai.com",
          name: "Dev Staff",
          passkey: "654321"
        })
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.user.role).toBe("STAFF");
      expect(data.user.googleId).toBe("google-staff-id");
    });

    it("prevents duplicate accounts on repeated logins", async () => {
      const payload = {
        googleId: "google-idempotent",
        email: "idempotent@resolveai.com",
        name: "Idempotent User"
      };

      const res1 = await fetch(`${baseUrl}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data1: any = await res1.json();

      const res2 = await fetch(`${baseUrl}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data2: any = await res2.json();

      expect(data1.user.id).toBe(data2.user.id);
      expect(data1.user.email).toBe(data2.user.email);
    });
  });

  describe("GET /api/auth/me", () => {
    it("restores the authenticated user with a valid Bearer token", async () => {
      const loginRes = await fetch(`${baseUrl}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleId: "google-me-test",
          email: "restore.me@example.com",
          name: "Restore Me"
        })
      });
      const session: any = await loginRes.json();

      const meRes = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });

      expect(meRes.status).toBe(200);
      const meData: any = await meRes.json();
      expect(meData.user.id).toBe(session.user.id);
      expect(meData.user.email).toBe("restore.me@example.com");
      expect(meData.user.role).toBe("USER");
    });

    it("rejects requests with missing or invalid token", async () => {
      const noAuthRes = await fetch(`${baseUrl}/auth/me`);
      expect(noAuthRes.status).toBe(401);

      const invalidTokenRes = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: "Bearer bad-token-1234" }
      });
      expect(invalidTokenRes.status).toBe(401);
    });
  });

  describe("Role-Based Backend Authorization", () => {
    it("blocks USER role from accessing ADMIN endpoints with 403 Forbidden", async () => {
      const loginRes = await fetch(`${baseUrl}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleId: "google-regular-user",
          email: "regular@example.com",
          name: "Regular User"
        })
      });
      const session: any = await loginRes.json();
      expect(session.user.role).toBe("USER");

      // Attempt admin overview access
      const adminRes = await fetch(`${baseUrl}/admin/overview`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      expect(adminRes.status).toBe(403);
    });

    it("blocks USER role from accessing STAFF endpoints with 403 Forbidden", async () => {
      const loginRes = await fetch(`${baseUrl}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleId: "google-regular-user-2",
          email: "regular2@example.com",
          name: "Regular User 2"
        })
      });
      const session: any = await loginRes.json();

      // Attempt staff overview access
      const staffRes = await fetch(`${baseUrl}/staff/overview`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      expect(staffRes.status).toBe(403);
    });

    it("allows ADMIN role to access ADMIN endpoints", async () => {
      // Register an admin user
      const adminReg = await registerUser({
        name: "Sys Admin",
        email: "sysadmin@resolveai.com",
        password: "AdminPassword123!",
        role: "ADMIN"
      });

      const adminRes = await fetch(`${baseUrl}/admin/overview`, {
        headers: { Authorization: `Bearer ${adminReg.token}` }
      });
      expect(adminRes.status).toBe(200);
    });

    it("allows STAFF role to access STAFF endpoints", async () => {
      // Register a staff user
      const staffReg = await registerUser({
        name: "Tech Specialist",
        email: "techspec@resolveai.com",
        password: "StaffPassword123!",
        role: "STAFF"
      });

      const staffRes = await fetch(`${baseUrl}/staff/overview`, {
        headers: { Authorization: `Bearer ${staffReg.token}` }
      });
      expect(staffRes.status).toBe(200);
    });
  });
});
