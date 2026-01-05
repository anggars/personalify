"use client";

import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import MarqueeText from "@/components/marquee-text";
import {
    Github,
    Linkedin,
    Instagram,
    Youtube,
    Send,
    FileText,
} from "lucide-react";
import { FaSpotify, FaSoundcloud, FaMedium } from "react-icons/fa";

const AUDIO_DATA = {
    tuning: {
        href: "https://youtu.be/oCI3fzZvKEo?si=dkjuFQOwWhY6TTx5",
        imgSrc: "/assets/facgce-strum.png",
        title: "This Tuning = Automatically Dreamy Chords",
        subtitle: "Let's Talk About Math Rock",
        isMarquee: true
    },
    mathRock: {
        href: "https://open.spotify.com/track/40TzrhKx3TZQ07mp5JEWMC?si=47faf11359fc4b94",
        imgSrc: "/assets/uchu-conbini-8films.png",
        title: "8films",
        subtitle: "宇宙コンビニ"
    },
    midwest: {
        href: "https://open.spotify.com/album/4v8wrVdL5MzelOln49yffP?si=MSUqhOv-R16mCt-0iDM0tg",
        imgSrc: "/assets/the-polar-bears-good-enough.png",
        title: "Good Enough",
        subtitle: "The Polar Bears"
    }
};

const XIcon = ({ className }: { className?: string }) => (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
        <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
);

