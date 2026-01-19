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
  Map<String, dynamic>? _profileData;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final apiService = Provider.of<ApiService>(context, listen: false);
      final data = await apiService.getFullUserProfile();
      
      if (mounted) {
        setState(() {
          _profileData = data;
          _isLoading = false;
        });
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
    // Header Style (Matching Dashboard)
    final headerStyle = GoogleFonts.plusJakartaSans(
      fontSize: 24, 
      fontWeight: FontWeight.bold,
      color: kTextPrimary
    );

    if (_isLoading) return const Center(child: CircularProgressIndicator(color: kAccentColor));
    if (_profileData == null) return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text("Profile Failed to Load"),
          TextButton(onPressed: _loadProfile, child: const Text("Retry"))
        ],
      )
    );

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
        actions: [
            IconButton(
                icon: const Icon(Icons.settings_outlined, color: kTextPrimary),
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen())),
            )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
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
                      ? DecorationImage(image: CachedNetworkImageProvider(image), fit: BoxFit.cover)
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
              _buildActionRow(Icons.logout_rounded, "Log Out", Colors.redAccent, _logout),
            ]),
            
            const SizedBox(height: 24),
            Text(
              "Personalify for Spotify",
              style: GoogleFonts.plusJakartaSans(fontSize: 12, color: Colors.white24),
            ),
          ],
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
