import React, { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ExternalLink,
  Gauge,
  HelpCircle,
  LifeBuoy,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  PartyPopper,
  RotateCw,
  ShieldAlert,
  Sparkles,
  Ticket,
  X,
  XCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { ChatInput } from "../components/chat/ChatInput";
import { ChatWindow } from "../components/chat/ChatWindow";
import { ConversationList } from "../components/chat/ConversationList";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../hooks/useChat";
import { createTicketApi, startTroubleshootingSession, submitStepOutcomeApi, type TroubleshootingSessionItem, type TroubleshootingStep } from "../services/api";
import { cn } from "../utils/cn";

const problemCategories = [
  { label: "Network", value: "network", emoji: "🌐" },
  { label: "Wi-Fi", value: "wi-fi", emoji: "📶" },
  { label: "VPN", value: "vpn", emoji: "🔒" },
  { label: "Software", value: "software", emoji: "💻" },
  { label: "Hardware", value: "hardware", emoji: "🖥️" },
  { label: "Account / Login", value: "account", emoji: "🔑" },
  { label: "Email", value: "email", emoji: "📧" },
  { label: "System", value: "system", emoji: "⚙️" },
  { label: "Other", value: "other", emoji: "❓" }
];

type TroubleshootingView = "chat" | "troubleshooting" | "resolved" | "escalated";

export function AiSupport() {
  const { user } = useAuth();
  const {
    activeConversation,
    conversations,
    error,
    isLoading,
    isSending,
    refreshConversations,
    removeConversation,
    retry,
    selectConversation,
    sendMessage,
    startConversation
  } = useChat();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState<TroubleshootingView>("chat");

  // Troubleshooting session state
  const [activeSession, setActiveSession] = useState<TroubleshootingSessionItem | null>(null);
  const [currentStep, setCurrentStep] = useState<TroubleshootingStep | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isSubmittingOutcome, setIsSubmittingOutcome] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  // Escalation / Raise Ticket Modal State
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketCategory, setTicketCategory] = useState("network");
  const [ticketSeverity, setTicketSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);

  /* ------------------------------------------------------------------ */
  /*  Start troubleshooting session from chat                           */
  /* ------------------------------------------------------------------ */

  const handleStartTroubleshooting = async (problemDescription: string, category?: string) => {
    setIsStartingSession(true);
    setSessionError(null);
    try {
      const result = await startTroubleshootingSession({
        problemDescription,
        category: category || "other"
      });
      setActiveSession(result.session);

      if (result.decision.shouldEscalate) {
        setView("escalated");
        setCreatedTicketId(result.session.ticketId || null);
        return;
      }

      const pending = result.session.steps.find((s) => s.outcome === "PENDING");
      setCurrentStep(pending || null);
      setView("troubleshooting");
    } catch (err: any) {
      setSessionError(err.response?.data?.error || err.message || "Failed to start troubleshooting");
    } finally {
      setIsStartingSession(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Submit step outcome                                               */
  /* ------------------------------------------------------------------ */

  const handleStepOutcome = async (outcome: "SUCCESS" | "FAILURE") => {
    if (!activeSession || !currentStep) return;

    setIsSubmittingOutcome(true);
    setSessionError(null);
    try {
      const result = await submitStepOutcomeApi(
        activeSession.id,
        currentStep.stepNumber,
        { outcome }
      );

      setActiveSession(result.session);

      if (result.resolved) {
        setView("resolved");
        setCurrentStep(null);
        return;
      }

      if (result.escalated) {
        setView("escalated");
        setCreatedTicketId(result.ticketId || result.session.ticketId || null);
        setCurrentStep(null);
        return;
      }

      // Next step
      const nextPending = result.session.steps.find((s) => s.outcome === "PENDING");
      setCurrentStep(nextPending || null);
    } catch (err: any) {
      setSessionError(err.response?.data?.error || err.message || "Failed to submit outcome");
    } finally {
      setIsSubmittingOutcome(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Chat send with auto-troubleshooting trigger                       */
  /* ------------------------------------------------------------------ */

  const handleSendMessage = async (message: string) => {
    await sendMessage(message);
  };

  /* ------------------------------------------------------------------ */
  /*  Reset to chat view                                                */
  /* ------------------------------------------------------------------ */

  const handleResetToChat = () => {
    setView("chat");
    setActiveSession(null);
    setCurrentStep(null);
    setCreatedTicketId(null);
    setSessionError(null);
  };

  const handleNewThread = async () => {
    handleResetToChat();
    await startConversation();
  };

  /* ------------------------------------------------------------------ */
  /*  Escalation modal                                                  */
  /* ------------------------------------------------------------------ */

  const openTicketModal = () => {
    const defaultTitle = activeConversation?.title || "Assistance Request from AI Chat";
    const historyText = activeConversation?.messages
      ?.map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
      .join("\n\n") || "";

    setTicketTitle(defaultTitle);
    setTicketDescription(
      historyText
        ? `Chat History:\n${historyText}\n\nAdditional notes: Issue unresolved via automated L1 troubleshooting.`
        : "Issue encountered during automated troubleshooting."
    );
    setTicketSuccess(null);
    setTicketError(null);
    setTicketModalOpen(true);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTitle.trim() || !ticketDescription.trim()) return;

    setTicketSubmitting(true);
    setTicketError(null);
    try {
      const created = await createTicketApi({
        title: ticketTitle.trim(),
        description: ticketDescription.trim(),
        category: ticketCategory,
        severity: ticketSeverity,
        priority: ticketSeverity === "CRITICAL" ? "P1" : ticketSeverity === "HIGH" ? "P2" : "P3"
      });
      setTicketSuccess(created.id || "Ticket Created");
      setTimeout(() => {
        setTicketModalOpen(false);
        setTicketSuccess(null);
      }, 2500);
    } catch (err: any) {
      console.error("Failed to raise ticket:", err);
      setTicketError(err.response?.data?.error || err.message || "Failed to raise ticket");
    } finally {
      setTicketSubmitting(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */

  return (
    <div className="flex h-screen max-h-screen flex-col overflow-hidden bg-slate-50">
      {/* Top Banner if Error */}
      {(error || sessionError) && (
        <div className="flex items-center justify-between gap-4 border-b border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error || sessionError}</span>
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100/60 shadow-2xs"
            onClick={error ? retry : () => setSessionError(null)}
          >
            <RotateCw className="h-3 w-3" />
            {error ? "Retry" : "Dismiss"}
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Conversation History */}
        <div
          className={cn(
            "shrink-0 transition-all duration-300 ease-in-out z-20",
            sidebarOpen
              ? "w-80 translate-x-0"
              : "-translate-x-full w-0 overflow-hidden border-none"
          )}
        >
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversation?.id}
            disabled={isLoading || isSending}
            onNew={handleNewThread}
            onRefresh={refreshConversations}
            onSelect={(id) => { handleResetToChat(); selectConversation(id); }}
            onDelete={removeConversation}
          />
        </div>

        {/* Right Main Chat Area */}
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-100/50">
          {/* Header Bar */}
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/90 bg-white px-4 sm:px-6 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-slate-900 truncate">
                    {view === "troubleshooting" && activeSession
                      ? `Troubleshooting: ${activeSession.problemDescription.slice(0, 40)}...`
                      : view === "resolved"
                      ? "Problem Resolved! 🎉"
                      : view === "escalated"
                      ? "Issue Escalated"
                      : activeConversation?.title || "New Support Session"}
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200/80 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
                    {view === "troubleshooting" ? "Step-by-Step" : "L1 AI Agent"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {view === "troubleshooting" && activeSession
                    ? `Step ${activeSession.currentStepNumber} · Confidence: ${Math.round(activeSession.aiConfidence * 100)}%`
                    : activeConversation
                    ? `${activeConversation.messages.length} messages in current thread`
                    : "Ready to assist with IT & hardware troubleshooting"}
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Back to Chat */}
              {view !== "chat" && (
                <button
                  type="button"
                  onClick={handleResetToChat}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Back to Chat</span>
                </button>
              )}

              {/* Escalate to Ticket Button */}
              {view === "chat" && activeConversation && activeConversation.messages.length > 0 && (
                <button
                  type="button"
                  onClick={openTicketModal}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 hover:border-amber-300 transition-all shadow-2xs"
                  title="Raise a formal ticket from this conversation"
                >
                  <Ticket className="h-3.5 w-3.5 text-amber-600" />
                  <span className="hidden sm:inline">Escalate to Ticket</span>
                </button>
              )}

              {/* Start New Chat Button */}
              <button
                type="button"
                onClick={handleNewThread}
                disabled={isLoading || isSending}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 active:scale-95 transition-all shadow-xs disabled:opacity-50"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Thread</span>
              </button>
            </div>
          </header>

          {/* Content Area */}
          {view === "chat" ? (
            <>
              {/* Category Suggestions (when no conversation) */}
              {!activeConversation && !isLoading && (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="max-w-lg text-center">
                    <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 text-white shadow-lg">
                      <Bot className="h-8 w-8" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">How can I help you today?</h2>
                    <p className="text-sm text-slate-500 mt-1">Describe your IT problem and I'll guide you through troubleshooting.</p>

                    <div className="mt-6 grid grid-cols-3 gap-2">
                      {problemCategories.map((cat) => (
                        <button
                          key={cat.value}
                          onClick={() => {
                            const msg = `I'm having a ${cat.label.toLowerCase()} issue.`;
                            handleSendMessage(msg);
                          }}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 transition-all shadow-2xs"
                        >
                          <span className="text-base">{cat.emoji}</span>
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Messages */}
              {(activeConversation || isLoading) && (
                <ChatWindow
                  messages={activeConversation?.messages ?? []}
                  isSending={isSending || isStartingSession}
                  hasConversation={Boolean(activeConversation)}
                  userName={user?.name || "You"}
                  onSendSuggestion={handleSendMessage}
                />
              )}

              {/* Dynamic State Badges: Escalated / Resolved / Troubleshooting Context */}
              {activeConversation?.state?.ticketId && (
                <div className="mx-4 mb-2 p-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 flex items-center justify-between shadow-xs animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <Ticket className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">Support Ticket Escalated (#{String(activeConversation.state.ticketId).slice(0, 8)})</p>
                      <p className="text-[11px] text-amber-700">An official support ticket has been opened with full diagnostic history for our IT support staff.</p>
                    </div>
                  </div>
                  <Link
                    to={`/tickets/${activeConversation.state.ticketId}`}
                    className="text-xs font-semibold px-3 py-1.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors shrink-0"
                  >
                    View Ticket
                  </Link>
                </div>
              )}

              {activeConversation?.state?.solved && (
                <div className="mx-4 mb-2 p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-900 flex items-center gap-2.5 shadow-xs animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">Problem Successfully Resolved</p>
                    <p className="text-[11px] text-emerald-700">The verified solution outcome has been recorded in ResolveAI's outcome memory.</p>
                  </div>
                </div>
              )}

              {/* Natural Quick Reply Chips */}
              {activeConversation && activeConversation.messages.length > 0 && !activeConversation.state?.solved && !activeConversation.state?.ticketId && (
                <div className="px-4 pb-2 flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0 mr-1">Quick reply:</span>
                  {[
                    "Yes, that worked!",
                    "That didn't work",
                    "I already tried that",
                    "My phone works on this Wi-Fi",
                    "I need a human technician"
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      disabled={isSending}
                      onClick={() => handleSendMessage(chip)}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 border border-slate-200 text-slate-700 shadow-2xs transition-all shrink-0"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              {/* Chat Input Bar */}
              <ChatInput
                disabled={isLoading || isSending || isStartingSession}
                isSending={isSending || isStartingSession}
                onSend={handleSendMessage}
              />
            </>
          ) : view === "troubleshooting" ? (
            /* ============= TROUBLESHOOTING VIEW ============= */
            <div className="flex-1 overflow-auto p-6">
              <div className="mx-auto max-w-2xl space-y-6">
                {/* Problem Summary */}
                {activeSession && (
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                    <div className="flex items-center gap-2 mb-3">
                      <HelpCircle className="h-4 w-4 text-teal-600" />
                      <h3 className="text-sm font-bold text-slate-900">Problem</h3>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                        {activeSession.category}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{activeSession.problemDescription}</p>
                  </div>
                )}

                {/* Progress */}
                {activeSession && activeSession.steps.length > 0 && (
                  <div className="flex items-center gap-2">
                    {activeSession.steps.map((step, idx) => (
                      <React.Fragment key={step.stepNumber}>
                        <div className={cn(
                          "grid h-8 w-8 place-items-center rounded-full text-xs font-bold border-2 transition-all",
                          step.outcome === "SUCCESS"
                            ? "bg-emerald-100 border-emerald-400 text-emerald-700"
                            : step.outcome === "FAILURE"
                            ? "bg-rose-100 border-rose-400 text-rose-700"
                            : step.outcome === "PENDING"
                            ? "bg-teal-100 border-teal-400 text-teal-700 ring-2 ring-teal-200 ring-offset-1"
                            : "bg-slate-100 border-slate-300 text-slate-500"
                        )}>
                          {step.outcome === "SUCCESS" ? "✓" : step.outcome === "FAILURE" ? "✕" : step.stepNumber}
                        </div>
                        {idx < activeSession.steps.length - 1 && (
                          <div className={cn(
                            "h-0.5 flex-1 rounded-full",
                            step.outcome !== "PENDING" ? "bg-teal-300" : "bg-slate-200"
                          )} />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {/* Current Action Card */}
                {currentStep && (
                  <div className="rounded-2xl border-2 border-teal-200 bg-gradient-to-br from-teal-50/50 to-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal-600 text-white text-sm font-bold shadow-sm">
                          {currentStep.stepNumber}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-teal-800 uppercase tracking-wide">
                            Troubleshooting Step {currentStep.stepNumber}
                          </p>
                          <span className={cn(
                            "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mt-0.5 inline-block",
                            currentStep.riskLevel === "low"
                              ? "bg-emerald-100 text-emerald-700"
                              : currentStep.riskLevel === "medium"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700"
                          )}>
                            {currentStep.riskLevel} risk
                          </span>
                        </div>
                      </div>
                      {currentStep.aiConfidence !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <Gauge className="h-4 w-4 text-slate-400" />
                          <span className="text-xs font-bold text-slate-700">
                            {Math.round(currentStep.aiConfidence * 100)}%
                          </span>
                        </div>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mb-2">{currentStep.actionName}</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">{currentStep.description}</p>

                    {currentStep.expectedOutcome && (
                      <div className="mt-3 rounded-xl bg-white/80 border border-teal-100 p-3">
                        <p className="text-[11px] font-semibold text-slate-600">Expected Outcome:</p>
                        <p className="text-xs text-slate-700 mt-0.5">{currentStep.expectedOutcome}</p>
                      </div>
                    )}

                    {currentStep.reason && (
                      <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200/60 p-3">
                        <p className="text-[11px] font-semibold text-slate-500">Why this action:</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">{currentStep.reason}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 mt-6">
                      <button
                        onClick={() => handleStepOutcome("SUCCESS")}
                        disabled={isSubmittingOutcome}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-all active:scale-[0.97]"
                      >
                        {isSubmittingOutcome ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        It Worked
                      </button>
                      <button
                        onClick={() => handleStepOutcome("FAILURE")}
                        disabled={isSubmittingOutcome}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50 shadow-sm transition-all active:scale-[0.97]"
                      >
                        {isSubmittingOutcome ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Didn't Work
                      </button>
                    </div>
                  </div>
                )}

                {/* Completed Steps History */}
                {activeSession && activeSession.steps.filter((s) => s.outcome !== "PENDING").length > 0 && (
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                    <h3 className="text-xs font-bold text-slate-900 mb-3 uppercase tracking-wide">Previous Steps</h3>
                    <div className="space-y-2">
                      {activeSession.steps
                        .filter((s) => s.outcome !== "PENDING")
                        .map((step) => (
                          <div key={step.stepNumber} className="flex items-center gap-3 rounded-lg bg-slate-50/70 p-3">
                            <div className={cn(
                              "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                              step.outcome === "SUCCESS"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            )}>
                              {step.outcome === "SUCCESS" ? "✓" : "✕"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800">{step.actionName}</p>
                              <p className="text-[11px] text-slate-500">{step.outcome === "SUCCESS" ? "Completed successfully" : "Did not resolve the issue"}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : view === "resolved" ? (
            /* ============= RESOLVED VIEW ============= */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg">
                  <PartyPopper className="h-10 w-10" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Problem Resolved! 🎉</h2>
                <p className="text-sm text-slate-500 mt-2">
                  Your issue was resolved through AI-guided troubleshooting.
                </p>
                {activeSession?.resolutionSummary && (
                  <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                    <p className="text-xs font-semibold text-emerald-800">{activeSession.resolutionSummary}</p>
                  </div>
                )}
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={handleNewThread}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 shadow-sm transition-all"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    New Support Session
                  </button>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            </div>
          ) : view === "escalated" ? (
            /* ============= ESCALATED VIEW ============= */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
                  <ShieldAlert className="h-10 w-10" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Issue Escalated</h2>
                <p className="text-sm text-slate-500 mt-2">
                  Your issue has been escalated to our support team. A technician will assist you.
                </p>
                {activeSession?.escalationReason && (
                  <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
                    <p className="text-xs font-semibold text-amber-800">Reason: {activeSession.escalationReason}</p>
                  </div>
                )}
                {createdTicketId && (
                  <div className="mt-4 rounded-xl bg-white border border-slate-200 p-4">
                    <p className="text-xs text-slate-500 font-medium">Ticket ID:</p>
                    <p className="text-sm font-bold font-mono text-teal-700 mt-1">
                      #{createdTicketId.slice(-6).toUpperCase()}
                    </p>
                  </div>
                )}
                <div className="mt-6 flex items-center justify-center gap-3">
                  {createdTicketId && (
                    <Link
                      to={`/tickets/${createdTicketId}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 shadow-sm transition-all"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Ticket
                    </Link>
                  )}
                  <button
                    onClick={handleNewThread}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    New Session
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Raise Ticket Modal */}
      {ticketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-amber-800">
                  <Ticket className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Escalate to Human Technician</h3>
                  <p className="text-[11px] text-slate-500">Create a tracked incident ticket with conversation context</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTicketModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {ticketSuccess ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Ticket Created Successfully!</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Your incident has been dispatched to the IT support queue.
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Link
                    to="/tickets"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 transition-colors"
                  >
                    <span>View in My Tickets</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateTicket} className="mt-4 space-y-4">
                {ticketError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                    <span>{ticketError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ticket Subject / Title
                  </label>
                  <input
                    type="text"
                    required
                    value={ticketTitle}
                    onChange={(e) => setTicketTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    placeholder="Brief summary of the issue"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      value={ticketCategory}
                      onChange={(e) => setTicketCategory(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 bg-white"
                    >
                      <option value="network">Network & Wi-Fi</option>
                      <option value="hardware">Hardware & Peripherals</option>
                      <option value="software">Software & Applications</option>
                      <option value="security">Security & VPN</option>
                      <option value="general">General Inquiry</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Severity
                    </label>
                    <select
                      value={ticketSeverity}
                      onChange={(e) => setTicketSeverity(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 bg-white"
                    >
                      <option value="LOW">Low (Minor inconvenience)</option>
                      <option value="MEDIUM">Medium (Normal business impact)</option>
                      <option value="HIGH">High (Urgent productivity block)</option>
                      <option value="CRITICAL">Critical (System down)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Problem Details & Action History
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={ticketDescription}
                    onChange={(e) => setTicketDescription(e.target.value)}
                    className="w-full resize-none rounded-xl border border-slate-300 p-3 text-xs text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 font-mono"
                    placeholder="Describe what occurred, what was tried, and the error messages"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTicketModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={ticketSubmitting}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:from-amber-700 hover:to-orange-700 disabled:opacity-50"
                  >
                    {ticketSubmitting ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent" />
                        <span>Submitting Ticket...</span>
                      </>
                    ) : (
                      <>
                        <Ticket className="h-3.5 w-3.5" />
                        <span>Confirm & Dispatch Ticket</span>
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
