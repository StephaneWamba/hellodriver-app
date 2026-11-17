/**
 * BullMQ inbound worker + enqueue helpers.
 * Orchestrates: parse → load session → FSM transition → execute actions → save session.
 */
import { Worker } from 'bullmq';
import { loadSession, saveSession, acquireLock, releaseLock, recoverSession } from './agent.session.js';
import {
  makeBullMQConnection,
  inboundQueue,
  outboundQueue,
  eventsQueue,
  INBOUND_QUEUE,
  OUTBOUND_QUEUE,
  EVENTS_QUEUE,
} from './agent.queue.js';
import { transition } from './agent.fsm.js';
import * as agentService from './agent.service.js';
import * as agentLlm from './agent.llm.js';
import * as agentWhatsapp from './agent.whatsapp.js';
import * as agentMessages from './agent.messages.js';
import type {
  WhatsAppInboundJob,
  WhatsAppOutboundJob,
  WhatsAppEventJob,
  FsmInput,
  FsmResult,
  SessionData,
} from './agent.types.js';

export { INBOUND_QUEUE, OUTBOUND_QUEUE, EVENTS_QUEUE };

// ── Enqueue helpers ───────────────────────────────────────────────────────────
// Reuse the long-lived Queue singletons from agent.queue.ts instead of opening
// a new Redis connection per call.

export async function enqueueInbound(job: WhatsAppInboundJob): Promise<void> {
  await inboundQueue.add('msg', job, {
    jobId: job.messageId,
    deduplication: { id: job.messageId },
    attempts: 3,
    backoff: { type: 'exponential', delay: 500 },
    removeOnComplete: { age: 3600 },
    removeOnFail: false,
  });
}

export async function enqueueOutbound(job: WhatsAppOutboundJob): Promise<void> {
  await outboundQueue.add('send', job, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false,
  });
}

export async function enqueueWhatsAppEvent(job: WhatsAppEventJob): Promise<void> {
  await eventsQueue.add('event', job, {
    removeOnComplete: true,
    removeOnFail: false,
  });
}

// ── Inbound worker ────────────────────────────────────────────────────────────

export function startAgentInboundWorker(): Worker {
  const worker = new Worker<WhatsAppInboundJob>(
    INBOUND_QUEUE,
    async (job) => {
      const { messageId, from, rawMessage } = job.data;

      // Dedup against a re-delivered Meta webhook is handled at enqueue time
      // via BullMQ's own jobId + deduplication (see enqueueInbound) — that
      // correctly coexists with this job's own attempts/backoff retries,
      // unlike a separate "mark processed" key set before work is done.

      // Per-user lock (retried on contention)
      const locked = await acquireLock(from, job.id!);
      if (!locked) throw new Error('LOCK_CONTENTION');

      try {
        // 3. Parse inbound message
        const parsed = agentWhatsapp.parseInboundMessage(rawMessage);
        if (!parsed) return;

        // 4. Mark as read (best-effort, non-blocking)
        agentWhatsapp.markAsRead(messageId).catch(() => {});

        // 5. Lookup user by phone
        const e164 = from.startsWith('+') ? from : `+${from}`;
        const userResult = await agentService.lookupUserByPhone(e164);
        if (!userResult.ok) {
          await enqueueOutbound({
            to: from,
            message: agentMessages.buildNoActiveSessionMessage(),
          });
          return;
        }
        const user = userResult.data;

        // 6. Load or recover session
        let session = await loadSession(from);
        if (!session) session = await recoverSession(from, user.id, user.role);

        // 7. Build FSM input
        const input = buildFsmInput(parsed);
        if (!input) return;

        // 8. Run the shared turn (transition + execute actions)
        const text = parsed.type === 'text' ? (parsed.text ?? '') : `[${parsed.type}]`;
        const { newSession, outbound } = await processTurn(from, user, session, input, text);

        // 9. Enqueue outbound messages via Meta
        for (const msg of outbound) {
          await enqueueOutbound(msg);
        }

        // 10. Save session
        await saveSession(from, newSession);

      } finally {
        await releaseLock(from, job.id!);
      }
    },
    { connection: makeBullMQConnection(), concurrency: 10 },
  );

  worker.on('failed', (job, err) => {
    if (err.message !== 'LOCK_CONTENTION') {
      console.error(`[agent.worker] inbound failed: ${job?.data.messageId}`, err.message);
    }
  });

  return worker;
}

