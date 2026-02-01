"use client";

import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { staggerContainerFast, cardReveal } from "@/lib/animations";

const TERMS_DATA = [
  {
    title: "1. Acceptance of Terms",
    content: (
      <p>
        By accessing or using the Personalify web or mobile application, you
        agree to be bound by these Terms of Service. If you do not agree,
        strictly referring to these terms, please do not use our services.
      </p>
    ),
  },
  {
    title: "2. Description of Service",
    content: (
      <p>
        Personalify provides analytics and insights into your Spotify listening
        habits. We also offer lyrics analysis features. The service is provided
        "as is" and is a personal project, not an official Spotify product.
      </p>
    ),
  },
  {
    title: "3. User Conduct",
    content: (
      <>
        <p>
          You agree not to misuse the service, including but not limited to:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Attempting to bypass auth mechanisms.</li>
          <li>Scraping or harvesting data from the app.</li>
          <li>Using the app for illegal activities.</li>
        </ul>
      </>
    ),
  },
  {
    title: "4. Disclaimers",
    content: (
      <p>
        Personalify is not affiliated with, endorsed, or sponsored by{" "}
        <a
          href="https://www.spotify.com"
          target="_blank"
          className="font-semibold hover:text-[#1DB954] transition-colors"
        >
          Spotify
        </a>
        ,{" "}
        <a
          href="https://genius.com"
          target="_blank"
          className="font-semibold hover:text-[#FFFF64] transition-colors"
        >
          Genius
        </a>
        , or any other third-party API providers. We are not responsible
        for any inaccuracies in the data provided by these third parties.
      </p>
    ),
  },
  {
    title: "5. Limitations of Liability",
    content: (
      <p>
        In no event shall Personalify or its developers be liable for any
        indirect, incidental, special, consequential or punitive damages arising
        out of your use of the service.
      </p>
    ),
  },
  {
    title: "6. Changes to Terms",
    content: (
      <p>
        We reserve the right to modify these terms at any time. Your continued
        use of the service after any changes indicates your acceptance of the
        new terms.
      </p>
    ),
  },
];

export default function TermsClient() {
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const hasTyped = useRef(false);

  // Typewriter effect
  useEffect(() => {
    if (hasTyped.current || !paragraphRef.current) return;
    hasTyped.current = true;

    const text = "Rules of engagement. Fair and simple.";
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
          Terms of Service
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
        {TERMS_DATA.map((section, idx) => (
          <motion.section
            key={idx}
            variants={cardReveal}
            className="glass-card rounded-2xl p-6 md:p-6"
            whileHover={{
              y: -4,
              transition: { type: "spring", stiffness: 400, damping: 17 },
            }}
            whileTap={{
              scale: 0.98,
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
