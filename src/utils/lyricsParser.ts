import { Song } from "../types";

export interface LyricLine {
  time: number; // in seconds (-1 if non-synced plain text)
  text: string;
}

export interface ParsedLyrics {
  lines: LyricLine[];
  isSynced: boolean;
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
    offset?: number;
  };
}

/**
 * Checks whether a song has lyrics available (either embedded string or external URL).
 */
export function hasLyrics(song?: Song | null): boolean {
  if (!song) return false;
  const hasEmbedded = typeof song.lyrics === "string" && song.lyrics.trim().length > 0;
  const hasUrl = typeof song.lyricsUrl === "string" && song.lyricsUrl.trim().length > 0;
  return Boolean(hasEmbedded || hasUrl);
}

/**
 * Converts mm:ss.xx or mm:ss or hh:mm:ss.xx to seconds
 */
export function parseTimestampToSeconds(ts: string): number | null {
  const clean = ts.trim();
  // Format: [hh:]mm:ss[.xx/xxx]
  const parts = clean.split(":");
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]);
    const secs = parseFloat(parts[1]);
    if (!isNaN(mins) && !isNaN(secs)) {
      return mins * 60 + secs;
    }
  } else if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const mins = parseFloat(parts[1]);
    const secs = parseFloat(parts[2].replace(",", "."));
    if (!isNaN(hours) && !isNaN(mins) && !isNaN(secs)) {
      return hours * 3600 + mins * 60 + secs;
    }
  }
  return null;
}

/**
 * Parses LRC formatted text with support for:
 * - standard [mm:ss.xx] line
 * - multiple tags per line: [00:10.50][00:30.20] repeated line
 * - metadata tags [ti:Title], [ar:Artist], [al:Album], [offset:500]
 */
export function parseLrc(content: string): ParsedLyrics {
  const rawLines = content.split(/\r?\n/);
  const parsedLines: LyricLine[] = [];
  const metadata: ParsedLyrics["metadata"] = {};
  let isSynced = false;
  let offsetMs = 0;

  const tagRegex = /\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g;
  const metaRegex = /\[(ti|ar|al|offset):([^\]]+)\]/i;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check metadata tags
    const metaMatch = trimmed.match(metaRegex);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const val = metaMatch[2].trim();
      if (key === "ti") metadata.title = val;
      if (key === "ar") metadata.artist = val;
      if (key === "al") metadata.album = val;
      if (key === "offset") {
        const parsedOffset = parseInt(val, 10);
        if (!isNaN(parsedOffset)) offsetMs = parsedOffset;
      }
      continue;
    }

    // Check timestamp tags
    const matches = Array.from(trimmed.matchAll(tagRegex));
    if (matches.length > 0) {
      isSynced = true;
      // Extract text after all timestamp brackets
      const text = trimmed.replace(tagRegex, "").trim();
      for (const m of matches) {
        const timeSec = parseTimestampToSeconds(m[1]);
        if (timeSec !== null) {
          const finalTime = Math.max(0, timeSec + offsetMs / 1000);
          parsedLines.push({
            time: finalTime,
            text: text || "♪"
          });
        }
      }
    }
  }

  if (isSynced && parsedLines.length > 0) {
    parsedLines.sort((a, b) => a.time - b.time);
    return { lines: parsedLines, isSynced: true, metadata };
  }

  return { lines: [], isSynced: false, metadata };
}

/**
 * Parses SRT / VTT subtitle format into timestamped lyrics
 */
export function parseSrtOrVtt(content: string): ParsedLyrics {
  const blocks = content.replace(/\r/g, "").split("\n\n");
  const parsedLines: LyricLine[] = [];

  const timeRegex = /(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}|\d{1,2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}|\d{1,2}:\d{2}[,\.]\d{1,3})/;

  for (const block of blocks) {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(timeRegex);
      if (match) {
        const startSec = parseTimestampToSeconds(match[1]);
        const textLines = lines.slice(i + 1).map(t => t.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
        const text = textLines.join(" ");
        if (startSec !== null && text) {
          parsedLines.push({
            time: startSec,
            text
          });
        }
        break;
      }
    }
  }

  if (parsedLines.length > 0) {
    parsedLines.sort((a, b) => a.time - b.time);
    return { lines: parsedLines, isSynced: true };
  }

  return { lines: [], isSynced: false };
}

/**
 * Parses plain text lyrics without timestamps
 */
export function parsePlainText(content: string): ParsedLyrics {
  const rawLines = content.split(/\r?\n/).map(l => l.trim());
  const lines: LyricLine[] = [];

  for (const line of rawLines) {
    if (line.length > 0) {
      lines.push({
        time: -1,
        text: line
      });
    }
  }

  return {
    lines,
    isSynced: false
  };
}

/**
 * Universal lyrics parser: detects format automatically (LRC, SRT/VTT, Plain Text)
 */
export function parseLyrics(content: string | undefined | null): ParsedLyrics {
  if (!content || !content.trim()) {
    return { lines: [], isSynced: false };
  }

  const trimmed = content.trim();

  // Try LRC first if timestamp brackets exist
  if (/\[\d{1,2}:\d{2}/.test(trimmed)) {
    const lrcResult = parseLrc(trimmed);
    if (lrcResult.isSynced && lrcResult.lines.length > 0) {
      return lrcResult;
    }
  }

  // Try SRT / VTT if arrow arrows exist
  if (/-->/.test(trimmed)) {
    const srtResult = parseSrtOrVtt(trimmed);
    if (srtResult.isSynced && srtResult.lines.length > 0) {
      return srtResult;
    }
  }

  // Fallback to plain text
  return parsePlainText(trimmed);
}

/**
 * Fetches lyrics text from a direct URL with timeout and fallback
 */
export async function fetchLyricsFromUrl(url: string): Promise<string> {
  if (!url || !url.trim().startsWith("http")) {
    throw new Error("Invalid URL provided");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/plain, text/lrc, text/vtt, text/srt, application/octet-stream, */*"
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to load lyrics: HTTP ${response.status}`);
    }

    return await response.text();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Lyrics fetch request timed out.");
    }
    throw err;
  }
}

/**
 * Finds index of currently active lyric line given currentTime
 */
export function findActiveLyricIndex(lines: LyricLine[], currentTime: number): number {
  if (!lines || lines.length === 0) return -1;
  if (lines[0].time === -1) return -1; // Plain text not synced

  let activeIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (currentTime >= lines[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }
  return activeIndex;
}
