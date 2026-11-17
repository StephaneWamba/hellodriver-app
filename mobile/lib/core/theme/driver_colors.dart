import 'package:flutter/material.dart';

class DriverColors {
  DriverColors._();

  // Primary — deep blue (driver identity)
  static const Color primary = Color(0xFF1A73E8);
  static const Color primaryDark = Color(0xFF1557B0);
  static const Color primaryLight = Color(0xFFE8F0FE);

  // Gradient
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [Color(0xFF1A73E8), Color(0xFF1557B0)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}
