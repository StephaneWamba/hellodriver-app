/**
 * BullMQ outbound worker — sends WhatsApp messages via Meta Cloud API.
 * Rate-limited to 80 messages/second (Meta MPS limit).
 * Adds typing indicator + minimum humanness delay before each message.
 */
import { Worker } from 'bullmq';
import { config } from '../../core/config.js';
import { sendWhatsAppMessage, sendTypingIndicator, WhatsAppNotConfiguredError } from './agent.whatsapp.js';
import { makeBullMQConnection, outboundQueue, OUTBOUND_QUEUE } from './agent.queue.js';
import { getRedis } from '../../plugins/redis.js';
import type { WhatsAppOutboundJob } from './agent.types.js';

const MIN_DELAY_MS = 600; // Humanness delay — prevents instant-bot feel
const SIM_OUTBOX_MAX = 50;
const SIM_OUTBOX_TTL_SECONDS = 3600;

// Mirrors every outbound message to a per-phone Redis list so the WhatsApp
// simulator web app can poll for messages triggered asynchronously (trip
// events from the mobile app: bid received, driver en route, etc.) — the
// direct chat reply for a simulator-originated message is already returned
// synchronously by POST /agent/simulate/send, so this only matters for
// events that don't originate from that endpoint.
async function mirrorToSimulatorOutbox(job: WhatsAppOutboundJob): Promise<void> {
  const redis = getRedis();
  const key = `whatsapp:sim:outbox:${job.to}`;
  await redis.lpush(key, JSON.stringify(job.message));
  await redis.ltrim(key, 0, SIM_OUTBOX_MAX - 1);
  await redis.expire(key, SIM_OUTBOX_TTL_SECONDS);
}

export function startAgentNotifyWorker(): Worker {
  const worker = new Worker<WhatsAppOutboundJob>(
    OUTBOUND_QUEUE,
    async (job) => {
      const { to, message } = job.data;

      // Typing indicator first (best-effort, non-blocking)
      await sendTypingIndicator(to);

      // Minimum delay (human-like pacing)
      await new Promise(r => setTimeout(r, MIN_DELAY_MS));

      // Send the message. If Meta isn't configured yet (business
      // verification pending) this is expected — swallow it, the simulator
      // outbox below is the fallback delivery path in the meantime. Any
      // OTHER failure (rate limit, 5xx, timeout) is a real, possibly
      // transient send failure and must propagate so BullMQ's attempts+
      // backoff actually get a chance to retry it — swallowing those too
      // silently drops outbound messages with no retry and no alert.
      try {
        await sendWhatsAppMessage(to, message);
      } catch (err) {
        if (err instanceof WhatsAppNotConfiguredError) {
          // expected for now — no-op, simulator outbox still fires below
        } else {
          await mirrorToSimulatorOutbox(job.data);
          throw err;
        }
      }

      await mirrorToSimulatorOutbox(job.data);
    },
    {
      connection: makeBullMQConnection(),
      concurrency: 10,
      limiter: {
        max: config.AGENT_WHATSAPP_OUTBOUND_RATE,
        duration: 1000,
      },
    },
  );

  worker.on('failed', (job, err) => {
    if ((err as any).status === 429) {
      console.warn(`[agent.notify] Meta rate limit — job will retry: ${job?.data.to}`);
    } else {
      console.error(`[agent.notify] Send failed: ${job?.data.to}`, err.message);
    }
  });

  // Apply global rate limit on the queue (enforced across all worker instances)
  outboundQueue.setGlobalRateLimit(config.AGENT_WHATSAPP_OUTBOUND_RATE, 1000).catch(() => {});

  return worker;
}
