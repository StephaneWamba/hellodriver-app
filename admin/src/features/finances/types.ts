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

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
