// Example of attaching OpsAgents to a service.
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
