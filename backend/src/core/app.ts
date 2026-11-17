import Fastify, { FastifyInstance } from 'fastify';
import jwtPlugin from '@fastify/jwt';
import multipartPlugin from '@fastify/multipart';
import corsPlugin from '@fastify/cors';
import rateLimitPlugin from '@fastify/rate-limit';
import helmetPlugin from '@fastify/helmet';
import { config } from './config.js';
import { errorHandler } from '../shared/errors/handlers.js';

/**
 * Create and configure Fastify app
 */
export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.DEBUG ? 'debug' : 'info',
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url.replace(/([?&])secret=[^&]*/i, '$1secret=[REDACTED]'),
          };
        },
      },
    },
  });

  // Register CORS (browser-based clients: web admin panel, local testing).
  // Any http://localhost:<port> origin is allowed in addition to the
  // explicit allowlist — a browser can only reach it from the same
  // machine, so it carries no more risk than local code execution already
  // implies, and it keeps ad-hoc local testing from requiring a config change.
  const localhostOrigin = /^http:\/\/localhost:\d+$/;
  app.register(corsPlugin, {
    origin: (origin, cb) => {
      if (!origin || config.CLIENT_ORIGINS.includes(origin) || localhostOrigin.test(origin)) {
        return cb(null, true);
      }
      cb(new Error('Not allowed by CORS'), false);
    },
  });

  // Security headers — CSP disabled: this is a pure JSON API, no HTML is
  // ever served, so a content policy meant for browser-rendered pages
  // doesn't apply and could only cause confusing false restrictions.
  app.register(helmetPlugin, {
    contentSecurityPolicy: false,
  });

  // Global rate limit — generous enough for a single legit user (mobile
  // clients on shared carrier NAT in Gabon can share one public IP across
  // many real users), but stops naive flooding/scraping. Endpoint-specific
  // limits (OTP per phone, etc.) still apply on top of this.
  app.register(rateLimitPlugin, {
    max: 300,
    timeWindow: '1 minute',
  });

  // Register JWT plugin
  app.register(jwtPlugin, {
    secret: config.JWT_SECRET,
  });

  // Register multipart (for file uploads)
  app.register(multipartPlugin, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
    },
  });

  // Global error handler
  app.setErrorHandler(errorHandler);

  // Graceful shutdown
  app.addHook('onClose', async () => {
    app.log.info('Server shutting down gracefully');
  });

  return app;
}
