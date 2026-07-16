/**
 * SentinelWindow — The SENTINEL AI Brain
 *
 * Full-featured chat window that uses the useSentinel hook for:
 * - ElevenLabs TTS with reverb DSP chain
 * - Whisper STT fallback
 * - Persistent session history
 * - Tool dispatch (weather, maps, directions, NWS alerts, Spotify, calendar, etc.)
 * - open_window tool: emits a custom DOM event so DesktopOS can open windows
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { Mic, MicOff, Send, Trash2, Volume2, VolumeX, ImagePlus, X, ChevronDown, Brain, Database } from "lucide-react";
import MessageBubble from "@/components/MessageBubble";
import WaveformVisualizer from "@/components/WaveformVisualizer";
import VoiceSettingsPanel from "@/components/VoiceSettingsPanel";
import { useSentinel } from "@/hooks/useJarvis";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── open_window bridge ────────────────────────────────────────────────────────
function useOpenWindowBridge(toolsUsed: string[]) {
  useEffect(() => {
    for (const t of toolsUsed) {
      if (t.startsWith("open_window:")) {
        // Format: "open_window:<windowType>" or "open_window:<windowType>:<jsonData>"
        const rest = t.slice("open_window:".length);
        const colonIdx = rest.indexOf(":");
        const windowType = colonIdx === -1 ? rest : rest.slice(0, colonIdx);
        const dataStr = colonIdx === -1 ? undefined : rest.slice(colonIdx + 1);
        let routeData: Record<string, unknown> | undefined;
        if (dataStr) {
          try { routeData = JSON.parse(dataStr) as Record<string, unknown>; } catch { /* ignore */ }
        }
        if (windowType) {
          window.dispatchEvent(new CustomEvent("sentinel:open-window", { detail: { windowType, routeData } }));
        }
      }
    }
  }, [toolsUsed]);
}

