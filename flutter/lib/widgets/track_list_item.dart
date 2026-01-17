import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:personalify/models/track.dart';

/// Reusable widget for displaying track in a list
class TrackListItem extends StatelessWidget {
  final Track track;
  final int rank;
  final VoidCallback? onTap;

  const TrackListItem({
    super.key,
    required this.track,
    required this.rank,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        decoration: const BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: Color(0xFF333333),
              width: 1,
            ),
          ),
        ),
        child: Row(
          children: [
            // Rank
            SizedBox(
              width: 30,
              child: Text(
                '$rank',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF908F8F),
                ),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(width: 12),

            // Album Cover
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: CachedNetworkImage(
                imageUrl: track.image,
                width: 56,
                height: 56,
                fit: BoxFit.cover,
                placeholder: (context, url) => Container(
                  width: 56,
                  height: 56,
                  color: const Color(0xFF1E1E1E),
                  child: const Center(
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Color(0xFF1DB954),
                    ),
                  ),
                ),
                errorWidget: (context, url, error) => Container(
                  width: 56,
                  height: 56,
                  color: const Color(0xFF1E1E1E),
                  child: const Icon(
                    Icons.music_note,
                    color: Color(0xFF908F8F),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),

            // Track Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Track Name
                  Text(
                    track.name,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),

                  // Artists
                  Text(
                    track.artistsString,
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFFB3B3B3),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),

                  // Album / Duration
                  Text(
                    '${track.album.name} • ${track.durationFormatted}',
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF908F8F),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),

            // Popularity indicator (optional)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF1DB954).withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.trending_up,
                    size: 12,
                    color: Color(0xFF1DB954),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${track.popularity}',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1DB954),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
