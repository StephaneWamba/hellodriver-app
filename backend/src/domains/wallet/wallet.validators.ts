import { z } from 'zod';
import { config } from '../../core/config.js';

export const depositSchema = z.object({
  amountXaf: z
    .number()
    .int()
    .min(config.DEPOSIT_MIN_XAF, `Minimum deposit is ${config.DEPOSIT_MIN_XAF} XAF`)
    .max(config.DEPOSIT_MAX_XAF, `Maximum deposit is ${config.DEPOSIT_MAX_XAF} XAF`),
  paymentMethodId: z.string().uuid('Invalid payment method ID'),
});

export const transactionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type DepositInput = z.infer<typeof depositSchema>;
export type TransactionsQueryInput = z.infer<typeof transactionsQuerySchema>;
