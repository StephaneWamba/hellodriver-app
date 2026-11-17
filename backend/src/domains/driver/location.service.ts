import { getDatabase } from '../../db/index.js';
import { driverLocations, tripLocationPings, driverProfiles } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getRedis } from '../../plugins/redis.js';
import { config } from '../../core/config.js';
import { errors } from '../../shared/errors/AppError.js';
import { emitDriverLocation } from '../../shared/events/realtime.events.js';
import type { LocationUpdateInput, OnlineToggleInput } from './location.validators.js';


/**
 * Update driver GPS location
 * - Redis GEOADD (ephemeral, for real-time matching) — every ping
 * - PostgreSQL upsert (durable fallback) — only on significant movement or time threshold
 * - Updates heartbeat for stale driver detection (25s TTL for Gabon network reliability)
 */
export async function updateDriverLocation(
  userId: string,
  data: LocationUpdateInput
): Promise<{ latitude: string; longitude: string; isOnline: boolean }> {
  const db = getDatabase() as any;
  const redis = getRedis();

  // Validate the driver is online — checked against Redis (set only by
  // toggleDriverOnlineStatus after a real verification check, and cleared
  // immediately on admin rejection) rather than re-querying Postgres on
  // every single ping. GPS pings arrive as often as every ~3s per active
  // driver; a DB round-trip on each one doesn't scale and adds latency that
  // matters on Gabon's 2G/3G links.
  const isOnline = await redis.exists(`driver:${userId}:online`);
  if (!isOnline) {
    throw errors.driverNotOnline();
  }

  // Add to Redis GEOADD (lon, lat order for Redis) — every ping for real-time matching
  await redis.geoadd('drivers:locations', data.longitude, data.latitude, userId);

  // Push the position live to whoever's riding with this driver right now —
  // this is the only thing that makes the client's map marker move. Was
  // entirely missing: the mobile app already listens for 'driver_location'
  // (see socket_service.dart) but nothing on the backend ever sent it.
  const activeTripId = await redis.get(`driver:${userId}:active_trip`);
  if (activeTripId) {
    emitDriverLocation(activeTripId, data.latitude, data.longitude);
  }

  // Refresh heartbeat in Redis (25s TTL — handles Gabon 3G network hiccups)
  // Drivers missing heartbeat >25s filtered from matching pool
  await redis.setex(`driver:${userId}:heartbeat`, config.DRIVER_HEARTBEAT_TTL_SECONDS, 'active');

  // Throttle the durable Postgres snapshot to ~10s per driver — Redis is
  // already the source of truth for real-time matching, so writing every
  // 3s ping straight to Postgres is unnecessary load (see CLAUDE.md's
  // "100 drivers × pings/sec would collapse the DB" note). We still return
  // the freshest coordinates to the caller either way.
  const pgSyncKey = `driver:${userId}:pg_synced_at`;
  const shouldSyncPg = await redis.set(pgSyncKey, '1', 'EX', 10, 'NX');

  if (shouldSyncPg) {
    await db
      .insert(driverLocations)
      .values({
        userId,
        latitude: String(data.latitude),
        longitude: String(data.longitude),
        geom: {
          x: data.longitude,
          y: data.latitude,
        },
        isOnline: true,
        lastHeartbeat: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: driverLocations.userId,
        set: {
          latitude: String(data.latitude),
          longitude: String(data.longitude),
          geom: {
            x: data.longitude,
            y: data.latitude,
          },
          isOnline: true,
          lastHeartbeat: new Date(),
          updatedAt: new Date(),
        },
      });
  }

  return {
    latitude: String(data.latitude),
    longitude: String(data.longitude),
    isOnline: true,
  };
}

/**
 * Toggle driver online/offline status
 * Prevents going online if not verified
 * Updates Redis and PostgreSQL atomically
 */
