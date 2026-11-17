import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../shared/errors/handlers.js';
import { AppError } from '../../shared/errors/AppError.js';
import {
  getWalletBalance,
  getWalletTransactions,
  ensureWalletExists,
  depositToWallet,
} from './wallet.service.js';
import { depositSchema, transactionsQuerySchema } from './wallet.validators.js';

export async function registerWalletRoutes(app: FastifyInstance) {
  // GET /wallet/balance — current Hello Money balance
  app.get(
    '/wallet/balance',
    { onRequest: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      await ensureWalletExists(userId);
      const balanceXaf = await getWalletBalance(userId);
      return reply.send({ balanceXaf, currency: 'XAF' });
    }
  );

  // GET /wallet/transactions — paginated transaction ledger
  app.get(
    '/wallet/transactions',
    { onRequest: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      try {
        const query = transactionsQuerySchema.parse(request.query);
        const result = await getWalletTransactions(userId, query.limit, query.cursor);
        return reply.send(result);
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: err.message },
        });
      }
    }
  );

  // POST /wallet/deposit — initiate a mobile money top-up via pawaPay
  app.post(
    '/wallet/deposit',
    { onRequest: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub;
      try {
        const body = depositSchema.parse(request.body);
        const result = await depositToWallet(userId, body.amountXaf, body.paymentMethodId);
        return reply.status(202).send(result);
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: err.message },
        });
      }
    }
  );
}
