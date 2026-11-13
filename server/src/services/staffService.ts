import mongoose from "mongoose";
import type { AuthenticatedUser, Priority, Severity, TicketStatus } from "@resolveai/shared";
import {
  TicketModel,
  UserModel,
  TechnicianModel,
  TicketReplyModel,
  TroubleshootingSessionModel,
  ActionOutcomeModel,
  ConversationModel,
  MessageModel,
  KnowledgeDocumentModel,
  AuditLogModel
} from "../models/index.js";
import { createNotification } from "./notificationService.js";
import { AssignmentService } from "./assignment/AssignmentService.js";
import { createRagService } from "./rag/RagService.js";

function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function isStaffOrAdmin(user: AuthenticatedUser): boolean {
  return user.role === "STAFF" || user.role === "TECHNICIAN" || user.role === "ADMIN";
}

/* ------------------------------------------------------------------ */
/*  In-memory fallback store for development/testing                   */
/* ------------------------------------------------------------------ */

export interface DevStaffTicket {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: Severity;
  priority: Priority;
  status: TicketStatus;
  userId: string;
  userName: string;
  userEmail: string;
  userDepartment?: string;
  userPhone?: string;
  technicianId?: string | null;
  technicianName?: string | null;
  aiConfidence: number;
  attemptedActions: string[];
  failedActions: string[];
  ragSources: string[];
  escalationReason: string;
  assignedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  resolution?: {
    summary: string;
    rootCause?: string;
    actionsTaken: string[];
    kbRecommendation?: string;
    resolvedBy?: string;
    resolvedByName?: string;
    resolvedAt?: string;
  };
  technicianActions: Array<{
    id: string;
    action: string;
    notes?: string;
    outcome: "SUCCESS" | "FAILED" | "PARTIAL" | "INVESTIGATING";
    performedBy?: string;
    performedByName?: string;
    createdAt: string;
  }>;
  replies: Array<{
    id: string;
    senderId: string;
    senderRole: string;
    message: string;
    createdAt: string;
  }>;
}

interface DevTechnicianProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  department: string;
  phone: string;
  skills: string[];
  availability: "AVAILABLE" | "BUSY" | "OFFLINE";
  workload: number;
  capacity: number;
  averageResolutionHours: number;
}

const devTechnicians: Map<string, DevTechnicianProfile> = new Map([
  [
    "staff-sam-id",
    {
      id: "tech-sam-1",
      userId: "staff-sam-id",
      name: "Sam Staff",
      email: "staff@resolveai.com",
      department: "IT Support",
      phone: "+1 (555) 024-6810",
      skills: ["network", "vpn", "wi-fi", "hardware", "software", "system"],
      availability: "AVAILABLE",
      workload: 1,
      capacity: 5,
      averageResolutionHours: 1.5
    }
  ]
]);

export const devStaffTickets: Map<string, DevStaffTicket> = new Map([
  [
    "ticket-dev-1",
    {
      id: "ticket-dev-1",
      title: "Production VPN gateway disconnects repeatedly during video conference calls",
      description: "Whenever I initiate a high-bandwidth video meeting over the GlobalProtect VPN tunnel, the connection terminates after 45-60 seconds. Error displayed: 'Gateway handshake timeout (code 0x8007274c)'.",
      category: "vpn",
      severity: "HIGH",
      priority: "P2",
      status: "ASSIGNED",
      userId: "user-alex-id",
      userName: "Alex User",
      userEmail: "user@resolveai.com",
      userDepartment: "Product Engineering",
      userPhone: "+1 (555) 012-3456",
      technicianId: "staff-sam-id",
      technicianName: "Sam Staff",
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
      assignedAt: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      updatedAt: new Date(Date.now() - 1800000).toISOString(),
      technicianActions: [
        {
          id: "tact-1",
          action: "Initial Diagnostic Review",
          notes: "Reviewed firewall tunnel telemetry. Suspecting MTU fragmentation packet drops on uplink ISP.",
          outcome: "INVESTIGATING",
          performedBy: "staff-sam-id",
          performedByName: "Sam Staff",
          createdAt: new Date(Date.now() - 1800000).toISOString()
        }
      ],
      replies: [
        {
          id: "rep-dev-1",
          senderId: "user-alex-id",
          senderRole: "USER",
          message: "The disconnection happens consistently with Zoom and Google Meet.",
          createdAt: new Date(Date.now() - 3600000).toISOString()
        }
      ]
    }
  ],
  [
    "ticket-dev-2",
    {
      id: "ticket-dev-2",
      title: "Hardware kernel panic on MacBook M2 Pro after macOS Sequoia upgrade",
      description: "Laptop crashes into kernel panic trap 14 when connecting external dual 4K DisplayPort monitors via Thunderbolt 4 dock.",
      category: "hardware",
      severity: "CRITICAL",
      priority: "P1",
      status: "OPEN",
      userId: "user-alex-id",
      userName: "Alex User",
      userEmail: "user@resolveai.com",
      userDepartment: "Product Engineering",
      userPhone: "+1 (555) 012-3456",
      technicianId: null,
      technicianName: null,
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
      createdAt: new Date(Date.now() - 5400000).toISOString(),
      updatedAt: new Date(Date.now() - 5400000).toISOString(),
      technicianActions: [],
      replies: []
    }
  ]
]);

export function getDevStaffTicketsMap(): Map<string, DevStaffTicket> {
  return devStaffTickets;
}

/* ------------------------------------------------------------------ */
/*  1. STAFF OVERVIEW STATISTICS                                       */
/* ------------------------------------------------------------------ */

export async function getStaffOverview(user: AuthenticatedUser) {
  if (!isStaffOrAdmin(user)) {
    throw new Error("Access denied: Staff or Admin role required");
  }

  if (!isDatabaseConnected()) {
    const tickets = Array.from(devStaffTickets.values());
    const assignedTickets = tickets.filter(
      (t) => (user.role === "ADMIN" ? Boolean(t.technicianId) : t.technicianId === user.id) &&
        t.status !== "RESOLVED" && t.status !== "CLOSED"
    ).length;
    const openTickets = tickets.filter((t) => t.status === "OPEN").length;
    const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS").length;
    const waitingForUser = tickets.filter((t) => t.status === "WAITING_FOR_USER").length;
    const resolvedToday = tickets.filter(
      (t) => (t.status === "RESOLVED" || t.status === "CLOSED")
    ).length;
    const highPriorityTickets = tickets.filter(
      (t) => (t.priority === "P1" || t.priority === "P2") && t.status !== "RESOLVED" && t.status !== "CLOSED"
    ).length;

    return {
      assignedTickets,
      openTickets,
      inProgress,
      waitingForUser,
      resolvedToday,
      highPriorityTickets,
      totalTickets: tickets.length
    };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    assignedTickets,
    openTickets,
    inProgress,
    waitingForUser,
    resolvedToday,
    highPriorityTickets,
    totalTickets
  ] = await Promise.all([
    // Assigned to this technician (or all assigned if ADMIN)
    TicketModel.countDocuments(
      user.role === "ADMIN"
        ? { technicianId: { $ne: null }, status: { $nin: ["RESOLVED", "CLOSED"] } }
        : { technicianId: new mongoose.Types.ObjectId(user.id), status: { $nin: ["RESOLVED", "CLOSED"] } }
    ),
    TicketModel.countDocuments({ status: "OPEN" }),
    TicketModel.countDocuments({ status: "IN_PROGRESS" }),
    TicketModel.countDocuments({ status: "WAITING_FOR_USER" }),
    TicketModel.countDocuments({
      status: { $in: ["RESOLVED", "CLOSED"] },
      $or: [{ resolvedAt: { $gte: startOfDay } }, { updatedAt: { $gte: startOfDay } }]
    }),
    TicketModel.countDocuments({
      priority: { $in: ["P1", "P2"] },
      status: { $nin: ["RESOLVED", "CLOSED"] }
    }),
    TicketModel.countDocuments()
  ]);

  return {
    assignedTickets,
    openTickets,
    inProgress,
    waitingForUser,
    resolvedToday,
    highPriorityTickets,
    totalTickets
  };
}

