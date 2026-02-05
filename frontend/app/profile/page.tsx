"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { staggerContainer, fadeUp, cardReveal } from "@/lib/animations";
import { ExternalLink, LogOut, Music2 } from "lucide-react";
import MarqueeText from "@/components/marquee-text";

interface CurrentlyPlaying {
    is_playing: boolean;
    track?: {
        id: string;
        name: string;
        artists: string[];
        album: string;
        image: string | null;
        duration_ms: number;
        progress_ms: number;
        external_url: string;
    };
}

export default function ProfilePage() {
    const router = useRouter();
    const paragraphRef = useRef<HTMLParagraphElement>(null);
    const hasTyped = useRef(false);
    const [spotifyId, setSpotifyId] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [userImage, setUserImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [nowPlaying, setNowPlaying] = useState<CurrentlyPlaying | null>(null);
    const [animatedDots, setAnimatedDots] = useState(".");

    // Animate loading dots
    useEffect(() => {
        if (!isLoading) return;
        const dotsInterval = setInterval(() => {
            setAnimatedDots((prev) => (prev.length >= 3 ? "." : prev + "."));
        }, 400);
        return () => clearInterval(dotsInterval);
    }, [isLoading]);

    // Typewriter effect for subtitle
    useEffect(() => {
        if (hasTyped.current || !paragraphRef.current) return;
        hasTyped.current = true;

        const text = "Manage account and see what you're playing.";
        let index = 0;

        function typeWriter() {
            if (index < text.length) {
                if (paragraphRef.current) {
                    paragraphRef.current.innerHTML =
                        text.substring(0, index + 1) +
                        '<span class="typing-cursor"></span>';
                }
                index++;
                setTimeout(typeWriter, 30);
            } else {
                if (paragraphRef.current) {
                    paragraphRef.current.innerHTML = text;
                }
            }
        }

        setTimeout(typeWriter, 400);
    }, []);

    // Smart Polling Logic
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const fetchNowPlaying = async (id: string) => {
        try {
            const res = await fetch(`/api/currently-playing/${id}`, {
                credentials: "include",
            });

            let nextPollDelay = 10000; // Default: 10 seconds

            if (res.ok) {
                const data = await res.json();
                setNowPlaying(data);

                // Adaptive Polling
                if (data && data.is_playing && data.track) {
                    const progress = data.track.progress_ms || 0;
                    const duration = data.track.duration_ms || 0;
                    const timeLeft = duration - progress;

                    if (timeLeft < 10000) {
                        // Song ending soon -> Poll faster to catch transition
                        nextPollDelay = 2000;
                    } else {
                        // Song playing -> Poll slower (save resources)
                        nextPollDelay = 15000;
                    }
                } else {
                    // Not playing / Paused -> Poll moderate speed
                    nextPollDelay = 5000;
                }
            } else {
                // Error -> Retry slower
                nextPollDelay = 10000;
            }

            // Schedule next poll
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => fetchNowPlaying(id), nextPollDelay);

        } catch (e) {
            // Network error -> Retry slower
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => fetchNowPlaying(id), 10000);
        }
    };

    useEffect(() => {
        const storedId = localStorage.getItem("spotify_id");
        if (!storedId) {
            router.push("/");
            return;
        }
        setSpotifyId(storedId);

        // Try to get cached user name
        const cachedName = localStorage.getItem("spotify_user_name");
        if (cachedName) {
            setUserName(cachedName);
        }

        // Try to get cached image first
        const cachedImage = localStorage.getItem("spotify_user_image");
        if (cachedImage) {
            setUserImage(cachedImage);
        }

        // Use lightweight profile endpoint (doesn't trigger emotion analysis)
        // Falls back to dashboard API if profile endpoint fails
        fetch(`/api/profile/${storedId}`, {
            credentials: "include",
        })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data && !data.error && data.user) {
                    setUserName(data.user);
                    localStorage.setItem("spotify_user_name", data.user);
                    if (data.image) {
                        setUserImage(data.image);
                        localStorage.setItem("spotify_user_image", data.image);
                    }
                    setIsLoading(false);
                } else {
                    // Fallback to dashboard API
                    return fetch(`/api/dashboard/${storedId}?time_range=short_term`, {
                        credentials: "include",
                    })
                        .then((res) => (res.ok ? res.json() : null))
                        .then((dashData) => {
                            if (dashData) {
                                setUserName(dashData.user);
                                localStorage.setItem("spotify_user_name", dashData.user);
                                if (dashData.image) {
                                    setUserImage(dashData.image);
                                    localStorage.setItem("spotify_user_image", dashData.image);
                                }
                            }
                            setIsLoading(false);
                        });
                }
            })
            .catch(() => {
                // Last resort fallback
                fetch(`/api/dashboard/${storedId}?time_range=short_term`, {
                    credentials: "include",
                })
                    .then((res) => (res.ok ? res.json() : null))
                    .then((dashData) => {
                        if (dashData) {
                            setUserName(dashData.user);
                            localStorage.setItem("spotify_user_name", dashData.user);
                            if (dashData.image) {
                                setUserImage(dashData.image);
                                localStorage.setItem("spotify_user_image", dashData.image);
                            }
                        }
                        setIsLoading(false);
                    })
                    .catch(() => setIsLoading(false));
            });

        // Initial fetch
        fetchNowPlaying(storedId);

        // Cleanup on unmount
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem("spotify_id");
        localStorage.removeItem("spotify_user_image");
        window.location.href = "/logout";
    };

    const handleMouseMove = (
        e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>
    ) => {
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        let clientX, clientY;

        if ("touches" in e) {
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

    if (isLoading) {
        return (
            <div className="page-container flex-1 flex flex-col items-center justify-center min-h-[calc(100dvh-160px)] w-full">
                <svg className="w-8 h-8 mb-4 spinner-svg" viewBox="0 0 50 50">
                    <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" />
                </svg>
                <span className="font-semibold text-foreground">Loading Profile{animatedDots}</span>
            </div>
        );
    }

    if (!spotifyId) {
        return null;
    }

    return (
        <motion.div
            className="page-container flex flex-col items-center w-full flex-1 min-h-[calc(100dvh-160px)]"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
        >
            {/* Header - Same as Lyrics page */}
            <motion.header
                variants={fadeUp}
                className="text-center mt-1 mb-4 flex-none px-4"
            >
                <h1 className="text-[2.5rem] font-extrabold text-[#1DB954] mb-2">
                    Your Profile
                </h1>
                <p
                    ref={paragraphRef}
                    className="text-lg mb-3 text-neutral-500 dark:text-[#B3B3B3] font-medium min-h-[1.5em]"
                >
                    Manage account and see what you're playing.
                </p>
            </motion.header>

            {/* Content - centered */}
            <div className="flex flex-col flex-1 justify-center w-full max-w-[420px]">
                <motion.div
                    variants={cardReveal}
                    className="w-full glass-card rounded-2xl p-5"
                    whileHover={{
                        y: -4,
                        transition: { type: "spring", stiffness: 400, damping: 17 },
                    }}
                >
                    {/* Profile Header */}
                    <div className="flex flex-col items-center mb-5">
                        {/* Profile Image */}
                        <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 mb-3 shadow-lg">
                            {userImage ? (
                                <Image
                                    src={userImage}
                                    alt="Profile"
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-3xl font-bold text-[#1DB954]">P</span>
                                </div>
                            )}
                        </div>

                        {/* Display Name */}
                        <h2 className="text-xl font-bold text-black dark:text-white mb-0.5">
                            {userName || "User"}
                        </h2>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            @{spotifyId}
                        </p>
                    </div>

                    {/* Currently Playing */}
                    <AnimatePresence mode="wait">
                        {nowPlaying?.is_playing && nowPlaying.track && (
                            <motion.a
                                key={nowPlaying.track.id}
                                href={nowPlaying.track.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/20 hover:bg-[#1DB954]/15 transition-colors"
                            >
                                {/* Album Art */}
                                <div className="relative w-12 h-12 rounded-md overflow-hidden bg-neutral-800 shrink-0">
                                    {nowPlaying.track.image ? (
                                        <Image
                                            src={nowPlaying.track.image}
                                            alt={nowPlaying.track.album}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Music2 size={20} className="text-neutral-500" />
                                        </div>
                                    )}
                                    {/* Playing indicator removed */}
                                </div>

                                {/* Track Info */}
                                <div className="flex-1 min-w-0">
                                    <MarqueeText
                                        text={nowPlaying.track.name}
                                        className="text-sm font-bold text-black dark:text-white whitespace-nowrap"
                                    />
                                    <MarqueeText
                                        text={nowPlaying.track.artists.join(", ")}
                                        className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap"
                                    />
                                </div>

                                {/* Now Playing Label */}
                                <div className="flex items-center gap-1 text-[#1DB954] text-xs font-medium shrink-0">
                                    <Music2 size={12} className="animate-bounce" />
                                </div>
                            </motion.a>
                        )}

                        {/* Not Playing State */}
                        {nowPlaying && !nowPlaying.is_playing && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center justify-center gap-2 p-3 mb-4 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 text-neutral-500 text-sm"
                            >
                                <Music2 size={14} />
                                <span>Not playing anything</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2.5 w-full">
                        {/* Open Spotify Button */}
                        <motion.a
                            href={`https://open.spotify.com/user/${spotifyId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onMouseMove={handleMouseMove}
                            onTouchMove={handleMouseMove}
                            className="btn-glass rounded-xl py-2.5 flex items-center justify-center gap-2 text-white font-bold text-sm"
                            whileHover={{ scale: 1.02, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <ExternalLink size={15} />
                            Open Spotify Profile
                        </motion.a>

                        {/* Logout Button */}
                        <motion.button
                            onClick={handleLogout}
                            onMouseMove={handleMouseMove}
                            onTouchMove={handleMouseMove}
                            className="btn-glass-red rounded-xl py-2.5 flex items-center justify-center gap-2 text-red-500 font-bold text-sm"
                            whileHover={{ scale: 1.02, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <LogOut size={15} />
                            Logout
                        </motion.button>
                    </div>

                    {/* Dashboard Link */}
                    <Link
                        href={`/dashboard/${spotifyId}?time_range=short_term`}
                        className="mt-4 block text-center text-sm text-neutral-500 dark:text-neutral-400 hover:text-[#1DB954] transition-colors"
                    >
                        View Dashboard →
                    </Link>
                </motion.div>
            </div>
        </motion.div>
    );
}
