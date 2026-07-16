import { useState } from "react";
import { Settings, X, Volume2, MapPin } from "lucide-react";
import type { VoiceSettings } from "@/hooks/useJarvis";

interface ElevenLabsVoice {
  key: string;
  id: string;
  label: string;
}

interface VoiceSettingsPanelProps {
  voiceSettings: VoiceSettings;
  elevenLabsVoices: ElevenLabsVoice[];
  onUpdate: (updates: Partial<VoiceSettings>) => void;
  homeZipCode?: string | null;
  onSaveZip?: (zip: string) => void;
}

export default function VoiceSettingsPanel({
  voiceSettings,
  elevenLabsVoices,
  onUpdate,
  homeZipCode,
  onSaveZip,
}: VoiceSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [zipInput, setZipInput] = useState<string>("");

  const hudBorder = "1px solid oklch(0.22 0.05 210 / 0.5)";
  const hudBg = "oklch(0.07 0.012 220 / 0.97)";
  const labelColor = "#00ccee55";
  const valueColor = "#00ccee";

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex-shrink-0 w-10 h-10 rounded-sm flex items-center justify-center transition-all duration-200"
        style={{
          background: open ? "oklch(0.72 0.18 200 / 0.15)" : "oklch(0.09 0.015 220)",
          border: open ? "1px solid #00ccee88" : hudBorder,
          color: open ? valueColor : "#00ccee44",
          boxShadow: open ? "0 0 8px #00ccee33" : "none",
        }}
        title="Voice settings"
      >
        <Settings size={14} />
      </button>

      {/* Settings drawer */}
      {open && (
        <div
          className="fixed z-50 rounded-sm p-4 shadow-2xl"
          style={{
            background: hudBg,
            border: hudBorder,
            boxShadow: "0 0 24px oklch(0.72 0.18 200 / 0.15)",
            bottom: "80px",
            right: "8px",
            left: "8px",
            maxWidth: "320px",
            marginLeft: "auto",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-2 border-b" style={{ borderColor: "oklch(0.22 0.05 210 / 0.4)" }}>
            <div className="flex items-center gap-2">
              <Volume2 size={12} style={{ color: valueColor }} />
              <span className="text-xs font-mono tracking-widest" style={{ color: valueColor }}>VOICE SETTINGS</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-6 h-6 flex items-center justify-center rounded-sm transition-opacity hover:opacity-100 opacity-50"
              style={{ color: "#00ccee", border: "1px solid oklch(0.22 0.05 210 / 0.4)" }}
            >
              <X size={10} />
            </button>
          </div>

          {/* ElevenLabs voice selector */}
          <div className="mb-4">
            <label className="block text-xs font-mono mb-1.5" style={{ color: labelColor }}>
              AI VOICE (ELEVENLABS)
            </label>
            <select
              value={voiceSettings.voiceKey}
              onChange={(e) => onUpdate({ voiceKey: e.target.value })}
              className="w-full text-xs font-mono px-2 py-2 rounded-sm outline-none"
              style={{
                background: "oklch(0.09 0.015 220)",
                border: hudBorder,
                color: "#b0e8f0",
              }}
            >
              {elevenLabsVoices.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs font-mono" style={{ color: "#00ccee33" }}>
              Powered by ElevenLabs AI
            </div>
          </div>

          {/* Speech rate */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono" style={{ color: labelColor }}>SPEECH RATE</label>
              <span className="text-xs font-mono" style={{ color: valueColor }}>{voiceSettings.rate.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={voiceSettings.rate}
              onChange={(e) => onUpdate({ rate: parseFloat(e.target.value) })}
              className="w-full h-1 rounded-full outline-none cursor-pointer"
              style={{
                accentColor: "#00ccee",
                background: `linear-gradient(to right, #00ccee ${((voiceSettings.rate - 0.5) / 1.5) * 100}%, oklch(0.22 0.05 210 / 0.4) 0%)`,
              }}
            />
            <div className="flex justify-between text-xs font-mono mt-0.5" style={{ color: labelColor }}>
              <span>SLOW</span><span>NORMAL</span><span>FAST</span>
            </div>
          </div>

          {/* Home zip code */}
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <MapPin size={10} style={{ color: labelColor }} />
              <label className="text-xs font-mono" style={{ color: labelColor }}>HOME ZIP CODE</label>
              {homeZipCode && (
                <span className="text-xs font-mono ml-auto" style={{ color: valueColor }}>{homeZipCode} ✓</span>
              )}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder={homeZipCode ?? "e.g. 13820"}
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
                maxLength={5}
                className="flex-1 text-xs font-mono px-2 py-1.5 rounded-sm outline-none"
                style={{ background: "oklch(0.09 0.015 220)", border: hudBorder, color: "#b0e8f0" }}
              />
              <button
                type="button"
                disabled={zipInput.length !== 5}
                onClick={() => { if (zipInput.length === 5) { onSaveZip?.(zipInput); setZipInput(""); } }}
                className="text-xs font-mono px-2 py-1.5 rounded-sm transition-all duration-150 disabled:opacity-30"
                style={{ background: "oklch(0.15 0.04 200)", border: "1px solid #00ccee44", color: valueColor }}
              >
                SAVE
              </button>
            </div>
            <div className="mt-1 text-xs font-mono" style={{ color: "#00ccee33" }}>
              SENTINEL uses this for weather queries automatically
            </div>
          </div>

          {/* Electronic reverb intensity */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono" style={{ color: labelColor }}>REVERB / ELECTRONIC FX</label>
              <span className="text-xs font-mono" style={{ color: valueColor }}>
                {voiceSettings.reverbIntensity === 0 ? "DRY" : voiceSettings.reverbIntensity < 0.4 ? "LIGHT" : voiceSettings.reverbIntensity < 0.7 ? "MEDIUM" : "HEAVY"}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={voiceSettings.reverbIntensity ?? 0.55}
              onChange={(e) => onUpdate({ reverbIntensity: parseFloat(e.target.value) })}
              className="w-full h-1 rounded-full outline-none cursor-pointer"
              style={{
                accentColor: "#00ccee",
                background: `linear-gradient(to right, #00ccee ${((voiceSettings.reverbIntensity ?? 0.55)) * 100}%, oklch(0.22 0.05 210 / 0.4) 0%)`,
              }}
            />
            <div className="flex justify-between text-xs font-mono mt-0.5" style={{ color: labelColor }}>
              <span>DRY</span><span>SUIT RADIO</span><span>HEAVY FX</span>
            </div>
            <div className="mt-1 text-xs font-mono" style={{ color: "#00ccee33" }}>
              Applies to ElevenLabs TTS only
            </div>
          </div>

          {/* Reset button */}
          <button
            type="button"
            onClick={() => onUpdate({ voiceKey: "daniel", rate: 1.0, pitch: 0.85, reverbIntensity: 0.55 })}
            className="w-full text-xs font-mono py-1.5 rounded-sm transition-all duration-200 hover:opacity-100 opacity-60"
            style={{
              background: "transparent",
              border: hudBorder,
              color: "#00ccee",
            }}
          >
            RESET TO DEFAULTS
          </button>
        </div>
      )}
    </>
  );
}
