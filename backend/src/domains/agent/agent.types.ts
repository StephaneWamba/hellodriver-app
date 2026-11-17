// ── Conversation FSM ──────────────────────────────────────────────────────────
export type ConversationState =
  | 'idle'
  | 'booking_origin'
  | 'booking_destination'
  | 'showing_fare'
  | 'awaiting_payment'
  | 'waiting_bids'
  | 'showing_bid'
  | 'active_trip'
  | 'support';

// ── Session (stored in Redis as JSON) ────────────────────────────────────────
export interface SessionData {
  userId: string;
  role: 'client' | 'driver';
  fsm: ConversationState;
  context: {
    tripId?: string;
    origin?: { lat: number; lon: number; address?: string };
    destination?: { lat: number; lon: number; address?: string };
    fareEstimateXaf?: number;
    pendingBids?: Array<{
      bidId: string;
      driverName: string;
      amountXaf: number;
      etaMin: number;
    }>;
    activePaymentMethodId?: string;
  };
  messageHistory: Array<{ role: 'user' | 'agent'; text: string; ts: number }>;
  lastActivityAt: number;       // epoch ms
  lastUserMessageAt?: number;   // epoch ms — for 24h window check
}

// ── FSM Inputs ────────────────────────────────────────────────────────────────
export type FsmInput =
  | { type: 'user_text'; text: string }
  | { type: 'user_location'; lat: number; lon: number; address?: string }
  | { type: 'user_menu_selection'; id: string; title: string }
  | { type: 'trip_event'; eventType: TripEventType; payload: unknown };

export type TripEventType =
  | 'bid_received'
  | 'driver_en_route'
  | 'driver_arrived'
  | 'in_transit'
  | 'completed'
  | 'payment_confirmed'
  | 'payment_failed';

// ── FSM Actions (pure output — no I/O) ───────────────────────────────────────
export type FsmAction =
  | { type: 'send_message'; message: WhatsAppOutboundMessage; tier: 'transactional' | 'conversational' }
  | { type: 'classify_intent' }
  | { type: 'generate_support_response' }
  | { type: 'generate_conversational_reply'; context: string }
  | { type: 'disambiguate_address'; text: string }
  | { type: 'call_book_trip' }
  | { type: 'call_get_fare_estimate' }
  | { type: 'call_accept_bid'; bidId: string }
  | { type: 'call_get_trip_status' }
  | { type: 'call_get_wallet_balance' }
  | { type: 'call_cancel_trip' }
  | { type: 'call_list_payment_methods' };

export interface FsmResult {
  newSession: SessionData;
  actions: FsmAction[];
}

// ── WhatsApp Outbound Message Types ──────────────────────────────────────────
export type WhatsAppOutboundMessage =
  | { type: 'text'; body: string; previewUrl?: boolean }
  | {
      type: 'interactive_buttons';
      body: string;
      buttons: Array<{ id: string; title: string }>;
      footer?: string;
    }
  | {
      type: 'interactive_list';
      body: string;
      buttonLabel: string;
      sections: Array<{
        title?: string;
        rows: Array<{ id: string; title: string; description?: string }>;
      }>;
      header?: string;
      footer?: string;
    }
  | { type: 'location_request'; body: string };

// ── BullMQ Job Payloads ───────────────────────────────────────────────────────
export interface WhatsAppInboundJob {
  messageId: string;    // wamid — dedup key
  from: string;         // phone without leading +
  timestamp: string;
  rawMessage: unknown;  // full Meta entry object
}

export interface WhatsAppOutboundJob {
  to: string;           // phone without leading +
  message: WhatsAppOutboundMessage;
  inboundMessageId?: string;
}

export interface WhatsAppEventJob {
  tripId: string;
  clientId: string;
  eventType: TripEventType;
  payload: unknown;
}

// ── Service Result ────────────────────────────────────────────────────────────
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

// ── LLM Types ─────────────────────────────────────────────────────────────────
export type IntentType =
  | 'book_trip'
  | 'check_status'
  | 'cancel_trip'
  | 'wallet'
  | 'support'
  | 'unknown';

export interface IntentResult {
  intent: IntentType;
  confidence: number;
}

// ── Admin monitoring ──────────────────────────────────────────────────────────
export interface AdminAgentStatus {
  circuitBreaker: { open: boolean; failures: number };
  activeSessions: Array<{
    phone: string;
    fsm: ConversationState;
    lastActivityAt: number;
    userId: string;
    userFirstName: string | null;
    userLastName: string | null;
  }>;
}
