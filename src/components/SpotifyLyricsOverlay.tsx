import React, { useEffect, useRef, useState, useMemo } from "react";
import { 
  X, 
  ChevronDown, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Repeat, 
  Shuffle, 
  Loader2, 
  Sparkles,
  Maximize2,
  Minimize2,
  Music2,
  Sliders
} from "lucide-react";
import { Song } from "../types";
import { parseLyrics, findActiveLyricIndex, LyricLine, fetchLyricsFromUrl } from "../utils/lyricsParser";

interface SpotifyLyricsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: Song | null;
  isPlaying: boolean;
  isBuffering?: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onSkipNext: () => void;
  onSkipPrev: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSeekToTime: (seconds: number) => void;
  volume: number;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  playbackMode: "normal" | "loop-one" | "loop-all" | "shuffle";
  onChangePlaybackMode: () => void;
  formatTime: (secs: number) => string;
}

export default function SpotifyLyricsOverlay({
  isOpen,
  onClose,
  currentSong,
  isPlaying,
  isBuffering = false,
  currentTime,
  duration,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
  onSeek,
  onSeekToTime,
  volume,
  onVolumeChange,
  isMuted,
  onToggleMute,
  playbackMode,
  onChangePlaybackMode,
  formatTime
}: SpotifyLyricsOverlayProps) {
  const [fetchedLyrics, setFetchedLyrics] = useState<string | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState<boolean>(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const userScrollTimeoutRef = useRef<any>(null);

  // Fetch lyrics if lyricsUrl is provided and song.lyrics is empty
  useEffect(() => {
    if (!isOpen || !currentSong) return;

    if (currentSong.lyrics && currentSong.lyrics.trim().length > 0) {
      setFetchedLyrics(null);
      setLyricsError(null);
      setLoadingLyrics(false);
      return;
    }

    if (currentSong.lyricsUrl && currentSong.lyricsUrl.trim().startsWith("http")) {
      setLoadingLyrics(true);
      setLyricsError(null);

      fetchLyricsFromUrl(currentSong.lyricsUrl)
        .then((text) => {
          setFetchedLyrics(text);
          setLoadingLyrics(false);
        })
        .catch((err) => {
          console.warn("Could not fetch external lyrics:", err);
          setLyricsError("Failed to fetch lyrics from source URL.");
          setLoadingLyrics(false);
        });
    } else {
      setFetchedLyrics(null);
      setLoadingLyrics(false);
    }
  }, [isOpen, currentSong?.id, currentSong?.lyrics, currentSong?.lyricsUrl]);

  // Parse lyrics
  const parsed = useMemo(() => {
    const rawContent = currentSong?.lyrics || fetchedLyrics || "";
    return parseLyrics(rawContent);
  }, [currentSong?.lyrics, fetchedLyrics]);

  const activeIndex = useMemo(() => {
    if (!parsed.isSynced || parsed.lines.length === 0) return -1;
    return findActiveLyricIndex(parsed.lines, currentTime);
  }, [parsed, currentTime]);

  // Smooth auto-scrolling to active line like Spotify
  useEffect(() => {
    if (!isOpen || isUserScrolling || activeIndex === -1 || !lyricsContainerRef.current) return;

    const activeEl = lyricsContainerRef.current.querySelector<HTMLElement>(`[data-lyric-idx="${activeIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, [isOpen, activeIndex, isUserScrolling]);

  // Detect user manual scroll and temporarily pause auto-scroll
  const handleScroll = () => {
    setIsUserScrolling(true);
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 2800);
  };

  const toggleNativeFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!isOpen || !currentSong) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black text-white select-none flex flex-col justify-between overflow-hidden animate-fade-in font-sans">
      {/* Background Animated Gradient Mesh based on track */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Blurred album artwork as atmospheric ambient backdrop */}
        <div 
          className="absolute inset-0 bg-cover bg-center scale-125 blur-[100px] opacity-40 transition-all duration-1000"
          style={{ backgroundImage: `url(${currentSong.imageUrl})` }}
        />
        {/* Spotify Deep Atmospheric Vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-[#070b14]/85 to-black/95" />
        
        {/* Ambient colorful fluid orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-cyan-500/20 blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 rounded-full bg-indigo-600/20 blur-[130px] pointer-events-none animate-pulse" style={{ animationDelay: "2s" }} />
        <div className="absolute -bottom-24 left-1/3 w-80 h-80 rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none" />
      </div>

      {/* TOP HEADER */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 md:px-10 md:py-6 border-b border-white/5 backdrop-blur-xl bg-black/20">
        {/* Left: Close button */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-slate-200 hover:text-white"
            title="Close Lyrics View (Esc)"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
          
          <div className="flex items-center space-x-3">
            <img 
              src={currentSong.imageUrl} 
              alt={currentSong.title}
              className="w-10 h-10 md:w-12 md:h-12 rounded-xl object-cover border border-white/15 shadow-lg"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <h2 className="text-sm md:text-base font-bold text-white truncate max-w-[200px] md:max-w-md">
                {currentSong.title}
              </h2>
              <p className="text-xs md:text-sm text-slate-400 truncate max-w-[180px] md:max-w-md">
                {currentSong.artist}
              </p>
            </div>
          </div>
        </div>

        {/* Center / Right: Lyrics Status Badge & Fullscreen */}
        <div className="flex items-center space-x-3">
          {parsed.isSynced ? (
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase">Live Synced Lyrics</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-slate-300">
              <Music2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-mono font-semibold tracking-wider uppercase">Lyrics</span>
            </div>
          )}

          {/* Spotify Badge "L" */}
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-extrabold text-xs shadow-[0_0_12px_rgba(6,182,212,0.3)]" title="Lyrics Available">
            L
          </div>

          <button
            onClick={toggleNativeFullscreen}
            className="hidden md:flex p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-slate-300 hover:text-white"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* MAIN LYRICS CONTENT AREA (SPOTIFY KARAOKE EXPERIENCE) */}
      <main 
        ref={lyricsContainerRef}
        onScroll={handleScroll}
        className="relative z-10 flex-1 overflow-y-auto px-6 md:px-16 lg:px-24 py-16 scrollbar-none space-y-7 md:space-y-10 focus:outline-none"
      >
        {loadingLyrics ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-24">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            <p className="text-base text-slate-300 font-medium tracking-wide">
              Loading lyrics for {currentSong.title}...
            </p>
          </div>
        ) : lyricsError ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-24">
            <p className="text-base text-red-400 font-medium">{lyricsError}</p>
            <p className="text-xs text-slate-500">Check external URL or upload lyrics file in Admin panel.</p>
          </div>
        ) : parsed.lines.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-24">
            <Music2 className="w-12 h-12 text-slate-600 mb-2" />
            <p className="text-lg text-slate-400 font-semibold">No lyrics available for this track.</p>
          </div>
        ) : parsed.isSynced ? (
          // SYNCED LYRICS (SPOTIFY INTERACTIVE KARAOKE STYLE)
          <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 py-8 md:py-16">
            {parsed.lines.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = activeIndex !== -1 && idx < activeIndex;
              const isFuture = activeIndex !== -1 && idx > activeIndex;

              return (
                <div
                  key={`${idx}-${line.time}`}
                  data-lyric-idx={idx}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => onSeekToTime(line.time)}
                  className={`group cursor-pointer select-none transition-all duration-500 rounded-2xl p-2 -mx-2 flex items-start space-x-4 ${
                    isActive 
                      ? "text-white font-extrabold scale-[1.03] md:scale-[1.04] origin-left drop-shadow-[0_0_25px_rgba(255,255,255,0.45)]" 
                      : isPast
                        ? "text-white/40 font-semibold hover:text-white/80"
                        : "text-white/20 font-medium hover:text-white/70"
                  }`}
                >
                  {/* Timestamp tooltip on hover or active indicator */}
                  <span className={`text-[10px] md:text-xs font-mono transition-opacity mt-1.5 w-10 flex-shrink-0 ${
                    isActive 
                      ? "text-cyan-400 font-bold opacity-100" 
                      : "text-slate-500 opacity-0 group-hover:opacity-100"
                  }`}>
                    {formatTime(line.time)}
                  </span>

                  {/* Lyric text */}
                  <p className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-tight leading-snug transition-all ${
                    isActive 
                      ? "text-white" 
                      : isPast 
                        ? "text-slate-400/80" 
                        : "text-slate-600/70 group-hover:text-slate-300"
                  }`}>
                    {line.text}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          // PLAIN TEXT LYRICS (ELEGANT SCROLLABLE)
          <div className="max-w-3xl mx-auto space-y-4 md:space-y-6 py-10 text-center md:text-left">
            <div className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs font-mono mb-4">
              Unsynchronized Plain Lyrics
            </div>
            {parsed.lines.map((line, idx) => (
              <p 
                key={idx} 
                className="text-xl sm:text-2xl md:text-3xl font-medium text-slate-300/90 leading-relaxed tracking-tight"
              >
                {line.text}
              </p>
            ))}
          </div>
        )}
      </main>

      {/* BOTTOM CONTROLLER DOCK (PERSISTENT PLAYBACK BAR) */}
      <footer className="relative z-20 px-6 py-4 md:px-12 md:py-6 border-t border-white/10 backdrop-blur-2xl bg-black/40">
        <div className="max-w-5xl mx-auto space-y-3">
          {/* Scrubber row */}
          <div className="flex items-center space-x-3">
            <span className="text-[11px] font-mono text-slate-400 w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <input 
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={onSeek}
              className="w-full h-1.5 bg-white/15 rounded-full accent-cyan-400 hover:accent-cyan-300 cursor-pointer outline-none transition-all"
            />
            <span className="text-[11px] font-mono text-slate-400 w-10">
              {formatTime(duration)}
            </span>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between pt-1">
            {/* Left buttons (Mode) */}
            <div className="flex items-center space-x-3">
              <button 
                onClick={onChangePlaybackMode}
                className={`p-2 rounded-xl transition-all ${
                  playbackMode !== "normal" 
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" 
                    : "text-slate-400 hover:text-white"
                }`}
                title={`Playback Mode: ${playbackMode}`}
              >
                {playbackMode === "shuffle" ? (
                  <Shuffle className="w-5 h-5" />
                ) : playbackMode === "loop-one" ? (
                  <div className="relative">
                    <Repeat className="w-5 h-5 text-cyan-400" />
                    <span className="absolute -top-1 -right-1 text-[8px] font-bold px-0.5 bg-cyan-500 text-black rounded font-mono">1</span>
                  </div>
                ) : playbackMode === "loop-all" ? (
                  <Repeat className="w-5 h-5 text-cyan-400" />
                ) : (
                  <Repeat className="w-5 h-5 text-slate-400" />
                )}
              </button>
            </div>

            {/* Middle Playback Actions */}
            <div className="flex items-center space-x-6">
              <button 
                onClick={onSkipPrev} 
                className="p-2 text-slate-300 hover:text-white active:scale-90 transition-all"
                title="Previous Track"
              >
                <SkipBack className="w-6 h-6 fill-slate-300 hover:fill-white" />
              </button>

              <button 
                onClick={onTogglePlay} 
                className="p-4 bg-white text-black rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.4)] flex items-center justify-center w-12 h-12"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isBuffering ? (
                  <Loader2 className="w-6 h-6 text-black animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 fill-black" />
                ) : (
                  <Play className="w-6 h-6 fill-black ml-0.5" />
                )}
              </button>

              <button 
                onClick={onSkipNext} 
                className="p-2 text-slate-300 hover:text-white active:scale-90 transition-all"
                title="Next Track"
              >
                <SkipForward className="w-6 h-6 fill-slate-300 hover:fill-white" />
              </button>
            </div>

            {/* Right Volume Controls */}
            <div className="flex items-center space-x-3">
              <button 
                onClick={onToggleMute} 
                className="text-slate-400 hover:text-white transition-colors"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-slate-300" />
                )}
              </button>
              <input 
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={onVolumeChange}
                className="hidden sm:block w-24 accent-cyan-400 cursor-pointer h-1.5 rounded bg-white/10"
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
