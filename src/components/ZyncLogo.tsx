import React from "react";

interface ZyncLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showSubtitle?: boolean;
  showText?: boolean;
  className?: string;
  onClick?: () => void;
}

export default function ZyncLogo({
  size = "md",
  showSubtitle = true,
  showText = true,
  className = "",
  onClick
}: ZyncLogoProps) {
  // Dimension presets
  const iconSizes = {
    xs: "w-6 h-6",
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-13 h-13",
    xl: "w-16 h-16"
  };

  const titleSizes = {
    xs: "text-xs tracking-wider",
    sm: "text-sm tracking-widest",
    md: "text-base tracking-[0.2em]",
    lg: "text-2xl tracking-[0.22em]",
    xl: "text-3xl tracking-[0.25em]"
  };

  const subtitleSizes = {
    xs: "text-[7px] tracking-widest",
    sm: "text-[8px] tracking-widest",
    md: "text-[9px] tracking-[0.2em]",
    lg: "text-[11px] tracking-[0.25em]",
    xl: "text-xs tracking-[0.3em]"
  };

  return (
    <div 
      onClick={onClick}
      className={`inline-flex items-center gap-3 select-none ${onClick ? "cursor-pointer group" : ""} ${className}`}
    >
      {/* Crisp Single Music Visualizer Ring Emblem */}
      <div className={`relative flex-shrink-0 ${iconSizes[size]} aspect-square`}>
        {/* Subtle Ambient Glow */}
        <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-md group-hover:bg-cyan-400/35 transition-all duration-300"></div>

        {/* Vector SVG Emblem - Crisp, Single, Clean */}
        <svg 
          viewBox="0 0 100 100" 
          className="w-full h-full relative z-10 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] group-hover:scale-105 transition-transform duration-300"
        >
          <defs>
            <linearGradient id={`zync-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00f2fe" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
            <linearGradient id={`zync-bar-grad-${size}`} x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#00f2fe" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
          </defs>

          {/* Single Crisp Outer Ring */}
          <circle 
            cx="50" 
            cy="50" 
            r="42" 
            fill="none" 
            stroke={`url(#zync-grad-${size})`} 
            strokeWidth="5.5" 
          />

          {/* 4 Single Crisp Equalizer Bars */}
          <rect x="29" y="27" width="6.5" height="46" rx="3.25" fill={`url(#zync-bar-grad-${size})`} />
          <rect x="40" y="33" width="6.5" height="34" rx="3.25" fill={`url(#zync-bar-grad-${size})`} />
          <rect x="51" y="39" width="6.5" height="22" rx="3.25" fill={`url(#zync-bar-grad-${size})`} />
          <rect x="62" y="44" width="6.5" height="12" rx="3.25" fill={`url(#zync-bar-grad-${size})`} />
        </svg>
      </div>

      {/* Typography Block - Single Crisp Clean Text */}
      {showText && (
        <div className="flex flex-col justify-center leading-tight">
          {/* Main Title: ZYNC */}
          <span className={`font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-400 uppercase font-['Plus_Jakarta_Sans',sans-serif] ${titleSizes[size]}`}>
            ZYNC
          </span>

          {/* Subtitle: MADE BY SKEDZ */}
          {showSubtitle && (
            <span className={`font-bold text-cyan-400 uppercase tracking-widest mt-0.5 ${subtitleSizes[size]}`}>
              MADE BY SKEDZ
            </span>
          )}
        </div>
      )}
    </div>
  );
}
