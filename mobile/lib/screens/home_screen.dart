import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:personalify/services/api_service.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/models/user_profile.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:personalify/screens/login_screen.dart';
import 'package:material_symbols_icons/symbols.dart';

class HomeScreen extends StatefulWidget {
  final Function(int) onTabChange;
  final String selectedTimeRange;

  const HomeScreen({
    super.key,
    required this.onTabChange,
    required this.selectedTimeRange,
  });

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
        // Use time range from prop (synced with Dashboard)
        final p = await _apiService.getUserProfile(id, timeRange: widget.selectedTimeRange);
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
  void didUpdateWidget(HomeScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Reload when time range changes
    if (oldWidget.selectedTimeRange != widget.selectedTimeRange) {
      _loadSummary();
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
          physics: const BouncingScrollPhysics(), // Allow scrolling naturally
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Welcome Header
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
                  PopupMenuButton<String>(
                    elevation: 4,
                    color: kSurfaceColor, // Dark Background
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), // Modern Rounded
                    offset: const Offset(0, 60), // Position below icon with gap
                    // Removed child: ... (it's the icon)
                    onSelected: (value) {
                      if (value == 'logout') {
                        _handleLogout();
                      }
                    },
                    itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
                       PopupMenuItem<String>(
                        value: 'logout',
                        height: 40, // Compact height
                        child: Row(
                          children: [
                            const Icon(Icons.logout_rounded, color: Colors.redAccent, size: 20),
                            const SizedBox(width: 12),
                            Text(
                              'Logout',
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w600, 
                                color: kTextPrimary,
                                fontSize: 14 // Smaller text
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: kAccentColor.withOpacity(0.5), width: 2), // Sublime border
                      ),
                      child: ClipOval(
                        child: Image.network(
                          _userProfile?.image ?? '',
                          width: 44, // Slightly larger touch target
                          height: 44,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) => Container(
                            width: 44,
                            height: 44,
                            color: kSurfaceColor,
                            child: const Icon(Icons.person, color: kTextSecondary, size: 24),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 32), // Consistent Gap

              // 2. Summary Section
              Text(
                _getTimeRangeLabel(widget.selectedTimeRange),
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 18, 
                  fontWeight: FontWeight.w700,
                  color: kTextPrimary,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [kSurfaceColor, kBgColor], 
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: kBorderColor),
                ),
                child: (_isLoading)
                    ? const Center(child: CircularProgressIndicator(color: kAccentColor))
                    : (_userProfile != null)
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildStatRow('Top Artist', _userProfile!.artists.isNotEmpty ? _userProfile!.artists.first.name : '-'),
                            const SizedBox(height: 12),
                            _buildStatRow('Top Track', _userProfile!.tracks.isNotEmpty ? _userProfile!.tracks.first.name : '-'),
                            const SizedBox(height: 12),
                            _buildStatRow('Top Genre', _userProfile!.genres.isNotEmpty ? _userProfile!.genres.first.name : '-'),
                          ],
                        )
                      : Text("Connect to see stats", style: GoogleFonts.plusJakartaSans(color: kTextSecondary)),
              ),

              const SizedBox(height: 32),
              
              // 2.5 Top Emotions (Compact)
              if (_userProfile != null && _userProfile!.topEmotions.isNotEmpty) ...[
                Text(
                  'Top Emotions',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 18, 
                    fontWeight: FontWeight.w700,
                    color: kTextPrimary,
                  ),
                ),
                const SizedBox(height: 12), 
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
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
                             width: 32, 
                             height: 32,
                             alignment: Alignment.center,
                             child: FaIcon(
                                  _getIconForEmotion(e.label),
                                  size: 20,
                                  color: kAccentColor,
                             ),
                           ),
                           const SizedBox(height: 4),
                           Text(
                             e.label[0].toUpperCase() + e.label.substring(1),
                             style: GoogleFonts.plusJakartaSans(
                               fontWeight: FontWeight.bold,
                               color: kTextPrimary,
                               fontSize: 12,
                             ),
                           ),
                           Text(
                             "${(e.score * 100).toInt()}%",
                             style: GoogleFonts.plusJakartaSans(color: kTextSecondary, fontSize: 10),
                           ),
                         ],
                       );
                    }).toList(),
                  ),
                ),
                 const SizedBox(height: 32),
               ],

              // 3. Menu Shortcuts
              Text(
                'Menu',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 18, 
                  fontWeight: FontWeight.w700,
                  color: kTextPrimary,
                ),
              ),
              const SizedBox(height: 12), 
              _buildFeatureCard(
                icon: Symbols.space_dashboard,
                title: 'Dashboard',
                description: 'Deep dive into your top tracks, artists, and genres.',
                onTap: () => widget.onTabChange(1),
              ),
              _buildFeatureCard(
                 icon: Symbols.lyrics,
                 title: 'Analyzer',
                 description: 'Analyze lyrics and get AI-powered insights.',
                 onTap: () => widget.onTabChange(2),
              ),
               _buildFeatureCard(
                 icon: Symbols.music_history,
                 title: 'History',
                 description: 'See your recently played tracks from Spotify.',
                 onTap: () => widget.onTabChange(3),
              ),
              
              const SizedBox(height: 48), // Bottom padding
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

  String _getTimeRangeLabel(String range) {
    switch (range) {
      case 'medium_term': return 'Your Summary (Last 6 Months)';
      case 'long_term': return 'Your Summary (All Time)';
      case 'short_term':
      default: return 'Your Summary (Last 4 Weeks)';
    }
  }

  // Helper: Icon Mapper (Material Symbols for consistency)
  // UPDATED: Maps both raw labels AND friendly labels from backend
  IconData _getIconForEmotion(String label) {
    final lowerLabel = label.toLowerCase();
    
    // Map friendly labels (what backend now returns) to icons
    // Format: "Adjective Noun" -> icon
    if (lowerLabel.contains('insight')) return Symbols.lightbulb;
    if (lowerLabel.contains('annoyance')) return Symbols.sentiment_frustrated;
    if (lowerLabel.contains('caring')) return Symbols.healing; // Changed from favorite
    if (lowerLabel.contains('letdown') || lowerLabel.contains('disappointment')) return Symbols.sentiment_dissatisfied;
    if (lowerLabel.contains('dislike') || lowerLabel.contains('disapproval')) return Symbols.thumb_down;
    if (lowerLabel.contains('disgust')) return Symbols.mood_bad;
    if (lowerLabel.contains('unease') || lowerLabel.contains('embarrassment')) return Symbols.face;
    if (lowerLabel.contains('excitement')) return Symbols.bolt;
    if (lowerLabel.contains('fear')) return Symbols.sentiment_worried;
    if (lowerLabel.contains('gratitude')) return Symbols.volunteer_activism;
    if (lowerLabel.contains('grief')) return Symbols.heart_broken;
    if (lowerLabel.contains('joy')) return Symbols.sentiment_very_satisfied;
    if (lowerLabel.contains('love')) return Symbols.favorite;
    if (lowerLabel.contains('anxiety') || lowerLabel.contains('nervousness')) return Symbols.psychiatry; // Changed from sentiment_dissatisfied
    if (lowerLabel.contains('optimism')) return Symbols.light_mode;
    if (lowerLabel.contains('pride')) return Symbols.military_tech;
    if (lowerLabel.contains('relief')) return Symbols.sentiment_satisfied;
    if (lowerLabel.contains('regret') || lowerLabel.contains('remorse')) return Symbols.sentiment_sad;
    if (lowerLabel.contains('sadness')) return Symbols.sentiment_very_dissatisfied;
    if (lowerLabel.contains('surprise')) return Symbols.add_reaction;
    if (lowerLabel.contains('admiration')) return Symbols.thumb_up;
    if (lowerLabel.contains('amusement')) return Symbols.celebration; // Changed from sentiment_very_satisfied
    if (lowerLabel.contains('anger')) return Symbols.sentiment_extremely_dissatisfied;
    if (lowerLabel.contains('approval')) return Symbols.check_circle;
    if (lowerLabel.contains('confusion')) return Symbols.help;
    if (lowerLabel.contains('curiosity')) return Symbols.search;
    if (lowerLabel.contains('desire')) return Symbols.local_fire_department;
    if (lowerLabel.contains('neutral') || lowerLabel.contains('vibe')) return Symbols.sentiment_neutral;
    
    // Fallback: raw labels (backward compatibility)
    switch (lowerLabel) {
      case 'joy': return Symbols.sentiment_very_satisfied;
      case 'sadness': return Symbols.sentiment_very_dissatisfied;
      case 'anger': return Symbols.sentiment_extremely_dissatisfied;
      case 'fear': return Symbols.sentiment_worried;
      case 'love': return Symbols.favorite;
      case 'excitement': return Symbols.bolt;
      case 'surprise': return Symbols.add_reaction;
      case 'neutral': return Symbols.sentiment_neutral;
      case 'confusion': return Symbols.help;
      case 'disgust': return Symbols.mood_bad;
      case 'optimism': return Symbols.light_mode;
      case 'admiration': return Symbols.thumb_up;
      case 'anticipation': return Symbols.hourglass_empty;
      case 'approval': return Symbols.check_circle;
      case 'caring': return Symbols.healing;
      case 'desire': return Symbols.local_fire_department;
      case 'disappointment': return Symbols.sentiment_dissatisfied;
      case 'disapproval': return Symbols.thumb_down;
      case 'embarrassment': return Symbols.face;
      case 'gratitude': return Symbols.volunteer_activism;
      case 'grief': return Symbols.heart_broken;
      case 'nervousness': return Symbols.psychiatry;
      case 'pride': return Symbols.military_tech;
      case 'realization': return Symbols.lightbulb;
      case 'relief': return Symbols.sentiment_satisfied;
      case 'remorse': return Symbols.sentiment_sad;
      case 'amusement': return Symbols.celebration;
      case 'annoyance': return Symbols.sentiment_frustrated;
      case 'curiosity': return Symbols.search;
      default: return Symbols.music_note;
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
