import { getDatabase } from '../../db/index.js';
import { wallets, walletTransactions } from '../../db/schema.js';
import { eq, lt, desc, and } from 'drizzle-orm';
import { errors } from '../../shared/errors/AppError.js';
import type { Wallet, WalletTransaction, WalletTransactionReason } from './wallet.types.js';

/**
 * Ensure a wallet exists for the user; create one if not.
 * Safe to call multiple times — idempotent.
 */
export async function ensureWalletExists(userId: string): Promise<Wallet> {
  const db = getDatabase() as any;

  const existing = await db.query.wallets.findFirst({
    where: eq(wallets.userId, userId),
  });

  if (existing) return existing as Wallet;

  const [created] = await db
    .insert(wallets)
    .values({ userId, balanceXaf: 0 })
    .returning();

  return created as Wallet;
}

/**
 * Post a wallet transaction inside a serializable DB transaction.
 * NEVER call wallets.balance_xaf directly — always use this function.
 *
 * Returns the new balance after the operation.
 */
export async function postWalletTransaction(
  userId: string,
  type: 'credit' | 'debit',
  amountXaf: number,
  reason: WalletTransactionReason,
  referenceId?: string,
  admin?: { adminNote: string; createdByAdminId: string }
): Promise<number> {
  const db = getDatabase() as any;

  return await db.transaction(async (tx: any) => {
    // Lock the row for update to prevent concurrent balance corruption
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .for('update');

    if (!wallet) throw errors.notFound('Wallet');

    const newBalance =
      type === 'credit'
        ? wallet.balanceXaf + amountXaf
        : wallet.balanceXaf - amountXaf;

    if (newBalance < 0) throw errors.insufficientBalance();

    await tx
      .update(wallets)
      .set({ balanceXaf: newBalance, updatedAt: new Date() })
      .where(eq(wallets.userId, userId));

    await tx.insert(walletTransactions).values({
      walletId: wallet.id,
      userId,
      type,
      amountXaf,
      reason,
      referenceId: referenceId ?? null,
      balanceAfterXaf: newBalance,
      adminNote: admin?.adminNote ?? null,
      createdByAdminId: admin?.createdByAdminId ?? null,
    });

    return newBalance;
  });
}

/**
 * Get current wallet balance. Creates wallet if it doesn't exist.
 */
export async function getWalletBalance(userId: string): Promise<number> {
  await ensureWalletExists(userId);
  const db = getDatabase() as any;
  const wallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, userId),
  });
  return wallet!.balanceXaf;
}

/**
 * Initiate a mobile money deposit to top up the wallet.
 * Delegates to payment.service to keep the payment domain authoritative.
 * wallet.routes must call this — never import payment.service directly.
 */
export async function depositToWallet(
  userId: string,
  amountXaf: number,
  paymentMethodId: string
): Promise<{ message: string; pawapayId: string }> {
  const { initiateDeposit } = await import('../payment/payment.service.js');
  return initiateDeposit(userId, amountXaf, paymentMethodId, null);
}

/**
 * Paginated wallet transaction history (cursor-based, newest first).
 * Cursor is the createdAt ISO string of the last item seen.
 */
export async function getWalletTransactions(
  userId: string,
  limit: number,
  cursor?: string
): Promise<{ transactions: WalletTransaction[]; nextCursor: string | null }> {
  const db = getDatabase() as any;

  const conditions = [eq(walletTransactions.userId, userId)];
  if (cursor) {
    conditions.push(lt(walletTransactions.createdAt, new Date(cursor)));
  }

  const rows = await db
    .select()
    .from(walletTransactions)
    .where(and(...conditions))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit + 1); // fetch one extra to detect if there's a next page

  const hasMore = rows.length > limit;
  const transactions = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? transactions[transactions.length - 1].createdAt.toISOString()
    : null;

  return { transactions: transactions as WalletTransaction[], nextCursor };
}
