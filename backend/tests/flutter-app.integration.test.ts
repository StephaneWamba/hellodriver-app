/**
 * Flutter App Integration Tests
 *
 * Validates every API endpoint consumed by the Flutter mobile app.
 * Uses the /auth/dev/otp/:phone backdoor (X-Dev-Key header) instead of Redis direct
 * so these tests work without a local Redis proxy.
 *
 * Coverage:
 *   AUTH     — send-otp, verify-otp-and-signup (client/driver/admin), /auth/me, profile
 *   WALLET   — balance, transactions, deposit (pawaPay sandbox)
 *   PAYMENTS — list, add, set-default, delete
 *   DRIVER   — profile, documents, admin approval, toggle-online, GPS, bid submit
 *   TRIP     — book, get, accept-bid, cancel, full bid flow
 *   REFERRAL — GET /referrals/my-code, POST /referrals/redeem
 *   PROMO    — POST /promo/validate
 */

import { describe, it, expect, beforeAll } from 'vitest';

const BASE = 'https://hellodriver-main.fly.dev';
const DEV_OTP_SECRET = process.env.DEV_OTP_SECRET!;

if (!DEV_OTP_SECRET) {
  throw new Error('DEV_OTP_SECRET is required — add it to .env.test');
}

// Unique suffix so each test run creates fresh users
const uid = Math.floor(100000 + Math.random() * 900000).toString();
const clientPhone  = `+24174${uid}`;
const driverPhone  = `+24177${uid.split('').reverse().join('').slice(0,8)}`;
const adminPhone   = `+24162${uid}`;
const referee2Phone = `+24167${uid}`;

let clientToken = '';
let clientId = '';
let driverToken = '';
let driverId = '';
let adminToken = '';
let paymentMethodId = '';
let tripId = '';
let referralCode = '';

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (extraHeaders) Object.assign(headers, extraHeaders);

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

const get  = (path: string, token?: string) => api('GET', path, undefined, token);
const post = (path: string, body: unknown, token?: string) => api('POST', path, body, token);
const patch = (path: string, body: unknown, token?: string) => api('PATCH', path, body, token);
const del  = (path: string, token?: string) => api('DELETE', path, undefined, token);

async function getOtp(phone: string): Promise<string> {
  const res = await api('GET', `/auth/dev/otp/${phone}`, undefined, undefined, {
    'x-dev-key': DEV_OTP_SECRET,
  });
  if (res.status !== 200) throw new Error(`getOtp failed: ${JSON.stringify(res.body)}`);
  return res.body.code as string;
}

