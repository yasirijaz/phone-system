'use client';

import type { ReactNode } from 'react';
import AppHeader from '@/components/app-header';
import CallHistoryFilters from '@/components/call-history-filters';
import CallHistoryTable from '@/components/call-history-table';
import PaginationControls from '@/components/pagination-controls';
import type { User } from '@/types';
import type {
  CallActivityEntry,
  CallHistoryPagination,
  CallHistorySummary,
} from '@/services/callLogService';
import type {
  CallHistoryDirectionFilter,
  CallHistoryFilters,
  CallHistoryStatusFilter,
} from '@/lib/call-history-filters';
import { getCallHistoryEmptyFilterLabel } from '@/lib/call-history-filters';
import { Loader2, MessageSquare, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CallHistoryShellProps = {
  user: User | null;
  logout: () => void;
  title: string;
  subtitle: ReactNode;
  icon?: ReactNode;
  loading: boolean;
  calls: CallActivityEntry[];
  summary: CallHistorySummary;
  pagination: CallHistoryPagination;
  directionFilter: CallHistoryDirectionFilter;
  statusFilter: CallHistoryStatusFilter;
  onDirectionChange: (filter: CallHistoryDirectionFilter) => void;
  onStatusChange: (filter: CallHistoryStatusFilter) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  subjectPhone?: string;
  emptyMessage: string;
  onCallClick?: () => void;
  onMessageClick?: () => void;
  dialerOpen?: boolean;
  onDialerOpenChange?: (open: boolean) => void;
  dialerInitialValue?: string;
};

function StatPill({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: 'default' | 'success' | 'warning' | 'danger' | 'live';
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClass = {
    default: 'border-border bg-background text-foreground',
    success: 'border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300',
    warning: 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300',
    danger: 'border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300',
    live: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
  }[tone];

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-lg border px-4 py-3 text-left transition-colors',
        toneClass,
        onClick && 'hover:bg-accent/40',
        active && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Component>
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
  summary,
  pagination,
  directionFilter,
  statusFilter,
  onDirectionChange,
  onStatusChange,
  onPageChange,
  onLimitChange,
  subjectPhone,
  emptyMessage,
  onCallClick,
  onMessageClick,
  dialerOpen,
  onDialerOpenChange,
  dialerInitialValue,
}: CallHistoryShellProps) {
  const filters: CallHistoryFilters = { direction: directionFilter, status: statusFilter };
  const hasAnyRecords = summary.total > 0;
  const hasFilteredResults = calls.length > 0;
  const filterLabel = getCallHistoryEmptyFilterLabel(filters);

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <AppHeader
        user={user}
        logout={logout}
        searchClassName="max-w-3xl"
        dialerOpen={dialerOpen}
        onDialerOpenChange={onDialerOpenChange}
        dialerInitialValue={dialerInitialValue}
      />

      <main className="flex-1 px-4 py-6 md:px-8">
        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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

                {onCallClick && onMessageClick ? (
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" onClick={onCallClick} disabled={loading}>
                      <Phone className="mr-2 h-4 w-4" />
                      Call
                    </Button>
                    <Button type="button" variant="outline" onClick={onMessageClick} disabled={loading}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Message
                    </Button>
                  </div>
                ) : null}
              </div>

              {!loading && hasAnyRecords ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  <StatPill
                    label="Total calls"
                    value={summary.total}
                    tone="default"
                    active={statusFilter === 'all'}
                    onClick={() => onStatusChange('all')}
                  />
                  <StatPill
                    label="Completed"
                    value={summary.completed}
                    tone="success"
                    active={statusFilter === 'completed'}
                    onClick={() => onStatusChange('completed')}
                  />
                  <StatPill
                    label="Missed"
                    value={summary.missed}
                    tone="warning"
                    active={statusFilter === 'missed'}
                    onClick={() => onStatusChange('missed')}
                  />
                  <StatPill
                    label="In progress"
                    value={summary.in_progress}
                    tone="live"
                    active={statusFilter === 'in_progress'}
                    onClick={() => onStatusChange('in_progress')}
                  />
                  <StatPill
                    label="Rejected"
                    value={summary.rejected}
                    tone="danger"
                    active={statusFilter === 'rejected'}
                    onClick={() => onStatusChange('rejected')}
                  />
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 md:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-24 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading call history...
              </div>
            ) : !hasAnyRecords ? (
              <div className="py-24 text-center text-sm text-muted-foreground">{emptyMessage}</div>
            ) : (
              <>
                <CallHistoryFilters
                  direction={directionFilter}
                  status={statusFilter}
                  onDirectionChange={onDirectionChange}
                  onStatusChange={onStatusChange}
                  disabled={loading}
                  className="mb-6"
                />

                {!hasFilteredResults ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    No {filterLabel} match this search.
                  </div>
                ) : (
                  <>
                    <CallHistoryTable calls={calls} subjectPhone={subjectPhone} />
                    <PaginationControls
                      currentPage={pagination.currentPage}
                      totalPages={pagination.totalPages}
                      totalRecords={pagination.totalRecords}
                      limit={pagination.perPage}
                      onPageChange={onPageChange}
                      onLimitChange={onLimitChange}
                      isLoading={loading}
                    />
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
