import { api } from '@/lib/api';
import type { DriverDocument, DriverProfile } from './types';

export function fetchPendingDrivers(): Promise<{ data: DriverProfile[]; count: number }> {
  return api.get('/admin/drivers/pending');
}

export function fetchDriverProfile(driverId: string): Promise<DriverProfile> {
  return api.get(`/drivers/${driverId}`);
}

export function fetchDriverDocuments(driverId: string): Promise<{ data: DriverDocument[]; count: number }> {
  return api.get(`/admin/drivers/${driverId}/documents`);
}

export function approveDocument(driverId: string, docId: string) {
  return api.post(`/admin/drivers/${driverId}/documents/${docId}/approve`);
}

export function rejectDocument(driverId: string, docId: string, rejectionReason: string) {
  return api.post(`/admin/drivers/${driverId}/documents/${docId}/reject`, { rejectionReason });
}

export function approveDriver(driverId: string, notes?: string) {
  return api.patch(`/admin/drivers/${driverId}/approve`, { notes });
}

export function rejectDriver(driverId: string, reason: string) {
  return api.patch(`/admin/drivers/${driverId}/reject`, { reason });
}
