# OpsAgents Platform — Design Specification

**Date:** 2026-06-03  
**Goal:** Autonomous lights-off operations platform built as a hierarchy of agents that can attach to any service. Each agent performs one atomic operation; controllers orchestrate them.

---

## 1. Problem Statement

Modern services require continuous deployment validation, performance monitoring, incident response, and infrastructure management. These operational concerns are repetitive, time-sensitive, and well-suited to automation — yet today they require significant human attention ("lights-on").

The OpsAgents Platform provides a composable, service-agnostic agent hierarchy that:
- Accepts **Code, Perf Logs, Monitors, and Machine Parameters** as inputs for any service
- Breaks every operation into **atomic agent tasks** that are independently testable
- Uses **controllers** to orchestrate those tasks into complete operational workflows
- Can be **attached to any service** via a lightweight SDK adapter

---

## 2. Architecture

### 2.1 Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│               SERVICE LAYER (Any Service)                │
│  Code │ Perf Logs │ Monitors │ Machine Params │ Incidents│
└────────────────────────┬────────────────────────────────┘
                         │ ServiceAdapter SDK
                         ▼
┌─────────────────────────────────────────────────────────┐
│             META-CONTROLLER (Supervisor)                 │
│  • Oversees all domain controllers                       │
│  • Detects malfunctioning agents                         │
│  • Escalates unresolved issues                           │
│  • Enforces SLAs across the ecosystem                    │
└────┬──────────────┬──────────────┬──────────────┬───────┘
     │              │              │              │
     ▼              ▼              ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│DEPLOYMENT│ │MONITORING│ │ INCIDENT │ │INFRASTRUCTURE│
│CONTROLLER│ │CONTROLLER│ │CONTROLLER│ │  CONTROLLER  │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘
     │             │             │              │
  Agents        Agents        Agents         Agents
```

### 2.2 Core Event Bus

All agents and controllers communicate through a typed internal event bus. No direct agent-to-agent calls. This ensures:
- Loose coupling between agents
- Full audit trail of every operation
- Replay of event sequences for debugging

### 2.3 Monorepo Structure (npm workspaces)

```
OpsAgents/
├── packages/
│   ├── core/                    # Interfaces, BaseAgent, EventBus, Registry
│   ├── sdk/                     # ServiceAdapter (attach to any service)
│   ├── controllers/             # DeploymentCtrl, MonitoringCtrl, IncidentCtrl, MetaCtrl
│   └── agents/
│       ├── deployment/          # 4 agents
│       ├── predictive/          # 3 agents
│       ├── monitoring/          # 3 agents
│       ├── reliability/         # 5 agents
│       └── infrastructure/      # 4 agents
├── services/
│   └── example-service/         # Reference integration
├── docs/superpowers/specs/
└── tests/
```

---

## 3. Core Interfaces

### 3.1 Input Types

Every agent declares which input types it consumes. The ServiceAdapter normalizes raw service data into these typed inputs before dispatch.

```typescript
type InputType = 'code' | 'perf-log' | 'monitor' | 'machine-params' | 'incident';

interface ServiceInputs {
  serviceId: string;
  timestamp: number;
  code?: {
    diff?: string;          // Git diff / commit
    commitSha?: string;
    files?: string[];       // Changed file paths
    coverage?: number;      // Test coverage %
  };
  perfLog?: {
    p50Latency: number;     // ms
    p99Latency: number;
    errorRate: number;      // 0–1
    throughput: number;     // req/s
    raw?: string[];         // Log lines
  };
  monitors?: {
    cpuPercent: number;
    memoryPercent: number;
    diskIoMbps: number;
    networkMbps: number;
    customMetrics?: Record<string, number>;
  };
  machineParams?: {
    instanceType: string;
    region: string;
    availabilityZone: string;
    nodeCount: number;
    tags?: Record<string, string>;
  };
  incident?: {
    alertId: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    source: string;
    timestamp: number;
  };
}
```

### 3.2 Agent Context and Result

```typescript
interface AgentContext {
  sessionId: string;           // Unique per orchestration run
  serviceId: string;
  triggeredBy: string;         // Controller ID or event name
  inputs: ServiceInputs;
  sharedState: Record<string, unknown>;  // Cross-agent shared data for this session
}

