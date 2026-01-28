import 'package:dio/dio.dart';
import 'package:personalify/models/user_profile.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/utils/constants.dart';
import 'package:flutter/material.dart';
import 'package:personalify/utils/navigation.dart';
import 'package:personalify/screens/login_screen.dart';

/// API service for backend communication
class ApiService {
  late final Dio _dio;
  final AuthService _authService;

  // TRACKING FOR CONDITIONAL LOGOUT
  bool _onAnalyzerScreen = false;
  void setAnalyzerScreen(bool isActive) {
    _onAnalyzerScreen = isActive;
    print("API: Analyzer Screen Active: $isActive");
  }

  ApiService(this._authService) {
    _dio = Dio(BaseOptions(
      baseUrl: AppConstants.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
    ));

    // Add interceptor to automatically inject Authorization header
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        // Get access token from secure storage
        final token = await _authService.getAccessToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
          print('API: Added Authorization header');
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        // Handle 401 Unauthorized OR 403 Forbidden - token expired/invalid
        final status = error.response?.statusCode;
        if (status == 401 || status == 403) {
          print('🚨 API ERROR: $status - Token expired.');
          
          // CONDITIONAL LOGOUT: Skip if on Analyzer Screen
          if (_onAnalyzerScreen) {
             print('⚠️ IGNORING LOGOUT because user is on Analyzer Screen');
             // Optionally show a toast here via navigation context if complex
             return handler.next(error); // Pass error so UI can handle it (e.g. show "Login required")
          }

          print('Auto Logout initiated.');
          
          // Force Logout & Redirect
          await _authService.logout();
          
          final nav = navigatorKey.currentState;
          if (nav != null) {
            nav.pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const LoginScreen()),
              (route) => false,
            );
          }
          
