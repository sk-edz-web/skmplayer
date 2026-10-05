/**
 * Advanced Client-Side Audio Metadata & Cover Art Extractor
 * Extracts Title, Artist, Album, Duration, Lyrics, and Embedded Album Art (APIC/covr)
 * from MP3 (ID3v2.2, ID3v2.3, ID3v2.4, ID3v1) and M4A/AAC files directly in browser.
 */

export interface ExtractedAudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  duration?: number; // duration in seconds
  lyrics?: string;
  coverBlob?: Blob;
  coverFile?: File;
  coverDataUrl?: string;
  mimeType?: string;
}

/**
 * Decode text bytes according to ID3 encoding flag:
 * 0 = ISO-8859-1 (Latin-1)
 * 1 = UTF-16 with BOM
 * 2 = UTF-16BE without BOM
 * 3 = UTF-8
 */
function decodeTextFrame(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) {
      // Latin1 / ISO-8859-1
      let end = bytes.indexOf(0);
      const sub = end === -1 ? bytes : bytes.subarray(0, end);
      return new TextDecoder("latin1").decode(sub).trim();
    } else if (encoding === 3) {
      // UTF-8
      let end = bytes.indexOf(0);
      const sub = end === -1 ? bytes : bytes.subarray(0, end);
      return new TextDecoder("utf-8").decode(sub).trim();
    } else if (encoding === 1) {
      // UTF-16 with BOM
      // Terminated by 0x00 0x00
      let end = -1;
      for (let i = 0; i < bytes.length - 1; i += 2) {
        if (bytes[i] === 0 && bytes[i + 1] === 0) {
          end = i;
          break;
        }
      }
      const sub = end === -1 ? bytes : bytes.subarray(0, end);
      return new TextDecoder("utf-16").decode(sub).trim();
    } else if (encoding === 2) {
      // UTF-16BE
      let end = -1;
      for (let i = 0; i < bytes.length - 1; i += 2) {
        if (bytes[i] === 0 && bytes[i + 1] === 0) {
          end = i;
          break;
        }
      }
      const sub = end === -1 ? bytes : bytes.subarray(0, end);
      return new TextDecoder("utf-16be").decode(sub).trim();
    }
  } catch (err) {
    console.warn("Failed to decode text frame:", err);
  }
  return "";
}

/**
 * Parse ID3v2 tags (v2.2, v2.3, v2.4)
 */
