import 'dart:math';
import 'package:personalify/widgets/top_toast.dart';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:personalify/widgets/ping_pong_text.dart';
import 'package:personalify/models/user_profile.dart';
import 'package:personalify/services/api_service.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/screens/login_screen.dart';
import 'package:personalify/screens/song_detail_screen.dart';
import 'package:dio/dio.dart';
import 'package:screenshot/screenshot.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:gal/gal.dart';

/// --------------------------------------------------------------------------
/// DashboardScreen: Final Polish v2
/// 1. Auto-Logout on 401 (Token Expiry)
/// 2. Flush Top Padding (No Gap)
/// 3. Ping-Pong Text Smoother Animation
/// 4. Strict Top 10 Logic (Chart + List)
/// --------------------------------------------------------------------------
class DashboardScreen extends StatefulWidget {
  final Function(String)? onTimeRangeChanged;
  const DashboardScreen({super.key, this.onTimeRangeChanged});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with TickerProviderStateMixin {
  final AuthService _authService = AuthService();
  late final ApiService _apiService;
  late TabController _tabController;
  final ScrollController _scrollController = ScrollController();

  // State
  String? _spotifyId;
  UserProfile? _userProfile;
  bool _isLoading = true;
  int _selectedTimeRange = 0;
  
  // Pagination State 
  bool _showTop20 = false;
  
  // Constants
  static const _timeRangeKeys = ['short_term', 'medium_term', 'long_term'];
  static const _timeRangeLabels = ['4 Weeks', '6 Months', 'All Time'];
  
  // Design System Colors
  static const Color kBgColor = Color(0xFF0a0a0a);
  static const Color kSurfaceColor = Color(0xFF181818); 
  static const Color kAccentColor = Color(0xFF1DB954); 
  static const Color kTextPrimary = Color(0xFFFFFFFF);
  static const Color kTextSecondary = Color(0xFFB3B3B3);
  static const Color kBorderColor = Color(0xFF282828);
  
  static const _genreColors = [
    Color(0xFF1DB954), Color(0xFF00C7B7), Color(0xFF2496ED), Color(0xFF9333EA),
    Color(0xFFE91E63), Color(0xFFFFD21E), Color(0xFFFF5722), Color(0xFF88B04B),
    Color(0xFFF7CAC9), Color(0xFF92A8D1), Color(0xFFFF0055), Color(0xFF00E5FF),
    Color(0xFFAA00FF), Color(0xFFFF9100), Color(0xFF00E676), Color(0xFF3D5AFE),
    Color(0xFFFFEB3B), Color(0xFF76FF03), Color(0xFFF50057), Color(0xFF651FFF),
  ];

  int _currentTabIndex = 0; 

  @override
  void initState() {
    super.initState();
    _apiService = ApiService(_authService);
    _tabController = TabController(length: 3, vsync: this);
    
    // Add listener to track VISUAL tab position continuously
    _tabController.animation!.addListener(() {
      final visualIndex = _tabController.animation!.value.round();
      print('🔄 Animation Listener: value=${_tabController.animation!.value}, rounded=$visualIndex, current=$_currentTabIndex');
      if (visualIndex != _currentTabIndex) {
        setState(() {
          _currentTabIndex = visualIndex;
          print('✅ Updated _currentTabIndex to: $visualIndex');
        });
      }
    });
    
    _init();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _scrollController.dispose();
    super.dispose();
  }
  
  Future<void> _init() async {
    final id = await _authService.getSpotifyId();
    if (id == null && mounted) {
      _handleLogout();
      return;
    }
    _spotifyId = id;
    _load();
  }
  
  Future<void> _handleShare(BuildContext context) async {
    if (_userProfile == null) return;
    
    // Use _currentTabIndex from state (synced via animation listener)
    final currentTab = _currentTabIndex;
    
    print('📤 SHARE START: _currentTabIndex=$_currentTabIndex, controller.index=${_tabController.index}, animation.value=${_tabController.animation?.value}');
    
    // DEBUG: Tell user what we are sharing
    final tabName = currentTab == 0 ? "Tracks" : currentTab == 1 ? "Artists" : "Genres";
    print('🎯 Will capture: $tabName (index $currentTab)');
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Sharing: $tabName'),
        duration: const Duration(seconds: 1),
        backgroundColor: kSurfaceColor,
      )
    );

