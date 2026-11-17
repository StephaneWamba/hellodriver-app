import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  varchar,
  integer,
  date,
  numeric,
  geometry,
  unique,
  smallint,
} from 'drizzle-orm/pg-core';


export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  authId: uuid('auth_id').notNull().unique(),
  role: text('role').notNull(), // 'client' | 'driver' | 'admin'
  phone: varchar('phone', { length: 20 }).unique().notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }),
  avatarUrl: text('avatar_url'),
  // Only ever set for role='admin' — client/driver auth stays phone+OTP,
  // admin auth is classic email+password (no OTP, internal staff tool).
  passwordHash: text('password_hash'),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  suspensionReason: text('suspension_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const clientProfiles = pgTable('client_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique().references(() => users.id),
  phoneVerified: boolean('phone_verified').default(false),
  emailVerified: boolean('email_verified').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const driverProfiles = pgTable('driver_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique().references(() => users.id),

  // Profile info
  dateOfBirth: date('date_of_birth'),
  vehicleBrand: varchar('vehicle_brand', { length: 100 }),
  vehicleYear: integer('vehicle_year'),
  vehicleModel: varchar('vehicle_model', { length: 100 }),
  vehicleRegistration: varchar('vehicle_registration', { length: 50 }),
  residentialArea: varchar('residential_area', { length: 100 }),
  hasAc: boolean('has_ac'),
  mobileMoneyAccount: varchar('mobile_money_account', { length: 20 }), // Airtel or Moov number

  // Verification
  isVerified: boolean('is_verified').default(false),
  verificationStatus: text('verification_status').default('pending'), // 'pending' | 'approved' | 'rejected'
  verifiedAt: timestamp('verified_at', { withTimezone: true }),

  // Ratings (aggregated)
  ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 }).default('0'),
  ratingCount: integer('rating_count').default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const driverDocuments = pgTable('driver_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  documentType: text('document_type').notNull(), // 'drivers_license' | 'id_card' | 'vehicle_insurance'
  storageUrl: varchar('storage_url'), // Supabase Storage public URL
  uploadStatus: text('upload_status').default('pending'), // 'pending' | 'verified' | 'rejected'
  rejectionReason: text('rejection_reason'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedByAdminId: uuid('verified_by_admin_id').references(() => users.id),
});

