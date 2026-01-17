import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:personalify/models/user_profile.dart';
import 'package:personalify/services/api_service.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/widgets/track_list_item.dart';
import 'package:personalify/screens/login_screen.dart';

/// Dashboard screen displaying user's Spotify data
class DashboardScreen extends StatefulWidget {
  final String spotifyId;

  const DashboardScreen({super.key, required this.spotifyId});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final AuthService _authService = AuthService();
  late final ApiService _apiService;

  UserProfile? _userProfile;
  bool _isLoading = true;
  String? _errorMessage;
  String _selectedTimeRange = 'short_term';

  final Map<String, String> _timeRangeLabels = {
    'short_term': 'Short Term',
    'medium_term': 'Mid Term',
    'long_term': 'Long Term',
  };

  final Map<String, String> _timeRangeSubtitles = {
    'short_term': "Here's your monthly recap",
    'medium_term': "A look at your last 6 months",
    'long_term': "Your listening overview for the year",
  };

  @override
  void initState() {
    super.initState();
    _apiService = ApiService(_authService);
    _loadDashboardData();
  }

  /// Load dashboard data from API
  Future<void> _loadDashboardData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final profile = await _apiService.getUserProfile(
        widget.spotifyId,
        timeRange: _selectedTimeRange,
      );

      if (profile != null) {
        setState(() {
          _userProfile = profile;
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = 'Failed to load dashboard data';
          _isLoading = false;
        });
      }
    } catch (e) {
      // Check if error is 401 - token expired
      if (e.toString().contains('401')) {
        // Redirect to login
        if (mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (context) => const LoginScreen()),
          );
        }
      } else {
        setState(() {
          _errorMessage = 'Error loading data: ${e.toString()}';
          _isLoading = false;
        });
      }
    }
  }

  /// Change time range and reload data
  void _changeTimeRange(String timeRange) {
    setState(() {
      _selectedTimeRange = timeRange;
    });
    _loadDashboardData();
  }

  /// Handle logout
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
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E1E1E),
        elevation: 0,
        title: const Text(
          'Personalify',
          style: TextStyle(
            color: Color(0xFF1DB954),
            fontWeight: FontWeight.bold,
          ),
        ),
        actions: [
          // Time Range Selector
          PopupMenuButton<String>(
            icon: const Icon(Icons.access_time, color: Colors.white),
            onSelected: _changeTimeRange,
            itemBuilder: (context) => _timeRangeLabels.entries
                .map((entry) => PopupMenuItem(
                      value: entry.key,
                      child: Text(entry.value),
                    ))
                .toList(),
          ),

          // Logout
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white),
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                color: Color(0xFF1DB954),
              ),
            )
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.error_outline,
                          size: 64,
                          color: Colors.red,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          _errorMessage!,
                          style: const TextStyle(
                            color: Colors.red,
                            fontSize: 16,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton(
                          onPressed: _loadDashboardData,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF1DB954),
                          ),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadDashboardData,
                  color: const Color(0xFF1DB954),
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // User Header
                        _buildUserHeader(),
                        const SizedBox(height: 24),

                        // Emotion Paragraph
                        if (_userProfile?.emotionParagraph.isNotEmpty ?? false)
                          _buildEmotionCard(),

                        const SizedBox(height: 24),

                        // Top Tracks Section
                        _buildTopTracksSection(),
                      ],
                    ),
                  ),
                ),
    );
  }

  /// Build user header with photo and name
  Widget _buildUserHeader() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF282828)),
      ),
      child: Column(
        children: [
          // User avatar placeholder (using icon since we don't have image in response)
          const CircleAvatar(
            radius: 40,
            backgroundColor: Color(0xFF1DB954),
            child: Icon(
              Icons.person,
              size: 40,
              color: Colors.black,
            ),
          ),
          const SizedBox(height: 16),

          // User name
          Text(
            _userProfile?.userName ?? 'User',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),

          // Time range subtitle
          Text(
            _timeRangeSubtitles[_selectedTimeRange] ?? '',
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFFB3B3B3),
            ),
          ),
        ],
      ),
    );
  }

  /// Build emotion analysis card
  Widget _buildEmotionCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF282828)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Your Vibe',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1DB954),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            _userProfile?.emotionParagraph ?? '',
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFFB3B3B3),
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  /// Build top tracks section
  Widget _buildTopTracksSection() {
    final tracks = _userProfile?.tracks.take(10).toList() ?? [];

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF282828)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section Header
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Top Tracks',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1DB954),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${tracks.length} songs',
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF908F8F),
                  ),
                ),
              ],
            ),
          ),

          // Divider
          const Divider(
            color: Color(0xFF282828),
            height: 1,
            thickness: 1,
          ),

          // Track List
          if (tracks.isEmpty)
            const Padding(
              padding: EdgeInsets.all(40),
              child: Center(
                child: Text(
                  'No tracks found',
                  style: TextStyle(
                    color: Color(0xFF908F8F),
                    fontSize: 14,
                  ),
                ),
              ),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: tracks.length,
              itemBuilder: (context, index) {
                return TrackListItem(
                  track: tracks[index],
                  rank: index + 1,
                );
              },
            ),
        ],
      ),
    );
  }
}
