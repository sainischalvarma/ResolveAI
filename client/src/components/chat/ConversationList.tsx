import React, { useState } from "react";
import {
  MessageSquare,
  MessageSquarePlus,
  RefreshCw,
  Search,
  Trash2,
  Clock,
  Sparkles,
  ChevronRight
} from "lucide-react";
import type { ChatConversationRecord } from "../../services/api";
import { cn } from "../../utils/cn";

interface ConversationListProps {
  conversations: ChatConversationRecord[];
  activeConversationId?: string;
  disabled?: boolean;
  onNew: () => void;
  onRefresh: () => void;
  onSelect: (conversationId: string) => void;
  onDelete?: (conversationId: string) => void;
}

export function ConversationList({
  conversations,
  activeConversationId,
  disabled,
  onNew,
  onRefresh,
  onSelect,
  onDelete
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = c.title.toLowerCase().includes(q);
    const messageMatch = c.messages.some((m) => m.content.toLowerCase().includes(q));
    return titleMatch || messageMatch;
  });

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
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
      return "";
    }
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-teal-500/10 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
              <MessageSquare className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">Conversations</h3>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              {conversations.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onRefresh}
              disabled={disabled}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-white transition-colors"
              title="Refresh conversations"
            >
              <RefreshCw className={cn("h-4 w-4", disabled && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Start New Conversation Button */}
        <button
          type="button"
          onClick={onNew}
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm shadow-teal-600/20 hover:from-teal-700 hover:to-cyan-700 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <MessageSquarePlus className="h-4 w-4" />
          <span>Start New Chat</span>
        </button>

        {/* Search Bar */}
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-teal-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-teal-500/10 transition-all"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="py-12 text-center px-4">
            <MessageSquare className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {searchQuery ? "No matching conversations" : "No conversation history"}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              {searchQuery ? "Try searching for different keywords" : "Start your first support thread"}
            </p>
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const lastMsg = conv.messages[conv.messages.length - 1]?.content;

            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "group relative flex items-start gap-3 rounded-xl p-3 text-left transition-all cursor-pointer select-none",
                  isActive
                    ? "bg-teal-500/10 dark:bg-teal-950/40 text-slate-900 dark:text-teal-200 border border-teal-200 dark:border-teal-800/60 shadow-xs"
                    : "hover:bg-slate-100/80 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 border border-transparent"
                )}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <span className="absolute left-1 top-2 bottom-2 w-1 rounded-full bg-teal-600 dark:bg-teal-400" />
                )}

                <div className="min-w-0 flex-1 pl-1">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={cn(
                        "text-xs font-semibold truncate",
                        isActive ? "text-teal-900 dark:text-teal-300 font-bold" : "text-slate-900 dark:text-slate-200 group-hover:text-slate-950 dark:group-hover:text-white"
                      )}
                    >
                      {conv.title || "Support Thread"}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                      {formatDate(conv.updatedAt || conv.createdAt)}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-relaxed">
                    {lastMsg || "Empty conversation"}
                  </p>
                </div>

                {/* Delete Button */}
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this conversation?")) {
                        onDelete(conv.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 rounded-md p-1 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 transition-all shrink-0 self-center"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-200/80 bg-slate-50/50 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>ResolveAI Online</span>
        </span>
        <span className="text-[10px] uppercase font-bold text-slate-400">Level-1 Bot</span>
      </div>
    </div>
  );
}
