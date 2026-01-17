import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:personalify/utils/constants.dart';

/// Authentication service handling Spotify OAuth flow
class AuthService {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  /// Login with Spotify using OAuth
  /// Opens browser, redirects to backend /login endpoint
  /// Listens for callback on personalify://callback
  Future<Map<String, String>?> loginWithSpotify() async {
    try {
      // Construct login URL - backend will redirect to Spotify
      final loginUrl = '${AppConstants.baseUrl}${AppConstants.loginEndpoint}';

      print('FLUTTER AUTH: Initiating login to $loginUrl');

      // Start OAuth flow
      // Backend will redirect to Spotify, then back to /callback
      // /callback will redirect to personalify://callback with data
      final result = await FlutterWebAuth2.authenticate(
        url: loginUrl,
        callbackUrlScheme: AppConstants.callbackScheme,
      );

      print('FLUTTER AUTH: Received callback: $result');

      // Parse the callback URL
      final uri = Uri.parse(result);
      
      // Extract spotify_id from query parameters or fragments
      final spotifyId = uri.queryParameters['spotify_id'] ?? 
                        uri.fragment.split('spotify_id=').lastWhere(
                          (e) => e.isNotEmpty, 
                          orElse: () => '',
                        ).split('&').first;
      
      final accessToken = uri.queryParameters['access_token'] ?? 
                          uri.fragment.split('access_token=').lastWhere(
                            (e) => e.isNotEmpty, 
                            orElse: () => '',
                          ).split('&').first;

      if (spotifyId.isEmpty) {
        print('FLUTTER AUTH: Failed to extract spotify_id from callback');
        return null;
      }

      // Store credentials securely
      await _storage.write(key: AppConstants.spotifyIdKey, value: spotifyId);
      
      // If backend provides access token in callback, store it
      // Otherwise, we'll use the spotify_id to fetch data
      if (accessToken.isNotEmpty) {
        await _storage.write(key: AppConstants.tokenKey, value: accessToken);
      }

      print('FLUTTER AUTH: Login successful, spotify_id: $spotifyId');

      return {
        'spotify_id': spotifyId,
        if (accessToken.isNotEmpty) 'access_token': accessToken,
      };
    } catch (e) {
      print('FLUTTER AUTH ERROR: $e');
      return null;
    }
  }

  /// Get stored Spotify ID
  Future<String?> getSpotifyId() async {
    return await _storage.read(key: AppConstants.spotifyIdKey);
  }

  /// Get stored access token
  Future<String?> getAccessToken() async {
    return await _storage.read(key: AppConstants.tokenKey);
  }

  /// Check if user is authenticated
  Future<bool> isAuthenticated() async {
    final spotifyId = await getSpotifyId();
    return spotifyId != null && spotifyId.isNotEmpty;
  }

  /// Logout - clear all stored credentials
  Future<void> logout() async {
    await _storage.delete(key: AppConstants.spotifyIdKey);
    await _storage.delete(key: AppConstants.tokenKey);
    print('FLUTTER AUTH: Logged out successfully');
  }
}
