'use client';

import { cn } from '@/lib/utils';
import type { CallStatusDisplay } from '@/lib/call-status-display';

type CallStatusBadgeProps = {
  display: CallStatusDisplay;
  className?: string;
};

export default function CallStatusBadge({ display, className }: CallStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide',
        display.className,
        className
      )}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', display.dotClassName)} />
      {display.label}
    </span>
  );
}
