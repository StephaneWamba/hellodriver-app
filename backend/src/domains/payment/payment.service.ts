import { getDatabase } from '../../db/index.js';
import { paymentMethods, payments } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { errors } from '../../shared/errors/AppError.js';
import { postWalletTransaction, ensureWalletExists } from '../wallet/wallet.service.js';
import {
  detectGabonOperator,
  toMsisdn,
  pawapayOperatorToInternal,
  pawapayDeposit,
  pawapayPayout,
  pawapayGetDeposit,
  pawapayGetPayout,
} from './pawapay.client.js';
import {
  emitPaymentConfirmed,
  emitPaymentFailed,
} from '../../shared/events/realtime.events.js';
import type { PaymentMethod, Payment } from './payment.types.js';
import type { AddPaymentMethodInput } from './payment.validators.js';

// ─── Payment Method CRUD ──────────────────────────────────────────────────────

export async function addPaymentMethod(
  userId: string,
  data: AddPaymentMethodInput
): Promise<PaymentMethod> {
  const db = getDatabase() as any;
  const operator = detectGabonOperator(data.phoneNumber);
  const internalOperator = pawapayOperatorToInternal(operator);

  const existing = await db.query.paymentMethods.findFirst({
    where: and(
      eq(paymentMethods.userId, userId),
      eq(paymentMethods.phoneNumber, data.phoneNumber)
    ),
  });
  if (existing) throw errors.conflict('Ce numéro est déjà enregistré');

  const allMethods = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.userId, userId));
  const isDefault = allMethods.length === 0;

  try {
    const [method] = await db
      .insert(paymentMethods)
      .values({
        userId,
        type: 'mobile_money',
        operator: internalOperator,
        phoneNumber: data.phoneNumber,
        isDefault,
      })
      .returning();

    return method as PaymentMethod;
  } catch (err: any) {
    // Unique violation — a concurrent request for the same number won the
    // race between our "existing" check above and this insert.
    if (err?.code === '23505') throw errors.conflict('Ce numéro est déjà enregistré');
    throw err;
  }
}

export async function listPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  const db = getDatabase() as any;
  const rows = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.userId, userId));
  return rows as PaymentMethod[];
}

export async function deletePaymentMethod(userId: string, methodId: string): Promise<void> {
  const db = getDatabase() as any;
  const method = await db.query.paymentMethods.findFirst({
    where: and(eq(paymentMethods.id, methodId), eq(paymentMethods.userId, userId)),
  });
  if (!method) throw errors.paymentMethodNotFound();
  await db.delete(paymentMethods).where(eq(paymentMethods.id, methodId));
}

export async function setDefaultPaymentMethod(userId: string, methodId: string): Promise<void> {
  const db = getDatabase() as any;
  const method = await db.query.paymentMethods.findFirst({
    where: and(eq(paymentMethods.id, methodId), eq(paymentMethods.userId, userId)),
  });
  if (!method) throw errors.paymentMethodNotFound();

  await db.transaction(async (tx: any) => {
    await tx
      .update(paymentMethods)
      .set({ isDefault: false })
      .where(eq(paymentMethods.userId, userId));
    await tx
      .update(paymentMethods)
      .set({ isDefault: true })
      .where(eq(paymentMethods.id, methodId));
  });
}

// ─── Payment Initiation ───────────────────────────────────────────────────────

/**
 * Initiate a pawaPay deposit (mobile money collection).
 * tripId = null means wallet top-up (no trip context).
 * Returns immediately after pawaPay ACCEPTED — callback updates DB async.
 */
export async function initiateDeposit(
  userId: string,
  amountXaf: number,
  paymentMethodId: string,
  tripId: string | null
): Promise<{ message: string; pawapayId: string }> {
  const db = getDatabase() as any;

  const method = await db.query.paymentMethods.findFirst({
    where: and(
      eq(paymentMethods.id, paymentMethodId),
      eq(paymentMethods.userId, userId)
    ),
  });
  if (!method) throw errors.paymentMethodNotFound();

  const pawapayOperator = detectGabonOperator(method.phoneNumber!);
  const msisdn = toMsisdn(method.phoneNumber!);
  const pawapayId = uuidv4();

  // Store BEFORE calling API — idempotency guarantee
  await db.insert(payments).values({
    id: uuidv4(),
    tripId,
    userId,
    type: 'deposit',
    pawapayId,
    operator: method.operator!,
    amountXaf,
    status: 'pending',
  });

  const response = await pawapayDeposit({
    depositId: pawapayId,
    payer: {
      type: 'MMO',
      accountDetails: { phoneNumber: msisdn, provider: pawapayOperator },
    },
    amount: String(amountXaf),
    currency: 'XAF',
    customerMessage: tripId ? 'Course HelloDriver' : 'Recharge Hello Money',
  });

  if (response.status === 'REJECTED') {
    await db
      .update(payments)
      .set({ status: 'failed', failureReason: JSON.stringify(response), updatedAt: new Date() })
      .where(eq(payments.pawapayId, pawapayId));
    throw errors.paymentFailed('Paiement refusé par l\'opérateur mobile');
  }

  return {
    message: 'Paiement en attente de confirmation mobile',
    pawapayId,
  };
}

/**
 * Initiate a pawaPay payout (mobile money disbursement) to driver.
 * Idempotency: if a payment row already exists for this pawapayId, return it.
 * Wallet is debited FIRST; if pawaPay rejects we credit back.
 */
