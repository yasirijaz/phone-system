'use client';

import type { ReactNode } from 'react';
import AppHeader from '@/components/app-header';
import CallHistoryTable from '@/components/call-history-table';
import { summarizeCalls } from '@/lib/call-status-display';
import type { User } from '@/types';
import type { CallActivityEntry } from '@/services/callLogService';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type CallHistoryShellProps = {
  user: User | null;
  logout: () => void;
  title: string;
  subtitle: ReactNode;
  icon?: ReactNode;
  loading: boolean;
  calls: CallActivityEntry[];
  subjectPhone?: string;
  emptyMessage: string;
};

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'default' | 'success' | 'warning' | 'danger' | 'live';
}) {
  const toneClass = {
    default: 'border-border bg-background text-foreground',
    success: 'border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300',
    warning: 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300',
    danger: 'border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300',
    live: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
  }[tone];

  return (
    <div className={cn('rounded-lg border px-4 py-3', toneClass)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function CallHistoryShell({
  user,
  logout,
  title,
  subtitle,
  icon,
  loading,
  calls,
  subjectPhone,
  emptyMessage,
}: CallHistoryShellProps) {
  const summary = summarizeCalls(calls);

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <AppHeader user={user} logout={logout} searchClassName="max-w-3xl" />

      <main className="flex-1 px-4 py-6 md:px-8">
        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                {icon ? (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {icon}
                  </div>
                ) : null}
                <div className="min-w-0">
                  <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Call search results
                  </p>
                  <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                </div>
              </div>

              {!loading && calls.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  <StatPill label="Total calls" value={summary.total} tone="default" />
                  <StatPill label="Completed" value={summary.completed} tone="success" />
                  <StatPill label="Missed" value={summary.missed} tone="warning" />
                  <StatPill label="In progress" value={summary.inProgress} tone="live" />
                  <StatPill label="Rejected" value={summary.rejected} tone="danger" />
                </div>
              ) : null}
            </div>
          </section>

          <section>
            {loading ? (
              <div className="flex items-center justify-center rounded-xl border bg-card py-24 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading call history...
              </div>
            ) : calls.length === 0 ? (
              <div className="rounded-xl border bg-card py-24 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              <CallHistoryTable calls={calls} subjectPhone={subjectPhone} />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
