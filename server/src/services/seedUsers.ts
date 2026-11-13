import { UserModel } from "../models/User.js";
import { registerUser } from "./authService.js";
import mongoose from "mongoose";

export async function seedDefaultUsers() {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    if (!isConnected) {
      console.log("Database not connected, skipping user seed or using in-memory store.");
    }

    const adminEmail = "admin@resolveai.com";
    const staffEmail = "staff@resolveai.com";
    const userEmail = "user@resolveai.com";

    // Check if users already exist
    let adminExists = false;
    let staffExists = false;
    let userExists = false;

    if (isConnected) {
      // Upsert demo users — always ensure correct roles even if they already exist
      const adminUser = await UserModel.findOne({ email: adminEmail });
      const staffUser2 = await UserModel.findOne({ email: staffEmail });
      const regularUser = await UserModel.findOne({ email: userEmail });

      adminExists = Boolean(adminUser);
      staffExists = Boolean(staffUser2);
      userExists = Boolean(regularUser);

      // Fix roles if they exist but have wrong role
      if (adminUser && adminUser.role !== "ADMIN") {
        await UserModel.updateOne({ email: adminEmail }, { $set: { role: "ADMIN" } });
        console.log(`Fixed admin role for ${adminEmail}`);
      }
      if (staffUser2 && staffUser2.role !== "STAFF") {
        await UserModel.updateOne({ email: staffEmail }, { $set: { role: "STAFF" } });
        console.log(`Fixed staff role for ${staffEmail}`);
      }
      if (regularUser && regularUser.role !== "USER") {
        await UserModel.updateOne({ email: userEmail }, { $set: { role: "USER" } });
        console.log(`Fixed user role for ${userEmail}`);
      }
    }

    if (!adminExists) {
      try {
        await registerUser({
          name: "System Administrator",
          email: adminEmail,
          password: "admin123",
          role: "ADMIN",
          department: "IT Infrastructure",
          phone: "+1 (555) 019-2834"
        });
        console.log(`Default Admin seeded: ${adminEmail} / admin123`);
      } catch (err: any) {
        if (!err.message?.includes("already exists")) {
          console.warn("Failed to seed admin user:", err.message);
        }
      }
    }

    if (!staffExists) {
      try {
        await registerUser({
          name: "Sam Staff",
          email: staffEmail,
          password: "staff123",
          role: "STAFF",
          department: "IT Support",
          phone: "+1 (555) 024-6810"
        });
        console.log(`Default Staff seeded: ${staffEmail} / staff123`);
      } catch (err: any) {
        if (!err.message?.includes("already exists")) {
          console.warn("Failed to seed staff user:", err.message);
        }
      }
    }

    if (isConnected) {
      // Ensure technician record exists for Sam Staff
      const staffUser = await UserModel.findOne({ email: staffEmail });
      if (staffUser) {
        const { TechnicianModel } = await import("../models/Technician.js");
        const techExists = await TechnicianModel.findOne({ userId: staffUser._id });
        if (!techExists) {
          await TechnicianModel.create({
            userId: staffUser._id,
            skills: ["network", "vpn", "wi-fi", "hardware", "software", "system"],
            availability: "AVAILABLE",
            workload: 1,
            capacity: 5,
            averageResolutionHours: 1.5
          });
          console.log(`Technician profile seeded for ${staffEmail}`);
        }
      }

      // Seed a sample escalated ticket with rich AI troubleshooting & RAG context if empty
      const { TicketModel } = await import("../models/Ticket.js");
      const ticketCount = await TicketModel.countDocuments();
      if (ticketCount === 0) {
        const alexUser = await UserModel.findOne({ email: userEmail });
        const samStaff = await UserModel.findOne({ email: staffEmail });
        if (alexUser) {
          await TicketModel.create({
            title: "Production VPN gateway disconnects repeatedly during video conference calls",
            description: "Whenever I initiate a high-bandwidth video meeting over the GlobalProtect VPN tunnel, the connection terminates after 45-60 seconds. Error displayed: 'Gateway handshake timeout (code 0x8007274c)'.",
            category: "vpn",
            severity: "HIGH",
            priority: "P2",
            status: "OPEN",
            userId: alexUser._id,
            technicianId: samStaff?._id,
            aiConfidence: 0.42,
            attemptedActions: [
              "Flush DNS Cache & Reset TCP/IP Stack",
              "Switch VPN Protocol from UDP to TCP (Port 443)",
              "Reinstall Virtual Network Adapter Drivers"
            ],
            failedActions: [
              "Switch VPN Protocol from UDP to TCP (Port 443)",
              "Reinstall Virtual Network Adapter Drivers"
            ],
            ragSources: [
              "KB-8821: Enterprise VPN MTU and TCP MSS Clamping Standard",
              "SOP-402: Resolving Handshake Dropouts on Cisco AnyConnect & GlobalProtect",
              "SEC-109: Firewall Deep Packet Inspection Bypass Exceptions"
            ],
            escalationReason: "Automated remediation failed after 3 adaptive steps. AI confidence dropped below threshold (0.42 < 0.65). Requires tier-2 network engineer intervention.",
            assignedAt: new Date(),
            technicianActions: [
              {
                action: "Initial Diagnostic Review",
                notes: "Reviewed firewall tunnel telemetry. Suspecting MTU fragmentation packet drops on uplink ISP.",
                outcome: "INVESTIGATING",
                performedBy: samStaff?._id,
                performedByName: samStaff?.name || "Sam Staff",
                createdAt: new Date()
              }
            ]
          });

          await TicketModel.create({
            title: "Hardware kernel panic on MacBook M2 Pro after macOS Sequoia upgrade",
            description: "Laptop crashes into kernel panic trap 14 when connecting external dual 4K DisplayPort monitors via Thunderbolt 4 dock.",
            category: "hardware",
            severity: "CRITICAL",
            priority: "P1",
            status: "IN_PROGRESS",
            userId: alexUser._id,
            technicianId: samStaff?._id,
            aiConfidence: 0.35,
            attemptedActions: [
              "Reset SMC & NVRAM on Apple Silicon",
              "Update DisplayLink Manager to v1.11 Beta"
            ],
            failedActions: [
              "Update DisplayLink Manager to v1.11 Beta"
            ],
            ragSources: [
              "HW-702: Apple Silicon Thunderbolt PCIe Allocation Matrix",
              "KB-9041: DisplayPort Multi-Stream Transport (MST) Limitations on macOS"
            ],
            escalationReason: "Critical hardware instability cannot be resolved remotely by automated agent. Device requires physical firmware inspection or dock replacement.",
            assignedAt: new Date(Date.now() - 3600000 * 2),
            technicianActions: [
              {
                action: "Dock Firmware Flashing",
                notes: "Flashing DisplayLink hub to revision 2.14.3. User reported fewer flicker events.",
                outcome: "PARTIAL",
                performedBy: samStaff?._id,
                performedByName: samStaff?.name || "Sam Staff",
                createdAt: new Date(Date.now() - 1800000)
              }
            ]
          });
          console.log("Seeded sample escalated tickets with rich AI context");
        }
      }
    }

    if (!userExists) {
      try {
        await registerUser({
          name: "Alex User",
          email: userEmail,
          password: "user123",
          role: "USER",
          department: "Product Engineering",
          phone: "+1 (555) 012-3456"
        });
        console.log(`Default User seeded: ${userEmail} / user123`);
      } catch (err: any) {
        if (!err.message?.includes("already exists")) {
          console.warn("Failed to seed regular user:", err.message);
        }
      }
    }
  } catch (error) {
    console.error("Error during default user seeding:", error);
  }
}
