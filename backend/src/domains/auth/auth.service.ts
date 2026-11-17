import { getDatabase } from '../../db/index.js';
import { users, clientProfiles, driverProfiles } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { errors } from '../../shared/errors/AppError.js';
import type { User, DriverProfile, ClientProfile } from './auth.types.js';

const BCRYPT_ROUNDS = 12;

/**
 * Create a new user with role-specific profile
 * Handles race condition: if phone already exists, returns existing user instead of erroring
 * Uses database transaction to ensure atomic user + profile creation
 */
export async function createUser(
  authId: string,
  role: 'client' | 'driver' | 'admin',
  phone: string,
  firstName: string,
  lastName: string,
  email?: string
): Promise<User> {
  const db = getDatabase() as any;

  try {
    return await db.transaction(async (tx: any) => {
      const [user] = await tx
        .insert(users)
        .values({
          authId,
          role,
          phone,
          firstName,
          lastName,
          email,
        })
        .returning();

      if (!user) {
        throw errors.internalError('Failed to create user');
      }

      // Create role-specific profile (skip for admin users)
      if (role === 'client') {
        await tx.insert(clientProfiles).values({
          userId: user.id,
          phoneVerified: true,
        });
      } else if (role === 'driver') {
        await tx.insert(driverProfiles).values({
          userId: user.id,
        });
      }
      // 'admin' role does not get a profile

      return {
        id: user.id,
        authId: user.authId,
        role: user.role as 'client' | 'driver' | 'admin',
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email || undefined,
        createdAt: user.createdAt || new Date(),
        updatedAt: user.updatedAt || new Date(),
      } as User;
    });
  } catch (err) {
    // Handle race condition: if phone already exists due to concurrent request,
    // fetch and return the existing user instead of failing
    if (err instanceof Error && 'code' in err && (err as any).code === '23505') {
      // PostgreSQL unique constraint violation error code
      const existingUser = await getUserByPhone(phone);
      if (existingUser) {
        return existingUser;
      }
    }
    throw err;
  }
}

/**
 * Get user by authId
 */
export async function getUser(authId: string): Promise<User | undefined> {
  const db = getDatabase() as any;

  const user = await db.query.users.findFirst({
    where: eq(users.authId, authId),
  });

  if (!user) return undefined;

  return {
    id: user.id,
    authId: user.authId,
    role: user.role as 'client' | 'driver' | 'admin',
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email || undefined,
    suspendedAt: user.suspendedAt || null,
    suspensionReason: user.suspensionReason || null,
    createdAt: user.createdAt || new Date(),
    updatedAt: user.updatedAt || new Date(),
  } as User;
}

/**
 * Get user with role-specific profile by userId
 */
export async function getUserWithProfile(userId: string) {
  const db = getDatabase() as any;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) return null;

  const userTyped: User = {
    id: user.id,
    authId: user.authId,
    role: user.role as 'client' | 'driver' | 'admin',
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email || undefined,
    avatarUrl: user.avatarUrl || undefined,
    suspendedAt: user.suspendedAt || null,
    suspensionReason: user.suspensionReason || null,
    createdAt: user.createdAt || new Date(),
    updatedAt: user.updatedAt || new Date(),
  };

  if (user.role === 'client') {
    const profile = await db.query.clientProfiles.findFirst({
      where: eq(clientProfiles.userId, user.id),
    });
    return { user: userTyped, profile, profileType: 'client' as const };
  } else if (user.role === 'driver') {
    const profile = await db.query.driverProfiles.findFirst({
      where: eq(driverProfiles.userId, user.id),
    });
    return { user: userTyped, profile, profileType: 'driver' as const };
  } else {
    // admin user - no profile
    return { user: userTyped, profile: null, profileType: 'admin' as const };
  }
}

/**
 * Update user profile fields by userId.
 * When `role` is included, also ensures the matching role-specific profile
 * row exists (a user picking their role for the first time after signup —
 * see RoleScreen in the mobile app — only has the 'client' profile created
 * by createUser's default; switching to 'driver' needs its own row).
 */
export async function updateUser(
  userId: string,
  updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
    avatarUrl?: string;
    role?: 'client' | 'driver';
  }
) {
  const db = getDatabase() as any;
  const { role, ...fields } = updates;

  return db.transaction(async (tx: any) => {
    const [updated] = await tx
      .update(users)
      .set({ ...fields, ...(role ? { role } : {}), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (role === 'client') {
      await tx.insert(clientProfiles).values({ userId, phoneVerified: true }).onConflictDoNothing();
    } else if (role === 'driver') {
      await tx.insert(driverProfiles).values({ userId }).onConflictDoNothing();
    }

    return updated;
  });
}

/**
 * Check if phone already exists
 */
export async function phoneExists(phone: string): Promise<boolean> {
  const db = getDatabase() as any;

  const user = await db.query.users.findFirst({
    where: eq(users.phone, phone),
  });

  return !!user;
}

/**
 * Get user by phone number
 */
export async function getUserByPhone(phone: string): Promise<User | undefined> {
  const db = getDatabase() as any;

  const user = await db.query.users.findFirst({
    where: eq(users.phone, phone),
  });

  if (!user) return undefined;

  return {
    id: user.id,
    authId: user.authId,
    role: user.role as 'client' | 'driver' | 'admin',
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email || undefined,
    suspendedAt: user.suspendedAt || null,
    suspensionReason: user.suspensionReason || null,
    createdAt: user.createdAt || new Date(),
    updatedAt: user.updatedAt || new Date(),
  } as User;
}

/**
 * Verify admin email+password credentials. Only role='admin' accounts can
 * ever have a passwordHash — client/driver auth stays phone+OTP only, this
 * path is unreachable for them regardless of what's submitted.
 */
export async function verifyAdminCredentials(email: string, password: string): Promise<User | null> {
  const db = getDatabase() as any;

  const user = await db.query.users.findFirst({
    where: and(eq(users.email, email), eq(users.role, 'admin')),
  });

  if (!user?.passwordHash) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return {
    id: user.id,
    authId: user.authId,
    role: 'admin',
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email || undefined,
    createdAt: user.createdAt || new Date(),
    updatedAt: user.updatedAt || new Date(),
  } as User;
}

/**
 * Change an admin's own password — requires the current password.
 */
export async function changeAdminPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const db = getDatabase() as any;

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.passwordHash) throw errors.unauthorized();

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw errors.unauthorized();

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, userId));
}
