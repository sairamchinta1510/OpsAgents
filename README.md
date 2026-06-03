# OpsAgents

**Autonomous lights-off operations for modern services**

OpsAgents is an autonomous platform for incident management, deployment orchestration, infrastructure optimization, and continuous monitoring — all without human intervention. Multiple specialized agents are orchestrated by domain controllers (Incident, Deployment, Monitoring, Infrastructure) and coordinated by a MetaController, enabling fully lights-off operations.

## What is OpsAgents?

OpsAgents enables services to self-heal, auto-scale, and optimize in real time by orchestrating a fleet of specialized agents that handle incidents, deployments, monitoring, and infrastructure management. Each agent focuses on a specific domain, and the MetaController ensures they work together under strict SLAs. The platform is designed for zero human interaction in the common case, with escalation paths for complex scenarios.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Incident Trigger                         │
│  (Alert | Deployment | Schedule | Manual)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   MetaController (30s SLA)  │
         │   Orchestrates in Parallel  │
         └──────────┬──────────────────┘
                    │
        ┌───────────┼───────────┬──────────────┐
        │           │           │              │
        ▼           ▼           ▼              ▼
    ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐
    │Incident│ │Deploym │ │Monitor │ │Infrastructure
    │Ctrller │ │ ent    │ │Ctrller │ │ Ctrller
    │        │ │Ctrller│ │        │ │
    └────────┘ └────────┘ └────────┘ └──────────────┘
        │
        └─ Pipeline (Sequential):
           1. IssueIdentificationAgent
           2. RootCauseAnalysisAgent
           3. CodeFixAgent                    ← NEW (CP-5)
           4. SpareTierRedundancyAgent
           5. EscalationAgent
           6. ReportingAgent
           7. ExecutiveCommunicationAgent     ← NEW (CP-5, always-run)