export const driverVerificationLog = pgTable('driver_verification_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  action: text('action').notNull(), // 'doc_uploaded' | 'doc_approved' | 'doc_rejected' | 'driver_approved' | 'driver_rejected'
  adminId: uuid('admin_id').references(() => users.id),
  details: text('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const driverLocations = pgTable('driver_locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique().references(() => users.id),
  latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
  geom: geometry('geom', { type: 'point', mode: 'xy', srid: 4326 }).notNull(),
  isOnline: boolean('is_online').default(false),
  isAvailable: boolean('is_available').default(false),
  lastHeartbeat: timestamp('last_heartbeat', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const trips = pgTable('trips', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').notNull().references(() => users.id),
  driverId: uuid('driver_id').references(() => users.id), // null until bid accepted

  status: text('status').notNull().default('pending_bids'),
  // 13 states: pending_bids | bid_accepted | driver_en_route | driver_arrived |
  //            in_transit | completed | rated |
  //            cancelled_by_client | cancelled_by_driver |
  //            no_bids | driver_no_show | expired | payment_failed

  originAddress: varchar('origin_address', { length: 255 }),
  originLatitude: numeric('origin_latitude', { precision: 10, scale: 7 }).notNull(),
  originLongitude: numeric('origin_longitude', { precision: 10, scale: 7 }).notNull(),
  originGeom: geometry('origin_geom', { type: 'point', mode: 'xy', srid: 4326 }),

  destinationAddress: varchar('destination_address', { length: 255 }),
  destinationLatitude: numeric('destination_latitude', { precision: 10, scale: 7 }).notNull(),
  destinationLongitude: numeric('destination_longitude', { precision: 10, scale: 7 }).notNull(),
  destinationGeom: geometry('destination_geom', { type: 'point', mode: 'xy', srid: 4326 }),

  fareEstimateXaf: integer('fare_estimate_xaf'),
  finalFareXaf: integer('final_fare_xaf'),

  // Phase 3: payment fields
  tripType: text('trip_type').notNull().default('exclusive'),
  // 'exclusive' | 'shared' — chauffeur_prive and abonnement_mensuel deferred to Phase 6
  paymentStatus: text('payment_status').notNull().default('unpaid'),
  // 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded'

  clientRating: smallint('client_rating'),
  clientComment: text('client_comment'),
  ratedAt: timestamp('rated_at', { withTimezone: true }),

  // Only set when status='cancelled_by_admin' — dispute-resolution audit trail
  adminCancellationReason: text('admin_cancellation_reason'),
  cancelledByAdminId: uuid('cancelled_by_admin_id').references(() => users.id),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const tripBids = pgTable(
  'trip_bids',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tripId: uuid('trip_id').notNull().references(() => trips.id),
    driverId: uuid('driver_id').notNull().references(() => users.id),
    amountXaf: integer('amount_xaf').notNull(),
    etaMinutes: integer('eta_minutes').notNull(),
    status: text('status').notNull().default('pending'),
    // pending | accepted | rejected | expired
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => ({
    // One driver can have at most one bid per trip (enforced at DB level)
    uniqueDriverTrip: unique('trip_bids_trip_id_driver_id_unique').on(
      table.tripId,
      table.driverId,
    ),
  }),
);

export const tripLocationPings = pgTable('trip_location_pings', {
  id: uuid('id').defaultRandom().primaryKey(),
  tripId: uuid('trip_id').notNull(),
  driverId: uuid('driver_id').notNull().references(() => users.id),
  latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
  geom: geometry('geom', { type: 'point', mode: 'xy', srid: 4326 }).notNull(),
  speed: numeric('speed', { precision: 5, scale: 2 }),
  bearing: numeric('bearing', { precision: 5, scale: 2 }),
  accuracy: numeric('accuracy', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Phase 3: Payments, Wallet & Referrals ───────────────────────────────────

export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),              // 'mobile_money' (card deferred to Phase 7)
    operator: text('operator'),               // 'airtel_money' | 'moov_money'
    phoneNumber: varchar('phone_number', { length: 20 }), // E.164 stored (+24177… Airtel, +24167… Moov)
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    // Backstops the application-level "already registered" check against a
    // concurrent double-submit (e.g. a flaky-network client retry) racing
    // past the check-then-insert in payment.service.ts.
    uniqueUserPhone: unique('payment_methods_user_id_phone_number_unique').on(
      table.userId,
      table.phoneNumber,
    ),
  }),
);

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tripId: uuid('trip_id').references(() => trips.id), // null for wallet top-ups without trip
  userId: uuid('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),             // 'deposit' | 'payout' | 'refund'
  pawapayId: uuid('pawapay_id').notNull().unique(), // idempotency key sent to pawaPay
  operator: text('operator').notNull(),     // 'airtel_money' | 'moov_money' | 'hello_money'
  amountXaf: integer('amount_xaf').notNull(),
  status: text('status').notNull().default('pending'),
  // 'pending' | 'completed' | 'failed'
  providerTransactionId: text('provider_transaction_id'), // from pawaPay callback
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const wallets = pgTable('wallets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  balanceXaf: integer('balance_xaf').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const walletTransactions = pgTable('wallet_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),             // 'credit' | 'debit'
  amountXaf: integer('amount_xaf').notNull(), // always positive
  reason: text('reason').notNull(),
  // 'trip_payment' | 'trip_earning' | 'commission' | 'deposit'
  // 'payout' | 'refund' | 'referral_reward' | 'promo_discount' | 'admin_adjustment'
  referenceId: uuid('reference_id'),        // tripId or paymentId
  balanceAfterXaf: integer('balance_after_xaf').notNull(), // snapshot for audit trail
  adminNote: text('admin_note'),            // free-text justification, only set for reason='admin_adjustment'
  createdByAdminId: uuid('created_by_admin_id').references(() => users.id), // only set for reason='admin_adjustment'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  // NEVER update or delete rows — append-only immutable ledger
});

export const promoCodes = pgTable('promo_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  type: text('type').notNull(),             // 'fixed_xaf' | 'percentage'
  value: integer('value').notNull(),        // XAF amount or % integer (0-100)
  maxUses: integer('max_uses'),             // null = unlimited
  usesCount: integer('uses_count').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdByAdminId: uuid('created_by_admin_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const referrals = pgTable('referrals', {
  id: uuid('id').defaultRandom().primaryKey(),
  referrerId: uuid('referrer_id').notNull().references(() => users.id),
  refereeId: uuid('referee_id').notNull().unique().references(() => users.id),
  // unique: one referral per new user
  promoCode: varchar('promo_code', { length: 20 }).notNull(),
  rewardXaf: integer('reward_xaf').notNull().default(4000),
  referrerRewardedAt: timestamp('referrer_rewarded_at', { withTimezone: true }),
  refereeRewardedAt: timestamp('referee_rewarded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
