import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/driver_colors.dart';
import '../../../shared/widgets/hd_button.dart';
import '../../../shared/widgets/hd_card.dart';
import '../../../shared/widgets/hd_header_banner.dart';
import 'driver_documents_screen.dart';
import 'driver_vehicle_info_screen.dart';

class DriverSettingsScreen extends ConsumerStatefulWidget {
  const DriverSettingsScreen({super.key});

  @override
  ConsumerState<DriverSettingsScreen> createState() => _DriverSettingsScreenState();
}

class _DriverSettingsScreenState extends ConsumerState<DriverSettingsScreen> {
  Map<String, dynamic>? _profile;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final userId = ref.read(authProvider).user?.id;
    if (userId == null) return;
    try {
      final res = await ref.read(apiClientProvider).get<Map<String, dynamic>>('/drivers/$userId');
      if (mounted) setState(() { _profile = res.data; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isVerified = _profile?['isVerified'] as bool? ?? false;
    final verificationStatus = _profile?['verificationStatus'] as String? ?? 'pending';

    return Theme(
      data: AppTheme.driver,
      child: Scaffold(
      backgroundColor: AppColors.greyLight,
      appBar: const HdHeaderBanner(title: 'Paramètres du compte', color: DriverColors.primary),
      body: SafeArea(
        top: false,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: DriverColors.primary))
            : RefreshIndicator(
                color: DriverColors.primary,
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text('Véhicule', style: AppTextStyles.captionMedium),
                    const SizedBox(height: 8),
                    HdCard(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: DriverColors.primaryLight,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Iconsax.car_copy, color: DriverColors.primary, size: 22),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _profile?['vehicleBrand'] != null
                                          ? '${_profile!['vehicleBrand']} ${_profile!['vehicleModel']}'
                                          : 'Non renseigné',
                                      style: AppTextStyles.bodySemiBold,
                                    ),
                                    if (_profile?['vehicleRegistration'] != null)
                                      Text(
                                        '${_profile!['vehicleRegistration']} · ${_profile!['vehicleYear']}'
                                        '${(_profile!['hasAc'] as bool? ?? false) ? ' · Climatisé' : ''}',
                                        style: AppTextStyles.caption.copyWith(color: AppColors.grey),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          HdButton(
                            label: 'Modifier les infos véhicule',
                            variant: HdButtonVariant.outline,
                            accentColor: DriverColors.primary,
                            height: 44,
                            onPressed: () async {
                              await Navigator.of(context).push(
                                MaterialPageRoute<void>(builder: (_) => const DriverVehicleInfoScreen()),
                              );
                              _load();
                            },
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text('Vérification', style: AppTextStyles.captionMedium),
                    const SizedBox(height: 8),
                    HdCard(
                      padding: EdgeInsets.zero,
                      child: _SettingsRow(
                        icon: isVerified ? Iconsax.tick_circle_copy : Iconsax.clock_copy,
                        iconColor: isVerified ? AppColors.success : AppColors.warning,
                        label: 'Documents',
                        subtitle: isVerified
                            ? 'Vérifié'
                            : verificationStatus == 'rejected'
                                ? 'Refusé — à renvoyer'
                                : 'En attente de vérification',
                        onTap: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute<void>(builder: (_) => const DriverDocumentsScreen()),
                          );
                          _load();
                        },
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Le moyen de paiement pour vos retraits et le reste de votre profil se gèrent depuis Portefeuille et Profil.',
                      style: AppTextStyles.caption.copyWith(color: AppColors.grey),
                    ),
                  ],
                ),
              ),
      ),
      ),
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String label;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(color: iconColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, color: iconColor, size: 18),
      ),
      title: Text(label, style: AppTextStyles.bodySemiBold),
      subtitle: Text(subtitle, style: AppTextStyles.caption.copyWith(color: AppColors.grey)),
      trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.greyBorder),
      onTap: onTap,
    );
  }
}
