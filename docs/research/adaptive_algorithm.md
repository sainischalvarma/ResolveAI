# Adaptive Troubleshooting Algorithm

## Overview

The Adaptive Troubleshooting Engine (ATE) selects the next best troubleshooting action using an explainable scoring function. It is not a trained machine-learning model; it is an interpretable rule-based scoring mechanism designed to be replaced by a learned model in future work.

## Scoring Function

Each candidate action `a` is scored against the current session context `C`:

```
score(a, C) = w1 * historicalSuccess(a, C.category)
            + w2 * ragRelevance(a, C.problemDescription)
            + w3 * contextMatch(a, C)
            + w4 * aiConfidence(C)
            - w5 * failurePenalty(a, C.failedActions)
            - w6 * riskPenalty(a.riskLevel)
            - w7 * repetitionPenalty(a, C.attemptedActions)
```

Default weights: `w1=0.30, w2=0.25, w3=0.20, w4=0.10, w5=0.25, w6=0.15, w7=0.20`

## Component Definitions

### historicalSuccess(a, category)
Ratio of successful outcomes for action `a` in the same problem category, computed from the `TroubleshootingSession` outcome store. Returns 0.5 (neutral) when no history exists.

### ragRelevance(a, problemDescription)
Cosine similarity between the action's description embedding and the top-k RAG chunks retrieved for the problem description. Measures how well the knowledge base supports this action.

### contextMatch(a, C)
Keyword overlap between the action's tags/category and the session's problem description and category. Normalized to [0, 1].

### aiConfidence(C)
The LLM's self-reported confidence score for the current session, passed through from the conversational engine. Higher confidence increases the score of all actions.

### failurePenalty(a, failedActions)
Binary penalty: 1.0 if action `a` has already failed in this session, 0 otherwise. Prevents the engine from repeating failed actions.

### riskPenalty(a.riskLevel)
Graduated penalty: `low=0`, `medium=0.5`, `high=1.0`. Defers high-risk actions until lower-risk alternatives are exhausted.

### repetitionPenalty(a, attemptedActions)
Binary penalty: 1.0 if action `a` has already been attempted in this session regardless of outcome, 0 otherwise.

## Escalation Decision

Escalation is triggered when any of the following conditions are met:

1. `score(bestAction, C) < ESCALATION_THRESHOLD` (default: 0.35)
2. `C.aiConfidence < CONFIDENCE_THRESHOLD` (default: 0.65)
3. `C.severity == "CRITICAL"` and `autoEscalateCritical == true`
4. All candidate actions have been attempted or failed
5. `C.totalStepsAttempted >= MAX_STEPS` (default: 5)

## Outcome Recording

After each step the user reports `SUCCESS`, `FAILURE`, or `SKIPPED`. This outcome is stored in `TroubleshootingSession.steps` and used to update the historical success rate for future sessions in the same category.

## Failure Memory

Failed actions are stored per-session in `failedActions[]` and globally aggregated in the analytics store. The global failure rate informs the `historicalSuccess` component for future sessions.

## Explainability

Every action decision includes a `reason` field explaining which scoring components drove the selection. This supports the research requirement for interpretable decisions and enables the ablation study to isolate individual components.
