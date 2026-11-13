import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  type ChatConversationRecord,
  createChatConversation,
  deleteChatConversation,
  getChatConversation,
  listChatConversations,
  sendChatMessage
} from "../services/api";

function friendlyError(err: any, fallback: string): string {
  if (err.response?.status === 401) return "Session expired. Please log in again.";
  if (err.response?.status === 403) return "You don't have permission for this action.";
  if (err.response?.status >= 500) return "Server error. Please try again later.";
  if (err.code === "ERR_NETWORK") return "Cannot reach the server. Is the backend running?";
  return err.response?.data?.message || err.response?.data?.error || fallback;
}

export function useChat() {
  const { user } = useAuth();
  const currentUserId = user?.id || "development-user";
  const storageKey = `resolveai.activeConversationId.${currentUserId}`;

  const [conversations, setConversations] = useState<ChatConversationRecord[]>([]);
  const [activeConversation, setActiveConversation] = useState<ChatConversationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshConversations = useCallback(async () => {
    const list = await listChatConversations(currentUserId);
    setConversations(list);
    return list;
  }, [currentUserId]);

  const loadConversation = useCallback(
    async (conversationId: string) => {
      setError(null);
      const conversation = await getChatConversation(conversationId, currentUserId);
      setActiveConversation(conversation);
      window.localStorage.setItem(storageKey, conversation.id);
      return conversation;
    },
    [currentUserId, storageKey]
  );

  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const list = await refreshConversations();
      const savedId = window.localStorage.getItem(storageKey);
      const conversationToLoad =
        savedId && list.some((conversation) => conversation.id === savedId)
          ? savedId
          : list[0]?.id;

      if (conversationToLoad) {
        await loadConversation(conversationToLoad);
      } else {
        setActiveConversation(null);
      }
    } catch (err: any) {
      console.error("Failed to load conversations:", err);
      setError(friendlyError(err, "Unable to load conversations. Check that the backend is running."));
    } finally {
      setIsLoading(false);
    }
  }, [loadConversation, refreshConversations, storageKey]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  async function startConversation() {
    try {
      setIsLoading(true);
      setError(null);
      const conversation = await createChatConversation({ userId: currentUserId });
      setActiveConversation(conversation);
      window.localStorage.setItem(storageKey, conversation.id);
      await refreshConversations();
    } catch (err: any) {
      console.error("Failed to start conversation:", err);
      setError(friendlyError(err, "Unable to start a new conversation."));
    } finally {
      setIsLoading(false);
    }
  }

  async function selectConversation(conversationId: string) {
    try {
      setIsLoading(true);
      await loadConversation(conversationId);
    } catch (err: any) {
      console.error("Failed to select conversation:", err);
      setError(friendlyError(err, "Unable to load that conversation."));
    } finally {
      setIsLoading(false);
    }
  }

  async function sendMessage(message: string) {
    try {
      setIsSending(true);
      setError(null);
      const conversation =
        activeConversation ?? (await createChatConversation({ userId: currentUserId }));
      const updatedConversation = await sendChatMessage(conversation.id, message, currentUserId);
      setActiveConversation(updatedConversation);
      window.localStorage.setItem(storageKey, updatedConversation.id);
      await refreshConversations();
    } catch (err: any) {
      console.error("Failed to send message:", err);
      setError(friendlyError(err, "Message failed. Please retry."));
    } finally {
      setIsSending(false);
    }
  }

  async function removeConversation(conversationId: string) {
    try {
      setError(null);
      await deleteChatConversation(conversationId, currentUserId);
      const isCurrent = activeConversation?.id === conversationId;
      if (isCurrent) {
        window.localStorage.removeItem(storageKey);
        setActiveConversation(null);
      }
      const list = await refreshConversations();
      if (isCurrent && list.length > 0) {
        await loadConversation(list[0].id);
      }
    } catch (err: any) {
      console.error("Failed to delete conversation:", err);
      setError(friendlyError(err, "Unable to delete conversation."));
    }
  }

  async function retry() {
    await initialize();
  }

  return {
    conversations,
    activeConversation,
    isLoading,
    isSending,
    error,
    startConversation,
    selectConversation,
    removeConversation,
    refreshConversations: initialize,
    sendMessage,
    retry
  };
}
