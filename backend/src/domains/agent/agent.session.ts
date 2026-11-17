import { getRedis } from '../../plugins/redis.js';
import { config } from '../../core/config.js';
import { getDatabase } from '../../db/index.js';
import { trips, users } from '../../db/schema.js';
import { eq, and, notInArray, inArray } from 'drizzle-orm';
import type { AdminAgentStatus, SessionData, ConversationState } from './agent.types.js';

const KEY = {
  session: (phone: string) => `whatsapp:session:${phone}`,
  lock:    (phone: string) => `whatsapp:lock:${phone}`,
};

// Map trip DB status → FSM state for ghost recovery
const TRIP_STATUS_TO_FSM: Record<string, ConversationState> = {
  pending_bids:    'waiting_bids',
  bid_accepted:    'active_trip',
  driver_en_route: 'active_trip',
  driver_arrived:  'active_trip',
  in_transit:      'active_trip',
};

const TERMINAL_TRIP_STATUSES = [
  'completed',
  'cancelled_by_client',
  'cancelled_by_driver',
  'rated',
  'expired',
  'no_bids',
  'payment_failed',
  'driver_no_show',
];

export async function loadSession(phone: string): Promise<SessionData | null> {
  const raw = await getRedis().get(KEY.session(phone));
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

export async function saveSession(phone: string, session: SessionData): Promise<void> {
  const ttl = ['active_trip', 'waiting_bids'].includes(session.fsm)
    ? config.TRIP_ACTIVE_REDIS_TTL_SECONDS
    : config.AGENT_SESSION_TTL_SECONDS;
  await getRedis().set(KEY.session(phone), JSON.stringify(session), 'EX', ttl);
}

export async function deleteSession(phone: string): Promise<void> {
  await getRedis().del(KEY.session(phone));
}

// Lua script for a fenced release: only deletes the lock if it still holds
// THIS job's token. Without this, a lock that outlives its 30s TTL (a slow
// LLM call, a retried step) can be silently stolen by a second job for the
// same phone; the first job's eventual `releaseLock` would then delete the
// SECOND job's lock instead of its own, letting a third job in — two FSM
// transitions can end up running concurrently for one conversation.
const RELEASE_IF_OWNER_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

// Returns true if lock was acquired, false if already held by another job
export async function acquireLock(phone: string, jobId: string): Promise<boolean> {
  const result = await getRedis().set(KEY.lock(phone), jobId, 'EX', 30, 'NX');
  return result === 'OK';
}

// Only releases the lock if `jobId` is still the current holder — a stale
// job whose lock already expired (and was possibly reacquired by another
// job) must never delete someone else's lock.
export async function releaseLock(phone: string, jobId: string): Promise<void> {
  await getRedis().eval(RELEASE_IF_OWNER_SCRIPT, 1, KEY.lock(phone), jobId);
}

// Ghost recovery: rebuild session from DB when Redis session is missing
export async function recoverSession(
  phone: string,
  userId: string,
  role: 'client' | 'driver',
): Promise<SessionData> {
  const db = getDatabase() as any;

  const activeTrip = await db.query.trips.findFirst({
    where: and(
      eq(trips.clientId, userId),
      notInArray(trips.status, TERMINAL_TRIP_STATUSES),
    ),
    orderBy: (t: any, { desc }: any) => [desc(t.createdAt)],
  });

  const fsm: ConversationState = activeTrip
    ? (TRIP_STATUS_TO_FSM[activeTrip.status] ?? 'idle')
    : 'idle';

  const session: SessionData = {
    userId,
    role,
    fsm,
    context: activeTrip ? { tripId: activeTrip.id } : {},
    messageHistory: [],
    lastActivityAt: Date.now(),
  };

  await saveSession(phone, session);
  return session;
}

// Admin monitoring: every currently-live WhatsApp conversation. SCAN (not
// KEYS) so an admin loading this page never blocks Redis for the drivers
// mid-ping — session volume is small today but this stays safe as it grows.
export async function listActiveSessions(): Promise<AdminAgentStatus['activeSessions']> {
  const redis = getRedis();
  const prefix = 'whatsapp:session:';
  let cursor = '0';
  const keys: string[] = [];
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');

  if (keys.length === 0) return [];

  const raw = await redis.mget(...keys);
  const sessions = keys
    .map((key, i) => {
      if (!raw[i]) return null;
      const phone = key.slice(prefix.length);
      const data = JSON.parse(raw[i] as string) as SessionData;
      return { phone, fsm: data.fsm, lastActivityAt: data.lastActivityAt, userId: data.userId };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  if (sessions.length === 0) return [];

  const db = getDatabase() as any;
  const userIds = [...new Set(sessions.map((s) => s.userId))];
  const rows = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(inArray(users.id, userIds));
  const userById = new Map(rows.map((r: any) => [r.id, r]));

  return sessions
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
    .map((s) => {
      const user = userById.get(s.userId) as { firstName: string; lastName: string } | undefined;
      return {
        ...s,
        userFirstName: user?.firstName ?? null,
        userLastName: user?.lastName ?? null,
      };
    });
}
