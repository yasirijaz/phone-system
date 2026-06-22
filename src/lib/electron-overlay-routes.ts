export const ELECTRON_OVERLAY_ROUTES = [
  '/incoming-call-notification',
  '/call-progress-bar',
] as const;

export function isElectronOverlayRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return ELECTRON_OVERLAY_ROUTES.some((route) => pathname.startsWith(route));
}
