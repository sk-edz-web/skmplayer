import React, { useState, useMemo } from "react";
import { 
  Share2, 
  Check, 
  Search, 
  Film, 
  Play, 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  ListVideo
} from "lucide-react";
import { VideoItem } from "../types";
import { VideoPlayer } from "./VideoPlayer";
import { formatDuration, formatViewCount, timeAgo } from "../lib/videoUtils";

interface VideoViewProps {
  videos: VideoItem[];
  currentVideo: VideoItem | null;
  onSelectVideo: (video: VideoItem | null) => void;
  onGoToMusic: () => void;
  onRecordVideoView?: (videoId: string) => void;
}

export const VideoView: React.FC<VideoViewProps> = ({
  videos,
  currentVideo,
  onSelectVideo,
  onGoToMusic,
  onRecordVideoView
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const [shareCopied, setShareCopied] = useState(false);

  // Extract unique categories from database videos
  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    videos.forEach(v => {
      if (v.category?.trim()) set.add(v.category.trim());
    });
    return Array.from(set);
  }, [videos]);

  // Filtered video list for browse feed
  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      const matchesSearch = 
        v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.creator && v.creator.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.category && v.category.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat = selectedCategory === "All" || v.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [videos, searchQuery, selectedCategory]);

  // Next up video recommendations (excluding current playing video)
  const upNextVideos = useMemo(() => {
    if (!currentVideo) return videos;
    return videos.filter(v => v.id !== currentVideo.id);
  }, [videos, currentVideo]);

  // Current playing video index to determine previous / next video existence
  const currentVideoIndex = useMemo(() => {
    if (!currentVideo) return -1;
    return videos.findIndex(v => v.id === currentVideo.id);
  }, [videos, currentVideo]);

  const hasPreviousVideo = currentVideoIndex > 0;
  const hasNextVideo = currentVideoIndex >= 0 && currentVideoIndex < videos.length - 1;

  const handlePreviousVideo = () => {
    if (hasPreviousVideo) {
      onSelectVideo(videos[currentVideoIndex - 1]);
      setIsMinimized(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNextVideo = () => {
    if (hasNextVideo) {
      onSelectVideo(videos[currentVideoIndex + 1]);
      setIsMinimized(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Real-time Like interaction handler (Real database increments)


  const handleShare = (video: VideoItem) => {
    const shareUrl = video.url || video.videoUrl || window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }).catch(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    });
  };

  return (
    <div className="w-full min-h-screen pb-32 text-slate-100 animate-fade-in select-none">
      {/* Main Content Area */}
      <div className={`w-full mx-auto ${currentVideo && !isMinimized ? "max-w-[1720px] px-0 sm:px-4 lg:px-8 pt-0 sm:pt-4" : "max-w-7xl px-0 sm:px-4 lg:px-8 pt-2 sm:pt-6"}`}>
        
        {/* CURRENT VIDEO PLAYER (ACTIVE OR MINIMIZED) */}
        {currentVideo && (
          <>
            {isMinimized ? (
              /* Minimized Floating Bar */
              <VideoPlayer 
                video={currentVideo} 
                autoPlay={true}
                isMinimized={true}
                onExpand={() => setIsMinimized(false)}
                onClose={() => {
                  setIsMinimized(false);
                  onSelectVideo(null);
                }}
                onViewRecorded={onRecordVideoView}
                onEnded={handleNextVideo}
              />
            ) : (
              /* Full Edge-to-Edge Player View (Clean Desktop 12-Col Cinema Layout) */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mb-8">
                
                {/* Main Video & Details Column */}
                <div className="flex flex-col lg:col-span-8">
                  
                  {/* EDGE-TO-EDGE VIDEO PLAYER (0 padding, 0 border on mobile, cinema on desktop) */}
                  <div className="w-[calc(100%+1.5rem)] sm:w-[calc(100%+3rem)] md:w-full -mx-3 sm:-mx-6 md:mx-0">
                    <VideoPlayer 
                      video={currentVideo} 
                      autoPlay={true}
                      isMinimized={false}
                      onViewRecorded={onRecordVideoView}
                      onMinimize={() => setIsMinimized(true)}
                      hasPreviousVideo={hasPreviousVideo}
                      hasNextVideo={hasNextVideo}
                      onPreviousVideo={handlePreviousVideo}
                      onNextVideo={handleNextVideo}
                      onEnded={handleNextVideo}
                    />
                  </div>

                  {/* Video Title & Actions */}
                  <div className="px-3 sm:px-1 pt-3 flex flex-col gap-3">
                    {/* Video Title */}
                    <h1 className="text-base sm:text-xl md:text-2xl font-bold text-white tracking-tight leading-snug">
                      {currentVideo.title}
                    </h1>

                    {/* Engagement Actions Row (Real database likes only) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 py-1.5 border-b border-slate-800/80">
                      {/* Real Views & Upload Date */}
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                        <span className="text-white font-bold flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-cyan-400" />
                          {formatViewCount(currentVideo.views)}
                        </span>
                        <span>·</span>
                        <span>{timeAgo(currentVideo.createdAt)}</span>
                      </div>

                      {/* Action Buttons: Like, Dislike, Share */}
                      <div className="flex items-center gap-2">


                        {/* Share Button */}
                        <button
                          onClick={() => handleShare(currentVideo)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-medium text-slate-200 transition-colors cursor-pointer shadow-sm"
                          title="Share Link"
                        >
                          {shareCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-medium">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Share</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Description Box */}
                    {currentVideo.description && (
                      <div 
                        onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                        className="p-3.5 rounded-2xl bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800 cursor-pointer transition-colors"
                      >
                        <p className={`text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line ${
                          isDescriptionExpanded ? "" : "line-clamp-2"
                        }`}>
                          {currentVideo.description}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white">
                          <span>{isDescriptionExpanded ? "Show less" : "Show more"}</span>
                          {isDescriptionExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Up Next Column (Desktop right sidebar) */}
                <div className="flex flex-col gap-3 px-3 sm:px-1 lg:col-span-4">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <ListVideo className="w-4 h-4 text-cyan-400" />
                      <span>Up Next</span>
                    </h2>
                  </div>

                  {/* Up Next List */}
                  <div className="flex flex-col gap-2.5">
                    {upNextVideos.length > 0 ? (
                      upNextVideos.map((video) => (
                        <div
                          key={video.id}
                          onClick={() => {
                            onSelectVideo(video);
                            setIsMinimized(false);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="group flex gap-3 p-2 rounded-xl hover:bg-slate-800/60 cursor-pointer transition-colors border border-transparent hover:border-slate-800"
                        >
                          <div className="relative w-36 aspect-video rounded-lg overflow-hidden bg-slate-900 shrink-0">
                            {video.thumbnailUrl ? (
                              <img
                                src={video.thumbnailUrl}
                                alt={video.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                                <Film className="w-6 h-6" />
                              </div>
                            )}
                            <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/85 text-[10px] font-mono font-medium text-white">
                              {formatDuration(video.duration)}
                            </div>
                          </div>

                          <div className="flex flex-col justify-start min-w-0 flex-1">
                            <h4 className="text-xs font-semibold text-slate-200 line-clamp-2 group-hover:text-cyan-300 transition-colors leading-snug mb-1">
                              {video.title}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1">
                              <span>{formatViewCount(video.views)}</span>
                              <span>·</span>
                              <span>{timeAgo(video.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
                        No more videos in the database.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* 
          =========================================================
          VIDEO DISCOVERY FEED (HOME SCREEN) - EDGE-TO-EDGE LIKE YT
          =========================================================
        */}
        {(!currentVideo || isMinimized) && (
          <div className="flex flex-col gap-4">
            {/* Search & Filter Bar */}
            <div className="px-3 sm:px-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search videos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700/80 focus:border-cyan-500 text-white rounded-xl pl-9 pr-4 py-2 text-xs md:text-sm placeholder-slate-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Category Chips Bar */}
              {categories.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        selectedCategory === cat
                          ? "bg-white text-slate-900 shadow-sm font-semibold"
                          : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Video Feed: 100% EDGE-TO-EDGE on Mobile like YT! */}
            {filteredVideos.length > 0 ? (
              <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 sm:gap-5">
                {filteredVideos.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => {
                      onSelectVideo(video);
                      setIsMinimized(false);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="group cursor-pointer flex flex-col pb-4 sm:pb-2 border-b border-slate-800/80 sm:border-0 hover:bg-white/[0.02] sm:rounded-2xl transition-all"
                  >
                    {/* Thumbnail: 100% EDGE-TO-EDGE ON MOBILE */}
                    <div className="relative w-[calc(100%+1.5rem)] sm:w-full -mx-3 sm:mx-0 aspect-video rounded-none sm:rounded-xl overflow-hidden bg-slate-900 shadow-md">
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                          <Film className="w-8 h-8" />
                        </div>
                      )}

                      {/* Play hover badge */}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                          <Play className="w-6 h-6 ml-0.5 fill-white" />
                        </div>
                      </div>

                      {/* Duration Badge */}
                      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 text-[10px] font-mono font-medium text-white shadow-sm">
                        {formatDuration(video.duration)}
                      </div>

                      {/* Quality Badge */}
                      {video.resolutions && (video.resolutions["4k"] || video.resolutions["1080p"]) && (
                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-amber-500/90 text-slate-950 font-bold text-[9px] shadow-sm">
                          {video.resolutions["4k"] ? "4K" : "HD"}
                        </div>
                      )}
                    </div>

                    {/* Metadata Details (Clean typography, Real views) */}
                    <div className="px-3 sm:px-1 pt-2.5 flex flex-col">
                      <h3 className="text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors line-clamp-2 leading-snug">
                        {video.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                        <span>{formatViewCount(video.views)}</span>
                        <span>·</span>
                        <span>{timeAgo(video.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center justify-center mx-3 sm:mx-0">
                <Film className="w-12 h-12 text-slate-600 mb-3" />
                <h3 className="text-base font-semibold text-slate-300">No videos found</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  {searchQuery ? "Try searching for another keyword." : "Add videos in the Admin Panel to stream them here."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
