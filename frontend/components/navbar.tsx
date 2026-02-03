"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ui/theme-toggle";
import { ChevronDown, Menu, X, CheckCircle, AlertTriangle } from "lucide-react";
import Image from "next/image";

type NotificationType = "warning" | "error" | "success" | "media" | null;

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
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState<string | null>(
    null,
  );
  const [desktopDropdownOpen, setDesktopDropdownOpen] = useState<string | null>(
    null,
  );
  const [spotifyId, setSpotifyId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  // Mount check for portal
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Update dropdown position when opened
  useEffect(() => {
    if (desktopDropdownOpen && dropdownTriggerRef.current) {
      const rect = dropdownTriggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 16,
        left: rect.left + rect.width / 2,
      });
    }
  }, [desktopDropdownOpen]);

  // Close dropdown when scroll state changes (sticky <-> floating)
  useEffect(() => {
    setDesktopDropdownOpen(null);
  }, [isScrolled]);

  // Notification State
  const [notification, setNotification] = useState<NotificationData | null>(
    null,
  );

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

    window.addEventListener(
      "personalify-notification" as any,
      handleNotification,
    );
    return () =>
      window.removeEventListener(
        "personalify-notification" as any,
        handleNotification,
      );
  }, []);

  // Get spotify_id from localStorage and sync with dashboard URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get("error");

    if (errorParam === "logged_out" || errorParam === "session_expired") {
      localStorage.removeItem("spotify_id");
      setSpotifyId(null);
      if (errorParam === "session_expired") {
        const event = new CustomEvent("personalify-notification", {
          detail: {
            type: "error",
            message: "Session expired. Please login again!",
          },
        });
        window.dispatchEvent(event);
        setTimeout(
          () =>
            window.dispatchEvent(
              new CustomEvent("personalify-notification", { detail: null }),
            ),
          4000,
        );
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
        detail: {
          type: "error",
          message: "Please login using the button on the home page!",
        },
      });
      window.dispatchEvent(event);
      setTimeout(
        () =>
          window.dispatchEvent(
            new CustomEvent("personalify-notification", { detail: null }),
          ),
        3000,
      );
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
    {
      name: "Dashboard",
      href: getDashboardHref(),
      onClick: handleDashboardClick,
    },
    {
      name: "Analyzer",
      href: "/lyrics",
      children: [
        { name: "Lyrics Analyzer", href: "/lyrics" },
        { name: "Genius Analyzer", href: "/lyrics/genius" },
      ],
    },
    { name: "About", href: "/about" },
  ];

  const navbarClass = cn(
    "fixed left-1/2 -translate-x-1/2 z-50 flex items-center justify-between",
    "transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] will-change-[width,top,background,border-radius]",
    isScrolled
      ? "top-4 w-[calc(100%-3rem)] md:w-[44rem] rounded-2xl bg-white/25 dark:bg-[#1e1e1e]/25 backdrop-blur-xl border border-black/10 dark:border-white/10 navbar-floating-glass px-4 py-3"
      : "top-0 w-full px-4 py-3 bg-transparent border-b border-black/5 dark:border-white/5",
  );

  const notificationContainerClass = cn(
    "fixed left-1/2 -translate-x-1/2 z-[100]", // Higher z-index than navbar
    isScrolled ? "top-4" : "top-4", // Consistent top position feels best for toasts
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty(
      "--mouse-x",
      `${e.clientX - rect.left}px`,
    );
    e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  return (
    <>
      <AnimatePresence>
        {notification ? (
          <motion.div
            key={
              notification.type === "media"
                ? notification.media?.title
                : notification.message
            }
            initial={{ opacity: 0, y: -20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.92, position: "absolute" }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={cn(
              notificationContainerClass,
              "toast-glass backdrop-blur-md shadow-2xl rounded-xl overflow-hidden transform-gpu",
              "border border-white/10 dark:border-white/8",
              "[box-shadow:inset_0_1px_2px_0_rgba(255,255,255,0.15),inset_0_1px_1px_0_rgba(255,255,255,0.2),0_4px_15px_rgba(0,0,0,0.3)]",
              "dark:[box-shadow:inset_0_1px_2px_0_rgba(255,255,255,0.15),inset_0_1px_1px_0_rgba(255,255,255,0.2),0_4px_15px_rgba(0,0,0,0.3)]",
              notification.type === "warning"
                ? "bg-white/10 dark:bg-white/1.5 text-yellow-600 dark:text-yellow-400"
                : notification.type === "error"
                  ? "bg-white/10 dark:bg-white/1.5 text-red-600 dark:text-red-400"
                  : notification.type === "success"
                    ? "bg-[#1DB954]/20 text-[#1DB954]"
                    : "bg-white/10 dark:bg-white/1.5 hover:scale-105 transition-transform duration-300",
            )}
          >
            {(notification.type === "warning" ||
              notification.type === "error" ||
              notification.type === "success") && (
                <div className="px-6 py-3 font-bold text-sm whitespace-nowrap flex items-center gap-2">
                  {notification.type === "success" && (
                    <CheckCircle size={14} className="relative bottom-px" />
                  )}
                  {notification.type === "error" && (
                    <AlertTriangle size={14} className="relative bottom-px" />
                  )}
                  {notification.type === "warning" && (
                    <AlertTriangle size={14} className="relative bottom-px" />
                  )}
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
                <div
                  className={cn(
                    "relative shrink-0 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 shadow-inner",
                    notification.media.title.includes("Tuning")
                      ? "w-[88px] h-[50px]"
                      : "w-12 h-12",
                  )}
                >
                  <Image
                    src={notification.media.imgSrc}
                    alt={notification.media.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  {notification.media.isMarquee ? (
                    <div className="w-[160px] overflow-hidden whitespace-nowrap mask-gradient">
                      <div className="animate-marquee inline-block">
                        <span className="font-bold text-black dark:text-white text-sm mr-4">
                          {notification.media.title}
                        </span>
                        <span className="font-bold text-black dark:text-white text-sm">
                          {notification.media.title}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="font-bold text-black dark:text-white text-sm whitespace-nowrap">
                      {notification.media.title}
                    </span>
                  )}
                  <span className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 whitespace-nowrap">
                    {notification.media.subtitle}
                  </span>
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
              <a
                href="/logout"
                className="flex items-center justify-center shrink-0 p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-red-500/10 transition-colors group"
                title="Logout"
              >
                <span className="font-bold text-lg text-[#1DB954] group-hover:text-red-500 w-5 h-5 flex items-center justify-center transition-colors">
                  P
                </span>
              </a>
            ) : (
              <Link
                href="/"
                className="flex items-center justify-center shrink-0 p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors group"
              >
                <span className="font-bold text-lg text-[#1DB954] w-5 h-5 flex items-center justify-center">
                  P
                </span>
              </Link>
            )}

            {/* DESKTOP MENU */}
            <div
              className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2"
              onMouseLeave={() => setHoveredPath(null)}
            >
              {navLinks.map((link) => {
                const isActive =
                  link.name === "Dashboard"
                    ? pathname?.startsWith("/dashboard")
                    : link.href === "/"
                      ? pathname === "/"
                      : pathname?.startsWith(link.href);

                const isHovered = hoveredPath === link.href;

                // The pill should show if this item is hovered OR (no item is hovered AND this item is active)
                const showPill = hoveredPath ? isHovered : isActive;

                const textClass = isActive
                  ? "text-black dark:text-white"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white";

                if (link.children) {
                  return (
                    <div key={link.name} className="relative group">
                      <button
                        ref={dropdownTriggerRef}
                        onClick={() =>
                          setDesktopDropdownOpen(
                            desktopDropdownOpen === link.name
                              ? null
                              : link.name,
                          )
                        }
                        onMouseEnter={() => {
                          setHoveredPath(link.href);
                          if (dropdownTriggerRef.current) {
                            const rect =
                              dropdownTriggerRef.current.getBoundingClientRect();
                            setDropdownPosition({
                              top: rect.bottom + 12,
                              left: rect.left + rect.width / 2,
                            });
                          }
                          setDesktopDropdownOpen(link.name);
                        }}
                        onMouseLeave={() => {
                          setTimeout(() => {
                            const dropdown = document.getElementById(
                              "navbar-dropdown-portal",
                            );
                            if (dropdown && !dropdown.matches(":hover")) {
                              setDesktopDropdownOpen(null);
                            }
                          }, 100);
                        }}
                        className={cn(
                          "flex items-center gap-1 text-sm transition-colors px-3 py-2 rounded-md relative whitespace-nowrap",
                          textClass,
                        )}
                      >
                        <span className="relative flex flex-col items-center justify-center">
                          <span
                            className={isActive ? "font-bold" : "font-medium"}
                          >
                            {link.name}
                          </span>
                          <span
                            className="font-bold invisible h-0 overflow-hidden"
                            aria-hidden="true"
                          >
                            {link.name}
                          </span>
                        </span>
                        <ChevronDown
                          className={cn(
                            "w-3 h-3 transition-transform duration-300",
                            desktopDropdownOpen === link.name
                              ? "rotate-180"
                              : "group-hover:rotate-180",
                          )}
                        />
                        {showPill && (
                          <motion.div
                            layoutId="navbar-active"
                            className="absolute inset-0 bg-black/5 dark:bg-white/5 rounded-md -z-10"
                            transition={{
                              type: "spring",
                              stiffness: 380,
                              damping: 30,
                            }}
                          />
                        )}
                      </button>

                      {/* Portal dropdown to body for proper backdrop-filter */}
                      {isMounted &&
                        desktopDropdownOpen === link.name &&
                        dropdownPosition &&
                        createPortal(
                          <div
                            id="navbar-dropdown-portal"
                            className="fixed z-10000 transition-all duration-200 ease-out"
                            style={{
                              top: dropdownPosition.top,
                              left: dropdownPosition.left,
                              transform: "translateX(-50%)",
                            }}
                            onMouseEnter={() =>
                              setDesktopDropdownOpen(link.name)
                            }
                            onMouseLeave={() => setDesktopDropdownOpen(null)}
                          >
                            <div className="bg-white/25 dark:bg-[#1e1e1e]/25 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-xl p-1.5 min-w-[140px] flex flex-col gap-0.5 overflow-hidden navbar-floating-glass">
                              {link.children.map((child) => (
                                <Link
                                  key={child.name}
                                  href={child.href}
                                  onClick={() => setDesktopDropdownOpen(null)}
                                  className={cn(
                                    "px-3 py-2 text-sm rounded-lg transition-all duration-200 text-center whitespace-nowrap font-medium",
                                    pathname === child.href
                                      ? "text-[#1DB954] bg-[#1DB954]/10 font-semibold"
                                      : "text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5",
                                  )}
                                >
                                  {child.name}
                                </Link>
                              ))}
                            </div>
                          </div>,
                          document.body,
                        )}
                    </div>
                  );
                }

                if (link.name === "Dashboard") {
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={link.onClick}
                      onMouseEnter={() => setHoveredPath(link.href)}
                      className={cn(
                        "relative px-3 py-2 text-sm transition-colors rounded-md whitespace-nowrap inline-flex flex-col items-center justify-center",
                        textClass,
                      )}
                    >
                      <span className="relative flex flex-col items-center justify-center">
                        <span
                          className={isActive ? "font-bold" : "font-medium"}
                        >
                          {link.name}
                        </span>
                        <span
                          className="font-bold invisible h-0 overflow-hidden"
                          aria-hidden="true"
                        >
                          {link.name}
                        </span>
                      </span>
                      {showPill && (
                        <motion.div
                          layoutId="navbar-active"
                          className="absolute inset-0 bg-black/5 dark:bg-white/5 rounded-md -z-10"
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 30,
                          }}
                        />
                      )}
                    </Link>
                  );
                }

                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    onMouseEnter={() => setHoveredPath(link.href)}
                    className={cn(
                      "relative px-3 py-2 text-sm transition-colors rounded-md whitespace-nowrap inline-flex flex-col items-center justify-center",
                      textClass,
                    )}
                  >
                    <span className="relative flex flex-col items-center justify-center">
                      <span className={isActive ? "font-bold" : "font-medium"}>
                        {link.name}
                      </span>
                      <span
                        className="font-bold invisible h-0 overflow-hidden"
                        aria-hidden="true"
                      >
                        {link.name}
                      </span>
                    </span>
                    {showPill && (
                      <motion.div
                        layoutId="navbar-active"
                        className="absolute inset-0 bg-black/5 dark:bg-white/5 rounded-md -z-10"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
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
        {isMobileMenuOpen && !notification && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col h-full overflow-hidden bg-white/80 dark:bg-[#121212]/80 backdrop-blur-xl"
          >
            {/* Header - Static, no animation */}
            <div
              className={cn(
                "flex items-center justify-between shrink-0 transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]",
                isScrolled
                  ? "mt-4 w-[calc(100%-3rem)] md:w-176 mx-auto rounded-2xl px-4 py-3 border border-black/10 dark:border-white/10"
                  : "w-full px-4 py-3 border-b border-black/5 dark:border-white/5",
              )}
            >
              {/* Same Logo Logic */}
              {spotifyId ? (
                <div className="flex items-center justify-center shrink-0 p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                  <span className="font-bold text-lg text-[#1DB954] w-5 h-5 flex items-center justify-center">
                    P
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center shrink-0 p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                  <span className="font-bold text-lg text-[#1DB954] w-5 h-5 flex items-center justify-center">
                    P
                  </span>
                </div>
              )}

              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Animated Content Area - Bouncy open, curtain close */}
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 35,
                mass: 1,
              }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Main Navigation (Centered) */}
              <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full px-6 overflow-y-auto no-scrollbar py-6">
                {navLinks.map((link) => (
                  <div
                    key={link.name}
                    className="flex flex-col items-center w-full"
                  >
                    {link.children ? (
                      <div className="flex flex-col items-center w-full">
                        <button
                          onClick={() =>
                            setMobileDropdownOpen(
                              mobileDropdownOpen === link.name
                                ? null
                                : link.name,
                            )
                          }
                          className={cn(
                            "text-[1.75rem] transition-colors flex items-center justify-center gap-2",
                            mobileDropdownOpen === link.name
                              ? "text-[#1DB954] font-extrabold"
                              : "text-black dark:text-white font-bold hover:text-neutral-500 dark:hover:text-neutral-300",
                          )}
                        >
                          {link.name}
                          <ChevronDown
                            className={cn(
                              "w-8 h-8 transition-transform duration-300",
                              mobileDropdownOpen === link.name
                                ? "rotate-180"
                                : "rotate-0",
                            )}
                          />
                        </button>

                        <AnimatePresence>
                          {mobileDropdownOpen === link.name && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="overflow-hidden w-full flex flex-col items-center"
                            >
                              <div className="flex flex-col items-center gap-4 pt-6 pb-2">
                                {link.children.map((child) => (
                                  <Link
                                    key={child.name}
                                    href={child.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={cn(
                                      "text-2xl font-medium transition-colors",
                                      pathname === child.href
                                        ? "text-[#1DB954]"
                                        : "text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white",
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
                          if (spotifyId || link.name !== "Dashboard")
                            setIsMobileMenuOpen(false);
                        }}
                        className={cn(
                          "text-[1.75rem] transition-colors relative block",
                          (link.name === "Dashboard" &&
                            pathname?.startsWith("/dashboard")) ||
                            pathname === link.href
                            ? "text-[#1DB954] font-extrabold"
                            : "text-black dark:text-white font-bold hover:text-neutral-500 dark:hover:text-neutral-300",
                        )}
                      >
                        {link.name}
                      </Link>
                    )}
                  </div>
                ))}

                {/* Theme Toggle */}
                <div className="mt-8 flex flex-col items-center gap-3">
                  <ThemeToggle />
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
                    Appearance
                  </span>
                </div>
              </div>

              {/* Copyright Footer (Simple) */}
              <div className="p-8 flex flex-col items-center gap-4 mt-auto shrink-0">
                <span className="text-xs text-neutral-500 font-medium">
                  Personalify © {new Date().getFullYear()}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};