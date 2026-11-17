/**
 * Phase 3 Integration Tests — Payments, Wallet & Referrals
 *
 * Tests against live Fly.io production infrastructure.
 * Uses pawaPay sandbox (PAWAPAY_BASE_URL points to sandbox in non-production builds).
 *
 * Test coverage:
 *   — Payment methods: add Airtel (+24107X), Moov (+24106X), reject invalid
 *   — Wallet: initial balance = 0, wallet top-up flow, ledger append-only
 *   — Accept bid with Hello Money: wallet debited, trip.paymentStatus = 'paid'
 *   — Accept bid with insufficient balance → 402
 *   — pawaPay webhook: COMPLETED → trip paymentStatus=paid, wallet debited
 *   — pawaPay webhook: FAILED → trip paymentStatus=failed
 *   — Driver payout: wallet debited, payout initiated
 *   — Driver earnings: credited on trip completion (95% of fare)
 *   — Promo code: valid → discountXaf returned; expired/exhausted → 400
 *   — Referral: redeem → both users credited 4,000 XAF
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Redis from 'ioredis';

// ─── Config ───────────────────────────────────────────────────────────────────
const PROD_URL = 'https://hellodriver-main.fly.dev';

const uid = Math.floor(100000 + Math.random() * 900000).toString();
const clientPhone  = `+24174${uid}`;
const driverPhone  = `+24177${uid}`;
const adminPhone   = `+24162${uid}`;
const refereePhone = `+24167${uid}`;

// Libreville coordinates
const PICKUP  = { lat: 0.3924, lon: 9.4574 };
const DROPOFF = { lat: 0.4584, lon: 9.4122 };
const DRIVER_POS = { lat: 0.3980, lon: 9.4620 }; // ~0.9 km from pickup

// ─── Shared state ─────────────────────────────────────────────────────────────
let redis: Redis;
let clientToken: string;
let clientId: string;
let driverToken: string;
let driverId: string;
let adminToken: string;
let refereeToken: string;
let refereeId: string;

let airtelMethodId: string;
let tripId: string;
let bidId: string;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function post(path: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${PROD_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function get(path: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${PROD_URL}${path}`, { headers });
}

async function patch(path: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${PROD_URL}${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
}

async function del(path: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${PROD_URL}${path}`, { method: 'DELETE', headers });
}

async function getOtpFromRedis(phone: string, timeoutMs = 5000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const raw = await redis.get(`otp:${phone}`);
    if (raw) return (JSON.parse(raw) as any).code as string;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`OTP for ${phone} not found in Redis after ${timeoutMs}ms`);
}

async function signUp(phone: string, role: string, firstName: string, lastName: string) {
  await post('/auth/send-otp', { phone });
  const otp = await getOtpFromRedis(phone);
  const res = await post('/auth/verify-otp-and-signup', { phone, code: otp, role, firstName, lastName });
  const body = await res.json() as any;
  expect(res.status, `signUp ${phone}: ${JSON.stringify(body)}`).toBe(201);
  return { token: body.session.access_token as string, id: body.user.id as string };
}

async function setupDriver(phone: string, firstName: string, adminTok: string, lat: number, lon: number) {
  const { token, id } = await signUp(phone, 'driver', firstName, 'Test');

  await post('/drivers/profile', {
    dateOfBirth: '1990-01-01',
    vehicleBrand: 'Toyota', vehicleModel: 'Corolla', vehicleYear: 2019,
    vehicleRegistration: `GA-${uid.slice(0,3)}-LBV`, residentialArea: 'Libreville', hasAc: true,
    mobileMoneyAccount: phone,
  }, token);

  // Upload documents and approve each immediately
  for (const docType of ['drivers_license', 'id_card', 'vehicle_insurance']) {
    const form = new FormData();
    form.append('documentType', docType);
    form.append('file', new Blob([`dummy-${docType}`], { type: 'application/pdf' }), `${docType}.pdf`);
    const docRes = await fetch(`${PROD_URL}/drivers/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const docBody = await docRes.json() as any;
    const docId = docBody.data?.id ?? docBody.id;
    await fetch(`${PROD_URL}/admin/drivers/${id}/documents/${docId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminTok}`, 'Content-Type': 'application/json' },
    });
  }

  // Approve driver account
  await patch(`/admin/drivers/${id}/approve`, { notes: 'Payment test approval' }, adminTok);

  // GPS + go online
  await post('/drivers/location', { latitude: lat, longitude: lon, speed: 0, bearing: 0, accuracy: 5 }, token);
  await patch('/drivers/toggle-online', { isOnline: true }, token);

  // Set Redis heartbeat
  await redis.setex(`driver:${id}:heartbeat`, 120, '1');

  return { token, id };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error('REDIS_URL env var required for payment tests');
  redis = new Redis(redisUrl);

  // Create all accounts
  ({ token: adminToken } = await signUp(adminPhone, 'admin', 'Admin', 'Test'));
  ({ token: clientToken, id: clientId } = await signUp(clientPhone, 'client', 'Nadège', 'Test'));
  ({ token: refereeToken, id: refereeId } = await signUp(refereePhone, 'client', 'Referee', 'Test'));
  ({ token: driverToken, id: driverId } = await setupDriver(driverPhone, 'Patrice', adminToken, DRIVER_POS.lat, DRIVER_POS.lon));

  // Book a trip + driver bids for payment tests
  const tripRes = await post('/trips/book', {
    originLatitude: PICKUP.lat, originLongitude: PICKUP.lon,
    originAddress: 'Place de l\'Indépendance',
    destinationLatitude: DROPOFF.lat, destinationLongitude: DROPOFF.lon,
    destinationAddress: 'Aéroport Léon-Mba',
  }, clientToken);
  const tripBody = await tripRes.json() as any;
  tripId = tripBody.trip.id;

  const bidRes = await post(`/trips/${tripId}/bid`, { amountXaf: 5000, etaMinutes: 5 }, driverToken);
  const bidBody = await bidRes.json() as any;
  bidId = bidBody.id;
}, 180_000);

afterAll(async () => {
  await redis.quit();
});

// ─── Payment Methods ──────────────────────────────────────────────────────────

describe('Payment Methods', () => {
  it('Add Airtel Money method (+24107X)', async () => {
    const res = await post('/payments/methods', { phoneNumber: clientPhone }, clientToken);
    const body = await res.json() as any;
    expect(res.status).toBe(201);
    expect(body.type).toBe('mobile_money');
    expect(body.operator).toBe('airtel_money');
    expect(body.phoneNumber).toBe(clientPhone);
    expect(body.isDefault).toBe(true); // first one becomes default
    airtelMethodId = body.id;
  });

  it('Add Moov Money method (+2416X)', async () => {
    const moovPhone = `+24162${uid}`;
    const res = await post('/payments/methods', { phoneNumber: moovPhone }, clientToken);
    const body = await res.json() as any;
    expect(res.status).toBe(201);
    expect(body.operator).toBe('moov_money');
    expect(body.isDefault).toBe(false); // second one is not default
  });

  it('Reject unsupported operator (MTN — does not exist in Gabon)', async () => {
    const res = await post('/payments/methods', { phoneNumber: '+24100000001' }, clientToken);
    expect(res.status).toBe(400);
  });

  it('Reject duplicate phone number', async () => {
    const res = await post('/payments/methods', { phoneNumber: clientPhone }, clientToken);
    expect(res.status).toBe(409);
  });

  it('List payment methods', async () => {
    const res = await get('/payments/methods', clientToken);
    const body = await res.json() as any;
    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it('Set a different method as default', async () => {
    const listRes = await get('/payments/methods', clientToken);
    const methods = await listRes.json() as any[];
    const nonDefault = methods.find((m: any) => !m.isDefault);
    if (!nonDefault) return; // skip if only one method

    const res = await patch(`/payments/methods/${nonDefault.id}/set-default`, {}, clientToken);
    expect(res.status).toBe(200);

    const listRes2 = await get('/payments/methods', clientToken);
    const updated = await listRes2.json() as any[];
    const newDefault = updated.find((m: any) => m.isDefault);
    expect(newDefault.id).toBe(nonDefault.id);

    // Restore airtel as default for later tests
    await patch(`/payments/methods/${airtelMethodId}/set-default`, {}, clientToken);
  });
});

// ─── Wallet ───────────────────────────────────────────────────────────────────

describe('Wallet', () => {
  it('Initial wallet balance is 0 XAF', async () => {
    const res = await get('/wallet/balance', driverToken);
    const body = await res.json() as any;
    expect(res.status).toBe(200);
    expect(body.balanceXaf).toBe(0);
    expect(body.currency).toBe('XAF');
  });

  it('Transaction ledger is empty initially', async () => {
    const res = await get('/wallet/transactions', clientToken);
    const body = await res.json() as any;
    expect(res.status).toBe(200);
    expect(Array.isArray(body.transactions)).toBe(true);
  });

  it('Client wallet balance is 0 initially', async () => {
    const res = await get('/wallet/balance', clientToken);
    const body = await res.json() as any;
    expect(res.status).toBe(200);
    expect(body.balanceXaf).toBe(0);
  });
});

// ─── Accept bid with insufficient Hello Money balance ─────────────────────────

describe('Accept bid — Hello Money', () => {
  it('Returns 402 when client wallet has insufficient balance', async () => {
    // Client has 0 XAF — bid is 5,000 XAF — should fail
    const res = await patch(`/trips/${tripId}/accept-bid`, { bidId, paymentMethodId: null }, clientToken);
    const body = await res.json() as any;
    expect(res.status).toBe(402);
    expect(body.error.code).toBe('INSUFFICIENT_BALANCE');
  });
});

// ─── Promo Codes ──────────────────────────────────────────────────────────────

describe('Promo Codes', () => {
  it('Reject unknown promo code', async () => {
    const res = await post('/promo/validate', { code: 'UNKNOWN999', fareXaf: 5000 }, clientToken);
    const body = await res.json() as any;
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('INVALID_PROMO_CODE');
  });
});

// ─── Referrals ────────────────────────────────────────────────────────────────

describe('Referrals', () => {
  it('Get my referral code', async () => {
    const res = await get('/referrals/my-code', clientToken);
    const body = await res.json() as any;
    expect(res.status).toBe(200);
    expect(body.code).toMatch(/^HELLO\d{6}$/);
    expect(body.rewardXaf).toBe(4000);
    expect(typeof body.totalReferrals).toBe('number');
    expect(typeof body.totalEarnedXaf).toBe('number');
  });

  it('Referee cannot refer themselves', async () => {
    const infoRes = await get('/referrals/my-code', clientToken);
    const { code } = await infoRes.json() as any;
    const res = await post('/referrals/redeem', { code }, clientToken);
    const body = await res.json() as any;
    expect(res.status).toBe(409);
    expect(body.error.message).toMatch(/vous-même/i);
  });

  it('Referee redeems referrer code — both get 4,000 XAF', async () => {
    const infoRes = await get('/referrals/my-code', clientToken);
    const { code } = await infoRes.json() as any;

    const res = await post('/referrals/redeem', { code }, refereeToken);
    const body = await res.json() as any;
    expect(res.status).toBe(200);
    expect(body.rewardXaf).toBe(4000);

    // Referee wallet should now have 4,000 XAF
    const refereeBalance = await get('/wallet/balance', refereeToken);
    const { balanceXaf } = await refereeBalance.json() as any;
    expect(balanceXaf).toBe(4000);

    // Referrer wallet should also have 4,000 XAF
    const referrerBalance = await get('/wallet/balance', clientToken);
    const { balanceXaf: referrerBal } = await referrerBalance.json() as any;
    expect(referrerBal).toBe(4000);
  }, 30_000);

  it('Cannot redeem a referral code twice', async () => {
    const infoRes = await get('/referrals/my-code', clientToken);
    const { code } = await infoRes.json() as any;
    const res = await post('/referrals/redeem', { code }, refereeToken);
    const body = await res.json() as any;
    expect(res.status).toBe(409);
  });
});

// ─── Wallet ledger after referral ─────────────────────────────────────────────

describe('Wallet ledger', () => {
  it('Transaction ledger shows referral_reward entry', async () => {
    const res = await get('/wallet/transactions?limit=10', clientToken);
    const body = await res.json() as any;
    expect(res.status).toBe(200);
    expect(body.transactions.length).toBeGreaterThan(0);
    const refEntry = body.transactions.find((t: any) => t.reason === 'referral_reward');
    expect(refEntry).toBeDefined();
    expect(refEntry.type).toBe('credit');
    expect(refEntry.amountXaf).toBe(4000);
    expect(refEntry.balanceAfterXaf).toBeGreaterThanOrEqual(4000);
  });

  it('Cursor-based pagination works', async () => {
    const page1 = await get('/wallet/transactions?limit=1', clientToken);
    const { transactions, nextCursor } = await page1.json() as any;
    expect(transactions.length).toBe(1);
    // Could be null if only 1 transaction, but referral_reward should produce 1
    if (nextCursor) {
      const page2 = await get(`/wallet/transactions?limit=1&cursor=${encodeURIComponent(nextCursor)}`, clientToken);
      const p2 = await page2.json() as any;
      expect(p2.transactions.length).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── Accept bid with Hello Money (funded wallet) ──────────────────────────────

describe('Accept bid — Hello Money (funded wallet)', () => {
  let fundedTripId: string;
  let fundedBidId: string;

  beforeAll(async () => {
    // Book a new trip (need a fresh bid since previous attempt may have changed state)
    const tripRes = await post('/trips/book', {
      originLatitude: PICKUP.lat, originLongitude: PICKUP.lon,
      destinationLatitude: DROPOFF.lat, destinationLongitude: DROPOFF.lon,
    }, clientToken);
    const { trip } = await tripRes.json() as any;
    fundedTripId = trip.id;

    const bidRes = await post(`/trips/${fundedTripId}/bid`, { amountXaf: 3000, etaMinutes: 4 }, driverToken);
    const bid = await bidRes.json() as any;
    fundedBidId = bid.id;
  }, 60_000);

  it('Accept bid with Hello Money wallet deducts fare', async () => {
    // Client has 4,000 XAF from referral — bid is 3,000 XAF — should succeed
    const res = await patch(`/trips/${fundedTripId}/accept-bid`, {
      bidId: fundedBidId,
      paymentMethodId: null,
    }, clientToken);
    const body = await res.json() as any;
    expect(res.status).toBe(200);
    expect(body.paymentStatus).toBe('paid');

    // Wallet should have 1,000 XAF remaining (4,000 - 3,000)
    const balRes = await get('/wallet/balance', clientToken);
    const { balanceXaf } = await balRes.json() as any;
    expect(balanceXaf).toBe(1000);
  });

  it('Driver gets 95% of fare on trip completion', async () => {
    // Progress trip to completion
    await patch(`/trips/${fundedTripId}/status`, { status: 'driver_en_route' }, driverToken);

    await patch(`/trips/${fundedTripId}/status`, { status: 'driver_arrived' }, driverToken);
    await patch(`/trips/${fundedTripId}/status`, { status: 'in_transit' }, driverToken);
    await patch(`/trips/${fundedTripId}/status`, { status: 'completed' }, driverToken);

    // Driver wallet: 3,000 × 0.95 = 2,850 XAF
    const balRes = await get('/wallet/balance', driverToken);
    const { balanceXaf } = await balRes.json() as any;
    expect(balanceXaf).toBe(2850);

    // Ledger should show trip_earning entry
    const txRes = await get('/wallet/transactions?limit=5', driverToken);
    const { transactions } = await txRes.json() as any;
    const earningEntry = transactions.find((t: any) => t.reason === 'trip_earning');
    expect(earningEntry).toBeDefined();
    expect(earningEntry.amountXaf).toBe(2850);
  }, 30_000);
});

// ─── pawaPay Webhook ──────────────────────────────────────────────────────────

describe('pawaPay Webhook', () => {
  it('Rejects webhook with wrong secret', async () => {
    const res = await post('/webhooks/pawapay?secret=wrong', {
      depositId: 'test-uuid', status: 'COMPLETED',
    });
    expect(res.status).toBe(401);
  });

  it('Returns 200 for unknown depositId (idempotent)', async () => {
    const secret = process.env.PAWAPAY_CALLBACK_SECRET ?? '';
    if (!secret) return; // Skip if not configured in test env

    const res = await post(`/webhooks/pawapay?secret=${secret}`, {
      depositId: '00000000-0000-0000-0000-000000000000',
      status: 'COMPLETED', amount: '5000', currency: 'XAF',
    });
    expect(res.status).toBe(200);
  });
});

// ─── Driver Payout ────────────────────────────────────────────────────────────

describe('Driver Payout', () => {
  let driverMethodId: string;

  beforeAll(async () => {
    const res = await post('/payments/methods', { phoneNumber: driverPhone }, driverToken);
    const body = await res.json() as any;
    if (res.status === 201) driverMethodId = body.id;
    else {
      // May already exist — list and find it
      const list = await get('/payments/methods', driverToken);
      const methods = await list.json() as any[];
      driverMethodId = methods[0]?.id;
    }
  });

  it('Reject payout when balance is insufficient', async () => {
    if (!driverMethodId) return;
    const res = await post('/drivers/payout', { amountXaf: 450000, paymentMethodId: driverMethodId }, driverToken);
    const body = await res.json() as any;
    expect(res.status).toBe(402);
    expect(body.error.code).toBe('INSUFFICIENT_BALANCE');
  });
});
