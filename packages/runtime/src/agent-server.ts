import * as http from 'node:http';
import type { IAgent, ServiceInputs, Trigger } from '@opsagents/core';

type ControllableAgent = IAgent & {
  enable(): void;
  disable(): void;
};

export interface AgentServerOptions {
  port: number;
  host?: string;
}

export class AgentServer {
  private readonly server: http.Server;
  private readonly agent: ControllableAgent;
  private readonly port: number;
  private readonly host: string;

  constructor(agent: IAgent, options: AgentServerOptions) {
    this.agent = agent as ControllableAgent;
    this.port = options.port;
    this.host = options.host ?? '0.0.0.0';
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.server.keepAliveTimeout = 0;
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, this.host, () => resolve());
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()));
      this.server.closeAllConnections();
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    try {
      if (method === 'GET' && url === '/info') {
        return this.json(res, 200, {
          id: this.agent.id,
          name: this.agent.name,
          version: this.agent.version,
          category: this.agent.category,
          acceptedInputs: this.agent.acceptedInputs,
          enabled: this.agent.isEnabled(),
        });
      }

      if (method === 'GET' && url === '/health') {
        const enabled = this.agent.isEnabled();
        return this.json(res, 200, {
          status: enabled ? 'ok' : 'disabled',
          agentId: this.agent.id,
          timestamp: new Date().toISOString(),
        });
      }

      if (method === 'GET' && url === '/metrics') {
        return this.json(res, 200, this.agent.getMetrics());
      }

      if (method === 'PUT' && url === '/control') {
        const body = await this.readBody<{ enabled: boolean }>(req);
        if (body.enabled) {
          this.agent.enable();
        } else {
          this.agent.disable();
        }
        return this.json(res, 200, { enabled: this.agent.isEnabled() });
      }

      if (method === 'POST' && url === '/execute') {
        const body = await this.readBody<{ trigger: Trigger; inputs: ServiceInputs }>(req);
        const ctx = {
          sessionId: `http-${Date.now()}`,
          serviceId: body.inputs.serviceId,
          triggeredBy: 'http',
          inputs: body.inputs,
          sharedState: {},
        };
        const result = await this.agent.execute(ctx);
        return this.json(res, 200, result);
      }

      this.json(res, 404, { error: 'Not found', path: url });
    } catch (err) {
      this.json(res, 500, { error: String(err) });
    }
  }

  private json(res: http.ServerResponse, status: number, body: unknown): void {
    const payload = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Connection': 'close' });
    res.end(payload);
  }

  private readBody<T>(req: http.IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        try {
          resolve(JSON.parse(raw) as T);
        } catch {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }
}
