export class EventBus {
    listeners = new Map();
    subscribe(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(handler);
        return () => this.listeners.get(event)?.delete(handler);
    }
    once(event, handler) {
        const wrapper = (payload) => {
            handler(payload);
            this.listeners.get(event)?.delete(wrapper);
        };
        this.subscribe(event, wrapper);
    }
    publish(event, payload) {
        this.listeners.get(event)?.forEach((h) => h(payload));
    }
    clear(event) {
        if (event) {
            this.listeners.delete(event);
        }
        else {
            this.listeners.clear();
        }
    }
}
//# sourceMappingURL=event-bus.js.map