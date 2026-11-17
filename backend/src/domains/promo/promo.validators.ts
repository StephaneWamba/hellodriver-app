import { z } from 'zod';

export const validatePromoSchema = z.object({
  code: z.string().min(1).max(20).toUpperCase(),
  fareXaf: z.number().int().min(0, 'Fare must be non-negative'),
});

export const redeemReferralSchema = z.object({
  code: z.string().min(1).max(20).toUpperCase(),
});

export type ValidatePromoInput = z.infer<typeof validatePromoSchema>;
export type RedeemReferralInput = z.infer<typeof redeemReferralSchema>;
