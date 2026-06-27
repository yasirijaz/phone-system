'use client';

import { Button } from '@/components/ui/button';
import {
  CALL_HISTORY_DIRECTION_OPTIONS,
  CALL_HISTORY_STATUS_OPTIONS,
  type CallHistoryDirectionFilter,
  type CallHistoryStatusFilter,
} from '@/lib/call-history-filters';
import { cn } from '@/lib/utils';

type CallHistoryFiltersProps = {
  direction: CallHistoryDirectionFilter;
  status: CallHistoryStatusFilter;
  onDirectionChange: (filter: CallHistoryDirectionFilter) => void;
  onStatusChange: (filter: CallHistoryStatusFilter) => void;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
};

function FilterPills<T extends string>({
  options,
  value,
  onChange,
  disabled,
  compact,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', compact && 'gap-1')}>
      {options.map((option) => {
        const isActive = value === option.value;

        return (
          <Button
            key={option.value}
            type="button"
            size={compact ? 'sm' : 'sm'}
            variant={isActive ? 'default' : 'outline'}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full',
              compact && 'h-7 px-2.5 text-xs',
              isActive && 'shadow-sm'
            )}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  compact,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      <p className={cn('font-medium text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
        {label}
      </p>
      <FilterPills
        options={options}
        value={value}
        onChange={onChange}
        disabled={disabled}
        compact={compact}
      />
    </div>
  );
}

export default function CallHistoryFilters({
  direction,
  status,
  onDirectionChange,
  onStatusChange,
  disabled,
  className,
  variant = 'default',
}: CallHistoryFiltersProps) {
  const compact = variant === 'compact';
  const directionOptions = compact
    ? CALL_HISTORY_DIRECTION_OPTIONS.map((option) =>
        option.value === 'all' ? { ...option, label: 'All' } : option
      )
    : CALL_HISTORY_DIRECTION_OPTIONS;
  const statusOptions = compact
    ? CALL_HISTORY_STATUS_OPTIONS.map((option) =>
        option.value === 'all'
          ? { ...option, label: 'All' }
          : option.value === 'in_progress'
            ? { ...option, label: 'Live' }
            : option
      )
    : CALL_HISTORY_STATUS_OPTIONS;

  if (compact) {
    return (
      <div
        className={cn(
          'flex flex-col gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4',
          className
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">Direction</span>
          <FilterPills
            options={directionOptions}
            value={direction}
            onChange={onDirectionChange}
            disabled={disabled}
            compact
          />
        </div>
        <div className="hidden h-6 w-px shrink-0 bg-border sm:block" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">Status</span>
          <FilterPills
            options={statusOptions}
            value={status}
            onChange={onStatusChange}
            disabled={disabled}
            compact
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <FilterRow
        label="Direction"
        options={directionOptions}
        value={direction}
        onChange={onDirectionChange}
        disabled={disabled}
      />
      <FilterRow
        label="Status"
        options={statusOptions}
        value={status}
        onChange={onStatusChange}
        disabled={disabled}
      />
    </div>
  );
}
