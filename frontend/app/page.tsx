"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { TechStackMarquee, TECH_STACK, TechIcon } from "@/components/tech-stack-marquee";
import { useRouter } from "next/navigation";
import { staggerContainer, fadeUp, scalePop, hoverScale, tapScale } from "@/lib/animations";

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const hasTyped = useRef(false);
  const [isTechStackVisible, setIsTechStackVisible] = useState(false);
  const isMobileRef = useRef(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      isMobileRef.current = window.innerWidth < 768;
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle SPA navigation for typewriter links
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A' && target.getAttribute('href')?.startsWith('/')) {
        e.preventDefault();
        router.push(target.getAttribute('href')!);
      }
    };

    const el = paragraphRef.current;
    if (el) {
      el.addEventListener('click', handleLinkClick);
      return () => el.removeEventListener('click', handleLinkClick);
    }
  }, [router]);

  // Typewriter effect for paragraph
  useEffect(() => {
    if (hasTyped.current || !paragraphRef.current) return;
    hasTyped.current = true;

    const text = `Discover your most played artists, tracks, and genres through <br class="md:hidden"/>Spotify insights. Go beyond the sound and <a href="/lyrics" class="text-[#888] hover:text-[#1DB954] transition-colors">analyze the emotion <br class="md:hidden"/>hidden in the lyrics</a>. Let's explore your unique taste in music.`;

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
          paragraphRef.current.innerHTML = currentHtml + '<span class="typing-cursor"></span>';
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

  const handleMouseMoveOrTouch = (e: React.MouseEvent<HTMLAnchorElement> | React.TouchEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
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
            width: isTechStackVisible ? (isMobileRef.current ? 180 : 240) : (isMobileRef.current ? 60 : 80),
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onMouseEnter={() => !isMobileRef.current && setIsTechStackVisible(true)}
          onMouseLeave={() => !isMobileRef.current && setIsTechStackVisible(false)}
          onClick={() => isMobileRef.current && setIsTechStackVisible(!isTechStackVisible)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className={`absolute inset-0 transition-opacity duration-300 ${isTechStackVisible ? "opacity-100" : "opacity-0"}`}>
            <TechStackMarquee isVisible={isTechStackVisible} />
          </div>

          <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isTechStackVisible ? "opacity-0" : "opacity-100"}`}>
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
      <motion.div
        variants={fadeUp}
        className="max-w-[600px]"
      >
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
            style={{ position: 'absolute' }}
            viewBox="0 0 50 50"
          >
            <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" />
          </svg>
        </motion.a>
      </motion.div>
    </motion.div>
  );
}