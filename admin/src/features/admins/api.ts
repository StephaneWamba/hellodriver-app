import { api } from '@/lib/api';
import type { AdminAccount } from './types';

export function fetchAdmins(): Promise<{ data: AdminAccount[]; count: number }> {
  return api.get('/admin/admins');
}

export function createAdminAccount(data: { firstName: string; lastName: string; email: string; password: string }) {
  return api.post<AdminAccount>('/admin/admins', data);
}

export function revokeAdmin(adminId: string) {
  return api.del(`/admin/admins/${adminId}`);
}
