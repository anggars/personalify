"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";

export const TECH_STACK = [
    { name: "Spotify", slug: "spotify", color: "1DB954" },
    { name: "Genius", slug: "genius", color: "FFFF00" },
    { name: "Next.js", slug: "nextdotjs", color: "white" },
    { name: "TypeScript", slug: "typescript", color: "3178C6" },
    { name: "FastAPI", slug: "fastapi", color: "009688" },
    { name: "Python", slug: "python", color: "3776AB" },
    { name: "shadcn/ui", slug: "shadcnui", color: "white" },
    { name: "Tailwind CSS", slug: "tailwindcss", color: "06B6D4" },
    { name: "React", slug: "react", color: "61DAFB" },
    { name: "Flutter", slug: "flutter", color: "02569B" },
    { name: "Dart", slug: "dart", color: "0175C2" },
    { name: "Framer Motion", slug: "framer", color: "white" },
    { name: "Vercel", slug: "vercel", color: "white" },
    { name: "Hugging Face", slug: "huggingface", color: "FFD21E" },
    { name: "Supabase", slug: "supabase", color: "3ECF8E", isCustom: false },
    { name: "PostgreSQL", slug: "postgresql", color: "4169E1" },
    { name: "MongoDB", slug: "mongodb", color: "47A248" },
    { name: "Upstash", slug: "upstash", color: "00E9A3" },
    { name: "Redis", slug: "redis", color: "DC382D" },
];

export const TechStackMarquee = ({ isVisible }: { isVisible: boolean }) => {
    // We want to show ~3 icons at a time. 
    // If parent is ~240px wide, each item is 80px.
    // Animation: infinite scroll left.

    if (!isVisible) return null;

    return (
        <div
            className="relative w-full h-full overflow-hidden flex items-center"
            style={{
                maskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
                WebkitMaskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)"
            }}
        >
            <motion.div
                className="flex items-center gap-0" // gap-0 because we control spacing via padding/width
                animate={{ x: ["0%", "-50%"] }} // Move half the width (since we duplicated list)
                transition={{
                    x: {
                        repeat: Infinity,
                        repeatType: "loop",
                        duration: 15,
                        ease: "linear",
                    },
                }}
            >
                {[...TECH_STACK, ...TECH_STACK].map((tech, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-center shrink-0 w-[80px] h-[80px] max-md:w-[60px] max-md:h-[60px] p-4 max-md:p-2 group relative"
                        title={tech.name}
                    >
                        <TechIcon tech={tech} />
                    </div>
                ))}
            </motion.div>
        </div>
    );
};

export const TechIcon = ({ tech }: { tech: typeof TECH_STACK[number] }) => {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const isLight = mounted && resolvedTheme === "light";
    const displayColor = isLight && tech.color === "white" ? "000000" : tech.color;

    if (tech.isCustom) {
        // Supabase Logo Colors
        // Dark Mode: Cyan (#12FFF7) & Pale Green (#B9FFB3)
        // Light Mode: Dark Teal (#007570) & Dark Green (#008F64) - for contrast on white
        const primaryColor = isLight ? "#007570" : "#12FFF7";
        const secondaryColor = isLight ? "#008F64" : "#B9FFB3";

        return (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" fill="none" className="w-full h-full object-contain p-2">
                <path fill={primaryColor} fillRule="evenodd" d="M0 4.828C0 2.16 2.172 0 4.851 0h18.436c2.679 0 4.85 2.161 4.85 4.828V20.43c0 2.758-3.507 3.955-5.208 1.778l-5.318-6.809v8.256c0 2.4-1.955 4.345-4.367 4.345H4.851C2.172 28 0 25.839 0 23.172zm4.851-.966a.97.97 0 0 0-.97.966v18.344c0 .534.435.966.97.966h8.539c.268 0 .34-.216.34-.483v-11.07c0-2.76 3.507-3.956 5.208-1.779l5.319 6.809V4.828c0-.534.05-.966-.485-.966z" clipRule="evenodd" />
                <path fill="url(#a)" fillRule="evenodd" d="M0 4.828C0 2.16 2.172 0 4.851 0h18.436c2.679 0 4.85 2.161 4.85 4.828V20.43c0 2.758-3.507 3.955-5.208 1.778l-5.318-6.809v8.256c0 2.4-1.955 4.345-4.367 4.345H4.851C2.172 28 0 25.839 0 23.172zm4.851-.966a.97.97 0 0 0-.97.966v18.344c0 .534.435.966.97.966h8.539c.268 0 .34-.216.34-.483v-11.07c0-2.76 3.507-3.956 5.208-1.779l5.319 6.809V4.828c0-.534.05-.966-.485-.966z" clipRule="evenodd" />
                <path fill="url(#b)" fillRule="evenodd" d="M0 4.828C0 2.16 2.172 0 4.851 0h18.436c2.679 0 4.85 2.161 4.85 4.828V20.43c0 2.758-3.507 3.955-5.208 1.778l-5.318-6.809v8.256c0 2.4-1.955 4.345-4.367 4.345H4.851C2.172 28 0 25.839 0 23.172zm4.851-.966a.97.97 0 0 0-.97.966v18.344c0 .534.435.966.97.966h8.539c.268 0 .34-.216.34-.483v-11.07c0-2.76 3.507-3.956 5.208-1.779l5.319 6.809V4.828c0-.534.05-.966-.485-.966z" clipRule="evenodd" />
                <path fill={secondaryColor} d="M23.287 0c2.679 0 4.85 2.161 4.85 4.828V20.43c0 2.758-3.507 3.955-5.208 1.778l-5.319-6.809v8.256c0 2.4-1.954 4.345-4.366 4.345a.484.484 0 0 0 .485-.483V12.584c0-2.758 3.508-3.955 5.21-1.777l5.318 6.808V.965a.97.97 0 0 0-.97-.965" />
                <defs>
                    <linearGradient id="a" x1="28.138" x2="3.533" y1="28" y2="-.12" gradientUnits="userSpaceOnUse"><stop stopColor={secondaryColor} /><stop offset="1" stopColor={secondaryColor} stopOpacity="0" /></linearGradient>
                    <linearGradient id="b" x1="28.138" x2="11.447" y1="28" y2="21.476" gradientUnits="userSpaceOnUse"><stop stopColor={isLight ? "#000000" : "#1A1A1A"} stopOpacity=".9" /><stop offset="1" stopColor={isLight ? "#000000" : "#1A1A1A"} stopOpacity="0" /></linearGradient>
                </defs>
            </svg>
        );
    }

    return (
        <img
            src={`https://cdn.simpleicons.org/${tech.slug}/${displayColor}`}
            alt={tech.name}
            className="w-full h-full object-contain p-2"
        />
    );
};