// ── Shared turn processor ─────────────────────────────────────────────────────
// Used by both the WhatsApp BullMQ inbound worker and the /agent/simulate route.
// Runs the FSM transition, executes any resulting actions, and appends the
// user's message to history. Does NOT enqueue outbound or save the session —
// callers own delivery (WhatsApp queue vs. direct HTTP response) and persistence.

export async function processTurn(
  phone: string,
  user: agentService.AgentUser,
  session: SessionData,
  input: FsmInput,
  historyText: string,
): Promise<{ newSession: SessionData; outbound: WhatsAppOutboundJob[] }> {
  const transitionResult = transition(session, input);
  const { newSession, outbound } = await executeActions(transitionResult, phone, user, input);

  newSession.messageHistory = [
    ...newSession.messageHistory.slice(-9),
    { role: 'user', text: historyText, ts: Date.now() },
  ];
  newSession.lastUserMessageAt = Date.now();

  return { newSession, outbound };
}

// ── Action executor ───────────────────────────────────────────────────────────

// Shared by the 'call_get_fare_estimate' action and disambiguate_address's
// single-candidate auto-select branch (which used to duplicate this inline).
async function pushFareEstimate(
  session: SessionData,
  phone: string,
  outbound: WhatsAppOutboundJob[],
): Promise<void> {
  const { origin, destination } = session.context;
  if (!origin || !destination) return;
  const res = await agentService.getFareEstimate(origin.lat, origin.lon, destination.lat, destination.lon);
  if (res.ok) {
    session.context.fareEstimateXaf = res.data.fareXaf;
    outbound.push({ to: phone, message: agentMessages.buildFareConfirmMessage(res.data.fareXaf, origin.address, destination.address) });
  } else {
    outbound.push({ to: phone, message: { type: 'text', body: 'Impossible d\'estimer le trajet. Réessayez.' } });
    session.fsm = 'idle';
  }
}

