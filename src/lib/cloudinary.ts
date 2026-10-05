/// <reference types="vite/client" />
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
  apiKey?: string;
}

const STORAGE_KEY = "skplayer_cloudinary_config";

// Default verified credentials provided by user
const DEFAULT_CLOUD_NAME = "oe3mhx3g";
const DEFAULT_UPLOAD_PRESET = "ml_default";
const DEFAULT_API_KEY = "961445142313949";

// Default fallbacks from Vite environment variables or user provided Cloudinary credentials
const ENV_CLOUD_NAME = (((import.meta as any).env?.VITE_CLOUDINARY_CLOUD_NAME || DEFAULT_CLOUD_NAME) as string).trim();
const ENV_UPLOAD_PRESET = (((import.meta as any).env?.VITE_CLOUDINARY_UPLOAD_PRESET || DEFAULT_UPLOAD_PRESET) as string).trim();
const ENV_API_KEY = (((import.meta as any).env?.VITE_CLOUDINARY_API_KEY || DEFAULT_API_KEY) as string).trim();

let inMemoryConfig: CloudinaryConfig | null = null;

/**
 * Gets currently saved Cloudinary credentials (from Memory, LocalStorage, Firestore, or Env)
 */
export async function getCloudinaryConfig(): Promise<CloudinaryConfig> {
  if (inMemoryConfig && inMemoryConfig.cloudName && inMemoryConfig.uploadPreset) {
    return inMemoryConfig;
  }

  // 1. Check LocalStorage (ensure it is valid and not empty or stale)
  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local) as CloudinaryConfig;
      if (parsed.cloudName && parsed.uploadPreset && parsed.cloudName !== "dntcjdw7r") {
        inMemoryConfig = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not read local Cloudinary config:", e);
  }

  // 2. Check Firestore "settings/cloudinary"
  try {
    const docRef = doc(db, "settings", "cloudinary");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.cloudName && data.uploadPreset && String(data.cloudName).trim() !== "dntcjdw7r") {
        const config: CloudinaryConfig = {
          cloudName: String(data.cloudName).trim(),
          uploadPreset: String(data.uploadPreset).trim(),
          apiKey: data.apiKey ? String(data.apiKey).trim() : DEFAULT_API_KEY
        };
        inMemoryConfig = config;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        } catch {}
        return config;
      }
    }
  } catch (e) {
    console.warn("Could not read Firestore Cloudinary config:", e);
  }

  // 3. Fallback to user verified config
  const fallbackConfig: CloudinaryConfig = {
    cloudName: ENV_CLOUD_NAME || DEFAULT_CLOUD_NAME,
    uploadPreset: ENV_UPLOAD_PRESET || DEFAULT_UPLOAD_PRESET,
    apiKey: ENV_API_KEY || DEFAULT_API_KEY
  };

  inMemoryConfig = fallbackConfig;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackConfig));
  } catch {}
  return fallbackConfig;
}

/**
 * Saves Cloudinary credentials both locally and to Firestore for global admin sync
 */
export async function saveCloudinaryConfig(config: CloudinaryConfig): Promise<void> {
  const cleanConfig: CloudinaryConfig = {
    cloudName: config.cloudName.trim(),
    uploadPreset: config.uploadPreset.trim(),
    apiKey: config.apiKey ? config.apiKey.trim() : undefined
  };

  inMemoryConfig = cleanConfig;

  // Save to LocalStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanConfig));
  } catch (e) {
    console.warn("LocalStorage write failed:", e);
  }

  // Sync to Firestore settings/cloudinary
  try {
    const docRef = doc(db, "settings", "cloudinary");
    await setDoc(docRef, {
      ...cleanConfig,
      updatedAt: Date.now()
    }, { merge: true });
    console.log("[Cloudinary] Configuration updated and synced to Firestore!");
  } catch (e) {
    console.warn("Firestore settings update warning:", e);
  }
}

/**
 * Directly uploads a File (audio, image, video) to Cloudinary via REST API with live progress tracking
 */
export async function uploadToCloudinaryDirect(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ secure_url: string; format: string; duration?: number | null }> {
  const config = await getCloudinaryConfig();

  if (!config.cloudName || !config.uploadPreset) {
    throw new Error("CLOUDINARY_NOT_CONFIGURED");
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Cloudinary treats audio files as resource_type "video" or "auto"
    let resourceType = "auto";
    if (file.type.startsWith("image/")) {
      resourceType = "image";
    } else if (file.type.startsWith("audio/")) {
      resourceType = "video"; // Cloudinary uses "video" endpoint for audio files
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resourceType}/upload`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", config.uploadPreset);

    if (xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.secure_url) {
            resolve({
              secure_url: data.secure_url,
              format: data.format || file.name.split(".").pop() || "mp3",
              duration: data.duration || null
            });
          } else {
            reject(new Error(data.error?.message || "No secure_url returned from Cloudinary"));
          }
        } catch (err: any) {
          reject(new Error("Failed to parse Cloudinary response: " + err.message));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.error?.message || `Cloudinary upload failed (HTTP ${xhr.status})`));
        } catch {
          reject(new Error(`Cloudinary upload failed with HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error occurred while uploading to Cloudinary"));
    };

    xhr.ontimeout = () => {
      reject(new Error("Upload request timed out"));
    };

    xhr.open("POST", endpoint, true);
    xhr.send(formData);
  });
}

/**
 * Tests if Cloudinary credentials are valid by sending a test ping to Cloudinary API
 */
export async function testCloudinaryCredentials(
  cloudName: string,
  uploadPreset: string
): Promise<{ success: boolean; message: string }> {
  if (!cloudName.trim() || !uploadPreset.trim()) {
    return { success: false, message: "Cloud Name and Upload Preset are required." };
  }

  try {
    // Create a tiny 1x1 transparent PNG blob for testing
    const tinyBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const res = await fetch(tinyBase64);
    const blob = await res.blob();
    const testFile = new File([blob], "ping_test.png", { type: "image/png" });

    const formData = new FormData();
    formData.append("file", testFile);
    formData.append("upload_preset", uploadPreset.trim());

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName.trim())}/image/upload`,
      {
        method: "POST",
        body: formData
      }
    );

    const data = await response.json();
    if (response.ok && data.secure_url) {
      return { 
        success: true, 
        message: `Connection successful! Connected to Cloudinary cloud "${cloudName.trim()}".` 
      };
    } else {
      return { 
        success: false, 
        message: data.error?.message || "Invalid Cloud Name or Upload Preset." 
      };
    }
  } catch (err: any) {
    return { 
      success: false, 
      message: "Connection failed: " + (err.message || "Network error") 
    };
  }
}
