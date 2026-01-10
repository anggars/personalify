"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import MarqueeText from "@/components/marquee-text";
import { useRouter } from "next/navigation";

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
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<Artist[]>([]);
    const [artists, setArtists] = useState<Artist[]>([]);
    const [songs, setSongs] = useState<Song[]>([]);
    const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
    const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [loadingState, setLoadingState] = useState<string | null>(null);

    const dispatchError = (message: string) => {
        window.dispatchEvent(new CustomEvent("personalify-notification", {
            detail: { type: "error", message }
        }));
        setTimeout(() => window.dispatchEvent(new CustomEvent("personalify-notification", { detail: null })), 4000);
    };

    const subtitleRef = useRef<HTMLParagraphElement>(null);
    const hasTyped = useRef(false);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Handle SPA navigation for typewriter links
    useEffect(() => {
        const handleLinkClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'A' && target.getAttribute('href')?.startsWith('/')) {
                e.preventDefault();
                router.push(target.getAttribute('href')!);
            }
        };

        const el = subtitleRef.current;
        if (el) {
            el.addEventListener('click', handleLinkClick);
            return () => el.removeEventListener('click', handleLinkClick);
        }
    }, [router]);

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
        if (!query.trim()) {
            dispatchError("Please enter an artist name first!");
            return;
        }
        setLoadingState("search");
        setArtists([]);
        setSongs([]);
        setAnalysis(null);
        setSuggestions([]);

        try {
            const res = await fetch(`/api/genius/search-artist?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.artists && data.artists.length > 0) {
                setArtists(data.artists);
            } else {
                dispatchError("No artist found.");
            }
        } catch (e) {
            dispatchError("Error searching artist.");
        } finally {
            setLoadingState(null);
        }
    };

    const handleMouseMoveOrTouch = (e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        const x = ((clientX - rect.left) / rect.width) * 100;
        const y = ((clientY - rect.top) / rect.height) * 100;
        el.style.setProperty("--mouse-x", `${x}%`);
        el.style.setProperty("--mouse-y", `${y}%`);
    };

    const handleAutocomplete = (val: string) => {
        setQuery(val);
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
            debounceTimer.current = null;
        }
        if (!val.trim()) {
            setSuggestions([]);
            return;
        }

        debounceTimer.current = setTimeout(async () => {
            if (!val.trim()) {
                setSuggestions([]);
                return;
            }
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
        setQuery(artist.name); // Auto-fill with artist's correct spelling
        setSuggestions([]);
        setArtists([]);
        setSelectedArtist(artist);
        setLoadingState("songs");

        try {
            const res = await fetch(`/api/genius/artist-songs/${artist.id}`);
            const data = await res.json();
            if (data.songs) {
                setSongs(data.songs);
            } else {
                dispatchError("No songs found.");
            }
        } catch (e) {
            dispatchError("Error loading songs.");
        } finally {
            setLoadingState(null);
        }
    };

    const handleClearSearch = () => {
        setQuery("");
        setSuggestions([]);
        setArtists([]);
        setSelectedArtist(null);
        setSongs([]);
        setSelectedSongId(null);
        setAnalysis(null);
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
            dispatchError("Failed to fetch lyrics or analyze.");
        } finally {
            setLoadingState(null);
        }
    };

    const isEmpty = !selectedArtist && artists.length === 0 && !loadingState;

    return (
        <div className="page-container flex flex-col w-full max-w-3xl mx-auto flex-1">
            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mt-2 mb-4 flex-none px-4"
            >
                <h1 className="text-[2.5rem] font-extrabold text-[#1DB954] mb-2">
                    Genius Analyzer
                </h1>
                <p
                    ref={subtitleRef}
                    className="text-lg mb-3 text-neutral-500 dark:text-[#B3B3B3] font-medium min-h-[1.5em]"
                />
            </motion.header>

            {/* Content - always centered */}
            <div className="flex flex-col w-full flex-1 justify-center">
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

                    {/* Search / Clear Button */}
                    <button
                        onClick={selectedArtist ? handleClearSearch : handleSearch}
                        onMouseMove={handleMouseMoveOrTouch}
                        onTouchMove={handleMouseMoveOrTouch}
                        disabled={loadingState === "search"}
                        className={`w-full group mb-0 min-h-[46px] ${loadingState === "search" ? "pointer-events-none" : ""} ${selectedArtist ? "btn-glass-red" : "btn-glass"}`}
                    >
                        <span className={`relative -top-px transition-opacity duration-200 ${loadingState === "search" ? "opacity-0" : "opacity-100"}`}>
                            {selectedArtist ? "Clear Search" : "Search Artist"}
                        </span>
                        {loadingState === "search" && (
                            <svg 
                                className="absolute top-1/2 left-1/2 -ml-3 -mt-3 w-6 h-6 spinner-svg" 
                                style={{ position: 'absolute' }}
                                viewBox="0 0 50 50"
                            >
                                <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" />
                            </svg>
                        )}
                    </button>



                    {/* Unified Results Grid (Suggestions or Search Results) */}
                    {(suggestions.length > 0 || artists.length > 0) && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 border-t border-neutral-200 dark:border-white/10 pt-6">
                            {(artists.length > 0 ? artists : suggestions).map((artist) => (
                                <div
                                    key={artist.id}
                                    onClick={() => handleLoadSongs(artist)}
                                    onMouseMove={handleMouseMoveOrTouch}
                                    onTouchMove={handleMouseMoveOrTouch}
                                    className="glass-card glow-card flex flex-col items-center p-4 rounded-xl cursor-pointer bg-white/5 hover:bg-white/10 border-white/10 transition-all active:scale-95"
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
                        <div className="flex flex-col items-center justify-center text-[#1DB954] py-6 gap-3 mt-4 border-t border-neutral-200 dark:border-white/10">
                            <svg className="spinner-svg w-8 h-8" viewBox="0 0 50 50">
                                <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" />
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
                                        onMouseMove={handleMouseMoveOrTouch}
                                        onTouchMove={handleMouseMoveOrTouch}
                                        className={`glass-card glow-card flex items-center gap-3 p-3 rounded-xl cursor-pointer text-left h-[71px] border-neutral-200 dark:border-white/10 snap-start transition-all active:scale-[0.98] ${selectedSongId === song.id
                                            ? "ring-2 ring-[#1DB954] bg-[#1DB954]/10 dark:bg-[#1DB954]/15"
                                            : "bg-white/5 dark:bg-white/5 hover:bg-white/10"
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
                                                className={`text-sm font-bold ${selectedSongId === song.id ? "text-[#1DB954]" : "text-neutral-900 dark:text-white"}`}
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
                        <div className="flex flex-col items-center justify-center text-[#1DB954] py-6 gap-3 mt-6 border-t border-dashed border-neutral-300 dark:border-[#333]">
                            <svg className="spinner-svg w-8 h-8" viewBox="0 0 50 50">
                                <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" />
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
                                        className="text-lg font-bold text-[#1DB954] mb-1"
                                    />
                                    <MarqueeText
                                        text={analysis.track_info.artist}
                                        className="text-neutral-500 dark:text-[#aaa] font-medium"
                                    />
                                </div>
                            </div>
                            <div className="bg-white dark:bg-[#181818] p-5 rounded-xl border border-neutral-200 dark:border-[#282828] text-neutral-700 dark:text-[#cccccc] leading-[1.6rem] whitespace-pre-wrap max-h-[300px] overflow-y-auto custom-scrollbar mb-6 text-[0.95rem] font-light tracking-wide">
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