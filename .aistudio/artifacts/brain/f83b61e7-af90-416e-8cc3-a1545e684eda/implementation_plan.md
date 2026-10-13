# YouTube-Style Video Player & Admin Video Management

A full-fledged YouTube-style video playback and management system seamlessly integrated into the ZYNC platform. This delivers dedicated video streaming for community-hosted and YouTube streams with dynamic quality switching (4K/1080p/720p/480p), ImgBB-powered thumbnail uploads in Admin, YouTube-style engagement actions, and effortless navigation between video and music playback.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX specifications were clarified and confirmed during Phase 1:

- **Confirmed Decision 1 (Video Source Support)**: Supports both YouTube embed URLs (standard and short URLs) and custom direct hosted video streams (MP4/WebM/HLS). Both play reliably with unified responsive playback controls.
- **Confirmed Decision 2 (Resolution / Quality Switching)**: Dual-mode quality selector:
  - For custom hosted streams, the video player includes a resolution switcher allowing users to choose between 4K, 1080p, 720p, and 480p streams configured in Admin, preserving playback position seamlessly across resolution changes.
  - For YouTube streams, native YouTube multi-resolution controls and embeds handle adaptive streaming smoothly.
- **Confirmed Decision 3 (ImgBB Thumbnail Upload)**: Uses the existing ImgBB integration in the app (`IMGBB_KEY: 7a39d89ccdbcf9a749363143c7b6009f`) for 1-click thumbnail/cover image uploading in the Admin video tab, alongside direct image URL input. Restricted exclusively to the Admin dashboard.
- **Confirmed Decision 4 (Database Video Isolation)**: Up-next recommendations, video feeds, and search display only videos registered in the Firestore database (`videos` collection). No random uncurated third-party feeds.
- **Confirmed Decision 5 (Music Navigation Anchor)**: A prominent "🎵 Go to Music" button positioned at the top of the video player view lets users immediately return to the main music experience, automatically pausing video playback so audio does not overlap.

---

### 1. Overview & Core Concept

- **What It Does**: Adds a dedicated "Videos" section to the app navigation alongside a full-featured YouTube-like video viewing experience. Users can stream high-definition music videos, live performances, and community clips. In the Admin panel, administrators can add and manage video records with titles, channel/artist names, descriptions, video URLs, resolution streams, and thumbnails uploaded directly via ImgBB.
- **Target Audience / Persona**: Music listeners and fans who want to watch official music videos and concert footage without leaving ZYNC, as well as administrators curating multimedia content.
- **Key Value**: Provides an immersive video experience matching YouTube's familiar layout (player, title, channel info, like button, comments/details, and Up Next video feed) while retaining full harmony with the core music player.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Browsing Videos**: User clicks "Videos" tab in the desktop sidebar or mobile bottom navigation bar. A responsive grid of video cards appears (thumbnail, duration badge, title, creator, views, relative timestamp).
  2. **Watching a Video**: User clicks any video card. An animated transition opens the YouTube-like player view:
     - Top bar features a prominent "← Back to Music" / "🎵 Go to Music" button with clear breadcrumbs.
     - 16:9 responsive theater video player with full custom controls: Play/Pause, Seekbar, Current Time / Duration, Volume / Mute, Quality Selector (4K, 1080p, 720p, 480p, Auto), and Fullscreen.
     - Below video: Video title, view counter, published date, channel/artist avatar and name with Subscribe button.
     - Action bar: Like button (with animated counter), Dislike, Share (copies URL to clipboard), and Save to Watch Later.
     - Expandable description box with category tags and details.
     - "Up Next / Related Videos" section below (mobile) or right sidebar (desktop) listing other database videos. Clicking any video switches playback with a smooth intro transition.
  3. **Returning to Music**: User taps "Go to Music" or any music track. Video playback pauses immediately, and the app seamlessly returns to the music player.
  4. **Admin Video Management**: Admin navigates to the Admin Panel > "Videos" tab. Admin can:
     - Input Title, Creator / Channel Name, Category, Description.
     - Provide primary Video URL (YouTube or direct link).
     - Optionally configure multi-resolution stream URLs (4K, 1080p, 720p, 480p).
     - Upload thumbnail to ImgBB with live progress or enter a direct image URL.
     - Save to Firestore database, edit existing videos, or delete obsolete videos.

- **Visual Identity & Theme**:
  - Consistent with ZYNC's refined dark theme (`#070a12` dark background, `#0f1422` card surfaces, subtle `#1e293b` hairline borders).
  - Accent colors: YouTube-style subtle ruby red (`#ef4444`) for video badges/progress, paired with ZYNC's cyan (`#06b6d4`) highlights.
  - Zero-pill metadata formatting: inline quiet typography with dot separators (`1.2M views · 2 weeks ago · Official MV`).

