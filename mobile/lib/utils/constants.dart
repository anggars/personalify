import 'package:flutter/material.dart';

/// Application-wide constants
class AppConstants {
  // API Configuration
  // Using Vercel production (redirect_uri whitelisted in Spotify)
  static const String baseUrl = 'https://personalify.vercel.app';
  
  // Local development (requires adding redirect_uri to Spotify Dashboard):
  // static const String baseUrl = 'http://10.229.170.164:8000';
  // static const String baseUrl = 'http://10.0.2.2:8000'; // Emulator
  
  // OAuth Configuration
  static const String callbackScheme = 'personalify';
  static const String callbackUrl = 'personalify://callback';
  
  // Theme Colors (Matching Web Dark Mode)
  static const int primaryGreen = 0xFF1DB954; // Spotify Green
  static const int backgroundDark = 0xFF121212;
  static const int cardDark = 0xFF1E1E1E;
  static const int textPrimary = 0xFFFFFFFF;
  static const int textSecondary = 0xFFB3B3B3;
  
  // Secure Storage Keys
  static const String tokenKey = 'access_token';
  static const String spotifyIdKey = 'spotify_id';
  
  // API Endpoints
  static const String loginEndpoint = '/login';
  static const String dashboardEndpoint = '/api/dashboard';
  static const String syncEndpoint = '/sync/top-data';
}

// Global Color Constants (Requested for consistency)
const Color kBgColor = Color(0xFF0a0a0a);
const Color kSurfaceColor = Color(0xFF181818); 
const Color kAccentColor = Color(0xFF1DB954); 
const Color kTextPrimary = Color(0xFFFFFFFF);
const Color kTextSecondary = Color(0xFFB3B3B3);
const Color kBorderColor = Color(0xFF282828);
// Glass Aesthetics
const double kGlassBlurSigma = 3.0; // OPTIMIZED: Reduced from 5.0 for better performance
const double kGlassOpacity = 0.8; // 80% Opacity for glass effect
