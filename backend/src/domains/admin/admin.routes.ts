import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAdmin } from '../../shared/errors/handlers.js';
import {
  listUsers,
  getUserDetail,
  setUserSuspension,
  getFinancesOverview,
  listWalletTransactions,
  listPayments,
  listTrips,
  getTripDetail,
  getLiveDrivers,
  listPromoCodes,
  createPromoCode,
  deactivatePromoCode,
  updatePromoCode,
  deletePromoCode,
  getReferralsOverview,
  updateUserProfile,
  adjustUserWallet,
  listAdmins,
  createAdmin,
  revokeAdmin,
} from './admin.service.js';
import {
  listUsersQuerySchema,
  suspendUserSchema,
  listTransactionsQuerySchema,
  listPaymentsQuerySchema,
  listTripsQuerySchema,
  createPromoCodeSchema,
  updatePromoCodeSchema,
  updateUserProfileSchema,
  adjustWalletSchema,
  createAdminSchema,
} from './admin.validators.js';

export async function registerAdminRoutes(app: FastifyInstance) {
  // GET /admin/users — search + paginate all users
  app.get(
    '/admin/users',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = listUsersQuerySchema.parse(request.query);
      const result = await listUsers(query);
      return reply.code(200).send(result);
    }
  );

  // GET /admin/users/:userId — full profile + trips + wallet history
  app.get(
    '/admin/users/:userId',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as { userId: string };
      const detail = await getUserDetail(userId);
      return reply.code(200).send(detail);
    }
  );

  // PATCH /admin/users/:userId/suspend — suspend or reinstate a client/driver account
  app.patch(
    '/admin/users/:userId/suspend',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as { userId: string };
      const { suspend, reason } = suspendUserSchema.parse(request.body);

      await setUserSuspension(userId, suspend, reason);

      return reply.code(200).send({ success: true });
    }
  );

  // PATCH /admin/users/:userId — edit profile fields (name, email)
  app.patch(
    '/admin/users/:userId',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as { userId: string };
      const body = updateUserProfileSchema.parse(request.body);
      await updateUserProfile(userId, body);
      return reply.code(200).send({ success: true });
    }
  );

  // POST /admin/users/:userId/wallet-adjustment — manual credit/debit with a reason
  app.post(
    '/admin/users/:userId/wallet-adjustment',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as { userId: string };
      const adminId = (request.user as any).sub;
      const body = adjustWalletSchema.parse(request.body);
      const result = await adjustUserWallet(userId, adminId, body);
      return reply.code(200).send(result);
    }
  );

  // GET /admin/finances/overview — platform revenue, wallet balances, alerts
  app.get(
    '/admin/finances/overview',
    { onRequest: [requireAdmin] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const overview = await getFinancesOverview();
      return reply.code(200).send(overview);
    }
  );

  // GET /admin/finances/transactions — paginated wallet ledger browser
  app.get(
    '/admin/finances/transactions',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = listTransactionsQuerySchema.parse(request.query);
      const result = await listWalletTransactions(query);
      return reply.code(200).send(result);
    }
  );

  // GET /admin/finances/payments — paginated pawaPay deposits/payouts
  app.get(
    '/admin/finances/payments',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = listPaymentsQuerySchema.parse(request.query);
      const result = await listPayments(query);
      return reply.code(200).send(result);
    }
  );

  // GET /admin/trips — paginated trip oversight, filterable by status
  app.get(
    '/admin/trips',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = listTripsQuerySchema.parse(request.query);
      const result = await listTrips(query);
      return reply.code(200).send(result);
    }
  );

  // GET /admin/trips/:tripId — full trip detail with bid history
  app.get(
    '/admin/trips/:tripId',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tripId } = request.params as { tripId: string };
      const detail = await getTripDetail(tripId);
      return reply.code(200).send(detail);
    }
  );

  // GET /admin/drivers/live — real-time positions of online drivers (Redis)
  app.get(
    '/admin/drivers/live',
    { onRequest: [requireAdmin] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const drivers = await getLiveDrivers();
      return reply.code(200).send({ data: drivers, count: drivers.length });
    }
  );

  // GET /admin/promo-codes — list all generic promo codes
  app.get(
    '/admin/promo-codes',
    { onRequest: [requireAdmin] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const codes = await listPromoCodes();
      return reply.code(200).send({ data: codes, count: codes.length });
    }
  );

  // POST /admin/promo-codes — create a new generic promo code
  app.post(
    '/admin/promo-codes',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const adminId = (request.user as any).sub;
      const body = createPromoCodeSchema.parse(request.body);
      const code = await createPromoCode(adminId, body);
      return reply.code(201).send(code);
    }
  );

  // PATCH /admin/promo-codes/:promoId/deactivate — expire a code immediately
  app.patch(
    '/admin/promo-codes/:promoId/deactivate',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { promoId } = request.params as { promoId: string };
      await deactivatePromoCode(promoId);
      return reply.code(200).send({ success: true });
    }
  );

  // PATCH /admin/promo-codes/:promoId — edit value, max uses, or expiry
  app.patch(
    '/admin/promo-codes/:promoId',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { promoId } = request.params as { promoId: string };
      const body = updatePromoCodeSchema.parse(request.body);
      const code = await updatePromoCode(promoId, body);
      return reply.code(200).send(code);
    }
  );

  // DELETE /admin/promo-codes/:promoId — permanently remove an unused code
  app.delete(
    '/admin/promo-codes/:promoId',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { promoId } = request.params as { promoId: string };
      await deletePromoCode(promoId);
      return reply.code(204).send();
    }
  );

  // GET /admin/referrals/overview — platform-wide referral stats
  app.get(
    '/admin/referrals/overview',
    { onRequest: [requireAdmin] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const overview = await getReferralsOverview();
      return reply.code(200).send(overview);
    }
  );

  // GET /admin/admins — list admin accounts
  app.get(
    '/admin/admins',
    { onRequest: [requireAdmin] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const admins = await listAdmins();
      return reply.code(200).send({ data: admins, count: admins.length });
    }
  );

  // POST /admin/admins — create a new admin account (email + password)
  app.post(
    '/admin/admins',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createAdminSchema.parse(request.body);
      const admin = await createAdmin(body);
      return reply.code(201).send(admin);
    }
  );

  // DELETE /admin/admins/:adminId — revoke an admin's access
  app.delete(
    '/admin/admins/:adminId',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { adminId } = request.params as { adminId: string };
      const actingAdminId = (request.user as any).sub;
      await revokeAdmin(adminId, actingAdminId);
      return reply.code(204).send();
    }
  );
}
