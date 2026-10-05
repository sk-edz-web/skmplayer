import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Folder, 
  FolderPlus, 
  FolderCheck, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Loader2, 
  Maximize2, 
  Minimize2, 
  X, 
  Image as ImageIcon, 
  Music, 
  FileText, 
  Edit3, 
  Save, 
  Play, 
  Pause, 
  RefreshCw, 
  SlidersHorizontal, 
  Layers, 
  Sparkles, 
  Check, 
  Plus, 
  Search, 
  Eye, 
  HelpCircle, 
  Filter,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Tag,
  Clock,
  Trash2,
  ExternalLink
} from "lucide-react";
import { Song, ArtistProfile } from "../types";
import { extractAudioFileMetadata } from "../utils/audioMetadataParser";
import { uploadToCloudinaryDirect } from "../lib/cloudinary";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

export interface FolderSongItem {
  id: string;
  file: File;
  fileName: string;
  relativePath: string;
  fileSize: number;
  folderName: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  categories: string[];
  lyrics?: string;
  lyricsUrl?: string;
  
  // Artwork
  coverDataUrl?: string;
  coverFile?: File;
  customCoverFile?: File;
  customCoverUrl?: string;
  
  // Status
  status: "queued" | "scanning" | "uploading" | "success" | "error";
  progress: number;
  currentStep?: string;
  errorMessage?: string;
  
  // Saved database record
  firestoreDocId?: string;
  uploadedAudioUrl?: string;
  uploadedImageUrl?: string;
  
  // Audit inspection
  missingDetails: {
    hasCover: boolean;
    hasArtist: boolean;
    hasAlbum: boolean;
    hasLyrics: boolean;
    hasCategories: boolean;
    totalMissing: number;
  };
}

interface AdminFolderUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  artistsList: ArtistProfile[];
  categories: string[];
  onSongAdded: () => void;
  onShowToast: (message: string, type: "success" | "error" | "info") => void;
}

