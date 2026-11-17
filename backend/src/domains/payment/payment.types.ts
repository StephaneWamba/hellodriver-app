export interface PaymentMethod {
  id: string;
  userId: string;
  type: 'mobile_money';
  operator: 'airtel_money' | 'moov_money' | null;
  phoneNumber: string | null;
  isDefault: boolean;
  createdAt: Date;
}

export interface Payment {
  id: string;
  tripId: string | null;
  userId: string;
  type: 'deposit' | 'payout' | 'refund';
  pawapayId: string;
  operator: string;
  amountXaf: number;
  status: 'pending' | 'completed' | 'failed';
  providerTransactionId: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Gabon pawaPay operator codes
export type PawapayOperator = 'AIRTEL_GAB' | 'MOOV_GAB';

export interface PawapayDepositRequest {
  depositId: string;
  payer: {
    type: 'MMO';
    accountDetails: {
      phoneNumber: string; // MSISDN — no + prefix, digits only
      provider: PawapayOperator;
    };
  };
  amount: string;  // XAF integer as string
  currency: 'XAF';
  customerMessage: string;
}

export interface PawapayPayoutRequest {
  payoutId: string;
  recipient: {
    type: 'MMO';
    accountDetails: {
      phoneNumber: string;
      provider: PawapayOperator;
    };
  };
  amount: string;
  currency: 'XAF';
  customerMessage: string;
}

export type PawapayDepositStatus = 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_IGNORED';
export type PawapayCallbackStatus = 'COMPLETED' | 'FAILED';

export interface PawapayCallbackPayload {
  depositId?: string;
  payoutId?: string;
  status: PawapayCallbackStatus;
  amount: string;
  currency: string;
  providerTransactionId?: string;
  failureReason?: { failureCode: string; failureMessage: string };
}
