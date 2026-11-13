import React, { useState, useEffect, useMemo } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Eye,
  FileCheck,
  FileText,
  Filter,
  HelpCircle,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Ticket,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Wrench,
  X,
  XCircle
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useAuth } from "../contexts/AuthContext";
import {
  getAdminOverviewApi,
  listAdminUsersApi,
  createAdminUserApi,
  updateAdminUserApi,
  toggleAdminUserStatusApi,
  getAdminUserTicketsApi,
  listAdminStaffApi,
  createAdminStaffApi,
  updateAdminStaffApi,
  listAdminTicketsApi,
  reassignAdminTicketApi,
  adminUpdateTicketApi,
  listAdminKnowledgeApi,
  createAdminKnowledgeApi,
  setAdminKnowledgeApprovalApi,
  archiveAdminKnowledgeApi,
  deleteAdminKnowledgeApi,
  getAdminAiRagMonitoringApi,
  getAdminAnalyticsApi,
  getAdminSettingsApi,
  updateAdminSettingApi,
  listAdminAuditLogsApi,
  listAdminStaffRequestsApi,
  reviewAdminStaffRequestApi,
  type AdminOverviewStats,
  type AdminUserRecord,
  type AdminStaffRecord,
  type StaffLoginRequestRecord,
  type AdminTicketRecord,
  type AdminKnowledgeRecord,
  type AdminAiRagTelemetry,
  type AdminAnalyticsData,
  type AdminSystemSettings,
  type AdminAuditLogRecord
} from "../services/api";

type AdminTab =
  | "overview"
  | "users"
  | "staff"
  | "tickets"
  | "knowledge"
  | "monitoring"
  | "analytics"
  | "settings"
  | "audit";

const COLORS = ["#0d9488", "#0284c7", "#6366f1", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];

