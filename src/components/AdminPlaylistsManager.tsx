import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  ListMusic, 
  Plus, 
  Download, 
  Upload, 
  Trash2, 
  Edit3, 
  Save, 
  Search, 
  Lock, 
  Eye, 
  Play, 
  Pause, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Music, 
  Share2, 
  Copy, 
  FileText, 
  FileJson, 
  Layers, 
  ExternalLink, 
  Clock, 
  Image as ImageIcon,
  Check,
  FolderPlus,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Disc
} from "lucide-react";
import { Playlist, Song } from "../types";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  orderBy,
  onSnapshot 
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinaryDirect } from "../lib/cloudinary";

interface AdminPlaylistsManagerProps {
  songs: Song[];
  onSongAdded: () => void;
  onShowToast: (message: string, type: "success" | "error" | "info") => void;
}

export default function AdminPlaylistsManager({
  songs,
  onSongAdded,
  onShowToast
}: AdminPlaylistsManagerProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Create Playlist Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newPlaylistName, setNewPlaylistName] = useState<string>("");
  const [newPlaylistDesc, setNewPlaylistDesc] = useState<string>("");
  const [newPlaylistImage, setNewPlaylistImage] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Manage / View Single Playlist Detail Modal
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [showAddSongsDrawer, setShowAddSongsDrawer] = useState<boolean>(false);
  const [songSearchQuery, setSongSearchQuery] = useState<string>("");

  // Import Playlist Modal State
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>("");
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const fileImportInputRef = useRef<HTMLInputElement | null>(null);

  // Audio preview playback
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Helper: Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "0:00";
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem.toString().padStart(2, "0")}`;
  };

  // Helper: Format total playlist duration
  const formatTotalDuration = (songIds: string[]) => {
    const totalSecs = songIds.reduce((acc, id) => {
      const s = songs.find(x => x.id === id);
      return acc + (s?.duration || 0);
    }, 0);
    const mins = Math.floor(totalSecs / 60);
    if (mins < 60) return `${mins} mins`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  // Real-time listener for Playlists
  useEffect(() => {
    setLoading(true);
    // Listen to all playlists in database
    const q = query(collection(db, "playlists"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Playlist[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          name: d.name || "Untitled Playlist",
          userId: d.userId || "admin",
          songIds: d.songIds || [],
          thumbnailUrl: d.thumbnailUrl || null,
          createdAt: d.createdAt || Date.now(),
          isPrivate: d.isPrivate !== false, // default to private for admin playlists
          description: d.description || "",
          updatedAt: d.updatedAt || d.createdAt || Date.now()
        });
      });
      setPlaylists(list);
      setLoading(false);
    }, (err) => {
      console.warn("Failed fetching playlists:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync activePlaylist when playlists list updates
  useEffect(() => {
    if (activePlaylist) {
      const refreshed = playlists.find(p => p.id === activePlaylist.id);
      if (refreshed) {
        setActivePlaylist(refreshed);
      }
    }
  }, [playlists]);

  // Audio preview playback handler
  const handleTogglePlay = (url: string) => {
    if (playingAudioUrl === url) {
      audioRef.current?.pause();
      setPlayingAudioUrl(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(e => console.warn("Audio play blocked", e));
        setPlayingAudioUrl(url);
      }
    }
  };

  // Create New Private Playlist
  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) {
      onShowToast("Please enter a playlist name", "error");
      return;
    }

    setIsCreating(true);
    try {
      const newPlaylistData: Partial<Playlist> & Record<string, any> = {
        name: newPlaylistName.trim(),
        description: newPlaylistDesc.trim(),
        thumbnailUrl: newPlaylistImage.trim() || null,
        userId: auth.currentUser?.uid || "admin",
        songIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPrivate: true // Strictly Private: Hidden from normal public users
      };

      const docRef = await addDoc(collection(db, "playlists"), newPlaylistData);
      onShowToast(`Private Playlist "${newPlaylistName.trim()}" created! 🔒`, "success");
      setNewPlaylistName("");
      setNewPlaylistDesc("");
      setNewPlaylistImage("");
      setShowCreateModal(false);

      // Immediately open this playlist to manage
      setActivePlaylist({
        id: docRef.id,
        name: newPlaylistData.name!,
        userId: newPlaylistData.userId!,
        songIds: [],
        thumbnailUrl: newPlaylistData.thumbnailUrl,
        createdAt: newPlaylistData.createdAt!,
        isPrivate: true,
        description: newPlaylistData.description
      });
    } catch (err: any) {
      console.error("Error creating playlist:", err);
      onShowToast(`Failed to create playlist: ${err?.message}`, "error");
    } finally {
      setIsCreating(false);
    }
  };

  // Delete Playlist
  const handleDeletePlaylist = async (playlist: Playlist) => {
    if (!confirm(`Are you sure you want to delete the private playlist "${playlist.name}"? (Songs will remain safely in library).`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "playlists", playlist.id));
      onShowToast(`Playlist "${playlist.name}" deleted.`, "info");
      if (activePlaylist?.id === playlist.id) {
        setActivePlaylist(null);
      }
    } catch (err: any) {
      onShowToast(`Error deleting playlist: ${err?.message}`, "error");
    }
  };

  // Add a song to the active playlist
  const handleAddSongToActivePlaylist = async (songId: string) => {
    if (!activePlaylist) return;
    if (activePlaylist.songIds.includes(songId)) {
      onShowToast("This song is already in the playlist.", "info");
      return;
    }

    const updatedSongIds = [...activePlaylist.songIds, songId];
    
    // Auto-fill thumbnail if empty
    let updatedThumb = activePlaylist.thumbnailUrl;
    if (!updatedThumb) {
      const addedSong = songs.find(s => s.id === songId);
      if (addedSong?.imageUrl) {
        updatedThumb = addedSong.imageUrl;
      }
    }

    try {
      await updateDoc(doc(db, "playlists", activePlaylist.id), {
        songIds: updatedSongIds,
        thumbnailUrl: updatedThumb,
        updatedAt: Date.now()
      });
      onShowToast("Song added to private playlist! ✓", "success");
    } catch (err: any) {
      onShowToast(`Failed to add song: ${err?.message}`, "error");
    }
  };

  // Remove a song from the active playlist
  const handleRemoveSongFromActivePlaylist = async (songId: string) => {
    if (!activePlaylist) return;
    const updatedSongIds = activePlaylist.songIds.filter(id => id !== songId);

    try {
      await updateDoc(doc(db, "playlists", activePlaylist.id), {
        songIds: updatedSongIds,
        updatedAt: Date.now()
      });
      onShowToast("Song removed from playlist.", "info");
    } catch (err: any) {
      onShowToast(`Failed to remove song: ${err?.message}`, "error");
    }
  };

  // EXPORT / DOWNLOAD PLAYLIST AS JSON WEB BUNDLE
  const handleExportPlaylistJSON = (playlist: Playlist) => {
    const playlistSongs = playlist.songIds
      .map(id => songs.find(s => s.id === id))
      .filter((s): s is Song => Boolean(s));

    const exportBundle = {
      version: "1.0",
      app: "skplayer",
      type: "skplayer-private-playlist-bundle",
      exportedAt: new Date().toISOString(),
      playlist: {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description || "",
        thumbnailUrl: playlist.thumbnailUrl || (playlistSongs[0]?.imageUrl || ""),
        isPrivate: true,
        createdAt: playlist.createdAt
      },
      songCount: playlistSongs.length,
      songs: playlistSongs.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        artistId: s.artistId || null,
        artistImage: s.artistImage || null,
        album: s.album || "",
        audioUrl: s.audioUrl,
        imageUrl: s.imageUrl,
        duration: s.duration,
        categories: s.categories || ["Tamil"],
        lyrics: s.lyrics || "",
        createdAt: s.createdAt
      }))
    };

    const jsonString = JSON.stringify(exportBundle, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = playlist.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    a.href = url;
    a.download = `skplayer_playlist_${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onShowToast(`Downloaded playlist bundle "${playlist.name}" (.json) with ${playlistSongs.length} songs! 🚀`, "success");
  };

  // EXPORT / DOWNLOAD PLAYLIST AS .M3U / M3U8
  const handleExportPlaylistM3U = (playlist: Playlist) => {
    const playlistSongs = playlist.songIds
      .map(id => songs.find(s => s.id === id))
      .filter((s): s is Song => Boolean(s));

    let m3uContent = "#EXTM3U\n";
    m3uContent += `#PLAYLIST:${playlist.name}\n\n`;

    playlistSongs.forEach(s => {
      m3uContent += `#EXTINF:${s.duration || 180},${s.artist} - ${s.title}\n`;
      m3uContent += `${s.audioUrl}\n\n`;
    });

    const blob = new Blob([m3uContent], { type: "audio/x-mpegurl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = playlist.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    a.href = url;
    a.download = `playlist_${safeName}.m3u8`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onShowToast(`Downloaded M3U8 streaming playlist for "${playlist.name}"! 🎵`, "success");
  };

  // Copy Playlist Web JSON to Clipboard
  const handleCopyPlaylistJSON = (playlist: Playlist) => {
    const playlistSongs = playlist.songIds
      .map(id => songs.find(s => s.id === id))
      .filter((s): s is Song => Boolean(s));

    const exportBundle = {
      version: "1.0",
      app: "skplayer",
      playlist: {
        name: playlist.name,
        thumbnailUrl: playlist.thumbnailUrl,
        isPrivate: true
      },
      songs: playlistSongs.map(s => ({
        title: s.title,
        artist: s.artist,
        audioUrl: s.audioUrl,
        imageUrl: s.imageUrl,
        duration: s.duration,
        lyrics: s.lyrics || ""
      }))
    };

    navigator.clipboard.writeText(JSON.stringify(exportBundle, null, 2)).then(() => {
      onShowToast("Playlist Web JSON copied to clipboard! 📋", "success");
    }).catch(() => {
      onShowToast("Failed copying to clipboard.", "error");
    });
  };

  // IMPORT PLAYLIST FROM JSON FILE OR TEXT
  const handleImportPlaylistBundle = async (rawJson: string) => {
    if (!rawJson.trim()) {
      onShowToast("Please provide valid JSON content to import.", "error");
      return;
    }

    setIsImporting(true);
    try {
      const parsed = JSON.parse(rawJson);
      
      const playlistMeta = parsed.playlist || {};
      const importedSongs: any[] = Array.isArray(parsed.songs) ? parsed.songs : [];

      if (!playlistMeta.name && importedSongs.length === 0) {
        throw new Error("Invalid playlist bundle. Missing playlist name or songs array.");
      }

      const pName = playlistMeta.name || "Imported Web Playlist";
      const pDesc = playlistMeta.description || `Imported on ${new Date().toLocaleDateString()}`;
      let pThumb = playlistMeta.thumbnailUrl || (importedSongs[0]?.imageUrl || null);

      // Verify and register any songs into Firestore if missing
      const resolvedSongIds: string[] = [];

      for (const s of importedSongs) {
        if (!s.title || !s.audioUrl) continue;

        // Check if song already exists in Firestore by audioUrl or title/artist
        const existing = songs.find(existingSong => 
          existingSong.audioUrl === s.audioUrl || 
          (existingSong.title.trim().toLowerCase() === s.title.trim().toLowerCase() && 
           existingSong.artist.trim().toLowerCase() === (s.artist || "").trim().toLowerCase())
        );

        if (existing) {
          resolvedSongIds.push(existing.id);
        } else {
          // Register new song into Firestore so it's playable in web app!
          const newSongDoc = await addDoc(collection(db, "songs"), {
            title: s.title.trim(),
            artist: s.artist?.trim() || "Various Artists",
            artistId: s.artistId || null,
            artistImage: s.artistImage || null,
            album: s.album?.trim() || pName,
            audioUrl: s.audioUrl,
            imageUrl: s.imageUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600&auto=format&fit=crop",
            duration: s.duration || 180,
            categories: s.categories || ["Tamil"],
            lyrics: s.lyrics || "",
            createdAt: Date.now(),
            uploadedBy: auth.currentUser?.uid || "admin"
          });
          resolvedSongIds.push(newSongDoc.id);
        }
      }

      // Create Private Playlist in Firestore
      const newPlDoc = await addDoc(collection(db, "playlists"), {
        name: pName,
        description: pDesc,
        thumbnailUrl: pThumb,
        userId: auth.currentUser?.uid || "admin",
        songIds: resolvedSongIds,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPrivate: true // Strictly Private Playlist
      });

      onSongAdded();
      onShowToast(`🎉 Imported playlist "${pName}" with ${resolvedSongIds.length} tracks into the app!`, "success");
      setShowImportModal(false);
      setImportJsonText("");
    } catch (err: any) {
      console.error("Playlist import error:", err);
      onShowToast(`Import failed: ${err?.message || "Invalid JSON"}`, "error");
    } finally {
      setIsImporting(false);
    }
  };

  // Filter playlists
  const filteredPlaylists = useMemo(() => {
    return playlists.filter(p => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
    });
  }, [playlists, searchQuery]);

  // Songs inside active playlist
  const activePlaylistSongs = useMemo(() => {
    if (!activePlaylist) return [];
    return activePlaylist.songIds
      .map(id => songs.find(s => s.id === id))
      .filter((s): s is Song => Boolean(s));
  }, [activePlaylist, songs]);

  // Songs available to add
  const availableSongsToAdd = useMemo(() => {
    if (!activePlaylist) return [];
    const existingIds = new Set(activePlaylist.songIds);
    return songs.filter(s => {
      if (existingIds.has(s.id)) return false;
      if (!songSearchQuery.trim()) return true;
      const q = songSearchQuery.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
    });
  }, [activePlaylist, songs, songSearchQuery]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hidden audio element for preview */}
      <audio 
        ref={audioRef} 
        onEnded={() => setPlayingAudioUrl(null)} 
        onError={() => setPlayingAudioUrl(null)} 
      />

      {/* Hidden file input for importing JSON */}
      <input 
        ref={fileImportInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            try {
              const text = await file.text();
              handleImportPlaylistBundle(text);
            } catch (err) {
              onShowToast("Failed reading JSON file", "error");
            }
          }
        }}
      />

      {/* Top Banner & Action Controls */}
      <div className="bg-gradient-to-br from-[#0c1222] via-[#0b101e] to-[#160e28] border border-purple-500/20 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-2.5 mb-1.5">
              <span className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                <ListMusic className="w-5 h-5" />
              </span>
              <h2 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight">
                Admin Private Playlists Hub
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold uppercase flex items-center space-x-1">
                <Lock className="w-3 h-3" />
                <span>Private & Hidden from Public</span>
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
              Create, organize, and export <strong>Private Playlists</strong>. Songs inside remain accessible, but the playlist itself is private to the Admin console. Export as portable JSON / M3U8 web bundles and import them into any web instance!
            </p>
          </div>

          {/* Action Buttons: Create & Import */}
          <div className="flex items-center space-x-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-bold transition-all flex items-center space-x-2 shadow-sm"
            >
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>Import Web Playlist</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-purple-500/25 transition-all flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Private Playlist</span>
            </button>
          </div>
        </div>

        {/* Stats Strip & Search */}
        <div className="pt-4 border-t border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 flex items-center space-x-2">
              <span className="text-slate-400">Total Playlists:</span>
              <strong className="text-purple-300">{playlists.length}</strong>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 flex items-center space-x-2">
              <span className="text-slate-400">Total Tracks Managed:</span>
              <strong className="text-cyan-300">
                {playlists.reduce((acc, p) => acc + (p.songIds?.length || 0), 0)}
              </strong>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search private playlists..."
              className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:border-purple-400 outline-none"
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
        </div>
      </div>

      {/* Playlist Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500">
          <Disc className="w-10 h-10 animate-spin mx-auto mb-2 text-purple-400" />
          <p className="text-xs font-mono">Loading private playlists...</p>
        </div>
      ) : filteredPlaylists.length === 0 ? (
        <div className="text-center py-20 px-4 bg-white/2 border border-white/5 rounded-3xl">
          <ListMusic className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-300">No Private Playlists Found</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Create your first private playlist or select one during single/batch/folder audio upload!
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition-all inline-flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Playlist</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPlaylists.map((playlist) => {
            const trackCount = playlist.songIds?.length || 0;
            const firstSong = songs.find(s => playlist.songIds?.includes(s.id));
            const displayCover = playlist.thumbnailUrl || firstSong?.imageUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&auto=format&fit=crop";

            return (
              <div 
                key={playlist.id}
                className="bg-[#0b101c] border border-white/10 hover:border-purple-500/40 rounded-2xl p-4 md:p-5 transition-all shadow-xl group flex flex-col justify-between relative overflow-hidden"
              >
                {/* Background glow on hover */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 group-hover:bg-purple-500/15 rounded-full blur-2xl transition-all pointer-events-none"></div>

                <div>
                  {/* Top Bar: Privacy Badge & Delete Button */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Private Playlist</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDeletePlaylist(playlist)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 transition-all text-xs"
                      title="Delete Playlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Thumbnail & Title */}
                  <div className="flex items-start space-x-3.5 mb-4">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden bg-black/60 border border-white/10 shadow-md flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                      <img 
                        src={displayCover} 
                        alt={playlist.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors truncate" title={playlist.name}>
                        {playlist.name}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                        {playlist.description || "Private administrator curated playlist."}
                      </p>

                      <div className="mt-2 flex items-center space-x-3 text-[11px] font-mono text-slate-400">
                        <span className="text-purple-300 font-bold">{trackCount} Tracks</span>
                        <span>•</span>
                        <span>{formatTotalDuration(playlist.songIds || [])}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Strip: Manage & Export */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setActivePlaylist(playlist)}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all flex items-center space-x-1.5"
                  >
                    <ListMusic className="w-3.5 h-3.5" />
                    <span>Manage Tracks</span>
                  </button>

                  <div className="flex items-center space-x-1">
                    {/* Export JSON Bundle Button */}
                    <button
                      type="button"
                      onClick={() => handleExportPlaylistJSON(playlist)}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all text-xs flex items-center space-x-1"
                      title="Download Playlist JSON Web Bundle"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[10px] font-mono font-bold">JSON</span>
                    </button>

                    {/* Export M3U8 Button */}
                    <button
                      type="button"
                      onClick={() => handleExportPlaylistM3U(playlist)}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all text-xs flex items-center space-x-1"
                      title="Download M3U8 Stream Playlist"
                    >
                      <Music className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] font-mono font-bold">M3U</span>
                    </button>

                    {/* Copy Web JSON */}
                    <button
                      type="button"
                      onClick={() => handleCopyPlaylistJSON(playlist)}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/10 transition-all"
                      title="Copy Web JSON to Clipboard"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE PLAYLIST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0c1220] border border-purple-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-5">
              <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <ListMusic className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg font-black text-white">Create Private Playlist</h3>
                <p className="text-xs text-slate-400">Strictly hidden from normal public users</p>
              </div>
            </div>

            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 font-mono uppercase block mb-1">
                  Playlist Name *
                </label>
                <input 
                  type="text"
                  required
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="e.g. Anirudh Exclusive Collection"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 focus:border-purple-400 rounded-xl text-white text-xs outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 font-mono uppercase block mb-1">
                  Description (Optional)
                </label>
                <textarea 
                  rows={2}
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  placeholder="Notes or description about this private playlist..."
                  className="w-full px-3.5 py-2 bg-black/40 border border-white/10 focus:border-purple-400 rounded-xl text-white text-xs outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 font-mono uppercase block mb-1">
                  Custom Cover Artwork URL (Optional)
                </label>
                <input 
                  type="text"
                  value={newPlaylistImage}
                  onChange={(e) => setNewPlaylistImage(e.target.value)}
                  placeholder="https://res.cloudinary.com/... or leave blank for auto"
                  className="w-full px-3.5 py-2 bg-black/40 border border-white/10 focus:border-purple-400 rounded-xl text-white text-xs outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/20 text-[11px] text-purple-300 flex items-start space-x-2">
                <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Privacy Rule</strong>: This playlist is saved with <code>isPrivate: true</code>. It will only be visible to you inside Admin Console and will not show on public user feeds.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newPlaylistName.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-500/25 flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>{isCreating ? "Creating..." : "Create Playlist"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT PLAYLIST MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0c1220] border border-cyan-500/30 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowImportModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-4">
              <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                <Upload className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg font-black text-white">Import Web Playlist Bundle</h3>
                <p className="text-xs text-slate-400">Load playlist file (.json) into this web app</p>
              </div>
            </div>

            {/* Quick Upload Button */}
            <div 
              onClick={() => fileImportInputRef.current?.click()}
              className="p-5 border-2 border-dashed border-cyan-500/30 hover:border-cyan-400 rounded-2xl text-center bg-cyan-500/5 cursor-pointer transition-all group mb-4"
            >
              <FileJson className="w-8 h-8 text-cyan-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-200">
                Click to Choose .JSON Playlist File
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Automatically extracts all songs, matches with library, and creates private playlist
              </p>
            </div>

            <div className="relative mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-400 font-mono uppercase">
                  Or Paste Playlist JSON Here:
                </label>
              </div>
              <textarea 
                rows={6}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder='{"playlist": {"name": "Hits"}, "songs": [...]}'
                className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-cyan-400 rounded-xl text-white text-xs outline-none font-mono"
              />
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isImporting || !importJsonText.trim()}
                onClick={() => handleImportPlaylistBundle(importJsonText)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/25 flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>{isImporting ? "Importing..." : "Import into App"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE TRACKS IN ACTIVE PLAYLIST MODAL */}
      {activePlaylist && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-fade-in">
          <div className="bg-[#0a0f1d] border border-purple-500/30 rounded-3xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
            {/* Modal Header */}
            <div className="p-5 md:p-6 border-b border-white/10 bg-[#0d1424] flex items-center justify-between gap-4 flex-shrink-0">
              <div className="flex items-center space-x-3.5 min-w-0">
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-black/60 border border-white/10 flex-shrink-0">
                  <img 
                    src={activePlaylist.thumbnailUrl || (activePlaylistSongs[0]?.imageUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&auto=format&fit=crop")} 
                    alt={activePlaylist.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg md:text-xl font-black text-white truncate">
                      {activePlaylist.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold flex items-center space-x-1 flex-shrink-0">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Private</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {activePlaylist.description || "Curated playlist"} • {activePlaylistSongs.length} Songs • {formatTotalDuration(activePlaylist.songIds)}
                  </p>
                </div>
              </div>

              {/* Action Buttons in Modal Header */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleExportPlaylistJSON(activePlaylist)}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all flex items-center space-x-1.5"
                  title="Download Playlist JSON Web Bundle"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportPlaylistM3U(activePlaylist)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all flex items-center space-x-1.5"
                  title="Download M3U8 Playlist"
                >
                  <Music className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export M3U8</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddSongsDrawer(!showAddSongsDrawer)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border ${
                    showAddSongsDrawer 
                      ? "bg-purple-600 text-white border-purple-500" 
                      : "bg-white/10 hover:bg-white/15 text-slate-200 border-white/10"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddSongsDrawer ? "Hide Songs Picker" : "Add Songs"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePlaylist(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Split view or List */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Left Column: Tracks inside playlist */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2.5">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-mono uppercase font-bold text-slate-400">
                    Playlist Tracks ({activePlaylistSongs.length})
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Click Listen to preview • Remove anytime
                  </span>
                </div>

                {activePlaylistSongs.length === 0 ? (
                  <div className="py-16 text-center bg-white/2 border border-white/5 rounded-2xl p-6">
                    <Music className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-300">Playlist is empty</p>
                    <p className="text-xs text-slate-500 mt-1 mb-4">
                      Click "+ Add Songs" to select tracks from your library, or upload songs directly into this playlist!
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAddSongsDrawer(true)}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold inline-flex items-center space-x-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Choose Songs to Add</span>
                    </button>
                  </div>
                ) : (
                  activePlaylistSongs.map((song, idx) => (
                    <div 
                      key={song.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-black/40 text-purple-300 font-mono text-xs flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>

                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/60 flex-shrink-0">
                          <img 
                            src={song.imageUrl} 
                            alt={song.title} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate" title={song.title}>
                            {song.title}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {song.artist} {song.album ? `• ${song.album}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="text-[11px] font-mono text-slate-400">
                          {formatTime(song.duration)}
                        </span>

                        {/* Listen preview button */}
                        <button
                          type="button"
                          onClick={() => handleTogglePlay(song.audioUrl)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 transition-all"
                          title="Preview Track"
                        >
                          {playingAudioUrl === song.audioUrl ? (
                            <Pause className="w-3.5 h-3.5 text-cyan-400" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Remove from playlist button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveSongFromActivePlaylist(song.id)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                          title="Remove from Playlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Right Column / Drawer: Add Songs from Library */}
              {showAddSongsDrawer && (
                <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-white/10 bg-[#080d19] p-4 md:p-6 flex flex-col flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-mono uppercase font-bold text-purple-300">
                      Add Songs from Library
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {availableSongsToAdd.length} Available
                    </span>
                  </div>

                  {/* Search songs */}
                  <div className="relative mb-3">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type="text"
                      value={songSearchQuery}
                      onChange={(e) => setSongSearchQuery(e.target.value)}
                      placeholder="Search songs to add..."
                      className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:border-purple-400 outline-none"
                    />
                  </div>

                  {/* Available Songs List */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {availableSongsToAdd.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-8">
                        {songs.length === 0 ? "No songs in library yet." : "All matching songs are already in this playlist!"}
                      </p>
                    ) : (
                      availableSongsToAdd.slice(0, 30).map((s) => (
                        <div 
                          key={s.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-black/60 flex-shrink-0">
                              <img 
                                src={s.imageUrl} 
                                alt={s.title} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {s.title}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {s.artist}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddSongToActivePlaylist(s.id)}
                            className="p-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white transition-all text-xs flex-shrink-0"
                            title="Add to Playlist"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
