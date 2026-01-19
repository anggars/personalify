import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/screens/main_navigation.dart';

/// Animated Login Screen mimicking the Web Design
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final AuthService _authService = AuthService();
  bool _isLoading = false;
  String? _errorMessage;
  
  // Animation State
  bool _isTechStackVisible = false;

  @override
  void initState() {
    super.initState();
    _checkExistingAuth();
  }

  Future<void> _checkExistingAuth() async {
    final isAuth = await _authService.isAuthenticated();
    if (isAuth && mounted) {
      final spotifyId = await _authService.getSpotifyId();
      if (spotifyId != null) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => const MainNavigation()),
        );
      }
    }
  }

  Future<void> _handleLogin() async {
    setState(() { _isLoading = true; _errorMessage = null; });
    try {
      final result = await _authService.loginWithSpotify();
      if (result != null && result['spotify_id'] != null) {
        if (mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (context) => const MainNavigation()),
          );
        }
      } else {
        setState(() { _errorMessage = 'Login failed.'; _isLoading = false; });
      }
    } catch (e) {
      setState(() { _errorMessage = 'Error: $e'; _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Colors & Fonts
    const kBgColor = Color(0xFF0a0a0a);
    const kAccentColor = Color(0xFF1DB954);
    
    return Scaffold(
      backgroundColor: kBgColor,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // 1. Animated Logo (Pill)
                GestureDetector(
                  onTap: () {
                    setState(() {
                      _isTechStackVisible = !_isTechStackVisible;
                    });
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 400),
                    curve: Curves.elasticOut,
                    width: _isTechStackVisible ? 180 : 60,
                    height: 60, // Smaller, more symmetric
                    decoration: BoxDecoration(
                      color: Colors.transparent,
                      borderRadius: BorderRadius.circular(30),
                    ),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        // Marquee Content (Tech Stack)
                        AnimatedOpacity(
                          duration: const Duration(milliseconds: 300),
                          opacity: _isTechStackVisible ? 1.0 : 0.0,
                          child: Container(
                            decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.05),
                                borderRadius: BorderRadius.circular(30),
                                border: Border.all(color: Colors.white10)
                            ),
                            child: ListView(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              children: const [
                                Icon(FontAwesomeIcons.spotify, color: kAccentColor, size: 20),
                                SizedBox(width: 12),
                                Icon(FontAwesomeIcons.react, color: Colors.blue, size: 20),
                                SizedBox(width: 12),
                                Icon(FontAwesomeIcons.python, color: Colors.yellow, size: 20),
                                SizedBox(width: 12),
                                Icon(FontAwesomeIcons.robot, color: Colors.purple, size: 20),
                              ],
                            ),
                          ),
                        ),
                        
                        // Spotify Logo (Centered)
                        AnimatedOpacity(
                          duration: const Duration(milliseconds: 300),
                          opacity: _isTechStackVisible ? 0.0 : 1.0,
                          child: Hero(
                            tag: 'logo',
                            child: Image.network(
                              'https://cdn.simpleicons.org/spotify/1DB954',
                              height: 60, width: 60,
                              fit: BoxFit.contain,
                              errorBuilder: (_,__,___) => const Icon(FontAwesomeIcons.spotify, color: kAccentColor, size: 60),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                
                const SizedBox(height: 20), // Reduced from 32

                // 2. Hero Text
                RichText(
                  textAlign: TextAlign.center,
                  text: TextSpan(
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 36, // ~text-4xl
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      height: 1.2,
                    ),
                    children: const [
                      TextSpan(text: 'Welcome to '),
                      TextSpan(text: 'Personalify', style: TextStyle(color: kAccentColor)),
                      TextSpan(text: '!'),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // 3. Typewriter Subtitle
                SizedBox(
                  height: 70, // Adjusted for smaller font
                  child: TypewriterText(
                    text: "Discover your most played artists, tracks, and genres through Spotify insights. Go beyond the sound and analyze the emotion hidden in the lyrics. Let's explore your unique taste in music.",
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12.5, // Smaller font to fit 3 lines
                      color: const Color(0xFFB3B3B3),
                      fontWeight: FontWeight.w500,
                      height: 1.4,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),

                const SizedBox(height: 20), // Reduced from 48

                // 4. Glass Login Button
                GestureDetector(
                  onTap: _isLoading ? null : _handleLogin,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    height: 54,
                    constraints: const BoxConstraints(maxWidth: 200), // Fit to text width
                    decoration: BoxDecoration(
                      color: kAccentColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white24),
                      boxShadow: [
                         BoxShadow(color: kAccentColor.withOpacity(0.1), blurRadius: 20, offset: const Offset(0, 4))
                      ]
                    ),
                    child: Center(
                       child: _isLoading 
                        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text(
                            "Login with Spotify",
                            style: GoogleFonts.plusJakartaSans(
                               fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 0.5
                            ),
                          ),
                    ),
                  ),
                ),
                
                 if (_errorMessage != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 24),
                    child: Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent)),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// --- TYPEWRITER WIDGET ---

class TypewriterText extends StatefulWidget {
  final String text;
  final TextStyle? style;
  final TextAlign textAlign;
  final Duration speed;

  const TypewriterText({
    super.key, 
    required this.text, 
    this.style, 
    this.textAlign = TextAlign.start,
    this.speed = const Duration(milliseconds: 30),
  });

  @override
  State<TypewriterText> createState() => _TypewriterTextState();
}

class _TypewriterTextState extends State<TypewriterText> {
  String _displayedString = "";
  late Timer _timer;
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _startTyping();
  }

  void _startTyping() {
    _timer = Timer.periodic(widget.speed, (timer) {
      if (_currentIndex < widget.text.length) {
        if (mounted) {
          setState(() {
            _displayedString += widget.text[_currentIndex];
            _currentIndex++;
          });
        }
      } else {
        timer.cancel();
      }
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RichText(
      textAlign: widget.textAlign,
      text: TextSpan(
        style: widget.style,
        children: [
          TextSpan(text: _displayedString),
          if (_currentIndex < widget.text.length)
             const TextSpan(text: "|", style: TextStyle(color: Color(0xFF1DB954))), // Cursor
        ],
      ),
    );
  }
}
