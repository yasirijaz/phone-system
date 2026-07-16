export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));
  if (seconds < 60) return `${seconds}s`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return remainingSeconds > 0
      ? `${hours}h ${minutes}m ${remainingSeconds}s`
      : minutes > 0
        ? `${hours}h ${minutes}m`
        : `${hours}h`;
  }

  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

export function formatCompactDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatTrend(value: number | null | undefined): {
  label: string;
  type: 'up' | 'down' | 'flat';
} {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { label: 'No prior data', type: 'flat' };
  }
  if (value === 0) {
    return { label: '0% vs prior period', type: 'flat' };
  }
  const type = value > 0 ? 'up' : 'down';
  const sign = value > 0 ? '+' : '';
  return { label: `${sign}${value}% vs prior period`, type };
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0%';
  return `${value}%`;
}
