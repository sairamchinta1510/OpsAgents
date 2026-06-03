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
