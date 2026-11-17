import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/models/wallet_model.dart';
import '../../core/providers/app_mode_provider.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/wallet_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/driver_colors.dart';
import '../../core/api/api_client.dart';
import '../../shared/widgets/hd_button.dart';
import '../../shared/widgets/hd_card.dart';
import 'add_payment_method_screen.dart';

class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(walletProvider);
    final user = ref.watch(authProvider).user;
    final mode = ref.watch(appModeProvider);
    final isDriverMode = mode == AppMode.driver;
    final primary = isDriverMode ? DriverColors.primary : AppColors.primary;

    return Scaffold(
      backgroundColor: AppColors.greyLight,
      body: RefreshIndicator(
        color: primary,
        onRefresh: () => ref.read(walletProvider.notifier).refresh(),
        child: CustomScrollView(
          slivers: [
            _WalletAppBar(
              balance: state.wallet?.balance,
              isLoading: state.isLoading,
              isDriverMode: isDriverMode,
            ),
            if (!isDriverMode)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: HdButton(
                    label: 'Recharger mon portefeuille',
                    icon: const Icon(Icons.add_rounded, color: AppColors.white),
                    onPressed: () => _showDepositSheet(context, ref, user?.phone ?? ''),
                  ),
                ),
              ),
            if (isDriverMode)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: HdButton(
                    label: 'Retirer mes gains',
                    icon: const Icon(Icons.account_balance_rounded, color: AppColors.white),
                    accentColor: DriverColors.primary,
                    onPressed: () => _showPayoutSheet(context, ref, user?.phone ?? ''),
                  ),
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: HdButton(
                  label: 'Ajouter un moyen de paiement',
                  variant: HdButtonVariant.outline,
                  accentColor: primary,
                  height: 44,
                  onPressed: () => _openAddPaymentMethod(context),
                ),
              ),
            ),
            if (state.error != null)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(state.error!,
                      style: AppTextStyles.body.copyWith(color: AppColors.error)),
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text('Historique', style: AppTextStyles.h3),
              ),
            ),
            if (state.isLoading)
              const SliverFillRemaining(
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              )
            else if (state.transactions.isEmpty)
              const SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.receipt_long_rounded, color: AppColors.greyBorder, size: 56),
                      SizedBox(height: 12),
                      Text('Aucune transaction', style: AppTextStyles.body),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                sliver: SliverList.separated(
                  itemCount: state.transactions.length,
                  separatorBuilder: (context, i) => const SizedBox(height: 8),
                  itemBuilder: (context, i) => _TransactionTile(state.transactions[i]),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showDepositSheet(BuildContext context, WidgetRef ref, String phone) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _DepositSheet(phone: phone),
    );
  }

  void _showPayoutSheet(BuildContext context, WidgetRef ref, String phone) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      // Bottom sheets are inserted at the root Navigator/Overlay, above any
      // Theme wrapper this screen sets locally — re-apply the driver theme
      // here so unthemed fields (e.g. the amount TextFormField) turn blue.
      builder: (_) => Theme(data: AppTheme.driver, child: _PayoutSheet(phone: phone)),
    );
  }

  Future<void> _openAddPaymentMethod(BuildContext context) async {
    await Navigator.of(context).push(
      MaterialPageRoute<bool>(builder: (_) => const AddPaymentMethodScreen()),
    );
  }
}