async function executeActions(
  result: FsmResult,
  phone: string,
  user: agentService.AgentUser,
  input: FsmInput,
): Promise<{ newSession: SessionData; outbound: WhatsAppOutboundJob[] }> {
  let session = result.newSession;
  const outbound: WhatsAppOutboundJob[] = [];

  for (const action of result.actions) {
    switch (action.type) {

      case 'send_message':
        outbound.push({ to: phone, message: action.message });
        break;

      case 'classify_intent': {
        const text = input.type === 'user_text' ? input.text : '';
        const { intent } = await agentLlm.classifyIntent(text);
        const intentToId: Record<string, string> = {
          book_trip: 'book',
          check_status: 'status',
          cancel_trip: 'cancel',
          wallet: 'wallet',
          support: 'support',
        };
        const menuId = intentToId[intent] ?? 'support';
        const { newSession: s2, actions: acts2 } = transition(session, {
          type: 'user_menu_selection',
          id: menuId,
          title: menuId,
        });
        session = s2;
        for (const a of acts2) {
          if (a.type === 'send_message') outbound.push({ to: phone, message: a.message });
        }
        break;
      }

      case 'generate_support_response': {
        const text = input.type === 'user_text' ? input.text : '';
        const reply = await agentLlm.generateSupportResponse(text, session.messageHistory);
        outbound.push({ to: phone, message: { type: 'text', body: reply } });
        session.messageHistory = [
          ...session.messageHistory.slice(-9),
          { role: 'agent', text: reply, ts: Date.now() },
        ];
        break;
      }

      case 'generate_conversational_reply': {
        const text = input.type === 'user_text' ? input.text : '';
        const reply = await agentLlm.generateConversationalReply(text, action.context, session.messageHistory);
        outbound.push({ to: phone, message: { type: 'text', body: reply } });
        break;
      }

      case 'disambiguate_address': {
        const candidates = await agentLlm.disambiguateAddress(action.text);
        if (candidates.length === 0) {
          outbound.push({
            to: phone,
            message: { type: 'text', body: 'Adresse introuvable. Partagez votre position directement. 📍' },
          });
        } else if (candidates.length === 1) {
          const loc = candidates[0];
          const { newSession: s2, actions: acts2 } = transition(session, {
            type: 'user_location',
            lat: loc.lat,
            lon: loc.lon,
            address: loc.label,
          });
          session = s2;
          for (const a of acts2) {
            if (a.type === 'send_message') outbound.push({ to: phone, message: a.message });
            else if (a.type === 'call_get_fare_estimate') {
              await pushFareEstimate(session, phone, outbound);
            }
          }
        } else {
          outbound.push({
            to: phone,
            message: {
              type: 'interactive_list',
              body: 'Quelle adresse ?',
              buttonLabel: 'Choisir',
              sections: [{
                rows: candidates.map((c, i) => ({
                  id: `addr_${i}_${c.lat.toFixed(4)}_${c.lon.toFixed(4)}`,
                  title: c.label.slice(0, 24),
                  // WhatsApp list rows support a longer description line
                  // (72 chars) below the title — use it so the full address
                  // stays visible even though the title itself is capped at
                  // Meta's 24-char limit.
                  description: c.label.length > 24 ? c.label.slice(0, 72) : undefined,
                })),
              }],
            },
          });
        }
        break;
      }

      case 'call_get_fare_estimate': {
        await pushFareEstimate(session, phone, outbound);
        break;
      }

      case 'call_list_payment_methods': {
        const [methodsRes, balanceRes] = await Promise.all([
          agentService.agentListPaymentMethods(user.id),
          agentService.agentGetWalletBalance(user.id),
        ]);
        const methods = methodsRes.ok ? methodsRes.data : [];
        const balance = balanceRes.ok ? balanceRes.data : 0;
        outbound.push({ to: phone, message: agentMessages.buildPaymentMethodMenu(methods, balance) });
        break;
      }

      case 'call_book_trip': {
        const { origin, destination, activePaymentMethodId } = session.context;
        if (!origin || !destination) break;
        const res = await agentService.agentBookTrip(user.id, {
          originLat: origin.lat,
          originLon: origin.lon,
          originAddress: origin.address,
          destLat: destination.lat,
          destLon: destination.lon,
          destAddress: destination.address,
        });
        if (res.ok) {
          session.context.tripId = res.data.id;
          outbound.push({ to: phone, message: agentMessages.buildWaitingForBidsMessage() });
        } else {
          outbound.push({ to: phone, message: { type: 'text', body: `Impossible de réserver : ${res.error.message}` } });
          session.fsm = 'idle';
        }
        break;
      }

      case 'call_accept_bid': {
        if (!session.context.tripId) break;
        const res = await agentService.agentAcceptBid(
          user.id,
          session.context.tripId,
          action.bidId,
          session.context.activePaymentMethodId,
        );
        if (res.ok) {
          outbound.push({ to: phone, message: { type: 'text', body: '✅ Chauffeur confirmé ! Il est en route. 🚗' } });
        } else {
          outbound.push({ to: phone, message: { type: 'text', body: `Erreur : ${res.error.message}` } });
          session.fsm = 'idle';
        }
        break;
      }

      case 'call_get_trip_status': {
        if (!session.context.tripId) {
          outbound.push({ to: phone, message: { type: 'text', body: 'Aucune course en cours.' } });
          break;
        }
        const res = await agentService.agentGetTripStatus(user.id, session.context.tripId);
        if (res.ok) {
          outbound.push({ to: phone, message: agentMessages.buildTripStatusMessage(res.data.status) });
        } else {
          outbound.push({ to: phone, message: { type: 'text', body: 'Course introuvable.' } });
        }
        break;
      }

      case 'call_get_wallet_balance': {
        const res = await agentService.agentGetWalletBalance(user.id);
        if (res.ok) {
          outbound.push({ to: phone, message: { type: 'text', body: `💰 Votre solde HelloDriver : *${res.data.toLocaleString()} XAF*` } });
        } else {
          outbound.push({ to: phone, message: { type: 'text', body: 'Impossible de récupérer votre solde.' } });
        }
        break;
      }

      case 'call_cancel_trip': {
        if (!session.context.tripId) break;
        const res = await agentService.agentCancelTrip(user.id, session.context.tripId);
        if (res.ok) {
          outbound.push({ to: phone, message: { type: 'text', body: 'Course annulée. À bientôt ! 👋' } });
          session.fsm = 'idle';
        } else {
          outbound.push({ to: phone, message: { type: 'text', body: `Impossible d'annuler : ${res.error.message}` } });
        }
        break;
      }
    }
  }

  return { newSession: session, outbound };
}

// ── Parse inbound → FsmInput ──────────────────────────────────────────────────

export function buildFsmInput(parsed: agentWhatsapp.ParsedInbound): FsmInput | null {
  if (parsed.type === 'text' && parsed.text) {
    return { type: 'user_text', text: parsed.text };
  }
  if (parsed.type === 'location' && parsed.location) {
    return {
      type: 'user_location',
      lat: parsed.location.latitude,
      lon: parsed.location.longitude,
    };
  }
  if (parsed.type === 'interactive' && parsed.interactive) {
    return {
      type: 'user_menu_selection',
      id: parsed.interactive.id,
      title: parsed.interactive.title,
    };
  }
  return null;
}
