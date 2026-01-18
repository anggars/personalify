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
