/**
 * Utilities for video handling, YouTube ID extraction, metadata & duration auto-detection, and ImgBB uploading
 */

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const cleanUrl = url.trim();
  // Support 11-char direct video ID
  if (cleanUrl.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
    return cleanUrl;
  }
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/;
  const match = cleanUrl.match(regExp);
  return match && match[1] ? match[1] : null;
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null;
}

export function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;

  if (hrs > 0) {
    return `${hrs}:${remMins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatViewCount(views?: number): string {
  const count = Math.max(0, Number(views) || 0);
  if (count === 0) return "0 views";
  if (count === 1) return "1 view";
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M views`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K views`;
  }
  return `${count.toLocaleString()} views`;
}

export function timeAgo(timestamp: number): string {
  if (!timestamp) return "Recently";
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} ${years === 1 ? "year" : "years"} ago`;
  if (months > 0) return `${months} ${months === 1 ? "month" : "months"} ago`;
  if (days > 0) return `${days} ${days === 1 ? "day" : "days"} ago`;
  if (hours > 0) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  if (minutes > 0) return `${minutes} ${minutes === 1 ? "min" : "mins"} ago`;
  return "Just now";
}

export interface AutoDetectedVideoMeta {
  title: string;
  creator: string;
  duration: number; // in seconds
  description: string;
  category: string;
  thumbnailUrl: string;
  isYouTube: boolean;
  videoId?: string | null;
}

// Client-side loader for YouTube IFrame Player API
let ytApiPromise: Promise<any> | null = null;
export function loadYouTubeIframeApi(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("Window not defined"));
  if ((window as any).YT && (window as any).YT.Player) {
    return Promise.resolve((window as any).YT);
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    // If YT.Player is already ready, resolve immediately
    if ((window as any).YT && (window as any).YT.Player) {
      resolve((window as any).YT);
      return;
    }

    // Safety polling fallback in case onYouTubeIframeAPIReady already fired
    let pollCount = 0;
    const pollTimer = setInterval(() => {
      pollCount++;
      if ((window as any).YT && (window as any).YT.Player) {
        clearInterval(pollTimer);
        resolve((window as any).YT);
      } else if (pollCount > 100) {
        clearInterval(pollTimer);
      }
    }, 100);

    const existing = document.getElementById("youtube-iframe-api-script");
    if (!existing) {
      const tag = document.createElement("script");
      tag.id = "youtube-iframe-api-script";
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.body.appendChild(tag);
    }
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      clearInterval(pollTimer);
      if (typeof prev === "function") prev();
      resolve((window as any).YT);
    };
  });

  return ytApiPromise;
}

/**
 * Detect exact duration for YouTube video via YouTube IFrame API
 */
export async function detectYouTubeDurationViaIFrame(videoId: string): Promise<number | null> {
  try {
    const YT = await loadYouTubeIframeApi();
    return new Promise((resolve) => {
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.width = "10px";
      container.style.height = "10px";
      container.style.opacity = "0.001";
      container.style.top = "-9999px";
      container.style.pointerEvents = "none";
      document.body.appendChild(container);

      let finished = false;
      let playerInstance: any = null;

      const cleanup = (val: number | null) => {
        if (!finished) {
          finished = true;
          try {
            if (playerInstance && typeof playerInstance.destroy === "function") {
              playerInstance.destroy();
            }
          } catch (e) {
            // ignore
          }
          if (container && container.parentNode) {
            container.parentNode.removeChild(container);
          }
          resolve(val);
        }
      };

      const timer = setTimeout(() => cleanup(null), 6000);

      try {
        playerInstance = new YT.Player(container, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0
          },
          events: {
            onReady: (e: any) => {
              clearTimeout(timer);
              const dur = Math.round(e.target.getDuration() || 0);
              cleanup(dur > 0 ? dur : null);
            },
            onError: () => {
              clearTimeout(timer);
              cleanup(null);
            }
          }
        });
      } catch (err) {
        clearTimeout(timer);
        cleanup(null);
      }
    });
  } catch (err) {
    console.warn("YouTube iframe API duration check failed:", err);
    return null;
  }
}

/**
 * Detect exact duration for direct video files (MP4, WebM, etc.)
 */
