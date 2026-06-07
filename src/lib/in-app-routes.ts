const EXACT_IN_APP_ROUTES = new Set(['/app', '/messages', '/contacts', '/profile']);

/** Department inbox view only — not admin sub-routes like settings/users/phone-numbers. */
const DEPARTMENT_INBOX_PATTERN = /^\/departments\/\d+\/?$/;

export function isInAppRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (EXACT_IN_APP_ROUTES.has(pathname)) return true;
  if (pathname.startsWith('/conversations/')) return true;
  return DEPARTMENT_INBOX_PATTERN.test(pathname);
}
