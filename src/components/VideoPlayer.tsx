import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Settings, 
  RotateCcw,
  RotateCw,
  Loader2,
  Check,
  Gauge,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  SkipBack,
  SkipForward
} from "lucide-react";
import { VideoItem } from "../types";
import { extractYouTubeId, formatDuration, loadYouTubeIframeApi } from "../lib/videoUtils";

interface VideoPlayerProps {
  video: VideoItem;
  onEnded?: () => void;
  autoPlay?: boolean;
  className?: string;
  isMinimized?: boolean;
  onViewRecorded?: (videoId: string) => void;
  onMinimize?: () => void;
  onExpand?: () => void;
  onClose?: () => void;
  hasPreviousVideo?: boolean;
  hasNextVideo?: boolean;
  onPreviousVideo?: () => void;
  onNextVideo?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  video,
  onEnded,
  autoPlay = true,
  className = "",
  isMinimized = false,
  onViewRecorded,
  onMinimize,
  onExpand,
  onClose,
  hasPreviousVideo = false,
  hasNextVideo = false,
  onPreviousVideo,
  onNextVideo
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRecordedViewRef = useRef<string | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const touchStartRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  
  // Track if user explicitly paused or cancelled playback to prevent delayed autoplay bugs
  const userPausedRef = useRef<boolean>(false);

  const rawUrl = video.url || video.videoUrl || "";
  const ytId = useMemo(() => extractYouTubeId(rawUrl), [rawUrl]);