export async function detectDirectVideoDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = url;

      let finished = false;
      const cleanup = (val: number | null) => {
        if (!finished) {
          finished = true;
          video.src = "";
          resolve(val);
        }
      };

      const timer = setTimeout(() => cleanup(null), 5000);

      video.onloadedmetadata = () => {
        clearTimeout(timer);
        const dur = Math.round(video.duration || 0);
        cleanup(dur > 0 ? dur : null);
      };

      video.onerror = () => {
        clearTimeout(timer);
        cleanup(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Main auto-detect function for YouTube and direct video links
 * Fetches title, channel/creator, exact duration, thumbnail, description & category
 */
export async function autoDetectVideoDetails(url: string): Promise<AutoDetectedVideoMeta> {
  const cleanUrl = url.trim();
  const ytId = extractYouTubeId(cleanUrl);

  // 1. Try server-side auto-detector endpoint first
  try {
    const res = await fetch(`/api/video-info?url=${encodeURIComponent(cleanUrl)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && (data.title || data.duration)) {
        let accurateDuration = data.duration;
        // If duration wasn't found by server or seems default, verify via client YouTube API
        if ((!accurateDuration || accurateDuration === 215) && ytId) {
          const clientDur = await detectYouTubeDurationViaIFrame(ytId);
          if (clientDur && clientDur > 0) {
            accurateDuration = clientDur;
          }
        }

        return {
          title: data.title || "",
          creator: data.creator || "",
          duration: accurateDuration || 0,
          description: data.description || "",
          category: data.category || "Music Video",
          thumbnailUrl: data.thumbnailUrl || (ytId ? `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg` : ""),
          isYouTube: data.isYouTube ?? (ytId !== null),
          videoId: data.videoId || ytId
        };
      }
    }
  } catch (err) {
    console.warn("Server /api/video-info call error:", err);
  }

  // 2. Client-side fallback if server endpoint is unavailable or fails
  if (ytId) {
    let title = "";
    let creator = "";
    let thumbnailUrl = `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`;

    // Try noembed & oEmbed directly from browser
    try {
      const noembedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytId}`);
      if (noembedRes.ok) {
        const noembed = await noembedRes.json();
        if (noembed.title) title = noembed.title;
        if (noembed.author_name) creator = noembed.author_name;
        if (noembed.thumbnail_url) thumbnailUrl = noembed.thumbnail_url;
      }
    } catch (e) {
      // try youtube oembed
      try {
        const ytOembed = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`);
        if (ytOembed.ok) {
          const odata = await ytOembed.json();
          if (odata.title) title = odata.title;
          if (odata.author_name) creator = odata.author_name;
          if (odata.thumbnail_url) thumbnailUrl = odata.thumbnail_url;
        }
      } catch (err) {
        console.warn("Client oembed error:", err);
      }
    }

    // Detect exact duration via YouTube IFrame API
    const accurateDuration = await detectYouTubeDurationViaIFrame(ytId);

    // Infer category
    let category = "Music Video";
    if (title) {
      const lower = title.toLowerCase();
      if (lower.includes("live") || lower.includes("concert")) category = "Live Concert";
      else if (lower.includes("remix")) category = "Remix";
      else if (lower.includes("lofi") || lower.includes("lo-fi") || lower.includes("acoustic")) category = "Lofi / Acoustic";
      else if (lower.includes("audio") || lower.includes("lyric")) category = "Official Audio";
      else if (lower.includes("video") || lower.includes("song")) category = "Music Video";
    }

    const description = title 
      ? `${title}${creator ? ` by ${creator}` : ""}. Available to stream on ZYNC.` 
      : "";

    return {
      title,
      creator,
      duration: accurateDuration || 0,
      description,
      category,
      thumbnailUrl,
      isYouTube: true,
      videoId: ytId
    };
  }

  // 3. Direct video file fallback (e.g. mp4, webm)
  const directDuration = await detectDirectVideoDuration(cleanUrl);
  return {
    title: "",
    creator: "",
    duration: directDuration || 0,
    description: "",
    category: "Music Video",
    thumbnailUrl: "",
    isYouTube: false,
    videoId: null
  };
}

/**
 * Upload an image file directly to ImgBB using the project's verified key
 */
export async function uploadToImgBB(
  file: File, 
  onProgress?: (percent: number) => void
): Promise<string> {
  const IMGBB_KEY = "7a39d89ccdbcf9a749363143c7b6009f";
  const formData = new FormData();
  formData.append("image", file);

  if (onProgress) onProgress(20);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: "POST",
    body: formData,
  });

  if (onProgress) onProgress(80);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ImgBB upload failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (onProgress) onProgress(100);

  if (data.success && data.data) {
    return data.data.display_url || data.data.url;
  }
  throw new Error(data.error?.message || "Failed to retrieve uploaded image URL from ImgBB");
}
