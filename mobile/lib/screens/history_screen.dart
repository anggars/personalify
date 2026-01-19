import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:personalify/utils/constants.dart';
import 'package:personalify/services/api_service.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  bool _isLoading = true;
  List<dynamic> _history = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  Future<void> _fetchHistory() async {
    try {
      final apiService = Provider.of<ApiService>(context, listen: false);
      final history = await apiService.getRecentlyPlayed();
      if (mounted) {
        setState(() {
          _history = history;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
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
    return Scaffold(
      backgroundColor: kBgColor,
      body: SafeArea(
        bottom: false, // For floating navbar overlap
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: Row(
                children: [
                  const Icon(Icons.history_rounded, color: kAccentColor, size: 28),
                  const SizedBox(width: 12),
                  Text(
                    'Recently Played',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: kTextPrimary,
                    ),
                  ),
                ],
              ),
            ),
            
            // Content
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: kAccentColor))
                  : _error != null
                      ? Center(child: Text('Error: $_error', style: const TextStyle(color: Colors.red)))
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(24, 0, 24, 120), // Bottom padding for navbar
                          itemCount: _history.length,
                          itemBuilder: (context, index) {
                            final item = _history[index];
                            final time = _formatTime(item['played_at']);
                            final title = item['track_name'] ?? 'Unknown';
                            final artist = item['artist_name'] ?? 'Unknown';
                            final image = item['image_url'] ?? '';

                            return Padding(
                              padding: const EdgeInsets.only(bottom: 16),
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
                                    ),
                                  ),
                                  
                                  const SizedBox(width: 12),
                                  
                                  // Info (Center)
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          title,
                                          style: GoogleFonts.plusJakartaSans(
                                            color: kTextPrimary,
                                            fontSize: 15,
                                            fontWeight: FontWeight.w600,
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
                                  
                                  const SizedBox(width: 12),
                                  
                                  // Cover (Right)
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: image.isNotEmpty
                                        ? CachedNetworkImage(
                                            imageUrl: image,
                                            width: 48,
                                            height: 48,
                                            fit: BoxFit.cover,
                                            placeholder: (context, url) => Container(color: kSurfaceColor),
                                            errorWidget: (context, url, error) => Container(color: kSurfaceColor),
                                          )
                                        : Container(width: 48, height: 48, color: kSurfaceColor),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
