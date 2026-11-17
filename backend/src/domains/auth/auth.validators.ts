import { z } from 'zod';

/**
 * Gabon E.164 phone: +241 followed by 8 digits (no trunk prefix in international format)
 * Airtel: +2417XXXXXXX | Moov: +2416XXXXXXX
 * Examples: +24177716770, +24167123456
 */
const gabonPhoneRegex = /^\+241[0-9]{8}$/;

/**
 * Name validation: alphanumeric, spaces, hyphens, apostrophes (French names)
 * Must be 2-100 characters after trimming
 */
const nameRegex = /^[a-zA-ZÀ-ÿ]([a-zA-ZÀ-ÿ\s\-']*[a-zA-ZÀ-ÿ])?$/;

export const signupSchema = z.object({
  phone: z.string().trim().regex(gabonPhoneRegex, 'Numéro invalide — format requis: +24177XXXXXX (Airtel) ou +24167XXXXXX (Moov)'),
  role: z.enum(['client', 'driver']),
  firstName: z.string()
    .trim()
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name must be at most 100 characters')
    .regex(nameRegex, 'First name contains invalid characters (use letters, spaces, hyphens, apostrophes)'),
  lastName: z.string()
    .trim()
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name must be at most 100 characters')
    .regex(nameRegex, 'Last name contains invalid characters (use letters, spaces, hyphens, apostrophes)'),
  email: z.string().email('Invalid email format').toLowerCase().optional().or(z.literal('')),
});

export const otpSchema = z.object({
  phone: z.string().trim().regex(gabonPhoneRegex, 'Numéro invalide — format requis: +241XXXXXXXX'),
  code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export const profileUpdateSchema = z.object({
  firstName: z.string()
    .trim()
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name must be at most 100 characters')
    .regex(nameRegex, 'First name contains invalid characters')
    .optional(),
  lastName: z.string()
    .trim()
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name must be at most 100 characters')
    .regex(nameRegex, 'Last name contains invalid characters')
    .optional(),
  email: z.string().email('Invalid email format').toLowerCase().optional().or(z.literal('')),
  avatarUrl: z.string().url().optional(),
  // 'admin' is intentionally excluded — never settable via self-service profile update.
  role: z.enum(['client', 'driver']).optional(),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const adminChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string().min(10, 'Le nouveau mot de passe doit contenir au moins 10 caractères'),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type OtpInput = z.infer<typeof otpSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminChangePasswordInput = z.infer<typeof adminChangePasswordSchema>;
