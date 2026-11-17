import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../../core/providers/app_mode_provider.dart';
import '../../core/providers/auth_provider.dart';
import '../driver/screens/driver_settings_screen.dart';
import '../driver/screens/driver_vehicle_info_screen.dart';
import '../trips/trip_history_screen.dart';
import '../referral/invite_friends_screen.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/theme/driver_colors.dart';
import '../../shared/widgets/hd_button.dart';
import '../../shared/widgets/hd_card.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final isDriver = user?.role == 'driver';

    return Scaffold(
      backgroundColor: AppColors.greyLight,
      appBar: AppBar(
        title: const Text('Profil'),
        centerTitle: true,
        elevation: 0,
        backgroundColor: AppColors.white,
        foregroundColor: AppColors.dark,
        surfaceTintColor: Colors.transparent,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Avatar card ─────────────────────────────────────────────
            HdCard(
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
              child: Column(
                children: [
                  GestureDetector(
                    onTap: () => _pickAndUploadAvatar(context, ref),
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        CircleAvatar(
                          radius: 48,
                          backgroundColor: isDriver
                              ? DriverColors.primaryLight
                              : AppColors.primaryLight,
                          backgroundImage: user?.avatarUrl != null
                              ? CachedNetworkImageProvider(user!.avatarUrl!)
                              : null,
                          child: user?.avatarUrl == null
                              ? Text(
                                  _initials(user?.name),
                                  style: AppTextStyles.h2.copyWith(
                                    color: isDriver
                                        ? DriverColors.primary
                                        : AppColors.primary,
                                    fontSize: 28,
                                  ),
                                )
                              : null,
                        ),
                        Positioned(
                          right: -2,
                          bottom: -2,
                          child: Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              color: isDriver
                                  ? DriverColors.primary
                                  : AppColors.primary,
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.white, width: 2),
                            ),
                            child: const Icon(Icons.camera_alt_rounded,
                                color: AppColors.white, size: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    user?.name ?? 'Mon profil',
                    style: AppTextStyles.h3,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    user?.phone ?? '',
                    style: AppTextStyles.body.copyWith(color: AppColors.grey),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                    decoration: BoxDecoration(
                      color: isDriver
                          ? DriverColors.primaryLight
                          : AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      isDriver ? 'Chauffeur' : 'Passager',
                      style: AppTextStyles.caption.copyWith(
                        color: isDriver ? DriverColors.primary : AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  // Rating — drivers only
                  if (isDriver && (user?.ratingCount ?? 0) > 0) ...[
                    const SizedBox(height: 10),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.star_rounded,
                            color: Color(0xFFFFC107), size: 18),
                        const SizedBox(width: 4),
                        Text(
                          (user!.ratingAvg ?? 0).toStringAsFixed(1),
                          style: AppTextStyles.body
                              .copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '(${user.ratingCount} avis)',
                          style: AppTextStyles.caption
                              .copyWith(color: AppColors.grey),
                        ),
                      ],
                    ),
                  ],
                  // Prompt to fill name if missing
                  if (user?.name == null || (user?.name?.isEmpty ?? true)) ...[
                    const SizedBox(height: 10),
                    GestureDetector(
                      onTap: () => _showEditSheet(
                          context, ref, user?.name ?? '', user?.email ?? ''),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppColors.warning.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.edit_rounded,
                                color: AppColors.warning, size: 14),
                            const SizedBox(width: 6),
                            Text(
                              'Complétez votre profil',
                              style: AppTextStyles.caption.copyWith(
                                color: AppColors.warning,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),

            // ── Mode switch — driver accounts ────────────────────────────
            if (isDriver) const _ModeSwitchCard(),
            if (isDriver) const SizedBox(height: 12),

            // ── Devenir chauffeur — client accounts ──────────────────────
            if (!isDriver) ...[
              _BecomeDriverCard(onTap: () => _startDriverOnboarding(context, ref)),
              const SizedBox(height: 12),
            ],

            // ── Referral code ────────────────────────────────────────────
            if (user?.referralCode != null) ...[
              HdCard(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.secondaryLight,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.card_giftcard_rounded,
                          color: AppColors.secondary, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Code parrainage',
                              style: AppTextStyles.caption
                                  .copyWith(color: AppColors.grey)),
                          const SizedBox(height: 2),
                          Text(user!.referralCode!,
                              style: AppTextStyles.h3.copyWith(
                                  color: AppColors.secondary,
                                  letterSpacing: 3)),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.copy_rounded,
                          color: AppColors.grey, size: 20),
                      onPressed: () {
                        Clipboard.setData(
                            ClipboardData(text: user.referralCode!));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Code copié !'),
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // ── Menu items ───────────────────────────────────────────────
            HdCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  _MenuItem(
                    icon: Icons.person_outline_rounded,
                    label: 'Modifier mon profil',
                    onTap: () => _showEditSheet(
                        context, ref, user?.name ?? '', user?.email ?? ''),
                  ),
                  const Divider(height: 1, indent: 52),
                  _MenuItem(
                    icon: Icons.history_rounded,
                    label: 'Mes courses',
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                          builder: (_) => const TripHistoryScreen()),
                    ),
                  ),
                  if (isDriver) ...[
                    const Divider(height: 1, indent: 52),
                    _MenuItem(
                      icon: Icons.directions_car_rounded,
                      label: 'Paramètres chauffeur',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(builder: (_) => const DriverSettingsScreen()),
                      ),
                    ),
                  ],
                  if (user?.referralCode != null) ...[
                    const Divider(height: 1, indent: 52),
                    _MenuItem(
                      icon: Icons.card_giftcard_rounded,
                      label: 'Inviter des amis',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(builder: (_) => const InviteFriendsScreen()),
                      ),
                    ),
                  ],
                  const Divider(height: 1, indent: 52),
                  _MenuItem(
                    icon: Icons.help_outline_rounded,
                    label: 'Aide et support',
                    onTap: () => _showInfoDialog(
                      context,
                      title: 'Aide et support',
                      content:
                          'Pour toute assistance, contactez-nous au\n+241 77 00 00 00\nou par email à\nsupport@hellodriver.ga',
                    ),
                  ),
                  const Divider(height: 1, indent: 52),
                  _MenuItem(
                    icon: Icons.info_outline_rounded,
                    label: 'À propos de HelloDriver',
                    onTap: () => _showInfoDialog(
                      context,
                      title: 'HelloDriver',
                      content:
                          'Version 1.0.0\nApplication de transport à Libreville.\n© 2026 HelloDriver',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            HdButton(
              label: 'Se déconnecter',
              variant: HdButtonVariant.outline,
              onPressed: () => ref.read(authProvider.notifier).signOut(),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickAndUploadAvatar(
      BuildContext context, WidgetRef ref) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
        source: ImageSource.gallery, imageQuality: 80, maxWidth: 800);
    if (picked == null) return;
    try {
      await ref.read(authProvider.notifier).uploadAvatar(File(picked.path));
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Échec du chargement de la photo'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  String _initials(String? name) {
    if (name == null || name.trim().isEmpty) return '?';
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name[0].toUpperCase();
  }

  Future<void> _showEditSheet(BuildContext context, WidgetRef ref,
      String currentName, String currentEmail) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EditProfileSheet(
          currentName: currentName, currentEmail: currentEmail),
    );
  }

  void _showInfoDialog(BuildContext context,
      {required String title, required String content}) {
    showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(title, style: AppTextStyles.h3),
        content: Text(content, style: AppTextStyles.body),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Fermer'),
          ),
        ],
      ),
    );
  }

  Future<void> _startDriverOnboarding(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: DriverColors.primaryLight,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Iconsax.car_copy, color: DriverColors.primary, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text('Devenir chauffeur', style: AppTextStyles.h3)),
          ],
        ),
        content: Text(
          'Gagnez de l\'argent en conduisant à Libreville. Vous devrez renseigner votre véhicule et envoyer 3 documents (permis, CNI, assurance) pour être vérifié.',
          style: AppTextStyles.body,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Continuer'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(authProvider.notifier).setRole('driver');
      if (!context.mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const DriverVehicleInfoScreen()),
      );
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Échec de l\'activation du mode chauffeur')),
        );
      }
    }
  }
}

