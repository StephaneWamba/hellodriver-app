import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/models/wallet_model.dart';

void main() {
  group('WalletModel.fromJson', () {
    test('parses balanceXaf field', () {
      final m = WalletModel.fromJson({'balanceXaf': 15000, 'currency': 'XAF'});
      expect(m.balance, 15000.0);
      expect(m.currency, 'XAF');
    });

    test('falls back to balance field', () {
      final m = WalletModel.fromJson({'balance': 5000});
      expect(m.balance, 5000.0);
      expect(m.currency, 'XAF');
    });

    test('defaults to 0 when no balance field', () {
      final m = WalletModel.fromJson({});
      expect(m.balance, 0.0);
    });
  });

  group('TransactionModel.fromJson', () {
    final baseJson = {
      'id': 'tx-1',
      'type': 'deposit',
      'amount': 5000,
      'status': 'completed',
      'created_at': '2024-01-15T10:30:00.000Z',
    };

    test('parses all base fields', () {
      final tx = TransactionModel.fromJson(baseJson);
      expect(tx.id, 'tx-1');
      expect(tx.type, 'deposit');
      expect(tx.amount, 5000.0);
      expect(tx.status, 'completed');
      expect(tx.createdAt, DateTime.parse('2024-01-15T10:30:00.000Z'));
    });

    test('parses optional description and reference', () {
      final tx = TransactionModel.fromJson({
        ...baseJson,
        'description': 'Rechargement MTN',
        'reference': 'REF-123',
      });
      expect(tx.description, 'Rechargement MTN');
      expect(tx.reference, 'REF-123');
    });

    test('isCredit true for deposit', () {
      final tx = TransactionModel.fromJson({...baseJson, 'type': 'deposit'});
      expect(tx.isCredit, isTrue);
    });

    test('isCredit true for trip_earning', () {
      final tx = TransactionModel.fromJson({...baseJson, 'type': 'trip_earning'});
      expect(tx.isCredit, isTrue);
    });

    test('isCredit true for referral_bonus', () {
      final tx = TransactionModel.fromJson({...baseJson, 'type': 'referral_bonus'});
      expect(tx.isCredit, isTrue);
    });

    test('isCredit false for trip_payment', () {
      final tx = TransactionModel.fromJson({...baseJson, 'type': 'trip_payment'});
      expect(tx.isCredit, isFalse);
    });

    test('isCredit false for withdrawal', () {
      final tx = TransactionModel.fromJson({...baseJson, 'type': 'withdrawal'});
      expect(tx.isCredit, isFalse);
    });
  });
}
