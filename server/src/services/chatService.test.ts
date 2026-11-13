import { beforeEach, describe, expect, it } from "vitest";
import type { AiProvider } from "./ai/AiProvider.js";
import {
  appendMessage,
  createConversation,
  getConversation,
  listConversations,
  resetDevelopmentChatStore,
  setChatAiProviderForTesting
} from "./chatService.js";

describe("chatService development conversations", () => {
  beforeEach(() => {
    resetDevelopmentChatStore();
  });

  it("creates a new empty conversation", async () => {
    const conversation = await createConversation({ userId: "user-1" });

    expect(conversation.id).toBeTruthy();
    expect(conversation.userId).toBe("user-1");
    expect(conversation.messages).toHaveLength(0);
  });

  it("saves the first user message and AI response", async () => {
    const conversation = await createConversation({
      userId: "user-1",
      message: "My Wi-Fi is not working"
    });

    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[0]).toMatchObject({ role: "user", content: "My Wi-Fi is not working" });
    expect(conversation.messages[1]?.role).toBe("assistant");
    expect(conversation.messages[1]?.content).toContain("Wi-Fi");
  });

  it("continues a conversation with previous messages available as context", async () => {
    const conversation = await createConversation({
      userId: "user-1",
      message: "My laptop Wi-Fi is not working"
    });

    const continued = await appendMessage(conversation.id, "Yes.", "user-1");

    expect(continued.messages).toHaveLength(4);
    expect(continued.messages[3]?.content).toContain("Step 2:");
    expect(continued.messages[3]?.content).toContain("laptop");
  });

  it("retrieves conversation history and lists previous conversations", async () => {
    const created = await createConversation({ userId: "user-1", message: "VPN is timing out" });
    const retrieved = await getConversation(created.id, "user-1");
    const conversations = await listConversations("user-1");

    expect(retrieved.messages).toHaveLength(2);
    expect(conversations[0]?.id).toBe(created.id);
    expect(conversations[0]?.messages).toHaveLength(1);
  });

  it("isolates conversations between users", async () => {
    const userOneConversation = await createConversation({ userId: "user-1", message: "My Wi-Fi is not working" });
    await createConversation({ userId: "user-2", message: "My printer is offline" });

    const userOneList = await listConversations("user-1");
    const userTwoList = await listConversations("user-2");

    expect(userOneList).toHaveLength(1);
    expect(userOneList[0]?.id).toBe(userOneConversation.id);
    expect(userTwoList).toHaveLength(1);
    await expect(getConversation(userOneConversation.id, "user-2")).rejects.toThrow("Conversation not found");
  });

  it("keeps a new conversation separate from prior messages", async () => {
    const first = await createConversation({ userId: "user-1", message: "Printer is offline" });
    const second = await createConversation({ userId: "user-1" });

    expect(first.id).not.toBe(second.id);
    expect(second.messages).toHaveLength(0);
  });

  it("throws for an invalid conversation id", async () => {
    await expect(appendMessage("missing-conversation", "Hello", "user-1")).rejects.toThrow("Conversation not found");
  });

  it("returns a safe assistant message when the AI provider fails", async () => {
    setChatAiProviderForTesting(new FailingProvider());
    const conversation = await createConversation({ userId: "user-1", message: "My Wi-Fi is not working" });

    expect(conversation.messages[1]?.role).toBe("assistant");
    expect(conversation.messages[1]?.content).toContain("trouble reaching the AI service");
  });

  it("rejects empty messages before saving them", async () => {
    const conversation = await createConversation({ userId: "user-1" });

    await expect(appendMessage(conversation.id, "   ", "user-1")).rejects.toThrow("Message content is required");
    expect((await getConversation(conversation.id, "user-1")).messages).toHaveLength(0);
  });
});

class FailingProvider implements AiProvider {
  async classifyProblem(): ReturnType<AiProvider["classifyProblem"]> {
    throw new Error("provider unavailable");
  }

  async generateResponse(): ReturnType<AiProvider["generateResponse"]> {
    throw new Error("provider unavailable");
  }
}
