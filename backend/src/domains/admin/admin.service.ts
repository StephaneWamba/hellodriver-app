import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { alias } from 'drizzle-orm/pg-core';
import { and, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import { getDatabase } from '../../db/index.js';
import { config } from '../../core/config.js';
import {
  users,
  wallets,
  driverProfiles,
  trips,
  tripBids,
  walletTransactions,
  payments,
  promoCodes,
  referrals,
} from '../../db/schema.js';
import { getRedis } from '../../plugins/redis.js';
import { postWalletTransaction, ensureWalletExists } from '../wallet/wallet.service.js';
import { errors } from '../../shared/errors/AppError.js';
import type {
  AdminAccount,
  AdminLiveDriver,
  AdminPayment,
  AdminPromoCode,
  AdminTripDetail,
  AdminTripListItem,
  AdminUserDetail,
  AdminUserListItem,
  AdminWalletTransaction,
  FinancesOverview,
  ReferralsOverview,
} from './admin.types.js';

const driverUsers = alias(users, 'driver_users');

export async function listUsers(params: {
  search?: string;
  role?: 'client' | 'driver' | 'admin';
  page: number;
  pageSize: number;
}): Promise<{ data: AdminUserListItem[]; total: number; page: number; pageSize: number }> {
  const db = getDatabase() as any;
  const { search, role, page, pageSize } = params;

  const filters = [
    role ? eq(users.role, role) : undefined,
    search
      ? or(
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`),
          ilike(users.phone, `%${search}%`),
          ilike(users.email, `%${search}%`)
        )
      : undefined,
  ].filter(Boolean);
  const where = filters.length ? and(...filters) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(where);

  const rows = await db
    .select({
      id: users.id,
      role: users.role,
      phone: users.phone,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      suspendedAt: users.suspendedAt,
      createdAt: users.createdAt,
      walletBalanceXaf: wallets.balanceXaf,
      driverVerificationStatus: driverProfiles.verificationStatus,
    })
    .from(users)
    .leftJoin(wallets, eq(wallets.userId, users.id))
    .leftJoin(driverProfiles, eq(driverProfiles.userId, users.id))
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    data: rows.map((r: any) => ({
      ...r,
      walletBalanceXaf: r.walletBalanceXaf ?? 0,
      suspendedAt: r.suspendedAt ? r.suspendedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  const db = getDatabase() as any;

  const [row] = await db
    .select({
      id: users.id,
      role: users.role,
      phone: users.phone,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      suspendedAt: users.suspendedAt,
      suspensionReason: users.suspensionReason,
      createdAt: users.createdAt,
      walletBalanceXaf: wallets.balanceXaf,
      driverVerificationStatus: driverProfiles.verificationStatus,
      vehicleBrand: driverProfiles.vehicleBrand,
      vehicleModel: driverProfiles.vehicleModel,
      vehicleRegistration: driverProfiles.vehicleRegistration,
      ratingAvg: driverProfiles.ratingAvg,
      ratingCount: driverProfiles.ratingCount,
    })
    .from(users)
    .leftJoin(wallets, eq(wallets.userId, users.id))
    .leftJoin(driverProfiles, eq(driverProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) throw errors.userNotFound();

  const [{ tripCount }] = await db
    .select({ tripCount: sql<number>`count(*)::int` })
    .from(trips)
    .where(or(eq(trips.clientId, userId), eq(trips.driverId, userId)));

  const recentTrips = await db
    .select({
      id: trips.id,
      status: trips.status,
      finalFareXaf: trips.finalFareXaf,
      fareEstimateXaf: trips.fareEstimateXaf,
      createdAt: trips.createdAt,
    })
    .from(trips)
    .where(or(eq(trips.clientId, userId), eq(trips.driverId, userId)))
    .orderBy(desc(trips.createdAt))
    .limit(5);

  const recentTransactions = await db
    .select({
      id: walletTransactions.id,
      type: walletTransactions.type,
      amountXaf: walletTransactions.amountXaf,
      reason: walletTransactions.reason,
      createdAt: walletTransactions.createdAt,
    })
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(5);

  return {
    id: row.id,
    role: row.role,
    phone: row.phone,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    avatarUrl: row.avatarUrl,
    suspendedAt: row.suspendedAt ? row.suspendedAt.toISOString() : null,
    suspensionReason: row.suspensionReason,
    createdAt: row.createdAt.toISOString(),
    walletBalanceXaf: row.walletBalanceXaf ?? 0,
    driverVerificationStatus: row.driverVerificationStatus,
    tripCount,
    driverProfile: row.driverVerificationStatus
      ? {
          vehicleBrand: row.vehicleBrand,
          vehicleModel: row.vehicleModel,
          vehicleRegistration: row.vehicleRegistration,
          ratingAvg: row.ratingAvg,
          ratingCount: row.ratingCount ?? 0,
        }
      : null,
    recentTrips: recentTrips.map((t: any) => ({ ...t, createdAt: t.createdAt.toISOString() })),
    recentTransactions: recentTransactions.map((t: any) => ({ ...t, createdAt: t.createdAt.toISOString() })),
  };
}

export async function setUserSuspension(
  userId: string,
  suspend: boolean,
  reason: string | undefined
): Promise<void> {
  const db = getDatabase() as any;

  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw errors.userNotFound();
  if (user.role === 'admin') {
    throw errors.validationFailed({ userId: 'Cannot suspend an admin account' });
  }

  await db
    .update(users)
    .set({
      suspendedAt: suspend ? new Date() : null,
      suspensionReason: suspend ? reason ?? null : null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

// Gabon (WAT) has no DST — a fixed UTC+1 offset, so "today" can be computed
// without a timezone library: shift the instant by +1h, read the UTC
// calendar fields as the WAT wall-clock date, then convert that date's
// midnight back to a UTC instant by subtracting the same 1h offset.
function startOfTodayWat(): Date {
  const watNow = new Date(Date.now() + 3600_000);
  const y = watNow.getUTCFullYear();
  const m = watNow.getUTCMonth();
  const d = watNow.getUTCDate();
  return new Date(Date.UTC(y, m, d) - 3600_000);
}

export async function getFinancesOverview(): Promise<FinancesOverview> {
  const db = getDatabase() as any;
  const todayStart = startOfTodayWat();
  const yesterday = new Date(Date.now() - 24 * 3600_000);

  const [[wallet], [commission], [deposits], [payouts], [todayCommission], [todayDeposits], [todayPayouts], [pending], [failed]] =
    await Promise.all([
      db.select({ v: sql<number>`coalesce(sum(${wallets.balanceXaf}), 0)::int` }).from(wallets),
      db
        .select({ v: sql<number>`coalesce(sum(${walletTransactions.amountXaf}), 0)::int` })
        .from(walletTransactions)
        .where(eq(walletTransactions.reason, 'commission')),
      db
        .select({ v: sql<number>`coalesce(sum(${payments.amountXaf}), 0)::int` })
        .from(payments)
        .where(and(eq(payments.type, 'deposit'), eq(payments.status, 'completed'))),
      db
        .select({ v: sql<number>`coalesce(sum(${payments.amountXaf}), 0)::int` })
        .from(payments)
        .where(and(eq(payments.type, 'payout'), eq(payments.status, 'completed'))),
      db
        .select({ v: sql<number>`coalesce(sum(${walletTransactions.amountXaf}), 0)::int` })
        .from(walletTransactions)
        .where(and(eq(walletTransactions.reason, 'commission'), gte(walletTransactions.createdAt, todayStart))),
      db
        .select({ v: sql<number>`coalesce(sum(${payments.amountXaf}), 0)::int` })
        .from(payments)
        .where(
          and(eq(payments.type, 'deposit'), eq(payments.status, 'completed'), gte(payments.createdAt, todayStart))
        ),
      db
        .select({ v: sql<number>`coalesce(sum(${payments.amountXaf}), 0)::int` })
        .from(payments)
        .where(
          and(eq(payments.type, 'payout'), eq(payments.status, 'completed'), gte(payments.createdAt, todayStart))
        ),
      db
        .select({ v: sql<number>`count(*)::int` })
        .from(payments)
        .where(and(eq(payments.type, 'payout'), eq(payments.status, 'pending'))),
      db
        .select({ v: sql<number>`count(*)::int` })
        .from(payments)
        .where(and(eq(payments.status, 'failed'), gte(payments.createdAt, yesterday))),
    ]);

  return {
    totalWalletBalanceXaf: wallet.v,
    totalCommissionXaf: commission.v,
    totalDepositsXaf: deposits.v,
    totalPayoutsXaf: payouts.v,
    todayDepositsXaf: todayDeposits.v,
    todayPayoutsXaf: todayPayouts.v,
    todayCommissionXaf: todayCommission.v,
    pendingPayoutsCount: pending.v,
    failedPayments24hCount: failed.v,
  };
}

export async function listWalletTransactions(params: {
  reason?: string;
  page: number;
  pageSize: number;
}): Promise<{ data: AdminWalletTransaction[]; total: number; page: number; pageSize: number }> {
  const db = getDatabase() as any;
  const { reason, page, pageSize } = params;
  const where = reason ? eq(walletTransactions.reason, reason) : undefined;

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(walletTransactions).where(where);

  const rows = await db
    .select({
      id: walletTransactions.id,
      type: walletTransactions.type,
      amountXaf: walletTransactions.amountXaf,
      reason: walletTransactions.reason,
      balanceAfterXaf: walletTransactions.balanceAfterXaf,
      createdAt: walletTransactions.createdAt,
      userId: users.id,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userPhone: users.phone,
    })
    .from(walletTransactions)
    .innerJoin(users, eq(users.id, walletTransactions.userId))
    .where(where)
    .orderBy(desc(walletTransactions.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    data: rows.map((r: any) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total,
    page,
    pageSize,
  };
}

export async function listPayments(params: {
  status?: 'pending' | 'completed' | 'failed';
  type?: 'deposit' | 'payout' | 'refund';
  page: number;
  pageSize: number;
}): Promise<{ data: AdminPayment[]; total: number; page: number; pageSize: number }> {
  const db = getDatabase() as any;
  const { status, type, page, pageSize } = params;

  const filters = [
    status ? eq(payments.status, status) : undefined,
    type ? eq(payments.type, type) : undefined,
  ].filter(Boolean);
  const where = filters.length ? and(...filters) : undefined;

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(payments).where(where);

  const rows = await db
    .select({
      id: payments.id,
      type: payments.type,
      operator: payments.operator,
      amountXaf: payments.amountXaf,
      status: payments.status,
      failureReason: payments.failureReason,
      createdAt: payments.createdAt,
      userId: users.id,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userPhone: users.phone,
    })
    .from(payments)
    .innerJoin(users, eq(users.id, payments.userId))
    .where(where)
    .orderBy(desc(payments.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    data: rows.map((r: any) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total,
    page,
    pageSize,
  };
}

export async function listTrips(params: {
  status?: string;
  page: number;
  pageSize: number;
}): Promise<{ data: AdminTripListItem[]; total: number; page: number; pageSize: number }> {
  const db = getDatabase() as any;
  const { status, page, pageSize } = params;
  const where = status ? eq(trips.status, status) : undefined;

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(trips).where(where);

  const rows = await db
    .select({
      id: trips.id,
      status: trips.status,
      originAddress: trips.originAddress,
      destinationAddress: trips.destinationAddress,
      fareEstimateXaf: trips.fareEstimateXaf,
      finalFareXaf: trips.finalFareXaf,
      paymentStatus: trips.paymentStatus,
      createdAt: trips.createdAt,
      clientId: users.id,
      clientFirstName: users.firstName,
      clientLastName: users.lastName,
      driverId: driverUsers.id,
      driverFirstName: driverUsers.firstName,
      driverLastName: driverUsers.lastName,
    })
    .from(trips)
    .innerJoin(users, eq(users.id, trips.clientId))
    .leftJoin(driverUsers, eq(driverUsers.id, trips.driverId))
    .where(where)
    .orderBy(desc(trips.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    data: rows.map((r: any) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total,
    page,
    pageSize,
  };
}

export async function getTripDetail(tripId: string): Promise<AdminTripDetail> {
  const db = getDatabase() as any;

  const [row] = await db
    .select({
      id: trips.id,
      status: trips.status,
      originAddress: trips.originAddress,
      originLatitude: trips.originLatitude,
      originLongitude: trips.originLongitude,
      destinationAddress: trips.destinationAddress,
      destinationLatitude: trips.destinationLatitude,
      destinationLongitude: trips.destinationLongitude,
      fareEstimateXaf: trips.fareEstimateXaf,
      finalFareXaf: trips.finalFareXaf,
      paymentStatus: trips.paymentStatus,
      clientRating: trips.clientRating,
      clientComment: trips.clientComment,
      createdAt: trips.createdAt,
      updatedAt: trips.updatedAt,
      expiresAt: trips.expiresAt,
      completedAt: trips.completedAt,
      adminCancellationReason: trips.adminCancellationReason,
      clientId: users.id,
      clientFirstName: users.firstName,
      clientLastName: users.lastName,
      clientPhone: users.phone,
      driverId: driverUsers.id,
      driverFirstName: driverUsers.firstName,
      driverLastName: driverUsers.lastName,
      driverPhone: driverUsers.phone,
    })
    .from(trips)
    .innerJoin(users, eq(users.id, trips.clientId))
    .leftJoin(driverUsers, eq(driverUsers.id, trips.driverId))
    .where(eq(trips.id, tripId))
    .limit(1);

  if (!row) throw errors.tripNotFound();

  const bids = await db
    .select({
      id: tripBids.id,
      driverId: tripBids.driverId,
      driverFirstName: users.firstName,
      driverLastName: users.lastName,
      amountXaf: tripBids.amountXaf,
      etaMinutes: tripBids.etaMinutes,
      status: tripBids.status,
      createdAt: tripBids.createdAt,
    })
    .from(tripBids)
    .innerJoin(users, eq(users.id, tripBids.driverId))
    .where(eq(tripBids.tripId, tripId))
    .orderBy(desc(tripBids.createdAt));

  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    bids: bids.map((b: any) => ({ ...b, createdAt: b.createdAt.toISOString() })),
  };
}

// Redis is the source of truth for where drivers are right now — see
// location.service.ts. 'drivers:locations' is a GEO set touched on every
// 3s ping; driver:{id}:heartbeat/online are TTL'd so a driver who dropped
// off the network (killed app, dead connection) silently ages out within
// 25s without needing an explicit offline event.
export async function getLiveDrivers(): Promise<AdminLiveDriver[]> {
  const redis = getRedis();

  const driverIds = await redis.zrange('drivers:locations', 0, -1);
  if (driverIds.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const id of driverIds) {
    pipeline.exists(`driver:${id}:heartbeat`);
    pipeline.exists(`driver:${id}:online`);
    pipeline.exists(`driver:${id}:active_trip`);
  }
  const flags = await pipeline.exec();

  const activeIds: string[] = [];
  const activeTripById = new Map<string, boolean>();
  driverIds.forEach((id, i) => {
    const hasHeartbeat = flags?.[i * 3]?.[1] === 1;
    const isOnline = flags?.[i * 3 + 1]?.[1] === 1;
    const hasActiveTrip = flags?.[i * 3 + 2]?.[1] === 1;
    if (hasHeartbeat && isOnline) {
      activeIds.push(id);
      activeTripById.set(id, hasActiveTrip);
    }
  });

  if (activeIds.length === 0) return [];

  const positions = await redis.geopos('drivers:locations', ...activeIds);

  const db = getDatabase() as any;
  const rows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(inArray(users.id, activeIds));
  const userById = new Map(rows.map((r: any) => [r.id, r]));

  const result: AdminLiveDriver[] = [];
  activeIds.forEach((id, i) => {
    const pos = positions[i];
    const user = userById.get(id);
    if (!pos || !user) return;
    result.push({
      ...(user as any),
      longitude: parseFloat(pos[0]),
      latitude: parseFloat(pos[1]),
      hasActiveTrip: activeTripById.get(id) ?? false,
    });
  });

  return result;
}

export async function listPromoCodes(): Promise<AdminPromoCode[]> {
  const db = getDatabase() as any;

  const rows = await db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));

  return rows.map((r: any) => ({
    id: r.id,
    code: r.code,
    type: r.type,
    value: r.value,
    maxUses: r.maxUses,
    usesCount: r.usesCount,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createPromoCode(
  adminId: string,
  data: { code: string; type: 'fixed_xaf' | 'percentage'; value: number; maxUses?: number; expiresAt?: string }
): Promise<AdminPromoCode> {
  const db = getDatabase() as any;

  const existing = await db.query.promoCodes.findFirst({ where: eq(promoCodes.code, data.code) });
  if (existing) throw errors.conflict('Ce code promo existe déjà');

  const [row] = await db
    .insert(promoCodes)
    .values({
      code: data.code,
      type: data.type,
      value: data.value,
      maxUses: data.maxUses ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      createdByAdminId: adminId,
    })
    .returning();

  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: row.value,
    maxUses: row.maxUses,
    usesCount: row.usesCount,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function deactivatePromoCode(promoId: string): Promise<void> {
  const db = getDatabase() as any;

  const [existing] = await db.select({ id: promoCodes.id }).from(promoCodes).where(eq(promoCodes.id, promoId)).limit(1);
  if (!existing) throw errors.notFound('Code promo');

  await db.update(promoCodes).set({ expiresAt: new Date() }).where(eq(promoCodes.id, promoId));
}

export async function updatePromoCode(
  promoId: string,
  updates: { value?: number; maxUses?: number | null; expiresAt?: string | null }
): Promise<AdminPromoCode> {
  const db = getDatabase() as any;

  const [existing] = await db.select().from(promoCodes).where(eq(promoCodes.id, promoId)).limit(1);
  if (!existing) throw errors.notFound('Code promo');

  const fields: Record<string, unknown> = {};
  if (updates.value !== undefined) fields.value = updates.value;
  if (updates.maxUses !== undefined) fields.maxUses = updates.maxUses;
  if (updates.expiresAt !== undefined) fields.expiresAt = updates.expiresAt ? new Date(updates.expiresAt) : null;

  const [row] = await db.update(promoCodes).set(fields).where(eq(promoCodes.id, promoId)).returning();

  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: row.value,
    maxUses: row.maxUses,
    usesCount: row.usesCount,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function deletePromoCode(promoId: string): Promise<void> {
  const db = getDatabase() as any;

  const [existing] = await db
    .select({ id: promoCodes.id, usesCount: promoCodes.usesCount })
    .from(promoCodes)
    .where(eq(promoCodes.id, promoId))
    .limit(1);
  if (!existing) throw errors.notFound('Code promo');
  if (existing.usesCount > 0) {
    throw errors.conflict('Ce code a déjà été utilisé — désactive-le plutôt que de le supprimer');
  }

  await db.delete(promoCodes).where(eq(promoCodes.id, promoId));
}

export async function getReferralsOverview(): Promise<ReferralsOverview> {
  const db = getDatabase() as any;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000);

  const [[{ total }], [{ recent }], topRows] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(referrals),
    db
      .select({ recent: sql<number>`count(*)::int` })
      .from(referrals)
      .where(gte(referrals.createdAt, thirtyDaysAgo)),
    db
      .select({
        userId: referrals.referrerId,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        referralCount: sql<number>`count(*)::int`,
      })
      .from(referrals)
      .innerJoin(users, eq(users.id, referrals.referrerId))
      .groupBy(referrals.referrerId, users.firstName, users.lastName, users.phone)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
  ]);

  return {
    totalReferrals: total,
    totalRewardsXaf: total * 2 * config.REFERRAL_REWARD_XAF, // both referrer and referee are rewarded
    referralsLast30Days: recent,
    topReferrers: topRows,
  };
}

export async function updateUserProfile(
  userId: string,
  updates: { firstName?: string; lastName?: string; email?: string }
): Promise<void> {
  const db = getDatabase() as any;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!existing) throw errors.userNotFound();

  const fields: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.firstName !== undefined) fields.firstName = updates.firstName;
  if (updates.lastName !== undefined) fields.lastName = updates.lastName;
  if (updates.email !== undefined) fields.email = updates.email || null;

  await db.update(users).set(fields).where(eq(users.id, userId));
}

export async function adjustUserWallet(
  userId: string,
  adminId: string,
  data: { type: 'credit' | 'debit'; amountXaf: number; reason: string }
): Promise<{ balanceXaf: number }> {
  const [user] = await (getDatabase() as any)
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw errors.userNotFound();

  await ensureWalletExists(userId);
  const balanceXaf = await postWalletTransaction(userId, data.type, data.amountXaf, 'admin_adjustment', undefined, {
    adminNote: data.reason,
    createdByAdminId: adminId,
  });

  return { balanceXaf };
}

const BCRYPT_ROUNDS = 12;

export async function listAdmins(): Promise<AdminAccount[]> {
  const db = getDatabase() as any;

  const rows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.role, 'admin'))
    .orderBy(desc(users.createdAt));

  return rows.map((r: any) => ({ ...r, email: r.email ?? '', createdAt: r.createdAt.toISOString() }));
}

export async function createAdmin(data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<AdminAccount> {
  const db = getDatabase() as any;

  const existing = await db.query.users.findFirst({ where: eq(users.email, data.email) });
  if (existing) throw errors.conflict('Un compte existe déjà avec cet email');

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  // Admin accounts authenticate by email+password, not phone+OTP, but the
  // schema still requires a unique phone — a synthetic placeholder that can
  // never collide with a real Gabonese number (always starts with +241).
  const placeholderPhone = `+000${Date.now()}`;

  const [row] = await db
    .insert(users)
    .values({
      authId: uuidv4(),
      role: 'admin',
      phone: placeholderPhone,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      passwordHash,
    })
    .returning();

  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function revokeAdmin(adminId: string, actingAdminId: string): Promise<void> {
  if (adminId === actingAdminId) {
    throw errors.validationFailed({ adminId: 'Impossible de révoquer son propre accès' });
  }

  const db = getDatabase() as any;

  const [{ count: adminCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, 'admin'));
  if (adminCount <= 1) {
    throw errors.conflict('Impossible de supprimer le dernier compte admin');
  }

  const [existing] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, adminId))
    .limit(1);
  if (!existing || existing.role !== 'admin') throw errors.notFound('Compte admin');

  await db.delete(users).where(eq(users.id, adminId));
}
