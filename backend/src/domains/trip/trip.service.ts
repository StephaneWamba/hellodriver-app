import { getDatabase } from '../../db/index.js';
import { getRedis } from '../../plugins/redis.js';
import { trips, tripBids, driverProfiles, users } from '../../db/schema.js';
import { eq, and, gte, ne, isNotNull, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getOnlineDriversInRadius } from '../driver/location.service.js';
import { VALID_TRANSITIONS } from './trip.types.js';
import type { Trip, TripBid, TripStatus } from './trip.types.js';
import type {
  BookTripInput,
  RateTripInput,
  SubmitBidInput,
  UpdateTripStatusInput,
} from './trip.validators.js';
import {
  postWalletTransaction,
  ensureWalletExists,
  getWalletBalance,
} from '../wallet/wallet.service.js';
import { initiateDeposit } from '../payment/payment.service.js';
import { config } from '../../core/config.js';
import { AppError, errors } from '../../shared/errors/AppError.js';
import { haversineKm, estimateFareXaf } from './trip.pricing.js';
import {
  emitBidReceived,
  emitBidAccepted,
  emitPaymentConfirmed,
  emitTripStatusChanged,
  emitNewTripRequest,
} from '../../shared/events/realtime.events.js';

// Delete Redis keys matching a pattern safely (SCAN-based — DEL does not support wildcards)
async function deleteKeysByPattern(pattern: string): Promise<void> {
  const redis = getRedis();
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}

/**
 * Book a trip: create trip, find nearby drivers, return fare estimate
 */
export async function bookTrip(
  clientId: string,
  data: BookTripInput
): Promise<{
  trip: Trip;
  availableDriverCount: number;
  fareEstimateXaf: number;
}> {
  const db = getDatabase() as any;
  const redis = getRedis();

  // Prevent a client from opening multiple simultaneous trips.
  const activeTrip = await redis.get(`client:${clientId}:active_trip`);
  if (activeTrip) throw errors.clientHasActiveTrip();

  const availableDriverIds = await getOnlineDriversInRadius(
    Number(data.originLatitude),
    Number(data.originLongitude),
    config.DRIVER_MATCHING_RADIUS_KM
  );

  const fareEstimate = estimateFareXaf(
    Number(data.originLatitude),
    Number(data.originLongitude),
    Number(data.destinationLatitude),
    Number(data.destinationLongitude)
  );

  const tripId = uuidv4();
  const expiresAt = new Date(Date.now() + config.TRIP_BID_EXPIRY_MS);

  const [trip] = await db
    .insert(trips)
    .values({
      id: tripId,
      clientId,
      status: 'pending_bids' as TripStatus,
      originAddress: data.originAddress || null,
      originLatitude: String(data.originLatitude),
      originLongitude: String(data.originLongitude),
      originGeom: { x: data.originLongitude, y: data.originLatitude },
      destinationAddress: data.destinationAddress || null,
      destinationLatitude: String(data.destinationLatitude),
      destinationLongitude: String(data.destinationLongitude),
      destinationGeom: { x: data.destinationLongitude, y: data.destinationLatitude },
      fareEstimateXaf: fareEstimate,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt,
    })
    .returning();

  await redis.setex(
    `trip:${tripId}:state`,
    Math.floor(config.TRIP_BID_EXPIRY_MS / 1000),
    'pending_bids'
  );

  // Guard against simultaneous bookings — cleared on any terminal status.
  await redis.setex(`client:${clientId}:active_trip`, config.TRIP_ACTIVE_REDIS_TTL_SECONDS, tripId);

  // Push the new trip to every matched driver so it surfaces live in their
  // app (NewTripSheet) — without this, drivers have no way to see it at all.
  const distanceKm = haversineKm(
    Number(data.originLatitude),
    Number(data.originLongitude),
    Number(data.destinationLatitude),
    Number(data.destinationLongitude)
  );
  for (const driverId of availableDriverIds) {
    emitNewTripRequest(driverId, {
      trip_id: tripId,
      pickup_address: data.originAddress || 'Position actuelle',
      dropoff_address: data.destinationAddress || 'Destination',
      estimated_price: fareEstimate,
      distance_km: distanceKm,
    });
  }

  return {
    trip: trip as Trip,
    availableDriverCount: availableDriverIds.length,
    fareEstimateXaf: fareEstimate,
  };
}

