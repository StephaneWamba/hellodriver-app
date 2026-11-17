import { config } from '../../core/config.js';
import { getRedis } from '../../plugins/redis.js';
import { sendSmsViaD7 } from './d7.client.js';
import type { SendOtpResult, VerifyOtpResult, OtpStore } from './sms.types.js';

/**
 * In-memory OTP store — used in test/dev only.
 * Production uses Redis (multi-machine safe).
 */
const otpStore = new Map<string, OtpStore>();


function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function redisKey(phone: string): string {
  return `otp:${phone}`;
}

/**
 * Delivers the OTP over SMS when a real provider is configured; otherwise
 * logs it (local dev / no provider configured yet). Never throws — a
 * delivery failure is reported back to the caller instead, since the OTP is
 * already persisted and the user can retry "Renvoyer le code".
 */
async function dispatchOtp(phone: string, code: string): Promise<{ delivered: boolean; error?: string }> {
  if (config.SMS_PROVIDER !== 'd7' || !config.D7_NETWORKS_API_KEY) {
    console.log(`🔐 OTP for ${phone}: ${code} (expires in ${Math.floor(config.OTP_TTL_SECONDS / 60)} min) — no SMS provider configured, logged only`);
    return { delivered: false };
  }

  try {
    await sendSmsViaD7(phone, `Votre code HelloDriver : ${code}`);
    return { delivered: true };
  } catch (err) {
    console.error('D7 Networks SMS send failed:', err instanceof Error ? err.message : err);
    return { delivered: false, error: 'SMS delivery failed' };
  }
}

export async function sendOTP(phone: string): Promise<SendOtpResult> {
  if (!phone.match(/^\+241[0-9]{7,9}$/)) {
    return { success: false, error: 'Invalid Gabon phone number format' };
  }

  const now = Date.now();
  const fifteenMinutesAgo = now - config.OTP_RATE_LIMIT_WINDOW_MS;

  if (config.NODE_ENV === 'production') {
    // --- Redis path (production, multi-machine safe) ---
    const redis = getRedis();
    const raw = await redis.get(redisKey(phone));
    const stored: OtpStore | null = raw ? JSON.parse(raw) : null;
    const recentRequests = (stored?.requestHistory ?? []).filter(ts => ts > fifteenMinutesAgo);

    if (recentRequests.length >= config.OTP_RATE_LIMIT_MAX) {
      return { success: false, error: 'Too many OTP requests. Please try again later.' };
    }

    const code = generateOTP();
    const expiresAt = new Date(now + config.OTP_TTL_SECONDS * 1000);

    const entry: OtpStore = {
      code,
      phone,
      expiresAt,
      attempts: 0,
      maxAttempts: 3,
      requestHistory: [...recentRequests, now],
    };

    await redis.setex(redisKey(phone), config.OTP_TTL_SECONDS, JSON.stringify(entry));

    const delivery = await dispatchOtp(phone, code);
    if (!delivery.delivered && config.SMS_PROVIDER === 'd7') {
      // A real provider is configured but the send failed — the user has no
      // other way to receive this code, so say so instead of stranding them
      // on the "enter code" screen waiting for an SMS that will never arrive.
      return { success: false, error: "Échec de l'envoi du SMS. Réessayez dans un instant." };
    }
    return { success: true };
  } else {
    // --- In-memory path (test/dev) ---
    const stored = otpStore.get(phone);
    const recentRequests = (stored?.requestHistory ?? []).filter(ts => ts > fifteenMinutesAgo);

    if (recentRequests.length >= config.OTP_RATE_LIMIT_MAX) {
      return { success: false, error: 'Too many OTP requests. Please try again later.' };
    }

    const code = generateOTP();
    const expiresAt = new Date(now + config.OTP_TTL_SECONDS * 1000);

    otpStore.set(phone, {
      code,
      phone,
      expiresAt,
      attempts: 0,
      maxAttempts: 3,
      requestHistory: [...recentRequests, now],
    });

    console.log(`🔐 OTP for ${phone}: ${code} (expires in 10 min)`);
    return { success: true, code };
  }
}

function verifyRateLimitKey(phone: string): string {
  return `otp_verify_rate:${phone}`;
}

export async function verifyOTP(phone: string, code: string): Promise<VerifyOtpResult> {
  if (config.NODE_ENV === 'production') {
    // --- Redis path ---
    const redis = getRedis();

    // Rate limit verify attempts per phone: max 10 per 15 minutes across all OTP cycles
    const rlKey = verifyRateLimitKey(phone);
    const attempts = await redis.incr(rlKey);
    if (attempts === 1) {
      await redis.expire(rlKey, Math.floor(config.OTP_RATE_LIMIT_WINDOW_MS / 1000));
    }
    if (attempts > 10) {
      return { success: false, error: 'Too many verification attempts. Please try again later.' };
    }

    const raw = await redis.get(redisKey(phone));

    if (!raw) {
      return { success: false, error: 'OTP not found. Please request a new one.' };
    }

    const stored: OtpStore = JSON.parse(raw);

    if (new Date() > new Date(stored.expiresAt)) {
      await redis.del(redisKey(phone));
      return { success: false, error: 'OTP has expired. Please request a new one.' };
    }

    if (stored.attempts >= stored.maxAttempts) {
      await redis.del(redisKey(phone));
      return { success: false, error: 'Too many failed attempts. Please request a new OTP.' };
    }

    if (stored.code !== code) {
      stored.attempts += 1;
      // Preserve the original expiry — use remaining TTL, not a fresh one.
      const remainingTtl = await redis.ttl(redisKey(phone));
      const ttl = remainingTtl > 0 ? remainingTtl : 1;
      await redis.setex(redisKey(phone), ttl, JSON.stringify(stored));
      return {
        success: false,
        error: `Invalid OTP. ${stored.maxAttempts - stored.attempts} attempts remaining.`,
      };
    }

    await redis.del(redisKey(phone));
    return { success: true };
  } else {
    // --- In-memory path ---
    const stored = otpStore.get(phone);

    if (!stored) {
      return { success: false, error: 'OTP not found. Please request a new one.' };
    }

    if (new Date() > stored.expiresAt) {
      otpStore.delete(phone);
      return { success: false, error: 'OTP has expired. Please request a new one.' };
    }

    if (stored.attempts >= stored.maxAttempts) {
      otpStore.delete(phone);
      return { success: false, error: 'Too many failed attempts. Please request a new OTP.' };
    }

    if (stored.code !== code) {
      stored.attempts += 1;
      return {
        success: false,
        error: `Invalid OTP. ${stored.maxAttempts - stored.attempts} attempts remaining.`,
      };
    }

    otpStore.delete(phone);
    return { success: true };
  }
}

/**
 * Get OTP for testing purposes — reads from in-memory store (test/dev only).
 * For E2E tests against production, read directly from Redis: GET otp:{phone}
 */
export function getOTPForTesting(phone: string): string | undefined {
  return otpStore.get(phone)?.code;
}
