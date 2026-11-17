import { api } from '@/lib/api';
import type { AdminLiveDriver } from './types';

export function fetchLiveDrivers(): Promise<{ data: AdminLiveDriver[]; count: number }> {
  return api.get('/admin/drivers/live');
}