/**
 * Submit a bid on a trip (atomically claim via Redis SET NX)
 */
export async function submitBid(
  driverId: string,
  tripId: string,
  data: SubmitBidInput
): Promise<TripBid> {
  const db = getDatabase() as any;
  const redis = getRedis();

  const driver = await db.query.driverProfiles.findFirst({
    where: eq(driverProfiles.userId, driverId),
  });

  if (!driver || driver.verificationStatus !== 'approved') {
    throw errors.driverNotVerified();
  }

  const trip = await db.query.trips.findFirst({
    where: eq(trips.id, tripId),
  });

  if (!trip) throw errors.tripNotFound();
  if (trip.status !== 'pending_bids') throw errors.tripNoLongerAcceptingBids();

  if (trip.expiresAt && new Date() > new Date(trip.expiresAt)) {
    throw errors.tripExpired();
  }

  const activeTrip = await redis.get(`driver:${driverId}:active_trip`);
  if (activeTrip) throw errors.driverHasActiveTrip();

  // Atomic claim: SET NX prevents same driver bidding twice within TTL
  const bidKey = `bid:${tripId}:${driverId}`;
  const bidData = JSON.stringify({
    driverId,
    amountXaf: data.amountXaf,
    etaMinutes: data.etaMinutes,
    createdAt: new Date().toISOString(),
  });

  const claimed = await redis.set(bidKey, bidData, 'EX', config.TRIP_BID_REDIS_TTL_SECONDS, 'NX');
  if (!claimed) throw errors.driverAlreadyBid();

  // Extend heartbeat so the driver remains "online" for the full bid window.
  // Without this, a 25s heartbeat TTL would cause acceptBid() to reject valid
  // bids when the client takes >25s to respond.
  const bidTtlSeconds = Math.ceil(config.TRIP_BID_EXPIRY_MS / 1000);
  await redis.expire(`driver:${driverId}:heartbeat`, bidTtlSeconds);

  const bidId = uuidv4();
  let bid: any;
  try {
    const [inserted] = await db
      .insert(tripBids)
      .values({
        id: bidId,
        tripId,
        driverId,
        amountXaf: data.amountXaf,
        etaMinutes: data.etaMinutes,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: trip.expiresAt,
      })
      .returning();
    bid = inserted;
  } catch (err: any) {
    // Roll back the Redis claim so the driver can retry cleanly
    await redis.del(bidKey);
    // PostgreSQL unique_violation (23505) from the (trip_id, driver_id) constraint
    if (err.code === '23505') {
      throw errors.driverAlreadyBid();
    }
    throw err;
  }

  const driverUser = await db.query.users.findFirst({ where: eq(users.id, driverId) });

  emitBidReceived(tripId, trip.clientId, {
    bidId: bid.id,
    driverId,
    driverName: driverUser?.firstName ?? 'Chauffeur',
    amountXaf: data.amountXaf,
    etaMinutes: data.etaMinutes,
    createdAt: bid.createdAt,
  });

  return bid as TripBid;
}

/**
 * Accept a bid: assign driver, transition trip, reject other bids.
 * DB transaction with status guard prevents double-accept race condition.
 *
 * paymentMethodId = null  → charge Hello Money wallet immediately (sync)
 * paymentMethodId = uuid  → initiate pawaPay mobile money collection (async, 202)
 */
