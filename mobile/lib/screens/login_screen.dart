import 'dart:async';
import 'dart:ui'; // Added for BackdropFilter
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/screens/main_navigation.dart';
import 'package:provider/provider.dart';
import 'package:personalify/services/api_service.dart';

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
                    "Discover your most played artists, tracks, and genres through Spotify insights. Go beyond the sound and analyze the emotion hidden in the lyrics. Let's explore your unique taste in music.",
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
    final contactController = TextEditingController();
    bool isSubmitting = false;

    // Premium Dialog Design
    showGeneralDialog(
      context: context,
      barrierDismissible: false,
      barrierLabel: "Request Access",
      barrierColor: Colors.black.withOpacity(0.8), // Darker Dim
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (context, anim1, anim2) {
        return StatefulBuilder(
          builder: (context, setState) => Center(
            child: Material(
              color: Colors.transparent,
              child: Container(
                width: MediaQuery.of(context).size.width * 0.85,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFF191414), // Spotify Black/Dark
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.white10),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.5), blurRadius: 20, offset: const Offset(0, 10)),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Header
                    Row(
                      children: [
                        const Icon(Icons.lock_person_rounded, color: Color(0xFF1DB954), size: 28),
                        const SizedBox(width: 12),
                        Text(
                          "Restricted Access",
                          style: GoogleFonts.plusJakartaSans(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    
                    Text(
                      "This application is currently in Private Beta (Dev Mode). To log in, you must request access.",
                      style: GoogleFonts.plusJakartaSans(color: const Color(0xFFB3B3B3), fontSize: 13, height: 1.5),
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Input - Name
                    _buildPremiumTextField(nameController, "Your Name", Icons.person_outline),
                    const SizedBox(height: 12),
                    
                    // Input - Contact
                    _buildPremiumTextField(contactController, "Telegram / Email", Icons.alternate_email),
                    
                    const SizedBox(height: 24),
                    
                    // Buttons
                    Row(
                      children: [
                        Expanded(
                          child: TextButton(
                            onPressed: () => Navigator.pop(context),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: Text("Cancel", style: GoogleFonts.plusJakartaSans(color: Colors.white54, fontWeight: FontWeight.w600)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: isSubmitting ? null : () async {
                              if (nameController.text.isEmpty || contactController.text.isEmpty) return;
                              
                              setState(() => isSubmitting = true);
                              final api = ApiService(_authService); // Ensure ApiService is instantiated
                              final success = await api.requestAccess(nameController.text, contactController.text);
                              
                              if (context.mounted) {
                                Navigator.pop(context);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      success ? "Request Sent! We'll review it soon." : "Failed to send. Try again.",
                                      style: GoogleFonts.plusJakartaSans(color: Colors.white),
                                    ),
                                    backgroundColor: success ? const Color(0xFF1DB954) : Colors.red,
                                    behavior: SnackBarBehavior.floating,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                );
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF1DB954),
                              foregroundColor: Colors.black,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              elevation: 0,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: isSubmitting 
                             ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                             : Text("Send Request", style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    )
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildPremiumTextField(TextEditingController controller, String label, IconData icon) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF282828),
        borderRadius: BorderRadius.circular(12),
      ),
      child: TextField(
        controller: controller,
        style: GoogleFonts.plusJakartaSans(color: Colors.white),
        decoration: InputDecoration(
          prefixIcon: Icon(icon, color: Colors.white24, size: 20),
          hintText: label,
          hintStyle: GoogleFonts.plusJakartaSans(color: Colors.white24),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        ),
      ),
    );
  }
}