  // Player States
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(video.duration || 0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [selectedQuality, setSelectedQuality] = useState<string>("Auto");
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [settingsSubView, setSettingsSubView] = useState<"main" | "quality" | "speed">("main");
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<{
    side: "left" | "right";
    label: string;
  } | null>(null);

  // Available stream resolution map for direct video files
  const availableResolutions = useMemo(() => {
    const res: { label: string; url: string }[] = [];
    if (video.resolutions) {
      if (video.resolutions["4k"]) res.push({ label: "4K (2160p)", url: video.resolutions["4k"] });
      if (video.resolutions["1080p"]) res.push({ label: "1080p HD", url: video.resolutions["1080p"] });
      if (video.resolutions["720p"]) res.push({ label: "720p HD", url: video.resolutions["720p"] });
      if (video.resolutions["480p"]) res.push({ label: "480p SD", url: video.resolutions["480p"] });
    }
    return res;
  }, [video.resolutions]);

  // Determine active media URL based on quality selection
  const currentStreamUrl = useMemo(() => {
    if (selectedQuality === "Auto") return rawUrl;
    const matched = availableResolutions.find(r => r.label.startsWith(selectedQuality));
    return matched?.url || rawUrl;
  }, [selectedQuality, availableResolutions, rawUrl]);

  // Record real-time view once per video playback
  const triggerRecordView = useCallback(() => {
    if (hasRecordedViewRef.current !== video.id) {
      hasRecordedViewRef.current = video.id;
      if (onViewRecorded) {
        onViewRecorded(video.id);
      }
    }
  }, [video.id, onViewRecorded]);

  // Reset player states & trigger YouTube-style opening splash when video changes
  useEffect(() => {
    setIsPlaying(false);
    userPausedRef.current = false;
    setCurrentTime(0);
    setDuration(video.duration || 0);
    setSelectedQuality("Auto");
    setIsBuffering(false);
    setPlaybackSpeed(1);
    hasRecordedViewRef.current = null;
    setShowControls(true);
    setShowSettingsModal(false);
    setSettingsSubView("main");

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [video.id, video.duration]);

  // Clean polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Controls visibility auto-hide on inactivity - 1400ms hide timer
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettingsModal) {
        setShowControls(false);
      }
    }, 1400);
  }, [isPlaying, showSettingsModal]);

  // Initialize YouTube Iframe API Player with custom controls & guarded playback
  useEffect(() => {
    if (!ytId) return;

    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    loadYouTubeIframeApi().then((YT) => {
      if (!isMounted || !ytContainerRef.current) return;

      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {
          // ignore
        }
        ytPlayerRef.current = null;
      }

      const playerDiv = document.createElement("div");
      playerDiv.id = `yt-embedded-${Date.now()}`;
      ytContainerRef.current.innerHTML = "";
      ytContainerRef.current.appendChild(playerDiv);

      try {
        ytPlayerRef.current = new YT.Player(playerDiv, {
          videoId: ytId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: autoPlay ? 1 : 0,
            controls: 0, // HIDE NATIVE CONTROLS
            disablekb: 1,
            fs: 0,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            showinfo: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              const dur = event.target.getDuration();
              if (dur && dur > 0) setDuration(dur);
              event.target.setVolume(volume * 100);
              if (isMuted) event.target.mute();

              // PREVENT DELAYED UNEXPECTED AUTOPLAY:
              // Only start playback if autoPlay requested AND user did NOT explicitly pause!
              if (autoPlay && !userPausedRef.current) {
                event.target.playVideo();
              } else if (userPausedRef.current) {
                event.target.pauseVideo();
              }
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              if (event.data === 1) { // PLAYING
                setIsPlaying(true);
                setIsBuffering(false);
                triggerRecordView();
              } else if (event.data === 2) { // PAUSED
                setIsPlaying(false);
                setIsBuffering(false);
                setShowControls(true);
              } else if (event.data === 3) { // BUFFERING
                setIsBuffering(true);
              } else if (event.data === 0) { // ENDED
                setIsPlaying(false);
                setIsBuffering(false);
                setShowControls(true);
                if (onEnded) onEnded();
              }
            }
          }
        });

        pollInterval = setInterval(() => {
          if (!isMounted || !ytPlayerRef.current) return;
          try {
            if (typeof ytPlayerRef.current.getCurrentTime === "function") {
              const cur = ytPlayerRef.current.getCurrentTime();
              if (typeof cur === "number" && !isNaN(cur)) {
                setCurrentTime(cur);
              }
            }
            if (typeof ytPlayerRef.current.getDuration === "function") {
              const dur = ytPlayerRef.current.getDuration();
              if (typeof dur === "number" && dur > 0) {
                setDuration(dur);
              }
            }
          } catch (e) {
            // ignore
          }
        }, 250);
      } catch (err) {
        console.warn("Error initializing player API:", err);
      }
    });

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {
          // ignore
        }
        ytPlayerRef.current = null;
      }
    };
  }, [ytId, autoPlay, triggerRecordView, onEnded]);

  // Robust Unified Play / Pause Action
  const togglePlay = useCallback(() => {
    if (ytId && ytPlayerRef.current) {
      try {
        const pState = typeof ytPlayerRef.current.getPlayerState === "function" 
          ? ytPlayerRef.current.getPlayerState() 
          : -1;

        // 1 = PLAYING, 3 = BUFFERING
        if (pState === 1 || pState === 3 || isPlaying) {
          ytPlayerRef.current.pauseVideo();
          userPausedRef.current = true;
          setIsPlaying(false);
          setShowControls(true);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        } else {
          userPausedRef.current = false;
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
          triggerRecordView();
          showControlsTemporarily();
        }
      } catch (e) {
        console.warn("Play/pause error:", e);
      }
      return;
    }

    if (videoRef.current) {
      if (videoRef.current.paused) {
        userPausedRef.current = false;
        videoRef.current.play().then(() => {
          setIsPlaying(true);
          triggerRecordView();
          showControlsTemporarily();
        }).catch(e => console.warn("Video play error:", e));
      } else {
        userPausedRef.current = true;
        videoRef.current.pause();
        setIsPlaying(false);
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [ytId, isPlaying, triggerRecordView, showControlsTemporarily]);

  // Unified Seek Action
  const handleSeek = (newTime: number) => {
    showControlsTemporarily();
    const clampedTime = Math.max(0, Math.min(duration || 100, newTime));
    setCurrentTime(clampedTime);

    if (ytId && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.seekTo(clampedTime, true);
      } catch (e) {
        console.warn("Seek error:", e);
      }
      return;
    }

    if (videoRef.current) {
      videoRef.current.currentTime = clampedTime;
    }
  };

  // Skip 10s forward or backward (Double Tap Only)
  const handleSkipSeconds = (offset: number) => {
    const target = Math.max(0, Math.min(duration || 100, currentTime + offset));
    handleSeek(target);

    setDoubleTapFeedback({
      side: offset < 0 ? "left" : "right",
      label: `${Math.abs(offset)}s`
    });
    setTimeout(() => setDoubleTapFeedback(null), 650);
  };

  // Volume & Mute Handlers
  const handleVolumeChange = (newVolume: number) => {
    showControlsTemporarily();
    setVolume(newVolume);
    setIsMuted(newVolume === 0);

    if (ytId && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.setVolume(newVolume * 100);
        if (newVolume === 0) ytPlayerRef.current.mute();
        else ytPlayerRef.current.unMute();
      } catch (e) {
        console.warn("Volume error:", e);
      }
      return;
    }

    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
  };

  const toggleMute = () => {
    showControlsTemporarily();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (ytId && ytPlayerRef.current) {
      try {
        if (nextMuted) {
          ytPlayerRef.current.mute();
        } else {
          ytPlayerRef.current.unMute();
          if (volume === 0) {
            setVolume(0.5);
            ytPlayerRef.current.setVolume(50);
          }
        }
      } catch (e) {
        console.warn("Mute error:", e);
      }
      return;
    }

    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      if (!nextMuted && volume === 0) {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
      }
    }
  };

  // Playback Speed Handler
  const handleSetPlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    setShowSettingsModal(false);
    showControlsTemporarily();

    if (ytId && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.setPlaybackRate(speed);
      } catch (e) {
        console.warn("Speed error:", e);
      }
      return;
    }

    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  // Quality Selector Handler
  const handleSelectQuality = (qualityLabel: string, targetUrl?: string) => {
    setSelectedQuality(qualityLabel);
    setShowSettingsModal(false);
    showControlsTemporarily();

    if (targetUrl && videoRef.current) {
      const savedTime = videoRef.current.currentTime;
      const wasPlaying = !videoRef.current.paused;

      videoRef.current.src = targetUrl;
      videoRef.current.load();

      const onLoaded = () => {
        if (videoRef.current) {
          videoRef.current.currentTime = savedTime;
          if (wasPlaying && !userPausedRef.current) {
            videoRef.current.play().catch(e => console.warn("Resume after quality switch:", e));
          }
        }
        videoRef.current?.removeEventListener("loadedmetadata", onLoaded);
      };
      videoRef.current.addEventListener("loadedmetadata", onLoaded);
    } else if (ytId && ytPlayerRef.current) {
      try {
        const qualityMap: Record<string, string> = {
          "1080p": "hd1080",
          "720p": "hd720",
          "480p": "large",
          "360p": "medium",
          "Auto": "default"
        };
        const ytTarget = qualityMap[qualityLabel] || "default";
        if (typeof ytPlayerRef.current.setPlaybackQuality === "function") {
          ytPlayerRef.current.setPlaybackQuality(ytTarget);
        }
      } catch (e) {
        // ignore
      }
    }
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    showControlsTemporarily();
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.warn("Fullscreen error:", err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(err => {
        console.warn("Exit fullscreen error:", err);
      });
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // SWIPE GESTURE DETECTORS (ONLY ON THE VIDEO SURFACE ITSELF)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now()
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.changedTouches.length === 1) {
      const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
      const timeDiff = Date.now() - touchStartRef.current.time;

      // Swiping vertically on the video surface only (> 55px drag, < 650ms duration)
      if (timeDiff < 650 && Math.abs(deltaY) > 55 && Math.abs(deltaY) > Math.abs(deltaX) * 1.3) {
        if (deltaY > 55) {
          // SWIPE DOWN: Exit fullscreen OR Minimize player!
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else if (onMinimize) {
            onMinimize();
          }
          return;
        } else if (deltaY < -55) {
          // SWIPE UP: Enter Fullscreen!
          if (!document.fullscreenElement) {
            toggleFullscreen();
          }
          return;
        }
      }
    }
  };

  // Fast Click & Double-Tap Detection on Video Overlay
  const handleSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If click was on a button or menu inside overlay, do not process surface toggle
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest(".zync-settings-menu")) return;

    if (showSettingsModal) {
      setShowSettingsModal(false);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const now = Date.now();

    // Double tap detector (within 300ms)
    if (now - lastTapRef.current.time < 300) {
      // Left 35% -> Rewind 10s
      if (clickX < width * 0.35) {
        handleSkipSeconds(-10);
      } 
      // Right 35% -> Forward 10s
      else if (clickX > width * 0.65) {
        handleSkipSeconds(10);
      } else {
        togglePlay();
      }
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: clickX };
      // Single tap toggles controls visibility
      if (!showControls) {
        showControlsTemporarily();
      } else {
        setShowControls(false);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      }
    }
  };

  // Keyboard Navigation Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft" || e.key === "j") {
        e.preventDefault();
        handleSkipSeconds(-10);
      } else if (e.key === "ArrowRight" || e.key === "l") {
        e.preventDefault();
        handleSkipSeconds(10);
      } else if (e.key === "m") {
        e.preventDefault();
        toggleMute();
      } else if (e.key === "f") {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [duration, isPlaying, isMuted, volume, currentTime, togglePlay]);

  /* ========================================================= */
  /* MINIMIZED FLOATING MINI-PLAYER VIEW (SNUG ABOVE NAV BAR)  */
  /* ========================================================= */
  if (isMinimized) {
    const miniPlayerContent = (
      <div 
        onClick={onExpand}
        className="fixed bottom-[74px] sm:bottom-[78px] md:bottom-6 inset-x-3 sm:inset-x-4 md:inset-x-auto md:right-6 md:w-96 z-50 bg-[#0c101d]/98 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl flex items-center p-2 gap-3 cursor-pointer select-none animate-slide-up"
        title="Tap to expand video"
      >
        {/* Left: Mini Video Container */}
        <div className="relative w-24 h-14 bg-black rounded-lg overflow-hidden shrink-0 border border-slate-800 pointer-events-none">
          {ytId ? (
            <div 
              ref={ytContainerRef}
              className="absolute inset-0 w-full h-full pointer-events-none scale-105"
            />
          ) : (
            <video
              ref={videoRef}
              src={currentStreamUrl}
              autoPlay={autoPlay && !userPausedRef.current}
              playsInline
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Center: Video Title & Time */}
        <div className="flex flex-col min-w-0 flex-1 justify-center">
          <h4 className="text-xs font-bold text-white truncate leading-tight">
            {video.title}
          </h4>
          <span className="text-[10px] text-cyan-400 font-mono mt-0.5">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
        </div>

        {/* Right: Quick Actions (Play/Pause & Close) */}
        <div className="flex items-center gap-1.5 shrink-0 pr-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-90"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 ml-0.5 fill-white" />
            )}
          </button>

          {onClose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-8 h-8 rounded-full hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all active:scale-90"
              title="Close Player"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );

    return typeof document !== "undefined" ? createPortal(miniPlayerContent, document.body) : miniPlayerContent;
  }

  /* ========================================================= */
  /* STANDARD / FULL VIDEO PLAYER VIEW                        */
  /* ========================================================= */
  return (
    <div 
      ref={containerRef}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className={`relative w-full aspect-video bg-black rounded-none md:rounded-2xl overflow-hidden shadow-2xl border-0 md:border md:border-slate-800/80 group select-none ${className}`}
    >
      {/* 1. MEDIA EMBED - SCALED TO CLIP OUT ANY NATIVE BRANDING & WATERMARK */}
      {ytId ? (
        <div 
          ref={ytContainerRef}
          className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden scale-[1.04] [&_iframe]:pointer-events-none [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-0"
          style={{ pointerEvents: "none" }}
        />
      ) : (
        <video
          ref={videoRef}
          src={currentStreamUrl}
          poster={video.thumbnailUrl}
          autoPlay={autoPlay && !userPausedRef.current}
          playsInline
          onTimeUpdate={() => {
            if (videoRef.current) {
              setCurrentTime(videoRef.current.currentTime);
              if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
                setDuration(videoRef.current.duration);
              }
            }
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
            triggerRecordView();
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            if (onEnded) onEnded();
          }}
          className="w-full h-full object-contain"
        />
      )}

      {/* 2. INTERACTIVE GESTURE SURFACE (HANDLES SWIPE DOWN/UP ONLY ON VIDEO!) */}
      <div 
        onClick={handleSurfaceClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="absolute inset-0 z-10 cursor-pointer bg-transparent"
        aria-label="Video Surface"
      />

      {/* 3. DOUBLE-TAP SKIP ANIMATION OVERLAY (+10s / -10s) */}
      {doubleTapFeedback && (
        <div 
          className={`absolute top-1/2 -translate-y-1/2 z-25 pointer-events-none flex flex-col items-center justify-center p-5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 animate-ping ${
            doubleTapFeedback.side === "left" ? "left-8 sm:left-16" : "right-8 sm:right-16"
          }`}
        >
          {doubleTapFeedback.side === "left" ? (
            <RotateCcw className="w-8 h-8 text-cyan-400 animate-spin" />
          ) : (
            <RotateCw className="w-8 h-8 text-cyan-400 animate-spin" />
          )}
          <span className="text-xs font-bold text-white mt-1 font-mono">
            {doubleTapFeedback.label}
          </span>
        </div>
      )}

      {/* 4. BUFFERING SPINNER WITH MINI ZYNC ACCENT */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] pointer-events-none z-20">
          <Loader2 className="w-11 h-11 text-cyan-400 animate-spin" />
        </div>
      )}

      {/* 5. TOP BAR: MINIMIZE BUTTON (WHEN CONTROLS VISIBLE) */}
      <div 
        className={`absolute top-0 left-0 right-0 z-30 p-3 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
          showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {onMinimize && (
          <button
            onClick={onMinimize}
            className="p-2 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md transition-all active:scale-90"
            title="Minimize Video (Swipe down)"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}
        <div />
      </div>

      {/* 6. CENTER OVERLAY CLUSTER: PREVIOUS + PLAY/PAUSE + NEXT (IMMEDIATE RESPONSIVE ACTIONS) */}
      <div 
        className={`absolute inset-0 flex items-center justify-center pointer-events-none z-25 transition-opacity duration-200 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-6 sm:gap-10 pointer-events-auto">
          {/* Previous Video Button - Shown ONLY IF there is a previous video */}
          {hasPreviousVideo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onPreviousVideo) onPreviousVideo();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                if (onPreviousVideo) onPreviousVideo();
              }}
              className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center shadow-lg active:scale-90 transition-all border border-white/20 backdrop-blur-sm cursor-pointer"
              title="Previous Video"
            >
              <SkipBack className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />
            </button>
          )}

          {/* Big Center Play / Pause Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600/95 hover:bg-red-500 text-white flex items-center justify-center shadow-[0_0_35px_rgba(220,38,38,0.6)] active:scale-95 transition-all border border-white/20 cursor-pointer"
            aria-label={isPlaying ? "Pause Video" : "Play Video"}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-white" />
            ) : (
              <Play className="w-8 h-8 sm:w-10 sm:h-10 ml-1 fill-white" />
            )}
          </button>

          {/* Next Video Button - Shown ONLY IF there is a next video */}
          {hasNextVideo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onNextVideo) onNextVideo();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                if (onNextVideo) onNextVideo();
              }}
              className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center shadow-lg active:scale-90 transition-all border border-white/20 backdrop-blur-sm cursor-pointer"
              title="Next Video"
            >
              <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />
            </button>
          )}
        </div>
      </div>

      {/* 8. YOUTUBE-STYLE SETTINGS POPUP (COMPACT, SEMI-TRANSPARENT, BOTTOM-RIGHT CORNER) */}
      {showSettingsModal && (
        <>
          {/* Transparent click-away layer to dismiss settings */}
          <div 
            onClick={() => setShowSettingsModal(false)}
            className="absolute inset-0 z-35 bg-transparent"
          />

          <div 
            onClick={(e) => e.stopPropagation()}
            className="zync-settings-menu absolute bottom-14 right-2.5 sm:right-5 z-40 w-52 sm:w-60 bg-[#070b14]/85 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_12px_35px_rgba(0,0,0,0.85)] p-2.5 flex flex-col gap-2 select-none animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                {settingsSubView !== "main" && (
                  <button
                    onClick={() => setSettingsSubView("main")}
                    className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                )}
                <h3 className="text-[11px] font-bold text-white tracking-wide uppercase">
                  {settingsSubView === "main" ? "Settings" : settingsSubView === "quality" ? "Quality" : "Playback Speed"}
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sub-View: Main Settings Menu */}
            {settingsSubView === "main" && (
              <div className="flex flex-col gap-1 py-0.5">
                {/* Quality Row */}
                <button
                  onClick={() => setSettingsSubView("quality")}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/10 text-xs text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Quality</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                    <span className="font-medium text-slate-300">{selectedQuality}</span>
                    <ChevronRight className="w-3 h-3 text-slate-500" />
                  </div>
                </button>

                {/* Playback Speed Row */}
                <button
                  onClick={() => setSettingsSubView("speed")}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/10 text-xs text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Playback Speed</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                    <span className="font-medium text-slate-300">{playbackSpeed === 1 ? "Normal" : `${playbackSpeed}x`}</span>
                    <ChevronRight className="w-3 h-3 text-slate-500" />
                  </div>
                </button>
              </div>
            )}

            {/* Sub-View: Quality Selector */}
            {settingsSubView === "quality" && (
              <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                {["Auto", "1080p", "720p", "480p", "360p"].map((q) => {
                  const matchedRes = availableResolutions.find(r => r.label.startsWith(q));
                  return (
                    <button
                      key={q}
                      onClick={() => handleSelectQuality(q, matchedRes?.url)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                        selectedQuality === q ? "bg-white/10 text-cyan-400 font-bold" : "text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      <span>{q === "Auto" ? "Auto (Adaptive HD)" : `${q} HD`}</span>
                      {selectedQuality === q && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sub-View: Playback Speed Selector */}
            {settingsSubView === "speed" && (
              <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSetPlaybackSpeed(s)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                      playbackSpeed === s ? "bg-white/10 text-cyan-400 font-bold" : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <span>{s === 1 ? "Normal (1x)" : `${s}x`}</span>
                    {playbackSpeed === s && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* 9. ULTRA-CLEAN BOTTOM BAR (COMPACT & NEVER OVERFLOWS) */}
      <div 
        className={`absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-12 pb-3 px-3 sm:px-5 transition-opacity duration-200 ${
          showControls || !isPlaying ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Scrubber Progress Slider */}
        <div className="relative mb-2.5 flex items-center group/scrubber">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="w-full h-1.5 sm:h-2 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-red-600 hover:h-2.5 transition-all"
            style={{
              background: `linear-gradient(to right, #ef4444 ${(currentTime / (duration || 1)) * 100}%, rgba(100, 116, 139, 0.45) ${(currentTime / (duration || 1)) * 100}%)`
            }}
          />
        </div>

        {/* Action Controls Row - Compact & Space-Optimized */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Play/Pause, Volume, Time */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="text-white hover:text-red-400 active:scale-95 transition-all p-1.5 rounded-lg hover:bg-white/10"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-white" />
              ) : (
                <Play className="w-5 h-5 fill-white" />
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                className="text-white hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/10"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-10 sm:w-16 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-red-600 hidden xs:block sm:block"
                title="Volume"
              />
            </div>

            {/* Time Readout */}
            <div className="text-[11px] sm:text-xs font-mono text-slate-300 ml-1 whitespace-nowrap">
              <span className="text-white font-medium">{formatDuration(currentTime)}</span>
              <span className="mx-1 text-slate-500">/</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Right: Settings Modal Trigger & Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Settings Gear (Quality + Playback Speed popup) */}
            <button
              onClick={() => {
                setShowSettingsModal(!showSettingsModal);
                setSettingsSubView("main");
              }}
              className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Settings (Quality, Playback Speed)"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-red-400 active:scale-95 transition-all p-1.5 rounded-lg hover:bg-white/10"
              title={isFullscreen ? "Exit Fullscreen (f)" : "Fullscreen (f / Swipe up)"}
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