export async function acceptBid(
  clientId: string,
  tripId: string,
  bidId: string,
  paymentMethodId: string | null = null
): Promise<Trip | { message: string; pawapayId: string; trip: Trip }> {
  const db = getDatabase() as any;
  const redis = getRedis();

  // Pre-fetch bid for early validation
  const bid = await db.query.tripBids.findFirst({
    where: and(eq(tripBids.id, bidId), eq(tripBids.tripId, tripId)),
  });

  if (!bid) throw errors.bidNotFound();
  if (bid.status !== 'pending') throw errors.bidNotFound();

  if (bid.expiresAt && new Date() > new Date(bid.expiresAt)) {
    throw errors.bidNotFound();
  }

  // Verify driver is still online before committing
  const heartbeat = await redis.get(`driver:${bid.driverId}:heartbeat`);
  if (!heartbeat) throw new AppError('DRIVER_OFFLINE', 'Driver is no longer online', 400);

  const fare = bid.amountXaf as number;

  // ── Payment pre-check (BEFORE any state change) ───────────────────────────
  if (paymentMethodId === null) {
    await ensureWalletExists(clientId);
    const balance = await getWalletBalance(clientId);
    if (balance < fare) throw errors.insufficientBalance();
  }

  let updatedTrip: any;

  await db.transaction(async (tx: any) => {
    // WHERE clause includes status = 'pending_bids' as a guard:
    // if another acceptBid() ran first, status is already 'bid_accepted'
    // and this update returns 0 rows, throwing before any bids are touched.
    const [updated] = await tx
      .update(trips)
      .set({
        status: 'bid_accepted' as TripStatus,
        driverId: bid.driverId,
        finalFareXaf: bid.amountXaf,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(trips.id, tripId),
          eq(trips.clientId, clientId),
          eq(trips.status, 'pending_bids')
        )
      )
      .returning();

    if (!updated) {
      throw errors.tripAccessDenied();
    }

    updatedTrip = updated;

    await tx
      .update(tripBids)
      .set({ status: 'accepted' })
      .where(eq(tripBids.id, bidId));

    await tx
      .update(tripBids)
      .set({ status: 'rejected' })
      .where(and(eq(tripBids.tripId, tripId), ne(tripBids.id, bidId)));
  });

  // Post-transaction Redis side effects
  await redis.setex(`driver:${bid.driverId}:active_trip`, config.TRIP_ACTIVE_REDIS_TTL_SECONDS, tripId);
  await redis.del(`trip:${tripId}:state`);
  await deleteKeysByPattern(`bid:${tripId}:*`);

  // ── Payment path ──────────────────────────────────────────────────────────
  if (paymentMethodId === null) {
    // Hello Money wallet payment — synchronous, debit immediately
    await postWalletTransaction(clientId, 'debit', fare, 'trip_payment', tripId);

    await db
      .update(trips)
      .set({ paymentStatus: 'paid', updatedAt: new Date() })
      .where(eq(trips.id, tripId));

    updatedTrip = { ...updatedTrip, paymentStatus: 'paid' };

    emitBidAccepted(tripId, {
      bidId,
      driverId: bid.driverId,
      tripId,
      finalFareXaf: fare,
      paymentStatus: 'paid',
    });
    emitPaymentConfirmed(tripId, clientId, { tripId, amountXaf: fare });

    return updatedTrip as Trip;
  } else {
    // Mobile Money payment — async via pawaPay
    await db
      .update(trips)
      .set({ paymentStatus: 'pending', updatedAt: new Date() })
      .where(eq(trips.id, tripId));

    const depositResult = await initiateDeposit(clientId, fare, paymentMethodId, tripId);

    emitBidAccepted(tripId, {
      bidId,
      driverId: bid.driverId,
      tripId,
      finalFareXaf: fare,
      paymentStatus: 'pending',
    });

    return {
      message: 'Paiement en attente de confirmation mobile',
      pawapayId: depositResult.pawapayId,
      trip: { ...updatedTrip, paymentStatus: 'pending' } as Trip,
    };
  }
}

/**
 * Update trip status with state machine validation
 */
