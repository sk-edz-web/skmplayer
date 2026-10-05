import React, { useEffect, useState } from "react";
import { 
  Cloud, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Key, 
  ExternalLink, 
  Save, 
  ShieldCheck, 
  Sparkles,
  Radio,
  FileAudio,
  Info,
  HelpCircle,
  Zap
} from "lucide-react";
import { 
  getCloudinaryConfig, 
  saveCloudinaryConfig, 
  testCloudinaryCredentials, 
  CloudinaryConfig 
} from "../lib/cloudinary";

interface AdminCloudinaryManagerProps {
  onShowToast: (message: string, type: "success" | "error" | "info") => void;
}

export default function AdminCloudinaryManager({ onShowToast }: AdminCloudinaryManagerProps) {
  const [cloudName, setCloudName] = useState("");
  const [uploadPreset, setUploadPreset] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isSaving, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Load existing credentials on mount
  useEffect(() => {
    async function loadConfig() {
      setLoadingConfig(true);
      try {
        const config = await getCloudinaryConfig();
        setCloudName(config.cloudName || "");
        setUploadPreset(config.uploadPreset || "");
        setApiKey(config.apiKey || "");

        if (config.cloudName && config.uploadPreset) {
          setTestResult({
            success: true,
            message: `Currently configured for cloud: "${config.cloudName}"`
          });
        }
      } catch (err) {
        console.warn("Error loading Cloudinary config:", err);
      } finally {
        setLoadingConfig(false);
      }
    }
    loadConfig();
  }, []);

  const handleTestConnection = async () => {
    if (!cloudName.trim() || !uploadPreset.trim()) {
      onShowToast("Please enter both Cloud Name and Upload Preset.", "error");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const res = await testCloudinaryCredentials(cloudName.trim(), uploadPreset.trim());
    setIsTesting(false);
    setTestResult(res);

    if (res.success) {
      onShowToast("Cloudinary connection verified successfully! 🎉", "success");
    } else {
      onShowToast(`Verification failed: ${res.message}`, "error");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudName.trim() || !uploadPreset.trim()) {
      onShowToast("Cloud Name and Upload Preset are required.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const config: CloudinaryConfig = {
        cloudName: cloudName.trim(),
        uploadPreset: uploadPreset.trim(),
        apiKey: apiKey.trim() || undefined
      };

      await saveCloudinaryConfig(config);
      setIsSubmitting(false);

      setTestResult({
        success: true,
        message: `Saved! Connected to Cloudinary cloud "${cloudName.trim()}".`
      });

      onShowToast("Cloudinary details saved & synced globally! ☁️", "success");
    } catch (err: any) {
      setIsSubmitting(false);
      onShowToast(`Failed to save configuration: ${err.message}`, "error");
    }
  };

  if (loadingConfig) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-mono">
        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
        <p className="text-xs">Loading Cloudinary Settings...</p>
      </div>
    );
  }

  const isConfigured = Boolean(cloudName.trim() && uploadPreset.trim());

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      
      {/* Top Banner Status Header */}
      <div className={`p-6 rounded-3xl border backdrop-blur-2xl transition-all duration-300 shadow-2xl ${
        isConfigured 
          ? "bg-cyan-950/30 border-cyan-500/30 text-slate-200" 
          : "bg-amber-950/30 border-amber-500/30 text-amber-200"
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className={`p-3.5 rounded-2xl border ${
              isConfigured 
                ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.3)]" 
                : "bg-amber-500/20 border-amber-400/40 text-amber-300"
            }`}>
              <Cloud className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Cloudinary Media Server Integration</h2>
                {isConfigured ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Active & Ready</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>Action Required</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Cloudinary is used to host unlimited high-bitrate audio files (MP3, WAV, AAC) and high-res cover art with global CDN acceleration! Bypasses browser base64 limits.
              </p>
            </div>
          </div>

          <a
            href="https://cloudinary.com/console"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-2 flex-shrink-0"
          >
            <span>Open Cloudinary Dashboard</span>
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="bg-[#0b0e1b]/80 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Key className="w-4 h-4 text-cyan-400" />
                  <span>Configure Cloudinary API Credentials</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter your Cloud Name & Unsigned Upload Preset below.
                </p>
              </div>
              <ShieldCheck className="w-6 h-6 text-emerald-400 opacity-80" />
            </div>

            {/* Cloud Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-cyan-300 uppercase tracking-wider font-mono">
                Cloud Name *
              </label>
              <input
                type="text"
                placeholder="e.g. dxy123456 or skplayer-audio"
                value={cloudName}
                onChange={(e) => setCloudName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-black/50 border border-white/12 focus:border-cyan-400 rounded-2xl text-slate-100 outline-none text-sm transition-all font-mono placeholder-slate-600"
              />
              <p className="text-[10px] text-slate-500 font-mono">
                Found on your main Cloudinary Dashboard page under "Cloud Name".
              </p>
            </div>

            {/* Upload Preset */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-cyan-300 uppercase tracking-wider font-mono">
                Unsigned Upload Preset *
              </label>
              <input
                type="text"
                placeholder="e.g. skplayer_preset or ml_default"
                value={uploadPreset}
                onChange={(e) => setUploadPreset(e.target.value)}
                required
                className="w-full px-4 py-3 bg-black/50 border border-white/12 focus:border-cyan-400 rounded-2xl text-slate-100 outline-none text-sm transition-all font-mono placeholder-slate-600"
              />
              <p className="text-[10px] text-slate-500 font-mono">
                Go to Settings ➔ Upload ➔ Add upload preset ➔ Set mode to <strong className="text-cyan-400">Unsigned</strong>.
              </p>
            </div>

            {/* API Key (Optional) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                API Key (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 123456789012345"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-4 py-3 bg-black/50 border border-white/12 focus:border-cyan-400/40 rounded-2xl text-slate-300 outline-none text-sm transition-all font-mono placeholder-slate-600"
              />
            </div>

            {/* Verification Status Feedback Box */}
            {testResult && (
              <div className={`p-4 rounded-2xl border text-xs font-mono flex items-start space-x-3 transition-all ${
                testResult.success
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                  : "bg-red-950/40 border-red-500/30 text-red-300"
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-bold block">{testResult.success ? "Status Verified" : "Error"}</span>
                  <span>{testResult.message}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !cloudName.trim() || !uploadPreset.trim()}
                className="w-full sm:w-auto px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl border border-white/15 transition-all text-xs flex items-center justify-center space-x-2 disabled:opacity-40"
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 text-yellow-400" />
                )}
                <span>Test Connection</span>
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Save & Sync Settings</span>
              </button>
            </div>
          </form>
        </div>

        {/* Instructions Guide Column (1 Col) */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-black border border-indigo-500/20 rounded-3xl p-6 space-y-4 shadow-xl backdrop-blur-2xl">
            <h3 className="text-sm font-bold text-cyan-300 flex items-center space-x-2 uppercase tracking-wider font-mono">
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              <span>How to get Free Cloudinary Credentials (1 Minute)</span>
            </h3>

            <ol className="space-y-3.5 text-xs text-slate-300 leading-relaxed list-decimal list-inside font-sans">
              <li className="pl-1">
                Open <a href="https://cloudinary.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-semibold">Cloudinary.com</a> and sign up or log in.
              </li>
              <li className="pl-1">
                Copy your <strong className="text-white">Cloud Name</strong> displayed at the top of your Dashboard.
              </li>
              <li className="pl-1">
                Click the <strong className="text-white">Settings Gear ⚙️ ➔ Upload</strong> tab in Cloudinary.
              </li>
              <li className="pl-1">
                Scroll down to <strong className="text-white font-mono">Upload presets</strong> and click <strong className="text-cyan-400">Add upload preset</strong>.
              </li>
              <li className="pl-1">
                Change Signing Mode from <em>Signed</em> to <strong className="text-emerald-400 font-mono font-bold">Unsigned</strong>, copy the preset name, and click Save!
              </li>
              <li className="pl-1">
                Paste the <strong className="text-white">Cloud Name</strong> and <strong className="text-white">Upload Preset</strong> above and click <strong className="text-cyan-400">Save & Sync Settings</strong>!
              </li>
            </ol>

            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-200 flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <span>
                Once saved, all audio/song file uploads will stream directly to Cloudinary at high speed with progress percentage tracking!
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