/* ------------------------------------------------------------------ */
/*  2. TICKET QUEUE                                                    */
/* ------------------------------------------------------------------ */

export interface StaffTicketQuery {
  assignedToMe?: boolean;
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export async function listStaffTickets(user: AuthenticatedUser, query: StaffTicketQuery = {}) {
  if (!isStaffOrAdmin(user)) {
    throw new Error("Access denied: Staff or Admin role required");
  }

  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 25));
  const skip = (page - 1) * limit;

  if (!isDatabaseConnected()) {
    let list = Array.from(devStaffTickets.values());

    if (query.assignedToMe) {
      list = list.filter((t) => t.technicianId === user.id);
    }
    if (query.status && query.status !== "ALL") {
      const statuses = query.status.split(",").map((s) => s.trim().toUpperCase());
      list = list.filter((t) => statuses.includes(t.status));
    }
    if (query.priority && query.priority !== "ALL") {
      const p = query.priority.toUpperCase();
      list = list.filter((t) => t.priority === p);
    }
    if (query.category && query.category !== "ALL") {
      const c = query.category.toLowerCase();
      list = list.filter((t) => t.category.toLowerCase() === c);
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.userName.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q)
      );
    }
    if (query.dateFrom) {
      list = list.filter((t) => new Date(t.createdAt) >= new Date(query.dateFrom!));
    }
    if (query.dateTo) {
      list = list.filter((t) => new Date(t.createdAt) <= new Date(query.dateTo!));
    }

    const total = list.length;
    const paginated = list
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(skip, skip + limit);

    return {
      tickets: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  const filter: Record<string, unknown> = {};

  if (query.assignedToMe) {
    filter.technicianId = new mongoose.Types.ObjectId(user.id);
  }
  if (query.status && query.status !== "ALL") {
    const statuses = query.status.split(",").map((s) => s.trim().toUpperCase());
    filter.status = { $in: statuses };
  }
  if (query.priority && query.priority !== "ALL") {
    filter.priority = query.priority.toUpperCase();
  }
  if (query.category && query.category !== "ALL") {
    filter.category = query.category.toLowerCase();
  }
  if (query.search) {
    const qRegex = new RegExp(query.search.trim(), "i");
    // Also match user name by looking up matching users
    const matchedUsers = await UserModel.find({ name: qRegex }).select("_id").lean();
    const userIds = matchedUsers.map((u) => u._id);

    filter.$or = [
      { title: qRegex },
      { description: qRegex },
      { userId: { $in: userIds } }
    ];
  }
  if (query.dateFrom || query.dateTo) {
    const dateRange: Record<string, Date> = {};
    if (query.dateFrom) dateRange.$gte = new Date(query.dateFrom);
    if (query.dateTo) dateRange.$lte = new Date(query.dateTo);
    filter.createdAt = dateRange;
  }

  const [rawTickets, total] = await Promise.all([
    TicketModel.find(filter)
      .populate("userId", "name email department phone")
      .populate("technicianId", "name email department")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    TicketModel.countDocuments(filter)
  ]);

  const tickets = rawTickets.map((t: any) => ({
    id: t._id.toString(),
    title: t.title,
    description: t.description,
    category: t.category,
    severity: t.severity,
    priority: t.priority,
    status: t.status,
    userId: t.userId?._id?.toString() || t.userId?.toString(),
    userName: t.userId?.name || "Unknown User",
    userEmail: t.userId?.email || "",
    userDepartment: t.userId?.department || "General",
    userPhone: t.userId?.phone || "",
    technicianId: t.technicianId?._id?.toString() || t.technicianId?.toString() || null,
    technicianName: t.technicianId?.name || null,
    aiConfidence: t.aiConfidence ?? 0.75,
    attemptedActions: t.attemptedActions ?? [],
    failedActions: t.failedActions ?? [],
    ragSources: t.ragSources ?? [],
    escalationReason: t.escalationReason ?? "Escalated from AI troubleshooting",
    assignedAt: t.assignedAt ? t.assignedAt.toISOString() : null,
    resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
    closedAt: t.closedAt ? t.closedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    technicianActionsCount: t.technicianActions?.length || 0
  }));

  return {
    tickets,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/* ------------------------------------------------------------------ */
/*  3. TICKET DETAILS WITH COMPLETE CONTEXT                            */
/* ------------------------------------------------------------------ */

export async function getStaffTicketDetails(user: AuthenticatedUser, ticketId: string) {
  if (!isStaffOrAdmin(user)) {
    throw new Error("Access denied: Staff or Admin role required");
  }

  if (!isDatabaseConnected()) {
    const ticket = devStaffTickets.get(ticketId);
    if (!ticket) return null;

    return {
      ticket,
      userInfo: {
        id: ticket.userId,
        name: ticket.userName,
        email: ticket.userEmail,
        department: ticket.userDepartment || "General",
        phone: ticket.userPhone || "Not provided"
      },
      problem: {
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        severity: ticket.severity,
        priority: ticket.priority
      },
      aiTroubleshootingHistory: {
        confidence: ticket.aiConfidence,
        attemptedActions: ticket.attemptedActions,
        failedActions: ticket.failedActions,
        successfulActions: ticket.attemptedActions.filter((a) => !ticket.failedActions.includes(a)),
        steps: ticket.attemptedActions.map((action, idx) => ({
          stepNumber: idx + 1,
          actionName: action,
          description: `Executed automated procedure: ${action}`,
          outcome: ticket.failedActions.includes(action) ? "FAILURE" : "PARTIAL",
          userFeedback: ticket.failedActions.includes(action) ? "Step did not solve problem" : "Partial improvement noted"
        })),
        conversation: [
          { role: "user", content: ticket.description, createdAt: ticket.createdAt },
          {
            role: "assistant",
            content: `I've analyzed your issue with ${ticket.category}. Let's attempt the standard remediation procedures.`,
            createdAt: ticket.createdAt
          }
        ]
      },
      ragInfo: {
        sources: ticket.ragSources.map((source, i) => ({
          chunkId: `chunk-${i + 1}`,
          title: source,
          relevance: 0.92 - i * 0.08,
          procedure: source.includes("SOP") || source.includes("KB") ? source : "Standard Remediation Guideline"
        }))
      },
      escalationInfo: {
        reason: ticket.escalationReason,
        confidence: ticket.aiConfidence,
        attemptsCount: ticket.attemptedActions.length,
        lastAttemptedAction: ticket.attemptedActions[ticket.attemptedActions.length - 1] || "None"
      },
      resolution: ticket.resolution || null,
      technicianActions: ticket.technicianActions || [],
      replies: ticket.replies || []
    };
  }

  const ticket = await TicketModel.findById(ticketId)
    .populate("userId", "name email department phone")
    .populate("technicianId", "name email department phone")
    .populate("resolution.resolvedBy", "name email")
    .lean();

  if (!ticket) return null;

  // Retrieve associated replies
  const replies = await TicketReplyModel.find({ ticketId: ticket._id })
    .populate("senderId", "name email role")
    .sort({ createdAt: 1 })
    .lean();

  // Find associated troubleshooting session (by ticketId or by userId)
  let session = await TroubleshootingSessionModel.findOne({ ticketId: ticket._id }).lean();
  if (!session) {
    session = await TroubleshootingSessionModel.findOne({
      userId: ticket.userId,
      category: ticket.category
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  // Find associated conversation messages if available
  let conversationMessages: any[] = [];
  if (session?.conversationId) {
    const conversation = await ConversationModel.findOne({
      conversationId: session.conversationId
    }).lean();
    if (conversation) {
      conversationMessages = await MessageModel.find({
        conversationId: conversation._id
      })
        .sort({ createdAt: 1 })
        .lean();
    }
  }

  const userInfo = {
    id: (ticket.userId as any)?._id?.toString() || ticket.userId?.toString(),
    name: (ticket.userId as any)?.name || "Unknown User",
    email: (ticket.userId as any)?.email || "N/A",
    department: (ticket.userId as any)?.department || "General",
    phone: (ticket.userId as any)?.phone || "Not provided"
  };

  const steps = session?.steps || [];
  const successfulActions = (steps as any[])
    .filter((s: any) => s.outcome === "SUCCESS")
    .map((s: any) => s.actionName);
  const failedActionsFromSteps = (steps as any[])
    .filter((s: any) => s.outcome === "FAILURE")
    .map((s: any) => s.actionName);

  const attemptedActions = ticket.attemptedActions?.length
    ? ticket.attemptedActions
    : (steps as any[]).map((s: any) => s.actionName);

  const failedActions = ticket.failedActions?.length
    ? ticket.failedActions
    : failedActionsFromSteps;

  return {
    ticket: {
      id: ticket._id.toString(),
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      severity: ticket.severity,
      priority: ticket.priority,
      status: ticket.status,
      technicianId: (ticket.technicianId as any)?._id?.toString() || ticket.technicianId?.toString() || null,
      technicianName: (ticket.technicianId as any)?.name || null,
      assignedAt: ticket.assignedAt ? ticket.assignedAt.toISOString() : null,
      resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
      closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString()
    },
    userInfo,
    problem: {
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      severity: ticket.severity,
      priority: ticket.priority
    },
    aiTroubleshootingHistory: {
      confidence: ticket.aiConfidence ?? session?.aiConfidence ?? 0.7,
      attemptedActions,
      failedActions,
      successfulActions,
      steps: (steps as any[]).map((s: any) => ({
        stepNumber: s.stepNumber,
        actionName: s.actionName,
        description: s.description,
        reason: s.reason,
        expectedOutcome: s.expectedOutcome,
        riskLevel: s.riskLevel,
        outcome: s.outcome,
        userFeedback: s.userFeedback,
        completedAt: s.completedAt ? s.completedAt.toISOString() : null
      })),
      conversation: conversationMessages.length
        ? conversationMessages.map((m: any) => ({
            role: m.role,
            content: m.content,
            createdAt: m.createdAt.toISOString()
          }))
        : [
            {
              role: "user",
              content: ticket.description,
              createdAt: ticket.createdAt.toISOString()
            },
            {
              role: "assistant",
              content: `AI evaluated issue in category "${ticket.category}". Diagnostic actions attempted: ${attemptedActions.join(", ") || "Standard assessment"}. Escalation triggered due to: ${ticket.escalationReason || "Manual intervention required."}`,
              createdAt: ticket.createdAt.toISOString()
            }
          ]
    },
    ragInfo: {
      sources: (ticket.ragSources || []).map((source: string, idx: number) => ({
        chunkId: `kb-ref-${idx + 1}`,
        title: source,
        relevance: 0.94 - idx * 0.05,
        procedure: source
      }))
    },
    escalationInfo: {
      reason: ticket.escalationReason || "Automated troubleshooting unable to fully resolve problem",
      confidence: ticket.aiConfidence ?? 0.5,
      attemptsCount: attemptedActions.length,
      lastAttemptedAction: attemptedActions[attemptedActions.length - 1] || "None"
    },
    resolution: ticket.resolution
      ? {
          summary: ticket.resolution.summary,
          rootCause: ticket.resolution.rootCause,
          actionsTaken: ticket.resolution.actionsTaken,
          kbRecommendation: ticket.resolution.kbRecommendation,
          resolvedByName: (ticket.resolution.resolvedBy as any)?.name || ticket.resolution.resolvedByName || "Staff",
          resolvedAt: ticket.resolution.resolvedAt ? ticket.resolution.resolvedAt.toISOString() : null
        }
      : null,
    technicianActions: (ticket.technicianActions || []).map((a: any) => ({
      id: a._id.toString(),
      action: a.action,
      notes: a.notes,
      outcome: a.outcome,
      performedByName: a.performedByName,
      createdAt: a.createdAt ? a.createdAt.toISOString() : new Date().toISOString()
    })),
    replies: replies.map((r: any) => ({
      id: r._id.toString(),
      senderId: (r.senderId as any)?._id?.toString() || r.senderId?.toString(),
      senderName: (r.senderId as any)?.name || (r.senderRole === "USER" ? userInfo.name : "Staff"),
      senderRole: r.senderRole,
      message: r.message,
      createdAt: r.createdAt.toISOString()
    }))
  };
}

/* ------------------------------------------------------------------ */
/*  4. TECHNICIAN ACTIONS                                              */
/* ------------------------------------------------------------------ */

/**
 * Technician accepts ticket, assigning it to themselves.
 */
export async function acceptTicket(user: AuthenticatedUser, ticketId: string) {
  if (!isStaffOrAdmin(user)) {
    throw new Error("Access denied: Staff or Admin role required");
  }

  if (!isDatabaseConnected()) {
    const ticket = devStaffTickets.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");

    ticket.technicianId = user.id;
    ticket.technicianName = user.name;
    ticket.status = "ASSIGNED";
    ticket.assignedAt = new Date().toISOString();
    ticket.updatedAt = new Date().toISOString();

    ticket.technicianActions.push({
      id: `tact-${Date.now()}`,
      action: "Ticket Accepted",
      notes: `Technician ${user.name} accepted assignment`,
      outcome: "SUCCESS",
      performedBy: user.id,
      performedByName: user.name,
      createdAt: new Date().toISOString()
    });

    const tech = devTechnicians.get(user.id);
    if (tech) tech.workload = (tech.workload || 0) + 1;

    await createNotification({
      userId: ticket.userId,
      type: "TECHNICIAN_ASSIGNED",
      title: "Technician Assigned",
      message: `${user.name} has accepted your ticket and is preparing to work on it.`,
      relatedTicketId: ticket.id
    });

    return ticket;
  }

  const ticket = await TicketModel.findById(ticketId);
  if (!ticket) throw new Error("Ticket not found");

  ticket.technicianId = new mongoose.Types.ObjectId(user.id);
  ticket.status = "ASSIGNED";
  ticket.assignedAt = new Date();
  ticket.technicianActions.push({
    action: "Ticket Accepted",
    notes: `Technician ${user.name} accepted ticket assignment`,
    outcome: "SUCCESS",
    performedBy: new mongoose.Types.ObjectId(user.id),
    performedByName: user.name,
    createdAt: new Date()
  } as any);

  await ticket.save();

  // Increment technician workload
  await TechnicianModel.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(user.id) },
    { $inc: { workload: 1 } },
    { upsert: true }
  );

  // Notify ticket user
  await createNotification({
    userId: ticket.userId.toString(),
    type: "TECHNICIAN_ASSIGNED",
    title: "Technician Assigned",
    message: `${user.name} has been assigned to ticket #${ticket._id.toString().slice(-6).toUpperCase()}.`,
    relatedTicketId: ticket._id.toString()
  });

  return getStaffTicketDetails(user, ticketId);
}

/**
 * Technician starts work on ticket (IN_PROGRESS)
 */
export async function startWork(user: AuthenticatedUser, ticketId: string) {
  if (!isStaffOrAdmin(user)) {
    throw new Error("Access denied: Staff or Admin role required");
  }

  if (!isDatabaseConnected()) {
    const ticket = devStaffTickets.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");

    if (!ticket.technicianId) {
      ticket.technicianId = user.id;
      ticket.technicianName = user.name;
      ticket.assignedAt = new Date().toISOString();
    }

    ticket.status = "IN_PROGRESS";
    ticket.updatedAt = new Date().toISOString();

    ticket.technicianActions.push({
      id: `tact-${Date.now()}`,
      action: "Work Started",
      notes: `Technician ${user.name} started live diagnosis`,
      outcome: "INVESTIGATING",
      performedBy: user.id,
      performedByName: user.name,
      createdAt: new Date().toISOString()
    });

    await createNotification({
      userId: ticket.userId,
      type: "TICKET_UPDATED",
      title: "Troubleshooting In Progress",
      message: `Technician ${user.name} has started actively troubleshooting your issue.`,
      relatedTicketId: ticket.id
    });

    return ticket;
  }

  const ticket = await TicketModel.findById(ticketId);
  if (!ticket) throw new Error("Ticket not found");

  if (!ticket.technicianId) {
    ticket.technicianId = new mongoose.Types.ObjectId(user.id);
    ticket.assignedAt = new Date();
  }

  ticket.status = "IN_PROGRESS";
  ticket.technicianActions.push({
    action: "Work Started",
    notes: `Technician ${user.name} started diagnosis and work`,
    outcome: "INVESTIGATING",
    performedBy: new mongoose.Types.ObjectId(user.id),
    performedByName: user.name,
    createdAt: new Date()
  } as any);

  await ticket.save();

  await createNotification({
    userId: ticket.userId.toString(),
    type: "TICKET_UPDATED",
    title: "Work In Progress",
    message: `Technician ${user.name} has begun work on ticket #${ticket._id.toString().slice(-6).toUpperCase()}.`,
    relatedTicketId: ticket._id.toString()
  });

  return getStaffTicketDetails(user, ticketId);
}

/**
 * Add troubleshooting action by technician
 */
export async function addTroubleshootingAction(
  user: AuthenticatedUser,
  ticketId: string,
  input: {
    action: string;
    notes?: string;
    outcome?: "SUCCESS" | "FAILED" | "PARTIAL" | "INVESTIGATING";
  }
) {
  if (!isStaffOrAdmin(user)) {
    throw new Error("Access denied: Staff or Admin role required");
  }

  if (!input.action?.trim()) {
    throw new Error("Action description is required");
  }

  if (!isDatabaseConnected()) {
    const ticket = devStaffTickets.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");

    ticket.technicianActions.push({
      id: `tact-${Date.now()}`,
      action: input.action.trim(),
      notes: input.notes?.trim(),
      outcome: input.outcome ?? "SUCCESS",
      performedBy: user.id,
      performedByName: user.name,
      createdAt: new Date().toISOString()
    });
    ticket.updatedAt = new Date().toISOString();

    return ticket;
  }

  const ticket = await TicketModel.findById(ticketId);
  if (!ticket) throw new Error("Ticket not found");

  ticket.technicianActions.push({
    action: input.action.trim(),
    notes: input.notes?.trim(),
    outcome: input.outcome ?? "SUCCESS",
    performedBy: new mongoose.Types.ObjectId(user.id),
    performedByName: user.name,
    createdAt: new Date()
  } as any);

  await ticket.save();
  return getStaffTicketDetails(user, ticketId);
}

/**
 * Request information from user (moves to WAITING_FOR_USER + adds reply + notifies user)
 */
export async function requestUserInformation(
  user: AuthenticatedUser,
  ticketId: string,
  message: string
) {
  if (!isStaffOrAdmin(user)) {
    throw new Error("Access denied: Staff or Admin role required");
  }

  if (!message?.trim()) {
    throw new Error("Message text is required");
  }

  if (!isDatabaseConnected()) {
    const ticket = devStaffTickets.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");

    ticket.status = "WAITING_FOR_USER";
    ticket.updatedAt = new Date().toISOString();

    ticket.replies.push({
      id: `rep-${Date.now()}`,
      senderId: user.id,
      senderRole: user.role,
      message: message.trim(),
      createdAt: new Date().toISOString()
    });

    ticket.technicianActions.push({
      id: `tact-${Date.now()}`,
      action: "Requested Information",
      notes: message.trim(),
      outcome: "INVESTIGATING",
      performedBy: user.id,
      performedByName: user.name,
      createdAt: new Date().toISOString()
    });

    await createNotification({
      userId: ticket.userId,
      type: "INFO_REQUESTED",
      title: "Information Requested",
      message: `Support technician ${user.name} requested details on ticket #${ticket.id.slice(-6).toUpperCase()}: "${message.slice(0, 80)}"`,
      relatedTicketId: ticket.id
    });

    return ticket;
  }

  const ticket = await TicketModel.findById(ticketId);
  if (!ticket) throw new Error("Ticket not found");

  ticket.status = "WAITING_FOR_USER";
  ticket.technicianActions.push({
    action: "Requested Information",
    notes: message.trim(),
    outcome: "INVESTIGATING",
    performedBy: new mongoose.Types.ObjectId(user.id),
    performedByName: user.name,
    createdAt: new Date()
  } as any);

  await ticket.save();

  // Create reply thread message
  await TicketReplyModel.create({
    ticketId: ticket._id,
    senderId: new mongoose.Types.ObjectId(user.id),
    senderRole: user.role,
    message: message.trim()
  });

  // Notify user
  await createNotification({
    userId: ticket.userId.toString(),
    type: "INFO_REQUESTED",
    title: "Information Requested",
    message: `Technician ${user.name} requested information on ticket #${ticket._id.toString().slice(-6).toUpperCase()}: "${message.slice(0, 80)}"`,
    relatedTicketId: ticket._id.toString()
  });

  return getStaffTicketDetails(user, ticketId);
}

/**
 * Change priority if authorized
 */
export async function updateTicketPriority(
  user: AuthenticatedUser,
  ticketId: string,
  priority: Priority
) {
  if (!isStaffOrAdmin(user)) {
    throw new Error("Access denied: Staff or Admin role required");
  }

  if (!["P1", "P2", "P3", "P4"].includes(priority)) {
    throw new Error("Invalid priority: must be P1, P2, P3, or P4");
  }

  if (!isDatabaseConnected()) {
    const ticket = devStaffTickets.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");

    const oldPriority = ticket.priority;
    ticket.priority = priority;
    ticket.updatedAt = new Date().toISOString();

    ticket.technicianActions.push({
      id: `tact-${Date.now()}`,
      action: "Priority Changed",
      notes: `Changed priority from ${oldPriority} to ${priority}`,
      outcome: "SUCCESS",
      performedBy: user.id,
      performedByName: user.name,
      createdAt: new Date().toISOString()
    });

    await createNotification({
      userId: ticket.userId,
      type: "PRIORITY_CHANGED",
      title: "Priority Updated",
      message: `Priority of ticket #${ticket.id.slice(-6).toUpperCase()} updated to ${priority}.`,
      relatedTicketId: ticket.id
    });

    return ticket;
  }

  const ticket = await TicketModel.findById(ticketId);
  if (!ticket) throw new Error("Ticket not found");

  const oldPriority = ticket.priority;
  ticket.priority = priority;
  ticket.technicianActions.push({
    action: "Priority Changed",
    notes: `Changed priority from ${oldPriority} to ${priority}`,
    outcome: "SUCCESS",
    performedBy: new mongoose.Types.ObjectId(user.id),
    performedByName: user.name,
    createdAt: new Date()
  } as any);

  await ticket.save();

  await createNotification({
    userId: ticket.userId.toString(),
    type: "PRIORITY_CHANGED",
    title: "Priority Updated",
    message: `Priority of ticket #${ticket._id.toString().slice(-6).toUpperCase()} updated to ${priority}.`,
    relatedTicketId: ticket._id.toString()
  });

  return getStaffTicketDetails(user, ticketId);
}

/**
 * Change ticket status (OPEN, ASSIGNED, IN_PROGRESS, WAITING_FOR_USER, RESOLVED, CLOSED, REOPENED)
 */
export async function updateTicketStatus(
  user: AuthenticatedUser,
  ticketId: string,
  status: TicketStatus
) {
  if (!isStaffOrAdmin(user)) {
    throw new Error("Access denied: Staff or Admin role required");
  }

  if (!isDatabaseConnected()) {
    const ticket = devStaffTickets.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");

    const oldStatus = ticket.status;
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();

    if (status === "RESOLVED") ticket.resolvedAt = new Date().toISOString();
    if (status === "CLOSED") ticket.closedAt = new Date().toISOString();

    ticket.technicianActions.push({
      id: `tact-${Date.now()}`,
      action: "Status Changed",
      notes: `Status changed from ${oldStatus} to ${status}`,
      outcome: "SUCCESS",
      performedBy: user.id,
      performedByName: user.name,
      createdAt: new Date().toISOString()
    });

    await createNotification({
      userId: ticket.userId,
      type: "TICKET_UPDATED",
      title: "Ticket Status Updated",
      message: `Ticket #${ticket.id.slice(-6).toUpperCase()} is now ${status}.`,
      relatedTicketId: ticket.id
    });

    return ticket;
  }

  const ticket = await TicketModel.findById(ticketId);
  if (!ticket) throw new Error("Ticket not found");

  const oldStatus = ticket.status;
  ticket.status = status;

  if (status === "RESOLVED") ticket.resolvedAt = new Date();
  if (status === "CLOSED") ticket.closedAt = new Date();

  ticket.technicianActions.push({
    action: "Status Changed",
    notes: `Status changed from ${oldStatus} to ${status}`,
    outcome: "SUCCESS",
    performedBy: new mongoose.Types.ObjectId(user.id),
    performedByName: user.name,
    createdAt: new Date()
  } as any);

  await ticket.save();

  await createNotification({
    userId: ticket.userId.toString(),
    type: "TICKET_UPDATED",
    title: "Ticket Status Updated",
    message: `Ticket #${ticket._id.toString().slice(-6).toUpperCase()} status changed to ${status}.`,
    relatedTicketId: ticket._id.toString()
  });

  return getStaffTicketDetails(user, ticketId);
}

/* ------------------------------------------------------------------ */
/*  5. RESOLUTION WITH PERSISTENCE                                     */
/* ------------------------------------------------------------------ */

export interface TicketResolutionInput {
  summary: string;
  rootCause?: string;
  actionsTaken: string[];
  kbRecommendation?: string;
}

export async function resolveTicket(
  user: AuthenticatedUser,
  ticketId: string,
  input: TicketResolutionInput
) {
  if (!isStaffOrAdmin(user)) {
    throw new Error("Access denied: Staff or Admin role required");
  }

  if (!input.summary?.trim()) {
    throw new Error("Resolution summary is required");
  }
  if (!input.actionsTaken || input.actionsTaken.length === 0) {
    throw new Error("At least one action taken must be provided");
  }

  const now = new Date();

  if (!isDatabaseConnected()) {
    const ticket = devStaffTickets.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");

    ticket.status = "RESOLVED";
    ticket.resolvedAt = now.toISOString();
    ticket.updatedAt = now.toISOString();

    ticket.resolution = {
      summary: input.summary.trim(),
      rootCause: input.rootCause?.trim() || "Unspecified",
      actionsTaken: input.actionsTaken,
      kbRecommendation: input.kbRecommendation?.trim() || "",
      resolvedBy: user.id,
      resolvedByName: user.name,
      resolvedAt: now.toISOString()
    };

    ticket.technicianActions.push({
      id: `tact-${Date.now()}`,
      action: "Issue Resolved",
      notes: input.summary.trim(),
      outcome: "SUCCESS",
      performedBy: user.id,
      performedByName: user.name,
      createdAt: now.toISOString()
    });

    const tech = devTechnicians.get(user.id);
    if (tech && tech.workload > 0) tech.workload -= 1;

    await createNotification({
      userId: ticket.userId,
      type: "TICKET_RESOLVED",
      title: "Ticket Resolved",
      message: `Your ticket has been resolved: ${input.summary.slice(0, 100)}`,
      relatedTicketId: ticket.id
    });

    // Save verified solution into Knowledge Base & Vector Index
    try {
      const ragService = createRagService();
      const verifiedTitle = `Resolved: ${ticket.title}`;
      const verifiedContent = [
        `PROBLEM: ${ticket.title}`,
        ticket.description ? `DESCRIPTION: ${ticket.description}` : "",
        input.rootCause ? `ROOT CAUSE: ${input.rootCause}` : "",
        `PROVEN RESOLUTION ACTIONS:\n${input.actionsTaken.map((a, i) => `${i + 1}. ${a}`).join("\n")}`,
        `RESOLUTION SUMMARY: ${input.summary}`
      ].filter(Boolean).join("\n\n");

      await ragService.indexDocument({
        title: verifiedTitle,
        category: ticket.category,
        content: verifiedContent,
        metadata: {
          ticketId: ticket.id,
          resolvedBy: user.name,
          approvalStatus: "APPROVED",
          source: "staff_verified_resolution"
        }
      });
    } catch (kbErr) {
      console.warn("Could not index resolved ticket to vector search:", kbErr);
    }

    return ticket;
  }

  const ticket = await TicketModel.findById(ticketId);
  if (!ticket) throw new Error("Ticket not found");

  ticket.status = "RESOLVED";
  ticket.resolvedAt = now;
  ticket.resolution = {
    summary: input.summary.trim(),
    rootCause: input.rootCause?.trim() || "",
    actionsTaken: input.actionsTaken,
    kbRecommendation: input.kbRecommendation?.trim() || "",
    resolvedBy: new mongoose.Types.ObjectId(user.id),
    resolvedByName: user.name,
    resolvedAt: now
  };

  ticket.technicianActions.push({
    action: "Issue Resolved",
    notes: input.summary.trim(),
    outcome: "SUCCESS",
    performedBy: new mongoose.Types.ObjectId(user.id),
    performedByName: user.name,
    createdAt: now
  } as any);

  await ticket.save();

  // Decrement workload on technician model
  await TechnicianModel.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(user.id), workload: { $gt: 0 } },
    { $inc: { workload: -1 } }
  );

  // Store in ActionOutcomeModel for historical model learning
  try {
    const resolutionDuration = Math.max(
      60,
      Math.round((now.getTime() - new Date(ticket.createdAt).getTime()) / 1000)
    );

    await ActionOutcomeModel.create({
      problemCategory: ticket.category,
      problemType: ticket.title.slice(0, 100),
      actionId: "technician-manual-resolution",
      actionName: input.summary.slice(0, 100),
      result: "SUCCESS",
      resolutionTimeSeconds: resolutionDuration,
      aiConfidence: ticket.aiConfidence ?? 0.85,
      technicianId: new mongoose.Types.ObjectId(user.id),
      ticketId: ticket._id,
      rootCause: input.rootCause?.trim() || "",
      kbRecommendation: input.kbRecommendation?.trim() || ""
    });
  } catch (err) {
    console.warn("Could not write to ActionOutcomeModel:", err);
  }

  // Notify ticket owner
  await createNotification({
    userId: ticket.userId.toString(),
    type: "TICKET_RESOLVED",
    title: "Ticket Resolved",
    message: `Your ticket #${ticket._id.toString().slice(-6).toUpperCase()} has been resolved: ${input.summary.slice(0, 100)}`,
    relatedTicketId: ticket._id.toString()
  });

  // Save verified solution into MongoDB Atlas Vector Search & Knowledge Base
  try {
    const ragService = createRagService();
    const verifiedTitle = `Resolved: ${ticket.title}`;
    const verifiedContent = [
      `PROBLEM: ${ticket.title}`,
      ticket.description ? `DESCRIPTION: ${ticket.description}` : "",
      input.rootCause ? `ROOT CAUSE: ${input.rootCause}` : "",
      `PROVEN RESOLUTION ACTIONS:\n${input.actionsTaken.map((a, i) => `${i + 1}. ${a}`).join("\n")}`,
      `RESOLUTION SUMMARY: ${input.summary}`
    ].filter(Boolean).join("\n\n");

    await ragService.indexDocument({
      title: verifiedTitle,
      category: ticket.category,
      content: verifiedContent,
      metadata: {
        ticketId: ticket._id.toString(),
        resolvedBy: user.name,
        approvalStatus: "APPROVED",
        source: "staff_verified_resolution"
      }
    });

    await KnowledgeDocumentModel.create({
      title: verifiedTitle,
      category: ticket.category,
      department: "IT Support",
      version: "v1.0",
      content: verifiedContent,
      chunkCount: 1,
      status: "READY",
      approvalStatus: "APPROVED",
      createdBy: new mongoose.Types.ObjectId(user.id),
      createdByName: user.name,
      metadata: {
        source: "staff_verified_resolution",
        ticketId: ticket._id.toString(),
        rootCause: input.rootCause
      }
    });
  } catch (kbErr) {
    console.warn("Could not index resolved ticket to vector search:", kbErr);
  }

  return getStaffTicketDetails(user, ticketId);
}

/**
 * Reopen ticket
 */
export async function reopenTicket(user: AuthenticatedUser, ticketId: string, reason?: string) {
  if (!isStaffOrAdmin(user)) {
    throw new Error("Access denied: Staff or Admin role required");
  }

  if (!isDatabaseConnected()) {
    const ticket = devStaffTickets.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");

    ticket.status = "REOPENED";
    ticket.resolvedAt = null;
    ticket.updatedAt = new Date().toISOString();

    ticket.technicianActions.push({
      id: `tact-${Date.now()}`,
      action: "Ticket Reopened",
      notes: reason || "Ticket reopened for further investigation",
      outcome: "INVESTIGATING",
      performedBy: user.id,
      performedByName: user.name,
      createdAt: new Date().toISOString()
    });

    if (ticket.technicianId) {
      await createNotification({
        userId: ticket.technicianId,
        type: "TICKET_REOPENED",
        title: "Ticket Reopened",
        message: `Ticket #${ticket.id.slice(-6).toUpperCase()} has been reopened. Reason: ${reason || "User requested further help."}`,
        relatedTicketId: ticket.id
      });
    }

    return ticket;
  }

  const ticket = await TicketModel.findById(ticketId);
  if (!ticket) throw new Error("Ticket not found");

  ticket.status = "REOPENED";
  ticket.resolvedAt = undefined;
  ticket.technicianActions.push({
    action: "Ticket Reopened",
    notes: reason || "Ticket reopened for further investigation",
    outcome: "INVESTIGATING",
    performedBy: new mongoose.Types.ObjectId(user.id),
    performedByName: user.name,
    createdAt: new Date()
  } as any);

  await ticket.save();

  if (ticket.technicianId) {
    await createNotification({
      userId: ticket.technicianId.toString(),
      type: "TICKET_REOPENED",
      title: "Ticket Reopened",
      message: `Ticket #${ticket._id.toString().slice(-6).toUpperCase()} has been reopened. Reason: ${reason || "Further assistance required."}`,
      relatedTicketId: ticket._id.toString()
    });
  }

  return getStaffTicketDetails(user, ticketId);
}

/* ------------------------------------------------------------------ */
/*  6. TECHNICIAN PROFILE                                              */
/* ------------------------------------------------------------------ */

export async function getTechnicianProfile(user: AuthenticatedUser, targetUserId?: string) {
  if (!isStaffOrAdmin(user)) {
    throw new Error("Access denied: Staff or Admin role required");
  }

  const userId = targetUserId || user.id;

  if (!isDatabaseConnected()) {
    const tech = devTechnicians.get(userId) || devTechnicians.get("staff-sam-id");
    const tickets = Array.from(devStaffTickets.values());
    const assigned = tickets.filter((t) => t.technicianId === userId);
    const resolved = tickets.filter(
      (t) => t.technicianId === userId && (t.status === "RESOLVED" || t.status === "CLOSED")
    );

    return {
      id: tech?.id || "tech-dev",
      userId,
      name: user.name || tech?.name || "Sam Staff",
      email: user.email || tech?.email || "staff@resolveai.com",
      department: user.department || tech?.department || "IT Support",
      phone: user.phone || tech?.phone || "+1 (555) 024-6810",
      skills: tech?.skills || ["network", "vpn", "wi-fi", "hardware", "software", "system"],
      availability: tech?.availability || "AVAILABLE",
      workload: assigned.filter((t) => t.status !== "RESOLVED" && t.status !== "CLOSED").length,
      capacity: tech?.capacity || 5,
      averageResolutionHours: tech?.averageResolutionHours || 1.5,
      stats: {
        activeTickets: assigned.filter((t) => t.status !== "RESOLVED" && t.status !== "CLOSED").length,
        resolvedTickets: resolved.length,
        highPriorityAssigned: assigned.filter((t) => t.priority === "P1" || t.priority === "P2").length
      }
    };
  }

  const userDoc = await UserModel.findById(userId).lean();
  if (!userDoc) throw new Error("Technician user record not found");

  let techDoc = await TechnicianModel.findOne({ userId: userDoc._id }).lean();
  if (!techDoc) {
    const created = await TechnicianModel.create({
      userId: userDoc._id,
      skills: ["network", "vpn", "wi-fi", "hardware", "software", "system"],
      availability: "AVAILABLE",
      workload: 0,
      capacity: 5,
      averageResolutionHours: 1.5
    });
    techDoc = created.toObject();
  }

  const [activeCount, resolvedCount, highPriorityCount] = await Promise.all([
    TicketModel.countDocuments({
      technicianId: userDoc._id,
      status: { $nin: ["RESOLVED", "CLOSED"] }
    }),
    TicketModel.countDocuments({
      technicianId: userDoc._id,
      status: { $in: ["RESOLVED", "CLOSED"] }
    }),
    TicketModel.countDocuments({
      technicianId: userDoc._id,
      priority: { $in: ["P1", "P2"] },
      status: { $nin: ["RESOLVED", "CLOSED"] }
    })
  ]);

  return {
    id: techDoc._id.toString(),
    userId: userDoc._id.toString(),
    name: userDoc.name,
    email: userDoc.email,
    department: userDoc.department || "IT Support",
    phone: userDoc.phone || "",
    skills: techDoc.skills || [],
    availability: techDoc.availability,
    workload: activeCount,
    capacity: techDoc.capacity,
    averageResolutionHours: techDoc.averageResolutionHours,
    stats: {
      activeTickets: activeCount,
      resolvedTickets: resolvedCount,
      highPriorityAssigned: highPriorityCount
    }
  };
}

export async function updateTechnicianProfile(
  user: AuthenticatedUser,
  input: {
    availability?: "AVAILABLE" | "BUSY" | "OFFLINE";
    skills?: string[];
    phone?: string;
    department?: string;
  }
) {
  if (!isStaffOrAdmin(user)) {
    throw new Error("Access denied: Staff or Admin role required");
  }

  if (!isDatabaseConnected()) {
    let tech = devTechnicians.get(user.id);
    if (!tech) {
      tech = {
        id: `tech-${Date.now()}`,
        userId: user.id,
        name: user.name,
        email: user.email,
        department: input.department || user.department || "IT Support",
        phone: input.phone || user.phone || "",
        skills: input.skills || ["network", "vpn"],
        availability: input.availability || "AVAILABLE",
        workload: 1,
        capacity: 5,
        averageResolutionHours: 1.5
      };
      devTechnicians.set(user.id, tech);
    } else {
      if (input.availability) tech.availability = input.availability;
      if (input.skills) tech.skills = input.skills;
      if (input.phone) tech.phone = input.phone;
      if (input.department) tech.department = input.department;
    }

    return getTechnicianProfile(user);
  }

  if (input.phone || input.department) {
    await UserModel.findByIdAndUpdate(user.id, {
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.department ? { department: input.department } : {})
    });
  }

  if (input.availability || input.skills) {
    await TechnicianModel.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(user.id) },
      {
        ...(input.availability ? { availability: input.availability } : {}),
        ...(input.skills ? { skills: input.skills } : {})
      },
      { upsert: true }
    );
  }

  return getTechnicianProfile(user);
}

