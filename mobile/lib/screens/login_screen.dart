import 'package:flutter/material.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/screens/main_navigation.dart';

/// Login screen with Spotify authentication
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final AuthService _authService = AuthService();
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _checkExistingAuth();
  }

  /// Check if user is already authenticated
  Future<void> _checkExistingAuth() async {
    final isAuth = await _authService.isAuthenticated();
    if (isAuth && mounted) {
      final spotifyId = await _authService.getSpotifyId();
      if (spotifyId != null) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (context) => const MainNavigation(),
          ),
        );
      }
    }
  }

  /// Handle Spotify login
  Future<void> _handleLogin() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final result = await _authService.loginWithSpotify();

      if (result != null && result['spotify_id'] != null) {
        if (mounted) {
          // Navigate to main navigation
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(
              builder: (context) => const MainNavigation(),
            ),
          );
        }
      } else {
        setState(() {
          _errorMessage = 'Login failed. Please try again.';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Login error: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212), // Dark background
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo/App Name
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF1DB954).withOpacity(0.2),
                        blurRadius: 30,
                        spreadRadius: 10,
                      )
                    ],
                  ),
                  child: Image.network(
                     'https://cdn.simpleicons.org/spotify/1DB954',
                     height: 80,
                     width: 80,
                     errorBuilder: (context, error, stackTrace) => const Icon(Icons.music_note, size: 80, color: Color(0xFF1DB954)),
                  ),
                ),
                const SizedBox(height: 48),

                // Hero Text: "Welcome to Personalify!"
                RichText(
                  textAlign: TextAlign.center,
                  text: const TextSpan(
                    style: TextStyle(
                      fontSize: 32, 
                      fontWeight: FontWeight.w800, 
                      color: Colors.white,
                      height: 1.2,
                    ),
                    children: [
                       TextSpan(text: 'Welcome to '),
                       TextSpan(text: 'Personalify', style: TextStyle(color: Color(0xFF1DB954))),
                       TextSpan(text: '!'),
                    ],
                  ),
                ),
                
                const SizedBox(height: 16),

                // Subtext
                const Text(
                  'Discover your most played artists, tracks, and genres through Spotify insights. Go beyond the sound and analyze the emotion hidden in the lyrics.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: Color(0xFFB3B3B3),
                    height: 1.5,
                  ),
                ),
                
                const SizedBox(height: 48),

                // Login Button
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1DB954),
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(30),
                    ),
                    elevation: 5,
                    shadowColor: const Color(0xFF1DB954).withOpacity(0.5),
                  ),
                  child: _isLoading 
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2.5),
                      )
                    : const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.login, size: 24),
                          SizedBox(width: 12),
                          Text(
                            'Login with Spotify',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                ),

                // Error Message
                if (_errorMessage != null) ...[
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.red.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.red.withOpacity(0.5)),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(
                        color: Colors.red,
                        fontSize: 14,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