function parseID3v2(buffer: ArrayBuffer): Partial<ExtractedAudioMetadata> {
  const result: Partial<ExtractedAudioMetadata> = {};
  const view = new DataView(buffer);

  if (view.byteLength < 10) return result;
  // Check "ID3" identifier
  if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) {
    return result;
  }

  const tagVersion = view.getUint8(3); // 2 = v2.2, 3 = v2.3, 4 = v2.4
  const flags = view.getUint8(5);
  const unsync = (flags & 0x80) !== 0;

  // Synchsafe integer tag size (bytes 6-9)
  const b1 = view.getUint8(6);
  const b2 = view.getUint8(7);
  const b3 = view.getUint8(8);
  const b4 = view.getUint8(9);
  const id3Size = ((b1 & 0x7f) << 21) | ((b2 & 0x7f) << 14) | ((b3 & 0x7f) << 7) | (b4 & 0x7f);

  let offset = 10;
  // If extended header is present in v2.3/v2.4
  if (flags & 0x40) {
    if (tagVersion === 4) {
      const extSize =
        ((view.getUint8(offset) & 0x7f) << 21) |
        ((view.getUint8(offset + 1) & 0x7f) << 14) |
        ((view.getUint8(offset + 2) & 0x7f) << 7) |
        (view.getUint8(offset + 3) & 0x7f);
      offset += extSize;
    } else {
      const extSize = view.getUint32(offset);
      offset += 4 + extSize;
    }
  }

  // Iterate frames
  while (offset < id3Size + 10 && offset < view.byteLength - 10) {
    let frameId = "";
    let frameSize = 0;
    let headerSize = 10;

    if (tagVersion === 2) {
      // ID3v2.2 uses 3-char frame IDs and 3-byte frame sizes
      frameId =
        String.fromCharCode(view.getUint8(offset)) +
        String.fromCharCode(view.getUint8(offset + 1)) +
        String.fromCharCode(view.getUint8(offset + 2));
      frameSize = (view.getUint8(offset + 3) << 16) | (view.getUint8(offset + 4) << 8) | view.getUint8(offset + 5);
      headerSize = 6;
    } else {
      // ID3v2.3 and ID3v2.4 use 4-char IDs
      for (let i = 0; i < 4; i++) {
        frameId += String.fromCharCode(view.getUint8(offset + i));
      }

      if (tagVersion === 4) {
        // v2.4 uses synchsafe integers for frame size
        const s1 = view.getUint8(offset + 4);
        const s2 = view.getUint8(offset + 5);
        const s3 = view.getUint8(offset + 6);
        const s4 = view.getUint8(offset + 7);
        frameSize = ((s1 & 0x7f) << 21) | ((s2 & 0x7f) << 14) | ((s3 & 0x7f) << 7) | (s4 & 0x7f);
      } else {
        // v2.3 uses regular 32-bit big endian integer
        frameSize = view.getUint32(offset + 4);
      }
    }

    if (frameId.charCodeAt(0) === 0 || frameSize <= 0) break;
    if (offset + headerSize + frameSize > view.byteLength) break;

    const frameDataOffset = offset + headerSize;

    // Handle Title, Artist, Album, Year
    if (frameId === "TIT2" || frameId === "TT2") {
      const encoding = view.getUint8(frameDataOffset);
      const text = decodeTextFrame(new Uint8Array(buffer, frameDataOffset + 1, frameSize - 1), encoding);
      if (text) result.title = text;
    } else if (frameId === "TPE1" || frameId === "TP1") {
      const encoding = view.getUint8(frameDataOffset);
      const text = decodeTextFrame(new Uint8Array(buffer, frameDataOffset + 1, frameSize - 1), encoding);
      if (text) result.artist = text;
    } else if (frameId === "TALB" || frameId === "TAL") {
      const encoding = view.getUint8(frameDataOffset);
      const text = decodeTextFrame(new Uint8Array(buffer, frameDataOffset + 1, frameSize - 1), encoding);
      if (text) result.album = text;
    } else if (frameId === "TDRC" || frameId === "TYER" || frameId === "TYE") {
      const encoding = view.getUint8(frameDataOffset);
      const text = decodeTextFrame(new Uint8Array(buffer, frameDataOffset + 1, frameSize - 1), encoding);
      if (text) result.year = text.slice(0, 4);
    } else if (frameId === "USLT" || frameId === "ULT") {
      // Unsynchronized lyric/text transcription
      try {
        const encoding = view.getUint8(frameDataOffset);
        // Next 3 bytes: language (e.g. "eng")
        let descOffset = frameDataOffset + 4;
        // Skip content descriptor until null terminator
        if (encoding === 1 || encoding === 2) {
          while (descOffset < frameDataOffset + frameSize - 1 && (view.getUint8(descOffset) !== 0 || view.getUint8(descOffset + 1) !== 0)) {
            descOffset += 2;
          }
          descOffset += 2;
        } else {
          while (descOffset < frameDataOffset + frameSize && view.getUint8(descOffset) !== 0) {
            descOffset++;
          }
          descOffset++;
        }
        const lyricsBytes = new Uint8Array(buffer, descOffset, frameSize - (descOffset - frameDataOffset));
        const lyricsText = decodeTextFrame(lyricsBytes, encoding);
        if (lyricsText && lyricsText.length > 5) {
          result.lyrics = lyricsText;
        }
      } catch (err) {
        console.warn("Error parsing USLT frame:", err);
      }
    } else if (frameId === "APIC" || frameId === "PIC") {
      // Attached Picture (Album Art Cover)
      try {
        const encoding = view.getUint8(frameDataOffset);
        let cur = frameDataOffset + 1;
        let mimeType = "image/jpeg";

        if (tagVersion === 2) {
          // 3-byte image format (e.g. "JPG", "PNG")
          const fmt =
            String.fromCharCode(view.getUint8(cur)) +
            String.fromCharCode(view.getUint8(cur + 1)) +
            String.fromCharCode(view.getUint8(cur + 2));
          mimeType = fmt.toUpperCase() === "PNG" ? "image/png" : "image/jpeg";
          cur += 3;
          // Picture type (1 byte)
          cur += 1;
        } else {
          // MIME type string terminated by null byte
          let mime = "";
          while (cur < frameDataOffset + frameSize && view.getUint8(cur) !== 0) {
            mime += String.fromCharCode(view.getUint8(cur));
            cur++;
          }
          cur++; // skip null
          if (mime) mimeType = mime.trim().toLowerCase();
          if (mimeType === "image/jpg") mimeType = "image/jpeg";
          
          // Picture type (1 byte)
          cur += 1;
        }

        // Description terminated by null
        if (encoding === 1 || encoding === 2) {
          while (cur < frameDataOffset + frameSize - 1 && (view.getUint8(cur) !== 0 || view.getUint8(cur + 1) !== 0)) {
            cur += 2;
          }
          cur += 2;
        } else {
          while (cur < frameDataOffset + frameSize && view.getUint8(cur) !== 0) {
            cur++;
          }
          cur++;
        }

        const picSize = frameSize - (cur - frameDataOffset);
        if (picSize > 100 && cur + picSize <= view.byteLength) {
          const picBytes = new Uint8Array(buffer, cur, picSize);
          
          // Check magic numbers for real image format if mimeType is generic
          if (picBytes[0] === 0x89 && picBytes[1] === 0x50 && picBytes[2] === 0x4e && picBytes[3] === 0x47) {
            mimeType = "image/png";
          } else if (picBytes[0] === 0xff && picBytes[1] === 0xd8) {
            mimeType = "image/jpeg";
          } else if (picBytes[0] === 0x52 && picBytes[1] === 0x49 && picBytes[2] === 0x46 && picBytes[3] === 0x46) {
            mimeType = "image/webp";
          }

          const blob = new Blob([picBytes], { type: mimeType });
          const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
          const file = new File([blob], `cover_art.${ext}`, { type: mimeType });
          
          // Generate base64 data URL for fast instant UI preview
          let binary = "";
          const len = picBytes.byteLength;
          // Process in chunks to avoid call stack limits on large images
          const chunkSize = 8192;
          for (let i = 0; i < len; i += chunkSize) {
            const chunk = picBytes.subarray(i, Math.min(i + chunkSize, len));
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const base64 = btoa(binary);

          result.coverBlob = blob;
          result.coverFile = file;
          result.coverDataUrl = `data:${mimeType};base64,${base64}`;
          result.mimeType = mimeType;
        }
      } catch (err) {
        console.warn("Error parsing APIC frame:", err);
      }
    }

    offset += headerSize + frameSize;
  }

  return result;
}

