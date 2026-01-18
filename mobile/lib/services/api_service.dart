import 'package:dio/dio.dart';
import 'package:personalify/models/user_profile.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/utils/constants.dart';
import 'package:flutter/material.dart';
import 'package:personalify/main.dart';
import 'package:personalify/screens/login_screen.dart';

/// API service for backend communication
class ApiService {
  late final Dio _dio;
  final AuthService _authService;

  ApiService(this._authService) {
    _dio = Dio(BaseOptions(
      baseUrl: AppConstants.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
    ));



// ... (existing imports)

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
        // Handle 401 Unauthorized - token expired
        if (error.response?.statusCode == 401) {
          print('API ERROR: 401 Unauthorized - Token expired');
          // Clear auth data and force re-login
          await _authService.logout();
          
          // Use Global Navigator Key to push Login Screen
          // Removing all previous routes to prevent back button from returning
          navigatorKey.currentState?.pushAndRemoveUntil(
            MaterialPageRoute(builder: (context) => const LoginScreen()),
            (route) => false,
          );
        }
        return handler.next(error);
      },
    ));
  }

  /// Get user profile and dashboard data
  /// Endpoint: GET /api/dashboard/{spotifyId}?time_range={timeRange}
  Future<UserProfile?> getUserProfile(String spotifyId,
      {String timeRange = 'short_term'}) async {
    try {
      print('API: Fetching dashboard for $spotifyId, timeRange: $timeRange');

      final response = await _dio.get(
        '${AppConstants.dashboardEndpoint}/$spotifyId',
        queryParameters: {'time_range': timeRange},
      );

      if (response.statusCode == 200) {
        print('API: Dashboard data received successfully');
        return UserProfile.fromJson(response.data as Map<String, dynamic>);
      } else {
        print('API ERROR: Unexpected status code ${response.statusCode}');
        return null;
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        print('API ERROR: Dashboard data not found. User needs to login again.');
      } else if (e.response?.statusCode == 401) {
        print('API ERROR: Unauthorized. Token expired or invalid.');
      } else {
        print('API ERROR: ${e.message}');
      }
      rethrow;
    } catch (e) {
      print('API ERROR: Unexpected error: $e');
      rethrow;
    }
  }

  /// Get top tracks for a user
  /// Endpoint: GET /top-data?spotify_id={spotifyId}&time_range={timeRange}
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
  /// Endpoint: GET /history?spotify_id={spotifyId}
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
  /// Analyze raw lyrics
  /// Endpoint: POST /analyze-lyrics
  Future<Map<String, dynamic>?> analyzeLyrics(String lyrics) async {
    try {
      final response = await _dio.post(
        '/analyze-lyrics',
        data: {'lyrics': lyrics},
      );
      if (response.statusCode == 200) {
        return response.data as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      print('API ERROR (analyzeLyrics): $e');
      rethrow;
    }
  }

  /// Search for an artist (Genius)
  /// Endpoint: GET /api/genius/search-artist?q={query}
  Future<List<dynamic>> searchArtist(String query) async {
    try {
      final response = await _dio.get(
        '/api/genius/search-artist',
        queryParameters: {'q': query},
      );
      if (response.statusCode == 200) {
        return (response.data['artists'] as List<dynamic>?) ?? [];
      }
      return [];
    } catch (e) {
      print('API ERROR (searchArtist): $e');
      rethrow;
    }
  }

  /// Autocomplete artist name
  /// Endpoint: GET /api/genius/autocomplete?q={query}
  Future<List<dynamic>> autocompleteArtist(String query) async {
    try {
      final response = await _dio.get(
        '/api/genius/autocomplete',
        queryParameters: {'q': query},
      );
      if (response.statusCode == 200) {
        return (response.data['results'] as List<dynamic>?) ?? [];
      }
      return [];
    } catch (e) {
      print('API ERROR (autocompleteArtist): $e');
      // Non-critical, return empty
      return [];
    }
  }

  /// Get songs by artist
  /// Endpoint: GET /api/genius/artist-songs/{artistId}
  Future<List<dynamic>> getArtistSongs(int artistId) async {
    try {
      final response = await _dio.get('/api/genius/artist-songs/$artistId');
      if (response.statusCode == 200) {
        return (response.data['songs'] as List<dynamic>?) ?? [];
      }
      return [];
    } catch (e) {
      print('API ERROR (getArtistSongs): $e');
      rethrow;
    }
  }

  /// Get lyrics and emotion analysis for a song
  /// Endpoint: GET /api/genius/lyrics/{songId}
  Future<Map<String, dynamic>?> getLyricsEmotion(int songId) async {
    try {
      final response = await _dio.get('/api/genius/lyrics/$songId');
      if (response.statusCode == 200) {
        return response.data as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      print('API ERROR (getLyricsEmotion): $e');
      rethrow;
    }
  }
}
