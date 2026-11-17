import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/driver_colors.dart';
import '../../../shared/widgets/hd_button.dart';

class RoleScreen extends ConsumerStatefulWidget {
  const RoleScreen({super.key});

  @override
  ConsumerState<RoleScreen> createState() => _RoleScreenState();
}

class _RoleScreenState extends ConsumerState<RoleScreen> {
  String? _selected;
  final _referralCtrl = TextEditingController();
  bool _showReferralField = false;

  @override
  void dispose() {
    _referralCtrl.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    if (_selected == null) return;
    await ref.read(authProvider.notifier).setRole(_selected!);
    final code = _referralCtrl.text.trim();
    if (code.isNotEmpty) {
      await ref.read(authProvider.notifier).redeemReferralCode(code);
    }
    // router redirect handles navigation
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(authProvider).isLoading;

    return Scaffold(
      backgroundColor: AppColors.grey,
      body: Column(
        children: [
          SizedBox(
            height: 240,
            width: double.infinity,
            child: Opacity(
              opacity: 0.45,
              child: SvgPicture.asset(
                'assets/illustrations/skyline.svg',
                fit: BoxFit.cover,
                width: double.infinity,
                height: 240,
                colorFilter: const ColorFilter.mode(AppColors.dark, BlendMode.srcIn),
              ),
            ),
          ),
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color: AppColors.greyLight,
                borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Vous êtes…', style: AppTextStyles.h1),
                      const SizedBox(height: 8),
                      Text(
                        'Choisissez votre profil pour personnaliser l\'expérience',
                        style: AppTextStyles.body.copyWith(color: AppColors.grey),
                      ),
                      const SizedBox(height: 32),
                      _RoleCard(
                        role: 'client',
                        title: 'Passager',
                        subtitle: 'Je veux réserver des courses',
                        icon: Icons.person_rounded,
                        selected: _selected == 'client',
                        onTap: () => setState(() => _selected = 'client'),
                      ),
                      const SizedBox(height: 16),
                      _RoleCard(
                        role: 'driver',
                        title: 'Chauffeur',
                        subtitle: 'Je veux proposer des courses',
                        icon: Icons.drive_eta_rounded,
                        selected: _selected == 'driver',
                        onTap: () => setState(() => _selected = 'driver'),
                      ),
                      const SizedBox(height: 16),
                      if (!_showReferralField)
                        GestureDetector(
                          onTap: () => setState(() => _showReferralField = true),
                          child: Text(
                            'J\'ai un code de parrainage',
                            style: AppTextStyles.captionMedium.copyWith(
                              color: AppColors.primary,
                              decoration: TextDecoration.underline,
                            ),
                          ),
                        )
                      else
                        TextFormField(
                          controller: _referralCtrl,
                          textCapitalization: TextCapitalization.characters,
                          decoration: const InputDecoration(
                            labelText: 'Code de parrainage (optionnel)',
                            prefixIcon: Icon(Icons.card_giftcard_rounded),
                          ),
                        ),
                      const Spacer(),
                      HdButton(
                        label: 'Confirmer',
                        isLoading: isLoading,
                        onPressed: _selected != null ? _confirm : null,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({
    required this.role,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String role;
  final String title;
  final String subtitle;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  Color get _accent => role == 'driver' ? DriverColors.primary : AppColors.primary;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: selected ? _accent.withValues(alpha: 0.08) : AppColors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? _accent : AppColors.greyBorder,
            width: selected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: selected ? _accent : AppColors.greyLight,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                icon,
                color: selected ? AppColors.white : AppColors.grey,
                size: 28,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AppTextStyles.h3),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: AppTextStyles.body.copyWith(color: AppColors.grey)),
                ],
              ),
            ),
            if (selected)
              Icon(Icons.check_circle_rounded, color: _accent, size: 24),
          ],
        ),
      ),
    );
  }
}
