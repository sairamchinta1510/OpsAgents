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
