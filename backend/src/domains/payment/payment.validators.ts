import { z } from 'zod';
import { config } from '../../core/config.js';

// Gabon E.164: +241 followed by 8 digits (no trunk prefix in international format)
// Airtel: +2417XXXXXXX | Moov: +2416XXXXXXX
const gabonPhoneRegex = /^\+241[0-9]{8}$/;

export const addPaymentMethodSchema = z.object({
  phoneNumber: z
    .string()
    .regex(gabonPhoneRegex, 'Format invalide — utilisez +24177XXXXXX (Airtel) ou +24167XXXXXX (Moov)'),
});

export const setDefaultPaymentMethodSchema = z.object({
  // no body — method ID comes from URL param
});

export const payoutSchema = z.object({
  amountXaf: z
    .number()
    .int()
    .min(config.PAYOUT_MIN_XAF, `Minimum payout is ${config.PAYOUT_MIN_XAF} XAF`)
    .max(config.PAYOUT_MAX_XAF, `Maximum payout is ${config.PAYOUT_MAX_XAF} XAF`),
  paymentMethodId: z.string().uuid('Invalid payment method ID'),
});

export type AddPaymentMethodInput = z.infer<typeof addPaymentMethodSchema>;
export type PayoutInput = z.infer<typeof payoutSchema>;
