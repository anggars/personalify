import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Cached text styles to avoid repeated GoogleFonts instantiation
/// This significantly improves performance by reducing font creation overhead
class AppTextStyles {
  AppTextStyles._(); // Private constructor to prevent instantiation

  // Color constants for easy reference
  static const Color kAccentColor = Color(0xFF1DB954);
  static const Color kTextPrimary = Color(0xFFFFFFFF);
  static const Color kTextSecondary = Color(0xFFB3B3B3);

  // ============================================================================
  // HEADERS / TITLES
  // ============================================================================
  
  static final TextStyle header32Bold = GoogleFonts.plusJakartaSans(
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: kTextPrimary,
  );

  static final TextStyle header24Bold = GoogleFonts.plusJakartaSans(
    fontSize: 24,
    fontWeight: FontWeight.w800,
    color: kAccentColor,
    letterSpacing: -0.5,
  );

  static final TextStyle header20Bold = GoogleFonts.plusJakartaSans(
    fontSize: 20,
    fontWeight: FontWeight.bold,
    color: kAccentColor,
  );

  static final TextStyle header18Bold = GoogleFonts.plusJakartaSans(
    fontSize: 18,
    fontWeight: FontWeight.bold,
    color: kAccentColor,
  );

  static final TextStyle header16Bold = GoogleFonts.plusJakartaSans(
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: kAccentColor,
  );

  static final TextStyle header16BoldWhite = GoogleFonts.plusJakartaSans(
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: kTextPrimary,
  );

  // ============================================================================
  // BODY TEXT
  // ============================================================================

  static final TextStyle body16 = GoogleFonts.plusJakartaSans(
    fontSize: 16,
    color: kTextPrimary,
  );

  static final TextStyle body16Bold = GoogleFonts.plusJakartaSans(
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: kTextSecondary,
  );

  static final TextStyle body15 = GoogleFonts.plusJakartaSans(
    fontSize: 15,
    color: kTextPrimary,
  );

  static final TextStyle body15Bold = GoogleFonts.plusJakartaSans(
    fontSize: 15,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  );

  static final TextStyle body14 = GoogleFonts.plusJakartaSans(
    fontSize: 14,
    color: kTextPrimary,
  );

  static final TextStyle body14Bold = GoogleFonts.plusJakartaSans(
    fontSize: 14,
    fontWeight: FontWeight.bold,
    color: kTextPrimary,
  );

  static final TextStyle body14SemiBold = GoogleFonts.plusJakartaSans(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: kTextPrimary,
  );

  static final TextStyle body13 = GoogleFonts.plusJakartaSans(
    fontSize: 13,
    color: kTextPrimary,
  );

  static final TextStyle body13Bold = GoogleFonts.plusJakartaSans(
    fontSize: 13,
    fontWeight: FontWeight.bold,
    color: kTextPrimary,
  );

  static final TextStyle body13SemiBold = GoogleFonts.plusJakartaSans(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: kTextPrimary,
  );

  static final TextStyle body13Medium = GoogleFonts.plusJakartaSans(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: kTextPrimary,
  );

  static final TextStyle body12 = GoogleFonts.plusJakartaSans(
    fontSize: 12,
    color: kTextSecondary,
  );

  static final TextStyle body12Bold = GoogleFonts.plusJakartaSans(
    fontSize: 12,
    fontWeight: FontWeight.bold,
    color: kTextSecondary,
  );

  static final TextStyle body11 = GoogleFonts.plusJakartaSans(
    fontSize: 11,
    color: kTextSecondary,
  );

  static final TextStyle body10 = GoogleFonts.plusJakartaSans(
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: kTextSecondary,
  );

  // ============================================================================
  // SECONDARY TEXT (Gray colors)
  // ============================================================================

  static final TextStyle secondary14 = GoogleFonts.plusJakartaSans(
    fontSize: 14,
    color: kTextSecondary,
  );

  static final TextStyle secondary14SemiBold = GoogleFonts.plusJakartaSans(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: kTextSecondary,
  );

  static final TextStyle secondary13 = GoogleFonts.plusJakartaSans(
    fontSize: 13,
    color: kTextSecondary,
  );

  static final TextStyle secondary13Bold = GoogleFonts.plusJakartaSans(
    fontSize: 13,
    fontWeight: FontWeight.bold,
    color: kTextSecondary,
  );

  static final TextStyle secondary12 = GoogleFonts.plusJakartaSans(
    fontSize: 12,
    color: kTextSecondary,
  );

  static final TextStyle secondary12Bold = GoogleFonts.plusJakartaSans(
    fontSize: 12,
    fontWeight: FontWeight.bold,
    color: kTextSecondary,
  );

  // ============================================================================
  // ACCENT (Green) TEXT
  // ============================================================================

  static final TextStyle accent14Bold = GoogleFonts.plusJakartaSans(
    fontSize: 14,
    fontWeight: FontWeight.bold,
    color: kAccentColor,
  );

  static final TextStyle accent13Bold = GoogleFonts.plusJakartaSans(
    fontSize: 13,
    fontWeight: FontWeight.bold,
    color: kAccentColor,
  );

  static final TextStyle accent16Bold = GoogleFonts.plusJakartaSans(
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: kAccentColor,
  );

  // ============================================================================
  // TAB BAR STYLES
  // ============================================================================

  static final TextStyle tabLabel = GoogleFonts.plusJakartaSans(
    fontWeight: FontWeight.w700,
    fontSize: 13,
  );

  static final TextStyle tabLabelUnselected = GoogleFonts.plusJakartaSans(
    fontWeight: FontWeight.w600,
    fontSize: 13,
  );

  // ============================================================================
  // BUTTON TEXT
  // ============================================================================

  static final TextStyle button15Bold = GoogleFonts.plusJakartaSans(
    fontWeight: FontWeight.bold,
    fontSize: 15,
    color: Colors.white,
  );

  static final TextStyle buttonBold = GoogleFonts.plusJakartaSans(
    fontWeight: FontWeight.bold,
  );

  // ============================================================================
  // NAVIGATION BAR
  // ============================================================================

  static final TextStyle navLabel10 = GoogleFonts.plusJakartaSans(
    fontSize: 10,
    fontWeight: FontWeight.w500,
  );

  static final TextStyle navLabel10Selected = GoogleFonts.plusJakartaSans(
    fontSize: 10,
    fontWeight: FontWeight.w600,
  );

  // ============================================================================
  // SPECIAL CASES
  // ============================================================================

  static final TextStyle tiny11Gray = GoogleFonts.plusJakartaSans(
    fontSize: 11,
    color: const Color(0xFF888888),
  );

  static final TextStyle error = GoogleFonts.plusJakartaSans(
    color: Colors.redAccent,
    fontWeight: FontWeight.bold,
  );

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /// Create a custom text style based on existing style with color override
  static TextStyle withColor(TextStyle base, Color color) {
    return base.copyWith(color: color);
  }

  /// Create a custom text style based on existing style with opacity
  static TextStyle withOpacity(TextStyle base, double opacity) {
    return base.copyWith(color: base.color?.withOpacity(opacity));
  }

  /// Create a custom text style based on existing style with size override
  static TextStyle withSize(TextStyle base, double fontSize) {
    return base.copyWith(fontSize: fontSize);
  }

  /// Create a custom text style based on existing style with weight override
  static TextStyle withWeight(TextStyle base, FontWeight weight) {
    return base.copyWith(fontWeight: weight);
  }
}
