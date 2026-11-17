import { getDatabase } from '../../db/index.js';
import { driverProfiles, driverDocuments, driverVerificationLog, users } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { errors } from '../../shared/errors/AppError.js';
import { getRedis } from '../../plugins/redis.js';
import { getSignedUrl } from '../storage/storage.service.js';
import type { DriverProfile, DriverDocument, VerificationStatus, DriverProfileWithUser } from './driver.types.js';

/**
 * driverDocuments.storageUrl actually holds a storage PATH (see
 * storage.service.ts uploadFile) — the driver-documents bucket is private,
 * so every read has to exchange that path for a fresh signed URL rather
 * than returning it as-is.
 */
async function withSignedUrls(docs: DriverDocument[]): Promise<DriverDocument[]> {
  return Promise.all(
    docs.map(async (doc) => ({
      ...doc,
      storageUrl: doc.storageUrl ? (await getSignedUrl(doc.storageUrl)) ?? doc.storageUrl : doc.storageUrl,
    }))
  );
}

/**
 * Update driver profile with personal and vehicle information
 */
export async function updateDriverProfile(
  userId: string,
  data: {
    dateOfBirth: string;
    vehicleBrand: string;
    vehicleYear: number;
    vehicleModel: string;
    vehicleRegistration: string;
    residentialArea: string;
    hasAc: boolean;
    mobileMoneyAccount: string;
  }
): Promise<DriverProfile> {
  const db = getDatabase() as any;

  const [driver] = await db
    .update(driverProfiles)
    .set({
      dateOfBirth: data.dateOfBirth,
      vehicleBrand: data.vehicleBrand,
      vehicleYear: data.vehicleYear,
      vehicleModel: data.vehicleModel,
      vehicleRegistration: data.vehicleRegistration,
      residentialArea: data.residentialArea,
      hasAc: data.hasAc,
      mobileMoneyAccount: data.mobileMoneyAccount,
      updatedAt: new Date(),
    })
    .where(eq(driverProfiles.userId, userId))
    .returning();

  if (!driver) {
    throw errors.driverProfileNotFound();
  }

  return driver as DriverProfile;
}

/**
 * Get driver profile
 */
