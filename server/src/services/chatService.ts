import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import type { ChatConversationRecord, ChatMessageRecord, ChatMessageRole } from "@resolveai/shared";
import {
  ActionOutcomeModel,
  ConversationModel,
  MessageModel,
  TicketModel,
  TroubleshootingSessionModel,
  type ConversationDocument,
  type MessageDocument
} from "../models/index.js";
import { AIService } from "./ai/AIService.js";
import type { AiProvider } from "./ai/AiProvider.js";

const developmentUserId = "development-user";
const maxMessageLength = 4000;

interface DevelopmentConversation {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessageRecord[];
  state?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

const developmentConversations = new Map<string, DevelopmentConversation>();
let testAiProvider: AiProvider | null = null;

export interface CreateConversationInput {
  userId?: string;
  message?: string;
}

export async function createConversation(input: CreateConversationInput = {}) {
  const userId = input.userId ?? developmentUserId;
  const initialMessage = input.message ? normalizeMessage(input.message) : undefined;
  const title = createTitle(initialMessage);

  if (!isDatabaseConnected()) {
    const now = new Date().toISOString();
    const conversation: DevelopmentConversation = {
      id: randomUUID(),
      userId,
      title,
      messages: [],
      state: {},
      createdAt: now,
      updatedAt: now
    };

    developmentConversations.set(conversation.id, conversation);

    if (initialMessage) {
      return appendMessage(conversation.id, initialMessage, userId);
    }

    return conversation;
  }

  const conversation = await ConversationModel.create({ userId, title });

  if (initialMessage) {
    return appendMessage(conversation._id.toString(), initialMessage, userId);
  }

  return toConversationRecord(conversation, []);
}

export async function appendMessage(conversationId: string, content: string, userId = developmentUserId) {
  const normalizedContent = normalizeMessage(content);

  if (!isDatabaseConnected()) {
    const conversation = getDevelopmentConversation(conversationId, userId);
    const userMessage = createDevelopmentMessage(conversation.id, "user", normalizedContent);
    conversation.messages.push(userMessage);

    const ai = createAiService();
    const reply = await ai.generateChatReply(conversation.messages, conversation.state);
    conversation.messages.push(createDevelopmentMessage(conversation.id, "assistant", reply.content));
    
    if (reply.state?.escalate && !reply.state.ticketId) {
      reply.state.ticketId = randomUUID();
    }
    
    conversation.state = reply.state;
    conversation.updatedAt = new Date().toISOString();

    return conversation;
  }

  const conversation = await ConversationModel.findOne({ _id: conversationId, userId });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  await MessageModel.create({ conversationId: conversation._id, userId, role: "user", content: normalizedContent });
  const messages = await MessageModel.find({ conversationId: conversation._id, userId }).sort({ createdAt: 1 });
  const ai = createAiService();
  const reply = await ai.generateChatReply(messages.map(toMessageRecord), conversation.state);
  await MessageModel.create({ conversationId: conversation._id, userId, role: "assistant", content: reply.content });

  // Record Outcome Memory in MongoDB
  try {
    if (reply.state?.solved) {
      await ActionOutcomeModel.create({
        problemCategory: reply.state.issue_category || "general",
        problemType: reply.state.issue_type || "Troubleshooting",
        actionId: reply.state.source_id || "resolved_step",
        actionName: reply.state.source_id || "Approved Troubleshooting Procedure",
        result: "SUCCESS",
        context: { conversationId, lastMessage: normalizedContent }
      });
    } else if (reply.state?.failed_steps && reply.state.failed_steps.length > 0) {
      const lastFailed = reply.state.failed_steps[reply.state.failed_steps.length - 1];
      if (lastFailed) {
        await ActionOutcomeModel.create({
          problemCategory: reply.state.issue_category || "general",
          problemType: reply.state.issue_type || "Troubleshooting",
          actionId: lastFailed,
          actionName: lastFailed,
          result: "FAILURE",
          context: { conversationId, lastMessage: normalizedContent }
        });
      }
    }
  } catch (outcomeErr) {
    console.warn("Could not save action outcome:", outcomeErr);
  }
  
  if (reply.state?.escalate && !reply.state.ticketId) {
    const priority = reply.state.impact_scope === "organization_wide" ? "P1" : (reply.state.impact_scope === "multiple_users" ? "P2" : "P3");
    const severity = reply.state.impact_scope === "organization_wide" ? "CRITICAL" : (reply.state.impact_scope === "multiple_users" ? "HIGH" : "MEDIUM");
    const transcript = messages.map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`).join("\n\n");
    
    const ticket = await TicketModel.create({
      title: conversation.title || "Support Escalation",
      description: `Issue: ${reply.state.issue_category} - ${reply.state.issue_type || "Technical Issue"}\nDevice: ${reply.state.device || "Workstation"}\nOS: ${reply.state.operating_system || "Windows"}\nError: ${reply.state.error_message || "None"}\n\nEscalation Reason: ${reply.state.reason_for_escalation || "User escalated from chat"}\n\nAttempted Actions: ${(reply.state.completed_steps || []).join(", ") || "None"}\nFailed Actions: ${(reply.state.failed_steps || []).join(", ") || "None"}\nRAG Knowledge Source: ${reply.state.source_id || "None"}\n\nFull Chat Transcript:\n${transcript}`,
      category: reply.state.issue_category || "general",
      severity,
      priority,
      status: "OPEN",
      userId: new mongoose.Types.ObjectId(userId),
      attemptedActions: reply.state.completed_steps || [],
      failedActions: reply.state.failed_steps || [],
      ragSources: reply.state.source_id ? [reply.state.source_id] : [],
      escalationReason: reply.state.reason_for_escalation || "User escalated from chat"
    });
    
    reply.state.ticketId = ticket._id.toString();
  }

  // Update or record TroubleshootingSession
  try {
    const sessionStatus = reply.state?.solved ? "RESOLVED" : reply.state?.escalate ? "ESCALATED" : "ACTIVE";
    await TroubleshootingSessionModel.findOneAndUpdate(
      { conversationId: conversation._id.toString() },
      {
        userId: new mongoose.Types.ObjectId(userId),
        conversationId: conversation._id.toString(),
        problemDescription: conversation.title || normalizedContent,
        category: (reply.state?.issue_category as any) || "other",
        status: sessionStatus,
        totalStepsAttempted: reply.state?.current_step || 1,
        ticketId: reply.state?.ticketId ? new mongoose.Types.ObjectId(reply.state.ticketId) : undefined,
        escalationReason: reply.state?.reason_for_escalation
      },
      { upsert: true, new: true }
    );
  } catch (sessErr) {
    console.warn("Could not save troubleshooting session:", sessErr);
  }

  await ConversationModel.updateOne({ _id: conversation._id }, { title: conversation.title || createTitle(content), state: reply.state });

  return getConversation(conversationId, userId);
}

export async function getConversation(conversationId: string, userId = developmentUserId) {
  if (!isDatabaseConnected()) {
    return getDevelopmentConversation(conversationId, userId);
  }

  const conversation = await ConversationModel.findOne({ _id: conversationId, userId });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const messages = await MessageModel.find({ conversationId: conversation._id, userId }).sort({ createdAt: 1 });
  return toConversationRecord(conversation, messages);
}

export async function listConversations(userId = developmentUserId) {
  if (!isDatabaseConnected()) {
    return [...developmentConversations.values()]
      .filter((conversation) => conversation.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((conversation) => ({
        ...conversation,
        messages: conversation.messages.slice(-1)
      }));
  }

  const conversations = await ConversationModel.find({ userId }).sort({ updatedAt: -1 });

  return Promise.all(
    conversations.map(async (conversation) => {
      const messages = await MessageModel.find({ conversationId: conversation._id, userId }).sort({ createdAt: -1 }).limit(1);
      return toConversationRecord(conversation, messages.reverse());
    })
  );
}

export async function deleteConversation(conversationId: string, userId = developmentUserId) {
  if (!isDatabaseConnected()) {
    const conversation = developmentConversations.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }
    developmentConversations.delete(conversationId);
    return { success: true };
  }

  const conversation = await ConversationModel.findOne({ _id: conversationId, userId });
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  await MessageModel.deleteMany({ conversationId: conversation._id });
  await ConversationModel.deleteOne({ _id: conversation._id });
  return { success: true };
}

export function resetDevelopmentChatStore() {
  developmentConversations.clear();
  testAiProvider = null;
}

export function setChatAiProviderForTesting(provider: AiProvider | null) {
  testAiProvider = provider;
}

function getDevelopmentConversation(conversationId: string, userId: string) {
  const conversation = developmentConversations.get(conversationId);

  if (!conversation || conversation.userId !== userId) {
    throw new Error("Conversation not found");
  }

  return conversation;
}

function createDevelopmentMessage(conversationId: string, role: ChatMessageRole, content: string): ChatMessageRecord {
  return {
    id: randomUUID(),
    conversationId,
    role,
    content,
    createdAt: new Date().toISOString()
  };
}

function createAiService() {
  return testAiProvider ? new AIService(testAiProvider) : new AIService();
}

function normalizeMessage(content: string) {
  const normalized = content.trim();

  if (!normalized) {
    throw new Error("Message content is required");
  }

  if (normalized.length > maxMessageLength) {
    throw new Error("Message content is too long");
  }

  return normalized;
}

function toConversationRecord(
  conversation: ConversationDocument,
  messages: MessageDocument[] | ChatMessageRecord[]
): ChatConversationRecord {
  return {
    id: conversation._id.toString(),
    userId: conversation.userId,
    title: conversation.title,
    messages: messages.map((message) => ("_id" in message ? toMessageRecord(message) : message)),
    state: conversation.state,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString()
  };
}

function toMessageRecord(message: MessageDocument): ChatMessageRecord {
  return {
    id: message._id.toString(),
    conversationId: message.conversationId.toString(),
    role: message.role as ChatMessageRole,
    content: message.content,
    createdAt: message.createdAt.toISOString()
  };
}

function createTitle(message = "New support conversation") {
  const normalized = message.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized.slice(0, 80) : "New support conversation";
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}
