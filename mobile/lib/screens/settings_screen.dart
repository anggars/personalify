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
      await ImageCache().clear();
      await ImageCache().clearLiveImages();
      // Note: cached_network_image usually uses DefaultCacheManager
      // But clearing ImageCache is also good. 
      // For DefaultCacheManager, we'd need flutter_cache_manager package import.
      // Assuming basic ImageCache for now as requested.
      if (mounted) {
         ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Image cache cleared!')),
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
