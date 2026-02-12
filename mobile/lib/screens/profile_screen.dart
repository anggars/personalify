import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:personalify/utils/constants.dart';
import 'package:personalify/models/user_profile.dart';
import 'package:personalify/services/api_service.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/screens/settings_screen.dart';
import 'package:provider/provider.dart';
import 'package:personalify/models/now_playing.dart';
import 'package:personalify/widgets/error_view.dart';
import 'package:personalify/widgets/ping_pong_text.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:async';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _profileData;
  NowPlaying? _nowPlaying;
  int _currentProgressMs = 0;
  bool _isLoading = true;
  String? _errorMessage;
  Timer? _pollingTimer;
  Timer? _tickerTimer;

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _startPolling();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _tickerTimer?.cancel();
    super.dispose();
  }

  void _startPolling() {
    _pollingTimer = Timer.periodic(const Duration(seconds: 10), (timer) {
      if (mounted && !_isLoading) {
        _loadNowPlaying();
      }
    });

    // Start 1s ticker for real-time progress
    _tickerTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted && _nowPlaying != null && _nowPlaying!.isPlaying && !_nowPlaying!.isAd && _nowPlaying!.track != null) {
        setState(() {
          final maxDur = _nowPlaying!.track!.durationMs;
          if (_currentProgressMs + 1000 < maxDur) {
            _currentProgressMs += 1000;
          } else {
            _currentProgressMs = maxDur;
          }
        });
      }
    });
  }

  Future<void> _loadProfile() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    
    try {
      final apiService = Provider.of<ApiService>(context, listen: false);
      final data = await apiService.getFullUserProfile();
      
      if (mounted) {
        if (data != null) {
          setState(() {
            _profileData = data;
            _isLoading = false;
          });
        } else {
          setState(() {
            _errorMessage = "Failed to fetch profile (404/500)";
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
    
    // Initial load of playback status
    _loadNowPlaying();
  }

  Future<void> _loadNowPlaying() async {
    try {
      final apiService = Provider.of<ApiService>(context, listen: false);
      final data = await apiService.getCurrentlyPlaying();
      if (mounted) {
        setState(() {
          _nowPlaying = data;
          if (data?.track != null) {
             _currentProgressMs = data!.track!.progressMs;
          }
        });
      }
    } catch (_) {
      // Silently fail for polling
    }
  }

  Future<void> _logout() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    await authService.logout();
    if (mounted) {
       Navigator.of(context, rootNavigator: true).pushReplacementNamed('/');
    }
  }

  Future<void> _openSpotify() async {
     final userid = _profileData?['id'];
     final deepLink = userid != null ? 'spotify:user:$userid' : 'spotify:';
     final webUrl = userid != null ? 'https://open.spotify.com/user/$userid' : 'https://open.spotify.com';

     try {
       // Try Native App
       final uri = Uri.parse(deepLink);
       if (await canLaunchUrl(uri)) {
          await launchUrl(uri); 
          return;
       }
     } catch (_) {}

     // Fallback to Web (External App Mode)
     try {
       await launchUrl(Uri.parse(webUrl), mode: LaunchMode.externalApplication);
     } catch (e) {
       if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Could not open Spotify: $e")));
     }
  }

  @override
  Widget build(BuildContext context) {
    // Header Style (Standardized: 24px ExtraBold, Centered)
    final headerStyle = GoogleFonts.plusJakartaSans(
      fontSize: 24, 
      fontWeight: FontWeight.w800,
      color: kAccentColor,
      letterSpacing: -0.5,
    );

    if (_isLoading) return const Center(child: CircularProgressIndicator(color: kAccentColor));
    
    if (_errorMessage != null || _profileData == null) {
      return Scaffold( // Ensure it has a scaffold background if full screen
        backgroundColor: kBgColor,
        body: ErrorView(
          title: "Profile Unavailable",
          message: _errorMessage ?? "Failed to load profile data.\nPlease try refreshing or logging in again.",
          onRetry: _loadProfile,
          onLogout: _logout,
        ),
      );
    }

    final name = _profileData!['display_name'] ?? 'Spotify User';
    final userid = _profileData!['id'] ?? '';
    final image = _profileData!['image_url'] ?? '';
    final followers = '${_profileData!['followers'] ?? 0}';
    final country = _profileData!['country'] ?? '-';
    final product = (_profileData!['product'] ?? 'free').toString().toUpperCase();

    return Scaffold(
      backgroundColor: kBgColor,
      appBar: AppBar(
        title: Text('Profile', style: headerStyle), // Matched Header Size
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        toolbarHeight: 70, // Consistent Header Height
        actions: [
            IconButton(
                icon: const Icon(Icons.settings_outlined, color: kTextPrimary),
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen())),
            )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        child: RepaintBoundary(
          child: Column(
            children: [
            // 1. Large Profile Image
            Center(
              child: Container(
                width: 160,
                height: 160,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: kSurfaceColor,
                  image: image.isNotEmpty 
                      ? DecorationImage(image: CachedNetworkImageProvider(image, maxWidth: 320), fit: BoxFit.cover)
                      : null,
                ),
                child: image.isEmpty 
                    ? const Icon(Icons.person_rounded, size: 80, color: Colors.grey)
                    : null,
              ),
            ),
            
            const SizedBox(height: 24),

            // 2. Name & Verified Badge
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  name,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                    color: kTextPrimary,
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.verified_rounded, color: kAccentColor, size: 24),
              ],
            ),
            
            const SizedBox(height: 8),
            
            // Spotify ID
            Text(
              '@$userid',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 14,
                color: kTextSecondary,
              ),
            ),

            const SizedBox(height: 20),

            // 3.5. Now Playing / Ad - MOVED TO TOP
            if (_nowPlaying != null && (_nowPlaying!.isPlaying || _nowPlaying!.isAd)) ...[
              _buildNowPlaying(),
              const SizedBox(height: 20),
            ],

            // 3. Real Info (Stats)
            _buildInfoGroup([
              _buildInfoRow(Icons.people_outline_rounded, "Followers", followers),
              _buildDivider(),
              _buildInfoRow(Icons.star_outline_rounded, "Subscription", product),
              _buildDivider(),
              _buildInfoRow(Icons.flag_outlined, "Country", country),
            ]),

            const SizedBox(height: 20),

            // 4. Actions
            _buildInfoGroup([
              _buildActionRow(Icons.open_in_new_rounded, "Open Spotify", kAccentColor, _openSpotify),
              _buildDivider(),
              _buildActionRow(Icons.logout_rounded, "Logout", Colors.redAccent, _logout),
            ]),
            
            const SizedBox(height: 20),
            Text(
              "Personalify for Spotify",
              style: GoogleFonts.plusJakartaSans(fontSize: 12, color: Colors.white24),
            ),
          ],
        ),
      ),
      ),
    );
  }

  // Helper: Now Playing Widget
  Widget _buildNowPlaying() {
    if (_nowPlaying == null) return const SizedBox.shrink();

    final isAd = _nowPlaying!.isAd;
    final track = _nowPlaying!.track;

    String formatDuration(int ms) {
      final minutes = (ms / 1000) ~/ 60;
      final seconds = ((ms / 1000) % 60).toInt();
      return "$minutes:${seconds.toString().padLeft(2, '0')}";
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: kSurfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderColor),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // 1. Artwork - 60x60 to match web
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: Colors.grey[800],
              image: (track?.image != null)
                  ? DecorationImage(
                      image: CachedNetworkImageProvider(track!.image!),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: (track?.image == null)
                ? const Icon(Icons.music_note_rounded, color: kAccentColor)
                : null,
          ),
          const SizedBox(width: 12),
          
          // 2. Metadata Column - 60px height for perfect symmetry
          Expanded(
            child: SizedBox(
              height: 60,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  return Column(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Row 1: Title
                      isAd 
                        ? Text(
                            "Advertisement",
                            style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: kTextPrimary,
                            ),
                          )
                        : PingPongScrollingText(
                            text: track?.name ?? "Unknown Track",
                            width: constraints.maxWidth,
                            style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: kTextPrimary,
                            ),
                          ),
                      
                      // Row 2: Artist
                      Text(
                        isAd ? "Spotify keeps things free" : (track?.artistsString ?? "Unknown Artist"),
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          color: kTextSecondary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),

                      // Row 3: Progress Section (Web-style: Compact)
                      if (!isAd && track != null)
                        Row(
                          children: [
                            Text(
                              formatDuration(_currentProgressMs),
                              style: GoogleFonts.plusJakartaSans(fontSize: 10, color: kTextSecondary, fontWeight: FontWeight.w500),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(2),
                                child: LinearProgressIndicator(
                                  value: track.durationMs > 0 ? _currentProgressMs / track.durationMs : 0,
                                  backgroundColor: Colors.white10,
                                  color: kAccentColor,
                                  minHeight: 4,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              formatDuration(track.durationMs),
                              style: GoogleFonts.plusJakartaSans(fontSize: 10, color: kTextSecondary, fontWeight: FontWeight.w500),
                            ),
                          ],
                        )
                      else if (isAd)
                        Row(
                          children: [
                            Text("0:00", style: GoogleFonts.plusJakartaSans(fontSize: 10, color: kTextSecondary, fontWeight: FontWeight.w500)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(2),
                                child: const LinearProgressIndicator(
                                  value: 0.4,
                                  backgroundColor: Colors.white10,
                                  color: Color(0xFF1DB954),
                                  minHeight: 4,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text("0:30", style: GoogleFonts.plusJakartaSans(fontSize: 10, color: kTextSecondary, fontWeight: FontWeight.w500)),
                          ],
                        ),
                    ],
                  );
                }
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Helper: Group Container (Rounded Card like WA/Settings iOS)
  Widget _buildInfoGroup(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: kSurfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderColor), // Added Border
      ),
      child: Column(
        children: children,
      ),
    );
  }

  Widget _buildDivider() {
    return Container(
      height: 1,
      color: kBorderColor,
      // Margin removed to make it full width (to the border)
    );
  }


    // Helper: Info Row
  Widget _buildInfoRow(IconData icon, String title, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12), // Reduced from 16
      child: Row(
        children: [
          Icon(icon, color: kTextSecondary, size: 22),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              title,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 16,
                color: kTextPrimary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Text(
            value,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 16,
              color: kTextSecondary, 
            ),
          ),
        ],
      ),
    );
  }

  // Helper: Action Row (Clickable)
  Widget _buildActionRow(IconData icon, String title, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12), // Reduced from 16
        child: Row(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(width: 16),
            Text(
              title,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 16,
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
