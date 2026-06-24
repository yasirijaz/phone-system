export type CallHistoryDirectionFilter = 'all' | 'inbound' | 'outbound';

export type CallHistoryStatusFilter =
  | 'all'
  | 'completed'
  | 'missed'
  | 'in_progress'
  | 'rejected';

export type CallHistoryFilters = {
  direction: CallHistoryDirectionFilter;
  status: CallHistoryStatusFilter;
};

export const DEFAULT_CALL_HISTORY_FILTERS: CallHistoryFilters = {
  direction: 'all',
  status: 'all',
};

export const CALL_HISTORY_DIRECTION_OPTIONS: Array<{
  value: CallHistoryDirectionFilter;
  label: string;
}> = [
  { value: 'all', label: 'All directions' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
];

export const CALL_HISTORY_STATUS_OPTIONS: Array<{
  value: CallHistoryStatusFilter;
  label: string;
}> = [
  { value: 'all', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'missed', label: 'Missed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'rejected', label: 'Rejected' },
];

export function getCallHistoryDirectionLabel(filter: CallHistoryDirectionFilter): string {
  return (
    CALL_HISTORY_DIRECTION_OPTIONS.find((option) => option.value === filter)?.label ??
    'All directions'
  );
}

export function getCallHistoryStatusLabel(filter: CallHistoryStatusFilter): string {
  return (
    CALL_HISTORY_STATUS_OPTIONS.find((option) => option.value === filter)?.label ?? 'All statuses'
  );
}

export function getCallHistoryEmptyFilterLabel(filters: CallHistoryFilters): string {
  const parts: string[] = [];

  if (filters.direction !== 'all') {
    parts.push(getCallHistoryDirectionLabel(filters.direction).toLowerCase());
  }

  if (filters.status !== 'all') {
    parts.push(getCallHistoryStatusLabel(filters.status).toLowerCase());
  }

  if (parts.length === 0) {
    return 'calls';
  }

  return parts.join(' ');
}