export default function AdminFolderUploadModal({
  isOpen,
  onClose,
  artistsList,
  categories,
  onSongAdded,
  onShowToast
}: AdminFolderUploadModalProps) {
  // Folder & File Queue State
  const [folderName, setFolderName] = useState<string>("");
  const [folderPath, setFolderPath] = useState<string>("");
  const [folderSongs, setFolderSongs] = useState<FolderSongItem[]>([]);
  const [isScanningFolder, setIsScanningFolder] = useState<boolean>(false);
  
  // Sequential Upload Engine State
  const [isSequentialUploading, setIsSequentialUploading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentUploadingIndex, setCurrentUploadingIndex] = useState<number>(-1);
  const pauseRef = useRef<boolean>(false);
  const cancelRef = useRef<boolean>(false);

  // Active View & Filters
  const [activeView, setActiveView] = useState<"queue" | "inspector">("queue");
  const [filterType, setFilterType] = useState<"all" | "missing_any" | "missing_cover" | "missing_artist" | "missing_lyrics" | "complete">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedEditCardId, setExpandedEditCardId] = useState<string | null>(null);

  // Audio preview player
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  
  // HTML Folder Input Ref
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Keep ref synced with paused state for loop control
  useEffect(() => {
    pauseRef.current = isPaused;
  }, [isPaused]);

  // Compute missing details helper
  const computeMissing = (item: Partial<FolderSongItem>): FolderSongItem["missingDetails"] => {
    const hasCover = Boolean(
      item.customCoverUrl || 
      item.customCoverFile || 
      item.coverDataUrl || 
      (item.uploadedImageUrl && !item.uploadedImageUrl.includes("photo-1614613535308-eb5fbd3d2c17"))
    );
    const artistStr = (item.artist || "").trim().toLowerCase();
    const hasArtist = Boolean(
      artistStr && 
      artistStr !== "various artists" && 
      artistStr !== "unknown" && 
      artistStr !== "unknown artist" &&
      artistStr !== "track"
    );
    const hasAlbum = Boolean(item.album && item.album.trim().length > 0 && item.album.trim().toLowerCase() !== "single");
    const hasLyrics = Boolean(item.lyrics && item.lyrics.trim().length > 10);
    const hasCategories = Boolean(item.categories && item.categories.length > 0);

    let totalMissing = 0;
    if (!hasCover) totalMissing++;
    if (!hasArtist) totalMissing++;
    if (!hasAlbum) totalMissing++;
    if (!hasLyrics) totalMissing++;

    return {
      hasCover,
      hasArtist,
      hasAlbum,
      hasLyrics,
      hasCategories,
      totalMissing
    };
  };

  // Helper: Format duration
  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "0:00";
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem.toString().padStart(2, "0")}`;
  };

  // Helper: Format file size
  const formatSize = (bytes: number) => {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Stop audio preview when closed
  useEffect(() => {
    if (!isOpen && audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      setPlayingAudioUrl(null);
    }
  }, [isOpen]);

  // Handle Folder Selection via HTML5 webkitdirectory
  const handleFolderSelected = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;

    setIsScanningFolder(true);
    cancelRef.current = false;
    setIsPaused(false);
    setIsSequentialUploading(false);
    setCurrentUploadingIndex(-1);

    const allFiles = Array.from(filesList);

    // Extract directory name from relative path: "Beast OST/01 - Arabic Kuthu.mp3" -> "Beast OST"
    let detectedFolderName = "Music Folder";
    if (allFiles[0] && (allFiles[0] as any).webkitRelativePath) {
      const parts = (allFiles[0] as any).webkitRelativePath.split("/");
      if (parts.length > 1) {
        detectedFolderName = parts[0];
      }
    }
    setFolderName(detectedFolderName);
    setFolderPath((allFiles[0] as any).webkitRelativePath || detectedFolderName);

    // Filter audio files
    const audioFiles = allFiles.filter(f => 
      f.type.startsWith("audio/") || 
      /\.(mp3|m4a|wav|aac|flac|ogg)$/i.test(f.name)
    );

    if (audioFiles.length === 0) {
      onShowToast("No audio files found in selected folder! Please select a folder with .mp3, .m4a, or .wav files.", "error");
      setIsScanningFolder(false);
      return;
    }

    // Look for standalone artwork files in the folder (e.g. cover.jpg, folder.jpg, album.png)
    const folderImageFiles = allFiles.filter(f => 
      /\.(jpg|jpeg|png|webp)$/i.test(f.name) && 
      /(cover|folder|album|front|artwork|art)/i.test(f.name)
    );
    const sharedFolderCoverFile = folderImageFiles.length > 0 ? folderImageFiles[0] : null;

    // Look for lyrics files in folder (e.g., .lrc, .txt)
    const lyricsFiles = allFiles.filter(f => /\.(lrc|srt|vtt|txt)$/i.test(f.name));

    const defaultCats = categories.length > 0 ? [categories[0]] : ["Tamil"];

    // Initialize item states
    const items: FolderSongItem[] = audioFiles.map((file, idx) => {
      const cleanTitle = file.name
        .replace(/\.(mp3|m4a|wav|aac|flac|ogg)$/i, "")
        .replace(/^\d+[\s.-]+/, "") // remove track numbers like "01 - "
        .trim();

      const relPath = (file as any).webkitRelativePath || file.name;

      // Check if matching lyric file exists
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const matchedLyricFile = lyricsFiles.find(lf => lf.name.replace(/\.[^/.]+$/, "").toLowerCase() === baseName.toLowerCase());

      const initialItem: Partial<FolderSongItem> = {
        title: cleanTitle,
        artist: "",
        album: detectedFolderName !== "Music Folder" ? detectedFolderName : "",
        duration: 0,
        categories: [...defaultCats],
        coverFile: sharedFolderCoverFile || undefined
      };

      return {
        id: `fitem-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        file,
        fileName: file.name,
        relativePath: relPath,
        fileSize: file.size,
        folderName: detectedFolderName,
        title: cleanTitle,
        artist: "",
        album: detectedFolderName !== "Music Folder" ? detectedFolderName : "",
        duration: 0,
        categories: [...defaultCats],
        coverFile: sharedFolderCoverFile || undefined,
        status: "queued",
        progress: 0,
        currentStep: "Ready in queue",
        missingDetails: computeMissing(initialItem)
      };
    });

    setFolderSongs(items);
    setIsScanningFolder(false);
    onShowToast(`Discovered ${items.length} tracks in "${detectedFolderName}". Scanning metadata...`, "info");

    // Scan ID3 metadata & lyrics in background for all tracks
    for (const item of items) {
      try {
        const meta = await extractAudioFileMetadata(item.file);
        
        // Check for lyrics file content if any
        let loadedLyrics = meta.lyrics || "";
        const baseName = item.fileName.replace(/\.[^/.]+$/, "");
        const matchedLyricFile = lyricsFiles.find(lf => lf.name.replace(/\.[^/.]+$/, "").toLowerCase() === baseName.toLowerCase());
        if (!loadedLyrics && matchedLyricFile) {
          try {
            loadedLyrics = await matchedLyricFile.text();
          } catch (lyErr) {
            console.warn("Failed reading lyric file", lyErr);
          }
        }

        setFolderSongs(prev => prev.map(s => {
          if (s.id !== item.id) return s;
          const updated: FolderSongItem = {
            ...s,
            title: meta.title || s.title,
            artist: meta.artist || s.artist,
            album: meta.album || s.album,
            duration: meta.duration || s.duration,
            coverDataUrl: meta.coverDataUrl || s.coverDataUrl,
            coverFile: meta.coverFile || s.coverFile,
            lyrics: loadedLyrics || s.lyrics,
            missingDetails: computeMissing({
              title: meta.title || s.title,
              artist: meta.artist || s.artist,
              album: meta.album || s.album,
              lyrics: loadedLyrics || s.lyrics,
              categories: s.categories,
              coverDataUrl: meta.coverDataUrl || s.coverDataUrl,
              coverFile: meta.coverFile || s.coverFile,
              customCoverFile: s.customCoverFile,
              customCoverUrl: s.customCoverUrl
            })
          };
          return updated;
        }));
      } catch (err) {
        console.warn("Folder metadata parse warning:", item.fileName, err);
      }
    }
  };

  // Upload a single track strictly sequentially
  const uploadTrackSequentially = async (index: number): Promise<boolean> => {
    const track = folderSongs[index];
    if (!track) return false;

    // 1. Mark as Uploading
    setFolderSongs(prev => prev.map((s, i) => i === index ? {
      ...s,
      status: "uploading",
      progress: 5,
      currentStep: "Directing to Cloudinary CDN..."
    } : s));

    try {
      // 2. Upload Audio File
      let audioUrl = "";
      try {
        setFolderSongs(prev => prev.map((s, i) => i === index ? {
          ...s,
          currentStep: "Uploading audio track..."
        } : s));

        const cloudRes = await uploadToCloudinaryDirect(track.file, (percent) => {
          setFolderSongs(prev => prev.map((s, i) => i === index ? {
            ...s,
            progress: Math.min(80, Math.round(percent * 0.75)),
            currentStep: `Uploading audio (${percent}%)...`
          } : s));
        });
        audioUrl = cloudRes.secure_url;
      } catch (directErr) {
        console.warn("Direct upload fallback to server API for", track.title, directErr);
        setFolderSongs(prev => prev.map((s, i) => i === index ? {
          ...s,
          currentStep: "Using secure server proxy fallback..."
        } : s));

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
          throw new Error(serverJson.message || "Failed uploading audio file");
        }
        audioUrl = serverJson.secure_url;
      }

      setFolderSongs(prev => prev.map((s, i) => i === index ? {
        ...s,
        progress: 82,
        currentStep: "Checking and uploading cover artwork..."
      } : s));

      // 3. Upload Artwork if present
      let finalImageUrl = track.customCoverUrl || "";
      const coverToUpload = track.customCoverFile || track.coverFile;

      if (!finalImageUrl && coverToUpload) {
        try {
          const cloudCover = await uploadToCloudinaryDirect(coverToUpload);
          if (cloudCover?.secure_url) {
            finalImageUrl = cloudCover.secure_url;
          }
        } catch (covErr) {
          console.warn("Cover image upload warning:", covErr);
        }
      }

      // Fallback artwork if no cover
      if (!finalImageUrl) {
        const matchedArtist = artistsList.find(a => a.name.trim().toLowerCase() === track.artist.trim().toLowerCase());
        finalImageUrl = matchedArtist?.imageUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600&auto=format&fit=crop";
      }

      setFolderSongs(prev => prev.map((s, i) => i === index ? {
        ...s,
        progress: 92,
        currentStep: "Writing to Firestore database..."
      } : s));

      // 4. Save to Firestore
      const matchedArtist = artistsList.find(a => a.name.trim().toLowerCase() === track.artist.trim().toLowerCase());
      const songDocData: Partial<Song> & Record<string, any> = {
        title: track.title.trim() || track.fileName.replace(/\.[^/.]+$/, ""),
        artist: track.artist.trim() || "Various Artists",
        artistId: matchedArtist?.id || null,
        artistImage: matchedArtist?.imageUrl || null,
        album: track.album.trim() || folderName || "Single",
        audioUrl,
        imageUrl: finalImageUrl,
        duration: track.duration || 180,
        categories: track.categories.length > 0 ? track.categories : ["Tamil"],
        createdAt: Date.now(),
        uploadedBy: auth.currentUser?.uid || "admin",
        lyrics: track.lyrics || ""
      };

      const docRef = await addDoc(collection(db, "songs"), songDocData);

      // 5. Update state to Success
      setFolderSongs(prev => prev.map((s, i) => {
        if (i !== index) return s;
        const updated: FolderSongItem = {
          ...s,
          status: "success",
          progress: 100,
          currentStep: "Uploaded & Saved ✓",
          firestoreDocId: docRef.id,
          uploadedAudioUrl: audioUrl,
          uploadedImageUrl: finalImageUrl,
          missingDetails: computeMissing({
            ...s,
            uploadedImageUrl: finalImageUrl
          })
        };
        return updated;
      }));

      onSongAdded();
      return true;
    } catch (err: any) {
      console.error("Sequential upload error for track index", index, track.fileName, err);
      setFolderSongs(prev => prev.map((s, i) => i === index ? {
        ...s,
        status: "error",
        progress: 0,
        currentStep: "Upload Failed",
        errorMessage: err?.message || "Failed to upload"
      } : s));
      return false;
    }
  };

  // Start or Resume Sequential Upload Loop
  const handleStartSequentialUpload = async () => {
    if (folderSongs.length === 0) {
      onShowToast("Please select a folder with songs first.", "info");
      return;
    }

    setIsSequentialUploading(true);
    setIsPaused(false);
    pauseRef.current = false;
    cancelRef.current = false;

    // Loop through each song strictly one by one
    for (let i = 0; i < folderSongs.length; i++) {
      if (cancelRef.current) break;

      // Check if paused
      while (pauseRef.current) {
        await new Promise(r => setTimeout(r, 400));
        if (cancelRef.current) break;
      }
      if (cancelRef.current) break;

      // Skip already uploaded tracks
      const current = folderSongs[i];
      if (current.status === "success") continue;

      setCurrentUploadingIndex(i);
      await uploadTrackSequentially(i);
      
      // Short delay between uploads for stability
      await new Promise(r => setTimeout(r, 300));
    }

    setIsSequentialUploading(false);
    setCurrentUploadingIndex(-1);

    const uploadedCount = folderSongs.filter(s => s.status === "success").length;
    onShowToast(`Folder upload session completed! ${uploadedCount}/${folderSongs.length} songs processed. 🎉`, "success");
    
    // Automatically switch to Inspector view if any songs have missing details
    const hasMissing = folderSongs.some(s => s.missingDetails.totalMissing > 0);
    if (hasMissing) {
      setActiveView("inspector");
    }
  };

  // Pause / Resume toggle
  const handleTogglePause = () => {
    setIsPaused(prev => !prev);
  };

  // Direct Inline Edit Save function
  const handleSaveTrackEdit = async (trackId: string, updates: Partial<FolderSongItem>) => {
    const target = folderSongs.find(s => s.id === trackId);
    if (!target) return;

    // Upload custom cover file if selected
    let updatedImageUrl = target.customCoverUrl || target.uploadedImageUrl || "";
    if (updates.customCoverFile) {
      try {
        onShowToast("Uploading updated cover to Cloudinary...", "info");
        const cloud = await uploadToCloudinaryDirect(updates.customCoverFile);
        if (cloud?.secure_url) {
          updatedImageUrl = cloud.secure_url;
          updates.customCoverUrl = updatedImageUrl;
        }
      } catch (imgErr) {
        console.warn("Cover update failed", imgErr);
      }
    }

    // Merge updates
    const merged: FolderSongItem = {
      ...target,
      ...updates,
      uploadedImageUrl: updatedImageUrl || target.uploadedImageUrl,
      missingDetails: computeMissing({
        ...target,
        ...updates,
        uploadedImageUrl: updatedImageUrl || target.uploadedImageUrl
      })
    };

    // Update in local state
    setFolderSongs(prev => prev.map(s => s.id === trackId ? merged : s));

    // If song was already saved to Firestore, update the Firestore document directly!
    if (target.firestoreDocId) {
      try {
        const matchedArtist = artistsList.find(a => a.name.trim().toLowerCase() === (updates.artist || target.artist).trim().toLowerCase());
        const firestorePatch: Record<string, any> = {
          title: merged.title,
          artist: merged.artist,
          artistId: matchedArtist?.id || null,
          artistImage: matchedArtist?.imageUrl || null,
          album: merged.album,
          categories: merged.categories,
          lyrics: merged.lyrics || ""
        };
        if (updatedImageUrl) {
          firestorePatch.imageUrl = updatedImageUrl;
        }

        await updateDoc(doc(db, "songs", target.firestoreDocId), firestorePatch);
        onShowToast(`"${merged.title}" updated in database! ✓`, "success");
        onSongAdded();
      } catch (dbErr: any) {
        console.error("Failed updating track in Firestore:", dbErr);
        onShowToast(`Failed to update database: ${dbErr?.message}`, "error");
      }
    } else {
      onShowToast(`"${merged.title}" details updated in queue! ✓`, "success");
    }

    setExpandedEditCardId(null);
  };

  // Quick Apply Artist to All Tracks in Folder
  const handleApplyArtistToAll = (artistName: string) => {
    if (!artistName) return;
    setFolderSongs(prev => prev.map(s => {
      const updatedArtist = s.artist || artistName;
      return {
        ...s,
        artist: updatedArtist,
        missingDetails: computeMissing({
          ...s,
          artist: updatedArtist
        })
      };
    }));
    onShowToast(`Applied artist "${artistName}" to all tracks needing an artist.`, "info");
  };

  // Play / Pause preview audio
  const handleTogglePlay = (track: FolderSongItem) => {
    const audioSrc = track.uploadedAudioUrl || (track.file ? URL.createObjectURL(track.file) : null);
    if (!audioSrc) return;

    if (playingAudioUrl === audioSrc) {
      audioPreviewRef.current?.pause();
      setPlayingAudioUrl(null);
    } else {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.src = audioSrc;
        audioPreviewRef.current.play().catch(e => console.warn("Audio play blocked", e));
        setPlayingAudioUrl(audioSrc);
      }
    }
  };

  // Filtered tracks calculation
  const filteredSongs = useMemo(() => {
    return folderSongs.filter(song => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = song.title.toLowerCase().includes(q);
        const matchArtist = song.artist.toLowerCase().includes(q);
        const matchFile = song.fileName.toLowerCase().includes(q);
        if (!matchTitle && !matchArtist && !matchFile) return false;
      }

      // Category / Missing Audit Filter
      if (filterType === "missing_any") {
        return song.missingDetails.totalMissing > 0;
      }
      if (filterType === "missing_cover") {
        return !song.missingDetails.hasCover;
      }
      if (filterType === "missing_artist") {
        return !song.missingDetails.hasArtist;
      }
      if (filterType === "missing_lyrics") {
        return !song.missingDetails.hasLyrics;
      }
      if (filterType === "complete") {
        return song.missingDetails.totalMissing === 0;
      }
      return true;
    });
  }, [folderSongs, filterType, searchQuery]);

  // Overall statistics
  const totalCount = folderSongs.length;
  const successCount = folderSongs.filter(s => s.status === "success").length;
  const errorCount = folderSongs.filter(s => s.status === "error").length;
  const queuedCount = folderSongs.filter(s => s.status === "queued").length;
  const missingAnyCount = folderSongs.filter(s => s.missingDetails.totalMissing > 0).length;
  const missingCoverCount = folderSongs.filter(s => !s.missingDetails.hasCover).length;
  const missingArtistCount = folderSongs.filter(s => !s.missingDetails.hasArtist).length;
  const missingLyricsCount = folderSongs.filter(s => !s.missingDetails.hasLyrics).length;
  const completeCount = folderSongs.filter(s => s.missingDetails.totalMissing === 0).length;

  const overallPercent = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#060913] text-slate-100 flex flex-col h-screen w-screen overflow-hidden select-none">
      {/* Hidden audio player for preview */}
      <audio 
        ref={audioPreviewRef} 
        onEnded={() => setPlayingAudioUrl(null)} 
        onError={() => setPlayingAudioUrl(null)} 
      />

      {/* Hidden folder picker input */}
      <input 
        ref={folderInputRef}
        type="file"
        // @ts-ignore: standard browser webkitdirectory attribute
        webkitdirectory="true"
        // @ts-ignore
        directory="true"
        multiple
        className="hidden"
        onChange={(e) => handleFolderSelected(e.target.files)}
      />

      {/* TOP EDGE-TO-EDGE HEADER */}
      <header className="flex-shrink-0 bg-[#0c1220]/95 backdrop-blur-xl border-b border-white/10 px-4 md:px-8 py-3.5 flex items-center justify-between gap-4 z-20 shadow-2xl">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 flex-shrink-0">
            <Folder className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h1 className="text-base md:text-lg font-black text-white truncate tracking-tight">
                {folderName ? `📁 ${folderName}` : "Edge-to-Edge Folder Upload Engine"}
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase font-bold flex-shrink-0">
                Sequential Mode
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate font-mono">
              {folderSongs.length > 0 
                ? `${folderSongs.length} Songs Loaded • Sequential Uploading One-by-One (Zero Flooding)`
                : "Select an entire music directory to upload tracks sequentially"}
            </p>
          </div>
        </div>

        {/* Live Upload Indicator / Actions in Header */}
        <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
          {folderSongs.length === 0 ? (
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="px-4 md:px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center space-x-2"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Select Music Folder</span>
            </button>
          ) : (
            <>
              {/* Sequential Upload Controls */}
              {!isSequentialUploading ? (
                <button
                  type="button"
                  onClick={handleStartSequentialUpload}
                  disabled={folderSongs.every(s => s.status === "success")}
                  className="px-4 md:px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>
                    {successCount > 0 ? `Resume (${folderSongs.length - successCount} Left)` : "Start Sequential Upload"}
                  </span>
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all border ${
                      isPaused 
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40" 
                        : "bg-white/10 hover:bg-white/15 text-slate-200 border-white/15"
                    }`}
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                    <span>{isPaused ? "Resume" : "Pause"}</span>
                  </button>

                  <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    <span>Uploading #{currentUploadingIndex + 1} of {totalCount}</span>
                  </div>
                </div>
              )}

              {/* View Switcher: Queue vs Inspector */}
              <div className="flex items-center p-1 bg-black/40 border border-white/10 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveView("queue")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    activeView === "queue"
                      ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Queue ({folderSongs.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveView("inspector")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    activeView === "inspector"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <AlertTriangle className={`w-3.5 h-3.5 ${missingAnyCount > 0 ? "text-amber-400" : "text-slate-400"}`} />
                  <span>Missing Details</span>
                  {missingAnyCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-black flex items-center justify-center font-mono">
                      {missingAnyCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Change Folder Button */}
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                disabled={isSequentialUploading}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all text-xs flex items-center space-x-1 disabled:opacity-50"
                title="Change or Re-select Folder"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden xl:inline">Pick Another Folder</span>
              </button>
            </>
          )}

          {/* Close Edge-to-Edge Screen */}
          <button
            type="button"
            onClick={() => {
              if (isSequentialUploading) {
                if (!confirm("Sequential upload is currently running! Are you sure you want to exit?")) {
                  return;
                }
                cancelRef.current = true;
              }
              onClose();
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 transition-all"
            title="Close Full Screen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* OVERALL REAL-TIME PROGRESS STRIP */}
      {folderSongs.length > 0 && (
        <div className="bg-[#090e1a] border-b border-white/5 px-4 md:px-8 py-2.5 flex-shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-1.5 text-xs font-mono">
            <div className="flex items-center space-x-3">
              <span className="text-slate-400 font-bold">
                {isSequentialUploading 
                  ? (isPaused ? "⏸️ Upload Queue Paused" : "🚀 Sequential Upload Active (1-by-1)") 
                  : (successCount === totalCount ? "🎉 All Songs Uploaded Successfully!" : "Ready to Upload")}
              </span>
              <span className="text-cyan-400 font-bold">
                {successCount} of {totalCount} Uploaded ({overallPercent}%)
              </span>
              {currentUploadingIndex >= 0 && folderSongs[currentUploadingIndex] && (
                <span className="text-purple-300 truncate max-w-sm">
                  Active: <strong>{folderSongs[currentUploadingIndex].title}</strong> ({folderSongs[currentUploadingIndex].currentStep})
                </span>
              )}
            </div>

            {/* Missing Info Badge Summary */}
            <div className="flex items-center space-x-2 text-[11px]">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ✓ {completeCount} Complete
              </span>
              {missingAnyCount > 0 ? (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                  ⚠️ {missingAnyCount} Missing Details (Fix Inline Below)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  ✨ All Metadata Ready
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
            <div 
              className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400 transition-all duration-300 shadow-sm"
              style={{ width: `${overallPercent}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* FILTER & AUDIT SUBHEADER BAR */}
      {folderSongs.length > 0 && (
        <div className="bg-[#090d18] border-b border-white/5 px-4 md:px-8 py-2.5 flex-shrink-0 flex flex-wrap items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono text-slate-400 uppercase font-bold mr-1">
              View Filter:
            </span>
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                filterType === "all"
                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                  : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"
              }`}
            >
              All Tracks ({totalCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterType("missing_any")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center space-x-1 ${
                filterType === "missing_any"
                  ? "bg-amber-500/20 border-amber-400 text-amber-300"
                  : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Needs Attention ({missingAnyCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType("missing_cover")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center space-x-1 ${
                filterType === "missing_cover"
                  ? "bg-purple-500/20 border-purple-400 text-purple-300"
                  : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"
              }`}
            >
              <ImageIcon className="w-3 h-3 text-purple-400" />
              <span>Missing Artwork ({missingCoverCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType("missing_artist")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center space-x-1 ${
                filterType === "missing_artist"
                  ? "bg-blue-500/20 border-blue-400 text-blue-300"
                  : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Music className="w-3 h-3 text-blue-400" />
              <span>Missing Artist ({missingArtistCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType("missing_lyrics")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center space-x-1 ${
                filterType === "missing_lyrics"
                  ? "bg-pink-500/20 border-pink-400 text-pink-300"
                  : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-3 h-3 text-pink-400" />
              <span>Missing Lyrics ({missingLyricsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType("complete")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center space-x-1 ${
                filterType === "complete"
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                  : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Complete ({completeCount})</span>
            </button>
          </div>

          {/* Quick Search & Batch Quick Fix */}
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tracks, artists..."
                className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:border-cyan-400 outline-none"
              />
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => setSearchQuery("")} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Auto-Link Artist dropdown if any missing */}
            {missingArtistCount > 0 && artistsList.length > 0 && (
              <div className="relative group/artistapply">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleApplyArtistToAll(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  defaultValue=""
                  className="px-2.5 py-1.5 bg-purple-950/60 border border-purple-500/30 text-purple-300 text-xs font-bold rounded-xl outline-none cursor-pointer"
                >
                  <option value="" disabled>⚡ Quick Fill Artist to Missing...</option>
                  {artistsList.map(a => (
                    <option key={a.id} value={a.name} className="bg-slate-900 text-white">
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAIN SCROLLABLE CONTENT BODY */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
        {/* Empty State / Initial Folder Drag Box */}
        {folderSongs.length === 0 ? (
          <div className="max-w-3xl mx-auto my-12 text-center">
            <div 
              onClick={() => folderInputRef.current?.click()}
              className="border-2 border-dashed border-cyan-500/30 hover:border-cyan-400 rounded-3xl p-12 bg-black/40 hover:bg-cyan-500/5 transition-all cursor-pointer group shadow-2xl relative overflow-hidden"
            >
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl shadow-cyan-500/10">
                <FolderPlus className="w-12 h-12" />
              </div>

              <h2 className="text-xl md:text-2xl font-black text-white group-hover:text-cyan-300 transition-colors mb-2">
                Click to Select Music Folder
              </h2>
              <p className="text-sm text-slate-400 max-w-lg mx-auto mb-6">
                Pick an entire music album or track directory. All audio files (.mp3, .m4a, .wav) will be loaded, scanned for artist & embedded artwork, and queued for sequential one-by-one upload.
              </p>

              <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold">
                <Sparkles className="w-4 h-4" />
                <span>Supports WebKit Directory & Auto Embedded Artwork Extraction</span>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 text-left">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-cyan-400 font-bold text-xs uppercase font-mono mb-1">
                  1. Sequential 1-by-1 Queue
                </div>
                <p className="text-xs text-slate-400">
                  Uploads tracks strictly one after another without network flooding. While track 1 uploads, others wait in queue.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-purple-400 font-bold text-xs uppercase font-mono mb-1">
                  2. Edge-to-Edge Overview
                </div>
                <p className="text-xs text-slate-400">
                  Real-time status shows which folder is selected, how many songs uploaded, active progress bar, and estimated time.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-emerald-400 font-bold text-xs uppercase font-mono mb-1">
                  3. Missing Info Inspector & Direct Edit
                </div>
                <p className="text-xs text-slate-400">
                  Identifies missing cover art, empty artist names, or lyrics. Edit and save directly onto each card in real time!
                </p>
              </div>
            </div>
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="text-center py-20 bg-white/5 border border-white/5 rounded-3xl">
            <Filter className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-300">No tracks match your current filter</h3>
            <p className="text-xs text-slate-500 mt-1">Try resetting the filter or search query</p>
            <button
              type="button"
              onClick={() => { setFilterType("all"); setSearchQuery(""); }}
              className="mt-4 px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          /* LIST / GRID OF SONGS IN FOLDER */
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredSongs.map((track, displayIdx) => {
              const originalIndex = folderSongs.findIndex(s => s.id === track.id);
              const isUploadingThis = isSequentialUploading && currentUploadingIndex === originalIndex;
              const isNextInQueue = isSequentialUploading && originalIndex > currentUploadingIndex && track.status === "queued";
              const isEditing = expandedEditCardId === track.id;

              const displayImage = track.customCoverUrl || 
                (track.customCoverFile ? URL.createObjectURL(track.customCoverFile) : track.coverDataUrl) || 
                track.uploadedImageUrl ||
                "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&auto=format&fit=crop";

              const hasMissingDetails = track.missingDetails.totalMissing > 0;

              return (
                <div 
                  key={track.id}
                  className={`rounded-2xl p-4 md:p-5 transition-all shadow-xl relative overflow-hidden border ${
                    isUploadingThis
                      ? "border-cyan-400 bg-cyan-950/20 shadow-cyan-500/20 ring-2 ring-cyan-500/30"
                      : track.status === "success"
                      ? "border-emerald-500/30 bg-[#0a1515]"
                      : track.status === "error"
                      ? "border-red-500/40 bg-red-950/15"
                      : isNextInQueue
                      ? "border-white/10 bg-[#090e1c] opacity-90"
                      : "border-white/10 bg-[#0c101d] hover:border-cyan-500/30"
                  }`}
                >
                  {/* Active Upload Glow Banner */}
                  {isUploadingThis && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 animate-pulse"></div>
                  )}

                  {/* Card Header: Index, Filename, Path & Live Sequential Status Badge */}
                  <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-white/5">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className={`w-7 h-7 rounded-xl font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                        isUploadingThis 
                          ? "bg-cyan-500 text-black animate-pulse" 
                          : track.status === "success"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-white/10 text-slate-300"
                      }`}>
                        #{originalIndex + 1}
                      </span>

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate" title={track.fileName}>
                          {track.fileName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">
                          {track.relativePath} • {formatSize(track.fileSize)} • {track.duration ? formatTime(track.duration) : "Auto duration"}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {isUploadingThis && (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold border border-cyan-400/40 animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Uploading {track.progress}%</span>
                        </span>
                      )}

                      {!isUploadingThis && track.status === "queued" && isSequentialUploading && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 text-[10px] font-mono border border-white/10">
                          <Clock className="w-3 h-3" />
                          <span>Waiting in Queue</span>
                        </span>
                      )}

                      {!isUploadingThis && track.status === "queued" && !isSequentialUploading && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-300 text-[10px] font-mono border border-cyan-500/20">
                          <span>Ready</span>
                        </span>
                      )}

                      {track.status === "success" && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-[10px] font-bold font-mono border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Uploaded ✓</span>
                        </span>
                      )}

                      {track.status === "error" && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-red-500/20 text-red-300 text-[10px] font-mono border border-red-500/30" title={track.errorMessage}>
                          <AlertCircle className="w-3 h-3" />
                          <span>Failed</span>
                        </span>
                      )}

                      {/* Edit / Quick Expand Toggle */}
                      <button
                        type="button"
                        onClick={() => setExpandedEditCardId(isEditing ? null : track.id)}
                        className={`p-1.5 rounded-lg text-xs transition-all border flex items-center space-x-1 ${
                          isEditing
                            ? "bg-purple-600 text-white border-purple-500"
                            : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
                        }`}
                        title="Edit track details inline"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold">{isEditing ? "Close Edit" : "Edit Details"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Missing Info Badges Strip */}
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    {!track.missingDetails.hasCover ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-red-500/15 text-red-300 border border-red-500/30 text-[10px] font-bold">
                        <AlertCircle className="w-3 h-3 text-red-400" />
                        <span>Missing Cover Image</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[9px] font-mono">
                        <Check className="w-2.5 h-2.5" />
                        <span>Artwork ✓</span>
                      </span>
                    )}

                    {!track.missingDetails.hasArtist ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                        <span>Missing Artist</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[9px] font-mono">
                        <Check className="w-2.5 h-2.5" />
                        <span>{track.artist}</span>
                      </span>
                    )}

                    {!track.missingDetails.hasLyrics ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px]">
                        <span>No Lyrics</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-pink-500/10 text-pink-300 text-[9px] font-mono">
                        <span>Lyrics Attached ✓</span>
                      </span>
                    )}

                    {track.status === "uploading" && track.currentStep && (
                      <span className="text-[10px] text-cyan-300 font-mono italic ml-auto">
                        {track.currentStep}
                      </span>
                    )}
                  </div>

                  {/* Main Card View: Image + Track Summary */}
                  <div className="flex gap-4 items-start">
                    {/* Artwork Preview & Click to Change */}
                    <div className="relative group/cover flex-shrink-0">
                      <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden bg-black/60 border border-white/10 shadow-md">
                        <img 
                          src={displayImage} 
                          alt={track.title} 
                          className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      {/* Cover file picker overlay */}
                      <label className="absolute inset-0 bg-black/75 opacity-0 group-hover/cover:opacity-100 flex flex-col items-center justify-center cursor-pointer rounded-2xl transition-opacity text-white text-[9px] font-mono p-1 text-center backdrop-blur-xs">
                        <ImageIcon className="w-4 h-4 mb-0.5 text-cyan-400" />
                        <span>Change Cover</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const imgFile = e.target.files?.[0];
                            if (imgFile) {
                              handleSaveTrackEdit(track.id, { customCoverFile: imgFile });
                            }
                          }}
                        />
                      </label>

                      {track.coverDataUrl && !track.customCoverFile && (
                        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 whitespace-nowrap font-mono shadow-sm">
                          ID3 Cover
                        </span>
                      )}
                    </div>

                    {/* Quick Metadata View */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-white truncate" title={track.title}>
                        {track.title || "Untitled Track"}
                      </h4>
                      <p className="text-xs text-slate-300 truncate mt-0.5">
                        <span className="text-slate-400">Artist:</span>{" "}
                        <strong className={track.artist ? "text-cyan-300" : "text-amber-400 italic"}>
                          {track.artist || "Missing Artist (Click Edit)"}
                        </strong>
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        <span className="text-slate-500">Album:</span>{" "}
                        <span>{track.album || folderName || "Single"}</span>
                      </p>

                      {/* Play Preview Button */}
                      <div className="mt-2 flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePlay(track)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] font-mono flex items-center space-x-1 transition-all"
                        >
                          <Play className="w-3 h-3" />
                          <span>Preview Audio</span>
                        </button>

                        {track.status !== "success" && !isSequentialUploading && (
                          <button
                            type="button"
                            onClick={() => uploadTrackSequentially(originalIndex)}
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold flex items-center space-x-1 transition-all"
                          >
                            <UploadCloud className="w-3 h-3" />
                            <span>Upload Just This</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ACTIVE UPLOAD LIVE PROGRESS BAR */}
                  {isUploadingThis && (
                    <div className="mt-3">
                      <div className="w-full bg-black/60 h-2 rounded-full overflow-hidden border border-cyan-500/30">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                          style={{ width: `${track.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* INLINE EDIT ACCORDION / FORM (Direct Editing Right Here) */}
                  {isEditing && (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-3 bg-black/40 -mx-4 -mb-4 p-4 rounded-b-2xl animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cyan-300 flex items-center space-x-1 font-mono uppercase">
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Inline Card Editor</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {track.firestoreDocId ? "✓ Synced with Live Database" : "Queued Track"}
                        </span>
                      </div>

                      {/* Title & Artist Input Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 font-mono uppercase block mb-1">
                            Track Title *
                          </label>
                          <input 
                            type="text"
                            defaultValue={track.title}
                            id={`edit-title-${track.id}`}
                            className="w-full px-3 py-1.5 bg-white/5 border border-white/15 focus:border-cyan-400 rounded-xl text-white text-xs outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 font-mono uppercase block mb-1">
                            Artist Name *
                          </label>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              defaultValue={track.artist}
                              id={`edit-artist-${track.id}`}
                              placeholder="Artist name"
                              className="w-full px-3 py-1.5 bg-white/5 border border-white/15 focus:border-purple-400 rounded-xl text-white text-xs outline-none"
                            />
                            {/* Artist Quick Dropdown */}
                            {artistsList.length > 0 && (
                              <select 
                                onChange={(e) => {
                                  const el = document.getElementById(`edit-artist-${track.id}`) as HTMLInputElement;
                                  if (el && e.target.value) el.value = e.target.value;
                                }}
                                defaultValue=""
                                className="px-2 py-1 bg-black/60 border border-white/15 text-slate-300 text-xs rounded-xl outline-none"
                              >
                                <option value="" disabled>Pick</option>
                                {artistsList.map(a => (
                                  <option key={a.id} value={a.name}>{a.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Album & Duration Row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 font-mono uppercase block mb-1">
                            Album Name
                          </label>
                          <input 
                            type="text"
                            defaultValue={track.album || folderName}
                            id={`edit-album-${track.id}`}
                            className="w-full px-3 py-1.5 bg-white/5 border border-white/15 focus:border-cyan-400 rounded-xl text-white text-xs outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 font-mono uppercase block mb-1">
                            Cover Image URL (or upload above)
                          </label>
                          <input 
                            type="text"
                            defaultValue={track.customCoverUrl || track.uploadedImageUrl || ""}
                            id={`edit-coverurl-${track.id}`}
                            placeholder="https://..."
                            className="w-full px-3 py-1.5 bg-white/5 border border-white/15 focus:border-cyan-400 rounded-xl text-white text-xs outline-none"
                          />
                        </div>
                      </div>

                      {/* Lyrics Editor Field */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-400 font-mono uppercase">
                            Lyrics (.lrc Synced or Plain text)
                          </label>
                          {track.lyrics && (
                            <span className="text-[9px] font-mono text-pink-400">
                              {track.lyrics.length} chars
                            </span>
                          )}
                        </div>
                        <textarea 
                          defaultValue={track.lyrics || ""}
                          id={`edit-lyrics-${track.id}`}
                          rows={3}
                          placeholder="Paste synchronized [00:12.30] lyrics or plain lyrics here..."
                          className="w-full px-3 py-2 bg-white/5 border border-white/15 focus:border-pink-400 rounded-xl text-white text-xs outline-none font-mono"
                        />
                      </div>

                      {/* Save Changes Button */}
                      <div className="flex items-center justify-end space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setExpandedEditCardId(null)}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const newTitle = (document.getElementById(`edit-title-${track.id}`) as HTMLInputElement)?.value;
                            const newArtist = (document.getElementById(`edit-artist-${track.id}`) as HTMLInputElement)?.value;
                            const newAlbum = (document.getElementById(`edit-album-${track.id}`) as HTMLInputElement)?.value;
                            const newCoverUrl = (document.getElementById(`edit-coverurl-${track.id}`) as HTMLInputElement)?.value;
                            const newLyrics = (document.getElementById(`edit-lyrics-${track.id}`) as HTMLTextAreaElement)?.value;

                            handleSaveTrackEdit(track.id, {
                              title: newTitle,
                              artist: newArtist,
                              album: newAlbum,
                              customCoverUrl: newCoverUrl,
                              lyrics: newLyrics
                            });
                          }}
                          className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center space-x-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save & Apply Updates</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* FOOTER BAR: SUMMARY & GLOBAL FINISH */}
      {folderSongs.length > 0 && (
        <footer className="flex-shrink-0 bg-[#0c1220]/95 backdrop-blur-xl border-t border-white/10 px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-4 z-20">
          <div className="flex items-center space-x-4 text-xs font-mono">
            <span className="text-slate-400">
              Folder: <strong className="text-white">{folderName}</strong>
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-cyan-400">
              {successCount}/{totalCount} Processed
            </span>
            {missingAnyCount > 0 && (
              <>
                <span className="text-slate-400">•</span>
                <span className="text-amber-400 font-bold">
                  ⚠️ {missingAnyCount} Tracks Need Info (Click "Edit Details" to fix)
                </span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => {
                if (isSequentialUploading) {
                  if (!confirm("Sequential upload is still active. Exit anyway?")) return;
                  cancelRef.current = true;
                }
                onClose();
              }}
              className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Finish & Return to Admin</span>
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