/* ------------------------------------------------------------------ */
/*  7. INTELLIGENT ASSIGNMENT                                          */
/* ------------------------------------------------------------------ */

export async function getAssignmentRecommendation(user: AuthenticatedUser, ticketId: string) {
  if (!isStaffOrAdmin(user)) {
    throw new Error("Access denied: Staff or Admin role required");
  }

  const assignmentService = new AssignmentService();

  if (!isDatabaseConnected()) {
    const ticket = devStaffTickets.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");

    const candidates = Array.from(devTechnicians.values()).map((t) => ({
      id: t.userId,
      skills: t.skills,
      availability: t.availability,
      workload: t.workload,
      capacity: t.capacity,
      averageResolutionHours: t.averageResolutionHours
    }));

    const decision = assignmentService.selectTechnician({
      category: ticket.category,
      severity: ticket.severity,
      priority: ticket.priority,
      requiredSkills: [ticket.category],
      technicians: candidates
    });

    const chosen = candidates.find((c) => c.id === decision.technicianId);
    return {
      decision,
      recommendedTechnician: chosen
        ? {
            id: chosen.id,
            name: "Sam Staff",
            skills: chosen.skills,
            availability: chosen.availability,
            workload: chosen.workload,
            capacity: chosen.capacity
          }
        : null
    };
  }

  const ticket = await TicketModel.findById(ticketId).lean();
  if (!ticket) throw new Error("Ticket not found");

  const techProfiles = await TechnicianModel.find().populate("userId", "name email department").lean();

  const candidates = techProfiles
    .filter((t: any) => t.userId)
    .map((t: any) => ({
      id: t.userId._id.toString(),
      name: t.userId.name,
      skills: t.skills || [],
      availability: t.availability,
      workload: t.workload,
      capacity: t.capacity,
      averageResolutionHours: t.averageResolutionHours
    }));

  if (candidates.length === 0) {
    return {
      decision: {
        technicianId: null,
        score: 0,
        reason: "No technicians found in system",
        alternatives: [],
        explanation: { skillMatch: 0, availability: 0, workload: 0, speed: 0, priorityFit: 0 }
      },
      recommendedTechnician: null
    };
  }

  const decision = assignmentService.selectTechnician({
    category: ticket.category,
    severity: ticket.severity as Severity,
    priority: ticket.priority as Priority,
    requiredSkills: [ticket.category],
    technicians: candidates
  });

  const chosen = candidates.find((c) => c.id === decision.technicianId);

  return {
    decision,
    recommendedTechnician: chosen || null
  };
}

