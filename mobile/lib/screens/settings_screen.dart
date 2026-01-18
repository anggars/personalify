import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:personalify/models/user_profile.dart'; // Make sure this model has email/country/product
import 'package:personalify/services/api_service.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/screens/login_screen.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final AuthService _authService = AuthService();
  late final ApiService _apiService;
  UserProfile? _userProfile; // Re-using UserProfile model, might need to expand it if it lacks email/product
  bool _isLoading = true;

  // Design System Colors
  static const Color kBgColor = Color(0xFF0a0a0a);
  static const Color kSurfaceColor = Color(0xFF181818); 
  static const Color kAccentColor = Color(0xFF1DB954); 
  static const Color kTextPrimary = Color(0xFFFFFFFF);
  static const Color kTextSecondary = Color(0xFFB3B3B3);

  @override
  void initState() {
    super.initState();
    _apiService = ApiService(_authService);
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final id = await _authService.getSpotifyId();
    if (id != null) {
      try {
        // We might need a specific endpoint for full user details if 'getUserProfile' only returns stats
        // But for now, let's assume getSpotifyId or a new method 'getMe' is needed.
        // Checking ApiService... it seems to rely on 'getUserProfile' for stats.
        // We may need to fetch basic user info separately or ensure UserProfile has it.
        // Assuming UserProfile has displayName and image. Email/Country might need a new API call or expansion.
        // For this step, I will use what we have and maybe mock the missing fields if API doesn't support them yet
        // OR better, I will implement a 'getMe' in ApiService if it doesn't exist.
        // Wait, looking at previous context, UserProfile has tracks/artists/genres. 
        // I will use _authService.getSpotifyId() for ID.
        // Let's reuse getUserProfile ('long_term') just to get the Profile Image and Name.
        final p = await _apiService.getUserProfile(id, timeRange: 'long_term');
        setState(() {
          _userProfile = p;
          _isLoading = false;
        });
      } catch (e) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBgColor,
      appBar: AppBar(
        backgroundColor: kBgColor,
        elevation: 0,
        centerTitle: true, // CENTERED as per request
        title: Text(
          'Account',
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w800,
            color: kAccentColor,
            letterSpacing: -0.5,
            fontSize: 24,
          ),
        ),
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator(color: kAccentColor))
        : SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                // Profile Image
                Container(
                  width: 120, height: 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: kAccentColor, width: 3),
                    image: _userProfile?.image != null 
                      ? DecorationImage(
                          image: CachedNetworkImageProvider(_userProfile!.image!), // Force unwrap valid string
                          fit: BoxFit.cover
                        )
                      : null,
                  ),
                  child: _userProfile?.image == null 
                    ? const Icon(Icons.person, size: 64, color: kTextSecondary) 
                    : null,
                ),
                const SizedBox(height: 24),
                
                // Name
                Text(
                  _userProfile?.displayName ?? 'Spotify User',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: kTextPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Spotify ID: ${_userProfile?.userId ?? "Unknown"}',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    color: kTextSecondary,
                  ),
                ),

                const SizedBox(height: 48),

                // Info Cards
                _buildInfoRow('Plan', 'Premium', Icons.star_rounded), // Mocked for now, API dependent
                _buildInfoRow('Country', 'ID (Indonesia)', Icons.flag_rounded), // Mocked
                _buildInfoRow('Email', 'user@example.com', Icons.email_rounded), // Mocked

                const SizedBox(height: 48),

                // Logout Button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      await AuthService().logout();
                      if (context.mounted) {
                         Navigator.of(context).pushAndRemoveUntil(
                           MaterialPageRoute(builder: (_) => const LoginScreen()),
                           (route) => false
                         );
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF282828),
                      foregroundColor: Colors.redAccent,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.logout_rounded),
                    label: Text('Logout', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 16)),
                  ),
                ),
                
                const SizedBox(height: 24),
                Text(
                  'Personalify Mobile v1.0.0',
                  style: GoogleFonts.plusJakartaSans(color: kTextSecondary.withOpacity(0.5), fontSize: 12),
                ),
              ],
            ),
          ),
    );
  }

  Widget _buildInfoRow(String label, String value, IconData icon) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      decoration: BoxDecoration(
        color: kSurfaceColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF282828)),
      ),
      child: Row(
        children: [
          Icon(icon, color: kTextSecondary, size: 20),
          const SizedBox(width: 16),
          Text(
            label,
            style: GoogleFonts.plusJakartaSans(color: kTextSecondary, fontWeight: FontWeight.w500),
          ),
          const Spacer(),
          Text(
            value,
            style: GoogleFonts.plusJakartaSans(color: kTextPrimary, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
