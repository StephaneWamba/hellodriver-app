/**
 * WhatsApp simulator routes — demo channel while Meta business verification
 * is pending. Drives the exact same FSM/LLM/business logic as the real
 * WhatsApp webhook (see agent.worker.ts `processTurn`), just over plain HTTP
 * instead of Meta's Cloud API. Protected by a shared secret header since it
 * can create real trips and move real money through the wallet.
 */
import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { config } from '../../core/config.js';
import { getRedis } from '../../plugins/redis.js';
import * as agentService from './agent.service.js';
import * as agentMessages from './agent.messages.js';
import { loadSession, saveSession, recoverSession, deleteSession } from './agent.session.js';
import { processTurn } from './agent.worker.js';
import type { FsmInput, WhatsAppOutboundMessage } from './agent.types.js';

const inputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().min(1).max(1000) }),
  z.object({ type: z.literal('location'), lat: z.number(), lon: z.number(), address: z.string().optional() }),
  z.object({ type: z.literal('menu_selection'), id: z.string(), title: z.string() }),
]);

const phoneSchema = z
  .string()
  .regex(/^\+241[0-9]{8}$/, 'Format invalide — utilisez +24177XXXXXX ou +24167XXXXXX');

const sendBodySchema = z.object({
  phone: phoneSchema,
  input: inputSchema,
});

function toFsmInput(input: z.infer<typeof inputSchema>): FsmInput {
  if (input.type === 'text') return { type: 'user_text', text: input.text };
  if (input.type === 'location') return { type: 'user_location', lat: input.lat, lon: input.lon, address: input.address };
  return { type: 'user_menu_selection', id: input.id, title: input.title };
}

// The real WhatsApp pipeline keys everything (Redis sessions, the `to` field
// on outbound jobs) by phone WITHOUT a leading '+' — that's the raw format
// Meta's webhook delivers in `from`. The simulator's public API stays E.164
// (with '+') since that's the natural format for a phone field, but every
// internal session/outbox lookup must use the same bare format so a bid or
// trip-status event routed through agent.events.worker.ts (which strips the
// '+' via `user.phone.replace('+', '')`) lands on the same Redis key.
function toWaPhone(phone: string): string {
  return phone.replace(/^\+/, '');
}

function requireSimulatorKey(request: FastifyRequest, reply: FastifyReply): boolean {
  const provided = Buffer.from((request.headers['x-simulator-key'] as string) ?? '');
  const expected = Buffer.from(config.SIMULATOR_SECRET);
  const valid =
    config.SIMULATOR_SECRET.length > 0 &&
    provided.length === expected.length &&
    timingSafeEqual(provided, expected);
  if (!valid) {
    reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid simulator key' } });
    return false;
  }
  return true;
}

export async function registerAgentSimulateRoutes(app: FastifyInstance): Promise<void> {
  // POST /agent/simulate/send — process one turn of the conversation, return the reply immediately
  app.post('/agent/simulate/send', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSimulatorKey(request, reply)) return;

    let body: z.infer<typeof sendBodySchema>;
    try {
      body = sendBodySchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: err.message } });
    }

    const { phone, input } = body;
    const waPhone = toWaPhone(phone);

    const userResult = await agentService.lookupUserByPhone(phone);
    if (!userResult.ok) {
      return reply.status(200).send({
        session: null,
        messages: [agentMessages.buildNoActiveSessionMessage()],
      });
    }
    const user = userResult.data;

    const existingSession = await loadSession(waPhone);
    const isFirstContact = !existingSession;
    let session = existingSession ?? (await recoverSession(waPhone, user.id, user.role));

    // First contact in a demo session: show the main menu instead of running
    // the raw text through intent classification — mirrors common WhatsApp
    // bot UX (greeting → menu) without touching the real webhook path.
    if (isFirstContact && session.fsm === 'idle' && !session.context.tripId) {
      const balanceRes = await agentService.agentGetWalletBalance(user.id);
      const messages: WhatsAppOutboundMessage[] = [
        agentMessages.buildMainMenu(balanceRes.ok ? balanceRes.data : undefined),
      ];
      session.messageHistory = [{ role: 'agent', text: '[menu]', ts: Date.now() }];
      await saveSession(waPhone, session);
      return reply.status(200).send({ session: { fsm: session.fsm, context: session.context }, messages });
    }

    const fsmInput = toFsmInput(input);
    const historyText = input.type === 'text' ? input.text : `[${input.type}]`;
    const { newSession, outbound } = await processTurn(waPhone, user, session, fsmInput, historyText);

    await saveSession(waPhone, newSession);

    return reply.status(200).send({
      session: { fsm: newSession.fsm, context: newSession.context },
      messages: outbound.map((o) => o.message),
    });
  });

  // GET /agent/simulate/:phone/poll — drain async messages (trip events triggered from elsewhere)
  app.get('/agent/simulate/:phone/poll', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSimulatorKey(request, reply)) return;

    const parsed = phoneSchema.safeParse((request.params as { phone: string }).phone);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message } });
    }
    const key = `whatsapp:sim:outbox:${toWaPhone(parsed.data)}`;
    const redis = getRedis();

    const raw = await redis.lrange(key, 0, -1);
    if (raw.length > 0) await redis.del(key);

    // Redis list is newest-first (LPUSH) — reverse to chronological order
    const messages: WhatsAppOutboundMessage[] = raw.reverse().map((r) => JSON.parse(r));

    return reply.status(200).send({ messages });
  });

  // POST /agent/simulate/:phone/reset — clear the conversation session (restart the demo)
  app.post('/agent/simulate/:phone/reset', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSimulatorKey(request, reply)) return;

    const parsed = phoneSchema.safeParse((request.params as { phone: string }).phone);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message } });
    }
    const waPhone = toWaPhone(parsed.data);
    await deleteSession(waPhone);
    await getRedis().del(`whatsapp:sim:outbox:${waPhone}`);

    return reply.status(204).send();
  });
}