// ── Become Driver card ────────────────────────────────────────────────────────

class _BecomeDriverCard extends StatelessWidget {
  const _BecomeDriverCard({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          gradient: DriverColors.primaryGradient,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Stack(
          children: [
            Positioned(
              right: -16,
              bottom: -18,
              child: Opacity(
                opacity: 0.18,
                child: SvgPicture.asset(
                  'assets/illustrations/car_silhouette.svg',
                  width: 140,
                  colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.directions_car_rounded,
                  color: Colors.white, size: 22),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Devenir chauffeur',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Gagnez de l\'argent en conduisant',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded,
                color: Colors.white, size: 22),
          ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Mode switch card ──────────────────────────────────────────────────────────

class _ModeSwitchCard extends ConsumerWidget {
  const _ModeSwitchCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(appModeProvider);
    final isDriverMode = mode == AppMode.driver;

    return GestureDetector(
      onTap: () => ref.read(appModeProvider.notifier).toggle(),
      child: HdCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isDriverMode
                    ? DriverColors.primaryLight
                    : AppColors.primaryLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                isDriverMode
                    ? Icons.directions_car_rounded
                    : Icons.person_rounded,
                color: isDriverMode ? DriverColors.primary : AppColors.primary,
                size: 22,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Mode actuel',
                      style: AppTextStyles.caption
                          .copyWith(color: AppColors.grey)),
                  const SizedBox(height: 2),
                  Text(
                    isDriverMode ? 'Chauffeur' : 'Passager',
                    style: AppTextStyles.body.copyWith(
                      fontWeight: FontWeight.w600,
                      color: isDriverMode
                          ? DriverColors.primary
                          : AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: isDriverMode
                    ? AppColors.primaryLight
                    : DriverColors.primaryLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                isDriverMode ? 'Mode passager' : 'Mode chauffeur',
                style: AppTextStyles.caption.copyWith(
                  color:
                      isDriverMode ? AppColors.primary : DriverColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Menu item ─────────────────────────────────────────────────────────────────

class _MenuItem extends StatelessWidget {
  const _MenuItem(
      {required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      leading: Icon(icon, color: AppColors.grey, size: 22),
      title: Text(label, style: AppTextStyles.body),
      trailing: const Icon(Icons.chevron_right_rounded,
          color: AppColors.greyBorder, size: 22),
      onTap: onTap,
    );
  }
}

// ── Edit profile sheet ────────────────────────────────────────────────────────

class _EditProfileSheet extends ConsumerStatefulWidget {
  const _EditProfileSheet(
      {required this.currentName, required this.currentEmail});
  final String currentName;
  final String currentEmail;

  @override
  ConsumerState<_EditProfileSheet> createState() => _EditProfileSheetState();
}

class _EditProfileSheetState extends ConsumerState<_EditProfileSheet> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _emailCtrl;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.currentName);
    _emailCtrl = TextEditingController(text: widget.currentEmail);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    try {
      await ref.read(authProvider.notifier).updateProfile(
            name: _nameCtrl.text.trim(),
            email: _emailCtrl.text.trim().isEmpty
                ? null
                : _emailCtrl.text.trim(),
          );
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Échec de la mise à jour: ${e.toString()}'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final isLoading = ref.watch(authProvider).isLoading;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 24 + bottom),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
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
          Text('Modifier le profil', style: AppTextStyles.h3),
          const SizedBox(height: 20),
          TextFormField(
            controller: _nameCtrl,
            decoration: const InputDecoration(
              labelText: 'Nom complet',
              prefixIcon: Icon(Icons.person_outline_rounded),
            ),
            textCapitalization: TextCapitalization.words,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _emailCtrl,
            decoration: const InputDecoration(
              labelText: 'Email (optionnel)',
              prefixIcon: Icon(Icons.email_outlined),
            ),
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 20),
          HdButton(
              label: 'Enregistrer',
              isLoading: isLoading,
              onPressed: _save),
        ],
      ),
    );
  }
}
