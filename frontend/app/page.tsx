"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  TechStackMarquee,
  TECH_STACK,
  TechIcon,
} from "@/components/tech-stack-marquee";
import { useRouter, useSearchParams } from "next/navigation";
import {
  staggerContainer,
  fadeUp,
  scalePop,
  hoverScale,
  tapScale,
} from "@/lib/animations";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const [isLoading, setIsLoading] = useState(false);
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const hasTyped = useRef(false);
  const [isTechStackVisible, setIsTechStackVisible] = useState(false);

  const isMobileRef = useRef(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--mouse-x", `${x}%`);
    el.style.setProperty("--mouse-y", `${y}%`);
  };

  // Request Access State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const showToast = (message: string, type: "success" | "error") => {
    const event = new CustomEvent("personalify-notification", {
      detail: { type, message },
    });
    window.dispatchEvent(event);
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("personalify-notification", { detail: null }),
      );
    }, 3000);
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestName || !requestEmail) return;
    setIsRequesting(true);
    try {
      const res = await fetch("/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: requestName, email: requestEmail }),
      });
      if (res.ok) {
        showToast("Request sent!", "success");
        setShowRequestModal(false);
        setRequestName("");
        setRequestEmail("");
      } else {
        showToast("Failed to send request.", "error");
      }
    } catch (err) {
      showToast("Error sending request.", "error");
    } finally {
      setIsRequesting(false);
    }
  };

  // Auto-open modal if access_denied
  useEffect(() => {
    if (authError === "access_denied") {
      setShowRequestModal(true);
    }
  }, [authError]);

  // Auto-redirect if already logged in
  useEffect(() => {
    const storedId = localStorage.getItem("spotify_id");
    if (storedId && !authError) {
      showToast("Already logged in! Redirecting to profile...", "success");
      router.push("/profile");
    }
  }, [router, authError]);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      isMobileRef.current = window.innerWidth < 768;
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle SPA navigation for typewriter links
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "A" &&
        target.getAttribute("href")?.startsWith("/")
      ) {
        e.preventDefault();
        router.push(target.getAttribute("href")!);
      }
    };

    const el = paragraphRef.current;
    if (el) {
      el.addEventListener("click", handleLinkClick);
      return () => el.removeEventListener("click", handleLinkClick);
    }
  }, [router]);

  // Typewriter effect for paragraph
  useEffect(() => {
    if (hasTyped.current || !paragraphRef.current) return;
    hasTyped.current = true;

    const text = `Discover your most played artists, tracks, and genres through <br class="md:hidden"/>Spotify insights. Go beyond the sound and <a href="/lyrics" class="text-[#888] hover:text-[#1DB954] transition-colors">analyze the essence <br class="md:hidden"/>hidden in the lyrics</a>. Let's explore your unique taste in music.`;

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
        if (paragraphRef.current) {
          paragraphRef.current.innerHTML =
            currentHtml + '<span class="typing-cursor"></span>';
        }
        setTimeout(typeWriter, 20);
      } else {
        if (paragraphRef.current) {
          paragraphRef.current.innerHTML = currentHtml;
        }
      }
    }

    // Start after a small delay
    setTimeout(typeWriter, 500);
  }, []);

  const handleMouseMoveOrTouch = (
    e:
      | React.MouseEvent<HTMLAnchorElement>
      | React.TouchEvent<HTMLAnchorElement>,
  ) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    let clientX, clientY;

    if ("touches" in e) {
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

  const handleLoginClick = () => {
    setIsLoading(true);
  };

  return (
    <motion.div
      className="page-container flex flex-col items-center justify-center flex-1 text-center"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Logo */}
      <motion.div
        variants={fadeUp}
        className="relative mb-5 flex justify-center"
      >
        <motion.div
          className="relative h-[80px] max-md:h-[60px] rounded-full overflow-hidden cursor-pointer"
          animate={{
            width: isTechStackVisible
              ? isMobileRef.current
                ? 180
                : 240
              : isMobileRef.current
                ? 60
                : 80,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onMouseEnter={() =>
            !isMobileRef.current && setIsTechStackVisible(true)
          }
          onMouseLeave={() =>
            !isMobileRef.current && setIsTechStackVisible(false)
          }
          onClick={() =>
            isMobileRef.current && setIsTechStackVisible(!isTechStackVisible)
          }
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
        >
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${isTechStackVisible ? "opacity-100" : "opacity-0"}`}
          >
            <TechStackMarquee isVisible={isTechStackVisible} />
          </div>

          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isTechStackVisible ? "opacity-0" : "opacity-100"}`}
          >
            <div className="w-full h-full p-0 flex items-center justify-center">
              <img
                src="https://cdn.simpleicons.org/spotify/1DB954"
                alt="Spotify"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Hero Section */}
      <motion.div variants={fadeUp} className="max-w-[600px]">
        <motion.h1
          className="text-4xl md:text-5xl font-extrabold text-foreground mb-4"
          variants={fadeUp}
        >
          Welcome to <span className="text">Personalify</span>!
        </motion.h1>

        <p
          ref={paragraphRef}
          className="text-[2.8vw] md:text-xl text-muted-foreground font-medium leading-relaxed mb-6 tracking-tight"
        />
      </motion.div>

      {/* Login Button */}
      <motion.div variants={scalePop}>
        <motion.a
          href="/login"
          onClick={handleLoginClick}
          onMouseMove={handleMouseMoveOrTouch}
          onTouchMove={handleMouseMoveOrTouch}
          className={`btn-glass group rounded-2xl ${isLoading ? "pointer-events-none" : ""}`}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <span
            className={`transition-opacity duration-200 ${isLoading ? "opacity-0" : "opacity-100"
              }`}
          >
            Login with Spotify
          </span>
          <svg
            className={`absolute top-1/2 left-1/2 -ml-3 -mt-3 w-6 h-6 transition-opacity duration-200 spinner-svg ${isLoading ? "opacity-100" : "opacity-0"
              }`}
            style={{ position: "absolute" }}
            viewBox="0 0 50 50"
          >
            <circle
              className="spinner-path"
              cx="25"
              cy="25"
              r="20"
              fill="none"
            />
          </svg>
        </motion.a>
      </motion.div>

      {/* Request Access Button - Condition: Show ONLY if error exists */}
      {authError === "access_denied" && (
        <motion.div variants={scalePop} className="mt-6 text-center">
          <p className="text-red-400 text-xs mb-1">
            Login failed! Not registered?
          </p>
          <button
            onClick={() => setShowRequestModal(true)}
            className="text-white/50 text-xs hover:text-white transition-colors cursor-pointer"
          >
            Request Access (Dev Mode)
          </button>
        </motion.div>
      )}

      {/* Request Access Modal */}
      <AnimatePresence>
        {showRequestModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative glass-card rounded-3xl p-8 w-full max-w-sm shadow-2xl transition-all"
            >
              <h2 className="text-2xl font-bold text-white mb-2 text-center tracking-tight">
                Request Access
              </h2>
              <p className="text-white/60 text-sm mb-6 text-center leading-relaxed">
                Spotify dev mode restriction.
                <br />
                Enter details to get whitelisted!
              </p>

              <form
                onSubmit={handleRequestSubmit}
                className="flex flex-col gap-4"
              >
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={requestName}
                    onChange={(e) => setRequestName(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#1DB954]/50 focus:ring-1 focus:ring-[#1DB954]/50 transition-all font-medium"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Spotify Email Address"
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#1DB954]/50 focus:ring-1 focus:ring-[#1DB954]/50 transition-all font-medium"
                    required
                  />
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    onMouseMove={handleMouseMove}
                    className="btn-glass-red flex-1 py-3 rounded-xl text-red-500 font-bold text-sm tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRequesting}
                    onMouseMove={handleMouseMove}
                    className="btn-glass flex-1 py-3 rounded-xl text-white font-bold text-sm tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {isRequesting ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      "Send Request"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
