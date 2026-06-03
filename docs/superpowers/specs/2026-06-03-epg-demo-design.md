# EPG Service Demo Design

**Date:** 2026-06-03  
**Tag:** `demo/epg-service`  
**Status:** Approved for implementation

---

## Overview

A fully runnable end-to-end demo that showcases the OpsAgents platform handling a real-world EPG (Electronic Program Guide) service incident — lights-off, zero human intervention. The demo triggers a bad pipeline deployment, then watches all four domain controllers fire in parallel under MetaController supervision, automatically fix the code, and brief the executive team.

Two new agents are added as part of this demo: `CodeFixAgent` (automated code repair + GitHub PR) and `ExecutiveCommunicationAgent` (multi-channel executive briefing).

---

## Scenario: Bad EPG Ingestion Deploy

**What happened:** A new EPG data pipeline version (`v2.3.1`) is deployed. It contains two bugs:
1. A hardcoded API key in the source (`SEC-001` violation)
2. A null-pointer error in the schedule parser that crashes when `programme.end_time` is missing

**Effect:** BBC One, ITV, and Channel 4 schedules show a 2-hour gap (21:00–23:00). The EPG API latency spikes from 120ms to 4,200ms. 503 errors increase 12×.

**Recovery:** MetaController orchestrates all four controllers in parallel. Within 90 seconds, the code is patched, a PR is open, infra is scaled, the security violation is blocked, and the executive team is briefed.

---

## New Agents

### CodeFixAgent

**Package:** `packages/agents/reliability/src/code-fix.ts`  
**Controller:** `IncidentController` — runs after `RootCauseAnalysisAgent`, before `SpareTierRedundancyAgent`

**Responsibilities:**
1. Receives the RCA result identifying the faulty file and line range
2. Applies a targeted patch (stub: writes corrected file content)
3. Creates a git branch: `fix/epg-null-programme-end-time-<timestamp>`
4. Calls `gh pr create` with title, body, and labels
5. Returns `AgentResult` with `pr_url`, `branch`, `patch_summary`

**PR creation** uses the `gh` CLI: `gh pr create --title "..." --body "..." --label "auto-fix,epg-service"`. If `gh` is unavailable, returns `status: 'escalate'` with reason `gh_cli_unavailable`.

**Inputs** (via `AgentContext.sharedState`):
- `priorResults['root-cause-analysis']` — file path, line number, error type
- `ctx.serviceInputs.codeRepo` — repo slug (e.g., `acme/epg-service`)

**Output shape:**
```ts
{
  agentId: 'code-fix',
  status: 'success' | 'escalate',
  data: {
    branch: string,
    pr_url: string,
    patch_summary: string,
    files_changed: string[]
  }
}
```

---

### ExecutiveCommunicationAgent

**Package:** `packages/agents/reliability/src/executive-communication.ts`  
**Controller:** `IncidentController` — runs as the final step, after `ReportingAgent`

**Responsibilities:**
1. Reads all prior agent results from `ctx.sharedState.priorResults`
2. Produces three stubbed output channels:
   - **Slack/Teams** — `slack_payload.json` (webhook-ready JSON, written to `dist/exec-comms/`)
   - **Email** — `executive-email.md` (plain-language briefing, written to `dist/exec-comms/`)
   - **Dashboard** — `dashboard-summary.json` (structured KPIs for a status page, written to `dist/exec-comms/`)
3. Always returns `status: 'success'`

**Executive email structure:**
- Subject: `[AUTO] EPG Service Incident — Resolved | <timestamp>`
- Body sections: What Happened · Root Cause · Actions Taken · PR Reference · Current Status · Next Steps

**Inputs:** all prior `AgentResult` entries in `ctx.sharedState.priorResults`

---

## Updated IncidentController Pipeline

Sequential execution (existing behaviour preserved):

```
IssueIdentificationAgent
  → RootCauseAnalysisAgent
  → CodeFixAgent              ← NEW
  → SpareTierRedundancyAgent
  → EscalationAgent
  → ReportingAgent
  → ExecutiveCommunicationAgent  ← NEW (always runs last, like ReportingAgent)
```

`ExecutiveCommunicationAgent` is always-run (same guarantee as `ReportingAgent`): even if an earlier agent escalates, the executive is always briefed.

---

## EPG Service Stub (`services/epg-service/`)

### Directory structure

```
services/epg-service/
  package.json
  src/
    epg-pipeline.ts          ← the "buggy" ingestion pipeline (v2.3.1 stub)
    epg-pipeline-fixed.ts    ← the patched version CodeFixAgent applies
    types.ts                 ← Channel, Programme, Schedule interfaces
  data/
    channels.json            ← 8 UK channels with metadata
    schedules/
      bbc-one.json           ← 24h schedule with the 21:00–23:00 gap
      bbc-two.json
      itv.json
      channel-4.json
      sky-sports.json
      espn.json
      sky-news.json
      dave.json
    incidents/
      epg-gap-incident.json  ← IssueIdentificationAgent trigger payload
    metrics/
      api-latency.json       ← synthetic latency timeseries (spike at 20:58)
      error-rates.json       ← 503 rate timeseries
  demo/
    run-demo.ts              ← runnable demo script
    voiceover.md             ← timestamped narration script
```