/**
 * Parse ID3v1 tags (last 128 bytes of an MP3 file)
 */
function parseID3v1(buffer: ArrayBuffer): Partial<ExtractedAudioMetadata> {
  const result: Partial<ExtractedAudioMetadata> = {};
  if (buffer.byteLength < 128) return result;

  const view = new DataView(buffer, buffer.byteLength - 128, 128);
  const tag =
    String.fromCharCode(view.getUint8(0)) +
    String.fromCharCode(view.getUint8(1)) +
    String.fromCharCode(view.getUint8(2));

  if (tag !== "TAG") return result;

  const readString = (start: number, length: number): string => {
    let str = "";
    for (let i = 0; i < length; i++) {
      const code = view.getUint8(start + i);
      if (code === 0) break;
      str += String.fromCharCode(code);
    }
    return str.trim();
  };

  const title = readString(3, 30);
  const artist = readString(33, 30);
  const album = readString(63, 30);
  const year = readString(93, 4);

  if (title) result.title = title;
  if (artist) result.artist = artist;
  if (album) result.album = album;
  if (year) result.year = year;

  return result;
}

/**
 * Parse MP4 / M4A / AAC container atoms (moov -> udta -> meta -> ilst)
 */
function parseM4A(buffer: ArrayBuffer): Partial<ExtractedAudioMetadata> {
  const result: Partial<ExtractedAudioMetadata> = {};
  const view = new DataView(buffer);
  
  if (view.byteLength < 16) return result;

  const readString = (offset: number, length: number) => {
    let str = "";
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(view.getUint8(offset + i));
    }
    return str;
  };

  const ftyp = readString(4, 4);
  if (ftyp !== "ftyp" && ftyp !== "M4A " && ftyp !== "mp42") {
    // Might still contain moov
  }

  // Find 'moov' atom
  let offset = 0;
  while (offset < view.byteLength - 8) {
    const atomSize = view.getUint32(offset);
    const atomType = readString(offset + 4, 4);

    if (atomSize <= 0 || offset + atomSize > view.byteLength) break;

    if (atomType === "moov") {
      // Search inside moov for ilst
      searchM4AContainer(view, buffer, offset + 8, atomSize - 8, result);
      break;
    }

    offset += atomSize;
  }

  return result;
}

