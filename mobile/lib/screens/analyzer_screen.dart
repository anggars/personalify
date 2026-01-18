import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:personalify/services/api_service.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/widgets/ping_pong_text.dart';

import 'package:personalify/models/user_profile.dart'; // Import Model

class AnalyzerScreen extends StatefulWidget {
  final UserProfile? userProfile;

  const AnalyzerScreen({super.key, this.userProfile});

  @override
  State<AnalyzerScreen> createState() => _AnalyzerScreenState();
}

class _AnalyzerScreenState extends State<AnalyzerScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ApiService _apiService = ApiService(AuthService()); // Initialize ApiService
  final AuthService _authService = AuthService(); // Add Auth Service

  // Colors
  static const Color kBgColor = Color(0xFF0a0a0a);
  static const Color kSurfaceColor = Color(0xFF181818);
  static const Color kAccentColor = Color(0xFF1DB954);
  static const Color kTextPrimary = Color(0xFFFFFFFF);
  static const Color kTextSecondary = Color(0xFFB3B3B3);
  static const Color kBorderColor = Color(0xFF282828);

  // --- LYRICS TAB STATE ---
  final TextEditingController _lyricsController = TextEditingController();
  bool _isAnalyzingLyrics = false;
  Map<String, dynamic>? _lyricsResult;

  // --- GENIUS TAB STATE ---
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;
  List<dynamic> _artistSuggestions = [];
  bool _suggestionsVisible = false;

  Map<String, dynamic>? _selectedArtist;
  List<dynamic> _artists = []; // Search results
  List<dynamic> _songs = [];
  String? _selectedSongId;
  bool _isLoadingSongs = false;
  String? _geniusLoadingState; // "Searching...", "Analyzing..."
  Map<String, dynamic>? _geniusAnalysis;

  // Global Vibe State
  UserProfile? _userProfile;
  bool _isLoadingProfile = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);

    // Initialize UserProfile
    if (widget.userProfile != null) {
      _userProfile = widget.userProfile;
    } else {
      _fetchUserProfile();
    }
  }

  Future<void> _fetchUserProfile() async {
    setState(() => _isLoadingProfile = true);
    try {
      final id = await _authService.getSpotifyId();
      if (id != null) {
        final profile = await _apiService.getUserProfile(id);
        if (mounted) {
           setState(() {
             _userProfile = profile;
           });
        }
      }
    } catch (e) {
      print("Error fetching profile for analyzer: $e");
    } finally {
      if (mounted) setState(() => _isLoadingProfile = false);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _lyricsController.dispose();
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  // --- LYRICS LOGIC ---

  Future<void> _analyzeLyrics() async {
    final text = _lyricsController.text.trim();
    if (text.isEmpty) {
      _showError("Please paste some lyrics first!");
      return;
    }

    setState(() { _isAnalyzingLyrics = true; _lyricsResult = null; });

    try {
      final result = await _apiService.analyzeLyrics(text);
      if (mounted) setState(() => _lyricsResult = result);
    } catch (e) {
      _showError("Analysis failed. Please try again.");
    } finally {
      if (mounted) setState(() => _isAnalyzingLyrics = false);
    }
  }

  // --- GENIUS LOGIC ---

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    if (query.isEmpty) {
      setState(() => _artistSuggestions = []);
      return;
    }

    _debounce = Timer(const Duration(milliseconds: 500), () async {
      try {
        final results = await _apiService.autocompleteArtist(query);
        if (mounted) setState(() => _artistSuggestions = results);
      } catch (e) {
        // Silent fail for autocomplete
      }
    });
  }

  Future<void> _searchArtist() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) {
      _showError("Please enter an artist name.");
      return;
    }

    setState(() {
      _geniusLoadingState = 'search';
      _selectedArtist = null;
      _songs = [];
      _geniusAnalysis = null;
      _artistSuggestions = [];
    });

    try {
      final results = await _apiService.searchArtist(query);
      if (results.isEmpty) _showError("No artist found.");
      if (mounted) setState(() => _artists = results);
    } catch (e) {
      _showError("Search failed.");
    } finally {
      if (mounted) setState(() => _geniusLoadingState = null);
    }
  }

  Future<void> _loadSongs(Map<String, dynamic> artist) async {
    setState(() {
      _selectedArtist = artist;
      _artists = []; // Clear list to show selected view
      _suggestionsVisible = false;
      _geniusLoadingState = 'songs';
      _searchController.text = artist['name']; // Auto-fill
    });

    try {
      final songs = await _apiService.getArtistSongs(artist['id']);
      if (mounted) setState(() => _songs = songs);
    } catch (e) {
      _showError("Failed to load songs.");
    } finally {
      if (mounted) setState(() => _geniusLoadingState = null);
    }
  }

  Future<void> _analyzeSong(int songId) async {
    setState(() {
      _selectedSongId = songId.toString();
      _geniusLoadingState = 'analyze';
      _geniusAnalysis = null;
    });

    try {
      final result = await _apiService.getLyricsEmotion(songId);
      if (mounted) setState(() => _geniusAnalysis = result);
    } catch (e) {
      _showError("Analysis failed.");
    } finally {
      if (mounted) setState(() => _geniusLoadingState = null);
    }
  }

  void _clearGenius() {
    setState(() {
      _searchController.clear();
      _artists = [];
      _songs = [];
      _selectedArtist = null;
      _selectedSongId = null;
      _geniusAnalysis = null;
      _artistSuggestions = [];
    });
  }



  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBgColor,
      body: SafeArea(
        child: Column(
          children: [
             const SizedBox(height: 16),
             Container(
               color: kBgColor,
               padding: const EdgeInsets.symmetric(horizontal: 16),
               child: TabBar(
                 controller: _tabController,
                 isScrollable: false,
                 labelColor: kAccentColor,
                 unselectedLabelColor: kTextSecondary,
                 indicatorSize: TabBarIndicatorSize.label,
                 indicatorColor: kAccentColor,
                 indicatorWeight: 3,
                 dividerColor: Colors.transparent,
                 labelStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 13),
                 unselectedLabelStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 13),
                 tabs: const [
                   Tab(text: 'Lyrics', height: 40),
                   Tab(text: 'Genius', height: 40),
                 ],
               ),
             ),
             Expanded(
               child: TabBarView(
                 controller: _tabController,
                 children: <Widget>[
                   _buildLyricsTab(),
                   _buildGeniusTab(),
                 ],
               ),
             ),
          ],
        ),
      ),
    );
  }

  // --- WIDGETS: LYRICS TAB ---

  Widget _buildLyricsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Lyrics Analyzer',
            style: GoogleFonts.plusJakartaSans(fontSize: 28, fontWeight: FontWeight.w800, color: kAccentColor),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Paste lyrics below to uncover hidden emotions.',
            style: GoogleFonts.plusJakartaSans(fontSize: 14, color: kTextSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),

          // --- GLOBAL VIBE CARD (If no result yet) ---
          if (_isLoadingProfile) 
             const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator(color: kAccentColor)),
             )
          else if (_lyricsResult == null && _userProfile != null && _userProfile!.topEmotions.isNotEmpty) ...[
             Container(
               padding: const EdgeInsets.all(20),
               decoration: BoxDecoration(
                 color: kSurfaceColor,
                 borderRadius: BorderRadius.circular(20),
                 border: Border.all(color: kBorderColor),
               ),
               child: Column(
                 children: [
                   Row(
                     mainAxisAlignment: MainAxisAlignment.center,
                     children: [
                       const Icon(Icons.auto_awesome, color: kAccentColor, size: 20),
                       const SizedBox(width: 8),
                       Text("Your Global Vibe", style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold, fontSize: 16)),
                     ],
                   ),
                   const SizedBox(height: 16),
                   Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: _userProfile!.topEmotions.take(3).map((e) {
                         return Column(
                           children: [
                             CircleAvatar(
                               backgroundColor: kBgColor,
                               radius: 24, // Slightly larger
                               child: FaIcon(_getIconForEmotion(e.label), size: 20, color: kAccentColor),
                             ),
                             const SizedBox(height: 8),
                             Text(e.label.toUpperCase(), style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.bold, color: kTextPrimary)),
                             Text("${(e.score * 100).toInt()}%", style: GoogleFonts.plusJakartaSans(fontSize: 10, color: kTextSecondary)),
                           ],
                         );
                      }).toList(),
                   )
                 ],
               ),
             ),
             const SizedBox(height: 24),
          ],
          
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF1A1A1A), // Darker Input BG
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.transparent), // Clean
            ),
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                TextField(
                  controller: _lyricsController,
                  maxLines: 8,
                  style: GoogleFonts.plusJakartaSans(color: kTextPrimary, fontSize: 14),
                  decoration: InputDecoration(
                    hintText: "Write or paste your lyrics here...",
                    hintStyle: GoogleFonts.plusJakartaSans(color: kTextSecondary.withOpacity(0.5)),
                    border: InputBorder.none,
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isAnalyzingLyrics ? null : _analyzeLyrics,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kAccentColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    child: _isAnalyzingLyrics 
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text('Analyze Emotions', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
          
          if (_lyricsResult != null) ...[
            const SizedBox(height: 24),
            _buildEmotionResults(_lyricsResult!['emotions']),
          ]
        ],
      ),
    );
  }

  Widget _buildEmotionResults(List<dynamic>? emotions) {
    if (emotions == null || emotions.isEmpty) {
      return Center(child: Text("No significant emotions found.", style: GoogleFonts.plusJakartaSans(color: kTextSecondary)));
    }

    // Filter and sort
    final filtered = emotions.where((e) => (e['score'] as num) > 0.05).toList();
    if (filtered.isEmpty) return const SizedBox();
    
    final maxScore = filtered.map((e) => (e['score'] as num).toDouble()).reduce((a, b) => a > b ? a : b);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("Emotion Results:", style: GoogleFonts.plusJakartaSans(color: kAccentColor, fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 12),
        ...filtered.take(10).map((e) {
          final score = (e['score'] as num).toDouble();
          final percentage = (score * 100).toStringAsFixed(1);
          final relativeWidth = score / maxScore;

          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                 SizedBox(
                   width: 80,
                   child: Text(
                     e['label'].toString().toUpperCase(),
                     style: GoogleFonts.plusJakartaSans(color: kTextPrimary, fontWeight: FontWeight.bold, fontSize: 12),
                     overflow: TextOverflow.ellipsis,
                   ),
                 ),
                 Expanded(
                   child: Container(
                     height: 8,
                     margin: const EdgeInsets.symmetric(horizontal: 12),
                     decoration: BoxDecoration(
                       color: kSurfaceColor,
                       borderRadius: BorderRadius.circular(4),
                     ),
                     child: FractionallySizedBox(
                       alignment: Alignment.centerLeft,
                       widthFactor: relativeWidth,
                       child: Container(
                         decoration: BoxDecoration(
                           color: kAccentColor,
                           borderRadius: BorderRadius.circular(4),
                         ),
                       ),
                     ),
                   ),
                 ),
                 Text(
                   "$percentage%",
                   style: GoogleFonts.plusJakartaSans(color: kTextSecondary, fontWeight: FontWeight.bold, fontSize: 12),
                 ),
              ],
            ),
          );
        }).toList(),
      ],
    );
  }

  // --- WIDGETS: GENIUS TAB ---

  Widget _buildGeniusTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Genius Analyzer',
            style: GoogleFonts.plusJakartaSans(fontSize: 28, fontWeight: FontWeight.bold, color: kAccentColor),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Pick a song to deep dive into meanings.',
            style: GoogleFonts.plusJakartaSans(fontSize: 14, color: kTextSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),

          // Search Bar
          Container(
            decoration: BoxDecoration(
              color: kSurfaceColor,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: kBorderColor),
            ),
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  onChanged: _onSearchChanged,
                  onSubmitted: (_) => _searchArtist(),
                  style: GoogleFonts.plusJakartaSans(color: kTextPrimary, fontSize: 14),
                  decoration: InputDecoration(
                    hintText: "Type artist name (e.g. The Beatles)...",
                    hintStyle: GoogleFonts.plusJakartaSans(color: kTextSecondary.withOpacity(0.5)),
                    border: InputBorder.none,
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.search, color: kAccentColor),
                      onPressed: _searchArtist,
                    ),
                  ),
                ),
                if (_selectedArtist != null) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                       onPressed: _clearGenius,
                       style: OutlinedButton.styleFrom(
                         foregroundColor: Colors.redAccent,
                         side: const BorderSide(color: Colors.redAccent),
                         shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                       ),
                       child: const Text("Clear Search"),
                    ),
                  ),
                ]
              ],
            ),
          ),

          // Suggestions
          if (_artistSuggestions.isNotEmpty && _suggestionsVisible && _selectedArtist == null)
            Container(
              margin: const EdgeInsets.only(top: 8),
              decoration: BoxDecoration(color: kSurfaceColor, borderRadius: BorderRadius.circular(12)),
              child: Column(
                children: _artistSuggestions.map((artist) => ListTile(
                  leading: const Icon(Icons.music_note, color: kTextSecondary, size: 20),
                  title: Text(artist['name'], style: GoogleFonts.plusJakartaSans(color: kTextPrimary)),
                  onTap: () {
                    _searchController.text = artist['name'];
                    _searchArtist();
                  },
                )).toList(),
              ),
            ),
          
          const SizedBox(height: 24),

          // Loading Indicator
          if (_geniusLoadingState != null)
             const Padding(
               padding: EdgeInsets.all(24.0),
               child: Center(child: CircularProgressIndicator(color: kAccentColor)),
             ),

          // Artist Results Grid
          if (_artists.isNotEmpty && _geniusLoadingState == null)
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.8,
                crossAxisSpacing: 12, 
                mainAxisSpacing: 12,
              ),
              itemCount: _artists.length,
              itemBuilder: (context, index) {
                final artist = _artists[index];
                return GestureDetector(
                  onTap: () => _loadSongs(artist),
                  child: Container(
                    decoration: BoxDecoration(
                      color: kSurfaceColor, 
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: kBorderColor),
                    ),
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(50),
                          child: CachedNetworkImage(
                            imageUrl: artist['image_url'] ?? '',
                            width: 80, height: 80, fit: BoxFit.cover,
                            errorWidget: (_,__,___) => Container(color: Colors.grey, width: 80, height: 80),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          artist['name'], 
                          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold, color: kTextPrimary),
                          textAlign: TextAlign.center,
                          maxLines: 2, overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),

           // Song List
           if (_songs.isNotEmpty && _geniusLoadingState == null) ...[
             const SizedBox(height: 8),
             Text(
               "Top Songs by ${_selectedArtist?['name']}",
               style: GoogleFonts.plusJakartaSans(color: kAccentColor, fontWeight: FontWeight.bold),
             ),
             const SizedBox(height: 12),
             ListView.builder(
               shrinkWrap: true,
               physics: const NeverScrollableScrollPhysics(),
               itemCount: _songs.length,
               itemBuilder: (context, index) {
                 final song = _songs[index];
                 final isSelected = _selectedSongId == song['id'].toString();
                 return GestureDetector(
                   onTap: () => _analyzeSong(song['id']),
                   child: Container(
                     margin: const EdgeInsets.only(bottom: 12),
                     padding: const EdgeInsets.all(12),
                     decoration: BoxDecoration(
                       color: isSelected ? kAccentColor.withOpacity(0.1) : kSurfaceColor,
                       borderRadius: BorderRadius.circular(12),
                       border: Border.all(color: isSelected ? kAccentColor : kBorderColor),
                     ),
                     child: Row(
                       children: [
                         ClipRRect(
                           borderRadius: BorderRadius.circular(8),
                           child: CachedNetworkImage(
                             imageUrl: song['image'] ?? '',
                             width: 48, height: 48, fit: BoxFit.cover,
                             errorWidget: (_,__,___) => Container(color: Colors.grey, width: 48, height: 48),
                           ),
                         ),
                         const SizedBox(width: 12),
                         Expanded(
                           child: Column(
                             crossAxisAlignment: CrossAxisAlignment.start,
                             children: [
                               Text(
                                 song['title'],
                                 style: GoogleFonts.plusJakartaSans(
                                   fontWeight: FontWeight.bold, 
                                   color: isSelected ? kAccentColor : kTextPrimary
                                 ),
                               ),
                               Text(
                                 song['album'] ?? "Single",
                                 style: GoogleFonts.plusJakartaSans(color: kTextSecondary, fontSize: 12),
                               ),
                             ],
                           ),
                         ),
                       ],
                     ),
                   ),
                 );
               },
             ),
           ],

           // Analysis Result
           if (_geniusAnalysis != null) ...[
             const SizedBox(height: 32),
             Container(
               decoration: BoxDecoration(
                 color: kSurfaceColor,
                 borderRadius: BorderRadius.circular(16),
                 border: Border.all(color: kBorderColor),
               ),
               padding: const EdgeInsets.all(16),
               child: Column(
                 crossAxisAlignment: CrossAxisAlignment.start,
                 children: [
                    Center(
                      child: Text(
                        _geniusAnalysis!['track_info']['title'],
                        style: GoogleFonts.plusJakartaSans(fontSize: 20, fontWeight: FontWeight.bold, color: kAccentColor),
                        textAlign: TextAlign.center,
                      ),
                    ),
                   const SizedBox(height: 16),
                   Container(
                     constraints: const BoxConstraints(maxHeight: 200),
                     child: SingleChildScrollView(
                       child: Text(
                         _geniusAnalysis!['lyrics'] ?? '',
                         style: GoogleFonts.plusJakartaSans(color: kTextSecondary, fontSize: 13, height: 1.5),
                       ),
                     ),
                   ),
                   const SizedBox(height: 24),
                   const Divider(color: kBorderColor),
                   const SizedBox(height: 24),
                   if (_geniusAnalysis!['emotion_analysis'] != null)
                      _buildEmotionResults(_geniusAnalysis!['emotion_analysis']['emotions']),
                 ],
               ),
             ),
           ]

        ],
      ),
    );
  }
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
}

