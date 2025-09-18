declare global {
  interface Window {
    electronAPI?: {
      on: (channel: string, callback: (...args: any[]) => void) => () => void;
      send: (channel: string, args?: any) => void;
    };
    api?: {
      send: (channel: string, data?: any) => void;
      receive: (channel: string, func: (...args: any[]) => void) => void;
      remove: (channel: string) => void;
      getAppInfo?: () => Promise<{ version?: string; updateReady?: boolean }>;
      onUpdateReady?: (callback: (payload?: any) => void) => () => void;
      restartToUpdate?: () => void;
    };
  }
}

export {};

