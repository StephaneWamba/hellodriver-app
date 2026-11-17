export type UserRole = 'client' | 'driver' | 'admin';
export type DriverVerificationStatus = 'pending' | 'approved' | 'rejected';

export interface AdminUserListItem {
  id: string;
  role: UserRole;
  phone: string;
  firstName: string;
  lastName: string;
  email: string | null;
  avatarUrl: string | null;
  suspendedAt: string | null;
  createdAt: string;
  walletBalanceXaf: number;
  driverVerificationStatus: DriverVerificationStatus | null;
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

export interface ListUsersResponse {
  data: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
}
