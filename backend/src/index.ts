import { initializeDatabase } from './db/index.js';
import { initializeRedis } from './plugins/redis.js';
import { initializeSocketIO } from './plugins/socketio.js';
import { createApp } from './core/app.js';
import { registerRoutes } from './routes.js';
import { config } from './core/config.js';
import { startPaymentWorker } from './workers/payment.worker.js';
import { startTripExpiryWorker } from './workers/trip-expiry.worker.js';
import { startAgentInboundWorker } from './domains/agent/agent.worker.js';
import { startAgentNotifyWorker } from './domains/agent/agent.notify.worker.js';
import { startAgentEventsWorker } from './domains/agent/agent.events.worker.js';

const start = async () => {
  try {
    // Initialize database
    initializeDatabase();
    console.log('✓ Database initialized');

    // Initialize Redis
    await initializeRedis();

    // Create app
    const app = await createApp();

    // Register routes
    await registerRoutes(app);
    console.log('✓ Routes registered');

    // Initialize Socket.io
    initializeSocketIO(app.server);

    // Start BullMQ payment polling worker (webhook fallback for stuck payments)
    startPaymentWorker();
    console.log('✓ Payment polling worker started');

    // Start trip expiry worker (transitions pending_bids → expired every 60s)
    const tripExpiryTimer = startTripExpiryWorker();

    // Start WhatsApp agent workers
    const agentInbound = startAgentInboundWorker();
    const agentNotify  = startAgentNotifyWorker();
    const agentEvents  = startAgentEventsWorker();
    console.log('✓ WhatsApp agent workers started');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down...`);
      clearInterval(tripExpiryTimer);
      await Promise.all([agentInbound.close(), agentNotify.close(), agentEvents.close()]);
      process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

    // Start server
    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`✓ Server running at http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`✗ Failed to start server: ${errorMessage}`);
    process.exit(1);
  }
};

start();
