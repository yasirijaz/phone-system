// Lightweight runtime check for Electron renderer context
export function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Exposed by preload in this app
    const w = window as any;
    if (w.electronAPI || w.api) return true;
    // Fallback to UA sniffing when preload objects are unavailable
    return typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent || '');
  } catch {
    return false;
  }
}

