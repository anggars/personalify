/// Model matching backend Track JSON structure
class Track {
  final String id;
  final String name;
  final String image;
  final List<String> artists;
  final Album album;
  final int popularity;
  final String? previewUrl;
  final int durationMs;

  Track({
    required this.id,
    required this.name,
    required this.image,
    required this.artists,
    required this.album,
    required this.popularity,
    this.previewUrl,
    required this.durationMs,
  });

  factory Track.fromJson(Map<String, dynamic> json) {
    return Track(
      id: json['id'] as String,
      name: json['name'] as String,
      image: json['image'] as String? ?? '',
      artists: (json['artists'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      album: Album.fromJson(json['album'] as Map<String, dynamic>),
      popularity: json['popularity'] as int? ?? 0,
      previewUrl: json['preview_url'] as String?,
      durationMs: json['duration_ms'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'image': image,
      'artists': artists,
      'album': album.toJson(),
      'popularity': popularity,
      'preview_url': previewUrl,
      'duration_ms': durationMs,
    };
  }

  String get artistsString => artists.join(', ');
  
  String get durationFormatted {
    final minutes = durationMs ~/ 60000;
    final seconds = (durationMs % 60000) ~/ 1000;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }
}

class Album {
  final String name;
  final String type;
  final int totalTracks;

  Album({
    required this.name,
    required this.type,
    required this.totalTracks,
  });

  factory Album.fromJson(Map<String, dynamic> json) {
    return Album(
      name: json['name'] as String,
      type: json['type'] as String? ?? 'album',
      totalTracks: json['total_tracks'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'type': type,
      'total_tracks': totalTracks,
    };
  }
}
