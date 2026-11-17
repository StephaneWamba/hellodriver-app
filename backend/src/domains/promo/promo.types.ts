export interface PromoCode {
  id: string;
  code: string;
  type: 'fixed_xaf' | 'percentage';
  value: number;
  maxUses: number | null;
  usesCount: number;
  expiresAt: Date | null;
  createdByAdminId: string | null;
  createdAt: Date;
}

export interface Referral {
  id: string;
  referrerId: string;
  refereeId: string;
  promoCode: string;
  rewardXaf: number;
  referrerRewardedAt: Date | null;
  refereeRewardedAt: Date | null;
  createdAt: Date;
}

export interface PromoValidationResult {
  valid: boolean;
  discountXaf: number;
  code: string;
}
