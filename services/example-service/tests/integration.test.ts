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
