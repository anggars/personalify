"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { GenreChart } from "@/components/genre-chart";
import * as htmlToImage from "html-to-image";
import { Slider } from "@/components/ui/slider";
import { CirclePlay, CirclePause } from "lucide-react";

import MarqueeText from "@/components/marquee-text";
import { toast } from "sonner";
import { fetchWithAuth } from "@/lib/api";

// Spotify IFrame API type declarations
interface SpotifyEmbedController {
  loadUri: (uri: string) => void;
  play: () => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  restart: () => void;
  seek: (seconds: number) => void;
  destroy: () => void;
  addListener: (event: string, callback: (e: any) => void) => void;
  removeListener: (event: string, callback?: (e: any) => void) => void;
}

interface SpotifyIFrameAPI {
  createController: (
    element: HTMLElement,
    options: { uri: string; width?: number | string; height?: number | string },
    callback: (controller: SpotifyEmbedController) => void
  ) => void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void;
    SpotifyIframeApi?: SpotifyIFrameAPI;
  }
}

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
  duration_ms: number;
}

interface Genre {
  name: string;
  count: number;
}

interface DashboardData {
  user: string;
  time_range: string;
  sentiment_report: string;
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
  "#1DB954", // 1. Spotify Green
  "#E6194B", // 2. Red
  "#4363D8", // 3. Blue
  "#FFE119", // 4. Yellow
  "#F58231", // 5. Orange
  "#911EB4", // 6. Purple
  "#42D4F4", // 7. Cyan/Sky
  "#F032E6", // 8. Magenta
  "#BFEF45", // 9. Lime
  "#FABED4", // 10. Pink
  "#469990", // 11. Teal
  "#DCBEFF", // 12. Lavender
  "#9A6324", // 13. Brown
  "#FFFAC8", // 14. Beige/Cream
  "#800000", // 15. Maroon
  "#AAFFC3", // 16. Mint
  "#808000", // 17. Olive
  "#FFD8B1", // 18. Apricot
  "#000075", // 19. Navy
  "#A9A9A9", // 20. Grey
  "#FFD700", // 21. Gold
  "#AEEA00", // 22. Acid Green
  "#FF1493", // 23. Deep Pink
  "#00BFFF", // 24. Deep Sky Blue
  "#FF4500", // 25. Orange Red
  "#2E8B57", // 26. Sea Green
  "#8A2BE2", // 27. Blue Violet
  "#DA70D6", // 28. Orchid
  "#7FFF00", // 29. Chartreuse
  "#CD5C5C", // 30. Indian Red
  "#BC8F8F", // 31. Rosy Brown
  "#5F9EA0", // 32. Cadet Blue
  "#9932CC", // 33. Dark Orchid
  "#FFDAB9", // 34. Peach Puff
  "#8B4513", // 35. Saddle Brown
  "#00FF00", // 36. Pure Green
  "#FF00FF", // 37. Pure Magenta
  "#00FFFF", // 38. Pure Cyan
  "#BDBDBD", // 39. Silver
  "#4682B4", // 40. Steel Blue
  "#D2691E", // 41. Chocolate
  "#9ACD32", // 42. Yellow Green
  "#BA55D3", // 43. Medium Orchid
  "#008B8B", // 44. Dark Cyan
  "#B22222", // 45. Fire Brick
  "#6A5ACD", // 46. Slate Blue
  "#F08080", // 47. Light Coral
  "#20B2AA", // 48. Light Sea Green
  "#FFCC00", // 49. Apple Gold
  "#AF52DE", // 50. Apple Purple
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

  // Error Handling - dispatch custom notification event like navbar
  useEffect(() => {
    if (error) {
      const event = new CustomEvent("personalify-notification", {
        detail: {
          type: "error",
          message: "Session expired. Please login again!",
        },
      });
      window.dispatchEvent(event);
      setTimeout(
        () =>
          window.dispatchEvent(
            new CustomEvent("personalify-notification", { detail: null }),
          ),
        4000,
      );
    }
  }, [error]);
  const [activeEmbed, setActiveEmbed] = useState<string | null>(null);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [hideSaveBtn, setHideSaveBtn] = useState(false);
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const embedRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  const [trackPosition, setTrackPosition] = useState<Record<string, number>>(
    {}
  );
  const [trackDuration, setTrackDuration] = useState<Record<string, number>>(
    {}
  );
  const [embedReady, setEmbedReady] = useState<Record<string, boolean>>({});
  const [showPlayerControls, setShowPlayerControls] = useState<
    Record<string, boolean>
  >({});
  const [expandedGenres, setExpandedGenres] = useState<Record<string, boolean>>(
    {}
  );
  const [isBuffering, setIsBuffering] = useState<Record<string, boolean>>({});

