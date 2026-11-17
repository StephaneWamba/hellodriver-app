import { api } from '@/lib/api';
import type { AdminUser, SessionResponse } from './types';

export function login(email: string, password: string): Promise<SessionResponse> {
  return api.post('/auth/admin/login', { email, password });
}

export function fetchMe(): Promise<AdminUser> {
  return api.get('/auth/me');
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
  return api.patch('/auth/admin/password', { currentPassword, newPassword });
}
