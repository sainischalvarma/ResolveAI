import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  getStaffOverview,
  listStaffTickets,
  getStaffTicketDetails,
  acceptTicket,
  startWork,
  addTroubleshootingAction,
  requestUserInformation,
  updateTicketPriority,
  updateTicketStatus,
  resolveTicket,
  reopenTicket,
  getTechnicianProfile,
  updateTechnicianProfile,
  getAssignmentRecommendation,
  intelligentAssignTicket,
  contributeKnowledge
} from "../services/staffService.js";

export const staffRouter = Router();

// Enforce authentication & role authorization for all staff endpoints
staffRouter.use(authenticate);
staffRouter.use(authorizeRoles("STAFF", "TECHNICIAN", "ADMIN"));

/* ------------------------------------------------------------------ */
/*  1. Overview statistics                                            */
/* ------------------------------------------------------------------ */
staffRouter.get("/overview", async (req, res, next) => {
  try {
    const stats = await getStaffOverview(req.authUser!);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/*  2. Ticket Queue (filters, search, pagination)                      */
/* ------------------------------------------------------------------ */
staffRouter.get("/tickets", async (req, res, next) => {
  try {
    const user = req.authUser!;
    const assignedToMe = req.query.assignedToMe === "true";
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 25;

    const result = await listStaffTickets(user, {
      assignedToMe,
      status,
      priority,
      category,
      search,
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

/* ------------------------------------------------------------------ */
/*  3. Ticket Details with Full AI Diagnostic Context                 */
/* ------------------------------------------------------------------ */
staffRouter.get("/tickets/:id", async (req, res, next) => {
  try {
    const details = await getStaffTicketDetails(req.authUser!, req.params.id);
    if (!details) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json(details);
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/*  4. Technician Actions                                             */
/* ------------------------------------------------------------------ */

// Accept ticket
staffRouter.post("/tickets/:id/accept", async (req, res, next) => {
  try {
    const result = await acceptTicket(req.authUser!, req.params.id);
    res.json({ message: "Ticket accepted successfully", result });
  } catch (error) {
    next(error);
  }
});

// Start live troubleshooting work
staffRouter.post("/tickets/:id/start-work", async (req, res, next) => {
  try {
    const result = await startWork(req.authUser!, req.params.id);
    res.json({ message: "Work started on ticket", result });
  } catch (error) {
    next(error);
  }
});

// Log troubleshooting action
staffRouter.post("/tickets/:id/action", async (req, res, next) => {
  try {
    const { action, notes, outcome } = req.body;
    if (!action) {
      res.status(400).json({ error: "Action description is required" });
      return;
    }
    const result = await addTroubleshootingAction(req.authUser!, req.params.id, {
      action,
      notes,
      outcome
    });
    res.json({ message: "Troubleshooting action recorded", result });
  } catch (error) {
    next(error);
  }
});

// Request information from user
staffRouter.post("/tickets/:id/request-info", async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) {
      res.status(400).json({ error: "Message content is required" });
      return;
    }
    const result = await requestUserInformation(req.authUser!, req.params.id, message);
    res.json({ message: "Information requested and user notified", result });
  } catch (error) {
    next(error);
  }
});

// Change ticket priority
staffRouter.put("/tickets/:id/priority", async (req, res, next) => {
  try {
    const { priority } = req.body;
    if (!priority) {
      res.status(400).json({ error: "Priority is required" });
      return;
    }
    const result = await updateTicketPriority(req.authUser!, req.params.id, priority);
    res.json({ message: "Priority updated successfully", result });
  } catch (error) {
    next(error);
  }
});

// Change ticket status
staffRouter.put("/tickets/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      res.status(400).json({ error: "Status is required" });
      return;
    }
    const result = await updateTicketStatus(req.authUser!, req.params.id, status);
    res.json({ message: "Status updated successfully", result });
  } catch (error) {
    next(error);
  }
});

// Resolve ticket with full summary, root cause, and learning outcome
staffRouter.post("/tickets/:id/resolve", async (req, res, next) => {
  try {
    const { summary, rootCause, actionsTaken, kbRecommendation } = req.body;
    if (!summary || !actionsTaken || !Array.isArray(actionsTaken) || actionsTaken.length === 0) {
      res.status(400).json({
        error: "Resolution summary and at least one action taken are required"
      });
      return;
    }
    const result = await resolveTicket(req.authUser!, req.params.id, {
      summary,
      rootCause,
      actionsTaken,
      kbRecommendation
    });
    res.json({ message: "Ticket resolved and recorded", result });
  } catch (error) {
    next(error);
  }
});

// Reopen ticket
staffRouter.post("/tickets/:id/reopen", async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await reopenTicket(req.authUser!, req.params.id, reason);
    res.json({ message: "Ticket reopened", result });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/*  5. Intelligent Assignment                                          */
/* ------------------------------------------------------------------ */

// Get recommendation without assigning
staffRouter.get("/tickets/:id/recommendation", async (req, res, next) => {
  try {
    const recommendation = await getAssignmentRecommendation(req.authUser!, req.params.id);
    res.json(recommendation);
  } catch (error) {
    next(error);
  }
});

// Execute intelligent auto-assignment
staffRouter.post("/tickets/:id/auto-assign", async (req, res, next) => {
  try {
    const result = await intelligentAssignTicket(req.authUser!, req.params.id);
    res.json({ message: "Ticket auto-assigned", result });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/*  6. Technician Profile                                              */
/* ------------------------------------------------------------------ */

staffRouter.get("/profile", async (req, res, next) => {
  try {
    const targetUserId = req.query.userId as string | undefined;
    const profile = await getTechnicianProfile(req.authUser!, targetUserId);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

staffRouter.put("/profile", async (req, res, next) => {
  try {
    const { availability, skills, phone, department } = req.body;
    const updated = await updateTechnicianProfile(req.authUser!, {
      availability,
      skills,
      phone,
      department
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/*  7. Knowledge Contribution ("Save as Knowledge")                   */
/* ------------------------------------------------------------------ */
staffRouter.post("/knowledge", async (req, res, next) => {
  try {
    const { ticketId, title, problem, rootCause, troubleshootingSteps, solution, category, tags, department } = req.body;
    if (!problem || !solution) {
      res.status(400).json({ error: "Problem description and final solution are required" });
      return;
    }
    const result = await contributeKnowledge(req.authUser!, {
      ticketId,
      title: title || `Solved: ${problem.slice(0, 60)}`,
      problem,
      rootCause,
      troubleshootingSteps: troubleshootingSteps || [],
      solution,
      category: category || "general",
      tags: tags || [],
      department
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

