"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ui/theme-toggle";
import { ChevronDown, Menu, X } from "lucide-react";
import Image from "next/image";

type NotificationType = "warning" | "error" | "media" | null;

interface NotificationData {
    type: NotificationType;
    message?: string;
    media?: {
        title: string;
        subtitle: string;
        imgSrc: string;
        href: string;
        isMarquee?: boolean;
    };
}

export const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [mobileDropdownOpen, setMobileDropdownOpen] = useState<string | null>(null);
    const [desktopDropdownOpen, setDesktopDropdownOpen] = useState<string | null>(null);
    const [spotifyId, setSpotifyId] = useState<string | null>(null);

    // Notification State
    const [notification, setNotification] = useState<NotificationData | null>(null);

    const pathname = usePathname();
    const params = useParams();

    // Handle scroll
    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Notification Listener
    useEffect(() => {
        const handleNotification = (e: CustomEvent) => {
            if (e.detail === null) {
                setNotification(null);
            } else {
                setNotification(e.detail);
            }
        };

        window.addEventListener("personalify-notification" as any, handleNotification);
        return () => window.removeEventListener("personalify-notification" as any, handleNotification);
    }, []);

    // Get spotify_id from localStorage and sync with dashboard URL
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const errorParam = urlParams.get("error");

        if (errorParam === "logged_out" || errorParam === "session_expired") {
            localStorage.removeItem("spotify_id");
            setSpotifyId(null);
            // Trigger notification for session expired
            if (errorParam === "session_expired") {
                const event = new CustomEvent("personalify-notification", {
                    detail: { type: "error", message: "⚠ Session expired. Please login again!" }
                });
                window.dispatchEvent(event);
                setTimeout(() => window.dispatchEvent(new CustomEvent("personalify-notification", { detail: null })), 4000);
            }
            return;
        }

        if (pathname?.startsWith("/dashboard/") && params.spotifyId) {
            localStorage.setItem("spotify_id", params.spotifyId as string);
            setSpotifyId(params.spotifyId as string);
        } else {
            const storedId = localStorage.getItem("spotify_id");
            setSpotifyId(storedId);
        }
    }, [pathname, params]);

    // Handle dashboard link click (Login Warning)
    const handleDashboardClick = (e: React.MouseEvent) => {
        if (!spotifyId) {
            e.preventDefault();
            const event = new CustomEvent("personalify-notification", {
                detail: { type: "error", message: "⚠ Please login using the button on the home page!" }
            });
            window.dispatchEvent(event);
            setTimeout(() => window.dispatchEvent(new CustomEvent("personalify-notification", { detail: null })), 3000);
        }
    };

    const getDashboardHref = () => {
        if (spotifyId) {
            return `/dashboard/${spotifyId}?time_range=short_term`;
        }
        return "#";
    };

    const navLinks = [
        { name: "Home", href: "/" },
        { name: "Dashboard", href: getDashboardHref(), onClick: handleDashboardClick },
        {
            name: "Analyzer",
            href: "/lyrics",
            children: [
                { name: "Lyrics Analyzer", href: "/lyrics" },
                { name: "Genius Analyzer", href: "/lyrics/genius" }
            ]
        },
        { name: "About", href: "/about" },
    ];

    const navbarClass = cn(
        "fixed left-1/2 -translate-x-1/2 z-50 flex items-center justify-between",
        "transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] will-change-[width,top,background,border-radius]",
        isScrolled
            ? "top-4 w-[calc(100%-3rem)] md:w-[44rem] rounded-2xl bg-white/50 dark:bg-[#1e1e1e]/60 backdrop-blur-xl border border-black/10 dark:border-white/10 navbar-floating-glass px-4 py-3"
            : "top-0 w-full px-4 py-3 bg-transparent border-b border-black/5 dark:border-white/5"
    );

    // Dynamic top position for notifications to match where navbar would be
    // If scrolled, navbar is at top-4. If not scrolled, it's at top-0 (but has padding).
    // User wants "sejajar". If sticky (not scrolled), navbar content is roughly top-4 centered vertically within the top-0 bar.
    // Let's standardise the notification position to `top-4` to be consistent and visible, 
    // or match the `isScrolled` logic if they want it to feel "inside" the bar area.
    // Given the request "pas muncul... sejajar sama navbar entah itu floating maupun sticky",
    // and "navbarnya pun langsung ilang", positioning at `top-4` is safe and looks good for bubbles.
    const notificationContainerClass = cn(
        "fixed left-1/2 -translate-x-1/2 z-[100]", // Higher z-index than navbar
        isScrolled ? "top-4" : "top-4" // Consistent top position feels best for toasts
    );

    const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    };

    return (
        <>
            <AnimatePresence>
                {notification ? (
                    <motion.div
                        key={notification.type === "media" ? notification.media?.title : notification.message}
                        initial={{ opacity: 0, y: -20, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.92, position: "absolute" }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={cn(
                            notificationContainerClass,
                            "toast-glass backdrop-blur-3xl shadow-2xl rounded-xl overflow-hidden transform-gpu ring-1 ring-white/10",
                            notification.type === "warning"
                                ? "bg-white/95 dark:bg-[#1e1e1e]/95 text-yellow-600 dark:text-yellow-400"
                                : notification.type === "error"
                                    ? "bg-white/95 dark:bg-[#1e1e1e]/95 text-red-600 dark:text-red-400 border border-red-500/20"
                                    : "bg-white/70 dark:bg-[#121212]/80 hover:scale-105 transition-transform duration-300"
                        )}
                    >
                        {(notification.type === "warning" || notification.type === "error") && (
                            <div className="px-6 py-3 font-bold text-sm whitespace-nowrap">
                                {notification.message}
                            </div>
                        )}

                        {notification.type === "media" && notification.media && (
                            <Link
                                href={notification.media.href}
                                target="_blank"
                                onMouseMove={handleMouseMove}
                                className="flex items-center gap-3 p-3 pr-6 w-full h-full group"
                            >
                                <div className={cn(
                                    "relative shrink-0 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 shadow-inner",
                                    notification.media.title.includes("Tuning") ? "w-[88px] h-[50px]" : "w-12 h-12"
                                )}>
                                    <Image src={notification.media.imgSrc} alt={notification.media.title} fill className="object-cover" />
                                </div>
                                <div className="flex flex-col">
                                    {notification.media.isMarquee ? (
                                        <div className="w-[160px] overflow-hidden whitespace-nowrap mask-gradient">
                                            <div className="animate-marquee inline-block">
                                                <span className="font-bold text-black dark:text-white text-sm mr-4">{notification.media.title}</span>
                                                <span className="font-bold text-black dark:text-white text-sm">{notification.media.title}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="font-bold text-black dark:text-white text-sm whitespace-nowrap">{notification.media.title}</span>
                                    )}
                                    <span className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 whitespace-nowrap">{notification.media.subtitle}</span>
                                </div>
                            </Link>
                        )}
                    </motion.div>
                ) : (
                    <motion.nav
                        key="navbar"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }} // Exit slightly up when being replaced
                        transition={{ duration: 0.3 }}
                        className={navbarClass}
                    >
                        {/* LOGO (Logout if logged in) */}
                        {spotifyId ? (
                            <a href="/logout" className="flex items-center justify-center shrink-0 p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-red-500/10 transition-colors group" title="Logout">
                                <span className="font-bold text-lg text-[#1DB954] group-hover:text-red-500 w-5 h-5 flex items-center justify-center transition-colors">P</span>
                            </a>
                        ) : (
                            <Link href="/" className="flex items-center justify-center shrink-0 p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors group">
                                <span className="font-bold text-lg text-[#1DB954] w-5 h-5 flex items-center justify-center">P</span>
                            </Link>
                        )}

                        {/* DESKTOP MENU */}
                        <div className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
                            {navLinks.map((link) => {
                                const isActive = link.name === "Dashboard"
                                    ? pathname?.startsWith("/dashboard")
                                    : link.href === "/"
                                        ? pathname === "/"
                                        : pathname?.startsWith(link.href);

                                const textClass = isActive
                                    ? "text-black dark:text-white"
                                    : "text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white";

                                if (link.children) {
                                    return (
                                        <div key={link.name} className="relative group">
                                            <button
                                                onClick={() => setDesktopDropdownOpen(desktopDropdownOpen === link.name ? null : link.name)}
                                                className={cn("flex items-center gap-1 text-sm transition-colors px-3 py-2 rounded-md relative whitespace-nowrap", textClass)}
                                            >
                                                <span className="relative flex flex-col items-center justify-center">
                                                    <span className={isActive ? "font-bold" : "font-medium"}>{link.name}</span>
                                                    <span className="font-bold invisible h-0 overflow-hidden" aria-hidden="true">{link.name}</span>
                                                </span>
                                                <ChevronDown className={cn("w-3 h-3 transition-transform duration-300", desktopDropdownOpen === link.name ? "rotate-180" : "group-hover:rotate-180")} />
                                                {isActive && (
                                                    <motion.div layoutId="navbar-active" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1DB954] rounded-full mx-3" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                                                )}
                                            </button>

                                            <div className={cn(
                                                "absolute top-full left-1/2 -translate-x-1/2 pt-4 transition-all duration-200 transform origin-top",
                                                desktopDropdownOpen === link.name
                                                    ? "opacity-100 visible translate-y-0"
                                                    : "opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-y-2 group-hover:translate-y-0"
                                            )}>
                                                <div className="bg-white/90 dark:bg-[#1e1e1e]/95 border border-black/10 dark:border-white/10 rounded-xl p-1 min-w-[140px] shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl">
                                                    {link.children.map((child) => (
                                                        <Link
                                                            key={child.name}
                                                            href={child.href}
                                                            className={cn(
                                                                "px-3 py-1.5 text-sm rounded-lg transition-colors text-left whitespace-nowrap",
                                                                pathname === child.href
                                                                    ? "text-[#1DB954] bg-black/5 dark:bg-white/5 font-semibold"
                                                                    : "text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                                                            )}
                                                        >
                                                            {child.name}
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                if (link.name === "Dashboard") {
                                    return (
                                        <Link
                                            key={link.name}
                                            href={link.href}
                                            onClick={link.onClick}
                                            className={cn("relative px-3 py-2 text-sm transition-colors rounded-md whitespace-nowrap inline-flex flex-col items-center justify-center", textClass)}
                                        >
                                            <span className="relative flex flex-col items-center justify-center">
                                                <span className={isActive ? "font-bold" : "font-medium"}>{link.name}</span>
                                                <span className="font-bold invisible h-0 overflow-hidden" aria-hidden="true">{link.name}</span>
                                            </span>
                                            {isActive && (
                                                <motion.div layoutId="navbar-active" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1DB954] rounded-full mx-3" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                                            )}
                                        </Link>
                                    );
                                }

                                return (
                                    <Link key={link.name} href={link.href} className={cn("relative px-3 py-2 text-sm transition-colors rounded-md whitespace-nowrap inline-flex flex-col items-center justify-center", textClass)}>
                                        <span className="relative flex flex-col items-center justify-center">
                                            <span className={isActive ? "font-bold" : "font-medium"}>{link.name}</span>
                                            <span className="font-bold invisible h-0 overflow-hidden" aria-hidden="true">{link.name}</span>
                                        </span>
                                        {isActive && (
                                            <motion.div layoutId="navbar-active" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1DB954] rounded-full mx-3" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* TOGGLE & MOBILE BTN */}
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="hidden md:block scale-90 md:scale-100">
                                <ThemeToggle />
                            </div>
                            <button
                                className="md:hidden p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            >
                                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                            </button>
                        </div>
                    </motion.nav>
                )}
            </AnimatePresence>

            {/* MOBILE MENU */}
            <AnimatePresence>
                {
                    isMobileMenuOpen && !notification && (
                        <motion.div
                            initial={{ opacity: 0, y: -20, backdropFilter: "blur(0px)" }}
                            animate={{ opacity: 1, y: 0, backdropFilter: "blur(16px)" }}
                            exit={{ opacity: 0, y: -20, backdropFilter: "blur(0px)" }}
                            transition={{ duration: 0.3 }}
                            className="fixed inset-0 z-40 bg-white/60 dark:bg-black/60 pt-24 px-6 md:hidden overflow-y-auto"
                        >
                            <div className="flex flex-col gap-2">
                                {/* Header / Theme Toggle inside */}
                                <div className="flex items-center justify-between mb-6 p-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 shadow-lg backdrop-blur-md">
                                    <span className="font-bold text-lg text-black dark:text-white">Appearance</span>
                                    <ThemeToggle />
                                </div>

                                {navLinks.map((link) => (
                                    <div key={link.name} className="flex flex-col">
                                        {link.children ? (
                                            <div className="rounded-2xl bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 overflow-hidden mb-2">
                                                <button
                                                    onClick={() => setMobileDropdownOpen(mobileDropdownOpen === link.name ? null : link.name)}
                                                    className="flex items-center justify-between w-full p-4 text-lg font-bold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                                >
                                                    {link.name}
                                                    <ChevronDown className={cn("w-5 h-5 transition-transform duration-300", mobileDropdownOpen === link.name ? "rotate-180" : "rotate-0")} />
                                                </button>

                                                <AnimatePresence>
                                                    {mobileDropdownOpen === link.name && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                        >
                                                            <div className="flex flex-col border-t border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20">
                                                                {link.children.map(child => (
                                                                    <Link
                                                                        key={child.name}
                                                                        href={child.href}
                                                                        onClick={() => setIsMobileMenuOpen(false)}
                                                                        className={cn(
                                                                            "px-6 py-2 text-base font-medium transition-colors",
                                                                            pathname === child.href ? "text-[#1DB954]" : "text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white"
                                                                        )}
                                                                    >
                                                                        {child.name}
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ) : (
                                            <Link
                                                href={link.href}
                                                onClick={(e) => {
                                                    if (link.onClick) link.onClick(e);
                                                    if (spotifyId || link.name !== "Dashboard") setIsMobileMenuOpen(false);
                                                }}
                                                className={cn(
                                                    "p-4 rounded-2xl mb-2 text-lg font-bold transition-all border border-white/20 dark:border-white/10",
                                                    (link.name === "Dashboard" && pathname?.startsWith("/dashboard")) || pathname === link.href
                                                        ? "bg-[#1DB954]/10 text-[#1DB954] border-[#1DB954]/20"
                                                        : "bg-white/40 dark:bg-white/5 text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5"
                                                )}
                                            >
                                                {link.name}
                                            </Link>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )
                }
            </AnimatePresence>
        </>
    );
};