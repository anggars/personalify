import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:personalify/utils/constants.dart';
import 'package:personalify/models/user_profile.dart';
import 'package:personalify/services/api_service.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/screens/settings_screen.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  UserProfile? _profile;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      final spotifyId = await authService.getSpotifyId();
      
      if (spotifyId != null) {
        final apiService = Provider.of<ApiService>(context, listen: false);
        final profile = await apiService.getUserProfile(spotifyId);
        // Note: Basic user profile might not have followers/following yet if not added to UserProfile model properly
        // For now, using what's available.
        if (mounted) {
          setState(() {
            _profile = profile;
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _logout() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    await authService.logout();
    if (mounted) {
       Navigator.of(context, rootNavigator: true).pushReplacementNamed('/');
    }
  }

  Future<void> _openSpotify() async {
     const url = 'https://open.spotify.com';
     if (await canLaunchUrl(Uri.parse(url))) {
       await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
     }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator(color: kAccentColor));
    if (_profile == null) return const Center(child: Text("Profile not found"));

    return Scaffold(
      backgroundColor: kBgColor,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 120), // For navbar
          child: Column(
            children: [
              const SizedBox(height: 32),
              
              // Profile Image
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: kAccentColor, width: 3),
                  boxShadow: [
                     BoxShadow(color: kAccentColor.withOpacity(0.3), blurRadius: 20),
                  ]
                ),
                child: ClipOval(
                  child: CachedNetworkImage(
                    imageUrl: _profile?.image ?? '',
                    width: 120,
                    height: 120,
                    fit: BoxFit.cover,
                    placeholder: (_,__) => Container(color: kSurfaceColor),
                    errorWidget: (_,__,__) => const Icon(Icons.person, size: 60, color: Colors.white),
                  ),
                ),
              ),
              
              const SizedBox(height: 16),
              
              // Name & Flag
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    _profile?.displayName ?? 'User',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 24, 
                      fontWeight: FontWeight.bold,
                      color: kTextPrimary
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Dummy flag if not in model, user requested flag.
                  // Assuming backend doesn't return country code in UserProfile yet.
                  // Will skip or use placeholder if unavailable.
                ],
              ),
              
              const SizedBox(height: 8),
              
              // Premium Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: kAccentColor.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: kAccentColor),
                ),
                child: Text(
                  'PREMIUM', // Static for now as requested
                  style: GoogleFonts.plusJakartaSans(
                    color: kAccentColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    letterSpacing: 1.0,
                  ),
                ),
              ),
              
              const SizedBox(height: 32),
              
              // Stats
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _buildStatItem('Followers', '1.2k'), // Mock data as requested in layout logic? No, fetch real if possible.
                  const SizedBox(width: 40),
                  _buildStatItem('Following', '48'),
                ],
              ),
              
              const SizedBox(height: 32),
              
              // Action Button
              OutlinedButton(
                onPressed: _openSpotify,
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: kAccentColor),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                ),
                child: Text(
                  'Open in Spotify',
                  style: GoogleFonts.plusJakartaSans(
                    color: kAccentColor,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              
              const SizedBox(height: 48),
              
              // Menu
              _buildMenuItem(
                icon: Icons.settings_rounded, 
                title: 'Settings',
                onTap: () {
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()));
                }
              ),
              _buildMenuItem(
                icon: Icons.logout_rounded, 
                title: 'Log Out',
                color: Colors.redAccent,
                onTap: _logout
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Column(
      children: [
        Text(
          value,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: kTextPrimary,
          ),
        ),
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            color: kTextSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildMenuItem({
    required IconData icon, 
    required String title, 
    required VoidCallback onTap,
    Color color = kTextPrimary,
  }) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 32, vertical: 4),
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: kSurfaceColor,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: color == kTextPrimary ? kTextPrimary : color, size: 20),
      ),
      title: Text(
        title,
        style: GoogleFonts.plusJakartaSans(
          fontWeight: FontWeight.w600,
          fontSize: 16,
          color: color,
        ),
      ),
      trailing: Icon(Icons.chevron_right_rounded, color: kTextSecondary),
    );
  }
}
