/**
 * Environment configuration - validated on startup
 */

const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NODE_ENV',
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});

// Payment secrets must be present in production.
if (process.env.NODE_ENV === 'production') {
  ['PAWAPAY_API_TOKEN', 'PAWAPAY_CALLBACK_SECRET', 'PLATFORM_USER_ID'].forEach((envVar) => {
    if (!process.env[envVar]) {
      throw new Error(`Missing required production environment variable: ${envVar}`);
    }
  });
}

// JWT_SECRET can be either JWT_SECRET or SUPABASE_JWT_SECRET
const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
if (!jwtSecret) {
  throw new Error('Missing required environment variable: JWT_SECRET or SUPABASE_JWT_SECRET');
}

export const config = {
  // Server
  NODE_ENV: process.env.NODE_ENV as 'development' | 'production' | 'test',
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',

  // Database
  DATABASE_URL: process.env.DATABASE_URL!,
  REDIS_URL: process.env.REDIS_URL!,

  // Auth — JWT tokens
  JWT_SECRET: jwtSecret,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_ACCESS_EXPIRES_SECONDS: parseInt(process.env.JWT_ACCESS_EXPIRES_SECONDS || '900', 10),
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  SUPABASE_STORAGE_BUCKET: 'driver-documents',

  // SMS (D7 Networks or mock)
  D7_NETWORKS_API_KEY: process.env.D7_NETWORKS_API_KEY,
  // Sender ID shown to recipients — must be pre-registered with D7 for most
  // destination networks, or delivery is silently downgraded/rejected.
  SMS_ORIGINATOR: process.env.SMS_ORIGINATOR ?? 'HelloDriver',
  SMS_PROVIDER: (process.env.SMS_PROVIDER as 'd7' | 'mock') || 'mock',
  OTP_TTL_SECONDS: parseInt(process.env.OTP_TTL_SECONDS || '600', 10),
  OTP_RATE_LIMIT_WINDOW_MS: parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10),
  OTP_RATE_LIMIT_MAX: parseInt(process.env.OTP_RATE_LIMIT_MAX || '3', 10),

  // pawaPay (Airtel Money + Moov Money — only gateway in Gabon)
  PAWAPAY_API_TOKEN: process.env.PAWAPAY_API_TOKEN ?? '',
  PAWAPAY_BASE_URL:
    process.env.PAWAPAY_BASE_URL ??
    (process.env.NODE_ENV === 'production'
      ? 'https://api.pawapay.io'
      : 'https://api.sandbox.pawapay.io'),
  PAWAPAY_CALLBACK_SECRET: process.env.PAWAPAY_CALLBACK_SECRET ?? '',

  // Platform wallet — receives 5% commission per trip
  PLATFORM_USER_ID: process.env.PLATFORM_USER_ID ?? '',

  // Business constants
  COMMISSION_RATE: 0.05,
  REFERRAL_REWARD_XAF: 4000,

  // Trip pricing (XAF)
  TRIP_BASE_FARE_XAF: parseInt(process.env.TRIP_BASE_FARE_XAF || '1500', 10),
  TRIP_PER_KM_RATE_XAF: parseInt(process.env.TRIP_PER_KM_RATE_XAF || '500', 10),
  TRIP_ROAD_DISTANCE_FACTOR: parseFloat(process.env.TRIP_ROAD_DISTANCE_FACTOR || '1.3'),

  // Trip matching & timing
  DRIVER_MATCHING_RADIUS_KM: parseFloat(process.env.DRIVER_MATCHING_RADIUS_KM || '5'),
  TRIP_BID_EXPIRY_MS: parseInt(process.env.TRIP_BID_EXPIRY_MS || String(2 * 60 * 1000), 10),
  TRIP_BID_REDIS_TTL_SECONDS: parseInt(process.env.TRIP_BID_REDIS_TTL_SECONDS || '30', 10),
  TRIP_ACTIVE_REDIS_TTL_SECONDS: parseInt(process.env.TRIP_ACTIVE_REDIS_TTL_SECONDS || '7200', 10),

  // Driver presence
  DRIVER_HEARTBEAT_TTL_SECONDS: parseInt(process.env.DRIVER_HEARTBEAT_TTL_SECONDS || '25', 10),
  DRIVER_ONLINE_TTL_SECONDS: parseInt(process.env.DRIVER_ONLINE_TTL_SECONDS || '86400', 10),

  // Payment worker polling
  PAYMENT_POLL_DELAY_MS: parseInt(process.env.PAYMENT_POLL_DELAY_MS || '30000', 10),
  PAYMENT_POLL_ATTEMPTS: parseInt(process.env.PAYMENT_POLL_ATTEMPTS || '5', 10),

  // Wallet deposit/payout limits (XAF)
  DEPOSIT_MIN_XAF: parseInt(process.env.DEPOSIT_MIN_XAF || '500', 10),
  DEPOSIT_MAX_XAF: parseInt(process.env.DEPOSIT_MAX_XAF || '500000', 10),
  PAYOUT_MIN_XAF: parseInt(process.env.PAYOUT_MIN_XAF || '1000', 10),
  PAYOUT_MAX_XAF: parseInt(process.env.PAYOUT_MAX_XAF || '500000', 10),

  // Socket.io allowed origins
  CLIENT_ORIGINS: process.env.CLIENT_ORIGINS?.split(',') ?? ['http://localhost:3000'],

  // Google Places/Geocoding — server-side only. Never expose this key to the
  // client; the app calls our own /places/* proxy instead (also sidesteps
  // Places REST API's lack of browser CORS support).
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY ?? '',

  // Feature flags
  DEBUG: process.env.DEBUG === 'true',

  // Dev OTP backdoor — read OTP from Redis without SMS. Remove once D7 is live.
  DEV_OTP_SECRET: process.env.DEV_OTP_SECRET ?? '',

  // ── WhatsApp / Meta Cloud API ──────────────────────────────────────────────
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
  META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN ?? '',
  META_WEBHOOK_SECRET: process.env.META_WEBHOOK_SECRET ?? '',

  // ── WhatsApp simulator (demo channel while Meta business verification is pending) ──
  SIMULATOR_SECRET: process.env.SIMULATOR_SECRET ?? '',

  // ── LLM — Vercel AI SDK provider registry ─────────────────────────────────
  // Switch provider zero-code: change prefix e.g. openai:gpt-4o-mini
  LLM_FAST_MODEL: process.env.LLM_FAST_MODEL ?? 'anthropic:claude-haiku-4-5-20251001',
  LLM_QUALITY_MODEL: process.env.LLM_QUALITY_MODEL ?? 'anthropic:claude-haiku-4-5-20251001',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',

  // ── Agent session & behaviour ──────────────────────────────────────────────
  AGENT_SESSION_TTL_SECONDS: parseInt(process.env.AGENT_SESSION_TTL_SECONDS ?? '14400', 10),
  AGENT_LLM_FAST_TIMEOUT_MS: parseInt(process.env.AGENT_LLM_FAST_TIMEOUT_MS ?? '3000', 10),
  AGENT_LLM_QUALITY_TIMEOUT_MS: parseInt(process.env.AGENT_LLM_QUALITY_TIMEOUT_MS ?? '8000', 10),
  AGENT_CIRCUIT_BREAKER_THRESHOLD: parseInt(process.env.AGENT_CIRCUIT_BREAKER_THRESHOLD ?? '5', 10),
  AGENT_CIRCUIT_BREAKER_RESET_MS: parseInt(process.env.AGENT_CIRCUIT_BREAKER_RESET_MS ?? '60000', 10),
  AGENT_WHATSAPP_OUTBOUND_RATE: parseInt(process.env.AGENT_WHATSAPP_OUTBOUND_RATE ?? '80', 10),
} as const;

export type Config = typeof config;
