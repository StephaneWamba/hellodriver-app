import { config } from '../../core/config.js';
import { errors } from '../../shared/errors/AppError.js';
import type { PawapayOperator, PawapayDepositRequest, PawapayPayoutRequest } from './payment.types.js';

// ─── Phone utilities ──────────────────────────────────────────────────────────

/** Strip + prefix: '+241077123456' → '241077123456' */
export function toMsisdn(e164: string): string {
  return e164.replace(/^\+/, '');
}

/** Detect Gabon operator from E.164 phone number (international format, no trunk 0) */
export function detectGabonOperator(e164: string): PawapayOperator {
  if (/^\+2417/.test(e164)) return 'AIRTEL_GAB'; // +2417XXXXXXX (Airtel)
  if (/^\+2416/.test(e164)) return 'MOOV_GAB';   // +2416XXXXXXX (Moov)
  throw errors.validationFailed({
    phoneNumber: 'Seuls Airtel Money (+2417X) et Moov Money (+2416X) sont supportes au Gabon',
  });
}

/** Map pawaPay operator code to internal operator key */
export function pawapayOperatorToInternal(operator: PawapayOperator): 'airtel_money' | 'moov_money' {
  return operator === 'AIRTEL_GAB' ? 'airtel_money' : 'moov_money';
}

// ─── HTTP client ──────────────────────────────────────────────────────────────

// pawaPay calls happen inline in the accept-bid/payout request cycle — an
// unbounded hang here would hold the HTTP request (and the wallet debit
// that already happened before it, for payouts) open indefinitely. 15s is
// generous enough for a real API round-trip while still failing fast.
const REQUEST_TIMEOUT_MS = 15000;

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function post(path: string, body: object): Promise<any> {
  const url = `${config.PAWAPAY_BASE_URL}${path}`;
  const res = await withTimeout((signal) =>
    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.PAWAPAY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    })
  );

  const data = await res.json() as any;
  if (!res.ok) {
    throw errors.paymentFailed(`pawaPay error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function get(path: string): Promise<any> {
  const url = `${config.PAWAPAY_BASE_URL}${path}`;
  const res = await withTimeout((signal) =>
    fetch(url, {
      headers: { Authorization: `Bearer ${config.PAWAPAY_API_TOKEN}` },
      signal,
    })
  );
  return res.json();
}

// ─── pawaPay API calls ────────────────────────────────────────────────────────

export async function pawapayDeposit(req: PawapayDepositRequest): Promise<any> {
  return post('/v2/deposits', req);
}

export async function pawapayPayout(req: PawapayPayoutRequest): Promise<any> {
  return post('/v2/payouts', req);
}

export async function pawapayGetDeposit(depositId: string): Promise<any> {
  return get(`/v2/deposits/${depositId}`);
}

export async function pawapayGetPayout(payoutId: string): Promise<any> {
  return get(`/v2/payouts/${payoutId}`);
}
