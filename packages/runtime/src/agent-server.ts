import * as http from 'node:http';
import type { AgentContext, IAgent, ServiceInputs, Trigger } from '@opsagents/core';

class ClientError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

type ControllableAgent = IAgent & {
  enable(): void;
  disable(): void;
};

type HttpTrigger = Trigger | { type: 'manual'; serviceId: string; timestamp: number };
type HttpAgentContext = AgentContext & { trigger: HttpTrigger };

export class AgentServer {
  private readonly server: http.Server;
  private readonly agent: ControllableAgent;
  private readonly host = '0.0.0.0';

  constructor(agent: IAgent) {
    this.agent = agent as ControllableAgent;
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.server.keepAliveTimeout = 0;
  }

  start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (err: Error) => {
        this.server.off('error', onError);
        reject(err);
      };
      this.server.once('error', onError);
      this.server.listen(port, this.host, () => {
        this.server.off('error', onError);
        resolve();
      });
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
        const body = await this.readBody<{ enabled?: boolean }>(req);
        if (typeof body.enabled !== 'boolean') {
          return this.json(res, 400, { error: '`enabled` must be a boolean' });
        }
        if (body.enabled) {
          this.agent.enable();
        } else {
          this.agent.disable();
        }
        return this.json(res, 200, { enabled: this.agent.isEnabled() });
      }

      if (method === 'POST' && url === '/execute') {
        const body = await this.readBody<{ trigger?: HttpTrigger; inputs?: ServiceInputs }>(req);
        const inputs = body.inputs ?? { serviceId: 'unknown', timestamp: Date.now() };
        const trigger = body.trigger ?? { type: 'manual', serviceId: 'unknown', timestamp: Date.now() };
        const ctx: HttpAgentContext = {
          sessionId: `http-${Date.now()}`,
          serviceId: 'serviceId' in inputs && typeof inputs.serviceId === 'string' ? inputs.serviceId : 'unknown',
          triggeredBy: 'http',
          inputs,
          sharedState: {},
          trigger,
        };
        const result = await this.agent.execute(ctx);
        return this.json(res, 200, result);
      }

      this.json(res, 404, { error: 'Not found', path: url });
    } catch (err) {
      const status = err instanceof ClientError ? err.statusCode : 500;
      const message = err instanceof Error ? err.message : 'Internal server error';
      this.json(res, status, { error: message });
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
          reject(new ClientError(400, 'Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }
}
