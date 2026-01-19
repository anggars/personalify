"use client";

import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { cardReveal } from "@/lib/animations";

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
        className="text-center mb-4 mt-2"
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
      <div className="w-full space-y-6">
        <motion.section
          variants={cardReveal}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          className="glass-card rounded-2xl p-6 md:p-8"
        >
          <div className="space-y-6 text-neutral-700 dark:text-[#b3b3b3] leading-relaxed text-justify hyphens-auto font-medium">
            <div>
              <h2 className="text-xl font-bold text-[#1DB954] mb-2">
                1. Introduction
              </h2>
              <p>
                Welcome to Personalify. We value your privacy and are committed
                to protecting your personal data. This privacy policy explains
                how we handle your information when you use our web and mobile
                applications.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#1DB954] mb-2">
                2. Data We Collect
              </h2>
              <p>
                Personalify integrates with the Spotify API. We collect only the
                data necessary to provide our services, which includes:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  Your Spotify Profile Information (Name, ID, Profile Image).
                </li>
                <li>
                  Your Top Artists and Tracks (Short, Medium, and Long term).
                </li>
                <li>Your Recently Played Tracks and Playlists.</li>
              </ul>
              <p className="mt-2">
                We do <strong>not</strong> collect or store your Spotify login
                credentials (password). Authentication is handled securely via
                Spotify OAuth.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#1DB954] mb-2">
                3. How We Use Your Data
              </h2>
              <p>Your data is used solely to specificy:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  Generate your personalized music dashboard and insights.
                </li>
                <li>
                  Analyze the sentiment and emotions of lyrics via external APIs
                  (Genius, Sentimind).
                </li>
                <li>Verify your identity within the app.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#1DB954] mb-2">
                4. Third-Party Services
              </h2>
              <p>We use the following third-party services:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  <strong>Spotify API:</strong> For music metadata.
                </li>
                <li>
                  <strong>Genius:</strong> For lyrics content.
                </li>
                <li>
                  <strong>Vercel / Supabase / Neon:</strong> For hosting and
                  data storage.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#1DB954] mb-2">
                5. Your Rights
              </h2>
              <p>
                You can revoke Personalify's access to your Spotify account at
                any time via your{" "}
                <a
                  href="https://www.spotify.com/account/apps/"
                  className="text-[#1DB954] hover:underline"
                  target="_blank"
                >
                  Spotify Apps settings
                </a>
                . You may also request the deletion of your data stored on our
                servers by contacting us.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#1DB954] mb-2">
                6. Contact Us
              </h2>
              <p>
                If you have any questions about this Privacy Policy, please
                contact us via the social links on our About page.
              </p>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
