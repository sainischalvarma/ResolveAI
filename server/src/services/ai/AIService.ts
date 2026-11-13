import type { ChatMessageRecord } from "@resolveai/shared";
import type { AiMessage, AiProvider } from "./AiProvider.js";
import { MockAiProvider } from "./MockAiProvider.js";
import { OpenAiProvider } from "./OpenAiProvider.js";
import { createRagService, type RagChunk } from "../rag/RagService.js";
import { chatStateSchema, type ChatState } from "./schema.js";
import { ConversationalEngine } from "./ConversationalEngine.js";

export const itSupportSystemPrompt = `You are ResolveAI's senior Tier-1 conversational technical support assistant.
You speak naturally, empathetically, and conversationally like a helpful IT specialist.

CORE BEHAVIOR & RULES:
1. Converse naturally in fluent, friendly language. DO NOT sound like a rigid decision tree or ask yes/no questions repeatedly.
2. Maintain Conversation Context: Understand previous messages. Understand pronouns ("it", "the other device", "since yesterday"). Never re-ask questions the user already answered.
3. Follow-up Intelligence: Ask smart follow-up questions to narrow down the issue (e.g., "Can your phone or another device connected to the same Wi-Fi access the internet?").
4. Grounded in Approved Knowledge: When approved knowledge base procedures are provided below, guide the user through their approved actions step-by-step. Do NOT invent arbitrary or unauthorized technical procedures.
5. Adaptive Troubleshooting: If a user reports an action failed ("didn't work", "tried that already"), do not repeat it. Suggest the next logical approved action.
6. Detect Resolution: If the user indicates the problem is resolved ("that worked", "it's working now", "fixed"), celebrate the outcome and confirm resolution without escalating.
7. Escalation: If all troubleshooting fails, or the problem is a critical outage, or the user requests a human/technician, explain that you are creating an official IT ticket and escalate cleanly.

OUTPUT FORMAT:
You must respond strictly with a valid JSON object matching this schema:
{
  "status": "troubleshooting" | "solved" | "escalated",
  "issue_category": "network" | "hardware" | "software" | "vpn" | "account" | "system" | "other",
  "issue_type": "string",
  "device": "string",
  "operating_system": "string",
  "current_step": number,
  "completed_steps": ["string"],
  "failed_steps": ["string"],
  "error_message": "string",
  "solved": boolean,
  "escalate": boolean,
  "reason_for_escalation": "string",
  "source_id": "string",
  "assistant_reply": "string (the natural, helpful response to display to the user)"
}
Never include markdown code blocks like \`\`\`json around the response. Just output the raw JSON object.`;

export function resolveAiProvider(): AiProvider {
  if (process.env.NODE_ENV === "test" && !process.env.FORCE_LLM_TEST) {
    return new MockAiProvider();
  }

  const providerType = (process.env.LLM_PROVIDER ?? "mock").toLowerCase().trim();
  const apiKey = (process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "").trim();

  if (providerType === "openai" || (apiKey && providerType !== "mock")) {
    if (!apiKey) {
      console.warn("LLM_PROVIDER is configured as 'openai' but LLM_API_KEY / OPENAI_API_KEY is missing. Falling back to MockAiProvider.");
      return new MockAiProvider();
    }
    return new OpenAiProvider(apiKey);
  }

  return new MockAiProvider();
}

export class AIService {
  private engine = new ConversationalEngine();

  constructor(private readonly provider: AiProvider = resolveAiProvider()) {}

  async generateChatReply(messages: ChatMessageRecord[], state?: Record<string, any>) {
    // 1. Analyze multi-turn conversation context
    const analysis = this.engine.analyzeConversation(messages, state);

    // 2. Synthesize semantic query & retrieve approved knowledge from MongoDB Atlas
    let relevantChunks: RagChunk[] = [];
    let ragContext = "";
    try {
      const ragService = createRagService();
      relevantChunks = await ragService.retrieve(analysis.semanticSearchQuery, {
        category: analysis.category !== "other" ? analysis.category : undefined,
        limit: 3
      });

      if (relevantChunks.length === 0 && analysis.category !== "other") {
        relevantChunks = await ragService.retrieve(analysis.semanticSearchQuery, { limit: 3 });
      }

      if (relevantChunks.length > 0) {
        const procedures = relevantChunks
          .map(
            (chunk, index) =>
              `--- PROCEDURE ${index + 1}: ${chunk.title} (${chunk.category}) ---\n${chunk.content}`
          )
          .join("\n\n");
        ragContext = `\n\nAPPROVED KNOWLEDGE BASE PROCEDURES (SOURCE OF TRUTH):\n${procedures}\n\nINSTRUCTION: Guide the user through these approved actions one step at a time.`;
      }
    } catch (err) {
      console.warn("[AIService] RAG retrieval error:", err);
    }

    // 3. If using MockAiProvider, generate conversational response directly using ConversationalEngine
    if (this.provider instanceof MockAiProvider) {
      const result = this.engine.generateConversationalTurn(analysis, messages, relevantChunks, state);
      return {
        content: result.replyText,
        confidence: 0.95,
        state: result.state
      };
    }

    // 4. Otherwise, format prompt for real LLM provider (OpenAI / Ollama / etc.)
    const stateContext = state ? `\n\nCURRENT CONVERSATION STATE:\n${JSON.stringify(state, null, 2)}` : "";
    const baseMessages: AiMessage[] = [
      { role: "system", content: `${itSupportSystemPrompt}${ragContext}${stateContext}` },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content
      }))
    ];

    try {
      let rawResponse = await this.provider.generateResponse(baseMessages, state);
      
      let parsedResult: ChatState;
      try {
        const cleanContent = rawResponse.content.replace(/^```json\s*/, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleanContent);
        parsedResult = chatStateSchema.parse(parsed);
      } catch (err) {
        console.warn("JSON parse/validation failed, falling back to conversational engine turn:", err);
        const fallback = this.engine.generateConversationalTurn(analysis, messages, relevantChunks, state);
        parsedResult = fallback.state;
      }
      
      return {
        content: parsedResult.assistant_reply,
        confidence: rawResponse.confidence,
        state: parsedResult
      };
    } catch (error) {
      console.error("AI provider failed:", error);
      return {
        content: "I am having trouble reaching the AI service right now. Please retry in a moment.",
        confidence: 0
      };
    }
  }
}
