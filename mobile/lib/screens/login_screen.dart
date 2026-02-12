import 'dart:async';
import 'dart:ui'; // Added for BackdropFilter
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/screens/main_navigation.dart';
import 'package:provider/provider.dart';
import 'package:personalify/services/api_service.dart';
import 'package:personalify/widgets/top_toast.dart';

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
  // bool _isTechStackVisible = false; // Removed unused state

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
      
      // Check for errors
      if (result != null && result.containsKey('error')) {
        if (result['error'] == 'access_denied') {
          setState(() { _isLoading = false; });
          if (mounted) _showRequestAccessDialog();
          return;
        }
      }

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
      backgroundColor: Colors.transparent, // Background handled by Container
      resizeToAvoidBottomInset: false, // PREVENT LAYOUT THRASHING
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          color: Color(0xFF121212),
          image: DecorationImage(
            image: AssetImage('assets/images/login_bg.png'), // Ensure this exists, or remove if not using image
            fit: BoxFit.cover,
            opacity: 0.6,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
               // Manual Padding for Keyboard
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
                left: 24, 
                right: 24
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                // 1. Static Logo
                Hero(
                  tag: 'logo',
                  child: Image.network(
                    'https://cdn.simpleicons.org/spotify/1DB954',
                    height: 60, width: 60,
                    fit: BoxFit.contain,
                    errorBuilder: (_,__,___) => const Icon(FontAwesomeIcons.spotify, color: kAccentColor, size: 60),
                  ),
                ),
                
                const SizedBox(height: 16), // Reduced from 32

                // 2. Hero Text (Single White Color)
                Text(
                  'Welcome to Personalify!',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 40,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    height: 1.2,
                  ),
                ),

                const SizedBox(height: 16),

                // 3. Static Subtitle (No Typing)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    "Discover your most played artists, tracks, and genres through Spotify insights. Go beyond the sound and analyze the essence hidden in the lyrics. Let's explore your unique taste in music.",
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12.5, // Revert to 12.5
                      color: const Color(0xFFB3B3B3),
                      fontWeight: FontWeight.w500,
                      height: 1.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),

                const SizedBox(height: 22), // Breathing room

                // 4. Glass Login Button (No Shadow, No Green, Reverted Radius/Icon)
                // 4. Glass Login Button (Optimized: Removed Blur)
                GestureDetector(
                  onTap: _isLoading ? null : _handleLogin,
                  child: Container(
                    height: 45, // Reduced from 54
                    width: 160, // Reduced from 200
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(16), // Reverted to 16
                      border: Border.all(color: Colors.white.withOpacity(0.2)),
                    ),
                    child: _isLoading 
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text(
                          "Login with Spotify",
                          style: GoogleFonts.plusJakartaSans(
                             fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 0.5
                          ),
                      ),
                  ),
                ), // Close GestureDetector

                const SizedBox(height: 16),
                
                if (_errorMessage != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 24),
                    child: Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent)),
                  ),
              ],
            ),
          ),
        ), // Center
      ), // SafeArea
      ), // Container (ADDED)
    ); // Scaffold
  }

  void _showRequestAccessDialog() {
    final nameController = TextEditingController();
    final emailController = TextEditingController();
    bool isSubmitting = false;

    // Premium Dialog Design with BackdropFilter (Matching Next.js)
    showGeneralDialog(
      context: context,
      barrierDismissible: false,
      barrierLabel: "Request Access",
      barrierColor: Colors.transparent, // Handled by BackdropFilter
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (context, anim1, anim2) {
        return StatefulBuilder(
          builder: (context, setState) => Stack(
            children: [
              // Full Screen Blur Backdrop (Matching Next.js backdrop-blur-md)
              Positioned.fill(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                  child: Container(color: Colors.black.withOpacity(0.6)),
                ),
              ),
              
              // Dialog Content
              Center(
                child: Material(
                  color: Colors.transparent,
                  child: Container(
                    width: MediaQuery.of(context).size.width * 0.85,
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      // Matching Next.js: bg-white/5 with backdrop-blur-xl
                      color: const Color(0xFF1a1a1a).withOpacity(0.95),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.white.withOpacity(0.2)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.5),
                          blurRadius: 40,
                          offset: const Offset(0, 20)
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Header - Matching Next.js
                        Text(
                          "Request Access",
                          style: GoogleFonts.plusJakartaSans(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            letterSpacing: -0.5,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        
                        Text(
                          "Spotify dev mode restriction.\nEnter details to get whitelisted!",
                          style: GoogleFonts.plusJakartaSans(
                            color: Colors.white.withOpacity(0.6),
                            fontSize: 14,
                            height: 1.5,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        
                        const SizedBox(height: 24),
                        
                        // Input 1: Your Name (Matching Next.js)
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.2),
                            border: Border.all(color: Colors.white.withOpacity(0.1)),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: TextField(
                            controller: nameController,
                            style: GoogleFonts.plusJakartaSans(
                              color: Colors.white,
                              fontWeight: FontWeight.w500,
                            ),
                            decoration: InputDecoration(
                              hintText: "Your Name",
                              hintStyle: GoogleFonts.plusJakartaSans(color: Colors.white.withOpacity(0.3)),
                              border: InputBorder.none,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            ),
                          ),
                        ),
                        
                        const SizedBox(height: 16),
                        
                        // Input 2: Spotify Email Address (Matching Next.js)
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.2),
                            border: Border.all(color: Colors.white.withOpacity(0.1)),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: TextField(
                            controller: emailController,
                            keyboardType: TextInputType.emailAddress,
                            style: GoogleFonts.plusJakartaSans(
                              color: Colors.white,
                              fontWeight: FontWeight.w500,
                            ),
                            decoration: InputDecoration(
                              hintText: "Spotify Email Address",
                              hintStyle: GoogleFonts.plusJakartaSans(color: Colors.white.withOpacity(0.3)),
                              border: InputBorder.none,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            ),
                          ),
                        ),
                        
                        const SizedBox(height: 24),
                        
                        // Buttons Row - Glass Effect (Matching Next.js)
                        Row(
                          children: [
                            // Cancel Button - Glass Red
                            Expanded(
                              child: GestureDetector(
                                onTap: () => Navigator.pop(context),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  decoration: BoxDecoration(
                                    color: Colors.red.withOpacity(0.1),
                                    border: Border.all(color: Colors.red.withOpacity(0.3)),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    "Cancel",
                                    style: GoogleFonts.plusJakartaSans(
                                      color: Colors.red[400],
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            // Submit Button - Glass Green
                            Expanded(
                              child: GestureDetector(
                                onTap: isSubmitting ? null : () async {
                                  if (nameController.text.isEmpty || emailController.text.isEmpty) {
                                    if (context.mounted) {
                                      showTopToast(context, "Please fill all fields", type: ToastType.error);
                                    }
                                    return;
                                  }
                                  
                                  if (!emailController.text.contains('@')) {
                                    if (context.mounted) {
                                      showTopToast(context, "Please enter a valid email", type: ToastType.error);
                                    }
                                    return;
                                  }
                                  
                                  setState(() => isSubmitting = true);
                                  final api = ApiService(_authService);
                                  final success = await api.requestAccess(nameController.text, emailController.text);
                                  
                                  if (context.mounted) {
                                    Navigator.pop(context);
                                    showTopToast(
                                      context,
                                      success ? "Request sent! We'll review it soon." : "Failed to send. Try again.",
                                      type: success ? ToastType.success : ToastType.error,
                                    );
                                  }
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF1DB954).withOpacity(0.15),
                                    border: Border.all(color: const Color(0xFF1DB954).withOpacity(0.5)),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  alignment: Alignment.center,
                                  child: isSubmitting 
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Color(0xFF1DB954),
                                        )
                                      )
                                    : Text(
                                        "Send Request",
                                        style: GoogleFonts.plusJakartaSans(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                ),
                              ),
                            ),
                          ],
                        )
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
