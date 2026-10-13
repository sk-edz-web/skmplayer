import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Film, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  Search, 
  Play, 
  Pause, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ExternalLink, 
  Clock, 
  Image as ImageIcon,
  Check,
  RefreshCw,
  Loader2,
  Tv,
  Eye,
  Sliders,
  UploadCloud
} from "lucide-react";
import { VideoItem } from "../types";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  onSnapshot 
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToImgBB, extractYouTubeId, formatDuration, autoDetectVideoDetails } from "../lib/videoUtils";
import { VideoPlayer } from "./VideoPlayer";

interface AdminVideosManagerProps {
  onShowToast: (message: string, type: "success" | "error" | "info") => void;
}

export const AdminVideosManager: React.FC<AdminVideosManagerProps> = ({
  onShowToast
}) => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Form states (manually typed details, url for video, ImgBB/URL for image)
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [category, setCategory] = useState("Music Video");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [durationInput, setDurationInput] = useState<string>("215");

  // Multi-resolution stream URLs (4K, 1080p, 720p, 480p)
  const [res4k, setRes4k] = useState("");
  const [res1080p, setRes1080p] = useState("");
  const [res720p, setRes720p] = useState("");
  const [res480p, setRes480p] = useState("");
  const [showMultiRes, setShowMultiRes] = useState(false);

  // Thumbnail states (direct URL or ImgBB file upload)
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [isUploadingImgBB, setIsUploadingImgBB] = useState(false);
  const [imgbbProgress, setImgbbProgress] = useState(0);

  // Auto-detection states for YouTube metadata and accurate duration
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [autoDetectStatus, setAutoDetectStatus] = useState<string | null>(null);
  const [lastAutoDetectedUrl, setLastAutoDetectedUrl] = useState<string>("");
  const [autoDetectNotice, setAutoDetectNotice] = useState<string | null>(null);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview modal state
  const [previewVideo, setPreviewVideo] = useState<VideoItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Real-time Firestore sync of videos collection
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "videos"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: VideoItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            title: data.title || "Untitled Video",
            creator: data.creator || "ZYNC Official",
            description: data.description || "",
            category: data.category || "Music Video",
            url: data.url || data.videoUrl || "",
            videoUrl: data.videoUrl || data.url || "",
            isYouTube: data.isYouTube ?? (extractYouTubeId(data.url || data.videoUrl || "") !== null),
            resolutions: data.resolutions || {},
            thumbnailUrl: data.thumbnailUrl || "",
            duration: Number(data.duration) || 0,
            likes: Number(data.likes) || 0,
            views: Number(data.views) || 0,
            createdAt: data.createdAt || Date.now(),
            userId: data.userId || "admin"
          });
        });
        setVideos(list);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore videos subscription error:", error);
        setLoading(false);
        onShowToast("Failed to load videos from database", "error");
      }
    );

    return () => unsubscribe();
  }, [onShowToast]);

  // Handle ImgBB Thumbnail Upload
  const handleImgBBUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onShowToast("Please select a valid image file", "error");
      return;
    }

    setIsUploadingImgBB(true);
    setImgbbProgress(25);

    try {
      const hostedUrl = await uploadToImgBB(file, (percent) => {
        setImgbbProgress(percent);
      });
      setThumbnailUrl(hostedUrl);
      onShowToast("Thumbnail uploaded to ImgBB successfully! 🖼️", "success");
    } catch (err: any) {
      console.error("ImgBB upload error:", err);
      onShowToast(err.message || "ImgBB upload failed", "error");
    } finally {
      setIsUploadingImgBB(false);
      setImgbbProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Auto-detect video details & accurate duration
  const handleAutoDetect = async (urlToDetect?: string, force = false) => {
    const targetUrl = (urlToDetect !== undefined ? urlToDetect : videoUrl).trim();
    if (!targetUrl) {
      if (force) onShowToast("Please enter or paste a video URL first", "error");
      return;
    }

    if (!force && targetUrl === lastAutoDetectedUrl) {
      return;
    }

    setIsAutoDetecting(true);
    setAutoDetectNotice(null);
    setAutoDetectStatus("⚡ Auto-detecting metadata, channel & exact duration...");

    try {
      const meta = await autoDetectVideoDetails(targetUrl);
      setLastAutoDetectedUrl(targetUrl);

      const detectedFields: string[] = [];

      if (meta.title) {
        setTitle(meta.title);
        detectedFields.push("Title");
      }
      if (meta.creator) {
        setCreator(meta.creator);
        detectedFields.push("Channel");
      }
      if (meta.duration && meta.duration > 0) {
        setDurationInput(String(meta.duration));
        detectedFields.push(`Duration (${formatDuration(meta.duration)})`);
      }
      if (meta.thumbnailUrl) {
        setThumbnailUrl(meta.thumbnailUrl);
        detectedFields.push("Cover image");
      }
      if (meta.category) {
        setCategory(meta.category);
      }
      if (meta.description) {
        setDescription(meta.description);
      }

      if (detectedFields.length > 0) {
        const noticeMsg = `Auto-detected: ${detectedFields.join(", ")}! ✨`;
        setAutoDetectNotice(noticeMsg);
        onShowToast(noticeMsg, "success");
      } else if (force) {
        onShowToast("No auto-metadata found for this URL. You can type details manually.", "info");
      }
    } catch (err: any) {
      console.warn("Auto-detect failed:", err);
      if (force) onShowToast("Auto-detection failed. You can type details manually.", "error");
    } finally {
      setIsAutoDetecting(false);
      setAutoDetectStatus(null);
    }
  };

  // Reset form
  const resetForm = () => {
    setEditingVideoId(null);
    setTitle("");
    setCreator("");
    setCategory("Music Video");
    setDescription("");
    setVideoUrl("");
    setDurationInput("215");
    setRes4k("");
    setRes1080p("");
    setRes720p("");
    setRes480p("");
    setThumbnailUrl("");
    setShowMultiRes(false);
    setLastAutoDetectedUrl("");
    setAutoDetectNotice(null);
    setAutoDetectStatus(null);
  };

  // Populate form for editing
  const handleEditClick = (v: VideoItem) => {
    setEditingVideoId(v.id);
    setTitle(v.title);
    setCreator(v.creator || "");
    setCategory(v.category || "Music Video");
    setDescription(v.description || "");
    setVideoUrl(v.url || v.videoUrl || "");
    setDurationInput(String(v.duration || 215));
    setThumbnailUrl(v.thumbnailUrl || "");

    if (v.resolutions) {
      setRes4k(v.resolutions["4k"] || "");
      setRes1080p(v.resolutions["1080p"] || "");
      setRes720p(v.resolutions["720p"] || "");
      setRes480p(v.resolutions["480p"] || "");
      if (v.resolutions["4k"] || v.resolutions["1080p"] || v.resolutions["720p"] || v.resolutions["480p"]) {
        setShowMultiRes(true);
      }
    } else {
      setRes4k("");
      setRes1080p("");
      setRes720p("");
      setRes480p("");
    }

    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Save / Update Video in Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      onShowToast("Video title is required", "error");
      return;
    }
    if (!videoUrl.trim()) {
      onShowToast("Video stream or YouTube URL is required", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const isYt = extractYouTubeId(videoUrl) !== null;
      const parsedDuration = parseInt(durationInput, 10) || 0;

      const resolutionsObj: { [key: string]: string } = {};
      if (res4k.trim()) resolutionsObj["4k"] = res4k.trim();
      if (res1080p.trim()) resolutionsObj["1080p"] = res1080p.trim();
      if (res720p.trim()) resolutionsObj["720p"] = res720p.trim();
      if (res480p.trim()) resolutionsObj["480p"] = res480p.trim();

      const videoData = {
        title: title.trim(),
        creator: creator.trim() || "ZYNC Official",
        category: category.trim() || "Music Video",
        description: description.trim(),
        url: videoUrl.trim(),
        videoUrl: videoUrl.trim(),
        isYouTube: isYt,
        resolutions: resolutionsObj,
        thumbnailUrl: thumbnailUrl.trim() || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
        duration: parsedDuration,
        userId: auth.currentUser?.uid || "admin",
        updatedAt: Date.now()
      };

      if (editingVideoId) {
        await updateDoc(doc(db, "videos", editingVideoId), videoData);
        onShowToast("Video updated successfully in database! ✨", "success");
      } else {
        await addDoc(collection(db, "videos"), {
          ...videoData,
          likes: 0,
          views: 0,
          createdAt: Date.now()
        });
        onShowToast("New video published to ZYNC database! 🎥", "success");
      }

      resetForm();
    } catch (err: any) {
      console.error("Firestore video save error:", err);
      onShowToast(err.message || "Failed to save video", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Video from Firestore
  const handleDeleteVideo = async (id: string, videoTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${videoTitle}" from the database?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "videos", id));
      onShowToast(`Deleted "${videoTitle}" from database`, "info");
      if (editingVideoId === id) resetForm();
      if (previewVideo?.id === id) setPreviewVideo(null);
    } catch (err: any) {
      console.error("Failed to delete video:", err);
      onShowToast("Failed to delete video", "error");
    }
  };

  // Filtered video list
  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return videos;
    const q = searchQuery.toLowerCase();
    return videos.filter(
      v => v.title.toLowerCase().includes(q) ||
           (v.creator && v.creator.toLowerCase().includes(q)) ||
           (v.category && v.category.toLowerCase().includes(q))
    );
  }, [videos, searchQuery]);

  return (
    <div className="space-y-8 animate-fade-in text-slate-100">
      {/* Top Header Card */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Video Management & ImgBB Integration
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Add YouTube or direct-stream videos, manage multi-resolution URLs (4K/1080p/720p/480p), and upload thumbnails directly via ImgBB.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
              {videos.length} Database Videos
            </span>
            {editingVideoId && (
              <button
                onClick={resetForm}
                className="px-3 py-1 text-xs rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>

        {/* Video Creation / Edit Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-6 pt-6 border-t border-slate-800/80">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. Title (manual text) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Video Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Arabic Kuthu - Official Video Song"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-red-500 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            </div>

            {/* 2. Creator / Channel / Artist Name (manual text) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Creator / Channel / Artist Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
                placeholder="e.g. Sun Pictures / Anirudh Ravichander"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-red-500 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            </div>

            {/* 3. Category (manual text / dropdown) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Music Video, Live Concert, Remix"
                list="category-suggestions"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-red-500 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
              <datalist id="category-suggestions">
                <option value="Music Video" />
                <option value="Live Concert" />
                <option value="Official Audio" />
                <option value="Remix" />
                <option value="Lofi / Acoustic" />
                <option value="Visualizer" />
              </datalist>
            </div>

            {/* 4. Primary Video URL (YouTube or Direct hosted stream) */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Primary Video URL (YouTube or Direct Stream URL) <span className="text-red-400">*</span></span>
                {extractYouTubeId(videoUrl) ? (
                  <span className="text-[11px] text-red-400 font-medium flex items-center gap-1">
                    <Tv className="w-3 h-3" /> Cloud Stream Detected
                  </span>
                ) : videoUrl.trim() ? (
                  <span className="text-[11px] text-cyan-400 font-medium flex items-center gap-1">
                    <Film className="w-3 h-3" /> Direct Video Stream
                  </span>
                ) : null}
              </label>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  required
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    if (pasted && pasted.trim()) {
                      setVideoUrl(pasted.trim());
                      handleAutoDetect(pasted.trim(), true);
                    }
                  }}
                  onBlur={() => {
                    if (videoUrl.trim() && videoUrl.trim() !== lastAutoDetectedUrl) {
                      handleAutoDetect(videoUrl.trim(), false);
                    }
                  }}
                  placeholder="https://www.youtube.com/watch?v=... or https://cdn.example.com/video.mp4"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-red-500 text-sm text-white placeholder-slate-500 focus:outline-none font-mono transition-colors"
                />

                <button
                  type="button"
                  disabled={isAutoDetecting || !videoUrl.trim()}
                  onClick={() => handleAutoDetect(videoUrl, true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 transition-all shrink-0 cursor-pointer"
                  title="Auto-detect title, creator, duration, thumbnail and category from YouTube"
                >
                  {isAutoDetecting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Detecting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Auto-Detect Details & Duration</span>
                    </>
                  )}
                </button>
              </div>

              {/* Auto-detection Status Banner */}
              {isAutoDetecting && (
                <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-red-400" />
                  <span>{autoDetectStatus || "Extracting metadata, channel info & duration..."}</span>
                </div>
              )}

              {autoDetectNotice && !isAutoDetecting && (
                <div className="flex items-center justify-between gap-2 mt-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{autoDetectNotice}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">All fields remain manually editable</span>
                </div>
              )}
            </div>

            {/* 5. Duration in Seconds */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Duration (Seconds)</span>
                <span className="text-[11px] text-cyan-400 font-mono font-medium">
                  {formatDuration(parseInt(durationInput, 10) || 0)}
                </span>
              </label>
              <input
                type="number"
                min={0}
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                placeholder="e.g. 215"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-red-500 text-sm text-white placeholder-slate-500 focus:outline-none font-mono transition-colors"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Auto-detected or manually entered: <span className="text-white font-medium">{formatDuration(parseInt(durationInput, 10) || 0)}</span> ({durationInput || 0}s)
              </span>
            </div>
          </div>

          {/* Multi-Resolution URLs Section */}
          <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200">
                  Multi-Resolution Stream URLs (Optional Quality Switching)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMultiRes(!showMultiRes)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                {showMultiRes ? "Hide Resolution URLs" : "Configure 4K / 1080p / 720p / 480p"}
              </button>
            </div>

            {showMultiRes && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-amber-400 mb-1">
                    4K (2160p) Stream URL
                  </label>
                  <input
                    type="url"
                    value={res4k}
                    onChange={(e) => setRes4k(e.target.value)}
                    placeholder="https://.../video_4k.mp4"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-cyan-400 mb-1">
                    1080p Full HD Stream URL
                  </label>
                  <input
                    type="url"
                    value={res1080p}
                    onChange={(e) => setRes1080p(e.target.value)}
                    placeholder="https://.../video_1080p.mp4"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-emerald-400 mb-1">
                    720p HD Stream URL
                  </label>
                  <input
                    type="url"
                    value={res720p}
                    onChange={(e) => setRes720p(e.target.value)}
                    placeholder="https://.../video_720p.mp4"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    480p SD Stream URL
                  </label>
                  <input
                    type="url"
                    value={res480p}
                    onChange={(e) => setRes480p(e.target.value)}
                    placeholder="https://.../video_480p.mp4"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Thumbnail / Cover Section: Direct URL OR ImgBB Upload */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
            {/* URL Input & ImgBB Upload Control */}
            <div className="md:col-span-8 space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Thumbnail / Cover Image (Direct URL or ImgBB Upload)
              </label>

              <div className="flex gap-2">
                <input
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://i.ibb.co/... or https://..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-red-500 text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none font-mono transition-colors"
                />

                {/* Upload to ImgBB Button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImgBBUpload}
                  className="hidden"
                  id="imgbb-upload-input"
                />
                <button
                  type="button"
                  disabled={isUploadingImgBB}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 transition-all shrink-0"
                >
                  {isUploadingImgBB ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{imgbbProgress}%</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>ImgBB Upload</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                Uploaded images are securely hosted on ImgBB using your connected key (<code className="font-mono text-cyan-300">7a39d8...</code>) and automatically assigned here.
              </p>
            </div>

            {/* Thumbnail Preview Box */}
            <div className="md:col-span-4 flex flex-col items-center">
              <span className="text-[11px] font-semibold text-slate-400 mb-1">
                Preview Thumbnail
              </span>
              <div className="w-full aspect-video rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center text-slate-600 text-xs">
                    <ImageIcon className="w-8 h-8 mb-1" />
                    <span>No image yet</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description (manual textarea) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Video Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, release credits, or artist notes..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-red-500 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {editingVideoId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs md:text-sm font-bold shadow-lg shadow-red-600/20 active:scale-95 disabled:opacity-50 flex items-center gap-2 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Video...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{editingVideoId ? "Update Video" : "Publish Video to Database"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Videos List / Table Section */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Registered Videos ({filteredVideos.length})
            </h3>
            <p className="text-xs text-slate-400">
              Videos saved in Firestore and visible in the app's Videos tab.
            </p>
          </div>

          {/* Search filter */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, creator, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 text-xs md:text-sm rounded-xl pl-9 pr-4 py-2 text-white focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>
        </div>

        {/* Video Cards Grid */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-2" />
            <span className="text-xs">Loading database videos...</span>
          </div>
        ) : filteredVideos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVideos.map((video) => (
              <div
                key={video.id}
                className="group p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
              >
                {/* Thumbnail & Badges */}
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Film className="w-8 h-8" />
                    </div>
                  )}

                  {/* Duration Pill */}
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 text-[10px] font-mono text-white">
                    {formatDuration(video.duration)}
                  </div>

                  {/* Source Type Badge */}
                  <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-medium text-slate-200 flex items-center gap-1">
                    {video.isYouTube ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        <span>HD Cloud</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        <span>Hosted</span>
                      </>
                    )}
                  </div>

                  {/* Preview Button */}
                  <button
                    onClick={() => setPreviewVideo(video)}
                    className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    title="Quick Preview"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 ml-0.5 fill-white" />
                    </div>
                  </button>
                </div>

                {/* Details */}
                <div>
                  <h4 className="text-sm font-semibold text-white line-clamp-1 group-hover:text-cyan-300 transition-colors">
                    {video.title}
                  </h4>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                    <span className="truncate">{video.creator || "ZYNC"}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 shrink-0">
                      {video.category || "Music Video"}
                    </span>
                  </div>

                  {/* Multi-res indicators */}
                  {video.resolutions && Object.keys(video.resolutions).length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-slate-400">Streams:</span>
                      {Object.keys(video.resolutions).map((res) => (
                        <span 
                          key={res} 
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 uppercase"
                        >
                          {res}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => setPreviewVideo(video)}
                    className="flex items-center gap-1 text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Preview</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditClick(video)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                      title="Edit Video"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteVideo(video.id, video.title)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                      title="Delete Video"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 text-xs">
            No videos in the database. Use the form above to add your first video!
          </div>
        )}
      </div>

      {/* Video Preview Modal */}
      {previewVideo && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewVideo(null)}
        >
          <div 
            className="w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{previewVideo.title}</h3>
                <p className="text-xs text-slate-400">{previewVideo.creator}</p>
              </div>
              <button
                onClick={() => setPreviewVideo(null)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <VideoPlayer video={previewVideo} autoPlay={true} />
          </div>
        </div>
      )}
    </div>
  );
};
