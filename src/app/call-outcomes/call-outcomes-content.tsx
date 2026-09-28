'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Tags } from 'lucide-react';
import { AppSidebar } from '@/components/app-sidebar';
import AppHeader from '@/components/app-header';
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { canAccessCallOutcomes } from '@/lib/roles';
import { formatPhoneNumber, cn } from '@/lib/utils';
import {
  getCallOutcomeCalls,
  getCallOutcomeSummary,
  type CallOutcomeCall,
  type CallOutcomeSummary,
} from '@/services/callClassificationService';

function formatDuration(value?: string | number | null): string {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function CallOutcomesPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [outcomes, setOutcomes] = useState<CallOutcomeSummary[]>([]);
  const [loadingOutcomes, setLoadingOutcomes] = useState(true);
  const [selected, setSelected] = useState<CallOutcomeSummary | null>(null);
  const [calls, setCalls] = useState<CallOutcomeCall[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!user) return;
    if (!canAccessCallOutcomes(user.role_id)) {
      router.replace('/app');
    }
  }, [user, router]);

  const loadOutcomes = useCallback(async () => {
    setLoadingOutcomes(true);
    try {
      const data = await getCallOutcomeSummary();
      setOutcomes(data.outcomes ?? []);
    } catch {
      toast({ title: 'Could not load call outcomes', variant: 'destructive' });
    } finally {
      setLoadingOutcomes(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!user || !canAccessCallOutcomes(user.role_id)) return;
    void loadOutcomes();
  }, [user, loadOutcomes]);

  const loadCalls = useCallback(async (outcome: CallOutcomeSummary, nextPage = 1) => {
    setLoadingCalls(true);
    try {
      const data = await getCallOutcomeCalls({
        disposition_id: outcome.disposition_id,
        custom_label: outcome.custom_label,
        page: nextPage,
        per_page: 25,
      });
      setCalls(data.calls ?? []);
      setPage(data.pagination?.page ?? nextPage);
      setTotalPages(data.pagination?.total_pages ?? 0);
      setTotal(data.pagination?.total ?? 0);
    } catch {
      toast({ title: 'Could not load calls', variant: 'destructive' });
    } finally {
      setLoadingCalls(false);
    }
  }, [toast]);

  useEffect(() => {
    const key = searchParams.get('outcome');
    if (!key || outcomes.length === 0) return;
    const match = outcomes.find((item) => item.key === key);
    if (!match) return;
    setSelected(match);
    void loadCalls(match, 1);
  }, [searchParams, outcomes, loadCalls]);

  const openOutcome = (outcome: CallOutcomeSummary) => {
    setSelected(outcome);
    router.replace(`/call-outcomes?outcome=${encodeURIComponent(outcome.key)}`);
    void loadCalls(outcome, 1);
  };

  const clearSelection = () => {
    setSelected(null);
    setCalls([]);
    router.replace('/call-outcomes');
  };

  if (!user || !canAccessCallOutcomes(user.role_id)) {
    return null;
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <AppSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex min-h-screen flex-col">
          <AppHeader user={user} logout={logout} pageTitle="Call Outcomes" />
          <main className="flex-1 bg-muted/40 p-4 md:p-8">
            <div className="mx-auto max-w-6xl space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Call outcomes</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Every classification badge used on calls. Open one to see the matching calls and notes.
                  </p>
                </div>
                {selected && (
                  <Button variant="outline" onClick={clearSelection}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    All outcomes
                  </Button>
                )}
              </div>

              {!selected ? (
                loadingOutcomes ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading outcomes…
                  </div>
                ) : outcomes.length === 0 ? (
                  <div className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground">
                    No call outcomes yet. They appear after agents classify completed calls.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {outcomes.map((outcome) => (
                      <button
                        key={outcome.key}
                        type="button"
                        onClick={() => openOutcome(outcome)}
                        className="rounded-xl border bg-background p-4 text-left transition hover:border-sky-300 hover:bg-sky-50/40"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-2 rounded-md bg-sky-50 px-2.5 py-1 text-sm font-medium text-sky-900">
                            <Tags className="h-3.5 w-3.5" />
                            {outcome.label}
                          </span>
                          <span className="text-sm font-semibold text-foreground">{outcome.count}</span>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {outcome.count === 1 ? '1 call' : `${outcome.count} calls`}
                        </p>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-md bg-sky-50 px-2.5 py-1 text-sm font-medium text-sky-900">
                      {selected.label}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {total} {total === 1 ? 'call' : 'calls'}
                    </span>
                  </div>

                  {loadingCalls ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading calls…
                    </div>
                  ) : calls.length === 0 ? (
                    <div className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground">
                      No calls found for this outcome.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border bg-background">
                      <div className="divide-y">
                        {calls.map((call) => {
                          const from = encodeURIComponent(call.direction === 'inbound' ? call.to : call.from);
                          const to = encodeURIComponent(call.direction === 'inbound' ? call.from : call.to);
                          return (
                            <Link
                              key={call.id}
                              href={`/conversations/${from}/${to}`}
                              className="flex flex-col gap-2 px-4 py-3 transition hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{call.caller_label}</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {call.direction === 'outbound' ? 'Outbound' : 'Inbound'}
                                  {' · '}
                                  {formatPhoneNumber(call.direction === 'outbound' ? call.to : call.from)}
                                  {call.agent_name ? ` · ${call.agent_name}` : ''}
                                  {call.department_name ? ` · ${call.department_name}` : ''}
                                </div>
                                {call.classification?.note && (
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    Note: {call.classification.note}
                                  </div>
                                )}
                              </div>
                              <div className="shrink-0 text-xs text-muted-foreground">
                                {formatDuration(call.duration)}
                                {call.created_at ? ` · ${new Date(call.created_at).toLocaleString()}` : ''}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        disabled={page <= 1 || loadingCalls}
                        onClick={() => selected && void loadCalls(selected, page - 1)}
                      >
                        Previous
                      </Button>
                      <span className={cn('text-sm text-muted-foreground')}>
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        disabled={page >= totalPages || loadingCalls}
                        onClick={() => selected && void loadCalls(selected, page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