function searchM4AContainer(
  view: DataView,
  buffer: ArrayBuffer,
  start: number,
  length: number,
  result: Partial<ExtractedAudioMetadata>
) {
  let offset = start;
  const end = start + length;

  while (offset < end - 8) {
    const size = view.getUint32(offset);
    if (size <= 0 || offset + size > view.byteLength) break;

    const type =
      String.fromCharCode(view.getUint8(offset + 4)) +
      String.fromCharCode(view.getUint8(offset + 5)) +
      String.fromCharCode(view.getUint8(offset + 6)) +
      String.fromCharCode(view.getUint8(offset + 7));

    if (type === "udta" || type === "meta") {
      const skip = type === "meta" ? 12 : 8; // meta has 4 version/flags bytes
      searchM4AContainer(view, buffer, offset + skip, size - skip, result);
    } else if (type === "ilst") {
      parseIlstAtoms(view, buffer, offset + 8, size - 8, result);
      return;
    }

    offset += size;
  }
}

function parseIlstAtoms(
  view: DataView,
  buffer: ArrayBuffer,
  start: number,
  length: number,
  result: Partial<ExtractedAudioMetadata>
) {
  let offset = start;
  const end = start + length;

  while (offset < end - 8) {
    const size = view.getUint32(offset);
    if (size <= 0 || offset + size > view.byteLength) break;

    const type =
      String.fromCharCode(view.getUint8(offset + 4)) +
      String.fromCharCode(view.getUint8(offset + 5)) +
      String.fromCharCode(view.getUint8(offset + 6)) +
      String.fromCharCode(view.getUint8(offset + 7));

    // Look for 'data' child atom inside this tag atom
    let dataOffset = offset + 8;
    const itemEnd = offset + size;

    while (dataOffset < itemEnd - 8) {
      const dataSize = view.getUint32(dataOffset);
      if (dataSize <= 0) break;
      const dataType =
        String.fromCharCode(view.getUint8(dataOffset + 4)) +
        String.fromCharCode(view.getUint8(dataOffset + 5)) +
        String.fromCharCode(view.getUint8(dataOffset + 6)) +
        String.fromCharCode(view.getUint8(dataOffset + 7));

      if (dataType === "data") {
        // Data atom payload starts at dataOffset + 16 (4 size, 4 type, 4 type indicator, 4 locale)
        const payloadOffset = dataOffset + 16;
        const payloadLength = dataSize - 16;

        if (payloadLength > 0 && payloadOffset + payloadLength <= view.byteLength) {
          if (type === "©nam") {
            const bytes = new Uint8Array(buffer, payloadOffset, payloadLength);
            result.title = new TextDecoder("utf-8").decode(bytes).trim();
          } else if (type === "©ART" || type === "aART") {
            const bytes = new Uint8Array(buffer, payloadOffset, payloadLength);
            result.artist = new TextDecoder("utf-8").decode(bytes).trim();
          } else if (type === "©alb") {
            const bytes = new Uint8Array(buffer, payloadOffset, payloadLength);
            result.album = new TextDecoder("utf-8").decode(bytes).trim();
          } else if (type === "©day") {
            const bytes = new Uint8Array(buffer, payloadOffset, payloadLength);
            result.year = new TextDecoder("utf-8").decode(bytes).trim().slice(0, 4);
          } else if (type === "covr") {
            const picBytes = new Uint8Array(buffer, payloadOffset, payloadLength);
            let mimeType = "image/jpeg";
            if (picBytes[0] === 0x89 && picBytes[1] === 0x50) {
              mimeType = "image/png";
            }

            const blob = new Blob([picBytes], { type: mimeType });
            const ext = mimeType.includes("png") ? "png" : "jpg";
            const file = new File([blob], `cover_art.${ext}`, { type: mimeType });

            let binary = "";
            const chunkSize = 8192;
            for (let i = 0; i < picBytes.byteLength; i += chunkSize) {
              const chunk = picBytes.subarray(i, Math.min(i + chunkSize, picBytes.byteLength));
              binary += String.fromCharCode.apply(null, Array.from(chunk));
            }
            const base64 = btoa(binary);

            result.coverBlob = blob;
            result.coverFile = file;
            result.coverDataUrl = `data:${mimeType};base64,${base64}`;
            result.mimeType = mimeType;
          }
        }
        break;
      }
      dataOffset += dataSize;
    }

    offset += size;
  }
}

/**
 * Intelligent filename parser when tags are missing or partial.
 * E.g. "01 - Anirudh Ravichander - Badass [Masstamilan].mp3"
 */
