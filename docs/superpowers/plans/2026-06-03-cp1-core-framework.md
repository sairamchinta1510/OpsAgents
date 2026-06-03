# CP-1: Core Framework + SDK — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the OpsAgents monorepo with TypeScript npm workspaces, implement core interfaces (`IAgent`, `IController`, `ServiceInputs`, `AgentContext`, `AgentResult`), `BaseAgent`, `EventBus`, `AgentRegistry`, `BaseController`, `ServiceAdapter` SDK, and a working example service integration.

**Architecture:** npm workspaces monorepo with three packages: `@opsagents/core` (interfaces + base classes + event bus), `@opsagents/sdk` (ServiceAdapter that attaches agents to any service), and `@opsagents/controllers` (BaseController + MetaController scaffold). All inter-package communication flows through the typed `EventBus`. Each package is independently buildable and testable.

**Tech Stack:** TypeScript 5.x, Node.js 20 LTS, npm workspaces, Vitest 1.x, ESLint 9.x + Prettier

---

## File Map

```
OpsAgents/
├── package.json                              # root workspace config
├── tsconfig.base.json                        # shared TS compiler options
├── .eslintrc.cjs                             # ESLint config (CommonJS, works with ESM)
├── .prettierrc                               # Prettier config
│
├── packages/
│   │
│   ├── core/                                 # @opsagents/core
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types.ts                      # enums and primitive type aliases
│   │       ├── interfaces.ts                 # IAgent, IController, ServiceInputs, AgentContext, AgentResult, OrchestrationResult, Trigger
│   │       ├── base-agent.ts                 # abstract BaseAgent implements IAgent
│   │       ├── event-bus.ts                  # EventBus wrapping Node EventEmitter
│   │       ├── agent-registry.ts             # AgentRegistry (register / lookup / list)
│   │       ├── base-controller.ts            # abstract BaseController implements IController
│   │       └── index.ts                      # re-exports everything
│   │   └── tests/
│   │       ├── base-agent.test.ts
│   │       ├── event-bus.test.ts
│   │       ├── agent-registry.test.ts
│   │       └── base-controller.test.ts
│   │
│   ├── sdk/                                  # @opsagents/sdk
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── input-normalizer.ts           # DefaultInputNormalizer (pass-through + validation)
│   │       ├── service-adapter.ts            # ServiceAdapter class
│   │       └── index.ts
│   │   └── tests/
│   │       ├── input-normalizer.test.ts
│   │       └── service-adapter.test.ts
│   │
│   └── controllers/                          # @opsagents/controllers
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── meta-controller.ts            # MetaController (CP-1 scaffold)
│           └── index.ts
│       └── tests/
│           └── meta-controller.test.ts
│
└── services/
    └── example-service/                      # shows how to attach OpsAgents to a service
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── echo-agent.ts                 # minimal IAgent implementation
            └── index.ts                      # wires adapter + triggers a run
        └── tests/
            └── integration.test.ts           # CP-1 end-to-end: adapter runs agent, result captured
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.eslintrc.cjs`
- Create: `.prettierrc`
- Create: `packages/core/package.json`
- Create: `packages/sdk/package.json`
- Create: `packages/controllers/package.json`
- Create: `services/example-service/package.json`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "opsagents",
  "private": true,
  "workspaces": [
    "packages/*",
    "services/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "lint": "eslint packages services --ext .ts"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

- [ ] **Step 3: Create `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2022: true },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
  },
};
```

- [ ] **Step 4: Create `.prettierrc`**

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 5: Create `packages/core/package.json`**

```json
{
  "name": "@opsagents/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "*",
    "vitest": "*"
  }
}
```

- [ ] **Step 6: Create `packages/sdk/package.json`**

```json
{
  "name": "@opsagents/sdk",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@opsagents/core": "*"
  },
  "devDependencies": {
    "typescript": "*",
    "vitest": "*"
  }
}
```

- [ ] **Step 7: Create `packages/controllers/package.json`**

```json
{
  "name": "@opsagents/controllers",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@opsagents/core": "*"
  },
  "devDependencies": {
    "typescript": "*",
    "vitest": "*"
  }
}
```

- [ ] **Step 8: Create `services/example-service/package.json`**

```json
{
  "name": "example-service",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node dist/index.js",
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@opsagents/core": "*",
    "@opsagents/sdk": "*",
    "@opsagents/controllers": "*"
  },
  "devDependencies": {
    "typescript": "*",
    "vitest": "*"
  }
}
```

- [ ] **Step 9: Create per-package `tsconfig.json` files**

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src", "tests"]
}
```

Copy identical content to `packages/sdk/tsconfig.json`, `packages/controllers/tsconfig.json`, and `services/example-service/tsconfig.json` (all three files are identical to core's tsconfig.json above).

- [ ] **Step 10: Install all dependencies**

```bash
cd C:\Users\schinta\OpsAgents
npm install
```

Expected: `node_modules/` populated, workspaces symlinked. No errors.

- [ ] **Step 11: Commit scaffolding**

```bash
git add .
git commit -m "chore: scaffold monorepo with npm workspaces and TypeScript"
```

---

## Task 2: Core Types

**Files:**
- Create: `packages/core/src/types.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  AgentCategory,
  AgentStatus,
  InputType,
} from '../src/types.js';

describe('AgentCategory', () => {
  it('has all five categories', () => {
    expect(AgentCategory.DEPLOYMENT).toBe('deployment');
    expect(AgentCategory.PREDICTIVE).toBe('predictive');
    expect(AgentCategory.MONITORING).toBe('monitoring');
    expect(AgentCategory.RELIABILITY).toBe('reliability');
    expect(AgentCategory.INFRASTRUCTURE).toBe('infrastructure');
  });
});

describe('AgentStatus', () => {
  it('has idle, running, error statuses', () => {
    expect(AgentStatus.IDLE).toBe('idle');
    expect(AgentStatus.RUNNING).toBe('running');
    expect(AgentStatus.ERROR).toBe('error');
  });
});

