"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import MarqueeText from "@/components/marquee-text";

interface Artist {
    id: string;
    name: string;
    image_url?: string;
    image?: string;
}

interface Song {
    id: string;
    title: string;
    image?: string;
    album?: string;
    date?: string;
}

interface AnalysisResult {
    lyrics: string;
    track_info: {
        title: string;
        artist: string;
    };
    emotion_analysis?: {
        emotions: { label: string; score: number }[];
    };
}

export default function GeniusPage() {
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<Artist[]>([]);
    const [artists, setArtists] = useState<Artist[]>([]);
    const [songs, setSongs] = useState<Song[]>([]);
    const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
    const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [loadingState, setLoadingState] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const subtitleRef = useRef<HTMLParagraphElement>(null);
    const hasTyped = useRef(false);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (hasTyped.current || !subtitleRef.current) return;
        hasTyped.current = true;

        const text = 'Pick a song or go back to <a href="/lyrics" class="text-[#888] hover:text-[#1DB954] transition-colors">manual input the lyrics</a>';
        let index = 0;
        let currentHtml = "";

        function typeWriter() {
            if (index < text.length) {
                const char = text.charAt(index);
                if (char === "<") {
                    const tagEnd = text.indexOf(">", index);
                    if (tagEnd !== -1) {
                        currentHtml += text.substring(index, tagEnd + 1);
                        index = tagEnd + 1;
                    } else {
                        currentHtml += char;
                        index++;
                    }
                } else {
                    currentHtml += char;
                    index++;
                }
                if (subtitleRef.current) {
                    subtitleRef.current.innerHTML = currentHtml + '<span class="typing-cursor"></span>';
                }
                setTimeout(typeWriter, 30);
            } else {
                if (subtitleRef.current) {
                    subtitleRef.current.innerHTML = currentHtml;
                }
            }
        }
        typeWriter();
    }, []);

    const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty("--mouse-x", `${x}%`);
        el.style.setProperty("--mouse-y", `${y}%`);
    };

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoadingState("search");
        setArtists([]);
        setSongs([]);
        setAnalysis(null);
        setError(null);
        setSuggestions([]);

        try {
            const res = await fetch(`/api/genius/search-artist?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.artists && data.artists.length > 0) {
                setArtists(data.artists);
            } else {
                setError("No artist found.");
            }
        } catch (e) {
            setError("Error searching artist.");
        } finally {
            setLoadingState(null);
        }
    };

    const handleAutocomplete = (val: string) => {
        setQuery(val);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        if (!val.trim()) {
            setSuggestions([]);
            return;
        }

        debounceTimer.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/genius/autocomplete?q=${encodeURIComponent(val)}`);
                const data = await res.json();
                setSuggestions(data.results || []);
            } catch (e) {
                console.error(e);
            }
        }, 300);
    };

    const handleLoadSongs = async (artist: Artist) => {
        setQuery("");
        setSuggestions([]);
        setArtists([]);
        setSelectedArtist(artist);
        setLoadingState("songs");
        setError(null);

        try {
            const res = await fetch(`/api/genius/artist-songs/${artist.id}`);
            const data = await res.json();
            if (data.songs) {
                setSongs(data.songs);
            } else {
                setError("No songs found.");
            }
        } catch (e) {
            setError("Error loading songs.");
        } finally {
            setLoadingState(null);
        }
    };

    const handleAnalyzeSong = async (songId: string) => {
        setSelectedSongId(songId);
        setLoadingState("analyze");
        setAnalysis(null);

        try {
            const res = await fetch(`/api/genius/lyrics/${songId}`);
            if (!res.ok) throw new Error("Server Error");
            setAnalysis(await res.json());
        } catch (e) {
            setError("Failed to fetch lyrics or analyze.");
        } finally {
            setLoadingState(null);
        }
    };

    const isEmpty = !selectedArtist && artists.length === 0 && !loadingState && !error;

    return (
        <div className="page-container flex flex-col w-full max-w-3xl mx-auto min-h-[calc(100vh-8rem)] md:min-h-[calc(100vh-10rem)] grow">
            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mt-4 max-md:mt-2 mb-6 max-md:mb-3 flex-none px-4"
            >
                <h1 className="text-[2.5rem] font-extrabold text-[#1DB954] mb-2">
                    Genius Analyzer
                </h1>
                <p
                    ref={subtitleRef}
                    className="text-lg mb-1 text-[#B3B3B3] font-medium min-h-[1.5em]"
                />
            </motion.header>

            {/* Content */}
            <div className={`flex flex-col w-full flex-1 transition-all duration-300 ${isEmpty ? "justify-center" : "justify-start"}`}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="w-full glass-card rounded-2xl p-5 md:p-6 hover:-translate-y-1 transition-transform duration-300"
                >
                    <div className="relative mb-6">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => handleAutocomplete(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            placeholder="Type artist name (e.g. The Beatles)..."
                            className="w-full p-4 rounded-xl border border-neutral-200 dark:border-[#282828] bg-white dark:bg-[#181818] text-neutral-900 dark:text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/20 transition-all text-base"
                        />
                    </div>

                    {/* Search Button */}
                    <button
                        onClick={handleSearch}
                        onMouseMove={handleMouseMove}
                        className="btn-glass w-full group mb-0 min-h-[46px]"
                    >
                        <span className={`relative -top-px transition-opacity duration-200 ${loadingState === "search" ? "opacity-0" : "opacity-100"}`}>
                            Search Artist
                        </span>
                        {loadingState === "search" && (
                            <svg className="absolute top-1/2 left-1/2 -ml-3 -mt-3 w-6 h-6 spinner-svg" viewBox="0 0 50 50">
                                <circle className="spinner-path stroke-[#1DB954]!" cx="25" cy="25" r="20" fill="none" />
                            </svg>
                        )}
                    </button>

                    {error && <p className="text-[#ff6b6b] text-center font-medium mb-4">{error}</p>}

                    {/* Unified Results Grid (Suggestions or Search Results) */}
                    {(suggestions.length > 0 || artists.length > 0) && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 border-t border-neutral-200 dark:border-white/10 pt-6">
                            {(artists.length > 0 ? artists : suggestions).map((artist) => (
                                <div
                                    key={artist.id}
                                    onClick={() => handleLoadSongs(artist)}
                                    onMouseMove={handleMouseMove}
                                    className="glass-card flex flex-col items-center p-4 rounded-xl cursor-pointer bg-white/5 hover:bg-white/10 border-white/10 transition-colors"
                                >
                                    <img
                                        src={artist.image_url || artist.image || "https://via.placeholder.com/150"}
                                        className="w-[90px] h-[90px] rounded-full object-cover shadow-lg mb-3"
                                        alt={artist.name}
                                    />
                                    <div className="w-full overflow-hidden text-center">
                                        <MarqueeText
                                            text={artist.name}
                                            className="font-bold text-sm text-neutral-900 dark:text-white"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {loadingState === "songs" && (
                        <div className="flex flex-col items-center justify-center text-[#1DB954] py-4 gap-3">
                            <svg className="spinner-svg w-8 h-8" viewBox="0 0 50 50">
                                <circle className="spinner-path stroke-[#1DB954]!" cx="25" cy="25" r="20" fill="none" />
                            </svg>
                            <span>Loading Songs...</span>
                        </div>
                    )}

                    {/* Songs List */}
                    {selectedArtist && songs.length > 0 && loadingState !== "songs" && (
                        <div className="mt-6">
                            <div className="border-t border-neutral-300 dark:border-[#333] pt-4 mb-4 text-center">
                                <h3 className="text-[#1DB954] text-lg font-bold">{selectedArtist.name}</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[412px] overflow-y-auto custom-scrollbar pr-2 pb-1 snap-y snap-mandatory scroll-p-2">
                                {songs.map((song) => (
                                    <div
                                        key={song.id}
                                        onClick={() => handleAnalyzeSong(song.id)}
                                        onMouseMove={handleMouseMove}
                                        className={`glass-card flex items-center gap-3 p-3 rounded-xl cursor-pointer text-left h-[71px] bg-white/5 dark:bg-white/5 border-neutral-200 dark:border-white/10 snap-start ${selectedSongId === song.id ? "ring-2 ring-[#1DB954]" : ""
                                            }`}
                                    >
                                        <img
                                            src={song.image || "https://via.placeholder.com/50"}
                                            className="w-[45px] h-[45px] rounded-md object-cover shrink-0"
                                            alt={song.title}
                                        />
                                        <div className="overflow-hidden flex-1 min-w-0">
                                            <MarqueeText
                                                text={song.title}
                                                className="text-sm font-bold text-neutral-900 dark:text-white"
                                            />
                                            <MarqueeText
                                                text={song.album || song.date || "Single"}
                                                className="text-xs text-neutral-500 dark:text-[#aaa]"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Loading Analysis */}
                    {loadingState === "analyze" && (
                        <div className="flex flex-col items-center justify-center text-[#1DB954] py-6 gap-3 mt-8 border-t border-dashed border-neutral-300 dark:border-[#333]">
                            <svg className="spinner-svg w-8 h-8" viewBox="0 0 50 50">
                                <circle className="spinner-path stroke-[#1DB954]!" cx="25" cy="25" r="20" fill="none" />
                            </svg>
                            <span>Analyzing...</span>
                        </div>
                    )}

                    {/* Analysis Results */}
                    {analysis && !loadingState && (
                        <div className="mt-8 border-t border-dashed border-neutral-300 dark:border-[#333] pt-6">
                            <div className="text-center mb-6 overflow-hidden">
                                <div className="w-full max-w-md mx-auto">
                                    <MarqueeText
                                        text={analysis.track_info.title}
                                        className="text-2xl font-bold text-[#1DB954] mb-1"
                                    />
                                    <MarqueeText
                                        text={analysis.track_info.artist}
                                        className="text-neutral-500 dark:text-[#aaa] font-medium"
                                    />
                                </div>
                            </div>
                            <div className="bg-white dark:bg-[#181818] p-5 rounded-xl border border-neutral-200 dark:border-[#282828] text-neutral-700 dark:text-[#cccccc] leading-loose whitespace-pre-wrap max-h-[300px] overflow-y-auto custom-scrollbar mb-6 text-[0.95rem] font-light tracking-wide">
                                {analysis.lyrics}
                            </div>
                            {analysis.emotion_analysis?.emotions && (
                                <div>
                                    <h3 className="text-center text-[#1DB954] font-bold text-lg mb-4 border-t border-neutral-300 dark:border-[#333] pt-4">
                                        Emotion Results:
                                    </h3>
                                    <div className="flex flex-col gap-4">
                                        {analysis.emotion_analysis.emotions.slice(0, 5).map((e, idx) => {
                                            const maxScore = Math.max(...analysis.emotion_analysis!.emotions.map((em) => em.score));
                                            const percent = (e.score * 100).toFixed(1);
                                            const widthPercent = ((e.score / maxScore) * 100).toFixed(1);
                                            return (
                                                <div key={idx} className="flex items-center gap-2 w-full">
                                                    <span className="font-bold text-neutral-800 dark:text-white capitalize text-sm whitespace-nowrap min-w-fit">
                                                        {e.label}
                                                    </span>
                                                    <div className="emotion-bar-bg flex-1">
                                                        <div className="emotion-bar" style={{ width: `${widthPercent}%` }} />
                                                    </div>
                                                    <span className="w-10 text-right text-neutral-500 dark:text-[#b3b3b3] text-sm font-medium">
                                                        {percent}%
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