          // Reject to stop downstream processing
          return handler.reject(error);
        } else {
           print("⚠️ API ERROR: $status. ${error.message}");
        }
        return handler.next(error);
      },
    ));
  }

  /// Get user profile and dashboard data
  /// Backend doesn't have /top-data endpoint, so we directly sync
  Future<UserProfile?> getUserProfile(String spotifyId,
      {String timeRange = 'short_term'}) async {
    print('API: Fetching profile for $spotifyId via sync endpoint');
    
    // 1. Try SYNC (Refreshes Data + AI Analysis)
    var profile = await syncTopData(timeRange);
    
    // 2. Fallback: If Sync fails (e.g. HuggingFace Down -> Backend 500)
    // Try to fetch existing data without sync
    if (profile == null) {
      print('API: Sync failed (likely HF down). Attempting readout fallback...');
      final fallbackJson = await getFullUserProfile();
      if (fallbackJson != null) {
        print('API: Fallback data loaded successfully.');
        return UserProfile.fromJson(fallbackJson);
      }
    }
    
    return profile;
  }

  /// Trigger massive data sync (scrapes Spotify and updates DB/Cache)
  Future<UserProfile?> syncTopData(String timeRange) async {
    try {
      final token = await _authService.getAccessToken();
      if (token == null) throw Exception("No token for sync");

      final requestUrl = '/sync/top-data?access_token=${token.substring(0, 20)}...&time_range=$timeRange';
      print("========================================");
      print("API: Syncing data... (This may take 5-10 seconds)");
      print("REQUEST URL: $requestUrl");
      print("BASE URL: ${AppConstants.baseUrl}");
      print("FULL URL: ${AppConstants.baseUrl}/sync/top-data");
      print("========================================");
      
      final response = await _dio.get(
        '/sync/top-data',
        queryParameters: {
          'access_token': token, // Required by backend endpoint
          'time_range': timeRange,
          'limit': 20, // FIX: Use top 20 for emotion analysis (was default 10)
        },
        options: Options(
          receiveTimeout: const Duration(seconds: 30), // Sync can be slow (hybrid fallback takes ~6-8s)
        )
      );

      print("========================================");
      print("RESPONSE STATUS: ${response.statusCode}");
      print("RESPONSE DATA TYPE: ${response.data.runtimeType}");
      print("========================================");

      if (response.statusCode == 200) {
        print("API: Sync Complete!");
        return UserProfile.fromJson(response.data as Map<String, dynamic>);
      }
    } catch (e) {
      print("========================================");
      print("API: Sync Failed with exception:");
      print(e);
      return null;
    }
  }

  /// NEW: Get recently played tracks
  Future<List<dynamic>> getRecentlyPlayed() async {
    try {
      // Must use authService to get fresh token if using custom dio interceptor isn't fully set up yet
      // However, assuming _dio has the interceptor or we pass headers? 
      // Based on previous code, _dio might rely on basic config. 
      // Let's ensure headers are set if needed.
      
      final response = await _dio.get('/api/spotify/recently-played?limit=50');
      if (response.statusCode == 200) {
        return response.data as List<dynamic>;
      }
      return [];
    } catch (e) {
      print('API Error (History): $e');
      // Return empty list instead of throwing to prevent red screen
      return [];
    }
  }
  
  /// NEW: Get Detailed User Profile (Direct from /v1/me via Backend)
  Future<Map<String, dynamic>?> getFullUserProfile() async {
    try {
      final response = await _dio.get('/api/user-profile');
      if (response.statusCode == 200) {
        return response.data as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      print('API Error (Profile): $e');
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // ANALYZER & GENIUS METHODS
  // ---------------------------------------------------------------------------

  /// Analyze raw lyrics text
  Future<Map<String, dynamic>> analyzeLyrics(String text) async {
    try {
      final response = await _dio.post(
        '/analyze-lyrics',
        data: {'lyrics': text},
      );
      return response.data as Map<String, dynamic>;
    } catch (e) {
      print('API Error analyzeLyrics: $e');
      rethrow;
    }
  }

  /// Autocomplete artist name
  Future<List<dynamic>> autocompleteArtist(String query) async {
    // Note: Mobile might not have this endpoint yet, using search as fallback or empty
    // If backend doesn't support autocomplete, return empty or implement similar logic
    return []; 
  }

  /// Search for artist (Genius)
  Future<List<dynamic>> searchArtist(String query) async {
    try {
      final response = await _dio.get(
        '/api/genius/search-artist',
        queryParameters: {'q': query},
      );
      // Backend returns {"artists": [...]}
      return response.data['artists'] as List<dynamic>;
    } catch (e) {
      print('API Error searchArtist: $e');
      return [];
    }
  }

  /// Get songs by artist (Genius)
  Future<List<dynamic>> getArtistSongs(int artistId) async {
    try {
      final response = await _dio.get('/api/genius/artist-songs/$artistId');
      return response.data['songs'] as List<dynamic>;
    } catch (e) {
      print('API Error getArtistSongs: $e');
      return [];
    }
  }

  /// Get lyrics and emotion analysis for a song (Genius)
  Future<Map<String, dynamic>> getLyricsEmotion(int songId) async {
    try {
      final response = await _dio.get('/api/genius/lyrics/$songId');
      return response.data as Map<String, dynamic>;
    } catch (e) {
      print('API Error getLyricsEmotion: $e');
      rethrow;
    }
  }

  /// Get top tracks for a user
  Future<List<dynamic>?> getTopTracks(String spotifyId,
      {String timeRange = 'short_term', int limit = 10}) async {
    try {
      print('API: Fetching top tracks for $spotifyId');

      final response = await _dio.get(
        '/top-data',
        queryParameters: {
          'spotify_id': spotifyId,
          'time_range': timeRange,
          'limit': limit,
          'sort': 'popularity',
        },
      );

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        return data['tracks'] as List<dynamic>?;
      }
      return null;
    } on DioException catch (e) {
      print('API ERROR: ${e.message}');
      rethrow;
    }
  }

  /// Get user's sync history
  Future<Map<String, dynamic>?> getRecentHistory(String spotifyId) async {
    try {
      print('API: Fetching sync history for $spotifyId');

      final response = await _dio.get(
        '/history',
        queryParameters: {'spotify_id': spotifyId},
      );

      if (response.statusCode == 200) {
        return response.data as Map<String, dynamic>;
      }
      return null;
    } on DioException catch (e) {
      print('API ERROR: ${e.message}');
      rethrow;
    }
  }
  /// Request Access to Dev App
  Future<bool> requestAccess(String name, String email) async {
    try {
      // Use _dio directly. If it fails due to auth interceptor, create a fresh dio instance?
      // But this endpoint is public/admin, shouldn't require Spotify Auth.
      // However, my interceptor adds Token if available. 
      // If user is NOT logged in, token is null. OK.
      
      final response = await _dio.post(
        '/request-access',
        data: {'name': name, 'email': email},
      );
      return response.statusCode == 200;
    } catch (e) {
      print('API Error requestAccess: $e');
      return false;
    }
  }
}
