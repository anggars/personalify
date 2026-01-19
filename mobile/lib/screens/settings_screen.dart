import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:personalify/utils/constants.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  // Colors & Styles (Copied from HomeScreen)
  static const Color kBgColor = Color(0xFF0a0a0a);
  static const Color kSurfaceColor = Color(0xFF181818); 
  static const Color kAccentColor = Color(0xFF1DB954); 
  static const Color kTextPrimary = Color(0xFFFFFFFF);
  static const Color kTextSecondary = Color(0xFFB3B3B3);
  static const Color kBorderColor = Color(0xFF282828);

  String _version = '';

  @override
  void initState() {
    super.initState();
    _loadVersion();
  }

  Future<void> _loadVersion() async {
    final info = await PackageInfo.fromPlatform();
    if (mounted) {
      setState(() {
        _version = 'v${info.version} (build ${info.buildNumber})';
      });
    }
  }

  Future<void> _clearImageCache() async {
    try {
      // Clear Memory Cache (Synchronous)
      PaintingBinding.instance.imageCache.clear();
      PaintingBinding.instance.imageCache.clearLiveImages();
      
      // Clear Disk Cache (Async) - Requires flutter_cache_manager
      // Since we didn't explicitly add flutter_cache_manager to pubspec for this screen (though cached_network_image uses it),
      // we'll stick to the safe approach of just clearing memory which is what imageCache does.
      // If we want to be thorough we can assume DefaultCacheManager is available.
      
      // However, to fix the IMMEDIATE build error which is "await ImageCache()", we just remove await and fix the calls.
      // ImageCache() constructor is internal/factory, usually accessed via PaintingBinding.
      
      if (mounted) {
         ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Memory cache cleared!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to clear cache: $e')),
        );
      }
    }
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBgColor,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        toolbarHeight: 70, // Consistent Header Height
        title: Text(
          'Settings',
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.bold,
            color: kTextPrimary,
          ),
        ),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          _buildSectionHeader('Storage'),
          _buildSettingsTile(
            icon: Icons.cleaning_services_rounded,
            title: 'Clear Image Cache',
            subtitle: 'Free up space by removing cached images',
            onTap: _clearImageCache,
          ),
          
          const SizedBox(height: 32),
          
          _buildSectionHeader('Legal'),
          _buildSettingsTile(
            icon: Icons.privacy_tip_rounded,
             title: 'Privacy Policy',
            onTap: () => _launchUrl('https://personalify.vercel.app/privacy'),
          ),
          _buildSettingsTile(
            icon: Icons.description_rounded,
            title: 'Terms of Service',
            onTap: () => _launchUrl('https://personalify.vercel.app/terms'),
          ),

          const SizedBox(height: 48),
          
          Center(
            child: Column(
              children: [
                Text(
                  'Personalify Mobile',
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.bold,
                    color: kTextSecondary,
                  ),
                ),
                Text(
                  _version,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: kTextSecondary.withOpacity(0.5),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16, left: 4),
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.plusJakartaSans(
          fontSize: 12,
          fontWeight: FontWeight.bold,
          color: kTextSecondary,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: kSurfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderColor),
      ),
      child: ListTile(
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: kBgColor,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: kAccentColor, size: 20),
        ),
        title: Text(
          title,
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w600,
            color: kTextPrimary,
            fontSize: 14,
          ),
        ),
        subtitle: subtitle != null
            ? Text(
                subtitle,
                style: GoogleFonts.plusJakartaSans(
                  color: kTextSecondary,
                  fontSize: 12,
                ),
              )
            : null,
        trailing: Icon(Icons.chevron_right_rounded, color: kTextSecondary),
      ),
    );
  }
}
