import React, { useEffect, useRef, useState } from "react";
import { 
  X, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Shuffle, 
  Repeat, 
  Volume2, 
  VolumeX, 
  Disc, 
  ListMusic, 
  ChevronDown,
  Sparkles,
  Sliders,
  Loader2,
  Plus
} from "lucide-react";
import { Song } from "../types";
import { hasLyrics } from "../utils/lyricsParser";
import LyricBadge from "./LyricBadge";

interface MobilePlayerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: Song | null;
  isPlaying: boolean;
  isBuffering?: boolean;
  onTogglePlay: () => void;
  onSkipNext: () => void;
  onSkipPrev: () => void;
  currentTime: number;
  duration: number;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  volume: number;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  playbackMode: "normal" | "loop-one" | "loop-all" | "shuffle";
  onChangePlaybackMode: () => void;
  formatTime: (secs: number) => string;
  onOpenEqualizer: () => void;
  onOpenLyrics?: () => void;
  playlists: any[];
  onAddSongToPlaylist: (songId: string, playlist: any) => void;
}

export default function MobilePlayerOverlay({
  isOpen,
  onClose,
  currentSong,
  isPlaying,
  isBuffering = false,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
  currentTime,
  duration,
  onSeek,
  volume,
  onVolumeChange,
  isMuted,
  onToggleMute,
  playbackMode,
  onChangePlaybackMode,
  formatTime,
  onOpenEqualizer,
  onOpenLyrics,
  playlists,
  onAddSongToPlaylist,
}: MobilePlayerOverlayProps) {
  if (!isOpen || !currentSong) return null;

  const [isVinylSlidOut, setIsVinylSlidOut] = useState(true);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [swipeAction, setSwipeAction] = useState<"left" | "right" | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const triggerSwipe = (dir: "left" | "right", action: () => void) => {
    setSwipeAction(dir);
    setTimeout(() => {
      action();
      // Reset swipeAction so the next song enters with a sleek slide-in transition!
      setSwipeAction(null);
    }, 250);
  };

  const isDragging = useRef<boolean>(false);
  const dragStartX = useRef<number>(0);
  const dragStartY = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - touchStartX.current;
    const diffY = endY - touchStartY.current;
    
    // Swipe left (next), Swipe right (prev)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 45) {
      if (diffX < 0) {
        triggerSwipe("left", onSkipNext);
      } else {
        triggerSwipe("right", onSkipPrev);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const endX = e.clientX;
    const endY = e.clientY;
    const diffX = endX - dragStartX.current;
    const diffY = endY - dragStartY.current;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 45) {
      if (diffX < 0) {
        triggerSwipe("left", onSkipNext);
      } else {
        triggerSwipe("right", onSkipPrev);
      }
    }
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
  };

  const onClickCenterpiece = (e: React.MouseEvent) => {
    const diffX = Math.abs(e.clientX - dragStartX.current);
    const diffY = Math.abs(e.clientY - dragStartY.current);
    if (diffX > 8 || diffY > 8) {
      return;
    }
    setIsVinylSlidOut(!isVinylSlidOut);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.code === "Space" && (e.target as HTMLElement)?.tagName !== "INPUT") {
        e.preventDefault();
        onTogglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onTogglePlay]);

  return (
    <div 
      className="fixed inset-0 z-50 w-screen h-screen bg-[#070a12] text-white flex flex-col justify-between select-none overflow-hidden animate-fade-in"
    >
      {/* Dynamic Ambient Background Blur */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20 blur-3xl pointer-events-none scale-125 transform-gpu transition-all duration-700"
        style={{ backgroundImage: `url(${currentSong.imageUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#070a12]/90 via-[#070a12]/95 to-[#070a12] pointer-events-none" />

      {/* 1. TOP BAR - EDGE TO EDGE */}
      <header className="relative z-30 w-full px-4 sm:px-8 md:px-12 py-3.5 md:py-4.5 flex justify-between items-center border-b border-white/[0.06] bg-black/25 backdrop-blur-md">
        <button 
          onClick={onClose}
          className="flex items-center space-x-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all text-slate-300 hover:text-white group active:scale-95"
          title="Minimize player (or press ESC)"
        >
          <ChevronDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
          <span className="hidden md:inline text-xs font-mono font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-200">
            Minimize <span className="text-[10px] opacity-60">(ESC)</span>
          </span>
        </button>

        <div className="text-center px-4">
          <span className="text-[10px] md:text-xs font-mono tracking-widest text-cyan-400 uppercase font-bold block">
            NOW PLAYING
          </span>
          <h3 className="text-xs md:text-sm font-semibold text-slate-300 truncate max-w-[200px] md:max-w-md">
            {currentSong.album || "ZYNC High-Fidelity Audio"}
          </h3>
        </div>
        
        {/* Actions on Top Bar */}
        <div className="flex items-center space-x-2">
          {hasLyrics(currentSong) && onOpenLyrics && (
            <button 
              type="button"
              onClick={onOpenLyrics}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/20 rounded-full text-cyan-300 transition-all text-xs font-mono font-bold"
              title="Open Synchronized Lyrics"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>Lyrics</span>
            </button>
          )}

          <button 
            type="button"
            onClick={onOpenEqualizer}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-slate-300 hover:text-cyan-400 transition-all active:scale-95"
            title="Open Equalizer"
          >
            <Sliders className="w-4.5 h-4.5" />
          </button>

          {/* Save to Playlist Dropdown */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
              className={`p-2.5 border rounded-full transition-all active:scale-95 ${
                showPlaylistMenu 
                  ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400" 
                  : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
              }`}
              title="Add to Playlist"
            >
              <Plus className="w-4.5 h-4.5" />
            </button>
            
            {showPlaylistMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-[#0c1220] border border-white/12 rounded-2xl p-2 shadow-2xl z-40 backdrop-blur-2xl animate-fade-in text-left">
                <p className="text-[10px] font-bold text-cyan-400 px-3 py-1.5 uppercase tracking-wider border-b border-white/5 select-none">Save to Playlist</p>
                {playlists.length === 0 ? (
                  <div className="p-3 text-center">
                    <p className="text-[10px] text-slate-500">No playlists found. Create one first!</p>
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto mt-1 custom-scrollbar space-y-0.5">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => {
                          onAddSongToPlaylist(currentSong.id, pl);
                          setShowPlaylistMenu(false);
                        }}
                        className="w-full text-left text-xs text-slate-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-xl truncate block font-medium"
                      >
                        {pl.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. CENTER STAGE - WIDESCREEN RESPONSIVE ON PC, VERTICAL ON MOBILE */}
      <main className="relative z-10 flex-1 min-h-0 w-full max-w-7xl mx-auto px-4 sm:px-8 md:px-12 py-4 md:py-8 flex flex-col md:flex-row items-center justify-center md:gap-16 lg:gap-24 overflow-y-auto overflow-x-hidden">
        
        {/* Left Column: CD Pack & Spinning Vinyl */}
        <div 
          className="relative flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none my-auto md:my-0 flex-shrink-0"
          onClick={onClickCenterpiece}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <div className={`relative flex items-center justify-center h-[240px] xs:h-[280px] md:h-[340px] lg:h-[380px] w-[280px] xs:w-[320px] md:w-[400px] lg:w-[460px] overflow-visible transition-all duration-300 ease-out ${
            swipeAction === "left" 
              ? "-translate-x-[150%] opacity-0 rotate-[-12deg]" 
              : swipeAction === "right" 
                ? "translate-x-[150%] opacity-0 rotate-[12deg]" 
                : "translate-x-0 opacity-100 rotate-0"
          }`}>
            
            {/* Ambient Back Glow */}
            <div className="absolute w-64 h-64 md:w-80 md:h-80 bg-gradient-to-tr from-cyan-500/25 to-blue-600/20 rounded-full blur-3xl animate-pulse pointer-events-none"></div>
            
            {/* CD SLEEVE / COVER BOX */}
            <div 
              className={`absolute w-48 h-48 xs:w-56 xs:h-56 md:w-68 md:h-68 lg:w-76 lg:h-76 bg-[#0b101d] rounded-2xl border border-white/15 shadow-2xl overflow-hidden z-20 transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) ${
                isVinylSlidOut 
                  ? "-translate-x-12 xs:-translate-x-16 md:-translate-x-20 rotate-[-2deg] shadow-[0_25px_60px_rgba(0,0,0,0.8)]" 
                  : "translate-x-0 shadow-[0_15px_35px_rgba(0,0,0,0.6)]"
              }`}
            >
              <img 
                src={currentSong.imageUrl} 
                alt={currentSong.title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              {/* CD Pack spine decoration */}
              <div className="absolute left-0 top-0 bottom-0 w-3 md:w-4 bg-black/50 border-r border-white/10 flex flex-col items-center justify-center py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
              </div>
              
              {/* Interactive banner */}
              <div className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur-sm py-1.5 px-3 text-center border-t border-white/5">
                <span className="text-[9px] md:text-[10px] font-mono tracking-wider text-cyan-400 font-extrabold uppercase">
                  {isVinylSlidOut ? "Tap to Close Box" : "Tap to Open CD"}
                </span>
              </div>
            </div>

            {/* VINYL DISC / ROUND CD */}
            <div 
              className={`absolute w-44 h-44 xs:w-52 xs:h-52 md:w-64 md:h-64 lg:w-72 lg:h-72 rounded-full bg-[#060606] border-[8px] md:border-[10px] border-neutral-900 shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) ${
                isVinylSlidOut 
                  ? "translate-x-14 xs:translate-x-18 md:translate-x-24 z-10 rotate-[12deg]" 
                  : "translate-x-0 scale-95 opacity-40 z-10"
              } ${isVinylSlidOut && isPlaying ? "animate-spin-slow" : ""}`}
              style={{
                boxShadow: "0 10px 40px rgba(0,0,0,0.9), inset 0 0 25px rgba(255,255,255,0.06)"
              }}
            >
              {/* Vinyl Grooves */}
              <div className="absolute inset-2 border border-neutral-800 rounded-full opacity-40"></div>
              <div className="absolute inset-7 border border-neutral-800 rounded-full opacity-40"></div>
              <div className="absolute inset-13 border border-neutral-800 rounded-full opacity-40"></div>
              <div className="absolute inset-19 border border-neutral-800 rounded-full opacity-40"></div>

              {/* Inner Center Label */}
              <div className="relative w-20 h-20 xs:w-24 xs:h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-4 border-neutral-950 shadow-inner">
                <img 
                  src={currentSong.imageUrl} 
                  alt={currentSong.title} 
                  className="w-full h-full object-cover rounded-full"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 m-auto w-4 h-4 bg-black border-2 border-slate-600 rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]"></div>
              </div>
            </div>

          </div>

          {/* Swipe indicator */}
          <div className="text-center mt-2 pointer-events-none select-none">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-500/5 border border-cyan-500/10 text-[9px] font-mono tracking-wider text-cyan-400 uppercase font-bold">
              <span>← Swipe Left (Next)</span>
              <span className="text-slate-600">•</span>
              <span>Swipe Right (Prev) →</span>
            </span>
          </div>
        </div>

        {/* Right Column (on PC) / Bottom block (on mobile): Track Metadata & Acoustics */}
        <div className="w-full md:max-w-md lg:max-w-lg flex flex-col justify-center space-y-4 md:space-y-6 mt-4 md:mt-0">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {currentSong.title}
              </h1>
              <LyricBadge song={currentSong} size="md" onClick={onOpenLyrics} />
            </div>
            <p className="text-sm md:text-base text-slate-400 font-medium mt-1">
              {currentSong.artist}
            </p>
          </div>

          {/* Audio Equalizer Spectrum Bar */}
          <div className="p-3.5 bg-white/[0.03] border border-white/[0.08] rounded-2xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex space-x-1 items-end h-6">
                {[...Array(12)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-1 rounded-full bg-gradient-to-t from-cyan-400 to-blue-500 transition-all duration-300 ${
                      isPlaying ? "animate-audio-bar" : "h-1"
                    }`}
                    style={{ 
                      animationDelay: `${i * 0.08}s`,
                      height: isPlaying ? `${Math.floor(Math.random() * 20) + 4}px` : "3px"
                    }}
                  />
                ))}
              </div>
              <span className="text-xs font-mono text-slate-400 font-medium">
                {isPlaying ? "Live Lossless Audio" : "Paused"}
              </span>
            </div>

            {hasLyrics(currentSong) && onOpenLyrics && (
              <button 
                type="button"
                onClick={onOpenLyrics}
                className="px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 rounded-xl text-cyan-300 text-xs font-mono font-bold transition-all"
              >
                View Lyrics
              </button>
            )}
          </div>
        </div>

      </main>

      {/* 3. BOTTOM CONTROL DECK - EDGE TO EDGE */}
      <footer className="relative z-30 w-full px-4 sm:px-8 md:px-12 py-4 md:py-6 bg-black/40 border-t border-white/[0.08] backdrop-blur-xl">
        <div className="max-w-5xl mx-auto flex flex-col space-y-3 md:space-y-4">
          
          {/* Progress Timeline */}
          <div className="w-full flex items-center space-x-3">
            <span className="text-[11px] font-mono text-slate-400 w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <input 
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={onSeek}
              className="flex-1 accent-cyan-400 h-1.5 rounded-lg bg-white/10 cursor-pointer outline-none transition-all hover:h-2"
            />
            <span className="text-[11px] font-mono text-slate-400 w-10">
              {formatTime(duration)}
            </span>
          </div>

          {/* Main Controls Row */}
          <div className="flex items-center justify-between gap-4">
            
            {/* Left: Shuffle & Loop */}
            <div className="flex items-center space-x-2">
              <button 
                onClick={onChangePlaybackMode}
                className={`p-2.5 rounded-full transition-all ${
                  playbackMode !== "normal" 
                    ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-400" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                title={`Playback Mode: ${playbackMode}`}
              >
                {playbackMode === "shuffle" ? (
                  <Shuffle className="w-5 h-5" />
                ) : playbackMode === "loop-one" ? (
                  <div className="relative">
                    <Repeat className="w-5 h-5 text-cyan-400" />
                    <span className="absolute -top-1.5 -right-1 text-[8px] font-bold font-mono px-0.5 bg-cyan-500 text-black rounded">1</span>
                  </div>
                ) : playbackMode === "loop-all" ? (
                  <Repeat className="w-5 h-5 text-cyan-400" />
                ) : (
                  <Repeat className="w-5 h-5 text-slate-400" />
                )}
              </button>
            </div>

            {/* Center: Playback Navigation (Prev, Play/Pause, Next) */}
            <div className="flex items-center space-x-4 md:space-x-6">
              <button 
                onClick={onSkipPrev}
                className="p-3 bg-white/5 hover:bg-white/10 active:scale-90 rounded-full border border-white/10 text-slate-200 hover:text-white transition-all"
                title="Previous Track"
              >
                <SkipBack className="w-5 h-5 md:w-6 md:h-6 fill-current" />
              </button>

              <button 
                onClick={onTogglePlay}
                className="p-4 md:p-5 bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 active:scale-95 rounded-full shadow-[0_0_25px_rgba(6,182,212,0.4)] text-black transition-all flex items-center justify-center w-14 h-14 md:w-16 md:h-16"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isBuffering ? (
                  <Loader2 className="w-7 h-7 text-black animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-7 h-7 text-black fill-black" />
                ) : (
                  <Play className="w-7 h-7 text-black fill-black ml-0.5" />
                )}
              </button>

              <button 
                onClick={onSkipNext}
                className="p-3 bg-white/5 hover:bg-white/10 active:scale-90 rounded-full border border-white/10 text-slate-200 hover:text-white transition-all"
                title="Next Track"
              >
                <SkipForward className="w-5 h-5 md:w-6 md:h-6 fill-current" />
              </button>
            </div>

            {/* Right: Volume Slider & Mute Toggle */}
            <div className="flex items-center space-x-2">
              <button 
                onClick={onToggleMute}
                className="p-2.5 text-slate-400 hover:text-white transition-all"
                title="Toggle Mute"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-slate-300" />
                )}
              </button>

              <div className="hidden sm:block w-24 md:w-32">
                <input 
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={onVolumeChange}
                  className="w-full accent-cyan-400 h-1 rounded bg-white/15 cursor-pointer outline-none"
                  title="Volume"
                />
              </div>
            </div>

          </div>

        </div>
      </footer>
    </div>
  );
}
