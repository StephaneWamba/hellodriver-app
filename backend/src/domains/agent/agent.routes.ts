/**
 * WhatsApp Cloud API webhook routes.
 * GET  /webhooks/whatsapp — Meta hub.challenge verification
 * POST /webhooks/whatsapp — Inbound messages (ACK immediately, process async)
 *
 * Raw body must be captured BEFORE JSON parsing for HMAC-SHA256 verification.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../core/config.js';
import { requireAdmin } from '../../shared/errors/handlers.js';
import { verifyWebhookSignature, parseInboundMessage } from './agent.whatsapp.js';
import { enqueueInbound } from './agent.worker.js';
import { getLlmCircuitStatus } from './agent.llm.js';
import { listActiveSessions } from './agent.session.js';
import type { WhatsAppInboundJob } from './agent.types.js';

export async function registerAgentRoutes(app: FastifyInstance): Promise<void> {
  // Encapsulated in its own plugin context so the raw-buffer content-type
  // parser below only applies to these two routes — Fastify scopes
  // addContentTypeParser to the instance it's called on. Registering it on
  // the top-level `app` directly would break every other JSON route in the
  // API that sends an empty body (e.g. any POST with no payload), since
  // `JSON.parse('')` throws.
  await app.register(async (instance) => {
    // ── Raw body capture — must come before Fastify's default JSON parser ──
    instance.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (req: FastifyRequest, body: Buffer, done: (err: Error | null, body?: unknown) => void) => {
        (req as any).rawBody = body;
        try {
          done(null, body.length ? JSON.parse(body.toString()) : {});
        } catch (e) {
          done(e as Error);
        }
      },
    );

    // ── GET /webhooks/whatsapp — Meta hub.challenge verification ───────────
    instance.get('/webhooks/whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
      const q = request.query as Record<string, string>;
      if (
        q['hub.mode'] === 'subscribe' &&
        q['hub.verify_token'] === config.META_WEBHOOK_VERIFY_TOKEN
      ) {
        return reply.status(200).send(q['hub.challenge']);
      }
      return reply.status(403).send({ error: 'Forbidden' });
    });

    // ── POST /webhooks/whatsapp — Inbound messages ──────────────────────────
    instance.post('/webhooks/whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
      // ACK immediately — Meta requires response within 5 seconds
      reply.status(200).send({ received: true });

      // Verify HMAC signature
      const signature = (request.headers['x-hub-signature-256'] as string) ?? '';
      const rawBody = (request as any).rawBody as Buffer;

      if (!verifyWebhookSignature(rawBody, signature)) {
        app.log.warn('[agent.routes] Invalid Meta webhook signature — dropping');
        return;
      }

      // Extract and enqueue each message entry
      try {
        const body = request.body as any;
        const entries: unknown[] = body?.entry ?? [];

        for (const entry of entries) {
          const parsed = parseInboundMessage(entry);
          if (!parsed || parsed.type === 'unknown') continue;

          const job: WhatsAppInboundJob = {
            messageId: parsed.messageId,
            from: parsed.from,
            timestamp: parsed.timestamp,
            rawMessage: entry,
          };

          await enqueueInbound(job);
        }
      } catch (err) {
        app.log.error({ err }, '[agent.routes] Error enqueuing inbound message');
      }
    });
  });

  // GET /admin/agent/status — LLM circuit breaker + live WhatsApp conversations
  app.get(
    '/admin/agent/status',
    { onRequest: [requireAdmin] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const activeSessions = await listActiveSessions();
      return reply.code(200).send({ circuitBreaker: getLlmCircuitStatus(), activeSessions });
    }
  );
}
