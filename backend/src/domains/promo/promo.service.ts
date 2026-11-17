import { getDatabase } from '../../db/index.js';
import { promoCodes, referrals, users, walletTransactions } from '../../db/schema.js';
import { eq, and, count, sql, like } from 'drizzle-orm';
import { config } from '../../core/config.js';
import { errors } from '../../shared/errors/AppError.js';
import { postWalletTransaction, ensureWalletExists } from '../wallet/wallet.service.js';
import type { PromoValidationResult, Referral } from './promo.types.js';
import type { ValidatePromoInput, RedeemReferralInput } from './promo.validators.js';

/**
 * Validate a promo code and calculate discount.
 * Does NOT redeem — use applyPromoCode at booking time.
 */
export async function validatePromoCode(
  data: ValidatePromoInput
): Promise<PromoValidationResult> {
  const db = getDatabase() as any;

  const promo = await db.query.promoCodes.findFirst({
    where: eq(promoCodes.code, data.code),
  });

  if (!promo) throw errors.invalidPromoCode();

  if (promo.expiresAt && new Date() > new Date(promo.expiresAt)) {
    throw errors.promoCodeExpired();
  }

  if (promo.maxUses !== null && promo.usesCount >= promo.maxUses) {
    throw errors.invalidPromoCode(); // Code exhausted
  }

  let discountXaf: number;
  if (promo.type === 'fixed_xaf') {
    discountXaf = Math.min(promo.value, data.fareXaf);
  } else {
    // percentage: 0–100 integer
    discountXaf = Math.floor((data.fareXaf * promo.value) / 100);
  }

  return { valid: true, discountXaf, code: data.code };
}

/**
 * Get a user's referral code (their phone-derived code).
 * Returns stats about past referrals.
 */
export async function getMyReferralInfo(userId: string): Promise<{
  code: string;
  rewardXaf: number;
  totalReferrals: number;
  totalEarnedXaf: number;
}> {
  const db = getDatabase() as any;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) throw errors.userNotFound();

  // Referral code = "HELLO" + last 8 digits of E.164 phone (without country code)
  // Using 8 digits (full local number for Gabon) avoids collisions between
  // Airtel (+2417XXXXXXX) and Moov (+2416XXXXXXX) users who share the same last 6 digits.
  const phone = user.phone.replace(/\D/g, '');
  const code = `HELLO${phone.slice(-8)}`;

  const myReferrals = await db
    .select()
    .from(referrals)
    .where(eq(referrals.referrerId, userId));

  const totalEarnedXaf = myReferrals
    .filter((r: any) => r.referrerRewardedAt !== null)
    .length * config.REFERRAL_REWARD_XAF;

  return {
    code,
    rewardXaf: config.REFERRAL_REWARD_XAF,
    totalReferrals: myReferrals.length,
    totalEarnedXaf,
  };
}

/**
 * Redeem a referral code at signup.
 * Credits both referrer (4,000 XAF) and referee (4,000 XAF).
 * Idempotent: a user can only be referred once (unique constraint on refereeId).
 */
export async function redeemReferral(
  refereeId: string,
  data: RedeemReferralInput
): Promise<{ message: string; rewardXaf: number }> {
  const db = getDatabase() as any;

  // Check user hasn't already been referred
  const existingReferral = await db.query.referrals.findFirst({
    where: eq(referrals.refereeId, refereeId),
  });
  if (existingReferral) {
    throw errors.conflict('Vous avez déjà utilisé un code de parrainage');
  }

  // Code format: "HELLO" + the referrer's last 8 phone digits — issued to
  // clients and drivers alike (see getMyReferralInfo, which doesn't filter
  // by role either), so the lookup must not restrict to role='client' —
  // doing so silently made every driver's referral code unredeemable by
  // anyone, since drivers were never in the candidate pool.
  const codeMatch = /^HELLO(\d{8})$/.exec(data.code);
  if (!codeMatch) throw errors.invalidPromoCode();

  const referrer = await db.query.users.findFirst({
    where: like(users.phone, `%${codeMatch[1]}`),
  });

  if (!referrer) throw errors.invalidPromoCode();
  if (referrer.id === refereeId) throw errors.conflict('Vous ne pouvez pas vous parrainer vous-même');

  const rewardXaf = config.REFERRAL_REWARD_XAF;
  const now = new Date();

  // Ensure wallets exist before the transaction so the INSERT doesn't fail
  await ensureWalletExists(referrer.id);
  await ensureWalletExists(refereeId);

  // Record referral + credit both wallets atomically
  await db.transaction(async (tx: any) => {
    await tx.insert(referrals).values({
      referrerId: referrer.id,
      refereeId,
      promoCode: data.code,
      rewardXaf,
      referrerRewardedAt: now,
      refereeRewardedAt: now,
    });

    await postWalletTransaction(referrer.id, 'credit', rewardXaf, 'referral_reward');
    await postWalletTransaction(refereeId, 'credit', rewardXaf, 'referral_reward');
  });

  return {
    message: `Code de parrainage accepté — ${rewardXaf.toLocaleString()} XAF crédités sur votre Hello Money`,
    rewardXaf,
  };
}
