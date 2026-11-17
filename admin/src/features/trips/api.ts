import { api } from '@/lib/api';
import type { AdminTripDetail, AdminTripListItem, PaginatedResponse } from './types';

export function fetchTrips(params: { status?: string; page: number }): Promise<PaginatedResponse<AdminTripListItem>> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  q.set('page', String(params.page));
  return api.get(`/admin/trips?${q.toString()}`);
}

export function fetchTripDetail(tripId: string): Promise<AdminTripDetail> {
  return api.get(`/admin/trips/${tripId}`);
}

export function adminCancelTrip(tripId: string, reason: string) {
  return api.post(`/admin/trips/${tripId}/cancel`, { reason });
}
