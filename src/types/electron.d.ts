export {};

declare global {
  interface Window {
    electronAPI?: {
      on: (channel: string, callback: (...args: any[]) => void) => (() => void) | void;
      send: (channel: string, args?: any) => void;
    };
    api?: {
        receive: (channel: string, data: any) => void;
        remove: (channel: string) => void;
    }
  }
}

    
