export interface AdminPromoCode {
  id: string;
  code: string;
  type: 'fixed_xaf' | 'percentage';
  value: number;
  maxUses: number | null;
  usesCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface ReferralsOverview {
  totalReferrals: number;
  totalRewardsXaf: number;
  referralsLast30Days: number;
  topReferrers: Array<{
    userId: string;
    firstName: string;
    lastName: string;
    phone: string;
    referralCount: number;
  }>;
}

export interface CreatePromoCodeInput {
  code: string;
  type: 'fixed_xaf' | 'percentage';
  value: number;
  maxUses?: number;
  expiresAt?: string;
}