### Channel stub data (channels.json)

8 channels: BBC One, BBC Two, ITV, Channel 4, Sky Sports, ESPN, Sky News, Dave.  
Each entry: `{ id, name, logo_url, category, region, epg_source_url }`.

### Schedule stub data

Each schedule JSON contains 24 × 30-min programme slots. BBC One has a deliberate gap at 21:00–23:00 (the missing data that triggers the incident). ITV has a duplicate entry that the null-pointer bug causes.

### Incident trigger payload (epg-gap-incident.json)

```json
{
  "type": "alert",
  "severity": "high",
  "serviceId": "epg-service",
  "timestamp": "2026-06-03T21:00:00Z",
  "description": "Schedule gap detected: BBC One missing 21:00–23:00",
  "metrics": {
    "api_latency_ms": 4200,
    "error_rate_pct": 14.7,
    "affected_channels": ["bbc-one", "itv", "channel-4"]
  },
  "deploy_ref": "v2.3.1",
  "codeRepo": "acme/epg-service"
}
```

---

## Demo Runner (`services/epg-service/demo/run-demo.ts`)

A single executable TypeScript script using `tsx`:

```
npx tsx services/epg-service/demo/run-demo.ts
```

**Flow:**
1. Banner: OpsAgents EPG Service Demo
2. Load stub incident trigger from `data/incidents/epg-gap-incident.json`
3. Instantiate MetaController with all 4 domain controllers
4. Print: "🚨 INCIDENT DETECTED — EPG schedule gap on BBC One (21:00–23:00)"
5. Call `metaController.runOrchestration(trigger, serviceInputs)`
6. Stream progress to stdout as each controller completes (coloured, timestamped)
7. Print CodeFixAgent result: branch name + PR URL
8. Print ExecutiveCommunicationAgent result: summary of outputs written
9. Print final health summary from MetaController
10. Print: "✅ RESOLVED — All systems nominal. Duration: Xs"

**Output format:** coloured terminal output with emoji status icons, no external dependencies beyond the existing monorepo packages.

---

## Voice-Over Script (`services/epg-service/demo/voiceover.md`)

Timestamped narration for a presenter running the demo live. Covers:
- 0:00 — Introduction: what OpsAgents is
- 0:15 — The incident: what broke and why it matters
- 0:30 — Demo start: `npx tsx run-demo.ts`
- 0:45 — MonitoringController fires, detects the latency spike
- 1:00 — IncidentController: IssueIdentification → RCA
- 1:20 — CodeFixAgent creates the branch and PR
- 1:35 — InfrastructureController: security blocks the bad deploy, infra scales
- 1:50 — ExecutiveCommunicationAgent: exec team briefed across all channels
- 2:00 — Final state: all green, MetaController health summary
- 2:10 — Close: "This ran entirely autonomously. Zero human intervention."

---

## Tests

### Unit tests (new agents)
- `packages/agents/reliability/tests/code-fix.test.ts` — 6 tests
  - successful fix + PR creation (stub gh)
  - missing RCA result → escalate
  - gh CLI unavailable → escalate with reason
  - branch naming includes timestamp
  - patch_summary populated correctly
  - files_changed populated from RCA context

- `packages/agents/reliability/tests/executive-communication.test.ts` — 6 tests
  - all three output files created
  - slack payload has correct shape
  - email contains root cause section
  - dashboard JSON has required KPI keys
  - always returns success even if prior agents escalated
  - output dir created if not exists

### Integration test
- `packages/integration/tests/epg-e2e.test.ts` — 8 tests
  - Full pipeline with EPG stub trigger
  - CodeFixAgent appears in incident results
  - ExecutiveCommunicationAgent is always last
  - MetaController health summary shows all healthy
  - PR url present in results
  - Exec comms files written
  - SLA not breached (all under 30s)
  - Demo can be imported as a module (no side effects at import time)

---

## Git Tag

Upon completion: `git tag demo/epg-service` and push to origin.

---

## Acceptance Criteria

- [ ] `npx tsx services/epg-service/demo/run-demo.ts` runs without errors
- [ ] CodeFixAgent calls `gh pr create` (or stubs cleanly when gh unavailable)
- [ ] ExecutiveCommunicationAgent writes all 3 output files to `dist/exec-comms/`
- [ ] All new unit tests pass (12 new tests across 2 agents)
- [ ] EPG e2e integration test passes (8 tests)
- [ ] `demo/epg-service` git tag pushed to origin
- [ ] Voice-over script covers full 2-minute demo narrative