export async function getDriverProfile(userId: string): Promise<DriverProfileWithUser | undefined> {
  const db = getDatabase() as any;

  const rows = await db
    .select({
      profile: driverProfiles,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
    })
    .from(driverProfiles)
    .innerJoin(users, eq(driverProfiles.userId, users.id))
    .where(eq(driverProfiles.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return undefined;

  return {
    ...row.profile,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    avatarUrl: row.avatarUrl,
  } as DriverProfileWithUser;
}

/**
 * Record a document upload in the database
 */
export async function recordDocumentUpload(
  userId: string,
  documentType: string,
  storageUrl: string
) {
  const db = getDatabase() as any;

  // Delete existing document of same type if present
  await db
    .delete(driverDocuments)
    .where(
      and(eq(driverDocuments.userId, userId), eq(driverDocuments.documentType, documentType))
    );

  // Insert new document record
  const [doc] = await db
    .insert(driverDocuments)
    .values({
      id: uuidv4(),
      userId,
      documentType,
      storageUrl,
      uploadStatus: 'pending',
      uploadedAt: new Date(),
    })
    .returning();

  // Log the upload
  await db.insert(driverVerificationLog).values({
    id: uuidv4(),
    userId,
    action: 'doc_uploaded',
    details: `Uploaded ${documentType}`,
    createdAt: new Date(),
  });

  return doc as DriverDocument;
}

/**
 * Get all documents for a driver
 */
export async function getDriverDocuments(userId: string): Promise<DriverDocument[]> {
  const db = getDatabase() as any;

  const docs = await db.query.driverDocuments.findMany({
    where: eq(driverDocuments.userId, userId),
  });

  return withSignedUrls(docs as DriverDocument[]);
}

/**
 * Get verification status for a driver
 */
export async function getVerificationStatus(userId: string): Promise<VerificationStatus> {
  const db = getDatabase() as any;

  const profile = await db.query.driverProfiles.findFirst({
    where: eq(driverProfiles.userId, userId),
  });

  const docs = await db.query.driverDocuments.findMany({
    where: eq(driverDocuments.userId, userId),
  });

  const verifiedDocsCount = docs.filter((doc: any) => doc.uploadStatus === 'verified').length;

  return {
    isVerified: profile?.isVerified || false,
    verificationStatus: (profile?.verificationStatus || 'pending') as 'pending' | 'approved' | 'rejected',
    verifiedAt: profile?.verifiedAt ?? undefined,
    documents: await withSignedUrls(docs as DriverDocument[]),
    verifiedDocsCount,
    totalDocsRequired: 3,
    allDocsVerified: verifiedDocsCount === 3,
  };
}

/**
 * Admin: List all drivers pending verification, joined with the identity
 * fields (name, phone, avatar) the admin UI needs — driverProfiles alone
 * only has the userId, unreadable on its own in a list.
 */
export async function getPendingDrivers(): Promise<DriverProfileWithUser[]> {
  const db = getDatabase() as any;

  const rows = await db
    .select({
      profile: driverProfiles,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
    })
    .from(driverProfiles)
    .innerJoin(users, eq(driverProfiles.userId, users.id))
    .where(eq(driverProfiles.verificationStatus, 'pending'));

  return rows.map((r: any) => ({
    ...r.profile,
    firstName: r.firstName,
    lastName: r.lastName,
    phone: r.phone,
    avatarUrl: r.avatarUrl,
  })) as DriverProfileWithUser[];
}

/**
 * Admin: Approve a single document
 */
export async function approveDocument(docId: string, adminId: string): Promise<DriverDocument> {
  const db = getDatabase() as any;

  const doc = await db.transaction(async (trx: any) => {
    // Update document status
    const [doc] = await trx
      .update(driverDocuments)
      .set({
        uploadStatus: 'verified',
        verifiedAt: new Date(),
        verifiedByAdminId: adminId,
      })
      .where(eq(driverDocuments.id, docId))
      .returning();

    if (!doc) {
      throw errors.documentNotFound();
    }

    // Log action
    await trx.insert(driverVerificationLog).values({
      id: uuidv4(),
      userId: doc.userId,
      action: 'doc_approved' as const,
      adminId,
      details: `Approved ${doc.documentType}`,
      createdAt: new Date(),
    });

    // Check if all 3 docs are now verified
    const allDocs = await trx.query.driverDocuments.findMany({
      where: eq(driverDocuments.userId, doc.userId),
    });

    const verifiedCount = allDocs.filter((d: any) => d.uploadStatus === 'verified').length;

    if (verifiedCount === 3) {
      // All docs approved - mark driver as fully verified
      await trx
        .update(driverProfiles)
        .set({
          isVerified: true,
          verificationStatus: 'approved' as const,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(driverProfiles.userId, doc.userId));

      // Log driver approval
      await trx.insert(driverVerificationLog).values({
        id: uuidv4(),
        userId: doc.userId,
        action: 'driver_approved' as const,
        adminId,
        details: 'All documents verified, driver approved',
        createdAt: new Date(),
      });
    }

    return doc as DriverDocument;
  });

  return (await withSignedUrls([doc]))[0];
}

/**
 * Admin: Reject a document
 */
export async function rejectDocument(
  docId: string,
  adminId: string,
  reason: string
): Promise<DriverDocument> {
  const db = getDatabase() as any;

  const doc = await db.transaction(async (trx: any) => {
    // Update document status
    const [doc] = await trx
      .update(driverDocuments)
      .set({
        uploadStatus: 'rejected',
        rejectionReason: reason,
        verifiedAt: new Date(),
        verifiedByAdminId: adminId,
      })
      .where(eq(driverDocuments.id, docId))
      .returning();

    if (!doc) {
      throw errors.documentNotFound();
    }

    // Log action
    await trx.insert(driverVerificationLog).values({
      id: uuidv4(),
      userId: doc.userId,
      action: 'doc_rejected' as const,
      adminId,
      details: `Rejected ${doc.documentType}: ${reason}`,
      createdAt: new Date(),
    });

    return doc as DriverDocument;
  });

  return (await withSignedUrls([doc]))[0];
}

/**
 * Admin: Manually approve entire driver (bypassing document requirements)
 */
export async function approveDriver(
  userId: string,
  adminId: string,
  notes?: string
): Promise<DriverProfile> {
  const db = getDatabase() as any;

  return db.transaction(async (trx: any) => {
    // Update driver profile
    const [driver] = await trx
      .update(driverProfiles)
      .set({
        isVerified: true,
        verificationStatus: 'approved',
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(driverProfiles.userId, userId))
      .returning();

    if (!driver) {
      throw errors.driverProfileNotFound();
    }

    // Log action
    await trx.insert(driverVerificationLog).values({
      id: uuidv4(),
      userId,
      action: 'driver_approved' as const,
      adminId,
      details: notes || 'Driver manually approved by admin',
      createdAt: new Date(),
    });

    return driver as DriverProfile;
  });
}

/**
 * Admin: Manually reject entire driver
 */
export async function rejectDriver(
  userId: string,
  adminId: string,
  reason: string
): Promise<DriverProfile> {
  const db = getDatabase() as any;

  return db.transaction(async (trx: any) => {
    // Update driver profile
    const [driver] = await trx
      .update(driverProfiles)
      .set({
        isVerified: false,
        verificationStatus: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(driverProfiles.userId, userId))
      .returning();

    if (!driver) {
      throw errors.driverProfileNotFound();
    }

    // Log action
    await trx.insert(driverVerificationLog).values({
      id: uuidv4(),
      userId,
      action: 'driver_rejected' as const,
      adminId,
      details: `Driver rejected: ${reason}`,
      createdAt: new Date(),
    });

    return driver as DriverProfile;
  }).then(async (driver: DriverProfile) => {
    // Evict immediately from the real-time matching pool — without this a
    // driver already online when rejected keeps receiving trip matches
    // until their heartbeat/online TTL naturally expires (up to 24h).
    const redis = getRedis();
    await Promise.all([
      redis.del(`driver:${userId}:online`),
      redis.del(`driver:${userId}:heartbeat`),
      redis.zrem('drivers:locations', userId),
    ]);
    return driver;
  });
}
