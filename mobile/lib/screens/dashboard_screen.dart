import 'dart:math';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:personalify/widgets/ping_pong_text.dart';
import 'package:personalify/models/user_profile.dart';
import 'package:personalify/services/api_service.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/screens/login_screen.dart';
import 'package:dio/dio.dart'; // Import Dio for DioException

/// --------------------------------------------------------------------------
/// DashboardScreen: Final Polish v2
/// 1. Auto-Logout on 401 (Token Expiry)
/// 2. Flush Top Padding (No Gap)
/// 3. Ping-Pong Text Smoother Animation
/// 4. Strict Top 10 Logic (Chart + List)
/// --------------------------------------------------------------------------
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

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

  @override
  void initState() {
    super.initState();
    _apiService = ApiService(_authService);
    _tabController = TabController(length: 3, vsync: this);
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

  Future<void> _handleLogout() async {
    await _authService.logout();
    if (mounted) {
       Navigator.of(context).pushAndRemoveUntil(
         MaterialPageRoute(builder: (_) => const LoginScreen()),
         (route) => false
       );
    }
  }

  Future<void> _load() async {
    if (_spotifyId == null) return;
    setState(() => _isLoading = true);
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
    return Scaffold(
      backgroundColor: kBgColor,
      appBar: AppBar(
        backgroundColor: kBgColor,
        surfaceTintColor: kBgColor,
        elevation: 0,
        toolbarHeight: 70,
        // HEADER: Time (Left), Title (Center), Logout (Right)
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
            // AESTHETIC ICON: Clock for Time Range (History/Time)
            icon: const FaIcon(FontAwesomeIcons.clock, color: kTextPrimary, size: 20), 
            tooltip: 'Time Range',
            onSelected: (i) {
              setState(() => _selectedTimeRange = i);
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
            // AESTHETIC ICON: Right From Bracket (Exit)
            icon: const FaIcon(FontAwesomeIcons.arrowRightFromBracket, color: Colors.redAccent, size: 20),
            onPressed: _handleLogout, // Direct logout
            tooltip: 'Logout',
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: kAccentColor))
          : Column(
              children: [
                Container(
                  color: kBgColor,
                  child: TabBar(
                    controller: _tabController,
                    isScrollable: false,
                    labelColor: kAccentColor,
                    unselectedLabelColor: kTextSecondary,
                    indicatorSize: TabBarIndicatorSize.label,
                    indicatorColor: kAccentColor,
                    indicatorWeight: 3,
                    dividerColor: Colors.transparent, // "Garis tipis" removed/hidden
                    labelStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 13),
                    unselectedLabelStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 13),
                    tabs: const [
                      Tab(text: 'Tracks', height: 40),
                      Tab(text: 'Artists', height: 40),
                      Tab(text: 'Genres', height: 40),
                    ],
                  ),
                ),
                Expanded(
                  child: NotificationListener<ScrollNotification>(
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
                ),
              ],
            ),
    );
  }

  Widget _buildSectionList(Widget content) {
    return SingleChildScrollView(
      controller: _scrollController,
      physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 120), // Outer Safe Padding
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
        final index = entry.key;
        final track = entry.value;
        final isLast = index == paginatedTracks.length - 1;

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
                const SizedBox(width: 16),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: CachedNetworkImage(imageUrl: track.image, width: 56, height: 56, fit: BoxFit.cover),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min, // Important for layout
                    children: [
                      // PING-PONG Marquee Title if name is long
                      SizedBox(
                        height: 20, 
                        child: track.name.length > 25 
                        ? PingPongScrollingText(
                            text: track.name,
                            width: double.infinity,
                            style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                              color: kTextPrimary,
                            ),
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
                        // Strict Logic
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
      }).toList(),
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
        final index = entry.key;
        final artist = entry.value;
        final isLast = index == paginatedArtists.length - 1;

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
                const SizedBox(width: 16),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8), 
                  child: CachedNetworkImage(imageUrl: artist.image, width: 56, height: 56, fit: BoxFit.cover),
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
      }).toList(),
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
          final color = _getGenreColor(genre.name); 
          final isLast = index == paginatedGenres.length - 1;
          
          final artistsList = _userProfile?.artists
              .where((a) => a.genres.contains(genre.name))
              .map((a) => a.name)
              .toList() ?? [];

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
                  Padding(
                    padding: const EdgeInsets.only(top: 0), // Centered now, less padding needed
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
        }),
      ],
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
