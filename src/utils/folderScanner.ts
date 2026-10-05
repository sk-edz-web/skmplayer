/**
 * Robust Client-Side Music Folder and Files Directory Scanner
 * Recursively scans folders and files dropped or selected via webkitdirectory.
 * Works across Chrome, Safari, Firefox, Edge and Opera.
 */

export interface ScannedFolderResult {
  folderName: string;
  audioFiles: File[];
  coverFiles: File[];
  lyricsFiles: File[];
  allFiles: File[];
}

/**
 * Recursively scans a DataTransfer object (drag and drop) using webkitGetAsEntry
 */
export async function scanDroppedItems(dataTransfer: DataTransfer): Promise<ScannedFolderResult> {
  const allFiles: File[] = [];
  let detectedFolderName = "Music Folder";

  const items = dataTransfer.items;
  if (items && items.length > 0 && typeof (items[0] as any).webkitGetAsEntry === "function") {
    const entries: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = (items[i] as any).webkitGetAsEntry();
      if (entry) {
        entries.push(entry);
        if (entry.isDirectory && (!detectedFolderName || detectedFolderName === "Music Folder")) {
          detectedFolderName = entry.name;
        }
      }
    }

    const traverseEntry = async (entry: any): Promise<void> => {
      if (entry.isFile) {
        await new Promise<void>((resolve) => {
          entry.file(
            (file: File) => {
              allFiles.push(file);
              resolve();
            },
            () => resolve()
          );
        });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readEntriesRecursively = async (): Promise<void> => {
          const batch: any[] = await new Promise((resolve) => {
            reader.readEntries(
              (results: any[]) => resolve(results),
              () => resolve([])
            );
          });
          if (batch.length > 0) {
            for (const child of batch) {
              await traverseEntry(child);
            }
            await readEntriesRecursively();
          }
        };
        await readEntriesRecursively();
      }
    };

    for (const ent of entries) {
      await traverseEntry(ent);
    }
  } else if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      allFiles.push(dataTransfer.files[i]);
    }
    if (allFiles[0] && (allFiles[0] as any).webkitRelativePath) {
      const parts = (allFiles[0] as any).webkitRelativePath.split("/");
      if (parts.length > 1) {
        detectedFolderName = parts[0];
      }
    }
  }

  return processFilesList(allFiles, detectedFolderName);
}

/**
 * Processes a FileList or array of Files (from input element onChange)
 */
export function processFilesList(files: FileList | File[], fallbackFolderName?: string): ScannedFolderResult {
  const allFiles = Array.isArray(files) ? files : Array.from(files);
  
  let detectedFolderName = fallbackFolderName || "Music Folder";
  if (allFiles[0] && (allFiles[0] as any).webkitRelativePath) {
    const parts = (allFiles[0] as any).webkitRelativePath.split("/");
    if (parts.length > 1) {
      detectedFolderName = parts[0];
    }
  }

  // Filter audio files
  const audioFiles = allFiles.filter(f => 
    f.type.startsWith("audio/") || 
    /\.(mp3|m4a|wav|aac|flac|ogg|opus)$/i.test(f.name)
  );

  // Filter image/artwork files
  const coverFiles = allFiles.filter(f => 
    f.type.startsWith("image/") || 
    /\.(jpg|jpeg|png|webp)$/i.test(f.name)
  );

  // Filter lyrics files
  const lyricsFiles = allFiles.filter(f => 
    /\.(lrc|txt|srt|vtt)$/i.test(f.name)
  );

  return {
    folderName: detectedFolderName,
    audioFiles,
    coverFiles,
    lyricsFiles,
    allFiles
  };
}