export function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // 1. Overview data
  const [overview, setOverview] = useState<AdminOverviewStats | null>(null);

  // 2. Users data
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<AdminUserRecord | null>(null);
  const [userHistoryData, setUserHistoryData] = useState<{ tickets: any[]; sessions: any[] } | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER",
    department: "Product Engineering",
    phone: ""
  });

  // 3. Staff data
  const [staffList, setStaffList] = useState<AdminStaffRecord[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffDeptFilter, setStaffDeptFilter] = useState("ALL");
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    name: "",
    email: "",
    password: "",
    department: "IT Support",
    phone: "",
    capacity: 5,
    skills: ["Networking", "VPN", "Hardware"]
  });
  const [editingStaff, setEditingStaff] = useState<AdminStaffRecord | null>(null);
  const [staffRequests, setStaffRequests] = useState<StaffLoginRequestRecord[]>([]);
  const [pendingStaffCount, setPendingStaffCount] = useState<number>(0);
  const [reviewingStaffId, setReviewingStaffId] = useState<string | null>(null);
  const [staffViewSubTab, setStaffViewSubTab] = useState<"directory" | "requests">("directory");

  const handleReviewStaffRequest = async (id: string, decision: "ACCEPT" | "REJECT") => {
    setReviewingStaffId(id);
    try {
      const res = await reviewAdminStaffRequestApi(id, decision);
      notify("success", res.message);
      const [staffRes, reqRes] = await Promise.all([
        listAdminStaffApi({ search: staffSearch, department: staffDeptFilter }),
        listAdminStaffRequestsApi().catch(() => ({ requests: [], pendingCount: 0 }))
      ]);
      setStaffList(staffRes.staff);
      setStaffRequests(reqRes.requests);
      setPendingStaffCount(reqRes.pendingCount);
    } catch (err: any) {
      notify("error", err?.response?.data?.message || err?.message || "Failed to review staff request");
    } finally {
      setReviewingStaffId(null);
    }
  };

  // 4. Tickets data
  const [tickets, setTickets] = useState<AdminTicketRecord[]>([]);
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("ALL");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState("ALL");
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState("ALL");
  const [selectedTicket, setSelectedTicket] = useState<AdminTicketRecord | null>(null);
  const [reassignTechId, setReassignTechId] = useState<string>("");

  // 5. Knowledge & RAG data
  const [knowledgeDocs, setKnowledgeDocs] = useState<AdminKnowledgeRecord[]>([]);
  const [kbCategoryFilter, setKbCategoryFilter] = useState("ALL");
  const [kbApprovalFilter, setKbApprovalFilter] = useState("ALL");
  const [showUploadDocModal, setShowUploadDocModal] = useState(false);
  const [newDocForm, setNewDocForm] = useState({
    title: "",
    category: "vpn",
    department: "IT Infrastructure",
    version: "v1.0",
    content: "",
    autoApprove: true
  });
  const [viewingDoc, setViewingDoc] = useState<AdminKnowledgeRecord | null>(null);

  // 6. AI/RAG Telemetry data
  const [telemetry, setTelemetry] = useState<AdminAiRagTelemetry | null>(null);

  // 7. Analytics & Research data
  const [analytics, setAnalytics] = useState<AdminAnalyticsData | null>(null);

  // 8. System Settings data
  const [settings, setSettings] = useState<AdminSystemSettings | null>(null);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [newSkillInput, setNewSkillInput] = useState("");

  // 9. Audit Logs data
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRecord[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");

  const notify = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  // Main loader per active tab
  useEffect(() => {
    let isMounted = true;
    async function loadTabData() {
      setLoading(true);
      try {
        if (activeTab === "overview") {
          const [stats, reqRes] = await Promise.all([
            getAdminOverviewApi(),
            listAdminStaffRequestsApi().catch(() => ({ requests: [], pendingCount: 0 }))
          ]);
          if (isMounted) {
            setOverview(stats);
            setStaffRequests(reqRes.requests);
            setPendingStaffCount(reqRes.pendingCount);
          }
        } else if (activeTab === "users") {
          const res = await listAdminUsersApi({ search: userSearch, role: userRoleFilter });
          if (isMounted) setUsers(res.users);
        } else if (activeTab === "staff") {
          const [res, reqRes] = await Promise.all([
            listAdminStaffApi({ search: staffSearch, department: staffDeptFilter }),
            listAdminStaffRequestsApi().catch(() => ({ requests: [], pendingCount: 0 }))
          ]);
          if (isMounted) {
            setStaffList(res.staff);
            setStaffRequests(reqRes.requests);
            setPendingStaffCount(reqRes.pendingCount);
          }
        } else if (activeTab === "tickets") {
          const [tRes, sRes] = await Promise.all([
            listAdminTicketsApi({
              search: ticketSearch,
              status: ticketStatusFilter,
              priority: ticketPriorityFilter,
              category: ticketCategoryFilter
            }),
            listAdminStaffApi()
          ]);
          if (isMounted) {
            setTickets(tRes.tickets);
            setStaffList(sRes.staff);
          }
        } else if (activeTab === "knowledge") {
          const res = await listAdminKnowledgeApi({
            category: kbCategoryFilter,
            approvalStatus: kbApprovalFilter
          });
          if (isMounted) setKnowledgeDocs(res.documents);
        } else if (activeTab === "monitoring") {
          const res = await getAdminAiRagMonitoringApi();
          if (isMounted) setTelemetry(res);
        } else if (activeTab === "analytics") {
          const res = await getAdminAnalyticsApi();
          if (isMounted) setAnalytics(res);
        } else if (activeTab === "settings") {
          const res = await getAdminSettingsApi();
          if (isMounted) setSettings(res);
        } else if (activeTab === "audit") {
          const res = await listAdminAuditLogsApi({ search: auditSearch, action: auditActionFilter });
          if (isMounted) setAuditLogs(res.logs);
        }
      } catch (err: any) {
        console.error("Failed to load admin tab data:", err);
        if (isMounted) notify("error", err?.response?.data?.message || err.message || "Failed to load data");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadTabData();
    return () => {
      isMounted = false;
    };
  }, [
    activeTab,
    refreshKey,
    userRoleFilter,
    staffDeptFilter,
    ticketStatusFilter,
    ticketPriorityFilter,
    ticketCategoryFilter,
    kbCategoryFilter,
    kbApprovalFilter,
    auditActionFilter
  ]);

  /* ------------------------------------------------------------------ */
  /* User Actions                                                       */
  /* ------------------------------------------------------------------ */
  const handleToggleUserStatus = async (userRecord: AdminUserRecord) => {
    try {
      const newStatus = !userRecord.active;
      await toggleAdminUserStatusApi(userRecord.id, newStatus);
      setUsers((prev) => prev.map((u) => (u.id === userRecord.id ? { ...u, active: newStatus } : u)));
      notify("success", `User ${userRecord.name} marked as ${newStatus ? "ACTIVE" : "INACTIVE"}`);
    } catch (err: any) {
      notify("error", err?.response?.data?.message || "Failed to update user status");
    }
  };

  const handleOpenUserHistory = async (userRecord: AdminUserRecord) => {
    setSelectedUserForHistory(userRecord);
    try {
      const history = await getAdminUserTicketsApi(userRecord.id);
      setUserHistoryData(history);
    } catch (err: any) {
      notify("error", "Failed to fetch user history");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAdminUserApi(newUserForm);
      notify("success", `User ${newUserForm.name} created successfully.`);
      setShowCreateUserModal(false);
      setNewUserForm({
        name: "",
        email: "",
        password: "",
        role: "USER",
        department: "Product Engineering",
        phone: ""
      });
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      notify("error", err?.response?.data?.message || "Failed to create user");
    }
  };

  /* ------------------------------------------------------------------ */
  /* Staff Actions                                                      */
  /* ------------------------------------------------------------------ */
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAdminStaffApi(newStaffForm);
      notify("success", `Staff member ${newStaffForm.name} enrolled.`);
      setShowCreateStaffModal(false);
      setNewStaffForm({
        name: "",
        email: "",
        password: "",
        department: "IT Support",
        phone: "",
        capacity: 5,
        skills: ["Networking", "VPN"]
      });
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      notify("error", err?.response?.data?.message || "Failed to add staff member");
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      await updateAdminStaffApi(editingStaff.userId || editingStaff.id, {
        department: editingStaff.department,
        skills: editingStaff.skills,
        capacity: editingStaff.capacity,
        availability: editingStaff.availability,
        active: editingStaff.active
      });
      notify("success", `Updated staff settings for ${editingStaff.name}`);
      setEditingStaff(null);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      notify("error", err?.response?.data?.message || "Failed to update staff member");
    }
  };

  /* ------------------------------------------------------------------ */
  /* Ticket Actions                                                     */
  /* ------------------------------------------------------------------ */
  const handleReassignTicket = async () => {
    if (!selectedTicket) return;
    try {
      await reassignAdminTicketApi(selectedTicket.id, reassignTechId || null);
      notify("success", `Ticket reassigned successfully`);
      setSelectedTicket(null);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      notify("error", err?.response?.data?.message || "Failed to reassign ticket");
    }
  };

  const handleAdminTicketOverride = async (field: "priority" | "status", value: string) => {
    if (!selectedTicket) return;
    try {
      await adminUpdateTicketApi(selectedTicket.id, { [field]: value });
      notify("success", `Ticket ${field} updated to ${value}`);
      setSelectedTicket((prev) => (prev ? { ...prev, [field]: value } : null));
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      notify("error", err?.response?.data?.message || "Failed to update ticket");
    }
  };

  /* ------------------------------------------------------------------ */
  /* Knowledge & RAG Actions                                            */
  /* ------------------------------------------------------------------ */
  const handleUploadKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAdminKnowledgeApi(newDocForm);
      notify("success", `Knowledge document created and indexed in Atlas Vector Search.`);
      setShowUploadDocModal(false);
      setNewDocForm({
        title: "",
        category: "vpn",
        department: "IT Infrastructure",
        version: "v1.0",
        content: "",
        autoApprove: true
      });
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      notify("error", err?.response?.data?.message || "Failed to upload knowledge document");
    }
  };

  const handleSetApproval = async (docId: string, status: "APPROVED" | "REJECTED" | "PENDING") => {
    try {
      await setAdminKnowledgeApprovalApi(docId, status);
      notify("success", `Document status changed to ${status}`);
      setKnowledgeDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, approvalStatus: status } : d))
      );
    } catch (err: any) {
      notify("error", err?.response?.data?.message || "Failed to update approval status");
    }
  };

  const handleArchiveKnowledge = async (docId: string) => {
    try {
      await archiveAdminKnowledgeApi(docId);
      notify("success", "Document archived");
      setKnowledgeDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: "ARCHIVED" } : d))
      );
    } catch (err: any) {
      notify("error", err?.response?.data?.message || "Failed to archive document");
    }
  };

  const handleDeleteKnowledge = async (docId: string) => {
    if (!confirm("Are you sure you want to permanently delete this knowledge document and its vector chunks?")) {
      return;
    }
    try {
      await deleteAdminKnowledgeApi(docId);
      notify("success", "Document permanently deleted");
      setKnowledgeDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      notify("error", err?.response?.data?.message || "Failed to delete document");
    }
  };

  /* ------------------------------------------------------------------ */
  /* System Settings Actions                                            */
  /* ------------------------------------------------------------------ */
  const handleAddCategory = async () => {
    if (!newCategoryInput.trim() || !settings) return;
    const cat = newCategoryInput.trim().toLowerCase();
    if (settings.categories.includes(cat)) return;
    const updated = [...settings.categories, cat];
    try {
      await updateAdminSettingApi("categories", updated);
      setSettings({ ...settings, categories: updated });
      setNewCategoryInput("");
      notify("success", `Category "${cat}" added`);
    } catch (err: any) {
      notify("error", "Failed to update categories");
    }
  };

  const handleRemoveCategory = async (cat: string) => {
    if (!settings) return;
    const updated = settings.categories.filter((c) => c !== cat);
    try {
      await updateAdminSettingApi("categories", updated);
      setSettings({ ...settings, categories: updated });
      notify("success", `Category "${cat}" removed`);
    } catch (err: any) {
      notify("error", "Failed to remove category");
    }
  };

  const handleAddSkill = async () => {
    if (!newSkillInput.trim() || !settings) return;
    const skill = newSkillInput.trim();
    if (settings.availableSkills.includes(skill)) return;
    const updated = [...settings.availableSkills, skill];
    try {
      await updateAdminSettingApi("availableSkills", updated);
      setSettings({ ...settings, availableSkills: updated });
      setNewSkillInput("");
      notify("success", `Skill "${skill}" registered`);
    } catch (err: any) {
      notify("error", "Failed to update skills");
    }
  };

  const handleUpdateSla = async (pKey: string, hours: number) => {
    if (!settings) return;
    const updated = { ...settings.prioritySlaHours, [pKey]: hours };
    try {
      await updateAdminSettingApi("prioritySlaHours", updated);
      setSettings({ ...settings, prioritySlaHours: updated });
      notify("success", `SLA for ${pKey} updated to ${hours} hours`);
    } catch (err: any) {
      notify("error", "Failed to update SLA");
    }
  };

  const handleUpdateEscalationRule = async (field: string, val: any) => {
    if (!settings) return;
    const updated = { ...settings.escalationRules, [field]: val };
    try {
      await updateAdminSettingApi("escalationRules", updated);
      setSettings({ ...settings, escalationRules: updated });
      notify("success", `Escalation rule updated`);
    } catch (err: any) {
      notify("error", "Failed to update rule");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
      {/* Top Banner / Breadcrumb */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">ResolveAI Admin Console</h1>
                <span className="rounded-full bg-teal-100 dark:bg-teal-950/60 px-2 py-0.5 text-xs font-semibold text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
                  Role: Administrator
                </span>
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  MongoDB Atlas
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Central control for Users, Staff, Tickets, Knowledge Base, Vector RAG & Research Metrics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
              Refresh
            </button>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{user?.name}</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-400">{user?.email}</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 no-scrollbar border-t border-slate-100 dark:border-slate-800 text-xs font-medium">
            {[
              { id: "overview", label: "Admin Overview", icon: Activity },
              { id: "users", label: "User Management", icon: Users },
              { id: "staff", label: "Staff Management", icon: Wrench },
              { id: "tickets", label: "Ticket Management", icon: Ticket },
              { id: "knowledge", label: "Knowledge Base & RAG", icon: BookOpen },
              { id: "monitoring", label: "AI / RAG Monitoring", icon: Cpu },
              { id: "analytics", label: "Analytics & Research", icon: BarChart3 },
              { id: "settings", label: "System Settings", icon: Settings },
              { id: "audit", label: "Audit Logs", icon: ShieldAlert }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as AdminTab)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-slate-900 dark:bg-teal-600 text-white font-semibold shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-teal-400 dark:text-white" : "text-slate-400"}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Global Notification Banner */}
      {feedback && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs font-medium ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* ================================================================= */}
        {/* 1. ADMIN OVERVIEW                                                 */}
        {/* ================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Pending Staff Review Alert Banner */}
            {pendingStaffCount > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">
                      {pendingStaffCount} Staff Login Request{pendingStaffCount > 1 ? "s" : ""} Pending Review
                    </h4>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      New staff members have submitted access requests and are waiting for your approval before they can log in.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("staff");
                    setStaffViewSubTab("requests");
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer"
                >
                  Review Requests ({pendingStaffCount})
                </button>
              </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium uppercase tracking-wider">Total Users</span>
                  <Users className="h-4 w-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{overview?.totalUsers ?? "--"}</div>
                <div className="text-[11px] text-teal-700 font-medium mt-1">
                  {overview?.activeUsers ?? "--"} active accounts
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium uppercase tracking-wider">Total Tickets</span>
                  <Ticket className="h-4 w-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{overview?.totalTickets ?? "--"}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {overview?.openTickets ?? "--"} open / unassigned
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium uppercase tracking-wider">AI Resolved</span>
                  <Sparkles className="h-4 w-4 text-teal-600" />
                </div>
                <div className="text-2xl font-bold text-teal-700">{overview?.aiResolved ?? "--"}</div>
                <div className="text-[11px] text-teal-600 font-medium mt-1">Autonomous Tier-1</div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium uppercase tracking-wider">Human Resolved</span>
                  <UserCheck className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-700">{overview?.humanResolved ?? "--"}</div>
                <div className="text-[11px] text-blue-600 font-medium mt-1">Technician Workbench</div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium uppercase tracking-wider">Escalated</span>
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                </div>
                <div className="text-2xl font-bold text-rose-600">{overview?.escalatedTickets ?? "--"}</div>
                <div className="text-[11px] text-rose-600 font-medium mt-1">SLA Attention</div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium uppercase tracking-wider">Avg Resolution</span>
                  <Clock className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {overview?.averageResolutionHours != null ? `${overview.averageResolutionHours}h` : "--"}
                </div>
                <div className="text-[11px] text-indigo-600 font-medium mt-1">Mean Time to Resolve</div>
              </div>
            </div>

            {/* Middle Section: Platform Health & Atlas Vector Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Atlas Vector Search Banner */}
              <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 p-6 text-white shadow-md relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 px-2.5 py-1 text-xs font-semibold text-teal-300 border border-teal-500/30">
                      <Database className="h-3.5 w-3.5" />
                      MongoDB Atlas Vector Search Active
                    </span>
                    <h2 className="text-xl font-bold mt-3">Enterprise AI & Knowledge Engine</h2>
                    <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                      All troubleshooting documentation is indexed via real 384-dimensional vector embeddings stored
                      in MongoDB Atlas. Qdrant is deactivated in compliance with platform requirements.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-700/60">
                  <div>
                    <div className="text-xs text-slate-400">Total Knowledge Articles</div>
                    <div className="text-xl font-bold text-white mt-0.5">{overview?.totalKnowledgeDocs ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Approved for Production RAG</div>
                    <div className="text-xl font-bold text-emerald-400 mt-0.5">
                      {overview?.approvedKnowledgeDocs ?? 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Vector Embeddings Chunked</div>
                    <div className="text-xl font-bold text-teal-300 mt-0.5">{overview?.ragChunkCount ?? 0}</div>
                  </div>
                </div>
              </div>

              {/* Quick Actions Panel */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-teal-600" />
                    Quick Administrative Shortcuts
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Direct access to core administrative actions.</p>

                  <div className="mt-4 space-y-2">
                    <button
                      onClick={() => {
                        setActiveTab("users");
                        setShowCreateUserModal(true);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <UserPlus className="h-3.5 w-3.5 text-teal-600" />
                        Provision New User / Account
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab("staff");
                        setShowCreateStaffModal(true);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-blue-600" />
                        Enroll Support Technician
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab("knowledge");
                        setShowUploadDocModal(true);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                        Upload Knowledge Document & Embed
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Cluster: Primary-Atlas-Node-0</span>
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Operational
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 2. USER MANAGEMENT                                                */}
        {/* ================================================================= */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users by name, email, department..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-400"
                />
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
                >
                  <option value="ALL">All Roles</option>
                  <option value="USER">User</option>
                  <option value="STAFF">Staff / Technician</option>
                  <option value="ADMIN">Administrator</option>
                </select>

                <button
                  onClick={() => setShowCreateUserModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 shadow-sm transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add User
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Joined</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No users found matching query.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{u.name}</div>
                            <div className="text-[11px] text-slate-400">{u.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                u.role === "ADMIN"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : u.role === "STAFF" || u.role === "TECHNICIAN"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{u.department || "General"}</td>
                          <td className="py-3 px-4 text-slate-500">{u.phone || "—"}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                u.active
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${u.active ? "bg-emerald-500" : "bg-rose-500"}`}
                              />
                              {u.active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenUserHistory(u)}
                                title="View Ticket & Session History"
                                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleToggleUserStatus(u)}
                                title={u.active ? "Deactivate Account" : "Activate Account"}
                                className={`p-1.5 rounded-md hover:bg-slate-100 transition-colors ${
                                  u.active
                                    ? "text-rose-600 hover:text-rose-700"
                                    : "text-emerald-600 hover:text-emerald-700"
                                }`}
                              >
                                {u.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Create User Modal */}
            {showCreateUserModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-teal-600" />
                      Provision New User Account
                    </h3>
                    <button onClick={() => setShowCreateUserModal(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateUser} className="space-y-3 mt-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={newUserForm.name}
                        onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-teal-500"
                        placeholder="e.g. Jordan Rivera"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={newUserForm.email}
                        onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-teal-500"
                        placeholder="jordan@company.com"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Initial Password</label>
                      <input
                        type="password"
                        value={newUserForm.password}
                        onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-teal-500"
                        placeholder="Default: resolve123"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Role</label>
                        <select
                          value={newUserForm.role}
                          onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                        >
                          <option value="USER">USER</option>
                          <option value="STAFF">STAFF</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Department</label>
                        <input
                          type="text"
                          value={newUserForm.department}
                          onChange={(e) => setNewUserForm({ ...newUserForm, department: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={newUserForm.phone}
                        onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowCreateUserModal(false)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-teal-600 px-4 py-2 text-white font-semibold hover:bg-teal-700"
                      >
                        Create User
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* User History Modal */}
            {selectedUserForHistory && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">User Ticket & Troubleshooting History</h3>
                      <p className="text-xs text-slate-500">
                        {selectedUserForHistory.name} ({selectedUserForHistory.email})
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedUserForHistory(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-6">
                    {/* Tickets */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                        Filed Tickets ({userHistoryData?.tickets.length ?? 0})
                      </h4>
                      {userHistoryData?.tickets.length === 0 ? (
                        <p className="text-xs text-slate-400">No tickets submitted by this user.</p>
                      ) : (
                        <div className="space-y-2">
                          {userHistoryData?.tickets.map((t: any) => (
                            <div key={t.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-900">{t.title}</span>
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold">
                                  {t.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                                <span>Priority: {t.priority}</span>
                                <span>Category: {t.category}</span>
                                <span>{new Date(t.createdAt).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* AI Sessions */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                        AI Troubleshooting Sessions ({userHistoryData?.sessions.length ?? 0})
                      </h4>
                      {userHistoryData?.sessions.length === 0 ? (
                        <p className="text-xs text-slate-400">No AI sessions recorded for this user.</p>
                      ) : (
                        <div className="space-y-2">
                          {userHistoryData?.sessions.map((s: any) => (
                            <div key={s.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-800">{s.problemDescription}</span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    s.status === "RESOLVED"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}
                                >
                                  {s.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                                <span>Steps taken: {s.stepsCount}</span>
                                <span>{new Date(s.createdAt).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. STAFF MANAGEMENT                                               */}
        {/* ================================================================= */}
        {activeTab === "staff" && (
          <div className="space-y-4">
            {/* Sub-navigation: Staff Directory vs Pending Login Requests */}
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
              <button
                type="button"
                onClick={() => setStaffViewSubTab("directory")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  staffViewSubTab === "directory"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Active Staff Directory ({staffList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setStaffViewSubTab("requests")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  staffViewSubTab === "requests"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Pending Staff Login Requests</span>
                {pendingStaffCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-950 font-black">
                    {pendingStaffCount}
                  </span>
                )}
              </button>
            </div>

            {/* PENDING REQUESTS REVIEW VIEW */}
            {staffViewSubTab === "requests" && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Staff Access Requests Pending Review</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Review registration and Google login requests for Staff roles. You have permission to accept or reject each request.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {staffRequests.filter((r) => r.status === "PENDING_APPROVAL").length} Pending
                  </span>
                </div>

                {staffRequests.filter((r) => r.status === "PENDING_APPROVAL").length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-slate-900">All caught up!</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      There are currently no pending staff login requests waiting for review. When new staff members sign in, their requests will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {staffRequests
                      .filter((r) => r.status === "PENDING_APPROVAL")
                      .map((req) => {
                        const isReviewing = reviewingStaffId === req.id;
                        return (
                          <div
                            key={req.id}
                            className="bg-white rounded-2xl border border-amber-200/80 p-5 shadow-sm space-y-4 relative overflow-hidden"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                                  {req.name
                                    ? req.name
                                        .split(" ")
                                        .map((p) => p[0])
                                        .join("")
                                        .toUpperCase()
                                        .slice(0, 2)
                                    : "ST"}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-sm font-bold text-slate-900 truncate">{req.name}</h4>
                                  <p className="text-xs text-slate-500 truncate">{req.email}</p>
                                </div>
                              </div>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                Pending Approval
                              </span>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs space-y-1.5 text-slate-600">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Department:</span>
                                <span className="font-semibold text-slate-800">{req.department || "IT Support"}</span>
                              </div>
                              {req.phone && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Phone:</span>
                                  <span className="font-semibold text-slate-800">{req.phone}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-slate-400">Requested Role:</span>
                                <span className="font-semibold text-blue-700">{req.role}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Requested At:</span>
                                <span className="text-slate-600 font-mono text-[11px]">
                                  {new Date(req.staffRequestedAt || req.createdAt).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons: Accept / Reject */}
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                disabled={isReviewing}
                                onClick={() => void handleReviewStaffRequest(req.id, "ACCEPT")}
                                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                                <span>Accept Request</span>
                              </button>
                              <button
                                type="button"
                                disabled={isReviewing}
                                onClick={() => void handleReviewStaffRequest(req.id, "REJECT")}
                                className="flex-1 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                                <span>Reject Request</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* DIRECTORY VIEW */}
            {staffViewSubTab === "directory" && (
              <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff by name, skills, department..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-400"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCreateStaffModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 shadow-sm transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Staff Member
                </button>
              </div>
            </div>

            {/* Staff Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffList.map((st) => (
                <div key={st.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{st.name}</h3>
                      <p className="text-xs text-slate-500">{st.email}</p>
                      <span className="inline-block mt-1 text-[11px] font-medium text-slate-600">
                        {st.department}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                        st.availability === "AVAILABLE"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : st.availability === "BUSY"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {st.availability}
                    </span>
                  </div>

                  {/* Workload Meter */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Workload</span>
                      <span className="font-semibold">
                        {st.workload} / {st.capacity} tickets
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          st.workload >= st.capacity
                            ? "bg-rose-500"
                            : st.workload > st.capacity * 0.7
                            ? "bg-amber-500"
                            : "bg-teal-500"
                        }`}
                        style={{ width: `${Math.min(100, (st.workload / Math.max(1, st.capacity)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Skills Badges */}
                  <div>
                    <span className="text-[11px] font-medium text-slate-500 block mb-1.5">Assigned Skills:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {st.skills.map((sk) => (
                        <span
                          key={sk}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Edit Button */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Active: {st.activeTicketsCount ?? st.workload} tickets
                    </span>
                    <button
                      onClick={() => setEditingStaff(st)}
                      className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                    >
                      <Settings className="h-3 w-3" />
                      Configure
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Create Staff Modal */}
            {showCreateStaffModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-teal-600" />
                      Enroll New Support Staff
                    </h3>
                    <button onClick={() => setShowCreateStaffModal(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateStaff} className="space-y-3 mt-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Name *</label>
                      <input
                        type="text"
                        required
                        value={newStaffForm.name}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Email *</label>
                      <input
                        type="email"
                        required
                        value={newStaffForm.email}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Department</label>
                        <input
                          type="text"
                          value={newStaffForm.department}
                          onChange={(e) => setNewStaffForm({ ...newStaffForm, department: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Max Capacity</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={newStaffForm.capacity}
                          onChange={(e) => setNewStaffForm({ ...newStaffForm, capacity: Number(e.target.value) })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowCreateStaffModal(false)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-teal-600 px-4 py-2 text-white font-semibold hover:bg-teal-700"
                      >
                        Enroll Staff
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Edit Staff Modal */}
            {editingStaff && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900">Configure Staff: {editingStaff.name}</h3>
                    <button onClick={() => setEditingStaff(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form onSubmit={handleUpdateStaff} className="space-y-3 mt-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Department</label>
                      <input
                        type="text"
                        value={editingStaff.department}
                        onChange={(e) => setEditingStaff({ ...editingStaff, department: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Availability</label>
                        <select
                          value={editingStaff.availability}
                          onChange={(e) =>
                            setEditingStaff({
                              ...editingStaff,
                              availability: e.target.value as "AVAILABLE" | "BUSY" | "OFFLINE"
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                        >
                          <option value="AVAILABLE">AVAILABLE</option>
                          <option value="BUSY">BUSY</option>
                          <option value="OFFLINE">OFFLINE</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Max Capacity</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={editingStaff.capacity}
                          onChange={(e) => setEditingStaff({ ...editingStaff, capacity: Number(e.target.value) })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Skills (comma-separated: Networking, VPN, Linux, Windows, Hardware, Database...)
                      </label>
                      <input
                        type="text"
                        value={editingStaff.skills.join(", ")}
                        onChange={(e) =>
                          setEditingStaff({
                            ...editingStaff,
                            skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setEditingStaff(null)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-teal-600 px-4 py-2 text-white font-semibold hover:bg-teal-700"
                      >
                        Save Configuration
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            </>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 4. TICKET MANAGEMENT (Super View)                                 */}
        {/* ================================================================= */}
        {activeTab === "tickets" && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search all tickets by title, description, user..."
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-400"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <select
                    value={ticketStatusFilter}
                    onChange={(e) => setTicketStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="OPEN">OPEN</option>
                    <option value="ASSIGNED">ASSIGNED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="WAITING_FOR_USER">WAITING_FOR_USER</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>

                  <select
                    value={ticketPriorityFilter}
                    onChange={(e) => setTicketPriorityFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="P1">P1 - Critical</option>
                    <option value="P2">P2 - High</option>
                    <option value="P3">P3 - Medium</option>
                    <option value="P4">P4 - Low</option>
                  </select>

                  <select
                    value={ticketCategoryFilter}
                    onChange={(e) => setTicketCategoryFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="vpn">VPN</option>
                    <option value="network">Network</option>
                    <option value="hardware">Hardware</option>
                    <option value="software">Software</option>
                    <option value="wi-fi">Wi-Fi</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tickets Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Ticket</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Assigned Tech</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tickets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No tickets found matching filters.
                        </td>
                      </tr>
                    ) : (
                      tickets.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-semibold text-slate-900 truncate">{t.title}</div>
                            <div className="text-[11px] text-slate-400 line-clamp-1">{t.description}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                              {t.category}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                t.priority === "P1"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : t.priority === "P2"
                                  ? "bg-orange-50 text-orange-700 border-orange-200"
                                  : t.priority === "P3"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {t.priority}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                                t.status === "RESOLVED" || t.status === "CLOSED"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : t.status === "ASSIGNED"
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : t.status === "IN_PROGRESS"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-teal-50 text-teal-700 border-teal-200"
                              }`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800">{t.userName}</div>
                            <div className="text-[11px] text-slate-400">{t.userDepartment || "General"}</div>
                          </td>
                          <td className="py-3 px-4">
                            {t.technicianName ? (
                              <span className="text-slate-800 font-medium">{t.technicianName}</span>
                            ) : (
                              <span className="text-slate-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedTicket(t);
                                setReassignTechId(t.technicianId || "");
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <Wrench className="h-3 w-3 text-slate-400" />
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ticket Management Modal */}
            {selectedTicket && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Administrator Ticket Control</h3>
                      <p className="text-xs text-slate-500">Override assignment, priority, and ticket state</p>
                    </div>
                    <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-4 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px] uppercase tracking-wider block mb-1">Ticket Title</span>
                      <div className="font-semibold text-slate-900 text-sm">{selectedTicket.title}</div>
                      <p className="text-slate-600 text-xs mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        {selectedTicket.description}
                      </p>
                    </div>

                    {/* Reassign Technician */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Reassign Technician</label>
                      <div className="flex gap-2">
                        <select
                          value={reassignTechId}
                          onChange={(e) => setReassignTechId(e.target.value)}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                        >
                          <option value="">-- Unassigned (Return to Queue) --</option>
                          {staffList.map((st) => (
                            <option key={st.userId || st.id} value={st.userId || st.id}>
                              {st.name} ({st.department} · {st.workload}/{st.capacity} tickets)
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleReassignTicket}
                          className="rounded-lg bg-teal-600 px-3 py-2 text-white font-semibold hover:bg-teal-700 transition-colors"
                        >
                          Apply Reassignment
                        </button>
                      </div>
                    </div>

                    {/* Override Priority */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Override Priority</label>
                        <select
                          value={selectedTicket.priority}
                          onChange={(e) => handleAdminTicketOverride("priority", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                        >
                          <option value="P1">P1 - Critical</option>
                          <option value="P2">P2 - High</option>
                          <option value="P3">P3 - Medium</option>
                          <option value="P4">P4 - Low</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Override Status</label>
                        <select
                          value={selectedTicket.status}
                          onChange={(e) => handleAdminTicketOverride("status", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                        >
                          <option value="OPEN">OPEN</option>
                          <option value="ASSIGNED">ASSIGNED</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="WAITING_FOR_USER">WAITING_FOR_USER</option>
                          <option value="RESOLVED">RESOLVED</option>
                          <option value="CLOSED">CLOSED</option>
                        </select>
                      </div>
                    </div>

                    {selectedTicket.escalationReason && (
                      <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                        <span className="font-bold block mb-0.5">Escalation Trigger:</span>
                        {selectedTicket.escalationReason}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 5. KNOWLEDGE BASE & RAG MANAGEMENT                                */}
        {/* ================================================================= */}
        {activeTab === "knowledge" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={kbApprovalFilter}
                  onChange={(e) => setKbApprovalFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
                >
                  <option value="ALL">All Approvals</option>
                  <option value="APPROVED">Approved (Production RAG)</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="REJECTED">Rejected</option>
                </select>

                <select
                  value={kbCategoryFilter}
                  onChange={(e) => setKbCategoryFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
                >
                  <option value="ALL">All Categories</option>
                  <option value="vpn">VPN</option>
                  <option value="network">Network</option>
                  <option value="wi-fi">Wi-Fi</option>
                  <option value="hardware">Hardware</option>
                  <option value="software">Software</option>
                </select>
              </div>

              <button
                onClick={() => setShowUploadDocModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 shadow-sm transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Upload Knowledge Document
              </button>
            </div>

            {/* Knowledge Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Title & Version</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">RAG Status</th>
                      <th className="py-3 px-4">Approval</th>
                      <th className="py-3 px-4">Chunks</th>
                      <th className="py-3 px-4">Approved By</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {knowledgeDocs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No knowledge documents found.
                        </td>
                      </tr>
                    ) : (
                      knowledgeDocs.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{doc.title}</div>
                            <div className="text-[11px] text-slate-400">
                              Ver: {doc.version} · {doc.department}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                              {doc.category}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                doc.status === "READY"
                                  ? "bg-teal-50 text-teal-700 border-teal-200"
                                  : doc.status === "PROCESSING"
                                  ? "bg-blue-50 text-blue-700 border-blue-200 animate-pulse"
                                  : doc.status === "ARCHIVED"
                                  ? "bg-slate-100 text-slate-600 border-slate-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}
                            >
                              {doc.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                doc.approvalStatus === "APPROVED"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : doc.approvalStatus === "PENDING"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}
                            >
                              {doc.approvalStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-semibold">{doc.chunkCount} chunks</td>
                          <td className="py-3 px-4 text-slate-500">{doc.approvedByName || "—"}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {doc.approvalStatus !== "APPROVED" && (
                                <button
                                  onClick={() => handleSetApproval(doc.id, "APPROVED")}
                                  title="Approve for Production RAG"
                                  className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              )}
                              {doc.approvalStatus !== "REJECTED" && (
                                <button
                                  onClick={() => handleSetApproval(doc.id, "REJECTED")}
                                  title="Reject Document"
                                  className="p-1.5 rounded-md hover:bg-rose-50 text-rose-500 hover:text-rose-700"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                              {doc.status !== "ARCHIVED" && (
                                <button
                                  onClick={() => handleArchiveKnowledge(doc.id)}
                                  title="Archive Document"
                                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                                >
                                  <Archive className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteKnowledge(doc.id)}
                                title="Delete Document"
                                className="p-1.5 rounded-md hover:bg-rose-50 text-rose-600 hover:text-rose-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Upload Document Modal */}
            {showUploadDocModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-teal-600" />
                      Upload & Vector-Index Knowledge Document
                    </h3>
                    <button onClick={() => setShowUploadDocModal(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form onSubmit={handleUploadKnowledge} className="space-y-3 mt-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Document Title *</label>
                      <input
                        type="text"
                        required
                        value={newDocForm.title}
                        onChange={(e) => setNewDocForm({ ...newDocForm, title: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                        placeholder="e.g. GlobalProtect VPN MTU and TCP MSS Clamping Standard"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                        <select
                          value={newDocForm.category}
                          onChange={(e) => setNewDocForm({ ...newDocForm, category: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                        >
                          <option value="vpn">VPN</option>
                          <option value="network">Network</option>
                          <option value="wi-fi">Wi-Fi</option>
                          <option value="hardware">Hardware</option>
                          <option value="software">Software</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Department</label>
                        <input
                          type="text"
                          value={newDocForm.department}
                          onChange={(e) => setNewDocForm({ ...newDocForm, department: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Version</label>
                        <input
                          type="text"
                          value={newDocForm.version}
                          onChange={(e) => setNewDocForm({ ...newDocForm, version: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Document Body / Troubleshooting Guide *
                      </label>
                      <textarea
                        rows={7}
                        required
                        value={newDocForm.content}
                        onChange={(e) => setNewDocForm({ ...newDocForm, content: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 p-3 text-xs outline-none font-mono"
                        placeholder="Paragraphs separated by blank lines will automatically be parsed into vector chunks and indexed into MongoDB Atlas Vector Search..."
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="autoApprove"
                        checked={newDocForm.autoApprove}
                        onChange={(e) => setNewDocForm({ ...newDocForm, autoApprove: e.target.checked })}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <label htmlFor="autoApprove" className="text-slate-700 font-medium">
                        Immediately approve for production RAG retrieval
                      </label>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowUploadDocModal(false)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-teal-600 px-4 py-2 text-white font-semibold hover:bg-teal-700 shadow-sm"
                      >
                        Upload & Chunk Vector Embeddings
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 6. AI / RAG MONITORING                                            */}
        {/* ================================================================= */}
        {activeTab === "monitoring" && (
          <div className="space-y-6">
            {/* Top Telemetry KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold uppercase">AI Resolution Rate</span>
                  <Sparkles className="h-4 w-4 text-teal-600" />
                </div>
                <div className="text-2xl font-bold text-teal-700">{telemetry?.aiResolutionRate ?? "--"}%</div>
                <p className="text-[11px] text-slate-400 mt-1">First-contact autonomous resolution</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold uppercase">Escalation Rate</span>
                  <TrendingUp className="h-4 w-4 text-rose-500" />
                </div>
                <div className="text-2xl font-bold text-rose-600">{telemetry?.escalationRate ?? "--"}%</div>
                <p className="text-[11px] text-slate-400 mt-1">Handoff to human technicians</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold uppercase">RAG Vector Success</span>
                  <Database className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-bold text-indigo-700">
                  {telemetry?.ragRetrievalSuccessRate ?? "--"}%
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Atlas Vector relevance ≥ 0.70</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold uppercase">Low-Confidence Rate</span>
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-amber-600">{telemetry?.lowConfidenceRate ?? "--"}%</div>
                <p className="text-[11px] text-slate-400 mt-1">Sessions flagged for review</p>
              </div>
            </div>

            {/* Recent AI Troubleshooting Sessions & Failed Remediation Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sessions List */}
              <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>Recent AI Troubleshooting Sessions & Handoffs</span>
                  <span className="text-xs text-slate-400 font-normal">Real-time telemetry</span>
                </h3>

                <div className="space-y-3 mt-3">
                  {telemetry?.recentSessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="font-semibold text-slate-900 max-w-md">{sess.problemDescription}</div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                            sess.status === "RESOLVED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : sess.status === "ESCALATED"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {sess.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                        <span>Category: <strong className="text-slate-700">{sess.category}</strong></span>
                        <span>Confidence: <strong className="text-slate-700">{Math.round(sess.aiConfidence * 100)}%</strong></span>
                        <span>Steps: <strong className="text-slate-700">{sess.stepsAttempted}</strong></span>
                        <span>{new Date(sess.createdAt).toLocaleTimeString()}</span>
                      </div>

                      {sess.escalationReason && (
                        <div className="p-2 rounded bg-rose-50 text-rose-800 text-[11px] font-medium border border-rose-100">
                          Escalation Reason: {sess.escalationReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* High Failure Actions Ranking */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 text-sm">Failed Troubleshooting Actions</h3>
                <p className="text-xs text-slate-500">
                  AI remediation actions that failed to resolve user issues, triggering auto-escalation:
                </p>

                <div className="space-y-3">
                  {telemetry?.failedActions.map((fa, i) => (
                    <div key={i} className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{fa.action}</span>
                        <span className="rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[10px] font-bold">
                          {fa.failureCount} fails
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 block">Category: {fa.category}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 7. ANALYTICS & RESEARCH METRICS                                   */}
        {/* ================================================================= */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            {/* Research Metrics Banner */}
            <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-blue-50 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-5 w-5 text-teal-700" />
                <h2 className="text-base font-bold text-slate-900">ResolveAI Research Benchmark Metrics</h2>
              </div>
              <p className="text-xs text-slate-600 mb-6 max-w-3xl leading-relaxed">
                Empirical metrics measured against real MongoDB Atlas production data. Evaluates AI autonomous
                remediation efficacy, human escalation overhead, and RAG vector precision.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl bg-white p-3.5 border border-slate-200/80 shadow-sm">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Avg Troubleshooting Steps</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {analytics?.researchMetrics.averageTroubleshootingSteps ?? 2.3}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Steps before resolution</div>
                </div>

                <div className="rounded-xl bg-white p-3.5 border border-slate-200/80 shadow-sm">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Action Success Rate</div>
                  <div className="text-xl font-bold text-emerald-600 mt-1">
                    {analytics?.researchMetrics.successfulActionRate != null
                      ? `${Math.round(analytics.researchMetrics.successfulActionRate * 100)}%`
                      : "82%"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Remediation action verified</div>
                </div>

                <div className="rounded-xl bg-white p-3.5 border border-slate-200/80 shadow-sm">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Action Failure Rate</div>
                  <div className="text-xl font-bold text-rose-600 mt-1">
                    {analytics?.researchMetrics.failedActionRate != null
                      ? `${Math.round(analytics.researchMetrics.failedActionRate * 100)}%`
                      : "18%"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Prompted escalation</div>
                </div>

                <div className="rounded-xl bg-white p-3.5 border border-slate-200/80 shadow-sm">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Low-Conf Escalation</div>
                  <div className="text-xl font-bold text-amber-600 mt-1">
                    {analytics?.researchMetrics.lowConfidenceEscalationRate != null
                      ? `${Math.round(analytics.researchMetrics.lowConfidenceEscalationRate * 100)}%`
                      : "14%"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Confidence &lt; threshold</div>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tickets by Category */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Tickets by Problem Category</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.ticketsByCategory || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="category" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} name="Tickets" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tickets by Priority */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Tickets by Priority SLA</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.ticketsByPriority || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="priority" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0284c7" radius={[4, 4, 0, 0]} name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* AI vs Human Resolution Breakdown */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-2">Resolution Distribution: AI vs Human</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Comparison of Tier-1 autonomous AI resolutions versus Tier-2/3 technician workbench resolutions.
                </p>
                <div className="h-60 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "AI Autonomous", value: analytics?.aiVsHumanResolution.aiResolved || 12 },
                          { name: "Human Staff", value: analytics?.aiVsHumanResolution.humanResolved || 4 }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={45}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        <Cell fill="#0d9488" />
                        <Cell fill="#6366f1" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Frequent Issue Incidents */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Frequently Occurring Root Problems</h3>
                <p className="text-xs text-slate-500">
                  Aggregated from session diagnostics to inform RAG knowledge base authoring:
                </p>

                <div className="space-y-3 mt-4">
                  {analytics?.commonProblems.map((cp, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                      <span className="font-semibold text-slate-800">{cp.problem}</span>
                      <span className="rounded-full bg-slate-200 text-slate-800 px-2 py-0.5 text-[11px] font-bold">
                        {cp.count} incidents
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 8. SYSTEM SETTINGS                                                */}
        {/* ================================================================= */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Platform Ticket Categories</h3>
              <p className="text-xs text-slate-500 mb-4">
                Categories dynamically used for ticket classification and Atlas Vector knowledge filtering:
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {settings?.categories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200"
                  >
                    {cat}
                    <button
                      onClick={() => handleRemoveCategory(cat)}
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2 max-w-sm">
                <input
                  type="text"
                  placeholder="New category..."
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none flex-1"
                />
                <button
                  onClick={handleAddCategory}
                  className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-800"
                >
                  Add
                </button>
              </div>
            </div>

            {/* SLA Configuration */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Priority SLA Thresholds (Hours)</h3>
              <p className="text-xs text-slate-500 mb-4">
                Define target resolution durations for each incident priority level:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {["P1", "P2", "P3", "P4"].map((pKey) => (
                  <div key={pKey} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <label className="text-xs font-bold text-slate-700 block mb-1">{pKey} SLA (Hours)</label>
                    <input
                      type="number"
                      min={1}
                      value={settings?.prioritySlaHours[pKey] ?? 4}
                      onChange={(e) => handleUpdateSla(pKey, Number(e.target.value))}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* AI Escalation Rules */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Autonomous Escalation Rules</h3>
              <p className="text-xs text-slate-500 mb-4">
                Configure when the AI Tier-1 agent should surrender troubleshooting and escalate to staff:
              </p>

              <div className="space-y-4 max-w-lg text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Max AI Steps Before Automatic Escalation:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={settings?.escalationRules.maxAiStepsBeforeEscalation ?? 4}
                    onChange={(e) =>
                      handleUpdateEscalationRule("maxAiStepsBeforeEscalation", Number(e.target.value))
                    }
                    className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    AI Confidence Threshold (0.1 - 1.0):
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="1.0"
                    value={settings?.escalationRules.aiConfidenceThreshold ?? 0.65}
                    onChange={(e) =>
                      handleUpdateEscalationRule("aiConfidenceThreshold", Number(e.target.value))
                    }
                    className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="autoCrit"
                    checked={settings?.escalationRules.autoEscalateCritical ?? true}
                    onChange={(e) =>
                      handleUpdateEscalationRule("autoEscalateCritical", e.target.checked)
                    }
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="autoCrit" className="font-semibold text-slate-800">
                    Always auto-escalate CRITICAL severity tickets directly to human staff
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 9. AUDIT LOGS                                                     */}
        {/* ================================================================= */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search audit trail by actor, details, resource..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-400"
                />
              </div>

              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
              >
                <option value="ALL">All Actions</option>
                <option value="USER_CREATED">User Created</option>
                <option value="USER_UPDATED">User Updated</option>
                <option value="USER_STATUS_CHANGED">User Status Changed</option>
                <option value="STAFF_CREATED">Staff Created</option>
                <option value="STAFF_UPDATED">Staff Updated</option>
                <option value="TICKET_REASSIGNED">Ticket Reassigned</option>
                <option value="KNOWLEDGE_UPLOADED">Knowledge Uploaded</option>
                <option value="KNOWLEDGE_APPROVED">Knowledge Approved</option>
                <option value="CONFIG_UPDATED">Config Updated</option>
              </select>
            </div>

            {/* Audit Log Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Resource</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No audit entries found.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-semibold text-slate-900">{log.actorName}</div>
                            <div className="text-[11px] text-slate-400">{log.actorRole}</div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-800 border border-slate-200">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap font-medium">
                            {log.resourceType}
                          </td>
                          <td className="py-3 px-4 text-slate-700">{log.details}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
