# Experiment Design

## Research Question

Can an outcome-driven adaptive troubleshooting system reduce troubleshooting steps, resolution time, unnecessary human escalations, and duplicate actions compared with:
- **Baseline A**: Traditional ticket-first support (no AI self-service)
- **Baseline B**: RAG-only support (knowledge retrieval without adaptive action selection)
- **Proposed**: ResolveAI ATE (adaptive scoring + failure memory + RAG)

## Ablation Conditions

| Condition | History | Failure Memory | RAG | Adaptive Scoring |
|-----------|---------|----------------|-----|-----------------|
| Ticket-first (A) | ✗ | ✗ | ✗ | ✗ |
| RAG-only (B) | ✗ | ✗ | ✓ | ✗ |
| ATE no-history | ✗ | ✓ | ✓ | ✓ |
| ATE no-failure-memory | ✓ | ✗ | ✓ | ✓ |
| ATE full (proposed) | ✓ | ✓ | ✓ | ✓ |

## Metrics

| Metric | Definition |
|--------|-----------|
| AI Resolution Rate | % of sessions resolved without human escalation |
| Ticket Reduction Rate | % reduction in tickets vs ticket-first baseline |
| Avg Troubleshooting Steps | Mean steps per resolved session |
| Avg Resolution Time (min) | Mean wall-clock minutes from session start to resolution |
| Escalation Rate | % of sessions escalated to human technician |
| Repeated Action Rate | % of sessions where the same action was attempted twice |
| User Satisfaction | Mean star rating (1–5) from post-resolution feedback |

## Simulation

The `simulateAblationBenchmark` endpoint generates synthetic session outcomes for each ablation condition using configurable parameters:
- `sampleSize`: number of simulated sessions (default: 100)
- `problemDiversity`: variety of problem categories (0–1)
- `historicalLearningRate`: rate at which history improves scores (0–1)

Simulation results are displayed in the Analytics Suite benchmark table and can be exported for the research paper.

## Evaluation Data

Primary evaluation uses real session outcomes collected during system operation. The simulation provides supplementary data for conditions that cannot be fully exercised with live users during the research period.

## Statistical Analysis

For each metric pair (proposed vs baseline), a two-sample t-test is used to assess significance (α = 0.05). Effect size is reported as Cohen's d.
