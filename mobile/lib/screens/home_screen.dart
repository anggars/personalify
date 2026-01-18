import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:personalify/services/api_service.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/models/user_profile.dart'; // Ensure models are accessible

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBgColor,
      // No AppBar as requested ("Ga usah ada header home")
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Welcome Header
              Text(
                'Welcome,',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  color: kTextSecondary,
                ),
              ),
              Text(
                _userProfile?.displayName ?? 'Music Lover',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 32,
                  fontWeight: FontWeight.w800,
                  color: kAccentColor,
                  letterSpacing: -1.0,
                ),
              ),
              const SizedBox(height: 32),

              // 2. Summary Card (Quick Stats)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [kAccentColor.withOpacity(0.2), kSurfaceColor],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: kAccentColor.withOpacity(0.3)),
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
                          const SizedBox(height: 8),
                          _buildStatRow('Top Track', _userProfile!.tracks.isNotEmpty ? _userProfile!.tracks.first.name : '-'),
                          const SizedBox(height: 8),
                          _buildStatRow('Top Genre', _userProfile!.genres.isNotEmpty ? _userProfile!.genres.first.name : '-'),
                        ],
                      )
                    else
                      Text("Connect to see stats", style: GoogleFonts.plusJakartaSans(color: kTextSecondary)),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              
              // 2.5 Top Emotions (New Feature)
              if (_userProfile != null && _userProfile!.topEmotions.isNotEmpty) ...[
                Text(
                  'Top Emotions',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: kTextPrimary,
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
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
                           Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: kAccentColor.withOpacity(0.1),
                                shape: BoxShape.circle,
                              ),
                              child: Text(
                                _getEmojiForEmotion(e.label),
                                style: const TextStyle(fontSize: 24),
                              ),
                           ),
                           const SizedBox(height: 8),
                           Text(
                             e.label[0].toUpperCase() + e.label.substring(1),
                             style: GoogleFonts.plusJakartaSans(
                               fontWeight: FontWeight.bold,
                               color: kTextPrimary,
                               fontSize: 14,
                             ),
                           ),
                           Text(
                             "${(e.score * 100).toInt()}%",
                             style: GoogleFonts.plusJakartaSans(color: kTextSecondary, fontSize: 12),
                           ),
                         ],
                       );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 32),
              ],
              
              const SizedBox(height: 0), // Removed extra space since conditional above handles it

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
              _buildFeatureCard(
                icon: Icons.grid_view_rounded,
                title: 'Dashboard',
                description: 'Deep dive into your top tracks, artists, and genres with interactive charts.',
                color: Colors.blueAccent,
              ),
              _buildFeatureCard(
                 icon: Icons.insights_rounded,
                 title: 'Analyzer',
                 description: 'Analyze lyrics and get AI-powered insights into the meaning of songs.',
                 color: Colors.purpleAccent,
              ),
               _buildFeatureCard(
                 icon: Icons.menu_book_rounded,
                 title: 'About',
                 description: 'Learn more about Personalify, privacy, and how we use data.',
                 color: Colors.orangeAccent,
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
        Text(label, style: GoogleFonts.plusJakartaSans(color: kTextSecondary)),
        Expanded(
          child: Text(
            value, 
            style: GoogleFonts.plusJakartaSans(color: kTextPrimary, fontWeight: FontWeight.w600),
            textAlign: TextAlign.end,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  String _getEmojiForEmotion(String label) {
    switch (label.toLowerCase()) {
      case 'joy': return '😄';
      case 'sadness': return '😢';
      case 'anger': return '😡';
      case 'fear': return '😱';
      case 'love': return '😍';
      case 'excitement': return '🤩';
      case 'surprise': return '😲';
      case 'neutral': return '😐';
      case 'confusion': return '😕';
      case 'disgust': return '🤢';
      case 'optimism': return '🌟';
      case 'admiration': return '👏';
      case 'anticipation': return '🫣';
      case 'approval': return '👍';
      case 'caring': return '🤗';
      case 'desire': return '😏';
      case 'disappointment': return '😞';
      case 'disapproval': return '👎';
      case 'embarrassment': return '😳';
      case 'gratitude': return '🙏';
      case 'grief': return '😭';
      case 'nervousness': return '😬';
      case 'pride': return '🦁';
      case 'realization': return '💡';
      case 'relief': return '😌';
      case 'remorse': return '😔';
      default: return '🎵';
    }
  }

  Widget _buildFeatureCard({required IconData icon, required String title, required String description, required Color color}) {
    return Container(
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
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 24),
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
                    fontSize: 12,
                    color: kTextSecondary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          )
        ],
      ),
    );
  }
}
