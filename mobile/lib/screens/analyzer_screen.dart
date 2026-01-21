import 'dart:async';
import 'dart:ui';
import 'package:personalify/widgets/top_toast.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:personalify/widgets/ping_pong_text.dart';
import 'package:personalify/services/api_service.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/models/user_profile.dart';
import 'package:material_symbols_icons/symbols.dart';

class AnalyzerScreen extends StatefulWidget {
  final UserProfile? userProfile;

  const AnalyzerScreen({super.key, this.userProfile});

  @override
  State<AnalyzerScreen> createState() => _AnalyzerScreenState();
}

class _AnalyzerScreenState extends State<AnalyzerScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ApiService _apiService = ApiService(AuthService()); 
  
  static const Color kBgColor = Color(0xFF0a0a0a);
  static const Color kSurfaceColor = Color(0xFF181818);
  static const Color kAccentColor = Color(0xFF1DB954);
  static const Color kTextPrimary = Color(0xFFFFFFFF);
  static const Color kTextSecondary = Color(0xFFB3B3B3);
  static const Color kCardBorderColor = Colors.white12;

  final TextEditingController _lyricsController = TextEditingController();
  bool _isAnalyzingLyrics = false;
  Map<String, dynamic>? _lyricsResult;

  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;
  List<dynamic> _artistSuggestions = [];

  Map<String, dynamic>? _selectedArtist;
  List<dynamic> _artists = []; 
  List<dynamic> _songs = [];
  String? _selectedSongId;
  String? _geniusLoadingState; 
  Map<String, dynamic>? _geniusAnalysis;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
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
    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (context) => TopToast(
        message: message, 
        type: ToastType.error,
        onDismissed: () => entry.remove(),
      ),
    );
    Overlay.of(context).insert(entry);
  }

  Future<void> _analyzeLyrics() async {
    final text = _lyricsController.text.trim();
    if (text.isEmpty) { _showError("Please paste some lyrics first!"); return; }
    FocusScope.of(context).unfocus();
    setState(() { _isAnalyzingLyrics = true; _lyricsResult = null; });
    try {
      final result = await _apiService.analyzeLyrics(text);
      if (mounted) setState(() => _lyricsResult = result);
    } catch (e) {
      _showError("Analysis failed.");
    } finally {
      if (mounted) setState(() => _isAnalyzingLyrics = false);
    }
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    if (query.isEmpty) { setState(() => _artistSuggestions = []); return; }
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      try {
        final results = await _apiService.searchArtist(query); 
        if (mounted) setState(() => _artistSuggestions = results);
      } catch (e) {}
    });
  }

  Future<void> _searchArtist() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() { _geniusLoadingState = 'search'; _selectedArtist = null; _songs = []; _geniusAnalysis = null; _artistSuggestions = []; });
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
    FocusScope.of(context).unfocus(); // Dismiss Keyboard
    setState(() { _selectedArtist = artist; _artists = []; _geniusLoadingState = 'songs'; _searchController.text = artist['name']; _artistSuggestions = []; });
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
    setState(() { _selectedSongId = songId.toString(); _geniusLoadingState = 'analyze'; _geniusAnalysis = null; });
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
    setState(() { _searchController.clear(); _artists = []; _songs = []; _selectedArtist = null; _selectedSongId = null; _geniusAnalysis = null; _artistSuggestions = []; });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBgColor,
      resizeToAvoidBottomInset: false, // Disable expensive scaffold resize
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text('Analyzer', style: GoogleFonts.plusJakartaSans(fontSize: 24, fontWeight: FontWeight.w800, color: kAccentColor, letterSpacing: -0.5)),
        centerTitle: true,
        backgroundColor: Colors.transparent, 
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        toolbarHeight: 70,
        flexibleSpace: Container(
          color: kBgColor.withOpacity(0.95), 
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            color: Colors.transparent,
            child: TabBar(
              controller: _tabController,
              isScrollable: false,
              labelColor: kAccentColor,
              unselectedLabelColor: kTextSecondary,
              indicatorSize: TabBarIndicatorSize.label,
              indicatorColor: kAccentColor,
              indicatorWeight: 2,
              indicator: const UnderlineTabIndicator(
                borderSide: BorderSide(color: kAccentColor, width: 2),
                borderRadius: BorderRadius.zero,
              ),
              overlayColor: MaterialStateProperty.all(Colors.transparent),
              dividerColor: Colors.transparent,
              labelStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 13),
              unselectedLabelStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 13),
              tabs: const [ Tab(text: "Lyrics", height: 40), Tab(text: "Genius", height: 40) ],
            ),
          ),
        ),
      ),

      body: TabBarView(
        controller: _tabController,
        children: [ _buildLyricsTab(), _buildGeniusTab() ],
      ),
    );
  }

  Widget _buildUnifiedCard({required List<Widget> children}) {
    // Manually handle keyboard padding
    final bottomPadding = MediaQuery.of(context).viewInsets.bottom;
    
    return Center(
      child: RepaintBoundary( 
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(20, 175, 20, 120 + bottomPadding), // Dynamic Padding
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: kSurfaceColor, 
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: kCardBorderColor),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
          ),
        ),
      ),
    );
  }

  Widget _buildLyricsTab() {
    return _buildUnifiedCard(children: [
      Container(
        decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(16)),
        child: TextField(
          controller: _lyricsController, maxLines: 8, minLines: 4,
          style: GoogleFonts.plusJakartaSans(color: kTextPrimary, fontSize: 16, height: 1.5),
          decoration: InputDecoration(
            hintText: "Write or paste your lyrics here...", 
            hintStyle: GoogleFonts.plusJakartaSans(color: kTextSecondary.withOpacity(0.5)),
            border: InputBorder.none, 
            contentPadding: const EdgeInsets.all(16),
          ),
        ),
      ),
      const SizedBox(height: 16), // Reduced from 20
      SizedBox(height: 50, child: ElevatedButton(onPressed: _isAnalyzingLyrics ? null : _analyzeLyrics, style: ElevatedButton.styleFrom(backgroundColor: kSurfaceColor, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), side: const BorderSide(color: Colors.white12), elevation: 0), child: _isAnalyzingLyrics ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : Text('Analyze Emotions', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white)))),
      if (_lyricsResult != null) ...[const SizedBox(height: 16), _buildEmotionResults(_lyricsResult!['emotions'])] // Reduced from 32
      else if (!_isAnalyzingLyrics && _lyricsController.text.isEmpty) ...[Padding(padding: const EdgeInsets.only(top: 32), child: Column(children: [Icon(Symbols.lyrics, color: kTextSecondary, size: 32), const SizedBox(height: 8), Text("Uncover the emotions hidden in text", style: GoogleFonts.plusJakartaSans(color: kTextSecondary, fontSize: 13))]))]
    ]);
  }

  Widget _buildGeniusTab() {
     return _buildUnifiedCard(children: [
          Container(
             decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(16)),
             child: TextField(
               controller: _searchController, onChanged: _onSearchChanged, textAlignVertical: TextAlignVertical.center, style: GoogleFonts.plusJakartaSans(color: kTextPrimary, fontSize: 15),
               decoration: InputDecoration(hintText: "Type artist name...", hintStyle: GoogleFonts.plusJakartaSans(color: kTextSecondary.withOpacity(0.5)), border: InputBorder.none, contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14)), onSubmitted: (_) => _searchArtist(),
             ),
           ),
           const SizedBox(height: 16),
           SizedBox(height: 50, child: ElevatedButton(onPressed: _selectedArtist == null ? _searchArtist : _clearGenius, style: ElevatedButton.styleFrom(backgroundColor: kSurfaceColor, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), elevation: 0, side: _selectedArtist == null ? const BorderSide(color: Colors.white12) : BorderSide(color: Colors.red.withOpacity(0.3))), child: _geniusLoadingState == 'search' ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : Text(_selectedArtist == null ? "Search Artist" : "Clear Search", style: GoogleFonts.plusJakartaSans(color: _selectedArtist == null ? Colors.white : Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 15)))),
           
           // Artist Suggestions Grid (Hide if Artists Results are shown)
           if (_artistSuggestions.isNotEmpty && _selectedArtist == null && _artists.isEmpty) ...[
              const SizedBox(height: 8), 
              const Divider(color: Colors.white10), 
              const SizedBox(height: 8),
              GridView.builder(
                key: const ValueKey('suggestions_grid'),
                shrinkWrap: true, 
                padding: EdgeInsets.zero,
                physics: const NeverScrollableScrollPhysics(), 
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2, // Reverted to 2 Cols
                  childAspectRatio: 1.0, 
                  crossAxisSpacing: 12, 
                  mainAxisSpacing: 12
                ), 
                itemCount: _artistSuggestions.length, 
                itemBuilder: (context, index) { 
                  final artist = _artistSuggestions[index]; 
                  return GestureDetector(
                    onTap: () {
                        // Direct Load Songs
                       _selectedArtist = artist;
                       _loadSongs(artist);
                    }, 
                    child: Container(
                      decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.white10)), 
                      padding: const EdgeInsets.all(8), 
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center, 
                        children: [
                          ClipOval(child: CachedNetworkImage(imageUrl: artist['image'] ?? '', width: 80, height: 80, fit: BoxFit.cover, errorWidget: (_,__,___) => Container(color: Colors.grey, width: 80, height: 80))), 
                          const SizedBox(height: 12), 
                          Text(artist['name'], style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold, color: kTextPrimary, fontSize: 13), textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis)
                        ]
                      )
                    )
                  ); 
                }
              )
           ],

           if (_geniusLoadingState == 'songs' || _geniusLoadingState == 'analyze') const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator(color: kAccentColor))),
           if (_artists.isNotEmpty && _geniusLoadingState == null) ...[
             const SizedBox(height: 12), // Reduced Gap
             // const Divider(color: Colors.white10), // Removed Divider to reduce gap
             
             GridView.builder(
               key: const ValueKey('results_grid'),
               shrinkWrap: true, 
               padding: EdgeInsets.zero, // Force Zero Padding
               physics: const NeverScrollableScrollPhysics(), 
               gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                 crossAxisCount: 2, // Reverted to 2 Cols
                 childAspectRatio: 0.9, // Slightly taller for bigger text
                 crossAxisSpacing: 12, 
                 mainAxisSpacing: 12
               ), 
               itemCount: _artists.length, 
               itemBuilder: (context, index) { 
                 final artist = _artists[index]; 
                 return GestureDetector(
                   onTap: () => _loadSongs(artist), 
                   child: Container(
                     decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white10)), 
                     padding: const EdgeInsets.all(12), 
                     child: Column(
                       mainAxisAlignment: MainAxisAlignment.center, 
                       children: [
                         ClipOval(child: CachedNetworkImage(imageUrl: artist['image'] ?? '', width: 90, height: 90, memCacheWidth: 200, fit: BoxFit.cover, errorWidget: (_,__,___) => Container(color: Colors.grey, width: 90, height: 90))), 
                         const SizedBox(height: 12), 
                         Text(artist['name'], style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold, color: kTextPrimary, fontSize: 14), textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis)
                       ]
                     )
                   )
                 ); 
               }
             )
           ],
           
           if (_songs.isNotEmpty && _geniusLoadingState == null) ...[
             const SizedBox(height: 16),
             Text("Songs by ${_selectedArtist!['name']}", style: GoogleFonts.plusJakartaSans(color: kAccentColor, fontWeight: FontWeight.bold, fontSize: 16), textAlign: TextAlign.center),
             const SizedBox(height: 16),
             
             Container(
               height: 325,
               decoration: BoxDecoration(
                 color: Colors.transparent, // MATCHING ORIGINAL STYLE
                 borderRadius: BorderRadius.circular(16), 
                 border: Border.all(color: kCardBorderColor)
               ),
               child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(vertical: 0),
                    itemCount: _songs.length,
                    separatorBuilder: (_, __) => const Divider(color: kCardBorderColor, height: 1),
                    itemBuilder: (context, index) {
                      final song = _songs[index];
                      final isSelected = _selectedSongId == song['id'].toString();
                      return Material(
                        color: isSelected ? kAccentColor.withOpacity(0.1) : Colors.transparent,
                        child: InkWell(
                          onTap: () => _analyzeSong(song['id']),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            child: Row(
                              children: [
                                ClipRRect(borderRadius: BorderRadius.circular(4), child: CachedNetworkImage(imageUrl: song['image'] ?? '', width: 40, height: 40, memCacheWidth: 100, fit: BoxFit.cover)),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      LayoutBuilder(
                                        builder: (context, constraints) {
                                          return PingPongScrollingText(
                                            text: song['title'],
                                            width: constraints.maxWidth,
                                            style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold, fontSize: 13, color: isSelected ? kAccentColor : kTextPrimary),
                                          );
                                        }
                                      ),
                                      const SizedBox(height: 4), 
                                      Text(song['release_date_for_display'] ?? song['date'] ?? song['release_date'] ?? "Unknown Date", style: GoogleFonts.plusJakartaSans(color: kTextSecondary, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
                                    ],
                                  ),
                                ),
                                if (isSelected) const Icon(Icons.check_circle, color: kAccentColor, size: 16)
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
               ),
             ),
           ],

           if (_geniusAnalysis != null) ...[
              const SizedBox(height: 16), // Unified Gap (Divider Removed)
              
              // <-- ATUR JARAK MARGIN TOP JUDUL LAGU DI SINI (Image 1)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24), // Avoid edge touching
                child: LayoutBuilder(
                   builder: (context, constraints) {
                     return PingPongScrollingText(
                       text: _geniusAnalysis!['track_info']['title'],
                       width: constraints.maxWidth,
                       alignment: Alignment.center,
                       style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.bold, color: kAccentColor),
                     );
                   }
                ),
              ), 
              Text(_geniusAnalysis!['track_info']['artist'], style: GoogleFonts.plusJakartaSans(color: kTextSecondary, fontSize: 14), textAlign: TextAlign.center),
              const SizedBox(height: 16), // Reduced from 20
              Container(
                height: 300, 
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(12), border: Border.all(color: kCardBorderColor)),
                child: SingleChildScrollView(
                  child: Text(
                     _geniusAnalysis!['lyrics'], 
                     style: GoogleFonts.plusJakartaSans(color: kTextSecondary, fontSize: 13, height: 1.6),
                     textAlign: TextAlign.left,
                  ),
                ),
              ),
              const SizedBox(height: 16), // Reduced from 24
              if (_geniusAnalysis!['emotion_analysis'] != null) _buildEmotionResults(_geniusAnalysis!['emotion_analysis']['emotions']),
           ],
     ]);
  }

  Widget _buildEmotionResults(List<dynamic>? emotions) {
    if (emotions == null || emotions.isEmpty) return const SizedBox();
    final filtered = emotions.where((e) => (e['score'] as num) > 0.05).toList();
    if (filtered.isEmpty) return Text("No distinct emotions found.", style: GoogleFonts.plusJakartaSans(color: kTextSecondary), textAlign: TextAlign.center);
    final maxScore = filtered.map((e) => (e['score'] as num).toDouble()).reduce((a, b) => a > b ? a : b);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Symmetric Title Spacing (20px)
        Text("Emotion Results:", style: GoogleFonts.plusJakartaSans(color: kAccentColor, fontWeight: FontWeight.bold, fontSize: 16), textAlign: TextAlign.center),
        const SizedBox(height: 12), // Top Spacing = 20px
        
        ...List.generate(filtered.take(5).length, (index) {
             final e = filtered[index];
             final score = (e['score'] as num).toDouble();
             final percentage = (score * 100).toStringAsFixed(1); 
             final relativeWidth = score / maxScore;
             final isLast = index == filtered.take(5).length - 1;
             
             return Padding(
               padding: EdgeInsets.only(bottom: isLast ? 0 : 10), // Zero padding for last item
               child: Row(
                 crossAxisAlignment: CrossAxisAlignment.center,
                 children: [
                   // DYNAMIC WIDTH LABEL
                   Text(
                      e['label'].toString().replaceFirstMapped(RegExp(r'^[a-z]'), (m) => m[0]!.toUpperCase()), 
                      style: GoogleFonts.plusJakartaSans(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                   ),
                   const SizedBox(width: 8), 
                   Expanded(
                     child: Container(
                       height: 6, // Thinner Bar (6px)
                       decoration: BoxDecoration(color: Colors.white.withOpacity(0.1), borderRadius: BorderRadius.circular(3)), 
                       alignment: Alignment.centerLeft,
                       child: FractionallySizedBox(
                         widthFactor: relativeWidth,
                         child: _ShimmerBar(color: kAccentColor), // Custom Shimmer Widget
                       ),
                     ),
                   ),
                   const SizedBox(width: 8),
                   SizedBox(width: 36, child: Text("$percentage%", style: GoogleFonts.plusJakartaSans(color: kTextSecondary, fontSize: 12, fontWeight: FontWeight.w500), textAlign: TextAlign.right)),
                 ],
               ),
             );
           }),
      ],
    );
  }
}

// Custom Shimmer Bar Widget
class _ShimmerBar extends StatefulWidget {
  final Color color;
  const _ShimmerBar({required this.color});

  @override
  State<_ShimmerBar> createState() => _ShimmerBarState();
}

class _ShimmerBarState extends State<_ShimmerBar> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 2000))..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(3), // Match parent radius
            gradient: LinearGradient(
              begin: Alignment(-2.0 + _controller.value * 4, -0.5), // Move gradient
              end: Alignment(-1.0 + _controller.value * 4, 0.5),
              colors: [
                widget.color,
                widget.color.withOpacity(0.3), // Reduced Highlight (Less Shining)
                widget.color, 
              ],
              stops: const [0.0, 0.5, 1.0],
            ),
            boxShadow: [
              BoxShadow(
                color: widget.color.withOpacity(0.15), // Reduced Shadow Opacity
                blurRadius: 4, // Reduced Blur
                offset: const Offset(0, 0), 
              )
            ],
          ),
        );
      },
    );
  }
}