  // Spotify IFrame API controller instances
  const embedControllers = useRef<Record<string, SpotifyEmbedController>>({});
  const [spotifyApiReady, setSpotifyApiReady] = useState(false);
  const embedContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Track which embeds have been initialized (prevents re-creating controllers)
  const [initializedEmbeds, setInitializedEmbeds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Only active on mobile/tablet (roughly < 768px, matching the CSS media query logic usually)
        // But user said "pas lagi di mobile", so we can check window width or just let it work generally.
        // The original legacy code checked `if (window.innerWidth > 768) return`.
        // We will mimic that behavioral check inside the callback or effect.
        if (window.innerWidth > 768) {
          setHideSaveBtn(false);
          return;
        }

        entries.forEach((entry) => {
          setHideSaveBtn(entry.isIntersecting);
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Initial check for mobile
    const checkMobile = () => {
      // Optional: Force update if needed on resize
    };
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [currentCategory, setCurrentCategory] = useState<
    "artists" | "tracks" | "genres"
  >("tracks");
  const [isMobile, setIsMobile] = useState(false);
  const [emotionText, setEmotionText] = useState<string>("");
  const [typedHtml, setTypedHtml] = useState<string>("");
  const [isTyping, setIsTyping] = useState(false);
  const [hoveredGenre, setHoveredGenre] = useState<number | null>(null);
  const [disabledGenres, setDisabledGenres] = useState<Set<number>>(new Set());
  const [showTop20, setShowTop20] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [animatedDots, setAnimatedDots] = useState(".");

  const chartRef = useRef<any>(null);
  const headerRef = useRef<HTMLElement>(null);

  const handleMouseMoveOrTouch = (
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

  // Animated dots for loading text
  const isAnalyzing =
    emotionText?.includes("being analyzed") ||
    emotionText?.includes("getting ready") ||
    emotionText?.includes("Digging deeper");
  useEffect(() => {
    if (!isAnalyzing) return;
    const dotsInterval = setInterval(() => {
      setAnimatedDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 2000);
    return () => clearInterval(dotsInterval);
  }, [isAnalyzing]);

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
    return () =>
      window.removeEventListener(
        "personalify-easter-egg",
        handleEasterEggEvent
      );
  }, [showTop20]);

  // Fetch data with polling for analysis
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    
    async function fetchData(isPolling = false) {
      if (!isPolling) setLoading(true);
      try {
        const res = await fetchWithAuth(
          `/api/dashboard/${spotifyId}?time_range=${timeRange}`
        );

        if (!res.ok) throw new Error("Failed to fetch dashboard data");

        const json = await res.json();
        setData(json);
        
        const report = json.sentiment_report || "";
        setEmotionText(report);

        const isStillLoading = 
          report.includes("being analyzed") || 
          report.includes("getting ready");

        // Start/Stop polling based on state
        if (isStillLoading && !pollInterval) {
          console.log("DASHBOARD: Vibe is loading, starting poll...");
          pollInterval = setInterval(() => fetchData(true), 10000);
          // Also trigger re-analysis in case it died
          fetchEmotionAnalysis(false);
        } else if (!isStillLoading && pollInterval) {
          console.log("DASHBOARD: Vibe ready, stopping poll.");
          clearInterval(pollInterval);
          pollInterval = null;
        }

      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError("Failed to load dashboard. Please try again.");
      } finally {
        if (!isPolling) setLoading(false);
      }
    }
    
    fetchData();
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [spotifyId, timeRange, router]);
  
  // Reset dashboard states when time range changes to prevent state leakage
  useEffect(() => {
    setShowTop20(false);
    setDisabledGenres(new Set());
    setActiveEmbed(null);
    setPlayingTrack(null);
    setExpandedGenres({});
    // Reset player specific states to prevent metadata leakage
    setTrackPosition({});
    setTrackDuration({});
    setEmbedReady({});
    setShowPlayerControls({});
    setIsBuffering({});
  }, [timeRange]);

  // Animate dots effect (Slower speed: 800ms)
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const fetchEmotionAnalysis = async (extended: boolean) => {
    try {
      if (extended) {
        setTypedHtml("");
        setEmotionText("Digging deeper into your music vibe...");
      }

      const res = await fetchWithAuth("/analyze-sentiment-background", {
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
        if (result.sentiment_report) {
          setTypedHtml("");
          setEmotionText(result.sentiment_report);
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

  // Load Spotify IFrame API script
  useEffect(() => {
    // Check if script already loaded
    if (window.SpotifyIframeApi) {
      setSpotifyApiReady(true);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="spotify.com/embed/iframe-api"]');
    if (existingScript) {
      // Wait for it to load
      window.onSpotifyIframeApiReady = (api) => {
        window.SpotifyIframeApi = api;
        setSpotifyApiReady(true);
      };
      return;
    }

    // Define callback before loading script
    window.onSpotifyIframeApiReady = (api) => {
      window.SpotifyIframeApi = api;
      setSpotifyApiReady(true);
    };

    // Load the script
    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // Listen to Spotify iframe postMessage events for playback state
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only process messages from Spotify
      if (!event.origin.includes("spotify.com")) return;

      try {
        const data = event.data;
        const trackId = activeEmbed;

        if (!trackId) return;

        // CRITICAL FIX: If we have a controller for this track, IGNORE postMessage events
        // to prevent double updates and race conditions with the Controller API listener.
        if (embedControllers.current[trackId]) return;

        // Handle playback state updates from Spotify embed
        if (data.type === "playback_update") {
          const { position, duration, isPaused, isBuffering: apiBuffering } = data;

          if (position !== undefined) {
            // Convert ms to seconds
            const positionSec = Math.floor(position / 1000);
            setTrackPosition((prev) => ({
              ...prev,
              [trackId]: positionSec
            }));
          }
          if (duration !== undefined) {
            const durationSec = Math.floor(duration / 1000);
            // Don't cap at 30s anymore, use logic similar to toggleEmbed
            setTrackDuration((prev) => ({ ...prev, [trackId]: durationSec }));
          }
          // Use isBuffering from API if available
          if (apiBuffering !== undefined) {
            setIsBuffering((prev) => ({ ...prev, [trackId]: apiBuffering }));
          }
          // Update playing state
          if (isPaused !== undefined) {
            if (isPaused) {
              setPlayingTrack((prev) => prev === trackId ? null : prev);
            } else {
              setPlayingTrack(trackId);
            }
          }
        }

        // Handle ready event
        if (data.type === "ready") {
          setIsBuffering((prev) => ({ ...prev, [trackId]: false }));
        }

        // Handle specific state events
        if (data.type === "playback_started") {
          setPlayingTrack(trackId);
          setIsBuffering((prev) => ({ ...prev, [trackId]: false }));
        }
      } catch (err) {
        // Ignore parsing errors
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [activeEmbed, isMobile]);

  // Fallback: simulate progress if no API messages received (legacy behavior)
  useEffect(() => {
    if (!playingTrack) return;

    // CRITICAL: Disable fallback timer if Controller is active for this track
    // The Controller API provides accurate updates, so manual simulation causes jumping/sync issues.
    if (embedControllers.current[playingTrack]) return;

    if (isBuffering[playingTrack]) return;

    const interval = setInterval(() => {
      setTrackPosition((prev) => {
        const currentPos = prev[playingTrack] || 0;
        const duration = trackDuration[playingTrack] || 30;

        if (currentPos >= duration - 1) {
          setPlayingTrack(null);
          return { ...prev, [playingTrack]: 0 };
        }

        return { ...prev, [playingTrack]: currentPos + 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [playingTrack, trackDuration, isBuffering]);

  const changeTimeRange = (range: string) => {
    setShowTimeModal(false);
    router.push(`/dashboard/${spotifyId}?time_range=${range}`);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getAlbumType = (totalTracks: number, albumName: string) => {
    if (totalTracks === 1) return "Single";
    if (totalTracks >= 2 && totalTracks <= 3)
      return `Maxi-Single: ${albumName}`;
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
    if (activeEmbed === trackId) {
      // Closing - fade out and pause, but DON'T destroy controller (prevents removeChild error)
      setShowPlayerControls((prev) => ({ ...prev, [trackId]: false }));

      // Pause using controller if available
      const controller = embedControllers.current[trackId];
      if (controller) {
        try {
          controller.pause();
        } catch (e) {
          // Ignore pause errors
        }
      }

      setTimeout(() => {
        setActiveEmbed(null);
        setPlayingTrack(null);
        setEmbedReady((prev) => ({ ...prev, [trackId]: false }));
      }, 300); // Match animation duration
    } else {
      // If there's already an active embed, close it first
      if (activeEmbed) {
        const prevController = embedControllers.current[activeEmbed];
        if (prevController) {
          try {
            prevController.pause();
          } catch (e) {
            // Ignore pause errors
          }
        }
        setShowPlayerControls((prev) => ({ ...prev, [activeEmbed]: false }));
        setPlayingTrack(null);
        setEmbedReady((prev) => ({ ...prev, [activeEmbed]: false }));
      }

      // Opening - show embed but delay controls
      setActiveEmbed(trackId);
      setPlayingTrack(null);
      setEmbedReady((prev) => ({ ...prev, [trackId]: false }));
      setIsBuffering((prev) => ({ ...prev, [trackId]: true }));

      // Initialize duration from track data (convert ms to seconds)
      // Don't hardcode 30s - use full duration, API will update with actual preview duration
      const track = data?.tracks.find((t) => t.id === trackId);
      if (track && track.duration_ms) {
        const durationSeconds = Math.floor(track.duration_ms / 1000);
        // For mobile, start with 0 (will show as Preview) until API gives actual preview duration
        // For desktop, show full track duration immediately
        setTrackDuration((prev) => ({
          ...prev,
          [trackId]: isMobile ? 0 : durationSeconds,
        }));
      }
      // Reset position
      setTrackPosition((prev) => ({ ...prev, [trackId]: 0 }));

      // Check if we already have a controller for this track
      if (embedControllers.current[trackId]) {
        // Reuse existing controller - just show controls
        setEmbedReady((prev) => ({ ...prev, [trackId]: true }));
        setShowPlayerControls((prev) => ({ ...prev, [trackId]: true }));
        setIsBuffering((prev) => ({ ...prev, [trackId]: false }));
        return;
      }

      // Create controller using Spotify IFrame API
      // Use setTimeout to ensure container is rendered
      setTimeout(() => {
        if (spotifyApiReady && window.SpotifyIframeApi) {
          const container = embedContainerRefs.current[trackId];
          if (container) {
            window.SpotifyIframeApi.createController(
              container,
              {
                uri: `spotify:track:${trackId}`,
                width: 0,
                height: 0,
              },
              (controller) => {
                embedControllers.current[trackId] = controller;

                // Show controls immediately when controller is created
                setEmbedReady((prev) => ({ ...prev, [trackId]: true }));
                setShowPlayerControls((prev) => ({ ...prev, [trackId]: true }));
                setIsBuffering((prev) => ({ ...prev, [trackId]: false }));

                // Listen for playback updates - this is the key for accurate sync!
                controller.addListener('playback_update', (e) => {
                  const { position, duration, isPaused, isBuffering: apiBuffering } = e.data;

                  // Convert ms to seconds
                  const positionSec = Math.floor(position / 1000);
                  const durationSec = Math.floor(duration / 1000);

                  // Update buffering state
                  setIsBuffering((prev) => ({ ...prev, [trackId]: apiBuffering }));

                  // Update duration from API (more accurate)
                  setTrackDuration((prev) => ({ ...prev, [trackId]: durationSec }));

                  // Update position ONLY if not buffering or position is 0 (reset/start)
                  // This prevents timestamp jumping ahead while audio is still loading
                  if (!apiBuffering || positionSec === 0) {
                    setTrackPosition((prev) => ({
                      ...prev,
                      [trackId]: positionSec
                    }));
                  }

                  // Update playing state based on isPaused
                  if (isPaused) {
                    setPlayingTrack((prev) => prev === trackId ? null : prev);
                  } else {
                    setPlayingTrack(trackId);
                  }

                  // Check for track end
                  if (positionSec >= durationSec - 1 && !isPaused) {
                    setPlayingTrack(null);
                    setTrackPosition((prev) => ({ ...prev, [trackId]: 0 }));
                  }
                });

                // Listen for playback started
                controller.addListener('playback_started', () => {
                  setPlayingTrack(trackId);
                  setIsBuffering((prev) => ({ ...prev, [trackId]: false }));
                });
              }
            );
          } else {
            // Container not available, use fallback
            setTimeout(() => {
              setEmbedReady((prev) => ({ ...prev, [trackId]: true }));
              setShowPlayerControls((prev) => ({ ...prev, [trackId]: true }));
              setIsBuffering((prev) => ({ ...prev, [trackId]: false }));
            }, 800);
          }
        } else {
          // API not ready, use fallback
          setTimeout(() => {
            setEmbedReady((prev) => ({ ...prev, [trackId]: true }));
            setTimeout(() => {
              setShowPlayerControls((prev) => ({ ...prev, [trackId]: true }));
              setIsBuffering((prev) => ({ ...prev, [trackId]: false }));
            }, 100);
          }, 800);
        }
      }, 100);
    }
  };

  const closeEmbed = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();

    // Pause using controller if available
    const controller = embedControllers.current[trackId];
    if (controller) {
      try {
        controller.pause();
      } catch (err) {
        // Ignore errors
      }
    } else {
      // Fallback to postMessage
      const iframe = embedRefs.current[trackId];
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({ command: "pause" }, "*");
        } catch (err) {
          // Ignore errors
        }
      }
    }

    // Fade out then close
    setShowPlayerControls((prev) => ({ ...prev, [trackId]: false }));
    setTimeout(() => {
      setActiveEmbed(null);
      setPlayingTrack(null);
      setEmbedReady((prev) => ({ ...prev, [trackId]: false }));
      // Reset position to 0 when closing
      setTrackPosition((prev) => ({ ...prev, [trackId]: 0 }));
    }, 300);
  };

  const togglePlayPause = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();

    const controller = embedControllers.current[trackId];

    if (playingTrack === trackId) {
      // Pause using controller
      if (controller) {
        try {
          controller.pause();
        } catch (e) {
          // Fallback to postMessage
          const iframe = embedRefs.current[trackId];
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ command: "pause" }, "*");
          }
        }
      } else {
        const iframe = embedRefs.current[trackId];
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ command: "pause" }, "*");
        }
      }
      setPlayingTrack(null);
    } else {
      // Play - reset position if at the end
      const currentPos = trackPosition[trackId] || 0;
      const duration = trackDuration[trackId] || 30;

      if (currentPos >= duration - 1) {
        // Reset to start if track has ended
        setTrackPosition((prev) => ({ ...prev, [trackId]: 0 }));
        if (controller) {
          try {
            controller.restart();
          } catch (e) {
            // Ignore errors
          }
        }
      }

      // Set buffering state
      setIsBuffering((prev) => ({ ...prev, [trackId]: true }));

      // Play using controller
      if (controller) {
        try {
          controller.togglePlay();
        } catch (e) {
          // Fallback to postMessage
          const iframe = embedRefs.current[trackId];
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ command: "toggle" }, "*");
          }
        }
      } else {
        const iframe = embedRefs.current[trackId];
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ command: "toggle" }, "*");
        }
      }
      setPlayingTrack(trackId);
    }
  };