class _WalletAppBar extends StatelessWidget {
  const _WalletAppBar({
    required this.balance,
    required this.isLoading,
    required this.isDriverMode,
  });
  final double? balance;
  final bool isLoading;
  final bool isDriverMode;

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 200,
      pinned: true,
      backgroundColor:
          isDriverMode ? DriverColors.primary : AppColors.primary,
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: BoxDecoration(
            gradient: isDriverMode
                ? DriverColors.primaryGradient
                : AppColors.primaryGradient,
          ),
          padding: const EdgeInsets.fromLTRB(24, 80, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text(
                'Mon portefeuille',
                style: AppTextStyles.body.copyWith(
                    color: AppColors.white.withValues(alpha: 0.8)),
              ),
              const SizedBox(height: 4),
              isLoading
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                          color: AppColors.white, strokeWidth: 2),
                    )
                  : Text(
                      balance != null
                          ? '${NumberFormat('#,###', 'fr_FR').format(balance!.toInt())} XAF'
                          : '— XAF',
                      style: AppTextStyles.priceLarge
                          .copyWith(color: AppColors.white, fontSize: 36),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NoPaymentMethodPrompt extends StatelessWidget {
  const _NoPaymentMethodPrompt({required this.onAdded});
  final VoidCallback onAdded;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GestureDetector(
        onTap: () async {
          final added = await Navigator.of(context).push<bool>(
            MaterialPageRoute<bool>(builder: (_) => const AddPaymentMethodScreen()),
          );
          if (added == true) onAdded();
        },
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.greyLight,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              const Icon(Icons.add_circle_outline_rounded, color: AppColors.primary, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Aucun moyen de paiement — appuyez pour en ajouter un',
                  style: AppTextStyles.caption.copyWith(color: AppColors.primary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  const _TransactionTile(this.tx);
  final TransactionModel tx;

  @override
  Widget build(BuildContext context) {
    final isCredit = tx.isCredit;
    final failed = tx.status == 'failed';

    return HdCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: failed
                  ? AppColors.error.withValues(alpha: 0.1)
                  : isCredit
                      ? AppColors.primary.withValues(alpha: 0.1)
                      : AppColors.secondary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              _icon,
              color: failed
                  ? AppColors.error
                  : isCredit
                      ? AppColors.primary
                      : AppColors.secondary,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_label, style: AppTextStyles.bodyMedium),
                const SizedBox(height: 2),
                Text(
                  DateFormat('dd MMM yyyy · HH:mm', 'fr_FR').format(tx.createdAt.toLocal()),
                  style: AppTextStyles.caption,
                ),
                if (tx.status == 'pending')
                  Text('En attente',
                      style: AppTextStyles.caption
                          .copyWith(color: AppColors.warning)),
                if (failed)
                  Text('Échoué',
                      style:
                          AppTextStyles.caption.copyWith(color: AppColors.error)),
              ],
            ),
          ),
          Text(
            '${isCredit ? '+' : '-'}${NumberFormat('#,###', 'fr_FR').format(tx.amount.toInt())} XAF',
            style: AppTextStyles.bodySemiBold.copyWith(
              color: failed
                  ? AppColors.grey
                  : isCredit
                      ? AppColors.primary
                      : AppColors.dark,
            ),
          ),
        ],
      ),
    );
  }

  IconData get _icon => switch (tx.type) {
        'deposit' => Icons.arrow_downward_rounded,
        'withdrawal' => Icons.arrow_upward_rounded,
        'trip_payment' => Icons.directions_car_rounded,
        'trip_earning' => Icons.monetization_on_rounded,
        'referral_bonus' || 'referral_reward' => Icons.card_giftcard_rounded,
        'seed_credit' || 'promo_credit' => Icons.savings_rounded,
        _ => Icons.swap_horiz_rounded,
      };

  String get _label => switch (tx.type) {
        'deposit' => 'Rechargement',
        'withdrawal' => 'Retrait',
        'trip_payment' => 'Paiement course',
        'trip_earning' => 'Gain course',
        'referral_bonus' || 'referral_reward' => 'Bonus parrainage',
        'seed_credit' => 'Crédit de bienvenue',
        'promo_credit' => 'Crédit promotionnel',
        _ => tx.description ?? 'Transaction',
      };
}

class _DepositSheet extends ConsumerStatefulWidget {
  const _DepositSheet({required this.phone});
  final String phone;

  @override
  ConsumerState<_DepositSheet> createState() => _DepositSheetState();
}

class _DepositSheetState extends ConsumerState<_DepositSheet> {
  final _amountCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  static const _presets = [1000, 2000, 5000, 10000, 20000];

  List<Map<String, dynamic>> _paymentMethods = [];
  String? _selectedMethodId;
  bool _loadingMethods = true;

