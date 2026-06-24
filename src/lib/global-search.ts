import type { Contact, User } from '@/types';
import { formatPhoneNumber, normalizePhoneDigits } from '@/lib/utils';

export type GlobalSearchResultType = 'contact' | 'user' | 'phone-query';

export type GlobalSearchResult = {
  id: string;
  type: GlobalSearchResultType;
  title: string;
  subtitle?: string;
  href: string;
  score: number;
};

type SearchInput = {
  query: string;
  contacts: Contact[];
  users: User[];
};

const TYPE_ORDER: GlobalSearchResultType[] = ['contact', 'user', 'phone-query'];

export const GLOBAL_SEARCH_GROUP_LABELS: Record<GlobalSearchResultType, string> = {
  contact: 'Contacts',
  user: 'Team members',
  'phone-query': 'Phone numbers',
};

function scoreText(value: string | undefined | null, query: string, queryDigits: string): number {
  if (!value) return 0;
  const normalized = value.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (normalized === q) return 100;
  if (normalized.startsWith(q)) return 85;
  if (normalized.includes(q)) return 70;

  if (queryDigits.length >= 1) {
    const valueDigits = normalizePhoneDigits(value);
    if (valueDigits === queryDigits) return 95;
    if (valueDigits.startsWith(queryDigits)) return 80;
    if (valueDigits.includes(queryDigits)) return 65;
  }

  return 0;
}

function buildPhoneCallsHref(phone: string): string {
  return `/activity/phone/${encodeURIComponent(phone)}`;
}

function buildUserCallsHref(userId: number): string {
  return `/activity/user/${userId}`;
}

export function buildGlobalSearchResults({
  query,
  contacts,
  users,
}: SearchInput): GlobalSearchResult[] {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  const queryDigits = normalizePhoneDigits(trimmed);
  const results: GlobalSearchResult[] = [];
  const seenPhoneDigits = new Set<string>();

  for (const contact of contacts) {
    const score = Math.max(
      scoreText(contact.name, trimmed, queryDigits),
      scoreText(contact.email, trimmed, queryDigits),
      scoreText(contact.phone_no, trimmed, queryDigits)
    );
    if (score === 0) continue;

    results.push({
      id: `contact-${contact.id}`,
      type: 'contact',
      title: contact.name,
      subtitle: `View call history · ${formatPhoneNumber(contact.phone_no)}`,
      href: buildPhoneCallsHref(contact.phone_no),
      score,
    });
    seenPhoneDigits.add(normalizePhoneDigits(contact.phone_no));
  }

  for (const member of users) {
    const score = Math.max(
      scoreText(member.name, trimmed, queryDigits),
      scoreText(member.email, trimmed, queryDigits)
    );
    if (score === 0) continue;

    results.push({
      id: `user-${member.id}`,
      type: 'user',
      title: member.name,
      subtitle: 'View calls handled by this agent',
      href: buildUserCallsHref(member.id),
      score,
    });
  }

  if (queryDigits.length >= 7) {
    const alreadyListed = seenPhoneDigits.has(queryDigits);
    if (!alreadyListed) {
      results.push({
        id: `phone-query-${queryDigits}`,
        type: 'phone-query',
        title: formatPhoneNumber(trimmed) || trimmed,
        subtitle: 'View call history for this number',
        href: buildPhoneCallsHref(trimmed),
        score: 75,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 12);
}

export function groupGlobalSearchResults(
  results: GlobalSearchResult[]
): Array<{ type: GlobalSearchResultType; items: GlobalSearchResult[] }> {
  return TYPE_ORDER.map((type) => ({
    type,
    items: results.filter((result) => result.type === type),
  })).filter((group) => group.items.length > 0);
}
