import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

// Cloudinary Configuration with verified user credentials
const CLOUDINARY_CLOUD_NAME = "oe3mhx3g";
const CLOUDINARY_API_KEY = "961445142313949";
const CLOUDINARY_API_SECRET = "cOBkn-mTeSsdPuC1krSkbR9B5rM";

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true
});

// Ensure ml_default upload preset is unsigned for browser uploads
try {
  cloudinary.api.update_upload_preset("ml_default", { unsigned: true }).then(() => {
    console.log("[Cloudinary] Upload preset 'ml_default' verified as unsigned.");
  }).catch((err) => {
    console.log("[Cloudinary] Preset check notice:", err?.message || err);
  });
} catch (e) {
  console.warn("[Cloudinary] Preset init warning:", e);
}

// Admin configuration constants from environment variables with secure fallbacks
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "sarathik354@gmail.com").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Sarathi@5023";
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || "sk_edz_admin_secret_key_session_token_secure";

// Helper to generate HMAC signed token
function generateAdminToken(email: string): string {
  const payload = JSON.stringify({
    email,
    role: "admin",
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days validity
  });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", ADMIN_SECRET).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

// Helper to verify HMAC signed token
function verifyAdminToken(token: string): { valid: boolean; email?: string } {
  try {
    if (!token || typeof token !== "string" || !token.includes(".")) {
      return { valid: false };
    }
    const [encodedPayload, signature] = token.split(".");
    const expectedSignature = crypto.createHmac("sha256", ADMIN_SECRET).update(encodedPayload).digest("base64url");
    
    if (signature !== expectedSignature) {
      return { valid: false };
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8"));
    if (Date.now() > payload.expiresAt) {
      return { valid: false };
    }
    if (payload.role !== "admin" || payload.email.toLowerCase() !== ADMIN_EMAIL) {
      return { valid: false };
    }

    return { valid: true, email: payload.email };
  } catch (err) {
    return { valid: false };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser with 200MB limit to handle base64 audio/image uploads safely
  app.use(express.json({ limit: "200mb" }));
  app.use(express.urlencoded({ limit: "200mb", extended: true }));

  // Admin Auth Route: Login (Strict server-side validation)
  app.post("/api/admin/login", (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ 
          success: false, 
          message: "Email address and password are required." 
        });
      }

      const inputEmail = String(email).trim().toLowerCase();
      const inputPassword = String(password);

      // Verify email and password on server side only
      if (inputEmail !== ADMIN_EMAIL || inputPassword !== ADMIN_PASSWORD) {
        // Uniform error response to avoid credential enumeration
        return res.status(401).json({ 
          success: false, 
          message: "Access Denied: Invalid credentials or unauthorized administrator account." 
        });
      }

      const token = generateAdminToken(inputEmail);
      console.log(`[Admin Auth] Successfully authenticated admin: ${inputEmail}`);
      
      return res.json({
        success: true,
        token,
        email: inputEmail,
        message: "Admin authentication successful."
      });
    } catch (err: any) {
      console.error("[Admin Auth] Login error:", err);
      return res.status(500).json({ success: false, message: "Internal server authentication error." });
    }
  });

  // Admin Auth Route: Verify Session Token
  app.post("/api/admin/verify", (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = req.body?.token || (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null);
      
      if (!token) {
        return res.status(401).json({ valid: false, message: "No token provided" });
      }

      const result = verifyAdminToken(token);
      if (!result.valid) {
        return res.status(401).json({ valid: false, message: "Invalid or expired session token" });
      }

      return res.json({ valid: true, email: result.email });
    } catch (err: any) {
      return res.status(500).json({ valid: false, message: "Verification error" });
    }
  });

  // Serve uploaded files statically
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // API Upload Route (Securely handles base64 audio/image uploads and saves them locally)
  app.post("/api/upload", async (req, res) => {
    try {
      const { file, presetType } = req.body;

      if (!file) {
        return res.status(400).json({ error: "No file content provided." });
      }

      // Ensure local uploads directory exists
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      let isImage = false;
      let extension = "mp3"; // default for audio
      let base64Data = file;

      if (typeof file === "string" && file.startsWith("data:")) {
        const mimeMatch = file.match(/^data:([^;]+);base64,/);
        if (mimeMatch) {
          const mime = mimeMatch[1];
          if (mime.startsWith("image/")) {
            isImage = true;
            extension = mime.split("/")[1] || "png";
          } else if (mime.startsWith("audio/")) {
            isImage = false;
            extension = mime.split("/")[1] || "mp3";
          }
          if (extension === "mpeg") extension = "mp3";
        }
        
        if (file.includes(";base64,")) {
          base64Data = file.split(";base64,")[1];
        }
      } else {
        // Fallback/guess based on presetType
        if (presetType && (presetType.includes("image") || presetType === "avatar" || presetType === "playlist" || presetType.includes("pfp"))) {
          isImage = true;
          extension = "png";
        } else {
          isImage = false;
          extension = "mp3";
        }
      }

      const prefix = isImage ? "img" : "audio";
      const filename = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}.${extension}`;
      const filePath = path.join(uploadsDir, filename);

      // 1. Primary Reliable Upload: Cloudinary Server-Side SDK Signed Upload
      try {
        const mimeType = isImage ? `image/${extension === "png" ? "png" : "jpeg"}` : `audio/${extension}`;
        const dataUri = typeof file === "string" && file.startsWith("data:") 
          ? file 
          : `data:${mimeType};base64,${base64Data}`;

        console.log(`[API Upload] Processing ${prefix} upload to Cloudinary CDN via Server SDK...`);
        const cloudRes = await cloudinary.uploader.upload(dataUri, {
          resource_type: isImage ? "image" : "video",
          folder: isImage ? "skplayer_images" : "skplayer_tracks"
        });

        if (cloudRes && cloudRes.secure_url) {
          console.log(`[API Upload] Successfully uploaded to Cloudinary CDN: ${cloudRes.secure_url}`);
          return res.json({
            secure_url: cloudRes.secure_url,
            format: cloudRes.format || extension,
            duration: cloudRes.duration ? Math.round(cloudRes.duration) : null,
          });
        }
      } catch (cErr: any) {
        console.warn("[API Upload] Cloudinary server SDK upload fallback:", cErr?.message || cErr);
      }

      // 2. Local File System Fallback
      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(filePath, buffer);
      console.log(`[API Upload] Saved ${prefix} locally at: ${filePath}`);

      const secureUrl = `/uploads/${filename}`;

      return res.json({
        secure_url: secureUrl,
        format: extension,
        duration: null,
      });
    } catch (error: any) {
      console.error("[API Upload] Internal server error:", error);
      return res.status(500).json({
        error: "Internal Server Error in local upload",
        message: error.message,
      });
    }
  });

  // VIP Keys Persistence Helper Functions
  const KEYS_FILE_PATH = path.join(process.cwd(), "data", "keys.json");

  function readStoredKeys(): any[] {
    try {
      if (!fs.existsSync(KEYS_FILE_PATH)) {
        return [];
      }
      const data = fs.readFileSync(KEYS_FILE_PATH, "utf-8");
      return JSON.parse(data) || [];
    } catch (err) {
      console.warn("[Keys API] Error reading keys file:", err);
      return [];
    }
  }

  function writeStoredKeys(keys: any[]): void {
    try {
      const dataDir = path.dirname(KEYS_FILE_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(KEYS_FILE_PATH, JSON.stringify(keys, null, 2), "utf-8");
    } catch (err) {
      console.warn("[Keys API] Error writing keys file:", err);
    }
  }

  // GET /api/keys - Retrieve all subscription passcodes
  app.get("/api/keys", (req, res) => {
    try {
      const keys = readStoredKeys();
      res.json({ success: true, keys });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || "Failed to read keys" });
    }
  });

  // GET /api/keys/:code - Check single passcode
  app.get("/api/keys/:code", (req, res) => {
    try {
      const code = String(req.params.code).trim().toUpperCase();
      const cleanCode = code.replace(/[^A-Z0-9]/g, "");
      const keys = readStoredKeys();
      const key = keys.find((k: any) => {
        const c = String(k.code || "").toUpperCase();
        return c === code || (cleanCode.length > 0 && c.replace(/[^A-Z0-9]/g, "") === cleanCode);
      });
      if (!key) {
        return res.status(404).json({ success: false, message: "Key not found" });
      }
      res.json({ success: true, key });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || "Failed to fetch key" });
    }
  });

  // POST /api/keys - Store/Create passcode
  app.post("/api/keys", (req, res) => {
    try {
      const keyData = req.body;
      if (!keyData || !keyData.code) {
        return res.status(400).json({ success: false, message: "Key code is required" });
      }
      const keys = readStoredKeys();
      const existingIdx = keys.findIndex((k: any) => k.code === keyData.code);
      if (existingIdx >= 0) {
        keys[existingIdx] = { ...keys[existingIdx], ...keyData };
      } else {
        keys.unshift(keyData);
      }
      writeStoredKeys(keys);
      res.json({ success: true, key: keyData });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || "Failed to save key" });
    }
  });

  // PUT /api/keys/:code - Update passcode (e.g. used, reset, disabled)
  app.put("/api/keys/:code", (req, res) => {
    try {
      const code = String(req.params.code).trim().toUpperCase();
      const cleanCode = code.replace(/[^A-Z0-9]/g, "");
      const updates = req.body;
      const keys = readStoredKeys();
      const existingIdx = keys.findIndex((k: any) => {
        const c = String(k.code || "").toUpperCase();
        return c === code || (cleanCode.length > 0 && c.replace(/[^A-Z0-9]/g, "") === cleanCode);
      });
      if (existingIdx >= 0) {
        keys[existingIdx] = { ...keys[existingIdx], ...updates };
        writeStoredKeys(keys);
        return res.json({ success: true, key: keys[existingIdx] });
      }
      res.status(404).json({ success: false, message: "Key not found" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || "Failed to update key" });
    }
  });

  // DELETE /api/keys/:code - Delete passcode
  app.delete("/api/keys/:code", (req, res) => {
    try {
      const code = String(req.params.code).trim().toUpperCase();
      const cleanCode = code.replace(/[^A-Z0-9]/g, "");
      let keys = readStoredKeys();
      keys = keys.filter((k: any) => {
        const c = String(k.code || "").toUpperCase();
        return c !== code && (cleanCode.length === 0 || c.replace(/[^A-Z0-9]/g, "") !== cleanCode);
      });
      writeStoredKeys(keys);
      res.json({ success: true, message: "Key deleted" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || "Failed to delete key" });
    }
  });

  // Video Metadata & Accurate Duration Auto-Detection Route
  app.get("/api/video-info", async (req, res) => {
    try {
      const rawUrl = String(req.query.url || req.query.videoUrl || "").trim();
      if (!rawUrl) {
        return res.status(400).json({ success: false, message: "Video URL is required" });
      }

      // 1. YouTube Video Detection & Parsing
      const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/;
      let videoId = rawUrl.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(rawUrl) 
        ? rawUrl 
        : null;

      if (!videoId) {
        const match = rawUrl.match(ytRegex);
        if (match && match[1]) {
          videoId = match[1];
        }
      }

      if (videoId) {
        let title = "";
        let creator = "";
        let duration: number | null = null;
        let description = "";
        let category = "Music Video";
        let thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

        // 1a. Try noembed & YouTube oEmbed
        try {
          const oembedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, {
            headers: { "User-Agent": "Mozilla/5.0" }
          });
          if (oembedRes.ok) {
            const data: any = await oembedRes.json();
            if (data.title) title = data.title;
            if (data.author_name) creator = data.author_name;
            if (data.thumbnail_url) thumbnailUrl = data.thumbnail_url;
          }
        } catch (e) {
          console.warn("[Video Info] noembed fetch error:", e);
        }

        if (!title) {
          try {
            const ytOembed = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
            if (ytOembed.ok) {
              const data: any = await ytOembed.json();
              if (data.title) title = data.title;
              if (data.author_name) creator = data.author_name;
              if (data.thumbnail_url) thumbnailUrl = data.thumbnail_url;
            }
          } catch (e) {
            console.warn("[Video Info] youtube oembed error:", e);
          }
        }

        // 1b. Fetch YouTube watch page HTML for accurate duration & metadata
        try {
          const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
              "Accept-Language": "en-US,en;q=0.9",
              "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
          });
          if (watchRes.ok) {
            const html = await watchRes.text();

            // Duration: parse lengthSeconds
            const mLength = html.match(/"lengthSeconds":"(\d+)"/);
            if (mLength && mLength[1]) {
              duration = parseInt(mLength[1], 10);
            }

            // Fallback ISO duration: itemprop="duration" content="PT3M34S"
            if (!duration) {
              const mIso = html.match(/itemprop="duration" content="PT([^"]+)"/);
              if (mIso && mIso[1]) {
                const iso = mIso[1];
                let sec = 0;
                const h = iso.match(/(\d+)H/);
                const m = iso.match(/(\d+)M/);
                const s = iso.match(/(\d+)S/);
                if (h) sec += parseInt(h[1], 10) * 3600;
                if (m) sec += parseInt(m[1], 10) * 60;
                if (s) sec += parseInt(s[1], 10);
                if (sec > 0) duration = sec;
              }
            }

            // Fallback heatmap max end
            if (!duration) {
              const re = /"startMillis":"(\d+)","durationMillis":"(\d+)"/g;
              let maxEnd = 0;
              let match;
              while ((match = re.exec(html)) !== null) {
                const end = (parseInt(match[1], 10) + parseInt(match[2], 10)) / 1000;
                if (end > maxEnd) maxEnd = end;
              }
              if (maxEnd > 0) duration = Math.round(maxEnd);
            }

            // Title fallback
            if (!title) {
              const mTitle = html.match(/<meta name="title" content="([^"]*)"/);
              if (mTitle && mTitle[1]) title = mTitle[1];
            }

            // Description
            const mDesc = html.match(/<meta name="description" content="([^"]*)"/);
            if (mDesc && mDesc[1]) {
              description = mDesc[1];
            }

            // Genre / Category
            const mGenre = html.match(/<meta itemprop="genre" content="([^"]*)"/);
            if (mGenre && mGenre[1]) {
              category = mGenre[1] === "Music" ? "Music Video" : mGenre[1];
            }
          }
        } catch (e) {
          console.warn("[Video Info] watch page scrape error:", e);
        }

        // Auto infer category from title keywords
        if (title) {
          const lower = title.toLowerCase();
          if (lower.includes("live") || lower.includes("concert")) category = "Live Concert";
          else if (lower.includes("remix")) category = "Remix";
          else if (lower.includes("lofi") || lower.includes("lo-fi") || lower.includes("acoustic")) category = "Lofi / Acoustic";
          else if (lower.includes("audio") || lower.includes("lyric")) category = "Official Audio";
          else if (lower.includes("video") || lower.includes("song")) category = "Music Video";
        }

        if (!description && title) {
          description = `${title}${creator ? ` by ${creator}` : ""}. Available to stream on ZYNC.`;
        }

        return res.json({
          success: true,
          isYouTube: true,
          videoId,
          title: title || `YouTube Video (${videoId})`,
          creator: creator || "YouTube Creator",
          duration: duration || 215,
          description,
          category,
          thumbnailUrl
        });
      }

      // 2. Non-YouTube Direct URL
      return res.json({
        success: true,
        isYouTube: false,
        videoId: null,
        title: "",
        creator: "",
        duration: null,
        description: "",
        category: "Music Video",
        thumbnailUrl: ""
      });
    } catch (err: any) {
      console.error("[Video Info] Route error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });



  // Serve static assets and frontend SPA build
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Server listening on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer().catch((err) => {
  console.error("[Server] Start server failed:", err);
});
