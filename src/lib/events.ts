
import { debounce } from '@/lib/utils';

type EventHandler = (...args: any[]) => void;

class EventEmitter {
  private events: { [key: string]: EventHandler[] } = {};
  private debouncedEmits = new Map<string, (...args: unknown[]) => void>();

  on(event: string, listener: EventHandler): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listener: EventHandler): void {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
  }

  /** Coalesce rapid emits (e.g. WebSocket bursts) into a single listener invocation. */
  emitDebounced(event: string, ms: number, ...args: any[]): void {
    let debounced = this.debouncedEmits.get(event);
    if (!debounced) {
      debounced = debounce((...debouncedArgs: unknown[]) => {
        this.emit(event, ...debouncedArgs);
      }, ms);
      this.debouncedEmits.set(event, debounced);
    }
    debounced(...args);
  }
}

export const events = new EventEmitter();
