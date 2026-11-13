# ResolveAI

ResolveAI is an outcome-driven adaptive support system that learns from troubleshooting results, dynamically selects the next best action, and selectively escalates problems to human technicians.

The project is intentionally not a basic chatbot or ticket CRUD app. The core research component is the Adaptive Troubleshooting Engine, which combines historical outcomes, failure memory, context, retrieval relevance, AI confidence, severity, and risk into explainable action decisions.

## Current Phase

Phase 1 is the architecture and repository setup phase. It establishes the monorepo, shared domain contracts, backend service boundaries, frontend shell, environment contract, and research documentation.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, Axios, Lucide React, Recharts, Framer Motion
- Backend: Node.js, Express.js, TypeScript, Mongoose, JWT, Node crypto password hashing, Socket.IO, Zod
- Database: MongoDB Atlas with MongoDB Atlas Vector Search for RAG
- AI: Provider abstraction supporting cloud LLM APIs and optional Ollama

## Repository Layout

```text
resolveai/
  client/          React application
  server/          Express API and domain services
  shared/          Shared TypeScript domain contracts
  knowledge-base/  Local development knowledge documents
  docs/            Architecture and research documentation
  tests/           Cross-package test assets
```

## Development Order

The implementation follows the requested phased roadmap. Each phase should finish with inspection, app run, tests, fixes, and verification before continuing.

## Setup

```bash
pnpm install
pnpm dev
```

Create `.env` from `.env.example` and set real secrets locally. Do not commit `.env`.

## Deployment (Docker)

```bash
# Copy and fill in secrets
cp .env.example server/.env

# Build and start both containers
docker compose up --build -d
```

- Client: http://localhost (Nginx serves the React SPA and proxies `/api` to the server)
- Server: http://localhost:4000
- Health check: http://localhost:4000/health

To pass a custom API URL at build time (e.g. for a hosted domain):

```bash
docker compose build --build-arg VITE_API_URL=https://api.yourdomain.com/api
```

## Research Positioning

Existing AI service-desk systems already provide conversational support, knowledge retrieval, ticket automation, routing, and escalation. ResolveAI focuses specifically on evaluating an outcome-driven adaptive troubleshooting mechanism that uses action-level historical outcomes and failure memory to dynamically select troubleshooting paths and decide when to escalate.
