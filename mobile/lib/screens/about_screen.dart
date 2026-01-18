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
            fontSize: 24,
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center, // Center align for consistency with web
            children: [
              // Header
              // Text(  <-- REMOVED REDUNDANT HEADER
              //   'About Personalify',
              //   style: GoogleFonts.plusJakartaSans(
              //     fontSize: 32,
              //     fontWeight: FontWeight.w800,
              //     color: kAccentColor,
              //     letterSpacing: -1.0,
              //   ),
              //   textAlign: TextAlign.center,
              // ),
              // const SizedBox(height: 8),
              Text(
                'The project scoop, from exam brief to deployment.',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 16,
                  color: kTextSecondary,
                  fontWeight: FontWeight.w500,
                ),
                textAlign: TextAlign.center,
              ),
              
              const SizedBox(height: 32),

              // Section 1: Just a Side-Quest?
              _buildCard(
                title: 'Just a Side-Quest?',
                children: [
                  RichText(
                    textAlign: TextAlign.justify,
                    text: TextSpan(
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 14,
                        color: kTextSecondary.withOpacity(0.8),
                        height: 1.6,
                      ),
                      children: const [
                        TextSpan(text: "Alright, here's the plot twist. Personalify wasn't just a random side-quest I built for fun. It was my final exam for "),
                        TextSpan(text: "'Distributed Data Processing'", style: TextStyle(color: Color(0xFFFF9900), fontWeight: FontWeight.bold)),
                        TextSpan(text: " back in semester 6. We had to build a system that integrates several database technologies. I chose a "),
                        TextSpan(text: "'Streaming Service Metadata Platform'", style: TextStyle(color: Color(0xFF00C7B7), fontWeight: FontWeight.bold)),
                         TextSpan(text: " as my use case. What started as an assignment evolved into a passion project where I pushed my skills.\n\n"),
                         
                         TextSpan(text: "The frontend runs on "),
                         TextSpan(text: "Next.js", style: TextStyle(color: kTextPrimary, fontWeight: FontWeight.bold)),
                         TextSpan(text: " while the backend uses "),
                         TextSpan(text: "FastAPI", style: TextStyle(color: Color(0xFF009688), fontWeight: FontWeight.bold)),
                         TextSpan(text: ". Data comes from the "),
                         TextSpan(text: "Spotify API", style: TextStyle(color: kAccentColor, fontWeight: FontWeight.bold)),
                         TextSpan(text: ". Local dev uses "),
                         TextSpan(text: "Docker", style: TextStyle(color: Color(0xFF2496ED), fontWeight: FontWeight.bold)),
                         TextSpan(text: ", but production runs on "),
                         TextSpan(text: "Vercel", style: TextStyle(color: kTextPrimary, fontWeight: FontWeight.bold)),
                         TextSpan(text: " as a serverless app. For storage, "),
                         TextSpan(text: "Neon", style: TextStyle(color: Color(0xFF00E599), fontWeight: FontWeight.bold)),
                         TextSpan(text: " handles main data, "),
                         TextSpan(text: "MongoDB", style: TextStyle(color: Color(0xFF47A248), fontWeight: FontWeight.bold)),
                         TextSpan(text: " stores sync history, and "),
                         TextSpan(text: "Redis", style: TextStyle(color: Color(0xFFDC382D), fontWeight: FontWeight.bold)),
                         TextSpan(text: " manages the cache. Lyrics come from "),
                         TextSpan(text: "Genius", style: TextStyle(color: Color(0xFFFFFF64), fontWeight: FontWeight.bold)),
                         TextSpan(text: " via a custom proxy. The vibe check runs on a "),
                         TextSpan(text: "Hugging Face", style: TextStyle(color: Color(0xFFFFD21E), fontWeight: FontWeight.bold)),
                         TextSpan(text: " model for sentiment analysis."),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Section 2: About Me
              _buildCard(
                title: 'About Me',
                children: [
                   RichText(
                    textAlign: TextAlign.justify,
                    text: TextSpan(
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 14,
                        color: kTextSecondary.withOpacity(0.8),
                        height: 1.6,
                      ),
                      children: const [
                        TextSpan(text: "I'm Angga, an Informatics major who just genuinely enjoys building cool things. My world is a constant juggling act between computational linguistics, psychology, and (obviously) music.\n\n"),
                        TextSpan(text: "This project is pretty much my whole personality a showcase of coding (mostly "),
                        TextSpan(text: "Python", style: TextStyle(color: Color(0xFF3776AB), fontWeight: FontWeight.bold)),
                        TextSpan(text: " and "),
                        TextSpan(text: "TypeScript", style: TextStyle(color: Color(0xFF3178C6), fontWeight: FontWeight.bold)),
                        TextSpan(text: "), NLP, with my heavy into "),
                        TextSpan(text: "Math Rock", style: TextStyle(color: kAccentColor, fontWeight: FontWeight.bold)),
                        TextSpan(text: " and "),
                        TextSpan(text: "Midwest Emo", style: TextStyle(color: kAccentColor, fontWeight: FontWeight.bold)),
                        TextSpan(text: ". I'm down in the trenches geeking out trying to learn alternate guitar tunings like "),
                        TextSpan(text: "FACGCE", style: TextStyle(color: kAccentColor, fontWeight: FontWeight.bold)),
                        TextSpan(text: " right now, even though it's tough as hell. This web is the crossover episode I didn't know I needed."),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Section 3: Hit Me Up!
              _buildCard(
                title: 'Hit Me Up!',
                children: [
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    alignment: WrapAlignment.center,
                    children: [
                      _buildSocialIcon(FontAwesomeIcons.github, 'https://github.com/anggars', 'Github'),
                      _buildSocialIcon(FontAwesomeIcons.linkedin, 'http://linkedin.com/in/anggarnts', 'LinkedIn', color: const Color(0xFF0077b5)),
                      _buildSocialIcon(FontAwesomeIcons.instagram, 'http://www.instagram.com/anggarnts', 'Instagram', color: const Color(0xFFe4405f)),
                      _buildSocialIcon(FontAwesomeIcons.spotify, 'https://open.spotify.com/user/31xon7qetimdnbmhkupbaszl52nu', 'Spotify', color: const Color(0xFF1DB954)),
                      _buildSocialIcon(FontAwesomeIcons.xTwitter, 'http://x.com/anggarnts', 'X'),
                      _buildSocialIcon(FontAwesomeIcons.youtube, 'http://youtube.com/@anggarnts', 'YouTube', color: const Color(0xFFff0000)),
                      _buildSocialIcon(FontAwesomeIcons.soundcloud, 'http://soundcloud.com/anggarnts', 'SoundCloud', color: const Color(0xFFff5500)),
                      _buildSocialIcon(FontAwesomeIcons.medium, 'https://medium.com/@anggarnts', 'Medium'),
                      _buildSocialIcon(FontAwesomeIcons.telegram, 'http://t.me/anggarnts', 'Telegram', color: const Color(0xFF0088cc)),
                      _buildSocialIcon(FontAwesomeIcons.globe, 'http://bit.ly/anggariantosudrajat', 'Blog', color: kAccentColor),
                    ],
                  ),
                ],
              ),
              
              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCard({required String title, required List<Widget> children}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: kSurfaceColor.withOpacity(0.5), // Glass effect simulation
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderColor),
      ),
      child: Column(
        children: [
          Text(
            title,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: kAccentColor,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Container(
            height: 1, 
            width: double.infinity, 
            color: kBorderColor.withOpacity(0.5),
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }

  Widget _buildSocialIcon(IconData icon, String url, String tooltip, {Color? color}) {
    return IconButton(
      icon: FaIcon(icon, size: 24, color: color ?? kTextSecondary),
      onPressed: () => _launchUrl(url),
      tooltip: tooltip,
      style: IconButton.styleFrom(
        backgroundColor: Colors.white.withOpacity(0.05),
        padding: const EdgeInsets.all(12),
        shape: const CircleBorder(side: BorderSide(color: kBorderColor)),
      ),
    );
  }
}
