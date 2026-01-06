"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const hasTyped = useRef(false);



  // Typewriter effect for paragraph
  useEffect(() => {
    if (hasTyped.current || !paragraphRef.current) return;
    hasTyped.current = true;

    // Use <br class="md:hidden"/> to force 3 lines on mobile only
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

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--mouse-x", `${x}%`);
    el.style.setProperty("--mouse-y", `${y}%`);
  };

  const handleLoginClick = () => {
    setIsLoading(true);
  };

  return (
    <div className="page-container mobile-fullscreen flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center">


      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <Image
          src="/assets/Spotify_Primary_Logo_RGB_Green.ico"
          alt="Personalify Logo"
          width={80}
          height={80}
          className="mb-5 max-md:w-[60px] max-md:h-[60px]"
          priority
        />
      </motion.div>

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="max-w-[600px]"
      >
        <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4">
          Welcome to <span className="text">Personalify</span>!
        </h1>

        <p
          ref={paragraphRef}
          className="text-[2.8vw] md:text-xl text-muted-foreground font-medium leading-relaxed mb-8 tracking-tight"
        />
      </motion.div>

      {/* Login Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <a
          href="/login"
          onClick={handleLoginClick}
          onMouseMove={handleMouseMove}
          className={`btn-glass group rounded-2xl ${isLoading ? "pointer-events-none" : ""}`}
        >
          <span
            className={`relative -top-px transition-opacity duration-200 ${isLoading ? "opacity-0" : "opacity-100"
              }`}
          >
            Login with Spotify
          </span>
          <svg
            className={`absolute top-1/2 left-1/2 -ml-[9px] -mt-[9px] w-[18px] h-[18px] transition-opacity duration-200 spinner-svg ${isLoading ? "opacity-100" : "opacity-0"
              }`}
            viewBox="0 0 50 50"
          >
            <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" />
          </svg>
        </a>
      </motion.div>
    </div>
  );
}
