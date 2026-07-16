import axios from '@/lib/axios';
import type { DashboardStats, DashboardTimeRange } from '@/types';

export async function getDashboardStats(range: DashboardTimeRange = '30d'): Promise<DashboardStats> {
  const response = await axios.get('/api/dashboard/stats', {
    params: { range },
  });
  return response.data.data;
}
