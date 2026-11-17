import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/hd_button.dart';
import '../../../shared/widgets/hd_logo.dart';

class PhoneScreen extends ConsumerStatefulWidget {
  const PhoneScreen({super.key});

  @override
  ConsumerState<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends ConsumerState<PhoneScreen> {
  final _controller = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String get _fullPhone {
    final raw = _controller.text.trim().replaceAll(' ', '');
    if (raw.startsWith('+')) return raw;
    if (raw.startsWith('0')) return '+241${raw.substring(1)}';
    return '+241$raw';
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    try {
      await ref.read(authProvider.notifier).sendOtp(_fullPhone);
      if (mounted) context.push('/otp', extra: _fullPhone);
    } catch (e) {
      // error is set on authProvider.error by sendOtp — no-op here
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(authProvider).isLoading;
    final error = ref.watch(authProvider).error;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 24),
                const HdLogo(size: 64),
                const SizedBox(height: 32),
                Text('Bienvenue sur\nHelloDriver', style: AppTextStyles.h1),
                const SizedBox(height: 8),
                Text(
                  'Entrez votre numéro de téléphone pour continuer',
                  style: AppTextStyles.body.copyWith(color: AppColors.grey),
                ),
                const SizedBox(height: 40),
                TextFormField(
                  controller: _controller,
                  keyboardType: TextInputType.phone,
                  autofocus: true,
                  decoration: InputDecoration(
                    labelText: 'Numéro de téléphone',
                    hintText: '077 123 456',
                    prefixIcon: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('🇬🇦', style: TextStyle(fontSize: 20)),
                          const SizedBox(width: 6),
                          Text('+241', style: AppTextStyles.body),
                          const SizedBox(width: 4),
                          Container(width: 1, height: 20, color: AppColors.greyBorder),
                          const SizedBox(width: 4),
                        ],
                      ),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Requis';
                    final digits = v.trim().replaceAll(' ', '').replaceAll('+241', '').replaceAll(RegExp(r'^0'), '');
                    if (digits.length != 8) return 'Numéro invalide (8 chiffres)';
                    return null;
                  },
                ),
                if (error != null) ...[
                  const SizedBox(height: 12),
                  Text(error, style: AppTextStyles.caption.copyWith(color: AppColors.error)),
                ],
                const SizedBox(height: 32),
                HdButton(
                  label: 'Continuer',
                  isLoading: isLoading,
                  onPressed: _submit,
                ),
                const SizedBox(height: 24),
                Center(
                  child: Text(
                    'En continuant, vous acceptez nos conditions\nd\'utilisation et notre politique de confidentialité',
                    textAlign: TextAlign.center,
                    style: AppTextStyles.caption.copyWith(color: AppColors.grey),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
