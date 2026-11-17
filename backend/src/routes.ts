import { FastifyInstance } from 'fastify';
import { registerAuthRoutes } from './domains/auth/auth.routes.js';
import { registerDriverRoutes } from './domains/driver/driver.routes.js';
import { registerTripRoutes } from './domains/trip/trip.routes.js';
import { registerWalletRoutes } from './domains/wallet/wallet.routes.js';
import { registerPaymentRoutes } from './domains/payment/payment.routes.js';
import { registerPromoRoutes } from './domains/promo/promo.routes.js';
import { registerPlacesRoutes } from './domains/places/places.routes.js';
import { registerAgentRoutes } from './domains/agent/agent.routes.js';
import { registerAgentSimulateRoutes } from './domains/agent/agent.simulate.routes.js';
import { registerAdminRoutes } from './domains/admin/admin.routes.js';

/**
 * Register all routes
 * This is the central place where all domain routes are registered
 */
export async function registerRoutes(app: FastifyInstance) {
  // Health check endpoint (no auth required)
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  // Auth routes
  await registerAuthRoutes(app);

  // Driver routes
  await registerDriverRoutes(app);

  // Trip routes (Phase 2)
  await registerTripRoutes(app);

  // Phase 3 — Wallet, Payments, Promo & Referrals
  await registerWalletRoutes(app);
  await registerPaymentRoutes(app);
  await registerPromoRoutes(app);
  await registerPlacesRoutes(app);

  // Phase 5 — WhatsApp AI Agent
  await registerAgentRoutes(app);
  await registerAgentSimulateRoutes(app);

  // Phase 6 — Admin panel (users, finances, trips oversight)
  await registerAdminRoutes(app);
}
