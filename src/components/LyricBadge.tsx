import React from "react";
import { Song } from "../types";
import { hasLyrics } from "../utils/lyricsParser";

interface LyricBadgeProps {
  song?: Song | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export default function LyricBadge({
  song,
  size = "sm",
  className = "",
  onClick
}: LyricBadgeProps) {
  if (!hasLyrics(song)) return null;

  const sizeClasses = {
    sm: "w-3.5 h-3.5 text-[8px]",
    md: "w-4 h-4 text-[9px]",
    lg: "w-5 h-5 text-[10px]"
  };

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center justify-center font-mono font-black rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_8px_rgba(6,182,212,0.25)] select-none flex-shrink-0 transition-transform ${sizeClasses[size]} ${onClick ? "cursor-pointer hover:scale-110 active:scale-95" : ""} ${className}`}
      title="Lyrics Available (Click to view full screen)"
    >
      L
    </span>
  );
}
