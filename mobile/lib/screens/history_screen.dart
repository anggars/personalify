import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:personalify/utils/constants.dart';
import 'package:personalify/services/api_service.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:personalify/screens/song_detail_screen.dart';
import 'package:personalify/widgets/ping_pong_text.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  bool _isLoading = true;
  List<dynamic> _history = [];
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  Future<void> _fetchHistory({bool isRefresh = false}) async {
    if (!isRefresh) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    }

    try {
      final apiService = Provider.of<ApiService>(context, listen: false);
      final history = await apiService.getRecentlyPlayed();
      if (mounted) {
        setState(() {
          _history = history;
          _isLoading = false;
        });
        
        if (history.isEmpty) {
           // Debug: check if it's empty because of error or actual no data
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
  }

  String _getMetadata(Map<String, dynamic> item) {
    if (!item.containsKey('album_type') && !item.containsKey('total_tracks')) return '';
    
    final type = item['album_type'] as String? ?? 'album';
    final total = item['total_tracks'] as int? ?? 0;
    final name = item['album_name'] as String? ?? '';

    if (total == 1 || type == 'single') return 'Single';
    if (total >= 2 && total <= 3) return 'Maxi-Single: $name';
    if (total >= 4 && total <= 6) return 'EP: $name';
    return 'Album: $name';
  }

  @override
  Widget build(BuildContext context) {
    // Header Style (Standardized from Dashboard)
    final headerStyle = GoogleFonts.plusJakartaSans(
      fontSize: 24, 
      fontWeight: FontWeight.w800,
      color: kAccentColor,
      letterSpacing: -0.5,
    );

    return Scaffold(
      backgroundColor: kBgColor,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text('Recently Played', style: headerStyle),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        toolbarHeight: 70,
        automaticallyImplyLeading: false,
        flexibleSpace: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Container(
              color: kBgColor.withOpacity(0.9),
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        color: kAccentColor,
        backgroundColor: kSurfaceColor,
        edgeOffset: 120, // Push spinner below Glass Header
        onRefresh: () async => await _fetchHistory(isRefresh: true),
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: kAccentColor))
            : _errorMessage != null
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 200),
                        child: Center(child: Text('Failed to load: $_errorMessage', style: const TextStyle(color: Colors.red))),
                      )
                    ],
                  )
                : SingleChildScrollView(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 115, 16, 120),
                    child: Container(
                      decoration: BoxDecoration(
                        color: kSurfaceColor,
                        borderRadius: BorderRadius.circular(16), 
                        border: Border.all(color: Colors.white10),
                      ),
                       clipBehavior: Clip.hardEdge,
                       child: Column(
                         children: _history.asMap().entries.map((entry) {
                            return _buildHistoryItem(entry.value, entry.key); 
                         }).toList(),
                       ),
                    ),
                  ),

      ),
    );
  }

  Widget _buildHistoryItem(Map<String, dynamic> item, int index) {
      final title = item['track_name'] ?? 'Unknown';
      final artist = item['artist_name'] ?? 'Unknown';
      final image = item['image_url'] ?? '';
      // Parse Time
      DateTime? dt;
      try { dt = DateTime.parse(item['played_at'] ?? '').toLocal(); } catch (_) {}
      final hour = dt != null ? DateFormat('HH').format(dt) : '--';
      final min = dt != null ? DateFormat('mm').format(dt) : '--';

      return Column(
        children: [
          GestureDetector(
            onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (context) => SongDetailScreen(song: item)));
            },
            child: Container( 
              height: 80, 
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: Colors.transparent,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  SizedBox(width: 24, child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(hour, style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.bold, color: kTextSecondary.withOpacity(0.7), height: 1.0)),
                    Text(min, style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.bold, color: kTextSecondary.withOpacity(0.7), height: 1.0)),
                  ])),
                  const SizedBox(width: 16),
                  ClipRRect(borderRadius: BorderRadius.circular(8), child: CachedNetworkImage(imageUrl: image, width: 56, height: 56, fit: BoxFit.cover, errorWidget: (_,__,___)=>Container(color:Colors.grey[900], child:const Icon(Icons.music_note, color:Colors.white54)))),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                    LayoutBuilder(
                      builder: (context, constraints) {
                        return PingPongScrollingText(
                          text: title,
                          width: constraints.maxWidth,
                          style: GoogleFonts.plusJakartaSans(color: kTextPrimary, fontWeight: FontWeight.w600, fontSize: 14),
                        );
                      }
                    ),
                    const SizedBox(height: 2),
                    Text(artist, style: GoogleFonts.plusJakartaSans(color: kTextPrimary.withOpacity(0.9), fontSize: 13, fontWeight: FontWeight.w500), maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(_getMetadata(item), style: GoogleFonts.plusJakartaSans(fontSize: 11, color: const Color(0xFF888888)), maxLines: 1, overflow: TextOverflow.ellipsis)
                  ])),
                ],
              ),
            ),
          ),
          if (index != _history.length - 1) const Divider(height: 1, color: Colors.white10),
        ],
      );
  }
}
