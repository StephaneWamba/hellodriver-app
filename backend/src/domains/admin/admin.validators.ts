import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(['client', 'driver', 'admin']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const suspendUserSchema = z.object({
  suspend: z.boolean(),
  reason: z.string().trim().min(3).max(500).optional(),
});

export const updateUserProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
});

export const adjustWalletSchema = z.object({
  type: z.enum(['credit', 'debit']),
  amountXaf: z.coerce.number().int().positive(),
  reason: z.string().trim().min(3).max(300),
});

export const listTransactionsQuerySchema = z.object({
  reason: z.string().trim().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const listTripsQuerySchema = z.object({
  status: z.string().trim().max(30).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createPromoCodeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{4,20}$/, 'Le code doit contenir 4 à 20 lettres/chiffres'),
    type: z.enum(['fixed_xaf', 'percentage']),
    value: z.coerce.number().int().positive(),
    maxUses: z.coerce.number().int().positive().optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .refine((data) => data.type !== 'percentage' || data.value <= 100, {
    message: 'Un pourcentage ne peut pas dépasser 100',
    path: ['value'],
  });

export const createAdminSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  password: z.string().min(10).max(200),
});

export const updatePromoCodeSchema = z.object({
  value: z.coerce.number().int().positive().optional(),
  maxUses: z.coerce.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const listPaymentsQuerySchema = z.object({
  status: z.enum(['pending', 'completed', 'failed']).optional(),
  type: z.enum(['deposit', 'payout', 'refund']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
