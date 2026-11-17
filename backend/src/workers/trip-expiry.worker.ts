import { getDatabase } from '../db/index.js';
import { trips } from '../db/schema.js';
import { eq, and, lt } from 'drizzle-orm';
import { getRedis } from '../plugins/redis.js';

const INTERVAL_MS = 60_000; // run every 60 seconds

/**
 * Transitions all pending_bids trips whose expiresAt has passed to 'expired'.
 * Runs in-process on a 60-second interval — no extra queue needed.
 */
async function expireStaleTrips(): Promise<void> {
  const db = getDatabase() as any;
  try {
    const staleTrips = await db
      .select({ id: trips.id, clientId: trips.clientId })
      .from(trips)
      .where(
        and(
          eq(trips.status, 'pending_bids'),
          lt(trips.expiresAt, new Date())
        )
      );

    if (staleTrips.length === 0) return;

    await db
      .update(trips)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(
        and(
          eq(trips.status, 'pending_bids'),
          lt(trips.expiresAt, new Date())
        )
      );

    // Release the client-side booking guard so an unanswered request doesn't
    // lock the client out of rebooking for the remainder of its 2h TTL.
    const redis = getRedis();
    await Promise.all(
      staleTrips.map((trip: { id: string; clientId: string }) =>
        redis.del(`client:${trip.clientId}:active_trip`)
      )
    );
  } catch {
    // Non-fatal — will retry on next tick
  }
}

export function startTripExpiryWorker(): NodeJS.Timeout {
  // Run once immediately at startup to clean up any trips that expired while the server was down
  expireStaleTrips();
  const timer = setInterval(expireStaleTrips, INTERVAL_MS);
  console.log('✓ Trip expiry worker started (60s interval)');
  return timer;
}