    // Show loading indicator
    if (context.mounted) {
       showDialog(
         context: context,
         barrierDismissible: false,
         builder: (ctx) => const Center(child: CircularProgressIndicator(color: kAccentColor)),
       );
    }

    try {
      print('========== SHARE: Tab $currentTab ==========');
      final ScreenshotController screenshotController = ScreenshotController();
      
      // Build widget with unique timestamp key to force rebuild
      final widget = KeyedSubtree(
        key: ValueKey('share_tab_${currentTab}_${DateTime.now().millisecondsSinceEpoch}'),
        child: _buildShareableWidget(currentTab),
      );
      
      final Uint8List image = await screenshotController.captureFromWidget(
        widget,
        delay: const Duration(milliseconds: 500),
        pixelRatio: 3.0, 
        targetSize: const Size(400, 711),
      );

      final directory = await getApplicationDocumentsDirectory();
      
      // CRITICAL FIX: Use unique filename with timestamp to prevent Android caching
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final filePath = '${directory.path}/personalify_share_$timestamp.png';
      print('💾 Saving to: $filePath');
      
      // Clean up old share files (keep only last 5)
      try {
        final files = directory.listSync()
            .where((f) => f.path.contains('personalify_share_'))
            .map((f) => f as File)
            .toList();
        files.sort((a, b) => b.lastModifiedSync().compareTo(a.lastModifiedSync()));
        if (files.length > 5) {
          for (var i = 5; i < files.length; i++) {
            files[i].deleteSync();
          }
        }
      } catch (e) {
        print('⚠️ Cleanup failed: $e');
      }
      
      final imagePath = await File(filePath).create();
      await imagePath.writeAsBytes(image);

      if (mounted) Navigator.pop(context);
      if (mounted) _showCustomShareSheet(context, imagePath.path);
      
      print('========== SHARE COMPLETE ==========');
    } catch (e, stackTrace) {
      print('========== SHARE ERROR ==========');
      print('$e\n$stackTrace');
      
      if (mounted) Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to share: $e')),
      );
    }
  }

  // --------------------------------------------------------------------------
  // Share Layout (Top 10 Snapshot - 9:16)
  // --------------------------------------------------------------------------
  Widget _buildShareableWidget(int tabIndex) {
    print('🎨 _buildShareableWidget called with tabIndex=$tabIndex');
    
    // WEB HEADER STYLE: 
    // Title: Share your vibe
    // Sub: Discover... (Web Footer Text)
    
    // remove HTML tags from emotion paragraph just in case
    final rawEmotion = _userProfile?.emotionParagraph ?? "";
    final cleanEmotion = rawEmotion.replaceAll(RegExp(r'<[^>]*>'), '');

    return Container(
      width: 400,
      height: 711, // 9:16 Aspect Ratio (Outer Canvas)
      color: kBgColor, 
      child: FittedBox(
        fit: BoxFit.contain,
        alignment: Alignment.center,
        child: Container(
           width: 550, // WIDER CONTENT
           // NO BOUNDED HEIGHT
           constraints: const BoxConstraints(minHeight: 711), 
           // Increased Top Padding for Instagram Stories safety
           padding: const EdgeInsets.fromLTRB(32, 100, 32, 40), 
           decoration: const BoxDecoration(color: kBgColor), 
           child: Column(
             crossAxisAlignment: CrossAxisAlignment.center,
             mainAxisSize: MainAxisSize.min, 
             children: [
                // 1. HEADER
                Text(
                  'Personalify',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 40, 
                    fontWeight: FontWeight.w800,
                    color: kAccentColor,
                    height: 1.0,
                    letterSpacing: -1.0,
                  ),
                ),
                
                const SizedBox(height: 8),
                Text(
                  _selectedTimeRange == 0 ? "Here's your monthly recap, ${_userProfile?.displayName?.split(' ').first ?? 'User'}!"
                  : _selectedTimeRange == 1 ? "A look at your last 6 months, ${_userProfile?.displayName?.split(' ').first ?? 'User'}!"
                  : "Your listening overview for the year, ${_userProfile?.displayName?.split(' ').first ?? 'User'}!",
                  style: GoogleFonts.plusJakartaSans(
                    color: kTextSecondary, 
                    fontSize: 14, 
                    fontWeight: FontWeight.w600,
                  ),
                  textAlign: TextAlign.center,
                ),

                if (cleanEmotion.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  SizedBox(
                    width: 380,
                    child: Text(
                      cleanEmotion,
                      style: GoogleFonts.plusJakartaSans(
                        color: kTextPrimary.withOpacity(0.9),
                        fontSize: 14,
                        fontStyle: FontStyle.italic,
                        height: 1.4,
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
                
                const SizedBox(height: 32), // GAP

                // 2. CARD
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: kSurfaceColor,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: kBorderColor),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 10))],
                  ),
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      // Card Title (Green, No Number, No Icon)
                      Container(
                        padding: const EdgeInsets.only(bottom: 12),
                        decoration: const BoxDecoration(
                          border: Border(bottom: BorderSide(color: kBorderColor))
                        ),
                        margin: const EdgeInsets.only(bottom: 12), // Tighter margin
                        width: double.infinity,
                        alignment: Alignment.center,
                        child: Text(
                          tabIndex == 0 ? "Top Tracks" : tabIndex == 1 ? "Top Artists" : "Top Genres",
                          style: GoogleFonts.plusJakartaSans(
                             fontSize: 18,
                             fontWeight: FontWeight.bold,
                             color: kAccentColor
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      
                      // Content
                      _buildShareContent(tabIndex),
                    ],
                  ),
                ),
                
                // 3. FOOTER (Text Only, No Icon)
                const SizedBox(height: 32), 
                Text(
                  'Personalify © 2026 • Powered by Spotify API',
                  style: GoogleFonts.plusJakartaSans(
                    color: kTextSecondary, 
                    fontWeight: FontWeight.bold, 
                    fontSize: 12,
                  ),
                ),
             ],
           ),
        ),
      ),
    );
  }

  Widget _buildShareContent(int tabIndex) {
    if (tabIndex == 0) return _buildShareTracksList();
    if (tabIndex == 1) return _buildShareArtistsList();
    if (tabIndex == 2) return _buildShareGenresList();
    return const SizedBox();
  }

  Widget _buildShareTracksList() {
    final tracks = (_userProfile?.tracks ?? []).take(10).toList();
    return Container(
      decoration: BoxDecoration(
        color: kSurfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderColor),
      ),
      // Use vertical:0 because items have internal vertical:12. 
      // Need 12 at top and 12 at bottom? No, internal handles it?
      // WAIT. If I put 0, first item top text is 12px from border. 
      // Gap between items (border) is 12+12=24.
      // So Top/Bottom should be 12 to match? 12 (container) + 12 (internal) = 24.
      // YES. vertical: 12.
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16), 
      child: Column(
        children: tracks.asMap().entries.map((entry) {
          final isLast = entry.key == tracks.length - 1;
          return Padding(
            padding: EdgeInsets.zero, // NO EXTERNAL GAP. Let internal padding handle it.
            child: _buildTrackItem(entry.value, entry.key, isLast: isLast, isShare: true),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildShareArtistsList() {
    final artists = (_userProfile?.artists ?? []).take(10).toList();
    return Container(
      decoration: BoxDecoration(
        color: kSurfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderColor),
      ),
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      child: Column(
        children: artists.asMap().entries.map((entry) {
          final isLast = entry.key == artists.length - 1;
          return Padding(
            padding: EdgeInsets.zero,
            child: _buildArtistItem(entry.value, entry.key, isLast: isLast, isShare: true),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildShareGenresList() {
    final genres = (_userProfile?.genres ?? []).take(10).toList();
    return Container(
      decoration: BoxDecoration(
        color: kSurfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderColor),
      ),
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      child: Column(
        children: genres.asMap().entries.map((entry) {
          final g = entry.value;
          List<String> artistsList = [];
           if (_userProfile != null) {
              artistsList = _userProfile!.artists
                .where((a) => a.genres.contains(g.name))
                .map((a) => a.name)
                .toList();
           }
           final isLast = entry.key == genres.length - 1;
           return Padding(
             padding: EdgeInsets.zero,
             child: _buildGenreItem(g, entry.key, _getGenreColor(g.name), artistsList, isLast: isLast, isShare: true),
           );
        }).toList(),
      ),
    );
  }

  Future<void> _handleLogout() async {
    await _authService.logout();
    if (mounted) {
       Navigator.of(context).pushAndRemoveUntil(
         MaterialPageRoute(builder: (_) => const LoginScreen()),
         (route) => false
       );
    }
  }

  Future<void> _load({bool isRefresh = false}) async {
    if (_spotifyId == null) return;
    if (!isRefresh) setState(() => _isLoading = true);
    try {
      final p = await _apiService.getUserProfile(_spotifyId!, timeRange: _timeRangeKeys[_selectedTimeRange]);
      setState(() { 
        _userProfile = p; 
        _isLoading = false; 
        _showTop20 = false;
      });
    } catch (e) {
      // 1. TOKEN EXPIRY HANDLING
      if (e is DioException && e.response?.statusCode == 401) {
         _handleLogout();
         return;
      }
      setState(() => _isLoading = false);
    }
  }

  Color _getGenreColor(String genreName) {
    if (_userProfile == null) return kTextSecondary.withOpacity(0.5);
    final index = _userProfile!.genres.indexWhere((g) => g.name == genreName);
    if (index != -1) {
      return _genreColors[index % _genreColors.length];
    } else {
      return _genreColors[genreName.hashCode.abs() % _genreColors.length].withOpacity(0.5); 
    }
  }

  bool _onScrollNotification(ScrollNotification notification) {
    if (notification is ScrollUpdateNotification) {
      if (!_showTop20 && notification.metrics.extentAfter < 100 && notification.metrics.pixels > 50) {
        setState(() {
          _showTop20 = true;
        });
      }
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: kBgColor,
        body: Center(child: CircularProgressIndicator(color: kAccentColor)),
      );
    }

    return Scaffold(
      backgroundColor: kBgColor,
      extendBodyBehindAppBar: true, // Allow body to scroll behind app bar
      appBar: AppBar(
        backgroundColor: Colors.transparent, // Transparent to show blur
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        toolbarHeight: 70,
        flexibleSpace: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10), 
            child: Container(
              color: kBgColor.withOpacity(0.9), // Darker, less transparent
            ),
          ),
        ),
        leading: Theme(

                  data: Theme.of(context).copyWith(
                    popupMenuTheme: PopupMenuThemeData(
                      color: kSurfaceColor,
                      surfaceTintColor: Colors.transparent,
                      shape: RoundedRectangleBorder(
                          side: const BorderSide(color: kBorderColor),
                          borderRadius: BorderRadius.circular(12)
                      ),
                      textStyle: GoogleFonts.plusJakartaSans(color: kTextPrimary),
                    ),
                  ),
                  child: PopupMenuButton<int>(
                    offset: const Offset(0, 48),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    icon: Icon(Symbols.view_day, color: kTextPrimary, size: 20), // view_day Material Symbol 
                    tooltip: 'Time Range',
                    onSelected: (i) {
                      setState(() => _selectedTimeRange = i);
                      final timeRanges = ['short_term', 'medium_term', 'long_term'];
                      widget.onTimeRangeChanged?.call(timeRanges[i]); // Notify parent
                      _load();
                    },
                    itemBuilder: (context) => List.generate(3, (i) => PopupMenuItem(
                      value: i,
                      height: 40,
                      child: Row(
                        children: [
                           if (_selectedTimeRange == i) 
                             const FaIcon(FontAwesomeIcons.check, size: 12, color: kAccentColor)
                           else 
                             const SizedBox(width: 12),
                           const SizedBox(width: 8),
                           Text(_timeRangeLabels[i], style: GoogleFonts.plusJakartaSans(fontSize: 13)),
                        ],
                      ),
                    )),
                  ),
                ),
                centerTitle: true,
                title: Text(
                  'Personalify',
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.w800,
                    color: kAccentColor,
                    letterSpacing: -0.5,
                    fontSize: 24,
                  ),
                ),
                actions: [
                  IconButton(
                    icon: const Icon(Icons.ios_share, color: kTextPrimary, size: 22),
                    onPressed: () => _handleShare(context),
                    tooltip: 'Share Top 10',
                  ),
                  const SizedBox(width: 8),
                ],
                bottom: PreferredSize(
                  preferredSize: const Size.fromHeight(48),
                  child: Container(
                    color: Colors.transparent,
                    child: TabBar(
                      controller: _tabController,
                      isScrollable: false,
                      labelColor: kAccentColor, // Green Active
                      unselectedLabelColor: kTextSecondary,
                      indicatorSize: TabBarIndicatorSize.label,
                      indicatorColor: kAccentColor,
                      indicatorWeight: 2, // Thinner (ignored by custom indicator but good practice)
                      // Custom Indicator: Green, Thinner (2px)
                      indicator: const UnderlineTabIndicator(
                         borderSide: BorderSide(color: kAccentColor, width: 2),
                         borderRadius: BorderRadius.zero, 
                      ),
                      overlayColor: MaterialStateProperty.all(Colors.transparent), // Remove Hover/Splash Box
                      dividerColor: Colors.transparent,
                      labelStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 13),
                      unselectedLabelStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 13),
                      tabs: const [
                        Tab(text: 'Tracks', height: 40),
                        Tab(text: 'Artists', height: 40),
                        Tab(text: 'Genres', height: 40),
                      ],
                    ),
                ),
              ),
      ),
      body: NotificationListener<ScrollNotification>(
        onNotification: _onScrollNotification,
        child: TabBarView(
          controller: _tabController,
          physics: const BouncingScrollPhysics(),
          children: [
            _buildSectionList(_buildTracksList()),
            _buildSectionList(_buildArtistsList()),
            _buildSectionList(_buildGenresList()),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionList(Widget content) {
    return SingleChildScrollView(
      controller: _scrollController,
      physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      padding: const EdgeInsets.fromLTRB(16, 175, 16, 120), // Increased to 150 for Glass Header
      child: Container(
        decoration: BoxDecoration(
          color: kSurfaceColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: kBorderColor),
        ),
        // ZERO internal padding. Let the list items define their own vertical padding.
        // This ensures the first item is right at the top (with its own padding)
        // and last item is right at bottom.
        clipBehavior: Clip.hardEdge, // Clip to border radius
        child: content,
      ),
    );
  }

  List<T> _getPaginatedList<T>(List<T> list) {
    if (list.isEmpty) return [];
    if (!_showTop20) return list.take(10).toList();
    return list.take(20).toList(); 
  }

  // --------------------------------------------------------------------------
  // Tracks List
  // --------------------------------------------------------------------------
  Widget _buildTracksList() {
    final tracks = _userProfile?.tracks ?? [];
    final paginatedTracks = _getPaginatedList(tracks);

    return Column(
      children: paginatedTracks.asMap().entries.map((entry) {
        return _buildTrackItem(entry.value, entry.key, isLast: entry.key == paginatedTracks.length - 1);
      }).toList(),
    );
  }

  Widget _buildTrackItem(dynamic track, int index, {bool isLast = false, bool isShare = false}) {
     final trackItem = Container(
          decoration: BoxDecoration(
            border: isLast ? null : const Border(bottom: BorderSide(color: kBorderColor)),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                SizedBox(
                  width: 24, 
                  child: Text(
                    '${index + 1}',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: kTextSecondary.withOpacity(0.5),
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(width: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: CachedNetworkImage(imageUrl: track.image, width: 56, height: 56, memCacheWidth: 150, fit: BoxFit.cover),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        height: 20, 
                        child: (track.name.length > 25 && !isShare)
                        ? LayoutBuilder(
                            builder: (context, constraints) {
                              return PingPongScrollingText(
                                text: track.name,
                                width: constraints.maxWidth,
                                style: GoogleFonts.plusJakartaSans(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14,
                                  color: kTextPrimary,
                                ),
                              );
                            }
                          )
                        : Text(
                            track.name,
                            style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                              color: kTextPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        track.artistsString,
                        style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w500,
                          fontSize: 13,
                          color: kTextPrimary.withOpacity(0.9),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        () {
                          final total = track.album.totalTracks;
                          final name = track.album.name;
                          
                          if (total == 1) return 'Single';
                          if (total >= 2 && total <= 3) return 'Maxi-Single: $name';
                          if (total >= 4 && total <= 6) return 'EP: $name';
                          return 'Album: $name';
                        }(),
                        style: GoogleFonts.plusJakartaSans(fontSize: 11, color: const Color(0xFF888888)),
                        maxLines: 1, 
                        overflow: TextOverflow.ellipsis,
                      )
                    ],
                  ),
                ),
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.whatshot, size: 14, color: kAccentColor.withOpacity(0.7)),
                    const SizedBox(height: 2),
                    Text(
                      '${track.popularity}',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 10, 
                        fontWeight: FontWeight.bold, 
                        color: kTextSecondary
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
     
     // Wrap in GestureDetector for navigation (except for share mode)
     if (isShare) {
       return trackItem;
     }
     
     return GestureDetector(
       onTap: () {
         Navigator.push(
           context,
           MaterialPageRoute(
             builder: (context) => SongDetailScreen(
               song: {
                 'title': track.name,
                 'artist': track.artistsString,
                 'image': track.image,
                 'album': track.album.name,
                 'popularity': track.popularity,
               },
             ),
           ),
         );
       },
       child: trackItem,
     );
  }

  // --------------------------------------------------------------------------
  // Artists List
  // --------------------------------------------------------------------------
  Widget _buildArtistsList() {
    final artists = _userProfile?.artists ?? [];
    final paginatedArtists = _getPaginatedList(artists);

    return Column(
      children: paginatedArtists.asMap().entries.map((entry) {
        return _buildArtistItem(entry.value, entry.key, isLast: entry.key == paginatedArtists.length - 1);
      }).toList(),
    );
  }

  Widget _buildArtistItem(dynamic artist, int index, {bool isLast = false, bool isShare = false}) {
     return Container(
          decoration: BoxDecoration(
            border: isLast ? null : const Border(bottom: BorderSide(color: kBorderColor)),
          ),
          child: Padding(
             padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
             child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                SizedBox(
                  width: 24,
                  child: Text(
                    '${index + 1}',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: kTextSecondary.withOpacity(0.5),
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(width: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8), 
                  child: CachedNetworkImage(imageUrl: artist.image, width: 56, height: 56, memCacheWidth: 150, fit: BoxFit.cover),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        artist.name,
                        style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: kTextPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis, 
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 4,
                        runSpacing: 4,
                        children: (artist.genres as List<String>).map((g) {
                          Color c = _getGenreColor(g);
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: c.withOpacity(0.5)),
                              color: c.withOpacity(0.05),
                            ),
                            child: Text(
                              g,
                              style: GoogleFonts.plusJakartaSans(fontSize: 10, color: kTextPrimary, fontWeight: FontWeight.w500),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ),
                ),
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.whatshot, size: 14, color: kAccentColor.withOpacity(0.7)),
                    const SizedBox(height: 2),
                    Text(
                      '${artist.popularity ?? 0}', 
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 10, 
                        fontWeight: FontWeight.bold, 
                        color: kTextSecondary
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
  }

  // --------------------------------------------------------------------------
  // Genres List
  // --------------------------------------------------------------------------
  Widget _buildGenresList() {
    final genres = _userProfile?.genres ?? [];
    if (genres.isEmpty) return const SizedBox();
    final paginatedGenres = _getPaginatedList(genres);

    return Column(
      children: [
        // Chart Area
        Padding(
          padding: const EdgeInsets.all(24.0),
          child: SizedBox(
            height: 220,
            width: 220,
            child: _userProfile != null ? CustomPaint(
              // Chart ALWAYS shows top 20 or all available to be "Real", 
              // BUT strict display requires limiting to what's visible?
              // Voice feedback: "Termasuk chart yang ada di genre... awalnya top 10"
              painter: RadialBarChartPainter(
                data: _userProfile!.genres.take(_showTop20 ? 20 : 10).toList(), // Strict control
                colors: _genreColors,
                getColor: _getGenreColor, 
              ),
            ) : const SizedBox(),
          ),
        ),
        
        // List items
        ...paginatedGenres.asMap().entries.map((entry) {
          final index = entry.key;
          final genre = entry.value;
          
          final artistsList = _userProfile?.artists
              .where((a) => a.genres.contains(genre.name))
              .map((a) => a.name)
              .toList() ?? [];

          return _buildGenreItem(genre, index, _getGenreColor(genre.name), artistsList, isLast: index == paginatedGenres.length - 1);
        }),
      ],
    );
  }

  Widget _buildGenreItem(dynamic genre, int index, Color color, List<String> artistsList, {bool isLast = false, bool isShare = false}) {
     return Container(
            decoration: BoxDecoration(
              border: isLast ? null : const Border(bottom: BorderSide(color: kBorderColor)),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center, // 4. CENTER VERTICAL
                children: [
                  Container(
                    width: 24, 
                    alignment: Alignment.center,
                    child: Text('${index + 1}', style: TextStyle(fontWeight: FontWeight.bold, color: kTextSecondary.withOpacity(0.5))),
                  ),
                  const SizedBox(width: 8), 
                  const SizedBox(width: 8), 
                  Padding(
                    padding: const EdgeInsets.only(top: 0),
                    child: Container(
                      width: 10, height: 10,
                      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          genre.name,
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                            color: kTextPrimary,
                          ),
                        ),
                        if (artistsList.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              'Mentioned ${genre.count} times: ${artistsList.join(", ")}',
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w500,
                                fontSize: 11,
                                color: const Color(0xFF666666),
                                height: 1.3,
                              ),
                            ),
                          ),
                         if (artistsList.isEmpty)
                           Text(
                               'Mentioned ${genre.count} times',
                               style: GoogleFonts.plusJakartaSans(
                                 fontWeight: FontWeight.w500,
                                 fontSize: 11,
                                 color: const Color(0xFF666666),
                               ),
                           ),
                      ],
                    ),
                  )
                ],
              ),
            ),
          );
  }
  void _showCustomShareSheet(BuildContext context, String imagePath) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        height: 600, 
        decoration: BoxDecoration(
          color: kBgColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(color: Colors.white.withOpacity(0.1)),
        ),
        child: Column(
          children: [
            // Handle
            Container(margin: const EdgeInsets.only(top: 12, bottom: 24), width: 40, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
            
            // Title
            Text("Share your vibe", style: GoogleFonts.plusJakartaSans(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 24),

            // Image Preview (Small Card)
            Expanded(
              child: Center(
                child: Container(
                   margin: const EdgeInsets.symmetric(horizontal: 40),
                   decoration: BoxDecoration(
                     borderRadius: BorderRadius.circular(16),
                     boxShadow: [BoxShadow(color: Colors.black45, blurRadius: 20, offset: const Offset(0, 10))]
                   ),
                   child: ClipRRect(
                     borderRadius: BorderRadius.circular(16), 
                     child: Image.file(File(imagePath), fit: BoxFit.contain)
                   ),
                ),
              ),
            ),
            const SizedBox(height: 32),

            // Share Button (Liquid Glass - Navbar Style)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Container(
                width: double.infinity,
                height: 56,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                     BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 20, offset: const Offset(0, 10)),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.1), // Glass
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withOpacity(0.2)),
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () {
                            Navigator.pop(ctx);
                            Share.shareXFiles([XFile(imagePath)], text: 'My Personalify Top 10 🎵 personalify.app');
                          },
                          splashColor: Colors.white24,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Symbols.ios_share, size: 22, color: kTextPrimary),
                              const SizedBox(width: 12),
                              Text("Share via...", style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold, fontSize: 16, color: kTextPrimary)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            
            // Other options
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                 TextButton.icon(
                   onPressed: () async {
                     try {
                        await Gal.putImage(imagePath);
                        if (ctx.mounted) {
                           Navigator.pop(ctx);
                           // Show Top Toast instead of SnackBar
                           showTopToast(context, "Saved to Gallery!", type: ToastType.success);
                        }
                     } catch (e) {
                        print("Save Error: $e");
                        if (ctx.mounted) {
                           ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text("Error saving: $e")));
                        }
                     }
                   }, 
                   icon: Icon(Symbols.arrow_circle_down, color: kTextSecondary, size: 24), 
                   label: Text("Save Image", style: GoogleFonts.plusJakartaSans(color: kTextSecondary))
                 ),
                 const SizedBox(width: 24),
                 TextButton.icon(
                   onPressed: () => Navigator.pop(ctx), 
                   icon: Icon(Symbols.cancel, color: kTextSecondary, size: 24), 
                   label: Text("Cancel", style: GoogleFonts.plusJakartaSans(color: kTextSecondary))
                 ),
              ],
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

class _StickyTabBarDelegate extends SliverPersistentHeaderDelegate {
  final Widget child;
  _StickyTabBarDelegate(this.child);
  @override double get minExtent => 52;
  @override double get maxExtent => 52;
  @override Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) => child;
  @override bool shouldRebuild(_StickyTabBarDelegate oldDelegate) => false;
}