- **Interactive Feedback & Motion**:
  - Tactile button press animations on Like/Dislike/Share.
  - Smooth resolution switching without video restart (preserves `currentTime` and playing state).
  - ImgBB upload status indicator with progress percentage and instant preview thumbnail.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: YouTube Embed vs. HTML5 Video Player Integration**
  - *Chosen Approach*: A hybrid smart player (`VideoPlayer.tsx`). Detects YouTube URLs (both `youtube.com/watch?v=...`, `youtu.be/...`, and `youtube.com/embed/...`) and renders an optimized YouTube iframe with privacy-enhanced controls. For direct MP4/WebM/HLS streams, renders a custom HTML5 video player with resolution switcher.
  - *Why*: Allows seamless support for both creator-hosted direct video files and external YouTube links without broken players.
  - *Alternatives Considered*: Enforcing only direct MP4 files (would break YouTube links) or only YouTube embeds (would block user's self-hosted video streams).

- **Decision 2: Resolution Switching Architecture**
  - *Chosen Approach*: Admin specifies individual stream URLs for target resolutions (e.g., 4K, 1080p, 720p, 480p) or provides a master URL. The custom player exposes a clean resolution dropdown. When switching, it copies `video.currentTime`, switches `video.src`, awaits `loadedmetadata`, and resumes playback at the exact second.
  - *Why*: Provides true multi-bitrate/resolution switching without requiring expensive server-side transcoding infrastructure on the client.
  - *Alternatives Considered*: Real-time client-side FFmpeg transcoding (prohibitively slow in-browser, high CPU/battery drain on mobile).

- **Decision 3: ImgBB API Integration in Admin**
  - *Chosen Approach*: Direct client-side `fetch` POST to `https://api.imgbb.com/1/upload?key=7a39d89ccdbcf9a749363143c7b6009f` using `FormData`. Automatically receives the hosted CDN URL and populates the thumbnail field.
  - *Why*: Uses the verified ImgBB key already present in the codebase, requires zero backend proxy overhead, and provides instant image hosting.
  - *Alternatives Considered*: Storing images in Firestore base64 (Firestore documents have strict 1MB limits).

- **Decision 4: Music & Video Audio Concurrency Control**
  - *Chosen Approach*: Global audio coordinator: When a video begins playback, the global audio player (`audioRef`) is automatically paused. Conversely, clicking "Go to Music" or playing a song pauses the video player.
  - *Why*: Prevents chaotic dual audio playback between background music and video audio.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌────────────────────────────────────────────────────────────────────────┐
│                          ZYNC CLIENT APPLICATION                       │
│                                                                        │
│  ┌───────────────────────┐      ┌───────────────────────────────────┐  │
│  │   Navigation & Tabs   │      │        Active Playback Mode       │  │
│  │  Home | Search |      │      │                                   │  │
│  │  Videos | Playlists   │      │   [Music Player] ⇄ [Video Player] │  │
│  └───────────┬───────────┘      └─────────────────┬─────────────────┘  │
│              │                                    │                    │
│              ▼                                    ▼                    │
│  ┌───────────────────────┐      ┌───────────────────────────────────┐  │
│  │   Video Discovery     │      │   YouTube-Style Video Experience  │  │
│  │   - Grid of Cards     │────► │   - Responsive 16:9 Viewport      │  │
│  │   - Database-Only     │      │   - Quality Selector (4K-480p)    │  │
│  │   - Category Filters  │      │   - Likes, Share, "Go to Music"   │  │
│  └───────────────────────┘      │   - "Up Next" Database List       │  │
│                                 └─────────────────┬─────────────────┘  │
│                                                   │                    │
│  ┌───────────────────────┐                        │                    │
│  │   Admin Video Tab     │                        │                    │
│  │   - Add/Edit Videos   │                        │                    │
│  │   - Multi-res Streams │                        │                    │
│  │   - ImgBB Upload      │                        │                    │
│  └───────────┬───────────┘                        │                    │
│              │                                    │                    │
└──────────────┼────────────────────────────────────┼────────────────────┘
               │                                    │
               ▼                                    ▼
┌───────────────────────────────┐  ┌────────────────────────────────────┐
│      ImgBB Image Host         │  │        Firestore Database          │
│  api.imgbb.com/1/upload       │  │        Collection: "videos"        │
│  Key: 7a39d89ccdbcf9a...      │  │  - title, creator, videoUrl,      │
│                               │  │    resolutions, thumbnailUrl,      │
│                               │  │    likes, views, createdAt         │
└───────────────────────────────┘  └────────────────────────────────────┘
```

#### Data Model (`src/types.ts` / Firestore `videos` collection):
```typescript
export interface VideoItem {
  id: string;
  title: string;
  creator: string; // Artist or Channel name
  description: string;
  category: string;
  videoUrl: string; // Primary stream URL or YouTube link
  isYouTube: boolean;
  resolutions?: {
    "4k"?: string;
    "1080p"?: string;
    "720p"?: string;
    "480p"?: string;
  };
  thumbnailUrl: string;
  duration?: number;
  likes: number;
  views: number;
  createdAt: number;
}
```

#### Interactive Component & State Mapping:
- **`src/components/VideoView.tsx`**: Main video browse feed and YouTube-like playback view with "Go to Music" navigation, quality switcher, interactive Like/Dislike, and Up Next video queue.
- **`src/components/VideoPlayer.tsx`**: Modular video component handling YouTube embed vs. HTML5 multi-resolution switching with timestamp preservation.
- **`src/admin.tsx` (Videos Tab)**: Complete form for metadata, YouTube/hosted URL validation, resolution stream entries, ImgBB file upload button with preview, and video deletion/editing controls.
- **`src/App.tsx`**: Integration of the `"videos"` tab in desktop navigation, mobile tab bar, and audio/video playback coordinator.
