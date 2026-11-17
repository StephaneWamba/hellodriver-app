import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../core/config.js';
import { pollPaymentStatus } from '../domains/payment/payment.service.js';

export const PAYMENT_POLLING_QUEUE = 'payment-polling';

export interface PaymentPollingJob {
  pawapayId: string;
  type: 'deposit' | 'payout';
}

/**
 * BullMQ requires maxRetriesPerRequest: null on its Redis connection.
 * We use a dedicated connection — never share with the main Redis client.
 */
function makeBullMQConnection(): IORedis {
  return new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

/**
 * Enqueue a payment polling job.
 * Called when a webhook is not received within 2 minutes (fallback).
 * BullMQ handles retries with exponential backoff.
 */
export async function enqueuePaymentPoll(job: PaymentPollingJob): Promise<void> {
  const queue = new Queue(PAYMENT_POLLING_QUEUE, { connection: makeBullMQConnection() });
  await queue.add('poll', job, {
    delay: config.PAYMENT_POLL_DELAY_MS,
    attempts: config.PAYMENT_POLL_ATTEMPTS,
    backoff: { type: 'exponential', delay: config.PAYMENT_POLL_DELAY_MS },
    removeOnComplete: true,
    removeOnFail: false,  // Keep failed jobs for investigation
  });
  await queue.close();
}

/**
 * Start the BullMQ worker that polls pawaPay for stuck payments.
 * Runs as a background process alongside the main API server.
 */
export function startPaymentWorker(): Worker {
  const worker = new Worker<PaymentPollingJob>(
    PAYMENT_POLLING_QUEUE,
    async (job) => {
      const { pawapayId, type } = job.data;
      await pollPaymentStatus(pawapayId, type);
    },
    {
      connection: makeBullMQConnection(),
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`✓ Payment poll completed: ${job.data.pawapayId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`✗ Payment poll failed: ${job?.data.pawapayId}`, err.message);
  });

  return worker;
}