export default function AboutPage() {
    const audioRefs = {
        tuning: useRef<HTMLAudioElement | null>(null),
        mathRock: useRef<HTMLAudioElement | null>(null),
        midwest: useRef<HTMLAudioElement | null>(null),
    };

    const clearNotification = () => {
        const event = new CustomEvent("personalify-notification", { detail: null });
        window.dispatchEvent(event);
    };

    const handlePlayAudio = (type: "tuning" | "mathRock" | "midwest") => {
        // Stop all others and prevent clearing notification
        Object.values(audioRefs).forEach((ref) => {
            if (ref.current) {
                ref.current.onpause = null;
                ref.current.pause();
                ref.current.currentTime = 0;
            }
        });

        const audio = audioRefs[type].current;
        if (audio) {
            // Play new audio
            audio.play().catch((e) => console.log("Audio play failed:", e));

            // Dispatch notification event
            const data = AUDIO_DATA[type];
            const event = new CustomEvent("personalify-notification", {
                detail: {
                    type: "media",
                    media: data
                }
            });
            window.dispatchEvent(event);

            // Cleanup listeners
            audio.onended = clearNotification;
            audio.onpause = () => {
                // If paused effectively (e.g. by system or other means not covered above), clear.
                // Note: The loop above removes this listener before pausing when switching tracks.
                clearNotification();
            };
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
        // No longer needed for bubble, but maybe for cards if they use it?
        // Checking cards... nope, cards use global css for glow?
        // Actually the cards in the original code didn't use this function, only BubbleToast did.
        // Wait, "glow-card" utility in CSS uses --mouse-x/y.
        // But the cards in the JSX don't have onMouseMove attached.
        // Ah, the BubbleToast had it. The main cards don't use it in the provided code snippet.
        // I will keep it if needed later, or remove if unused. It seems unused by main cards.
    };

    const socials = [
        { icon: Github, href: "https://github.com/anggars", label: "Github", hover: "hover-brand-github" },
        { icon: Linkedin, href: "http://linkedin.com/in/anggarnts", label: "LinkedIn", hover: "hover-brand-linkedin" },
        { icon: Instagram, href: "http://www.instagram.com/anggarnts", label: "Instagram", hover: "instagram-hover" },
        { icon: FaSpotify, href: "https://open.spotify.com/user/31xon7qetimdnbmhkupbaszl52nu", label: "Spotify", hover: "hover-brand-spotify" },
        { icon: XIcon, href: "http://x.com/anggarnts", label: "X", hover: "hover-brand-x" },
        { icon: Youtube, href: "http://youtube.com/@anggarnts", label: "YouTube", hover: "hover-brand-youtube" },
        { icon: FaSoundcloud, href: "http://soundcloud.com/anggarnts", label: "SoundCloud", hover: "hover-brand-soundcloud" },
        { icon: FaMedium, href: "https://medium.com/@anggarnts", label: "Medium", hover: "hover-brand-medium" },
        { icon: Send, href: "http://t.me/anggarnts", label: "Telegram", hover: "hover-brand-telegram" }, // Send icon serves as Paper Plane
        { icon: FileText, href: "http://bit.ly/anggariantosudrajat", label: "Blog", hover: "hover-brand-blog" },
    ];

    return (
        <div className="page-container flex flex-col items-center w-full max-w-3xl mx-auto">
            {/* Audio elements */}
            <audio ref={audioRefs.tuning} src="/assets/audio/facgce-strum.mp3" preload="auto" />
            <audio ref={audioRefs.mathRock} src="/assets/audio/uchu-conbini-8films.mp3" preload="auto" />
            <audio ref={audioRefs.midwest} src="/assets/audio/the-polar-bears-good-enough.mp3" preload="auto" />

            {/* Hero Header */}
            <motion.header
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center mt-4 mb-6"
            >
                <h1 className="text-[2.5rem] font-extrabold text-[#1DB954] mb-2">
                    About Personalify
                </h1>
                <p className="text-lg mb-1 text-neutral-500 dark:text-[#B3B3B3] font-medium">
                    The project scoop, from exam brief to deployment.
                </p>
            </motion.header>

            {/* Content Sections */}
            <div
                className="w-full space-y-6"
            >
                {/* Section 1 */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="glass-card rounded-2xl p-6 md:p-6 hover:-translate-y-1 transition-transform duration-300"
                >
                    <h2 className="text-xl font-bold text-[#1DB954] border-b border-neutral-200 dark:border-[#333] pb-4 mb-4 text-center -mt-2">
                        Just a Side-Quest?
                    </h2>
                    <div className="space-y-4 text-neutral-700 dark:text-[#b3b3b3] leading-relaxed text-justify">
                        <p>
                            Alright, so here's the plot twist. Personalify basically wasn't just a random side-quest I built for fun.
                            This whole project was actually my final exam for my <b>'Distributed Data Processing'</b> class back in semester 6.
                            The brief was to build a system that integrates several database technologies.
                            We had to pick a use case, so I went straight for the <b>'Streaming Service Metadata Platform'</b>,
                            and this web is the final result. It started as an assignment, but evolved into a real passion project.
                        </p>
                        <p>
                            This whole thing is built with a{" "}
                            <a href="https://fastapi.tiangolo.com/" target="_blank" className="font-semibold hover:text-[#009688] transition-colors">
                                Python (FastAPI)
                            </a>{" "}
                            backend, seamlessly pulling data from the{" "}
                            <a href="https://developer.spotify.com/" target="_blank" className="font-semibold hover:text-[#1DB954] transition-colors">
                                Spotify Developer API
                            </a>
                            . While local development relies on{" "}
                            <a href="https://www.docker.com/" target="_blank" className="font-semibold hover:text-[#2496ED] transition-colors">
                                Docker
                            </a>{" "}
                            containers, production runs purely as a Serverless app on{" "}
                            <a href="https://vercel.com/" target="_blank" className="font-semibold hover:text-white transition-colors">
                                Vercel
                            </a>
                            . Main data lives in{" "}
                            <a href="https://neon.tech/" target="_blank" className="font-semibold hover:text-[#00E599] transition-colors">
                                Neon (Serverless Postgres)
                            </a>
                            , sync history goes to{" "}
                            <a href="https://www.mongodb.com/atlas" target="_blank" className="font-semibold hover:text-[#4DB33D] transition-colors">
                                MongoDB Atlas
                            </a>
                            , and{" "}
                            <a href="https://upstash.com/" target="_blank" className="font-semibold hover:text-[#DC382D] transition-colors">
                                Upstash Redis
                            </a>{" "}
                            handles the cache. Lyrics are retrieved via a custom proxy routing strategy to bypass{" "}
                            <a href="https://genius.com/developers" target="_blank" className="font-semibold hover:text-[#FFFF64] transition-colors">
                                Genius
                            </a>{" "}
                            restrictions, and the vibe check? That's a{" "}
                            <a href="https://huggingface.co/" target="_blank" className="font-semibold hover:text-[#FFD21E] transition-colors">
                                Hugging Face
                            </a>{" "}
                            NLP model.
                        </p>
                    </div>
                </motion.section>

                {/* Section 2 */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="glass-card rounded-2xl p-6 md:p-6 hover:-translate-y-1 transition-transform duration-300"
                >
                    <h2 className="text-xl font-bold text-[#1DB954] border-b border-neutral-200 dark:border-[#333] pb-4 mb-4 text-center -mt-2">
                        About Me
                    </h2>
                    <div className="space-y-4 text-neutral-700 dark:text-[#b3b3b3] leading-relaxed text-justify">
                        <p>
                            I'm Angga, an Informatics major who just genuinely enjoys building cool things.
                            My world is a constant juggling act between computational linguistics, psychology, and (obviously) music.
                            I'm always looking for creative ways these different fields can overlap,
                            and this project is truly the perfect example of that personal exploration.
                        </p>
                        <p>
                            This project is pretty much my whole personality a showcase of coding (mostly Python & JavaScript),
                            NLP, and I'm so deeply into{" "}
                            <button
                                onClick={() => handlePlayAudio("mathRock")}
                                className="font-bold hover:text-[#1DB954] transition-colors cursor-pointer bg-transparent border-none"
                            >
                                Math Rock
                            </button>{" "}
                            and{" "}
                            <button
                                onClick={() => handlePlayAudio("midwest")}
                                className="font-bold hover:text-[#1DB954] transition-colors cursor-pointer bg-transparent border-none"
                            >
                                Midwest Emo
                            </button>
                            . I'm down in the trenches geeking out trying to learn alternate guitar tunings like{" "}
                            <button
                                onClick={() => handlePlayAudio("tuning")}
                                className="font-bold hover:text-[#1DB954] transition-colors cursor-pointer bg-transparent border-none"
                            >
                                FACGCE
                            </button>{" "}
                            right now, even though it's tough as hell. This web is the crossover episode I didn't know I needed.
                        </p>
                    </div>
                </motion.section>

                {/* Section 3 - Socials */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="glass-card rounded-2xl p-6 md:p-6 hover:-translate-y-1 transition-transform duration-300"
                >
                    <h2 className="text-xl font-bold text-[#1DB954] border-b border-neutral-200 dark:border-[#333] pb-4 mb-4 text-center -mt-2">
                        Hit Me Up!
                    </h2>
                    <div className="grid grid-cols-5 gap-3 justify-items-center md:flex md:flex-wrap md:justify-center md:gap-4 pt-2">
                        {socials.map((social) => (
                            <a
                                key={social.label}
                                href={social.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center justify-center w-11 h-11 rounded-full bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-[#282828] text-neutral-600 dark:text-[#b3b3b3] transition-all duration-300 ${social.hover}`}
                                aria-label={social.label}
                            >
                                <social.icon className="w-5 h-5" />
                            </a>
                        ))}
                    </div>
                </motion.section>
            </div>
        </div>
    );
}
