import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:personalify/widgets/analysis_card.dart';
import 'package:personalify/services/api_service.dart';
import 'package:personalify/widgets/ping_pong_text.dart'; // Import Marquee Widget
import 'package:personalify/widgets/native_glass.dart'; // Ensure this exists
import 'package:provider/provider.dart';

class SongDetailScreen extends StatefulWidget {
  final Map<String, dynamic>? song;
  const SongDetailScreen({super.key, this.song});

  @override
  State<SongDetailScreen> createState() => _SongDetailScreenState();
}

class _SongDetailScreenState extends State<SongDetailScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  static const Color kAccentColor = Color(0xFF1DB954);
  int _selectedTabIndex = 0;

  // Real Lyrics from Genius API
  bool _isLoadingLyrics = true;
  String? _lyrics;
  Map<String, dynamic>? _lyricsData; // Store full response
  String? _lyricsError;

  // Dummy Analysis (for now - can be replaced with real emotion data)
  final Map<String, dynamic> _analysis = {
    "emotion": "Melancholic",
    "sentiment_score": 0.2, 
    "meaning": "The song explores the painful reality of moving on from a past relationship while still lingering on memories of an ex-partner. It highlights the comparison between a current perfect partner and the emotional depth of a lost love.",
    "facts": [
      {"title": "Piano Ballad", "text": "Written as a simple piano ballad but became a global hit."},
      {"title": "Viral Hit", "text": "Exploded on TikTok, becoming Joji's highest-charting song."},
      {"title": "Video Concept", "text": "The music video depicts destructive behavior, contrasting the song's softness."}
    ]
  };

  bool _isTransitionComplete = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      setState(() {
        _selectedTabIndex = _tabController.index;
      });
    });
    
    // Defer heavy blur rendering until transition is likely done
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _isTransitionComplete = true);
    });

    _fetchLyrics();
  }

  Future<void> _fetchLyrics() async {
    if (widget.song == null) {
      setState(() {
        _isLoadingLyrics = false;
        _lyricsError = 'No song data';
      });
      return;
    }

    final title = widget.song!['title'] ?? widget.song!['track_name'] ?? '';
    final artist = widget.song!['artist'] ?? widget.song!['artist_name'] ?? '';

    if (title.isEmpty || artist.isEmpty) {
      setState(() {
        _isLoadingLyrics = false;
        _lyricsError = 'Incomplete song information';
      });
      return;
    }

    try {
      final apiService = Provider.of<ApiService>(context, listen: false);
      
      // Step 1: Search for artist
      final artists = await apiService.searchArtist(artist);
      if (artists.isEmpty) {
        setState(() {
          _isLoadingLyrics = false;
          _lyricsError = 'Artist not found on Genius';
        });
        return;
      }

      // Step 2: Get artist's songs
      final artistId = artists.first['id'];
      final songs = await apiService.getArtistSongs(artistId);
      
      // Step 3: Find matching song (fuzzy match by title)
      final matchedSong = songs.firstWhere(
        (song) => (song['title'] as String)
            .toLowerCase()
            .contains(title.toLowerCase().split('(').first.trim()), // Remove anything after ( in title
        orElse: () => null,
      );

      if (matchedSong == null) {
        setState(() {
          _isLoadingLyrics = false;
          _lyricsError = 'Lyrics not available';
        });
        return;
      }

      // Step 4: Get lyrics and emotion
      final songId = matchedSong['id'];
      final lyricsData = await apiService.getLyricsEmotion(songId);
      print("DEBUG_SONG_DETAIL: Response for $title: $lyricsData");

      // Normalize: Flatten 'track_info' if present
      final Map<String, dynamic> normalizedData = Map<String, dynamic>.from(lyricsData);
      if (lyricsData.containsKey('track_info') && lyricsData['track_info'] is Map) {
        normalizedData.addAll(Map<String, dynamic>.from(lyricsData['track_info']));
      }

      // FIX: Extract emotions from nested `emotion_analysis`
      if (lyricsData.containsKey('emotion_analysis')) {
         final analysis = lyricsData['emotion_analysis'];
         if (analysis is Map && analysis.containsKey('emotions')) {
             normalizedData['emotions'] = analysis['emotions'];
         } else if (analysis is Map && analysis.containsKey('error')) {
             print("DEBUG_SONG_DETAIL: Analysis Error -> ${analysis['error']}");
         }
      }
      
      setState(() {
        _lyrics = normalizedData['lyrics'] as String?;
        _lyricsData = normalizedData; 
        _isLoadingLyrics = false;
      });

    } catch (e) {
      print('Error fetching lyrics: $e');
      setState(() {
        _isLoadingLyrics = false;
        _lyricsError = 'Failed to load lyrics';
      });
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Use song data if available
    final title = widget.song?['title'] ?? widget.song?['track_name'] ?? 'Unknown Track';
    final artist = widget.song?['artist'] ?? widget.song?['artist_name'] ?? 'Unknown Artist';
    final cover = widget.song?['image'] ?? widget.song?['image_url'] ?? '';
    final trackId = widget.song?['id']?.toString() ?? '';

    return Stack(
      children: [
        // 1. Immersive Animated Background
        // OPTIMIZE: Fade in expensive blur ONLY after transition completes
        // Prevents "Jank" during the slide animation
        Positioned.fill(
           child: Container(color: Colors.black), // Base color
        ),
        
        if (cover.isNotEmpty)
          Positioned.fill(
             child: AnimatedOpacity(
               duration: const Duration(milliseconds: 500),
               opacity: _isTransitionComplete ? 1.0 : 0.0,
               child: NativeGlass(imageUrl: cover), // NATIVE BLUR RESTORED
             ),
          ),
        
        // 2. Dark Overlay
        Positioned.fill(
          child: Container(
            color: Colors.black.withOpacity(0.5),
          ),
        ),

        // 3. Content
        Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
              onPressed: () => Navigator.pop(context),
            ),
            centerTitle: true,
          ),
          body: Column(
            children: [
              const SizedBox(height: 16),
              _buildSegmentedTab(),
              const SizedBox(height: 16),
              
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  physics: const BouncingScrollPhysics(),
                  children: [
                    _buildLyricsTab(),
                    _buildDeepDiveTab(),
                  ],
                ),
              ),
            ],
          ),
        ),

        // 4. Floating Header (Text Only - No Artwork Collision)
        Positioned(
          top: MediaQuery.of(context).padding.top + 10,
          left: 50,
          right: 50,
          child: Material( 
            type: MaterialType.transparency,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // REMOVED: Small Hero Image (Fixed "nabrak" issue)
                
                // Title Marquee
                SizedBox(
                  height: 24, // Keep height comfortable
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      return PingPongScrollingText(
                        text: title,
                        width: constraints.maxWidth,
                        alignment: Alignment.center,
                        style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white), 
                      );
                    }
                  ),
                ),
                
                // Artist Marquee
                SizedBox(
                  height: 18,
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      return PingPongScrollingText(
                          text: artist,
                          width: constraints.maxWidth,
                          alignment: Alignment.center,
                          style: GoogleFonts.plusJakartaSans(fontSize: 12, color: Colors.white70),
                      );
                    }
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSegmentedTab() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 40),
      height: 48,
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.3),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Stack(
        children: [
          AnimatedAlign(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
            alignment: _selectedTabIndex == 0 ? Alignment.centerLeft : Alignment.centerRight,
            child: FractionallySizedBox(
              widthFactor: 0.5,
              heightFactor: 1.0,
              child: Container(
                margin: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(20),
                ),
              ),
            ),
          ),
          Row(
            children: [
              _buildTabItem("Lyrics", 0),
              _buildTabItem("Deep Dive", 1),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTabItem(String text, int index) {
    final isSelected = _selectedTabIndex == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => _tabController.animateTo(index),
        behavior: HitTestBehavior.translucent,
        child: Center(
          child: Text(
            text,
            style: GoogleFonts.plusJakartaSans(
              color: isSelected ? Colors.white : Colors.white60,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
              fontSize: 14,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLyricsTab() {
    if (_isLoadingLyrics) {
      return const Center(
        child: CircularProgressIndicator(color: kAccentColor),
      );
    }

    if (_lyricsError != null || _lyrics == null || _lyrics!.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.music_off, color: Colors.white38, size: 64),
            const SizedBox(height: 16),
            Text(
              _lyricsError ?? 'Lyrics not available',
              style: GoogleFonts.plusJakartaSans(
                color: Colors.white54,
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }

    return RepaintBoundary( // FIX: Cache shader mask for smoother tab swipe
      child: ShaderMask(
        shaderCallback: (rect) {
          return const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.black, Colors.black, Colors.transparent],
            stops: [0.0, 0.8, 1.0],
          ).createShader(rect);
        },
        blendMode: BlendMode.dstIn,
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(32, 24, 32, 100),
          child: Text(
            _lyrics!,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
              height: 1.5,
            ),
            textAlign: TextAlign.start,
          ),
        ),
      ),
    );
  }

  Widget _buildDeepDiveTab() {
    // Show loading state
    if (_isLoadingLyrics) {
      return const Center(
        child: CircularProgressIndicator(color: kAccentColor),
      );
    }

    // Show error or no emotion data
    if (_lyricsData == null || _lyricsData!['emotions'] == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.analytics_outlined, color: Colors.white38, size: 64),
            const SizedBox(height: 16),
            Text(
              'Emotion analysis not available',
              style: GoogleFonts.plusJakartaSans(
                color: Colors.white54,
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }

    // Extract real emotion data
    final emotions = _lyricsData!['emotions'] as List<dynamic>?;
    final topEmotion = emotions != null && emotions.isNotEmpty 
        ? emotions.first 
        : {'label': 'Unknown', 'score': 0.0};
    
    String capitalize(String s) => s.isNotEmpty ? '${s[0].toUpperCase()}${s.substring(1)}' : '';

    final emotionLabel = capitalize(topEmotion['label'] ?? 'Unknown');
    final emotionScore = (topEmotion['score'] ?? 0.0) as num;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Section 1: Vibe & Sentiment (Real Data)
          AnalysisCard(
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(_getEmotionIcon(emotionLabel), color: kAccentColor, size: 28),
                    const SizedBox(width: 12),
                    Text(
                      emotionLabel,
                      style: GoogleFonts.plusJakartaSans(fontSize: 24, fontWeight: FontWeight.w800, color: kAccentColor),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    const Icon(Icons.sentiment_dissatisfied, color: Colors.white54, size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Container(
                        height: 8,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: emotionScore.toDouble(),
                          child: Container(
                            decoration: BoxDecoration(
                              color: kAccentColor,
                              borderRadius: BorderRadius.circular(4),
                              boxShadow: [BoxShadow(color: kAccentColor.withOpacity(0.6), blurRadius: 8)]
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Icon(Icons.sentiment_satisfied_alt, color: Colors.white54, size: 20),
                  ],
                ),
                const SizedBox(height: 8),
                Text("Confidence Score: ${(emotionScore * 100).toStringAsFixed(1)}%", 
                     style: GoogleFonts.plusJakartaSans(color: Colors.white54, fontSize: 12)),
              ],
            ),
          ),
          
          const SizedBox(height: 24),

          // Show top 5 emotions if available
          if (emotions != null && emotions.length > 1) ...[
            Text("TOP EMOTIONS", style: GoogleFonts.plusJakartaSans(color: Colors.white54, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1)),
            const SizedBox(height: 12),
            ...emotions.take(5).map((emotion) {
              final label = capitalize(emotion['label'] ?? 'Unknown');
              final score = (emotion['score'] ?? 0.0) as num;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AnalysisCard(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Icon(_getEmotionIcon(label), color: kAccentColor, size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          label,
                          style: GoogleFonts.plusJakartaSans(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                      ),
                      Text(
                        '${(score * 100).toStringAsFixed(0)}%',
                        style: GoogleFonts.plusJakartaSans(color: kAccentColor, fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
            const SizedBox(height: 24),
          ],
          
          const SizedBox(height: 48),
        ],
      ),
    );
  }

  // Helper to get emotion icon
  IconData _getEmotionIcon(String emotion) {
    switch (emotion.toLowerCase()) {
      case 'joy':
      case 'happiness':
      case 'happy':
        return FontAwesomeIcons.faceSmileBeam;
      case 'sadness':
      case 'sad':
      case 'grief':
      case 'loneliness':
        return FontAwesomeIcons.faceSadTear;
      case 'anger':
      case 'angry':
      case 'rage':
      case 'frustration':
        return FontAwesomeIcons.faceAngry;
      case 'fear':
      case 'scared':
      case 'anxiety':
      case 'nervous':
        return FontAwesomeIcons.faceFlushed;
      case 'love':
      case 'loving':
      case 'romance':
      case 'affection':
        return FontAwesomeIcons.heart;
      case 'excitement':
      case 'excited':
      case 'thrill':
        return FontAwesomeIcons.bolt;
      case 'surprise':
      case 'surprised':
      case 'shock':
        return FontAwesomeIcons.faceSurprise;
      case 'neutral':
      case 'calm':
        return FontAwesomeIcons.faceMeh;
      case 'disgust':
      case 'disgusted':
        return FontAwesomeIcons.faceGrimace;
      case 'optimism':
      case 'optimistic':
      case 'hope':
        return FontAwesomeIcons.lightbulb; // Changed from sun to lightbulb/chart
      case 'pessimism':
      case 'pessimistic':
        return FontAwesomeIcons.cloudRain;
      case 'amusement':
      case 'amused':
      case 'funny':
        return FontAwesomeIcons.faceLaughSquint;
      // New specific mappings
      case 'real-life':
      case 'real life':
      case 'reality':
        return FontAwesomeIcons.earthAmericas;
      case 'design':
      case 'creativity':
      case 'art':
        return FontAwesomeIcons.palette;
      case 'caring':
      case 'kindness':
      case 'care':
        return FontAwesomeIcons.handHoldingHeart;
      case 'realization':
      case 'epiphany':
        return FontAwesomeIcons.brain;
      case 'gratitude':
      case 'grateful':
      case 'thankful':
        return FontAwesomeIcons.handsPraying;
      case 'desire':
      case 'lust':
      case 'craving':
        return FontAwesomeIcons.fire;
      case 'admiration':
      case 'admire':
        return FontAwesomeIcons.star;
      case 'curiosity':
      case 'curious':
        return FontAwesomeIcons.magnifyingGlass;
      case 'pride':
      case 'proud':
        return FontAwesomeIcons.medal;
      case 'pain':
      case 'hurt':
      case 'suffering':
        return FontAwesomeIcons.bandage;
      case 'confusion':
      case 'confused':
        return FontAwesomeIcons.question;
      case 'nostalgia':
      case 'nostalgic':
        return FontAwesomeIcons.hourglassHalf;
      case 'relief':
      case 'relieved':
        return FontAwesomeIcons.faceSmile;
      
      // --- New Comprehensive Mappings ---
      case 'determination':
      case 'determined':
      case 'confidence':
      case 'confident':
      case 'power':
      case 'strong':
        return FontAwesomeIcons.fistRaised;
      case 'lonely':
      case 'loneliness':
      case 'alone':
      case 'isolation':
        return FontAwesomeIcons.personThroughWindow; // or cloudRain
      case 'bored':
      case 'boredom':
        return FontAwesomeIcons.faceRollingEyes;
      case 'disgust':
      case 'disgusted':
        return FontAwesomeIcons.faceGrimace;
      case 'party':
      case 'celebration':
      case 'dance':
      case 'club':
        return FontAwesomeIcons.champagneGlasses;
      case 'dream':
      case 'dreamy':
      case 'fantasy':
        return FontAwesomeIcons.cloudMoon;
      case 'funny':
      case 'humor':
      case 'comedy':
      case 'fun':
        return FontAwesomeIcons.masksTheater;
      case 'dark':
      case 'evil':
      case 'horror':
      case 'scary':
        return FontAwesomeIcons.ghost;
      case 'nature':
      case 'forest':
        return FontAwesomeIcons.tree;
      case 'city':
      case 'urban':
        return FontAwesomeIcons.city;
      case 'travel':
      case 'trip':
      case 'journey':
        return FontAwesomeIcons.plane;
      case 'breakup':
      case 'heartbreak':
      case 'broken':
        return FontAwesomeIcons.heartCrack;
      case 'friendship':
      case 'friends':
        return FontAwesomeIcons.userGroup;
      case 'money':
      case 'wealth':
      case 'flex':
      case 'rich':
        return FontAwesomeIcons.sackDollar;
      case 'summer':
      case 'sunny':
      case 'hot':
        return FontAwesomeIcons.sun;
      case 'winter':
      case 'cold':
      case 'snow':
        return FontAwesomeIcons.snowflake;
      case 'night':
      case 'midnight':
        return FontAwesomeIcons.moon;
      case 'focus':
      case 'concentration':
      case 'study':
        return FontAwesomeIcons.bullseye;
      case 'sexy':
      case 'sensual':
      case 'seductive':
        return FontAwesomeIcons.pepperHot; // or fire
      case 'intense':
      case 'intensity':
        return FontAwesomeIcons.bolt;
      case 'regret':
      case 'guilt':
        return FontAwesomeIcons.faceFrownOpen;
      case 'freedom':
      case 'free':
      case 'liberation':
        return FontAwesomeIcons.dove;
      case 'mystery':
      case 'mysterious':
      case 'secret':
        return FontAwesomeIcons.userSecret;
      case 'chaos':
      case 'chaotic':
        return FontAwesomeIcons.tornado;
      case 'victory':
      case 'win':
      case 'success':
        return FontAwesomeIcons.trophy;
        
      // --- User Requested 27 Emotions Mapping ---
      case 'admiration': return FontAwesomeIcons.star; // Inspiring
      case 'amusement': return FontAwesomeIcons.masksTheater; // Playful
      case 'anger': return FontAwesomeIcons.fire; // Intense
      case 'annoyance': return FontAwesomeIcons.personWalkingDashedLineArrowRight; // Subtle/Dashed? Or faceRollingEyes
      case 'approval': return FontAwesomeIcons.thumbsUp; // Positive
      case 'caring': return FontAwesomeIcons.handHoldingHeart; // Gentle
      case 'confusion': return FontAwesomeIcons.question; // Hazy
      case 'curiosity': return FontAwesomeIcons.magnifyingGlass; // Sparked
      case 'desire': return FontAwesomeIcons.heartCircleBolt; // Yearning
      case 'disappointment': return FontAwesomeIcons.faceFrownOpen; // Quiet letdown
      case 'disapproval': return FontAwesomeIcons.thumbsDown; // Firm dislike
      case 'disgust': return FontAwesomeIcons.faceGrimace; // Raw
      case 'embarrassment': return FontAwesomeIcons.faceFlushed; // Awkward
      case 'excitement': return FontAwesomeIcons.bolt; // Bright
      case 'fear': return FontAwesomeIcons.ghost; // Cold
      case 'gratitude': return FontAwesomeIcons.handsPraying; // Warm
      case 'grief': return FontAwesomeIcons.cloudShowersHeavy; // Heavy
      case 'joy': return FontAwesomeIcons.sun; // Radiant
      case 'love': return FontAwesomeIcons.heart; // Tender
      case 'nervousness': return FontAwesomeIcons.faceMehBlank; // Tense/Anxiety. Or faceGrimace? Used Flushed for Embarrassment. Nervous -> stop watch? Or faceDizzy? I'll use faceMehBlank or personWalking.
      case 'optimism': return FontAwesomeIcons.lightbulb; // Hopeful
      case 'pride': return FontAwesomeIcons.medal; // Bold
      case 'realization': return FontAwesomeIcons.brain; // Sudden insight
      case 'relief': return FontAwesomeIcons.faceSmile; // Soothing
      case 'remorse': return FontAwesomeIcons.rotateLeft; // Deep regret (Backward/Undo) or faceSadTear
      case 'sadness': return FontAwesomeIcons.cloudRain; // Soft
      case 'surprise': return FontAwesomeIcons.gift; // Pure (Gift box? Or exclamation?)
      
      // Fallback aliases
      case 'annoyed': return FontAwesomeIcons.faceRollingEyes;
      case 'embarrassed': return FontAwesomeIcons.faceFlushed;
      case 'nervous': return FontAwesomeIcons.faceMehBlank;
      case 'surprised': return FontAwesomeIcons.exclamation;
      
      default:
        // Use a generic logic-based icon or fallback
        if (emotion.toLowerCase().contains('happy') || emotion.toLowerCase().contains('joy')) return FontAwesomeIcons.faceSmile;
        if (emotion.toLowerCase().contains('sad')) return FontAwesomeIcons.faceFrown;
        if (emotion.toLowerCase().contains('love')) return FontAwesomeIcons.heart;
        // Default fallback
        return FontAwesomeIcons.circleQuestion;
    }
  }
}