export async function intelligentAssignTicket(user: AuthenticatedUser, ticketId: string) {
  if (!isStaffOrAdmin(user)) {
    throw new Error("Access denied: Staff or Admin role required");
  }

  const { decision, recommendedTechnician } = await getAssignmentRecommendation(user, ticketId);
  if (!decision.technicianId || !recommendedTechnician) {
    throw new Error("Unable to auto-assign: " + decision.reason);
  }

  if (!isDatabaseConnected()) {
    const ticket = devStaffTickets.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");

    ticket.technicianId = decision.technicianId;
    ticket.technicianName = recommendedTechnician.name;
    ticket.status = "ASSIGNED";
    ticket.assignedAt = new Date().toISOString();
    ticket.updatedAt = new Date().toISOString();

    ticket.technicianActions.push({
      id: `tact-${Date.now()}`,
      action: "Intelligent Auto-Assignment",
      notes: `Matched to ${recommendedTechnician.name} (Score: ${(decision.score * 100).toFixed(0)}%). Reason: ${decision.reason}`,
      outcome: "SUCCESS",
      performedBy: user.id,
      performedByName: user.name,
      createdAt: new Date().toISOString()
    });

    await createNotification({
      userId: decision.technicianId,
      type: "TECHNICIAN_ASSIGNED",
      title: "New Ticket Auto-Assigned",
      message: `You were assigned ticket #${ticket.id.slice(-6).toUpperCase()} by ResolveAI intelligent routing (${ticket.category} - ${ticket.priority}).`,
      relatedTicketId: ticket.id
    });

    return ticket;
  }

  const ticket = await TicketModel.findById(ticketId);
  if (!ticket) throw new Error("Ticket not found");

  ticket.technicianId = new mongoose.Types.ObjectId(decision.technicianId);
  ticket.status = "ASSIGNED";
  ticket.assignedAt = new Date();

  ticket.technicianActions.push({
    action: "Intelligent Auto-Assignment",
    notes: `Matched to ${recommendedTechnician.name} (Score: ${(decision.score * 100).toFixed(0)}%). Rationale: ${decision.reason}`,
    outcome: "SUCCESS",
    performedBy: new mongoose.Types.ObjectId(user.id),
    performedByName: user.name,
    createdAt: new Date()
  } as any);

  await ticket.save();

  // Increment technician workload
  await TechnicianModel.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(decision.technicianId) },
    { $inc: { workload: 1 } }
  );

  // Notify assigned technician
  await createNotification({
    userId: decision.technicianId,
    type: "TECHNICIAN_ASSIGNED",
    title: "New Ticket Assigned",
    message: `You have been assigned ticket #${ticket._id.toString().slice(-6).toUpperCase()} by Intelligent Assignment.`,
    relatedTicketId: ticket._id.toString()
  });

  return getStaffTicketDetails(user, ticketId);
}

