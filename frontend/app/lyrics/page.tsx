"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function LyricsPage() {
    const router = useRouter();
    const [lyrics, setLyrics] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ emotions: { label: string; score: number }[] } | null>(null);

    const dispatchError = (message: string) => {
        window.dispatchEvent(new CustomEvent("personalify-notification", {
            detail: { type: "error", message }
        }));
        setTimeout(() => window.dispatchEvent(new CustomEvent("personalify-notification", { detail: null })), 4000);
    };

    const subtitleRef = useRef<HTMLParagraphElement>(null);
    const hasTyped = useRef(false);

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

        const text = 'Uncover the emotions or <a href="/lyrics/genius" class="text-[#888] hover:text-[#1DB954] transition-colors">search use Genius</a>';
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

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lyrics.trim()) {
            dispatchError("Please paste some lyrics first!");
            setResult(null);
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            const res = await fetch("/analyze-lyrics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lyrics }),
            });

            if (!res.ok) throw new Error(`Server error: ${res.statusText}`);

            const data = await res.json();
            if (data.error) {
                dispatchError(data.error);
            } else {
                setResult(data);
            }
        } catch (err) {
            dispatchError("Failed to contact the analysis server.");
        } finally {
            setIsLoading(false);
        }
    };

    const isEmpty = !result && !isLoading;

    return (
        <div className="page-container flex flex-col w-full max-w-3xl mx-auto flex-1">
            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mt-2 mb-4 flex-none px-4"
            >
                <h1 className="text-[2.5rem] font-extrabold text-[#1DB954] mb-2">
                    Lyrics Analyzer
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
                    <form onSubmit={handleAnalyze} className="flex flex-col gap-6">
                        <textarea
                            value={lyrics}
                            onChange={(e) => setLyrics(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 768) {
                                    e.preventDefault();
                                    handleAnalyze(e as any);
                                }
                            }}
                            placeholder="Write or paste your lyrics here..."
                            className="w-full min-h-[250px] max-md:min-h-[180px] p-5 max-md:p-3 rounded-xl border border-neutral-200 dark:border-[#282828] bg-white dark:bg-[#181818] text-neutral-900 dark:text-[#cccccc] placeholder:text-neutral-500 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/20 transition-all custom-scrollbar resize-y leading-[1.6rem] font-light tracking-wide text-[0.95rem]"
                        />

                        <button
                            type="submit"
                            onMouseMove={handleMouseMoveOrTouch}
                            onTouchMove={handleMouseMoveOrTouch}
                            disabled={isLoading}
                            className={`btn-glass w-full group ${isLoading ? "pointer-events-none" : ""}`}
                        >
                            <span className={`relative -top-px transition-opacity duration-200 ${isLoading ? "opacity-0" : "opacity-100"}`}>
                                Analyze Emotions
                            </span>
                            <svg
                                className={`absolute top-1/2 left-1/2 -ml-3 -mt-3 w-6 h-6 transition-opacity duration-200 spinner-svg ${isLoading ? "opacity-100" : "opacity-0"}`}
                                style={{ position: 'absolute' }}
                                viewBox="0 0 50 50"
                            >
                                <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" />
                            </svg>
                        </button>
                    </form>

                    {/* Results */}
                    {(result || isLoading) && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-6"
                        >




                            {result && result.emotions && (
                                <div className="flex flex-col gap-4">
                                    {result.emotions.length === 0 ? (
                                        <p className="text-center text-neutral-400">Could not find significant emotions.</p>
                                    ) : (
                                        result.emotions
                                            .filter((e) => e.score > 0.05)
                                            .slice(0, 10)
                                            .map((e, idx) => {
                                                const maxScore = Math.max(...result.emotions.map((em) => em.score));
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
                                            })
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
