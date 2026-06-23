'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Contact, User } from '@/types';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hash, Phone, Search, UserRound, Users } from 'lucide-react';
import {
  buildGlobalSearchResults,
  GLOBAL_SEARCH_GROUP_LABELS,
  groupGlobalSearchResults,
  type GlobalSearchResult,
  type GlobalSearchResultType,
} from '@/lib/global-search';
import { cn } from '@/lib/utils';

type GlobalSearchProps = {
  contacts: Contact[];
  users: User[];
  className?: string;
};

const TYPE_ICONS: Record<GlobalSearchResultType, typeof Search> = {
  contact: UserRound,
  user: Users,
  'phone-query': Hash,
};

export default function GlobalSearch({ contacts, users, className }: GlobalSearchProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(
    () => buildGlobalSearchResults({ query, contacts, users }),
    [query, contacts, users]
  );

  const groups = useMemo(() => groupGlobalSearchResults(results), [results]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, results.length]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const navigateTo = (result: GlobalSearchResult) => {
    setQuery('');
    setOpen(false);
    router.push(result.href);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      setOpen(true);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      navigateTo(results[activeIndex]);
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  let runningIndex = -1;

  return (
    <div ref={containerRef} className={cn('relative w-full md:w-96', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search contacts, agents, or phone numbers..."
        className="pl-9"
        value={query}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="global-search-results"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />

      {open && query.trim().length >= 2 ? (
        <div
          id="global-search-results"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg"
        >
          {results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No matches found.</p>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="p-1">
                {groups.map((group) => (
                  <div key={group.type} className="py-1">
                    <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      {GLOBAL_SEARCH_GROUP_LABELS[group.type]}
                    </p>
                    {group.items.map((result) => {
                      runningIndex += 1;
                      const index = runningIndex;
                      const Icon = TYPE_ICONS[result.type];
                      const isActive = index === activeIndex;

                      return (
                        <button
                          key={result.id}
                          type="button"
                          className={cn(
                            'flex w-full items-start gap-3 rounded-sm px-2 py-2 text-left transition-colors',
                            isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70'
                          )}
                          onMouseEnter={() => setActiveIndex(index)}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            navigateTo(result);
                          }}
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{result.title}</span>
                            {result.subtitle ? (
                              <span className="block truncate text-xs text-muted-foreground">
                                {result.subtitle}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      ) : null}
    </div>
  );
}
