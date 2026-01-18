  /// Build top artists section - add this after _buildTopTracksSection
  Widget _buildTopArtistsSection() {
    final artists = _userProfile?.artists ?? [];

    if (artists.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(40),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF282828)),
        ),
        child: const Center(
          child: Text(
            'No artists found',
            style: TextStyle(
              color: Color(0xFF908F8F),
              fontSize: 14,
            ),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF282828)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Text(
            'Top Artists',
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1DB954),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${artists.length} artists',
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF908F8F),
            ),
          ),
          const SizedBox(height: 20),

          // Artists Grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 0.75,
            ),
            itemCount: artists.length,
            itemBuilder: (context, index) {
              final artist = artists[index];
              return Column(
                children: [
                  // Artist Image
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFF282828),
                      image: artist.image.isNotEmpty
                          ? DecorationImage(
                              image: CachedNetworkImageProvider(artist.image),
                              fit: BoxFit.cover,
                            )
                          : null,
                    ),
                    child: artist.image.isEmpty
                        ? const Icon(
                            Icons.person,
                            color: Color(0xFF908F8F),
                            size: 40,
                          )
                        : null,
                  ),
                  const SizedBox(height: 8),
                  // Artist Name
                  Text(
                    artist.name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  /// Build genres section
  Widget _buildGenresSection() {
    final genres = _userProfile?.genres ?? [];

    if (genres.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(40),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF282828)),
        ),
        child: const Center(
          child: Text(
            'No genres found',
            style: TextStyle(
              color: Color(0xFF908F8F),
              fontSize: 14,
            ),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF282828)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          const Text(
            'Top Genres',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1DB954),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${genres.length} genres',
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF908F8F),
            ),
          ),
          const SizedBox(height: 20),

          // Genres List
          ...genres.asMap().entries.map((entry) {
            final index = entry.key;
            final genre = entry.value;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  // Rank
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFF1DB954).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        '${index + 1}',
                        style: const TextStyle(
                          color: Color(0xFF1DB954),
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Genre Name
                  Expanded(
                    child: Text(
                      genre,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ],
      ),
    );
  }