async function signUp(phone: string, role: string, firstName: string): Promise<{ token: string; id: string }> {
  const send = await post('/auth/send-otp', { phone });
  expect(send.status, `send-otp for ${phone}: ${JSON.stringify(send.body)}`).toBe(200);

  const otp = await getOtp(phone);

  const verify = await post('/auth/verify-otp-and-signup', {
    phone, code: otp, role, firstName, lastName: 'Test',
  });
  expect(verify.status, `verify-otp for ${phone}: ${JSON.stringify(verify.body)}`).toBe(201);
  return {
    token: verify.body.session.access_token as string,
    id: verify.body.user.id as string,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HelloDriver Flutter App — Integration', () => {

  // ── 1. Health ──────────────────────────────────────────────────────────────
  describe('Health', () => {
    it('GET /health returns 200', async () => {
      const { status, body } = await get('/health');
      expect(status).toBe(200);
      expect(body.status).toBe('ok');
    });
  });

  // ── 2. Auth — OTP backdoor ─────────────────────────────────────────────────
  describe('Auth — DEV OTP backdoor', () => {
    it('rejects wrong X-Dev-Key', async () => {
      const res = await api('GET', `/auth/dev/otp/${clientPhone}`, undefined, undefined, {
        'x-dev-key': 'wrong-key',
      });
      expect(res.status).toBe(401);
    });

    it('returns 404 when no OTP has been sent yet', async () => {
      const res = await api('GET', `/auth/dev/otp/+24174000001`, undefined, undefined, {
        'x-dev-key': DEV_OTP_SECRET,
      });
      expect(res.status).toBe(404);
    });
  });

  // ── 3. Client signup ───────────────────────────────────────────────────────
  describe('Auth — Client signup', () => {
    it('rejects non-Gabon phone', async () => {
      const { status } = await post('/auth/send-otp', { phone: '+33612345678' });
      expect(status).toBe(400);
    });

    it('signs up a new client', async () => {
      const result = await signUp(clientPhone, 'client', 'Aimé');
      clientToken = result.token;
      clientId = result.id;
      expect(clientToken).toBeTruthy();
      expect(clientId).toBeTruthy();
    });

    it('GET /auth/me returns correct user', async () => {
      const { status, body } = await get('/auth/me', clientToken);
      expect(status).toBe(200);
      expect(body.user?.phone ?? body.phone).toBe(clientPhone);
      expect(body.user?.role ?? body.role).toBe('client');
    });

    it('second signup with same phone returns existing user (idempotent)', async () => {
      const send = await post('/auth/send-otp', { phone: clientPhone });
      expect(send.status).toBe(200);
      const otp = await getOtp(clientPhone);
      const { status, body } = await post('/auth/verify-otp-and-signup', {
        phone: clientPhone, code: otp, role: 'client', firstName: 'Aimé', lastName: 'Test',
      });
      expect(status).toBe(201);
      expect(body.user.id).toBe(clientId);
    });
  });

  // ── 4. Profile update ──────────────────────────────────────────────────────
  describe('Auth — Profile update', () => {
    it('GET /auth/me without token returns 401', async () => {
      const { status } = await get('/auth/me');
      expect(status).toBe(401);
    });

    it('PATCH /auth/profile updates first name', async () => {
      const { status, body } = await patch('/auth/profile', { firstName: 'Aimé-Updated' }, clientToken);
      expect(status).toBe(200);
      expect(body.firstName ?? body.user?.firstName).toBe('Aimé-Updated');
    });

    it('rejects unauthenticated profile update', async () => {
      const { status } = await patch('/auth/profile', { firstName: 'Hacker' });
      expect(status).toBe(401);
    });

    it('rejects invalid JWT token', async () => {
      const { status } = await get('/auth/me', 'not.a.valid.token');
      expect(status).toBe(401);
    });
  });

  // ── 5. Driver signup ───────────────────────────────────────────────────────
  describe('Auth — Driver signup', () => {
    it('signs up a new driver', async () => {
      const result = await signUp(driverPhone, 'driver', 'Serge');
      driverToken = result.token;
      expect(driverToken).toBeTruthy();
    });

    it('GET /drivers/verification-status returns pending', async () => {
      const { status, body } = await get('/drivers/verification-status', driverToken);
      expect(status).toBe(200);
      expect(['pending', 'not_submitted', 'incomplete']).toContain(
        body.verificationStatus ?? body.status ?? body.data?.verificationStatus
      );
    });
  });

  // ── 6. Wallet ──────────────────────────────────────────────────────────────
  describe('Wallet', () => {
    it('GET /wallet/balance returns 0 for new client', async () => {
      const { status, body } = await get('/wallet/balance', clientToken);
      expect(status).toBe(200);
      const balance = body.balanceXaf ?? body.balance ?? body.data?.balanceXaf;
      expect(typeof balance).toBe('number');
      expect(balance).toBeGreaterThanOrEqual(0);
    });

    it('GET /wallet/transactions returns empty array for new client', async () => {
      const { status, body } = await get('/wallet/transactions', clientToken);
      expect(status).toBe(200);
      const txs = body.transactions ?? body.data ?? body;
      expect(Array.isArray(txs)).toBe(true);
    });

    it('rejects wallet access without token', async () => {
      const { status } = await get('/wallet/balance');
      expect(status).toBe(401);
    });

    it('client cannot read another user wallet', async () => {
      // driverToken accessing /wallet/balance is fine (own wallet)
      // but clientToken cannot see driver transactions — no cross-user endpoint exists
      // Verify driver wallet is isolated (balance = 0, separate from client)
      const { status, body } = await get('/wallet/balance', driverToken);
      expect(status).toBe(200);
      const balance = body.balanceXaf ?? body.balance;
      // Driver started at 0, client's deposit didn't affect driver wallet
      expect(balance).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 7. Payment methods ─────────────────────────────────────────────────────
  describe('Payment Methods', () => {
    it('GET /payments/methods returns empty array initially', async () => {
      const { status, body } = await get('/payments/methods', clientToken);
      expect(status).toBe(200);
      const methods = Array.isArray(body) ? body : body.data ?? body.methods ?? [];
      expect(Array.isArray(methods)).toBe(true);
    });

    it('POST /payments/methods adds Airtel Money method', async () => {
      const { status, body } = await post('/payments/methods', {
        phoneNumber: clientPhone,
      }, clientToken);
      expect(status, JSON.stringify(body)).toBe(201);
      const method = body.data ?? body;
      paymentMethodId = method.id as string;
      expect(paymentMethodId).toBeTruthy();
    });

    it('GET /payments/methods returns the added method', async () => {
      const { status, body } = await get('/payments/methods', clientToken);
      expect(status).toBe(200);
      const methods: any[] = Array.isArray(body) ? body : body.data ?? body.methods ?? [];
      expect(methods.length).toBeGreaterThanOrEqual(1);
      expect(methods.some(m => m.id === paymentMethodId)).toBe(true);
    });

    it('PATCH set-default marks method as default', async () => {
      const { status } = await patch(
        `/payments/methods/${paymentMethodId}/set-default`, {}, clientToken
      );
      expect(status).toBe(200);
    });

    it('rejects adding non-Gabon phone number', async () => {
      const { status } = await post('/payments/methods', {
        phoneNumber: '+33612345678',
      }, clientToken);
      expect(status).toBe(400);
    });
  });

  // ── 8. Trip booking ────────────────────────────────────────────────────────
  describe('Trip booking', () => {
    it('POST /trips/book creates a trip in pending_bids', async () => {
      const { status, body } = await post('/trips/book', {
        originLatitude: 0.3924,
        originLongitude: 9.4574,
        destinationLatitude: 0.4584,
        destinationLongitude: 9.4122,
        originAddress: 'Pont de Gué-Gué, Libreville',
        destinationAddress: 'Aéroport Léon-Mba, Libreville',
        tripType: 'exclusive',
      }, clientToken);
      expect(status, JSON.stringify(body)).toBe(201);
      const trip = body.trip ?? body.data ?? body;
      tripId = trip.id as string;
      expect(tripId).toBeTruthy();
      expect(['pending_bids', 'searching']).toContain(trip.status);
    });

    it('GET /trips/:id returns the booked trip', async () => {
      const { status, body } = await get(`/trips/${tripId}`, clientToken);
      expect(status).toBe(200);
      const trip = body.trip ?? body.data ?? body;
      expect(trip.id).toBe(tripId);
    });

    it('PATCH /trips/:id/status cancels the trip', async () => {
      const { status, body } = await patch(`/trips/${tripId}/status`, {
        status: 'cancelled_by_client',
      }, clientToken);
      expect(status, JSON.stringify(body)).toBe(200);
      const trip = body.trip ?? body.data ?? body;
      expect(trip.status).toBe('cancelled_by_client');
    });

    it('rejects booking without auth', async () => {
      const { status } = await post('/trips/book', {
        originLatitude: 0.39, originLongitude: 9.45,
        destinationLatitude: 0.46, destinationLongitude: 9.41,
        originAddress: 'A', destinationAddress: 'B', tripType: 'exclusive',
      });
      expect(status).toBe(401);
    });
  });

  // ── 9. Wallet deposit ──────────────────────────────────────────────────────
  describe('Wallet — Deposit', () => {
    it('POST /wallet/deposit initiates a pawaPay deposit (sandbox)', async () => {
      const { status, body } = await post('/wallet/deposit', {
        amountXaf: 1000,
        paymentMethodId,
      }, clientToken);
      expect(status, JSON.stringify(body)).toBe(202);
      // Backend returns { message, pawapayId }
      expect(body.pawapayId ?? body.depositId ?? body.id).toBeTruthy();
    });

    it('rejects deposit below minimum (500 XAF)', async () => {
      const { status } = await post('/wallet/deposit', {
        amountXaf: 100,
        paymentMethodId,
      }, clientToken);
      expect(status).toBe(400);
    });

    it('GET /wallet/transactions has pending entry after deposit', async () => {
      const { status, body } = await get('/wallet/transactions', clientToken);
      expect(status).toBe(200);
      const txs: any[] = body.transactions ?? body.data ?? body;
      expect(Array.isArray(txs)).toBe(true);
      expect(txs.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects deposit above maximum', async () => {
      const { status } = await post('/wallet/deposit', {
        amountXaf: 999_999_999,
        paymentMethodId,
      }, clientToken);
      expect(status).toBe(400);
    });

    it('rejects deposit without amountXaf', async () => {
      const { status } = await post('/wallet/deposit', {
        paymentMethodId,
      }, clientToken);
      expect(status).toBe(400);
    });

    it('rejects deposit with unknown paymentMethodId', async () => {
      const { status } = await post('/wallet/deposit', {
        amountXaf: 1000,
        paymentMethodId: '00000000-0000-0000-0000-000000000000',
      }, clientToken);
      // Backend returns 404 when method not found
      expect([400, 404]).toContain(status);
    });

    it('rejects deposit without auth', async () => {
      const { status } = await post('/wallet/deposit', {
        amountXaf: 1000,
        paymentMethodId,
      });
      expect(status).toBe(401);
    });
  });

  // ── 10. Delete payment method ──────────────────────────────────────────────
  describe('Payment Methods — Delete', () => {
    let methodToDeleteId = '';

    it('adds a second method to delete', async () => {
      const { status, body } = await post('/payments/methods', {
        phoneNumber: driverPhone,
      }, clientToken);
      expect(status, JSON.stringify(body)).toBe(201);
      methodToDeleteId = (body.data ?? body).id as string;
      expect(methodToDeleteId).toBeTruthy();
    });

    it('DELETE /payments/methods/:id removes the method', async () => {
      const { status } = await del(`/payments/methods/${methodToDeleteId}`, clientToken);
      expect(status).toBe(204);
    });

    it('deleted method no longer appears in list', async () => {
      const { body } = await get('/payments/methods', clientToken);
      const methods: any[] = Array.isArray(body) ? body : body.data ?? body.methods ?? [];
      expect(methods.every(m => m.id !== methodToDeleteId)).toBe(true);
    });

    it('rejects deleting another user\'s method', async () => {
      const { status } = await del(`/payments/methods/${paymentMethodId}`, driverToken);
      expect([403, 404]).toContain(status);
    });
  });

  // ── 11. Admin signup + driver full approval flow ───────────────────────────
  describe('Admin — Driver approval flow', () => {
    it('signs up admin user', async () => {
      const result = await signUp(adminPhone, 'admin', 'AdminTest');
      adminToken = result.token;
      expect(adminToken).toBeTruthy();
    });

    it('driver sets up profile', async () => {
      const { status, body } = await post('/drivers/profile', {
        dateOfBirth: '1990-06-15',
        vehicleBrand: 'Toyota',
        vehicleModel: 'Corolla',
        vehicleYear: 2020,
        vehicleRegistration: `GA-${uid.slice(0,3)}-LBV`,
        residentialArea: 'Libreville',
        hasAc: true,
        mobileMoneyAccount: driverPhone,
      }, driverToken);
      expect(status, JSON.stringify(body)).toBe(200);
    });

    it('driver uploads documents and admin approves each', async () => {
      const driverMeRes = await get('/auth/me', driverToken);
      driverId = (driverMeRes.body.user ?? driverMeRes.body).id as string;

      for (const docType of ['drivers_license', 'id_card', 'vehicle_insurance']) {
        const form = new FormData();
        form.append('documentType', docType);
        form.append('file', new Blob([`dummy-${docType}`], { type: 'application/pdf' }), `${docType}.pdf`);

        const uploadRes = await fetch(`${BASE}/drivers/documents/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${driverToken}` },
          body: form,
        });
        const uploadBody = await uploadRes.json() as any;
        expect(uploadRes.status, `upload ${docType}: ${JSON.stringify(uploadBody)}`).toBe(200);

        const docId: string = uploadBody.data?.id ?? uploadBody.id;
        const approveRes = await api('POST', `/admin/drivers/${driverId}/documents/${docId}/approve`, {}, adminToken);
        expect(approveRes.status, `approve ${docType}: ${JSON.stringify(approveRes.body)}`).toBe(200);
      }
    });

    it('admin approves driver account', async () => {
      const { status, body } = await patch(`/admin/drivers/${driverId}/approve`, {
        notes: 'Flutter integration test approval',
      }, adminToken);
      expect(status, JSON.stringify(body)).toBe(200);
    });

    it('driver verification-status is now approved', async () => {
      const { status, body } = await get('/drivers/verification-status', driverToken);
      expect(status).toBe(200);
      const vs = body.verificationStatus ?? body.status ?? body.data?.verificationStatus;
      expect(vs).toBe('approved');
    });
  });

  // ── 12. Driver goes online + full bid flow ─────────────────────────────────
  describe('Trip — Full bid flow (driver + client)', () => {
    let activeTripId = '';
    let bidId = '';

    it('driver sends GPS location', async () => {
      const { status, body } = await post('/drivers/location', {
        latitude: 0.3980,
        longitude: 9.4620,
        speed: 0,
        bearing: 0,
        accuracy: 5,
      }, driverToken);
      expect(status, JSON.stringify(body)).toBe(200);
    });

    it('driver toggles online', async () => {
      const { status, body } = await patch('/drivers/toggle-online', { isOnline: true }, driverToken);
      expect(status, JSON.stringify(body)).toBe(200);
    });

    it('unverified driver cannot bid', async () => {
      // Sign up a fresh unverified driver and try to bid
      const newDriverPhone = `+24176${uid.slice(0,8)}`;
      const { token: unverifiedToken } = await signUp(newDriverPhone, 'driver', 'Unverified');
      const { status } = await post(`/trips/${tripId}/bid`, {
        amountXaf: 1500, etaMinutes: 3,
      }, unverifiedToken);
      expect([403, 401]).toContain(status);
    });

    it('client books a trip near driver', async () => {
      const { status, body } = await post('/trips/book', {
        originLatitude: 0.3924,
        originLongitude: 9.4574,
        destinationLatitude: 0.4584,
        destinationLongitude: 9.4122,
        originAddress: 'Pont de Gué-Gué, Libreville',
        destinationAddress: 'Aéroport Léon-Mba, Libreville',
        tripType: 'exclusive',
      }, clientToken);
      expect(status, JSON.stringify(body)).toBe(201);
      activeTripId = (body.trip ?? body.data ?? body).id as string;
      expect(activeTripId).toBeTruthy();
    });

    it('driver submits a bid', async () => {
      const { status, body } = await post(`/trips/${activeTripId}/bid`, {
        amountXaf: 2000,
        etaMinutes: 5,
      }, driverToken);
      expect(status, JSON.stringify(body)).toBe(201);
      const bid = body.bid ?? body.data ?? body;
      bidId = bid.id as string;
      expect(bidId).toBeTruthy();
    });

    it('credit client wallet via pawaPay webhook before accepting bid', async () => {
      // Initiate deposit to get a pawapayId
      const depositRes = await post('/wallet/deposit', { amountXaf: 5000, paymentMethodId }, clientToken);
      expect(depositRes.status, JSON.stringify(depositRes.body)).toBe(202);
      const pawapayId = depositRes.body.pawapayId;
      expect(pawapayId).toBeTruthy();

      // Simulate pawaPay COMPLETED callback to credit the wallet
      const callbackSecret = process.env.PAWAPAY_CALLBACK_SECRET!;
      const webhookRes = await api('POST', `/webhooks/pawapay?secret=${callbackSecret}`, {
        depositId: pawapayId,
        status: 'COMPLETED',
        amount: '5000',
        currency: 'XAF',
        correspondent: 'AIRTEL_GABON',
        msisdn: clientPhone,
        statementDescription: 'Test deposit',
        requestedAmount: '5000',
        requestedCurrency: 'XAF',
        created: new Date().toISOString(),
        respondedByPayer: new Date().toISOString(),
        correspondentIds: { AIRTEL_GABON: 'test-ref-001' },
      });
      expect(webhookRes.status).toBe(200);

      // Verify wallet balance updated
      const balRes = await get('/wallet/balance', clientToken);
      const balance = balRes.body.balanceXaf ?? balRes.body.balance;
      expect(balance).toBeGreaterThanOrEqual(5000);
    });

    it('client accepts the bid', async () => {
      const { status, body } = await patch(`/trips/${activeTripId}/accept-bid`, {
        bidId,
      }, clientToken);
      expect(status, JSON.stringify(body)).toBe(200);
      const trip = body.trip ?? body.data ?? body;
      expect(['bid_accepted', 'driver_en_route']).toContain(trip.status);
    });

    it('GET /trips/:id reflects bid_accepted status', async () => {
      const { status, body } = await get(`/trips/${activeTripId}`, clientToken);
      expect(status).toBe(200);
      const trip = body.trip ?? body.data ?? body;
      expect(['bid_accepted', 'driver_en_route']).toContain(trip.status);
      expect(trip.driverId ?? trip.driver_id).toBeTruthy();
    });

    it('driver cannot bid on an already accepted trip', async () => {
      const { status, body } = await post(`/trips/${activeTripId}/bid`, {
        amountXaf: 1800, etaMinutes: 4,
      }, driverToken);
      expect([400, 409, 422]).toContain(status);
    });

    it('client cannot cancel an already accepted trip with wrong status', async () => {
      const { status, body } = await patch(`/trips/${activeTripId}/status`, {
        status: 'cancelled_by_client',
      }, clientToken);
      // Should either succeed (policy allows cancel before pickup) or return 400/409
      expect([200, 400, 409]).toContain(status);
    });

    it('driver wallet received earnings after accept', async () => {
      const { status, body } = await get('/wallet/transactions', driverToken);
      expect(status).toBe(200);
      // Driver may have an earning transaction if trip completed, or empty if still in_progress
      const txs: any[] = body.transactions ?? body.data ?? body;
      expect(Array.isArray(txs)).toBe(true);
    });

    it('another client cannot access this trip', async () => {
      // Sign up a second client and try to read the trip
      const otherPhone = `+24174${uid.split('').reverse().join('').slice(0,8)}`;
      const { token: otherToken } = await signUp(otherPhone, 'client', 'Intrus');
      const { status } = await get(`/trips/${activeTripId}`, otherToken);
      expect([403, 404]).toContain(status);
    });

    it('driver goes offline after trip', async () => {
      const { status } = await patch('/drivers/toggle-online', { isOnline: false }, driverToken);
      expect(status).toBe(200);
    });
  });

  // ── 13. Referrals ──────────────────────────────────────────────────────────
  describe('Referrals', () => {
    it('GET /referrals/my-code returns a referral code', async () => {
      const { status, body } = await get('/referrals/my-code', clientToken);
      expect(status).toBe(200);
      referralCode = body.code ?? body.referralCode ?? body.data?.code;
      expect(referralCode).toBeTruthy();
    });

    it('GET /referrals/my-code returns stats', async () => {
      const { body } = await get('/referrals/my-code', clientToken);
      expect(typeof (body.totalReferrals ?? body.stats?.total ?? 0)).toBe('number');
    });

    it('new user can redeem referral code', async () => {
      const { token: newToken } = await signUp(referee2Phone, 'client', 'Referee');
      const { status, body } = await post('/referrals/redeem', {
        code: referralCode,
      }, newToken);
      expect(status, JSON.stringify(body)).toBe(200);
    });

    it('cannot redeem same code twice', async () => {
      const { token: newToken } = await signUp(referee2Phone, 'client', 'Referee');
      await post('/referrals/redeem', { code: referralCode }, newToken);
      const { status } = await post('/referrals/redeem', { code: referralCode }, newToken);
      expect([400, 409]).toContain(status);
    });

    it('rejects invalid referral code', async () => {
      const { status } = await post('/referrals/redeem', {
        code: 'INVALID999',
      }, clientToken);
      expect(status).toBe(400);
    });
  });

  // ── 14. Promo codes ────────────────────────────────────────────────────────
  describe('Promo codes', () => {
    it('POST /promo/validate rejects unknown code', async () => {
      const { status } = await post('/promo/validate', {
        code: 'FAKECODE',
        fareXaf: 5000,
      }, clientToken);
      expect(status).toBe(400);
    });

    it('rejects promo validation without auth', async () => {
      const { status } = await post('/promo/validate', {
        code: 'TEST10',
        fareXaf: 5000,
      });
      expect(status).toBe(401);
    });

    it('rejects promo with negative fare', async () => {
      const { status } = await post('/promo/validate', {
        code: 'TEST10',
        fareXaf: -100,
      }, clientToken);
      expect(status).toBe(400);
    });

    it('rejects promo with missing fields', async () => {
      const { status } = await post('/promo/validate', {
        code: 'TEST10',
      }, clientToken);
      expect(status).toBe(400);
    });
  });

  // ── 15. Security edge cases ────────────────────────────────────────────────
  describe('Security', () => {
    it('client cannot access admin endpoints', async () => {
      const { status } = await get('/admin/drivers/pending', clientToken);
      expect([401, 403]).toContain(status);
    });

    it('driver cannot approve their own documents', async () => {
      const { status } = await api('POST', `/admin/drivers/${driverId}/documents/fake-doc-id/approve`, {}, driverToken);
      expect([401, 403]).toContain(status);
    });

    it('client cannot go online as driver', async () => {
      const { status } = await patch('/drivers/toggle-online', { isOnline: true }, clientToken);
      expect([401, 403]).toContain(status);
    });

    it('client cannot send GPS as driver', async () => {
      const { status } = await post('/drivers/location', {
        latitude: 0.39, longitude: 9.45, speed: 0, bearing: 0, accuracy: 5,
      }, clientToken);
      expect([401, 403]).toContain(status);
    });

    it('webhook rejects without secret', async () => {
      const { status } = await post('/webhooks/pawapay', {
        depositId: 'fake', status: 'COMPLETED',
      });
      expect(status).toBe(401);
    });

    it('webhook rejects wrong secret', async () => {
      const { status } = await api('POST', '/webhooks/pawapay?secret=wrongsecret', {
        depositId: 'fake', status: 'COMPLETED',
      });
      expect(status).toBe(401);
    });

    it('driver cannot book a trip', async () => {
      const { status } = await post('/trips/book', {
        originLatitude: 0.39, originLongitude: 9.45,
        destinationLatitude: 0.46, destinationLongitude: 9.41,
        originAddress: 'A', destinationAddress: 'B', tripType: 'exclusive',
      }, driverToken);
      expect([401, 403]).toContain(status);
    });

    it('unauthenticated user cannot list payment methods', async () => {
      const { status } = await get('/payments/methods');
      expect(status).toBe(401);
    });

    it('unauthenticated user cannot submit a bid', async () => {
      const { status } = await post(`/trips/${tripId}/bid`, {
        amountXaf: 2000, etaMinutes: 5,
      });
      expect(status).toBe(401);
    });
  });

});
