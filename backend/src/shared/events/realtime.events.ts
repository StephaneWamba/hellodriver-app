import { getIO } from '../../plugins/socketio.js';
import { enqueueWhatsAppEvent } from '../../domains/agent/agent.worker.js';

// ─── Payload types ────────────────────────────────────────────────────────────

export interface BidReceivedPayload {
  bidId: string;
  driverId: string;
  driverName: string;
  amountXaf: number;
  etaMinutes: number;
  createdAt: Date;
}

export interface BidAcceptedPayload {
  bidId: string;
  driverId: string;
  tripId: string;
  finalFareXaf: number;
  paymentStatus: 'paid' | 'pending';
}

export interface TripStatusChangedPayload {
  tripId: string;
  newStatus: string;
  previousStatus: string;
  driverId: string | null;
  timestamp: Date;
}

export interface PaymentConfirmedPayload {
  tripId: string;
  amountXaf: number;
}

export interface PaymentFailedPayload {
  tripId: string;
  reason: string;
}

export interface NewTripRequestPayload {
  trip_id: string;
  pickup_address: string;
  dropoff_address: string;
  estimated_price: number;
  distance_km: number;
}

// ─── Emit helpers — all non-throwing ─────────────────────────────────────────

/**
 * Pushed to each matched driver's personal room right after a client books
 * a trip, so their app can surface it via NewTripSheet without polling.
 */
export function emitNewTripRequest(driverId: string, data: NewTripRequestPayload): void {
  try {
    getIO().to(`user:${driverId}`).emit('new_trip_request', data);
  } catch {
    // Socket.io failure is non-fatal — driver simply won't see this trip live
  }
}

export function emitBidReceived(tripId: string, clientId: string, data: BidReceivedPayload): void {
  try {
    getIO().to(`trip:${tripId}`).emit('bid:received', data);
  } catch {
    // Socket.io failure is non-fatal
  }
  enqueueWhatsAppEvent({
    tripId,
    clientId,
    eventType: 'bid_received',
    payload: { bidId: data.bidId, driverName: data.driverName, amountXaf: data.amountXaf, etaMin: data.etaMinutes },
  }).catch(() => {});
}

export function emitBidAccepted(tripId: string, data: BidAcceptedPayload): void {
  try {
    getIO().to(`trip:${tripId}`).emit('bid:accepted', data);
  } catch {
    // Socket.io failure is non-fatal
  }
}

export function emitTripStatusChanged(tripId: string, clientId: string, data: TripStatusChangedPayload): void {
  try {
    getIO().to(`trip:${tripId}`).emit('trip:status_changed', data);
  } catch {
    // Socket.io failure is non-fatal
  }
  const statusToEvent: Record<string, string> = {
    driver_en_route: 'driver_en_route',
    driver_arrived:  'driver_arrived',
    in_transit:      'in_transit',
    completed:       'completed',
  };
  const eventType = statusToEvent[data.newStatus];
  if (eventType) {
    enqueueWhatsAppEvent({ tripId, clientId, eventType: eventType as any, payload: data }).catch(() => {});
  }
}

export function emitPaymentConfirmed(tripId: string, clientId: string, data: PaymentConfirmedPayload): void {
  try {
    getIO().to(`trip:${tripId}`).emit('payment:confirmed', data);
  } catch {
    // Socket.io failure is non-fatal
  }
  enqueueWhatsAppEvent({ tripId, clientId, eventType: 'payment_confirmed', payload: data }).catch(() => {});
}

export function emitPaymentFailed(tripId: string, clientId: string, data: PaymentFailedPayload): void {
  try {
    getIO().to(`trip:${tripId}`).emit('payment:failed', data);
  } catch {
    // Socket.io failure is non-fatal
  }
  enqueueWhatsAppEvent({ tripId, clientId, eventType: 'payment_failed', payload: data }).catch(() => {});
}

// Driver GPS position during an active trip — CLAUDE.md rule 8 calls for
// volatile.emit specifically here: a dropped position update under
// congestion is harmless since the next ping (~3s later) supersedes it.
export function emitDriverLocation(tripId: string, latitude: number, longitude: number): void {
  try {
    getIO().to(`trip:${tripId}`).volatile.emit('driver_location', { latitude, longitude });
  } catch {
    // Socket.io failure is non-fatal — client simply won't see this ping
  }
}
