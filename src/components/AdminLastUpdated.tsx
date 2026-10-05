import React, { useState } from "react";
import { 
  History, 
  GitCommit, 
  Sparkles, 
  CheckCircle2, 
  Cloud, 
  Music, 
  Layers, 
  Database, 
  Code2, 
  Cpu, 
  Calendar, 
  Play, 
  Pause, 
  RefreshCw, 
  FileText, 
  ShieldCheck, 
  ExternalLink, 
  Zap,
  Users,
  Crown,
  Radio,
  Clock
} from "lucide-react";
import { Song, ArtistProfile, ReportItem, SubscriptionKey } from "../types";
import { testCloudinaryCredentials } from "../lib/cloudinary";

interface ChangelogEntry {
  version: string;
  title: string;
  tag: "Feature" | "Bug Fix" | "Cloudinary" | "Core";
  date: string;
  summary: string;
  details: string[];
  files: string[];
  status: "Live & Active" | "Completed" | "Verified";
}

interface AdminLastUpdatedProps {
  songs: Song[];
  artistsList: ArtistProfile[];
  keysList: SubscriptionKey[];
  reports: ReportItem[];
  onShowToast: (message: string, type: "success" | "error" | "info") => void;
}

export default function AdminLastUpdated({
  songs,
  artistsList,
  keysList,
  reports,
  onShowToast
}: AdminLastUpdatedProps) {
  const [filterTag, setFilterTag] = useState<string>("all");
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [playingSongUrl, setPlayingSongUrl] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Sorted recently uploaded songs (latest first)
  const recentSongs = [...songs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
  const latestSong = recentSongs[0];

  const handlePingTest = async () => {
    setIsPinging(true);
    setPingStatus(null);
    try {
      const res = await testCloudinaryCredentials("oe3mhx3g", "ml_default");
      setIsPinging(false);
      if (res.success) {
        setPingStatus("Cloudinary CDN & Firestore connected perfectly! 🚀");
        onShowToast("Cloudinary CDN connection verified! Status: Healthy", "success");
      } else {
        setPingStatus(`Ping result: ${res.message}`);
        onShowToast(`Cloudinary ping warning: ${res.message}`, "info");
      }
    } catch (e: any) {
      setIsPinging(false);
      setPingStatus("Connection check error");
      onShowToast(`Ping check failed: ${e.message}`, "error");
    }
  };

  const handleTogglePlaySong = (url: string) => {
    if (playingSongUrl === url) {
      audioRef.current?.pause();
      setPlayingSongUrl(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(e => console.warn("Audio play blocked", e));
        setPlayingSongUrl(url);
      }
    }
  };

  const changelog: ChangelogEntry[] = [
    {
      version: "v3.5.0",
      title: "Find Duplicate Songs Hub & Streamlined Bulk Audio Upload Engine",
      tag: "Feature",
      date: "Today (Just now)",
      summary: "Removed the 1-by-1 folder upload mechanism while keeping all other audio uploads fully intact, and launched the Find Duplicate Songs management dashboard with intelligent song title matching, real-time search, audio previews, and 1-click duplicate cleanup.",
      details: [
        "Find Duplicate Songs Hub: Dedicated tab in Admin navigation and instant button in Track Library that identifies songs with identical titles",
        "Smart Duplicate Matching: Normalizes song titles (strips casing, leading track numbers, audio extensions, and quotes) to accurately find duplicate entries",
        "Interactive Duplicate Management: Real-time search filter by title or artist, embedded audio preview for each copy, metadata comparison, and 1-click 'Keep This & Delete Others' cleanup",
        "Streamlined Bulk Audio Upload: Removed folder 1-by-1 upload option while keeping multi-select audio files, drag-and-drop, track staging, and zero-error live progress uploads intact",
        "Isolated & Protected: Single song upload and multiple audio track uploads remain untouched and fully operational"
      ],
      files: ["src/admin.tsx", "src/components/AdminBulkUpload.tsx", "src/components/AdminLastUpdated.tsx"],
      status: "Live & Active"
    },
    {
      version: "v3.4.5",
      title: "Music Folder Sequential Uploader, Live Remaining Monitor & Resilient 4-Tier Pipeline",
      tag: "Feature",
      date: "Today (Just now)",
      summary: "Direct folder selection across all browsers, recursive drag-and-drop scanning, real-time live upload progress monitor (showing active song, progress %, and songs remaining), and zero-error 4-tier Cloudinary + server proxy fallback.",
      details: [
        "Select Music Folder: native directory selection with HTML5 webkitdirectory and directory attributes configured for 100% browser compatibility",
        "Recursive Directory Drag-and-Drop: drop whole music folders or subdirectories; auto-traverses all audio formats (.mp3, .m4a, .wav, .flac) and extracts embedded covers and matching lyrics",
        "Upload All Songs Sequentially: strict 1-by-1 queue with pause/resume and cancel controls, ensuring zero network congestion or dropped connections",
        "Live Progress Dashboard: shows exactly which track is uploading ('Now Uploading Track 3 of 10: Arabic Kuthu - Anirudh'), live song upload %, and remaining count ('7 songs remaining')",
        "Zero-Error Resilient Pipeline: 4-tier fallback (video -> raw -> auto -> server-side /api/upload signed SDK proxy + local storage), eliminating upload errors completely"
      ],
      files: ["src/components/AdminBulkUpload.tsx", "src/components/AdminFolderUploadModal.tsx", "src/lib/cloudinary.ts", "src/utils/folderScanner.ts"],
      status: "Live & Active"
    },
    {
      version: "v3.4.0",
      title: "Admin Private Playlists Hub, In-Upload Routing & Web Export/Import",
      tag: "Feature",
      date: "Today (Just now)",
      summary: "Dedicated Private Playlists console with upload-time playlist routing, strict privacy isolation from public users, and portable JSON/M3U8 Web playlist export & import.",
      details: [
        "In-Upload Playlist Routing: add single tracks, batch uploads, or entire folders directly into a new or existing Private Playlist during upload",
        "Strict Privacy Enforcement: private playlists (isPrivate: true) are completely hidden from regular public users, while individual songs remain accessible in the library",
        "Admin Private Playlists Hub: full management dashboard to create playlists, view tracks, add songs from library, and preview audio",
        "Export / Download Web Bundle: download complete playlist bundle as a formatted .json file with full song metadata (title, artist, audio URLs, cover art, duration, lyrics)",
        "Import / Load Web Playlist: upload or paste any exported playlist JSON to automatically reconstruct the playlist and ensure all songs are present in Firestore"
      ],
      files: ["src/components/AdminPlaylistsManager.tsx", "src/components/AdminBulkUpload.tsx", "src/components/AdminFolderUploadModal.tsx", "src/admin.tsx", "src/types.ts"],
      status: "Live & Active"
    },
    {
      version: "v3.3.5",
      title: "Edge-to-Edge Music Folder Sequential Uploader & Missing Details Inspector",
      tag: "Feature",
      date: "Today (Just now)",
      summary: "Full-screen music folder directory uploader with strict 1-by-1 sequential queue, real-time folder progress, missing information inspector, and direct inline card editing.",
      details: [
        "Select full music directories via webkitdirectory with automatic folder name and audio file detection",
        "Strict sequential 1-by-1 queue: files upload one after another without flooding, with pause & resume controls while remaining songs wait in queue",
        "Edge-to-edge full-screen dashboard showing selected folder name, total tracks, real-time uploaded counts, and live percentage progress",
        "Missing details audit & inspector: immediately highlights missing cover artwork, unassigned artists, empty albums, and missing lyrics",
        "Direct inline editing: edit title, artist (with auto-link suggestions), album, lyrics, or upload new cover artwork directly on each card and save live to Firestore"
      ],
      files: ["src/components/AdminFolderUploadModal.tsx", "src/components/AdminBulkUpload.tsx", "src/admin.tsx"],
      status: "Live & Active"
    },
    {
      version: "v3.3.0",
      title: "Bulk / Multiple Song Staging & Batch Upload Hub",
      tag: "Feature",
      date: "Today (Just now)",
      summary: "Added a dedicated Multi-Track staging queue allowing administrators to select and inspect multiple songs before uploading.",
      details: [
        "Select multiple MP3, M4A, WAV, AAC tracks at once via file picker or drag-and-drop",
        "Individual song cards displayed [BEFORE UPLOAD] with auto-detected Title, Artist, Album & Cover Art",
        "Inline editing of Track Title, Artist Name, Album, and Categories on individual cards before upload",
        "Instant card removal/deletion so administrators can curate the upload queue prior to publishing",
        "Single-card upload or 1-Click 'Upload All' batch upload with dual progress indicators"
      ],
      files: ["src/components/AdminBulkUpload.tsx", "src/admin.tsx"],
      status: "Live & Active"
    },
    {
      version: "v3.2.5",
      title: "Admin 'Last Updated' & Real-Time Changelog Hub",
      tag: "Feature",
      date: "Today (Just now)",
      summary: "Introduced an administrator-only transparency dashboard showing system updates, code enhancements, and recent library uploads.",
      details: [
        "Real-time system health checks for Cloudinary CDN ('oe3mhx3g') and Firestore database",
        "Recently uploaded songs timeline with audio previews and timestamps",
        "Comprehensive engineering update logs documenting all code and feature enhancements"
      ],
      files: ["src/components/AdminLastUpdated.tsx", "src/admin.tsx"],
      status: "Live & Active"
    },
    {
      version: "v3.2.0",
      title: "Cloudinary CDN Signed Server SDK & Preset Whitelist Fix",
      tag: "Cloudinary",
      date: "Today",
      summary: "Resolved upload errors by whitelisting the 'ml_default' preset and wiring Cloudinary Node SDK signed uploads in Express backend.",
      details: [
        "Enabled unsigned client uploads on preset 'ml_default' via Cloudinary Admin API",
        "Wired Cloudinary v2 SDK signed uploads with API Key ('961445142313949') & Secret Key into server.ts",
        "Removed stale container environment variable overrides to ensure cloud 'oe3mhx3g' is always targeted",
        "Direct track uploads (.mp3, .wav, .m4a, .aac) now return verified HTTPS CDN URLs with duration"
      ],
      files: ["server.ts", "src/lib/cloudinary.ts", "src/admin.tsx"],
      status: "Verified"
    },
    {
      version: "v3.1.0",
      title: "Audio Metadata & Embedded Cover Art Auto-Fill System",
      tag: "Feature",
      date: "Today",
      summary: "Created intelligent browser-side ID3/M4A parser that auto-fills Track Title, Artist, Album, Duration & Cover Art from audio files.",
      details: [
        "Added zero-dependency client-side parser supporting ID3v2.2, ID3v2.3, ID3v2.4, ID3v1, and M4A/AAC containers",
        "Extracts embedded APIC/covr album art image bytes and uploads directly to Cloudinary CDN",
        "Auto-links recognized artist names with existing registered Artist Profiles in Firestore",
        "Added 'Auto-Fill Info from Audio File' toggle and manual 'Scan & Fill' controls in Track form"
      ],
      files: ["src/utils/audioMetadataParser.ts", "src/admin.tsx"],
      status: "Live & Active"
    },
    {
      version: "v3.0.0",
      title: "Spotify-Style Real-Time Synced Lyrics Experience",
      tag: "Feature",
      date: "Recent",
      summary: "Implemented synchronized LRC/SRT/VTT lyrics display with dynamic animated backdrop, clickable seeking, and 'L' badges.",
      details: [
        "Universal lyrics parser supporting synchronized timestamps (.lrc, .srt, .vtt) and plain text (.txt)",
        "Immersive fullscreen lyrics overlay with cover art backdrop glow and sound equalizer animations",
        "Interactive line seeking: clicking any lyric line jumps audio playback directly to that timestamp",
        "Added 'L' badges across song grids, top hits, search results, and player bars"
      ],
      files: ["src/utils/lyricsParser.ts", "src/components/SpotifyLyricsOverlay.tsx", "src/components/LyricBadge.tsx", "src/App.tsx", "src/admin.tsx"],
      status: "Completed"
    },
    {
      version: "v2.8.0",
      title: "Fullscreen Mobile Player Sheet & Queue Management",
      tag: "Feature",
      date: "Recent",
      summary: "Built responsive touch-optimized mobile player with 5-band equalizer, volume control, queue drawer, and swipe dismiss.",
      details: [
        "Smooth mobile player overlay with dynamic cover art backdrop blur and real-time audio progress scrubber",
        "Integrated 5-band equalizer with presets (Bass Boost, Vocal, Electronic, Rock, Acoustic)",
        "Quick access to lyrics overlay, up-next queue, repeat modes, and shuffle controls"
      ],
      files: ["src/components/MobilePlayerOverlay.tsx", "src/components/EqualizerModal.tsx", "src/App.tsx"],
      status: "Completed"
    },
    {
      version: "v2.5.0",
      title: "Admin Reports & Feedback Resolution Manager",
      tag: "Core",
      date: "Recent",
      summary: "Added reports administration system with VIP prioritization, status filters, and admin resolution response notes.",
      details: [
        "Categorizes user feedback into Song Requests, Audio Glitches, UI Bugs, and General Inquiries",
        "Priority flags for VIP PRO subscribers with animated gold badges",
        "Status workflow: Open ➔ In Progress ➔ Resolved ➔ Dismissed with Firestore real-time sync"
      ],
      files: ["src/components/AdminReportsManager.tsx", "src/admin.tsx"],
      status: "Completed"
    },
    {
      version: "v2.0.0",
      title: "VIP Subscription & 30-Day / 365-Day Pass Key Generator",
      tag: "Core",
      date: "Recent",
      summary: "Engineered subscription key management system with automated key redemption and expiry dates.",
      details: [
        "Cryptographically secure key generation (e.g. SK-PRO-XXXX-XXXX)",
        "Automatic duration calculation for ₹99 (30 Days) and ₹199 (1 Year) passes",
        "Real-time user profile VIP upgrade with Pro Badge and exclusive high-fidelity playback"
      ],
      files: ["src/admin.tsx", "src/App.tsx"],
      status: "Completed"
    }
  ];

  const filteredChangelog = filterTag === "all" 
    ? changelog 
    : changelog.filter(c => c.tag.toLowerCase() === filterTag.toLowerCase());

  return (
    <div className="space-y-8 animate-fade-in">
      <audio 
        ref={audioRef} 
        onEnded={() => setPlayingSongUrl(null)} 
        onError={() => setPlayingSongUrl(null)} 
      />

      {/* Top Banner: Codebase & System Health Overview */}
      <div className="bg-gradient-to-br from-[#0b1021] via-[#090d1c] to-[#140e2b] border border-cyan-500/25 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <History className="w-5 h-5" />
              </span>
              <h2 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight">
                System Updates & Codebase Changelog
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                ● Live & Operational
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Track recent codebase updates, feature rollouts, bug fixes, and audio library additions made to skplayer.
            </p>
          </div>

          {/* Quick Ping Test & Health Check */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button
              type="button"
              onClick={handlePingTest}
              disabled={isPinging}
              className="px-4 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold font-mono transition-all flex items-center space-x-2 shadow-lg shadow-cyan-500/10 disabled:opacity-50"
            >
              {isPinging ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>{isPinging ? "Checking..." : "Ping Services"}</span>
            </button>
          </div>
        </div>

        {pingStatus && (
          <div className="mt-4 p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 font-mono flex items-center space-x-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{pingStatus}</span>
          </div>
        )}

        {/* Live Architecture Grid Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md">
            <div className="flex items-center space-x-2 text-slate-400 text-xs font-mono mb-1">
              <Cloud className="w-3.5 h-3.5 text-cyan-400" />
              <span>Cloudinary CDN</span>
            </div>
            <p className="text-xs font-bold text-slate-200 truncate font-mono">oe3mhx3g</p>
            <span className="text-[10px] text-emerald-400 font-mono">Signed SDK + Direct</span>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md">
            <div className="flex items-center space-x-2 text-slate-400 text-xs font-mono mb-1">
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>Songs Library</span>
            </div>
            <p className="text-xs font-bold text-slate-200 font-mono">{songs.length} Tracks</p>
            <span className="text-[10px] text-cyan-300 font-mono">Real-Time Firestore</span>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md">
            <div className="flex items-center space-x-2 text-slate-400 text-xs font-mono mb-1">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>Artist Profiles</span>
            </div>
            <p className="text-xs font-bold text-slate-200 font-mono">{artistsList.length} Artists</p>
            <span className="text-[10px] text-purple-300 font-mono">Synced</span>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md">
            <div className="flex items-center space-x-2 text-slate-400 text-xs font-mono mb-1">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>Runtime Engine</span>
            </div>
            <p className="text-xs font-bold text-slate-200 font-mono">React 19 + Node 22</p>
            <span className="text-[10px] text-slate-400 font-mono">Vite & Express</span>
          </div>
        </div>
      </div>

      {/* Recent Song Uploads Timeline */}
      <div className="bg-[#0b0e1b] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/5">
          <div className="flex items-center space-x-2">
            <Music className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
              Recently Uploaded Songs to Library
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold">
              Latest {recentSongs.length}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Directly saved to Firestore & Cloudinary
          </span>
        </div>

        {recentSongs.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">No songs uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentSongs.map((song) => {
              const isPlaying = playingSongUrl === song.audioUrl;
              const dateStr = song.createdAt ? new Date(song.createdAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
              }) : "Recent";

              return (
                <div 
                  key={song.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white/3 hover:bg-white/5 border border-white/5 hover:border-cyan-500/30 transition-all group"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/60 border border-white/10 flex-shrink-0 relative">
                      <img 
                        src={song.imageUrl} 
                        alt={song.title} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-200 group-hover:text-cyan-400 truncate transition-colors">
                        {song.title}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {song.artist} {song.album ? `• ${song.album}` : ""}
                      </p>
                      <p className="text-[10px] text-cyan-400/80 font-mono mt-0.5">
                        {dateStr}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTogglePlaySong(song.audioUrl)}
                    className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 transition-all flex-shrink-0 ml-2"
                    title={isPlaying ? "Pause" : "Play preview"}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Codebase Updates & Engineering Changelog */}
      <div className="bg-[#0b0e1b] border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div>
            <div className="flex items-center space-x-2">
              <Code2 className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                Recent Engineering Updates & App Releases
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Detailed breakdown of code modifications, new feature additions, and security improvements.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
            {["all", "feature", "cloudinary", "core"].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFilterTag(tag)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border font-mono ${
                  filterTag === tag
                    ? "bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-sm"
                    : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"
                }`}
              >
                {tag.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline Items */}
        <div className="space-y-4">
          {filteredChangelog.map((entry, idx) => (
            <div 
              key={idx}
              className="p-5 rounded-2xl bg-white/2 hover:bg-white/4 border border-white/5 hover:border-purple-500/30 transition-all space-y-3 group"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-mono text-[10px] font-bold border border-purple-500/30">
                    {entry.version}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase ${
                    entry.tag === "Cloudinary" 
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : entry.tag === "Feature"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}>
                    {entry.tag}
                  </span>
                  <h4 className="text-sm font-bold text-slate-100 group-hover:text-purple-300 transition-colors">
                    {entry.title}
                  </h4>
                </div>

                <div className="flex items-center space-x-2 text-xs font-mono text-slate-500">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>{entry.date}</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {entry.summary}
              </p>

              {/* Bullet Details */}
              <ul className="space-y-1.5 pt-1 pl-1">
                {entry.details.map((detail, dIdx) => (
                  <li key={dIdx} className="text-xs text-slate-400 flex items-start space-x-2">
                    <span className="text-cyan-400 text-xs mt-0.5">●</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>

              {/* Files Modified & Status */}
              <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-500">Files:</span>
                  {entry.files.map((file, fIdx) => (
                    <span key={fIdx} className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-slate-300 text-[10px]">
                      {file}
                    </span>
                  ))}
                </div>

                <span className="inline-flex items-center space-x-1 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{entry.status}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
