/**
 * Standard application error with HTTP status and error code
 */

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * Predefined error factories
 */

export const errors = {
  // Auth errors
  invalidOtp: (message = 'Invalid or expired OTP') =>
    new AppError('INVALID_OTP', message, 400),

  otpSendFailed: (message = 'Failed to send OTP') =>
    new AppError('OTP_SEND_FAILED', message, 500),

  userNotFound: () =>
    new AppError('USER_NOT_FOUND', 'User not found', 404),

  unauthorized: () =>
    new AppError('UNAUTHORIZED', 'Unauthorized', 401),

  accountSuspended: (reason?: string | null) =>
    new AppError('ACCOUNT_SUSPENDED', reason || 'Ce compte a été suspendu', 403),

  // Driver errors
  driverProfileNotFound: () =>
    new AppError('DRIVER_PROFILE_NOT_FOUND', 'Driver profile not found', 404),

  driverNotVerified: () =>
    new AppError('DRIVER_NOT_VERIFIED', 'Driver is not verified and cannot go online', 403),

  driverNotOnline: () =>
    new AppError('DRIVER_NOT_ONLINE', 'Driver must go online before sending location updates', 403),

  documentUploadFailed: (message = 'Document upload failed') =>
    new AppError('DOCUMENT_UPLOAD_FAILED', message, 500),

  allDocumentsRequired: () =>
    new AppError(
      'ALL_DOCUMENTS_REQUIRED',
      'All 3 documents (license, ID, insurance) are required',
      400
    ),

  // Admin errors
  accessDenied: () =>
    new AppError('ACCESS_DENIED', 'You do not have permission to access this resource', 403),

  documentNotFound: () =>
    new AppError('DOCUMENT_NOT_FOUND', 'Document not found', 404),

  // Validation errors
  validationFailed: (details: Record<string, any>) =>
    new AppError('VALIDATION_FAILED', 'Validation failed', 400, details),

  // Generic errors
  internalError: (message = 'Internal server error') =>
    new AppError('INTERNAL_ERROR', message, 500),

  notFound: (resource: string) =>
    new AppError('NOT_FOUND', `${resource} not found`, 404),

  conflict: (message: string) =>
    new AppError('CONFLICT', message, 409),

  // Payment & wallet errors
  insufficientBalance: () =>
    new AppError('INSUFFICIENT_BALANCE', 'Solde Hello Money insuffisant', 402),

  paymentFailed: (reason: string) =>
    new AppError('PAYMENT_FAILED', reason, 402),

  paymentMethodNotFound: () =>
    new AppError('PAYMENT_METHOD_NOT_FOUND', 'Moyen de paiement introuvable', 404),

  invalidPromoCode: () =>
    new AppError('INVALID_PROMO_CODE', 'Code promo invalide ou expiré', 400),

  promoCodeExpired: () =>
    new AppError('PROMO_CODE_EXPIRED', 'Code promo expiré', 400),

  // Trip errors
  tripNotFound: () =>
    new AppError('TRIP_NOT_FOUND', 'Trip not found', 404),

  tripNoLongerAcceptingBids: () =>
    new AppError('TRIP_NO_LONGER_ACCEPTING_BIDS', 'Trip no longer accepting bids', 409),

  tripExpired: () =>
    new AppError('TRIP_EXPIRED', 'Trip has expired', 400),

  driverAlreadyBid: () =>
    new AppError('CONFLICT', 'You have already submitted a bid for this trip', 409),

  driverHasActiveTrip: () =>
    new AppError('DRIVER_HAS_ACTIVE_TRIP', 'You already have an active trip in progress', 400),

  clientHasActiveTrip: () =>
    new AppError('CLIENT_HAS_ACTIVE_TRIP', 'You already have an active trip in progress', 400),

  bidNotFound: () =>
    new AppError('BID_NOT_FOUND', 'Bid not found or has expired', 404),

  invalidTripTransition: (from: string, to: string) =>
    new AppError('BAD_REQUEST', `Cannot transition trip from ${from} to ${to}`, 400),

  tripAccessDenied: () =>
    new AppError('FORBIDDEN', 'You do not have access to this trip', 403),
};