interface AgentResult {
  agentId: string;
  status: 'success' | 'failure' | 'skipped' | 'escalate';
  output: unknown;             // Agent-specific structured output
  recommendations?: string[];  // Human-readable next actions
  escalate?: boolean;          // Request MetaController escalation
  nextAgents?: string[];       // Suggest follow-up agent IDs
  durationMs: number;
}
```

### 3.3 IAgent — Base Agent Interface

```typescript
interface IAgent {
  readonly id: string;
  readonly name: string;
  readonly category: AgentCategory;
  readonly acceptedInputs: InputType[];
  readonly version: string;

  execute(context: AgentContext): Promise<AgentResult>;
  canHandle(inputs: ServiceInputs): boolean;  // Pre-flight check
  getStatus(): AgentStatus;
  healthCheck(): Promise<boolean>;
}

// All agents extend BaseAgent which handles logging, timing, and error wrapping
abstract class BaseAgent implements IAgent {
  abstract execute(context: AgentContext): Promise<AgentResult>;
  // canHandle has default: returns true if any acceptedInputs key is present
}
```

### 3.4 IController — Orchestrator Interface

```typescript
type Trigger =
  | { type: 'deployment'; artifact: string }
  | { type: 'alert'; severity: string }
  | { type: 'schedule'; cronExpression: string }
  | { type: 'manual'; reason: string };

interface IController {
  readonly id: string;
  readonly name: string;

  registerAgent(agent: IAgent): void;
  orchestrate(trigger: Trigger, inputs: ServiceInputs): Promise<OrchestrationResult>;
  getRegisteredAgents(): IAgent[];
}

interface OrchestrationResult {
  controllerId: string;
  sessionId: string;
  trigger: Trigger;
  agentResults: AgentResult[];
  overallStatus: 'success' | 'partial' | 'failure' | 'escalated';
  durationMs: number;
  summary: string;
}
```

### 3.5 ServiceAdapter SDK

```typescript
interface ServiceAdapterConfig {
  serviceId: string;
  controllers: IController[];          // Which controllers to attach
  inputNormalizer?: InputNormalizer;   // Custom normalizer for service-specific formats
  triggerRules?: TriggerRule[];        // Auto-trigger rules (e.g., on deploy, on alert)
}

class ServiceAdapter {
  constructor(config: ServiceAdapterConfig);
  
  // Fire-and-forget trigger
  trigger(triggerType: Trigger['type'], inputs: Partial<ServiceInputs>): Promise<void>;
  
  // Synchronous — await full orchestration result
  run(trigger: Trigger, inputs: ServiceInputs): Promise<OrchestrationResult[]>;
  
