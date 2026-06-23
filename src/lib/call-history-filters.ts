export type CallHistoryFilter =
  | 'all'
  | 'inbound'
  | 'outbound'
  | 'completed'
  | 'missed'
  | 'in_progress'
  | 'rejected';

export const CALL_HISTORY_FILTER_OPTIONS: Array<{
  value: CallHistoryFilter;
  label: string;
}> = [
  { value: 'all', label: 'All calls' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'completed', label: 'Completed' },
  { value: 'missed', label: 'Missed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'rejected', label: 'Rejected' },
];

export function getCallHistoryFilterLabel(filter: CallHistoryFilter): string {
  return CALL_HISTORY_FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? 'All calls';
}