  const handleSeek = (trackId: string, value: number[]) => {
    const seekPosition = value[0];

    // Update visual position immediately for responsive UI
    setTrackPosition((prev) => ({ ...prev, [trackId]: seekPosition }));

    // Use IFrame API seek for both desktop and mobile
    // Duration is already capped at 30s for mobile preview
    const controller = embedControllers.current[trackId];
    if (controller) {
      try {
        controller.seek(seekPosition);
      } catch (e) {
        // Ignore seek errors
      }
    }
  };

  const toggleGenre = (idx: number) => {
    setDisabledGenres((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      return newSet;
    });
  };

  const toggleExpandedGenres = (artistId: string) => {
    setExpandedGenres((prev) => ({
      ...prev,
      [artistId]: !prev[artistId],
    }));
  };

  // Calculate genres client-side to respect Top 10 / Top 20 toggle
  const processedGenres = React.useMemo(() => {
    if (!data || !data.artists) return { genres: [], map: {} as Record<string, string[]> };
    const artistsToUser = showTop20 ? data.artists : data.artists.slice(0, 10);

    const counts: Record<string, number> = {};
    const mapping: Record<string, string[]> = {};

    artistsToUser.forEach((artist) => {
      artist.genres.forEach((g) => {
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

    const container = document.createElement("div");
    container.id = "personalify-screenshot";
    // Main Container Styles - Fixed 9:16 - Theme Aware
    const isLight = resolvedTheme === "light";
    const bgColor = isLight ? "#ffffff" : "#121212";
    const textColor = isLight ? "#000000" : "#ffffff";
    const subTextColor = isLight ? "#666666" : "#B3B3B3";
    const cardBg = isLight ? "#f5f5f5" : "#1e1e1e";
    const cardBorder = isLight ? "#e5e5e5" : "#282828";
    const roleColor = isLight ? "#444444" : "#908f8f"; // darker gray for light mode small text

    Object.assign(container.style, {
      width: `${STORY_WIDTH}px`,
      height: `${STORY_HEIGHT}px`,
      background: bgColor,
      color: textColor,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      overflow: "hidden",
      position: "fixed",
      top: "0",
      left: "0",
      zIndex: "-9999",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "80px 40px 60px 40px",
      boxSizing: "border-box",
    });

    // Inject Styles for Recharts Background (Dark Mode Fix + Theme Aware)
    const styleFix = document.createElement("style");
    // For light mode, we want a lighter gray for the radial chart background tracks
    const radialBgColor = isLight ? "#e0e0e0" : "#333333";
    styleFix.innerHTML = `
            /* Force radial bar background to be dark/light depending on theme */
            .recharts-radial-bar-background-sector {
                fill: ${radialBgColor} !important; 
                stroke: ${radialBgColor} !important;
            }
        `;
    container.appendChild(styleFix);

    // --- HEADER ---
    const header = document.createElement("div");
    header.style.textAlign = "center";
    header.style.flexShrink = "0"; // Don't shrink
    header.style.width = "100%";
    header.innerHTML = `
            <h1 style="color: #1DB954; font-size: 2.5rem; font-weight: 800; margin: 0 0 4px 0;">Personalify</h1>
            <p style="color: ${subTextColor}; font-size: 1.1rem; margin: 0 0 12px 0;">
                ${TIME_RANGE_SUBTITLES[timeRange]}, ${data.user}!
            </p>
            <p style="color: ${subTextColor}; font-size: 0.9rem; margin: 0; font-style: italic; line-height: 1.5; max-width: 600px; margin: 0 auto;">
                ${emotionText.replace(/<[^>]*>/g, "")}
            </p>
        `;
    container.appendChild(header);

    // GAP (Consistent Spacing)
    const gap = document.createElement("div");
    gap.style.height = "20px";
    gap.style.flexShrink = "0";
    container.appendChild(gap);

    // --- MIDDLE SECTION (CARD) ---
    // Wrapper fills available vertical space
    const cardWrapper = document.createElement("div");
    Object.assign(cardWrapper.style, {
      flex: "1",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center", // Center vertically
      width: "100%",
      position: "relative",
      minHeight: "0", // Important for flex child to shrink/overflow properly
    });

    const section = document.createElement("div");
    Object.assign(section.style, {
      background: cardBg,
      borderRadius: "16px",
      padding: "1.5rem",
      border: `1px solid ${cardBorder}`,
      width: "100%",
      boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
      boxSizing: "border-box",
      // We initiate with no scale, we'll calculate it later
      transformOrigin: "center center",
    });

    const sectionTitle = document.createElement("h2");
    sectionTitle.textContent = `Top ${category.charAt(0).toUpperCase() + category.slice(1)
      }`;
    Object.assign(sectionTitle.style, {
      color: "#1DB954",
      fontSize: "1.25rem",
      fontWeight: "700",
      textAlign: "center",
      borderBottom: isLight ? "1px solid #e0e0e0" : "1px solid #333",
      paddingBottom: "1rem",
      marginTop: "-0.5rem",
      marginBottom: "0.5rem",
    });
    section.appendChild(sectionTitle);

    // -- CLONE CHART IF GENRES --
    if (category === "genres") {
      const chartContainer = document.getElementById("genre-chart-container");
      if (chartContainer) {
        // Clone the SVG inside
        const svg = chartContainer.querySelector("svg");
        if (svg) {
          const clonedSvg = svg.cloneNode(true) as SVGElement;
          const chartWrapper = document.createElement("div");
          // Style fitting for the image
          Object.assign(chartWrapper.style, {
            display: "flex",
            justifyContent: "center",
            marginBottom: "1rem",
            marginTop: "0.5rem",
            height: "220px",
          });

          clonedSvg.setAttribute("width", "220");
          clonedSvg.setAttribute("height", "220");
          clonedSvg.style.width = "220px";
          clonedSvg.style.height = "220px";
          clonedSvg.style.overflow = "visible";

          chartWrapper.appendChild(clonedSvg);
          section.appendChild(chartWrapper);
        }
      }
    }

    // List
    const list = document.createElement("ol");
    list.style.listStyle = "none";
    list.style.padding = "0";
    list.style.margin = "0";

    const items =
      category === "artists"
        ? data.artists
        : category === "tracks"
          ? data.tracks
          : processedGenres.genres;
    const itemsToRender = items.slice(0, 10);

    itemsToRender.forEach((item, idx) => {
      const li = document.createElement("li");
      Object.assign(li.style, {
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "0.75rem 0",
        borderBottom:
          idx < itemsToRender.length - 1
            ? isLight
              ? "1px solid #e0e0e0"
              : "1px solid #333"
            : "none",
        height: "auto",
        minHeight: "0",
      });

      const rank = document.createElement("span");
      rank.textContent = String(idx + 1);
      Object.assign(rank.style, {
        fontSize: "1.2rem",
        fontWeight: "700",
        color: isLight ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.5)",
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
          width: "60px",
          height: "60px",
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
                    <p style="font-weight: 600; font-size: 0.85rem; color: ${textColor}; margin: 0 0 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${artist.name
          }</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px;">
                        ${artist.genres
            .slice(0, 4)
            .map((g) => {
              const color = getGenreColor(g);
              return `<span style="background: ${isLight
                ? "rgba(0,0,0,0.05)"
                : "rgba(255,255,255,0.1)"
                }; border: 1px solid ${color}; border-radius: 9999px; padding: 2px 8px; font-size: 0.6rem; color: ${textColor};">${g}</span>`;
            })
            .join("")}
                    </div>
                    <p style="font-size: 0.68rem; color: ${roleColor}; margin: 0;">Popularity: ${artist.popularity
          }</p>
                `;
      } else if (category === "tracks") {
        const track = item as Track;
        info.innerHTML = `
                    <p style="font-weight: 600; font-size: 0.85rem; color: ${textColor}; margin: 0 0 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.name
          }</p>
                    <p style="font-size: 0.68rem; color: ${roleColor}; margin: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.artists.join(
            ", "
          )}</p>
                    <p style="font-size: 0.68rem; color: ${roleColor}; margin: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${getAlbumType(
            track.album.total_tracks,
            track.album.name
          )}</p>
                    <p style="font-size: 0.68rem; color: ${roleColor}; margin: 2px 0;">Popularity: ${track.popularity
          }</p>
                `;
      } else {
        const genre = item as Genre;
        const artistsList = processedGenres.map[genre.name] || [];
        info.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 10px; height: 10px; border-radius: 50%; background: ${GENRE_COLORS[idx]
          };"></span>
                        <span style="font-weight: 600; font-size: 0.85rem; color: ${textColor};">${genre.name
          }</span>
                    </div>
                    <p style="font-size: 0.6rem; color: ${roleColor}; margin: 4px 0 0 0; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; line-height: 1.3;">Mentioned ${genre.count
          } times${artistsList.length > 0 ? `: ${artistsList.join(", ")}` : ""
          }</p>
                `;
      }
      li.appendChild(info);
      list.appendChild(li);
    });

