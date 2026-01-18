import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:personalify/services/api_service.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/models/user_profile.dart'; // Ensure models are accessible
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:personalify/screens/login_screen.dart';

class HomeScreen extends StatefulWidget {
  final Function(int) onTabChange;

  const HomeScreen({super.key, required this.onTabChange});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  // Colors & Styles
  static const Color kBgColor = Color(0xFF0a0a0a);
  static const Color kSurfaceColor = Color(0xFF181818); 
  static const Color kAccentColor = Color(0xFF1DB954); 
  static const Color kTextPrimary = Color(0xFFFFFFFF);
  static const Color kTextSecondary = Color(0xFFB3B3B3);
  static const Color kBorderColor = Color(0xFF282828);

  // Data State
  final AuthService _authService = AuthService();
  late final ApiService _apiService;
  UserProfile? _userProfile;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _apiService = ApiService(_authService);
    _loadSummary();
  }

  Future<void> _loadSummary() async {
    final id = await _authService.getSpotifyId();
    if (id != null) {
      try {
        // Fetch short term data for quick summary
        final p = await _apiService.getUserProfile(id, timeRange: 'short_term');
        if (mounted) {
           setState(() {
             _userProfile = p;
             _isLoading = false;
           });
        }
      } catch (e) {
        if (mounted) setState(() => _isLoading = false);
      }
    } else {
        if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleLogout() async {
    await _authService.logout();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (context) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBgColor,
      // No AppBar as requested ("Ga usah ada header home")
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const NeverScrollableScrollPhysics(), // User requested: DISABLE SCROLLING
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24), // Match Dashboard 16px
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Welcome Header with Profile Icon
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Welcome,',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                          color: kTextSecondary,
                        ),
                      ),
                      if (_isLoading)
                         Padding(
                           padding: const EdgeInsets.only(top: 4),
                           child: Row(
                             children: [
                               const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: kAccentColor)),
                               const SizedBox(width: 8),
                               Text("Syncing...", style: GoogleFonts.plusJakartaSans(fontSize: 18, color: kTextSecondary)),
                             ],
                           ),
                         )
                      else
                        Text(
                          _userProfile?.displayName ?? 'User',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            color: kAccentColor,
                            letterSpacing: -1.0,
                          ),
                        ),
                    ],
                  ),
                  // Profile Icon with Logout Menu
                  PopupMenuButton<String>(
                    onSelected: (value) {
                      if (value == 'logout') {
                        _handleLogout();
                      }
                    },
                    itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
                       PopupMenuItem<String>(
                        value: 'logout',
                        child: Row(
                          children: [
                            const Icon(Icons.logout_rounded, color: Colors.red, size: 20),
                            const SizedBox(width: 12),
                            Text(
                              'Logout',
                              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                          ],
                        ),
                      ),
                    ],
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: kAccentColor, width: 2),
                      ),
                      child: ClipOval(
                        child: Image.network(
                          _userProfile?.image ?? '',
                          width: 40,
                          height: 40,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) => Container(
                            width: 40,
                            height: 40,
                            color: kSurfaceColor,
                            child: const Icon(Icons.person, color: kTextSecondary, size: 20),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),

              // 2. Summary Card (Quick Stats)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [kSurfaceColor, kBgColor], // Cleaner Gradient
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: kBorderColor),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.insights_rounded, color: kAccentColor),
                        const SizedBox(width: 8),
                        Text(
                          'Your Vibe (Last 4 Weeks)',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: kTextPrimary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    if (_isLoading)
                      const Center(child: CircularProgressIndicator(color: kAccentColor))
                    else if (_userProfile != null)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildStatRow('Top Artist', _userProfile!.artists.isNotEmpty ? _userProfile!.artists.first.name : '-'),
                          const SizedBox(height: 12),
                          _buildStatRow('Top Track', _userProfile!.tracks.isNotEmpty ? _userProfile!.tracks.first.name : '-'),
                          const SizedBox(height: 12),
                          _buildStatRow('Top Genre', _userProfile!.genres.isNotEmpty ? _userProfile!.genres.first.name : '-'),
                          
                          const SizedBox(height: 16),
                          const Divider(color: kBorderColor),
                          const SizedBox(height: 12),
                          
                          Row(
                            children: [
                               const Icon(Icons.psychology, color: kAccentColor, size: 18),
                               const SizedBox(width: 8),
                               Text(
                                'Vibe Analysis',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: kTextPrimary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _userProfile?.emotionParagraph ?? "Analyzing your music taste...",
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              color: kTextSecondary, 
                              height: 1.5,
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                        ],
                      )
                    else
                      Text("Connect to see stats", style: GoogleFonts.plusJakartaSans(color: kTextSecondary)),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              
                // 2.5 Top Emotions (Compact)
                if (_userProfile != null && _userProfile!.topEmotions.isNotEmpty) ...[
                  Text(
                    'Top Emotions',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 18, // Reduced from 20
                      fontWeight: FontWeight.w700,
                      color: kTextPrimary,
                    ),
                  ),
                  const SizedBox(height: 12), // Reduced from 16
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12), // Tighter padding
                    decoration: BoxDecoration(
                       color: kSurfaceColor,
                       borderRadius: BorderRadius.circular(16),
                       border: Border.all(color: kBorderColor),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: _userProfile!.topEmotions.take(3).map((e) {
                         return Column(
                           children: [
                             // Uniform Icon Container (Smaller)
                             Container(
                               width: 32, 
                               height: 32,
                               alignment: Alignment.center,
                               child: FaIcon(
                                    _getIconForEmotion(e.label),
                                    size: 20, // Smaller 24->20
                                    color: kAccentColor,
                               ),
                             ),
                             const SizedBox(height: 4),
                             Text(
                               e.label[0].toUpperCase() + e.label.substring(1),
                               style: GoogleFonts.plusJakartaSans(
                                 fontWeight: FontWeight.bold,
                                 color: kTextPrimary,
                                 fontSize: 12, // Reduced from 14
                               ),
                             ),
                             Text(
                               "${(e.score * 100).toInt()}%",
                               style: GoogleFonts.plusJakartaSans(color: kTextSecondary, fontSize: 10), // Reduced from 12
                             ),
                           ],
                         );
                      }).toList(),
                    ),
                  ),
                   const SizedBox(height: 24), // Reduced bottom spacing
                ],

              // 3. Feature Explanations
              Text(
                'Features',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: kTextPrimary,
                ),
              ),
              const SizedBox(height: 16),
              // Uniform Styling - No "Colors"
              _buildFeatureCard(
                icon: Icons.grid_view_rounded,
                title: 'Dashboard',
                description: 'Deep dive into your top tracks, artists, and genres with interactive charts.',
                onTap: () => widget.onTabChange(1), // Index 1: Dashboard
              ),
              _buildFeatureCard(
                 icon: Icons.insights_rounded,
                 title: 'Analyzer',
                 description: 'Analyze lyrics and get AI-powered insights into the meaning of songs.',
                 onTap: () => widget.onTabChange(2), // Index 2: Analyzer
              ),
               _buildFeatureCard(
                 icon: Icons.menu_book_rounded,
                 title: 'About',
                 description: 'Learn more about Personalify, privacy, and how we use data.',
                 onTap: () => widget.onTabChange(3), // Index 3: About
              ),
              
              const SizedBox(height: 100), // Bottom padding
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: GoogleFonts.plusJakartaSans(color: kTextSecondary, fontSize: 14)),
        Expanded(
          child: Text(
            value, 
            style: GoogleFonts.plusJakartaSans(color: kTextPrimary, fontWeight: FontWeight.w600, fontSize: 14),
            textAlign: TextAlign.end,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }



// ... (existing code)

  // Helper: Icon Mapper (Aesthetic Icons instead of Emojis)
  IconData _getIconForEmotion(String label) {
    switch (label.toLowerCase()) {
      case 'joy': return FontAwesomeIcons.faceSmileBeam;
      case 'sadness': return FontAwesomeIcons.faceSadTear;
      case 'anger': return FontAwesomeIcons.faceAngry;
      case 'fear': return FontAwesomeIcons.faceFlushed;
      case 'love': return FontAwesomeIcons.heart;
      case 'excitement': return FontAwesomeIcons.bolt;
      case 'surprise': return FontAwesomeIcons.faceSurprise;
      case 'neutral': return FontAwesomeIcons.faceMeh;
      case 'confusion': return FontAwesomeIcons.question;
      case 'disgust': return FontAwesomeIcons.faceGrimace;
      case 'optimism': return FontAwesomeIcons.sun;
      case 'admiration': return FontAwesomeIcons.thumbsUp;
      case 'anticipation': return FontAwesomeIcons.hourglassHalf; 
      case 'approval': return FontAwesomeIcons.check;
      case 'caring': return FontAwesomeIcons.handHoldingHeart;
      case 'desire': return FontAwesomeIcons.fire;
      case 'disappointment': return FontAwesomeIcons.faceFrownOpen;
      case 'disapproval': return FontAwesomeIcons.thumbsDown;
      case 'embarrassment': return FontAwesomeIcons.faceFlushed;
      case 'gratitude': return FontAwesomeIcons.handsPraying;
      case 'grief': return FontAwesomeIcons.heartCrack;
      case 'nervousness': return FontAwesomeIcons.faceGrimace;
      case 'pride': return FontAwesomeIcons.medal;
      case 'realization': return FontAwesomeIcons.lightbulb;
      case 'relief': return FontAwesomeIcons.faceSmile;
      case 'remorse': return FontAwesomeIcons.faceSadCry;
      default: return FontAwesomeIcons.music;
    }
  }

  // UPDATED: Added onTap
  Widget _buildFeatureCard({required IconData icon, required String title, required String description, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kSurfaceColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: kBorderColor),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: kAccentColor.withOpacity(0.1), // Uniform Green Tint
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: kAccentColor, size: 24), // Uniform Green Icon
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: kTextPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      color: kTextSecondary,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
            // Indication that it's clickable
            const Icon(Icons.chevron_right_rounded, color: kTextSecondary, size: 20),
          ],
        ),
      ),
    );
  }
}
