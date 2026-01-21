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
                    fontSize: 36, // ~text-4xl
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
                GestureDetector(
                  onTap: _isLoading ? null : _handleLogin,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16), // Reverted to 16
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                      child: Container(
                        height: 54,
                        width: 200,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.08), // Subtle Glass
                          borderRadius: BorderRadius.circular(16), // Reverted to 16
                          border: Border.all(color: Colors.white.withOpacity(0.2)),
                          // No Shadow
                        ),
                        child: _isLoading 
                          ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : Text(
                              "Login with Spotify",
                              style: GoogleFonts.plusJakartaSans(
                                 fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 0.5
                              ), // Reverted Size to 16, Removed Icon
                      ),
                    ),
                  ),
                ),
                
                const SizedBox(height: 16),
                
                // 5. Request Access (Dev Mode)
                TextButton(
                  onPressed: () => _showRequestAccessDialog(context),
                  child: Text(
                    "Request Access (Dev Mode)",
                    style: GoogleFonts.plusJakartaSans(
                      color: Colors.white54,
                      fontSize: 12,
                      decoration: TextDecoration.underline,
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

  void _showRequestAccessDialog(BuildContext context) {
    final nameController = TextEditingController();
    final emailController = TextEditingController();
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          backgroundColor: const Color(0xFF1E1E1E),
          title: Text("Request Access", style: GoogleFonts.plusJakartaSans(color: Colors.white, fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                "Spotify Dev Mode requires manual whitelisting. Request access below.",
                style: GoogleFonts.plusJakartaSans(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameController,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: "Your Name", hintText: "Budi"),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: emailController,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: "Spotify Email", hintText: "email@example.com"),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
            if (isSubmitting)
              const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
            else
              ElevatedButton(
                onPressed: () async {
                  if (nameController.text.isEmpty || emailController.text.isEmpty) return;
                  
                  setState(() => isSubmitting = true);
                  final api = Provider.of<ApiService>(context, listen: false);
                  final success = await api.requestAccess(nameController.text, emailController.text);
                  setState(() => isSubmitting = false);
                  Navigator.pop(context); // Close Dialog

                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(success ? "Request Sent! Check your email later." : "Failed to send request."),
                        backgroundColor: success ? Colors.green : Colors.red,
                      ),
                    );
                  }
                },
                child: const Text("Submit"),
              ),
          ],
        ),
      ),
    );
  }
}
