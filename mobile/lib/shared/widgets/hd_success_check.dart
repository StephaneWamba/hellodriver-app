import 'package:flutter/material.dart';

/// Checkmark that scales in with a bounce — used on trip-completed and
/// document-upload-success moments. Code-drawn (see HdPulseLoader for why).
class HdSuccessCheck extends StatelessWidget {
  const HdSuccessCheck({super.key, required this.color, this.size = 56});
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 500),
      curve: Curves.elasticOut,
      builder: (context, value, child) => Transform.scale(scale: value, child: child),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
        child: Icon(Icons.check_circle_rounded, color: color, size: size * 0.72),
      ),
    );
  }
}