export interface StaffKnowledgeInput {
  ticketId?: string;
  title: string;
  problem: string;
  rootCause?: string;
  troubleshootingSteps: string[] | string;
  solution: string;
  category: string;
  tags?: string[] | string;
  department?: string;
}

export async function contributeKnowledge(actor: AuthenticatedUser, input: StaffKnowledgeInput) {
  if (!isStaffOrAdmin(actor)) {
    throw new Error("Access denied: Staff privileges required");
  }

  const stepsArray = Array.isArray(input.troubleshootingSteps)
    ? input.troubleshootingSteps
    : input.troubleshootingSteps.split("\n").filter((s) => s.trim().length > 0);

  const tagsArray = Array.isArray(input.tags)
    ? input.tags
    : (input.tags || "").split(",").map((t) => t.trim()).filter(Boolean);

  const formattedContent = [
    `PROBLEM: ${input.problem}`,
    input.rootCause ? `ROOT CAUSE: ${input.rootCause}` : "",
    `TROUBLESHOOTING STEPS:\n${stepsArray.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}`,
    `FINAL SOLUTION:\n${input.solution}`,
    tagsArray.length > 0 ? `TAGS: ${tagsArray.join(", ")}` : ""
  ].filter(Boolean).join("\n\n");

  const category = (input.category || "general").trim().toLowerCase();
  const department = input.department?.trim() || "General";
  const title = input.title?.trim() || `Resolved: ${input.problem.slice(0, 60)}`;

  if (!isDatabaseConnected()) {
    return {
      success: true,
      documentId: `dev-kb-${Date.now()}`,
      title,
      category,
      approvalStatus: "PENDING",
      message: "Knowledge submitted for administrator approval"
    };
  }

  const documentId = new mongoose.Types.ObjectId();

  const doc = await KnowledgeDocumentModel.create({
    _id: documentId,
    title,
    category,
    department,
    version: "v1.0",
    content: formattedContent,
    chunkCount: 1,
    status: "READY",
    approvalStatus: "PENDING",
    createdBy: new mongoose.Types.ObjectId(actor.id),
    createdByName: actor.name,
    metadata: {
      source: "technician_contribution",
      ticketId: input.ticketId,
      rootCause: input.rootCause,
      tags: tagsArray,
      submittedByRole: actor.role
    }
  });

  await AuditLogModel.create({
    actorId: new mongoose.Types.ObjectId(actor.id),
    actorName: actor.name,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "KNOWLEDGE_CONTRIBUTED",
    resourceType: "KnowledgeDocument",
    resourceId: doc._id.toString(),
    details: `Staff ${actor.name} submitted knowledge article "${title}" for review.`
  });

  return {
    success: true,
    documentId: doc._id.toString(),
    title: doc.title,
    category: doc.category,
    approvalStatus: doc.approvalStatus,
    message: "Knowledge submitted successfully and queued for Administrator approval before Vector Search indexing."
  };
}

