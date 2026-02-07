"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
    const [isMobile, setIsMobile] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number; alignment: "left" | "right" | "center" }>({
        top: 0,
        left: 0,
        alignment: "center",
    });
    const containerRef = useRef<HTMLElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null); // Ref for the portal content
    const [mounted, setMounted] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // If color is provided, use it for icon styling. Otherwise default to neutral adaptive.
    const iconStyle = color ? { color: color } : {};
    const iconClass = color ? "" : "text-neutral-900 dark:text-white";

    // For gradient background, default to gray if no color provided
    const gradientColor = color || "#888888";

    useEffect(() => {
        setMounted(true);
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();

        window.addEventListener("resize", checkMobile);
        window.addEventListener("scroll", () => {
            if (isHovered && !isMobile) {
                // Ideally update position on scroll, or just close it to avoid detachment
                handleInteraction(false);
            }
        });

        // Click Outside Listener
        const handleClickOutside = (event: MouseEvent) => {
            // If clicking inside the trigger container OR inside the tooltip (portal), do nothing.
            if (
                containerRef.current?.contains(event.target as Node) ||
                tooltipRef.current?.contains(event.target as Node)
            ) {
                return;
            }
            // Otherwise close it
            setIsHovered(false);
        };

        if (isHovered) {
            document.addEventListener("mousedown", handleClickOutside as any);
            document.addEventListener("touchstart", handleClickOutside as any); // For mobile touch
        }

        return () => {
            window.removeEventListener("resize", checkMobile);
            document.removeEventListener("mousedown", handleClickOutside as any);
            document.removeEventListener("touchstart", handleClickOutside as any);
        };
    }, [isHovered, isMobile]);

    const updatePosition = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const screenWidth = window.innerWidth;

            // Determine horizontal alignment based on screen position
            // This logic works for both Mobile and Desktop to ensure it stays on screen
            let align: "left" | "right" | "center" = "center";

            // Boundary thresholds (px from edge)
            const margin = 20;
            const tooltipWidthEstimate = 220; // Approx max width of tooltip

            // Check if too close to Left Edge
            if (rect.left < (tooltipWidthEstimate / 2) + margin) {
                align = "left";
            }
            // Check if too close to Right Edge
            else if (rect.right > screenWidth - ((tooltipWidthEstimate / 2) + margin)) {
                align = "right";
            }

            // Calculate anchor point
            let anchorLeft = rect.left + rect.width / 2; // Default center

            if (align === "left") {
                // If aligned left, anchor is the left edge of text
                // But on mobile if text is VERY left, we might strictly align to screen padding? 
                // Let's keep it simple: strict align to text left
                anchorLeft = rect.left;
            } else if (align === "right") {
                // If aligned right, anchor is the right edge of text
                anchorLeft = rect.right;
            }

            setCoords({
                top: rect.top,
                left: anchorLeft,
                alignment: align,
            });
        }
    };

    const handleInteraction = (active: boolean) => {
        if (active) {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            updatePosition();
            setIsHovered(true);
        } else {
            timeoutRef.current = setTimeout(() => {
                setIsHovered(false);
            }, 100);
        }
    };

    const handleMouseMoveCard = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    };

    const TriggerComponent = ((isMobile && (href || onClick)) ? "button" : (onClick ? "button" : "a")) as React.ElementType;

    const handleTriggerClick = (e: React.MouseEvent) => {
        if (isMobile) {
            // Mobile: Tap always toggles hover first
            e.preventDefault();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setIsHovered(!isHovered);
            if (!isHovered) updatePosition();
        } else {
            // Desktop: Follows standard behavior (onClick or href)
            if (onClick) onClick();
        }
    };

    // Tooltip Wrapper Component to handle Clickable Card behavior
    const TooltipWrapper = ({ children }: { children: React.ReactNode }) => {
        // If it has an href, make the entire card a link
        if (href) {
            return (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block cursor-pointer"
                    onClick={() => {
                        setIsHovered(false); // Close tooltip immediately after click for links too
                    }}
                >
                    {children}
                </a>
            );
        }

        // If it has onClick (but no href), make it a clickable div
        if (onClick) {
            return (
                <div
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent bubbling issues
                        onClick?.();
                        setIsHovered(false); // Close tooltip immediately after click
                    }}
                    role="button"
                    className="block cursor-pointer"
                >
                    {children}
                </div>
            );
        }

        // Just info, no interaction
        return <div className="block">{children}</div>;
    };

    // Tooltip Content
    const tooltipContent = (
        <AnimatePresence>
            {isHovered && (
                <motion.div
                    // Add ref here to track clicks inside tooltip (portal)
                    ref={tooltipRef}
                    initial={{
                        opacity: 0,
                        y: 10,
                        scale: 0.95,
                        x: coords.alignment === "left" ? "0%" : coords.alignment === "right" ? "-100%" : "-50%"
                    }}
                    animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        x: coords.alignment === "left" ? "0%" : coords.alignment === "right" ? "-100%" : "-50%"
                    }}
                    exit={{
                        opacity: 0,
                        y: 10,
                        scale: 0.95,
                        x: coords.alignment === "left" ? "0%" : coords.alignment === "right" ? "-100%" : "-50%"
                    }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{
                        position: "fixed",
                        top: coords.top,
                        left: coords.left,
                        zIndex: 9999,
                    }}
                    className="mb-2 w-fit min-w-[200px] max-w-[calc(100vw-2rem)] md:max-w-md pointer-events-auto"
                    onMouseEnter={() => handleInteraction(true)}
                    onMouseLeave={() => handleInteraction(false)}
                >
                    <div className="transform -translate-y-full pb-2">
                        <div
                            onMouseMove={handleMouseMoveCard}
                            className="group relative bg-white/20 dark:bg-neutral-900/25 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl p-4 overflow-hidden hover:scale-[1.02] transition-transform duration-200 shadow-[inset_0_1px_2px_0_rgba(255,255,255,0.15),inset_0_1px_1px_0_rgba(255,255,255,0.2),0_4px_15px_rgba(0,0,0,0.3)]"
                        >
                            <TooltipWrapper>
                                {/* Dynamic Spotlight Glow */}
                                <div
                                    className="absolute inset-0 opacity-0 group-hover:opacity-40 pointer-events-none transition-opacity duration-300"
                                    style={{
                                        backgroundImage: `radial-gradient(circle 50px at var(--mouse-x, 50%) var(--mouse-y, 50%), ${gradientColor} 0%, ${gradientColor}33 30%, ${gradientColor}14 60%, transparent 100%)`,
                                    }}
                                />

                                <div className="relative flex items-start gap-3 z-10 text-left">
                                    {Icon && (
                                        <div
                                            className={`p-2 rounded-lg bg-white/10 shrink-0 ${iconClass}`}
                                            style={iconStyle}
                                        >
                                            <Icon size={24} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm text-neutral-900 dark:text-white mb-0.5 whitespace-nowrap">
                                            {text}
                                        </h4>
                                        <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-snug whitespace-normal w-0 min-w-full">
                                            {description}
                                        </p>
                                    </div>
                                </div>
                            </TooltipWrapper>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <>
            <span
                ref={containerRef}
                className="relative inline"
                onMouseEnter={() => handleInteraction(true)}
                onMouseLeave={() => handleInteraction(false)}
            >
                <TriggerComponent
                    href={(isMobile && href) ? undefined : (onClick ? undefined : href)}
                    target={onClick || isMobile ? undefined : "_blank"}
                    rel={onClick || isMobile ? undefined : "noopener noreferrer"}
                    onClick={handleTriggerClick}
                    className={`font-semibold transition-colors cursor-pointer bg-transparent border-none p-0 inline ${className}`}
                    style={{
                        color: isHovered && color ? color : undefined
                    }}
                >
                    {text}
                </TriggerComponent>
            </span>
            {mounted && createPortal(tooltipContent, document.body)}
        </>
    );
}
