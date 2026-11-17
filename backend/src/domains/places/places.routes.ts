import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../shared/errors/handlers.js';
import { errors } from '../../shared/errors/AppError.js';
import { config } from '../../core/config.js';

const GOOGLE_BASE = 'https://maps.googleapis.com/maps/api';

// Libreville bounding circle — biases results without hard-restricting them.
const LOCATION_BIAS = 'circle:50000@0.4162,9.4673';

/**
 * Proxies Google Places/Geocoding REST calls server-side.
 *
 * Two independent reasons this can't be a direct client call:
 * 1. Security — the Places/Geocoding REST APIs don't support HTTP-referrer
 *    restrictions the way the client-side Maps JS/SDK key does, so shipping
 *    this key inside the app (APK/IPA/web bundle) means anyone can extract
 *    and reuse it against our quota.
 * 2. Google's Places/Geocoding REST endpoints send no CORS headers at all —
 *    by design they expect server-side callers, so a browser build can never
 *    call them directly regardless of origin.
 */
export async function registerPlacesRoutes(app: FastifyInstance) {
  // GET /places/autocomplete?input=...
  app.get(
    '/places/autocomplete',
    { onRequest: [authenticate], config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { input } = request.query as { input?: string };
      if (!input || !input.trim()) return reply.send({ predictions: [] });

      const url = new URL(`${GOOGLE_BASE}/place/autocomplete/json`);
      url.searchParams.set('input', input);
      url.searchParams.set('key', config.GOOGLE_MAPS_API_KEY);
      url.searchParams.set('language', 'fr');
      url.searchParams.set('locationbias', LOCATION_BIAS);
      url.searchParams.set('types', 'geocode|establishment');

      try {
        const res = await fetch(url);
        const data = await res.json();
        return reply.send(data);
      } catch {
        throw errors.internalError('Places autocomplete request failed');
      }
    }
  );

  // GET /places/details?placeId=...
  app.get(
    '/places/details',
    { onRequest: [authenticate], config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { placeId } = request.query as { placeId?: string };
      if (!placeId) throw errors.validationFailed({ placeId: 'Required' });

      const url = new URL(`${GOOGLE_BASE}/place/details/json`);
      url.searchParams.set('place_id', placeId);
      url.searchParams.set('key', config.GOOGLE_MAPS_API_KEY);
      url.searchParams.set('fields', 'geometry,formatted_address');
      url.searchParams.set('language', 'fr');

      try {
        const res = await fetch(url);
        const data = await res.json();
        return reply.send(data);
      } catch {
        throw errors.internalError('Place details request failed');
      }
    }
  );

  // GET /places/directions?originLat=...&originLng=...&destLat=...&destLng=...
  app.get(
    '/places/directions',
    { onRequest: [authenticate], config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { originLat, originLng, destLat, destLng } = request.query as {
        originLat?: string;
        originLng?: string;
        destLat?: string;
        destLng?: string;
      };
      if (!originLat || !originLng || !destLat || !destLng) {
        throw errors.validationFailed({ query: 'originLat, originLng, destLat, destLng are required' });
      }

      const url = new URL(`${GOOGLE_BASE}/directions/json`);
      url.searchParams.set('origin', `${originLat},${originLng}`);
      url.searchParams.set('destination', `${destLat},${destLng}`);
      url.searchParams.set('key', config.GOOGLE_MAPS_API_KEY);
      url.searchParams.set('language', 'fr');
      url.searchParams.set('mode', 'driving');

      try {
        const res = await fetch(url);
        const data = await res.json();
        return reply.send(data);
      } catch {
        throw errors.internalError('Directions request failed');
      }
    }
  );

  // GET /places/geocode?lat=...&lng=...  (reverse geocoding)
  app.get(
    '/places/geocode',
    { onRequest: [authenticate], config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { lat, lng } = request.query as { lat?: string; lng?: string };
      if (!lat || !lng) throw errors.validationFailed({ lat: 'Required', lng: 'Required' });

      const url = new URL(`${GOOGLE_BASE}/geocode/json`);
      url.searchParams.set('latlng', `${lat},${lng}`);
      url.searchParams.set('key', config.GOOGLE_MAPS_API_KEY);
      url.searchParams.set('language', 'fr');

      try {
        const res = await fetch(url);
        const data = await res.json();
        return reply.send(data);
      } catch {
        throw errors.internalError('Reverse geocoding request failed');
      }
    }
  );
}
