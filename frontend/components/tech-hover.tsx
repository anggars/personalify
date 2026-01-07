"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconType } from "react-icons";

interface TechHoverProps {
    text: string;
    href?: string;
    onClick?: () => void;
    description: string;
    icon?: IconType | React.ElementType;
    color?: string; // Hex color for the icon/glow
    className?: string;
}

export default function TechHover({
    text,
    href,
    onClick,
    description,
    icon: Icon,
    color,
    className = "",
}: TechHoverProps) {
    const [isHovered, setIsHovered] = useState(false);

    // If color is provided, use it for icon styling. Otherwise default to neutral adaptive.
    const iconStyle = color ? { color: color } : {};
    const iconClass = color ? "" : "text-neutral-900 dark:text-white";

    // For gradient background, default to gray if no color provided
    const gradientColor = color || "#888888";

    const Component = onClick ? "button" : "a";

    return (
        <span
            className="relative inline-block"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Component
                href={onClick ? undefined : href}
                target={onClick ? undefined : "_blank"}
                rel={onClick ? undefined : "noopener noreferrer"}
                onClick={onClick}
                className={`font-semibold transition-colors cursor-pointer bg-transparent border-none p-0 inline ${className}`}
                style={{
                    color: isHovered && color ? color : undefined
                }}
            >
                {text}
            </Component>

            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                        exit={{ opacity: 0, y: 10, scale: 0.95, x: "-50%" }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute bottom-full left-1/2 mb-2 w-fit min-w-[240px] max-w-md z-50 pointer-events-none"
                    >
                        <div className="relative bg-white/10 dark:bg-neutral-900/90 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-xl p-4 shadow-xl overflow-hidden">
                            {/* Gradient Background Glow */}
                            <div
                                className="absolute inset-0 opacity-20"
                                style={{
                                    background: `radial-gradient(circle at center, ${gradientColor}, transparent 70%)`
                                }}
                            />

                            <div className="relative flex items-start gap-3 z-10">
                                {Icon && (
                                    <div
                                        className={`p-2 rounded-lg bg-white/10 shrink-0 ${iconClass}`}
                                        style={iconStyle}
                                    >
                                        <Icon size={24} />
                                    </div>
                                )}
                                <div className="text-left flex-1 min-w-0">
                                    <h4 className="font-bold text-sm text-neutral-900 dark:text-white mb-0.5 whitespace-nowrap">
                                        {text}
                                    </h4>
                                    <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-snug whitespace-normal w-0 min-w-full">
                                        {description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </span>
    );
}