export async function toggleDriverOnlineStatus(
  userId: string,
  data: OnlineToggleInput
): Promise<{ isOnline: boolean; isAvailable: boolean }> {
  const db = getDatabase() as any;
  const redis = getRedis();

  // Validate driver is verified before allowing online status
  if (data.isOnline) {
    const driver = await db.query.driverProfiles.findFirst({
      where: eq(driverProfiles.userId, userId),
    });

    if (!driver || driver.verificationStatus !== 'approved') {
      throw errors.driverNotVerified();
    }
  }

  // Update PostgreSQL
  const [location] = await db
    .insert(driverLocations)
    .values({
      userId,
      latitude: '0',
      longitude: '0',
      geom: {
        x: 0,
        y: 0,
      },
      isOnline: data.isOnline,
      isAvailable: data.isOnline, // Available implies online
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: driverLocations.userId,
      set: {
        isOnline: data.isOnline,
        isAvailable: data.isOnline,
        updatedAt: new Date(),
      },
    })
    .returning();

  // Update Redis status key
  if (data.isOnline) {
    await redis.setex(`driver:${userId}:online`, config.DRIVER_ONLINE_TTL_SECONDS, '1');
    await redis.setex(`driver:${userId}:heartbeat`, config.DRIVER_HEARTBEAT_TTL_SECONDS, 'active'); // 25s TTL
  } else {
    await redis.del(`driver:${userId}:online`);
    await redis.del(`driver:${userId}:heartbeat`);
    // Remove from geo-sorted-set so offline drivers are excluded from trip matching
    await redis.zrem('drivers:locations', userId);
  }

  return {
    isOnline: location.isOnline,
    isAvailable: location.isAvailable,
  };
}

/**
 * Record GPS ping for active trip
 * Append-only, used for trip history and detailed tracking
 */
export async function recordTripLocationPing(
  tripId: string,
  driverId: string,
  data: LocationUpdateInput
): Promise<void> {
  const db = getDatabase() as any;

  await db.insert(tripLocationPings).values({
    id: uuidv4(),
    tripId,
    driverId,
    latitude: String(data.latitude),
    longitude: String(data.longitude),
    geom: {
      x: data.longitude,
      y: data.latitude,
    },
    speed: data.speed ? String(data.speed) : null,
    bearing: data.bearing ? String(data.bearing) : null,
    accuracy: data.accuracy ? String(data.accuracy) : null,
    createdAt: new Date(),
  });
}

/**
 * Get driver location
 */
export async function getDriverLocation(userId: string) {
  const db = getDatabase() as any;

  const location = await db.query.driverLocations.findFirst({
    where: eq(driverLocations.userId, userId),
  });

  return location;
}

/**
 * Get online available drivers in a region (via Redis GEORADIUS)
 * Used by trip matching engine
 */
export async function getOnlineDriversInRadius(
  latitude: number,
  longitude: number,
  radiusKm: number = 5
): Promise<string[]> {
  const redis = getRedis();

  // GEORADIUS: find drivers within radius
  const driverIds = (await redis.georadius(
    'drivers:locations',
    longitude,
    latitude,
    radiusKm,
    'km'
  )) as string[];

  if (driverIds.length === 0) return [];

  // Filter by heartbeat (remove stale drivers without a recent ping) —
  // checked in parallel rather than one round-trip at a time per candidate,
  // which matters once a zone has more than a handful of drivers.
  const pipeline = redis.pipeline();
  for (const driverId of driverIds) {
    pipeline.exists(`driver:${driverId}:heartbeat`);
    pipeline.exists(`driver:${driverId}:online`);
  }
  const results = await pipeline.exec();

  const activeDrivers: string[] = [];
  driverIds.forEach((driverId, i) => {
    const hasHeartbeat = results?.[i * 2]?.[1] === 1;
    const isOnline = results?.[i * 2 + 1]?.[1] === 1;
    if (hasHeartbeat && isOnline) {
      activeDrivers.push(driverId);
    }
  });

  return activeDrivers;
}