```

## Agent Catalog

| Agent Name | Package | Description | Always Runs |
|---|---|---|---|
| **IssueIdentificationAgent** | `@opsagents/agents-reliability` | Parses incident alerts to identify service health issues | — |
| **RootCauseAnalysisAgent** | `@opsagents/agents-reliability` | Correlates metrics, logs, and traces to identify root cause | — |
| **CodeFixAgent** | `@opsagents/agents-reliability` | Applies targeted patches and creates GitHub PRs for code fixes | — |
| **SpareTierRedundancyAgent** | `@opsagents/agents-reliability` | Manages redundancy tier failover and capacity planning | — |
| **EscalationAgent** | `@opsagents/agents-reliability` | Escalates to on-call engineers when incidents exceed autonomous resolution | — |
| **ReportingAgent** | `@opsagents/agents-reliability` | Generates incident reports and metrics summaries | ✓ (always runs) |
| **ExecutiveCommunicationAgent** | `@opsagents/agents-reliability` | Briefs executive team across Slack, Email, and Dashboard | ✓ (always runs) |
| **HealthCheckAgent** | `@opsagents/agents-monitoring` | Continuous service health probes and endpoint monitoring | — |
| **MonitoringAgent** | `@opsagents/agents-monitoring` | Detects performance anomalies and metric spikes | — |
| **ContentQualityAgent** | `@opsagents/agents-monitoring` | Validates data quality and content integrity | — |
| **DeploymentValidationAgent** | `@opsagents/agents-deployment` | Validates deployment artifacts and pre-deployment health checks | — |
| **OnDemandTestingAgent** | `@opsagents/agents-deployment` | Runs integration and regression tests triggered by deployments | — |
| **LagIndicationAgent** | `@opsagents/agents-deployment` | Detects deployment lag and rollback conditions | — |
| **CiCdGovernanceAgent** | `@opsagents/agents-deployment` | Enforces CI/CD policy and audit compliance | — |
| **CostOptimizationAgent** | `@opsagents/agents-infrastructure` | Right-sizes instances and optimizes cloud spend | — |
| **HardwarePlannerAgent** | `@opsagents/agents-infrastructure` | Forecasts capacity and plans hardware expansion | — |
| **SecurityComplianceAgent** | `@opsagents/agents-infrastructure` | Scans for security violations and enforces compliance | — |
| **KnowledgeGraphAgent** | `@opsagents/agents-infrastructure` | Maintains infrastructure topology and dependency graph | — |

## Controllers

### MetaController

The orchestration hub. Runs all domain controllers **concurrently** with per-controller SLA enforcement (default 30s). Monitors health of each domain, tracks SLA breaches, publishes events, and coordinates escalations.

### IncidentController

**Pipeline:** IssueIdentificationAgent → RootCauseAnalysisAgent → CodeFixAgent → SpareTierRedundancyAgent → EscalationAgent → ReportingAgent → ExecutiveCommunicationAgent

Runs sequentially. Incident flow: detects issue → identifies root cause → applies fixes → scales redundancy → escalates if needed → reports → briefs execs. `ReportingAgent` and `ExecutiveCommunicationAgent` always run, even if an earlier agent escalates.

### DeploymentController

Orchestrates deployment workflow: validates artifact → runs tests → enforces governance → checks lag conditions → approves/rejects.

### MonitoringController

Continuous background monitoring: health probes, anomaly detection, content quality checks, alerts on threshold violations.

### InfrastructureController

Infrastructure optimization and planning: cost analysis, capacity forecasting, security scanning, topology management.

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- git

### Installation

```bash
git clone https://github.com/acme/opsagents.git
cd opsagents
npm install
```

### Build & Test

```bash
npm run build
npm run test
```

### Run EPG Demo

The EPG Service demo showcases OpsAgents handling a production incident end-to-end: bad deployment, incident detection, root cause analysis, code fix, infrastructure scaling, and executive briefing — all autonomous.

```bash
npm run demo --workspace=services/epg-service
```

Expected output: incident detection → agent pipeline → PR created → exec briefed → resolution confirmed in ~2 minutes.

## Checkpoints

| CP | Description | Tag |
|---|---|---|
| CP-1 | Core interfaces and BaseAgent abstraction | `core/v1.0` |
| CP-2 | Deployment agents (validation, testing, governance) | `agents/deployment/v1.0` |
| CP-3 | Monitoring agents (health, anomalies, content quality) | `agents/monitoring/v1.0` |
| CP-4 | Incident/reliability agents (identify, RCA, redundancy) | `agents/reliability/v1.0` |
| CP-5 | Infrastructure agents + CodeFixAgent + ExecutiveCommunicationAgent | `demo/epg-service` |

## EPG Demo

The **EPG (Electronic Program Guide) Service Demo** is a fully runnable end-to-end demonstration of OpsAgents in action.

**Scenario:** A faulty EPG data pipeline (`v2.3.1`) is deployed with two bugs:
1. A hardcoded API key (security violation)
2. A null-pointer crash when `programme.end_time` is missing

**Effect:** BBC One shows a 2-hour schedule gap (21:00–23:00). API latency spikes from 120ms to 4,200ms. Error rates jump 12×.

**Recovery:** MetaController orchestrates all four controllers in parallel. Within 90 seconds:
- IncidentController identifies the issue → analyzes root cause → creates a fix → opens a PR
- InfrastructureController scales capacity and blocks the security violation
- MonitoringController validates recovery
- ExecutiveCommunicationAgent briefs the executive team across Slack, Email, and Dashboard

**Run the demo:**

```bash
npm run demo --workspace=services/epg-service
```

Expected runtime: ~2 minutes. All output is logged to stdout with coloured, timestamped progress. No external infrastructure required — everything runs locally.

## Directory Structure

```
OpsAgents/
├── packages/
│   ├── core/                 # BaseAgent, BaseController, interfaces
│   ├── agents/
│   │   ├── reliability/      # Incident response agents
│   │   ├── deployment/       # Deployment orchestration agents
│   │   ├── monitoring/       # Health & anomaly detection agents
│   │   ├── infrastructure/   # Infrastructure optimization agents
│   │   └── predictive/       # Forecasting agents
│   ├── controllers/
│   │   ├── incident/         # IncidentController
│   │   ├── deployment/       # DeploymentController
│   │   ├── monitoring/       # MonitoringController
│   │   ├── infrastructure/   # InfrastructureController
│   │   └── src/meta-controller.ts  # MetaController
│   ├── sdk/                  # Client SDK
│   ├── runtime/              # Execution runtime
│   └── integration/          # Integration tests
├── services/
│   └── epg-service/          # EPG demo service
├── docs/
│   └── superpowers/specs/    # Design specifications
└── README.md
```

## Development

### Project Structure

- **`packages/core`** — Core interfaces, BaseAgent, BaseController, EventBus, AgentRegistry
- **`packages/agents/*`** — Domain-specific agents (reliability, deployment, monitoring, infrastructure)
- **`packages/controllers/*`** — Domain controllers + MetaController
- **`services/epg-service`** — Runnable demo service with stub incident data

### Running Tests

```bash
npm run test                          # All tests
npm run test --workspace=@opsagents/core     # Single workspace
npm run test:watch                    # Watch mode
```

### Linting & Formatting

```bash
npm run lint                          # Check code style
npm run lint:fix                      # Auto-fix style issues
npm run format                        # Format with Prettier
```

## License

MIT
