# Chatbot Audit

## Current Flow
1. **Frontend**: The user opens the chat in `AiSupport.tsx`. It uses the `useChat.ts` hook to manage conversations, fetching/creating them from the backend via REST endpoints.
2. **Backend Chat Service**: `chatService.ts` handles storing conversations and messages either in memory (development mode) or MongoDB.
3. **AI Service**: `chatService.ts` calls `AIService.ts` (`generateChatReply`) which builds a system prompt containing RAG context. It queries the RAG service for knowledge chunks.
4. **Troubleshooting Engine**: `AdaptiveTroubleshootingEngine.ts` exists but doesn't seem to be deeply integrated into the current `chatService.ts` flow (only used for escalation logic or completely separate). Wait, in `chatService.ts`, the `AdaptiveTroubleshootingEngine` is not imported or used. The LLM generates the state and decides whether to escalate.
5. **Tickets**: When the LLM sets `escalate: true`, `chatService.ts` generates a ticket in the database.

## What is Real vs. Mocked
- **Real**: 
  - MongoDB integration is implemented in `chatService.ts` and `RagService.ts` (if connected).
  - OpenAiProvider is implemented.
  - Ticket model exists and creates tickets.
- **Mocked/Development**:
  - `chatService.ts` falls back to in-memory maps if MongoDB is not connected.
  - `RagService.ts` has `InMemoryVectorRagService` and `seedDevelopmentKnowledge`.
  - `MockAiProvider.ts` is used by default in tests and when API keys are absent.
  - `developmentUserId` is hardcoded as a fallback.
  - Action definitions in `AdaptiveTroubleshootingEngine` are hardcoded `approvedDevelopmentActions`.

## Gaps Against the Prompt
- **Qdrant**: There are Qdrant routes and services in the codebase that need to be removed from the chat/RAG path.
- **Pipeline Architecture (Step 2)**: Currently, the LLM receives the RAG context and imagines/formats the step. The prompt requires an Agent Coordinator pipeline where:
  1. Understand turn (classify)
  2. Extract structured context
  3. Risk/criticality check
  4. RAG retrieval of APPROVED knowledge
  5. Action selection via Adaptive Troubleshooting Engine (not LLM)
  6. Response generation (LLM only phrases the selected action)
  7. Record everything
- **Conversation Behavior (Step 3)**:
  - Loop and stall protection is missing.
  - Outcomes (SUCCESS/FAILURE) are handled via a separate `submitStepOutcomeApi` in UI, but the chat service itself relies on the LLM state.
- **RAG on MongoDB Atlas (Step 4)**:
  - Need to support `text-embedding-3-small` (1536 dims). Currently `embeddingDimensions` is hardcoded to 384 in `RagService.ts`.
  - Need to handle `$vectorSearch` with metadata filters and keyword reciprocal rank fusion.
- **Adaptive Engine (Step 5)**:
  - It exists but is not wired into the main chat loop.
  - Outcomes are not persisted properly for learning.
- **Tickets (Step 6)**:
  - Missing info collection before ticket creation.
  - Idempotency is not guaranteed.
  - Backend assignment logic is missing.
- **Screenshots (Step 7)**:
  - Screenshot upload and vision analysis is missing.
- **Reliability and Speed (Step 8)**:
  - Streaming responses (SSE/Socket.IO) are not implemented.
  - Rate limiting, token limits, cost caps are missing.
- **Safety (Step 9)**:
  - PII redaction is missing.
  - Prompt injection defense is not robust.

## Scenario Failures
Ran 40 scripted scenarios against the mock backend.
- **Result**: 11/40 passed.
- **Failures**:
  - `MockAiProvider` lacks complete structured state generation (e.g. `issue_type`, `device`, `operating_system`, `impact_scope`), causing Zod schema validation errors.
  - Fallback logic triggers premature escalation when JSON validation fails, instead of providing "Step 1:".
  - Pattern matching in `MockAiProvider` fails to identify and handle multiple categories correctly, providing generic responses or incorrect step numbers.
