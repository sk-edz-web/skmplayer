import React from "react";

interface ZyncAppSplashProps {
  className?: string;
  statusText?: string;
}

export const ZyncAppSplash: React.FC<ZyncAppSplashProps> = ({
  className = "",
  statusText = "Syncing high-fidelity session..."
}) => {
  return (
    <div 
      className={`fixed inset-0 z-[9999] bg-[#04060c] flex flex-col items-center justify-center p-4 select-none overflow-hidden ${className}`}
    >
      {/* Cinematic Ambient Radial Glow */}
      <div className="absolute w-96 h-96 rounded-full bg-cyan-500/15 blur-[100px] pointer-events-none" />
      <div className="absolute w-80 h-80 rounded-full bg-blue-600/10 blur-[90px] pointer-events-none -bottom-10" />

      {/* Center Logo Group with YouTube-style Ripple Waves */}
      <div className="relative flex flex-col items-center justify-center z-10">
        {/* Animated Expanding Ripple Wave 1 */}
        <div className="absolute w-36 h-36 rounded-full border border-cyan-400/30 animate-yt-ring pointer-events-none" />
        
        {/* Animated Expanding Ripple Wave 2 (delayed) */}
        <div 
          className="absolute w-36 h-36 rounded-full border border-cyan-500/20 animate-yt-ring pointer-events-none" 
          style={{ animationDelay: "0.6s" }} 
        />

        {/* Center ZYNC Emblem with Equalizer Bars Animation */}
        <div className="relative w-24 h-24 rounded-full flex items-center justify-center animate-yt-pulse shadow-[0_0_40px_rgba(6,182,212,0.45)]">
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_18px_rgba(6,182,212,0.75)]">
            <defs>
              <linearGradient id="app-splash-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f2fe" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id="app-splash-bar-grad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#00f2fe" />
                <stop offset="100%" stopColor="#ffffff" />
              </linearGradient>
            </defs>

            {/* Glowing Outer Ring */}
            <circle 
              cx="50" 
              cy="50" 
              r="43" 
              fill="#060912" 
              stroke="url(#app-splash-ring-grad)" 
              strokeWidth="5" 
            />

            {/* Equalizer Bars Animated with Dynamic Rhythm */}
            <g transform="translate(0, 0)">
              <rect x="29" y="32" width="6.5" height="36" rx="3.25" fill="url(#app-splash-bar-grad)" className="animate-yt-eq-1" />
              <rect x="40" y="27" width="6.5" height="46" rx="3.25" fill="url(#app-splash-bar-grad)" className="animate-yt-eq-2" />
              <rect x="51" y="34" width="6.5" height="32" rx="3.25" fill="url(#app-splash-bar-grad)" className="animate-yt-eq-3" />
              <rect x="62" y="40" width="6.5" height="20" rx="3.25" fill="url(#app-splash-bar-grad)" className="animate-yt-eq-4" />
            </g>
          </svg>
        </div>

        {/* Brand Name Typography */}
        <div className="mt-6 flex flex-col items-center">
          <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-400 tracking-[0.28em] font-['Plus_Jakarta_Sans',sans-serif] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            ZYNC
          </span>
          <span className="text-[11px] font-semibold text-cyan-400/70 tracking-[0.2em] uppercase mt-1">
            MADE BY SKEDZ
          </span>
        </div>

        {/* Loading Progress Bar & Status Text */}
        <div className="mt-8 flex flex-col items-center">
          <div className="w-40 h-1 bg-slate-800/80 rounded-full overflow-hidden relative">
            <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-cyan-400 to-blue-500 w-1/2 rounded-full animate-pulse" />
          </div>
          <span className="text-[11px] text-slate-400 font-mono tracking-wider mt-3 uppercase">
            {statusText}
          </span>
        </div>
      </div>
    </div>
  );
};
