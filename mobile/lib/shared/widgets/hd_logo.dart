import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../core/theme/app_colors.dart';

/// HelloDriver logo — steering wheel over a skyline silhouette, drawn in code
/// plus a bundled skyline SVG, mirroring the rounded app-icon badge from the
/// Figma mockups (splash/login screens).
class HdLogo extends StatelessWidget {
  const HdLogo({super.key, this.size = 56, this.color = AppColors.primary});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(size * 0.22),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Opacity(
              opacity: 0.22,
              child: SvgPicture.asset(
                'assets/illustrations/skyline.svg',
                height: size * 0.55,
                width: size,
                fit: BoxFit.cover,
                colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn),
              ),
            ),
          ),
          CustomPaint(
            size: Size(size * 0.6, size * 0.6),
            painter: _SteeringWheelPainter(),
          ),
        ],
      ),
    );
  }
}

class _SteeringWheelPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.1
      ..strokeCap = StrokeCap.round;

    final strokeW = size.width * 0.1;
    final center = Offset(size.width / 2, size.height / 2);
    final outerR = size.width / 2 - strokeW / 2;
    final innerR = size.width * 0.18;

    // Outer ring
    canvas.drawCircle(center, outerR, paint);
    // Inner hub
    canvas.drawCircle(center, innerR, paint);

    // 3 spokes at -90°, 30°, 150°
    for (int i = 0; i < 3; i++) {
      final angle = (i * 120 - 90) * math.pi / 180;
      final start = Offset(
        center.dx + innerR * math.cos(angle),
        center.dy + innerR * math.sin(angle),
      );
      final end = Offset(
        center.dx + outerR * math.cos(angle),
        center.dy + outerR * math.sin(angle),
      );
      canvas.drawLine(start, end, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