export async function updateTripStatus(
  userId: string,
  tripId: string,
  data: UpdateTripStatusInput | { status: 'cancelled_by_admin' }
): Promise<Trip> {
  const db = getDatabase() as any;
  const redis = getRedis();
  const newStatus = data.status as TripStatus;

  const trip = await db.query.trips.findFirst({
    where: eq(trips.id, tripId),
  });

  if (!trip) throw errors.tripNotFound();

  const currentStatus = trip.status as TripStatus;

  if (!VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
    throw errors.invalidTripTransition(currentStatus, newStatus);
  }

  // Role-based permission enforcement
  if (
    ['driver_en_route', 'driver_arrived', 'in_transit', 'completed'].includes(newStatus) &&
    trip.driverId !== userId
  ) {
    throw errors.tripAccessDenied();
  }

  if (newStatus === 'cancelled_by_client' && trip.clientId !== userId) {
    throw errors.tripAccessDenied();
  }

  if (newStatus === 'cancelled_by_driver' && trip.driverId !== userId) {
    throw errors.tripAccessDenied();
  }

  const updateData: any = { status: newStatus, updatedAt: new Date() };
  if (newStatus === 'completed') {
    updateData.completedAt = new Date();
  }

  const [updatedTrip] = await db
    .update(trips)
    .set(updateData)
    .where(and(eq(trips.id, tripId), eq(trips.status, currentStatus)))
    .returning();

  if (!updatedTrip) {
    // Another concurrent request already transitioned this trip.
    throw errors.invalidTripTransition(currentStatus, newStatus);
  }

  // Clean up Redis for terminal states
  if (['completed', 'cancelled_by_client', 'cancelled_by_driver', 'cancelled_by_admin', 'no_bids', 'expired', 'payment_failed'].includes(newStatus)) {
    if (trip.driverId) {
      await redis.del(`driver:${trip.driverId}:active_trip`);
    }
    if (trip.clientId) {
      await redis.del(`client:${trip.clientId}:active_trip`);
    }
  }

  // Credit driver earnings on completion (5% commission to platform).
  // The ride itself already happened and trips.status is already committed
  // above — a payout failure (e.g. a stale/misconfigured PLATFORM_USER_ID)
  // must not turn a real, physically-completed trip into an HTTP error for
  // the driver, and must not skip the emitTripStatusChanged below. Each
  // postWalletTransaction call is already atomic on its own; log and move
  // on so this gets reconciled instead of corrupting the response.
  if (newStatus === 'completed' && trip.finalFareXaf && trip.driverId) {
    const commission = Math.floor(trip.finalFareXaf * config.COMMISSION_RATE);
    const driverEarning = trip.finalFareXaf - commission;

    try {
      await ensureWalletExists(trip.driverId);
      await postWalletTransaction(trip.driverId, 'credit', driverEarning, 'trip_earning', tripId);

      if (config.PLATFORM_USER_ID) {
        await ensureWalletExists(config.PLATFORM_USER_ID);
        await postWalletTransaction(config.PLATFORM_USER_ID, 'credit', commission, 'commission', tripId);
      }
    } catch (err) {
      console.error(`[trip.service] Failed to credit earnings for trip ${tripId}:`, err);
    }
  }

  // Refund the client if the trip was already paid — cancelling after
  // payment (by either party) must not just make the money disappear.
  // A fresh ledger credit, never a mutation of the original debit.
  if (
    ['cancelled_by_client', 'cancelled_by_driver', 'cancelled_by_admin'].includes(newStatus) &&
    trip.paymentStatus === 'paid' &&
    trip.finalFareXaf
  ) {
    try {
      await postWalletTransaction(trip.clientId, 'credit', trip.finalFareXaf, 'refund', tripId);
      await db.update(trips).set({ paymentStatus: 'refunded' }).where(eq(trips.id, tripId));
    } catch (err) {
      console.error(`[trip.service] Failed to refund trip ${tripId}:`, err);
    }
  }

  emitTripStatusChanged(tripId, trip.clientId, {
    tripId,
    newStatus,
    previousStatus: currentStatus,
    driverId: trip.driverId,
    timestamp: updatedTrip.updatedAt,
  });

  return updatedTrip as Trip;
}

/**
 * Admin-forced cancellation for dispute resolution. Reuses updateTripStatus
 * for the state transition, refund, and Redis cleanup it already handles —
 * only adds the audit trail (who, why) that a normal cancellation doesn't
 * need since the acting party is always the client or driver themselves.
 */
export async function adminCancelTrip(
  adminId: string,
  tripId: string,
  reason: string
): Promise<Trip> {
  const db = getDatabase() as any;

  const updatedTrip = await updateTripStatus(adminId, tripId, { status: 'cancelled_by_admin' });

  await db
    .update(trips)
    .set({ adminCancellationReason: reason, cancelledByAdminId: adminId })
    .where(eq(trips.id, tripId));

  return { ...updatedTrip, adminCancellationReason: reason, cancelledByAdminId: adminId } as Trip;
}

/**
 * Get trip details with active (non-expired) bids
 */
export async function getTripById(
  userId: string,
  tripId: string
): Promise<{ trip: Trip; bids?: TripBid[] }> {
  const db = getDatabase() as any;

  const trip = await db.query.trips.findFirst({
    where: eq(trips.id, tripId),
  });

  if (!trip) throw errors.tripNotFound();

  if (trip.clientId !== userId && trip.driverId !== userId) {
    throw errors.tripAccessDenied();
  }

  let bids: TripBid[] | undefined;

  if (trip.status === 'pending_bids') {
    bids = await db.query.tripBids.findMany({
      where: and(
        eq(tripBids.tripId, tripId),
        gte(tripBids.expiresAt, new Date())
      ),
    });
  }

  return { trip: trip as Trip, bids: bids as TripBid[] | undefined };
}