export function parseFromFilename(filename: string): { title?: string; artist?: string } {
  // Strip extension
  let clean = filename.replace(/\.(mp3|m4a|wav|aac|flac|ogg|opus)$/i, "").trim();

  // Strip common promo tags & brackets like [Masstamilan], (320kbps), [128kbps], (Original)
  clean = clean.replace(/\[[^\]]*\]|\([^\)]*\)/g, " ").trim();

  // Strip leading track numbers like "01. ", "01 - ", "1 "
  clean = clean.replace(/^\d+[\.\-\s_]+/g, "").trim();

  // Replace underscores with spaces
  clean = clean.replace(/_/g, " ").replace(/\s+/g, " ").trim();

  // Check for " - " delimiter (e.g. "Artist - Title")
  if (clean.includes(" - ")) {
    const parts = clean.split(" - ");
    if (parts.length >= 2) {
      const part1 = parts[0].trim();
      const part2 = parts.slice(1).join(" - ").trim();
      return {
        artist: part1,
        title: part2
      };
    }
  }

  return { title: clean };
}

/**
 * Calculates accurate audio duration using native HTMLAudioElement
 */
export async function getAudioFileDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const objectUrl = URL.createObjectURL(file);
      const audio = new Audio(objectUrl);

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
      };

      audio.addEventListener("loadedmetadata", () => {
        const dur = audio.duration;
        cleanup();
        if (dur && !isNaN(dur) && isFinite(dur)) {
          resolve(Math.round(dur));
        } else {
          resolve(null);
        }
      });

      audio.addEventListener("error", () => {
        cleanup();
        resolve(null);
      });

      // Timeout safety after 3 seconds
      setTimeout(() => {
        cleanup();
        resolve(null);
      }, 3000);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Master parser: Extracts all metadata (Title, Artist, Album, Cover Art, Duration, Lyrics)
 * from any audio File object.
 */
export async function extractAudioFileMetadata(file: File): Promise<ExtractedAudioMetadata> {
  const result: ExtractedAudioMetadata = {};

  try {
    // 1. Get accurate duration in seconds
    const duration = await getAudioFileDuration(file);
    if (duration) {
      result.duration = duration;
    }

    // 2. Read first chunk for ID3v2 & M4A (read up to 4MB to capture embedded album art covers)
    const headerChunkSize = Math.min(file.size, 4 * 1024 * 1024);
    const headerBuffer = await file.slice(0, headerChunkSize).arrayBuffer();

    // Check ID3v2
    const id3v2Data = parseID3v2(headerBuffer);
    if (id3v2Data.title) result.title = id3v2Data.title;
    if (id3v2Data.artist) result.artist = id3v2Data.artist;
    if (id3v2Data.album) result.album = id3v2Data.album;
    if (id3v2Data.year) result.year = id3v2Data.year;
    if (id3v2Data.lyrics) result.lyrics = id3v2Data.lyrics;
    if (id3v2Data.coverBlob) {
      result.coverBlob = id3v2Data.coverBlob;
      result.coverFile = id3v2Data.coverFile;
      result.coverDataUrl = id3v2Data.coverDataUrl;
      result.mimeType = id3v2Data.mimeType;
    }

    // Check M4A / AAC if title/artist not found yet
    if (!result.title || !result.coverBlob) {
      const m4aData = parseM4A(headerBuffer);
      if (!result.title && m4aData.title) result.title = m4aData.title;
      if (!result.artist && m4aData.artist) result.artist = m4aData.artist;
      if (!result.album && m4aData.album) result.album = m4aData.album;
      if (!result.coverBlob && m4aData.coverBlob) {
        result.coverBlob = m4aData.coverBlob;
        result.coverFile = m4aData.coverFile;
        result.coverDataUrl = m4aData.coverDataUrl;
        result.mimeType = m4aData.mimeType;
      }
    }

    // 3. If ID3v1 is present at the end of file (for MP3 files)
    if (!result.title || !result.artist || !result.album) {
      if (file.size > 128) {
        const footerBuffer = await file.slice(file.size - 128).arrayBuffer();
        const id3v1Data = parseID3v1(footerBuffer);
        if (!result.title && id3v1Data.title) result.title = id3v1Data.title;
        if (!result.artist && id3v1Data.artist) result.artist = id3v1Data.artist;
        if (!result.album && id3v1Data.album) result.album = id3v1Data.album;
      }
    }

    // 4. Intelligent Filename fallback if title or artist is still empty
    const fromName = parseFromFilename(file.name);
    if (!result.title && fromName.title) {
      result.title = fromName.title;
    }
    if (!result.artist && fromName.artist) {
      result.artist = fromName.artist;
    }

  } catch (err) {
    console.warn("Audio metadata extraction encountered an error:", err);
  }

  return result;
}
