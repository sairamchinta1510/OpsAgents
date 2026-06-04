/**
 * OpsAgents Real Simulation Server
 *
 * Auto-detection: an ErrorWatchdog monitors every real HTTP response from the
 * embedded EPG service. When the rolling error window breaches threshold, it
 * automatically fires the full OpsAgents pipeline — no human click required.
 *
 * Usage:  npx tsx services/epg-service/demo/simulation-server.ts
 * Open:   http://localhost:3000/opsagents-simulator.html
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { EventBus } from '@opsagents/core';
import { MetaController } from '@opsagents/controllers';
import { IncidentController } from '@opsagents/controllers-incident';
import { AgentRegistry } from '@opsagents/core';
import { RepoConnector, LogWatcher, PatchAgent, AutoRemediationAgent } from '@opsagents/agents-reliability';
import { ALL_SCENARIOS } from './scenarios/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR WATCHDOG — auto-detects failure conditions and fires OpsAgents
// ═══════════════════════════════════════════════════════════════════════════════

interface ResponseRecord {
  ts: number;
  statusCode: number;
  path: string;
  ms: number;
  errorCode?: string;
  errorMessage?: string;
}

interface AutoTriggerReason {
  errorCount: number;
  totalRequests: number;
  errorRate: number;
  p50: number;
  p99: number;
  dominantError: string;
  recentErrors: ResponseRecord[];
  windowMs: number;
  triggeredBy: 'error-rate' | 'error-count' | 'process-crash' | 'unhandled-rejection';
}

class ErrorWatchdog {
  private window: ResponseRecord[] = [];
  readonly windowMs = 60_000;
  readonly errorCountThreshold = 5;
  readonly errorRateThreshold = 0.25;
  readonly cooldownMs = 20_000;
  private lastTriggerTs = 0;
  private enabled = false;
  private onTrigger: (reason: AutoTriggerReason) => void;

  constructor(onTrigger: (reason: AutoTriggerReason) => void) {
    this.onTrigger = onTrigger;
  }

  enable()  { this.enabled = true;  console.log('🔍 Auto-detect ENABLED'); }
  disable() { this.enabled = false; console.log('🔕 Auto-detect DISABLED'); }
  isEnabled() { return this.enabled; }

  record(rec: ResponseRecord) {
    const now = Date.now();
    this.window.push(rec);
    // Evict entries outside rolling window
    this.window = this.window.filter(e => now - e.ts < this.windowMs);
    if (this.enabled) this.evaluate();
  }

  getMetrics() {
    const now = Date.now();
    const recent = this.window.filter(e => now - e.ts < this.windowMs);
    const errors = recent.filter(e => e.statusCode >= 500);
    const latencies = recent.map(e => e.ms).sort((a, b) => a - b);
    return {
      totalRequests: recent.length,
      errorCount: errors.length,
      errorRate: recent.length > 0 ? errors.length / recent.length : 0,
      p50: percentile(latencies, 50),
      p99: percentile(latencies, 99),
      windowMs: this.windowMs,
      enabled: this.enabled,
      cooldownRemaining: Math.max(0, this.cooldownMs - (now - this.lastTriggerTs)),
    };
  }

  private evaluate() {
    const now = Date.now();
    if (now - this.lastTriggerTs < this.cooldownMs) return;

    const recent = this.window.filter(e => now - e.ts < this.windowMs);
    const errors = recent.filter(e => e.statusCode >= 500 || e.statusCode === 0);
    if (recent.length < 3) return; // need enough data

    const errorRate = errors.length / recent.length;
    const meetsCount = errors.length >= this.errorCountThreshold;
    const meetsRate  = errorRate >= this.errorRateThreshold;

    if (!meetsCount && !meetsRate) return;

    this.lastTriggerTs = now;

    const latencies = recent.map(e => e.ms).sort((a, b) => a - b);
    const errCounts = errors.reduce<Record<string, number>>((acc, e) => {
      const k = e.errorCode ?? String(e.statusCode);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
    const dominantError = Object.entries(errCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'UNKNOWN';

    this.onTrigger({
      errorCount: errors.length,
      totalRequests: recent.length,
      errorRate,
      p50: percentile(latencies, 50),
      p99: percentile(latencies, 99),
      dominantError,
      recentErrors: errors.slice(-5),
      windowMs: this.windowMs,
      triggeredBy: meetsRate ? 'error-rate' : 'error-count',
    });
  }

  triggerFromCrash(message: string, type: 'process-crash' | 'unhandled-rejection') {
    if (!this.enabled) return;
    const now = Date.now();
    if (now - this.lastTriggerTs < this.cooldownMs) return;
    this.lastTriggerTs = now;
    this.onTrigger({
      errorCount: 1, totalRequests: 1, errorRate: 1,
      p50: 0, p99: 0,
      dominantError: message.slice(0, 80),
      recentErrors: [],
      windowMs: this.windowMs,
      triggeredBy: type,
    });
  }
}

// ─── SSE client registry ──────────────────────────────────────────────────────
type SSEClient = {
  id: string;
  res: express.Response;
  write: (event: string, data: unknown) => void;
};
const sseClients = new Map<string, SSEClient>();

function makeClient(id: string, res: express.Response): SSEClient {
  return {
    id, res,
    write(event: string, data: unknown) {
      try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
    },
  };
}

function broadcastAll(event: string, data: unknown) {
  for (const client of sseClients.values()) client.write(event, data);
}

// ─── Simulation state ─────────────────────────────────────────────────────────
let simulationRunning = false;
let currentRepoConfig: any = null;
let currentLogWatcher: any = null;
let currentPatch: any = null;

// ─── Watchdog instantiation ───────────────────────────────────────────────────
const watchdog = new ErrorWatchdog(async (reason) => {
  console.log(`\n🚨 Auto-detected incident! trigger=${reason.triggeredBy} errors=${reason.errorCount}/${reason.totalRequests} (${(reason.errorRate*100).toFixed(0)}%)`);
  broadcastAll('auto:detected', {
    ...reason,
    message: `Auto-detected: ${reason.errorCount}/${reason.totalRequests} errors (${(reason.errorRate*100).toFixed(0)}%) in last ${reason.windowMs/1000}s`,
  });
  if (!simulationRunning) {
    await autoRunOrchestration(reason);
  } else {
    broadcastAll('auto:skipped', { message: 'Simulation already running — watchdog queued' });
  }
});

// Process-level crash hooks — catches real Node.js fatal errors
process.on('uncaughtException', (err) => {
  console.error('💥 uncaughtException:', err.message);
  broadcastAll('process:crash', { type: 'uncaughtException', message: err.message, stack: err.stack });
  watchdog.triggerFromCrash(err.message, 'process-crash');
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error('💥 unhandledRejection:', msg);
  broadcastAll('process:crash', { type: 'unhandledRejection', message: msg });
  watchdog.triggerFromCrash(msg, 'unhandled-rejection');
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-ORCHESTRATION — builds ServiceInputs from real watchdog evidence
// ═══════════════════════════════════════════════════════════════════════════════

async function autoRunOrchestration(reason: AutoTriggerReason) {
  // Map the dominant error to a severity and incident type
  const isNullPointer    = reason.dominantError === 'NULL_POINTER' || reason.dominantError.includes('null');
  const isUpstreamDown   = reason.dominantError === 'UPSTREAM_DOWN' || reason.dominantError === '503';
  const isPoolExhausted  = reason.dominantError === 'POOL_EXHAUSTED';
  const isConfigMissing  = reason.dominantError === 'CONFIG_MISSING';
  const isCritical       = reason.errorRate >= 0.8 || reason.triggeredBy === 'process-crash';
  const severity         = isCritical ? 'critical' : 'high';

  const incidentMessage =
    isNullPointer   ? `Null pointer exception in EPG pipeline — ${reason.errorCount} requests failed with TypeError` :
    isUpstreamDown  ? `Upstream EPG provider unreachable — ${(reason.errorRate*100).toFixed(0)}% requests returning 503` :
    isPoolExhausted ? `DB connection pool exhausted — ${reason.errorCount} requests rejected` :
    isConfigMissing ? `Service misconfiguration — missing required environment variables` :
    `Service degraded — ${reason.errorCount}/${reason.totalRequests} requests failed (${(reason.errorRate*100).toFixed(0)}%)`;

  const inputs = {
    serviceId: 'epg-service',
    timestamp: Date.now(),
    incident: {
      alertId: `auto-${Date.now()}`,
      severity,
      message: incidentMessage,
      source: 'opsagents:error-watchdog',
      timestamp: Date.now(),
    },
    perfLog: {
      p50Latency: reason.p50 || 200,
      p99Latency: Math.max(reason.p99 || 500, reason.errorRate > 0.5 ? 900 : 500),
      errorRate: reason.errorRate,
      throughput: reason.totalRequests / (reason.windowMs / 1000),
    },
    monitors: {
      cpuPercent: isCritical ? 85 : 65,
      memoryPercent: reason.dominantError === 'POOL_EXHAUSTED' ? 78 : 55,
      diskIoMbps: 20,
      networkMbps: isUpstreamDown ? 2 : 45,
    },
    ...(isNullPointer && {
      code: {
        diff: `--- a/src/epg-pipeline.ts\n+++ b/src/epg-pipeline.ts\n-  const endIso = programme.end_time.toISOString();\n+  const endIso = programme.end_time?.toISOString() ?? 'OPEN_END';`,
        commitSha: 'f3a9c2e',
        files: ['src/epg-pipeline.ts'],
        coverage: 54,
      },
    }),
    codeRepo: 'github.com/org/opsagents',
    metadata: {
      deploymentVersion: '2.3.1',
      affectedChannels: ['bbc-one', 'bbc-two'],
      autoDetected: true,
      watchdogReason: reason,
      epgFaultMode,
    },
  };

  broadcastAll('auto:orchestrating', {
    message: `🤖 OpsAgents auto-triggered — running full pipeline for "${incidentMessage.slice(0, 60)}…"`,
    severity,
    inputs,
  });

  await runOrchestration({ type: 'alert', severity }, inputs as any, 'auto');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMBEDDED EPG HTTP SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

type EpgFaultMode = 'normal' | 'null-pointer' | 'slow' | 'cpu-stress' |
  'memory-pressure' | 'disk-io' | 'upstream-down' | 'pool-exhausted' |
  'config-missing' | 'flood';

let epgFaultMode: EpgFaultMode = 'normal';
let epgActiveConnections = 0;
const EPG_POOL_LIMIT = 10;

// Middleware: intercept every EPG response and record it in the watchdog
app.use('/epg', (req, res, next) => {
  const start = Date.now();
  const originalJson = res.json.bind(res);
  (res as any).json = (data: unknown) => {
    const ms = Date.now() - start;
    const body = data as Record<string, unknown>;
    watchdog.record({
      ts: Date.now(), statusCode: res.statusCode,
      path: req.path, ms,
      errorCode: typeof body?.code === 'string' ? body.code : undefined,
      errorMessage: typeof body?.message === 'string' ? body.message : undefined,
    });
    // Broadcast live request metrics to all SSE clients
    broadcastAll('epg:request', {
      method: req.method, path: req.path,
      statusCode: res.statusCode, ms,
      faultMode: epgFaultMode,
      metrics: watchdog.getMetrics(),
    });
    return originalJson(data);
  };
  next();
});

// POST /epg/fault
app.post('/epg/fault', (req, res) => {
  const { mode } = req.body as { mode: EpgFaultMode };
  epgFaultMode = mode ?? 'normal';
  epgActiveConnections = 0;
  broadcastAll('epg:fault-changed', { mode: epgFaultMode });
  res.json({ ok: true, mode: epgFaultMode });
});

// POST /epg/break — one-click: inject null-pointer fault (simulates bad deployment)
app.post('/epg/break', (req, res) => {
  const { mode = 'null-pointer' } = req.body as { mode?: EpgFaultMode };
  epgFaultMode = mode;
  epgActiveConnections = 0;
  console.log(`\n🔴 EPG service broken — fault mode: ${epgFaultMode}`);
  broadcastAll('epg:broken', { mode: epgFaultMode, message: `EPG service set to fault mode: ${mode}` });
  res.json({ ok: true, mode: epgFaultMode, message: `Service broken — fault mode: ${mode}` });
});

// GET /epg/health
app.get('/epg/health', (_req, res) => {
  res.json({
    status: epgFaultMode === 'normal' ? 'ok' : 'degraded',
    version: '2.3.1', faultMode: epgFaultMode,
    activeConnections: epgActiveConnections,
    watchdog: watchdog.getMetrics(),
  });
});

// GET /epg/metrics — live watchdog state
app.get('/epg/metrics', (_req, res) => {
  res.json(watchdog.getMetrics());
});

// POST /epg/auto-detect — toggle watchdog
app.post('/epg/auto-detect', (req, res) => {
  const { enabled } = req.body as { enabled: boolean };
  if (enabled) watchdog.enable(); else watchdog.disable();
  broadcastAll('watchdog:toggled', { enabled });
  res.json({ ok: true, enabled });
});

// GET /epg/schedule/:channelId
app.get('/epg/schedule/:channelId', async (req, res) => {
  const { channelId } = req.params;
  const schedule = {
    channel: { id: channelId, name: channelId.replace(/-/g, ' ').toUpperCase(), region: 'UK' },
    programmes: [
      { channel_id: channelId, title: 'Morning News',  start_time: '2024-11-15T06:00:00Z', end_time: '2024-11-15T09:00:00Z', category: 'News' },
      { channel_id: channelId, title: 'Daytime Show',  start_time: '2024-11-15T09:00:00Z', end_time: '2024-11-15T12:00:00Z', category: 'Entertainment' },
      { channel_id: channelId, title: 'Evening Drama', start_time: '2024-11-15T18:00:00Z', end_time: '2024-11-15T19:00:00Z', category: 'Drama' },
      { channel_id: channelId, title: 'Late Film',     start_time: '2024-11-15T21:00:00Z', end_time: null as any,             category: 'Film' },
    ],
  };

  try {
    switch (epgFaultMode) {
      case 'normal': {
        const { processSchedule } = await import('../src/epg-pipeline-fixed.js');
        const warnings = processSchedule(schedule as any);
        res.json({ channelId, programmes: schedule.programmes.length, warnings, status: 'ok' });
        break;
      }
      case 'null-pointer': {
        try {
          const nullProg = schedule.programmes.find(p => p.end_time === null);
          if (nullProg) { const x = (nullProg.end_time as any).toISOString(); void x; }
          res.json({ channelId, programmes: schedule.programmes.length });
        } catch (err) {
          res.status(500).json({ error: 'Pipeline error', code: 'NULL_POINTER', message: err instanceof Error ? err.message : String(err), file: 'epg-pipeline.ts:processSchedule', version: '2.3.1' });
        }
        break;
      }
      case 'slow': {
        const d = 1200 + Math.random() * 1800;
        await new Promise(r => setTimeout(r, d));
        res.json({ channelId, programmes: schedule.programmes.length, upstreamMs: Math.round(d) });
        break;
      }
      case 'cpu-stress': {
        const t0 = Date.now(); let x = 0;
        for (let i = 0; i < 3_000_000; i++) x += Math.sqrt(i); void x;
        res.json({ channelId, programmes: schedule.programmes.length, cpuMs: Date.now() - t0 });
        break;
      }
      case 'memory-pressure': {
        const buf = Buffer.alloc(50 * 1024 * 1024, 0xff);
        await new Promise(r => setTimeout(r, 100));
        void buf.length;
        res.json({ channelId, programmes: schedule.programmes.length, allocatedMB: 50 });
        break;
      }
      case 'disk-io': {
        const f = path.join(os.tmpdir(), `epg-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
        fs.writeFileSync(f, JSON.stringify(schedule));
        const parsed = JSON.parse(fs.readFileSync(f, 'utf8'));
        fs.unlinkSync(f);
        res.json({ channelId, programmes: parsed.programmes.length, diskNote: 'write+read+delete' });
        break;
      }
      case 'upstream-down': {
        await new Promise(r => setTimeout(r, 150 + Math.random() * 200));
        res.status(503).json({ error: 'Upstream EPG provider unavailable', code: 'UPSTREAM_DOWN', retryAfter: 30 });
        break;
      }
      case 'pool-exhausted': {
        if (epgActiveConnections >= EPG_POOL_LIMIT) {
          res.status(503).json({ error: 'DB connection pool exhausted', code: 'POOL_EXHAUSTED', activeConnections: epgActiveConnections, maxPool: EPG_POOL_LIMIT });
          return;
        }
        epgActiveConnections++;
        try { await new Promise(r => setTimeout(r, 200 + Math.random() * 300)); res.json({ channelId, programmes: schedule.programmes.length }); }
        finally { epgActiveConnections--; }
        break;
      }
      case 'config-missing': {
        const required = ['EPG_PROVIDER_URL', 'DB_CONNECTION_STRING', 'AUTH_SECRET', 'REDIS_URL'];
        const missing = required.filter(k => !process.env[k]);
        res.status(500).json({ error: 'Service misconfigured', code: 'CONFIG_MISSING', missingKeys: missing, message: `Missing: ${missing.join(', ')}` });
        break;
      }
      case 'flood': {
        const qMs = epgActiveConnections * 80;
        epgActiveConnections++;
        try { await new Promise(r => setTimeout(r, qMs)); res.json({ channelId, programmes: schedule.programmes.length, queuedMs: qMs }); }
        finally { epgActiveConnections--; }
        break;
      }
      default: res.status(400).json({ error: `Unknown fault mode: ${epgFaultMode}` });
    }
  } catch (err) {
    res.status(500).json({ error: 'Unhandled server error', message: String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/scenarios', (_req, res) => {
  res.json(ALL_SCENARIOS.map(s => ({ id: s.id, name: s.name, icon: s.icon, description: s.description, severity: s.severity })));
});

app.get('/api/stream/:clientId', (req, res) => {
  const { clientId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const client = makeClient(clientId, res);
  sseClients.set(clientId, client);

  // Send current watchdog state on connect
  client.write('watchdog:state', watchdog.getMetrics());

  const hb = setInterval(() => { try { res.write(': heartbeat\n\n'); } catch { clearInterval(hb); } }, 15_000);
  req.on('close', () => { clearInterval(hb); sseClients.delete(clientId); });
});

app.post('/api/simulate', async (req, res) => {
  const { scenarioId, clientId } = req.body as { scenarioId: string; clientId: string };
  const scenario = ALL_SCENARIOS.find(s => s.id === scenarioId);
  if (!scenario) { res.status(404).json({ error: `Unknown scenario: ${scenarioId}` }); return; }
  const client = sseClients.get(clientId);
  if (!client) { res.status(400).json({ error: 'SSE client not connected.' }); return; }
  res.json({ ok: true, scenarioId, message: 'Simulation started.' });
  setImmediate(() => runScenario(scenario, client).catch(err => client.write('error', { message: String(err) })));
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

async function runOrchestration(trigger: { type: string; severity: string }, inputs: Record<string, unknown>, sourceLabel: string) {
  if (simulationRunning) return;
  simulationRunning = true;

  const startTs = Date.now();
  const bus = new EventBus();
  const agentTimeline: Array<{ id: string; name?: string; startTs?: number; endTs?: number; status?: string }> = [];

  const ALL_EVENTS = [
    'meta-controller:started', 'meta-controller:controller-started',
    'meta-controller:controller-completed', 'meta-controller:controller-failed',
    'meta-controller:completed', 'meta-controller:failed',
    'incident-controller:agent-started', 'incident-controller:agent-completed', 'incident-controller:agent-failed',
    'deployment-controller:agent-started', 'deployment-controller:agent-completed',
    'monitoring-controller:agent-started', 'monitoring-controller:agent-completed',
    'infrastructure-controller:agent-started', 'infrastructure-controller:agent-completed',
  ];

  const unsubs: Array<() => void> = [];
  for (const event of ALL_EVENTS) {
    const unsub = bus.subscribe(event as any, (payload: unknown) => {
      const p = payload as Record<string, unknown>;
      if (event.endsWith(':agent-started')) {
        const id = String(p.agentId ?? p.id ?? event);
        agentTimeline.push({ id, name: String(p.agentName ?? id), startTs: Date.now() });
      } else if (event.endsWith(':agent-completed') || event.endsWith(':agent-failed')) {
        const id = String(p.agentId ?? p.id ?? event);
        const entry = agentTimeline.find(e => e.id === id && !e.endTs);
        if (entry) { entry.endTs = Date.now(); entry.status = event.endsWith(':failed') ? 'failed' : 'ok'; }
      }
      broadcastAll('pipeline:event', { event, payload, ts: Date.now(), source: sourceLabel });
    });
    unsubs.push(unsub);
  }

  const registry = new AgentRegistry();
  const incidentCtrl = new IncidentController(registry, bus);
  const meta = new MetaController(bus);
  meta.addDomainController(incidentCtrl, 30_000);

  try {
    broadcastAll('sim:orchestrating', { message: `MetaController.orchestrate() [${sourceLabel}] — pipeline running…`, source: sourceLabel });
    const result = await meta.orchestrate(trigger as any, inputs as any);
    broadcastAll('sim:complete', { durationMs: Date.now() - startTs, result, timeline: agentTimeline, source: sourceLabel });
    // Send reasoning tree for optional enhancement
    broadcastAll('reasoning:tree', { steps: agentTimeline ?? [] });
    console.log(`✅ OpsAgents pipeline complete [${sourceLabel}] in ${Date.now() - startTs}ms`);
  } catch (err) {
    broadcastAll('sim:error', { stage: 'orchestration', message: String(err), source: sourceLabel });
  } finally {
    for (const u of unsubs) u();
    simulationRunning = false;
    epgFaultMode = 'normal';
    epgActiveConnections = 0;
  }
}

async function runScenario(scenario: typeof ALL_SCENARIOS[0], client: SSEClient) {
  const startTs = Date.now();
  client.write('sim:start', { scenarioId: scenario.id, scenarioName: scenario.name, icon: scenario.icon, severity: scenario.severity, ts: startTs });
  client.write('sim:setup', { message: `Setting up real failure for "${scenario.name}"…` });

  let setup: Awaited<ReturnType<typeof scenario.setup>>;
  try { setup = await scenario.setup(); }
  catch (err) { client.write('error', { stage: 'setup', message: String(err) }); return; }

  client.write('sim:condition', { name: setup.realCondition.name, detail: setup.realCondition.detail, raw: setup.realCondition.raw, inputs: setup.inputs });
  await runOrchestration(setup.trigger as any, setup.inputs as any, scenario.id);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(Math.ceil((p / 100) * sorted.length) - 1, sorted.length - 1);
  return sorted[Math.max(0, idx)];
}

// ─── Auto Remediation ─────────────────────────────────────────────────────────
async function autoRunRemediationForError(errorRecord: any): Promise<void> {
  try {
    broadcastAll('log:error', { message: `Auto-remediation triggered for ${errorRecord.errorType}` });
    
    // Run AutoRemediationAgent
    const remediationAgent = new AutoRemediationAgent();
    const remediationResult = remediationAgent.remediate(errorRecord);
    broadcastAll('remediation:applied', remediationResult);
    
    // If code-fix action exists and we have a file reference, apply patch
    const codeFix = remediationResult.actions.find((a: any) => a.type === 'code-fix');
    if (codeFix && errorRecord.file && currentRepoConfig) {
      try {
        const sourceContent = fs.readFileSync(errorRecord.file, 'utf8');
        const patchAgent = new PatchAgent();
        const patchedContent = patchAgent.generatePatch(errorRecord, sourceContent);
        
        if (patchedContent !== sourceContent) {
          const patchResult = patchAgent.applyPatch({
            errorRecord,
            cloneDir: currentRepoConfig.cloneDir,
            repoUrl: currentRepoConfig.repoUrl,
            originalContent: sourceContent,
            patchedContent,
            targetFile: errorRecord.file
          });
          currentPatch = patchResult;
          broadcastAll('patch:ready', patchResult);
        }
      } catch (patchErr) {
        broadcastAll('log:error', { message: `Patch failed: ${String(patchErr)}` });
      }
    }
    
    // Run exec summary
    broadcastAll('exec:summary', { summary: remediationResult.summary, requiresHumanReview: remediationResult.requiresHumanReview });
    
  } catch (err) {
    broadcastAll('log:error', { message: `Remediation error: ${String(err)}` });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-REMEDIATION API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/connect-repo
app.post('/api/connect-repo', (req, res) => {
  const { repoUrl, cloneDir, branch } = req.body as { repoUrl: string; cloneDir: string; branch?: string };
  if (!repoUrl || !cloneDir) return res.status(400).json({ error: 'repoUrl and cloneDir required' });
  
  currentRepoConfig = { repoUrl, cloneDir, branch };
  broadcastAll('repo:connecting', { repoUrl, cloneDir });
  
  try {
    const connector = new RepoConnector();
    const result = connector.connect({ repoUrl, cloneDir, branch });
    broadcastAll('repo:connected', result);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/start-watching
app.post('/api/start-watching', (req, res) => {
  const { logPaths, language } = req.body as { logPaths: string[]; language: string };
  if (!logPaths?.length) return res.status(400).json({ error: 'logPaths required' });
  
  if (currentLogWatcher) currentLogWatcher.stopWatching();
  
  currentLogWatcher = new LogWatcher(language ?? 'unknown', (errorRecord) => {
    broadcastAll('log:error', errorRecord);
    // Trigger auto-remediation pipeline
    autoRunRemediationForError(errorRecord);
  });
  
  currentLogWatcher.startWatching(logPaths);
  logPaths.forEach(p => broadcastAll('repo:log-discovered', { path: p }));
  res.json({ ok: true, watching: logPaths });
});

// POST /api/stop-watching
app.post('/api/stop-watching', (_req, res) => {
  if (currentLogWatcher) {
    currentLogWatcher.stopWatching();
    currentLogWatcher = null;
  }
  res.json({ ok: true });
});

// POST /api/push-pr
app.post('/api/push-pr', (req, res) => {
  if (!currentPatch) return res.status(400).json({ error: 'No patch pending' });
  broadcastAll('patch:pushed', currentPatch);
  res.json({ ok: true, patch: currentPatch });
  currentPatch = null;
});

// GET /api/repo-status
app.get('/api/repo-status', (_req, res) => {
  res.json({
    repoConfig: currentRepoConfig,
    isWatching: !!currentLogWatcher,
    pendingPatch: currentPatch
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════════

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n✅ OpsAgents Simulation Server running at http://localhost:${PORT}`);
  console.log(`   Dashboard: http://localhost:${PORT}/opsagents-simulator.html`);
  console.log(`   EPG API:   http://localhost:${PORT}/epg/health`);
  console.log(`   Auto-detect: POST /epg/auto-detect {"enabled":true}`);
  console.log(`   Break EPG:   POST /epg/break {"mode":"null-pointer"}\n`);
  console.log('   Auto-detection thresholds:');
  console.log(`     Error count: ≥${watchdog.errorCountThreshold} errors in ${watchdog.windowMs/1000}s window`);
  console.log(`     Error rate:  ≥${watchdog.errorRateThreshold*100}% of requests failing`);
  console.log(`     Cooldown:    ${watchdog.cooldownMs/1000}s between triggers\n`);
});