/**
 * Get trip history for the authenticated user (client or driver).
 * Returns last 50 trips sorted by creation date descending.
 */
export async function getTripHistory(
  userId: string,
  role: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ trips: any[]; total: number }> {
  const db = getDatabase();
  const offset = (page - 1) * limit;

  const condition = role === 'driver'
    ? eq(trips.driverId, userId)
    : eq(trips.clientId, userId);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: trips.id,
        status: trips.status,
        originAddress: trips.originAddress,
        destinationAddress: trips.destinationAddress,
        fareEstimateXaf: trips.fareEstimateXaf,
        finalFareXaf: trips.finalFareXaf,
        clientRating: trips.clientRating,
        createdAt: trips.createdAt,
        completedAt: trips.completedAt,
        driverFirstName: sql<string>`(SELECT first_name FROM users WHERE id = ${trips.driverId})`,
        clientFirstName: sql<string>`(SELECT first_name FROM users WHERE id = ${trips.clientId})`,
      })
      .from(trips)
      .where(condition)
      .orderBy(sql`${trips.createdAt} DESC`)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(trips)
      .where(condition),
  ]);

  const mapped = rows.map((r) => ({
    ...r,
    driver: r.driverFirstName ? { firstName: r.driverFirstName } : null,
    client: r.clientFirstName ? { firstName: r.clientFirstName } : null,
  }));

  return { trips: mapped, total: countRows[0]?.count ?? 0 };
}

/**
 * Get available (non-expired) trips near driver position
 */
export async function getAvailableTrips(
  driverId: string,
  originLatitude: number,
  originLongitude: number
): Promise<Trip[]> {
  const db = getDatabase() as any;

  const now = new Date();
  const radiusMeters = config.DRIVER_MATCHING_RADIUS_KM * 1000;

  const availableTrips = await db
    .select()
    .from(trips)
    .where(
      and(
        eq(trips.status, 'pending_bids'),
        gte(trips.expiresAt, now),
        isNotNull(trips.originGeom),
        sql`ST_DWithin(
          origin_geom::geography,
          ST_SetSRID(ST_MakePoint(${originLongitude}, ${originLatitude}), 4326)::geography,
          ${radiusMeters}
        )`,
      ),
    )
    .orderBy(trips.createdAt)
    .limit(50);

  return availableTrips as Trip[];
}

/**
 * Estimate trip fare without creating a trip record.
 * Used by GET /trips/estimate-fare.
 */
/**
 * Client rates a completed trip (1–5 stars).
 * Updates trip status to 'rated' and recomputes driver's rolling average.
 */
export async function rateTrip(
  clientId: string,
  tripId: string,
  data: RateTripInput,
): Promise<void> {
  const db = getDatabase();

  const [trip] = await db
    .select()
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);

  if (!trip) throw errors.notFound('Trip not found');
  if (trip.clientId !== clientId) throw errors.accessDenied();
  if (trip.status !== 'completed') {
    throw new AppError('TRIP_NOT_COMPLETED', 'Trip must be completed before rating', 400);
  }
  if (trip.ratedAt) {
    throw new AppError('ALREADY_RATED', 'This trip has already been rated', 409);
  }

  await db
    .update(trips)
    .set({
      status: 'rated',
      clientRating: data.rating,
      clientComment: data.comment ?? null,
      ratedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId));

  // Recompute driver rolling average
  if (trip.driverId) {
    await db
      .update(driverProfiles)
      .set({
        ratingAvg: sql`(rating_avg * rating_count + ${data.rating}) / (rating_count + 1)`,
        ratingCount: sql`rating_count + 1`,
        updatedAt: new Date(),
      })
      .where(eq(driverProfiles.userId, trip.driverId));
  }
}

export function estimateTrip(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number
): { fareEstimateXaf: number; distanceKm: number } {
  const distanceKm = haversineKm(originLat, originLon, destLat, destLon);
  const fareEstimateXaf = estimateFareXaf(originLat, originLon, destLat, destLon);
  return { fareEstimateXaf, distanceKm };
}
