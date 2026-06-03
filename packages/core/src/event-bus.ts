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
