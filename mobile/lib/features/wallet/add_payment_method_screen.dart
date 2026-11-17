import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import '../../core/api/api_client.dart';
import '../../core/providers/app_mode_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/driver_colors.dart';
import '../../shared/widgets/hd_button.dart';
import '../../shared/widgets/hd_header_banner.dart';

/// Adds a saved Airtel/Moov mobile money number. The backend infers the
/// operator from the phone prefix (7 = Airtel, 6 = Moov) — no operator picker needed.
class AddPaymentMethodScreen extends ConsumerStatefulWidget {
  const AddPaymentMethodScreen({super.key});

  @override
  ConsumerState<AddPaymentMethodScreen> createState() => _AddPaymentMethodScreenState();
}

class _AddPaymentMethodScreenState extends ConsumerState<AddPaymentMethodScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneCtrl = TextEditingController(text: '+241');
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _submitting = true; _error = null; });
    try {
      await ref.read(apiClientProvider).post<dynamic>(
        '/payments/methods',
        data: {'phoneNumber': _phoneCtrl.text.trim()},
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      final msg = _extractError(e);
      if (mounted) setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _extractError(Object e) {
    try {
      // ignore: avoid_dynamic_calls
      final data = (e as dynamic).response?.data;
      final msg = data?['error']?['message'] ?? data?['message'];
      if (msg is String) return msg;
    } catch (_) {}
    return 'Une erreur est survenue';
  }

  @override
  Widget build(BuildContext context) {
    final isDriverMode = ref.watch(appModeProvider) == AppMode.driver;
    final accent = isDriverMode ? DriverColors.primary : AppColors.primary;
    final accentLight = isDriverMode ? DriverColors.primaryLight : AppColors.primaryLight;

    return Theme(
      data: isDriverMode ? AppTheme.driver : AppTheme.light,
      child: Scaffold(
      backgroundColor: AppColors.greyLight,
      appBar: HdHeaderBanner(title: 'Ajouter un moyen de paiement', color: accent),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: accentLight,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      Icon(Iconsax.wallet_copy, color: accent, size: 22),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Airtel Money ou Moov Money — le numéro est reconnu automatiquement.',
                          style: AppTextStyles.caption.copyWith(color: accent),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _phoneCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Numéro de téléphone',
                    hintText: '+24177XXXXXX',
                    prefixIcon: Icon(Iconsax.call_copy),
                  ),
                  keyboardType: TextInputType.phone,
                  validator: (v) => (v == null || !RegExp(r'^\+241[0-9]{8}$').hasMatch(v.trim()))
                      ? 'Format invalide — ex. +24177123456'
                      : null,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: AppTextStyles.caption.copyWith(color: AppColors.error)),
                ],
                const SizedBox(height: 20),
                HdButton(
                  label: 'Enregistrer',
                  accentColor: accent,
                  isLoading: _submitting,
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ),
      ),
      ),
    );
  }
}
