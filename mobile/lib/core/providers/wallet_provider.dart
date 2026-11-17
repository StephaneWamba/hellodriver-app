import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/wallet_model.dart';

class WalletState {
  const WalletState({
    this.wallet,
    this.transactions = const [],
    this.isLoading = false,
    this.isDepositing = false,
    this.error,
  });

  final WalletModel? wallet;
  final List<TransactionModel> transactions;
  final bool isLoading;
  final bool isDepositing;
  final String? error;

  WalletState copyWith({
    WalletModel? wallet,
    List<TransactionModel>? transactions,
    bool? isLoading,
    bool? isDepositing,
    String? error,
    bool clearError = false,
  }) =>
      WalletState(
        wallet: wallet ?? this.wallet,
        transactions: transactions ?? this.transactions,
        isLoading: isLoading ?? this.isLoading,
        isDepositing: isDepositing ?? this.isDepositing,
        error: clearError ? null : error ?? this.error,
      );
}

class WalletNotifier extends Notifier<WalletState> {
  bool _disposed = false;

  @override
  WalletState build() {
    ref.onDispose(() => _disposed = true);
    _load();
    return const WalletState(isLoading: true);
  }

  ApiClient get _api => ref.read(apiClientProvider);

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        _api.get<Map<String, dynamic>>('/wallet/balance'),
        // limit=100 (API max) — the driver earnings screen buckets by day
        // over the last 30 days; the previous unset default of 20 silently
        // undercounted "cette semaine" for any driver doing >20 trips/txns.
        _api.get<Map<String, dynamic>>('/wallet/transactions', params: {'limit': 100}),
      ]);
      if (_disposed) return;
      final wallet = WalletModel.fromJson(results[0].data!);
      final txData = results[1].data!;
      final txList = ((txData['transactions'] as List<dynamic>?) ?? [])
          .map((e) => TransactionModel.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(wallet: wallet, transactions: txList, isLoading: false);
    } catch (e) {
      if (_disposed) return;
      state = state.copyWith(isLoading: false, error: _extractError(e));
    }
  }

  Future<void> refresh() => _load();

  Future<void> deposit({
    required String paymentMethodId,
    required int amountXaf,
  }) async {
    state = state.copyWith(isDepositing: true, clearError: true);
    try {
      await _api.post<dynamic>('/wallet/deposit', data: {
        'paymentMethodId': paymentMethodId,
        'amountXaf': amountXaf,
      });
      state = state.copyWith(isDepositing: false);
      await _load();
    } catch (e) {
      state = state.copyWith(isDepositing: false, error: _extractError(e));
      rethrow;
    }
  }

  String _extractError(Object e) {
    try {
      // ignore: avoid_dynamic_calls
      final msg = (e as dynamic).response?.data?['message'];
      if (msg is String) return msg;
    } catch (_) {}
    return 'Une erreur est survenue';
  }
}

final walletProvider = NotifierProvider<WalletNotifier, WalletState>(WalletNotifier.new);
