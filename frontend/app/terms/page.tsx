"use client";

import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { cardReveal } from "@/lib/animations";

export default function TermsPage() {
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
        className="text-center mb-4 mt-2"
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
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing or using the Personalify web or mobile application,
                you agree to be bound by these Terms of Service. If you do not
                agree, strictly referring to these terms, please do not use our
                services.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#1DB954] mb-2">
                2. Description of Service
              </h2>
              <p>
                Personalify provides analytics and insights into your Spotify
                listening habits. We also offer lyrics analysis features. The
                service is provided "as is" and is a personal project, not an
                official Spotify product.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#1DB954] mb-2">
                3. User Conduct
              </h2>
              <p>
                You agree not to misuse the service, including but not limited
                to:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Attempting to bypass auth mechanisms.</li>
                <li>Scraping or harvesting data from the app.</li>
                <li>Using the app for illegal activities.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#1DB954] mb-2">
                4. Disclaimers
              </h2>
              <p>
                Personalify is not affiliated with, endorsed, or sponsored by
                Spotify, Genius, or any other third-party API providers. We are
                not responsible for any inaccuracies in the data provided by
                these third parties.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#1DB954] mb-2">
                5. Limitations of Liability
              </h2>
              <p>
                In no event shall Personalify or its developers be liable for
                any indirect, incidental, special, consequential or punitive
                damages arising out of your use of the service.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#1DB954] mb-2">
                6. Changes to Terms
              </h2>
              <p>
                We reserve the right to modify these terms at any time. Your
                continued use of the service after any changes indicates your
                acceptance of the new terms.
              </p>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