export async function initiatePayout(
  driverId: string,
  amountXaf: number,
  paymentMethodId: string,
  idempotencyKey?: string
): Promise<{ message: string; pawapayId: string }> {
  const db = getDatabase() as any;

  const method = await db.query.paymentMethods.findFirst({
    where: and(
      eq(paymentMethods.id, paymentMethodId),
      eq(paymentMethods.userId, driverId)
    ),
  });
  if (!method) throw errors.paymentMethodNotFound();

  const pawapayId = idempotencyKey ?? uuidv4();

  // Idempotency check — return early if already initiated
  const existingPayment = await db.query.payments.findFirst({
    where: and(eq(payments.pawapayId, pawapayId), eq(payments.type, 'payout')),
  });
  if (existingPayment) {
    return { message: 'Virement en cours de traitement', pawapayId };
  }

  await ensureWalletExists(driverId);

  // Debit wallet first — will throw insufficientBalance if balance too low
  await postWalletTransaction(driverId, 'debit', amountXaf, 'payout');

  const pawapayOperator = detectGabonOperator(method.phoneNumber!);
  const msisdn = toMsisdn(method.phoneNumber!);
  const paymentId = uuidv4();

  await db.insert(payments).values({
    id: paymentId,
    tripId: null,
    userId: driverId,
    type: 'payout',
    pawapayId,
    operator: method.operator!,
    amountXaf,
    status: 'pending',
  });

  try {
    const response = await pawapayPayout({
      payoutId: pawapayId,
      recipient: {
        type: 'MMO',
        accountDetails: { phoneNumber: msisdn, provider: pawapayOperator },
      },
      amount: String(amountXaf),
      currency: 'XAF',
      customerMessage: 'Gains HelloDriver',
    });

    if (response.status === 'REJECTED') {
      await postWalletTransaction(driverId, 'credit', amountXaf, 'refund');
      await db
        .update(payments)
        .set({ status: 'failed', failureReason: JSON.stringify(response), updatedAt: new Date() })
        .where(eq(payments.pawapayId, pawapayId));
      throw errors.paymentFailed('Virement refusé par l\'opérateur mobile');
    }

    return { message: 'Virement en cours de traitement', pawapayId };
  } catch (err: any) {
    // If network error (not a known rejection), roll back
    if (err.code !== 'PAYMENT_FAILED') {
      await postWalletTransaction(driverId, 'credit', amountXaf, 'refund');
    }
    throw err;
  }
}

// ─── Webhook Handler ──────────────────────────────────────────────────────────

/**
 * Process a pawaPay callback (deposit or payout).
 * Updates payment + trip + wallet atomically where needed.
 */
export async function handlePawapayCallback(payload: any): Promise<void> {
  const db = getDatabase() as any;

  const pawapayId = payload.depositId ?? payload.payoutId;
  if (!pawapayId) return;

  const payment = await db.query.payments.findFirst({
    where: eq(payments.pawapayId, pawapayId),
  });
  if (!payment) return;

  // Idempotency: skip if already processed to prevent double-credits on webhook retries
  if (payment.status === 'completed' || payment.status === 'failed') return;

  const isCompleted = payload.status === 'COMPLETED';
  const isFailed = payload.status === 'FAILED';

  if (!isCompleted && !isFailed) return;

  if (isCompleted) {
    await db
      .update(payments)
      .set({
        status: 'completed',
        providerTransactionId: payload.providerTransactionId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(payments.pawapayId, pawapayId));

    if (payment.type === 'deposit') {
      if (payment.tripId) {
        const { trips } = await import('../../db/schema.js');
        await db
          .update(trips)
          .set({ paymentStatus: 'paid', updatedAt: new Date() })
          .where(eq(trips.id, payment.tripId));

        emitPaymentConfirmed(payment.tripId, payment.userId, {
          tripId: payment.tripId,
          amountXaf: payment.amountXaf,
        });
      } else {
        await ensureWalletExists(payment.userId);
        await postWalletTransaction(
          payment.userId,
          'credit',
          payment.amountXaf,
          'deposit',
          payment.id
        );
      }
    }
    // Payout COMPLETED — wallet already debited at initiation, nothing more to do
  }

  if (isFailed) {
    const failureReason =
      payload.failureReason?.failureMessage ?? 'Échec du paiement';

    await db
      .update(payments)
      .set({ status: 'failed', failureReason, updatedAt: new Date() })
      .where(eq(payments.pawapayId, pawapayId));

    if (payment.type === 'deposit' && payment.tripId) {
      const { trips } = await import('../../db/schema.js');
      await db
        .update(trips)
        .set({ paymentStatus: 'failed', updatedAt: new Date() })
        .where(eq(trips.id, payment.tripId));

      emitPaymentFailed(payment.tripId, payment.userId, {
        tripId: payment.tripId,
        reason: failureReason,
      });
    }

    if (payment.type === 'payout') {
      await postWalletTransaction(
        payment.userId,
        'credit',
        payment.amountXaf,
        'refund',
        payment.id
      );
    }
  }
}

// ─── Payment polling (used by BullMQ worker) ─────────────────────────────────

export async function pollPaymentStatus(pawapayId: string, type: 'deposit' | 'payout'): Promise<void> {
  const data = type === 'deposit'
    ? await pawapayGetDeposit(pawapayId)
    : await pawapayGetPayout(pawapayId);

  const normalized = {
    depositId: type === 'deposit' ? pawapayId : undefined,
    payoutId: type === 'payout' ? pawapayId : undefined,
    status: data.status,
    amount: data.amount,
    currency: data.currency,
    providerTransactionId: data.providerTransactionId,
    failureReason: data.failureReason,
  };
  await handlePawapayCallback(normalized);
}
