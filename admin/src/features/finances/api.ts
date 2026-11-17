import { api } from '@/lib/api';
import type { AdminPayment, AdminWalletTransaction, FinancesOverview, PaginatedResponse } from './types';

export function fetchFinancesOverview(): Promise<FinancesOverview> {
  return api.get('/admin/finances/overview');
}

export function fetchTransactions(params: {
  reason?: string;
  page: number;
}): Promise<PaginatedResponse<AdminWalletTransaction>> {
  const q = new URLSearchParams();
  if (params.reason) q.set('reason', params.reason);
  q.set('page', String(params.page));
  return api.get(`/admin/finances/transactions?${q.toString()}`);
}

export function fetchPayments(params: {
  status?: string;
  type?: string;
  page: number;
}): Promise<PaginatedResponse<AdminPayment>> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.type) q.set('type', params.type);
  q.set('page', String(params.page));
  return api.get(`/admin/finances/payments?${q.toString()}`);
}
