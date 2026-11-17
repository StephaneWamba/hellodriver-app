import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/wallet_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../wallet/add_payment_method_screen.dart';

/// Lets the client pick how to pay for a bid: Hello Money wallet balance
/// (if sufficient) or a saved mobile money number (pawaPay direct charge).
class PaymentMethodPickerSheet extends ConsumerStatefulWidget {
  const PaymentMethodPickerSheet({super.key, required this.fareXaf});
  final int fareXaf;

  static const walletChoice = '__wallet__';

  @override
  ConsumerState<PaymentMethodPickerSheet> createState() => _PaymentMethodPickerSheetState();
}

class _PaymentMethodPickerSheetState extends ConsumerState<PaymentMethodPickerSheet> {
  List<Map<String, dynamic>> _methods = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ref.read(apiClientProvider).get<List<dynamic>>('/payments/methods');
      if (!mounted) return;
      setState(() {
        _methods = (res.data ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final balance = ref.watch(walletProvider).wallet?.balance ?? 0;
    final canUseWallet = balance >= widget.fareXaf;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(color: AppColors.greyBorder, borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 16),
          Text('Comment payez-vous ?', style: AppTextStyles.h3),
          Text('${widget.fareXaf} XAF', style: AppTextStyles.body.copyWith(color: AppColors.grey)),
          const SizedBox(height: 16),

          // Wallet option
          _PaymentOption(
            icon: Iconsax.wallet_copy,
            title: 'Solde HelloDriver',
            subtitle: canUseWallet ? '$balance XAF disponibles' : 'Solde insuffisant ($balance XAF)',
            enabled: canUseWallet,
            onTap: () => Navigator.of(context).pop(PaymentMethodPickerSheet.walletChoice),
          ),
          const SizedBox(height: 8),

          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else ...[
            ..._methods.map((m) {
              final id = m['id'] as String? ?? '';
              final phone = m['phoneNumber'] as String? ?? m['phone'] as String? ?? 'Mobile Money';
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _PaymentOption(
                  icon: Iconsax.call_copy,
                  title: phone,
                  subtitle: 'Paiement Mobile Money',
                  enabled: true,
                  onTap: () => Navigator.of(context).pop(id),
                ),
              );
            }),
            _PaymentOption(
              icon: Iconsax.add_circle_copy,
              title: 'Ajouter un numéro Mobile Money',
              subtitle: null,
              enabled: true,
              onTap: () async {
                final added = await Navigator.of(context).push<bool>(
                  MaterialPageRoute<bool>(builder: (_) => const AddPaymentMethodScreen()),
                );
                if (added == true) await _load();
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _PaymentOption extends StatelessWidget {
  const _PaymentOption({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.greyLight,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.greyBorder),
          ),
          child: Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppTextStyles.bodySemiBold),
                    if (subtitle != null)
                      Text(subtitle!, style: AppTextStyles.caption.copyWith(color: AppColors.grey)),
                  ],
                ),
              ),
              if (enabled) const Icon(Icons.chevron_right_rounded, color: AppColors.greyBorder),
            ],
          ),
        ),
      ),
    );
  }
}
