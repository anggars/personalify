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
import { FaSpotify, FaSoundcloud, FaMedium, FaGuitar, FaMusic, FaWaveSquare, FaNetworkWired, FaLayerGroup } from "react-icons/fa";
import TechHover from "@/components/tech-hover";
import {
    SiNextdotjs,
    SiPython,
    SiFastapi,
    SiDocker,
    SiVercel,
    SiPostgresql,
    SiMongodb,
    SiRedis,
    SiGenius,
    SiHuggingface,
    SiTypescript,
    SiSpotify
} from "react-icons/si";

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
        { icon: Github, href: "https://github.com/anggars", label: "Github", hover: "hover-brand-github", active: "active:text-black dark:active:text-white" },
        { icon: Linkedin, href: "http://linkedin.com/in/anggarnts", label: "LinkedIn", hover: "hover-brand-linkedin", active: "active:text-[#0077b5]" },
        { icon: Instagram, href: "http://www.instagram.com/anggarnts", label: "Instagram", hover: "instagram-hover", active: "active:text-[#e4405f]" },
        { icon: FaSpotify, href: "https://open.spotify.com/user/31xon7qetimdnbmhkupbaszl52nu", label: "Spotify", hover: "hover-brand-spotify", active: "active:text-[#1DB954]" },
        { icon: XIcon, href: "http://x.com/anggarnts", label: "X", hover: "hover-brand-x", active: "active:text-black dark:active:text-white" },
        { icon: Youtube, href: "http://youtube.com/@anggarnts", label: "YouTube", hover: "hover-brand-youtube", active: "active:text-[#ff0000]" },
        { icon: FaSoundcloud, href: "http://soundcloud.com/anggarnts", label: "SoundCloud", hover: "hover-brand-soundcloud", active: "active:text-[#ff5500]" },
        { icon: FaMedium, href: "https://medium.com/@anggarnts", label: "Medium", hover: "hover-brand-medium", active: "active:text-black dark:active:text-white" },
        { icon: Send, href: "http://t.me/anggarnts", label: "Telegram", hover: "hover-brand-telegram", active: "active:text-[#0088cc]" },
        { icon: FileText, href: "http://bit.ly/anggariantosudrajat", label: "Blog", hover: "hover-brand-blog", active: "active:text-[#1DB954]" },
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
                className="text-center mt-2 mb-4"
            >
                <h1 className="text-[2.5rem] font-extrabold text-[#1DB954] mb-2">
                    About Personalify
                </h1>
                <p className="text-lg mb-3 text-neutral-500 dark:text-[#B3B3B3] font-medium">
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
                    <h2 className="text-xl font-bold text-[#1DB954] border-b border-neutral-200 dark:border-[#333] pb-4 mb-4 text-center md:-mt-2">
                        Just a Side-Quest?
                    </h2>
                    <div className="space-y-4 text-neutral-700 dark:text-[#b3b3b3] leading-relaxed text-justify">
                        <div className="mb-4">
                            Alright, so here's the plot twist. Personalify basically wasn't just a random side-quest I built for fun.
                            This whole project was actually my final exam for my{" "}
                            <TechHover
                                text="'Distributed Data Processing'"
                                description="A course focusing on parallel computing and managing large-scale data systems."
                                icon={FaNetworkWired}
                                color="#FF9900"
                            />{" "}
                            class back in semester 6.
                            The brief was to build a system that integrates several database technologies.
                            We had to pick a use case, so I went straight for the{" "}
                            <TechHover
                                text="'Streaming Service Metadata Platform'"
                                description="A unified system to aggregate, process, and serve rich metadata from various music sources."
                                icon={FaLayerGroup}
                                color="#00C7B7"
                            />
                            , and this web is the final result. It started as an assignment, but evolved into a real passion project
                            where I could really push my full-stack engineering skills to the limit.
                        </div>
                        <div>
                            The architecture is modernized with a{" "}
                            <TechHover
                                text="Next.js"
                                href="https://nextjs.org/"
                                description="The React Framework for the Web. Used for server-side rendering and static generation."
                                icon={SiNextdotjs}
                                className="hover:text-black dark:hover:text-white"
                            />{" "}
                            frontend and a{" "}
                            <TechHover
                                text="Python (FastAPI)"
                                href="https://fastapi.tiangolo.com/"
                                description="High performance, easy to learn, fast to code, ready for production web framework."
                                icon={SiFastapi}
                                color="#009688"
                            />{" "}
                            backend, seamlessly pulling data from the{" "}
                            <TechHover
                                text="Spotify Developer API"
                                href="https://developer.spotify.com/"
                                description="Web API to retrieve metadata, player state, and user information."
                                icon={SiSpotify}
                                color="#1DB954"
                            />
                            . While local development relies on{" "}
                            <TechHover
                                text="Docker"
                                href="https://www.docker.com/"
                                description="Platform to develop, ship, and run applications in containers."
                                icon={SiDocker}
                                color="#2496ED"
                            />{" "}
                            containers, production runs purely as a Serverless app on{" "}
                            <TechHover
                                text="Vercel"
                                href="https://vercel.com/"
                                description="Frontend Cloud needed to develop, preview, and ship Next.js."
                                icon={SiVercel}
                                className="hover:text-black dark:hover:text-white"
                            />
                            . Main data lives in{" "}
                            <span className="whitespace-nowrap">
                                <TechHover
                                    text="Neon (Serverless Postgres)"
                                    href="https://neon.tech/"
                                    description="Serverless Postgres built for the cloud."
                                    icon={SiPostgresql}
                                    color="#00E599"
                                />
                            </span>
                            , sync history goes to{" "}
                            <TechHover
                                text="MongoDB Atlas"
                                href="https://www.mongodb.com/atlas"
                                description="Multi-cloud database service for modern applications."
                                icon={SiMongodb}
                                color="#47A248"
                            />
                            , and{" "}
                            <TechHover
                                text="Upstash Redis"
                                href="https://upstash.com/"
                                description="Serverless Data for Redis and Kafka."
                                icon={SiRedis}
                                color="#DC382D"
                            />{" "}
                            handles the cache. Lyrics are retrieved via a custom proxy routing strategy to bypass{" "}
                            <TechHover
                                text="Genius"
                                href="https://genius.com/developers"
                                description="World's biggest collection of song lyrics and musical knowledge."
                                icon={SiGenius}
                                color="#FFFF64"
                            />{" "}
                            restrictions, and the vibe check? That's powered by a sophisticated{" "}
                            <TechHover
                                text="Hugging Face"
                                href="https://huggingface.co/"
                                description="The AI community building the future. Used for sentiment analysis models."
                                icon={SiHuggingface}
                                color="#FFD21E"
                            />{" "}
                            transformer model for sentiment analysis.
                        </div>
                    </div>
                </motion.section>

                {/* Section 2 */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="glass-card rounded-2xl p-6 md:p-6 hover:-translate-y-1 transition-transform duration-300"
                >
                    <h2 className="text-xl font-bold text-[#1DB954] border-b border-neutral-200 dark:border-[#333] pb-4 mb-4 text-center md:-mt-2">
                        About Me
                    </h2>
                    <div className="space-y-4 text-neutral-700 dark:text-[#b3b3b3] leading-relaxed text-justify">
                        <div className="mb-4">
                            I'm Angga, an Informatics major who just genuinely enjoys building cool things.
                            My world is a constant juggling act between computational linguistics, psychology, and (obviously) music.
                            I'm always looking for creative ways these different fields can overlap,
                            and this project is truly the perfect example of that personal exploration.
                        </div>
                        <div>
                            This project is pretty much my whole personality a showcase of coding (mostly{" "}
                            <TechHover
                                text="Python"
                                href="https://www.python.org/"
                                description="A programming language that lets you work quickly and integrate systems more effectively."
                                icon={SiPython}
                                color="#3776AB"
                            />{" "}
                            &{" "}
                            <TechHover
                                text="TypeScript"
                                href="https://www.typescriptlang.org/"
                                description="TypeScript is JavaScript with syntax for types."
                                icon={SiTypescript}
                                color="#3178C6"
                            />
                            ), NLP, and I'm so deeply into{" "}
                            <TechHover
                                text="Math Rock"
                                onClick={() => handlePlayAudio("mathRock")}
                                description="Complex rhythms, atypical time signatures, and angular melodies. Click to listen!"
                                icon={FaGuitar}
                                color="#1DB954"
                            />{" "}
                            and{" "}
                            <TechHover
                                text="Midwest Emo"
                                onClick={() => handlePlayAudio("midwest")}
                                description="Emotional indie rock characterized by melodic guitars and confessionary lyrics. Click to listen!"
                                icon={FaWaveSquare}
                                color="#1DB954"
                            />
                            . I'm down in the trenches geeking out trying to learn alternate guitar tunings like{" "}
                            <TechHover
                                text="FACGCE"
                                onClick={() => handlePlayAudio("tuning")}
                                description="An open tuning often used in Math Rock and Emo for dreamy, resonant chords. Click for a lesson!"
                                icon={FaMusic}
                                color="#1DB954"
                            />{" "}
                            right now, even though it's tough as hell. This web is the crossover episode I didn't know I needed.
                        </div>
                    </div>
                </motion.section>

                {/* Section 3 - Socials */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="glass-card rounded-2xl p-6 md:p-6 hover:-translate-y-1 transition-transform duration-300"
                >
                    <h2 className="text-xl font-bold text-[#1DB954] border-b border-neutral-200 dark:border-[#333] pb-4 mb-4 text-center md:-mt-2">
                        Hit Me Up!
                    </h2>
                    <div className="grid grid-cols-5 gap-3 justify-items-center md:flex md:flex-wrap md:justify-center md:gap-4 pt-2">
                        {socials.map((social) => (
                            <a
                                key={social.label}
                                href={social.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center justify-center w-11 h-11 rounded-full bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-[#282828] text-neutral-600 dark:text-[#b3b3b3] transition-all duration-300 ${social.hover} ${social.active}`}
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