class RadialBarChartPainter extends CustomPainter {
  final List<dynamic> data; 
  final List<Color> colors;
  final Color Function(String)? getColor; 

  RadialBarChartPainter({required this.data, required this.colors, this.getColor});

  @override
  void paint(Canvas canvas, Size size) {
    if (data.isEmpty) return; // Guard
    final center = Offset(size.width / 2, size.height / 2);
    final maxRadius = min(size.width, size.height) / 2;
    // Stroke width and spacing fine tuned for "Real" feel
    final strokeWidth = (maxRadius * 0.9) / max(data.length, 1) * 0.8; 
    final spacing = (maxRadius * 0.9) / max(data.length, 1) * 0.2;
    
    // Painter assumes data is already prepared/limited by the widget
    final renderCount = data.length; 
    final maxCount = data.isNotEmpty ? data.first.count.toDouble() : 1.0;

    for (int i = 0; i < renderCount; i++) {
      final item = data[i];
      // USE STRICT LOOKUP if provided
      final color = getColor != null 
          ? getColor!(item.name) 
          : colors[i % colors.length];
          
      final radius = maxRadius - (i * (strokeWidth + spacing));
      if (radius <= 0) break;

      final paint = Paint()..style = PaintingStyle.stroke..strokeWidth = strokeWidth..strokeCap = StrokeCap.round;
      paint.color = color.withOpacity(0.15);
      canvas.drawCircle(center, radius, paint);
      paint.color = color;
      final sweepAngle = (item.count / maxCount) * (2 * pi * 0.75); 
      canvas.drawArc(Rect.fromCircle(center: center, radius: radius), -pi / 2, sweepAngle, false, paint);
    }
  }
  @override bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
