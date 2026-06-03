# CP-2: Deployment Agents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement DeploymentController with 4 deployment agents (CI/CD Governance, Deployment Validation, Lag Indication, On-Demand Testing) and 3 predictive agents (Traffic Prediction, Traffic Dial-Up, Critical Metrics), with integration tests covering the deployment happy path and rollback path.

**Architecture:** Two new agent packages (`packages/agents/deployment` and `packages/agents/predictive`) added under a new `packages/agents/*` workspace glob. DeploymentController lives in `packages/controllers` and runs deployment agents sequentially, halting the chain on any escalation. All agent logic is pure TypeScript (no external LLM calls) — results are determined by input thresholds so they are fully deterministic and testable.

**Tech Stack:** TypeScript 5.x, Node.js 20 LTS, npm workspaces (`packages/agents/*` added), Vitest 1.x, `@opsagents/core` (built at `packages/core/dist/`)

---

## File Map

```
packages/agents/
  deployment/
    package.json
    tsconfig.json
    vitest.config.ts
    src/
      ci-cd-governance.ts       # CiCdGovernanceAgent
      deployment-validation.ts  # DeploymentValidationAgent
      lag-indication.ts         # LagIndicationAgent
      on-demand-testing.ts      # OnDemandTestingAgent
      index.ts                  # barrel export
    tests/
      ci-cd-governance.test.ts
      deployment-validation.test.ts
      lag-indication.test.ts
      on-demand-testing.test.ts
  predictive/
    package.json
    tsconfig.json
    vitest.config.ts
    src/
      traffic-prediction.ts     # TrafficPredictionAgent
      traffic-dial-up.ts        # TrafficDialUpAgent
      critical-metrics.ts       # CriticalMetricsAgent
      index.ts                  # barrel export
    tests/
      traffic-prediction.test.ts
      traffic-dial-up.test.ts
      critical-metrics.test.ts

packages/controllers/
  src/
    deployment-controller.ts    # NEW
    index.ts                    # MODIFY — add deployment-controller export
  tests/
    deployment-controller.test.ts  # NEW

services/example-service/
  tests/
    deployment-integration.test.ts  # NEW end-to-end
```

Root `package.json` workspaces modified: add `"packages/agents/*"`.

---

## Task 1: Agent Packages Scaffolding

**Files:**
- Modify: `package.json` (root) — add `packages/agents/*` to workspaces
- Create: `packages/agents/deployment/package.json`
- Create: `packages/agents/deployment/tsconfig.json`
- Create: `packages/agents/deployment/vitest.config.ts`
- Create: `packages/agents/predictive/package.json`
- Create: `packages/agents/predictive/tsconfig.json`
- Create: `packages/agents/predictive/vitest.config.ts`

- [ ] **Step 1: Update root workspaces**

