import React, { useEffect, useState, useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  HelpCircle,
  Info,
  Layers,
  MessageSquare,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  User,
  UserCheck,
  Users,
  Wrench,
  X
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../contexts/AuthContext";
import {
  getStaffOverviewApi,
  listStaffTicketsApi,
  getStaffTicketDetailsApi,
  acceptStaffTicketApi,
  startWorkStaffTicketApi,
  addStaffActionApi,
  requestStaffInfoApi,
  updateStaffPriorityApi,
  updateStaffStatusApi,
  resolveStaffTicketApi,
  reopenStaffTicketApi,
  getStaffAssignmentRecommendationApi,
  autoAssignStaffTicketApi,
  getStaffProfileApi,
  updateStaffProfileApi,
  listNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  addTicketReplyApi,
  contributeStaffKnowledgeApi,
  type StaffOverviewStats,
  type StaffTicketItem,
  type StaffTicketDetailsResponse,
  type TechnicianProfileData,
  type AssignmentRecommendationResponse,
  type NotificationItem
} from "../services/api";
import { cn } from "../utils/cn";

type DashboardTab = "overview" | "queue" | "profile" | "notifications";
type QueueFilterTab = "assigned" | "open" | "high-priority" | "waiting" | "all";

export function TechnicianDashboard() {
  const { user, isStaff, isAdmin } = useAuth();

  // Active top-level tab
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  // Overview stats
  const [stats, setStats] = useState<StaffOverviewStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Ticket Queue state
  const [tickets, setTickets] = useState<StaffTicketItem[]>([]);
  const [queueFilterTab, setQueueFilterTab] = useState<QueueFilterTab>("assigned");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);

  // Selected Ticket for Details view / modal
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetails, setTicketDetails] = useState<StaffTicketDetailsResponse | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsTab, setDetailsTab] = useState<"ai-context" | "actions" | "thread" | "rag">("ai-context");

  // Action Modals State
  const [showActionModal, setShowActionModal] = useState(false);
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionNotes, setNewActionNotes] = useState("");
  const [newActionOutcome, setNewActionOutcome] = useState<"SUCCESS" | "FAILED" | "PARTIAL" | "INVESTIGATING">("SUCCESS");

  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [requestInfoMessage, setRequestInfoMessage] = useState("");

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveSummary, setResolveSummary] = useState("");
  const [resolveRootCause, setResolveRootCause] = useState("");
  const [resolveActions, setResolveActions] = useState("");
  const [resolveKbRec, setResolveKbRec] = useState("");

  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  // Knowledge Contribution ("Save as Knowledge") state
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [kbTitle, setKbTitle] = useState("");
  const [kbProblem, setKbProblem] = useState("");
  const [kbRootCause, setKbRootCause] = useState("");
  const [kbSteps, setKbSteps] = useState("");
  const [kbSolution, setKbSolution] = useState("");
  const [kbCategory, setKbCategory] = useState("network");
  const [kbTags, setKbTags] = useState("");
  const [kbSubmitting, setKbSubmitting] = useState(false);
  const [kbSuccessMessage, setKbSuccessMessage] = useState<string | null>(null);

  // Intelligent assignment recommendation state
  const [assignmentRec, setAssignmentRec] = useState<AssignmentRecommendationResponse | null>(null);
  const [isLoadingRec, setIsLoadingRec] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Technician Profile state
  const [profile, setProfile] = useState<TechnicianProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [editingSkills, setEditingSkills] = useState("");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  // Quick message thread input inside details
  const [quickReplyText, setQuickReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Status/Feedback alerts
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  /* ------------------------------------------------------------------ */
  /*  Load Data                                                         */
  /* ------------------------------------------------------------------ */

  const loadStats = async () => {
    setIsLoadingStats(true);
    try {
      const data = await getStaffOverviewApi();
      setStats(data);
    } catch (err: any) {
      console.warn("Could not load staff overview stats:", err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const loadTickets = async () => {
    setIsLoadingTickets(true);
    try {
      const params: any = {};
      if (queueFilterTab === "assigned") {
        params.assignedToMe = true;
      } else if (queueFilterTab === "open") {
        params.status = "OPEN";
      } else if (queueFilterTab === "high-priority") {
        params.priority = "P1,P2";
      } else if (queueFilterTab === "waiting") {
        params.status = "WAITING_FOR_USER";
      }

      if (statusFilter !== "ALL") params.status = statusFilter;
      if (priorityFilter !== "ALL") params.priority = priorityFilter;
      if (categoryFilter !== "ALL") params.category = categoryFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const data = await listStaffTicketsApi(params);
      setTickets(data.tickets);
    } catch (err) {
      console.warn("Could not load staff tickets:", err);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const loadProfile = async () => {
    setIsLoadingProfile(true);
    try {
      const data = await getStaffProfileApi();
      setProfile(data);
      setEditingSkills(data.skills.join(", "));
    } catch (err) {
      console.warn("Could not load technician profile:", err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const loadNotifications = async () => {
    setIsLoadingNotifications(true);
    try {
      const data = await listNotificationsApi();
      setNotifications(data);
    } catch (err) {
      console.warn("Could not load notifications:", err);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const openTicketDetails = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setIsLoadingDetails(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const details = await getStaffTicketDetailsApi(ticketId);
      setTicketDetails(details);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || "Failed to load ticket details");
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    void loadStats();
    void loadTickets();
    void loadProfile();
    void loadNotifications();
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [queueFilterTab, statusFilter, priorityFilter, categoryFilter]);

  // Handle live search debouncing
  useEffect(() => {
    const handler = setTimeout(() => {
      void loadTickets();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  /* ------------------------------------------------------------------ */
  /*  Technician Actions Handlers                                       */
  /* ------------------------------------------------------------------ */

  const handleAcceptTicket = async (ticketId: string) => {
    setActionError(null);
    try {
      await acceptStaffTicketApi(ticketId);
      setActionSuccess("Ticket accepted and assigned to you!");
      void loadStats();
      void loadTickets();
      if (selectedTicketId === ticketId) {
        void openTicketDetails(ticketId);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || "Failed to accept ticket");
    }
  };

  const handleStartWork = async (ticketId: string) => {
    setActionError(null);
    try {
      await startWorkStaffTicketApi(ticketId);
      setActionSuccess("Ticket moved to IN_PROGRESS. Diagnostics started.");
      void loadStats();
      void loadTickets();
      if (selectedTicketId === ticketId) {
        void openTicketDetails(ticketId);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || "Failed to start work");
    }
  };

  const handleAddTroubleshootingAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !newActionTitle.trim()) return;
    setActionError(null);
    try {
      await addStaffActionApi(selectedTicketId, {
        action: newActionTitle.trim(),
        notes: newActionNotes.trim() || undefined,
        outcome: newActionOutcome
      });
      setShowActionModal(false);
      setNewActionTitle("");
      setNewActionNotes("");
      setActionSuccess("Troubleshooting action added to history.");
      void openTicketDetails(selectedTicketId);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || "Failed to add action");
    }
  };

  const handleRequestInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !requestInfoMessage.trim()) return;
    setActionError(null);
    try {
      await requestStaffInfoApi(selectedTicketId, requestInfoMessage.trim());
      setShowRequestInfoModal(false);
      setRequestInfoMessage("");
      setActionSuccess("Information requested and ticket placed in WAITING_FOR_USER.");
      void loadStats();
      void loadTickets();
      void openTicketDetails(selectedTicketId);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || "Failed to request info");
    }
  };

  const handleUpdatePriority = async (newPriority: "P1" | "P2" | "P3" | "P4") => {
    if (!selectedTicketId) return;
    setActionError(null);
    try {
      await updateStaffPriorityApi(selectedTicketId, newPriority);
      setActionSuccess(`Ticket priority updated to ${newPriority}.`);
      void loadStats();
      void loadTickets();
      void openTicketDetails(selectedTicketId);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || "Failed to update priority");
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTicketId) return;
    setActionError(null);
    try {
      await updateStaffStatusApi(selectedTicketId, newStatus);
      setActionSuccess(`Ticket status updated to ${newStatus}.`);
      void loadStats();
      void loadTickets();
      void openTicketDetails(selectedTicketId);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || "Failed to update status");
    }
  };

  const handleResolveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !resolveSummary.trim() || !resolveActions.trim()) return;
    setActionError(null);
    try {
      const actionsList = resolveActions
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean);

      await resolveStaffTicketApi(selectedTicketId, {
        summary: resolveSummary.trim(),
        rootCause: resolveRootCause.trim() || undefined,
        actionsTaken: actionsList,
        kbRecommendation: resolveKbRec.trim() || undefined
      });

      // If KB Recommendation is provided, automatically queue as knowledge contribution for admin approval
      if (resolveKbRec.trim() && ticketDetails?.ticket) {
        try {
          await contributeStaffKnowledgeApi({
            ticketId: selectedTicketId,
            title: `Resolved: ${ticketDetails.ticket.title}`,
            problem: ticketDetails.ticket.description,
            rootCause: resolveRootCause.trim() || undefined,
            troubleshootingSteps: actionsList,
            solution: resolveSummary.trim(),
            category: ticketDetails.ticket.category || "network",
            tags: [ticketDetails.ticket.category, "technician_solution"].filter(Boolean) as string[]
          });
        } catch {
          // non-blocking
        }
      }

      setShowResolveModal(false);
      setResolveSummary("");
      setResolveRootCause("");
      setResolveActions("");
      setResolveKbRec("");
      setActionSuccess("Ticket resolved successfully and outcome recorded for AI learning!");
      void loadStats();
      void loadTickets();
      void loadProfile();
      void openTicketDetails(selectedTicketId);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || "Failed to resolve ticket");
    }
  };

  const handleContributeKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbProblem.trim() || !kbSolution.trim()) return;
    setKbSubmitting(true);
    setKbSuccessMessage(null);
    try {
      await contributeStaffKnowledgeApi({
        ticketId: selectedTicketId || undefined,
        title: kbTitle.trim() || `Resolved: ${kbProblem.trim().slice(0, 60)}`,
        problem: kbProblem.trim(),
        rootCause: kbRootCause.trim() || undefined,
        troubleshootingSteps: kbSteps.trim(),
        solution: kbSolution.trim(),
        category: kbCategory || "network",
        tags: kbTags.trim() || undefined
      });
      setKbSuccessMessage("Knowledge submitted successfully! Administrator will review and approve for RAG retrieval.");
      setTimeout(() => {
        setShowKnowledgeModal(false);
        setKbSuccessMessage(null);
      }, 2500);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || "Failed to submit knowledge");
    } finally {
      setKbSubmitting(false);
    }
  };

  const handleReopenTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId) return;
    setActionError(null);
    try {
      await reopenStaffTicketApi(selectedTicketId, reopenReason.trim() || undefined);
      setShowReopenModal(false);
      setReopenReason("");
      setActionSuccess("Ticket reopened for further diagnostics.");
      void loadStats();
      void loadTickets();
      void openTicketDetails(selectedTicketId);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || "Failed to reopen ticket");
    }
  };

  const handleQuickReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !quickReplyText.trim() || isSendingReply) return;
    setIsSendingReply(true);
    setActionError(null);
    try {
      await addTicketReplyApi(selectedTicketId, quickReplyText.trim());
      setQuickReplyText("");
      void openTicketDetails(selectedTicketId);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || "Failed to send message");
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleFetchRecommendation = async (ticketId: string) => {
    setIsLoadingRec(true);
    setShowAssignModal(true);
    try {
      const rec = await getStaffAssignmentRecommendationApi(ticketId);
      setAssignmentRec(rec);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || "Failed to fetch recommendation");
    } finally {
      setIsLoadingRec(false);
    }
  };

  const handleAutoAssign = async (ticketId: string) => {
    setActionError(null);
    try {
      await autoAssignStaffTicketApi(ticketId);
      setShowAssignModal(false);
      setActionSuccess("Ticket auto-assigned by intelligent skill & capacity matching.");
      void loadStats();
      void loadTickets();
      if (selectedTicketId === ticketId) {
        void openTicketDetails(ticketId);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || "Failed to auto-assign ticket");
    }
  };

  const handleUpdateAvailability = async (newAvailability: "AVAILABLE" | "BUSY" | "OFFLINE") => {
    try {
      const updated = await updateStaffProfileApi({ availability: newAvailability });
      setProfile(updated);
      setProfileMessage(`Status changed to ${newAvailability}`);
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (err: any) {
      setProfileMessage("Failed to update status");
    }
  };

  const handleSaveProfileSkills = async () => {
    try {
      const skillsArray = editingSkills
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const updated = await updateStaffProfileApi({ skills: skillsArray });
      setProfile(updated);
      setProfileMessage("Skills updated successfully!");
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (err: any) {
      setProfileMessage("Failed to update skills");
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await markNotificationReadApi(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.warn("Could not mark notification read:", err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await markAllNotificationsReadApi();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.warn("Could not mark all notifications read:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-slate-950 pb-16">
      {/* Top Header Banner */}
      <header className="border-b border-white/10 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between max-w-7xl mx-auto">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Wrench className="h-3 w-3" />
                Staff Operations Center
              </span>
              <span className="text-xs text-slate-500">Tier-2 Escalations</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-1">
              Technician Diagnostic Workbench
            </h1>
          </div>

          {/* Quick Tabs & Live Refresh */}
          <div className="flex items-center gap-3">
            <div className="flex p-1 bg-slate-950/80 rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all",
                  activeTab === "overview"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                Queue & Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all",
                  activeTab === "profile"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <User className="h-3.5 w-3.5" />
                Technician Profile
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("notifications")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all relative",
                  activeTab === "notifications"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Bell className="h-3.5 w-3.5" />
                Alerts
                {notifications.filter((n) => !n.read).length > 0 && (
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                void loadStats();
                void loadTickets();
                void loadNotifications();
              }}
              title="Refresh all metrics and queue"
              className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
            >
              <RefreshCw className={cn("h-4 w-4", (isLoadingStats || isLoadingTickets) && "animate-spin")} />
            </button>
          </div>
        </div>
      </header>

      {/* Global Action Notifications Toast */}
      {actionSuccess && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button type="button" onClick={() => setActionError(null)} className="text-rose-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW & TICKET QUEUE */}
      {activeTab === "overview" && (
        <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          {/* SECTION 1: STAFF OVERVIEW STATS (Backend calculated) */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-amber-400" />
                Live Support Telemetry & Workload
              </h2>
              <span className="text-[11px] text-slate-500">Live MongoDB counts</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Assigned Tickets */}
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Assigned to Me</span>
                  <UserCheck className="h-4 w-4 text-amber-400" />
                </div>
                <p className="text-2xl font-black text-white mt-2">
                  {isLoadingStats ? "..." : stats?.assignedTickets ?? 0}
                </p>
                <div className="mt-2 text-[10px] text-amber-300/80 font-medium">Require action</div>
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
              </div>

              {/* Open Tickets */}
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Open Queue</span>
                  <HelpCircle className="h-4 w-4 text-sky-400" />
                </div>
                <p className="text-2xl font-black text-white mt-2">
                  {isLoadingStats ? "..." : stats?.openTickets ?? 0}
                </p>
                <div className="mt-2 text-[10px] text-sky-300/80 font-medium">Unassigned issues</div>
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-sky-500/10 rounded-full blur-xl pointer-events-none" />
              </div>

              {/* In Progress */}
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>In Progress</span>
                  <Cpu className="h-4 w-4 text-indigo-400" />
                </div>
                <p className="text-2xl font-black text-white mt-2">
                  {isLoadingStats ? "..." : stats?.inProgress ?? 0}
                </p>
                <div className="mt-2 text-[10px] text-indigo-300/80 font-medium">Under diagnosis</div>
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
              </div>

              {/* Waiting for User */}
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Waiting on User</span>
                  <Clock className="h-4 w-4 text-purple-400" />
                </div>
                <p className="text-2xl font-black text-white mt-2">
                  {isLoadingStats ? "..." : stats?.waitingForUser ?? 0}
                </p>
                <div className="mt-2 text-[10px] text-purple-300/80 font-medium">Info requested</div>
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
              </div>

              {/* High Priority Tickets */}
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 relative overflow-hidden">
                <div className="flex items-center justify-between text-rose-300 text-xs font-semibold">
                  <span>High Priority</span>
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                </div>
                <p className="text-2xl font-black text-rose-200 mt-2">
                  {isLoadingStats ? "..." : stats?.highPriorityTickets ?? 0}
                </p>
                <div className="mt-2 text-[10px] text-rose-300 font-bold uppercase tracking-wider">P1 / P2 Urgency</div>
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-rose-500/15 rounded-full blur-xl pointer-events-none" />
              </div>

              {/* Resolved Today */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 relative overflow-hidden">
                <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold">
                  <span>Resolved Today</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-2xl font-black text-emerald-200 mt-2">
                  {isLoadingStats ? "..." : stats?.resolvedToday ?? 0}
                </p>
                <div className="mt-2 text-[10px] text-emerald-300 font-medium">Closed & recorded</div>
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-emerald-500/15 rounded-full blur-xl pointer-events-none" />
              </div>
            </div>
          </section>

          {/* SECTION 2: TICKET QUEUE WITH COMPREHENSIVE FILTERS */}
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-xl">
            {/* Queue Sub-tabs & Search */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-white/10 pb-4">
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setQueueFilterTab("assigned")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all",
                    queueFilterTab === "assigned"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  My Assigned ({stats?.assignedTickets ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueFilterTab("open")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all",
                    queueFilterTab === "open"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Open Triage ({stats?.openTickets ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueFilterTab("high-priority")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all",
                    queueFilterTab === "high-priority"
                      ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  High Priority ({stats?.highPriorityTickets ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueFilterTab("waiting")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all",
                    queueFilterTab === "waiting"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Waiting on User ({stats?.waitingForUser ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueFilterTab("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all",
                    queueFilterTab === "all"
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  All Tickets ({stats?.totalTickets ?? 0})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full lg:w-72">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search problem, user, ID..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/70 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 pb-2 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Status Filter</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="OPEN">OPEN (Unassigned)</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="WAITING_FOR_USER">WAITING_FOR_USER</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="REOPENED">REOPENED</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Priority Filter</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="P1">P1 - Critical</option>
                  <option value="P2">P2 - High</option>
                  <option value="P3">P3 - Medium</option>
                  <option value="P4">P4 - Low</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Category Filter</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="ALL">All Categories</option>
                  <option value="vpn">VPN</option>
                  <option value="network">Network</option>
                  <option value="wi-fi">Wi-Fi</option>
                  <option value="hardware">Hardware</option>
                  <option value="software">Software</option>
                  <option value="account">Account</option>
                  <option value="email">Email</option>
                  <option value="system">System</option>
                </select>
              </div>
            </div>

            {/* Ticket Table */}
            <div className="overflow-x-auto mt-4 rounded-xl border border-white/5">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/10">
                  <tr>
                    <th className="py-3 px-3">Ticket ID</th>
                    <th className="py-3 px-3">User & Dept</th>
                    <th className="py-3 px-4">Problem Summary</th>
                    <th className="py-3 px-2">Category</th>
                    <th className="py-3 px-2">Priority</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-3">AI Diagnostic Summary</th>
                    <th className="py-3 px-3">Dates</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isLoadingTickets ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Cpu className="h-6 w-6 animate-spin mx-auto text-amber-500 mb-2" />
                        Fetching support tickets from backend...
                      </td>
                    </tr>
                  ) : tickets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                        <p className="font-semibold text-slate-300">No tickets found</p>
                        <p className="text-xs text-slate-500 mt-1">No tickets match the selected filters.</p>
                      </td>
                    </tr>
                  ) : (
                    tickets.map((ticket) => {
                      const isAssignedToMe = ticket.technicianId === user?.id;
                      const isHighPriority = ticket.priority === "P1" || ticket.priority === "P2";

                      return (
                        <tr
                          key={ticket.id}
                          className={cn(
                            "hover:bg-white/[0.03] transition-colors group",
                            isHighPriority && "bg-rose-500/[0.02]"
                          )}
                        >
                          {/* Ticket ID */}
                          <td className="py-3.5 px-3 font-mono text-xs font-bold text-amber-400 whitespace-nowrap">
                            #{ticket.id.slice(-6).toUpperCase()}
                          </td>

                          {/* User & Dept */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <p className="font-semibold text-white">{ticket.userName}</p>
                            <p className="text-[11px] text-slate-400">{ticket.userDepartment || "General"}</p>
                          </td>

                          {/* Problem Summary */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="font-medium text-white truncate" title={ticket.title}>
                              {ticket.title}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5" title={ticket.description}>
                              {ticket.description}
                            </p>
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-2">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-medium text-slate-300 uppercase">
                              {ticket.category}
                            </span>
                          </td>

                          {/* Priority */}
                          <td className="py-3.5 px-2 whitespace-nowrap">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded font-black text-[11px] uppercase tracking-wider",
                                ticket.priority === "P1" && "bg-rose-500 text-white",
                                ticket.priority === "P2" && "bg-orange-500 text-white",
                                ticket.priority === "P3" && "bg-amber-500 text-slate-950",
                                ticket.priority === "P4" && "bg-slate-700 text-slate-200"
                              )}
                            >
                              {ticket.priority}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-2 whitespace-nowrap">
                            <StatusBadge value={ticket.status as any} />
                          </td>

                          {/* AI Diagnostic Summary */}
                          <td className="py-3.5 px-3 max-w-[200px]">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <Sparkles className="h-3 w-3 text-cyan-400 shrink-0" />
                              <span className="text-slate-300 font-medium">
                                Conf: {Math.round((ticket.aiConfidence || 0.7) * 100)}%
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5" title={ticket.escalationReason}>
                              {ticket.escalationReason || "Escalated to human support"}
                            </p>
                          </td>

                          {/* Dates */}
                          <td className="py-3.5 px-3 whitespace-nowrap text-[11px] text-slate-400">
                            <div>Created: {new Date(ticket.createdAt).toLocaleDateString()}</div>
                            {ticket.assignedAt && (
                              <div className="text-[10px] text-amber-400/80">
                                Assigned: {new Date(ticket.assignedAt).toLocaleDateString()}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Open Context button */}
                              <button
                                type="button"
                                onClick={() => void openTicketDetails(ticket.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-all"
                                title="Open full AI context and technician controls"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Inspect
                              </button>

                              {/* Quick Accept if not assigned to me */}
                              {!isAssignedToMe && ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
                                <button
                                  type="button"
                                  onClick={() => void handleAcceptTicket(ticket.id)}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all"
                                  title="Accept and assign to me"
                                >
                                  <UserCheck className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {/* Auto Assign Recommendation */}
                              {!ticket.technicianId && ticket.status === "OPEN" && (
                                <button
                                  type="button"
                                  onClick={() => void handleFetchRecommendation(ticket.id)}
                                  className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 transition-all"
                                  title="Intelligent Assignment Recommendation"
                                >
                                  <Cpu className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {/* TAB 2: TECHNICIAN PROFILE & CAPACITY */}
      {activeTab === "profile" && (
        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl space-y-6">
            <div className="flex items-start justify-between border-b border-white/10 pb-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Technician Operations Profile
                </span>
                <h2 className="text-2xl font-black text-white mt-1">
                  {profile?.name || user?.name || "Sam Staff"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {profile?.department || "IT Support"} · {profile?.email || user?.email}
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
                    profile?.availability === "AVAILABLE" && "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
                    profile?.availability === "BUSY" && "bg-amber-500/10 border-amber-500/30 text-amber-400",
                    profile?.availability === "OFFLINE" && "bg-slate-700/50 border-slate-600 text-slate-400"
                  )}
                >
                  ● {profile?.availability || "AVAILABLE"}
                </span>
              </div>
            </div>

            {profileMessage && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0" />
                {profileMessage}
              </div>
            )}

            {/* Quick Status Toggle */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Update Dispatch Availability
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => void handleUpdateAvailability("AVAILABLE")}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all",
                    profile?.availability === "AVAILABLE"
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold shadow-lg shadow-emerald-500/10"
                      : "border-white/10 bg-slate-950/60 text-slate-400 hover:text-white"
                  )}
                >
                  <p className="text-sm font-semibold">Available</p>
                  <p className="text-[10px] opacity-75">Ready for auto-routing</p>
                </button>

                <button
                  type="button"
                  onClick={() => void handleUpdateAvailability("BUSY")}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all",
                    profile?.availability === "BUSY"
                      ? "border-amber-500 bg-amber-500/20 text-amber-300 font-bold shadow-lg shadow-amber-500/10"
                      : "border-white/10 bg-slate-950/60 text-slate-400 hover:text-white"
                  )}
                >
                  <p className="text-sm font-semibold">Busy</p>
                  <p className="text-[10px] opacity-75">At active capacity</p>
                </button>

                <button
                  type="button"
                  onClick={() => void handleUpdateAvailability("OFFLINE")}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all",
                    profile?.availability === "OFFLINE"
                      ? "border-slate-500 bg-slate-800 text-white font-bold"
                      : "border-white/10 bg-slate-950/60 text-slate-400 hover:text-white"
                  )}
                >
                  <p className="text-sm font-semibold">Offline</p>
                  <p className="text-[10px] opacity-75">Off-duty / Do not assign</p>
                </button>
              </div>
            </div>

            {/* Workload Capacity Meter */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-300">Active Workload Capacity</span>
                <span className="font-mono text-amber-400 font-bold">
                  {profile?.workload ?? 0} / {profile?.capacity ?? 5} active tickets
                </span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(((profile?.workload ?? 1) / (profile?.capacity ?? 5)) * 100)
                    )}%`
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Average Resolution Time: <strong className="text-white">{profile?.averageResolutionHours ?? 1.5}h</strong>
              </p>
            </div>

            {/* Skills & Expertise Editor */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Skills & Technical Expertise Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {profile?.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold"
                  >
                    <Tag className="h-3 w-3" />
                    {skill}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editingSkills}
                  onChange={(e) => setEditingSkills(e.target.value)}
                  placeholder="Comma separated: network, vpn, hardware, macos, cloud"
                  className="flex-1 bg-slate-950/70 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveProfileSkills()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all"
                >
                  Save Skills
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Intelligent routing matches ticket categories against these skill keywords.
              </p>
            </div>

            {/* Performance Telemetry */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-950/40 border border-white/5 text-center">
                <p className="text-xl font-black text-white">{profile?.stats?.activeTickets ?? 0}</p>
                <p className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Active Tickets</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/40 border border-white/5 text-center">
                <p className="text-xl font-black text-emerald-400">{profile?.stats?.resolvedTickets ?? 0}</p>
                <p className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Resolved Lifetime</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/40 border border-white/5 text-center">
                <p className="text-xl font-black text-rose-400">{profile?.stats?.highPriorityAssigned ?? 0}</p>
                <p className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">High Priority</p>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* TAB 3: NOTIFICATIONS PANEL */}
      {activeTab === "notifications" && (
        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Bell className="h-5 w-5 text-amber-400" />
                  Support Dispatch Notifications
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time alerts for ticket assignments, priority escalations, and customer replies.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleMarkAllNotificationsRead()}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
              >
                Mark all read
              </button>
            </div>

            <div className="divide-y divide-white/5">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Bell className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                  <p className="font-semibold text-slate-300">No notifications</p>
                  <p className="text-xs text-slate-500 mt-1">You are completely up to date.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      "py-3.5 px-3 rounded-xl transition-colors flex items-start justify-between gap-3",
                      !notif.read ? "bg-amber-500/5 border border-amber-500/20" : "hover:bg-white/[0.02]"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-lg shrink-0 mt-0.5",
                          notif.type.includes("ASSIGNED") && "bg-amber-500/20 text-amber-300",
                          notif.type.includes("PRIORITY") && "bg-rose-500/20 text-rose-300",
                          notif.type.includes("RESOLVED") && "bg-emerald-500/20 text-emerald-300",
                          notif.type.includes("USER") && "bg-cyan-500/20 text-cyan-300"
                        )}
                      >
                        <Bell className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-white">{notif.title}</p>
                          {!notif.read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          )}
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{notif.message}</p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {new Date(notif.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {!notif.read && (
                      <button
                        type="button"
                        onClick={() => void handleMarkNotificationRead(notif.id)}
                        className="text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 border border-white/10 shrink-0"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      )}

      {/* ============================================================ */}
      {/* SECTION 3: TICKET DETAILS MODAL (FULL AI CONTEXT & CONTROLS) */}
      {/* ============================================================ */}
      {selectedTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 bg-slate-950/80 flex items-start justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-md font-mono text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  #{ticketDetails?.ticket.id.slice(-6).toUpperCase() || selectedTicketId.slice(-6).toUpperCase()}
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white line-clamp-1">
                    {ticketDetails?.problem.title || "Loading Ticket..."}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400 uppercase font-semibold">
                      Category: <span className="text-white">{ticketDetails?.problem.category}</span>
                    </span>
                    <span className="text-slate-600">·</span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                        ticketDetails?.problem.priority === "P1" && "bg-rose-500 text-white",
                        ticketDetails?.problem.priority === "P2" && "bg-orange-500 text-white",
                        ticketDetails?.problem.priority === "P3" && "bg-amber-500 text-slate-950",
                        ticketDetails?.problem.priority === "P4" && "bg-slate-700 text-slate-200"
                      )}
                    >
                      {ticketDetails?.problem.priority}
                    </span>
                    <span className="text-slate-600">·</span>
                    {ticketDetails && <StatusBadge value={ticketDetails.ticket.status as any} />}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedTicketId(null);
                  setTicketDetails(null);
                }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            {isLoadingDetails ? (
              <div className="py-24 text-center text-slate-400">
                <Cpu className="h-8 w-8 animate-spin mx-auto text-amber-500 mb-3" />
                <p className="font-semibold text-white">Aggregating Full Diagnostic Context...</p>
                <p className="text-xs text-slate-500 mt-1">
                  Loading AI conversation transcript, RAG citations, and attempt telemetry.
                </p>
              </div>
            ) : ticketDetails ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. ESCALATION WARNING BANNER */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                          Why AI Escalation Occurred
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-400">AI Confidence:</span>
                          <span className="text-xs font-mono font-bold text-amber-300">
                            {Math.round(ticketDetails.escalationInfo.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-amber-100 font-medium mt-1 leading-relaxed">
                        {ticketDetails.escalationInfo.reason}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-4 text-[11px] text-amber-200/80">
                        <span>
                          Attempts Count: <strong className="text-white">{ticketDetails.escalationInfo.attemptsCount}</strong>
                        </span>
                        <span>
                          Last Automated Step: <strong className="text-white">{ticketDetails.escalationInfo.lastAttemptedAction}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. USER INFORMATION & CONTACT AUTHORIZATION */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-teal-400" />
                      User Identity
                    </span>
                    <p className="text-sm font-bold text-white mt-1.5">{ticketDetails.userInfo.name}</p>
                    <p className="text-xs text-slate-400">{ticketDetails.userInfo.department}</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-sky-400" />
                      Contact & Authorization
                    </span>
                    <p className="text-xs font-mono text-slate-300 mt-1.5">{ticketDetails.userInfo.email}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{ticketDetails.userInfo.phone}</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5 text-amber-400" />
                      Assigned Technician
                    </span>
                    <p className="text-sm font-bold text-white mt-1.5">
                      {ticketDetails.ticket.technicianName || "Unassigned"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {ticketDetails.ticket.assignedAt
                        ? `Assigned: ${new Date(ticketDetails.ticket.assignedAt).toLocaleDateString()}`
                        : "Waiting for triage"}
                    </p>
                  </div>
                </div>

                {/* 3. PROBLEM DESCRIPTION */}
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Original Incident Description
                  </span>
                  <p className="text-xs text-slate-200 mt-2 whitespace-pre-wrap leading-relaxed">
                    {ticketDetails.problem.description}
                  </p>
                </div>

                {/* 4. TECHNICIAN ACTION TOOLBAR */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Wrench className="h-4 w-4" />
                      Technician Action Controls
                    </span>
                    <span className="text-[11px] text-slate-400">Tier-2 Response Actions</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Accept Ticket */}
                    {ticketDetails.ticket.technicianId !== user?.id &&
                      ticketDetails.ticket.status !== "RESOLVED" &&
                      ticketDetails.ticket.status !== "CLOSED" && (
                        <button
                          type="button"
                          onClick={() => void handleAcceptTicket(ticketDetails.ticket.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-all"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Accept Ticket
                        </button>
                      )}

                    {/* Start Work */}
                    {ticketDetails.ticket.status === "ASSIGNED" && (
                      <button
                        type="button"
                        onClick={() => void handleStartWork(ticketDetails.ticket.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition-all"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Start Work
                      </button>
                    )}

                    {/* Add Troubleshooting Action */}
                    {ticketDetails.ticket.status !== "RESOLVED" && ticketDetails.ticket.status !== "CLOSED" && (
                      <button
                        type="button"
                        onClick={() => setShowActionModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs border border-white/10 transition-all"
                      >
                        <FileText className="h-3.5 w-3.5 text-amber-400" />
                        Add Troubleshooting Action
                      </button>
                    )}

                    {/* Request Information */}
                    {ticketDetails.ticket.status !== "RESOLVED" && ticketDetails.ticket.status !== "CLOSED" && (
                      <button
                        type="button"
                        onClick={() => setShowRequestInfoModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-all"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Request Info from User
                      </button>
                    )}

                    {/* Change Priority Dropdown */}
                    <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-white/10 text-xs">
                      <span className="text-slate-400 font-semibold text-[11px]">Priority:</span>
                      <select
                        value={ticketDetails.problem.priority}
                        onChange={(e) => void handleUpdatePriority(e.target.value as any)}
                        className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                      >
                        <option value="P1" className="bg-slate-900 text-rose-400 font-bold">P1 - Critical</option>
                        <option value="P2" className="bg-slate-900 text-orange-400 font-bold">P2 - High</option>
                        <option value="P3" className="bg-slate-900 text-amber-400 font-bold">P3 - Medium</option>
                        <option value="P4" className="bg-slate-900 text-slate-300 font-bold">P4 - Low</option>
                      </select>
                    </div>

                    {/* Change Status Dropdown */}
                    <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-white/10 text-xs">
                      <span className="text-slate-400 font-semibold text-[11px]">Status:</span>
                      <select
                        value={ticketDetails.ticket.status}
                        onChange={(e) => void handleUpdateStatus(e.target.value)}
                        className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                      >
                        <option value="OPEN" className="bg-slate-900">OPEN</option>
                        <option value="ASSIGNED" className="bg-slate-900">ASSIGNED</option>
                        <option value="IN_PROGRESS" className="bg-slate-900">IN_PROGRESS</option>
                        <option value="WAITING_FOR_USER" className="bg-slate-900">WAITING_FOR_USER</option>
                        <option value="RESOLVED" className="bg-slate-900">RESOLVED</option>
                        <option value="CLOSED" className="bg-slate-900">CLOSED</option>
                      </select>
                    </div>

                    {/* Resolve Ticket Button */}
                    {ticketDetails.ticket.status !== "RESOLVED" && ticketDetails.ticket.status !== "CLOSED" && (
                      <button
                        type="button"
                        onClick={() => setShowResolveModal(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all ml-auto"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Resolve Ticket
                      </button>
                    )}

                    {/* Save as Knowledge Contribution Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setKbTitle(`Resolved: ${ticketDetails.ticket.title}`);
                        setKbProblem(ticketDetails.ticket.description);
                        setKbCategory(ticketDetails.ticket.category || "network");
                        setKbRootCause(ticketDetails.ticket.resolution?.rootCause || "");
                        setKbSteps(
                          ticketDetails.technicianActions.map((a) => a.action).join("\n") ||
                          ticketDetails.aiTroubleshootingHistory.successfulActions.join("\n") ||
                          ""
                        );
                        setKbSolution(ticketDetails.ticket.resolution?.summary || "");
                        setKbTags(ticketDetails.ticket.category || "troubleshooting");
                        setShowKnowledgeModal(true);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition-all",
                        ticketDetails.ticket.status === "RESOLVED" || ticketDetails.ticket.status === "CLOSED" ? "ml-auto" : ""
                      )}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                      Save as Knowledge
                    </button>

                    {/* Reopen Ticket Button */}
                    {(ticketDetails.ticket.status === "RESOLVED" || ticketDetails.ticket.status === "CLOSED") && (
                      <button
                        type="button"
                        onClick={() => setShowReopenModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reopen Ticket
                      </button>
                    )}
                  </div>
                </div>

                {/* 5. DIAGNOSTIC CONTEXT TABS */}
                <div className="border-b border-white/10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailsTab("ai-context")}
                    className={cn(
                      "flex items-center gap-1.5 py-2.5 px-3 text-xs font-bold border-b-2 transition-all",
                      detailsTab === "ai-context"
                        ? "border-amber-400 text-amber-400"
                        : "border-transparent text-slate-400 hover:text-white"
                    )}
                  >
                    <Cpu className="h-3.5 w-3.5" />
                    AI Diagnostic History ({ticketDetails.aiTroubleshootingHistory.steps.length} Steps)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailsTab("rag")}
                    className={cn(
                      "flex items-center gap-1.5 py-2.5 px-3 text-xs font-bold border-b-2 transition-all",
                      detailsTab === "rag"
                        ? "border-amber-400 text-amber-400"
                        : "border-transparent text-slate-400 hover:text-white"
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                    RAG Knowledge Citations ({ticketDetails.ragInfo.sources.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailsTab("actions")}
                    className={cn(
                      "flex items-center gap-1.5 py-2.5 px-3 text-xs font-bold border-b-2 transition-all",
                      detailsTab === "actions"
                        ? "border-amber-400 text-amber-400"
                        : "border-transparent text-slate-400 hover:text-white"
                    )}
                  >
                    <FileText className="h-3.5 w-3.5 text-amber-400" />
                    Technician Actions Log ({ticketDetails.technicianActions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailsTab("thread")}
                    className={cn(
                      "flex items-center gap-1.5 py-2.5 px-3 text-xs font-bold border-b-2 transition-all",
                      detailsTab === "thread"
                        ? "border-amber-400 text-amber-400"
                        : "border-transparent text-slate-400 hover:text-white"
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-purple-400" />
                    Customer Communication Thread ({ticketDetails.replies.length})
                  </button>
                </div>

                {/* TAB CONTENT: AI TROUBLESHOOTING HISTORY & CONVERSATION */}
                {detailsTab === "ai-context" && (
                  <div className="space-y-4">
                    {/* Successful vs Failed Actions Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                        <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Successful Actions Attempted
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {ticketDetails.aiTroubleshootingHistory.successfulActions.length === 0 ? (
                            <span className="text-xs text-slate-500 italic">None completed successfully</span>
                          ) : (
                            ticketDetails.aiTroubleshootingHistory.successfulActions.map((act) => (
                              <span
                                key={act}
                                className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 text-[11px] font-medium"
                              >
                                {act}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5">
                        <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> Failed Actions (Do Not Repeat)
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {ticketDetails.aiTroubleshootingHistory.failedActions.length === 0 ? (
                            <span className="text-xs text-slate-500 italic">No specific action failures recorded</span>
                          ) : (
                            ticketDetails.aiTroubleshootingHistory.failedActions.map((act) => (
                              <span
                                key={act}
                                className="px-2.5 py-0.5 rounded-md bg-rose-500/20 text-rose-200 border border-rose-500/30 text-[11px] font-medium"
                              >
                                {act}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step-by-Step AI Remediation Timeline */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        Adaptive Troubleshooting Sequence
                      </h4>
                      <div className="space-y-2.5">
                        {ticketDetails.aiTroubleshootingHistory.steps.map((step) => (
                          <div
                            key={step.stepNumber}
                            className="p-3.5 rounded-xl border border-white/5 bg-slate-950/60 flex items-start gap-3"
                          >
                            <span className="h-6 w-6 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                              {step.stepNumber}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-bold text-white">{step.actionName}</p>
                                <span
                                  className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                    step.outcome === "SUCCESS" && "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
                                    step.outcome === "FAILURE" && "bg-rose-500/20 text-rose-300 border border-rose-500/30",
                                    step.outcome === "PARTIAL" && "bg-amber-500/20 text-amber-300 border border-amber-500/30",
                                    step.outcome === "PENDING" && "bg-slate-700 text-slate-300"
                                  )}
                                >
                                  {step.outcome}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1">{step.description}</p>
                              {step.userFeedback && (
                                <p className="text-[11px] text-amber-200/90 mt-1 italic bg-amber-500/5 p-1.5 rounded border border-amber-500/10">
                                  User feedback: "{step.userFeedback}"
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Full Conversational Dialogue */}
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-cyan-400" />
                        AI Agent & User Conversation Record
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto p-3 bg-slate-950 rounded-xl border border-white/5">
                        {ticketDetails.aiTroubleshootingHistory.conversation.map((msg, i) => (
                          <div
                            key={i}
                            className={cn(
                              "p-2.5 rounded-lg text-xs",
                              msg.role === "assistant"
                                ? "bg-slate-900 border border-white/10 text-slate-200 mr-8"
                                : "bg-teal-500/10 border border-teal-500/20 text-teal-100 ml-8"
                            )}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block mb-1">
                              {msg.role === "assistant" ? "AI Agent" : "Employee"}
                            </span>
                            <p className="leading-relaxed">{msg.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT: RAG PROCEDURES & CITATIONS */}
                {detailsTab === "rag" && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400">
                      Procedures and standard operating guidelines automatically retrieved and consulted by the AI engine:
                    </p>
                    {ticketDetails.ragInfo.sources.map((src, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl border border-white/10 bg-slate-950/60 flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5">
                          <FileText className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-white">{src.title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Procedure: {src.procedure || src.title}
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-mono text-[11px] shrink-0">
                          {Math.round(src.relevance * 100)}% match
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB CONTENT: TECHNICIAN ACTIONS LOG */}
                {detailsTab === "actions" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400">Recorded diagnostic actions performed by staff:</p>
                      <button
                        type="button"
                        onClick={() => setShowActionModal(true)}
                        className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                      >
                        + Log new action
                      </button>
                    </div>

                    {ticketDetails.technicianActions.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-xs italic bg-slate-950 rounded-xl border border-white/5">
                        No technician actions recorded yet. Click "Add Troubleshooting Action" to log your work.
                      </div>
                    ) : (
                      ticketDetails.technicianActions.map((act) => (
                        <div
                          key={act.id}
                          className="p-3.5 rounded-xl border border-white/5 bg-slate-950/60 flex items-start justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-white">{act.action}</p>
                              <span
                                className={cn(
                                  "px-2 py-0.2 rounded text-[10px] font-bold uppercase",
                                  act.outcome === "SUCCESS" && "bg-emerald-500/20 text-emerald-300",
                                  act.outcome === "FAILED" && "bg-rose-500/20 text-rose-300",
                                  act.outcome === "PARTIAL" && "bg-amber-500/20 text-amber-300",
                                  act.outcome === "INVESTIGATING" && "bg-indigo-500/20 text-indigo-300"
                                )}
                              >
                                {act.outcome}
                              </span>
                            </div>
                            {act.notes && (
                              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{act.notes}</p>
                            )}
                            <p className="text-[10px] text-slate-500 mt-1.5">
                              By {act.performedByName || "Staff"} · {new Date(act.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB CONTENT: THREAD & REPLIES */}
                {detailsTab === "thread" && (
                  <div className="space-y-4">
                    <div className="space-y-2.5 max-h-72 overflow-y-auto p-3 bg-slate-950 rounded-xl border border-white/5">
                      {ticketDetails.replies.length === 0 ? (
                        <p className="text-center py-6 text-slate-500 text-xs italic">
                          No messages in this ticket thread yet.
                        </p>
                      ) : (
                        ticketDetails.replies.map((rep) => {
                          const isTechnician = rep.senderRole === "STAFF" || rep.senderRole === "TECHNICIAN" || rep.senderRole === "ADMIN";
                          return (
                            <div
                              key={rep.id}
                              className={cn(
                                "p-3 rounded-xl text-xs",
                                isTechnician
                                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-100 mr-6"
                                  : "bg-white/5 border border-white/10 text-slate-200 ml-6"
                              )}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-white">
                                  {rep.senderName || (isTechnician ? "Technician" : "User")}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(rep.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="leading-relaxed whitespace-pre-wrap">{rep.message}</p>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Quick Reply Form */}
                    <form onSubmit={handleQuickReply} className="flex gap-2">
                      <input
                        type="text"
                        value={quickReplyText}
                        onChange={(e) => setQuickReplyText(e.target.value)}
                        placeholder="Write a message to the user..."
                        className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <button
                        type="submit"
                        disabled={isSendingReply || !quickReplyText.trim()}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs disabled:opacity-50 transition-all flex items-center gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Reply
                      </button>
                    </form>
                  </div>
                )}

                {/* RESOLUTION RECORD (If Resolved) */}
                {ticketDetails.resolution && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        Resolution Record (Stored in MongoDB & Outcome Engine)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Resolved By: <strong className="text-white">{ticketDetails.resolution.resolvedByName}</strong>
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-emerald-200">
                      {ticketDetails.resolution.summary}
                    </p>
                    {ticketDetails.resolution.rootCause && (
                      <p className="text-xs text-slate-300">
                        <strong>Root Cause:</strong> {ticketDetails.resolution.rootCause}
                      </p>
                    )}
                    {ticketDetails.resolution.actionsTaken?.length > 0 && (
                      <p className="text-xs text-slate-300">
                        <strong>Actions Taken:</strong> {ticketDetails.resolution.actionsTaken.join(", ")}
                      </p>
                    )}
                    {ticketDetails.resolution.kbRecommendation && (
                      <p className="text-xs text-emerald-300/90 italic">
                        <strong>KB Recommendation:</strong> {ticketDetails.resolution.kbRecommendation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: ADD TROUBLESHOOTING ACTION                          */}
      {/* ============================================================ */}
      {showActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Wrench className="h-5 w-5 text-amber-400" />
              Log Troubleshooting Action
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Record a test, driver update, config patch, or network procedure you performed.
            </p>

            <form onSubmit={handleAddTroubleshootingAction} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Action Performed *
                </label>
                <input
                  type="text"
                  required
                  value={newActionTitle}
                  onChange={(e) => setNewActionTitle(e.target.value)}
                  placeholder="e.g. Cleared ARP cache & adjusted MTU to 1420"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Outcome Status
                </label>
                <select
                  value={newActionOutcome}
                  onChange={(e) => setNewActionOutcome(e.target.value as any)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="SUCCESS">SUCCESS (Issue improved or fixed)</option>
                  <option value="PARTIAL">PARTIAL (Partial relief observed)</option>
                  <option value="INVESTIGATING">INVESTIGATING (Testing in progress)</option>
                  <option value="FAILED">FAILED (Did not resolve issue)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Diagnostic Notes & Findings
                </label>
                <textarea
                  rows={3}
                  value={newActionNotes}
                  onChange={(e) => setNewActionNotes(e.target.value)}
                  placeholder="Additional telemetry details, metrics, ping results..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowActionModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                >
                  Save Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: REQUEST INFORMATION FROM USER                       */}
      {/* ============================================================ */}
      {showRequestInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-400" />
              Request Information From Employee
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Ticket status will automatically change to <strong>WAITING_FOR_USER</strong> and dispatch an alert.
            </p>

            <form onSubmit={handleRequestInfo} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Message / Question *
                </label>
                <textarea
                  required
                  rows={4}
                  value={requestInfoMessage}
                  onChange={(e) => setRequestInfoMessage(e.target.value)}
                  placeholder="e.g. Could you please confirm if this issue still occurs when connecting via direct ethernet cable rather than Wi-Fi?"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestInfoModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                >
                  Send & Change Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: RESOLVE TICKET                                      */}
      {/* ============================================================ */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              Complete Ticket Resolution
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Required by system SLA. Resolution data will feed the automated learning model.
            </p>

            <form onSubmit={handleResolveTicket} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Resolution Summary *
                </label>
                <input
                  type="text"
                  required
                  value={resolveSummary}
                  onChange={(e) => setResolveSummary(e.target.value)}
                  placeholder="e.g. Reconfigured MTU MSS clamping on Cisco gateway"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Root Cause (If known)
                </label>
                <input
                  type="text"
                  value={resolveRootCause}
                  onChange={(e) => setResolveRootCause(e.target.value)}
                  placeholder="e.g. ISP packet fragmentation on upstream uplink"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Actions Taken * (One per line)
                </label>
                <textarea
                  required
                  rows={3}
                  value={resolveActions}
                  onChange={(e) => setResolveActions(e.target.value)}
                  placeholder="MSS clamping applied&#10;Gateway tunnel rebooted&#10;Verified audio streaming"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Knowledge-Base Recommendation (Optional)
                </label>
                <input
                  type="text"
                  value={resolveKbRec}
                  onChange={(e) => setResolveKbRec(e.target.value)}
                  placeholder="e.g. Update KB-8821 with macOS Sequoia MTU values"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  Submit Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: SAVE AS KNOWLEDGE (STAFF CONTRIBUTION)                 */}
      {/* ============================================================ */}
      {showKnowledgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative text-white max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowKnowledgeModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-cyan-300 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Save as Knowledge Base Article</h3>
                <p className="text-xs text-slate-400">
                  Adaptive RAG learning: Newly solved solutions expand AI knowledge without model retraining
                </p>
              </div>
            </div>

            {kbSuccessMessage && (
              <div className="my-3 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{kbSuccessMessage}</span>
              </div>
            )}

            <form onSubmit={handleContributeKnowledge} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Knowledge Article Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={kbTitle}
                    onChange={(e) => setKbTitle(e.target.value)}
                    placeholder="e.g. Wi-Fi adapter restart & WLAN AutoConfig reset"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={kbCategory}
                    onChange={(e) => setKbCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="network">Network / Wi-Fi</option>
                    <option value="vpn">VPN / Remote Access</option>
                    <option value="hardware">Hardware / Printer</option>
                    <option value="software">Software / Outlook</option>
                    <option value="account">Account / Login / Password</option>
                    <option value="system">System / Windows / Mac</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Problem Description *
                </label>
                <textarea
                  required
                  rows={2}
                  value={kbProblem}
                  onChange={(e) => setKbProblem(e.target.value)}
                  placeholder="Detailed description of the symptom or user issue..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Root Cause (Identified by Technician)
                </label>
                <input
                  type="text"
                  value={kbRootCause}
                  onChange={(e) => setKbRootCause(e.target.value)}
                  placeholder="e.g. Stale WLAN AutoConfig service state after sleep/resume"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Troubleshooting Steps Taken * (One per line)
                </label>
                <textarea
                  required
                  rows={3}
                  value={kbSteps}
                  onChange={(e) => setKbSteps(e.target.value)}
                  placeholder="1. Verify adapter state in Device Manager&#10;2. Restart WLAN AutoConfig service in services.msc&#10;3. Reset network adapter via netsh int ip reset"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Final Verified Solution *
                </label>
                <textarea
                  required
                  rows={2}
                  value={kbSolution}
                  onChange={(e) => setKbSolution(e.target.value)}
                  placeholder="Exact steps to solve the issue that worked successfully..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  value={kbTags}
                  onChange={(e) => setKbTags(e.target.value)}
                  placeholder="wifi, wlan, network, adapter, windows"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <span className="text-[11px] text-slate-400">
                  Queues for Admin approval before embedding generation
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowKnowledgeModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={kbSubmitting}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                  >
                    {kbSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                        <span>Submit to Knowledge Base</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: REOPEN TICKET                                       */}
      {/* ============================================================ */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-400" />
              Reopen Ticket
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Provide context for why the issue has recurred or requires additional assistance.
            </p>

            <form onSubmit={handleReopenTicket} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason for Reopening
                </label>
                <textarea
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g. User reported the disconnect issue returned after overnight reboot."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
                >
                  Reopen Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 5: INTELLIGENT ASSIGNMENT RECOMMENDATION               */}
      {/* ============================================================ */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Cpu className="h-5 w-5 text-cyan-400" />
              Intelligent Assignment Recommendation
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Backend assignment engine evaluating skills, availability, and active capacity.
            </p>

            {isLoadingRec ? (
              <div className="py-12 text-center text-slate-400">
                <Cpu className="h-6 w-6 animate-spin mx-auto text-cyan-400 mb-2" />
                Scoring available technicians...
              </div>
            ) : assignmentRec?.recommendedTechnician ? (
              <div className="mt-4 space-y-4">
                <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">Top Recommended</p>
                      <h4 className="text-base font-bold text-white mt-1">
                        {assignmentRec.recommendedTechnician.name || "Technician"}
                      </h4>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-cyan-500 text-slate-950 font-black text-xs">
                      {Math.round(assignmentRec.decision.score * 100)}% Match
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2 font-medium">
                    Rationale: {assignmentRec.decision.reason}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400 border-t border-white/5 pt-2">
                    <div>
                      Workload: <strong className="text-white">{assignmentRec.recommendedTechnician.workload} / {assignmentRec.recommendedTechnician.capacity}</strong>
                    </div>
                    <div>
                      Status: <strong className="text-white">{assignmentRec.recommendedTechnician.availability}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                  >
                    Close
                  </button>
                  {selectedTicketId && (
                    <button
                      type="button"
                      onClick={() => void handleAutoAssign(selectedTicketId)}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                    >
                      Assign to {assignmentRec.recommendedTechnician.name || "Technician"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No matching technician available with current capacity.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
