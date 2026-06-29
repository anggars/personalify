"use client";

import React, { useState, useRef, useEffect, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, X, Music, AlertCircle } from "lucide-react";
import { WaveformPlayer } from "../../components/waveform-player";
import {
  staggerContainer,
  fadeUp,
  cardReveal,
  staggerContainerFast,
  listItem,
} from "@/lib/animations";
import { AnalyzerResult } from "./actions";

// MBTI Connectors mapping for Math Rock / Midwest Emo theme
const MBTI_CONNECTORS: Record<string, string> = {
  INTJ: "the calculated complexity of an", INTP: "the noodly abstraction of an",
  ENTJ: "the aggressive time signatures of an", ENTP: "the chaotic tapping of an",
  INFJ: "the deep emotional resonance of an", INFP: "the nostalgic whining of an",
  ENFJ: "the expressive warmth of an", ENFP: "the twinkly exuberance of an",
  ISTJ: "the tight rhythm section of an", ISFJ: "the earnest confession of an",
  ESTJ: "the driving force of an", ESFJ: "the melodic heart of an",
  ISTP: "the technical riffage of an", ISFP: "the raw emotion of an",
  ESTP: "the energetic groove of an", ESFP: "the frantic pulse of an",
};

export default function AnalyzerPage() {
  const [lyrics, setLyrics] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AnalyzerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
    }
  }, [audioFile]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const hasTyped = useRef(false);

  // Typewriter effect for subtitle
  useEffect(() => {
    if (hasTyped.current || !subtitleRef.current) return;
    hasTyped.current = true;

    const text = 'Discover the intricate riffs and odd time signatures of your music';
    let index = 0;
    let currentHtml = "";

    function typeWriter() {
      if (index < text.length) {
        currentHtml += text.charAt(index);
        index++;
        if (subtitleRef.current) {
          subtitleRef.current.innerHTML = currentHtml + '<span class="typing-cursor"></span>';
        }
        setTimeout(typeWriter, 30);
      } else {
        if (subtitleRef.current) {
          subtitleRef.current.innerHTML = currentHtml;
        }
      }
    }
    typeWriter();
  }, []);

  // Glow effect on mouse move
  const handleMouseMoveOrTouch = (e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
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

  const dispatchError = (message: string) => {
    setError(message);
    window.dispatchEvent(
      new CustomEvent("personalify-notification", {
        detail: { type: "error", message },
      })
    );
    setTimeout(() => {
      setError(null);
      window.dispatchEvent(
        new CustomEvent("personalify-notification", { detail: null })
      );
    }, 5000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
       if (file.size > 50 * 1024 * 1024) {
         dispatchError("Audio file is too large. Maximum size is 50MB.");
         return;
       }
       setAudioFile(file);
       
       // Auto-fetch lyrics
       const fetchLyrics = async () => {
         setIsFetchingLyrics(true);
         try {
           const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
           const response = await fetch(`${API_URL}/api/genius/fetch-by-filename?filename=${encodeURIComponent(file.name)}`);
           if (response.ok) {
             const data = await response.json();
             if (data.lyrics) {
               setLyrics(data.lyrics);
             }
           }
         } catch (e) {
           console.error("Failed to auto-fetch lyrics:", e);
         } finally {
           setIsFetchingLyrics(false);
         }
       };
       fetchLyrics();
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening file dialog
    setAudioFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.includes("audio") || file.name.match(/\.(wav|mp3)$/i))) {
        if (file.size > 50 * 1024 * 1024) {
            dispatchError("Audio file is too large. Maximum size is 50MB.");
            return;
        }
        setAudioFile(file);
    } else if(file) {
        dispatchError("Invalid file type. Please upload an audio file (.wav or .mp3).");
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!audioFile && !lyrics.trim()) {
      dispatchError("Please provide an audio file or lyrics to analyze.");
      return;
    }

    setError(null);
    setResult(null);

    startTransition(async () => {
      const formData = new FormData();
      if (audioFile) formData.append("audio", audioFile);
      if (lyrics.trim()) formData.append("lyrics", lyrics.trim());

      try {
        const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const response = await fetch(`${NEXT_PUBLIC_API_URL}/api/analyze-multimodal`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          dispatchError(errorData.detail || "Analysis failed.");
        } else {
          const res = await response.json();
          if (res.success && res.data) {
            if (res.data.error) {
                dispatchError(res.data.error);
            } else {
                setResult(res.data);
            }
          } else if (res.error) {
            dispatchError(res.error);
          } else {
            dispatchError("Failed to parse analysis results.");
          }
        }
      } catch (err) {
        console.error(err);
        dispatchError("Network error occurred during analysis.");
      }
    });
  };

  const formatProbabilities = (dict: Record<string, number>) => {
      return Object.entries(dict)
        .map(([label, score]) => ({ label, score }))
        .sort((a, b) => b.score - a.score);
  };

  const mbtiList = result ? formatProbabilities(result.mbti) : [];
  const emotionsList = result ? formatProbabilities(result.emotions) : [];

  return (
    <motion.div
      className="page-container flex flex-col w-full max-w-3xl mx-auto flex-1"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.header variants={fadeUp} className="text-center mt-1 mb-4 flex-none px-4">
        <h1 className="text-[2.5rem] font-extrabold text-[#1DB954] mb-2">
          Math Rock Analyzer
        </h1>
        <p
          ref={subtitleRef}
          className="text-lg mb-3 text-neutral-500 dark:text-[#B3B3B3] font-medium min-h-[1.5em]"
        />
      </motion.header>

      <div className="flex flex-col w-full flex-1 justify-center">
        <motion.div 
            variants={cardReveal}
            className="w-full glass-card rounded-2xl p-5 md:p-6"
            whileHover={{ y: -4, transition: { type: "spring", stiffness: 400, damping: 17 } }}
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Audio Upload Dropzone */}
              <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className={`
                      relative border-2 border-dashed rounded-xl p-4 md:p-6 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[120px] md:min-h-[140px] text-center
                      ${audioFile 
                          ? 'border-neutral-600 bg-white/3' 
                          : 'border-neutral-700 hover:border-neutral-500 hover:bg-white/5'}
                  `}
              >
                  <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept="audio/wav,audio/mpeg,audio/mp3" 
                      className="hidden" 
                  />
                  
                  <AnimatePresence mode="wait">
                      {audioFile ? (
                          <motion.div 
                              key="has-file"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className="flex flex-col items-center gap-3 w-full"
                          >
                              {!audioUrl && (
                                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#1DB954]/20 flex items-center justify-center mb-2">
                                      <Music className="w-5 h-5 md:w-6 md:h-6 text-[#1DB954]" />
                                  </div>
                              )}
                              {audioUrl && (
                                  <div className="w-full max-w-2xl px-2 md:px-4">
                                      <WaveformPlayer 
                                        audioUrl={audioUrl} 
                                        filename={audioFile.name.replace(/\.[^/.]+$/, "").replace(/^(SpotiDownloader\.com\s*-\s*|\[.*?\]\s*-\s*|y2mate\.com\s*-\s*)/i, "")}
                                        fileSize={audioFile.size}
                                      />
                                  </div>
                              )}
                              <button 
                                  type="button" 
                                  onClick={clearFile}
                                  className="absolute top-2 right-2 md:top-3 md:right-3 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
                              >
                                  <X className="w-4 h-4" />
                              </button>
                          </motion.div>
                      ) : (
                          <motion.div 
                              key="no-file"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className="flex flex-col items-center gap-2 text-neutral-400"
                          >
                              <UploadCloud className="w-8 h-8 md:w-10 md:h-10 mb-1 opacity-70" />
                              <p className="text-sm font-medium">Click or drag an audio file here</p>
                              <p className="text-[11px] opacity-70">
                                  WAV or MP3 (Max 50MB) &bull; <span className="text-neutral-400 font-medium opacity-100">For Emotional State (Multimodal)</span>
                              </p>
                          </motion.div>
                      )}
                  </AnimatePresence>
              </div>

              {/* Lyrics Textarea */}
              <div className="relative w-full">
                <textarea
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder={
                    isFetchingLyrics 
                      ? `Fetching lyrics for ${audioFile?.name.replace(/\.[^/.]+$/, "")}...`
                      : audioFile 
                        ? `Paste the lyrics for ${audioFile.name.replace(/\.[^/.]+$/, "")} here...` 
                        : "Paste the song lyrics here..."
                  }
                  className="w-full min-h-[120px] md:min-h-[140px] py-2 px-4 pb-7 rounded-xl border border-neutral-200 dark:border-[#282828] bg-white dark:bg-[#181818] text-neutral-900 dark:text-[#cccccc] placeholder:text-neutral-500 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/20 transition-all custom-scrollbar resize-none leading-relaxed text-[0.95rem] font-light tracking-wide"
                />
                {!lyrics.trim() && (
                  <span className="absolute bottom-3 right-4 text-[10px] text-neutral-400 dark:text-neutral-500 font-medium pointer-events-none">
                      For MBTI Personality (Text Only)
                  </span>
                )}
              </div>



              <button
                type="submit"
                onMouseMove={handleMouseMoveOrTouch}
                onTouchMove={handleMouseMoveOrTouch}
                disabled={isPending}
                className={`btn-glass w-full group min-h-[46px] mt-1 ${isPending ? "pointer-events-none" : ""} ${(!audioFile && !lyrics.trim()) ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span className={`relative -top-px transition-opacity duration-200 ${isPending ? "opacity-0" : "opacity-100"}`}>
                  Analyze Track
                </span>
                {isPending && (
                    <svg
                        className="absolute top-1/2 left-1/2 -ml-3 -mt-3 w-6 h-6 spinner-svg"
                        style={{ position: 'absolute' }}
                        viewBox="0 0 50 50"
                    >
                        <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" />
                    </svg>
                )}
              </button>
            </form>

            {/* Results Section */}
            {result && !isPending && (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 24 }}
                    className="mt-6 pt-6 border-t border-[#282828]"
                >
                    <h3 className="text-center text-[#1DB954] font-bold text-lg mb-4 mt-0">
                        Analysis Results:
                    </h3>
                    
                    {/* Emotion Breakdown */}
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-neutral-400 mb-3 text-center">Emotional State (Multimodal)</h4>
                        <motion.div 
                            className="flex flex-col gap-2"
                            variants={staggerContainerFast}
                            initial="hidden"
                            animate="show"
                        >
                            {emotionsList.length === 0 ? (
                                <p className="text-center text-neutral-400">No emotional data returned.</p>
                            ) : (
                                emotionsList.slice(0, 5).map((e, idx) => {
                                    const maxScore = Math.max(...emotionsList.map(em => em.score));
                                    const percent = (e.score * 100).toFixed(1);
                                    const widthPercent = ((e.score / maxScore) * 100).toFixed(1);

                                    return (
                                        <motion.div key={idx} variants={listItem} className="flex items-center gap-2 w-full">
                                            <span className="font-bold text-neutral-800 dark:text-white capitalize text-sm whitespace-nowrap min-w-fit">
                                                {e.label}
                                            </span>
                                            <div className="emotion-bar-bg flex-1">
                                                <motion.div
                                                    className="emotion-bar"
                                                    initial={{ scaleX: 0 }}
                                                    animate={{ scaleX: 1 }}
                                                    transition={{ type: "spring", stiffness: 100, damping: 15, delay: idx * 0.05 }}
                                                    style={{ width: `${widthPercent}%`, transformOrigin: 'left' }}
                                                />
                                            </div>
                                            <span className="min-w-fit text-right text-neutral-500 dark:text-[#b3b3b3] text-sm font-medium whitespace-nowrap">
                                                {percent}%
                                            </span>
                                        </motion.div>
                                    );
                                })
                            )}
                        </motion.div>
                    </div>

                    {/* MBTI Personality Sentence */}
                    {mbtiList.length > 0 && (
                        <div className="mt-8">
                            <h4 className="text-sm font-semibold text-neutral-400 mb-3 text-center">Predicted MBTI (Text Only)</h4>
                            <motion.p
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.3 }}
                                className="text-center text-sm text-neutral-500 dark:text-[#888] mb-0 font-medium"
                            >
                                This track holds {MBTI_CONNECTORS[mbtiList[0].label] || "the essence of an"}{" "}
                                <span className="text-[#1DB954] font-bold">{mbtiList[0].label}</span>
                                {" "}({(mbtiList[0].score * 100).toFixed(1)}%)
                            </motion.p>
                        </div>
                    )}
                </motion.div>
            )}
        </motion.div>
      </div>
    </motion.div>
  );
}
