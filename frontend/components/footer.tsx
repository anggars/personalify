"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const TECH_STACKS = [
    { phrase: "Built with", name: "Next.js (TypeScript)", url: "https://nextjs.org/", color: "hover:text-black dark:hover:text-white active:text-black dark:active:text-white" },
    { phrase: "Backed by", name: "Python (FastAPI)", url: "https://fastapi.tiangolo.com/", color: "hover:text-[#009688] active:text-[#009688]" },
    { phrase: "Containerized by", name: "Docker", url: "https://www.docker.com/", color: "hover:text-[#2496ED] active:text-[#2496ED]" },
    { phrase: "Deployed on", name: "Vercel", url: "https://vercel.com/", color: "hover:text-white active:text-white" },
    { phrase: "Main Database by", name: "Neon", url: "https://neon.tech/", color: "hover:text-[#00E599] active:text-[#00E599]" },
    { phrase: "History stored in", name: "MongoDB", url: "https://www.mongodb.com/atlas", color: "hover:text-[#4DB33D] active:text-[#4DB33D]" },
    { phrase: "Cached by", name: "Upstash", url: "https://upstash.com/", color: "hover:text-[#DC382D] active:text-[#DC382D]" },
];

const DASHBOARD_STACKS = [
    { phrase: "Powered by", name: "Spotify API", url: "https://developer.spotify.com/", color: "hover:text-[#1DB954] active:text-[#1DB954]" },
    { phrase: "Powered by", name: "Hugging Face", url: "https://huggingface.co/", color: "hover:text-[#FFD21E] active:text-[#FFD21E]" },
];

const GENIUS_STACKS = [
    { phrase: "Powered by", name: "Genius API", url: "https://docs.genius.com/", color: "hover:text-[#ffff64] active:text-[#ffff64]" },
    { phrase: "Powered by", name: "Hugging Face", url: "https://huggingface.co/", color: "hover:text-[#FFD21E] active:text-[#FFD21E]" },
];

export function Footer() {
    const pathname = usePathname();
    const [displayText, setDisplayText] = useState({ phrase: "", name: "" });
    const [loopIndex, setLoopIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [typingSpeed, setTypingSpeed] = useState(80);

    // Determine which stack to use based on pathname
    const activeStacks = React.useMemo(() => {
        if (pathname === "/about") return TECH_STACKS;
        if (pathname?.startsWith("/dashboard")) return DASHBOARD_STACKS;
        if (pathname === "/lyrics/genius") return GENIUS_STACKS;
        return null;
    }, [pathname]);

    // Typewriter effect logic
    useEffect(() => {
        if (!activeStacks) return;

        const currentStack = activeStacks[loopIndex % activeStacks.length];
        const fullPhrase = currentStack.phrase;
        const fullName = currentStack.name;

        const handleTyping = () => {
            setDisplayText((prev) => {
                if (isDeleting) {
                    if (prev.name.length > 0) {
                        return { ...prev, name: fullName.substring(0, prev.name.length - 1) };
                    } else if (prev.phrase.length > 0) {
                        return { ...prev, phrase: fullPhrase.substring(0, prev.phrase.length - 1) };
                    }
                    return prev;
                } else {
                    if (prev.phrase.length < fullPhrase.length) {
                        return { ...prev, phrase: fullPhrase.substring(0, prev.phrase.length + 1) };
                    } else if (prev.name.length < fullName.length) {
                        return { ...prev, name: fullName.substring(0, prev.name.length + 1) };
                    }
                    return prev;
                }
            });

            if (!isDeleting && displayText.phrase === fullPhrase && displayText.name === fullName) {
                setTypingSpeed(2000);
                setIsDeleting(true);
            } else if (isDeleting && displayText.phrase === "" && displayText.name === "") {
                setIsDeleting(false);
                setLoopIndex((prev) => prev + 1);
                setTypingSpeed(500);
            } else {
                setTypingSpeed(isDeleting ? 40 : 80);
            }
        };

        const timer = setTimeout(handleTyping, typingSpeed);
        return () => clearTimeout(timer);
    }, [displayText, isDeleting, loopIndex, activeStacks, typingSpeed]);

    // Reset loop index if path changes (optional but good for consistency)
    useEffect(() => {
        setLoopIndex(0);
        setDisplayText({ phrase: "", name: "" });
        setIsDeleting(false);
    }, [pathname]);

    const renderPoweredBy = () => {
        if (activeStacks) {
            const currentStack = activeStacks[loopIndex % activeStacks.length];
            return (
                <span>
                    <span>{displayText.phrase}</span>{" "}
                    <a
                        href={currentStack.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`transition-colors duration-300 ${isDeleting && displayText.name === currentStack.name
                            ? currentStack.color
                            : "text-neutral-500"
                            }`}
                    >
                        {displayText.name}
                    </a>
                </span>
            );
        }

        // Default for other pages
        return (
            <span>
                Powered by{" "}
                <a
                    href="https://developer.spotify.com/"
                    target="_blank"
                    className="md:hover:text-[#1DB954] active:text-[#1DB954] transition-colors"
                >
                    Spotify API
                </a>
            </span>
        );
    };

    const isDashboard = pathname?.startsWith("/dashboard");

    const handleEasterEgg = () => {
        if (isDashboard) {
            window.dispatchEvent(new CustomEvent("personalify-easter-egg"));
        }
    };

    return (
        <footer
            className={`w-full py-3 md:py-6 px-6 -mt-4 md:mt-1 mb-2 bg-transparent text-center z-40 relative transition-opacity duration-500 ${pathname === "/about" ? "animate-fade-in-up" : ""
                }`}
        >
            <div className="text-xs text-neutral-600 dark:text-neutral-400 font-medium leading-tight">
                <div className="min-h-5">
                    {isDashboard ? (
                        <span
                            onClick={handleEasterEgg}
                            className="cursor-pointer md:hover:text-[#1DB954] active:text-[#1DB954] transition-colors footer-toggler"
                        >
                            Personalify
                        </span>
                    ) : (
                        <Link href="/" className="md:hover:text-[#1DB954] active:text-[#1DB954] transition-colors">
                            Personalify
                        </Link>
                    )}{" "}
                    © {new Date().getFullYear()} • {renderPoweredBy()}
                </div>
                <p>
                    Created by{" "}
                    <a
                        href="https://aritsu.vercel.app"
                        target="_blank"
                        className="hover:text-[#1DB954] active:text-[#1DB954] transition-colors"
                    >
                        アリツ
                    </a>
                </p>
            </div>
        </footer>
    );
}
