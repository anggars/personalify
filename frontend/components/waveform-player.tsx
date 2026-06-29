"use client";

import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause } from "lucide-react";

interface WaveformPlayerProps {
  audioUrl: string;
}

export function WaveformPlayer({ audioUrl }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    wavesurfer.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "rgba(29, 185, 84, 0.3)", // Dimmer green
      progressColor: "#1DB954", // Spotify green
      cursorColor: "#ffffff",
      barWidth: 2,
      barGap: 3,
      barRadius: 2,
      height: 40,
      normalize: true,
      url: audioUrl,
    });

    wavesurfer.current.on("ready", () => {
      setIsReady(true);
    });

    wavesurfer.current.on("play", () => setIsPlaying(true));
    wavesurfer.current.on("pause", () => setIsPlaying(false));
    wavesurfer.current.on("finish", () => setIsPlaying(false));

    return () => {
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
      }
    };
  }, [audioUrl]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (wavesurfer.current) {
      wavesurfer.current.playPause();
    }
  };

  return (
    <div 
      className="flex items-center gap-4 w-full bg-black/40 p-3 rounded-2xl border border-neutral-800"
      onClick={(e) => e.stopPropagation()} // Prevent triggering dropzone click
    >
      <button
        type="button"
        onClick={togglePlay}
        disabled={!isReady}
        className="w-10 h-10 shrink-0 flex items-center justify-center bg-[#1DB954] hover:bg-[#1ed760] text-black rounded-full transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 fill-current" />
        ) : (
          <Play className="w-5 h-5 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 w-full" ref={containerRef} />
    </div>
  );
}
