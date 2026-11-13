import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  getAdminOverview,
  listUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  getUserTicketHistory,
  listStaff,
  createStaff,
  updateStaff,
  listAllTickets,
  reassignTicket,
  adminUpdateTicket,
  listKnowledgeDocuments,
  createKnowledgeDocument,
  setKnowledgeApprovalStatus,
  archiveKnowledgeDocument,
  deleteKnowledgeDocument,
  getAiRagMonitoring,
  getAnalytics,
  getSystemSettings,
  updateSystemSetting,
  listAuditLogs,
  listStaffRequests,
  reviewStaffRequest
} from "../services/adminService.js";

export const adminRouter = Router();

// Strictly enforce Admin authorization for all administrative endpoints
adminRouter.use(authenticate);
adminRouter.use(authorizeRoles("ADMIN"));

/* ------------------------------------------------------------------ */
/*  1. ADMIN OVERVIEW                                                 */
/* ------------------------------------------------------------------ */
adminRouter.get("/overview", async (req, res, next) => {
  try {
    const stats = await getAdminOverview(req.authUser!);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/*  2. USER MANAGEMENT                                                */
/* ------------------------------------------------------------------ */
adminRouter.get("/users", async (req, res, next) => {
  try {
    const search = req.query.search as string | undefined;
    const role = req.query.role as string | undefined;
    const active = req.query.active !== undefined ? req.query.active === "true" : undefined;
    const department = req.query.department as string | undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 25;

    const result = await listUsers(req.authUser!, { search, role, active, department, page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users", async (req, res, next) => {
  try {
    const newUser = await createUser(req.authUser!, req.body);
    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/users/:id", async (req, res, next) => {
  try {
    const updated = await updateUser(req.authUser!, req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/users/:id/status", async (req, res, next) => {
  try {
    const { active } = req.body;
    const result = await toggleUserStatus(req.authUser!, req.params.id, Boolean(active));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/users/:id/tickets", async (req, res, next) => {
  try {
    const history = await getUserTicketHistory(req.authUser!, req.params.id);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/*  3. STAFF MANAGEMENT                                               */
/* ------------------------------------------------------------------ */
adminRouter.get("/staff", async (req, res, next) => {
  try {
    const search = req.query.search as string | undefined;
    const department = req.query.department as string | undefined;
    const availability = req.query.availability as string | undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 25;

    const result = await listStaff(req.authUser!, { search, department, availability, page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/staff", async (req, res, next) => {
  try {
    const staff = await createStaff(req.authUser!, req.body);
    res.status(201).json(staff);
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/staff/:id", async (req, res, next) => {
  try {
    const updated = await updateStaff(req.authUser!, req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/*  4. TICKET MANAGEMENT                                              */
/* ------------------------------------------------------------------ */
adminRouter.get("/tickets", async (req, res, next) => {
  try {
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;
    const category = req.query.category as string | undefined;
    const technicianId = req.query.technicianId as string | undefined;
    const department = req.query.department as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 25;

    const result = await listAllTickets(req.authUser!, {
      search,
      status,
      priority,
      category,
      technicianId,
      department,
      dateFrom,
      dateTo,
      page,
      limit
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/tickets/:id/reassign", async (req, res, next) => {
  try {
    const { technicianId } = req.body;
    const result = await reassignTicket(req.authUser!, req.params.id, technicianId || null);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/tickets/:id", async (req, res, next) => {
  try {
    const result = await adminUpdateTicket(req.authUser!, req.params.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/*  5. KNOWLEDGE BASE & RAG MANAGEMENT                                */
/* ------------------------------------------------------------------ */
adminRouter.get("/knowledge", async (req, res, next) => {
  try {
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const approvalStatus = req.query.approvalStatus as string | undefined;
    const status = req.query.status as string | undefined;

    const result = await listKnowledgeDocuments(req.authUser!, { search, category, approvalStatus, status });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/knowledge", async (req, res, next) => {
  try {
    const doc = await createKnowledgeDocument(req.authUser!, req.body);
    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/knowledge/:id/approval", async (req, res, next) => {
  try {
    const { approvalStatus } = req.body;
    const result = await setKnowledgeApprovalStatus(req.authUser!, req.params.id, approvalStatus);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/knowledge/:id/archive", async (req, res, next) => {
  try {
    const result = await archiveKnowledgeDocument(req.authUser!, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/knowledge/:id", async (req, res, next) => {
  try {
    const result = await deleteKnowledgeDocument(req.authUser!, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/*  6. AI / RAG MONITORING                                            */
/* ------------------------------------------------------------------ */
adminRouter.get("/monitoring/ai-rag", async (req, res, next) => {
  try {
    const telemetry = await getAiRagMonitoring(req.authUser!);
    res.json(telemetry);
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/*  7. ANALYTICS & RESEARCH METRICS                                   */
/* ------------------------------------------------------------------ */
adminRouter.get("/analytics", async (req, res, next) => {
  try {
    const analytics = await getAnalytics(req.authUser!);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/*  8. SYSTEM SETTINGS                                                */
/* ------------------------------------------------------------------ */
adminRouter.get("/settings", async (req, res, next) => {
  try {
    const settings = await getSystemSettings(req.authUser!);
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/settings/:key", async (req, res, next) => {
  try {
    const { value } = req.body;
    const result = await updateSystemSetting(req.authUser!, req.params.key, value);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/*  9. AUDIT LOGS                                                     */
/* ------------------------------------------------------------------ */
adminRouter.get("/audit-logs", async (req, res, next) => {
  try {
    const action = req.query.action as string | undefined;
    const resourceType = req.query.resourceType as string | undefined;
    const search = req.query.search as string | undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 25;

    const result = await listAuditLogs(req.authUser!, { action, resourceType, search, page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/*  10. STAFF LOGIN REQUESTS REVIEW (ACCEPT / REJECT)                 */
/* ------------------------------------------------------------------ */
adminRouter.get("/staff-requests", async (req, res, next) => {
  try {
    const result = await listStaffRequests(req.authUser!);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/staff-requests/:id/review", async (req, res, next) => {
  try {
    const { decision, notes } = req.body;
    const result = await reviewStaffRequest(req.authUser!, req.params.id, decision, notes);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
