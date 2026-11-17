/**
 * BullMQ trip events worker — routes trip status changes to WhatsApp.
 * Only sends if user has an active agent session (never spams non-agent users).
 */
import { Worker } from 'bullmq';
import { loadSession, saveSession } from './agent.session.js';
import { transition } from './agent.fsm.js';
import { enqueueOutbound } from './agent.worker.js';
import { makeBullMQConnection, EVENTS_QUEUE } from './agent.queue.js';
import { getDatabase } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import type { WhatsAppEventJob, FsmInput } from './agent.types.js';

export function startAgentEventsWorker(): Worker {
  const worker = new Worker<WhatsAppEventJob>(
    EVENTS_QUEUE,
    async (job) => {
      const { clientId, eventType, payload } = job.data;

      // 1. Lookup client phone from DB
      const db = getDatabase() as any;
      const user = await db.query.users.findFirst({ where: eq(users.id, clientId) });
      if (!user?.phone) return;

      // Meta expects phone without leading +
      const phone = user.phone.replace('+', '');

      // 2. Only send if user has an active agent session (opted into agent)
      const session = await loadSession(phone);
      if (!session) return;

      // 3. Build FSM input
      const input: FsmInput = { type: 'trip_event', eventType, payload };

      // 4. FSM transition
      const { newSession, actions } = transition(session, input);

      // 5. Enqueue outbound messages
      for (const action of actions) {
        if (action.type === 'send_message') {
          await enqueueOutbound({ to: phone, message: action.message });
        }
      }

      // 6. Save updated session
      await saveSession(phone, newSession);
    },
    { connection: makeBullMQConnection(), concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    console.error(`[agent.events] event failed: ${job?.data.eventType}`, err.message);
  });

  return worker;
}
