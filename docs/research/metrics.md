# Metrics

## Primary Outcome Metrics

### AI Resolution Rate
`resolvedByAI / totalSessions`

The fraction of troubleshooting sessions that reached `RESOLVED` status without human escalation. This is the primary metric for evaluating the adaptive engine's effectiveness.

### Ticket Reduction Rate
`1 - (ticketsCreated / totalSessions)`

Measures how often the system avoids creating a human-handled ticket. Higher is better.

### Escalation Rate
`escalatedSessions / totalSessions`

Complement of AI Resolution Rate. Includes both confidence-threshold escalations and max-step escalations.

## Efficiency Metrics

### Average Troubleshooting Steps
Mean number of steps attempted per session across all resolved sessions. Fewer steps indicates the engine is selecting effective actions earlier.

### Average Resolution Time
Mean wall-clock minutes from session creation to `resolvedAt` timestamp. Includes user response time.

### Repeated Action Rate
`sessionsWithRepeatedActions / totalSessions`

Measures failure memory effectiveness. A session has a repeated action if any `actionId` appears more than once in `steps[]`.

## Quality Metrics

### User Satisfaction Score
Mean star rating (1–5) collected via the post-resolution feedback modal. Stored per session.

### RAG Retrieval Success Rate
`sessionsWithRagSources / totalSessions`

Fraction of sessions where at least one RAG chunk was retrieved with relevance ≥ 0.5.

### Low Confidence Escalation Rate
`lowConfidenceEscalations / totalEscalations`

Fraction of escalations triggered specifically by AI confidence falling below threshold, as opposed to step exhaustion or critical severity.

## Research Metrics Summary (from Analytics API)

The `/analytics/overview` endpoint returns `researchMetrics` containing all of the above values computed from live session data. These are displayed in the Admin Dashboard Analytics tab and used directly in the research paper results section.
