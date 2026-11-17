import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Primary — mint green (from Figma screenshots)
  static const Color primary = Color(0xFF2DC9A0);
  static const Color primaryDark = Color(0xFF22A882);
  static const Color primaryLight = Color(0xFFE8FAF5);

  // Secondary — deep blue
  static const Color secondary = Color(0xFF3B5BDB);
  static const Color secondaryLight = Color(0xFFEEF2FF);

  // Neutrals
  static const Color dark = Color(0xFF1A1A2E);
  static const Color grey = Color(0xFF8C8C9E);
  static const Color greyLight = Color(0xFFF5F5F7);
  static const Color greyBorder = Color(0xFFE8E8EE);
  static const Color white = Color(0xFFFFFFFF);

  // Semantic
  static const Color success = Color(0xFF27AE60);
  static const Color error = Color(0xFFFF4757);
  static const Color warning = Color(0xFFFFB347);

  // Map overlay
  static const Color mapBackground = Color(0xFFF8F8F8);

  // Gradient primary
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [Color(0xFF2DC9A0), Color(0xFF22A882)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Status colors (trip states)
  static const Color statusPending = Color(0xFFFFB347);
  static const Color statusActive = Color(0xFF2DC9A0);
  static const Color statusCompleted = Color(0xFF27AE60);
  static const Color statusCancelled = Color(0xFFFF4757);
}
