import 'package:personalify/models/artist.dart';
import 'package:personalify/models/track.dart';

/// Model matching backend Dashboard API response
class UserProfile {
  final String userName;
  final String timeRange;
  final String emotionParagraph;
  final List<Artist> artists;
  final List<Track> tracks;
  final List<Genre> genres;
  final Map<String, List<String>> genreArtistsMap;

  UserProfile({
    required this.userName,
    required this.timeRange,
    required this.emotionParagraph,
    required this.artists,
    required this.tracks,
    required this.genres,
    required this.genreArtistsMap,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      userName: json['user'] as String,
      timeRange: json['time_range'] as String? ?? 'short_term',
      emotionParagraph: json['emotion_paragraph'] as String? ?? '',
      artists: (json['artists'] as List<dynamic>?)
              ?.map((e) => Artist.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      tracks: (json['tracks'] as List<dynamic>?)
              ?.map((e) => Track.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      genres: (json['genres'] as List<dynamic>?)
              ?.map((e) => Genre.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      genreArtistsMap: (json['genre_artists_map'] as Map<String, dynamic>?)
              ?.map((key, value) => MapEntry(
                  key, (value as List<dynamic>).map((e) => e as String).toList())) ??
          {},
    );
  }
}

class Genre {
  final String name;
  final int count;

  Genre({
    required this.name,
    required this.count,
  });

  factory Genre.fromJson(Map<String, dynamic> json) {
    return Genre(
      name: json['name'] as String,
      count: json['count'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'count': count,
    };
  }
}
