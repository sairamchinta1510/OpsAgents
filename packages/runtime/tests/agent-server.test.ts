import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import { AgentServer } from '../src/agent-server.js';
import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';

class EchoAgent extends BaseAgent {
  readonly id = 'echo';
  readonly name = 'Echo Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';
  lastContext?: AgentContext & { trigger?: unknown };
  protected async run(ctx: AgentContext): Promise<AgentResult> {
    this.lastContext = ctx as AgentContext & { trigger?: unknown };
    return { agentId: this.id, status: 'success', output: { echo: ctx.inputs.serviceId }, durationMs: 1 };
  }
}

async function request(
  port: number,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  return requestRaw(port, method, path, body ? JSON.stringify(body) : undefined);
}

async function requestRaw(
  port: number,
  method: string,
  path: string,
  rawBody?: string,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method,
        headers: { 'Content-Type': 'application/json', ...(rawBody ? { 'Content-Length': Buffer.byteLength(rawBody) } : {}) } },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }));
      },
    );
    req.on('error', reject);
    if (rawBody) req.write(rawBody);
    req.end();
  });
}

describe('AgentServer', () => {
  let server: AgentServer;
  let agent: EchoAgent;
  const PORT = 14321;

  beforeEach(async () => {
    agent = new EchoAgent();
    server = new AgentServer(agent);
    await server.start(PORT);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('GET /info returns agent metadata', async () => {
    const res = await request(PORT, 'GET', '/info');
    expect(res.status).toBe(200);
    const body = res.body as { id: string; name: string; version: string; enabled: boolean };
    expect(body.id).toBe('echo');
    expect(body.name).toBe('Echo Agent');
    expect(body.enabled).toBe(true);
  });

  it('GET /health returns ok when enabled', async () => {
    const res = await request(PORT, 'GET', '/health');
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe('ok');
  });

  it('POST /execute runs the agent and returns AgentResult', async () => {
    const trigger = { type: 'manual', serviceId: 'svc-from-trigger', timestamp: Date.now() };
    const res = await request(PORT, 'POST', '/execute', {
      trigger,
      inputs: {
        serviceId: 'test-svc',
        timestamp: Date.now(),
        monitors: { cpuPercent: 30, memoryPercent: 40, diskIoMbps: 1, networkMbps: 5 },
      },
    });
    expect(res.status).toBe(200);
    const body = res.body as { agentId: string; status: string };
    expect(body.agentId).toBe('echo');
    expect(body.status).toBe('success');
    expect(agent.lastContext?.trigger).toEqual(trigger);
  });

  it('GET /metrics returns invocation metrics', async () => {
    await request(PORT, 'POST', '/execute', {
      inputs: { serviceId: 'svc', timestamp: Date.now(), monitors: { cpuPercent: 30, memoryPercent: 40, diskIoMbps: 1, networkMbps: 5 } },
    });
    expect(agent.lastContext?.trigger).toMatchObject({ type: 'manual', serviceId: 'unknown' });
    expect(typeof (agent.lastContext?.trigger as { timestamp?: unknown } | undefined)?.timestamp).toBe('number');
    const res = await request(PORT, 'GET', '/metrics');
    expect(res.status).toBe(200);
    const m = res.body as { invocationCount: number };
    expect(m.invocationCount).toBe(1);
  });

  it('PUT /control disables the agent', async () => {
    const res = await request(PORT, 'PUT', '/control', { enabled: false });
    expect(res.status).toBe(200);
    const health = await request(PORT, 'GET', '/health');
    expect((health.body as { status: string }).status).toBe('disabled');
  });

  it('PUT /control re-enables the agent', async () => {
    await request(PORT, 'PUT', '/control', { enabled: false });
    await request(PORT, 'PUT', '/control', { enabled: true });
    const health = await request(PORT, 'GET', '/health');
    expect((health.body as { status: string }).status).toBe('ok');
  });

  it('PUT /control with missing enabled returns 400', async () => {
    const res = await request(PORT, 'PUT', '/control', {});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: '`enabled` must be a boolean' });

    const health = await request(PORT, 'GET', '/health');
    expect((health.body as { status: string }).status).toBe('ok');
  });

  it('POST /execute with invalid JSON returns 400', async () => {
    const res = await requestRaw(PORT, 'POST', '/execute', '{');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON body' });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(PORT, 'GET', '/unknown');
    expect(res.status).toBe(404);
  });

  it('start rejects when the port is already in use', async () => {
    const otherServer = new AgentServer(new EchoAgent());
    await expect(otherServer.start(PORT)).rejects.toThrow();
    await otherServer.stop().catch(() => undefined);
  });
});
