import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { googleLoginUser, getUserFromToken, registerUser } from "../src/services/authService.js";
import { UserModel } from "../src/models/User.js";

async function runVerification() {
  console.log("=== ResolveAI Google Authentication Verification ===");

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI not found in environment");
    process.exit(1);
  }

  console.log("1. Connecting to MongoDB Atlas...");
  try {
    await mongoose.connect(mongoUri);
    console.log("   Connected to MongoDB Atlas successfully!");
  } catch (err: any) {
    console.warn("   Atlas connection notice (continuing with memory mode check):", err.message);
  }

  const testEmail = `google.test.${Date.now()}@example.com`;
  const testGoogleId = `google-id-${Date.now()}`;

  // Test 1: New Google User Registration
  console.log("\n2. Testing New Google User registration...");
  const newSession = await googleLoginUser({
    googleId: testGoogleId,
    email: testEmail,
    name: "Dr. Alice Tester",
    profileImage: "https://lh3.googleusercontent.com/a/test-avatar",
    role: "ADMIN" // malicious attempt to claim ADMIN
  });

  console.log("   User created successfully:");
  console.log(`   - ID: ${newSession.user.id}`);
  console.log(`   - Email: ${newSession.user.email}`);
  console.log(`   - Name: ${newSession.user.name}`);
  console.log(`   - Role: ${newSession.user.role}`);
  console.log(`   - Google ID: ${newSession.user.googleId}`);
  console.log(`   - Profile Image: ${newSession.user.profileImage}`);

  if (newSession.user.role !== "USER") {
    throw new Error(`SECURITY FAILURE: New Google user received role ${newSession.user.role} instead of USER`);
  }
  console.log("   Security check passed: New Google user strictly assigned role USER.");

  // Test 2: Login Persistence via /api/auth/me token resolution
  console.log("\n3. Testing Token Resolution (/api/auth/me equivalent)...");
  const restoredUser = await getUserFromToken(newSession.token);
  if (restoredUser.id !== newSession.user.id || restoredUser.email !== testEmail) {
    throw new Error("Login persistence failed: Restored user does not match session user");
  }
  console.log("   Persistence check passed: Token resolves to authenticated user.");

  // Test 3: Existing Google User Login (Duplicate prevention & role preservation)
  console.log("\n4. Testing Existing Google User Login & Duplicate Prevention...");
  const repeatSession = await googleLoginUser({
    googleId: testGoogleId,
    email: testEmail,
    name: "Dr. Alice Tester Updated",
    profileImage: "https://lh3.googleusercontent.com/a/test-avatar-updated"
  });

  if (repeatSession.user.id !== newSession.user.id) {
    throw new Error(`Duplicate prevention failed: Created new user ID ${repeatSession.user.id} instead of reusing ${newSession.user.id}`);
  }
  console.log("   Duplicate prevention check passed: Existing user preserved without duplication.");

  // Test 4: Existing STAFF/ADMIN Role Preservation
  console.log("\n5. Testing Role Preservation for Existing STAFF / ADMIN...");
  const staffEmail = `staff.member.${Date.now()}@resolveai.com`;
  
  if (mongoose.connection.readyState === 1) {
    await UserModel.create({
      name: "Sam Staff",
      email: staffEmail,
      role: "STAFF",
      active: true,
      status: "ACTIVE"
    });
  } else {
    await registerUser({
      name: "Sam Staff",
      email: staffEmail,
      password: "staffPassword123!",
      role: "STAFF"
    });
  }

  const staffGoogleSession = await googleLoginUser({
    googleId: `google-staff-${Date.now()}`,
    email: staffEmail,
    name: "Sam Staff",
    passkey: "123456"
  });

  if (staffGoogleSession.user.role !== "STAFF") {
    throw new Error(`Role preservation failed: Expected STAFF, got ${staffGoogleSession.user.role}`);
  }
  console.log(`   Role preservation check passed: Existing user retained ${staffGoogleSession.user.role} role.`);

  // Cleanup test documents if connected to Atlas
  if (mongoose.connection.readyState === 1) {
    await UserModel.deleteMany({ email: { $in: [testEmail, staffEmail] } });
    console.log("\n6. Cleaned up temporary test documents in MongoDB Atlas.");
    await mongoose.disconnect();
  }

  console.log("\n=== ALL GOOGLE AUTHENTICATION TESTS PASSED SUCCESSFULLY! ===");
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
