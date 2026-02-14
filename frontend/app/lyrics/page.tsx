"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { staggerContainer, fadeUp, scalePop, cardReveal, staggerContainerFast, listItem } from "@/lib/animations";

export default function LyricsPage() {
    const router = useRouter();
    const [lyrics, setLyrics] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ emotions: { label: string; score: number }[]; mbti?: { label: string; score: number }[] } | null>(null);

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

        const text = 'Uncover the essence or <a href="/lyrics/genius" class="text-[#888] hover:text-[#1DB954] transition-colors">search use Genius</a>';
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
        <motion.div
            className="page-container flex flex-col w-full max-w-3xl mx-auto flex-1"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
        >
            {/* Header */}
            <motion.header
                variants={fadeUp}
                className="text-center mt-1 mb-4 flex-none px-4"
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
                    variants={cardReveal}
                    className="w-full glass-card rounded-2xl p-5 md:p-6"
                    whileHover={{ y: -4, transition: { type: "spring", stiffness: 400, damping: 17 } }}
                >
                    <form onSubmit={handleAnalyze} className="flex flex-col gap-4 md:gap-5">
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
                            className="w-full min-h-[182px] md:min-h-[256px] py-1.5 px-4 md:py-2 md:px-4 rounded-xl border border-neutral-200 dark:border-[#282828] bg-white dark:bg-[#181818] text-neutral-900 dark:text-[#cccccc] placeholder:text-neutral-500 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/20 transition-all custom-scrollbar resize-none leading-6 font-light tracking-wide text-[0.95rem]"
                        />

                        <button
                            type="submit"
                            onMouseMove={handleMouseMoveOrTouch}
                            onTouchMove={handleMouseMoveOrTouch}
                            disabled={isLoading}
                            className={`btn-glass w-full group ${isLoading ? "pointer-events-none" : ""}`}
                        >
                            <span className={`relative -top-px transition-opacity duration-200 ${isLoading ? "opacity-0" : "opacity-100"}`}>
                                Analyze Essence
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
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 24 }}
                            className="mt-5"
                        >
                            {result && result.emotions && (
                                <motion.div
                                    className="flex flex-col gap-2"
                                    variants={staggerContainerFast}
                                    initial="hidden"
                                    animate="show"
                                >
                                    {result.emotions.length === 0 ? (
                                        <p className="text-center text-neutral-400">Could not find significant emotions.</p>
                                    ) : (
                                        result.emotions
                                            .slice(0, 5) // Ensure we show top 5 explicitly (though backend usually handles this)
                                            .map((e, idx) => {
                                                const maxScore = Math.max(...result.emotions.map((em) => em.score));
                                                const percent = (e.score * 100).toFixed(1);
                                                const widthPercent = ((e.score / maxScore) * 100).toFixed(1);

                                                return (
                                                    <motion.div
                                                        key={idx}
                                                        className="flex items-center gap-2 w-full"
                                                        variants={listItem}
                                                    >
                                                        <span className="font-bold text-neutral-800 dark:text-white capitalize text-sm whitespace-nowrap min-w-fit">
                                                            {e.label}
                                                        </span>
                                                        <div className="emotion-bar-bg flex-1">
                                                            <motion.div
                                                                className="emotion-bar"
                                                                initial={{ scaleX: 0 }}
                                                                animate={{ scaleX: 1 }}
                                                                transition={{ type: "spring", stiffness: 100, damping: 15, delay: idx * 0.05 }}
                                                                style={{ width: `${widthPercent}%`, transformOrigin: 'left' }}
                                                            />
                                                        </div>
                                                        <span className="min-w-fit text-right text-neutral-500 dark:text-[#b3b3b3] text-sm font-medium whitespace-nowrap">
                                                            {percent}%
                                                        </span>
                                                    </motion.div>
                                                );
                                            })
                                    )}
                                </motion.div>
                            )}

                            {/* MBTI Personality Sentence */}
                            {(() => {
                                const MBTI_CONNECTORS: Record<string, string> = {
                                    INTJ: "the precision of an", INTP: "the curiosity of an",
                                    ENTJ: "the drive of an", ENTP: "the chaos of an",
                                    INFJ: "the depth of an", INFP: "the longing of an",
                                    ENFJ: "the warmth of an", ENFP: "the wonder of an",
                                    ISTJ: "the steadiness of an", ISFJ: "the care of an",
                                    ESTJ: "the structure of an", ESFJ: "the heart of an",
                                    ISTP: "the craft of an", ISFP: "the art of an",
                                    ESTP: "the fire of an", ESFP: "the pulse of an",
                                };
                                const mbti = result?.mbti;
                                if (!mbti || mbti.length === 0) return null;
                                const label = mbti[0].label;
                                const connector = MBTI_CONNECTORS[label] || "the soul of an";
                                return (
                                    <motion.p
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.3 }}
                                        className="text-center text-sm text-neutral-500 dark:text-[#888] mt-2.75 md:mt-2 mb-0.5 md:-mb-2 font-medium"
                                    >
                                        These lyrics hold {connector}{" "}
                                        <span className="text-[#1DB954] font-bold">{label}</span>
                                        {" "}({(mbti[0].score * 100).toFixed(1)}%)
                                    </motion.p>
                                );
                            })()}
                        </motion.div>
                    )}
                </motion.div>
            </div>
        </motion.div>
    );
}
