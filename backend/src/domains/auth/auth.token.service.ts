import { config } from '../../core/config.js';
import type { User, JwtPayload } from './auth.types.js';

/**
 * Token service factory.
 * Takes the Fastify JWT plugin instance so signing/verification stays in one place.
 * All payload shapes and expiry values are defined here — never inline in routes.
 */
export function createTokenService(jwt: {
  sign(payload: object, options?: { expiresIn?: string }): string;
  verify(token: string): JwtPayload;
}) {
  function accessPayload(user: User): Omit<JwtPayload, 'iat' | 'exp'> {
    return { sub: user.id, role: user.role, phone: user.phone, type: 'access' };
  }

  function refreshPayload(user: User): Omit<JwtPayload, 'iat' | 'exp'> {
    return { sub: user.id, role: user.role, phone: user.phone, type: 'refresh' };
  }

  return {
    createAccessToken(user: User): string {
      return jwt.sign(accessPayload(user), { expiresIn: config.JWT_ACCESS_EXPIRES_IN });
    },

    createRefreshToken(user: User): string {
      return jwt.sign(refreshPayload(user), { expiresIn: config.JWT_REFRESH_EXPIRES_IN });
    },

    verifyRefreshToken(token: string): JwtPayload {
      return jwt.verify(token);
    },
  };
}

export type TokenService = ReturnType<typeof createTokenService>;
