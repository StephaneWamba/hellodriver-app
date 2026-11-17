import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { authenticate, requireDriver } from '../../shared/errors/handlers.js';
import { AppError, errors } from '../../shared/errors/AppError.js';
import { config } from '../../core/config.js';
import {
  addPaymentMethod,
  listPaymentMethods,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  initiatePayout,
  handlePawapayCallback,
} from './payment.service.js';
import { addPaymentMethodSchema, payoutSchema } from './payment.validators.js';

export async function registerPaymentRoutes(app: FastifyInstance) {
  // GET /payments/methods — list saved mobile money numbers
  app.get(
    '/payments/methods',
    { onRequest: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      const methods = await listPaymentMethods(userId);
      return reply.send(methods);
    }
  );

  // POST /payments/methods — add Airtel/Moov number
  app.post(
    '/payments/methods',
    { onRequest: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      try {
        const body = addPaymentMethodSchema.parse(request.body);
        const method = await addPaymentMethod(userId, body);
        return reply.status(201).send(method);
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: err.message },
        });
      }
    }
  );

  // DELETE /payments/methods/:id — remove a saved method
  app.delete(
    '/payments/methods/:id',
    { onRequest: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      const methodId = (request.params as any).id;
      await deletePaymentMethod(userId, methodId);
      return reply.status(204).send();
    }
  );

  // PATCH /payments/methods/:id/set-default — set as default payment method
  app.patch(
    '/payments/methods/:id/set-default',
    { onRequest: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      const methodId = (request.params as any).id;
      await setDefaultPaymentMethod(userId, methodId);
      return reply.send({ success: true });
    }
  );

  // POST /drivers/payout — driver requests payout to mobile money
  app.post(
    '/drivers/payout',
    { onRequest: [requireDriver] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      try {
        const body = payoutSchema.parse(request.body);
        const result = await initiatePayout(userId, body.amountXaf, body.paymentMethodId);
        return reply.send(result);
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: err.message },
        });
      }
    }
  );

  // POST /webhooks/pawapay?secret=<token> — pawaPay deposit + payout callbacks
  // No auth middleware — verified via secret query param
  app.post(
    '/webhooks/pawapay',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { secret } = request.query as { secret?: string };

      const provided = Buffer.from(secret ?? '');
      const expected = Buffer.from(config.PAWAPAY_CALLBACK_SECRET);
      const valid =
        provided.length === expected.length &&
        timingSafeEqual(provided, expected);

      if (!valid) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Invalid callback secret' },
        });
      }

      try {
        await handlePawapayCallback(request.body);
      } catch (err: any) {
        // Log but return 200 — pawaPay will retry if we return non-2xx
        app.log.error({ err }, 'pawaPay callback processing error');
      }

      // Always return 200 fast — pawaPay expects it
      return reply.status(200).send({ received: true });
    }
  );
}
