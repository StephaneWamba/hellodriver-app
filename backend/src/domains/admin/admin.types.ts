export interface AdminUserListItem {
  id: string;
  role: 'client' | 'driver' | 'admin';
  phone: string;
  firstName: string;
  lastName: string;
  email: string | null;
  avatarUrl: string | null;
  suspendedAt: string | null;
  createdAt: string;
  walletBalanceXaf: number;
  driverVerificationStatus: 'pending' | 'approved' | 'rejected' | null;
}

export interface AdminUserDetail extends AdminUserListItem {
  suspensionReason: string | null;
  tripCount: number;
  driverProfile: {
    vehicleBrand: string | null;
    vehicleModel: string | null;
    vehicleRegistration: string | null;
    ratingAvg: string | null;
    ratingCount: number;
  } | null;
  recentTrips: Array<{
    id: string;
    status: string;
    finalFareXaf: number | null;
    fareEstimateXaf: number | null;
    createdAt: string;
  }>;
  recentTransactions: Array<{
    id: string;
    type: 'credit' | 'debit';
    amountXaf: number;
    reason: string;
    createdAt: string;
  }>;
}

export interface FinancesOverview {
  totalWalletBalanceXaf: number;
  totalCommissionXaf: number;
  totalDepositsXaf: number;
  totalPayoutsXaf: number;
  todayDepositsXaf: number;
  todayPayoutsXaf: number;
  todayCommissionXaf: number;
  pendingPayoutsCount: number;
  failedPayments24hCount: number;
}

export interface AdminWalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amountXaf: number;
  reason: string;
  balanceAfterXaf: number;
  createdAt: string;
  userId: string;
  userFirstName: string;
  userLastName: string;
  userPhone: string;
}

export interface AdminTripListItem {
  id: string;
  status: string;
  originAddress: string | null;
  destinationAddress: string | null;
  fareEstimateXaf: number | null;
  finalFareXaf: number | null;
  paymentStatus: string;
  createdAt: string;
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  driverId: string | null;
  driverFirstName: string | null;
  driverLastName: string | null;
}

export interface AdminTripDetail extends AdminTripListItem {
  clientPhone: string;
  driverPhone: string | null;
  adminCancellationReason: string | null;
  originLatitude: string;
  originLongitude: string;
  destinationLatitude: string;
  destinationLongitude: string;
  clientRating: number | null;
  clientComment: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  bids: Array<{
    id: string;
    driverId: string;
    driverFirstName: string;
    driverLastName: string;
    amountXaf: number;
    etaMinutes: number;
    status: string;
    createdAt: string;
  }>;
}

export interface AdminPromoCode {
  id: string;
  code: string;
  type: 'fixed_xaf' | 'percentage';
  value: number;
  maxUses: number | null;
  usesCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface ReferralsOverview {
  totalReferrals: number;
  totalRewardsXaf: number;
  referralsLast30Days: number;
  topReferrers: Array<{
    userId: string;
    firstName: string;
    lastName: string;
    phone: string;
    referralCount: number;
  }>;
}

export interface AdminAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
}

export interface AdminLiveDriver {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl: string | null;
  latitude: number;
  longitude: number;
  hasActiveTrip: boolean;
}

export interface AdminPayment {
  id: string;
  type: 'deposit' | 'payout' | 'refund';
  operator: string;
  amountXaf: number;
  status: 'pending' | 'completed' | 'failed';
  failureReason: string | null;
  createdAt: string;
  userId: string;
  userFirstName: string;
  userLastName: string;
  userPhone: string;
}
