export interface Wallet {
  id: string;
  userId: string;
  balanceXaf: number;
  updatedAt: Date;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  userId: string;
  type: 'credit' | 'debit';
  amountXaf: number;
  reason: WalletTransactionReason;
  referenceId: string | null;
  balanceAfterXaf: number;
  createdAt: Date;
}

export type WalletTransactionReason =
  | 'trip_payment'
  | 'trip_earning'
  | 'commission'
  | 'deposit'
  | 'payout'
  | 'refund'
  | 'referral_reward'
  | 'promo_discount'
  | 'admin_adjustment';
