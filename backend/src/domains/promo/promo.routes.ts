import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../shared/errors/handlers.js';
import { AppError } from '../../shared/errors/AppError.js';
import {
  validatePromoCode,
  getMyReferralInfo,
  redeemReferral,
} from './promo.service.js';
import { validatePromoSchema, redeemReferralSchema } from './promo.validators.js';

export async function registerPromoRoutes(app: FastifyInstance) {
  // POST /promo/validate — validate promo code and get discount amount
  app.post(
    '/promo/validate',
    { onRequest: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = validatePromoSchema.parse(request.body);
        const result = await validatePromoCode(body);
        return reply.send(result);
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: err.message },
        });
      }
    }
  );

  // GET /referrals/my-code — get my referral code and stats
  app.get(
    '/referrals/my-code',
    { onRequest: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      const result = await getMyReferralInfo(userId);
      return reply.send(result);
    }
  );

  // POST /referrals/redeem — redeem a referral code (called at signup)
  app.post(
    '/referrals/redeem',
    { onRequest: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      try {
        const body = redeemReferralSchema.parse(request.body);
        const result = await redeemReferral(userId, body);
        return reply.send(result);
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: err.message },
        });
      }
    }
  );
}

