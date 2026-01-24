import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:personalify/utils/constants.dart';
import 'package:personalify/models/user_profile.dart';
import 'package:personalify/services/api_service.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/screens/settings_screen.dart';
import 'package:provider/provider.dart';
import 'package:personalify/widgets/error_view.dart';
import 'package:url_launcher/url_launcher.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _profileData;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    
    try {
      final apiService = Provider.of<ApiService>(context, listen: false);
      final data = await apiService.getFullUserProfile();
      
      if (mounted) {
        if (data != null) {
          setState(() {
            _profileData = data;
            _isLoading = false;
          });
        } else {
          setState(() {
            _errorMessage = "Failed to fetch profile (404/500)";
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
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
     final userid = _profileData?['id'];
     final deepLink = userid != null ? 'spotify:user:$userid' : 'spotify:';
     final webUrl = userid != null ? 'https://open.spotify.com/user/$userid' : 'https://open.spotify.com';

     try {
       // Try Native App
       final uri = Uri.parse(deepLink);
       if (await canLaunchUrl(uri)) {
          await launchUrl(uri); 
          return;
       }
     } catch (_) {}

     // Fallback to Web (External App Mode)
     try {
       await launchUrl(Uri.parse(webUrl), mode: LaunchMode.externalApplication);
     } catch (e) {
       if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Could not open Spotify: $e")));
     }
  }

  @override
  Widget build(BuildContext context) {
    // Header Style (Standardized: 24px ExtraBold, Centered)
    final headerStyle = GoogleFonts.plusJakartaSans(
      fontSize: 24, 
      fontWeight: FontWeight.w800,
      color: kAccentColor,
      letterSpacing: -0.5,
    );

    if (_isLoading) return const Center(child: CircularProgressIndicator(color: kAccentColor));
    
    if (_errorMessage != null || _profileData == null) {
      return Scaffold( // Ensure it has a scaffold background if full screen
        backgroundColor: kBgColor,
        body: ErrorView(
          title: "Profile Unavailable",
          message: _errorMessage ?? "Failed to load profile data.\nPlease try refreshing or logging in again.",
          onRetry: _loadProfile,
          onLogout: _logout,
        ),
      );
    }

    final name = _profileData!['display_name'] ?? 'Spotify User';
    final userid = _profileData!['id'] ?? '';
    final image = _profileData!['image_url'] ?? '';
    final followers = '${_profileData!['followers'] ?? 0}';
    final country = _profileData!['country'] ?? '-';
    final product = (_profileData!['product'] ?? 'free').toString().toUpperCase();

    return Scaffold(
      backgroundColor: kBgColor,
      appBar: AppBar(
        title: Text('Profile', style: headerStyle), // Matched Header Size
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        toolbarHeight: 70, // Consistent Header Height
        actions: [
            IconButton(
                icon: const Icon(Icons.settings_outlined, color: kTextPrimary),
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen())),
            )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        child: RepaintBoundary(
          child: Column(
            children: [
            // 1. Large Profile Image
            Center(
              child: Container(
                width: 160,
                height: 160,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: kSurfaceColor,
                  image: image.isNotEmpty 
                      ? DecorationImage(image: CachedNetworkImageProvider(image, maxWidth: 320), fit: BoxFit.cover)
                      : null,
                ),
                child: image.isEmpty 
                    ? const Icon(Icons.person_rounded, size: 80, color: Colors.grey)
                    : null,
              ),
            ),
            
            const SizedBox(height: 24),

            // 2. Name & Verified Badge
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  name,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                    color: kTextPrimary,
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.verified_rounded, color: kAccentColor, size: 24),
              ],
            ),
            
            const SizedBox(height: 8),
            
            // Spotify ID
            Text(
              '@$userid',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 14,
                color: kTextSecondary,
              ),
            ),

            const SizedBox(height: 32),

            // 3. Real Info (Stats)
            _buildInfoGroup([
              _buildInfoRow(Icons.people_outline_rounded, "Followers", followers),
              _buildInfoRow(Icons.star_outline_rounded, "Subscription", product),
              _buildInfoRow(Icons.flag_outlined, "Country", country),
            ]),

            const SizedBox(height: 24),

            // 4. Actions
            _buildInfoGroup([
              _buildActionRow(Icons.open_in_new_rounded, "Open Spotify", kAccentColor, _openSpotify),

              const SizedBox(height: 8),
              _buildActionRow(Icons.logout_rounded, "Logout", Colors.redAccent, _logout),
            ]),
            
            const SizedBox(height: 24),
            Text(
              "Personalify for Spotify",
              style: GoogleFonts.plusJakartaSans(fontSize: 12, color: Colors.white24),
            ),
          ],
        ),
      ),
      ),
    );
  }

  // Helper: Group Container (Rounded Card like WA/Settings iOS)
  Widget _buildInfoGroup(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: kSurfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderColor), // Added Border
      ),
      child: Column(
        children: children,
      ),
    );
  }

  // Helper: Info Row
  Widget _buildInfoRow(IconData icon, String title, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Row(
        children: [
          Icon(icon, color: kTextSecondary, size: 22),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              title,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 16,
                color: kTextPrimary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Text(
            value,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 16,
              color: kTextSecondary, // Value is simpler
            ),
          ),
        ],
      ),
    );
  }

  // Helper: Action Row (Clickable)
  Widget _buildActionRow(IconData icon, String title, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: Row(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(width: 16),
            Text(
              title,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 16,
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
