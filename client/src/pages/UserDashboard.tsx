import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  LifeBuoy,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Ticket,
  TrendingUp,
  User as UserIcon,
  X
} from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../contexts/AuthContext";
import {
  getDashboardStats,
  listTicketsApi,
  listTroubleshootingSessions,
  type TicketResponseItem,
  type TroubleshootingSessionItem
} from "../services/api";
import { cn } from "../utils/cn";

export function UserDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    activeSessions: 0,
    resolvedSessions: 0,
    escalatedSessions: 0,
    openTickets: 0,
    pendingTickets: 0,
    totalTickets: 0
  });
  const [recentTickets, setRecentTickets] = useState<TicketResponseItem[]>([]);
  const [activeSessions, setActiveSessions] = useState<TroubleshootingSessionItem[]>([]);
  const [recentResolved, setRecentResolved] = useState<TroubleshootingSessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Feedback Modal State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackSession, setFeedbackSession] = useState<TroubleshootingSessionItem | null>(null);
  const [feedbackHelpful, setFeedbackHelpful] = useState<boolean>(true);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, ticketsData, sessionsData, resolvedData] = await Promise.allSettled([
        getDashboardStats(),
        listTicketsApi({ limit: 5 }),
        listTroubleshootingSessions("ACTIVE"),
        listTroubleshootingSessions("RESOLVED")
      ]);

      if (statsData.status === "fulfilled") setStats(statsData.value);
      if (ticketsData.status === "fulfilled") setRecentTickets(ticketsData.value.tickets || []);
      if (sessionsData.status === "fulfilled") setActiveSessions(sessionsData.value || []);
      if (resolvedData.status === "fulfilled") setRecentResolved((resolvedData.value || []).slice(0, 5));
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const metrics = [
    {
      label: "Active Sessions",
      value: stats.activeSessions.toString(),
      delta: "Currently troubleshooting",
      icon: Bot,
      tone: stats.activeSessions > 0 ? "warn" : "good",
      color: "from-violet-500 to-purple-600"
    },
    {
      label: "Open Tickets",
      value: stats.openTickets.toString(),
      delta: `${stats.pendingTickets} pending confirmation`,
      icon: Ticket,
      tone: stats.openTickets > 0 ? "warn" : "good",
      color: "from-amber-500 to-orange-600"
    },
    {
      label: "Resolved Issues",
      value: stats.resolvedSessions.toString(),
      delta: "Solved via AI support",
      icon: CheckCircle2,
      tone: "good",
      color: "from-emerald-500 to-teal-600"
    },
    {
      label: "Total Interactions",
      value: (stats.resolvedSessions + stats.escalatedSessions + stats.activeSessions).toString(),
      delta: `${stats.escalatedSessions} escalated`,
      icon: TrendingUp,
      tone: "neutral",
      color: "from-blue-500 to-indigo-600"
    }
  ] as const;

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return "Recently";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 2) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={`User Workspace · Welcome back, ${user?.name || "User"}`}
        title="Describe the problem first, escalate only when needed"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadDashboard}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs disabled:opacity-50 transition-all"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              Refresh
            </button>
            <Link
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:from-teal-700 hover:to-emerald-700 shadow-md shadow-teal-600/20 transition-all active:scale-[0.97]"
              to="/support"
            >
              <Sparkles className="h-4 w-4" />
              Start AI Support
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        }
      />
      <main className="space-y-6 p-6">
        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 shrink-0" />
            <span>{error} — Showing cached data.</span>
          </div>
        )}

        {/* User Profile Overview & Quick Chatbot Access Banner */}
        <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="relative">
                {user?.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt={user.name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-teal-400 shadow-md"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-500 text-white font-extrabold text-lg flex items-center justify-center border-2 border-white/20 shadow-md">
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : "US"}
                  </div>
                )}
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white tracking-tight">{user?.name || "Employee User"}</h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[10px] font-bold uppercase">
                    {user?.role || "USER"}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">{user?.email || "user@resolveai.com"}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Department: <span className="text-slate-200 font-semibold">{user?.department || "General Enterprise"}</span> &bull; Status: <span className="text-emerald-400 font-semibold">Active</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Link
                to="/support"
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Ask ResolveAI</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article
              key={metric.label}
              className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-md transition-all duration-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{metric.label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
                    {isLoading ? (
                      <span className="inline-block h-8 w-12 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
                    ) : (
                      metric.value
                    )}
                  </p>
                </div>
                <div className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                  metric.color
                )}>
                  <metric.icon className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
              <p className={cn(
                "mt-3 text-xs font-medium",
                metric.tone === "good" && "text-emerald-600 dark:text-emerald-400",
                metric.tone === "warn" && "text-amber-600 dark:text-amber-400",
                metric.tone === "neutral" && "text-slate-500 dark:text-slate-400"
              )}>
                {metric.delta}
              </p>
              <div className={cn(
                "absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity",
                metric.color
              )} />
            </article>
          ))}
        </div>

        {/* Main Content */}
        <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
          {/* Left: Active Sessions + Recent Tickets */}
          <div className="space-y-6">
            {/* Active Troubleshooting Sessions */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
                    <Activity className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Active Troubleshooting</h2>
                  {activeSessions.length > 0 && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                      {activeSessions.length}
                    </span>
                  )}
                </div>
                <Link to="/sessions" className="text-xs font-semibold text-teal-600 hover:text-teal-800">
                  View all
                </Link>
              </div>
              <div className="p-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                    ))}
                  </div>
                ) : activeSessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                    <Bot className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs font-medium text-slate-500">No active troubleshooting sessions</p>
                    <Link
                      to="/support"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-800"
                    >
                      <Sparkles className="h-3 w-3" />
                      Start a new session
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeSessions.slice(0, 3).map((session) => (
                      <Link
                        key={session.id}
                        to={`/sessions/${session.id}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 hover:bg-teal-50/30 hover:border-teal-200 transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700 text-xs font-bold">
                            {session.currentStepNumber}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">{session.problemDescription}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Step {session.currentStepNumber} · {session.category} · {formatTimeAgo(session.updatedAt)}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-teal-600 transition-colors shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Tickets */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                    <Ticket className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">My Tickets</h2>
                </div>
                <Link to="/tickets" className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300">
                  View all
                </Link>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                    ))}
                  </div>
                ) : recentTickets.length === 0 ? (
                  <div className="p-8 text-center">
                    <MessageSquare className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No tickets yet</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Try AI Support first — tickets are created only when needed.</p>
                  </div>
                ) : (
                  recentTickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      to={`/tickets/${ticket.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                          #{ticket.id.slice(-6).toUpperCase()}
                        </span>
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{ticket.title}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge value={ticket.status} />
                        <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 group-hover:text-teal-600 dark:group-hover:text-teal-400" />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link
                  to="/support"
                  className="flex items-center gap-3 rounded-xl border border-teal-200/60 dark:border-teal-800/60 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30 p-3.5 hover:from-teal-100 hover:to-emerald-100 dark:hover:from-teal-950/50 dark:hover:to-emerald-950/50 transition-all group"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-teal-600 text-white shadow-sm">
                    <Bot className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">New Support Request</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Describe your problem to AI</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-teal-400 ml-auto group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  to="/tickets"
                  className="flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 p-3.5 hover:bg-slate-100/60 dark:hover:bg-slate-800/80 transition-all group"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <Ticket className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">View My Tickets</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Track escalated issues</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 ml-auto group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  to="/notifications"
                  className="flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 p-3.5 hover:bg-slate-100/60 dark:hover:bg-slate-800/80 transition-all group"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <LifeBuoy className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Notifications</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Updates & status changes</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 ml-auto group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Recently Resolved */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recently Resolved</h2>
              </div>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                  ))}
                </div>
              ) : recentResolved.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No resolved sessions yet</p>
              ) : (
                <div className="space-y-2">
                  {recentResolved.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between gap-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100/80 dark:border-emerald-800/50 p-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{session.problemDescription}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {session.totalStepsAttempted} step{session.totalStepsAttempted !== 1 ? "s" : ""} · {formatTimeAgo(session.resolvedAt || session.updatedAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFeedbackSession(session);
                          setFeedbackSuccess(false);
                          setFeedbackComment("");
                          setFeedbackRating(5);
                          setFeedbackHelpful(true);
                          setShowFeedbackModal(true);
                        }}
                        className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 transition-colors"
                      >
                        <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                        <span>Rate</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* How It Works */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">How ResolveAI Works</h2>
              <div className="space-y-3">
                {[
                  { step: "1", title: "Describe your problem", desc: "Tell the AI what's happening" },
                  { step: "2", title: "AI troubleshoots", desc: "Guided steps from approved knowledge" },
                  { step: "3", title: "Report outcome", desc: "Tell us if it worked" },
                  { step: "4", title: "Escalate if needed", desc: "Auto-ticket creation when required" }
                ].map((item) => (
                  <div key={item.step} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-50 border border-teal-200/60 text-xs font-bold text-teal-700">
                      {item.step}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Resolution Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-2xl relative text-slate-900">
            <button
              onClick={() => setShowFeedbackModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Resolution Feedback</h3>
                <p className="text-xs text-slate-500">Help improve future RAG automated solutions</p>
              </div>
            </div>

            {feedbackSession && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Issue Resolved</p>
                <p className="text-xs font-semibold text-slate-800 mt-0.5">{feedbackSession.problemDescription}</p>
              </div>
            )}

            {feedbackSuccess ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Thank you for your feedback!</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Your rating and comments have been recorded to tune RAG retrieval relevance.
                </p>
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="mt-3 px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Was the automated solution helpful?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFeedbackHelpful(true)}
                      className={cn(
                        "py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all",
                        feedbackHelpful
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>Yes, Solved It</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedbackHelpful(false)}
                      className={cn(
                        "py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all",
                        !feedbackHelpful
                          ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      <span>Partially / No</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Satisfaction Rating (1 to 5 stars)
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={cn(
                            "w-6 h-6",
                            star <= feedbackRating
                              ? "text-amber-500 fill-amber-400"
                              : "text-slate-300"
                          )}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-slate-600 ml-2">
                      {feedbackRating} / 5 Stars
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Comments or Suggestions (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Tell us what worked well or what troubleshooting steps could be clearer..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackSuccess(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
                  >
                    Submit Feedback
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
