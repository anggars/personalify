class NowPlaying {
  final bool isPlaying;
  final bool isAd;
  final NowPlayingTrack? track;

  NowPlaying({
    required this.isPlaying,
    this.isAd = false,
    this.track,
  });

  factory NowPlaying.fromJson(Map<String, dynamic> json) {
    return NowPlaying(
      isPlaying: json['is_playing'] ?? false,
      isAd: json['is_ad'] ?? false,
      track: json['track'] != null ? NowPlayingTrack.fromJson(json['track']) : null,
    );
  }
}

class NowPlayingTrack {
  final String id;
  final String name;
  final List<String> artists;
  final String album;
  final String? image;
  final int durationMs;
  final int progressMs;
  final String externalUrl;

  NowPlayingTrack({
    required this.id,
    required this.name,
    required this.artists,
    required this.album,
    this.image,
    required this.durationMs,
    required this.progressMs,
    required this.externalUrl,
  });

  factory NowPlayingTrack.fromJson(Map<String, dynamic> json) {
    return NowPlayingTrack(
      id: json['id'] ?? '',
      name: json['name'] ?? 'Unknown Track',
      artists: List<String>.from(json['artists'] ?? []),
      album: json['album'] ?? 'Unknown Album',
      image: json['image'],
      durationMs: json['duration_ms'] ?? 0,
      progressMs: json['progress_ms'] ?? 0,
      externalUrl: json['external_url'] ?? '',
    );
  }

  String get artistsString => artists.join(', ');
}
