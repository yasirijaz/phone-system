const EXACT_IN_APP_ROUTES = new Set(['/app', '/messages', '/contacts', '/profile']);

/** Department inbox view only — not admin sub-routes like settings/users/phone-numbers. */
const DEPARTMENT_INBOX_PATTERN = /^\/departments\/\d+\/?$/;
const PHONE_ACTIVITY_PATTERN = /^\/activity\/phone\/.+/;
const USER_ACTIVITY_PATTERN = /^\/activity\/user\/\d+\/?$/;

export function isInAppRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (EXACT_IN_APP_ROUTES.has(pathname)) return true;
  if (pathname.startsWith('/conversations/')) return true;
  if (PHONE_ACTIVITY_PATTERN.test(pathname)) return true;
  if (USER_ACTIVITY_PATTERN.test(pathname)) return true;
  return DEPARTMENT_INBOX_PATTERN.test(pathname);
}
