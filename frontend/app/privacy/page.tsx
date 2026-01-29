"use client";

import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { staggerContainerFast, cardReveal } from "@/lib/animations";

const PRIVACY_DATA = [
  {
    title: "1. Introduction",
    content: (
      <p>
        Welcome to Personalify. We value your privacy and are committed to
        protecting your personal data. This privacy policy explains how we
        handle your information when you use our web and mobile applications.
      </p>
    ),
  },
  {
    title: "2. Data We Collect",
    content: (
      <>
        <p>
          Personalify integrates with the Spotify API. We collect only the data
          necessary to provide our services, which includes:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Your Spotify Profile Information (Name, ID, Profile Image).</li>
          <li>Your Top Artists and Tracks (Short, Medium, and Long term).</li>
          <li>Your Recently Played Tracks and Playlists.</li>
        </ul>
        <p className="mt-2">
          We do <strong>not</strong> collect or store your Spotify login
          credentials (password). Authentication is handled securely via Spotify
          OAuth.
        </p>
      </>
    ),
  },
  {
    title: "3. How We Use Your Data",
    content: (
      <>
        <p>Your data is used solely to specificy:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Generate your personalized music dashboard and insights.</li>
          <li>
            Analyze the sentiment and emotions of lyrics via external APIs
            (<a href="https://genius.com/developers" target="_blank" className="hover:text-[#FFFF64] transition-colors font-semibold">Genius</a>, <a href="https://huggingface.co/" target="_blank" className="hover:text-[#FFD21E] transition-colors font-semibold">Hugging Face</a>).
          </li>
          <li>Verify your identity within the app.</li>
        </ul>
      </>
    ),
  },
  {
    title: "4. Third-Party Services",
    content: (
      <>
        <p>We use the following third-party services:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>
            <a
              href="https://developer.spotify.com/"
              className="font-semibold hover:text-[#1DB954] transition-colors"
              target="_blank"
            >
              Spotify API
            </a>
            : For music metadata.
          </li>
          <li>
            <a
              href="https://genius.com/developers"
              className="font-semibold hover:text-[#FFFF64] transition-colors"
              target="_blank"
            >
              Genius
            </a>
            : For lyrics content.
          </li>
          <li>
            <a
              href="https://vercel.com/"
              className="font-semibold hover:text-black dark:hover:text-white transition-colors"
              target="_blank"
            >
              Vercel
            </a>{" "}
            /{" "}
            <a
              href="https://supabase.com/"
              className="font-semibold hover:text-[#3ECF8E] transition-colors"
              target="_blank"
            >
              Supabase
            </a>{" "}
            /{" "}
            <a
              href="https://neon.tech/"
              className="font-semibold hover:text-[#00E599] transition-colors"
              target="_blank"
            >
              Neon
            </a>
            : For hosting and data storage.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "5. Your Rights",
    content: (
      <p>
        You can revoke Personalify's access to your Spotify account at any time
        via your{" "}
        <a
          href="https://www.spotify.com/account/apps/"
          className="font-bold transition-colors hover:text-[#1DB954]"
          target="_blank"
        >
          Spotify Apps settings
        </a>
        . You may also request the deletion of your data stored on our servers
        by contacting us.
      </p>
    ),
  },
  {
    title: "6. Contact Us",
    content: (
      <p>
        If you have any questions about this Privacy Policy, please contact us
        via the social links on our About page.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const hasTyped = useRef(false);

  // Typewriter effect
  useEffect(() => {
    if (hasTyped.current || !paragraphRef.current) return;
    hasTyped.current = true;

    const text = "Your data, your control. Full transparency.";
    let index = 0;

    function typeWriter() {
      if (index < text.length) {
        if (paragraphRef.current) {
          paragraphRef.current.innerHTML =
            text.substring(0, index + 1) +
            '<span class="typing-cursor"></span>';
        }
        index++;
        setTimeout(typeWriter, 30);
      } else {
        if (paragraphRef.current) {
          paragraphRef.current.innerHTML = text;
        }
      }
    }
    setTimeout(typeWriter, 400);
  }, []);

  return (
    <div className="page-container flex flex-col items-center w-full max-w-3xl mx-auto">
      {/* Hero Header */}
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-4 mt-1"
      >
        <h1 className="text-[2.5rem] font-extrabold text-[#1DB954] mb-2">
          Privacy Policy
        </h1>
        <p
          ref={paragraphRef}
          className="text-lg mb-3 text-neutral-500 dark:text-[#B3B3B3] font-medium"
        />
      </motion.header>

      {/* Content Sections */}
      <motion.div
        className="w-full space-y-6"
        variants={staggerContainerFast}
        initial="hidden"
        animate="show"
      >
        {PRIVACY_DATA.map((section, idx) => (
          <motion.section
            key={idx}
            variants={cardReveal}
            className="glass-card rounded-2xl p-6 md:p-6"
            whileHover={{
              y: -4,
              transition: { type: "spring", stiffness: 400, damping: 17 },
            }}
          >
            <h2 className="text-xl font-bold text-[#1DB954] border-b border-neutral-200 dark:border-[#333] pb-4 mb-3 text-center md:-mt-2">
              {section.title}
            </h2>
            <div className="text-neutral-700 dark:text-[#b3b3b3] leading-relaxed text-justify hyphens-auto font-medium">
              {section.content}
            </div>
          </motion.section>
        ))}
      </motion.div>
    </div>
  );
}
