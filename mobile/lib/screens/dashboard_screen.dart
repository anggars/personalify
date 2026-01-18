import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/screens/login_screen.dart';

/// Dashboard screen with hybrid WebView section cards
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with SingleTickerProviderStateMixin {
  final AuthService _authService = AuthService();
  late TabController _tabController;
  
  String? _spotifyId;
  String _selectedTimeRange = 'short_term';
  bool _isLoading = true;
  
  // WebView controllers for each tab
  late WebViewController _tracksController;
  late WebViewController _artistsController;
  late WebViewController _genresController;

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
    _tabController = TabController(length: 3, vsync: this);
    _initializeData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _initializeData() async {
    final spotifyId = await _authService.getSpotifyId();
    if (spotifyId == null && mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (context) => const LoginScreen()),
      );
      return;
    }
    
    setState(() {
      _spotifyId = spotifyId;
      _isLoading = false;
    });
    
    _initWebViews();
  }

  void _initWebViews() {
    if (_spotifyId == null) return;
    
    _tracksController = _createWebViewController('tracks');
    _artistsController = _createWebViewController('artists');
    _genresController = _createWebViewController('genres');
  }

  WebViewController _createWebViewController(String category) {
    final url = 'https://personalify.vercel.app/embedded/$_spotifyId?time_range=$_selectedTimeRange&category=$category';
    
    return WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF121212))
      ..loadRequest(Uri.parse(url));
  }

  void _changeTimeRange(String timeRange) {
    setState(() => _selectedTimeRange = timeRange);
    _initWebViews(); // Reload WebViews with new time range
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFF121212),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF1DB954))),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      body: Column(
        children: [
          // Native Header - CENTERED
          _buildCenteredHeader(),
          
          // TabBar
          Container(
            color: const Color(0xFF121212),
            child: TabBar(
              controller: _tabController,
              indicatorColor: const Color(0xFF1DB954),
              indicatorWeight: 3,
              labelColor: const Color(0xFF1DB954),
              unselectedLabelColor: const Color(0xFF908F8F),
              tabs: const [
                Tab(text: 'Tracks'),
                Tab(text: 'Artists'),
                Tab(text: 'Genres'),
              ],
            ),
          ),
          
          // WebView Content
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildWebViewTab(_tracksController),
                _buildWebViewTab(_artistsController),
                _buildWebViewTab(_genresController),
              ],
            ),
          ),
          
          // Bottom padding for navbar
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  Widget _buildCenteredHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 56, 24, 16),
      child: Column(
        children: [
          // Centered title
          const Text(
            'Personalify',
            style: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1DB954),
              letterSpacing: -0.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          
          // Subtitle with user info
          Text(
            _timeRangeSubtitles[_selectedTimeRange] ?? '',
            style: const TextStyle(fontSize: 14, color: Color(0xFFB3B3B3)),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          
          // Time range selector - centered
          PopupMenuButton<String>(
            onSelected: _changeTimeRange,
            color: const Color(0xFF1E1E1E),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF1E1E1E),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFF282828)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _timeRangeLabels[_selectedTimeRange]!,
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                  ),
                  const SizedBox(width: 8),
                  const Icon(Icons.expand_more, color: Colors.white, size: 18),
                ],
              ),
            ),
            itemBuilder: (context) => _timeRangeLabels.entries.map((e) => 
              PopupMenuItem(value: e.key, child: Text(e.value, style: const TextStyle(color: Colors.white)))
            ).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildWebViewTab(WebViewController controller) {
    return WebViewWidget(controller: controller);
  }
}
