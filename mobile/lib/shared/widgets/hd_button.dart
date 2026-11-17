import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';

enum HdButtonVariant { primary, secondary, outline, dark, ghost }

class HdButton extends StatelessWidget {
  const HdButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = HdButtonVariant.primary,
    this.icon,
    this.isLoading = false,
    this.height = 56,
    this.accentColor,
  });

  final String label;
  final VoidCallback? onPressed;
  final HdButtonVariant variant;
  final Widget? icon;
  final bool isLoading;
  final double height;

  /// Overrides the variant's default brand color (AppColors.primary/secondary).
  /// Pass DriverColors.primary in driver-facing screens to keep the blue/green
  /// branding split correct — HdButton has no context awareness on its own.
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final child = isLoading
        ? SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: _fgColor,
            ),
          )
        : icon != null
            ? Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  icon!,
                  const SizedBox(width: 8),
                  Text(label, style: AppTextStyles.button.copyWith(color: _fgColor)),
                ],
              )
            : Text(label, style: AppTextStyles.button.copyWith(color: _fgColor));

    return SizedBox(
      width: double.infinity,
      height: height,
      child: _buildButton(child),
    );
  }

  Widget _buildButton(Widget child) {
    final accent = accentColor ?? AppColors.primary;
    switch (variant) {
      case HdButtonVariant.primary:
        return ElevatedButton(
          onPressed: isLoading ? null : onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: accent,
            foregroundColor: AppColors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 0,
          ),
          child: child,
        );
      case HdButtonVariant.secondary:
        return ElevatedButton(
          onPressed: isLoading ? null : onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: accentColor?.withValues(alpha: 0.12) ?? AppColors.secondaryLight,
            foregroundColor: accentColor ?? AppColors.secondary,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 0,
          ),
          child: child,
        );
      case HdButtonVariant.outline:
        return OutlinedButton(
          onPressed: isLoading ? null : onPressed,
          style: OutlinedButton.styleFrom(
            foregroundColor: accent,
            side: BorderSide(color: accent, width: 1.5),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          child: child,
        );
      case HdButtonVariant.dark:
        return ElevatedButton(
          onPressed: isLoading ? null : onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.dark,
            foregroundColor: AppColors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 0,
          ),
          child: child,
        );
      case HdButtonVariant.ghost:
        return TextButton(
          onPressed: isLoading ? null : onPressed,
          style: TextButton.styleFrom(
            foregroundColor: accent,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          child: child,
        );
    }
  }

  Color get _fgColor {
    if (onPressed == null && !isLoading) return AppColors.grey;
    final accent = accentColor ?? AppColors.primary;
    return switch (variant) {
      HdButtonVariant.primary => AppColors.white,
      HdButtonVariant.secondary => accent,
      HdButtonVariant.outline => accent,
      HdButtonVariant.dark => AppColors.white,
      HdButtonVariant.ghost => accent,
    };
  }
}
