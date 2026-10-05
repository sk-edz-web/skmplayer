import React, { useState, useRef, useEffect } from "react";
import { 
  UploadCloud, 
  FileAudio, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
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
  FolderCheck,
  Maximize2,
  Lock,
  ListMusic,
  RefreshCw,
  CheckCheck
} from "lucide-react";
import { Song, ArtistProfile, Playlist } from "../types";
import { extractAudioFileMetadata } from "../utils/audioMetadataParser";
import { uploadToCloudinaryDirect } from "../lib/cloudinary";
import { scanDroppedItems, processFilesList } from "../utils/folderScanner";
import { collection, addDoc, updateDoc, doc, query, orderBy, onSnapshot } from "firebase/firestore";
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
  currentStep?: string;
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
  
  // Real-time Upload Progress & Queue Tracking
  const [uploadingIndex, setUploadingIndex] = useState<number>(-1);
  const [currentTrackProgress, setCurrentTrackProgress] = useState<number>(0);
  const [currentUploadStep, setCurrentUploadStep] = useState<string>("");
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [lastDetectedFolder, setLastDetectedFolder] = useState<string>("");

  const pauseRef = useRef<boolean>(false);
  const cancelRef = useRef<boolean>(false);

  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Private Playlist Routing for Batch Upload
  const [existingPlaylists, setExistingPlaylists] = useState<Playlist[]>([]);
  const [batchPlaylistEnabled, setBatchPlaylistEnabled] = useState<boolean>(false);
  const [selectedBatchPlaylistId, setSelectedBatchPlaylistId] = useState<string>("new");
  const [newBatchPlaylistName, setNewBatchPlaylistName] = useState<string>("");
  const activeBatchPlaylistDocRef = useRef<string | null>(null);

  // Synchronize pause state with ref for loop control
  useEffect(() => {
    pauseRef.current = isPaused;
  }, [isPaused]);

  // Set webkitdirectory and directory attributes on folder input element
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
      folderInputRef.current.setAttribute("multiple", "");
    }
  }, []);

  // Subscribe to existing playlists in Firestore
  useEffect(() => {
    const q = query(collection(db, "playlists"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: Playlist[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          name: d.name || "Untitled Playlist",
          userId: d.userId || "admin",
          songIds: d.songIds || [],
          thumbnailUrl: d.thumbnailUrl || null,
          createdAt: d.createdAt || Date.now(),
          isPrivate: d.isPrivate !== false
        });
      });
      setExistingPlaylists(list);
    }, () => {});
    return () => unsub();
  }, []);

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

  // Common queue addition helper with ID3 extraction
  const addFilesToQueue = (audioFiles: File[], coverFiles: File[] = [], detectedFolderName?: string) => {
    if (audioFiles.length === 0) {
      onShowToast("Please select valid audio files (MP3, M4A, WAV, AAC).", "error");
      return;
    }

    if (detectedFolderName && detectedFolderName !== "Music Folder") {
      setLastDetectedFolder(detectedFolderName);
      if (batchPlaylistEnabled && selectedBatchPlaylistId === "new" && !newBatchPlaylistName) {
        setNewBatchPlaylistName(detectedFolderName);
      }
    }

    const defaultCategories = categories.length > 0 ? [categories[0]] : ["Tamil"];
    const sharedCoverFile = coverFiles.length > 0 ? coverFiles[0] : undefined;

    const newStagedItems: StagedSong[] = audioFiles.map((file, idx) => {
      const cleanName = file.name
        .replace(/\.(mp3|m4a|wav|aac|flac|ogg|opus)$/i, "")
        .replace(/^\d+[\s.-]+/, "")
        .trim();

      return {
        id: `staged-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        fileName: file.name,
        fileSize: file.size,
        title: cleanName,
        artist: "",
        album: detectedFolderName && detectedFolderName !== "Music Folder" ? detectedFolderName : "",
        duration: 0,
        categories: [...defaultCategories],
        coverFile: sharedCoverFile,
        status: "scanning",
        progress: 0,
        currentStep: "Extracting ID3 tags..."
      };
    });

    setStagedSongs(prev => [...prev, ...newStagedItems]);
    onShowToast(`Added ${audioFiles.length} track(s) from "${detectedFolderName || 'Selected Items'}". Auto-detecting metadata...`, "info");

    // Scan ID3 metadata & embedded cover art in background
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
            coverDataUrl: meta.coverDataUrl || s.coverDataUrl,
            coverFile: meta.coverFile || s.coverFile,
            status: "ready",
            currentStep: "Ready in Queue"
          };
        }));
      } catch (err) {
        console.warn("Scan warning for", item.fileName, err);
        setStagedSongs(prev => prev.map(s => s.id === item.id ? { ...s, status: "ready", currentStep: "Ready in Queue" } : s));
      }
    });
  };

  // Handle files selected from file picker
  const handleFilesSelected = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const scanned = processFilesList(filesList);
    addFilesToQueue(scanned.audioFiles, scanned.coverFiles, scanned.folderName);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle folder selected from native folder picker
  const handleFolderSelected = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const scanned = processFilesList(filesList);
    addFilesToQueue(scanned.audioFiles, scanned.coverFiles, scanned.folderName);
    if (folderInputRef.current) {
      folderInputRef.current.value = "";
    }
  };

  // Handle drag and drop of files OR whole folders
  const handleDropFilesOrFolder = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!e.dataTransfer) return;

    try {
      onShowToast("Scanning dropped folder & audio files...", "info");
      const scanned = await scanDroppedItems(e.dataTransfer);
      if (scanned.audioFiles.length === 0) {
        onShowToast("No audio files (.mp3, .m4a, .wav) found in dropped items.", "error");
        return;
      }
      addFilesToQueue(scanned.audioFiles, scanned.coverFiles, scanned.folderName);
    } catch (err: any) {
      console.warn("Drop scanning error:", err);
      onShowToast("Failed scanning folder: " + (err?.message || "Unknown error"), "error");
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

  // Upload a single file (audio + cover) and write to Firestore with 4-tier fallback & auto-retry
  const uploadSingleStagedTrack = async (
    track: StagedSong, 
    onStep?: (step: string) => void,
    onProgressUpdate?: (percent: number) => void
  ): Promise<boolean> => {
    // 1. Mark as uploading
    setStagedSongs(prev => prev.map(s => s.id === track.id ? {
      ...s,
      status: "uploading",
      progress: 5,
      currentStep: "Directing to Cloudinary CDN..."
    } : s));
    if (onStep) onStep("Directing to Cloudinary CDN...");
    if (onProgressUpdate) onProgressUpdate(5);

    try {
      // 2. Upload Audio File (with 4-tier fallback & progress)
      let audioUrl = "";
      if (onStep) onStep(`Uploading "${track.title}" audio file...`);
      
      const cloudAudio = await uploadToCloudinaryDirect(track.file, (percent) => {
        const mapped = Math.min(80, Math.round(percent * 0.75));
        setStagedSongs(prev => prev.map(s => s.id === track.id ? {
          ...s,
          progress: mapped,
          currentStep: `Uploading audio (${percent}%)...`
        } : s));
        if (onProgressUpdate) onProgressUpdate(mapped);
        if (onStep) onStep(`Uploading audio track (${percent}%)...`);
      });

      audioUrl = cloudAudio.secure_url;
      if (onProgressUpdate) onProgressUpdate(82);

      // 3. Upload Cover Image Artwork
      if (onStep) onStep("Checking & uploading cover artwork...");
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

      if (onProgressUpdate) onProgressUpdate(92);
      if (onStep) onStep("Writing to Firestore database...");

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

      const newSongDocRef = await addDoc(collection(db, "songs"), songData);

      // Add to batch private playlist if enabled
      if (batchPlaylistEnabled) {
        try {
          let targetPlId = activeBatchPlaylistDocRef.current || selectedBatchPlaylistId;
          if (targetPlId === "new" || (!targetPlId && newBatchPlaylistName.trim())) {
            const plDoc = await addDoc(collection(db, "playlists"), {
              name: newBatchPlaylistName.trim() || `Batch Upload ${new Date().toLocaleDateString()}`,
              description: "Private playlist created during batch upload",
              userId: auth.currentUser?.uid || "admin",
              songIds: [newSongDocRef.id],
              thumbnailUrl: imageUrl || null,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              isPrivate: true
            });
            activeBatchPlaylistDocRef.current = plDoc.id;
          } else if (targetPlId && targetPlId !== "new") {
            const targetPl = existingPlaylists.find(p => p.id === targetPlId);
            const currentIds = targetPl?.songIds || [];
            const nextIds = currentIds.includes(newSongDocRef.id) ? currentIds : [...currentIds, newSongDocRef.id];
            await updateDoc(doc(db, "playlists", targetPlId), {
              songIds: nextIds,
              thumbnailUrl: targetPl?.thumbnailUrl || imageUrl || null,
              updatedAt: Date.now()
            });
            activeBatchPlaylistDocRef.current = targetPlId;
          }
        } catch (plErr) {
          console.warn("Failed linking batch track to playlist:", plErr);
        }
      }

      // 5. Update track status to success
      setStagedSongs(prev => prev.map(s => {
        if (s.id !== track.id) return s;
        return {
          ...s,
          status: "success",
          progress: 100,
          currentStep: "Published ✓",
          uploadedAudioUrl: audioUrl,
          uploadedImageUrl: imageUrl
        };
      }));

      if (onProgressUpdate) onProgressUpdate(100);
      if (onStep) onStep("Uploaded & Published Successfully ✓");
      onSongAdded();
      return true;
    } catch (err: any) {
      console.error("Error uploading staged track:", track.fileName, err);
      setStagedSongs(prev => prev.map(s => {
        if (s.id !== track.id) return s;
        return {
          ...s,
          status: "error",
          currentStep: "Upload Failed",
          errorMessage: err?.message || "Upload failed"
        };
      }));
      return false;
    }
  };

  // Upload All Staged Tracks strictly sequentially with real-time feedback
  const handleUploadAll = async () => {
    const pendingTracks = stagedSongs.filter(s => s.status !== "success");
    if (pendingTracks.length === 0) {
      onShowToast("No pending tracks ready to upload.", "info");
      return;
    }

    setIsBulkUploading(true);
    setIsPaused(false);
    pauseRef.current = false;
    cancelRef.current = false;
    setGlobalProgress(0);

    let successCountTotal = 0;
    let failCountTotal = 0;

    for (let i = 0; i < pendingTracks.length; i++) {
      if (cancelRef.current) {
        onShowToast("Upload cancelled by user.", "info");
        break;
      }

      // Handle Pause
      while (pauseRef.current) {
        await new Promise(r => setTimeout(r, 400));
        if (cancelRef.current) break;
      }
      if (cancelRef.current) break;

      const track = pendingTracks[i];
      setUploadingIndex(i);
      setCurrentTrackProgress(5);
      setCurrentUploadStep(`Starting upload for "${track.title}"...`);

      const success = await uploadSingleStagedTrack(
        track,
        (step) => setCurrentUploadStep(step),
        (pct) => setCurrentTrackProgress(pct)
      );

      if (success) {
        successCountTotal++;
      } else {
        failCountTotal++;
      }

      const completed = i + 1;
      setGlobalProgress(Math.round((completed / pendingTracks.length) * 100));

      // Small pause between songs for UI fluidity & network rest
      await new Promise(r => setTimeout(r, 300));
    }

    setIsBulkUploading(false);
    setUploadingIndex(-1);
    setCurrentTrackProgress(0);
    setCurrentUploadStep("");

    if (failCountTotal === 0) {
      onShowToast(`All ${successCountTotal} track(s) uploaded and published successfully without error! 🎉`, "success");
    } else {
      onShowToast(`Upload finished: ${successCountTotal} succeeded, ${failCountTotal} failed. You can retry failed songs.`, "info");
    }
  };

  const handleTogglePause = () => {
    setIsPaused(prev => !prev);
  };

  const handleCancelUpload = () => {
    if (confirm("Are you sure you want to stop the remaining uploads?")) {
      cancelRef.current = true;
    }
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
  const pendingTracksList = stagedSongs.filter(s => s.status !== "success");
  const currentActiveTrack = uploadingIndex >= 0 && uploadingIndex < pendingTracksList.length ? pendingTracksList[uploadingIndex] : null;
  const remainingCount = pendingTracksList.length - (uploadingIndex >= 0 ? uploadingIndex : 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hidden audio element for preview */}
      <audio 
        ref={audioPreviewRef} 
        onEnded={() => setPlayingPreviewUrl(null)} 
        onError={() => setPlayingPreviewUrl(null)} 
      />

      {/* Hidden file & folder inputs */}
      <input 
        ref={fileInputRef}
        type="file" 
        multiple 
        accept="audio/*,.mp3,.m4a,.wav,.aac,.flac,.ogg,.opus" 
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden" 
      />
      <input 
        ref={folderInputRef}
        type="file"
        // webkitdirectory and directory set in useEffect via ref
        className="hidden" 
        onChange={(e) => handleFolderSelected(e.target.files)}
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
                Bulk / Music Folder Upload Engine
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold uppercase">
                1-by-1 Queue
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
              Upload multiple audio files or an <strong>entire music folder</strong> with one click. Songs are uploaded strictly sequentially (1-by-1) showing exact progress, which song is uploading, and remaining count with zero errors!
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
              {errorCount > 0 && (
                <div className="px-3 py-1 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                  <span className="text-[10px] text-red-400 block font-mono uppercase">Errors</span>
                  <span className="text-xs font-bold text-red-300">{errorCount}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3 Upload Options: Files, Folder Directory, Edge-to-Edge Full Screen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Option 1: Select Audio Files */}
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
                  Audio Files
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                Select Audio Files (.mp3, .m4a, .wav)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Pick individual audio tracks. Review individual cards below, edit titles/artists, and upload when ready.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center text-xs font-bold text-cyan-400">
              <span>Choose audio files &rarr;</span>
            </div>
          </div>

          {/* Option 2: Select Full Music Folder */}
          <div 
            onClick={() => folderInputRef.current?.click()}
            className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/30 via-teal-950/20 to-[#0a121d] border border-emerald-500/30 hover:border-emerald-400/60 hover:bg-emerald-500/10 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none"></div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 group-hover:scale-105 transition-transform">
                  <FolderCheck className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                  Select Folder
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors flex items-center space-x-1.5">
                <span>📁 Select Music Folder</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Pick an entire music album folder. Automatically loads all tracks, folder art & tags directly into the staging queue!
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-bold text-emerald-400">
              <span>Choose Music Directory &rarr;</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                Auto-scan
              </span>
            </div>
          </div>

          {/* Option 3: Edge-to-Edge Folder Modal */}
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
                  Full Screen
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors flex items-center space-x-1.5">
                <span>Edge-to-Edge Inspector Mode</span>
                <Maximize2 className="w-3.5 h-3.5 text-purple-400" />
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Full-screen album dashboard with real-time missing details audit (artwork, lyrics, artist) & card editor.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-bold text-purple-300">
              <span>Launch Full Screen Mode</span>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-[10px] font-mono border border-purple-500/30">
                Edge-to-Edge
              </span>
            </div>
          </div>
        </div>

        {/* Drag & Drop Multi-file AND Folder Drop Box */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDropFilesOrFolder}
          className={`relative border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-300 group ${
            isDragging 
              ? "border-cyan-400 bg-cyan-500/15 scale-[1.01] shadow-2xl shadow-cyan-500/20" 
              : "border-cyan-500/30 hover:border-cyan-400 bg-black/20 hover:bg-cyan-500/5"
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-4 border border-cyan-500/20 group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all duration-300 shadow-lg shadow-cyan-500/10">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-base font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
            {isDragging ? "Drop Files or Music Folder Here!" : "Drag & Drop Audio Files OR Entire Folder Here"}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Drop entire folders or select files. Recursively extracts MP3, M4A, WAV, AAC with automatic ID3 tag extraction and folder cover art.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/5 text-[11px] text-slate-300 border border-white/10 font-mono">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Auto-detects Title & Artist</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/5 text-[11px] text-slate-300 border border-white/10 font-mono">
              <ImageIcon className="w-3 h-3 text-purple-400" />
              <span>Extracts Embedded Artwork</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/5 text-[11px] text-slate-300 border border-white/10 font-mono">
              <FolderCheck className="w-3 h-3 text-emerald-400" />
              <span>Supports Directory Traversal</span>
            </span>
          </div>
        </div>

        {/* Batch Private Playlist Option Bar */}
        {stagedSongs.length > 0 && (
          <div className="mt-5 p-4 rounded-2xl bg-purple-950/25 border border-purple-500/30 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center space-x-3">
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input 
                  type="checkbox"
                  checked={batchPlaylistEnabled}
                  onChange={(e) => setBatchPlaylistEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>

              <div>
                <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 text-purple-400" />
                  <span>Add All Staged Tracks into a Private Playlist</span>
                </span>
                <p className="text-[10px] text-slate-400">
                  Songs are added to library and grouped in a Private Playlist hidden from public users.
                </p>
              </div>
            </div>

            {batchPlaylistEnabled && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedBatchPlaylistId}
                  onChange={(e) => setSelectedBatchPlaylistId(e.target.value)}
                  className="px-3 py-1.5 bg-black/60 border border-purple-500/30 text-white rounded-xl text-xs outline-none focus:border-purple-400"
                >
                  <option value="new">➕ [+] Create New Private Playlist...</option>
                  {existingPlaylists.map(pl => (
                    <option key={pl.id} value={pl.id}>
                      📁 {pl.name} ({pl.songIds?.length || 0} tracks)
                    </option>
                  ))}
                </select>

                {selectedBatchPlaylistId === "new" && (
                  <input 
                    type="text"
                    value={newBatchPlaylistName}
                    onChange={(e) => setNewBatchPlaylistName(e.target.value)}
                    placeholder="New Playlist Name"
                    className="px-3 py-1.5 bg-black/60 border border-purple-500/40 text-white rounded-xl text-xs outline-none focus:border-purple-400 placeholder-slate-500 w-48"
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Global Bulk Action Bar when queue has items */}
        {stagedSongs.length > 0 && (
          <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBulkUploading}
                className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-bold transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>Add Files</span>
              </button>

              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                disabled={isBulkUploading}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 text-xs font-bold transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                <FolderPlus className="w-4 h-4 text-emerald-400" />
                <span>Add Folder</span>
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                disabled={isBulkUploading}
                className="px-3.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-bold transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All ({stagedSongs.length})</span>
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleUploadAll}
                disabled={isBulkUploading || pendingTracksList.length === 0}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-extrabold text-xs tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/25 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBulkUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading ({globalProgress}%)</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload All ({pendingTracksList.length}) Songs Sequentially</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* HIGH-VISIBILITY LIVE UPLOAD PROGRESS MONITOR DASHBOARD */}
        {isBulkUploading && (
          <div className="mt-6 p-5 md:p-6 rounded-2xl bg-gradient-to-r from-[#0b172a] via-[#101428] to-[#160e29] border-2 border-cyan-400/50 shadow-2xl relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 right-0 w-60 h-60 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>

            {/* Top row: Status header & controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div className="flex items-center space-x-3">
                <span className="relative flex h-3.5 w-3.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPaused ? "bg-amber-400" : "bg-cyan-400"}`}></span>
                  <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${isPaused ? "bg-amber-500" : "bg-cyan-500"}`}></span>
                </span>
                <div>
                  <h4 className="text-sm font-black text-white flex items-center space-x-2">
                    <span>
                      {isPaused 
                        ? "⏸️ UPLOAD QUEUE PAUSED" 
                        : `🚀 UPLOADING TRACK ${uploadingIndex + 1} OF ${pendingTracksList.length}`}
                    </span>
                    {currentActiveTrack && (
                      <span className="text-cyan-300 font-bold font-mono">
                        : "{currentActiveTrack.title}"
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {currentActiveTrack?.artist ? `Artist: ${currentActiveTrack.artist}` : "Auto-extracting tags"} • {currentUploadStep || "Processing..."}
                  </p>
                </div>
              </div>

              {/* Stats & Pause/Resume Controls */}
              <div className="flex items-center space-x-2 self-start md:self-auto">
                <div className="px-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs font-mono">
                  <span className="text-amber-400 font-bold">{remainingCount} Songs Remaining</span>
                </div>

                <button
                  type="button"
                  onClick={handleTogglePause}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all border ${
                    isPaused 
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40" 
                      : "bg-white/10 hover:bg-white/15 text-slate-200 border-white/15"
                  }`}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                  <span>{isPaused ? "Resume" : "Pause"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/25 font-bold text-xs transition-all"
                >
                  Stop
                </button>
              </div>
            </div>

            {/* Current Song Progress Bar */}
            <div className="space-y-1.5 mb-3 bg-black/30 p-3 rounded-xl border border-white/5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300">
                  Active Song: <strong className="text-cyan-300">{currentActiveTrack?.fileName}</strong>
                </span>
                <span className="text-cyan-400 font-bold">{currentTrackProgress}%</span>
              </div>
              <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-cyan-500/20">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${currentTrackProgress}%` }}
                ></div>
              </div>
            </div>

            {/* Overall Queue Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>Total Queue Completion ({uploadingIndex + 1}/{pendingTracksList.length} tracks)</span>
                <span className="text-purple-300 font-bold">{globalProgress}%</span>
              </div>
              <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300"
                  style={{ width: `${globalProgress}%` }}
                ></div>
              </div>
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
            Click the buttons above or drag & drop a music folder here. Each track will appear as an editable card here before publishing.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2 flex-wrap gap-2">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <span>Staged Tracks Queue</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold">
                {stagedSongs.length} Songs
              </span>
              {lastDetectedFolder && (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-mono">
                  📁 {lastDetectedFolder}
                </span>
              )}
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {successCount} uploaded • {pendingTracksList.length} ready • {errorCount} errors
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

                    {/* Status Badge & Actions */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {song.status === "scanning" && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 text-[10px] font-mono border border-amber-500/20">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Scanning ID3...</span>
                        </span>
                      )}

                      {song.status === "ready" && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 text-[10px] font-mono border border-cyan-500/20">
                          <span>Ready in Queue</span>
                        </span>
                      )}

                      {song.status === "uploading" && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-mono border border-blue-500/30">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Uploading {song.progress}%</span>
                        </span>
                      )}

                      {song.status === "success" && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Uploaded ✓</span>
                        </span>
                      )}

                      {song.status === "error" && (
                        <div className="flex items-center space-x-1.5">
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 text-[10px] font-mono border border-red-500/30">
                            <AlertCircle className="w-3 h-3" />
                            <span>Error</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => uploadSingleStagedTrack(song)}
                            className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-[10px] font-mono font-bold flex items-center space-x-1"
                            title="Retry Upload"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        </div>
                      )}

                      {song.status !== "uploading" && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSong(song.id)}
                          className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors"
                          title="Remove track from queue"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Content: Thumbnail, Form details & Categories */}
                  <div className="flex gap-4">
                    {/* Cover Art Preview */}
                    <div className="relative group/thumb flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center">
                      <img 
                        src={displayImage} 
                        alt={song.title} 
                        className="w-full h-full object-cover" 
                      />
                      
                      {/* Audio preview playback overlay */}
                      <button
                        type="button"
                        onClick={() => handleTogglePreview(URL.createObjectURL(song.file))}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white"
                        title="Listen to audio preview"
                      >
                        {playingPreviewUrl ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
                      </button>

                      {/* Custom cover file picker trigger */}
                      <label className="absolute bottom-1 right-1 p-1 bg-black/80 hover:bg-purple-600 rounded-md text-white cursor-pointer transition-colors shadow">
                        <ImageIcon className="w-3 h-3" />
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleUpdateField(song.id, "customCoverFile", e.target.files[0]);
                              handleUpdateField(song.id, "customCoverUrl", URL.createObjectURL(e.target.files[0]));
                            }
                          }}
                          className="hidden" 
                        />
                      </label>
                    </div>

                    {/* Metadata fields: Title, Artist, Album */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-0.5">
                          Song Title
                        </label>
                        <input 
                          type="text"
                          value={song.title}
                          onChange={(e) => handleUpdateField(song.id, "title", e.target.value)}
                          placeholder="Song Title"
                          className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:border-cyan-400 outline-none font-semibold"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-0.5">
                            Artist Name
                          </label>
                          <input 
                            type="text"
                            value={song.artist}
                            onChange={(e) => handleUpdateField(song.id, "artist", e.target.value)}
                            placeholder="Artist / Composer"
                            list={`artists-${song.id}`}
                            className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:border-cyan-400 outline-none"
                          />
                          <datalist id={`artists-${song.id}`}>
                            {artistsList.map(a => (
                              <option key={a.id} value={a.name} />
                            ))}
                          </datalist>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-0.5">
                            Album / Movie
                          </label>
                          <input 
                            type="text"
                            value={song.album}
                            onChange={(e) => handleUpdateField(song.id, "album", e.target.value)}
                            placeholder="Album / Film Name"
                            className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:border-cyan-400 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Categories Pills */}
                  <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-500 uppercase mr-1">
                      Categories:
                    </span>
                    {categories.map(cat => {
                      const selected = song.categories?.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => handleToggleCategory(song.id, cat)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all border ${
                            selected 
                              ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-300 font-bold" 
                              : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>

                  {/* Individual Upload Progress on Card */}
                  {song.status === "uploading" && (
                    <div className="mt-3 pt-2 border-t border-cyan-500/20">
                      <div className="flex justify-between text-[10px] font-mono text-cyan-300 mb-1">
                        <span>{song.currentStep || "Uploading..."}</span>
                        <span>{song.progress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                          style={{ width: `${song.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Error display */}
                  {song.status === "error" && song.errorMessage && (
                    <div className="mt-2.5 p-2 rounded-lg bg-red-950/30 border border-red-500/20 text-red-300 text-xs flex items-center space-x-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span className="truncate">{song.errorMessage}</span>
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
