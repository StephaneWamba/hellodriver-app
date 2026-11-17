import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/providers/app_mode_provider.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/driver_colors.dart';
import '../../shared/widgets/hd_button.dart';
import '../../shared/widgets/hd_card.dart';
import '../../shared/widgets/hd_header_banner.dart';

class InviteFriendsScreen extends ConsumerStatefulWidget {
  const InviteFriendsScreen({super.key});

  @override
  ConsumerState<InviteFriendsScreen> createState() => _InviteFriendsScreenState();
}

class _InviteFriendsScreenState extends ConsumerState<InviteFriendsScreen> {
  int? _rewardXaf;
  int? _totalReferrals;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ref.read(apiClientProvider).get<Map<String, dynamic>>('/referrals/my-code');
      if (!mounted) return;
      setState(() {
        _rewardXaf = res.data?['rewardXaf'] as int?;
        _totalReferrals = res.data?['totalReferrals'] as int?;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _shareMessage(String code) =>
      'Rejoins-moi sur HelloDriver ! Utilise mon code $code à l\'inscription et on gagne chacun ${_rewardXaf ?? 4000} XAF sur notre Hello Money. Télécharge l\'app pour commencer.';

  @override
  Widget build(BuildContext context) {
    final code = ref.watch(authProvider).user?.referralCode;
    final isDriverMode = ref.watch(appModeProvider) == AppMode.driver;
    final accent = isDriverMode ? DriverColors.primary : AppColors.secondary;
    final accentLight = isDriverMode ? DriverColors.primaryLight : AppColors.secondaryLight;

    return Theme(
      data: isDriverMode ? AppTheme.driver : AppTheme.light,
      child: Scaffold(
      backgroundColor: AppColors.greyLight,
      appBar: HdHeaderBanner(title: 'Inviter des amis', color: accent),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            HdCard(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: accentLight,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Iconsax.gift_copy, color: accent, size: 30),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _loading
                        ? 'Parrainez vos amis'
                        : 'Gagnez ${_rewardXaf ?? 4000} XAF par ami parrainé',
                    style: AppTextStyles.h3,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Votre ami reçoit aussi ${_rewardXaf ?? 4000} XAF sur son Hello Money à l\'inscription.',
                    style: AppTextStyles.body.copyWith(color: AppColors.grey),
                    textAlign: TextAlign.center,
                  ),
                  if (!_loading && _totalReferrals != null && _totalReferrals! > 0) ...[
                    const SizedBox(height: 12),
                    Text('$_totalReferrals ami${_totalReferrals! > 1 ? 's' : ''} déjà parrainé${_totalReferrals! > 1 ? 's' : ''}',
                        style: AppTextStyles.captionMedium.copyWith(color: accent)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (code != null) ...[
              Text('Votre code', style: AppTextStyles.captionMedium),
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 20),
                decoration: BoxDecoration(
                  color: AppColors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: accent, width: 1.5),
                ),
                child: Text(
                  code,
                  textAlign: TextAlign.center,
                  style: AppTextStyles.h1.copyWith(color: accent, letterSpacing: 4),
                ),
              ),
              const SizedBox(height: 20),
              HdButton(
                label: 'Partager par SMS',
                accentColor: accent,
                icon: const Icon(Iconsax.message_copy, color: AppColors.white, size: 18),
                onPressed: () async {
                  final uri = Uri(scheme: 'sms', path: '', queryParameters: {'body': _shareMessage(code)});
                  if (await canLaunchUrl(uri)) await launchUrl(uri);
                },
              ),
              const SizedBox(height: 10),
              HdButton(
                label: 'Copier le code',
                variant: HdButtonVariant.outline,
                accentColor: accent,
                icon: Icon(Iconsax.copy_copy, color: accent, size: 18),
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: _shareMessage(code)));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Message copié !'), behavior: SnackBarBehavior.floating),
                  );
                },
              ),
            ],
          ],
        ),
      ),
      ),
    );
  }
}
