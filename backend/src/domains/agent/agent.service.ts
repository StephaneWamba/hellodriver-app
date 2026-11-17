/**
 * Service facade — the ONLY file in the agent domain that imports from other domains.
 * All methods return Result<T> to standardize error handling.
 * Callers never need to catch AppError or know domain internals.
 */
import { getUserByPhone } from '../auth/auth.service.js';
import { bookTrip, getTripById, updateTripStatus, estimateTrip, acceptBid } from '../trip/trip.service.js';
import { getWalletBalance } from '../wallet/wallet.service.js';
import { listPaymentMethods } from '../payment/payment.service.js';
import { getDatabase } from '../../db/index.js';
import { trips } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { Result } from './agent.types.js';

// ── Exported agent-safe types (no deep domain coupling) ──────────────────────
export interface AgentUser {
  id: string;
  role: 'client' | 'driver';
  phone: string;
  firstName: string;
}

export interface AgentTrip {
  id: string;
  status: string;
  fareEstimateXaf?: number;
  finalFareXaf?: number;
  driverId?: string | null;
}

export interface AgentPaymentMethod {
  id: string;
  operator: string;
  phoneNumber: string;
  isDefault: boolean;
}

// ── User lookup ───────────────────────────────────────────────────────────────
export async function lookupUserByPhone(phone: string): Promise<Result<AgentUser>> {
  try {
    // Meta sends phone WITHOUT leading + — normalize to E.164
    const e164 = phone.startsWith('+') ? phone : `+${phone}`;
    const user = await getUserByPhone(e164);
    if (!user) {
      return { ok: false, error: { code: 'USER_NOT_FOUND', message: 'Aucun compte HelloDriver pour ce numéro.' } };
    }
    return {
      ok: true,
      data: {
        id: user.id,
        role: user.role as 'client' | 'driver',
        phone: user.phone,
        firstName: user.firstName,
      },
    };
  } catch (err) {
    return { ok: false, error: { code: 'LOOKUP_FAILED', message: 'Erreur lors de la recherche utilisateur.' } };
  }
}

// ── Fare estimate (sync — no DB write) ───────────────────────────────────────
export function getFareEstimate(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
): Result<{ fareXaf: number; distanceKm: number }> {
  try {
    const result = estimateTrip(originLat, originLon, destLat, destLon);
    return { ok: true, data: { fareXaf: result.fareEstimateXaf, distanceKm: result.distanceKm } };
  } catch (err: any) {
    return { ok: false, error: { code: 'ESTIMATE_FAILED', message: err.message ?? 'Impossible d\'estimer le trajet.' } };
  }
}

// ── Book trip with idempotency guard ──────────────────────────────────────────
export async function agentBookTrip(
  userId: string,
  input: {
    originLat: number;
    originLon: number;
    originAddress?: string;
    destLat: number;
    destLon: number;
    destAddress?: string;
  },
): Promise<Result<AgentTrip>> {
  try {
    const db = getDatabase() as any;

    // Idempotency: if user already has a pending_bids trip, return it
    const existing = await db.query.trips.findFirst({
      where: and(eq(trips.clientId, userId), eq(trips.status, 'pending_bids')),
    });
    if (existing) {
      return {
        ok: true,
        data: {
          id: existing.id,
          status: existing.status,
          fareEstimateXaf: existing.fareEstimateXaf ?? undefined,
        },
      };
    }

    const result = await bookTrip(userId, {
      originLatitude: input.originLat,
      originLongitude: input.originLon,
      originAddress: input.originAddress,
      destinationLatitude: input.destLat,
      destinationLongitude: input.destLon,
      destinationAddress: input.destAddress,
      tripType: 'exclusive',
    });

    return {
      ok: true,
      data: {
        id: result.trip.id,
        status: result.trip.status,
        fareEstimateXaf: result.fareEstimateXaf,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      error: { code: err.code ?? 'BOOK_FAILED', message: err.message ?? 'Impossible de réserver.' },
    };
  }
}

// ── Accept bid ────────────────────────────────────────────────────────────────
export async function agentAcceptBid(
  userId: string,
  tripId: string,
  bidId: string,
  paymentMethodId?: string,
): Promise<Result<AgentTrip>> {
  try {
    const result = await acceptBid(userId, tripId, bidId, paymentMethodId ?? null);
    // acceptBid returns Trip or { message, pawapayId, trip }
    const trip = 'id' in result ? result : (result as any).trip;
    return { ok: true, data: { id: trip.id, status: trip.status } };
  } catch (err: any) {
    return {
      ok: false,
      error: { code: err.code ?? 'ACCEPT_BID_FAILED', message: err.message ?? 'Impossible d\'accepter l\'offre.' },
    };
  }
}

// ── Cancel trip ───────────────────────────────────────────────────────────────
export async function agentCancelTrip(userId: string, tripId: string): Promise<Result<void>> {
  try {
    await updateTripStatus(userId, tripId, { status: 'cancelled_by_client' });
    return { ok: true, data: undefined };
  } catch (err: any) {
    return {
      ok: false,
      error: { code: err.code ?? 'CANCEL_FAILED', message: err.message ?? 'Impossible d\'annuler.' },
    };
  }
}

// ── Get trip status ───────────────────────────────────────────────────────────
export async function agentGetTripStatus(userId: string, tripId: string): Promise<Result<AgentTrip>> {
  try {
    const { trip } = await getTripById(userId, tripId);
    return {
      ok: true,
      data: {
        id: trip.id,
        status: trip.status,
        fareEstimateXaf: (trip as any).fareEstimateXaf ?? undefined,
        finalFareXaf: (trip as any).finalFareXaf ?? undefined,
        driverId: (trip as any).driverId,
      },
    };
  } catch (err: any) {
    return { ok: false, error: { code: err.code ?? 'TRIP_NOT_FOUND', message: 'Course introuvable.' } };
  }
}

// ── Wallet balance ────────────────────────────────────────────────────────────
export async function agentGetWalletBalance(userId: string): Promise<Result<number>> {
  try {
    const balance = await getWalletBalance(userId);
    return { ok: true, data: balance };
  } catch (err: any) {
    return { ok: false, error: { code: 'WALLET_FAILED', message: 'Impossible de récupérer le solde.' } };
  }
}

// ── Payment methods ───────────────────────────────────────────────────────────
export async function agentListPaymentMethods(userId: string): Promise<Result<AgentPaymentMethod[]>> {
  try {
    const methods = await listPaymentMethods(userId);
    return {
      ok: true,
      data: methods.map(m => ({
        id: m.id,
        operator: m.operator ?? '',
        phoneNumber: m.phoneNumber ?? '',
        isDefault: m.isDefault,
      })),
    };
  } catch (err: any) {
    return { ok: false, error: { code: 'METHODS_FAILED', message: 'Impossible de récupérer vos modes de paiement.' } };
  }
}
