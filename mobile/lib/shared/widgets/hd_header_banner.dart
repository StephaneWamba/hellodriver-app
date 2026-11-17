import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';

/// Colored top banner with a skyline silhouette, mirroring the Figma
/// mockups' header treatment (colored band + city skyline behind the title).
/// Used in place of a flat white AppBar on onboarding/form screens.
class HdHeaderBanner extends StatelessWidget implements PreferredSizeWidget {
  const HdHeaderBanner({
    super.key,
    required this.title,
    this.color = AppColors.primary,
    this.showBack = true,
    this.height = 128,
  });

  final String title;
  final Color color;
  final bool showBack;
  final double height;

  @override
  Size get preferredSize => Size.fromHeight(height);

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: color,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      child: Stack(
        children: [
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Opacity(
              opacity: 0.18,
              child: SvgPicture.asset(
                'assets/illustrations/skyline.svg',
                height: height * 0.6,
                width: double.infinity,
                fit: BoxFit.cover,
                colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn),
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: SizedBox(
              height: height,
              child: Row(
                children: [
                  SizedBox(
                    width: 48,
                    child: showBack
                        ? IconButton(
                            icon: const Icon(Icons.arrow_back_rounded, color: AppColors.white),
                            onPressed: () => Navigator.of(context).maybePop(),
                          )
                        : null,
                  ),
                  Expanded(
                    child: Text(
                      title,
                      textAlign: TextAlign.center,
                      style: AppTextStyles.h3.copyWith(color: AppColors.white),
                    ),
                  ),
                  const SizedBox(width: 48),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
