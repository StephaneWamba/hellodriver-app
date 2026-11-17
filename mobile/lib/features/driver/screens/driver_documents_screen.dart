import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/providers/driver_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/driver_colors.dart';
import '../../../shared/widgets/hd_button.dart';
import '../../../shared/widgets/hd_card.dart';
import '../../../shared/widgets/hd_header_banner.dart';
import '../../shell/main_shell.dart';

class _DocSpec {
  const _DocSpec(this.type, this.label, this.icon);
  final String type;
  final String label;
  final IconData icon;
}

const _docSpecs = [
  _DocSpec('drivers_license', 'Permis de conduire', Iconsax.card_copy),
  _DocSpec('id_card', 'Carte d\'identité (CNI)', Iconsax.personalcard_copy),
  _DocSpec('vehicle_insurance', 'Assurance du véhicule', Iconsax.shield_tick_copy),
];

/// Self-service driver onboarding — step 2: identity/vehicle document upload.
class DriverDocumentsScreen extends ConsumerStatefulWidget {
  const DriverDocumentsScreen({super.key});

  @override
  ConsumerState<DriverDocumentsScreen> createState() => _DriverDocumentsScreenState();
}

class _DriverDocumentsScreenState extends ConsumerState<DriverDocumentsScreen> {
  String? _uploadingType;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(driverProvider.notifier).fetchVerificationStatus();
    });
  }

  Future<void> _pickAndUpload(String documentType) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => const _SourcePickerSheet(),
    );
    if (source == null) return;

    final picker = ImagePicker();
    final picked = await picker.pickImage(source: source, imageQuality: 85, maxWidth: 1600);
    if (picked == null) return;

    setState(() => _uploadingType = documentType);
    try {
      await ref.read(driverProvider.notifier).uploadDocument(documentType, File(picked.path));
    } catch (_) {
      if (mounted) {
        final err = ref.read(driverProvider).error ?? 'Échec de l\'envoi du document';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
      }
    } finally {
      if (mounted) setState(() => _uploadingType = null);
    }
  }

  void _finish() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const MainShell()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final verification = ref.watch(driverProvider).verification;
    final uploaded = verification?.uploadedDocumentTypes ?? const [];
    final allUploaded = _docSpecs.every((d) => uploaded.contains(d.type));

    return Theme(
      data: AppTheme.driver,
      child: Scaffold(
      backgroundColor: AppColors.greyLight,
      appBar: const HdHeaderBanner(title: 'Devenir chauffeur', color: DriverColors.primary),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                Text('Étape 2/2', style: AppTextStyles.captionMedium.copyWith(color: DriverColors.primary)),
                const SizedBox(width: 8),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: const LinearProgressIndicator(
                      value: 1,
                      minHeight: 6,
                      backgroundColor: AppColors.greyBorder,
                      valueColor: AlwaysStoppedAnimation(DriverColors.primary),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text('Vos documents', style: AppTextStyles.h3),
            const SizedBox(height: 4),
            Text(
              'Prenez une photo nette et lisible de chaque document. Votre dossier sera vérifié sous 24 à 48h.',
              style: AppTextStyles.body.copyWith(color: AppColors.grey),
            ),
            const SizedBox(height: 20),
            ..._docSpecs.map((spec) {
              final isUploaded = uploaded.contains(spec.type);
              final isUploading = _uploadingType == spec.type;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: HdCard(
                  onTap: isUploading ? null : () => _pickAndUpload(spec.type),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: isUploaded ? AppColors.success.withValues(alpha: 0.12) : DriverColors.primaryLight,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 350),
                          transitionBuilder: (child, anim) => ScaleTransition(scale: anim, child: child),
                          child: Icon(
                            isUploaded ? Iconsax.tick_circle_copy : spec.icon,
                            key: ValueKey(isUploaded),
                            color: isUploaded ? AppColors.success : DriverColors.primary,
                            size: 22,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(spec.label, style: AppTextStyles.bodySemiBold),
                            Text(
                              isUploaded ? 'Envoyé — en attente de vérification' : 'Appuyez pour ajouter une photo',
                              style: AppTextStyles.caption.copyWith(
                                color: isUploaded ? AppColors.success : AppColors.grey,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (isUploading)
                        const SizedBox(
                          width: 20, height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2.5),
                        )
                      else
                        const Icon(Iconsax.arrow_right_3_copy, color: AppColors.greyBorder, size: 20),
                    ],
                  ),
                ),
              );
            }),
            const SizedBox(height: 12),
            HdButton(
              label: allUploaded ? 'Terminer' : 'Terminer plus tard',
              variant: allUploaded ? HdButtonVariant.primary : HdButtonVariant.outline,
              accentColor: DriverColors.primary,
              onPressed: _finish,
            ),
          ],
        ),
      ),
      ),
    );
  }
}

class _SourcePickerSheet extends StatelessWidget {
  const _SourcePickerSheet();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36, height: 4,
            decoration: BoxDecoration(color: AppColors.greyBorder, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(height: 16),
          Material(
            color: Colors.transparent,
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Iconsax.camera_copy, color: DriverColors.primary),
                  title: Text('Prendre une photo', style: AppTextStyles.body),
                  onTap: () => Navigator.of(context).pop(ImageSource.camera),
                ),
                ListTile(
                  leading: const Icon(Iconsax.gallery_copy, color: DriverColors.primary),
                  title: Text('Choisir depuis la galerie', style: AppTextStyles.body),
                  onTap: () => Navigator.of(context).pop(ImageSource.gallery),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