Edit `package.json` (root) — change the workspaces array:
```json
{
  "name": "opsagents",
  "private": true,
  "workspaces": [
    "packages/*",
    "packages/agents/*",
    "services/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "lint": "eslint"
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

- [ ] **Step 2: Create deployment package files**

Create `packages/agents/deployment/package.json`:
```json
{
  "name": "@opsagents/agents-deployment",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@opsagents/core": "*"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

Create `packages/agents/deployment/tsconfig.json`:
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Create `packages/agents/deployment/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 3: Create predictive package files**

Create `packages/agents/predictive/package.json`:
```json
{
  "name": "@opsagents/agents-predictive",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@opsagents/core": "*"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

Create `packages/agents/predictive/tsconfig.json`:
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Create `packages/agents/predictive/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 4: Create src/ and tests/ directories**

```powershell
New-Item -ItemType Directory -Force C:\Users\schinta\OpsAgents\packages\agents\deployment\src
New-Item -ItemType Directory -Force C:\Users\schinta\OpsAgents\packages\agents\deployment\tests
New-Item -ItemType Directory -Force C:\Users\schinta\OpsAgents\packages\agents\predictive\src
New-Item -ItemType Directory -Force C:\Users\schinta\OpsAgents\packages\agents\predictive\tests
```

- [ ] **Step 5: Run npm install to link workspaces**

```
cd C:\Users\schinta\OpsAgents && npm install --legacy-peer-deps
```

Expected: No errors. `node_modules/@opsagents/agents-deployment` and `node_modules/@opsagents/agents-predictive` symlinks created.

- [ ] **Step 6: Commit**

```
git -C C:\Users\schinta\OpsAgents add package.json packages/agents/
git -C C:\Users\schinta\OpsAgents commit -m "chore: scaffold agents-deployment and agents-predictive packages

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: CiCdGovernanceAgent

**Files:**
- Create: `packages/agents/deployment/src/ci-cd-governance.ts`
- Create: `packages/agents/deployment/tests/ci-cd-governance.test.ts`

**Logic:** Validates release readiness from code + perf-log inputs.
- `approved = coverage >= 70 && errorRate <= 0.05`
- `escalate = true` if `coverage < 50` (critically under-tested)

- [ ] **Step 1: Write the failing test**

Create `packages/agents/deployment/tests/ci-cd-governance.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { CiCdGovernanceAgent } from '../src/ci-cd-governance.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

const makeCtx = (inputs: ServiceInputs): AgentContext => ({
  sessionId: 'sess-1',
  serviceId: inputs.serviceId,
  triggeredBy: 'test',
  inputs,
  sharedState: {},
});

describe('CiCdGovernanceAgent', () => {
  const agent = new CiCdGovernanceAgent();

  it('has correct id, category, and acceptedInputs', () => {
    expect(agent.id).toBe('ci-cd-governance');
    expect(agent.acceptedInputs).toContain('code');
    expect(agent.acceptedInputs).toContain('perf-log');
  });

  it('returns success when coverage >= 70 and errorRate <= 0.05', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      code: { diff: '+1 line', commitSha: 'abc', coverage: 80 },
      perfLog: { p50Latency: 50, p99Latency: 150, errorRate: 0.01, throughput: 500 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    expect((result.output as { approved: boolean }).approved).toBe(true);
    expect(result.escalate).toBeFalsy();
  });

  it('returns failure when coverage < 70', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      code: { coverage: 65 },
      perfLog: { p50Latency: 50, p99Latency: 150, errorRate: 0.01, throughput: 500 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('failure');
    expect((result.output as { approved: boolean }).approved).toBe(false);
    expect(result.escalate).toBeFalsy();
  });

  it('escalates when coverage < 50 (critically under-tested)', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      code: { coverage: 30 },
      perfLog: { p50Latency: 50, p99Latency: 150, errorRate: 0.01, throughput: 500 },
    });
    const result = await agent.execute(ctx);
    expect(result.escalate).toBe(true);
  });

  it('returns failure when errorRate > 0.05', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      code: { coverage: 80 },
      perfLog: { p50Latency: 50, p99Latency: 400, errorRate: 0.1, throughput: 500 },
    });
    const result = await agent.execute(ctx);
    expect((result.output as { approved: boolean }).approved).toBe(false);
  });

  it('skips when code input is absent', async () => {
    const ctx = makeCtx({ serviceId: 'svc', timestamp: 1000 });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd C:\Users\schinta\OpsAgents\packages\agents\deployment && npx vitest run tests/ci-cd-governance.test.ts
```
Expected: FAIL — `Cannot find module '../src/ci-cd-governance.js'`

- [ ] **Step 3: Implement `packages/agents/deployment/src/ci-cd-governance.ts`**

```typescript
import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';

export interface CiCdGovernanceOutput {
  approved: boolean;
  coverage: number;
  errorRate: number;
  reason: string;
  auditLog: string[];
}

export class CiCdGovernanceAgent extends BaseAgent {
  readonly id = 'ci-cd-governance';
  readonly name = 'CI/CD Governance Agent';
  readonly category = AgentCategory.DEPLOYMENT;
  readonly acceptedInputs = ['code' as const, 'perf-log' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const { code, perfLog } = context.inputs;

    if (!code) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No code input provided' },
        durationMs: 0,
      };
    }

    const coverage = code.coverage ?? 0;
    const errorRate = perfLog?.errorRate ?? 0;
    const auditLog: string[] = [];

    auditLog.push(`Coverage: ${coverage}% (threshold: 70%)`);
    auditLog.push(`Error rate: ${(errorRate * 100).toFixed(2)}% (threshold: 5%)`);

    // Critical: coverage below 50% is unacceptable — escalate
    if (coverage < 50) {
      auditLog.push('CRITICAL: Coverage below 50% — escalating');
      return {
        agentId: this.id,
        status: 'failure',
        output: { approved: false, coverage, errorRate, reason: 'Coverage critically low (<50%)', auditLog } satisfies CiCdGovernanceOutput,
        recommendations: ['Add unit tests before deploying', 'Minimum 70% coverage required'],
        escalate: true,
        durationMs: 0,
      };
    }

    const approved = coverage >= 70 && errorRate <= 0.05;

    if (!approved) {
      const reasons: string[] = [];
      if (coverage < 70) reasons.push(`Coverage ${coverage}% below 70% threshold`);
      if (errorRate > 0.05) reasons.push(`Error rate ${(errorRate * 100).toFixed(2)}% above 5% threshold`);
      auditLog.push(`REJECTED: ${reasons.join('; ')}`);
    } else {
      auditLog.push('APPROVED: All governance checks passed');
    }

    return {
      agentId: this.id,
      status: approved ? 'success' : 'failure',
      output: {
        approved,
        coverage,
        errorRate,
        reason: approved ? 'All checks passed' : 'Governance checks failed',
        auditLog,
      } satisfies CiCdGovernanceOutput,
      recommendations: approved ? [] : ['Improve test coverage', 'Investigate error rate'],
      durationMs: 0,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
cd C:\Users\schinta\OpsAgents\packages\agents\deployment && npx vitest run tests/ci-cd-governance.test.ts
```
Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```
git -C C:\Users\schinta\OpsAgents add packages/agents/deployment/src/ci-cd-governance.ts packages/agents/deployment/tests/ci-cd-governance.test.ts
git -C C:\Users\schinta\OpsAgents commit -m "feat(agents-deployment): add CiCdGovernanceAgent with coverage and error rate validation

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: DeploymentValidationAgent

**Files:**
- Create: `packages/agents/deployment/src/deployment-validation.ts`
- Create: `packages/agents/deployment/tests/deployment-validation.test.ts`

**Logic:** Validates post-deploy health from monitors.
- `validated = cpuPercent < 85 && memoryPercent < 85`
- `escalate = true` if `cpuPercent > 95 || memoryPercent > 95`

- [ ] **Step 1: Write the failing test**

Create `packages/agents/deployment/tests/deployment-validation.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { DeploymentValidationAgent } from '../src/deployment-validation.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

const makeCtx = (inputs: ServiceInputs): AgentContext => ({
  sessionId: 'sess-1',
  serviceId: inputs.serviceId,
  triggeredBy: 'test',
  inputs,
  sharedState: {},
});

describe('DeploymentValidationAgent', () => {
  const agent = new DeploymentValidationAgent();

  it('has correct id and acceptedInputs', () => {
    expect(agent.id).toBe('deployment-validation');
    expect(agent.acceptedInputs).toContain('monitor');
  });

  it('validates successfully when cpu < 85 and memory < 85', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 50, memoryPercent: 60, diskIoMbps: 10, networkMbps: 20 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    expect((result.output as { validated: boolean }).validated).toBe(true);
    expect(result.escalate).toBeFalsy();
  });

  it('returns failure when cpu >= 85', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 88, memoryPercent: 50, diskIoMbps: 10, networkMbps: 20 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('failure');
    expect((result.output as { validated: boolean }).validated).toBe(false);
    expect(result.escalate).toBeFalsy();
  });

  it('escalates when cpu > 95', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 97, memoryPercent: 50, diskIoMbps: 10, networkMbps: 20 },
    });
    const result = await agent.execute(ctx);
    expect(result.escalate).toBe(true);
  });

  it('escalates when memory > 95', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 50, memoryPercent: 96, diskIoMbps: 10, networkMbps: 20 },
    });
    const result = await agent.execute(ctx);
    expect(result.escalate).toBe(true);
  });

  it('skips when monitors input is absent', async () => {
    const ctx = makeCtx({ serviceId: 'svc', timestamp: 1000 });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd C:\Users\schinta\OpsAgents\packages\agents\deployment && npx vitest run tests/deployment-validation.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement `packages/agents/deployment/src/deployment-validation.ts`**

```typescript
import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';

export interface DeploymentValidationOutput {
  validated: boolean;
  healthScore: number;
  cpuPercent: number;
  memoryPercent: number;
  issues: string[];
}

export class DeploymentValidationAgent extends BaseAgent {
  readonly id = 'deployment-validation';
  readonly name = 'Deployment Validation Agent';
  readonly category = AgentCategory.DEPLOYMENT;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const { monitors } = context.inputs;

    if (!monitors) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No monitors input provided' },
        durationMs: 0,
      };
    }

    const { cpuPercent, memoryPercent } = monitors;
    const issues: string[] = [];

    // Critical: immediate escalation
    if (cpuPercent > 95 || memoryPercent > 95) {
      return {
        agentId: this.id,
        status: 'failure',
        output: {
          validated: false,
          healthScore: 0,
          cpuPercent,
          memoryPercent,
          issues: [`Critical resource exhaustion: cpu=${cpuPercent}%, mem=${memoryPercent}%`],
        } satisfies DeploymentValidationOutput,
        recommendations: ['Immediate scale-out required', 'Consider rollback'],
        escalate: true,
        durationMs: 0,
      };
    }

    if (cpuPercent >= 85) issues.push(`CPU ${cpuPercent}% exceeds 85% threshold`);
    if (memoryPercent >= 85) issues.push(`Memory ${memoryPercent}% exceeds 85% threshold`);

    const validated = issues.length === 0;
    // Health score: 100 minus penalties for resource usage above 50%
    const healthScore = Math.max(0, 100 - Math.max(0, cpuPercent - 50) - Math.max(0, memoryPercent - 50));

    return {
      agentId: this.id,
      status: validated ? 'success' : 'failure',
      output: { validated, healthScore, cpuPercent, memoryPercent, issues } satisfies DeploymentValidationOutput,
      recommendations: validated ? [] : ['Scale resources before completing rollout'],
      durationMs: 0,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
cd C:\Users\schinta\OpsAgents\packages\agents\deployment && npx vitest run tests/deployment-validation.test.ts
```
Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```
git -C C:\Users\schinta\OpsAgents add packages/agents/deployment/src/deployment-validation.ts packages/agents/deployment/tests/deployment-validation.test.ts
git -C C:\Users\schinta\OpsAgents commit -m "feat(agents-deployment): add DeploymentValidationAgent with resource threshold checks

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: LagIndicationAgent

**Files:**
- Create: `packages/agents/deployment/src/lag-indication.ts`
- Create: `packages/agents/deployment/tests/lag-indication.test.ts`

**Logic:** Computes a risk score from perf-log to detect slow-emerging bugs.
- `riskScore = clamp(p99Latency / 500 * 0.6 + errorRate * 0.4, 0, 1)`
- Risk < 0.3: success (low risk)
- Risk 0.3–0.7: success with recommendations (medium risk)
- Risk > 0.7: escalate (high risk)

- [ ] **Step 1: Write the failing test**

Create `packages/agents/deployment/tests/lag-indication.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { LagIndicationAgent } from '../src/lag-indication.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

const makeCtx = (inputs: ServiceInputs): AgentContext => ({
  sessionId: 'sess-1',
  serviceId: inputs.serviceId,
  triggeredBy: 'test',
  inputs,
  sharedState: {},
});

describe('LagIndicationAgent', () => {
  const agent = new LagIndicationAgent();

  it('has correct id and acceptedInputs', () => {
    expect(agent.id).toBe('lag-indication');
    expect(agent.acceptedInputs).toContain('perf-log');
  });

  it('returns success with low risk when p99 < 150ms and errorRate < 0.01', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: { p50Latency: 30, p99Latency: 100, errorRate: 0.005, throughput: 1000 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    const out = result.output as { riskScore: number; riskLevel: string };
    expect(out.riskLevel).toBe('low');
    expect(out.riskScore).toBeLessThan(0.3);
    expect(result.escalate).toBeFalsy();
  });

  it('returns success with medium risk recommendations when riskScore is 0.3–0.7', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: { p50Latency: 100, p99Latency: 300, errorRate: 0.05, throughput: 800 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    const out = result.output as { riskLevel: string };
    expect(out.riskLevel).toBe('medium');
    expect(result.recommendations?.length).toBeGreaterThan(0);
    expect(result.escalate).toBeFalsy();
  });

  it('escalates when riskScore > 0.7', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: { p50Latency: 300, p99Latency: 800, errorRate: 0.2, throughput: 200 },
    });
    const result = await agent.execute(ctx);
    const out = result.output as { riskLevel: string };
    expect(out.riskLevel).toBe('high');
    expect(result.escalate).toBe(true);
  });

  it('skips when perfLog input is absent', async () => {
    const ctx = makeCtx({ serviceId: 'svc', timestamp: 1000 });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd C:\Users\schinta\OpsAgents\packages\agents\deployment && npx vitest run tests/lag-indication.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement `packages/agents/deployment/src/lag-indication.ts`**

```typescript
import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';

export interface LagIndicationOutput {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  p99Latency: number;
  errorRate: number;
  anomalies: string[];
  recommendation: string;
}

export class LagIndicationAgent extends BaseAgent {
  readonly id = 'lag-indication';
  readonly name = 'Lag Indication Agent';
  readonly category = AgentCategory.DEPLOYMENT;
  readonly acceptedInputs = ['perf-log' as const, 'code' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const { perfLog } = context.inputs;

    if (!perfLog) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No perfLog input provided' },
        durationMs: 0,
      };
    }

    const { p99Latency, errorRate } = perfLog;
    const anomalies: string[] = [];

    // Risk score: latency component (0-1 for 0-500ms) + error rate component
    const latencyRisk = Math.min(1, p99Latency / 500);
    const errorRisk = Math.min(1, errorRate);
    const riskScore = Math.min(1, latencyRisk * 0.6 + errorRisk * 0.4);

    if (p99Latency > 300) anomalies.push(`High p99 latency: ${p99Latency}ms (threshold: 300ms)`);
    if (errorRate > 0.05) anomalies.push(`Elevated error rate: ${(errorRate * 100).toFixed(2)}%`);

    const riskLevel: 'low' | 'medium' | 'high' =
      riskScore < 0.3 ? 'low' : riskScore < 0.7 ? 'medium' : 'high';

    const recommendation =
      riskLevel === 'low'
        ? 'No action required — deployment looks healthy'
        : riskLevel === 'medium'
          ? 'Monitor closely for 10 minutes after full rollout'
          : 'High risk detected — consider rollback before full traffic';

    const output: LagIndicationOutput = {
      riskScore: Math.round(riskScore * 100) / 100,
      riskLevel,
      p99Latency,
      errorRate,
      anomalies,
      recommendation,
    };

    if (riskLevel === 'high') {
      return {
        agentId: this.id,
        status: 'failure',
        output,
        recommendations: [recommendation, 'Review recent commits for performance regressions'],
        escalate: true,
        durationMs: 0,
      };
    }

    return {
      agentId: this.id,
      status: 'success',
      output,
      recommendations: riskLevel === 'medium' ? [recommendation] : [],
      durationMs: 0,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
cd C:\Users\schinta\OpsAgents\packages\agents\deployment && npx vitest run tests/lag-indication.test.ts
```
Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```
git -C C:\Users\schinta\OpsAgents add packages/agents/deployment/src/lag-indication.ts packages/agents/deployment/tests/lag-indication.test.ts
git -C C:\Users\schinta\OpsAgents commit -m "feat(agents-deployment): add LagIndicationAgent with risk scoring

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5: OnDemandTestingAgent

**Files:**
- Create: `packages/agents/deployment/src/on-demand-testing.ts`
- Create: `packages/agents/deployment/tests/on-demand-testing.test.ts`

**Logic:** Simulates running a regression suite based on code coverage.
- `passed = coverage >= 60`
- `escalate = true` if `coverage < 40` (critically under-tested)

- [ ] **Step 1: Write the failing test**

Create `packages/agents/deployment/tests/on-demand-testing.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { OnDemandTestingAgent } from '../src/on-demand-testing.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

const makeCtx = (inputs: ServiceInputs): AgentContext => ({
  sessionId: 'sess-1',
  serviceId: inputs.serviceId,
  triggeredBy: 'test',
  inputs,
  sharedState: {},
});

describe('OnDemandTestingAgent', () => {
  const agent = new OnDemandTestingAgent();

  it('has correct id and acceptedInputs', () => {
    expect(agent.id).toBe('on-demand-testing');
    expect(agent.acceptedInputs).toContain('code');
  });

  it('passes when coverage >= 60', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      code: { coverage: 75, diff: 'some diff', commitSha: 'abc' },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    expect((result.output as { passed: boolean }).passed).toBe(true);
    expect(result.escalate).toBeFalsy();
  });

  it('returns failure when coverage < 60', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      code: { coverage: 55 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('failure');
    expect((result.output as { passed: boolean }).passed).toBe(false);
    expect(result.escalate).toBeFalsy();
  });

  it('escalates when coverage < 40', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      code: { coverage: 25 },
    });
    const result = await agent.execute(ctx);
    expect(result.escalate).toBe(true);
  });

  it('skips when code input is absent', async () => {
    const ctx = makeCtx({ serviceId: 'svc', timestamp: 1000 });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd C:\Users\schinta\OpsAgents\packages\agents\deployment && npx vitest run tests/on-demand-testing.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement `packages/agents/deployment/src/on-demand-testing.ts`**

```typescript
import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';

export interface OnDemandTestingOutput {
  passed: boolean;
  coverage: number;
  testCount: number;
  failedTests: string[];
  summary: string;
}

export class OnDemandTestingAgent extends BaseAgent {
  readonly id = 'on-demand-testing';
  readonly name = 'On-Demand Testing Agent';
  readonly category = AgentCategory.DEPLOYMENT;
  readonly acceptedInputs = ['code' as const, 'monitor' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const { code } = context.inputs;

    if (!code) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No code input provided' },
        durationMs: 0,
      };
    }

    const coverage = code.coverage ?? 0;
    // Simulate test count proportional to coverage (mock: 1 test per coverage %)
    const testCount = Math.round(coverage * 2);
    const failedTests: string[] = [];

    // Critical: escalate if coverage < 40
    if (coverage < 40) {
      failedTests.push('CRITICAL: Insufficient test coverage for safe deployment');
      return {
        agentId: this.id,
        status: 'failure',
        output: {
          passed: false,
          coverage,
          testCount,
          failedTests,
          summary: `Critical: ${coverage}% coverage is below minimum 40% threshold`,
        } satisfies OnDemandTestingOutput,
        recommendations: ['Add tests before deploying — minimum 60% coverage required'],
        escalate: true,
        durationMs: 0,
      };
    }

    if (coverage < 60) {
      failedTests.push(`Coverage ${coverage}% below 60% pass threshold`);
    }

    const passed = failedTests.length === 0;

    return {
      agentId: this.id,
      status: passed ? 'success' : 'failure',
      output: {
        passed,
        coverage,
        testCount,
        failedTests,
        summary: passed
          ? `All ${testCount} simulated tests passed with ${coverage}% coverage`
          : `${failedTests.length} test criteria failed`,
      } satisfies OnDemandTestingOutput,
      recommendations: passed ? [] : ['Improve test coverage to at least 60%'],
      durationMs: 0,
    };
  }
}
```

- [ ] **Step 4: Run all deployment agent tests**

```
cd C:\Users\schinta\OpsAgents\packages\agents\deployment && npx vitest run
```
Expected: 4 test files, all pass (6 + 5 + 4 + 4 = 19 tests)

- [ ] **Step 5: Commit**

```
git -C C:\Users\schinta\OpsAgents add packages/agents/deployment/src/on-demand-testing.ts packages/agents/deployment/tests/on-demand-testing.test.ts
git -C C:\Users\schinta\OpsAgents commit -m "feat(agents-deployment): add OnDemandTestingAgent with regression simulation

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 6: Deployment Package Barrel Export + Build

**Files:**
- Create: `packages/agents/deployment/src/index.ts`

- [ ] **Step 1: Create barrel export**

Create `packages/agents/deployment/src/index.ts`:
```typescript
export * from './ci-cd-governance.js';
export * from './deployment-validation.js';
export * from './lag-indication.js';
export * from './on-demand-testing.js';
```

- [ ] **Step 2: Run all deployment tests**

```
cd C:\Users\schinta\OpsAgents\packages\agents\deployment && npx vitest run
```
Expected: All 19 tests pass

- [ ] **Step 3: Build deployment package**

```
cd C:\Users\schinta\OpsAgents\packages\agents\deployment && npx tsc
```
Expected: `packages/agents/deployment/dist/` created with no TypeScript errors.

- [ ] **Step 4: Commit**

```
git -C C:\Users\schinta\OpsAgents add packages/agents/deployment/src/index.ts packages/agents/deployment/dist
git -C C:\Users\schinta\OpsAgents commit -m "feat(agents-deployment): add barrel export and verify tsc build

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 7: TrafficPredictionAgent

**Files:**
- Create: `packages/agents/predictive/src/traffic-prediction.ts`
- Create: `packages/agents/predictive/tests/traffic-prediction.test.ts`

**Logic:** Forecasts 24h demand from current throughput and CPU headroom.
- `forecastedRps = throughput * 1.2` (20% growth baseline)
- `scalingNeeded = forecastedRps > throughput * (1 - cpuPercent/100) * 2`

- [ ] **Step 1: Write the failing test**

Create `packages/agents/predictive/tests/traffic-prediction.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { TrafficPredictionAgent } from '../src/traffic-prediction.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

const makeCtx = (inputs: ServiceInputs): AgentContext => ({
  sessionId: 'sess-1',
  serviceId: inputs.serviceId,
  triggeredBy: 'test',
  inputs,
  sharedState: {},
});

describe('TrafficPredictionAgent', () => {
  const agent = new TrafficPredictionAgent();

  it('has correct id and acceptedInputs', () => {
    expect(agent.id).toBe('traffic-prediction');
    expect(agent.acceptedInputs).toContain('perf-log');
    expect(agent.acceptedInputs).toContain('monitor');
  });

  it('forecasts 20% growth and returns success when headroom is sufficient', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: { p50Latency: 50, p99Latency: 150, errorRate: 0.01, throughput: 1000 },
      monitors: { cpuPercent: 40, memoryPercent: 50, diskIoMbps: 5, networkMbps: 10 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    const out = result.output as { forecastedRps: number; scalingNeeded: boolean };
    expect(out.forecastedRps).toBe(1200);
    expect(out.scalingNeeded).toBe(false);
  });

  it('recommends scaling when CPU headroom is insufficient for forecasted load', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: { p50Latency: 50, p99Latency: 200, errorRate: 0.01, throughput: 1000 },
      monitors: { cpuPercent: 85, memoryPercent: 70, diskIoMbps: 5, networkMbps: 10 },
    });
    const result = await agent.execute(ctx);
    const out = result.output as { scalingNeeded: boolean; scalingRecommendation: string };
    expect(out.scalingNeeded).toBe(true);
    expect(out.scalingRecommendation).toContain('scale');
  });

  it('skips when neither perfLog nor monitors is present', async () => {
    const ctx = makeCtx({ serviceId: 'svc', timestamp: 1000 });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd C:\Users\schinta\OpsAgents\packages\agents\predictive && npx vitest run tests/traffic-prediction.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement `packages/agents/predictive/src/traffic-prediction.ts`**

```typescript
import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';

export interface TrafficPredictionOutput {
  currentRps: number;
  forecastedRps: number;
  peakWindow: string;
  scalingNeeded: boolean;
  scalingRecommendation: string;
}

export class TrafficPredictionAgent extends BaseAgent {
  readonly id = 'traffic-prediction';
  readonly name = 'Traffic Prediction Agent';
  readonly category = AgentCategory.PREDICTIVE;
  readonly acceptedInputs = ['perf-log' as const, 'monitor' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const { perfLog, monitors } = context.inputs;

    if (!perfLog && !monitors) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No perfLog or monitors input provided' },
        durationMs: 0,
      };
    }

    const currentRps = perfLog?.throughput ?? 0;
    const forecastedRps = Math.round(currentRps * 1.2); // 20% growth baseline
    const cpuPercent = monitors?.cpuPercent ?? 50;

    // Headroom: how much more load can current CPU handle?
    // If CPU is at X%, then we have (100-X)% headroom.
    // Scaled to RPS: currentRps * ((100 - cpuPercent) / cpuPercent)
    const cpuHeadroomRps = cpuPercent > 0 ? Math.round(currentRps * (100 - cpuPercent) / cpuPercent) : 0;
    const scalingNeeded = forecastedRps > currentRps + cpuHeadroomRps;

    const scalingRecommendation = scalingNeeded
      ? `Add capacity to handle forecasted ${forecastedRps} RPS — current headroom ~${cpuHeadroomRps} RPS above current load`
      : `Sufficient headroom for forecasted ${forecastedRps} RPS — no immediate scaling needed`;

    return {
      agentId: this.id,
      status: 'success',
      output: {
        currentRps,
        forecastedRps,
        peakWindow: 'next 24 hours',
        scalingNeeded,
        scalingRecommendation,
      } satisfies TrafficPredictionOutput,
      recommendations: scalingNeeded ? [scalingRecommendation] : [],
      durationMs: 0,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
cd C:\Users\schinta\OpsAgents\packages\agents\predictive && npx vitest run tests/traffic-prediction.test.ts
```
Expected: PASS — 3 tests pass

- [ ] **Step 5: Commit**

```
git -C C:\Users\schinta\OpsAgents add packages/agents/predictive/src/traffic-prediction.ts packages/agents/predictive/tests/traffic-prediction.test.ts
git -C C:\Users\schinta\OpsAgents commit -m "feat(agents-predictive): add TrafficPredictionAgent with 20% growth forecast

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 8: TrafficDialUpAgent

**Files:**
- Create: `packages/agents/predictive/src/traffic-dial-up.ts`
- Create: `packages/agents/predictive/tests/traffic-dial-up.test.ts`

**Logic:** Recommends safe traffic percentage based on CPU headroom.
- `recommendedPercent = 100` if `cpuPercent < 50`
- `recommendedPercent = 50` if `cpuPercent` is 50–70
- `recommendedPercent = 20` if `cpuPercent` is 70–85
- `rollback = true` if `cpuPercent > 85`

- [ ] **Step 1: Write the failing test**

Create `packages/agents/predictive/tests/traffic-dial-up.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { TrafficDialUpAgent } from '../src/traffic-dial-up.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

const makeCtx = (inputs: ServiceInputs): AgentContext => ({
  sessionId: 'sess-1',
  serviceId: inputs.serviceId,
  triggeredBy: 'test',
  inputs,
  sharedState: {},
});

describe('TrafficDialUpAgent', () => {
  const agent = new TrafficDialUpAgent();

  it('has correct id and acceptedInputs', () => {
    expect(agent.id).toBe('traffic-dial-up');
    expect(agent.acceptedInputs).toContain('monitor');
  });

  it('recommends 100% traffic when cpu < 50', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 30, memoryPercent: 40, diskIoMbps: 5, networkMbps: 10 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    const out = result.output as { recommendedPercent: number; rollback: boolean };
    expect(out.recommendedPercent).toBe(100);
    expect(out.rollback).toBe(false);
  });

  it('recommends 50% traffic when cpu is 50-70', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 60, memoryPercent: 50, diskIoMbps: 5, networkMbps: 10 },
    });
    const result = await agent.execute(ctx);
    const out = result.output as { recommendedPercent: number };
    expect(out.recommendedPercent).toBe(50);
  });

  it('recommends 20% traffic when cpu is 70-85', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 78, memoryPercent: 50, diskIoMbps: 5, networkMbps: 10 },
    });
    const result = await agent.execute(ctx);
    const out = result.output as { recommendedPercent: number };
    expect(out.recommendedPercent).toBe(20);
  });

  it('signals rollback when cpu > 85', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 90, memoryPercent: 50, diskIoMbps: 5, networkMbps: 10 },
    });
    const result = await agent.execute(ctx);
    const out = result.output as { rollback: boolean };
    expect(out.rollback).toBe(true);
    expect(result.escalate).toBe(true);
  });

  it('skips when monitors input is absent', async () => {
    const ctx = makeCtx({ serviceId: 'svc', timestamp: 1000 });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd C:\Users\schinta\OpsAgents\packages\agents\predictive && npx vitest run tests/traffic-dial-up.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement `packages/agents/predictive/src/traffic-dial-up.ts`**

```typescript
import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';

export interface TrafficDialUpOutput {
  currentCpuPercent: number;
  recommendedPercent: number;
  rollback: boolean;
  rationale: string;
}

export class TrafficDialUpAgent extends BaseAgent {
  readonly id = 'traffic-dial-up';
  readonly name = 'Traffic Dial-Up Agent';
  readonly category = AgentCategory.PREDICTIVE;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const { monitors } = context.inputs;

    if (!monitors) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No monitors input provided' },
        durationMs: 0,
      };
    }

    const { cpuPercent } = monitors;

    if (cpuPercent > 85) {
      return {
        agentId: this.id,
        status: 'failure',
        output: {
          currentCpuPercent: cpuPercent,
          recommendedPercent: 0,
          rollback: true,
          rationale: `CPU at ${cpuPercent}% — rollback recommended to restore headroom`,
        } satisfies TrafficDialUpOutput,
        recommendations: ['Trigger rollback immediately', 'Investigate CPU spike cause'],
        escalate: true,
        durationMs: 0,
      };
    }

    const recommendedPercent = cpuPercent < 50 ? 100 : cpuPercent < 70 ? 50 : 20;

    const rationale =
      cpuPercent < 50
        ? `CPU at ${cpuPercent}% — safe to dial up to 100% traffic`
        : cpuPercent < 70
          ? `CPU at ${cpuPercent}% — dial up to 50% traffic and monitor`
          : `CPU at ${cpuPercent}% — conservative 20% traffic until CPU stabilises`;

    return {
      agentId: this.id,
      status: 'success',
      output: {
        currentCpuPercent: cpuPercent,
        recommendedPercent,
        rollback: false,
        rationale,
      } satisfies TrafficDialUpOutput,
      recommendations: recommendedPercent < 100 ? [rationale] : [],
      durationMs: 0,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
cd C:\Users\schinta\OpsAgents\packages\agents\predictive && npx vitest run tests/traffic-dial-up.test.ts
```
Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```
git -C C:\Users\schinta\OpsAgents add packages/agents/predictive/src/traffic-dial-up.ts packages/agents/predictive/tests/traffic-dial-up.test.ts
git -C C:\Users\schinta\OpsAgents commit -m "feat(agents-predictive): add TrafficDialUpAgent with CPU-based ramp logic

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 9: CriticalMetricsAgent

**Files:**
- Create: `packages/agents/predictive/src/critical-metrics.ts`
- Create: `packages/agents/predictive/tests/critical-metrics.test.ts`

**Logic:** Identifies which metrics are currently above warning thresholds and outputs updated alert definitions.
- CPU > 70% → critical
- Memory > 75% → critical
- Error rate > 0.03 → critical
- p99 > 300ms → critical

- [ ] **Step 1: Write the failing test**

Create `packages/agents/predictive/tests/critical-metrics.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { CriticalMetricsAgent } from '../src/critical-metrics.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

const makeCtx = (inputs: ServiceInputs): AgentContext => ({
  sessionId: 'sess-1',
  serviceId: inputs.serviceId,
  triggeredBy: 'test',
  inputs,
  sharedState: {},
});

describe('CriticalMetricsAgent', () => {
  const agent = new CriticalMetricsAgent();

  it('has correct id and acceptedInputs', () => {
    expect(agent.id).toBe('critical-metrics');
    expect(agent.acceptedInputs).toContain('perf-log');
    expect(agent.acceptedInputs).toContain('monitor');
  });

  it('returns no critical metrics when all values are within thresholds', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 40, memoryPercent: 50, diskIoMbps: 5, networkMbps: 10 },
      perfLog: { p50Latency: 30, p99Latency: 150, errorRate: 0.01, throughput: 1000 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    const out = result.output as { criticalMetrics: string[] };
    expect(out.criticalMetrics).toHaveLength(0);
  });

  it('identifies cpu as critical when > 70%', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 80, memoryPercent: 50, diskIoMbps: 5, networkMbps: 10 },
    });
    const result = await agent.execute(ctx);
    const out = result.output as { criticalMetrics: string[] };
    expect(out.criticalMetrics).toContain('cpuPercent');
  });

  it('identifies multiple critical metrics', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 80, memoryPercent: 80, diskIoMbps: 5, networkMbps: 10 },
      perfLog: { p50Latency: 100, p99Latency: 400, errorRate: 0.05, throughput: 500 },
    });
    const result = await agent.execute(ctx);
    const out = result.output as { criticalMetrics: string[] };
    expect(out.criticalMetrics).toContain('cpuPercent');
    expect(out.criticalMetrics).toContain('memoryPercent');
    expect(out.criticalMetrics).toContain('p99Latency');
    expect(out.criticalMetrics).toContain('errorRate');
  });

  it('skips when neither monitors nor perfLog is present', async () => {
    const ctx = makeCtx({ serviceId: 'svc', timestamp: 1000 });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd C:\Users\schinta\OpsAgents\packages\agents\predictive && npx vitest run tests/critical-metrics.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement `packages/agents/predictive/src/critical-metrics.ts`**

```typescript
import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';

export interface CriticalMetricsOutput {
  criticalMetrics: string[];
  alertThresholds: Record<string, number>;
  summary: string;
}

const THRESHOLDS: Record<string, number> = {
  cpuPercent: 70,
  memoryPercent: 75,
  errorRate: 0.03,
  p99Latency: 300,
};

export class CriticalMetricsAgent extends BaseAgent {
  readonly id = 'critical-metrics';
  readonly name = 'Critical Metrics Agent';
  readonly category = AgentCategory.PREDICTIVE;
  readonly acceptedInputs = ['perf-log' as const, 'monitor' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const { monitors, perfLog } = context.inputs;

    if (!monitors && !perfLog) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No monitors or perfLog input provided' },
        durationMs: 0,
      };
    }

    const criticalMetrics: string[] = [];

    if (monitors) {
      if (monitors.cpuPercent > THRESHOLDS.cpuPercent) criticalMetrics.push('cpuPercent');
      if (monitors.memoryPercent > THRESHOLDS.memoryPercent) criticalMetrics.push('memoryPercent');
    }

    if (perfLog) {
      if (perfLog.p99Latency > THRESHOLDS.p99Latency) criticalMetrics.push('p99Latency');
      if (perfLog.errorRate > THRESHOLDS.errorRate) criticalMetrics.push('errorRate');
    }

    const summary =
      criticalMetrics.length === 0
        ? 'All metrics within acceptable thresholds'
        : `${criticalMetrics.length} metric(s) above threshold: ${criticalMetrics.join(', ')}`;

    return {
      agentId: this.id,
      status: 'success',
      output: {
        criticalMetrics,
        alertThresholds: { ...THRESHOLDS },
        summary,
      } satisfies CriticalMetricsOutput,
      recommendations:
        criticalMetrics.length > 0
          ? [`Review and address: ${criticalMetrics.join(', ')}`]
          : [],
      durationMs: 0,
    };
  }
}
```

- [ ] **Step 4: Run all predictive tests**

```
cd C:\Users\schinta\OpsAgents\packages\agents\predictive && npx vitest run
```
Expected: 3 test files, all pass (3 + 5 + 4 = 12 tests)

- [ ] **Step 5: Commit**

```
git -C C:\Users\schinta\OpsAgents add packages/agents/predictive/src/critical-metrics.ts packages/agents/predictive/tests/critical-metrics.test.ts
git -C C:\Users\schinta\OpsAgents commit -m "feat(agents-predictive): add CriticalMetricsAgent with threshold-based metric classification

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 10: Predictive Package Barrel Export + Build

**Files:**
- Create: `packages/agents/predictive/src/index.ts`

- [ ] **Step 1: Create barrel export**

Create `packages/agents/predictive/src/index.ts`:
```typescript
export * from './traffic-prediction.js';
export * from './traffic-dial-up.js';
export * from './critical-metrics.js';
```

- [ ] **Step 2: Run all predictive tests**

```
cd C:\Users\schinta\OpsAgents\packages\agents\predictive && npx vitest run
```
Expected: All 12 tests pass

- [ ] **Step 3: Build predictive package**

```
cd C:\Users\schinta\OpsAgents\packages\agents\predictive && npx tsc
```
Expected: `packages/agents/predictive/dist/` created with no TypeScript errors.

- [ ] **Step 4: Commit**

```
git -C C:\Users\schinta\OpsAgents add packages/agents/predictive/src/index.ts packages/agents/predictive/dist
git -C C:\Users\schinta\OpsAgents commit -m "feat(agents-predictive): add barrel export and verify tsc build

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 11: DeploymentController

**Files:**
- Create: `packages/controllers/src/deployment-controller.ts`
- Create: `packages/controllers/tests/deployment-controller.test.ts`
- Modify: `packages/controllers/src/index.ts` — add export

**Sequence:** CiCdGovernance → DeploymentValidation → LagIndication → OnDemandTesting (stops on escalation). Uses `canHandle()` to skip agents that cannot process the available inputs.

- [ ] **Step 1: Write the failing test**

Create `packages/controllers/tests/deployment-controller.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { DeploymentController } from '../src/deployment-controller.js';
import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult, ServiceInputs } from '@opsagents/core';

// Always succeeds
class GreenAgent extends BaseAgent {
  constructor(public readonly id: string) { super(); }
  readonly name = 'Green Agent';
  readonly category = AgentCategory.DEPLOYMENT;
  readonly acceptedInputs = ['code' as const];
  readonly version = '0.1.0';
  protected async run(ctx: AgentContext): Promise<AgentResult> {
    return { agentId: this.id, status: 'success', output: { ok: true }, durationMs: 1 };
  }
}

// Always escalates
class EscalatingAgent extends BaseAgent {
  constructor(public readonly id: string) { super(); }
  readonly name = 'Escalating Agent';
  readonly category = AgentCategory.DEPLOYMENT;
  readonly acceptedInputs = ['code' as const];
  readonly version = '0.1.0';
  protected async run(ctx: AgentContext): Promise<AgentResult> {
    return { agentId: this.id, status: 'failure', output: { error: 'critical' }, escalate: true, durationMs: 1 };
  }
}

const makeInputs = (): ServiceInputs => ({
  serviceId: 'svc',
  timestamp: 1000,
  code: { coverage: 80, diff: 'diff', commitSha: 'abc' },
  monitors: { cpuPercent: 30, memoryPercent: 40, diskIoMbps: 1, networkMbps: 5 },
});

describe('DeploymentController', () => {
  it('has id "deployment-controller"', () => {
    expect(new DeploymentController().id).toBe('deployment-controller');
  });

  it('runs all agents when none escalate', async () => {
    const ctrl = new DeploymentController();
    ctrl.registerAgent(new GreenAgent('a1'));
    ctrl.registerAgent(new GreenAgent('a2'));
    ctrl.registerAgent(new GreenAgent('a3'));

    const result = await ctrl.orchestrate({ type: 'deployment', artifact: 'svc:v1' }, makeInputs());
    expect(result.agentResults).toHaveLength(3);
    expect(result.overallStatus).toBe('success');
  });

  it('stops executing after an escalating agent', async () => {
    const ctrl = new DeploymentController();
    ctrl.registerAgent(new GreenAgent('a1'));
    ctrl.registerAgent(new EscalatingAgent('a2')); // escalates
    ctrl.registerAgent(new GreenAgent('a3'));       // should NOT run

    const result = await ctrl.orchestrate({ type: 'deployment', artifact: 'svc:v1' }, makeInputs());
    // Only a1 and a2 should have run
    expect(result.agentResults).toHaveLength(2);
    expect(result.overallStatus).toBe('escalated');
  });

  it('skips agents that cannot handle available inputs', async () => {
    class NoInputAgent extends BaseAgent {
      readonly id = 'no-input';
      readonly name = 'No Input Agent';
      readonly category = AgentCategory.DEPLOYMENT;
      readonly acceptedInputs = ['incident' as const]; // incident not in inputs
      readonly version = '0.1.0';
      protected async run(ctx: AgentContext): Promise<AgentResult> {
        return { agentId: this.id, status: 'success', output: {}, durationMs: 0 };
      }
    }

    const ctrl = new DeploymentController();
    ctrl.registerAgent(new GreenAgent('a1'));
    ctrl.registerAgent(new NoInputAgent());

    const result = await ctrl.orchestrate({ type: 'deployment', artifact: 'svc:v1' }, makeInputs());
    // NoInputAgent is skipped — only a1 result
    expect(result.agentResults).toHaveLength(1);
    expect(result.agentResults[0].agentId).toBe('a1');
  });

  it('returns "failure" overallStatus when all agents fail without escalation', async () => {
    class FailAgent extends BaseAgent {
      readonly id = 'fail-only';
      readonly name = 'Fail Agent';
      readonly category = AgentCategory.DEPLOYMENT;
      readonly acceptedInputs = ['code' as const];
      readonly version = '0.1.0';
      protected async run(ctx: AgentContext): Promise<AgentResult> {
        return { agentId: this.id, status: 'failure', output: {}, durationMs: 0 };
      }
    }
    const ctrl = new DeploymentController();
    ctrl.registerAgent(new FailAgent());
    const result = await ctrl.orchestrate({ type: 'deployment', artifact: 'svc:v1' }, makeInputs());
    expect(result.overallStatus).toBe('failure');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd C:\Users\schinta\OpsAgents\packages\controllers && npx vitest run tests/deployment-controller.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement `packages/controllers/src/deployment-controller.ts`**

```typescript
import { BaseController } from '@opsagents/core';
import type { AgentContext, AgentResult, ServiceInputs, Trigger } from '@opsagents/core';

export class DeploymentController extends BaseController {
  readonly id = 'deployment-controller';
  readonly name = 'Deployment Controller';

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

    // Sequential execution — halt chain on any escalation
    for (const agent of this.getRegisteredAgents()) {
      if (!agent.canHandle(inputs)) {
        // Skip agents that cannot process available inputs
        continue;
      }

      const result = await agent.execute(ctx);
      results.push(result);

      if (result.escalate === true) {
        // Halt: further agents will not run
        break;
      }
    }

    return results;
  }
}
```

- [ ] **Step 4: Update `packages/controllers/src/index.ts`**

```typescript
export * from './meta-controller.js';
export * from './deployment-controller.js';
```

- [ ] **Step 5: Run all controller tests**

```
cd C:\Users\schinta\OpsAgents\packages\controllers && npx vitest run
```
Expected: All tests pass (3 meta + 4 deployment = 7 tests)

- [ ] **Step 6: Rebuild controllers**

```
cd C:\Users\schinta\OpsAgents\packages\controllers && npx tsc
```
Expected: No TypeScript errors.

- [ ] **Step 7: Commit**

```
git -C C:\Users\schinta\OpsAgents add packages/controllers/src/deployment-controller.ts packages/controllers/src/index.ts packages/controllers/tests/deployment-controller.test.ts packages/controllers/dist
git -C C:\Users\schinta\OpsAgents commit -m "feat(controllers): add DeploymentController with sequential execution and escalation halt

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 12: Integration Tests — Happy Path + Rollback

**Files:**
- Create: `services/example-service/tests/deployment-integration.test.ts`

This test wires real agents (from `@opsagents/agents-deployment`) into DeploymentController via ServiceAdapter, exercising the full stack.

- [ ] **Step 1: Write the failing test**

Create `services/example-service/tests/deployment-integration.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { ServiceAdapter } from '@opsagents/sdk';
import { DeploymentController } from '@opsagents/controllers';
import {
  CiCdGovernanceAgent,
  DeploymentValidationAgent,
  LagIndicationAgent,
  OnDemandTestingAgent,
} from '@opsagents/agents-deployment';

function makeController(): DeploymentController {
  const ctrl = new DeploymentController();
  ctrl.registerAgent(new CiCdGovernanceAgent());
  ctrl.registerAgent(new DeploymentValidationAgent());
  ctrl.registerAgent(new LagIndicationAgent());
  ctrl.registerAgent(new OnDemandTestingAgent());
  return ctrl;
}

describe('Deployment Integration — Happy Path', () => {
  it('all agents succeed and overall status is "success"', async () => {
    const adapter = new ServiceAdapter({
      serviceId: 'example-service',
      controllers: [makeController()],
    });

    const results = await adapter.run(
      { type: 'deployment', artifact: 'example-service:v2.0.0' },
      {
        serviceId: 'example-service',
        timestamp: Date.now(),
        code: { diff: '+feature', commitSha: 'def456', coverage: 85 },
        perfLog: { p50Latency: 40, p99Latency: 120, errorRate: 0.01, throughput: 800 },
        monitors: { cpuPercent: 35, memoryPercent: 45, diskIoMbps: 5, networkMbps: 10 },
      },
    );

    expect(results).toHaveLength(1);
    const orch = results[0];
    expect(orch.overallStatus).toBe('success');
    // All 4 agents should have run
    expect(orch.agentResults).toHaveLength(4);
    expect(orch.agentResults.every((r) => r.status === 'success')).toBe(true);
  });
});

describe('Deployment Integration — Rollback Path', () => {
  it('halts after CiCdGovernance escalates due to critically low coverage', async () => {
    const adapter = new ServiceAdapter({
      serviceId: 'example-service',
      controllers: [makeController()],
    });

    const results = await adapter.run(
      { type: 'deployment', artifact: 'example-service:v2.0.1' },
      {
        serviceId: 'example-service',
        timestamp: Date.now(),
        code: { diff: '+bad change', commitSha: 'bad001', coverage: 20 }, // < 50% → escalate
        perfLog: { p50Latency: 40, p99Latency: 120, errorRate: 0.01, throughput: 800 },
        monitors: { cpuPercent: 35, memoryPercent: 45, diskIoMbps: 5, networkMbps: 10 },
      },
    );

    expect(results).toHaveLength(1);
    const orch = results[0];
    // Controller halted after first agent escalated
    expect(orch.overallStatus).toBe('escalated');
    expect(orch.agentResults).toHaveLength(1);
    expect(orch.agentResults[0].agentId).toBe('ci-cd-governance');
    expect(orch.agentResults[0].escalate).toBe(true);
  });

  it('halts after LagIndication escalates due to high risk score', async () => {
    const adapter = new ServiceAdapter({
      serviceId: 'example-service',
      controllers: [makeController()],
    });

    const results = await adapter.run(
      { type: 'deployment', artifact: 'example-service:v2.0.2' },
      {
        serviceId: 'example-service',
        timestamp: Date.now(),
        code: { diff: '+patch', commitSha: 'lag001', coverage: 80 },  // governance passes
        perfLog: { p50Latency: 300, p99Latency: 900, errorRate: 0.25, throughput: 100 }, // high risk → escalate
        monitors: { cpuPercent: 35, memoryPercent: 45, diskIoMbps: 5, networkMbps: 10 }, // validation passes
      },
    );

    const orch = results[0];
    expect(orch.overallStatus).toBe('escalated');
    // governance + validation + lag = 3 agents, halted at lag
    expect(orch.agentResults).toHaveLength(3);
    expect(orch.agentResults[2].agentId).toBe('lag-indication');
    expect(orch.agentResults[2].escalate).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd C:\Users\schinta\OpsAgents\services\example-service && npx vitest run tests/deployment-integration.test.ts
```
Expected: FAIL — `Cannot find module '@opsagents/agents-deployment'` or `@opsagents/controllers`

- [ ] **Step 3: Update `services/example-service/package.json` dependencies**

Read the current `services/example-service/package.json`, then add the missing dependencies. It should look like:
```json
{
  "name": "example-service",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "build": "tsc"
  },
  "dependencies": {
    "@opsagents/core": "*",
    "@opsagents/sdk": "*",
    "@opsagents/controllers": "*",
    "@opsagents/agents-deployment": "*"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

Then run:
```
cd C:\Users\schinta\OpsAgents && npm install --legacy-peer-deps
```

- [ ] **Step 4: Run integration test to verify it passes**

```
cd C:\Users\schinta\OpsAgents\services\example-service && npx vitest run tests/deployment-integration.test.ts
```
Expected: PASS — 3 integration tests pass

- [ ] **Step 5: Run the full monorepo test suite**

```
cd C:\Users\schinta\OpsAgents && npm test
```
Expected: All packages pass — approximately 41 (CP-1) + 19 (deployment agents) + 12 (predictive agents) + 7 (controllers) + 3 (integration) = ~82 tests.

- [ ] **Step 6: Commit, tag, and push**

```
git -C C:\Users\schinta\OpsAgents add services/example-service/
git -C C:\Users\schinta\OpsAgents commit -m "feat(example): add deployment integration tests (happy path + rollback)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

git -C C:\Users\schinta\OpsAgents tag checkpoint/cp-2-deployment
git -C C:\Users\schinta\OpsAgents push origin master --tags
```

---

## Self-Review

**Spec coverage check:**
- ✅ `DeploymentController` with ordered sequential execution — Task 11
- ✅ `CiCdGovernanceAgent` (validates build + coverage) — Task 2
- ✅ `DeploymentValidationAgent` (smoke test / resource check) — Task 3
- ✅ `LagIndicationAgent` (replay perf risk scoring) — Task 4
- ✅ `OnDemandTestingAgent` (regression suite simulation) — Task 5
- ✅ `TrafficPredictionAgent` (24h forecast) — Task 7
- ✅ `TrafficDialUpAgent` (gradual ramp based on CPU) — Task 8
- ✅ `CriticalMetricsAgent` (metric threshold classification) — Task 9
- ✅ Integration tests: happy path (all 4 agents succeed) — Task 12
- ✅ Integration tests: rollback path (escalation halt at first agent, at third agent) — Task 12
- ✅ `checkpoint/cp-2-deployment` git tag — Task 12, Step 6
- ✅ Example service integrated with DeploymentController — Task 12

**Placeholder scan:** None found. All steps include complete code.

**Type consistency:**
- `AgentCategory.DEPLOYMENT` and `AgentCategory.PREDICTIVE` used consistently (defined in `@opsagents/core` types.ts)
- `acceptedInputs` use `'monitor' as const` (not `'monitors'`) — `canHandle()` maps `'monitor'` → `monitors` key internally in BaseAgent
- All output types use `satisfies OutputInterface` for compile-time checking
- `DeploymentController` extends `BaseController` from `@opsagents/core`
- `@opsagents/controllers` package.json already depends on `@opsagents/core` — check it also needs `@opsagents/agents-deployment` is NOT needed (integration test imports both separately)

*Next plan: `2026-06-03-cp3-monitoring-agents.md` — MonitoringController + 3 monitoring agents + alert routing to IncidentController.*
