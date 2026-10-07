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
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center select-none overflow-hidden animate-fade-in p-0 md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Dynamic Ambient Background Blur for desktop backdrop */}
      <div 
        className="hidden md:block absolute inset-0 bg-cover bg-center opacity-20 blur-3xl pointer-events-none scale-125 transform-gpu"
        style={{ backgroundImage: `url(${currentSong.imageUrl})` }}
      />

      {/* Main Player Container: Full screen on Mobile, Centered Phone Card on Desktop */}
      <div className="w-full h-full md:h-auto md:max-h-[92vh] md:max-w-md md:rounded-[36px] bg-[#0c1222] border-0 md:border md:border-white/10 md:shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col justify-between overflow-hidden relative text-white">
        
        {/* Dynamic Ambient Background Inside Container */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-25 blur-3xl pointer-events-none scale-125 transform-gpu transition-all duration-700"
          style={{ backgroundImage: `url(${currentSong.imageUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c1222]/85 via-[#0c1222]/90 to-[#0c1222] pointer-events-none" />

        {/* 1. TOP HEADER */}
        <header className="relative z-20 w-full px-5 py-3.5 flex justify-between items-center border-b border-white/[0.06] bg-black/20 backdrop-blur-sm">
          <button 
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all text-slate-300 hover:text-white active:scale-95 cursor-pointer"
            title="Minimize player"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          <div className="text-center px-2 min-w-0">
            <span className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase font-bold block">
              NOW PLAYING
            </span>
            <h3 className="text-xs font-semibold text-slate-300 truncate max-w-[170px]">
              {currentSong.album || "ZYNC High-Fidelity Audio"}
            </h3>
          </div>

          <div className="flex items-center space-x-1.5">
            <button 
              type="button"
              onClick={onOpenEqualizer}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-slate-300 hover:text-cyan-400 transition-all active:scale-95"
              title="Open Equalizer"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Save to Playlist Dropdown */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
                className={`p-2 border rounded-full transition-all active:scale-95 ${
                  showPlaylistMenu 
                    ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400" 
                    : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                }`}
                title="Add to Playlist"
              >
                <Plus className="w-4 h-4" />
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

        {/* 2. CENTER PIECE: CD PACK & SPINNING VINYL */}
        <div 
          className="relative z-10 flex-1 flex flex-col items-center justify-center py-4 px-4 min-h-0 select-none cursor-grab active:cursor-grabbing"
          onClick={onClickCenterpiece}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <div className={`relative flex items-center justify-center h-[230px] xs:h-[260px] w-[270px] xs:w-[300px] overflow-visible transition-all duration-300 ease-out ${
            swipeAction === "left" 
              ? "-translate-x-[150%] opacity-0 rotate-[-12deg]" 
              : swipeAction === "right" 
                ? "translate-x-[150%] opacity-0 rotate-[12deg]" 
                : "translate-x-0 opacity-100 rotate-0"
          }`}>
            
            {/* Ambient Back Glow */}
            <div className="absolute w-52 h-52 bg-gradient-to-tr from-cyan-500/25 to-blue-600/20 rounded-full blur-2xl animate-pulse pointer-events-none"></div>
            
            {/* CD SLEEVE / COVER BOX */}
            <div 
              className={`absolute w-44 h-44 xs:w-52 xs:h-52 bg-[#0b101d] rounded-2xl border border-white/15 shadow-2xl overflow-hidden z-20 transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) ${
                isVinylSlidOut 
                  ? "-translate-x-12 xs:-translate-x-16 rotate-[-2deg] shadow-[0_25px_60px_rgba(0,0,0,0.8)]" 
                  : "translate-x-0 shadow-[0_15px_35px_rgba(0,0,0,0.6)]"
              }`}
            >
              <img 
                src={currentSong.imageUrl} 
                alt={currentSong.title} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute left-0 top-0 bottom-0 w-3 bg-black/50 border-r border-white/10 flex flex-col items-center justify-center py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur-sm py-1 px-2 text-center border-t border-white/5">
                <span className="text-[9px] font-mono tracking-wider text-cyan-400 font-bold uppercase">
                  {isVinylSlidOut ? "Tap to Close Box" : "Tap to Open CD"}
                </span>
              </div>
            </div>

            {/* VINYL DISC / ROUND CD */}
            <div 
              className={`absolute w-40 h-40 xs:w-48 xs:h-48 rounded-full bg-[#060606] border-[7px] border-neutral-900 shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) ${
                isVinylSlidOut 
                  ? "translate-x-14 xs:translate-x-18 z-10 rotate-[12deg]" 
                  : "translate-x-0 scale-95 opacity-40 z-10"
              } ${isVinylSlidOut && isPlaying ? "animate-spin-slow" : ""}`}
              style={{
                boxShadow: "0 10px 40px rgba(0,0,0,0.9), inset 0 0 25px rgba(255,255,255,0.06)"
              }}
            >
              {/* Vinyl Grooves */}
              <div className="absolute inset-2 border border-neutral-800 rounded-full opacity-40"></div>
              <div className="absolute inset-6 border border-neutral-800 rounded-full opacity-40"></div>
              <div className="absolute inset-10 border border-neutral-800 rounded-full opacity-40"></div>

              {/* Inner Center Label */}
              <div className="relative w-16 h-16 xs:w-20 xs:h-20 rounded-full overflow-hidden border-4 border-neutral-950 shadow-inner">
                <img 
                  src={currentSong.imageUrl} 
                  alt={currentSong.title} 
                  className="w-full h-full object-cover rounded-full" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 m-auto w-3 h-3 bg-black border border-slate-600 rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]"></div>
              </div>
            </div>

          </div>

          <div className="text-center mt-3 pointer-events-none select-none">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-500/5 border border-cyan-500/10 text-[9px] font-mono tracking-wider text-cyan-400 uppercase font-bold">
              <span>← Swipe Left (Next)</span>
              <span className="text-slate-600">•</span>
              <span>Swipe Right (Prev) →</span>
            </span>
          </div>
        </div>

        {/* 3. BOTTOM CONTROLS DECK */}
        <div className="relative z-20 w-full px-6 pb-6 pt-3 flex flex-col space-y-3 bg-gradient-to-t from-[#0c1222] via-[#0c1222]/95 to-transparent">
          
          {/* Song Metadata & Lyrics Badge */}
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1 pr-3">
              <h2 className="text-base xs:text-lg font-black text-white truncate tracking-tight">
                {currentSong.title}
              </h2>
              <p className="text-xs text-slate-400 truncate mt-0.5 font-medium">
                {currentSong.artist}
              </p>
            </div>
            {hasLyrics(currentSong) && onOpenLyrics && (
              <LyricBadge song={currentSong} size="md" onClick={onOpenLyrics} />
            )}
          </div>

          {/* Equalizer Spectrum Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-0.5 items-end h-3.5">
                {[...Array(8)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-1 rounded-full bg-cyan-400 transition-all duration-300 ${isPlaying ? "animate-audio-bar" : "h-1"}`}
                    style={{ 
                      animationDelay: `${i * 0.08}s`,
                      height: isPlaying ? `${Math.floor(Math.random() * 12) + 3}px` : "2px"
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {isPlaying ? "Live Lossless Audio" : "Paused"}
              </span>
            </div>
            {hasLyrics(currentSong) && onOpenLyrics && (
              <button 
                type="button" 
                onClick={onOpenLyrics} 
                className="text-[10px] text-cyan-400 font-mono font-bold hover:underline"
              >
                Lyrics
              </button>
            )}
          </div>

          {/* Progress Timeline */}
          <div className="w-full flex items-center space-x-2.5">
            <span className="text-[10px] font-mono text-slate-400 w-8 text-right">
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
            <span className="text-[10px] font-mono text-slate-400 w-8">
              {formatTime(duration)}
            </span>
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between pt-1">
            <button 
              onClick={onChangePlaybackMode}
              className={`p-2 rounded-full transition-all ${
                playbackMode !== "normal" 
                  ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-400" 
                  : "text-slate-400 hover:text-white"
              }`}
              title={`Playback Mode: ${playbackMode}`}
            >
              {playbackMode === "shuffle" ? (
                <Shuffle className="w-4 h-4" />
              ) : playbackMode === "loop-one" ? (
                <div className="relative">
                  <Repeat className="w-4 h-4 text-cyan-400" />
                  <span className="absolute -top-1 -right-1 text-[7px] font-bold font-mono px-0.5 bg-cyan-500 text-black rounded">1</span>
                </div>
              ) : (
                <Repeat className={`w-4 h-4 ${playbackMode === "loop-all" ? "text-cyan-400" : "text-slate-400"}`} />
              )}
            </button>

            <div className="flex items-center space-x-4">
              <button 
                onClick={onSkipPrev}
                className="p-2 text-slate-200 hover:text-white active:scale-90 transition-transform cursor-pointer"
                title="Previous Track"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              <button 
                onClick={onTogglePlay}
                className="p-3.5 bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 active:scale-95 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.4)] text-black transition-all flex items-center justify-center w-12 h-12 cursor-pointer"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isBuffering ? (
                  <Loader2 className="w-5 h-5 text-black animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5 text-black fill-black" />
                ) : (
                  <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                )}
              </button>

              <button 
                onClick={onSkipNext}
                className="p-2 text-slate-200 hover:text-white active:scale-90 transition-transform cursor-pointer"
                title="Next Track"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
            </div>

            <button 
              onClick={onToggleMute}
              className="p-2 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Toggle Mute"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
