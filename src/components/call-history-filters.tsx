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
};

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = value === option.value;

          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn('rounded-full', isActive && 'shadow-sm')}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
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
}: CallHistoryFiltersProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <FilterRow
        label="Direction"
        options={CALL_HISTORY_DIRECTION_OPTIONS}
        value={direction}
        onChange={onDirectionChange}
        disabled={disabled}
      />
      <FilterRow
        label="Status"
        options={CALL_HISTORY_STATUS_OPTIONS}
        value={status}
        onChange={onStatusChange}
        disabled={disabled}
      />
    </div>
  );
}
