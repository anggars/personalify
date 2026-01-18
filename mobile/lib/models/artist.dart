/// Model matching backend Artist JSON structure
class Artist {
  final String id;
  final String name;
  final String image;
  final List<String> genres;
  final int popularity;

  Artist({
    required this.id,
    required this.name,
    required this.image,
    required this.genres,
    required this.popularity,
  });

  factory Artist.fromJson(Map<String, dynamic> json) {
    return Artist(
      id: json['id'] as String,
      name: json['name'] as String,
      image: json['image'] as String? ?? '',
      genres: (json['genres'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      popularity: json['popularity'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'image': image,
      'genres': genres,
      'popularity': popularity,
    };
  }
}
