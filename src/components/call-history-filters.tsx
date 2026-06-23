'use client';

import { Button } from '@/components/ui/button';
import {
  CALL_HISTORY_FILTER_OPTIONS,
  type CallHistoryFilter,
} from '@/lib/call-history-filters';
import { cn } from '@/lib/utils';

type CallHistoryFiltersProps = {
  value: CallHistoryFilter;
  onChange: (filter: CallHistoryFilter) => void;
  disabled?: boolean;
  className?: string;
};

export default function CallHistoryFilters({
  value,
  onChange,
  disabled,
  className,
}: CallHistoryFiltersProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm font-medium text-muted-foreground">Filter calls</p>
      <div className="flex flex-wrap gap-2">
        {CALL_HISTORY_FILTER_OPTIONS.map((option) => {
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
