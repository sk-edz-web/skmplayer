import React, { StrictMode, useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { 
  db, 
  auth, 
  OperationType, 
  handleFirestoreError 
} from "./firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  updateDoc,
  setDoc,
  onSnapshot,
  writeBatch
} from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { 
  Music, 
  Image as ImageIcon, 
  UploadCloud, 
  Trash2, 
  Play, 
  Pause, 
  ArrowLeft, 
  Disc, 
  FileAudio, 
  Sparkles, 
  Plus, 
  CheckCircle2, 
  Loader2,
  Edit,
  Crown,
  Key,
  RefreshCw,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  AlertCircle,
  MoreVertical,
  MoreHorizontal,
  AlertTriangle,
  Check,
  Search,
  MessageSquare,
  Send,
  Clock,
  User as UserIcon,
  CheckCheck,
  Filter,
  Bell,
  ExternalLink,
  X,
  Radio,
  Layers,
  FileText,
  HelpCircle,
  Activity,
  Flame,
  CornerDownRight,
  ChevronRight,
  Copy,
  Zap,
  Users,
  UserCheck,
  AlignLeft,
  Cloud,
  History,
  Folder,
  ListMusic
} from "lucide-react";
import { Song, Playlist, ReportItem, ReportStatus, AppNotification, SubscriptionKey, ArtistProfile } from "./types";
import AdminReportsManager from "./components/AdminReportsManager";
import AdminArtistsManager from "./components/AdminArtistsManager";
import AdminCloudinaryManager from "./components/AdminCloudinaryManager";
import AdminBulkUpload from "./components/AdminBulkUpload";
import AdminLastUpdated from "./components/AdminLastUpdated";
import AdminPlaylistsManager from "./components/AdminPlaylistsManager";
import { uploadToCloudinaryDirect } from "./lib/cloudinary";
import { parseLyrics, hasLyrics, fetchLyricsFromUrl } from "./utils/lyricsParser";
import { extractAudioFileMetadata, ExtractedAudioMetadata } from "./utils/audioMetadataParser";
import LyricBadge from "./components/LyricBadge";
import "./index.css";