  @override
  void initState() {
    super.initState();
    _loadPaymentMethods();
  }

  Future<void> _loadPaymentMethods() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get<List<dynamic>>('/payments/methods');
      final methods = (res.data ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      if (mounted) {
        setState(() {
          _paymentMethods = methods;
          _selectedMethodId = methods.isNotEmpty
              ? (methods.firstWhere(
                      (m) => m['isDefault'] == true,
                      orElse: () => methods.first)['id'] as String?)
              : null;
          _loadingMethods = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingMethods = false);
    }
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedMethodId == null) return;
    final amount = int.tryParse(_amountCtrl.text.replaceAll(' ', '')) ?? 0;
    try {
      await ref.read(walletProvider.notifier).deposit(
            paymentMethodId: _selectedMethodId!,
            amountXaf: amount,
          );
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Demande de rechargement envoyée'),
            backgroundColor: AppColors.primary,
          ),
        );
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final isLoading = ref.watch(walletProvider).isDepositing;
    final error = ref.watch(walletProvider).error;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 24 + bottom),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                  color: AppColors.greyBorder,
                  borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(height: 16),
            Text('Recharger via Mobile Money', style: AppTextStyles.h3),
            const SizedBox(height: 4),
            Text(widget.phone,
                style: AppTextStyles.body.copyWith(color: AppColors.grey)),
            const SizedBox(height: 20),
            // Payment method selector
            if (_loadingMethods)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        color: AppColors.primary, strokeWidth: 2),
                  ),
                ),
              )
            else if (_paymentMethods.isEmpty)
              _NoPaymentMethodPrompt(onAdded: _loadPaymentMethods)
            else ...[
              Text('Méthode de paiement', style: AppTextStyles.caption.copyWith(color: AppColors.grey)),
              const SizedBox(height: 8),
              ...(_paymentMethods.map((m) {
                final id = m['id'] as String? ?? '';
                final label = m['label'] as String? ??
                    m['provider'] as String? ??
                    m['phone'] as String? ??
                    'Mobile Money';
                final selected = _selectedMethodId == id;
                return InkWell(
                  onTap: () => setState(() => _selectedMethodId = id),
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        Icon(
                          selected
                              ? Icons.radio_button_checked_rounded
                              : Icons.radio_button_unchecked_rounded,
                          color: selected ? AppColors.primary : AppColors.greyBorder,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(label, style: AppTextStyles.body),
                      ],
                    ),
                  ),
                );
              })),
              const SizedBox(height: 8),
            ],
            // Preset amounts
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _presets.map((v) => ActionChip(
                label: Text('${NumberFormat('#,###', 'fr_FR').format(v)} XAF',
                    style: AppTextStyles.caption),
                backgroundColor: AppColors.greyLight,
                side: BorderSide.none,
                onPressed: () => _amountCtrl.text = v.toString(),
              )).toList(),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _amountCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Montant (XAF)',
                suffixText: 'XAF',
              ),
              validator: (v) {
                final n = double.tryParse(v?.replaceAll(' ', '') ?? '');
                if (n == null || n <= 0) return 'Montant invalide';
                if (n < 500) return 'Minimum 500 XAF';
                return null;
              },
            ),
            if (error != null) ...[
              const SizedBox(height: 8),
              Text(error,
                  style: AppTextStyles.caption.copyWith(color: AppColors.error)),
            ],
            const SizedBox(height: 20),
            HdButton(
              label: 'Valider le rechargement',
              isLoading: isLoading,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Payout Sheet ─────────────────────────────────────────────────────────────

class _PayoutSheet extends ConsumerStatefulWidget {
  const _PayoutSheet({required this.phone});
  final String phone;

  @override
  ConsumerState<_PayoutSheet> createState() => _PayoutSheetState();
}

class _PayoutSheetState extends ConsumerState<_PayoutSheet> {
  final _amountCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _submitting = false;
  String? _error;

  List<Map<String, dynamic>> _paymentMethods = [];
  String? _selectedMethodId;
  bool _loadingMethods = true;

  static const _presets = [5000, 10000, 25000, 50000];

  @override
  void initState() {
    super.initState();
    _loadPaymentMethods();
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadPaymentMethods() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get<List<dynamic>>('/payments/methods');
      final methods = (res.data ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      if (mounted) {
        setState(() {
          _paymentMethods = methods;
          _selectedMethodId = methods.isNotEmpty
              ? (methods.firstWhere(
                      (m) => m['isDefault'] == true,
                      orElse: () => methods.first)['id'] as String?)
              : null;
          _loadingMethods = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingMethods = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _selectedMethodId == null) return;
    final amount = int.tryParse(_amountCtrl.text.replaceAll(' ', '')) ?? 0;
    setState(() { _submitting = true; _error = null; });
    try {
      final api = ref.read(apiClientProvider);
      await api.post<void>(
        '/drivers/payout',
        data: {'amountXaf': amount, 'paymentMethodId': _selectedMethodId},
      );
      if (!mounted) return;
      await ref.read(walletProvider.notifier).refresh();
      if (!mounted) return;
      final nav = Navigator.of(context);
      final messenger = ScaffoldMessenger.of(context);
      nav.pop();
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Demande de retrait envoyée'),
          backgroundColor: DriverColors.primary,
        ),
      );
    } on DioException catch (e) {
      final msg = e.response?.data?['error']?['message'] ?? 'Erreur inattendue';
      if (mounted) setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 24 + bottom),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                  color: AppColors.greyBorder,
                  borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(height: 16),
            Text('Retirer mes gains', style: AppTextStyles.h3),
            const SizedBox(height: 4),
            Text('Vers votre Mobile Money',
                style: AppTextStyles.body.copyWith(color: AppColors.grey)),
            const SizedBox(height: 20),
            if (_loadingMethods)
              const Center(child: CircularProgressIndicator(color: DriverColors.primary, strokeWidth: 2))
            else if (_paymentMethods.isEmpty)
              _NoPaymentMethodPrompt(onAdded: _loadPaymentMethods)
            else ...[
              Text('Compte destinataire',
                  style: AppTextStyles.caption.copyWith(color: AppColors.grey)),
              const SizedBox(height: 8),
              ...(_paymentMethods.map((m) {
                final id = m['id'] as String? ?? '';
                final label = m['label'] as String? ??
                    m['provider'] as String? ??
                    m['phone'] as String? ??
                    'Mobile Money';
                final selected = _selectedMethodId == id;
                return InkWell(
                  onTap: () => setState(() => _selectedMethodId = id),
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        Icon(
                          selected
                              ? Icons.radio_button_checked_rounded
                              : Icons.radio_button_unchecked_rounded,
                          color: selected ? DriverColors.primary : AppColors.greyBorder,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(label, style: AppTextStyles.body),
                      ],
                    ),
                  ),
                );
              })),
              const SizedBox(height: 12),
            ],
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _presets.map((v) => ActionChip(
                label: Text('${NumberFormat('#,###', 'fr_FR').format(v)} XAF',
                    style: AppTextStyles.caption),
                backgroundColor: DriverColors.primaryLight,
                side: BorderSide.none,
                onPressed: () => _amountCtrl.text = v.toString(),
              )).toList(),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _amountCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Montant à retirer (XAF)',
                suffixText: 'XAF',
              ),
              validator: (v) {
                final n = double.tryParse(v?.replaceAll(' ', '') ?? '');
                if (n == null || n <= 0) return 'Montant invalide';
                if (n < 1000) return 'Minimum 1 000 XAF';
                return null;
              },
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!,
                  style: AppTextStyles.caption.copyWith(color: AppColors.error)),
            ],
            const SizedBox(height: 20),
            HdButton(
              label: 'Valider le retrait',
              accentColor: DriverColors.primary,
              isLoading: _submitting,
              onPressed: _selectedMethodId != null ? _submit : null,
            ),
          ],
        ),
      ),
    );
  }
}
