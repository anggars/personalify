import 'package:personalify/models/artist.dart';
import 'package:personalify/models/track.dart';

/// Model matching backend Dashboard API response
class UserProfile {
  final String userName;
  final String timeRange;
  final String sentimentReport;
  final List<Artist> artists;
  final List<Track> tracks;
  final List<Genre> genres;
  final Map<String, List<String>> genreArtistsMap;
  
  // NEW FIELDS for Account Screen
  final String? displayName;
  final String? image; 
  final String? userId;
  final int? followers; // Added followers
  final List<Emotion> sentimentScores;

  UserProfile({
    required this.userName,
    required this.timeRange,
    required this.sentimentReport,
    required this.artists,
    required this.tracks,
    required this.genres,
    required this.genreArtistsMap,
    this.displayName,
    this.image,
    this.userId,
    this.followers,
    this.sentimentScores = const [],
  });
  
  // Getter alias consistent with ProfileScreen usage
  String get id => userId ?? userName;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      userName: json['user'] as String,
      timeRange: json['time_range'] as String? ?? 'short_term',
      sentimentReport: json['sentiment_report'] as String? ?? '',
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
      // Parse new fields if available, otherwise default to userName
      displayName: json['display_name'] as String? ?? json['user'] as String,
      image: json['image'] as String?,
      userId: json['user_id'] as String? ?? json['user'] as String,
      followers: json['followers'] as int?,
      sentimentScores: (json['sentiment_scores'] as List<dynamic>?)
              ?.map((e) => Emotion.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class Emotion {
  final String label;
  final double score;

  Emotion({required this.label, required this.score});

  factory Emotion.fromJson(Map<String, dynamic> json) {
    return Emotion(
      label: json['label'] as String,
      score: (json['score'] as num).toDouble(),
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
