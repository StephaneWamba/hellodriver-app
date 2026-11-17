class WalletModel {
  const WalletModel({required this.balance, required this.currency});
  final double balance;
  final String currency;

  factory WalletModel.fromJson(Map<String, dynamic> json) => WalletModel(
        balance: (json['balanceXaf'] as num? ?? json['balance'] as num? ?? 0).toDouble(),
        currency: json['currency'] as String? ?? 'XAF',
      );
}

class TransactionModel {
  const TransactionModel({
    required this.id,
    required this.type,
    required this.amount,
    required this.status,
    required this.createdAt,
    this.description,
    this.reference,
  });

  final String id;
  final String type; // 'deposit' | 'withdrawal' | 'trip_payment' | 'trip_earning' | 'referral_bonus'
  final double amount;
  final String status; // 'pending' | 'completed' | 'failed'
  final DateTime createdAt;
  final String? description;
  final String? reference;

  bool get isCredit =>
      type == 'deposit' ||
      type == 'trip_earning' ||
      type == 'referral_reward' ||
      type == 'referral_bonus' ||
      type == 'seed_credit' ||
      type == 'promo_credit';

  factory TransactionModel.fromJson(Map<String, dynamic> json) =>
      TransactionModel(
        id: json['id'] as String? ?? '',
        type: json['type'] as String? ?? 'unknown',
        amount: ((json['amountXaf'] ?? json['amount']) as num?)?.toDouble() ?? 0.0,
        status: json['status'] as String? ?? 'completed',
        createdAt: () {
          final raw = json['createdAt'] ?? json['created_at'];
          if (raw is String) return DateTime.tryParse(raw) ?? DateTime.now();
          return DateTime.now();
        }(),
        description: json['description'] ?? json['reason'] as String?,
        reference: json['reference'] ?? json['referenceId'] as String?,
      );
}