// ── Suggested prompts ─────────────────────────────────────────────────────────
const SUGGESTED_PROMPTS = [
  "What's the weather like right now?",
  "Any active weather alerts near me?",
  "What's on my calendar today?",
  "Play some music on Spotify",
  "Get directions to the nearest airport",
  "What's the air quality index today?",
  "Open the maps window",
  "Good morning, SENTINEL",
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function SentinelWindow(_props: { data?: unknown }) {
  const {
    state,
    messages,
    error,
    voiceName,
    isListeningSupported,
    lastToolsUsed,
    elevenLabsVoices,
    voiceSettings,
    calendarConnected,
    spotifyConnected,
    nowPlaying,
    userPreferences,
    updateVoiceSettings,
    startListening,
    stopListening,
    stopSpeaking,
    sendMessage,
    clearHistory,
  } = useSentinel();

  useOpenWindowBridge(lastToolsUsed);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textInput, setTextInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [activePanel, setActivePanel] = useState<"chat" | "memory">("chat");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(isAtBottom);
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const clearImage = useCallback(() => {
    setImageFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }, [imagePreviewUrl]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (state === "thinking") return;

    if (imageFile) {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("question", textInput.trim() || "Describe this image in detail.");
      clearImage();
      setTextInput("");
      try {
        const res = await fetch("/api/analyze-image", { method: "POST", body: formData });
        const json = await res.json() as { analysis?: string; error?: string };
        sendMessage(json.analysis ? `[Image analysis]: ${json.analysis}` : "I was unable to analyse that image, sir.");
      } catch {
        sendMessage("Image analysis failed. Please try again.");
      }
      return;
    }

    if (!textInput.trim()) return;
    const text = textInput.trim();
    setTextInput("");
    sendMessage(text);
  }, [state, imageFile, textInput, clearImage, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }, [handleSubmit]);

  const handleMicClick = useCallback(() => {
    if (state === "listening") stopListening();
    else if (state === "speaking") stopSpeaking();
    else startListening();
  }, [state, startListening, stopListening, stopSpeaking]);

  const isActive = state === "listening" || state === "speaking";
  const isThinking = state === "thinking";

  void isMuted; // suppress unused warning

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden"
      style={{ background: "oklch(0.04 0.01 220 / 0.98)", fontFamily: "'Exo 2', sans-serif" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid oklch(0.72 0.18 200 / 0.2)", background: "oklch(0.06 0.015 220 / 0.95)" }}
      >
        <div className="flex items-center gap-3">
          <div className="relative w-7 h-7 flex-shrink-0">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle at 40% 35%, oklch(0.85 0.22 200), oklch(0.45 0.28 210) 60%, oklch(0.12 0.18 220))",
                boxShadow: "0 0 12px oklch(0.72 0.18 200 / 0.7), 0 0 4px oklch(0.72 0.18 200 / 0.9) inset",
              }}
            />
            <div className="absolute inset-[4px] rounded-full" style={{ background: "oklch(0.08 0.02 220)", boxShadow: "0 0 6px oklch(0.72 0.18 200 / 0.5) inset" }} />
          </div>
          <div>
            <div className="text-xs font-mono tracking-[0.25em] font-bold" style={{ color: "#00ccee", textShadow: "0 0 8px #00ccee88" }}>
              SENTINEL
            </div>
            <div className="text-[10px] font-mono tracking-widest" style={{ color: "oklch(0.72 0.18 200 / 0.5)" }}>
              INTELLIGENT ASSISTANT PLATFORM
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {calendarConnected && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm" style={{ color: "#00ff88", border: "1px solid oklch(0.55 0.22 150 / 0.4)", background: "oklch(0.55 0.22 150 / 0.1)" }}>CAL</span>
          )}
          {spotifyConnected && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm" style={{ color: "#1db954", border: "1px solid oklch(0.55 0.22 145 / 0.4)", background: "oklch(0.55 0.22 145 / 0.1)" }}>SPT</span>
          )}

          <div
            className="text-[10px] font-mono tracking-widest px-2 py-1 rounded-sm"
            style={{
              color: state === "idle" ? "oklch(0.72 0.18 200 / 0.5)" : state === "listening" ? "#00ff88" : state === "thinking" ? "#ffcc44" : "#00ccee",
              border: `1px solid ${state === "idle" ? "oklch(0.72 0.18 200 / 0.15)" : state === "listening" ? "oklch(0.55 0.22 150 / 0.5)" : state === "thinking" ? "oklch(0.55 0.22 60 / 0.5)" : "oklch(0.72 0.18 200 / 0.5)"}`,
              background: state === "idle" ? "transparent" : state === "listening" ? "oklch(0.55 0.22 150 / 0.1)" : state === "thinking" ? "oklch(0.55 0.22 60 / 0.1)" : "oklch(0.72 0.18 200 / 0.1)",
            }}
          >
            {state === "idle" ? "STANDBY" : state === "listening" ? "LISTENING" : state === "thinking" ? "PROCESSING" : "SPEAKING"}
          </div>

          <button
            onClick={() => setIsMuted((m) => !m)}
            title={isMuted ? "Unmute voice" : "Mute voice"}
            className="p-1.5 rounded-sm transition-all"
            style={{ color: isMuted ? "oklch(0.72 0.18 200 / 0.3)" : "#00ccee", border: "1px solid oklch(0.72 0.18 200 / 0.2)", background: "transparent" }}
          >
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>

          <VoiceSettingsPanel
            voiceSettings={voiceSettings}
            elevenLabsVoices={elevenLabsVoices}
            onUpdate={updateVoiceSettings}
            homeZipCode={userPreferences?.homeZipCode ?? undefined}
          />

          <button
            onClick={() => setActivePanel((p) => p === "memory" ? "chat" : "memory")}
            title="Memory review"
            className="p-1.5 rounded-sm transition-all"
            style={{
              color: activePanel === "memory" ? "#00ccee" : "oklch(0.72 0.18 200 / 0.4)",
              border: `1px solid ${activePanel === "memory" ? "oklch(0.72 0.18 200 / 0.5)" : "oklch(0.72 0.18 200 / 0.15)"}`,
              background: activePanel === "memory" ? "oklch(0.72 0.18 200 / 0.1)" : "transparent",
            }}
          >
            <Database size={13} />
          </button>

          <button
            onClick={clearHistory}
            title="Clear conversation"
            className="p-1.5 rounded-sm transition-all"
            style={{ color: "oklch(0.72 0.18 200 / 0.4)", border: "1px solid oklch(0.72 0.18 200 / 0.15)", background: "transparent" }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Waveform */}
      {isActive && (
        <div className="flex items-center justify-center py-2 flex-shrink-0" style={{ borderBottom: "1px solid oklch(0.72 0.18 200 / 0.1)" }}>
          <WaveformVisualizer active={isActive} color={state === "listening" ? "#00ff88" : "#00ccee"} barCount={24} />
        </div>
      )}

      {/* Now Playing */}
      {spotifyConnected && nowPlaying?.playing && nowPlaying.track && (
        <div className="flex items-center gap-2 px-4 py-1.5 flex-shrink-0" style={{ borderBottom: "1px solid oklch(0.72 0.18 200 / 0.1)", background: "oklch(0.55 0.22 145 / 0.06)" }}>
          {nowPlaying.track.albumArt && <img src={nowPlaying.track.albumArt} alt="album" className="w-5 h-5 rounded-sm flex-shrink-0" />}
          <span className="text-[10px] font-mono" style={{ color: "#1db954" }}>♪</span>
          <span className="text-[10px] font-mono truncate" style={{ color: "oklch(0.72 0.18 200 / 0.6)" }}>
            {nowPlaying.track.name} — {nowPlaying.track.artist}
          </span>
        </div>
      )}

      {/* Memory Panel */}
      {activePanel === "memory" && <MemoryPanel onClose={() => setActivePanel("chat")} />}

      {/* Messages */}
      {activePanel === "chat" && (
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{ scrollbarWidth: "thin", scrollbarColor: "oklch(0.72 0.18 200 / 0.2) transparent" }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
            <div className="relative w-20 h-20 opacity-20">
              <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 40% 35%, oklch(0.85 0.22 200), oklch(0.45 0.28 210) 60%, oklch(0.12 0.18 220))", boxShadow: "0 0 30px oklch(0.72 0.18 200 / 0.5)" }} />
              <div className="absolute inset-[10px] rounded-full" style={{ background: "oklch(0.08 0.02 220)" }} />
            </div>
            <div className="text-center">
              <div className="text-sm font-mono tracking-[0.3em] mb-1" style={{ color: "oklch(0.72 0.18 200 / 0.5)" }}>SENTINEL ONLINE</div>
              <div className="text-xs font-mono" style={{ color: "oklch(0.72 0.18 200 / 0.3)" }}>How may I assist you today, sir?</div>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-left text-[11px] font-mono px-3 py-2 rounded-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ color: "oklch(0.72 0.18 200 / 0.6)", border: "1px solid oklch(0.72 0.18 200 / 0.15)", background: "oklch(0.06 0.015 220 / 0.8)" }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isThinking && (
              <div className="flex items-start gap-2">
                <div className="px-4 py-3 rounded-sm text-sm font-mono" style={{ background: "oklch(0.08 0.015 220 / 0.55)", border: "1px solid oklch(0.72 0.18 200 / 0.35)", color: "#00ccee" }}>
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
                  </span>
                  <span className="ml-2 text-[10px] tracking-widest opacity-60">PROCESSING</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      )}

      {/* Scroll to bottom */}
      {!autoScroll && (
        <div className="flex justify-center pb-1 flex-shrink-0">
          <button
            onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); setAutoScroll(true); }}
            className="flex items-center gap-1 text-[10px] font-mono px-3 py-1 rounded-full"
            style={{ color: "#00ccee", border: "1px solid oklch(0.72 0.18 200 / 0.3)", background: "oklch(0.06 0.015 220 / 0.9)" }}
          >
            <ChevronDown size={11} /> SCROLL TO BOTTOM
          </button>
        </div>
      )}

      {/* Error — styled as a SENTINEL advisory bubble, not a raw red block */}
      {error && (
        <div className="mx-4 mb-2 flex-shrink-0">
          <div
            className="px-4 py-3 rounded-sm text-sm font-mono"
            style={{
              background: "oklch(0.08 0.015 220 / 0.7)",
              border: "1px solid oklch(0.55 0.22 25 / 0.45)",
              color: "oklch(0.85 0.12 25)",
              position: "relative",
            }}
          >
            {/* HUD corner brackets */}
            <span style={{ position: "absolute", top: 4, left: 4, color: "oklch(0.55 0.22 25 / 0.6)", fontSize: 10, lineHeight: 1 }}>[┌</span>
            <span style={{ position: "absolute", bottom: 4, right: 4, color: "oklch(0.55 0.22 25 / 0.6)", fontSize: 10, lineHeight: 1 }}>┘]</span>
            <div className="text-[10px] tracking-widest mb-1" style={{ color: "oklch(0.65 0.22 25 / 0.8)" }}>SENTINEL · SYSTEM ADVISORY</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* Image preview */}
      {imagePreviewUrl && (
        <div className="mx-4 mb-2 flex items-center gap-2 flex-shrink-0">
          <img src={imagePreviewUrl} alt="preview" className="w-12 h-12 object-cover rounded-sm" style={{ border: "1px solid oklch(0.72 0.18 200 / 0.3)" }} />
          <span className="text-[10px] font-mono" style={{ color: "oklch(0.72 0.18 200 / 0.5)" }}>{imageFile?.name}</span>
          <button onClick={clearImage} className="ml-auto p-1" style={{ color: "oklch(0.72 0.18 200 / 0.4)" }}><X size={12} /></button>
        </div>
      )}

      {/* Voice name */}
      {voiceName && (
        <div className="px-4 pb-1 flex-shrink-0">
          <span className="text-[9px] font-mono tracking-widest" style={{ color: "oklch(0.72 0.18 200 / 0.3)" }}>VOICE: {voiceName.toUpperCase()}</span>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex items-end gap-2 px-4 pb-4 pt-2 flex-shrink-0"
        style={{ borderTop: "1px solid oklch(0.72 0.18 200 / 0.15)" }}
      >
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          title="Attach image"
          className="p-2 rounded-sm flex-shrink-0 transition-all active:scale-95"
          style={{ color: imageFile ? "#00ccee" : "oklch(0.72 0.18 200 / 0.35)", border: "1px solid oklch(0.72 0.18 200 / 0.2)", background: "transparent" }}
        >
          <ImagePlus size={15} />
        </button>

        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={state === "listening" ? "Listening…" : state === "thinking" ? "Processing…" : state === "speaking" ? "Speaking…" : "Ask SENTINEL anything…"}
            rows={1}
            disabled={state === "thinking"}
            className="w-full resize-none rounded-sm px-3 py-2 text-sm font-mono outline-none transition-all"
            style={{ background: "oklch(0.06 0.015 220 / 0.8)", border: "1px solid oklch(0.72 0.18 200 / 0.25)", color: "#b0e8f0", caretColor: "#00ccee", maxHeight: "120px", scrollbarWidth: "none" }}
          />
        </div>

        {isListeningSupported && (
          <button
            type="button"
            onClick={handleMicClick}
            title={state === "listening" ? "Stop listening" : state === "speaking" ? "Stop speaking" : "Start listening"}
            className="p-2 rounded-sm flex-shrink-0 transition-all active:scale-95"
            style={{
              color: state === "listening" ? "#00ff88" : state === "speaking" ? "#00ccee" : "oklch(0.72 0.18 200 / 0.5)",
              border: `1px solid ${state === "listening" ? "oklch(0.55 0.22 150 / 0.5)" : state === "speaking" ? "oklch(0.72 0.18 200 / 0.4)" : "oklch(0.72 0.18 200 / 0.2)"}`,
              background: state === "listening" ? "oklch(0.55 0.22 150 / 0.1)" : "transparent",
              boxShadow: state === "listening" ? "0 0 8px oklch(0.55 0.22 150 / 0.3)" : "none",
            }}
          >
            {state === "listening" ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
        )}

        <button
          type="submit"
          disabled={state === "thinking" || (!textInput.trim() && !imageFile)}
          className="p-2 rounded-sm flex-shrink-0 transition-all active:scale-95 disabled:opacity-30"
          style={{ color: "#00ccee", border: "1px solid oklch(0.72 0.18 200 / 0.35)", background: "oklch(0.72 0.18 200 / 0.08)", boxShadow: "0 0 8px oklch(0.72 0.18 200 / 0.15)" }}
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}

// ── Memory Panel ──────────────────────────────────────────────────────────────
function MemoryPanel({ onClose }: { onClose: () => void }) {
  const { data, isLoading, refetch } = trpc.sentinel.getFacts.useQuery();
  const deleteFact = trpc.sentinel.deleteFact.useMutation({
    onSuccess: () => {
      void refetch();
      toast.success("Memory erased");
    },
    onError: () => toast.error("Failed to erase memory"),
  });
  const saveFact = trpc.sentinel.saveFact.useMutation({
    onSuccess: () => {
      void refetch();
      toast.success("Memory updated");
    },
  });

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const facts = (data as { key: string; value: string; updatedAt?: string | null }[] | undefined) ?? [];

  const handleEdit = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue);
  };

  const handleSaveEdit = (key: string) => {
    if (editValue.trim()) {
      saveFact.mutate({ key, value: editValue.trim() });
    }
    setEditingKey(null);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid oklch(0.72 0.18 200 / 0.15)", background: "oklch(0.06 0.015 220 / 0.8)" }}
      >
        <div className="flex items-center gap-2">
          <Database size={12} style={{ color: "#00ccee" }} />
          <span className="text-[11px] font-mono tracking-widest" style={{ color: "#00ccee" }}>
            MEMORY CORE
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm" style={{ color: "oklch(0.72 0.18 200 / 0.5)", border: "1px solid oklch(0.72 0.18 200 / 0.2)" }}>
            {facts.length} RECORDS
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-sm"
          style={{ color: "oklch(0.72 0.18 200 / 0.4)", border: "1px solid oklch(0.72 0.18 200 / 0.15)" }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Facts list */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: "oklch(0.72 0.18 200 / 0.2) transparent" }}
      >
        {isLoading ? (
          <div className="text-center py-8 text-[11px] font-mono" style={{ color: "oklch(0.72 0.18 200 / 0.4)" }}>
            ACCESSING MEMORY CORE...
          </div>
        ) : facts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Brain size={32} style={{ color: "oklch(0.72 0.18 200 / 0.2)" }} />
            <div className="text-[11px] font-mono text-center" style={{ color: "oklch(0.72 0.18 200 / 0.35)" }}>
              NO MEMORY RECORDS FOUND
              <br />
              <span style={{ color: "oklch(0.72 0.18 200 / 0.25)" }}>
                Tell me something to remember, sir
              </span>
            </div>
          </div>
        ) : (
          facts.map((fact) => (
            <div
              key={fact.key}
              className="rounded-sm px-3 py-2"
              style={{
                background: "oklch(0.06 0.015 220 / 0.6)",
                border: "1px solid oklch(0.72 0.18 200 / 0.15)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-mono tracking-widest mb-1" style={{ color: "oklch(0.72 0.18 200 / 0.4)" }}>
                    {fact.key.toUpperCase().replace(/_/g, " ")}
                  </div>
                  {editingKey === fact.key ? (
                    <div className="flex gap-1 mt-1">
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(fact.key);
                          if (e.key === "Escape") setEditingKey(null);
                        }}
                        className="flex-1 text-xs font-mono px-2 py-1 rounded-sm outline-none"
                        style={{
                          background: "oklch(0.08 0.015 220 / 0.8)",
                          border: "1px solid oklch(0.72 0.18 200 / 0.4)",
                          color: "#b0e8f0",
                        }}
                      />
                      <button
                        onClick={() => handleSaveEdit(fact.key)}
                        className="text-[10px] font-mono px-2 py-1 rounded-sm"
                        style={{ color: "#00ccee", border: "1px solid oklch(0.72 0.18 200 / 0.4)", background: "oklch(0.72 0.18 200 / 0.1)" }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingKey(null)}
                        className="text-[10px] font-mono px-2 py-1 rounded-sm"
                        style={{ color: "oklch(0.72 0.18 200 / 0.4)", border: "1px solid oklch(0.72 0.18 200 / 0.2)" }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs font-mono" style={{ color: "#b0e8f0" }}>
                      {fact.value}
                    </div>
                  )}
                  {fact.updatedAt && (
                    <div className="text-[9px] font-mono mt-1" style={{ color: "oklch(0.72 0.18 200 / 0.25)" }}>
                      {new Date(fact.updatedAt).toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(fact.key, fact.value)}
                    title="Edit"
                    className="p-1 rounded-sm transition-all"
                    style={{ color: "oklch(0.72 0.18 200 / 0.4)", border: "1px solid oklch(0.72 0.18 200 / 0.15)" }}
                  >
                    <span className="text-[10px] font-mono">✎</span>
                  </button>
                  <button
                    onClick={() => deleteFact.mutate({ key: fact.key })}
                    title="Delete"
                    className="p-1 rounded-sm transition-all"
                    style={{ color: "oklch(0.55 0.22 25 / 0.5)", border: "1px solid oklch(0.55 0.22 25 / 0.2)" }}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