  // Attach to existing webhook/event stream
  listen(eventEmitter: EventEmitter): void;
}
```

---

## 4. Controllers

### 4.1 DeploymentController

**Trigger:** New deployment artifact detected  
**Agent sequence (ordered):**
1. CI/CD Governance Agent — validates build, compliance, security scan
2. Deployment Validation Agent — smoke tests, API checks, baseline comparison
3. Lag Indication Agent — replays historical traffic to catch slow-emerging bugs
4. Traffic Dial-Up Agent — gradual traffic ramp based on health signals
5. On-Demand Testing Agent — regression suite on demand

**Exit conditions:**
- All agents pass → Traffic reaches 100%, deployment sealed
- Any agent returns `escalate: true` → MetaController takes over, rollback triggered

### 4.2 MonitoringController

**Trigger:** Schedule (continuous) or alert event  
**Agent sequence (parallel where possible):**
1. Monitoring Agent — anomaly detection on latency/errors/resources
2. Health Check Agent — DB connectivity, certs, config consistency
3. Content Quality Agent — encoding, metadata, SLA compliance
4. Critical Metrics Agent — dynamic metric prioritization update
5. Traffic Prediction Agent — forecast next 24h demand

### 4.3 IncidentController

**Trigger:** Alert from MonitoringController or external PagerDuty  
**Agent sequence (ordered):**
1. Issue Identification Agent — correlate telemetry, identify blast radius
2. Root Cause Analysis Agent — correlate code changes, generate hypotheses
3. Spare Tier & Redundancy Validation Agent — verify failover paths are live
4. Escalation Agent — route to human or automated responder if unresolved
5. Reporting Agent — publish incident timeline and RCA to stakeholders

### 4.4 InfrastructureController

**Trigger:** Schedule or MetaController request  
**Agents (run independently):**
- Hardware Planner Agent — autoscaling and job scheduling
- Security & Compliance Agent — secret rotation, threat scanning
- Cost Optimization Agent — billing analysis and right-sizing
- Knowledge Graph Agent — update cross-agent incident graph

### 4.5 MetaController (Supervisor)

- Monitors health of all domain controllers and their agents
- Detects stuck/failing agents and can restart or substitute
- Enforces SLA timers — escalates to human if no resolution within threshold
- Receives `escalate: true` results from any agent
- Uses Escalation Agent and Reporting Agent directly

---

## 5. Agents Catalog

### Category: Deployment & Release

| Agent | Atomic Operation | Key Inputs | Key Outputs |
|---|---|---|---|
| CI/CD Governance | Validate release artifact | code, perf-log | approval/rejection, audit log |
| Deployment Validation | Post-deploy smoke test | code, monitors | validation report, rollback trigger |
| Lag Indication | Replay historical traffic | perf-log, code | risk score, anomaly report |
| On-Demand Testing | Run regression suite | code, monitors | pass/fail report, alert |

### Category: Predictive & Proactive

| Agent | Atomic Operation | Key Inputs | Key Outputs |
|---|---|---|---|
| Traffic Prediction | Forecast 24h demand | perf-log, monitors | demand forecast, scaling recommendation |
| Traffic Dial-Up | Gradual traffic ramp | monitors | ramp %, rollback signal |
| Critical Metrics | Update monitored metrics list | perf-log, monitors | updated metric definitions |

### Category: Monitoring & Quality

| Agent | Atomic Operation | Key Inputs | Key Outputs |
|---|---|---|---|
| Monitoring | Detect anomalies in telemetry | monitors, machine-params | anomaly alerts, scaling triggers |
| Content Quality Check | Validate content integrity/SLA | monitors, perf-log | QA report, corrective triggers |
| Health Check | Check infra health | machine-params, monitors | health report, remediation steps |

### Category: Reliability & Governance

| Agent | Atomic Operation | Key Inputs | Key Outputs |
|---|---|---|---|
| Spare Tier & Redundancy | Validate failover paths | machine-params | redundancy status, DR readiness |
| Issue Identification | Correlate telemetry to incidents | monitors, perf-log | incident summary, blast radius |
| Root Cause Analysis | Generate root cause hypotheses | incident, code, perf-log | RCA report, fix recommendations |
| Escalation & Meta-Supervisor | Route critical issues | incident | escalation actions, SLA enforcement |
| Reporting & Communication | Deliver operational summaries | all | dashboards, reports, stakeholder alerts |

### Category: Infrastructure & Optional

| Agent | Atomic Operation | Key Inputs | Key Outputs |
|---|---|---|---|
| Hardware Planner | Dynamic resource allocation | machine-params, monitors | scaling decisions, job schedule |
| Security & Compliance | Enforce policies, rotate secrets | code, machine-params | compliance report, secrets rotated |
| Cost Optimization | Analyze spend and right-size | machine-params, monitors | cost report, optimization actions |
| Knowledge Graph | Maintain cross-agent context | all outputs | updated knowledge graph, recommendations |

---

## 6. Checkpoint Roadmap

This is a long-running project. Work is organized into 5 checkpoints, each tagged in git.

### CP-1: Core Framework + SDK *(Foundation)*
**Deliverables:**
- `packages/core` — all interfaces, `BaseAgent`, `EventBus`, `AgentRegistry`
- `packages/sdk` — `ServiceAdapter` with input normalization
- `packages/controllers` — `BaseController` and `MetaController` scaffolding
- Project tooling: TypeScript, ESLint, Vitest, npm workspaces
- Unit tests for core interfaces
- `services/example-service` — minimal integration example

**Git tag:** `checkpoint/cp-1-core`

### CP-2: Deployment Agents *(CI/CD + Rollout)*
**Deliverables:**
- `DeploymentController` with full agent sequence
- 4 Deployment agents fully implemented with mocked LLM stubs
- 3 Predictive agents (Traffic Prediction, Traffic Dial-Up, Critical Metrics)
- Integration tests: deployment happy path + rollback path
- Example service integrated with DeploymentController

**Git tag:** `checkpoint/cp-2-deployment`

### CP-3: Monitoring + Quality Agents
**Deliverables:**
- `MonitoringController` with parallel agent scheduling
- 3 Monitoring agents implemented
- Continuous polling loop in ServiceAdapter
- Alert routing from MonitoringController to IncidentController
- Tests: anomaly detection, health check scenarios

**Git tag:** `checkpoint/cp-3-monitoring`

### CP-4: Reliability + Incident Response
**Deliverables:**
- `IncidentController` with full RCA + escalation sequence
- 5 Reliability agents implemented
- RCA Agent with hypothesis generation (LLM-backed)
- Escalation hooks (email/Slack/PagerDuty webhook stub)
- Reporting Agent outputting structured JSON + Markdown reports
- Tests: incident end-to-end from alert → RCA → report

**Git tag:** `checkpoint/cp-4-incident`

### CP-5: Infrastructure Agents + Full System
**Deliverables:**
- `InfrastructureController`
- 4 Infrastructure agents implemented
- Knowledge Graph Agent with in-memory graph (neo4j adapter stub)
- `MetaController` fully wired: monitors all controllers, enforces SLAs
- End-to-end integration test: multi-service lights-off scenario
- Full documentation and `README.md`

**Git tag:** `checkpoint/cp-5-complete`

---

## 7. Technology Stack

| Concern | Choice | Rationale |
|---|---|---|
| Language | TypeScript 5.x | Type safety for agent interfaces is critical |
| Runtime | Node.js 20 LTS | Stable, excellent async support |
| Package Manager | npm workspaces | Monorepo without heavyweight tooling |
| Testing | Vitest | Fast, TypeScript-native |
| Linting | ESLint + Prettier | Standard TS stack |
| LLM Integration | Abstracted behind `LLMClient` interface | Swap OpenAI / Azure / local models |
| Event Bus | In-process EventEmitter (Phase 1), Redis adapter stub (Phase 2) | Start simple, scale later |
| Knowledge Graph | In-memory Map (Phase 1), Neo4j adapter stub (Phase 5) | Progressive enhancement |
| Observability | OpenTelemetry stubs | Plug into any existing OTEL setup |

---

## 8. Error Handling & Resilience

- Every agent wraps execution in try/catch; failures produce `status: 'failure'` results, never throw to controller
- Controllers use **circuit breaker pattern**: if an agent fails 3× consecutively, skip it and log
- MetaController has a **watchdog timer** per domain controller; if no heartbeat for 5 minutes, restarts it
- All agent results are persisted to an **audit log** (append-only JSON file per session)
- Escalation is a first-class result status, not an exception

---

## 9. Testing Strategy

- **Unit tests**: Each agent has tests for happy path, failure path, and `canHandle()` rejection
- **Controller tests**: Mock agents injected via `registerAgent()`, verify orchestration sequence and rollback logic
- **Integration tests**: Real agents wired to a mock `ServiceInputs` fixture per checkpoint
- **End-to-end**: `example-service` runs a full scenario, assertions on `OrchestrationResult`

---

## 10. Open Questions (Deferred to Implementation)

- LLM provider for RCA Agent — OpenAI vs. Azure OpenAI vs. local (LM Studio)
- Persistent event store — append-only JSON file vs. SQLite for Phase 1
- Knowledge Graph persistence — in-memory acceptable through CP-4
- Authentication for multi-service deployments (service tokens)
- Whether `MetaController` should run as a separate process or in-process

---

*Spec written by GitHub Copilot CLI powered by Claude Sonnet 4.6. Reviewed and approved by project owner before implementation.*