    section.appendChild(list);
    cardWrapper.appendChild(section);
    container.appendChild(cardWrapper);

    // --- FOOTER ---
    const footer = document.createElement("div");
    const currentYear = new Date().getFullYear();
    footer.innerHTML = `Personalify © ${currentYear} • Powered by Spotify API`;
    Object.assign(footer.style, {
      textAlign: "center",
      fontSize: "0.75rem",
      color: "#888",
      flexShrink: "0",
      width: "100%",
      marginTop: "1rem",
    });
    container.appendChild(footer);

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

      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 1000));

      const availableHeight = cardWrapper.clientHeight;
      const actualCardHeight = section.scrollHeight;

      if (actualCardHeight > availableHeight) {
        const scale = (availableHeight - 20) / actualCardHeight;
        const finalScale = Math.min(1, scale);
        section.style.transform = `scale(${finalScale})`;
      }

      const dataUrl = await htmlToImage.toPng(container, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: bgColor,
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

  // Chart data for Recharts
  const chartData = React.useMemo(() => {
    if (!processedGenres?.genres?.length) return [];

    return processedGenres.genres.map((genre, index) => ({
      name: genre.name,
      count: disabledGenres.has(index) ? 0 : genre.count, // Set count to 0 if disabled
      fill: disabledGenres.has(index)
        ? "transparent"
        : GENRE_COLORS[index % GENRE_COLORS.length], // Transparent if disabled
    }));
  }, [processedGenres, disabledGenres]);

  if (loading) {
    return (
      // Loading State - Inline with Layout (not covering navbar)
      // Use page-container to respect navbar height
      <div className="page-container flex-1 flex flex-col items-center justify-center min-h-[calc(100dvh-160px)] w-full">
        <svg className="w-8 h-8 mb-4 spinner-svg" viewBox="0 0 50 50">
          <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" />
        </svg>
        <span className="font-semibold text-foreground">
          Loading Dashboard{animatedDots}
        </span>
      </div>
    );
  }

  if (!data) {
    return (
      // Error State - Inline with Layout
      <div className="page-container flex-1 flex flex-col items-center justify-center min-h-[calc(100dvh-160px)] w-full">
        <div className="text-center space-y-6">
          <p className="text-lg font-medium text-muted-foreground">
            Session expired or no data available!
          </p>
          <motion.button
            onClick={() => router.push("/?error=session_expired")}
            onMouseMove={handleMouseMoveOrTouch}
            onTouchMove={handleMouseMoveOrTouch}
            className="btn-glass rounded-2xl"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            Back to Home
          </motion.button>
        </div>
      </div>
    );
  }

  // Helper functions for time formatting
  const formatTimeHelper = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? "0" + sec : sec}`;
  };

  const formatDurationHelper = (seconds: number) => {
    // If duration is 0, show Preview (useful for mobile initial state)
    if (!seconds) return "Preview";
    return formatTimeHelper(seconds);
  };

  return (
    <div className="page-container w-full max-w-none">
      {/* Saving Overlay */}
      <AnimatePresence>
        {isSaving && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{
              backgroundColor:
                resolvedTheme === "light" ? "#ffffff" : "#121212",
            }}
          >
            <svg className="w-8 h-8 mb-4 spinner-svg" viewBox="0 0 50 50">
              <circle
                className="spinner-path"
                cx="25"
                cy="25"
                r="20"
                fill="none"
                stroke={resolvedTheme === "light" ? "#000" : "#fff"}
              />
            </svg>
            <span
              className={`font-semibold ${resolvedTheme === "light" ? "text-black" : "text-white"
                }`}
            >
              Processing Image...
            </span>
            <span className="text-muted-foreground text-sm mt-2">
              Please wait!
            </span>
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
        <h1 className="text-[2.5rem] font-extrabold text-[#1DB954] mt-2.5 mb-3 leading-tight">
          Personalify
        </h1>
        <p className="text-lg mb-3 text-[#B3B3B3] font-medium">
          {TIME_RANGE_SUBTITLES[timeRange]},{" "}
          <span className="font-bold">{data.user}</span>!
        </p>
        <p className="emotion-recap mt-4">
          {isAnalyzing ? (
            <span className="animate-pulse text-neutral-500 dark:text-[#B3B3B3]">
              {emotionText.replace(/\.\.\.$/, "")}{animatedDots}
            </span>
          ) : (
            <span dangerouslySetInnerHTML={{ __html: typedHtml }} />
          )}
        </p>
      </motion.header>

      {/* Filters */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        <button
          onClick={() => setShowTimeModal(true)}
          className="filter-btn glow-card"
          onMouseMove={handleMouseMoveOrTouch}
          onTouchMove={handleMouseMoveOrTouch}
        >
          <span>{TIME_RANGE_LABELS[timeRange]}</span>
          <span className="text-muted-foreground text-sm ml-2">▼</span>
        </button>

        {isMobile && (
          <button
            onClick={() => setShowCategoryModal(true)}
            className="filter-btn glow-card"
            onMouseMove={handleMouseMoveOrTouch}
            onTouchMove={handleMouseMoveOrTouch}
          >
            <span>
              {currentCategory === "artists"
                ? "Top Artists"
                : currentCategory === "tracks"
                  ? "Top Tracks"
                  : "Top Genres"}
            </span>
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
                  <button
                    key={range}
                    onClick={() => changeTimeRange(range)}
                    className="btn-glass"
                    onMouseMove={handleMouseMoveOrTouch}
                    onTouchMove={handleMouseMoveOrTouch}
                  >
                    {TIME_RANGE_LABELS[range]}
                  </button>
                ))}
                <button
                  onClick={() => setShowTimeModal(false)}
                  onMouseMove={handleMouseMoveOrTouch}
                  onTouchMove={handleMouseMoveOrTouch}
                  className="btn-glass-red rounded-xl py-2.5 flex items-center justify-center gap-2 text-red-500 font-bold text-sm cursor-pointer mt-2"
                >
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
                  <button
                    key={cat}
                    onClick={() => {
                      setCurrentCategory(cat);
                      setShowCategoryModal(false);
                    }}
                    className="btn-glass"
                    onMouseMove={handleMouseMoveOrTouch}
                    onTouchMove={handleMouseMoveOrTouch}
                  >
                    Top {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
                <button
                  onClick={() => setShowCategoryModal(false)}
                  onMouseMove={handleMouseMoveOrTouch}
                  onTouchMove={handleMouseMoveOrTouch}
                  className="btn-glass-red rounded-xl py-2.5 flex items-center justify-center gap-2 text-red-500 font-bold text-sm cursor-pointer mt-2"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dashboard Container */}
      <div
        className={`grid gap-6 ${isMobile
          ? "grid-cols-1"
          : "grid-cols-[repeat(auto-fit,minmax(300px,1fr))]"
          }`}
      >
        {/* Top Artists Section */}
        {(!isMobile || currentCategory === "artists") && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0 }}
            className="section-card hover:-translate-y-1"
          >
            <h2>Top Artists</h2>
            <ol className="list-none p-0 m-0">
              {data.artists.slice(0, showTop20 ? 20 : 10).map((artist, idx) => (
                <motion.li
                  key={artist.id}
                  initial={idx >= 10 ? { opacity: 0, y: 20 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx >= 10 ? (idx - 10) * 0.1 : 0 }}
                  className="list-item hover:bg-accent/50 transition-colors"
                >
                  <span className="rank">{idx + 1}</span>
                  <img
                    src={artist.image}
                    alt={artist.name}
                    className="cursor-pointer rounded-lg"
                    onClick={() => openArtistProfile(artist.id)}
                  />
                  <div className="info">
                    <p
                      className="name cursor-pointer"
                      onClick={() => openArtistProfile(artist.id)}
                    >
                      {artist.name}
                    </p>
                    <div className="genre-pills">
                      {(expandedGenres[artist.id]
                        ? artist.genres
                        : artist.genres.slice(0, 6)
                      ).map((genre) => (
                        <span
                          key={genre}
                          className="genre-pill"
                          style={{ borderColor: getGenreColor(genre) }}
                        >
                          {genre}
                        </span>
                      ))}
                      {artist.genres.length > 6 && (
                        <span
                          className="genre-pill cursor-pointer hover:bg-white/20 transition-colors"
                          style={{
                            borderStyle: "dashed",
                            borderColor: "rgba(255,255,255,0.3)",
                            color: "rgba(255,255,255,0.7)"
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpandedGenres(artist.id);
                          }}
                        >
                          {expandedGenres[artist.id]
                            ? "show less"
                            : `+${artist.genres.length - 6}`}
                        </span>
                      )}
                    </div>
                    <p className="meta">Popularity: {artist.popularity}</p>
                  </div>
                </motion.li>
              ))}
            </ol>
          </motion.section>
        )}

        {/* Top Tracks Section */}
        {(!isMobile || currentCategory === "tracks") && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="section-card hover:-translate-y-1"
          >
            <h2>Top Tracks</h2>
            <ol className="list-none p-0 m-0">
              {data.tracks.slice(0, showTop20 ? 20 : 10).map((track, idx) => (
                <motion.li
                  key={track.id}
                  initial={idx >= 10 ? { opacity: 0, y: 20 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx >= 10 ? (idx - 10) * 0.1 : 0 }}
                  className={`list-item track-item cursor-pointer hover:bg-accent/50 transition-colors border-b border-border ${activeEmbed === track.id ? "embed-shown" : ""
                    }`}
                  onClick={() => toggleEmbed(track.id)}
                >
                  {/* Rank / Close Button */}
                  <span
                    className={`rank flex items-center justify-center ${activeEmbed === track.id ? "embed-active" : ""
                      }`}
                    onClick={
                      activeEmbed === track.id
                        ? (e) => closeEmbed(e, track.id)
                        : undefined
                    }
                  >
                    {activeEmbed === track.id ? (
                      // macOS-style red close button
                      <div className="w-3.5 h-3.5 rounded-full bg-[#FF5F57] hover:bg-[#FF3B30] flex items-center justify-center transition-colors cursor-pointer group">
                        <svg
                          viewBox="0 0 12 12"
                          className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          fill="none"
                          stroke="#4D0000"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        >
                          <path d="M3 3l6 6M9 3l-6 6" />
                        </svg>
                      </div>
                    ) : (
                      idx + 1
                    )}
                  </span>

                  {/* Album Art - Always visible */}
                  <img
                    src={track.image}
                    alt={track.name}
                    className="w-12 h-12 md:w-16 md:h-16 rounded-lg object-cover shrink-0"
                  />

                  {/* Info Area */}
                  <div className="info min-w-0 flex-1 overflow-hidden">
                    {/* Track Name - Always visible */}
                    <MarqueeText
                      text={track.name}
                      className={`name font-semibold text-sm md:text-base mb-1 ${activeEmbed === track.id
                        ? "text-[#1DB954]"
                        : "text-foreground"
                        }`}
                    />
                    {/* Artist - Always visible */}
                    <MarqueeText
                      text={track.artists.join(", ")}
                      className="meta text-muted-foreground text-xs md:text-sm"
                    />

                    {/* Conditional: Metadata OR Player Controls */}
                    {activeEmbed !== track.id ? (
                      <>
                        {/* Album Type */}
                        <MarqueeText
                          text={getAlbumType(
                            track.album.total_tracks,
                            track.album.name
                          )}
                          className="meta text-muted-foreground text-xs md:text-sm"
                        />
                        {/* Popularity */}
                        <MarqueeText
                          text={`Popularity: ${track.popularity}`}
                          className="meta text-muted-foreground text-xs md:text-sm"
                        />
                      </>
                    ) : (
                      /* Compact Player Controls with fade animation */
                      <AnimatePresence mode="wait">
                        {!showPlayerControls[track.id] ? (
                          <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="flex items-center gap-2 text-muted-foreground mt-1.5"
                          >
                            <span className="text-xs">Loading player...</span>
                            <svg
                              className="w-4 h-4 animate-spin"
                              viewBox="0 0 50 50"
                            >
                              <circle
                                className="opacity-25"
                                cx="25"
                                cy="25"
                                r="20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M25 5 A20 20 0 0 1 45 25"
                              />
                            </svg>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="controls"
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.3 }}
                            className="player-row flex items-center gap-2 mt-1 pr-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Timestamp left */}
                            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                              {formatTimeHelper(trackPosition[track.id] || 0)}
                            </span>

                            {/* Progress bar with Slider - Seekable on both desktop and mobile */}
                            <div className="flex-1 -my-2">
                              <Slider
                                value={[trackPosition[track.id] || 0]}
                                max={trackDuration[track.id] || 30}
                                step={1}
                                onValueChange={(value) => handleSeek(track.id, value)}
                                className="cursor-pointer hover:opacity-100 opacity-80 [&>span:first-child]:h-1 [&>span:first-child]:bg-black/10 dark:[&>span:first-child]:bg-white/20 **:[[role=slider]]:h-2.5 **:[[role=slider]]:w-2.5 **:[[role=slider]]:border-black dark:**:[[role=slider]]:border-white **:[[role=slider]]:bg-black dark:**:[[role=slider]]:bg-white [&>span>span]:bg-black dark:[&>span>span]:bg-white"
                              />
                            </div>

                            {/* Timestamp right */}
                            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                              {formatDurationHelper(trackDuration[track.id] || 0)}
                            </span>

                            {/* Play/Pause Button */}
                            <button
                              className="ml-1 focus:outline-none focus:scale-95 hover:scale-105 active:scale-90 transition-transform cursor-pointer rounded-full"
                              onClick={(e) => togglePlayPause(e, track.id)}
                              aria-label={
                                playingTrack === track.id ? "Pause" : "Play"
                              }
                            >
                              {playingTrack === track.id ? (
                                <CirclePause
                                  size={20} // w-5 h-5 (match original container)
                                  className="text-black dark:text-white fill-black/10 dark:fill-white/10 opacity-90 hover:opacity-100 transition-opacity"
                                  strokeWidth={1.5}
                                />
                              ) : (
                                <CirclePlay
                                  size={20}
                                  className="text-black dark:text-white fill-black/10 dark:fill-white/10 opacity-90 hover:opacity-100 transition-opacity"
                                  strokeWidth={1.5}
                                />
                              )}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </div>

                  {/* Persistent Container for Spotify IFrame API Controller - ALWAYS RENDERED */}
                  {/* This container is NEVER unmounted to prevent removeChild error */}
                  <div
                    ref={(el) => {
                      embedContainerRefs.current[track.id] = el;
                    }}
                    style={{
                      position: "absolute",
                      width: 0,
                      height: 0,
                      opacity: 0,
                      pointerEvents: "none",
                      overflow: "hidden",
                    }}
                  />

                  {/* Fallback hidden iframe when Spotify IFrame API is not ready */}
                  {activeEmbed === track.id && !spotifyApiReady && (
                    <iframe
                      ref={(el) => {
                        embedRefs.current[track.id] = el;
                      }}
                      src={`https://open.spotify.com/embed/track/${track.id}?utm_source=generator&theme=0`}
                      width="0"
                      height="0"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      style={{
                        position: "absolute",
                        opacity: 0,
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </motion.li>
              ))}
            </ol>
          </motion.section>
        )}

        {/* Top Genres Section */}
        {(!isMobile || currentCategory === "genres") && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="section-card overflow-visible hover:-translate-y-1"
          >
            <h2>Top Genres</h2>

            {chartData.length > 0 && (
              <div id="genre-chart-container" className="mt-2 mb-0">
                <GenreChart data={chartData} />
              </div>
            )}

            <ol className="list-none p-0 m-0">
              {processedGenres.genres.map((genre, idx) => (
                <motion.li
                  key={genre.name}
                  initial={idx >= 10 ? { opacity: 0, y: 20 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx >= 10 ? (idx - 10) * 0.1 : 0 }}
                  className={`py-3 border-b border-border last:border-b-0 cursor-pointer hover:bg-accent/50 transition-all ${disabledGenres.has(idx) ? "opacity-40 line-through" : ""
                    }`}
                  onMouseEnter={() => setHoveredGenre(idx)}
                  onMouseLeave={() => setHoveredGenre(null)}
                  onClick={() => toggleGenre(idx)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground/50 w-6 text-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: disabledGenres.has(idx)
                              ? "#555"
                              : GENRE_COLORS[idx % GENRE_COLORS.length],
                          }}
                        />
                        <span className="font-semibold text-sm text-foreground">
                          {genre.name}
                        </span>
                      </div>
                      <p className="text-[0.68rem] font-medium mt-0.5 text-(--text-muted) leading-relaxed">
                        Mentioned {genre.count} times
                        {processedGenres.map[genre.name] && (
                          <>: {processedGenres.map[genre.name].join(", ")}</>
                        )}
                      </p>
                    </div>
                  </div>
                </motion.li>
              ))}
            </ol>
          </motion.section>
        )}
      </div>

      {/* Save as Image Button */}
      <button
        onClick={() =>
          isMobile ? generateImage(currentCategory) : setShowSaveModal(true)
        }
        onMouseMove={handleMouseMoveOrTouch}
        onTouchMove={handleMouseMoveOrTouch}
        className={`download-btn glow-card fixed bottom-6 right-8 z-40 px-6 py-3 rounded-2xl font-bold
                    bg-white/5 dark:bg-[#ffffff05] backdrop-blur-md border border-white/10 shadow-lg text-sm
                    ${hideSaveBtn ? "hide-on-scroll" : "show-floating-btn"}
                `}
      >
        <span className="relative -top-px">Save as Image</span>
      </button>

      {/* Save Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className="modal-overlay"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-6">
                Choose Category to Save
              </h3>
              <div className="flex flex-col gap-4">
                {(["artists", "tracks", "genres"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => generateImage(cat)}
                    className="btn-glass"
                    onMouseMove={handleMouseMoveOrTouch}
                    onTouchMove={handleMouseMoveOrTouch}
                  >
                    Top {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
                <button
                  onClick={() => setShowSaveModal(false)}
                  onMouseMove={handleMouseMoveOrTouch}
                  onTouchMove={handleMouseMoveOrTouch}
                  className="btn-glass-red rounded-xl py-2.5 flex items-center justify-center gap-2 text-red-500 font-bold text-sm cursor-pointer mt-2"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Styles */}
      <style jsx global>
        {`
          .track-item.embed-shown .rank.embed-active {
            color: #1db954 !important;
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
        `}
      </style>
    </div >
  );
}
