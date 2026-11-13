import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  Send,
  ShieldAlert,
  Sparkles,
  Tag,
  User,
  Wrench
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../contexts/AuthContext";
import { tickets as mockTickets } from "../data/demoData";
import {
  addTicketReplyApi,
  getTicketByIdApi,
  type TicketReplyItem,
  type TicketResponseItem
} from "../services/api";
import { cn } from "../utils/cn";

export function TicketDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [realTicket, setRealTicket] = useState<TicketResponseItem | null>(null);
  const [replies, setReplies] = useState<TicketReplyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Fallback mock ticket if id matches demo data or API fails
  const mockFallback = mockTickets.find((item) => item.id === id) ?? mockTickets[0];

  useEffect(() => {
    let isMounted = true;
    async function loadTicket() {
      if (!id) return;
      setIsLoading(true);
      try {
        const data = await getTicketByIdApi(id);
        if (isMounted && data) {
          setRealTicket(data);
          setReplies(data.replies || []);
        }
      } catch {
        // If not in database, fallback to mock
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadTicket();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const ticket = realTicket || mockFallback;
  const isReal = Boolean(realTicket);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = replyMessage.trim();
    if (!clean || isSendingReply) return;

    setIsSendingReply(true);
    setReplyError(null);

    try {
      if (isReal && realTicket) {
        const newReply = await addTicketReplyApi(realTicket.id, clean);
        setReplies((prev) => [...prev, newReply]);
      } else {
        // Mock reply for demo
        const fakeReply: TicketReplyItem = {
          id: "rep-" + Date.now(),
          ticketId: ticket.id,
          senderId: user?.id || "user-1",
          senderRole: user?.role || "USER",
          message: clean,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setReplies((prev) => [...prev, fakeReply]);
      }
      setReplyMessage("");
    } catch (err: any) {
      setReplyError(err.response?.data?.error || err.message || "Failed to post reply");
    } finally {
      setIsSendingReply(false);
    }
  };

  const attemptedActions = ("attemptedActions" in ticket && ticket.attemptedActions) || [];
  const failedActions = ("failedActions" in ticket && ticket.failedActions) || [];
  const ragSources = ("ragSources" in ticket && ticket.ragSources) || [];

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-2/3 animate-pulse rounded-xl bg-slate-200" />
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}
          </div>
          <div className="space-y-6">
            {[1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2">
        <Link
          to="/tickets"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to All Tickets</span>
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-mono text-xs font-bold text-teal-800">
          {ticket.id.startsWith("TCK-") ? ticket.id : `#${ticket.id.slice(-6).toUpperCase()}`}
        </span>
      </div>

      {/* Page Header */}
      <PageHeader
        eyebrow={`Incident • ${ticket.category.toUpperCase()}`}
        title={ticket.title}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge value={ticket.severity} />
            <StatusBadge value={ticket.status} />
          </div>
        }
      />

      {/* Main Content Layout */}
      <main className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* Left Column: Description + Troubleshooting History + Conversation Replies */}
        <div className="space-y-6">
          {/* Issue Overview Card */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Tag className="h-4 w-4 text-teal-600" />
              <span>Incident Summary</span>
            </h2>
            <div className="text-xs leading-relaxed text-slate-700 bg-slate-50/70 rounded-xl p-4 border border-slate-200/60 font-mono whitespace-pre-wrap">
              {"description" in ticket ? ticket.description : "No description provided."}
            </div>
          </section>

          {/* Troubleshooting Timeline Card */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal-600" />
              <span>Automated L1 Diagnosis Timeline</span>
            </h2>
            <div className="space-y-4">
              {attemptedActions.length ? (
                attemptedActions.map((action, idx) => {
                  const failed = failedActions.includes(action);
                  return (
                    <div key={idx} className="flex items-start gap-3">
                      <div
                        className={cn(
                          "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold mt-0.5",
                          failed ? "bg-rose-100 text-rose-700" : "bg-teal-100 text-teal-700"
                        )}
                      >
                        {failed ? "✕" : "✓"}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-slate-900">{action}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {failed
                            ? "Action executed by automated agent but failed verification."
                            : "Action completed successfully or confirmed by user."}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4 text-xs text-slate-500 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Direct technician escalation created without automated self-service bypass.</span>
                </div>
              )}
            </div>
          </section>

          {/* Conversation & Replies Thread */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-teal-600" />
              <span>Ticket Activity & Staff Discussion</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                {replies.length}
              </span>
            </h2>

            {/* Replies List */}
            <div className="space-y-3 mb-4">
              {replies.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                  No comments or staff updates on this ticket yet. Post an update below.
                </div>
              ) : (
                replies.map((rep) => {
                  const isStaff = rep.senderRole === "STAFF" || rep.senderRole === "ADMIN" || rep.senderRole === "TECHNICIAN";
                  return (
                    <div
                      key={rep.id}
                      className={cn(
                        "rounded-xl p-4 border text-xs space-y-1.5",
                        isStaff
                          ? "border-indigo-100 bg-indigo-50/40 text-slate-800"
                          : "border-slate-200/90 bg-slate-50/70 text-slate-800"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {isStaff ? "Support Staff" : "User"}
                          </span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.2 text-[9px] font-extrabold uppercase",
                              isStaff
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-slate-200 text-slate-700"
                            )}
                          >
                            {rep.senderRole}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(rep.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{rep.message}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply Input Box */}
            <form onSubmit={handleSendReply} className="space-y-2 pt-2 border-t border-slate-100">
              {replyError && (
                <p className="text-xs text-rose-600 font-medium">{replyError}</p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Post an update, add diagnostic notes, or provide feedback..."
                  className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 bg-white"
                />
                <button
                  type="submit"
                  disabled={isSendingReply || !replyMessage.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-all"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Reply</span>
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Right Sidebar: Ticket Metadata & Knowledge Sources */}
        <aside className="space-y-6">
          {/* Metadata Card */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">
              Incident Metadata
            </h3>
            <div className="mt-3 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Status</span>
                <StatusBadge value={ticket.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Severity</span>
                <StatusBadge value={ticket.severity} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Category</span>
                <span className="font-semibold text-slate-800 capitalize">{ticket.category}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Assignment</span>
                <span className="font-semibold text-slate-800">
                  {"technician" in ticket && ticket.technician ? ticket.technician : ("technicianId" in ticket && ticket.technicianId ? "Assigned Staff" : "Unassigned / AI Queue")}
                </span>
              </div>
              {"aiConfidence" in ticket && ticket.aiConfidence !== undefined && ticket.aiConfidence !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">AI Confidence</span>
                  <span className="font-bold text-teal-700">{Math.round(ticket.aiConfidence * 100)}%</span>
                </div>
              )}
            </div>
          </section>

          {/* RAG Knowledge Runbooks Card */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-teal-600" />
              <span>Referenced Runbooks</span>
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-600">
              {ragSources.length ? (
                ragSources.map((source, idx) => (
                  <li key={idx} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 border border-slate-200/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500 shrink-0" />
                    <span className="font-medium text-slate-800 truncate">{source}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-400 italic">No external runbooks linked.</li>
              )}
            </ul>
          </section>
        </aside>
      </main>
    </div>
  );
}
