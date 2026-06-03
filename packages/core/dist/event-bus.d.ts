type Handler<T = unknown> = (payload: T) => void;
export declare class EventBus {
    private readonly listeners;
    subscribe<T>(event: string, handler: Handler<T>): () => void;
    once<T>(event: string, handler: Handler<T>): void;
    publish<T>(event: string, payload: T): void;
    clear(event?: string): void;
}
export {};
//# sourceMappingURL=event-bus.d.ts.map