describe('InputType', () => {
  it('has all five input types', () => {
    const types: InputType[] = ['code', 'perf-log', 'monitor', 'machine-params', 'incident'];
    expect(types).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run tests/types.test.ts
```

Expected: FAIL — `Cannot find module '../src/types.js'`

- [ ] **Step 3: Implement `packages/core/src/types.ts`**

```typescript
export enum AgentCategory {
  DEPLOYMENT = 'deployment',
  PREDICTIVE = 'predictive',
  MONITORING = 'monitoring',
  RELIABILITY = 'reliability',
  INFRASTRUCTURE = 'infrastructure',
}

export enum AgentStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  ERROR = 'error',
  DISABLED = 'disabled',
}

export type InputType = 'code' | 'perf-log' | 'monitor' | 'machine-params' | 'incident';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/core && npx vitest run tests/types.test.ts
```

Expected: PASS — 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/types.ts packages/core/tests/types.test.ts
git commit -m "feat(core): add AgentCategory, AgentStatus, InputType enums"
```

---

## Task 3: Core Interfaces

**Files:**
- Create: `packages/core/src/interfaces.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/interfaces.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import type {
  ServiceInputs,
  AgentContext,
  AgentResult,
  OrchestrationResult,
  Trigger,
  IAgent,
  IController,
} from '../src/interfaces.js';
import { AgentCategory, AgentStatus, InputType } from '../src/types.js';

describe('ServiceInputs shape', () => {
  it('accepts a minimal service input with only serviceId and timestamp', () => {
    const input: ServiceInputs = {
      serviceId: 'my-service',
      timestamp: Date.now(),
    };
    expect(input.serviceId).toBe('my-service');
  });

  it('accepts full input with all optional fields', () => {
    const input: ServiceInputs = {
      serviceId: 'svc',
      timestamp: 1000,
      code: { diff: 'diff --git ...', commitSha: 'abc123', files: ['src/app.ts'], coverage: 85 },
      perfLog: { p50Latency: 50, p99Latency: 200, errorRate: 0.01, throughput: 1000 },
      monitors: { cpuPercent: 40, memoryPercent: 60, diskIoMbps: 10, networkMbps: 100 },
      machineParams: { instanceType: 't3.medium', region: 'us-east-1', availabilityZone: 'us-east-1a', nodeCount: 3 },
      incident: { alertId: 'alert-1', severity: 'high', message: 'p99 spike', source: 'cloudwatch', timestamp: 1000 },
    };
    expect(input.perfLog?.p99Latency).toBe(200);
    expect(input.incident?.severity).toBe('high');
  });
});

describe('AgentResult shape', () => {
  it('requires agentId, status, output, durationMs', () => {
    const result: AgentResult = {
      agentId: 'test-agent',
      status: 'success',
      output: { verified: true },
      durationMs: 100,
    };
    expect(result.status).toBe('success');
  });
});

describe('Trigger union', () => {
  it('covers all four trigger types', () => {
    const t1: Trigger = { type: 'deployment', artifact: 'my-service:v1.2.3' };
    const t2: Trigger = { type: 'alert', severity: 'critical' };
    const t3: Trigger = { type: 'schedule', cronExpression: '0 * * * *' };
    const t4: Trigger = { type: 'manual', reason: 'hotfix test' };
    expect([t1.type, t2.type, t3.type, t4.type]).toEqual(['deployment', 'alert', 'schedule', 'manual']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run tests/interfaces.test.ts
```

Expected: FAIL — `Cannot find module '../src/interfaces.js'`

- [ ] **Step 3: Implement `packages/core/src/interfaces.ts`**

```typescript
import type { AgentCategory, AgentStatus, InputType } from './types.js';

// ── Inputs ──────────────────────────────────────────────────────────────────

export interface CodeInput {
  diff?: string;
  commitSha?: string;
  files?: string[];
  coverage?: number;
}

export interface PerfLogInput {
  p50Latency: number;
  p99Latency: number;
  errorRate: number;
  throughput: number;
  raw?: string[];
}

export interface MonitorInput {
  cpuPercent: number;
  memoryPercent: number;
  diskIoMbps: number;
  networkMbps: number;
  customMetrics?: Record<string, number>;
}

export interface MachineParamsInput {
  instanceType: string;
  region: string;
  availabilityZone: string;
  nodeCount: number;
  tags?: Record<string, string>;
}

export interface IncidentInput {
  alertId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  source: string;
  timestamp: number;
}

export interface ServiceInputs {
  serviceId: string;
  timestamp: number;
  code?: CodeInput;
  perfLog?: PerfLogInput;
  monitors?: MonitorInput;
  machineParams?: MachineParamsInput;
  incident?: IncidentInput;
}

// ── Agent Context & Result ───────────────────────────────────────────────────

export interface AgentContext {
  sessionId: string;
  serviceId: string;
  triggeredBy: string;
  inputs: ServiceInputs;
  sharedState: Record<string, unknown>;
}

export interface AgentResult {
  agentId: string;
  status: 'success' | 'failure' | 'skipped' | 'escalate';
  output: unknown;
  recommendations?: string[];
  escalate?: boolean;
  nextAgents?: string[];
  durationMs: number;
}

// ── Trigger Union ────────────────────────────────────────────────────────────

export type Trigger =
  | { type: 'deployment'; artifact: string }
  | { type: 'alert'; severity: string }
  | { type: 'schedule'; cronExpression: string }
  | { type: 'manual'; reason: string };

// ── Orchestration ────────────────────────────────────────────────────────────

export interface OrchestrationResult {
  controllerId: string;
  sessionId: string;
  trigger: Trigger;
  agentResults: AgentResult[];
  overallStatus: 'success' | 'partial' | 'failure' | 'escalated';
  durationMs: number;
  summary: string;
}

// ── Agent Interface ──────────────────────────────────────────────────────────

export interface IAgent {
  readonly id: string;
  readonly name: string;
  readonly category: AgentCategory;
  readonly acceptedInputs: InputType[];
  readonly version: string;

  execute(context: AgentContext): Promise<AgentResult>;
  canHandle(inputs: ServiceInputs): boolean;
  getStatus(): AgentStatus;
  healthCheck(): Promise<boolean>;
}

// ── Controller Interface ─────────────────────────────────────────────────────

export interface IController {
  readonly id: string;
  readonly name: string;

  registerAgent(agent: IAgent): void;
  orchestrate(trigger: Trigger, inputs: ServiceInputs): Promise<OrchestrationResult>;
  getRegisteredAgents(): IAgent[];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/core && npx vitest run tests/interfaces.test.ts
```

Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/interfaces.ts packages/core/tests/interfaces.test.ts
git commit -m "feat(core): add all core interfaces (ServiceInputs, IAgent, IController, Trigger)"
```

---

## Task 4: BaseAgent

**Files:**
- Create: `packages/core/src/base-agent.ts`
- Create: `packages/core/tests/base-agent.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/base-agent.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { BaseAgent } from '../src/base-agent.js';
import type { AgentContext, AgentResult, ServiceInputs } from '../src/interfaces.js';
import { AgentCategory, AgentStatus } from '../src/types.js';

// Minimal concrete agent for testing
class EchoAgent extends BaseAgent {
  readonly id = 'echo';
  readonly name = 'Echo Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    return {
      agentId: this.id,
      status: 'success',
      output: { echoed: context.inputs.serviceId },
      durationMs: 0,
    };
  }
}

// Agent that throws to test error wrapping
class BrokenAgent extends BaseAgent {
  readonly id = 'broken';
  readonly name = 'Broken Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';

  protected async run(_context: AgentContext): Promise<AgentResult> {
    throw new Error('internal failure');
  }
}

const makeContext = (overrides: Partial<AgentContext> = {}): AgentContext => ({
  sessionId: 'sess-1',
  serviceId: 'my-service',
  triggeredBy: 'test',
  inputs: { serviceId: 'my-service', timestamp: 1000 },
  sharedState: {},
  ...overrides,
});

describe('BaseAgent.execute', () => {
  it('returns success result from run()', async () => {
    const agent = new EchoAgent();
    const result = await agent.execute(makeContext());
    expect(result.status).toBe('success');
    expect((result.output as { echoed: string }).echoed).toBe('my-service');
  });

  it('wraps thrown errors into failure result', async () => {
    const agent = new BrokenAgent();
    const result = await agent.execute(makeContext());
    expect(result.status).toBe('failure');
    expect(result.agentId).toBe('broken');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('sets status to RUNNING during execution, IDLE after', async () => {
    const agent = new EchoAgent();
    expect(agent.getStatus()).toBe(AgentStatus.IDLE);
    await agent.execute(makeContext());
    expect(agent.getStatus()).toBe(AgentStatus.IDLE);
  });
});

describe('BaseAgent.canHandle', () => {
  it('returns true if any accepted input key is present in ServiceInputs', () => {
    const agent = new EchoAgent();
    const inputs: ServiceInputs = {
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 10, memoryPercent: 20, diskIoMbps: 1, networkMbps: 5 },
    };
    expect(agent.canHandle(inputs)).toBe(true);
  });

  it('returns false if no accepted input key is present', () => {
    const agent = new EchoAgent(); // only accepts 'monitor'
    const inputs: ServiceInputs = { serviceId: 'svc', timestamp: 1000, code: { diff: 'x' } };
    expect(agent.canHandle(inputs)).toBe(false);
  });
});

describe('BaseAgent.healthCheck', () => {
  it('returns true by default', async () => {
    const agent = new EchoAgent();
    expect(await agent.healthCheck()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run tests/base-agent.test.ts
```

Expected: FAIL — `Cannot find module '../src/base-agent.js'`

- [ ] **Step 3: Implement `packages/core/src/base-agent.ts`**

```typescript
import type { AgentContext, AgentResult, IAgent, ServiceInputs } from './interfaces.js';
import type { AgentCategory, InputType } from './types.js';
import { AgentStatus } from './types.js';

// INPUT_TYPE_TO_KEY maps InputType enum values to the ServiceInputs property key.
const INPUT_TYPE_TO_KEY: Record<InputType, keyof ServiceInputs> = {
  'code': 'code',
  'perf-log': 'perfLog',
  'monitor': 'monitors',
  'machine-params': 'machineParams',
  'incident': 'incident',
};

export abstract class BaseAgent implements IAgent {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly category: AgentCategory;
  abstract readonly acceptedInputs: InputType[];
  abstract readonly version: string;

  private _status: AgentStatus = AgentStatus.IDLE;

  // Subclasses implement this instead of execute()
  protected abstract run(context: AgentContext): Promise<AgentResult>;

  async execute(context: AgentContext): Promise<AgentResult> {
    this._status = AgentStatus.RUNNING;
    const start = Date.now();
    try {
      const result = await this.run(context);
      this._status = AgentStatus.IDLE;
      return { ...result, durationMs: Date.now() - start };
    } catch (err) {
      this._status = AgentStatus.ERROR;
      return {
        agentId: this.id,
        status: 'failure',
        output: { error: err instanceof Error ? err.message : String(err) },
        durationMs: Date.now() - start,
      };
    } finally {
      if (this._status === AgentStatus.RUNNING) {
        this._status = AgentStatus.IDLE;
      }
    }
  }

  canHandle(inputs: ServiceInputs): boolean {
    return this.acceptedInputs.some((type) => inputs[INPUT_TYPE_TO_KEY[type]] !== undefined);
  }

  getStatus(): AgentStatus {
    return this._status;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/core && npx vitest run tests/base-agent.test.ts
```

Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/base-agent.ts packages/core/tests/base-agent.test.ts
git commit -m "feat(core): add BaseAgent with error wrapping, canHandle, and status tracking"
```

---

## Task 5: EventBus

**Files:**
- Create: `packages/core/src/event-bus.ts`
- Create: `packages/core/tests/event-bus.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/event-bus.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/event-bus.js';
import type { AgentResult } from '../src/interfaces.js';

describe('EventBus', () => {
  it('delivers published events to subscribers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.subscribe('agent:result', handler);

    const result: AgentResult = {
      agentId: 'test', status: 'success', output: {}, durationMs: 10,
    };
    bus.publish('agent:result', result);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(result);
  });

  it('does not deliver events to unsubscribed handlers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe('agent:result', handler);
    unsubscribe();

    bus.publish('agent:result', { agentId: 'x', status: 'success', output: {}, durationMs: 1 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers for the same event', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.subscribe('agent:result', h1);
    bus.subscribe('agent:result', h2);

    bus.publish('agent:result', { agentId: 'x', status: 'success', output: {}, durationMs: 1 });

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('does not deliver events on different channels', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.subscribe('agent:result', handler);

    bus.publish('controller:done', { anything: true });

    expect(handler).not.toHaveBeenCalled();
  });

  it('once() fires exactly once then unsubscribes', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.once('agent:result', handler);

    bus.publish('agent:result', { agentId: 'a', status: 'success', output: {}, durationMs: 1 });
    bus.publish('agent:result', { agentId: 'b', status: 'success', output: {}, durationMs: 1 });

    expect(handler).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run tests/event-bus.test.ts
```

Expected: FAIL — `Cannot find module '../src/event-bus.js'`

- [ ] **Step 3: Implement `packages/core/src/event-bus.ts`**

```typescript
type Handler<T = unknown> = (payload: T) => void;

export class EventBus {
  private readonly listeners = new Map<string, Set<Handler>>();

  subscribe<T>(event: string, handler: Handler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as Handler);
    return () => this.listeners.get(event)?.delete(handler as Handler);
  }

  once<T>(event: string, handler: Handler<T>): void {
    const wrapper: Handler<T> = (payload) => {
      handler(payload);
      this.listeners.get(event)?.delete(wrapper as Handler);
    };
    this.subscribe(event, wrapper);
  }

  publish<T>(event: string, payload: T): void {
    this.listeners.get(event)?.forEach((h) => h(payload));
  }

  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/core && npx vitest run tests/event-bus.test.ts
```

Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/event-bus.ts packages/core/tests/event-bus.test.ts
git commit -m "feat(core): add EventBus with subscribe, publish, once, and unsubscribe"
```

---

## Task 6: AgentRegistry

**Files:**
- Create: `packages/core/src/agent-registry.ts`
- Create: `packages/core/tests/agent-registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/agent-registry.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { AgentRegistry } from '../src/agent-registry.js';
import { BaseAgent } from '../src/base-agent.js';
import type { AgentContext, AgentResult } from '../src/interfaces.js';
import { AgentCategory } from '../src/types.js';

class StubAgent extends BaseAgent {
  constructor(public readonly id: string, public readonly category: AgentCategory) {
    super();
  }
  readonly name = 'Stub';
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';
  protected async run(ctx: AgentContext): Promise<AgentResult> {
    return { agentId: this.id, status: 'success', output: {}, durationMs: 0 };
  }
}

describe('AgentRegistry', () => {
  it('registers and retrieves an agent by id', () => {
    const registry = new AgentRegistry();
    const agent = new StubAgent('mon-1', AgentCategory.MONITORING);
    registry.register(agent);
    expect(registry.get('mon-1')).toBe(agent);
  });

  it('throws when registering duplicate id', () => {
    const registry = new AgentRegistry();
    registry.register(new StubAgent('dup', AgentCategory.MONITORING));
    expect(() => registry.register(new StubAgent('dup', AgentCategory.MONITORING))).toThrow(
      'Agent with id "dup" is already registered',
    );
  });

  it('lists all agents', () => {
    const registry = new AgentRegistry();
    registry.register(new StubAgent('a1', AgentCategory.DEPLOYMENT));
    registry.register(new StubAgent('a2', AgentCategory.MONITORING));
    expect(registry.list()).toHaveLength(2);
  });

  it('lists agents filtered by category', () => {
    const registry = new AgentRegistry();
    registry.register(new StubAgent('d1', AgentCategory.DEPLOYMENT));
    registry.register(new StubAgent('m1', AgentCategory.MONITORING));
    registry.register(new StubAgent('m2', AgentCategory.MONITORING));
    const monitoring = registry.listByCategory(AgentCategory.MONITORING);
    expect(monitoring).toHaveLength(2);
    expect(monitoring.every((a) => a.category === AgentCategory.MONITORING)).toBe(true);
  });

  it('returns undefined for unknown id', () => {
    const registry = new AgentRegistry();
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('unregisters an agent by id', () => {
    const registry = new AgentRegistry();
    registry.register(new StubAgent('to-remove', AgentCategory.MONITORING));
    registry.unregister('to-remove');
    expect(registry.get('to-remove')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run tests/agent-registry.test.ts
```

Expected: FAIL — `Cannot find module '../src/agent-registry.js'`

- [ ] **Step 3: Implement `packages/core/src/agent-registry.ts`**

```typescript
import type { IAgent } from './interfaces.js';
import type { AgentCategory } from './types.js';

export class AgentRegistry {
  private readonly agents = new Map<string, IAgent>();

  register(agent: IAgent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent with id "${agent.id}" is already registered`);
    }
    this.agents.set(agent.id, agent);
  }

  unregister(id: string): void {
    this.agents.delete(id);
  }

  get(id: string): IAgent | undefined {
    return this.agents.get(id);
  }

  list(): IAgent[] {
    return [...this.agents.values()];
  }

  listByCategory(category: AgentCategory): IAgent[] {
    return this.list().filter((a) => a.category === category);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/core && npx vitest run tests/agent-registry.test.ts
```

Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent-registry.ts packages/core/tests/agent-registry.test.ts
git commit -m "feat(core): add AgentRegistry with register, unregister, list, listByCategory"
```

---

## Task 7: BaseController

**Files:**
- Create: `packages/core/src/base-controller.ts`
- Create: `packages/core/tests/base-controller.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/base-controller.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { BaseController } from '../src/base-controller.js';
import { BaseAgent } from '../src/base-agent.js';
import type { AgentContext, AgentResult, OrchestrationResult, ServiceInputs, Trigger } from '../src/interfaces.js';
import { AgentCategory } from '../src/types.js';

class PassAgent extends BaseAgent {
  readonly id = 'pass-agent';
  readonly name = 'Pass Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';
  protected async run(ctx: AgentContext): Promise<AgentResult> {
    return { agentId: this.id, status: 'success', output: { ok: true }, durationMs: 5 };
  }
}

class FailAgent extends BaseAgent {
  readonly id = 'fail-agent';
  readonly name = 'Fail Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';
  protected async run(ctx: AgentContext): Promise<AgentResult> {
    return { agentId: this.id, status: 'failure', output: { error: 'bad' }, durationMs: 5 };
  }
}

// Concrete controller for testing: runs all registered agents sequentially
class SequentialController extends BaseController {
  readonly id = 'seq-ctrl';
  readonly name = 'Sequential Controller';

  protected async runOrchestration(
    trigger: Trigger,
    inputs: ServiceInputs,
    sessionId: string,
  ): Promise<AgentResult[]> {
    const ctx: AgentContext = {
      sessionId,
      serviceId: inputs.serviceId,
      triggeredBy: this.id,
      inputs,
      sharedState: {},
    };
    const results: AgentResult[] = [];
    for (const agent of this.getRegisteredAgents()) {
      results.push(await agent.execute(ctx));
    }
    return results;
  }
}

const makeInputs = (): ServiceInputs => ({
  serviceId: 'test-svc',
  timestamp: 1000,
  monitors: { cpuPercent: 10, memoryPercent: 20, diskIoMbps: 1, networkMbps: 5 },
});

describe('BaseController', () => {
  it('registers agents and lists them', () => {
    const ctrl = new SequentialController();
    ctrl.registerAgent(new PassAgent());
    expect(ctrl.getRegisteredAgents()).toHaveLength(1);
  });

  it('returns orchestration result with all agent results', async () => {
    const ctrl = new SequentialController();
    ctrl.registerAgent(new PassAgent());
    const result = await ctrl.orchestrate({ type: 'manual', reason: 'test' }, makeInputs());
    expect(result.agentResults).toHaveLength(1);
    expect(result.agentResults[0].status).toBe('success');
  });

  it('sets overallStatus to "partial" when any agent fails', async () => {
    const ctrl = new SequentialController();
    ctrl.registerAgent(new PassAgent());
    ctrl.registerAgent(new FailAgent());
    const result = await ctrl.orchestrate({ type: 'manual', reason: 'test' }, makeInputs());
    expect(result.overallStatus).toBe('partial');
  });

  it('sets overallStatus to "success" when all agents pass', async () => {
    const ctrl = new SequentialController();
    ctrl.registerAgent(new PassAgent());
    const result = await ctrl.orchestrate({ type: 'manual', reason: 'test' }, makeInputs());
    expect(result.overallStatus).toBe('success');
  });

  it('sets overallStatus to "failure" when all agents fail', async () => {
    const ctrl = new SequentialController();
    ctrl.registerAgent(new FailAgent());
    const result = await ctrl.orchestrate({ type: 'manual', reason: 'test' }, makeInputs());
    expect(result.overallStatus).toBe('failure');
  });

  it('populates controllerId and sessionId in result', async () => {
    const ctrl = new SequentialController();
    ctrl.registerAgent(new PassAgent());
    const result = await ctrl.orchestrate({ type: 'manual', reason: 'test' }, makeInputs());
    expect(result.controllerId).toBe('seq-ctrl');
    expect(typeof result.sessionId).toBe('string');
    expect(result.sessionId.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run tests/base-controller.test.ts
```

Expected: FAIL — `Cannot find module '../src/base-controller.js'`

- [ ] **Step 3: Implement `packages/core/src/base-controller.ts`**

```typescript
import { randomUUID } from 'node:crypto';
import type { AgentResult, IAgent, IController, OrchestrationResult, ServiceInputs, Trigger } from './interfaces.js';

export abstract class BaseController implements IController {
  abstract readonly id: string;
  abstract readonly name: string;

  private readonly agents: IAgent[] = [];

  // Subclasses implement the orchestration logic, returning raw agent results
  protected abstract runOrchestration(
    trigger: Trigger,
    inputs: ServiceInputs,
    sessionId: string,
  ): Promise<AgentResult[]>;

  registerAgent(agent: IAgent): void {
    this.agents.push(agent);
  }

  getRegisteredAgents(): IAgent[] {
    return [...this.agents];
  }

  async orchestrate(trigger: Trigger, inputs: ServiceInputs): Promise<OrchestrationResult> {
    const sessionId = randomUUID();
    const start = Date.now();

    const agentResults = await this.runOrchestration(trigger, inputs, sessionId);

    const successes = agentResults.filter((r) => r.status === 'success').length;
    const failures = agentResults.filter((r) => r.status === 'failure').length;
    const escalations = agentResults.filter((r) => r.escalate === true).length;

    let overallStatus: OrchestrationResult['overallStatus'];
    if (escalations > 0) {
      overallStatus = 'escalated';
    } else if (failures === 0) {
      overallStatus = 'success';
    } else if (successes === 0) {
      overallStatus = 'failure';
    } else {
      overallStatus = 'partial';
    }

    return {
      controllerId: this.id,
      sessionId,
      trigger,
      agentResults,
      overallStatus,
      durationMs: Date.now() - start,
      summary: `${successes} succeeded, ${failures} failed, ${escalations} escalated out of ${agentResults.length} agents`,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/core && npx vitest run tests/base-controller.test.ts
```

Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/base-controller.ts packages/core/tests/base-controller.test.ts
git commit -m "feat(core): add BaseController with orchestrate, overallStatus, and agent registration"
```

---

## Task 8: Core Barrel Export + Build

**Files:**
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Create `packages/core/src/index.ts`**

```typescript
export * from './types.js';
export * from './interfaces.js';
export * from './base-agent.js';
export * from './event-bus.js';
export * from './agent-registry.js';
export * from './base-controller.js';
```

- [ ] **Step 2: Run all core tests**

```bash
cd packages/core && npx vitest run
```

Expected: All tests pass (types, interfaces, base-agent, event-bus, agent-registry, base-controller).

- [ ] **Step 3: Build core**

```bash
cd packages/core && npx tsc
```

Expected: `packages/core/dist/` created with `.js`, `.d.ts`, and `.js.map` files. No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): add barrel export and verify build"
```

---

## Task 9: InputNormalizer (SDK)

**Files:**
- Create: `packages/sdk/src/input-normalizer.ts`
- Create: `packages/sdk/tests/input-normalizer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/sdk/tests/input-normalizer.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { DefaultInputNormalizer } from '../src/input-normalizer.js';
import type { ServiceInputs } from '@opsagents/core';

describe('DefaultInputNormalizer', () => {
  const normalizer = new DefaultInputNormalizer();

  it('passes through valid ServiceInputs unchanged', () => {
    const inputs: ServiceInputs = {
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 50, memoryPercent: 60, diskIoMbps: 5, networkMbps: 10 },
    };
    const result = normalizer.normalize(inputs);
    expect(result).toEqual(inputs);
  });

  it('stamps timestamp if missing', () => {
    const raw = { serviceId: 'svc' } as unknown as ServiceInputs;
    const result = normalizer.normalize(raw);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('throws if serviceId is missing', () => {
    const raw = { timestamp: 1000 } as unknown as ServiceInputs;
    expect(() => normalizer.normalize(raw)).toThrow('serviceId is required');
  });

  it('clamps errorRate to [0,1] range', () => {
    const inputs: ServiceInputs = {
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: { p50Latency: 50, p99Latency: 200, errorRate: 1.5, throughput: 100 },
    };
    const result = normalizer.normalize(inputs);
    expect(result.perfLog?.errorRate).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/sdk && npx vitest run tests/input-normalizer.test.ts
```

Expected: FAIL — `Cannot find module '../src/input-normalizer.js'`

- [ ] **Step 3: Implement `packages/sdk/src/input-normalizer.ts`**

```typescript
import type { ServiceInputs } from '@opsagents/core';

export interface InputNormalizer {
  normalize(raw: ServiceInputs): ServiceInputs;
}

export class DefaultInputNormalizer implements InputNormalizer {
  normalize(raw: ServiceInputs): ServiceInputs {
    if (!raw.serviceId) {
      throw new Error('serviceId is required');
    }

    const normalized: ServiceInputs = {
      ...raw,
      timestamp: raw.timestamp ?? Date.now(),
    };

    if (normalized.perfLog) {
      normalized.perfLog = {
        ...normalized.perfLog,
        errorRate: Math.min(1, Math.max(0, normalized.perfLog.errorRate)),
      };
    }

    return normalized;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/sdk && npx vitest run tests/input-normalizer.test.ts
```

Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/input-normalizer.ts packages/sdk/tests/input-normalizer.test.ts
git commit -m "feat(sdk): add DefaultInputNormalizer with validation and timestamp stamping"
```

---

## Task 10: ServiceAdapter

**Files:**
- Create: `packages/sdk/src/service-adapter.ts`
- Create: `packages/sdk/src/index.ts`
- Create: `packages/sdk/tests/service-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/sdk/tests/service-adapter.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { ServiceAdapter } from '../src/service-adapter.js';
import { BaseController, BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult, OrchestrationResult, ServiceInputs, Trigger } from '@opsagents/core';

class EchoAgent extends BaseAgent {
  readonly id = 'echo';
  readonly name = 'Echo Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';
  protected async run(ctx: AgentContext): Promise<AgentResult> {
    return { agentId: this.id, status: 'success', output: { serviceId: ctx.inputs.serviceId }, durationMs: 1 };
  }
}

class PassController extends BaseController {
  readonly id = 'pass-ctrl';
  readonly name = 'Pass Controller';
  protected async runOrchestration(trigger: Trigger, inputs: ServiceInputs, sessionId: string): Promise<AgentResult[]> {
    const ctx: AgentContext = {
      sessionId, serviceId: inputs.serviceId, triggeredBy: this.id, inputs, sharedState: {},
    };
    const results: AgentResult[] = [];
    for (const agent of this.getRegisteredAgents()) {
      results.push(await agent.execute(ctx));
    }
    return results;
  }
}

describe('ServiceAdapter', () => {
  it('run() dispatches to controllers and returns all OrchestrationResults', async () => {
    const ctrl = new PassController();
    ctrl.registerAgent(new EchoAgent());

    const adapter = new ServiceAdapter({ serviceId: 'svc-1', controllers: [ctrl] });
    const results = await adapter.run(
      { type: 'manual', reason: 'test' },
      { serviceId: 'svc-1', timestamp: 1000, monitors: { cpuPercent: 10, memoryPercent: 20, diskIoMbps: 1, networkMbps: 5 } },
    );

    expect(results).toHaveLength(1);
    expect(results[0].overallStatus).toBe('success');
    expect(results[0].agentResults[0].agentId).toBe('echo');
  });

  it('normalizes inputs before passing to controllers', async () => {
    const ctrl = new PassController();
    ctrl.registerAgent(new EchoAgent());

    const adapter = new ServiceAdapter({ serviceId: 'svc-1', controllers: [ctrl] });
    // Pass input without timestamp — normalizer should stamp it
    const raw = { serviceId: 'svc-1', monitors: { cpuPercent: 10, memoryPercent: 20, diskIoMbps: 1, networkMbps: 5 } } as ServiceInputs;
    const results = await adapter.run({ type: 'manual', reason: 'test' }, raw);
    expect(results[0].agentResults[0].status).toBe('success');
  });

  it('throws if adapter serviceId does not match inputs serviceId', async () => {
    const ctrl = new PassController();
    const adapter = new ServiceAdapter({ serviceId: 'svc-1', controllers: [ctrl] });
    const inputs: ServiceInputs = { serviceId: 'other-svc', timestamp: 1000 };
    await expect(adapter.run({ type: 'manual', reason: 'test' }, inputs)).rejects.toThrow(
      'serviceId mismatch',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/sdk && npx vitest run tests/service-adapter.test.ts
```

Expected: FAIL — `Cannot find module '../src/service-adapter.js'`

- [ ] **Step 3: Implement `packages/sdk/src/service-adapter.ts`**

```typescript
import type { IController, OrchestrationResult, ServiceInputs, Trigger } from '@opsagents/core';
import { DefaultInputNormalizer, type InputNormalizer } from './input-normalizer.js';

export interface ServiceAdapterConfig {
  serviceId: string;
  controllers: IController[];
  inputNormalizer?: InputNormalizer;
}

export class ServiceAdapter {
  private readonly serviceId: string;
  private readonly controllers: IController[];
  private readonly normalizer: InputNormalizer;

  constructor(config: ServiceAdapterConfig) {
    this.serviceId = config.serviceId;
    this.controllers = config.controllers;
    this.normalizer = config.inputNormalizer ?? new DefaultInputNormalizer();
  }

  async run(trigger: Trigger, rawInputs: ServiceInputs): Promise<OrchestrationResult[]> {
    if (rawInputs.serviceId !== this.serviceId) {
      throw new Error(
        `serviceId mismatch: adapter is for "${this.serviceId}" but inputs have "${rawInputs.serviceId}"`,
      );
    }

    const inputs = this.normalizer.normalize(rawInputs);

    return Promise.all(
      this.controllers.map((ctrl) => ctrl.orchestrate(trigger, inputs)),
    );
  }
}
```

- [ ] **Step 4: Create `packages/sdk/src/index.ts`**

```typescript
export * from './input-normalizer.js';
export * from './service-adapter.js';
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd packages/sdk && npx vitest run
```

Expected: PASS — all 7 SDK tests pass

- [ ] **Step 6: Build SDK**

```bash
cd packages/sdk && npx tsc
```

Expected: `packages/sdk/dist/` created. No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add packages/sdk/src/ packages/sdk/tests/
git commit -m "feat(sdk): add ServiceAdapter with input normalization and multi-controller dispatch"
```

---

## Task 11: MetaController Scaffold

**Files:**
- Create: `packages/controllers/src/meta-controller.ts`
- Create: `packages/controllers/src/index.ts`
- Create: `packages/controllers/tests/meta-controller.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/controllers/tests/meta-controller.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { MetaController } from '../src/meta-controller.js';
import { BaseController, BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult, ServiceInputs, Trigger } from '@opsagents/core';

class StubDomainController extends BaseController {
  constructor(public readonly id: string, public readonly name: string) { super(); }
  protected async runOrchestration(trigger: Trigger, inputs: ServiceInputs, sessionId: string): Promise<AgentResult[]> {
    return [{ agentId: 'stub', status: 'success', output: {}, durationMs: 1 }];
  }
}

describe('MetaController', () => {
  it('registers domain controllers', () => {
    const meta = new MetaController();
    meta.addDomainController(new StubDomainController('d1', 'D1'));
    expect(meta.getDomainControllers()).toHaveLength(1);
  });

  it('orchestrate dispatches to all domain controllers when trigger type is "manual"', async () => {
    const meta = new MetaController();
    meta.addDomainController(new StubDomainController('d1', 'D1'));
    meta.addDomainController(new StubDomainController('d2', 'D2'));

    const result = await meta.orchestrate(
      { type: 'manual', reason: 'full sweep' },
      { serviceId: 'svc', timestamp: 1000 },
    );

    // MetaController returns one AgentResult per domain controller
    expect(result.agentResults).toHaveLength(2);
    expect(result.overallStatus).toBe('success');
  });

  it('has id "meta-controller" and name "Meta Controller"', () => {
    const meta = new MetaController();
    expect(meta.id).toBe('meta-controller');
    expect(meta.name).toBe('Meta Controller');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/controllers && npx vitest run tests/meta-controller.test.ts
```

Expected: FAIL — `Cannot find module '../src/meta-controller.js'`

- [ ] **Step 3: Implement `packages/controllers/src/meta-controller.ts`**

```typescript
import { BaseController } from '@opsagents/core';
import type { AgentResult, IController, ServiceInputs, Trigger } from '@opsagents/core';

export class MetaController extends BaseController {
  readonly id = 'meta-controller';
  readonly name = 'Meta Controller';

  private readonly domainControllers: IController[] = [];

  addDomainController(controller: IController): void {
    this.domainControllers.push(controller);
  }

  getDomainControllers(): IController[] {
    return [...this.domainControllers];
  }

  protected async runOrchestration(
    trigger: Trigger,
    inputs: ServiceInputs,
    sessionId: string,
  ): Promise<AgentResult[]> {
    // Each domain controller runs; its OrchestrationResult becomes one AgentResult summary
    const results = await Promise.allSettled(
      this.domainControllers.map((ctrl) => ctrl.orchestrate(trigger, inputs)),
    );

    return results.map((settled, i) => {
      const ctrl = this.domainControllers[i];
      if (settled.status === 'fulfilled') {
        const orch = settled.value;
        return {
          agentId: ctrl.id,
          status: orch.overallStatus === 'failure' ? 'failure' : 'success',
          output: orch,
          durationMs: orch.durationMs,
          escalate: orch.overallStatus === 'escalated',
        } satisfies AgentResult;
      } else {
        return {
          agentId: ctrl.id,
          status: 'failure',
          output: { error: String(settled.reason) },
          durationMs: 0,
        } satisfies AgentResult;
      }
    });
  }
}
```

- [ ] **Step 4: Create `packages/controllers/src/index.ts`**

```typescript
export * from './meta-controller.js';
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd packages/controllers && npx vitest run
```

Expected: PASS — 3 tests pass

- [ ] **Step 6: Build controllers**

```bash
cd packages/controllers && npx tsc
```

Expected: `packages/controllers/dist/` created. No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add packages/controllers/src/ packages/controllers/tests/
git commit -m "feat(controllers): add MetaController scaffold with domain controller dispatch"
```

---

## Task 12: Example Service Integration

**Files:**
- Create: `services/example-service/src/echo-agent.ts`
- Create: `services/example-service/src/index.ts`
- Create: `services/example-service/tests/integration.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `services/example-service/tests/integration.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { ServiceAdapter } from '@opsagents/sdk';
import { BaseController, BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult, ServiceInputs, Trigger } from '@opsagents/core';
import { EchoAgent } from '../src/echo-agent.js';

class MonitoringController extends BaseController {
  readonly id = 'monitoring-ctrl';
  readonly name = 'Monitoring Controller';
  protected async runOrchestration(trigger: Trigger, inputs: ServiceInputs, sessionId: string): Promise<AgentResult[]> {
    const ctx: AgentContext = {
      sessionId,
      serviceId: inputs.serviceId,
      triggeredBy: this.id,
      inputs,
      sharedState: {},
    };
    const agents = this.getRegisteredAgents().filter((a) => a.canHandle(inputs));
    return Promise.all(agents.map((a) => a.execute(ctx)));
  }
}

describe('Example Service Integration', () => {
  it('attaches EchoAgent to a service and produces a successful orchestration result', async () => {
    const ctrl = new MonitoringController();
    ctrl.registerAgent(new EchoAgent());

    const adapter = new ServiceAdapter({
      serviceId: 'example-service',
      controllers: [ctrl],
    });

    const results = await adapter.run(
      { type: 'schedule', cronExpression: '* * * * *' },
      {
        serviceId: 'example-service',
        timestamp: Date.now(),
        monitors: {
          cpuPercent: 35,
          memoryPercent: 55,
          diskIoMbps: 12,
          networkMbps: 80,
        },
      },
    );

    expect(results).toHaveLength(1);
    expect(results[0].overallStatus).toBe('success');
    expect(results[0].agentResults[0].agentId).toBe('echo-agent');
    const output = results[0].agentResults[0].output as { message: string };
    expect(output.message).toContain('example-service');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/example-service && npx vitest run tests/integration.test.ts
```

Expected: FAIL — `Cannot find module '../src/echo-agent.js'`

- [ ] **Step 3: Create `services/example-service/src/echo-agent.ts`**

```typescript
import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';

export class EchoAgent extends BaseAgent {
  readonly id = 'echo-agent';
  readonly name = 'Echo Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const { cpuPercent, memoryPercent } = context.inputs.monitors ?? {
      cpuPercent: 0,
      memoryPercent: 0,
    };

    return {
      agentId: this.id,
      status: 'success',
      output: {
        message: `example-service health: cpu=${cpuPercent}%, mem=${memoryPercent}%`,
        cpuPercent,
        memoryPercent,
      },
      durationMs: 0,
    };
  }
}
```

- [ ] **Step 4: Create `services/example-service/src/index.ts`**

```typescript
// Example of attaching OpsAgents to a service.
// Run: node dist/index.js
import { ServiceAdapter } from '@opsagents/sdk';
import { BaseController } from '@opsagents/core';
import type { AgentContext, AgentResult, ServiceInputs, Trigger } from '@opsagents/core';
import { EchoAgent } from './echo-agent.js';

class MonitoringController extends BaseController {
  readonly id = 'monitoring-ctrl';
  readonly name = 'Monitoring Controller';
  protected async runOrchestration(trigger: Trigger, inputs: ServiceInputs, sessionId: string): Promise<AgentResult[]> {
    const ctx: AgentContext = {
      sessionId, serviceId: inputs.serviceId, triggeredBy: this.id, inputs, sharedState: {},
    };
    return Promise.all(
      this.getRegisteredAgents()
        .filter((a) => a.canHandle(inputs))
        .map((a) => a.execute(ctx)),
    );
  }
}

const ctrl = new MonitoringController();
ctrl.registerAgent(new EchoAgent());

const adapter = new ServiceAdapter({ serviceId: 'example-service', controllers: [ctrl] });

const results = await adapter.run(
  { type: 'manual', reason: 'demo run' },
  {
    serviceId: 'example-service',
    timestamp: Date.now(),
    monitors: { cpuPercent: 35, memoryPercent: 55, diskIoMbps: 12, networkMbps: 80 },
  },
);

console.log(JSON.stringify(results, null, 2));
```

- [ ] **Step 5: Run integration test to verify it passes**

```bash
cd services/example-service && npx vitest run
```

Expected: PASS — 1 integration test passes

- [ ] **Step 6: Run all tests across the monorepo**

```bash
cd C:\Users\schinta\OpsAgents && npm test
```

Expected: All packages report PASS. Zero failing tests.

- [ ] **Step 7: Commit and tag CP-1**

```bash
git add services/example-service/
git commit -m "feat(example): add EchoAgent and ServiceAdapter integration example"

git tag checkpoint/cp-1-core
```

---

## Self-Review

**Spec coverage check:**
- ✅ `packages/core` with interfaces, BaseAgent, EventBus, AgentRegistry — Tasks 2–8
- ✅ `packages/sdk` with ServiceAdapter and InputNormalizer — Tasks 9–10
- ✅ `packages/controllers` with MetaController scaffold — Task 11
- ✅ Project tooling (TypeScript, npm workspaces, Vitest) — Task 1
- ✅ Unit tests for all core pieces — each task has TDD cycle
- ✅ `services/example-service` minimal integration — Task 12
- ✅ `checkpoint/cp-1-core` git tag — Task 12, Step 7

**Type consistency:**
- `AgentResult` used consistently: `agentId`, `status`, `output`, `durationMs` throughout
- `AgentContext.inputs` is `ServiceInputs` throughout
- `BaseController.runOrchestration` returns `AgentResult[]` consistently
- `InputType` → `ServiceInputs` key mapping defined once in `base-agent.ts`

**No placeholders found.**

---

*Next plan: `2026-06-03-cp2-deployment-agents.md` — implement DeploymentController + 4 deployment agents + 3 predictive agents. Create after CP-1 tag is verified.*
