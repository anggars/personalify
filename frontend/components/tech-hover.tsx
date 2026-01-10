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

            // Mobile: Always center on screen (to avoid edge cutoff)
            if (window.innerWidth < 768) {
                setCoords({
                    top: rect.top,
                    left: screenWidth / 2,
                    alignment: "center",
                });
                return;
            }

            const threshold = 150;

            let align: "left" | "right" | "center" = "center";
            if (rect.left < threshold) {
                align = "left";
            } else if (rect.right > screenWidth - threshold) {
                align = "right";
            }

            // Calculate anchor point based on alignment
            let anchorLeft = rect.left + rect.width / 2; // Default center
            if (align === "left") anchorLeft = rect.left;
            if (align === "right") anchorLeft = rect.right;

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
                            className="relative bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl p-4 shadow-xl overflow-hidden hover:scale-[1.02] transition-transform duration-200"
                        >
                            <TooltipWrapper>
                                {/* Gradient Background Glow */}
                                <div
                                    className="absolute inset-0 opacity-20 pointer-events-none"
                                    style={{
                                        background: `radial-gradient(circle at center, ${gradientColor}, transparent 70%)`
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