function AdminApp() {
  // Admin Authentication Gate State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<"songs" | "batch" | "duplicates" | "playlists" | "artists" | "keys" | "cloudinary" | "reports" | "updates">("songs");
  // Find Duplicate Songs State
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState<boolean>(false);
  const [duplicateSearchTerm, setDuplicateSearchTerm] = useState<string>("");

  // Admin Playlists State
  const [adminPlaylists, setAdminPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState<boolean>(true);

  // Artist Profiles State
  const [artistsList, setArtistsList] = useState<ArtistProfile[]>([]);
  const [loadingArtists, setLoadingArtists] = useState<boolean>(true);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedArtistImage, setSelectedArtistImage] = useState<string | null>(null);
  const [showArtistDropdown, setShowArtistDropdown] = useState<boolean>(false);
  const [artistFilterQuery, setArtistFilterQuery] = useState<string>("");

  // Reports Management State
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState<boolean>(true);
  const [isUpdatingReport, setIsUpdatingReport] = useState<boolean>(false);
  const [isDeletingReportId, setIsDeletingReportId] = useState<string | null>(null);
  const [adminToast, setAdminToast] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);

  // VIP Key Management State
  const [keysList, setKeysList] = useState<SubscriptionKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<99 | 199>(99);
  const [customKeyNote, setCustomKeyNote] = useState<string>("");
  const [keySearchTerm, setKeySearchTerm] = useState<string>("");
  const [keyFilterPlan, setKeyFilterPlan] = useState<"all" | "99" | "199">("all");
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Songs List State
  const [songs, setSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(true);

  // Form State
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [imageStatus, setImageStatus] = useState<"unchecked" | "available" | "unavailable">("unchecked");
  // Lyrics Form State
  const [lyrics, setLyrics] = useState("");
  const [lyricsUrl, setLyricsUrl] = useState("");
  const [isFetchingLyricsUrl, setIsFetchingLyricsUrl] = useState(false);
  const [lyricsPreviewModalSong, setLyricsPreviewModalSong] = useState<Song | null>(null);

  // Audio Metadata Auto-Fill State (Auto-extracts Artist, Title, Album, Duration, Cover Art from file)
  const [autoFillMetadata, setAutoFillMetadata] = useState<boolean>(() => {
    try {
      return localStorage.getItem("admin_autofill_audio_metadata") !== "false";
    } catch {
      return true;
    }
  });
  const [isExtractingMetadata, setIsExtractingMetadata] = useState<boolean>(false);
  const [detectedMetadata, setDetectedMetadata] = useState<ExtractedAudioMetadata | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [isUploadingExtractedCover, setIsUploadingExtractedCover] = useState<boolean>(false);

  // Add to Private Playlist Form State
  const [addToPlaylistEnabled, setAddToPlaylistEnabled] = useState<boolean>(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [newPlaylistName, setNewPlaylistName] = useState<string>("");

  // Helper to compute SHA-256 hash using native Web Crypto API (No credentials exposed)
  const computeAdminHash = async (email: string, pass: string): Promise<string> => {
    try {
      const text = `${email.trim().toLowerCase()}::${pass}::sk_edz_admin_secret_salt_2026`;
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      return "";
    }
  };

  // Check saved session token on load
  useEffect(() => {
    const verifySavedSession = async () => {
      const savedToken = sessionStorage.getItem("sk_admin_token");
      if (!savedToken) {
        setIsCheckingAuth(false);
        return;
      }

      // Check if it's a client-issued signed session
      if (savedToken.startsWith("sk_adm_client_")) {
        try {
          const parts = savedToken.split("_");
          const timestamp = parseInt(parts[3], 10);
          if (timestamp && Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) {
            setIsAdminAuthenticated(true);
            setIsCheckingAuth(false);
            return;
          }
        } catch {
          // fall through
        }
      }

      try {
        const response = await fetch("/api/admin/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: savedToken })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.valid) {
            setIsAdminAuthenticated(true);
            setIsCheckingAuth(false);
            return;
          }
        }
        // If server returned invalid or was 404, check fallback
        sessionStorage.removeItem("sk_admin_token");
        setIsAdminAuthenticated(false);
      } catch (err) {
        // Fallback for static environments without server API
        if (savedToken.startsWith("sk_adm_")) {
          setIsAdminAuthenticated(true);
        } else {
          sessionStorage.removeItem("sk_admin_token");
          setIsAdminAuthenticated(false);
        }
      } finally {
        setIsCheckingAuth(false);
      }
    };
    verifySavedSession();
  }, []);

  // Handle Admin Login submission with hybrid resilience (Serverless API + Cryptographic Hash Fallback)
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const cleanEmail = loginEmail.trim().toLowerCase();
    const cleanPass = loginPassword.trim();

    if (!cleanEmail || !cleanPass) {
      setAuthError("Please enter both administrator email and password.");
      return;
    }

    setIsLoggingIn(true);
    let serverLoginSucceeded = false;

    // 1. First attempt Server / Vercel Serverless API authentication
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPass
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.token) {
          sessionStorage.setItem("sk_admin_token", data.token);
          setIsAdminAuthenticated(true);
          setAuthError("");
          setLoginPassword("");
          serverLoginSucceeded = true;
          // Sign in to Firebase Auth in background if possible
          signInWithEmailAndPassword(auth, cleanEmail, cleanPass).catch(() => {});
          setIsLoggingIn(false);
          return;
        }
      } else if (response.status === 401) {
        // Explicit 401 from server: wrong credentials
        const data = await response.json().catch(() => ({}));
        setAuthError(data.message || "Access Denied: Invalid administrator credentials.");
        setIsLoggingIn(false);
        return;
      }
    } catch (err) {
      // Backend route unreachable (e.g. deployed as static SPA on Vercel without serverless)
      console.warn("Backend API unreachable, using secure client-side cryptographic verification:", err);
    }

    // 2. Cryptographic SHA-256 Hash Verification Fallback
    // Verified securely via SHA-256 hash - neither email nor password is visible in plaintext
    const expectedHash = "68a9607e63390b16ceac905372a0c2e2acf1b672bc247f62aedf5c7d89584062";
    const computedHash = await computeAdminHash(cleanEmail, cleanPass);

    if (computedHash === expectedHash) {
      const clientToken = `sk_adm_client_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      sessionStorage.setItem("sk_admin_token", clientToken);
      setIsAdminAuthenticated(true);
      setAuthError("");
      setLoginPassword("");
      // Background Firebase Auth login
      signInWithEmailAndPassword(auth, cleanEmail, cleanPass).catch(() => {});
    } else {
      setAuthError("Access Denied: Invalid credentials or unauthorized administrator account.");
    }

    setIsLoggingIn(false);
  };

  // Handle Admin Logout
  const handleAdminLogout = () => {
    sessionStorage.removeItem("sk_admin_token");
    setIsAdminAuthenticated(false);
    setLoginPassword("");
    setAuthError("");
  };

  // Automatic background image validation check
  useEffect(() => {
    if (!imageUrl) {
      setImageStatus("unchecked");
      return;
    }
    const img = new Image();
    img.onload = () => setImageStatus("available");
    img.onerror = () => setImageStatus("unavailable");
    img.src = imageUrl;
  }, [imageUrl]);

  // Edit Mode State
  const [editingSongId, setEditingSongId] = useState<string | null>(null);

  // Search & Filter States
  const [trackSearchTerm, setTrackSearchTerm] = useState<string>("");
  const [trackFilterCategory, setTrackFilterCategory] = useState<string>("all");
  const [autoFillSearchTerm, setAutoFillSearchTerm] = useState<string>("");
  const [showAutoFillDropdown, setShowAutoFillDropdown] = useState<boolean>(false);

  // Dynamic Categories State
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesObj, setCategoriesObj] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  // Debounced auto-duration detection for pasted URL links
  useEffect(() => {
    if (!audioUrl || !audioUrl.startsWith("http")) return;

    const timer = setTimeout(() => {
      setStatusMessage("Attempting to auto-fetch audio duration from URL...");
      const tempAudio = new Audio(audioUrl);
      
      const handleMetadata = () => {
        setDuration(Math.round(tempAudio.duration));
        setStatusMessage("Audio duration fetched successfully!");
        tempAudio.removeEventListener("loadedmetadata", handleMetadata);
      };
      
      const handleError = () => {
        console.warn("Could not load metadata from URL directly.");
        tempAudio.removeEventListener("error", handleError);
      };

      tempAudio.addEventListener("loadedmetadata", handleMetadata);
      tempAudio.addEventListener("error", handleError);
      tempAudio.load();
    }, 1200);

    return () => clearTimeout(timer);
  }, [audioUrl]);

  const startEditSong = (song: Song) => {
    setEditingSongId(song.id);
    setTitle(song.title);
    setArtist(song.artist);
    setAlbum(song.album || "");
    setAudioUrl(song.audioUrl);
    setImageUrl(song.imageUrl);
    setDuration(song.duration);
    setSelectedCategories(song.categories || []);
    setLyrics(song.lyrics || "");
    setLyricsUrl(song.lyricsUrl || "");
    setStatusMessage(`Editing track: "${song.title}"`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingSongId(null);
    setTitle("");
    setArtist("");
    setAlbum("");
    setAudioUrl("");
    setImageUrl("");
    setDuration(0);
    setSelectedCategories([]);
    setLyrics("");
    setLyricsUrl("");
    setUploadProgress({});
    setStatusMessage("Edit cancelled.");
  };

  // Real-time synchronization of Categories from Firestore (with seed)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "categories"), async (snapshot) => {
      const catList: string[] = [];
      const catObjList: { id: string; name: string }[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        catList.push(data.name);
        catObjList.push({ id: doc.id, name: data.name });
      });
      
      if (catList.length === 0) {
        // Seed default 5 popular categories requested by user
        const defaults = ["K-Pop", "Hip-Hop", "Melody", "Tamil", "Lo-Fi"];
        for (const cat of defaults) {
          try {
            await setDoc(doc(db, "categories", cat.toLowerCase().replace(/\s+/g, "-")), {
              name: cat,
              createdAt: Date.now()
            });
          } catch (e) {
            console.error("Failed to seed category:", cat, e);
          }
        }
      } else {
        setCategories(catList);
        setCategoriesObj(catObjList);
      }
    }, (error) => {
      console.error("Categories subscription failed:", error);
    });

    return () => unsubscribe();
  }, []);

  // Handler to add a new category to Firestore
  const handleAddCategory = async (e: React.MouseEvent) => {
    e.preventDefault();
    const catName = newCategoryName.trim();
    if (!catName) return;
    
    setIsAddingCategory(true);
    try {
      const catId = catName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      await setDoc(doc(db, "categories", catId), {
        name: catName,
        createdAt: Date.now()
      });
      setNewCategoryName("");
      setStatusMessage(`Category "${catName}" added successfully! 🎉`);
    } catch (err) {
      console.error("Failed to add category:", err);
      setStatusMessage("Failed to add category.");
    } finally {
      setIsAddingCategory(false);
    }
  };

  // Handler to delete a category from Firestore
  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (!window.confirm(`Are you sure you want to delete the category "${catName}"?`)) return;
    try {
      await deleteDoc(doc(db, "categories", catId));
      setStatusMessage(`Category "${catName}" deleted successfully!`);
    } catch (err) {
      console.error("Failed to delete category:", err);
      setStatusMessage("Failed to delete category.");
    }
  };

  // Handler to start editing a category
  const startEditingCategory = (catId: string, currentName: string) => {
    setEditingCategoryId(catId);
    setEditingCategoryName(currentName);
  };

  // Handler to save an edited category
  const handleSaveCategoryEdit = async (catId: string) => {
    const trimmedName = editingCategoryName.trim();
    if (!trimmedName) return;
    try {
      await updateDoc(doc(db, "categories", catId), {
        name: trimmedName
      });
      setEditingCategoryId(null);
      setEditingCategoryName("");
      setStatusMessage(`Category renamed to "${trimmedName}"!`);
    } catch (err) {
      console.error("Failed to update category:", err);
      setStatusMessage("Failed to update category.");
    }
  };

  // Helper to toggle multi-selection of categories for a song
  const toggleCategorySelection = (catName: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(catName)) {
        return prev.filter((c) => c !== catName);
      } else {
        return [...prev, catName];
      }
    });
  };

  // Upload Status
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audio Preview State
  const [previewSongId, setPreviewSongId] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // ImgBB / Local Storage Details
  const IMGBB_KEY = "7a39d89ccdbcf9a749363143c7b6009f";

  // Load songs from Firestore on startup
  const fetchSongs = async () => {
    setLoadingSongs(true);
    try {
      const q = query(collection(db, "songs"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const songList: Song[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        songList.push({
          id: doc.id,
          title: data.title || "Untitled",
          artist: data.artist || "Unknown Artist",
          album: data.album || "",
          audioUrl: data.audioUrl || "",
          imageUrl: data.imageUrl || "",
          duration: data.duration || 0,
          createdAt: data.createdAt || Date.now(),
          uploadedBy: data.uploadedBy || "",
          categories: data.categories || [],
          lyrics: data.lyrics || "",
          lyricsUrl: data.lyricsUrl || ""
        });
      });
      setSongs(songList);
    } catch (err) {
      console.error("Failed to load songs:", err);
      // Fail gracefully or show notification
    } finally {
      setLoadingSongs(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  // Set up preview audio event listeners
  useEffect(() => {
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio();
    }

    const audio = previewAudioRef.current;

    const handleEnded = () => {
      setIsPlayingPreview(false);
      setPreviewSongId(null);
    };

    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
    };
  }, []);

  // Handle preview playing
  const togglePreview = (song: Song) => {
    if (!previewAudioRef.current) return;

    if (previewSongId === song.id) {
      if (isPlayingPreview) {
        previewAudioRef.current.pause();
        setIsPlayingPreview(false);
      } else {
        previewAudioRef.current.play().catch(err => console.log(err));
        setIsPlayingPreview(true);
      }
    } else {
      previewAudioRef.current.src = song.audioUrl;
      previewAudioRef.current.load();
      previewAudioRef.current.play()
        .then(() => {
          setPreviewSongId(song.id);
          setIsPlayingPreview(true);
        })
        .catch(err => {
          console.error("Preview play failed:", err);
          alert("Could not load preview. Please check the audio URL.");
        });
    }
  };

  // Helper to convert File to Base64
  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // High-Speed Direct Upload helper (Cloudinary CDN Direct API with Server Fallback)
  const uploadFileToServer = async (file: File, type: "audio" | "image") => {
    const key = type === "audio" ? "audio_file" : "image_file";
    setUploadProgress(prev => ({ ...prev, [key]: 5 }));
    
    try {
      // 1. Attempt High-Speed Direct Cloudinary CDN Upload First
      try {
        setStatusMessage(`Uploading ${type} directly to Cloudinary CDN...`);
        const cloudinaryRes = await uploadToCloudinaryDirect(file, (percent) => {
          setUploadProgress(prev => ({ ...prev, [key]: Math.min(99, percent) }));
        });

        setUploadProgress(prev => ({ ...prev, [key]: 100 }));
        
        if (type === "audio") {
          try {
            setStatusMessage("Auto-calculating track duration...");
            const tempAudio = new Audio(cloudinaryRes.secure_url);
            tempAudio.addEventListener("loadedmetadata", () => {
              if (tempAudio.duration && !isNaN(tempAudio.duration)) {
                setDuration(Math.round(tempAudio.duration));
                setStatusMessage("Track duration calculated!");
              }
            });
          } catch (durErr) {
            console.warn("Could not get duration automatically:", durErr);
          }
        }

        showAdminToast(`${type === "audio" ? "Song audio" : "Cover art"} uploaded to Cloudinary CDN! ☁️`, "success");
        return cloudinaryRes.secure_url;
      } catch (cloudErr: any) {
        if (cloudErr.message === "CLOUDINARY_NOT_CONFIGURED") {
          console.warn("[Upload] Cloudinary not configured yet. Attempting Express server fallback...");
          setStatusMessage("Cloudinary not configured. Falling back to server upload...");
        } else {
          console.warn("[Upload] Cloudinary direct upload failed:", cloudErr);
          setStatusMessage(`Cloudinary warning: ${cloudErr.message}. Falling back to server upload...`);
        }
      }

      // 2. Server Fallback via Express /api/upload (Cloudinary Signed Server SDK)
      setStatusMessage(`Uploading ${type} securely via Cloudinary backend...`);
      const base64 = await toBase64(file);
      setUploadProgress(prev => ({ ...prev, [key]: 45 }));
      
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file: base64,
          presetType: `admin_${type}`,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || `Server upload returned status ${response.status}`);
      }

      setUploadProgress(prev => ({ ...prev, [key]: 100 }));
      const data = await response.json();
      
      if (data.secure_url) {
        if (type === "audio") {
          if (data.duration && typeof data.duration === "number") {
            setDuration(Math.round(data.duration));
          } else {
            try {
              const tempAudio = new Audio(data.secure_url);
              tempAudio.addEventListener("loadedmetadata", () => {
                if (tempAudio.duration && !isNaN(tempAudio.duration)) {
                  setDuration(Math.round(tempAudio.duration));
                }
              });
            } catch {}
          }
        }
        showAdminToast(`${type === "audio" ? "Song audio" : "Cover art"} uploaded to Cloudinary CDN! ☁️`, "success");
        return data.secure_url;
      } else {
        throw new Error("No secure URL returned from upload server");
      }
    } catch (error: any) {
      console.error(`${type} upload error:`, error);
      const errorDetail = error instanceof Error ? error.message : "Upload failed";
      setStatusMessage(`Upload error: ${errorDetail}`);
      showAdminToast(`Upload error: ${errorDetail}`, "error");
      setUploadProgress(prev => ({ ...prev, [key]: 0 }));
      return null;
    }
  };

  // Apply extracted audio metadata to form
  const applyExtractedMetadata = async (meta: ExtractedAudioMetadata) => {
    if (meta.title) setTitle(meta.title);
    if (meta.artist) {
      setArtist(meta.artist);
      const matched = artistsList.find(
        (a) => a.name.trim().toLowerCase() === meta.artist!.trim().toLowerCase()
      );
      if (matched) {
        setSelectedArtistId(matched.id);
        setSelectedArtistImage(matched.imageUrl);
      }
    }
    if (meta.album) setAlbum(meta.album);
    if (meta.duration && meta.duration > 0) setDuration(meta.duration);
    if (meta.lyrics && !lyrics) setLyrics(meta.lyrics);

    // Handle embedded Album Art Cover extracted from audio file
    if (meta.coverFile) {
      if (meta.coverDataUrl) {
        setImageUrl(meta.coverDataUrl);
        setImageStatus("available");
      }

      try {
        setIsUploadingExtractedCover(true);
        setStatusMessage("Uploading extracted album cover art to Cloudinary CDN...");
        const coverRes = await uploadToCloudinaryDirect(meta.coverFile);
        if (coverRes && coverRes.secure_url) {
          setImageUrl(coverRes.secure_url);
          setImageStatus("available");
          showAdminToast("Album cover art auto-extracted & uploaded to Cloudinary! 🖼️", "success");
        }
      } catch (covErr) {
        console.warn("Cover art upload fallback:", covErr);
      } finally {
        setIsUploadingExtractedCover(false);
      }
    }
  };

  // Handle file picker selection with instant metadata extraction
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: "audio" | "image") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === "audio") {
      setSelectedAudioFile(file);

      // Instant Metadata Extraction (Runs in parallel with upload so UI fills immediately!)
      if (autoFillMetadata) {
        setIsExtractingMetadata(true);
        setStatusMessage("Scanning audio file for ID3 metadata, artist & album art...");

        extractAudioFileMetadata(file)
          .then(async (meta) => {
            setDetectedMetadata(meta);
            setIsExtractingMetadata(false);
            console.log("Extracted audio metadata:", meta);

            await applyExtractedMetadata(meta);

            const details: string[] = [];
            if (meta.title) details.push(`Title: "${meta.title}"`);
            if (meta.artist) details.push(`Artist: "${meta.artist}"`);
            if (meta.album) details.push(`Album: "${meta.album}"`);
            if (meta.coverFile) details.push("Cover Art extracted");

            if (details.length > 0) {
              showAdminToast(`✨ Auto-detected: ${details.join(" | ")}`, "success");
              setStatusMessage(`Auto-filled metadata from audio file: ${details.join(" • ")}`);
            }
          })
          .catch((err) => {
            setIsExtractingMetadata(false);
            console.warn("Metadata extraction warning:", err);
          });
      }
    }

    setStatusMessage(`Uploading ${type} securely via Cloudinary CDN...`);
    const uploadedUrl = await uploadFileToServer(file, type);

    if (uploadedUrl) {
      if (type === "audio") {
        setAudioUrl(uploadedUrl);
        setStatusMessage("Audio uploaded successfully!");
      } else {
        setImageUrl(uploadedUrl);
        setStatusMessage("Cover image uploaded successfully!");
        setImageStatus("available");
      }
    }
  };

  // Handle lyrics file upload (.lrc, .srt, .vtt, .txt)
  const handleLyricsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setLyrics(text);
        const parsed = parseLyrics(text);
        showAdminToast(`Loaded lyrics (${parsed.lines.length} lines, ${parsed.isSynced ? "Synced LRC" : "Plain text"})!`, "success");
        setStatusMessage(`Lyrics file "${file.name}" loaded (${parsed.lines.length} lines, ${parsed.isSynced ? "Synced LRC" : "Plain text"})`);
      }
    };
    reader.onerror = () => {
      showAdminToast("Could not read lyrics file.", "error");
    };
    reader.readAsText(file);
  };

  // Handle fetching lyrics from external URL (.lrc, .txt, .srt)
  const handleFetchLyricsFromUrl = async () => {
    if (!lyricsUrl || !lyricsUrl.trim().startsWith("http")) {
      showAdminToast("Please enter a valid HTTP/HTTPS URL first.", "error");
      return;
    }
    setIsFetchingLyricsUrl(true);
    setStatusMessage("Fetching lyrics from remote URL...");
    try {
      const text = await fetchLyricsFromUrl(lyricsUrl.trim());
      setLyrics(text);
      const parsed = parseLyrics(text);
      showAdminToast(`Fetched ${parsed.lines.length} lines (${parsed.isSynced ? "Synced LRC" : "Plain text"}) from URL!`, "success");
      setStatusMessage(`Lyrics URL parsed successfully (${parsed.lines.length} lines)`);
    } catch (err: any) {
      showAdminToast(`Could not fetch from URL: ${err.message}. The URL will still be saved to the database.`, "error");
      setStatusMessage(`URL fetch warning: ${err.message}`);
    } finally {
      setIsFetchingLyricsUrl(false);
    }
  };

  // Create or Update song doc in Firestore
  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !artist || !audioUrl) {
      setStatusMessage("Please fill in Title, Artist, and Audio source.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(editingSongId ? "Updating track in database..." : "Saving track to sk edz database...");

    try {
      const matchedArtist = artistsList.find(
        (a) =>
          a.id === selectedArtistId ||
          a.name.trim().toLowerCase() === artist.trim().toLowerCase()
      );

      const songData: Partial<Song> & Record<string, any> = {
        title,
        artist,
        artistId: matchedArtist?.id || selectedArtistId || null,
        artistImage: matchedArtist?.imageUrl || selectedArtistImage || null,
        album: album || "Single",
        audioUrl,
        imageUrl: imageUrl || matchedArtist?.imageUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600&auto=format&fit=crop",
        duration: duration || 180, // Fallback to 3 minutes
        createdAt: Date.now(),
        uploadedBy: auth.currentUser?.uid || "admin",
        categories: selectedCategories,
        lyrics: lyrics.trim() || null,
        lyricsUrl: lyricsUrl.trim() || null
      };

      let savedSongId = editingSongId;
      if (editingSongId) {
        await updateDoc(doc(db, "songs", editingSongId), songData);
        setEditingSongId(null);
        setStatusMessage("Song updated successfully! 🎉");
        showAdminToast("Track updated successfully! 🎉", "success");
      } else {
        const newDocRef = await addDoc(collection(db, "songs"), songData);
        savedSongId = newDocRef.id;
        setStatusMessage("Song added successfully! 🎉");
        showAdminToast("New track published to library! 🎵", "success");
      }

      // Add to Private Playlist if enabled
      if (addToPlaylistEnabled && savedSongId) {
        try {
          if (selectedPlaylistId === "new" && newPlaylistName.trim()) {
            await addDoc(collection(db, "playlists"), {
              name: newPlaylistName.trim(),
              description: "Created during song upload",
              userId: auth.currentUser?.uid || "admin",
              songIds: [savedSongId],
              thumbnailUrl: songData.imageUrl || null,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              isPrivate: true // Strictly Private
            });
            showAdminToast(`Also added to new private playlist "${newPlaylistName.trim()}"! 🔒`, "success");
            setNewPlaylistName("");
          } else if (selectedPlaylistId && selectedPlaylistId !== "new") {
            const targetPl = adminPlaylists.find(p => p.id === selectedPlaylistId);
            if (targetPl) {
              const updatedSongIds = targetPl.songIds.includes(savedSongId) ? targetPl.songIds : [...targetPl.songIds, savedSongId];
              await updateDoc(doc(db, "playlists", selectedPlaylistId), {
                songIds: updatedSongIds,
                thumbnailUrl: targetPl.thumbnailUrl || songData.imageUrl || null,
                updatedAt: Date.now()
              });
              showAdminToast(`Added to private playlist "${targetPl.name}"! 🔒`, "success");
            }
          }
        } catch (plErr) {
          console.warn("Failed linking to private playlist:", plErr);
        }
      }
      
      // Clear inputs
      setTitle("");
      setArtist("");
      setSelectedArtistId(null);
      setSelectedArtistImage(null);
      setAlbum("");
      setAudioUrl("");
      setImageUrl("");
      setDuration(0);
      setSelectedCategories([]);
      setLyrics("");
      setLyricsUrl("");
      setUploadProgress({});
      
      // Refetch song list
      fetchSongs();
    } catch (error) {
      console.error("Error writing to database:", error);
      try {
        handleFirestoreError(error, editingSongId ? OperationType.UPDATE : OperationType.CREATE, "songs");
      } catch (fErr) {
        setStatusMessage(`Firestore error: ${fErr instanceof Error ? fErr.message : "Failed to save"}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Song
  const handleDeleteSong = async (songId: string) => {
    if (!confirm("Are you sure you want to delete this song from sk edz?")) return;

    try {
      await deleteDoc(doc(db, "songs", songId));
      setSongs(prev => prev.filter(s => s.id !== songId));
      setStatusMessage("Song deleted successfully.");
      showAdminToast("Song removed from library.", "info");
    } catch (error) {
      console.error("Error deleting song:", error);
      try {
        handleFirestoreError(error, OperationType.DELETE, `songs/${songId}`);
      } catch (fErr) {
        alert(`Delete failed: ${fErr instanceof Error ? fErr.message : "Error"}`);
      }
    }
  };

  // Compute duplicate songs grouped by identical or normalized title
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, Song[]>();
    for (const song of songs) {
      if (!song.title) continue;
      const normalized = (song.title || "")
        .toLowerCase()
        .trim()
        .replace(/\.(mp3|m4a|wav|aac|flac|ogg|opus)$/i, "")
        .replace(/^\d+[\s.-]+/, "")
        .replace(/['`’]/g, "'")
        .replace(/["“”]/g, '"')
        .replace(/\s+/g, " ")
        .trim();
      if (!normalized) continue;
      const list = map.get(normalized) || [];
      list.push(song);
      map.set(normalized, list);
    }

    const duplicates: { name: string; songs: Song[] }[] = [];
    map.forEach((groupedSongs) => {
      if (groupedSongs.length > 1) {
        duplicates.push({
          name: groupedSongs[0].title.trim(),
          songs: groupedSongs
        });
      }
    });

    return duplicates.sort((a, b) => b.songs.length - a.songs.length);
  }, [songs]);

  const totalDuplicateTracksCount = useMemo(() => {
    return duplicateGroups.reduce((acc, g) => acc + g.songs.length, 0);
  }, [duplicateGroups]);

  // Filter duplicate groups based on search term
  const filteredDuplicateGroups = useMemo(() => {
    const term = (trackSearchTerm || duplicateSearchTerm).trim().toLowerCase();
    if (!term) return duplicateGroups;
    return duplicateGroups.filter(group => 
      group.name.toLowerCase().includes(term) ||
      group.songs.some(s => 
        s.title.toLowerCase().includes(term) || 
        s.artist.toLowerCase().includes(term) ||
        (s.album && s.album.toLowerCase().includes(term))
      )
    );
  }, [duplicateGroups, trackSearchTerm, duplicateSearchTerm]);

  // Batch Cleanup Duplicates: Keep one chosen song and delete other copies
  const handleKeepOneDeleteDuplicates = async (keepSong: Song, duplicateGroup: Song[]) => {
    const toDelete = duplicateGroup.filter(s => s.id !== keepSong.id);
    if (!confirm(`Keep "${keepSong.title}" (${keepSong.artist}) and delete the other ${toDelete.length} duplicate copy(ies)? This action cannot be undone.`)) {
      return;
    }
    try {
      for (const item of toDelete) {
        await deleteDoc(doc(db, "songs", item.id));
      }
      setSongs(prev => prev.filter(s => !toDelete.some(del => del.id === s.id)));
      showAdminToast(`Cleaned up duplicates! Kept "${keepSong.title}". Deleted ${toDelete.length} duplicate copy(ies). 🗑️`, "success");
    } catch (err: any) {
      showAdminToast(`Failed cleaning duplicates: ${err.message}`, "error");
    }
  };

  // Helper to format duration
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? "0" : ""}${remainingSecs}`;
  };

  // Real-time VIP keys subscription
  useEffect(() => {
    setLoadingKeys(true);
    const q = query(collection(db, "keys"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const keysArr: any[] = [];
      snapshot.forEach((doc) => {
        keysArr.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setKeysList(keysArr);
      setLoadingKeys(false);
    }, (error) => {
      console.error("Keys subscription failed:", error);
      setLoadingKeys(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time Admin Playlists subscription
  useEffect(() => {
    setLoadingPlaylists(true);
    const q = query(collection(db, "playlists"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const plArr: Playlist[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        plArr.push({
          id: docSnap.id,
          name: d.name || "Untitled Playlist",
          userId: d.userId || "admin",
          songIds: d.songIds || [],
          thumbnailUrl: d.thumbnailUrl || null,
          createdAt: d.createdAt || Date.now(),
          isPrivate: d.isPrivate !== false,
          description: d.description || "",
          updatedAt: d.updatedAt || d.createdAt || Date.now()
        });
      });
      setAdminPlaylists(plArr);
      setLoadingPlaylists(false);
    }, (error) => {
      console.warn("Playlists subscription warning:", error);
      setLoadingPlaylists(false);
    });

    return () => unsubscribe();
  }, []);

  // Admin key generation handler (Supports ₹99 and ₹199 plans with custom notes)
  const handleGenerateVipKey = async () => {
    setGeneratingKey(true);
    setStatusMessage(`Generating secure ₹${selectedPlan} VIP Key...`);
    try {
      const r = (l: number) => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let str = "";
        for (let i = 0; i < l; i++) {
          str += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return str;
      };
      // Generate key in XXX-XXX-XXX format (e.g. 7K9-MP4-2XA) without VIP99 or VIP199 prefix
      const newKeyCode = `${r(3)}-${r(3)}-${r(3)}`;
      
      // All keys are strictly 30 days as requested
      const durationDays = 30;
      const planName = selectedPlan === 199 ? "₹199 VIP Master Pass (30 Days)" : "₹99 VIP Gold Pass (30 Days)";
      const now = Date.now();
      const expiresAtTimestamp = now + durationDays * 24 * 60 * 60 * 1000;
      const expiresAtISO = new Date(expiresAtTimestamp).toISOString();
      const expiresAtFormatted = new Date(expiresAtTimestamp).toLocaleDateString();

      const keyDocRef = doc(db, "keys", newKeyCode);
      await setDoc(keyDocRef, {
        code: newKeyCode,
        plan: selectedPlan,
        planName: planName,
        price: selectedPlan,
        durationDays: durationDays,
        note: customKeyNote.trim() || "",
        createdAt: now,
        status: "active",
        used: false,
        usedBy: "",
        usedAt: 0,
        expiresAt: expiresAtTimestamp,
        expiresAtDate: expiresAtISO,
        expiresAtFormatted: expiresAtFormatted
      });
      setCustomKeyNote("");
      showAdminToast(`Successfully created ${planName} Key: ${newKeyCode} 👑`, "success");
      setStatusMessage(`Generated ${planName} Key: ${newKeyCode} 🎉`);
    } catch (err) {
      console.error("Failed to generate VIP key:", err);
      setStatusMessage("Failed to generate VIP key.");
      showAdminToast("Failed to generate VIP key.", "error");
    } finally {
      setGeneratingKey(false);
    }
  };

  // Copy key to clipboard
  const handleCopyKey = (code: string, id?: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKeyId(id || code);
    showAdminToast(`Copied key code "${code}" to clipboard! 📋`, "info");
    setTimeout(() => setCopiedKeyId(null), 2500);
  };

  // Toggle key status: Activate (reset used status) / Deactivate
  const handleToggleKeyStatus = async (keyId: string, currentStatus: string, isUsed: boolean) => {
    try {
      const keyDocRef = doc(db, "keys", keyId);
      const keySnap = await getDoc(keyDocRef);
      const keyData = keySnap.exists() ? keySnap.data() : null;

      if (isUsed || currentStatus === "disabled") {
        // Activate/Reactivate back to active state and reset used details with updated 30-day expiration
        const now = Date.now();
        const durationDays = 30;
        const expiresAtTimestamp = now + durationDays * 24 * 60 * 60 * 1000;
        
        await updateDoc(keyDocRef, {
          status: "active",
          used: false,
          usedBy: "",
          userId: "",
          activatedBy: "",
          activatedUserId: "",
          usedAt: 0,
          expiresAt: expiresAtTimestamp,
          expiresAtDate: new Date(expiresAtTimestamp).toISOString(),
          expiresAtFormatted: new Date(expiresAtTimestamp).toLocaleDateString()
        });

        // If this key was previously linked to a user, update that user's status in Firestore to revoked/reset
        if (keyData?.userId) {
          try {
            const linkedUserRef = doc(db, "users", keyData.userId);
            await updateDoc(linkedUserRef, {
              isPro: false,
              keyStatus: "reset",
              updatedAt: Date.now()
            });
          } catch (e) {
            console.warn("Could not update linked user profile on key reset:", e);
          }
        }

        showAdminToast(`Key ${keyId} successfully reactivated and reset! 👑`, "success");
        setStatusMessage(`Key ${keyId} successfully reactivated and reset! 👑`);
      } else {
        // Deactivate/Disable the key
        await updateDoc(keyDocRef, {
          status: "disabled"
        });

        if (keyData?.userId) {
          try {
            const linkedUserRef = doc(db, "users", keyData.userId);
            await updateDoc(linkedUserRef, {
              isPro: false,
              keyStatus: "disabled",
              updatedAt: Date.now()
            });
          } catch (e) {
            console.warn("Could not update linked user profile on key disable:", e);
          }
        }

        showAdminToast(`Key ${keyId} successfully deactivated.`, "info");
        setStatusMessage(`Key ${keyId} successfully deactivated.`);
      }
    } catch (err) {
      console.error("Failed to toggle key status:", err);
      setStatusMessage("Failed to update key status.");
      showAdminToast("Failed to update key status.", "error");
    }
  };

  // Delete key
  const handleDeleteKey = async (keyId: string) => {
    if (!window.confirm(`Are you sure you want to delete VIP passcode ${keyId}?`)) return;
    try {
      await deleteDoc(doc(db, "keys", keyId));
      setStatusMessage(`Passcode ${keyId} successfully deleted.`);
    } catch (err) {
      console.error("Failed to delete key:", err);
      setStatusMessage("Failed to delete key.");
    }
  };

  // Toast helper
  const showAdminToast = (text: string, type: "success" | "info" | "error" = "success") => {
    setAdminToast({ text, type });
    setTimeout(() => {
      setAdminToast(null);
    }, 4500);
  };

  // Real-time Firestore Reports Subscription
  useEffect(() => {
    setLoadingReports(true);
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ReportItem[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as ReportItem);
        });
        setReports(list);
        setLoadingReports(false);
      },
      (err) => {
        console.warn("Ordered reports query failed, falling back to unordered listener:", err);
        const fallbackUnsub = onSnapshot(collection(db, "reports"), (snap) => {
          const list: ReportItem[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as ReportItem);
          });
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setReports(list);
          setLoadingReports(false);
        });
        return () => fallbackUnsub();
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time Artists Collection Subscription
  useEffect(() => {
    setLoadingArtists(true);
    const q = query(collection(db, "artists"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ArtistProfile[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as ArtistProfile);
        });
        setArtistsList(list);
        setLoadingArtists(false);
      },
      (err) => {
        console.warn("Artists collection query with orderBy failed, falling back to unordered:", err);
        const fallbackUnsub = onSnapshot(collection(db, "artists"), (snap) => {
          const list: ArtistProfile[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as ArtistProfile);
          });
          list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
          setArtistsList(list);
          setLoadingArtists(false);
        });
        return () => fallbackUnsub();
      }
    );

    return () => unsubscribe();
  }, []);

  // Handler to Create or Update an Artist Profile
  const handleSaveArtistProfile = async (data: Partial<ArtistProfile>, id?: string) => {
    try {
      if (id) {
        await updateDoc(doc(db, "artists", id), {
          ...data,
          updatedAt: Date.now()
        });
        showAdminToast(`Artist profile "${data.name}" updated! ✨`, "success");
      } else {
        await addDoc(collection(db, "artists"), {
          ...data,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        showAdminToast(`Artist profile "${data.name}" published! 🌟`, "success");
      }
    } catch (err: any) {
      console.error("Failed to save artist profile:", err);
      showAdminToast(`Error saving artist: ${err.message || "Failed"}`, "error");
      throw err;
    }
  };

  // Handler to Delete an Artist Profile
  const handleDeleteArtistProfile = async (artistId: string) => {
    try {
      await deleteDoc(doc(db, "artists", artistId));
      showAdminToast("Artist profile deleted from database.", "info");
    } catch (err: any) {
      console.error("Failed to delete artist profile:", err);
      showAdminToast(`Failed to delete: ${err.message}`, "error");
      throw err;
    }
  };

  // Handler to Multi-Assign / Link Existing Songs to an Artist Profile
  const handleAssignSongsToArtist = async (
    artistProfile: ArtistProfile,
    songIdsToAssign: string[]
  ) => {
    if (!artistProfile || !artistProfile.id) return;
    try {
      if (songIdsToAssign.length === 0) {
        showAdminToast("No tracks selected to assign.", "info");
        return;
      }

      const batch = writeBatch(db);
      songIdsToAssign.forEach((songId) => {
        const songRef = doc(db, "songs", songId);
        batch.update(songRef, {
          artist: artistProfile.name,
          artistId: artistProfile.id,
          artistImage: artistProfile.imageUrl || null,
          updatedAt: Date.now()
        });
      });

      await batch.commit();
      showAdminToast(
        `Successfully linked ${songIdsToAssign.length} song${songIdsToAssign.length === 1 ? "" : "s"} to ${artistProfile.name}! 🎵✨`,
        "success"
      );
    } catch (err: any) {
      console.error("Failed to assign songs to artist:", err);
      showAdminToast(`Failed to assign tracks: ${err.message || "Database error"}`, "error");
      throw err;
    }
  };

  // Bulk Delete Reports Handler (tani tani yavum & motha ma vum)
  const handleBulkDeleteReports = async (reportIds: string[]) => {
    if (!reportIds || reportIds.length === 0) return;
    try {
      await Promise.all(reportIds.map((id) => deleteDoc(doc(db, "reports", id))));
      showAdminToast(`Successfully deleted ${reportIds.length} report document${reportIds.length === 1 ? "" : "s"}! 🗑️`, "success");
    } catch (err: any) {
      console.error("Failed to bulk delete reports:", err);
      showAdminToast(`Bulk delete error: ${err.message || "Failed"}`, "error");
      throw err;
    }
  };

  // Update Report Status & Dispatch In-App Notification to User
  const handleUpdateReportStatus = async (
    report: ReportItem,
    newStatus: ReportStatus,
    customReply?: string,
    notes?: string
  ) => {
    setIsUpdatingReport(true);
    try {
      const reportRef = doc(db, "reports", report.id);
      const updateData: any = {
        status: newStatus,
        updatedAt: Date.now()
      };
      if (customReply !== undefined) {
        updateData.adminReply = customReply;
      }
      if (notes !== undefined) {
        updateData.adminNotes = notes;
      }

      await updateDoc(reportRef, updateData);

      // Dispatch real-time in-app notification to the user
      if (report.userId) {
        const statusMeta: Record<ReportStatus, { title: string; desc: string }> = {
          open: {
            title: "Report Status: Open 📩",
            desc: "Your report is in the queue and scheduled for review."
          },
          seen: {
            title: "Admin Viewed Your Report 👀",
            desc: "Administrator has seen and acknowledged your reported issue."
          },
          under_review: {
            title: "Report Under Review 🔍",
            desc: "Administrator is investigating and reviewing the details of your report."
          },
          processing: {
            title: "Report In Progress ⚙️",
            desc: "Administrator is actively resolving and fixing the issue you submitted."
          },
          done: {
            title: "Report Resolved! ✅",
            desc: "The issue you reported has been successfully addressed and completed."
          }
        };

        const meta = statusMeta[newStatus] || {
          title: `Report Status: ${newStatus}`,
          desc: `Your report status was updated to ${newStatus}.`
        };

        const finalNotificationMsg = customReply?.trim()
          ? `${meta.desc}\n\n💬 Admin Message: "${customReply.trim()}"`
          : meta.desc;

        await addDoc(collection(db, "notifications"), {
          userId: report.userId,
          reportId: report.id,
          title: meta.title,
          message: finalNotificationMsg,
          status: newStatus,
          type: "report_update",
          read: false,
          createdAt: Date.now()
        });
      }

      const statusLabels: Record<ReportStatus, string> = {
        open: "Open",
        seen: "Seen",
        under_review: "Under Review",
        processing: "Processing",
        done: "Done"
      };

      showAdminToast(`Status changed to ${statusLabels[newStatus]} & Notification sent! 🚀`, "success");
    } catch (err: any) {
      console.error("Failed to update report status:", err);
      showAdminToast(`Error updating report: ${err.message || "Failed"}`, "error");
    } finally {
      setIsUpdatingReport(false);
    }
  };

  // Delete Report permanently
  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this report record?")) {
      return;
    }
    setIsDeletingReportId(reportId);
    try {
      await deleteDoc(doc(db, "reports", reportId));
      showAdminToast("Report successfully deleted! 🗑️", "success");
    } catch (err: any) {
      console.error("Failed to delete report:", err);
      showAdminToast(`Failed to delete: ${err.message}`, "error");
    } finally {
      setIsDeletingReportId(null);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#090b16] text-slate-100 p-4">
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-400 via-indigo-500 to-fuchsia-500 p-[2px] shadow-[0_0_30px_rgba(6,182,212,0.4)] animate-pulse mb-4">
          <div className="w-full h-full bg-[#0b0c15] rounded-2xl flex items-center justify-center">
            <Disc className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        </div>
        <p className="text-xs font-mono text-cyan-400 tracking-wider animate-pulse uppercase">Verifying Administrator Session...</p>
      </div>
    );
  }

  if (!isAdminAuthenticated) {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-hidden bg-[#070810]">
        {/* Ambient background glows */}
        <div className="absolute top-[-15%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-[-15%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none animate-pulse" style={{ animationDelay: "2s" }}></div>

        <div className="w-full max-w-md bg-white/[0.04] border border-white/10 rounded-3xl p-8 backdrop-blur-2xl shadow-2xl relative z-10 overflow-hidden">
          {/* Top badge */}
          <div className="text-center mb-7">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 shadow-[0_0_25px_rgba(6,182,212,0.4)] flex items-center justify-center mx-auto mb-4 border border-cyan-400/30">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-mono font-bold tracking-wider uppercase mb-2">
              <ShieldAlert className="w-3 h-3" />
              <span>Restricted Access</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
              sk edz admin
            </h1>
            <p className="text-slate-400 text-xs mt-1 font-sans">
              Enter administrator credentials to manage cloud tracks, genres & VIP passcodes.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="admin@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 focus:border-cyan-400/60 rounded-2xl text-slate-100 outline-none transition-all placeholder-slate-500 text-sm focus:ring-1 focus:ring-cyan-400/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 bg-white/5 border border-white/10 focus:border-cyan-400/60 rounded-2xl text-slate-100 outline-none transition-all placeholder-slate-500 text-sm focus:ring-1 focus:ring-cyan-400/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-mono">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(6,182,212,0.3)] text-sm mt-2"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Unlock Admin Console</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5 text-center">
            <a
              href="/"
              className="inline-flex items-center space-x-2 text-xs font-medium text-slate-400 hover:text-cyan-400 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Music Player</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-x-hidden">
      {/* Dynamic Ambient Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: "2s" }}></div>

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-8 flex flex-col flex-grow">
        
        {/* Navigation & Brand */}
        <header className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center animate-spin-slow">
              <Disc className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                  sk edz admin
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold uppercase">
                  Authorized
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">LIQUID GLASS CONSOLE</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleAdminLogout}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold transition-all duration-300 hover:scale-105 active:scale-95"
              title="Sign out of admin console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Lock / Exit</span>
            </button>

            <a 
              href="/" 
              className="flex items-center space-x-2 px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 group text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400 group-hover:-translate-x-1 transition-transform" />
              <span>Go to Player 🎧</span>
            </a>
          </div>
        </header>

        {/* Switchable Tabs Selector */}
        <div className="flex flex-wrap gap-2 p-1.5 bg-white/5 border border-white/10 rounded-2xl mb-8 self-start backdrop-blur-md">
          <button
            onClick={() => setActiveTab("songs")}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 ${
              activeTab === "songs"
                ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Tracks Manager</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-black/20 text-white ml-1 font-bold">
              {songs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("batch")}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 ${
              activeTab === "batch"
                ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 text-white shadow-lg shadow-emerald-500/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Multiple Upload</span>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase ml-1">
              Batch
            </span>
          </button>

          {/* Dedicated Find Duplicate Songs Tab Button */}
          <button
            onClick={() => {
              setActiveTab("duplicates");
              setShowDuplicatesOnly(true);
            }}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 ${
              activeTab === "duplicates"
                ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-amber-500/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Copy className="w-4 h-4 text-amber-400" />
            <span>Find Duplicate Songs</span>
            {duplicateGroups.length > 0 && (
              <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded-md bg-amber-500 text-black ml-1">
                {duplicateGroups.length}
              </span>
            )}
          </button>

          {/* Private Playlists Hub Tab Button */}
          <button
            onClick={() => setActiveTab("playlists")}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 ${
              activeTab === "playlists"
                ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white shadow-lg shadow-purple-500/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <ListMusic className="w-4 h-4" />
            <span>Private Playlists</span>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-400/30 uppercase ml-1 flex items-center space-x-0.5">
              <Lock className="w-2.5 h-2.5" />
              <span>{adminPlaylists.length}</span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab("artists")}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 ${
              activeTab === "artists"
                ? "bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Artist Profiles</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold ml-1 ${
              activeTab === "artists" ? "bg-black/20 text-white" : "bg-purple-500/20 text-purple-300"
            }`}>
              {artistsList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("keys")}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 ${
              activeTab === "keys"
                ? "bg-gradient-to-r from-amber-500 to-yellow-600 text-black shadow-lg shadow-amber-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>VIP Keys Manager</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold ml-1 ${
              activeTab === "keys" ? "bg-black/20 text-black" : "bg-amber-500/20 text-amber-300"
            }`}>
              {keysList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("cloudinary")}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 ${
              activeTab === "cloudinary"
                ? "bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>Cloudinary Storage</span>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 ml-1 uppercase">
              CDN
            </span>
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 relative ${
              activeTab === "reports"
                ? "bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 text-white shadow-lg shadow-rose-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Reports & Feedback</span>
            {reports.filter(r => r.status === "open").length > 0 && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black font-mono animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]">
                {reports.some(r => (r.isVIP || r.priority === "vip") && r.status === "open") && (
                  <Crown className="w-2.5 h-2.5 mr-0.5" />
                )}
                <span>{reports.filter(r => r.status === "open").length} New</span>
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("updates")}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 ${
              activeTab === "updates"
                ? "bg-gradient-to-r from-violet-500 via-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Last Updated</span>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-400/30 uppercase ml-1">
              Logs
            </span>
          </button>
        </div>

        {/* Tab 1: Tracks Manager */}
        {activeTab === "songs" && (
          /* Dashboard Grid - Tracks Manager */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
            
            {/* Upload and Input Glass Panel */}
            <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
              {/* Ambient inner card glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/5 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-bold text-slate-100">
                    {editingSongId ? "Edit Track Details" : "Add Track Details"}
                  </h2>
                </div>
                {editingSongId && (
                  <button 
                    type="button"
                    onClick={cancelEdit}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold transition-all"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <form onSubmit={handleAddSong} className="space-y-4">
                {/* Search & Auto-Fill from Existing Library */}
                <div className="relative border border-cyan-500/20 bg-cyan-500/5 rounded-2xl p-3.5 space-y-2">
                  <label className="block text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center justify-between font-mono">
                    <span className="flex items-center space-x-1.5">
                      <Search className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Search & Auto-fill Track</span>
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">QUICK PREFILL</span>
                  </label>
                  
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Type song or artist name to auto-fill details..."
                      value={autoFillSearchTerm}
                      onFocus={() => setShowAutoFillDropdown(true)}
                      onChange={(e) => {
                        setAutoFillSearchTerm(e.target.value);
                        setShowAutoFillDropdown(true);
                      }}
                      className="w-full pl-9 pr-8 py-2 bg-black/40 border border-white/10 focus:border-cyan-400/60 rounded-xl text-slate-200 placeholder-slate-500 text-xs outline-none transition-all focus:ring-1 focus:ring-cyan-400/30"
                    />
                    {autoFillSearchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setAutoFillSearchTerm("");
                          setShowAutoFillDropdown(false);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Dropdown Suggestions */}
                  {showAutoFillDropdown && autoFillSearchTerm.trim().length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-40 mt-1 bg-[#0d1222] border border-cyan-500/30 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.8)] overflow-hidden max-h-56 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                      {songs
                        .filter(
                          (s) =>
                            s.title.toLowerCase().includes(autoFillSearchTerm.toLowerCase()) ||
                            s.artist.toLowerCase().includes(autoFillSearchTerm.toLowerCase()) ||
                            (s.album && s.album.toLowerCase().includes(autoFillSearchTerm.toLowerCase()))
                        )
                        .slice(0, 7)
                        .map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setTitle(s.title);
                              setArtist(s.artist);
                              setAlbum(s.album || "");
                              setAudioUrl(s.audioUrl || "");
                              setImageUrl(s.imageUrl || "");
                              setDuration(s.duration || 0);
                              setSelectedCategories(s.categories || []);
                              setAutoFillSearchTerm(s.title);
                              setShowAutoFillDropdown(false);
                              setStatusMessage(`Auto-filled details from "${s.title}"!`);
                            }}
                            className="w-full flex items-center justify-between p-2 hover:bg-cyan-500/15 rounded-xl transition-all text-left group"
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <img
                                src={s.imageUrl}
                                alt={s.title}
                                className="w-8 h-8 rounded-lg object-cover bg-black/50 border border-white/10"
                                referrerPolicy="no-referrer"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 truncate">
                                  {s.title}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">{s.artist}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 group-hover:bg-cyan-500/30 whitespace-nowrap">
                              Fill ⤓
                            </span>
                          </button>
                        ))}
                      {songs.filter(
                        (s) =>
                          s.title.toLowerCase().includes(autoFillSearchTerm.toLowerCase()) ||
                          s.artist.toLowerCase().includes(autoFillSearchTerm.toLowerCase()) ||
                          (s.album && s.album.toLowerCase().includes(autoFillSearchTerm.toLowerCase()))
                      ).length === 0 && (
                        <div className="p-3 text-center text-xs text-slate-400 italic">
                          No matching track found in library.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Audio File Metadata Auto-Fill Option Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-purple-950/20 border border-cyan-500/30 shadow-md transition-all hover:border-cyan-500/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0 pr-3">
                      <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30 flex-shrink-0">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-100 tracking-wide">
                            Auto-Fill Info from Audio File
                          </span>
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold uppercase tracking-wider">
                            Smart ID3 & Cover Art
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Automatically extracts Artist, Title, Album, Duration & Embedded Album Art Cover directly when audio is uploaded.
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={autoFillMetadata}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setAutoFillMetadata(val);
                          try {
                            localStorage.setItem("admin_autofill_audio_metadata", String(val));
                          } catch {}
                          showAdminToast(
                            val
                              ? "Auto-fill metadata enabled! Details will fill automatically on audio upload. ✨"
                              : "Auto-fill disabled. Manual input mode active.",
                            "info"
                          );
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 shadow-inner"></div>
                    </label>
                  </div>

                  {/* Detected metadata summary badge if active */}
                  {detectedMetadata && (
                    <div className="mt-3 pt-3 border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {detectedMetadata.coverDataUrl && (
                          <img
                            src={detectedMetadata.coverDataUrl}
                            alt="Extracted Cover"
                            className="w-8 h-8 rounded-lg object-cover border border-cyan-400/40 shadow-sm flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-200 font-semibold truncate">
                            ✨ {detectedMetadata.title || "Untitled"} {detectedMetadata.artist ? `by ${detectedMetadata.artist}` : ""}
                          </p>
                          <p className="text-[10px] text-cyan-300 font-mono truncate">
                            {detectedMetadata.album ? `Album: ${detectedMetadata.album} • ` : ""}
                            {detectedMetadata.duration ? `${Math.floor(detectedMetadata.duration / 60)}:${(detectedMetadata.duration % 60).toString().padStart(2, "0")} • ` : ""}
                            {detectedMetadata.coverFile ? "Cover Art Extracted ✓" : "No Embedded Cover"}
                            {isUploadingExtractedCover && " (Uploading art to Cloudinary...)"}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => applyExtractedMetadata(detectedMetadata)}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold flex items-center space-x-1 transition-all"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Re-apply Details</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Add to Private Playlist Option Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-[#0c1220] border border-purple-500/30 shadow-md transition-all hover:border-purple-500/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0 pr-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30 flex-shrink-0">
                        <ListMusic className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-100 tracking-wide">
                            Add to Private Playlist
                          </span>
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold uppercase tracking-wider flex items-center space-x-0.5">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Private Only</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Adds this song to an Admin Private Playlist. The song is in library, but playlist is hidden from normal public users.
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={addToPlaylistEnabled}
                        onChange={(e) => {
                          setAddToPlaylistEnabled(e.target.checked);
                          if (e.target.checked && !selectedPlaylistId && adminPlaylists.length > 0) {
                            setSelectedPlaylistId(adminPlaylists[0].id);
                          } else if (e.target.checked && adminPlaylists.length === 0) {
                            setSelectedPlaylistId("new");
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-indigo-500"></div>
                    </label>
                  </div>

                  {/* Expanded Playlist Choice Picker */}
                  {addToPlaylistEnabled && (
                    <div className="mt-3 pt-3 border-t border-purple-500/20 space-y-2.5 animate-fade-in">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase font-mono sm:w-28 flex-shrink-0">
                          Select Playlist:
                        </label>
                        <select
                          value={selectedPlaylistId}
                          onChange={(e) => setSelectedPlaylistId(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-black/50 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-purple-400"
                        >
                          <option value="new">➕ [+] Create New Private Playlist...</option>
                          {adminPlaylists.map((pl) => (
                            <option key={pl.id} value={pl.id}>
                              📁 {pl.name} ({pl.songIds?.length || 0} tracks)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* New Playlist Name Input if 'new' selected */}
                      {selectedPlaylistId === "new" && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <label className="text-[10px] font-bold text-purple-300 uppercase font-mono sm:w-28 flex-shrink-0">
                            New Playlist Name:
                          </label>
                          <input 
                            type="text"
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            placeholder="e.g. My Exclusive Favorites"
                            className="flex-1 px-3 py-1.5 bg-black/50 border border-purple-500/40 rounded-xl text-xs text-white outline-none focus:border-purple-400 placeholder-slate-500"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Track Title *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Arabic Kuthu" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-cyan-400/50 rounded-2xl text-slate-100 outline-none transition-all placeholder-slate-500 backdrop-blur-md text-sm"
                  />
                </div>

                {/* Artist Name & Searchable Artist Profile Picker */}
                <div className="space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Artist Name *
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveTab("artists")}
                      className="text-[11px] font-mono text-purple-400 hover:text-purple-300 hover:underline flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Manage Artist Profiles ({artistsList.length})</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Anirudh Ravichander (Search or type new)" 
                      value={artist}
                      onFocus={() => setShowArtistDropdown(true)}
                      onChange={(e) => {
                        setArtist(e.target.value);
                        setArtistFilterQuery(e.target.value);
                        setShowArtistDropdown(true);
                        // Check if typed name matches any profile
                        const exact = artistsList.find(
                          (a) => a.name.trim().toLowerCase() === e.target.value.trim().toLowerCase()
                        );
                        if (exact) {
                          setSelectedArtistId(exact.id);
                          setSelectedArtistImage(exact.imageUrl);
                        } else {
                          setSelectedArtistId(null);
                          setSelectedArtistImage(null);
                        }
                      }}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-purple-400/60 rounded-2xl text-slate-100 outline-none transition-all placeholder-slate-500 backdrop-blur-md text-sm focus:ring-1 focus:ring-purple-400/30"
                    />

                    {artistsList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowArtistDropdown(!showArtistDropdown)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-purple-300 text-xs font-mono transition-colors"
                        title="Browse Artist Profiles"
                      >
                        <Users className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Searchable Artist Profiles Dropdown Menu */}
                  {showArtistDropdown && artistsList.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-40 mt-1.5 bg-[#0e1122]/95 border border-purple-500/30 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.85)] overflow-hidden max-h-60 overflow-y-auto custom-scrollbar p-2 space-y-1 backdrop-blur-2xl">
                      <div className="px-2 py-1 text-[10px] font-mono text-purple-400 flex items-center justify-between border-b border-white/10 mb-1">
                        <span>SELECT ARTIST PROFILE ({artistsList.length})</span>
                        <button
                          type="button"
                          onClick={() => setShowArtistDropdown(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>

                      {artistsList
                        .filter((a) =>
                          !artistFilterQuery.trim() ||
                          a.name.toLowerCase().includes(artistFilterQuery.toLowerCase()) ||
                          (a.genre && a.genre.toLowerCase().includes(artistFilterQuery.toLowerCase()))
                        )
                        .map((art) => (
                          <button
                            key={art.id}
                            type="button"
                            onClick={() => {
                              setArtist(art.name);
                              setSelectedArtistId(art.id);
                              setSelectedArtistImage(art.imageUrl);
                              if (!imageUrl && art.imageUrl) {
                                setImageUrl(art.imageUrl);
                                setImageStatus("available");
                              }
                              setShowArtistDropdown(false);
                              setStatusMessage(`Linked artist profile "${art.name}"! ✨`);
                            }}
                            className="w-full flex items-center justify-between p-2 hover:bg-purple-500/15 rounded-xl transition-all text-left group"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl overflow-hidden bg-black/50 border border-white/10 flex-shrink-0">
                                {art.imageUrl ? (
                                  <img
                                    src={art.imageUrl}
                                    alt={art.name}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-purple-500/20 text-purple-300 font-bold text-xs">
                                    {art.name.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-100 group-hover:text-purple-300 truncate flex items-center space-x-1.5">
                                  <span>{art.name}</span>
                                  {art.verified && (
                                    <span className="text-[9px] text-cyan-400 font-bold">✓</span>
                                  )}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {art.genre || "Artist"} {art.monthlyListeners ? `• ${art.monthlyListeners}` : ""}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 group-hover:bg-purple-500/30 whitespace-nowrap">
                              Select ✓
                            </span>
                          </button>
                        ))}

                      {artistsList.filter((a) =>
                        !artistFilterQuery.trim() ||
                        a.name.toLowerCase().includes(artistFilterQuery.toLowerCase()) ||
                        (a.genre && a.genre.toLowerCase().includes(artistFilterQuery.toLowerCase()))
                      ).length === 0 && (
                        <div className="p-3 text-center text-xs text-slate-400">
                          <p>No artist matching "{artistFilterQuery}".</p>
                          <button
                            type="button"
                            onClick={() => setActiveTab("artists")}
                            className="mt-1.5 text-xs text-purple-400 hover:underline font-mono"
                          >
                            + Create New Profile in Artists Tab
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selected Artist Profile Link Badge */}
                  {selectedArtistId && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-200 text-xs">
                      <div className="flex items-center space-x-2 min-w-0">
                        {selectedArtistImage && (
                          <img
                            src={selectedArtistImage}
                            alt="Artist"
                            className="w-6 h-6 rounded-full object-cover border border-purple-400/40 flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <span className="font-bold truncate font-mono text-[11px]">
                          Linked Profile: {artist}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedArtistId(null);
                          setSelectedArtistImage(null);
                        }}
                        className="text-[10px] text-purple-400 hover:text-white px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/40 font-mono transition-colors"
                      >
                        Unlink
                      </button>
                    </div>
                  )}

                  {/* Quick Clickable Chips of Registered Artists */}
                  {artistsList.length > 0 && !selectedArtistId && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[10px] font-mono text-slate-400">Quick Select Artist Profile:</div>
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto custom-scrollbar">
                        {artistsList.slice(0, 8).map((art) => (
                          <button
                            key={art.id}
                            type="button"
                            onClick={() => {
                              setArtist(art.name);
                              setSelectedArtistId(art.id);
                              setSelectedArtistImage(art.imageUrl);
                              if (!imageUrl && art.imageUrl) {
                                setImageUrl(art.imageUrl);
                                setImageStatus("available");
                              }
                            }}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/30 text-slate-300 hover:text-purple-200 text-[11px] transition-all"
                          >
                            {art.imageUrl && (
                              <img
                                src={art.imageUrl}
                                alt={art.name}
                                className="w-3.5 h-3.5 rounded-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <span>{art.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Album */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Album (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Beast" 
                    value={album}
                    onChange={(e) => setAlbum(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-cyan-400/50 rounded-2xl text-slate-100 outline-none transition-all placeholder-slate-500 backdrop-blur-md text-sm"
                  />
                </div>

                {/* Categories Management & Selection */}
                <div className="border border-white/5 rounded-2xl p-4 bg-black/20 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Categories *</label>
                    <span className="text-[10px] text-slate-400 font-mono">SELECT MULTIPLE</span>
                  </div>

                  {/* List of categories with checkable pill buttons */}
                  {categories.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No categories created yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((cat) => {
                        const isSelected = selectedCategories.includes(cat);
                        return (
                          <button
                            type="button"
                            key={cat}
                            onClick={() => toggleCategorySelection(cat)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                              isSelected
                                ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                                : "bg-white/5 border-white/10 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Add New Category Option inline inside the card */}
                  <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add new category (e.g. K-Pop)"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 focus:border-cyan-400/30 rounded-xl text-slate-200 outline-none transition-all placeholder-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      disabled={isAddingCategory || !newCategoryName.trim()}
                      className="p-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl transition-all disabled:opacity-50 flex items-center justify-center font-bold"
                      title="Add category"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Category List with Edit and Delete options */}
                  {categoriesObj.length > 0 && (
                    <div className="pt-3 border-t border-white/5 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Manage Categories</span>
                      </div>
                      <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                        {categoriesObj.map((catObj) => (
                          <div key={catObj.id} className="flex items-center justify-between p-2 rounded-xl bg-white/2 hover:bg-white/5 border border-white/5 group">
                            {editingCategoryId === catObj.id ? (
                              <div className="flex items-center gap-1.5 w-full">
                                <input
                                  type="text"
                                  value={editingCategoryName}
                                  onChange={(e) => setEditingCategoryName(e.target.value)}
                                  className="flex-1 px-2 py-1 bg-white/10 border border-white/20 focus:border-cyan-400/30 rounded-lg text-slate-100 outline-none text-xs"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveCategoryEdit(catObj.id)}
                                  className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/35 text-emerald-400 text-[10px] font-bold rounded-lg transition-all"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingCategoryId(null); setEditingCategoryName(""); }}
                                  className="px-2 py-1 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 text-[10px] font-bold rounded-lg transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="text-xs text-slate-300 font-medium">{catObj.name}</span>
                                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => startEditingCategory(catObj.id, catObj.name)}
                                    className="p-1.5 hover:bg-cyan-500/20 border border-transparent hover:border-cyan-500/15 text-slate-400 hover:text-cyan-400 rounded-lg transition-all"
                                    title="Edit Name"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCategory(catObj.id, catObj.name)}
                                    className="p-1.5 hover:bg-red-500/20 border border-transparent hover:border-red-500/15 text-slate-400 hover:text-red-400 rounded-lg transition-all"
                                    title="Delete Category"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Audio Stream Source */}
                  <div className="border border-cyan-500/20 bg-cyan-500/5 rounded-2xl p-4 animate-fade-in space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-semibold text-cyan-400 uppercase tracking-wider font-mono">
                        Direct Audio Stream Source *
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">URL OR FILE UPLOAD</span>
                    </div>
                    
                    <input 
                      type="text" 
                      placeholder="Enter direct MP3/Audio URL (e.g. https://domain.com/song.mp3)" 
                      value={audioUrl}
                      onChange={(e) => setAudioUrl(e.target.value)}
                      className="w-full px-3 py-2.5 bg-black/40 border border-white/10 focus:border-cyan-400/50 rounded-xl text-slate-200 outline-none transition-all placeholder-slate-600 text-xs"
                    />

                    {/* File picker for Audio */}
                    <div className="relative flex items-center justify-center border border-dashed border-cyan-500/30 rounded-xl p-4 hover:border-cyan-400 transition-all group bg-white/5 cursor-pointer">
                      <input 
                        type="file" 
                        accept="audio/*"
                        onChange={(e) => handleFileChange(e, "audio")}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="text-center">
                        <FileAudio className="w-6 h-6 text-cyan-400 group-hover:scale-110 mx-auto mb-1.5 transition-transform" />
                        <span className="text-xs text-slate-200 font-semibold block">
                          {selectedAudioFile ? selectedAudioFile.name : "Select / Drop Audio File"}
                        </span>
                        <span className="text-[10px] text-cyan-400/80 block mt-0.5">
                          {autoFillMetadata 
                            ? "✨ Auto-fills Artist, Title, Album, Duration & Cover Art" 
                            : "Direct Cloudinary Upload (MP3, M4A, WAV, AAC)"}
                        </span>
                      </div>
                    </div>

                    {/* Selected Audio File Status & Manual Scan Tool */}
                    {selectedAudioFile && (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs">
                        <div className="flex items-center space-x-2 min-w-0">
                          <FileAudio className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-200 truncate">{selectedAudioFile.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {(selectedAudioFile.size / (1024 * 1024)).toFixed(2)} MB
                              {detectedMetadata?.title ? ` • Detected: "${detectedMetadata.title}"` : ""}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isExtractingMetadata}
                          onClick={async () => {
                            setIsExtractingMetadata(true);
                            setStatusMessage("Scanning audio file metadata...");
                            try {
                              const meta = await extractAudioFileMetadata(selectedAudioFile);
                              setDetectedMetadata(meta);
                              await applyExtractedMetadata(meta);
                              showAdminToast("Metadata scanned and applied to form! ✨", "success");
                            } catch (e: any) {
                              showAdminToast(`Scan failed: ${e.message}`, "error");
                            } finally {
                              setIsExtractingMetadata(false);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold flex items-center space-x-1 transition-colors flex-shrink-0 ml-2"
                          title="Scan and extract details from this file"
                        >
                          {isExtractingMetadata ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          <span>{isExtractingMetadata ? "Scanning..." : "Scan & Fill"}</span>
                        </button>
                      </div>
                    )}

                    {/* Progress bar */}
                    {uploadProgress.audio_file !== undefined && uploadProgress.audio_file > 0 && (
                      <div>
                        <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                          <span>Audio Uploading</span>
                          <span>{uploadProgress.audio_file}%</span>
                        </div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-400 transition-all duration-300" style={{ width: `${uploadProgress.audio_file}%` }}></div>
                        </div>
                      </div>
                    )}
                  </div>

                {/* Cover Image URL & File Upload */}
                <div className="border border-white/5 rounded-2xl p-4 bg-black/20 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-semibold text-pink-400 uppercase tracking-wider">
                      Cover Image Artwork (Optional)
                    </label>
                    <div className="flex items-center space-x-1.5">
                      {imageStatus === "available" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                          ● Image Available
                        </span>
                      )}
                      {imageStatus === "unavailable" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                          ● Image Unavailable
                        </span>
                      )}
                      {imageStatus === "unchecked" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold font-mono bg-slate-500/10 text-slate-400 border border-slate-500/20 uppercase tracking-wider">
                          ● Unchecked
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {imageUrl && (
                      <img
                        src={imageUrl}
                        alt="Cover Preview"
                        className="w-12 h-12 rounded-xl object-cover border border-white/10 bg-black/40 flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <input 
                      type="text" 
                      placeholder="Enter external direct Cover URL link" 
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 focus:border-pink-400/30 rounded-xl text-slate-200 outline-none transition-all placeholder-slate-600 text-xs"
                    />
                  </div>

                  {/* File picker for Image */}
                  <div className="relative flex items-center justify-center border border-dashed border-white/15 rounded-xl p-3.5 hover:border-pink-500/30 transition-all group bg-white/5 cursor-pointer">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, "image")}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="text-center">
                      <ImageIcon className="w-5 h-5 text-slate-400 group-hover:text-pink-400 mx-auto mb-1 transition-colors" />
                      <span className="text-xs text-slate-300 font-medium block">Upload Custom Cover Art</span>
                      <span className="text-[10px] text-slate-500 block">JPG, PNG, WEBP</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {uploadProgress.image_file !== undefined && uploadProgress.image_file > 0 && (
                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                        <span>Image Uploading</span>
                        <span>{uploadProgress.image_file}%</span>
                      </div>
                      <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-pink-500 transition-all duration-300" style={{ width: `${uploadProgress.image_file}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Custom Duration Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Track Duration (Seconds)</label>
                  <input 
                    type="number" 
                    placeholder="Duration in seconds (e.g. 180)" 
                    value={duration || ""}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-cyan-400/50 rounded-2xl text-slate-100 outline-none transition-all placeholder-slate-500 backdrop-blur-md text-sm"
                  />
                  {duration > 0 && (
                    <p className="text-[10px] text-emerald-400 font-mono mt-1">Calculated time: {formatTime(duration)}</p>
                  )}
                </div>

                {/* Lyrics Support (Optional) - Supports .lrc, .srt, .txt, URLs, and direct text */}
                <div className="border border-cyan-500/25 bg-black/40 rounded-2xl p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlignLeft className="w-4 h-4 text-cyan-400" />
                      <label className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                        Lyrics Support (Optional)
                      </label>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                        L BADGE
                      </span>
                    </div>
                    {lyrics.trim() ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold">
                        {parseLyrics(lyrics).isSynced ? "● Synced LRC" : "● Plain Text"} ({parseLyrics(lyrics).lines.length} lines)
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">Optional</span>
                    )}
                  </div>

                  {/* Lyrics File URL input */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-400">
                      External Lyrics File URL (Supports .lrc, .srt, .txt links)
                    </label>
                    <div className="flex space-x-2">
                      <input 
                        type="text" 
                        placeholder="https://domain.com/lyrics/track.lrc" 
                        value={lyricsUrl}
                        onChange={(e) => setLyricsUrl(e.target.value)}
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 focus:border-cyan-400/40 rounded-xl text-slate-200 outline-none text-xs transition-all placeholder-slate-600"
                      />
                      <button
                        type="button"
                        onClick={handleFetchLyricsFromUrl}
                        disabled={isFetchingLyricsUrl || !lyricsUrl.trim()}
                        className="px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold disabled:opacity-40 transition-all flex items-center space-x-1.5"
                        title="Fetch and parse lyrics from URL"
                      >
                        {isFetchingLyricsUrl ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ExternalLink className="w-3.5 h-3.5" />
                        )}
                        <span>Fetch URL</span>
                      </button>
                    </div>
                  </div>

                  {/* File Upload Picker for .lrc, .srt, .vtt, .txt */}
                  <div className="relative flex items-center justify-center border border-dashed border-cyan-500/20 rounded-xl p-3 hover:border-cyan-400/40 transition-all group bg-cyan-500/5 cursor-pointer">
                    <input 
                      type="file" 
                      accept=".lrc,.srt,.vtt,.txt,text/*"
                      onChange={handleLyricsFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="text-center">
                      <FileText className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 mx-auto mb-1 transition-colors" />
                      <span className="text-xs text-slate-300 font-medium block">Upload Lyrics File (.lrc, .srt, .txt)</span>
                      <span className="text-[10px] text-slate-500 block">All formats supported — auto-parses timing and text</span>
                    </div>
                  </div>

                  {/* Direct Lyrics Editor / Paste area */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="block text-[11px] font-medium text-slate-400">
                        Lyrics Editor (LRC Timestamps or Plain Text)
                      </label>
                      {lyrics && (
                        <button 
                          type="button" 
                          onClick={() => setLyrics("")}
                          className="text-[10px] text-red-400 hover:text-red-300 font-mono"
                        >
                          Clear Lyrics
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={5}
                      value={lyrics}
                      onChange={(e) => setLyrics(e.target.value)}
                      placeholder={`Paste synchronized lyrics (.lrc) or plain text here:\n[00:12.30] Line 1 synced lyrics\n[00:18.45] Line 2 chorus lyrics`}
                      className="w-full px-3 py-2.5 bg-black/40 border border-white/10 focus:border-cyan-400/40 rounded-xl text-slate-200 outline-none text-xs font-mono transition-all placeholder-slate-600 custom-scrollbar resize-y"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center space-x-2 py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(6,182,212,0.25)] text-sm mt-6"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{editingSongId ? "Updating Song..." : "Saving Song..."}</span>
                    </>
                  ) : (
                    <>
                      {editingSongId ? (
                        <>
                          <Edit className="w-5 h-5" />
                          <span>Update Track in sk edz</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-5 h-5" />
                          <span>Publish Song to sk edz</span>
                        </>
                      )}
                    </>
                  )}
                </button>

                {/* Status Display */}
                {statusMessage && (
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 text-xs text-center text-slate-300 font-mono backdrop-blur-md flex items-center justify-center space-x-2 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{statusMessage}</span>
                  </div>
                )}
              </form>
            </div>

            {/* Songs List Column */}
            <div className="lg:col-span-7 flex flex-col space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                      <Music className="w-5 h-5 text-indigo-400" />
                      <span>Track Library ({songs.length})</span>
                    </h2>
                    <p className="text-xs text-slate-400">All songs available for streaming on skplayer</p>
                  </div>
                  <div className="flex items-center space-x-2 self-start sm:self-auto flex-wrap gap-2">
                    {/* Find Duplicate Songs Button */}
                    <button
                      type="button"
                      onClick={() => setShowDuplicatesOnly(prev => !prev)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center space-x-2 ${
                        showDuplicatesOnly
                          ? "bg-amber-500/25 border-amber-400 text-amber-300 shadow-lg shadow-amber-500/20"
                          : duplicateGroups.length > 0
                          ? "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300"
                          : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-400 hover:text-slate-200"
                      }`}
                      title="Find songs with identical or duplicate names"
                    >
                      <Copy className="w-4 h-4 text-amber-400" />
                      <span>{showDuplicatesOnly ? "Showing Duplicates" : "Find Duplicate Songs"}</span>
                      {duplicateGroups.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-black text-[10px] font-black font-mono">
                          {duplicateGroups.length}
                        </span>
                      )}
                    </button>

                    <button 
                      onClick={fetchSongs} 
                      className="self-start sm:self-auto p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-all flex items-center space-x-1.5 text-xs font-medium"
                      title="Reload Tracks"
                    >
                      <Loader2 className={`w-4 h-4 ${loadingSongs ? "animate-spin" : ""}`} />
                      <span className="hidden sm:inline">Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Real-time Track Search & Category Filter Bar */}
                <div className="space-y-3 mb-5">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search tracks by song name, artist, album, genre..."
                      value={trackSearchTerm}
                      onChange={(e) => setTrackSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-black/40 border border-white/10 focus:border-cyan-400/60 rounded-2xl text-slate-100 placeholder-slate-500 text-xs outline-none transition-all focus:ring-1 focus:ring-cyan-400/30"
                    />
                    {trackSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setTrackSearchTerm("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded-md hover:bg-white/10 transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Category filter pills */}
                  <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 custom-scrollbar">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDuplicatesOnly(false);
                        setTrackFilterCategory("all");
                      }}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all border whitespace-nowrap ${
                        !showDuplicatesOnly && trackFilterCategory === "all"
                          ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                          : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                      }`}
                    >
                      All Tracks ({songs.length})
                    </button>

                    {/* Duplicate Songs Pill */}
                    <button
                      type="button"
                      onClick={() => setShowDuplicatesOnly(prev => !prev)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all border whitespace-nowrap flex items-center space-x-1.5 ${
                        showDuplicatesOnly
                          ? "bg-amber-500/25 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)] font-black"
                          : duplicateGroups.length > 0
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                          : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                      }`}
                    >
                      <Copy className="w-3 h-3 text-amber-400" />
                      <span>Duplicate Names ({duplicateGroups.length})</span>
                    </button>

                    {categories.map((cat) => {
                      const count = songs.filter((s) => s.categories && s.categories.includes(cat)).length;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setShowDuplicatesOnly(false);
                            setTrackFilterCategory(cat);
                          }}
                          className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all border whitespace-nowrap ${
                            !showDuplicatesOnly && trackFilterCategory === cat
                              ? "bg-indigo-500/20 border-indigo-400/50 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.2)]"
                              : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                          }`}
                        >
                          {cat} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {loadingSongs ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
                    <p className="text-sm font-mono text-slate-400">Syncing with Cloud Firestore...</p>
                  </div>
                ) : showDuplicatesOnly ? (
                  /* DEDICATED DUPLICATE SONGS INSPECTOR VIEW */
                  <div className="space-y-4 max-h-[680px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Header Banner */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/20 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 flex-shrink-0">
                          <Copy className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                            <span>Duplicate Songs Detector</span>
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black font-mono">
                              {duplicateGroups.length} Duplicate Titles ({totalDuplicateTracksCount} Tracks)
                            </span>
                          </h3>
                          <p className="text-xs text-slate-400">
                            Listing tracks that share the exact same title. Compare artists, audio files, and delete unwanted duplicates.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowDuplicatesOnly(false)}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold transition-colors self-start sm:self-auto flex items-center space-x-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>View All Tracks</span>
                      </button>
                    </div>

                    {filteredDuplicateGroups.length === 0 ? (
                      <div className="text-center py-16 px-4 bg-white/2 border border-white/5 rounded-2xl">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                        <h4 className="text-base font-bold text-slate-200">
                          {trackSearchTerm ? `No duplicate songs match "${trackSearchTerm}"` : "No duplicate songs found!"}
                        </h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                          {trackSearchTerm 
                            ? "Try searching for a different song name or clear your search to see all duplicates."
                            : "Every song in your track library has a unique title. No duplicate names detected."}
                        </p>
                      </div>
                    ) : (
                      filteredDuplicateGroups.map((group, groupIdx) => (
                        <div 
                          key={groupIdx}
                          className="bg-black/40 border border-amber-500/25 hover:border-amber-500/40 rounded-2xl p-4 transition-all shadow-md space-y-3"
                        >
                          {/* Group Title Bar */}
                          <div className="flex items-center justify-between pb-2.5 border-b border-white/5 flex-wrap gap-2">
                            <div className="flex items-center space-x-2">
                              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-mono font-bold flex items-center justify-center">
                                #{groupIdx + 1}
                              </span>
                              <h4 className="text-sm font-black text-amber-300 tracking-wide">
                                "{group.name}"
                              </h4>
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold">
                                {group.songs.length} copies found
                              </span>
                            </div>
                          </div>

                          {/* List of Copies for this Song Name */}
                          <div className="space-y-2.5">
                            {group.songs.map((song, copyIdx) => (
                              <div 
                                key={song.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 gap-3 transition-colors"
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  {/* Cover Art & Audio Preview Button */}
                                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-black/50 border border-white/10 flex-shrink-0">
                                    <img 
                                      src={song.imageUrl} 
                                      alt={song.title} 
                                      className="w-full h-full object-cover" 
                                      referrerPolicy="no-referrer"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => togglePreview(song)}
                                      className="absolute inset-0 bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors text-white"
                                      title="Listen to preview"
                                    >
                                      {previewSongId === song.id && isPlayingPreview ? (
                                        <Pause className="w-5 h-5 text-amber-400" />
                                      ) : (
                                        <Play className="w-5 h-5 text-white" />
                                      )}
                                    </button>
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-bold">
                                        Copy #{copyIdx + 1}
                                      </span>
                                      <h5 className="text-xs font-bold text-white truncate">
                                        {song.title}
                                      </h5>
                                    </div>
                                    <p className="text-[11px] text-slate-300 mt-0.5">
                                      Artist: <strong>{song.artist}</strong> • Album: {song.album || "Single"}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-mono">
                                      Duration: {formatTime(song.duration)} • Added: {new Date(song.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>

                                {/* Action Buttons for Duplicate Copy */}
                                <div className="flex items-center space-x-2 self-end sm:self-auto flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleKeepOneDeleteDuplicates(song, group.songs)}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-colors flex items-center space-x-1"
                                    title="Keep this copy and delete the others"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Keep This & Delete Others</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => startEditSong(song)}
                                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                                    title="Edit details"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSong(song.id)}
                                    className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 border border-red-500/20 transition-colors"
                                    title="Delete this copy"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : songs.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/5">
                    <Disc className="w-12 h-12 text-slate-500 mx-auto mb-3 animate-spin-slow" />
                    <h3 className="text-sm font-bold text-slate-300">No tracks published yet</h3>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">Use the upload tool on the left to add your favorite songs to skplayer library!</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[680px] overflow-y-auto pr-2 custom-scrollbar">
                    {songs
                      .filter((song) => {
                        const term = trackSearchTerm.trim().toLowerCase();
                        const matchesSearch =
                          !term ||
                          song.title.toLowerCase().includes(term) ||
                          song.artist.toLowerCase().includes(term) ||
                          (song.album && song.album.toLowerCase().includes(term)) ||
                          (song.categories && song.categories.some((c) => c.toLowerCase().includes(term)));
                        const matchesCategory =
                          trackFilterCategory === "all" ||
                          (song.categories && song.categories.includes(trackFilterCategory));
                        return matchesSearch && matchesCategory;
                      })
                      .map((song) => (
                      <div 
                        key={song.id} 
                        className="group relative flex items-center justify-between p-3.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all duration-300 hover:translate-x-1"
                      >
                        <div className="flex items-center space-x-3.5 min-w-0">
                          {/* Artwork */}
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex-shrink-0 shadow-lg">
                            <img 
                              src={song.imageUrl} 
                              alt={song.title} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                              referrerPolicy="no-referrer"
                            />
                            {/* Play/Pause icon overlay */}
                            <button
                              onClick={() => togglePreview(song)}
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300"
                            >
                              {previewSongId === song.id && isPlayingPreview ? (
                                <Pause className="w-5 h-5 text-cyan-400" />
                              ) : (
                                <Play className="w-5 h-5 text-white" />
                              )}
                            </button>
                          </div>

                          {/* Text Metadata */}
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm font-bold text-slate-200 truncate group-hover:text-cyan-400 transition-colors">
                                {song.title}
                              </h4>
                              <LyricBadge 
                                song={song} 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLyricsPreviewModalSong(song);
                                }}
                              />
                            </div>
                            <p className="text-xs text-slate-400 truncate mt-0.5">{song.artist}</p>

                            {song.album && (
                              <span className="inline-block mt-1 mr-1 text-[9px] font-mono px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-full">
                                {song.album}
                              </span>
                            )}
                            {song.categories && song.categories.map((cat) => (
                              <span key={cat} className="inline-block mt-1 mr-1 text-[9px] font-mono px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 rounded-full">
                                {cat}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Controls and duration */}
                        <div className="flex items-center space-x-2.5 ml-4 flex-shrink-0">
                          <span className="text-xs font-mono text-slate-400">{formatTime(song.duration)}</span>
                          
                          {/* Lyrics Preview Modal Trigger */}
                          {hasLyrics(song) && (
                            <button
                              onClick={() => setLyricsPreviewModalSong(song)}
                              className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 text-cyan-400 transition-all flex items-center space-x-1"
                              title="Inspect Lyrics"
                            >
                              <AlignLeft className="w-4 h-4" />
                              <span className="text-[10px] font-mono font-bold hidden sm:inline">L</span>
                            </button>
                          )}

                          <button
                            onClick={() => togglePreview(song)}
                            className={`p-2 rounded-xl transition-all ${
                              previewSongId === song.id && isPlayingPreview 
                                ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 animate-pulse" 
                                : "bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300"
                            }`}
                            title="Preview Track"
                          >
                            {previewSongId === song.id && isPlayingPreview ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={() => startEditSong(song)}
                            className={`p-2 rounded-xl transition-all ${
                              editingSongId === song.id 
                                ? "bg-amber-500/15 border border-amber-500/30 text-amber-400" 
                                : "bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-amber-400 hover:border-amber-500/20"
                            }`}
                            title="Edit Track Details"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteSong(song.id)}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all"
                            title="Delete Track"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {songs.filter((song) => {
                      const term = trackSearchTerm.trim().toLowerCase();
                      const matchesSearch =
                        !term ||
                        song.title.toLowerCase().includes(term) ||
                        song.artist.toLowerCase().includes(term) ||
                        (song.album && song.album.toLowerCase().includes(term)) ||
                        (song.categories && song.categories.some((c) => c.toLowerCase().includes(term)));
                      const matchesCategory =
                        trackFilterCategory === "all" ||
                        (song.categories && song.categories.includes(trackFilterCategory));
                      return matchesSearch && matchesCategory;
                    }).length === 0 && (
                      <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl bg-white/5">
                        <Search className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">No tracks match your search query "{trackSearchTerm}".</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Dedicated Find Duplicate Songs Dashboard Tab */}
        {activeTab === "duplicates" && (
          <div className="bg-white/5 border border-amber-500/25 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden animate-fade-in space-y-6">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10 relative z-10">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 flex-shrink-0 shadow-lg shadow-amber-500/10">
                  <Copy className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2.5 flex-wrap">
                    <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                      Find Duplicate Songs
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-black text-xs font-black font-mono">
                      {duplicateGroups.length} Duplicate Titles
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                    Listing tracks that share the exact same title. Compare audio previews, artists & artwork, and delete unwanted duplicate copies with 1-click.
                  </p>
                </div>
              </div>

              {/* Stats & Actions */}
              <div className="flex items-center space-x-3 self-start md:self-auto flex-wrap gap-2">
                <div className="px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-slate-300">
                  <span className="text-amber-400 font-bold">{totalDuplicateTracksCount}</span> Redundant Tracks
                </div>

                <button
                  type="button"
                  onClick={fetchSongs}
                  className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold transition-all flex items-center space-x-1.5"
                  title="Reload from Firestore"
                >
                  <Loader2 className={`w-3.5 h-3.5 ${loadingSongs ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("songs")}
                  className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all flex items-center space-x-1.5"
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>Tracks Manager</span>
                </button>
              </div>
            </div>

            {/* Real-time Search within Duplicates */}
            <div className="relative z-10">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search duplicate songs by song title or artist name..."
                value={duplicateSearchTerm}
                onChange={(e) => setDuplicateSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-black/40 border border-white/10 focus:border-amber-400/60 rounded-2xl text-slate-100 placeholder-slate-500 text-xs outline-none transition-all focus:ring-1 focus:ring-amber-400/30"
              />
              {duplicateSearchTerm && (
                <button
                  type="button"
                  onClick={() => setDuplicateSearchTerm("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded-md hover:bg-white/10 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Duplicate Groups List */}
            {loadingSongs ? (
              <div className="flex flex-col items-center justify-center py-20 relative z-10">
                <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
                <p className="text-sm font-mono text-slate-400">Scanning library for duplicate song titles...</p>
              </div>
            ) : filteredDuplicateGroups.length === 0 ? (
              <div className="text-center py-20 px-4 bg-white/2 border border-white/5 rounded-3xl relative z-10">
                <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-3" />
                <h4 className="text-base md:text-lg font-bold text-slate-200">
                  {duplicateSearchTerm ? `No duplicate songs match "${duplicateSearchTerm}"` : "No duplicate songs found!"}
                </h4>
                <p className="text-xs md:text-sm text-slate-400 max-w-md mx-auto mt-1">
                  {duplicateSearchTerm 
                    ? "Try searching for a different song name or clear your filter to see all duplicates."
                    : "Every song in your track library has a unique title. No duplicate names detected."}
                </p>
                {duplicateSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setDuplicateSearchTerm("")}
                    className="mt-4 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
                  >
                    Clear Search Filter
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
                {filteredDuplicateGroups.map((group, groupIdx) => (
                  <div 
                    key={groupIdx}
                    className="bg-black/50 border border-amber-500/25 hover:border-amber-500/40 rounded-2xl p-5 transition-all shadow-lg space-y-4"
                  >
                    {/* Group Title Bar */}
                    <div className="flex items-center justify-between pb-3 border-b border-white/5 flex-wrap gap-2">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-mono font-bold flex items-center justify-center">
                          #{groupIdx + 1}
                        </span>
                        <h4 className="text-base font-black text-amber-300 tracking-wide">
                          "{group.name}"
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">
                          {group.songs.length} copies found
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] text-slate-400 font-mono">
                          Action: Pick which copy to keep
                        </span>
                      </div>
                    </div>

                    {/* List of Copies for this Song Name */}
                    <div className="space-y-3">
                      {group.songs.map((song, copyIdx) => (
                        <div 
                          key={song.id}
                          className="flex flex-col lg:flex-row lg:items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 gap-3 transition-colors"
                        >
                          <div className="flex items-center space-x-3.5 min-w-0">
                            {/* Cover Art & Audio Preview Button */}
                            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-black/50 border border-white/10 flex-shrink-0">
                              <img 
                                src={song.imageUrl} 
                                alt={song.title} 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                              <button
                                type="button"
                                onClick={() => togglePreview(song)}
                                className="absolute inset-0 bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors text-white"
                                title="Listen to preview"
                              >
                                {previewSongId === song.id && isPlayingPreview ? (
                                  <Pause className="w-6 h-6 text-amber-400" />
                                ) : (
                                  <Play className="w-6 h-6 text-white" />
                                )}
                              </button>
                            </div>

                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center space-x-2">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-300 font-bold">
                                  Copy #{copyIdx + 1}
                                </span>
                                <h5 className="text-sm font-bold text-white truncate">
                                  {song.title}
                                </h5>
                              </div>
                              <p className="text-xs text-slate-300">
                                Artist: <strong className="text-white">{song.artist}</strong> • Album: <span className="text-slate-400">{song.album || "Single"}</span>
                              </p>
                              <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-mono">
                                <span>Duration: {formatTime(song.duration)}</span>
                                <span>•</span>
                                <span>Added: {new Date(song.createdAt).toLocaleDateString()}</span>
                                {song.categories && song.categories.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>{song.categories.join(", ")}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons for Duplicate Copy */}
                          <div className="flex items-center space-x-2 self-end lg:self-auto flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleKeepOneDeleteDuplicates(song, group.songs)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-sm"
                              title="Keep this copy and delete the others"
                            >
                              <Check className="w-4 h-4" />
                              <span>Keep This & Delete Others</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab("songs");
                                startEditSong(song);
                              }}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                              title="Edit track details"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSong(song.id)}
                              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 border border-red-500/20 transition-colors"
                              title="Delete this copy"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: VIP Keys Manager */}
        {activeTab === "keys" && (
          /* VIP Keys Manager Dashboard */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
            {/* Left/Top Column: Key Generation */}
            <div className="lg:col-span-5 bg-white/5 border border-amber-500/20 rounded-3xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="space-y-5">
                <div className="flex items-center space-x-2.5">
                  <Crown className="w-5 h-5 text-amber-400 animate-pulse fill-amber-400/20" />
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">Generate Subscription Key</h2>
                    <p className="text-xs text-slate-400">Create instant activation passcodes for users</p>
                  </div>
                </div>

                {/* Plan Selection Radio Cards */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider font-mono">
                    Select Plan Type *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Plan 1: ₹99 */}
                    <button
                      type="button"
                      onClick={() => setSelectedPlan(99)}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                        selectedPlan === 99
                          ? "bg-amber-500/20 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-sm font-black text-amber-300">₹99 Plan</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          1 MONTH
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-200">VIP Gold</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">30 Days Unlimited Access</p>
                    </button>

                    {/* Plan 2: ₹199 */}
                    <button
                      type="button"
                      onClick={() => setSelectedPlan(199)}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                        selectedPlan === 199
                          ? "bg-gradient-to-br from-amber-500/25 to-yellow-500/20 border-yellow-300 shadow-[0_0_25px_rgba(234,179,8,0.25)]"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-sm font-black text-yellow-300">₹199 Plan</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                          30 DAYS
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-200">VIP Master</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">30 Days Premium Pass</p>
                    </button>
                  </div>
                </div>

                {/* Optional Note / Customer Ref */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Customer Note / Transaction Ref (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GPay ₹99 from user@gmail.com / 9876543210"
                    value={customKeyNote}
                    onChange={(e) => setCustomKeyNote(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 focus:border-amber-400/50 rounded-xl text-slate-200 placeholder-slate-500 text-xs outline-none transition-all"
                  />
                </div>

                <button
                  onClick={handleGenerateVipKey}
                  disabled={generatingKey}
                  className="w-full flex items-center justify-center space-x-2 py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-[0_4px_20px_rgba(245,158,11,0.25)] text-xs uppercase"
                >
                  {generatingKey ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating ₹{selectedPlan} Passcode...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Generate ₹{selectedPlan} (30 Days) Key</span>
                    </>
                  )}
                </button>

                {statusMessage && (
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 text-xs text-center text-slate-300 font-mono backdrop-blur-md flex items-center justify-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{statusMessage}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right/Main Column: Keys List */}
            <div className="lg:col-span-7 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                    <Key className="w-5 h-5 text-amber-400" />
                    <span>Passcode Registry ({keysList.length})</span>
                  </h2>
                  <p className="text-xs text-slate-400">All generated ₹99 & ₹199 passcodes with 1-click copy</p>
                </div>

                {/* Filter by Plan */}
                <div className="flex items-center space-x-1.5 p-1 bg-black/40 rounded-xl border border-white/10 self-start sm:self-auto">
                  <button
                    onClick={() => setKeyFilterPlan("all")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      keyFilterPlan === "all" ? "bg-white/20 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setKeyFilterPlan("99")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      keyFilterPlan === "99" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    ₹99 Pass
                  </button>
                  <button
                    onClick={() => setKeyFilterPlan("199")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      keyFilterPlan === "199" ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    ₹199 Pass
                  </button>
                </div>
              </div>

              {loadingKeys ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
                  <p className="text-sm font-mono text-slate-400">Syncing key registry with database...</p>
                </div>
              ) : keysList.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/5">
                  <Key className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-300">No passcodes generated yet</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                    Select ₹99 or ₹199 plan and click generate to create activation keys!
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[580px] overflow-y-auto pr-2 custom-scrollbar">
                  {keysList.map((k) => (
                    <div
                      key={k.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-2xl gap-4 transition-all duration-300 hover:translate-x-1"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg text-sm tracking-wider shadow-[0_2px_8px_rgba(245,158,11,0.05)] select-all">
                            {k.code}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleCopyKey(k.code, k.id)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/30 text-slate-300 hover:text-amber-300 transition-all flex items-center space-x-1 text-xs"
                            title="Copy Key Code"
                          >
                            {copiedKeyId === k.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[10px] text-emerald-400 font-bold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span className="text-[10px]">Copy</span>
                              </>
                            )}
                          </button>
                          
                          {/* Plan Badge */}
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            k.plan === "199"
                              ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-300"
                              : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                          }`}>
                            {k.plan === "199" ? `👑 ₹199 (${k.durationDays || 30} Days)` : `💎 ₹99 (${k.durationDays || 30} Days)`}
                          </span>

                          {k.used ? (
                            <span className="text-[9px] font-mono font-black bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2 py-0.5 rounded uppercase">
                              USED
                            </span>
                          ) : k.status === "disabled" ? (
                            <span className="text-[9px] font-mono font-black bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded uppercase animate-pulse">
                              DISABLED
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase">
                              ACTIVE
                            </span>
                          )}
                        </div>

                        {k.note && (
                          <p className="text-xs text-slate-300 font-medium bg-black/30 px-2.5 py-1 rounded-lg border border-white/5 inline-block">
                            📝 {k.note}
                          </p>
                        )}
                        
                        <div className="text-[10px] text-slate-400 font-mono space-y-0.5 leading-relaxed">
                          <p>Created: {new Date(k.createdAt || Date.now()).toLocaleString()}</p>
                          {k.expiresAt && (
                            <p className="text-amber-300/90 font-bold">
                              Expiry Date: {k.expiresAtFormatted || new Date(k.expiresAt).toLocaleDateString()} ({new Date(k.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                            </p>
                          )}
                          {k.usedBy && (
                            <p className="text-slate-300">
                              Activated by User: <span className="text-amber-400 font-bold">{k.usedBy}</span>
                            </p>
                          )}
                          {k.usedAt && (
                            <p className="text-slate-400">
                              Activated on: {new Date(k.usedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 sm:self-center flex-shrink-0">
                        <button
                          onClick={() => handleToggleKeyStatus(k.id, k.status, k.used)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-black transition-all duration-300 uppercase ${
                            k.used || k.status === "disabled"
                              ? "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:scale-105"
                              : "bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400 hover:scale-105"
                          }`}
                          title={k.used || k.status === "disabled" ? "Activate or reset this code for use" : "Deactivate / disable this code"}
                        >
                          {k.used ? "Reset" : k.status === "disabled" ? "Enable" : "Disable"}
                        </button>
                        
                        <button
                          onClick={() => handleDeleteKey(k.id)}
                          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-black transition-all uppercase hover:scale-105"
                          title="Delete Key Code"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Admin Private Playlists Hub */}
        {activeTab === "playlists" && (
          <AdminPlaylistsManager
            songs={songs}
            onSongAdded={fetchSongs}
            onShowToast={showAdminToast}
          />
        )}

        {/* Tab 2: Artist Profiles Manager */}
        {activeTab === "artists" && (
          <AdminArtistsManager
            artists={artistsList}
            songs={songs}
            loading={loadingArtists}
            onSaveArtist={handleSaveArtistProfile}
            onDeleteArtist={handleDeleteArtistProfile}
            onAssignSongsToArtist={handleAssignSongsToArtist}
            onSelectArtistForSongUpload={(artistName, artistImg) => {
              setArtist(artistName);
              const found = artistsList.find((a) => a.name.toLowerCase() === artistName.toLowerCase());
              if (found) {
                setSelectedArtistId(found.id);
                setSelectedArtistImage(found.imageUrl);
              }
              if (artistImg && !imageUrl) {
                setImageUrl(artistImg);
                setImageStatus("available");
              }
              setActiveTab("songs");
              showAdminToast(`Selected artist "${artistName}" for song upload! 🎵`, "info");
            }}
            onUploadImage={(file) => uploadFileToServer(file, "image")}
            onShowToast={showAdminToast}
          />
        )}

        {/* Tab: Cloudinary Storage CDN */}
        {activeTab === "cloudinary" && (
          <AdminCloudinaryManager onShowToast={showAdminToast} />
        )}

        {/* Tab 4: Reports & Feedback Manager */}
        {activeTab === "reports" && (
          <AdminReportsManager
            reports={reports}
            loading={loadingReports}
            onUpdateStatus={handleUpdateReportStatus}
            onDeleteReport={handleDeleteReport}
            onBulkDeleteReports={handleBulkDeleteReports}
            isUpdating={isUpdatingReport}
            isDeletingId={isDeletingReportId}
            onShowToast={showAdminToast}
          />
        )}

        {/* Tab 5: Bulk / Multiple Songs Upload */}
        {activeTab === "batch" && (
          <AdminBulkUpload
            artistsList={artistsList}
            categories={categories}
            onSongAdded={fetchSongs}
            onShowToast={showAdminToast}
          />
        )}

        {/* Tab 6: Last Updated & System Changelog */}
        {activeTab === "updates" && (
          <AdminLastUpdated
            songs={songs}
            artistsList={artistsList}
            keysList={keysList}
            reports={reports}
            onShowToast={showAdminToast}
          />
        )}

        {/* Floating Admin Toast Feedback */}
        {adminToast && (
          <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
            <div className={`px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-2xl border flex items-center space-x-3 text-xs font-mono font-bold ${
              adminToast.type === "error"
                ? "bg-red-950/90 border-red-500/40 text-red-200 shadow-red-500/20"
                : adminToast.type === "info"
                ? "bg-sky-950/90 border-sky-500/40 text-sky-200 shadow-sky-500/20"
                : "bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-500/20"
            }`}>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{adminToast.text}</span>
            </div>
          </div>
        )}

        {/* Lyrics Preview Modal */}
        {lyricsPreviewModalSong && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0b0f19] border border-white/10 rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center space-x-3">
                  <img 
                    src={lyricsPreviewModalSong.imageUrl} 
                    alt={lyricsPreviewModalSong.title} 
                    className="w-10 h-10 rounded-xl object-cover border border-white/10"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-white truncate max-w-xs">{lyricsPreviewModalSong.title}</h3>
                    <p className="text-xs text-slate-400">{lyricsPreviewModalSong.artist}</p>
                  </div>
                </div>
                <button
                  onClick={() => setLyricsPreviewModalSong(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-cyan-400 font-bold">
                    {parseLyrics(lyricsPreviewModalSong.lyrics).isSynced ? "● Synced LRC Format" : "● Plain Text Lyrics"}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {parseLyrics(lyricsPreviewModalSong.lyrics).lines.length} lines detected
                  </span>
                </div>

                {lyricsPreviewModalSong.lyricsUrl && (
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs font-mono text-slate-400 truncate">
                    <span className="text-cyan-400">URL:</span> {lyricsPreviewModalSong.lyricsUrl}
                  </div>
                )}

                <div className="bg-black/50 border border-white/10 rounded-2xl p-4 font-mono text-xs text-slate-300 max-h-96 overflow-y-auto space-y-1.5 custom-scrollbar select-text">
                  {lyricsPreviewModalSong.lyrics ? (
                    lyricsPreviewModalSong.lyrics.split("\n").map((line, i) => (
                      <div key={i} className="hover:text-cyan-300 transition-colors">
                        {line || " "}
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 italic">No direct text stored; loading from external URL at playback.</p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    startEditSong(lyricsPreviewModalSong);
                    setLyricsPreviewModalSong(null);
                  }}
                  className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold"
                >
                  Edit in Song Form
                </button>
                <button
                  onClick={() => setLyricsPreviewModalSong(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-[11px] text-slate-500 font-mono border-t border-white/5 pt-6">
          <p>skplayer Admin Console — Powered by Local Storage & Firebase Firestore</p>
          <p className="mt-1 text-[10px] text-slate-600">Created with Glassmorphism Liquid Theme</p>
        </footer>
      </div>
    </div>
  );
}

// Render app
createRoot(document.getElementById("admin-root")!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>
);
