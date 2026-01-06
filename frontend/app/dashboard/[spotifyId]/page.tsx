"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import * as htmlToImage from "html-to-image";

ChartJS.register(ArcElement, Tooltip, Legend);

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
    album: {
        name: string;
        total_tracks: number;
    };
    popularity: number;
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
    genre_artists_map: Record<string, string[]>;
}

const TIME_RANGE_LABELS: Record<string, string> = {
    short_term: "Short Term",
    medium_term: "Mid Term",
    long_term: "Long Term",
};

const TIME_RANGE_SUBTITLES: Record<string, string> = {
    short_term: "Here's your monthly recap",
    medium_term: "A look at your last 6 months",
    long_term: "Your listening overview for the year",
};

const GENRE_COLORS = [
    "#1DB954", "#F28E2B", "#E15759", "#76B7B2", "#9AA067",
    "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC",
    "#4D4D4D", "#6B5B95", "#88B04B", "#F7CAC9", "#92A8D1",
    "#D62728", "#9467BD", "#8C564B", "#E377C2", "#7F7F7F"
];

function hexToRgba(hex: string, alpha: number) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function DashboardPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { resolvedTheme } = useTheme();

    const spotifyId = params.spotifyId as string;
    const timeRange = searchParams.get("time_range") || "short_term";

    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeEmbed, setActiveEmbed] = useState<string | null>(null);
    const [showTimeModal, setShowTimeModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [hideSaveBtn, setHideSaveBtn] = useState(false);

    useEffect(() => {
        const footer = document.querySelector('footer');
        if (!footer) return;

        const observer = new IntersectionObserver((entries) => {
            // Only active on mobile/tablet (roughly < 768px, matching the CSS media query logic usually)
            // But user said "pas lagi di mobile", so we can check window width or just let it work generally.
            // The original legacy code checked `if (window.innerWidth > 768) return`.
            // We will mimic that behavioral check inside the callback or effect.
            if (window.innerWidth > 768) {
                setHideSaveBtn(false);
                return;
            }

            entries.forEach(entry => {
                setHideSaveBtn(entry.isIntersecting);
            });
        }, { threshold: 0.1 });

        observer.observe(footer);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        // Initial check for mobile
        const checkMobile = () => {
            // Optional: Force update if needed on resize
        };
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const [currentCategory, setCurrentCategory] = useState<"artists" | "tracks" | "genres">("tracks");
    const [isMobile, setIsMobile] = useState(false);
    const [emotionText, setEmotionText] = useState<string>("");
    const [typedHtml, setTypedHtml] = useState<string>("");
    const [isTyping, setIsTyping] = useState(false);
    const [hoveredGenre, setHoveredGenre] = useState<number | null>(null);
    const [disabledGenres, setDisabledGenres] = useState<Set<number>>(new Set());
    const [showTop20, setShowTop20] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const chartRef = useRef<any>(null);
    const headerRef = useRef<HTMLElement>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty("--mouse-x", `${x}%`);
        el.style.setProperty("--mouse-y", `${y}%`);
    };

    // Typewriter effect with HTML support
    useEffect(() => {
        if (emotionText && emotionText !== typedHtml) {
            setIsTyping(true);
            let i = 0;
            let currentHtml = "";

            const interval = setInterval(() => {
                if (i < emotionText.length) {
                    const char = emotionText.charAt(i);
                    if (char === "<") {
                        const tagEnd = emotionText.indexOf(">", i);
                        if (tagEnd !== -1) {
                            currentHtml += emotionText.substring(i, tagEnd + 1);
                            i = tagEnd + 1;
                        } else {
                            currentHtml += char;
                            i++;
                        }
                    } else {
                        currentHtml += char;
                        i++;
                    }
                    setTypedHtml(currentHtml);
                } else {
                    clearInterval(interval);
                    setIsTyping(false);
                }
            }, 30);
            return () => clearInterval(interval);
        }
    }, [emotionText]);

    // Check screen size
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Listen for easter egg event from footer
    useEffect(() => {
        const handleEasterEggEvent = () => {
            if (!showTop20) {
                setShowTop20(true);
                fetchEmotionAnalysis(true);
            }
        };
        window.addEventListener("personalify-easter-egg", handleEasterEggEvent);
        return () => window.removeEventListener("personalify-easter-egg", handleEasterEggEvent);
    }, [showTop20]);

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const res = await fetch(`/api/dashboard/${spotifyId}?time_range=${timeRange}`, {
                    credentials: "include",
                });

                if (res.status === 401 || res.status === 404) {
                    router.push("/?error=session_expired");
                    return;
                }

                if (!res.ok) throw new Error("Failed to fetch dashboard data");

                const json = await res.json();
                setData(json);
                setEmotionText(json.emotion_paragraph || "");

                if (json.emotion_paragraph?.includes("being analyzed") || json.emotion_paragraph?.includes("getting ready")) {
                    fetchEmotionAnalysis(false);
                }
            } catch (err) {
                setError("Failed to load dashboard. Please try again.");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [spotifyId, timeRange, router]);

    const fetchEmotionAnalysis = async (extended: boolean) => {
        try {
            const res = await fetch("/analyze-emotions-background", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    spotify_id: spotifyId,
                    time_range: timeRange,
                    extended: extended,
                }),
            });

            if (res.ok) {
                const result = await res.json();
                if (result.emotion_paragraph) {
                    setTypedHtml("");
                    setEmotionText(result.emotion_paragraph);
                }
            }
        } catch (err) {
            console.warn("Emotion analysis failed:", err);
        }
    };

    // Easter egg - click footer text to show top 20
    const handleEasterEgg = useCallback(() => {
        if (showTop20) return;
        setShowTop20(true);
        fetchEmotionAnalysis(true);
    }, [showTop20]);

    // Close modals on ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setShowCategoryModal(false);
                setShowSaveModal(false);
                setShowTimeModal(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const changeTimeRange = (range: string) => {
        setShowTimeModal(false);
        router.push(`/dashboard/${spotifyId}?time_range=${range}`);
    };

    const getAlbumType = (totalTracks: number, albumName: string) => {
        if (totalTracks === 1) return "Single";
        if (totalTracks >= 2 && totalTracks <= 3) return `Maxi-Single: ${albumName}`;
        if (totalTracks >= 4 && totalTracks <= 6) return `EP: ${albumName}`;
        return `Album: ${albumName}`;
    };

    const openArtistProfile = (artistId: string) => {
        window.open(`https://open.spotify.com/artist/${artistId}`, "_blank");
    };

    const getGenreColor = (genreName: string) => {
        if (!data) return "rgba(255,255,255,0.2)";
        const idx = data.genres.findIndex((g: any) => g.name === genreName);
        if (idx !== -1) {
            return GENRE_COLORS[idx % GENRE_COLORS.length];
        }
        return "rgba(255,255,255,0.2)";
    };

    const toggleEmbed = (trackId: string) => {
        setActiveEmbed(activeEmbed === trackId ? null : trackId);
    };

    const closeEmbed = (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveEmbed(null);
    };

    const toggleGenre = (idx: number) => {
        setDisabledGenres(prev => {
            const newSet = new Set(prev);
            if (newSet.has(idx)) {
                newSet.delete(idx);
            } else {
                newSet.add(idx);
            }
            return newSet;
        });
    };

    // Calculate genres client-side to respect Top 10 / Top 20 toggle
    const processedGenres = React.useMemo(() => {
        if (!data) return { genres: [], map: {} as Record<string, string[]> };
        const artistsToUser = showTop20 ? data.artists : data.artists.slice(0, 10);

        const counts: Record<string, number> = {};
        const mapping: Record<string, string[]> = {};

        artistsToUser.forEach(artist => {
            artist.genres.forEach(g => {
                counts[g] = (counts[g] || 0) + 1;
                if (!mapping[g]) mapping[g] = [];
                mapping[g].push(artist.name);
            });
        });

        const sorted = Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        // Limit to 10 genres in default mode, show all in Top 20 mode
        const limitedGenres = showTop20 ? sorted : sorted.slice(0, 10);

        return { genres: limitedGenres, map: mapping };
    }, [data, showTop20]);

    // Generate image like vanilla - 720x1280 story format with header
    const generateImage = async (category: "artists" | "tracks" | "genres") => {
        setShowSaveModal(false);
        setIsSaving(true);
        setActiveEmbed(null);

        if (!data) {
            setIsSaving(false);
            return;
        }

        const STORY_WIDTH = 720;
        const STORY_HEIGHT = 1280;

        // Create container
        const container = document.createElement("div");
        container.id = "personalify-screenshot";
        Object.assign(container.style, {
            width: `${STORY_WIDTH}px`,
            height: `${STORY_HEIGHT}px`,
            background: "#121212",
            color: "#fff",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            overflow: "hidden",
            position: "fixed",
            top: "0",
            left: "0",
            zIndex: "-9999",
        });

        // Content wrapper
        const contentWrapper = document.createElement("div");
        Object.assign(contentWrapper.style, {
            width: "100%",
            padding: "140px 40px 60px 40px", // Increased top padding for Instagram UI safe zone
            boxSizing: "border-box",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
        });

        // Header
        const header = document.createElement("div");
        header.innerHTML = `
            <h1 style="color: #1DB954; font-size: 2.5rem; font-weight: 800; text-align: center; margin: 0 0 0.5rem 0;">Personalify</h1>
            <p style="color: #B3B3B3; font-size: 1.1rem; text-align: center; margin: 0 0 0.5rem 0;">
                ${TIME_RANGE_SUBTITLES[timeRange]}, ${data.user}!
            </p>
            <p style="color: #B3B3B3; font-size: 0.9rem; text-align: center; margin: 0 0 5rem 0; font-style: italic;">
                ${emotionText.replace(/<[^>]*>/g, '')}
            </p>
        `;
        contentWrapper.appendChild(header);

        // Section
        const section = document.createElement("div");
        Object.assign(section.style, {
            background: "#1e1e1e",
            borderRadius: "16px",
            padding: "1.5rem",
            border: "1px solid #282828",
        });

        const sectionTitle = document.createElement("h2");
        sectionTitle.textContent = `Top ${category.charAt(0).toUpperCase() + category.slice(1)}`;
        Object.assign(sectionTitle.style, {
            color: "#1DB954",
            fontSize: "1.25rem",
            fontWeight: "700",
            textAlign: "center",
            borderBottom: "1px solid #333",
            paddingBottom: "1rem",
            marginTop: "-0.5rem",
            marginBottom: "0.5rem",
        });
        section.appendChild(sectionTitle);

        // List items - limit to 10
        const list = document.createElement("ol");
        list.style.listStyle = "none";
        list.style.padding = "0";
        list.style.margin = "0";

        const items = category === "artists" ? data.artists : category === "tracks" ? data.tracks : data.genres;
        const top10 = items.slice(0, 10);

        top10.forEach((item, idx) => {
            const li = document.createElement("li");
            Object.assign(li.style, {
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "0.75rem 0",
                borderBottom: idx < 9 ? "1px solid #333" : "none",
            });

            const rank = document.createElement("span");
            rank.textContent = String(idx + 1);
            Object.assign(rank.style, {
                fontSize: "1.2rem",
                fontWeight: "700",
                color: "rgba(255, 255, 255, 0.5)",
                width: "2rem",
                textAlign: "center",
                flexShrink: "0",
            });
            li.appendChild(rank);

            if (category !== "genres") {
                const img = document.createElement("img");
                img.src = (item as Artist | Track).image;
                img.crossOrigin = "anonymous";
                Object.assign(img.style, {
                    width: "64px",
                    height: "64px",
                    borderRadius: "8px",
                    objectFit: "cover",
                    flexShrink: "0",
                });
                li.appendChild(img);
            }

            const info = document.createElement("div");
            info.style.flex = "1";
            info.style.minWidth = "0";

            if (category === "artists") {
                const artist = item as Artist;
                info.innerHTML = `
                    <p style="font-weight: 600; font-size: 0.85rem; color: #fff; margin: 0 0 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${artist.name}</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px;">
                        ${artist.genres.slice(0, 5).map(g => {
                    const color = getGenreColor(g);
                    return `<span style="background: rgba(255,255,255,0.1); border: 1px solid ${color}; border-radius: 9999px; padding: 2px 8px; font-size: 0.6rem; color: #fff;">${g}</span>`;
                }).join("")}
                    </div>
                    <p style="font-size: 0.68rem; color: #908f8f; margin: 0;">Popularity: ${artist.popularity}</p>
                `;
            } else if (category === "tracks") {
                const track = item as Track;
                info.innerHTML = `
                    <p style="font-weight: 600; font-size: 0.85rem; color: #fff; margin: 0 0 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.name}</p>
                    <p style="font-size: 0.68rem; color: #908f8f; margin: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.artists.join(", ")}</p>
                    <p style="font-size: 0.68rem; color: #908f8f; margin: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${getAlbumType(track.album.total_tracks, track.album.name)}</p>
                    <p style="font-size: 0.68rem; color: #908f8f; margin: 2px 0;">Popularity: ${track.popularity}</p>
                `;
            } else {
                const genre = item as Genre;
                const artistsList = data.genre_artists_map[genre.name] || [];
                info.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 10px; height: 10px; border-radius: 50%; background: ${GENRE_COLORS[idx]};"></span>
                        <span style="font-weight: 600; font-size: 0.85rem; color: #fff;">${genre.name}</span>
                    </div>
                    <p style="font-size: 0.68rem; color: #908f8f; margin: 4px 0 0 0;">Mentioned ${genre.count} times${artistsList.length > 0 ? `: ${artistsList.join(", ")}` : ""}</p>
                `;
            }
            li.appendChild(info);
            list.appendChild(li);
        });

        section.appendChild(list);
        contentWrapper.appendChild(section);

        // Footer
        const footer = document.createElement("div");
        footer.innerHTML = "Personalify © 2025 • Powered by Spotify API";
        Object.assign(footer.style, {
            paddingTop: "1.5rem",
            textAlign: "center",
            fontSize: "0.75rem",
            color: "#888",
        });
        contentWrapper.appendChild(footer);

        container.appendChild(contentWrapper);
        document.body.appendChild(container);

        try {
            // Wait for images to load
            const imgs = container.querySelectorAll("img");
            await Promise.all(
                Array.from(imgs).map(
                    (img) =>
                        new Promise((resolve) => {
                            if (img.complete) {
                                resolve(true);
                            } else {
                                img.onload = () => resolve(true);
                                img.onerror = () => resolve(true);
                            }
                        })
                )
            );

            await new Promise((r) => setTimeout(r, 300));

            const dataUrl = await htmlToImage.toPng(container, {
                quality: 1.0,
                pixelRatio: 2,
                backgroundColor: "#121212",
                width: STORY_WIDTH,
                height: STORY_HEIGHT,
            });

            const link = document.createElement("a");
            link.download = `personalify-${category}-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error("Failed to generate image:", err);
            alert("Failed to create image. Try refreshing the page.");
        } finally {
            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
            setIsSaving(false);
        }
    };

    // Chart data
    const chartDisplayGenres = processedGenres.genres;
    const chartData = chartDisplayGenres.length > 0 ? {
        labels: chartDisplayGenres.map(g => g.name),
        datasets: [{
            data: chartDisplayGenres.map((g, i) =>
                disabledGenres.has(i) ? 0 : g.count
            ),
            backgroundColor: chartDisplayGenres.map((_, i) => {
                const c = GENRE_COLORS[i % GENRE_COLORS.length];
                return disabledGenres.has(i) ? "transparent" :
                    hoveredGenre !== null && hoveredGenre !== i
                        ? hexToRgba(c, 0.2)
                        : hexToRgba(c, 0.7);
            }),
            borderColor: chartDisplayGenres.map((_, i) => {
                const c = GENRE_COLORS[i % GENRE_COLORS.length];
                return disabledGenres.has(i) ? "transparent" :
                    hoveredGenre !== null && hoveredGenre !== i
                        ? "rgba(255, 255, 255, 0.1)"
                        : "rgba(255, 255, 255, 0.3)";
            }),
            borderWidth: 1,
        }]
    } : null;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: "rgba(30, 30, 30, 0.9)",
                titleColor: "#fff",
                bodyColor: "#fff",
                borderColor: "rgba(255, 255, 255, 0.1)",
                borderWidth: 1,
            }
        },
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[102vh]">
                <svg className="w-8 h-8 mb-4 spinner-svg" viewBox="0 0 50 50">
                    <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" />
                </svg>
                <span className="font-semibold text-foreground">Loading Dashboard...</span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-destructive">
                <p className="font-semibold">{error || "Something went wrong"}</p>
            </div>
        );
    }

    return (
        <div className="page-container w-full max-w-none">
            {/* Saving Overlay */}
            <AnimatePresence>
                {isSaving && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-background/95 z-50 flex flex-col items-center justify-center"
                    >
                        <svg className="w-8 h-8 mb-4 spinner-svg" viewBox="0 0 50 50">
                            <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" />
                        </svg>
                        <span className="font-semibold">Processing Image...</span>
                        <span className="text-muted-foreground text-sm mt-2">Please wait!</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <motion.header
                ref={headerRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="dashboard-header text-center"
            >
                <h1 className="text-[2.5rem] font-extrabold text-[#1DB954] mb-3 leading-tight">Personalify</h1>
                <p className="text-lg mb-3 text-[#B3B3B3] font-medium">
                    {TIME_RANGE_SUBTITLES[timeRange]}, <span className="font-bold">{data.user}</span>!
                </p>
                <p className="emotion-recap mt-4">
                    <span dangerouslySetInnerHTML={{ __html: typedHtml }} />
                </p>
            </motion.header>

            {/* Filters */}
            <div className="flex flex-wrap justify-center gap-3 mb-10">
                <button onClick={() => setShowTimeModal(true)} className="filter-btn glow-card" onMouseMove={handleMouseMove}>
                    <span>{TIME_RANGE_LABELS[timeRange]}</span>
                    <span className="text-muted-foreground text-sm ml-2">▼</span>
                </button>

                {isMobile && (
                    <button onClick={() => setShowCategoryModal(true)} className="filter-btn glow-card" onMouseMove={handleMouseMove}>
                        <span>{currentCategory === "artists" ? "Top Artists" : currentCategory === "tracks" ? "Top Tracks" : "Top Genres"}</span>
                        <span className="text-muted-foreground text-sm ml-2">▼</span>
                    </button>
                )}
            </div>

            {/* Time Range Modal */}
            <AnimatePresence>
                {showTimeModal && (
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        className="modal-overlay"
                        onClick={() => setShowTimeModal(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="modal-content"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-bold mb-6">Select Time Range</h3>
                            <div className="flex flex-col gap-4">
                                {["short_term", "medium_term", "long_term"].map((range) => (
                                    <button key={range} onClick={() => changeTimeRange(range)} className="btn-glass" onMouseMove={handleMouseMove}>
                                        {TIME_RANGE_LABELS[range]}
                                    </button>
                                ))}
                                <button onClick={() => setShowTimeModal(false)}
                                    className="mt-2 px-6 py-2 rounded-xl font-bold text-destructive bg-destructive/10 border border-destructive/20 hover:bg-destructive/15 transition-all">
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Category Modal (Mobile) */}
            <AnimatePresence>
                {showCategoryModal && (
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        className="modal-overlay"
                        onClick={() => setShowCategoryModal(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="modal-content"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-bold mb-6">Select Category</h3>
                            <div className="flex flex-col gap-4">
                                {(["artists", "tracks", "genres"] as const).map((cat) => (
                                    <button key={cat} onClick={() => { setCurrentCategory(cat); setShowCategoryModal(false); }} className="btn-glass" onMouseMove={handleMouseMove}>
                                        Top {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                    </button>
                                ))}
                                <button onClick={() => setShowCategoryModal(false)}
                                    className="mt-2 px-6 py-2 rounded-xl font-bold text-destructive bg-destructive/10 border border-destructive/20 hover:bg-destructive/15 transition-all">
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dashboard Container */}
            <div className={`grid gap-6 ${isMobile ? "grid-cols-1" : "grid-cols-[repeat(auto-fit,minmax(300px,1fr))]"}`}>



                {/* Top Artists Section */}
                {
                    (!isMobile || currentCategory === "artists") && (
                        <section className="section-card hover:-translate-y-1 transition-transform duration-300">
                            <h2>Top Artists</h2>
                            <ol className="list-none p-0 m-0">
                                {data.artists.slice(0, showTop20 ? 20 : 10).map((artist, idx) => (
                                    <motion.li
                                        key={artist.id}
                                        initial={idx >= 10 ? { opacity: 0, y: 20 } : false}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx >= 10 ? (idx - 10) * 0.1 : 0 }}
                                        className="list-item cursor-pointer hover:bg-accent/50 rounded-lg transition-colors"
                                        onClick={() => openArtistProfile(artist.id)}
                                    >
                                        <span className="rank">{idx + 1}</span>
                                        <img src={artist.image} alt={artist.name} />
                                        <div className="info">
                                            <p className="name">{artist.name}</p>
                                            <div className="genre-pills">
                                                {artist.genres.slice(0, 6).map((genre) => (
                                                    <span key={genre} className="genre-pill" style={{ borderColor: getGenreColor(genre) }}>{genre}</span>
                                                ))}
                                                {artist.genres.length > 6 && (
                                                    <span className="text-primary text-xs cursor-pointer">+{artist.genres.length - 6}</span>
                                                )}
                                            </div>
                                            <p className="meta">Popularity: {artist.popularity}</p>
                                        </div>
                                    </motion.li>
                                ))}
                            </ol>
                        </section>
                    )
                }

                {/* Top Tracks Section */}
                {
                    (!isMobile || currentCategory === "tracks") && (
                        <section className="section-card hover:-translate-y-1 transition-transform duration-300">
                            <h2>Top Tracks</h2>
                            <ol className="list-none p-0 m-0">
                                {data.tracks.slice(0, showTop20 ? 20 : 10).map((track, idx) => (
                                    <motion.li
                                        key={track.id}
                                        initial={idx >= 10 ? { opacity: 0, y: 20 } : false}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx >= 10 ? (idx - 10) * 0.1 : 0 }}
                                        className={`list-item track-item cursor-pointer hover:bg-accent/50 rounded-lg transition-colors ${activeEmbed === track.id ? "embed-shown" : ""}`}
                                        onClick={() => toggleEmbed(track.id)}
                                    >
                                        <span
                                            className={`rank ${activeEmbed === track.id ? "embed-active" : ""}`}
                                            onClick={activeEmbed === track.id ? closeEmbed : undefined}
                                        >
                                            {idx + 1}
                                        </span>

                                        <div className={`track-content ${activeEmbed === track.id ? "hidden" : "flex"} items-center gap-4 flex-1 min-w-0`}>
                                            <img src={track.image} alt={track.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                                            <div className="info min-w-0 flex-1 overflow-hidden">
                                                <MarqueeText text={track.name} className="name font-semibold text-foreground text-base mb-0.5" />
                                                <MarqueeText text={track.artists.join(", ")} className="meta text-muted-foreground text-sm mt-0.5" />
                                                <p className="meta truncate">{getAlbumType(track.album.total_tracks, track.album.name)}</p>
                                                <p className="meta">Popularity: {track.popularity}</p>
                                            </div>
                                        </div>

                                        {activeEmbed === track.id && (
                                            <div className="embed-placeholder flex-1 -ml-2 bg-[#282828] rounded-xl overflow-hidden shadow-lg border border-[#1DB954]" onClick={(e) => e.stopPropagation()}>
                                                <iframe
                                                    src={`https://open.spotify.com/embed/track/${track.id}?utm_source=generator&theme=${resolvedTheme === 'dark' ? '0' : '1'}`}
                                                    width="100%"
                                                    height="80"
                                                    frameBorder="0"
                                                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                                    loading="lazy"
                                                    style={{ borderRadius: "12px", backgroundColor: "#282828" }}
                                                />
                                            </div>
                                        )}
                                    </motion.li>
                                ))}
                            </ol>
                        </section>
                    )
                }

                {/* Top Genres Section */}
                {
                    (!isMobile || currentCategory === "genres") && (
                        <section className="section-card overflow-visible hover:-translate-y-1 transition-transform duration-300">
                            <h2>Top Genres</h2>

                            {chartData && (
                                <div className="max-h-[250px] my-4 mb-2 mx-auto" style={{ maxWidth: "250px" }}>
                                    <Pie ref={chartRef} data={chartData} options={chartOptions} />
                                </div>
                            )}

                            <ol className="list-none p-0 m-0">
                                {processedGenres.genres.map((genre, idx) => (
                                    <motion.li
                                        key={genre.name}
                                        initial={idx >= 10 ? { opacity: 0, y: 20 } : false}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx >= 10 ? (idx - 10) * 0.1 : 0 }}
                                        className={`py-3 border-b border-border last:border-b-0 cursor-pointer hover:bg-accent/50 rounded-lg transition-all ${disabledGenres.has(idx) ? "opacity-40 line-through" : ""}`}
                                        onMouseEnter={() => setHoveredGenre(idx)}
                                        onMouseLeave={() => setHoveredGenre(null)}
                                        onClick={() => toggleGenre(idx)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="text-lg font-bold text-muted-foreground/50 w-6 text-center shrink-0">{idx + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: disabledGenres.has(idx) ? "#555" : GENRE_COLORS[idx % GENRE_COLORS.length] }} />
                                                    <span className="font-semibold text-sm text-foreground">{genre.name}</span>
                                                </div>
                                                <p className="text-[0.68rem] font-medium mt-0.5 text-(--text-muted) leading-relaxed">
                                                    Mentioned {genre.count} times{processedGenres.map[genre.name] && <>: {processedGenres.map[genre.name].join(", ")}</>}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.li>
                                ))}
                            </ol>
                        </section>
                    )
                }
            </div >


            {/* Save as Image Button */}
            <button
                onClick={() => setShowSaveModal(true)}
                onMouseMove={handleMouseMove}
                className={`download-btn glow-card fixed bottom-6 right-8 z-40 px-6 py-3 rounded-2xl font-bold
                    bg-white/5 dark:bg-[#ffffff05] backdrop-blur-md border border-white/10 shadow-lg text-sm
                    transition-all duration-500 ease-in-out
                    ${hideSaveBtn ? 'hide-on-scroll' : 'translate-y-0 opacity-100'}
                `}
            >
                <span className="relative -top-px">Save as Image</span>
            </button>

            {/* Save Modal */}
            <AnimatePresence>
                {
                    showSaveModal && (
                        <motion.div
                            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
                            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                            className="modal-overlay"
                            onClick={() => setShowSaveModal(false)}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="modal-content"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h3 className="text-xl font-bold mb-6">Choose Category to Save</h3>
                                <div className="flex flex-col gap-4">
                                    {(["artists", "tracks", "genres"] as const).map((cat) => (
                                        <button key={cat} onClick={() => generateImage(cat)} className="btn-glass" onMouseMove={handleMouseMove}>
                                            Top {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                        </button>
                                    ))}
                                    <button onClick={() => setShowSaveModal(false)}
                                        className="mt-2 px-6 py-2 rounded-xl font-bold text-destructive bg-destructive/10 border border-destructive/20 hover:bg-destructive/15 transition-all">
                                        Cancel
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )
                }
            </AnimatePresence >

            {/* Styles */}
            < style jsx global > {`
                .track-item.embed-shown .rank.embed-active {
                    color: #1DB954 !important;
                    cursor: pointer;
                    transition: color 0.2s ease, text-shadow 0.2s ease;
                }
                .track-item.embed-shown .rank.embed-active:hover {
                    color: white !important;
                    text-shadow: 0 0 8px rgba(29, 185, 84, 0.7);
                }
                .embed-placeholder {
                    margin-top: -0.2rem;
                    margin-bottom: -0.3rem;
                }
                .embed-placeholder iframe {
                    border-radius: 8px;
                    background: transparent;
                }
                .emotion-recap b {
                    font-weight: 700;
                    color: var(--foreground);
                }
            `}</style >
        </div >
    );
}
