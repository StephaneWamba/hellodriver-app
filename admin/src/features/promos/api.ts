import { api } from '@/lib/api';
import type { AdminPromoCode, CreatePromoCodeInput, ReferralsOverview } from './types';

export function fetchPromoCodes(): Promise<{ data: AdminPromoCode[]; count: number }> {
  return api.get('/admin/promo-codes');
}

export function createPromoCode(input: CreatePromoCodeInput): Promise<AdminPromoCode> {
  return api.post('/admin/promo-codes', input);
}

export function deactivatePromoCode(promoId: string) {
  return api.patch(`/admin/promo-codes/${promoId}/deactivate`);
}

export function updatePromoCode(
  promoId: string,
  updates: { value?: number; maxUses?: number | null; expiresAt?: string | null }
): Promise<AdminPromoCode> {
  return api.patch(`/admin/promo-codes/${promoId}`, updates);
}

export function deletePromoCode(promoId: string) {
  return api.del(`/admin/promo-codes/${promoId}`);
}

export function fetchReferralsOverview(): Promise<ReferralsOverview> {
  return api.get('/admin/referrals/overview');
}
