import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { timingSafeEqual } from 'node:crypto';
import {
  signupSchema,
  otpSchema,
  profileUpdateSchema,
  adminLoginSchema,
  adminChangePasswordSchema,
  type SignupInput,
  type OtpInput,
} from './auth.validators.js';
import {
  createUser,
  getUser,
  getUserByPhone,
  getUserWithProfile,
  updateUser,
  phoneExists,
  verifyAdminCredentials,
  changeAdminPassword,
} from './auth.service.js';
import { sendOTP, verifyOTP } from '../sms/sms.service.js';
import { getRedis } from '../../plugins/redis.js';
import { authenticate, requireAdmin } from '../../shared/errors/handlers.js';
import { errors } from '../../shared/errors/AppError.js';
import { createTokenService } from './auth.token.service.js';
import { config } from '../../core/config.js';

/**
 * Register auth routes
 */
export async function registerAuthRoutes(app: FastifyInstance) {
  const tokenService = createTokenService(app.jwt);
  /**
   * POST /auth/send-otp
   * Send OTP to phone number
   */
  app.post('/auth/send-otp', async (request: FastifyRequest, reply: FastifyReply) => {
    const { phone } = signupSchema.pick({ phone: true }).parse(request.body);

    try {
      const result = await sendOTP(phone);

      if (!result.success) {
        if (result.error?.toLowerCase().includes('too many')) {
          return reply.code(429).send({ error: { code: 'OTP_RATE_LIMITED', message: result.error } });
        }
        throw errors.otpSendFailed(result.error);
      }

      return reply.code(200).send({
        message: 'OTP sent to phone',
        phone,
      });
    } catch (err) {
      if (err instanceof Error && 'statusCode' in err && 'code' in err) {
        throw err;
      }
      throw errors.otpSendFailed();
    }
  });

  /**
   * POST /auth/verify-otp-and-signup
   * Verify OTP and create user account
   */
  app.post(
    '/auth/verify-otp-and-signup',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const bodySchema = otpSchema.merge(
        signupSchema.pick({ role: true, firstName: true, lastName: true, email: true }).partial()
      );

      const { phone, code, role, firstName, lastName, email } = bodySchema.parse(request.body);

      try {
        // Verify OTP
        const otpResult = await verifyOTP(phone, code);

        if (!otpResult.success) {
          throw errors.invalidOtp(otpResult.error);
        }

        // Check if user already exists
        let user = await getUserByPhone(phone);
        const isNewUser = !user;

        if (!user) {
          const authId = uuidv4();
          user = await createUser(authId, role ?? 'client', phone, firstName ?? '', lastName ?? '', email);
        }

        if (!user) {
          throw errors.internalError('Failed to create user');
        }

        if (user.suspendedAt) {
          throw errors.accountSuspended(user.suspensionReason);
        }

        const accessToken = tokenService.createAccessToken(user);
        const refreshToken = tokenService.createRefreshToken(user);

        return reply.code(isNewUser ? 201 : 200).send({
          user: {
            id: user.id,
            phone: user.phone,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null,
            email: user.email ?? null,
            role: user.role,
            avatar_url: user.avatarUrl ?? null,
            is_verified: false,
            referral_code: null,
          },
          session: {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: config.JWT_ACCESS_EXPIRES_SECONDS,
          },
        });
      } catch (err) {
        if (err instanceof Error && 'statusCode' in err && 'code' in err) {
          throw err;
        }
        console.error('OTP verification error:', err instanceof Error ? err.message : String(err));
        throw errors.internalError('OTP verification failed');
      }
    }
  );

  /**
   * POST /auth/admin/login
   * Email + password login — admin only, no OTP. Client/driver accounts
   * never have a passwordHash so this path is a dead end for them.
   */
  app.post('/auth/admin/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = adminLoginSchema.parse(request.body);

    const user = await verifyAdminCredentials(email, password);
    if (!user) {
      throw errors.unauthorized();
    }

    const accessToken = tokenService.createAccessToken(user);
    const refreshToken = tokenService.createRefreshToken(user);

    return reply.code(200).send({
      user: {
        id: user.id,
        phone: user.phone,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null,
        email: user.email ?? null,
        role: user.role,
        avatar_url: null,
        is_verified: true,
        referral_code: null,
      },
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: config.JWT_ACCESS_EXPIRES_SECONDS,
      },
    });
  });

  /**
   * PATCH /auth/admin/password
   * Admin rotates their own password — requires the current one.
   */
  app.patch(
    '/auth/admin/password',
    { onRequest: [requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { currentPassword, newPassword } = adminChangePasswordSchema.parse(request.body);
      const userId = (request.user as any).sub;

      await changeAdminPassword(userId, currentPassword, newPassword);

      return reply.code(200).send({ success: true });
    }
  );

  /**
   * GET /auth/me
   * Get current authenticated user
   */
  app.get('/auth/me', { onRequest: [authenticate] }, async (request: FastifyRequest) => {
    const result = await getUserWithProfile((request.user as any).sub);

    if (!result) {
      throw errors.userNotFound();
    }

    const { user, profile } = result;
    const referralCode = (profile as any)?.referralCode ?? null;
    return {
      id: user.id,
      phone: user.phone,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null,
      email: user.email ?? null,
      role: user.role,
      avatar_url: user.avatarUrl ?? null,
      is_verified: (profile as any)?.isVerified ?? false,
      referral_code: referralCode,
      rating_avg: user.role === 'driver'
        ? parseFloat((profile as any)?.ratingAvg ?? '0')
        : null,
      rating_count: user.role === 'driver'
        ? ((profile as any)?.ratingCount ?? 0)
        : null,
    };
  });

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  app.post('/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refresh_token } = request.body as { refresh_token?: string };

    if (!refresh_token) {
      throw errors.validationFailed({ refresh_token: 'Refresh token is required' });
    }

    try {
      // Verify the refresh token
      const payload = tokenService.verifyRefreshToken(refresh_token) as any;

      // Ensure it's actually a refresh token
      if (payload.type !== 'refresh') {
        throw errors.unauthorized();
      }

      // Fetch user to ensure still active
      const userWithProfile = await getUserWithProfile(payload.sub as string);
      if (!userWithProfile) {
        throw errors.userNotFound();
      }
      const user = userWithProfile.user;

      if (user.suspendedAt) {
        throw errors.accountSuspended(user.suspensionReason);
      }

      // Issue new access token
      const accessToken = tokenService.createAccessToken(user);

      return reply.code(200).send({
        access_token: accessToken,
        expires_in: config.JWT_ACCESS_EXPIRES_SECONDS,
      });
    } catch (err) {
      if (err instanceof Error && 'statusCode' in err && 'code' in err) {
        throw err;
      }
      throw errors.unauthorized();
    }
  });

  /**
   * GET /auth/dev/otp/:phone
   * Read OTP from Redis — dev/test backdoor until D7 SMS is live.
   * Protected by X-Dev-Key header matching DEV_OTP_SECRET env var.
   */
  app.get('/auth/dev/otp/:phone', async (request: FastifyRequest, reply: FastifyReply) => {
    const devKey = config.DEV_OTP_SECRET;
    if (!devKey || config.NODE_ENV === 'production') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    }

    const headerKey = (request.headers['x-dev-key'] as string) ?? '';
    const provided = Buffer.from(headerKey);
    const expected = Buffer.from(devKey);
    const valid = provided.length === expected.length && timingSafeEqual(provided, expected);
    if (!valid) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid dev key' } });
    }

    const { phone } = request.params as { phone: string };
    const redis = getRedis();
    const raw = await redis.get(`otp:${phone}`);
    if (!raw) {
      return reply.code(404).send({ error: { code: 'OTP_NOT_FOUND', message: 'No OTP found for this phone' } });
    }

    const stored = JSON.parse(raw) as { code: string; expiresAt: string };
    return reply.code(200).send({ phone, code: stored.code, expiresAt: stored.expiresAt });
  });

  /**
   * PATCH /auth/profile
   * Update authenticated user profile
   */
  app.patch(
    '/auth/profile',
    { onRequest: [authenticate] },
    async (request: FastifyRequest) => {
      const data = profileUpdateSchema.parse(request.body);

      const user = await updateUser((request.user as any).sub, data);

      if (!user) {
        throw errors.userNotFound();
      }

      // The role is a JWT claim (see auth.token.service.ts) — the caller's
      // current access token still carries the pre-change role, so every
      // subsequent request (e.g. driver-only routes right after "Devenir
      // chauffeur") would keep 403'ing until natural token expiry unless a
      // fresh pair is issued here, the same way login does.
      const session = data.role
        ? {
            access_token: tokenService.createAccessToken(user),
            refresh_token: tokenService.createRefreshToken(user),
            expires_in: config.JWT_ACCESS_EXPIRES_SECONDS,
          }
        : undefined;

      return {
        id: user.id,
        phone: user.phone,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null,
        email: user.email ?? null,
        role: user.role,
        avatar_url: user.avatarUrl ?? null,
        is_verified: false,
        referral_code: null,
        ...(session ? { session } : {}),
      };
    }
  );

  /**
   * POST /auth/avatar
   * Upload profile photo → Supabase Storage → update user avatar_url
   */
  app.post(
    '/auth/avatar',
    { onRequest: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any).sub as string;

      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: { code: 'NO_FILE', message: 'No file uploaded' } });
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.code(400).send({ error: { code: 'INVALID_TYPE', message: 'Only JPEG, PNG, and WebP images are allowed' } });
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk as Buffer);
      }
      const buffer = Buffer.concat(chunks);

      if (buffer.byteLength > 5 * 1024 * 1024) {
        return reply.code(400).send({ error: { code: 'FILE_TOO_LARGE', message: 'Image must be under 5MB' } });
      }

      const ext = data.mimetype === 'image/png' ? 'png' : data.mimetype === 'image/webp' ? 'webp' : 'jpg';
      const path = `${userId}/avatar.${ext}`;

      const uploadUrl = `${config.SUPABASE_URL}/storage/v1/object/avatars/${path}`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': data.mimetype,
          'x-upsert': 'true',
        },
        body: buffer,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        app.log.error({ err }, 'Supabase Storage upload failed');
        throw errors.internalError('Avatar upload failed');
      }

      const avatarUrl = `${config.SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
      const user = await updateUser(userId, { avatarUrl });

      if (!user) throw errors.userNotFound();

      return reply.code(200).send({ avatarUrl });
    }
  );
}
