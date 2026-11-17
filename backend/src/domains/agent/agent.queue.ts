/**
 * Shared BullMQ connection + queue singletons for the WhatsApp agent domain.
 * Previously each worker file (agent.worker.ts, agent.notify.worker.ts,
 * agent.events.worker.ts) duplicated its own makeBullMQConnection() and every
 * enqueue call opened a brand-new IORedis connection + Queue just to add one
 * job then close it — wasteful under Gabon's higher-latency links and against
 * BullMQ's own guidance to reuse Queue instances.
 */
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../../core/config.js';

export const INBOUND_QUEUE = 'whatsapp-inbound';
export const OUTBOUND_QUEUE = 'whatsapp-outbound';
export const EVENTS_QUEUE = 'whatsapp-events';

export function makeBullMQConnection(): IORedis {
  return new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

// Long-lived Queue instances — one connection each, reused for every enqueue
// call for the lifetime of the process. Workers (Worker instances) still get
// their own dedicated connection via makeBullMQConnection(), which is correct
// BullMQ usage (a Worker's connection is not meant to be shared with a Queue).
export const inboundQueue = new Queue(INBOUND_QUEUE, { connection: makeBullMQConnection() });
export const outboundQueue = new Queue(OUTBOUND_QUEUE, { connection: makeBullMQConnection() });
export const eventsQueue = new Queue(EVENTS_QUEUE, { connection: makeBullMQConnection() });
