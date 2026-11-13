# System Architecture

## High-Level Components

```
User Browser
    │
    ▼
React Client (Vite + TypeScript + Tailwind)
    │  REST + Socket.IO
    ▼
Express API Server (Node.js + TypeScript)
    ├── Auth Service          — JWT, role-based access (USER / STAFF / TECHNICIAN / ADMIN)
    ├── Chat Service          — Conversational engine, LLM provider abstraction
    ├── Troubleshooting       — Adaptive Troubleshooting Engine (ATE)
    │   Session Service           scoring, failure memory, escalation decision
    ├── RAG Service           — Embedding + vector search (MongoDB Atlas or Qdrant)
    ├── Ticket Service        — Lifecycle management, replies, status transitions
    ├── Staff Service         — Technician workbench, actions log, resolution
    ├── Assignment Service    — Skill-match + workload scoring for auto-assignment
    ├── Incident Detection    — Jaccard + cosine duplicate detection, cluster detection
    ├── Analytics Service     — Root-cause distribution, action efficacy, ablation benchmarks
    ├── Notification Service  — Real-time Socket.IO gateway + persistent store
    └── Admin Service         — User/staff/knowledge/ticket management, audit logs
    │
    ▼
MongoDB Atlas
    ├── users                 — Accounts and roles
    ├── tickets               — Incident lifecycle
    ├── troubleshootingsessions — Step-by-step ATE history and outcomes
    ├── chatconversations     — LLM conversation threads
    ├── knowledgedocuments    — KB metadata
    ├── knowledgechunks       — Embedded chunks with vector index (384-dim, cosine)
    ├── technicianprofiles    — Skills, availability, workload
    ├── notifications         — Per-user notification store
    └── auditlogs             — Admin audit trail
```

## Adaptive Troubleshooting Engine Data Flow

1. User describes problem → Chat Service → LLM extracts category + severity
2. ATE queries action library filtered by category
3. For each candidate action: score = f(history, RAG relevance, context, confidence, penalties)
4. Highest-scoring non-attempted action is selected
5. User executes action and reports outcome (SUCCESS / FAILURE / SKIPPED)
6. Outcome stored → updates historical success rates
7. If escalation conditions met → Ticket created → Assignment Service selects technician

## RAG Pipeline

1. Knowledge documents ingested → chunked (512 tokens, 64 overlap)
2. Each chunk embedded via `@xenova/transformers` (all-MiniLM-L6-v2, 384-dim)
3. Embeddings stored in MongoDB Atlas Vector Search index or Qdrant
4. At query time: problem description embedded → top-k chunks retrieved by cosine similarity
5. Retrieved chunks injected into LLM system prompt as grounding context

## LLM Provider Abstraction

The `AiProvider` interface supports:
- `mock` — deterministic responses for testing and offline demo
- `openai` — GPT-4o via OpenAI API
- `ollama` — local models via Ollama REST API

Provider is selected via `LLM_PROVIDER` environment variable with no code changes required.

## Deployment Topology

- Client: static build served by Nginx (Docker)
- Server: Node.js process in Docker container
- Database: MongoDB Atlas (cloud-managed)
- Vector search: MongoDB Atlas Vector Search (embedded) or Qdrant Cloud
- Reverse proxy: Nginx routes `/api` to server, `/` to client static files
