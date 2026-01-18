import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  // Colors
  static const Color kBgColor = Color(0xFF0a0a0a);
  static const Color kSurfaceColor = Color(0xFF181818); 
  static const Color kAccentColor = Color(0xFF1DB954); 
  static const Color kTextPrimary = Color(0xFFFFFFFF);
  static const Color kTextSecondary = Color(0xFFB3B3B3);
  static const Color kBorderColor = Color(0xFF282828);

  Future<void> _launchUrl(String url) async {
    if (!await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication)) {
      debugPrint('Could not launch $url');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBgColor,
      appBar: AppBar(
        backgroundColor: kBgColor,
        elevation: 0,
        centerTitle: true,
        title: Text(
          'About',
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w800,
            color: kAccentColor,
            letterSpacing: -0.5,
            fontSize: 20,
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Hero Section
              Center(
                child: Column(
                  children: [
                     Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: kAccentColor, width: 2),
                      ),
                      child: ClipOval(
                        child: Image.network(
                          'https://github.com/anggars.png', 
                          width: 80,
                          height: 80,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) {
                            return Container(
                              width: 80,
                              height: 80,
                              color: kSurfaceColor,
                              child: const Center(
                                child: Icon(FontAwesomeIcons.userAstronaut, size: 30, color: kTextSecondary),
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Angga RS',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: kTextPrimary,
                      ),
                    ),
                    Text(
                      'Developer & Music Nerd',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 14,
                        color: kTextSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              
              const SizedBox(height: 40),

              // Section: The Project
              Text(
                'THE PROJECT',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: kTextSecondary,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 16),
              Text(
              "Personalify starts as a final exam project but has grown into a passion project. We aim to provide deeper insights into your music taste with a beautiful, modern interface.\n\nBuilt with Flutter and Python (FastAPI), Personalify leverages the Spotify Web API to fetch your top tracks, artists, and genres. It then uses advanced NLP (Natural Language Processing) to analyze the emotional sentiment of your favorite lyrics, giving you a unique 'Vibe Check' that goes beyond just numbers.\n\nWhether you're curious about your listening habits or just want to share your music personality with friends, Personalify is here to help you understand the soundtrack of your life.",
              style: GoogleFonts.plusJakartaSans(
                fontSize: 14,
                color: kTextSecondary,
                height: 1.6,
              ),
              textAlign: TextAlign.justify,
            ),

              const SizedBox(height: 40),

              // Section: Connect
              Text(
                'CONNECT',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: kTextSecondary,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 8),
              
              _buildSimpleLink(FontAwesomeIcons.github, 'GitHub', 'https://github.com/anggars'),
              _buildSimpleLink(FontAwesomeIcons.linkedin, 'LinkedIn', 'http://linkedin.com/in/anggarnts'),
              _buildSimpleLink(FontAwesomeIcons.instagram, 'Instagram', 'http://www.instagram.com/anggarnts'),
              _buildSimpleLink(FontAwesomeIcons.spotify, 'Spotify', 'https://open.spotify.com/user/31xon7qetimdnbmhkupbaszl52nu'),
              _buildSimpleLink(FontAwesomeIcons.globe, 'Website', 'https://personalify.vercel.app'),

              const SizedBox(height: 40),
               Center(
                child: Text(
                  'v1.0.0 • Personalify Mobile',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: kTextSecondary.withOpacity(0.5),
                  ),
                ),
              ),
               const SizedBox(height: 80),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSimpleLink(IconData icon, String title, String url) {
    return InkWell(
      onTap: () => _launchUrl(url),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            FaIcon(icon, size: 20, color: kTextPrimary),
            const SizedBox(width: 16),
            Text(
              title,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: kTextPrimary,
              ),
            ),
            const Spacer(),
            const Icon(Icons.arrow_outward_rounded, size: 16, color: kTextSecondary),
          ],
        ),
      ),
    );
  }
}
