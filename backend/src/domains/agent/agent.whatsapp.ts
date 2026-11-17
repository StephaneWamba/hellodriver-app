/**
 * Meta WhatsApp Cloud API v21.0 HTTP client.
 * Mirrors pawapay.client.ts pattern — owns all HTTP communication with Meta.
 */
import crypto from 'crypto';
import { config } from '../../core/config.js';
import type { WhatsAppOutboundMessage } from './agent.types.js';

const GRAPH_URL = 'https://graph.facebook.com/v21.0';
const REQUEST_TIMEOUT_MS = 8000; // Gabon 2G/3G — fail fast rather than tie up a worker slot

/** Thrown when Meta credentials aren't set — distinct from a real send failure
 *  so callers can skip retries instead of hammering an API that can never work. */
export class WhatsAppNotConfiguredError extends Error {
  constructor() {
    super('WHATSAPP_NOT_CONFIGURED');
    this.name = 'WhatsAppNotConfiguredError';
  }
}

// ── Send a message ────────────────────────────────────────────────────────────
export async function sendWhatsAppMessage(
  to: string,
  message: WhatsAppOutboundMessage,
): Promise<void> {
  if (!config.WHATSAPP_ACCESS_TOKEN || !config.WHATSAPP_PHONE_NUMBER_ID) {
    throw new WhatsAppNotConfiguredError();
  }

  const payload = buildPayload(to, message);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(
      `${GRAPH_URL}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 429) {
      const err = new Error('WHATSAPP_RATE_LIMIT');
      (err as any).status = 429;
      throw err;
    }
    throw new Error(`WhatsApp API ${res.status}: ${body.slice(0, 200)}`);
  }
}

// Shared by the two best-effort calls below — never throws, just gives up
// after REQUEST_TIMEOUT_MS instead of risking an indefinite hang on a slow
// Meta response (sendTypingIndicator is awaited inline before every send).
async function bestEffortMetaCall(body: unknown): Promise<void> {
  if (!config.WHATSAPP_ACCESS_TOKEN || !config.WHATSAPP_PHONE_NUMBER_ID) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    await fetch(`${GRAPH_URL}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    // Non-fatal
  } finally {
    clearTimeout(timeout);
  }
}

// ── Typing indicator (best-effort, non-fatal) ─────────────────────────────────
export async function sendTypingIndicator(to: string): Promise<void> {
  await bestEffortMetaCall({
    messaging_product: 'whatsapp',
    to,
    type: 'typing',
    typing: { is_typing: true },
  });
}

// ── Mark message as read (shows blue ticks) ───────────────────────────────────
export async function markAsRead(messageId: string): Promise<void> {
  await bestEffortMetaCall({
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  });
}

// ── Webhook signature verification (x-hub-signature-256) ─────────────────────
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string): boolean {
  if (!signatureHeader || !config.META_WEBHOOK_SECRET) return false;
  const sig = signatureHeader.replace('sha256=', '');
  const expected = crypto
    .createHmac('sha256', config.META_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// ── Parse inbound Meta webhook entry ─────────────────────────────────────────
export interface ParsedInbound {
  messageId: string;
  from: string;
  timestamp: string;
  type: 'text' | 'location' | 'interactive' | 'unknown';
  text?: string;
  location?: { latitude: number; longitude: number };
  interactive?: { type: 'button_reply' | 'list_reply'; id: string; title: string };
}

export function parseInboundMessage(entry: unknown): ParsedInbound | null {
  try {
    const e = entry as any;
    const change = e?.changes?.[0]?.value;
    const msg = change?.messages?.[0];
    if (!msg) return null;

    const base = {
      messageId: msg.id as string,
      from: msg.from as string,
      timestamp: msg.timestamp as string,
    };

    if (msg.type === 'text') {
      return { ...base, type: 'text', text: msg.text?.body as string };
    }
    if (msg.type === 'location') {
      return {
        ...base,
        type: 'location',
        location: {
          latitude: parseFloat(msg.location.latitude),
          longitude: parseFloat(msg.location.longitude),
        },
      };
    }
    if (msg.type === 'interactive') {
      const itype = msg.interactive?.type as string;
      if (itype === 'button_reply') {
        return {
          ...base,
          type: 'interactive',
          interactive: {
            type: 'button_reply',
            id: msg.interactive.button_reply.id as string,
            title: msg.interactive.button_reply.title as string,
          },
        };
      }
      if (itype === 'list_reply') {
        return {
          ...base,
          type: 'interactive',
          interactive: {
            type: 'list_reply',
            id: msg.interactive.list_reply.id as string,
            title: msg.interactive.list_reply.title as string,
          },
        };
      }
    }
    return { ...base, type: 'unknown' };
  } catch {
    return null;
  }
}

// ── Build Meta API message payload ────────────────────────────────────────────
function buildPayload(to: string, message: WhatsAppOutboundMessage): unknown {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to };

  if (message.type === 'text') {
    return {
      ...base,
      type: 'text',
      text: { body: message.body, preview_url: message.previewUrl ?? false },
    };
  }

  if (message.type === 'interactive_buttons') {
    return {
      ...base,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: message.body },
        ...(message.footer ? { footer: { text: message.footer } } : {}),
        action: {
          buttons: message.buttons.map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    };
  }

  if (message.type === 'interactive_list') {
    return {
      ...base,
      type: 'interactive',
      interactive: {
        type: 'list',
        ...(message.header ? { header: { type: 'text', text: message.header } } : {}),
        body: { text: message.body },
        ...(message.footer ? { footer: { text: message.footer } } : {}),
        action: {
          button: message.buttonLabel.slice(0, 20),
          sections: message.sections.map(s => ({
            ...(s.title ? { title: s.title.slice(0, 24) } : {}),
            rows: s.rows.slice(0, 10).map(r => ({
              id: r.id,
              title: r.title.slice(0, 24),
              ...(r.description ? { description: r.description.slice(0, 72) } : {}),
            })),
          })),
        },
      },
    };
  }

  // location_request — WhatsApp Cloud API has no native "request location" message type
  // Send a text prompt; user shares pin natively via the attachment button
  if (message.type === 'location_request') {
    return {
      ...base,
      type: 'text',
      text: { body: message.body },
    };
  }

  return base;
}
