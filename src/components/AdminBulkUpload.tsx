import React, { useState, useRef } from "react";
import { 
  UploadCloud, 
  FileAudio, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Plus, 
  Image as ImageIcon, 
  Play, 
  Pause, 
  Layers, 
  Music, 
  Tag, 
  Clock, 
  X, 
  Check, 
  RotateCw,
  FolderPlus,
  Folder,
  Maximize2
} from "lucide-react";
import { Song, ArtistProfile } from "../types";
import { extractAudioFileMetadata } from "../utils/audioMetadataParser";
import { uploadToCloudinaryDirect } from "../lib/cloudinary";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import AdminFolderUploadModal from "./AdminFolderUploadModal";

export interface StagedSong {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  categories: string[];
  coverDataUrl?: string;
  coverFile?: File;
  customCoverFile?: File;
  customCoverUrl?: string;
  status: "scanning" | "ready" | "uploading" | "success" | "error";
  progress: number;
  errorMessage?: string;
  uploadedAudioUrl?: string;
  uploadedImageUrl?: string;
}

interface AdminBulkUploadProps {
  artistsList: ArtistProfile[];
  categories: string[];
  onSongAdded: () => void;
  onShowToast: (message: string, type: "success" | "error" | "info") => void;
}

export default function AdminBulkUpload({
  artistsList,
  categories,
  onSongAdded,
  onShowToast
}: AdminBulkUploadProps) {
  const [stagedSongs, setStagedSongs] = useState<StagedSong[]>([]);
  const [isBulkUploading, setIsBulkUploading] = useState<boolean>(false);
  const [globalProgress, setGlobalProgress] = useState<number>(0);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [playingPreviewUrl, setPlayingPreviewUrl] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState<boolean>(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Helper: Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "0:00";
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem.toString().padStart(2, "0")}`;
  };

  // Helper: Format bytes to MB
  const formatFileSize = (bytes: number) => {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle files selected from file picker or drop zone
  const handleFilesSelected = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;

    const newFiles: File[] = Array.from(filesList).filter(f => 
      f.type.startsWith("audio/") || 
      /\.(mp3|m4a|wav|aac|flac|ogg)$/i.test(f.name)
    );

    if (newFiles.length === 0) {
      onShowToast("Please select valid audio files (MP3, M4A, WAV, AAC).", "error");
      return;
    }

    const defaultCategories = categories.length > 0 ? [categories[0]] : ["Tamil"];

    // Create initial staged items in "scanning" state
    const newStagedItems: StagedSong[] = newFiles.map((file, idx) => {
      const cleanName = file.name.replace(/\.(mp3|m4a|wav|aac|flac|ogg)$/i, "");
      return {
        id: `staged-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        fileName: file.name,
        fileSize: file.size,
        title: cleanName,
        artist: "",
        album: "",
        duration: 0,
        categories: [...defaultCategories],
        status: "scanning",
        progress: 0
      };
    });

    setStagedSongs(prev => [...prev, ...newStagedItems]);
    onShowToast(`Added ${newFiles.length} track(s) to queue. Extracting metadata...`, "info");

    // Scan each audio file in parallel to auto-fill Title, Artist, Album, Duration, Cover Art
    newStagedItems.forEach(async (item) => {
      try {
        const meta = await extractAudioFileMetadata(item.file);
        setStagedSongs(prev => prev.map(s => {
          if (s.id !== item.id) return s;
          return {
            ...s,
            title: meta.title || s.title,
            artist: meta.artist || s.artist,
            album: meta.album || s.album,
            duration: meta.duration || s.duration,
            coverDataUrl: meta.coverDataUrl,
            coverFile: meta.coverFile,
            status: "ready"
          };
        }));
      } catch (err) {
        console.warn("Scan warning for", item.fileName, err);
        setStagedSongs(prev => prev.map(s => s.id === item.id ? { ...s, status: "ready" } : s));
      }
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove individual song from queue
  const handleRemoveSong = (id: string) => {
    setStagedSongs(prev => prev.filter(s => s.id !== id));
  };

  // Clear all songs
  const handleClearAll = () => {
    if (stagedSongs.length === 0) return;
    if (confirm("Clear all staged tracks from the batch queue?")) {
      setStagedSongs([]);
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      setPlayingPreviewUrl(null);
    }
  };

  // Update field of an individual card
  const handleUpdateField = (id: string, field: keyof StagedSong, value: any) => {
    setStagedSongs(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // Toggle category on a card
  const handleToggleCategory = (id: string, cat: string) => {
    setStagedSongs(prev => prev.map(s => {
      if (s.id !== id) return s;
      const current = s.categories || [];
      const updated = current.includes(cat)
        ? current.filter(c => c !== cat)
        : [...current, cat];
      return { ...s, categories: updated };
    }));
  };

  // Upload a single file (audio + cover) and write to Firestore
  const uploadSingleStagedTrack = async (track: StagedSong): Promise<boolean> => {
    try {
      // 1. Update status to uploading
      setStagedSongs(prev => prev.map(s => s.id === track.id ? { ...s, status: "uploading", progress: 10 } : s));

      // 2. Upload Audio File (Cloudinary direct or server fallback)
      let audioUrl = "";
      try {
        const cloudAudio = await uploadToCloudinaryDirect(track.file, (percent) => {
          setStagedSongs(prev => prev.map(s => s.id === track.id ? { ...s, progress: Math.min(80, Math.round(percent * 0.75)) } : s));
        });
        audioUrl = cloudAudio.secure_url;
      } catch (directErr) {
        console.warn("Direct upload fallback to server API for track:", track.title);
        // Fallback to Express /api/upload
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(track.file);
        const base64Data = await base64Promise;

        const serverRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: base64Data, presetType: "admin_audio" })
        });
        const serverJson = await serverRes.json();
        if (!serverJson.secure_url) {
          throw new Error(serverJson.message || "Failed to upload audio file");
        }
        audioUrl = serverJson.secure_url;
      }

      setStagedSongs(prev => prev.map(s => s.id === track.id ? { ...s, progress: 85 } : s));

      // 3. Upload Cover Image Artwork
      let imageUrl = track.customCoverUrl || "";
      const coverToUpload = track.customCoverFile || track.coverFile;

      if (!imageUrl && coverToUpload) {
        try {
          const cloudCover = await uploadToCloudinaryDirect(coverToUpload);
          if (cloudCover?.secure_url) {
            imageUrl = cloudCover.secure_url;
          }
        } catch (covErr) {
          console.warn("Cover upload warning:", covErr);
        }
      }

      // Default fallback cover if none
      if (!imageUrl) {
        const matchedArtist = artistsList.find(a => a.name.trim().toLowerCase() === track.artist.trim().toLowerCase());
        imageUrl = matchedArtist?.imageUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600&auto=format&fit=crop";
      }

      setStagedSongs(prev => prev.map(s => s.id === track.id ? { ...s, progress: 95 } : s));

      // 4. Save to Firestore
      const matchedArtist = artistsList.find(a => a.name.trim().toLowerCase() === track.artist.trim().toLowerCase());
      const songData: Partial<Song> & Record<string, any> = {
        title: track.title.trim() || track.fileName.replace(/\.[^/.]+$/, ""),
        artist: track.artist.trim() || "Various Artists",
        artistId: matchedArtist?.id || null,
        artistImage: matchedArtist?.imageUrl || null,
        album: track.album.trim() || "Single",
        audioUrl,
        imageUrl,
        duration: track.duration || 180,
        categories: track.categories.length > 0 ? track.categories : ["Tamil"],
        createdAt: Date.now(),
        uploadedBy: auth.currentUser?.uid || "admin"
      };

      await addDoc(collection(db, "songs"), songData);

      // 5. Update track status to success
      setStagedSongs(prev => prev.map(s => {
        if (s.id !== track.id) return s;
        return {
          ...s,
          status: "success",
          progress: 100,
          uploadedAudioUrl: audioUrl,
          uploadedImageUrl: imageUrl
        };
      }));

      onSongAdded();
      return true;
    } catch (err: any) {
      console.error("Error uploading staged track:", track.fileName, err);
      setStagedSongs(prev => prev.map(s => {
        if (s.id !== track.id) return s;
        return {
          ...s,
          status: "error",
          errorMessage: err?.message || "Upload failed"
        };
      }));
      return false;
    }
  };

  // Upload All Staged Tracks in sequence
  const handleUploadAll = async () => {
    const pendingTracks = stagedSongs.filter(s => s.status === "ready" || s.status === "error");
    if (pendingTracks.length === 0) {
      onShowToast("No pending tracks ready to upload.", "info");
      return;
    }

    setIsBulkUploading(true);
    setGlobalProgress(0);

    let completed = 0;
    for (let i = 0; i < pendingTracks.length; i++) {
      const track = pendingTracks[i];
      await uploadSingleStagedTrack(track);
      completed++;
      setGlobalProgress(Math.round((completed / pendingTracks.length) * 100));
    }

    setIsBulkUploading(false);
    onShowToast(`Batch upload finished! ${completed} track(s) processed. 🎉`, "success");
  };

  // Play / Pause audio preview
  const handleTogglePreview = (url: string) => {
    if (playingPreviewUrl === url) {
      audioPreviewRef.current?.pause();
      setPlayingPreviewUrl(null);
    } else {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.src = url;
        audioPreviewRef.current.play().catch(e => console.warn("Audio play blocked", e));
        setPlayingPreviewUrl(url);
      }
    }
  };

  const pendingCount = stagedSongs.filter(s => s.status === "ready" || s.status === "scanning").length;
  const successCount = stagedSongs.filter(s => s.status === "success").length;
  const errorCount = stagedSongs.filter(s => s.status === "error").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hidden audio element for preview */}
      <audio 
        ref={audioPreviewRef} 
        onEnded={() => setPlayingPreviewUrl(null)} 
        onError={() => setPlayingPreviewUrl(null)} 
      />

      {/* Top Banner & Multi-file Upload Zone */}
      <div className="bg-gradient-to-br from-[#0c1222] via-[#090e1a] to-[#120f24] border border-cyan-500/20 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-2.5 mb-1.5">
              <span className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
                <Layers className="w-5 h-5" />
              </span>
              <h2 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight">
                Bulk / Multiple Songs Upload
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold uppercase">
                Batch Mode
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
              Select multiple MP3/M4A tracks at once. Review individual song cards with auto-detected Artist names, Titles, Album names & Embedded Artwork <strong>before uploading</strong>. Edit or remove individual cards freely!
            </p>
          </div>

          {/* Action Stats Pill */}
          {stagedSongs.length > 0 && (
            <div className="flex items-center gap-2 p-2 bg-black/40 border border-white/10 rounded-2xl self-start md:self-auto backdrop-blur-md">
              <div className="px-3 py-1 rounded-xl bg-white/5 text-center">
                <span className="text-[10px] text-slate-400 block font-mono uppercase">Total</span>
                <span className="text-xs font-bold text-slate-200">{stagedSongs.length}</span>
              </div>
              <div className="px-3 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center">
                <span className="text-[10px] text-cyan-400 block font-mono uppercase">Ready</span>
                <span className="text-xs font-bold text-cyan-300">{pendingCount}</span>
              </div>
              <div className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <span className="text-[10px] text-emerald-400 block font-mono uppercase">Uploaded</span>
                <span className="text-xs font-bold text-emerald-300">{successCount}</span>
              </div>
            </div>
          )}
        </div>

        {/* Dual Upload Options: Multiple Files vs Full Folder Sequential */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Option A: Select Files */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="p-5 rounded-2xl bg-black/30 border border-white/10 hover:border-cyan-400/50 hover:bg-cyan-500/5 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                  Multiple Files
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                Select Audio Files Queue
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Pick individual audio tracks. Review individual cards below, edit titles/artists, and upload when ready.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center text-xs font-bold text-cyan-400">
              <span>Choose audio files (.mp3, .m4a, .wav) &rarr;</span>
            </div>
          </div>

          {/* Option B: Edge-to-Edge Folder Sequential Upload */}
          <div 
            onClick={() => setShowFolderModal(true)}
            className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-[#0d1424] border border-purple-500/30 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-500/10 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
                  <Folder className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 uppercase font-bold animate-pulse">
                  Full Screen Sequential
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors flex items-center space-x-1.5">
                <span>Upload Music Folder (Edge-to-Edge)</span>
                <Maximize2 className="w-3.5 h-3.5 text-purple-400" />
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Upload entire music directory sequentially (1-by-1 queue). Full-screen dashboard shows which folder is selected, tracks uploaded, missing artwork inspector & live card editor!
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-bold text-purple-300">
              <span>Launch Edge-to-Edge Folder Mode</span>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-[10px] font-mono border border-purple-500/30">
                1-by-1 Queue
              </span>
            </div>
          </div>
        </div>

        {/* Drag & Drop Multi-file Selection Box */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="relative border-2 border-dashed border-cyan-500/30 hover:border-cyan-400 rounded-3xl p-8 text-center cursor-pointer bg-black/20 hover:bg-cyan-500/5 transition-all group"
        >
          <input 
            ref={fileInputRef}
            type="file" 
            multiple 
            accept="audio/*,.mp3,.m4a,.wav,.aac,.flac,.ogg" 
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="hidden" 
          />

          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-4 border border-cyan-500/20 group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all duration-300 shadow-lg shadow-cyan-500/10">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-base font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
            Click to Select Multiple Audio Files, or Drag & Drop Here
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Upload albums, soundtracks or track collections at once. Accepts MP3, M4A, WAV, AAC with automatic ID3 tag extraction.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/5 text-[11px] text-slate-300 border border-white/10 font-mono">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Auto-detects Title & Artist</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/5 text-[11px] text-slate-300 border border-white/10 font-mono">
              <ImageIcon className="w-3 h-3 text-purple-400" />
              <span>Extracts Embedded Cover Art</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/5 text-[11px] text-slate-300 border border-white/10 font-mono">
              <Clock className="w-3 h-3 text-emerald-400" />
              <span>Calculates Duration</span>
            </span>
          </div>
        </div>

        {/* Global Bulk Action Bar when queue has items */}
        {stagedSongs.length > 0 && (
          <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-bold transition-all flex items-center space-x-2"
              >
                <FolderPlus className="w-4 h-4 text-cyan-400" />
                <span>Add More Audio Files</span>
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                disabled={isBulkUploading}
                className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-bold transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All ({stagedSongs.length})</span>
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleUploadAll}
                disabled={isBulkUploading || pendingCount === 0}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-extrabold text-xs tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/25 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBulkUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading Tracks ({globalProgress}%)</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload All ({pendingCount}) Tracks to Cloudinary</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Global Progress Bar */}
        {isBulkUploading && (
          <div className="mt-4 pt-3">
            <div className="flex justify-between text-xs font-mono text-cyan-300 mb-1.5">
              <span>Batch Upload Progress</span>
              <span>{globalProgress}% Complete</span>
            </div>
            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-cyan-500/20">
              <div 
                className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 transition-all duration-300"
                style={{ width: `${globalProgress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Staged Song Cards Grid [BEFORE UPLOAD] */}
      {stagedSongs.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white/2 border border-white/5 rounded-3xl">
          <FileAudio className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-300">No tracks staged in queue</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Click the box above to select multiple audio files. Each track will appear as an editable card here before publishing.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <span>Staged Tracks Queue</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono">
                {stagedSongs.length} Songs
              </span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Edit individual details or remove songs prior to uploading
            </span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {stagedSongs.map((song, index) => {
              const isEditing = editingCardId === song.id;
              const displayImage = song.customCoverUrl || 
                (song.customCoverFile ? URL.createObjectURL(song.customCoverFile) : song.coverDataUrl) || 
                song.uploadedImageUrl ||
                "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&auto=format&fit=crop";

              return (
                <div 
                  key={song.id}
                  className={`bg-[#0c101d] border rounded-2xl p-4 md:p-5 transition-all shadow-xl relative overflow-hidden ${
                    song.status === "success" 
                      ? "border-emerald-500/40 bg-emerald-950/10 shadow-emerald-500/5"
                      : song.status === "error"
                      ? "border-red-500/40 bg-red-950/10"
                      : song.status === "uploading"
                      ? "border-cyan-400/50 bg-cyan-950/15"
                      : "border-white/10 hover:border-cyan-500/30"
                  }`}
                >
                  {/* Top Header of Card: Index Badge, File Info & Action Buttons */}
                  <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-white/5">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-white/10 text-cyan-300 text-xs font-mono font-bold flex items-center justify-center flex-shrink-0">
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-300 truncate" title={song.fileName}>
                          {song.fileName}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {formatFileSize(song.fileSize)} • {song.duration ? formatTime(song.duration) : "Auto-detecting duration"}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge & Remove Button */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {song.status === "scanning" && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 text-[10px] font-mono border border-amber-500/20">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Scanning ID3...</span>
                        </span>
                      )}

                      {song.status === "ready" && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 text-[10px] font-mono border border-cyan-500/20">
                          <span>Ready</span>
                        </span>
                      )}

                      {song.status === "uploading" && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-mono border border-blue-500/30">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Uploading {song.progress}%</span>
                        </span>
                      )}

                      {song.status === "success" && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-bold font-mono border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Uploaded ✓</span>
                        </span>
                      )}

                      {song.status === "error" && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 text-[10px] font-mono border border-red-500/30" title={song.errorMessage}>
                          <AlertCircle className="w-3 h-3" />
                          <span>Failed</span>
                        </span>
                      )}

                      {/* Remove Button (Before upload or any time) */}
                      <button
                        type="button"
                        onClick={() => handleRemoveSong(song.id)}
                        disabled={song.status === "uploading"}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 transition-all text-xs"
                        title="Remove track from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Main Card Body: Cover Image + Editable Metadata */}
                  <div className="flex gap-4 items-start">
                    {/* Cover Art Preview & Custom Cover Picker */}
                    <div className="relative group/cover flex-shrink-0">
                      <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden bg-black/60 border border-white/10 shadow-md">
                        <img 
                          src={displayImage} 
                          alt={song.title} 
                          className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      {/* Cover file picker overlay */}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover/cover:opacity-100 flex flex-col items-center justify-center cursor-pointer rounded-2xl transition-opacity text-white text-[9px] font-mono p-1 text-center backdrop-blur-xs">
                        <ImageIcon className="w-4 h-4 mb-0.5" />
                        <span>Change Cover</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const imgFile = e.target.files?.[0];
                            if (imgFile) {
                              handleUpdateField(song.id, "customCoverFile", imgFile);
                            }
                          }}
                        />
                      </label>

                      {song.coverDataUrl && !song.customCoverFile && (
                        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 whitespace-nowrap font-mono shadow-sm">
                          ID3 Art ✓
                        </span>
                      )}
                    </div>

                    {/* Metadata Inputs (Title, Artist, Album, Categories) */}
                    <div className="flex-1 min-w-0 space-y-2.5">
                      {/* Track Title Input */}
                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                            Track Title *
                          </label>
                        </div>
                        <input 
                          type="text"
                          value={song.title}
                          disabled={song.status === "uploading" || song.status === "success"}
                          onChange={(e) => handleUpdateField(song.id, "title", e.target.value)}
                          placeholder="e.g. Arabic Kuthu"
                          className="w-full px-3 py-1.5 bg-white/5 border border-white/10 focus:border-cyan-400 rounded-xl text-slate-100 text-xs outline-none transition-all placeholder-slate-600 disabled:opacity-60"
                        />
                      </div>

                      {/* Artist Name with Quick Matching */}
                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                            Artist Name *
                          </label>
                          {artistsList.length > 0 && (
                            <span className="text-[9px] text-purple-400 font-mono">
                              {artistsList.some(a => a.name.toLowerCase() === song.artist.toLowerCase()) ? "Linked Profile ✓" : ""}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input 
                            type="text"
                            value={song.artist}
                            disabled={song.status === "uploading" || song.status === "success"}
                            onChange={(e) => handleUpdateField(song.id, "artist", e.target.value)}
                            placeholder="e.g. Anirudh Ravichander"
                            className="w-full px-3 py-1.5 bg-white/5 border border-white/10 focus:border-purple-400 rounded-xl text-slate-100 text-xs outline-none transition-all placeholder-slate-600 disabled:opacity-60"
                          />
                        </div>
                      </div>

                      {/* Album & Duration Row */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-0.5">
                            Album (Optional)
                          </label>
                          <input 
                            type="text"
                            value={song.album}
                            disabled={song.status === "uploading" || song.status === "success"}
                            onChange={(e) => handleUpdateField(song.id, "album", e.target.value)}
                            placeholder="e.g. Beast"
                            className="w-full px-2.5 py-1 bg-white/5 border border-white/10 focus:border-cyan-400 rounded-xl text-slate-100 text-xs outline-none transition-all placeholder-slate-600 disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-0.5">
                            Duration (Secs)
                          </label>
                          <input 
                            type="number"
                            value={song.duration || ""}
                            disabled={song.status === "uploading" || song.status === "success"}
                            onChange={(e) => handleUpdateField(song.id, "duration", parseInt(e.target.value) || 0)}
                            placeholder="e.g. 210"
                            className="w-full px-2.5 py-1 bg-white/5 border border-white/10 focus:border-cyan-400 rounded-xl text-slate-100 text-xs outline-none transition-all placeholder-slate-600 disabled:opacity-60 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Categories Selector on Card */}
                  <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 max-w-md">
                      <span className="text-[10px] text-slate-400 font-mono uppercase mr-1">Category:</span>
                      {categories.map((cat) => {
                        const isSelected = song.categories.includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            disabled={song.status === "uploading" || song.status === "success"}
                            onClick={() => handleToggleCategory(song.id, cat)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all border ${
                              isSelected
                                ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300"
                                : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>

                    {/* Single Upload Button / Audio Playback */}
                    <div className="flex items-center space-x-2 ml-auto">
                      {song.status === "success" && song.uploadedAudioUrl && (
                        <button
                          type="button"
                          onClick={() => handleTogglePreview(song.uploadedAudioUrl!)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center space-x-1 transition-all"
                        >
                          {playingPreviewUrl === song.uploadedAudioUrl ? (
                            <>
                              <Pause className="w-3 h-3" />
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                      )}

                      {song.status !== "success" && (
                        <button
                          type="button"
                          onClick={() => uploadSingleStagedTrack(song)}
                          disabled={song.status === "uploading"}
                          className="px-3 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition-all flex items-center space-x-1 disabled:opacity-50"
                        >
                          {song.status === "uploading" ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <UploadCloud className="w-3 h-3" />
                          )}
                          <span>{song.status === "uploading" ? "Uploading..." : "Upload This"}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Individual Progress Bar during upload */}
                  {song.status === "uploading" && (
                    <div className="mt-3">
                      <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-cyan-400 transition-all duration-300"
                          style={{ width: `${song.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edge-to-Edge Full Screen Music Folder Upload Modal */}
      <AdminFolderUploadModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        artistsList={artistsList}
        categories={categories}
        onSongAdded={onSongAdded}
        onShowToast={onShowToast}
      />
    </div>
  );
}
