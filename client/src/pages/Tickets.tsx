import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  HelpCircle,
  KeyRound,
  Laptop,
  LayoutGrid,
  List,
  MessageSquare,
  Network,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Ticket as TicketIcon,
  UserCheck,
  X
} from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { TicketTable } from "../components/TicketTable";
import { useAuth } from "../contexts/AuthContext";
import { tickets as mockTickets } from "../data/demoData";
import { createTicketApi, listTicketsApi, type TicketResponseItem } from "../services/api";
import { cn } from "../utils/cn";

const CATEGORY_OPTIONS = [
  { id: "network", label: "Internet & Wi-Fi", icon: Network, desc: "VPN, slow speed, campus Wi-Fi" },
  { id: "hardware", label: "Laptop & Hardware", icon: Laptop, desc: "Screen, battery, keyboard, peripherals" },
  { id: "identity", label: "Account & Login", icon: KeyRound, desc: "Password reset, MFA, email access" },
  { id: "software", label: "Software & Apps", icon: Sparkles, desc: "Crashes, updates, license approval" },
  { id: "general", label: "Other Support", icon: HelpCircle, desc: "General IT question or request" }
];

export function Tickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketResponseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "WAITING" | "RESOLVED">("ALL");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Create Ticket Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("network");
  const [urgency, setUrgency] = useState<"standard" | "urgent">("standard");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const res = await listTicketsApi();
      if (res && Array.isArray(res.tickets)) {
        setTickets(res.tickets);
      }
    } catch (err) {
      console.warn("Could not load backend tickets, displaying demo requests:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchTickets();
  }, []);

  const allTickets = useMemo(() => {
    if (tickets.length > 0) {
      return [...tickets, ...mockTickets];
    }
    return mockTickets;
  }, [tickets]);

  // Tab Filtering
  const filteredTickets = useMemo(() => {
    return allTickets.filter((t) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const idMatch = t.id.toLowerCase().includes(q);
        const titleMatch = t.title.toLowerCase().includes(q);
        const catMatch = t.category.toLowerCase().includes(q);
        if (!idMatch && !titleMatch && !catMatch) return false;
      }

      // Tab filtering
      if (activeTab === "ACTIVE") {
        return t.status === "OPEN" || t.status === "IN_PROGRESS" || t.status === "ASSIGNED" || t.status === "ESCALATED";
      }
      if (activeTab === "WAITING") {
        return t.status === "USER_CONFIRMATION";
      }
      if (activeTab === "RESOLVED") {
        return t.status === "RESOLVED" || t.status === "CLOSED";
      }
      return true;
    });
  }, [allTickets, searchQuery, activeTab]);

  // Metrics
  const counts = useMemo(() => {
    return {
      all: allTickets.length,
      active: allTickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS" || t.status === "ASSIGNED" || t.status === "ESCALATED").length,
      waiting: allTickets.filter((t) => t.status === "USER_CONFIRMATION").length,
      resolved: allTickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length
    };
  }, [allTickets]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const created = await createTicketApi({
        title: title.trim(),
        description: description.trim(),
        category: selectedCategory,
        severity: urgency === "urgent" ? "HIGH" : "MEDIUM",
        priority: urgency === "urgent" ? "P2" : "P4"
      });

      setTickets((prev) => [created, ...prev]);
      setSuccessMessage("Your help request was submitted successfully! Our team will notify you as soon as there's an update.");
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccessMessage(null);
        setTitle("");
        setDescription("");
      }, 2000);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "OPEN":
        return { label: "Request Received", step: 1, desc: "Queued for support review" };
      case "ASSIGNED":
      case "IN_PROGRESS":
        return { label: "In Progress", step: 2, desc: "IT Specialist is working on this" };
      case "USER_CONFIRMATION":
        return { label: "Needs Your Feedback", step: 2, desc: "Please confirm if your issue is resolved" };
      case "ESCALATED":
        return { label: "Senior Review", step: 2, desc: "Escalated for senior technician inspection" };
      case "RESOLVED":
      case "CLOSED":
        return { label: "Resolved", step: 3, desc: "Completed & verified" };
      default:
        return { label: status.replace(/_/g, " "), step: 1, desc: "" };
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Friendly User Portal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200/60 px-2 py-0.5 rounded-full">
              Support Center
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            My Help Requests
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Track your open support tickets, view updates, and talk with the IT support team
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/support"
            className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/80 px-3.5 py-2.5 text-xs font-semibold text-teal-800 hover:bg-teal-100/70 transition-all shadow-2xs"
          >
            <Bot className="h-4 w-4 text-teal-600" />
            <span className="hidden sm:inline">Ask AI Assistant</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2.5 text-xs font-semibold text-white hover:from-teal-700 hover:to-cyan-700 active:scale-95 transition-all shadow-sm shadow-teal-600/20"
          >
            <Plus className="h-4 w-4" />
            <span>Submit a Request</span>
          </button>
        </div>
      </div>

      {/* Instant AI Assistance Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/70 bg-gradient-to-r from-teal-900 via-slate-900 to-slate-950 p-4 sm:p-5 text-white shadow-sm">
        <div className="absolute right-0 top-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-teal-500/20 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-500/20 border border-teal-400/30 text-teal-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Need an immediate answer?</h3>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed max-w-xl">
                Our automated AI Agent can diagnose Wi-Fi, VPN errors, email setup, and app crashes in real-time without waiting in the support queue.
              </p>
            </div>
          </div>
          <Link
            to="/support"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-teal-50 transition-colors shadow-sm shrink-0 self-start sm:self-center"
          >
            <span>Start Free Diagnosis</span>
            <ArrowRight className="h-3.5 w-3.5 text-teal-700" />
          </Link>
        </div>
      </div>

      {/* Friendly Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "ALL", label: "All Requests", count: counts.all },
            { id: "ACTIVE", label: "In Progress", count: counts.active },
            { id: "WAITING", label: "Action Needed", count: counts.waiting },
            { id: "RESOLVED", label: "Resolved", count: counts.resolved }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all",
                activeTab === tab.id
                  ? "bg-slate-900 dark:bg-teal-600 text-white shadow-xs font-bold"
                  : "bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Layout View Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your requests..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all"
            />
          </div>

          <button
            type="button"
            onClick={fetchTickets}
            disabled={isLoading}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs"
            title="Refresh requests"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </button>

          {/* Card / Table Toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={cn(
                "p-1.5 rounded-lg text-xs transition-colors",
                viewMode === "cards" ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
              title="Card view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "p-1.5 rounded-lg text-xs transition-colors",
                viewMode === "table" ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
              title="Table view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Request Stream */}
      {viewMode === "table" ? (
        <TicketTable tickets={filteredTickets} isLoading={isLoading} />
      ) : (
        /* Friendly Card View */
        <div className="space-y-3">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-solid border-teal-600 border-r-transparent mb-3" />
              <p className="text-xs text-slate-500 font-medium">Checking support tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-12 text-center shadow-xs">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                <TicketIcon className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No requests found</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? "No requests match your search criteria. Try a different keyword."
                  : "You don't have any support requests in this tab right now."}
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Submit a Request</span>
                </button>
              </div>
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              const statusInfo = getStatusDisplay(ticket.status);
              const technicianName = "technician" in ticket && ticket.technician ? ticket.technician : ("technicianId" in ticket && ticket.technicianId ? "Assigned Specialist" : "AI Diagnostic Bot");
              const isResolved = ticket.status === "RESOLVED" || ticket.status === "CLOSED";
              const isWaitingUser = ticket.status === "USER_CONFIRMATION";

              return (
                <div
                  key={ticket.id}
                  className={cn(
                    "group relative rounded-2xl border bg-white p-4 sm:p-5 transition-all shadow-xs hover:shadow-md hover:border-teal-400",
                    isWaitingUser ? "border-purple-200 bg-purple-50/20" : "border-slate-200/90"
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    {/* Left: ID & Category */}
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200/70 px-2 py-0.5 rounded-md">
                        {ticket.id.startsWith("TCK-") ? ticket.id : `#${ticket.id.slice(-6).toUpperCase()}`}
                      </span>
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md capitalize">
                        {ticket.category}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-400">
                        {"createdAt" in ticket && ticket.createdAt
                          ? new Date(ticket.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })
                          : "Recently logged"}
                      </span>
                    </div>

                    {/* Right: Friendly Status Badge */}
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <StatusBadge value={ticket.status} />
                    </div>
                  </div>

                  {/* Title & Description Excerpt */}
                  <div className="mb-4">
                    <Link
                      to={`/tickets/${ticket.id}`}
                      className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-1"
                    >
                      {ticket.title}
                    </Link>
                    {"description" in ticket && ticket.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {ticket.description}
                      </p>
                    )}
                  </div>

                  {/* Request Progress Stages Bar */}
                  <div className="mb-4 rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1.5">
                      <span className="flex items-center gap-1 text-slate-700">
                        <Clock className="h-3 w-3 text-teal-600" />
                        <span>Status: {statusInfo.label}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {statusInfo.desc}
                      </span>
                    </div>

                    {/* Step bar */}
                    <div className="grid grid-cols-3 gap-1.5 mt-2">
                      <div className={cn("h-1.5 rounded-full transition-all", statusInfo.step >= 1 ? "bg-teal-500" : "bg-slate-200")} />
                      <div className={cn("h-1.5 rounded-full transition-all", statusInfo.step >= 2 ? "bg-teal-500" : "bg-slate-200")} />
                      <div className={cn("h-1.5 rounded-full transition-all", statusInfo.step >= 3 ? "bg-emerald-500" : "bg-slate-200")} />
                    </div>
                  </div>

                  {/* Footer Line: Assigned Specialist & Link Button */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {technicianName.includes("Bot") || technicianName.includes("AI") ? (
                          <Bot className="h-3.5 w-3.5 text-teal-600" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                        )}
                      </div>
                      <span className="text-slate-600 font-medium truncate max-w-[200px]">
                        {technicianName}
                      </span>
                    </div>

                    <Link
                      to={`/tickets/${ticket.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 transition-colors group-hover:translate-x-0.5"
                    >
                      <span>View Updates & Reply</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* User-Centric "Submit a Request" Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60">
                  <TicketIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">How can IT help you today?</h3>
                  <p className="text-[11px] text-slate-500">We'll assign a specialist to diagnose and resolve your issue</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Success Banner */}
            {successMessage && (
              <div className="my-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h4 className="text-xs font-bold text-emerald-900">Request Sent!</h4>
                <p className="text-[11px] text-emerald-700 mt-1">{successMessage}</p>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="my-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {!successMessage && (
              <form onSubmit={handleCreateRequest} className="mt-4 space-y-4">
                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    What's going wrong?
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. My screen flickers when connecting to external display"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                {/* Category Selection Pills */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Which area is this related to?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CATEGORY_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = selectedCategory === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSelectedCategory(opt.id)}
                          className={cn(
                            "flex flex-col items-start p-2.5 rounded-xl border text-left transition-all",
                            isSelected
                              ? "border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/10 text-teal-950 font-semibold"
                              : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                          )}
                        >
                          <Icon className={cn("h-4 w-4 mb-1", isSelected ? "text-teal-700" : "text-slate-400")} />
                          <span className="text-xs leading-tight">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Urgency Radio */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    How urgently do you need this fixed?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUrgency("standard")}
                      className={cn(
                        "rounded-xl border p-2.5 text-left transition-all text-xs",
                        urgency === "standard"
                          ? "border-teal-500 bg-teal-50/50 ring-2 ring-teal-500/10 text-slate-900"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                      )}
                    >
                      <p className="font-semibold text-slate-900">Standard</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">I can still get other work done</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUrgency("urgent")}
                      className={cn(
                        "rounded-xl border p-2.5 text-left transition-all text-xs",
                        urgency === "urgent"
                          ? "border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/10 text-slate-900"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                      )}
                    >
                      <p className="font-semibold text-amber-900">Urgent</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Completely blocked from working</p>
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Describe what happened
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell us what you were doing, any error codes on screen, or steps you've already tried..."
                    className="w-full resize-none rounded-xl border border-slate-300 p-3 text-xs text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                {/* Submit / Cancel Footer */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 transition-all"
                  >
                    {submitting ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Send Request</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
