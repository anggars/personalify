"use client";

import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause } from "lucide-react";

interface WaveformPlayerProps {
  audioUrl: string;
  filename: string;
  fileSize: number;
}

export function WaveformPlayer({ audioUrl, filename, fileSize }: WaveformPlayerProps) {
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
      height: 36,
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
      className="flex flex-col gap-2 w-full py-2"
      onClick={(e) => e.stopPropagation()} // Prevent triggering dropzone click
    >
      {/* Title & Info */}
      <div className="flex flex-col items-center mb-1">
        <span className="font-bold text-[15px] truncate w-full text-center text-white drop-shadow-md">{filename}</span>
        <span className="text-xs text-neutral-400 mt-0.5">{(fileSize / 1024 / 1024).toFixed(2)} MB</span>
      </div>

      {/* Player Controls & Waveform */}
      <div className="flex items-center gap-4 w-full">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!isReady}
          className="w-10 h-10 shrink-0 flex items-center justify-center bg-[#1DB954] hover:bg-[#1ed760] text-black rounded-full transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(29,185,84,0.3)]"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-1" />
          )}
        </button>

        <div className="flex-1 w-full" ref={containerRef} />
      </div>
    </div>
  );
}
