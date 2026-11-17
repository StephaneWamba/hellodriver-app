import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  bookTrip,
  submitBid,
  acceptBid,
  updateTripStatus,
  getTripById,
  getAvailableTrips,
  estimateTrip,
  rateTrip,
  getTripHistory,
  adminCancelTrip,
} from './trip.service.js';
import {
  bookTripSchema,
  submitBidSchema,
  acceptBidSchema,
  updateTripStatusSchema,
  estimateFareSchema,
  rateTripSchema,
  adminCancelTripSchema,
} from './trip.validators.js';
import {
  authenticate,
  requireClient,
  requireDriver,
  requireAdmin,
} from '../../shared/errors/handlers.js';
import { AppError } from '../../shared/errors/AppError.js';

export async function registerTripRoutes(app: FastifyInstance) {
  // POST /trips/book — client books a trip
  app.post(
    '/trips/book',
    { onRequest: [requireClient] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      try {
        const body = bookTripSchema.parse(request.body);
        const result = await bookTrip(userId, body);
        return reply.status(201).send(result);
      } catch (err: any) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send(err.toJSON());
        }
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: err.message },
        });
      }
    }
  );

  // POST /trips/:id/bid — driver submits bid
  app.post(
    '/trips/:id/bid',
    { onRequest: [requireDriver] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      const tripId = (request.params as any).id;
      try {
        const body = submitBidSchema.parse(request.body);
        const bid = await submitBid(userId, tripId, body);
        return reply.status(201).send(bid);
      } catch (err: any) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send(err.toJSON());
        }
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: err.message },
        });
      }
    }
  );

  // PATCH /trips/:id/accept-bid — client accepts a bid
  app.patch(
    '/trips/:id/accept-bid',
    { onRequest: [requireClient] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      const tripId = (request.params as any).id;
      try {
        const body = acceptBidSchema.parse(request.body);
        const result = await acceptBid(userId, tripId, body.bidId, body.paymentMethodId);
        // Mobile money payment path → 202 with pawapayId
        if ('pawapayId' in result) {
          return reply.status(202).send(result);
        }
        return reply.send(result);
      } catch (err: any) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send(err.toJSON());
        }
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: err.message },
        });
      }
    }
  );

  // PATCH /trips/:id/status — update trip status (driver or client depending on transition)
  app.patch(
    '/trips/:id/status',
    { onRequest: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      const tripId = (request.params as any).id;
      try {
        const body = updateTripStatusSchema.parse(request.body);
        const trip = await updateTripStatus(userId, tripId, body);
        return reply.send(trip);
      } catch (err: any) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send(err.toJSON());
        }
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: err.message },
        });
      }
    }
  );

  // GET /trips/history — paginated trip history for authenticated user
  app.get(
    '/trips/history',
    { onRequest: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as any;
      const { page, limit } = request.query as { page?: string; limit?: string };
      const result = await getTripHistory(
        user.sub,
        user.role,
        page ? Math.max(1, parseInt(page)) : 1,
        limit ? Math.min(50, parseInt(limit)) : 20,
      );
      return reply.send(result);
    }
  );

  // GET /trips/estimate-fare — fare/distance estimate without creating a trip
  app.get(
    '/trips/estimate-fare',
    { onRequest: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = estimateFareSchema.parse(request.query);
        const result = estimateTrip(query.originLat, query.originLon, query.destLat, query.destLon);
        return reply.send(result);
      } catch (err: any) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send(err.toJSON());
        }
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: err.message },
        });
      }
    }
  );

  // GET /trips/available — list available trips for driver (must be before /:id)
  app.get(
    '/trips/available',
    { onRequest: [requireDriver] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      const { latitude, longitude } = request.query as {
        latitude?: string;
        longitude?: string;
      };

      if (!latitude || !longitude) {
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: 'latitude and longitude required' },
        });
      }

      const lat = Number(latitude);
      const lon = Number(longitude);
      if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: 'Invalid coordinates' },
        });
      }

      try {
        const availableTrips = await getAvailableTrips(userId, lat, lon);
        return reply.send(availableTrips);
      } catch (err: any) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send(err.toJSON());
        }
        request.log.error({ err }, 'getAvailableTrips failed');
        return reply.status(500).send({
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'Une erreur est survenue' },
        });
      }
    }
  );

  // POST /trips/:id/rate — client rates a completed trip
  app.post(
    '/trips/:id/rate',
    { onRequest: [requireClient] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const clientId = (request.user as any).sub;
      const tripId = (request.params as any).id as string;
      try {
        const body = rateTripSchema.parse(request.body);
        await rateTrip(clientId, tripId, body);
        return reply.status(204).send();
      } catch (err: any) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send(err.toJSON());
        }
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: err.message },
        });
      }
    }
  );

  // GET /trips/:id — get trip details
  app.get(
    '/trips/:id',
    { onRequest: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      const tripId = (request.params as any).id as string;
      try {
        const result = await getTripById(userId, tripId);
        return reply.send(result);
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        // Treat authorization failures as 404 to avoid leaking trip existence.
        if (err.message === 'Unauthorized') {
          return reply.status(404).send({
            error: { code: 'NOT_FOUND', message: 'Trip not found' },
          });
        }
        throw err;
      }
    }
  );

  // POST /admin/trips/:tripId/cancel — admin-forced cancellation for dispute resolution
  app.post(
    '/admin/trips/:tripId/cancel',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tripId } = request.params as { tripId: string };
      const adminId = (request.user as any).sub;
      const { reason } = adminCancelTripSchema.parse(request.body);

      const trip = await adminCancelTrip(adminId, tripId, reason);
      return reply.code(200).send(trip);
    }
  );
}
