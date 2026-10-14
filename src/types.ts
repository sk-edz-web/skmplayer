export interface Song {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artistImage?: string;
  album?: string;
  audioUrl: string;
  imageUrl: string;
  duration: number; // in seconds
  createdAt: number;
  uploadedBy?: string;
  categories?: string[];
  lyrics?: string;
  lyricsUrl?: string;
}

export interface ArtistProfile {
  id: string;
  name: string;
  imageUrl: string;
  bio?: string;
  genre?: string;
  monthlyListeners?: string | number;
  instagram?: string;
  spotify?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface Playlist {
  id: string;
  name: string;
  userId: string;
  songIds: string[];
  createdAt: number;
  thumbnailUrl?: string;
  isPrivate?: boolean;
  description?: string;
  updatedAt?: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  vip?: boolean;
  vipkey?: string;
  expire?: string;
  vipExpiresAt?: number;
  plan?: string | number;
  updatedAt?: number;
  createdAt?: number;
  isPro?: boolean;
  proKey?: string;
  proActivatedAt?: number;
  proExpiresAt?: number;
  proExpiresAtDate?: string;
  proExpiresAtFormatted?: string;
  planName?: string;
  tier?: string;
  keyStatus?: string;
}

export interface SubscriptionKey {
  id?: string;
  code: string;
  plan: number;
  planName: string;
  price: number;
  durationDays: number;
  note?: string;
  used: boolean;
  user?: string;
  expire?: string;
  usedBy?: string;
  userId?: string;
  activatedBy?: string;
  activatedUserId?: string;
  activatedAt?: number | string;
  usedAt?: number;
  status: "active" | "disabled" | "used";
  createdAt: number;
  expiresAt?: number;
  expiresAtDate?: string;
  expiresAtFormatted?: string;
}

export interface VideoItem {
  id: string;
  userId?: string;
  title: string;
  creator?: string; // Channel or artist name
  description?: string;
  category?: string;
  url: string; // Video URL (YouTube or direct stream)
  videoUrl?: string; // Fallback alias
  type?: "youtube" | "direct" | "my_media";
  isYouTube?: boolean;
  resolutions?: {
    "4k"?: string;
    "1080p"?: string;
    "720p"?: string;
    "480p"?: string;
  };
  thumbnailUrl?: string;
  duration?: number; // duration in seconds
  likes?: number;
  views?: number;
  createdAt: number;
}

export type ReportStatus = "open" | "seen" | "under_review" | "processing" | "done";

export interface ReportItem {
  id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  userPhoto?: string;
  userPhone?: string;
  contactPreference?: "call" | "message" | "whatsapp" | "email";
  requestType?: "report" | "call_request" | "message_request" | "subscription" | string;
  isVIP?: boolean;
  proKey?: string;
  title?: string;
  category?: "song_issue" | "audio_glitch" | "ui_bug" | "vip_issue" | "suggestion" | "call_request" | "message_request" | "subscription_help" | "other" | string;
  description: string;
  songId?: string;
  songTitle?: string;
  songArtist?: string;
  deviceInfo?: string;
  appVersion?: string;
  status: ReportStatus;
  adminNotes?: string;
  adminReply?: string;
  createdAt: number;
  updatedAt?: number;
  priority?: "vip" | "normal";
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "report_update" | "vip_info" | "system";
  reportId?: string;
  status?: ReportStatus | string;
  read: boolean;
  createdAt: number;
}
