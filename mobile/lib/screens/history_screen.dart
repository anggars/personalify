import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:personalify/utils/constants.dart';
import 'package:personalify/services/api_service.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:personalify/screens/song_detail_screen.dart';

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

  Future<void> _fetchHistory() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

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
           // We might want to set a flag or message here
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

  String _formatTime(String timestamp) {
    if (timestamp.isEmpty) return '';
    try {
      final dt = DateTime.parse(timestamp).toLocal();
      return DateFormat('HH:mm').format(dt);
    } catch (e) {
      return '';
    }
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
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(70),
        child: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10), // Adjust for blur intensity
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    kBgColor.withOpacity(0.85),
                    kBgColor.withOpacity(0.75),
                    kBgColor.withOpacity(0.6),
                    kBgColor.withOpacity(0.0),
                  ],
                  stops: const [0.0, 0.7, 0.9, 1.0],
                ),
              ),
              child: AppBar(
                title: Text('Recently Played', style: headerStyle),
                centerTitle: true,
                backgroundColor: Colors.transparent,
                surfaceTintColor: Colors.transparent,
                elevation: 0,
                toolbarHeight: 70,
                automaticallyImplyLeading: false,
              ),
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        color: kAccentColor,
        backgroundColor: kSurfaceColor,
        onRefresh: _fetchHistory,
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
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                    child: Container(
                      decoration: BoxDecoration(
                        color: kSurfaceColor,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: Column(
                        children: _history.asMap().entries.map((entry) {
                          final index = entry.key;
                          final item = entry.value;
                          final time = _formatTime(item['played_at'] ?? '');
                          final title = item['track_name'] ?? 'Unknown';
                          final artist = item['artist_name'] ?? 'Unknown';
                          final image = item['image_url'] ?? '';

                          return Column(
                            children: [
                              GestureDetector(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) => SongDetailScreen(
                                        song: {
                                          'track_name': title,
                                          'artist_name': artist,
                                          'image_url': image,
                                        },
                                      ),
                                    ),
                                  );
                                },
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Row(
                                    children: [
                                      // Time (Left)
                                      SizedBox(
                                        width: 50,
                                        child: Text(
                                          time,
                                          style: GoogleFonts.plusJakartaSans(
                                            color: kTextSecondary,
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                          ),
                                          textAlign: TextAlign.center,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      // Image
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(8),
                                        child: CachedNetworkImage(
                                          imageUrl: image,
                                          width: 48,
                                          height: 48,
                                          fit: BoxFit.cover,
                                          placeholder: (_,__) => Container(color: kSurfaceColor),
                                          errorWidget: (_, __, ___) => Container(color: kSurfaceColor, child: const Icon(Icons.music_note, color: Colors.white24)),
                                        ),
                                      ),
                                      const SizedBox(width: 16),
                                      // Details
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              title,
                                              style: GoogleFonts.plusJakartaSans(
                                                color: kTextPrimary,
                                                fontWeight: FontWeight.w600,
                                                fontSize: 15,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            Text(
                                              artist,
                                              style: GoogleFonts.plusJakartaSans(
                                                color: kTextSecondary,
                                                fontSize: 13,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              if (index != _history.length - 1)
                                const Divider(height: 1, color: Colors.white10),
                            ],
                          );
                        }).toList(),
                      ),
                    ),
                  ),
      ),
    );
  }
}
