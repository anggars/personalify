"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { GenreChart } from "@/components/genre-chart";
import MarqueeText from "@/components/marquee-text";

interface Artist {
  id: string;
  name: string;
  image: string;
  genres: string[];
  popularity: number;
}

interface Track {
  id: string;
  name: string;
  image: string;
  artists: string[];
  album: { name: string; total_tracks: number };
  popularity: number;
  duration_ms: number;
}

interface Genre {
  name: string;
  count: number;
}

interface DashboardData {
  user: string;
  time_range: string;
  emotion_paragraph: string;
  artists: Artist[];
  tracks: Track[];
  genres: Genre[];
}

const GENRE_COLORS = [
  "#1DB954",
  "#00C7B7",
  "#2496ED",
  "#9333EA",
  "#E91E63",
  "#FFD21E",
  "#FF5722",
  "#88B04B",
  "#F7CAC9",
  "#92A8D1",
];

export default function EmbeddedDashboard() {
  const params = useParams();
  const searchParams = useSearchParams();

  const spotifyId = params.spotifyId as string;
  const timeRange = searchParams.get("time_range") || "short_term";
  const category = searchParams.get("category") || "tracks";

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(
          `/api/dashboard/${spotifyId}?time_range=${timeRange}`,
          { credentials: "include" },
        );
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to fetch:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [spotifyId, timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#121212]">
        <div className="animate-spin w-8 h-8 border-2 border-[#1DB954] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#121212] text-white">
        No data available
      </div>
    );
  }

  const getGenreColor = (genreName: string) => {
    const idx = data.genres.findIndex((g) => g.name === genreName);
    return idx >= 0 ? GENRE_COLORS[idx % GENRE_COLORS.length] : GENRE_COLORS[0];
  };

  const chartData = data.genres.slice(0, 10).map((genre, i) => ({
    name: genre.name,
    count: genre.count,
    fill: GENRE_COLORS[i % GENRE_COLORS.length],
  }));

  return (
    <div className="min-h-screen bg-[#121212] text-white p-4">
      {/* Tracks Section */}
      {category === "tracks" && (
        <section className="section-card">
          <h2>Top Tracks</h2>
          <ol className="list-none p-0 m-0">
            {data.tracks.slice(0, 10).map((track, idx) => (
              <li key={track.id} className="list-item">
                <span className="rank">{idx + 1}</span>
                <img
                  src={track.image}
                  alt={track.name}
                  className="w-14 h-14 rounded-lg object-cover"
                />
                <div className="info">
                  <MarqueeText text={track.name} className="name" />
                  <MarqueeText
                    text={track.artists.join(", ")}
                    className="meta"
                  />
                  <p className="meta">Popularity: {track.popularity}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Artists Section */}
      {category === "artists" && (
        <section className="section-card">
          <h2>Top Artists</h2>
          <ol className="list-none p-0 m-0">
            {data.artists.slice(0, 10).map((artist, idx) => (
              <li key={artist.id} className="list-item">
                <span className="rank">{idx + 1}</span>
                <img
                  src={artist.image}
                  alt={artist.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="info">
                  <p className="name">{artist.name}</p>
                  <div className="genre-pills">
                    {artist.genres.slice(0, 4).map((genre) => (
                      <span
                        key={genre}
                        className="genre-pill"
                        style={{ borderColor: getGenreColor(genre) }}
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                  <p className="meta">Popularity: {artist.popularity}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Genres Section */}
      {category === "genres" && (
        <section className="section-card">
          <h2>Top Genres</h2>
          <div className="flex justify-center my-6" id="genre-chart-container">
            <GenreChart data={chartData} />
          </div>
          <ul className="list-none p-0 m-0 space-y-3">
            {data.genres.slice(0, 10).map((genre, idx) => (
              <li key={genre.name} className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    backgroundColor: GENRE_COLORS[idx % GENRE_COLORS.length],
                  }}
                />
                <span className="text-sm text-muted-foreground font-bold w-6">
                  {idx + 1}
                </span>
                <span className="flex-1 text-sm">{genre.name}</span>
                <span
                  className="text-xs"
                  style={{ color: GENRE_COLORS[idx % GENRE_COLORS.length] }}
                >
                  {genre.count}x
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
