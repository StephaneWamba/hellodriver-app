import { api } from '@/lib/api';
import type { AdminUserDetail, ListUsersResponse, UserRole } from './types';

export function fetchUsers(params: {
  search?: string;
  role?: UserRole;
  page: number;
}): Promise<ListUsersResponse> {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.role) q.set('role', params.role);
  q.set('page', String(params.page));
  return api.get(`/admin/users?${q.toString()}`);
}

export function fetchUserDetail(userId: string): Promise<AdminUserDetail> {
  return api.get(`/admin/users/${userId}`);
}

export function suspendUser(userId: string, suspend: boolean, reason?: string) {
  return api.patch(`/admin/users/${userId}/suspend`, { suspend, reason });
}

export function updateUserProfile(userId: string, updates: { firstName?: string; lastName?: string; email?: string }) {
  return api.patch(`/admin/users/${userId}`, updates);
}

export function adjustUserWallet(userId: string, data: { type: 'credit' | 'debit'; amountXaf: number; reason: string }) {
  return api.post<{ balanceXaf: number }>(`/admin/users/${userId}/wallet-adjustment`, data);
}
