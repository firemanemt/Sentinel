import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ArcReactor from "@/components/ArcReactor";
import MessageBubble from "@/components/MessageBubble";
import WaveformVisualizer from "@/components/WaveformVisualizer";
import { HudScanLine, HudCornerBrackets, HudStatusBar } from "@/components/HudDecorations";
import HexGrid from "@/components/HexGrid";
import HudParticles from "@/components/HudParticles";
import { useSentinel } from "@/hooks/useJarvis";
import { trpc } from "@/lib/trpc";
import { useWakeWord } from "@/hooks/useWakeWord";
import { useLayout } from "@/hooks/useLayout";
import LayoutSwitcher from "@/components/LayoutSwitcher";
import { Mic, MicOff, Send, Trash2, Volume2, Radio, CalendarDays, Music, ImagePlus } from "lucide-react";
import VoiceSettingsPanel from "@/components/VoiceSettingsPanel";
import NowPlayingWidget from "@/components/NowPlayingWidget";
import BlueprintSchematic from "@/components/BlueprintSchematic";
import { WeatherForecastPanel } from "@/components/WeatherForecastPanel";
import { StockTickerPanel } from "@/components/StockTickerPanel";
import { ReminderPanel } from "@/components/ReminderPanel";
import { NewsTicker } from "@/components/NewsTicker";
import { HudThemePanel } from "@/components/HudThemePanel";
import { useHudTheme } from "@/hooks/useHudTheme";
import type { LayoutMode } from "@/hooks/useLayout";

export default function Home() {
  const {
    state,
    messages,
    error,
    voiceName,
    isListeningSupported,
    isTtsSupported,
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

  const { layout, setLayout, cycleLayout } = useLayout();
  const { theme, setTheme, intensity, setIntensity, config: hudConfig } = useHudTheme();

  // Page Visibility API — pause canvas animations when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      document.documentElement.style.setProperty(
        "--hud-paused",
        document.hidden ? "paused" : "running"
      );
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const prevStateRef = useRef<string>("idle");
  useEffect(() => { prevStateRef.current = state; }, [state]);

  // No-op first interaction handler (sounds removed)
  const handleFirstInteraction = useCallback(() => {}, []);

  // Gmail unread badge — auto-refreshes every 60 seconds when calendar/Gmail is connected
  const { data: gmailUnread } = trpc.sentinel.gmailUnreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
    enabled: calendarConnected,
  });
  const gmailUnreadCount = gmailUnread?.count ?? 0;

  const [textInput, setTextInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleTextSubmitWithImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "thinking") return;
    if (imageFile) {
      // Upload image and get analysis
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("question", textInput.trim() || "Describe this image in detail.");
      clearImage();
      setTextInput("");
      try {
        const res = await fetch("/api/analyze-image", { method: "POST", body: formData });
        const json = await res.json() as { analysis?: string; error?: string };
        if (json.analysis) {
          sendMessage(`[Image analysis]: ${json.analysis}`);
        } else {
          sendMessage("I was unable to analyse that image, sir.");
        }
      } catch {
        sendMessage("Image analysis failed. Please try again.");
      }
      return;
    }
    if (!textInput.trim()) return;
    sendMessage(textInput.trim());
    setTextInput("");
  };
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [wakeWordError, setWakeWordError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef(state);

  useEffect(() => { stateRef.current = state; }, [state]);

  const handleWakeWordDetected = useCallback((commandAfterWakeWord?: string) => {
    if (stateRef.current !== "idle") return;
    if (commandAfterWakeWord && commandAfterWakeWord.trim().length > 3) {
      sendMessage(commandAfterWakeWord);
    } else {
      startListening();
    }
  }, [sendMessage, startListening]);

  const { isListening: isWakeWordListening } = useWakeWord({
    enabled: wakeWordEnabled && isListeningSupported && state === "idle",
    onWakeWordDetected: handleWakeWordDetected,
    onError: (msg) => setWakeWordError(msg),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && document.activeElement === document.body) {
        e.preventDefault();
        if (state === "idle") startListening();
        else if (state === "listening") stopListening();
        else if (state === "speaking") stopSpeaking();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, startListening, stopListening, stopSpeaking]);

  // handleTextSubmit is replaced by handleTextSubmitWithImage above

  const handleMicClick = () => {
    if (state === "idle") startListening();
    else if (state === "listening") stopListening();
    else if (state === "speaking") stopSpeaking();
  };

  const toggleWakeWord = () => {
    setWakeWordError(null);
    setWakeWordEnabled((prev) => !prev);
  };

  const statusText =
    wakeWordEnabled && isWakeWordListening ? "WAKE-WORD ACTIVE" :
    state === "idle" ? "SYSTEM READY" :
    state === "listening" ? "VOICE INPUT ACTIVE" :
    state === "thinking" ? "PROCESSING REQUEST" :
    "AUDIO OUTPUT ACTIVE";

  const combinedError = error || wakeWordError;

  // ── Shared sub-components ────────────────────────────────────────────────

  const arcReactorArea = ({ size, compact }: { size: number; compact?: boolean }) => (
    <div
      className="flex flex-col items-center justify-center relative"
      style={{
        padding: compact ? "16px 0" : "24px 0",
        borderBottom: "1px solid oklch(0.22 0.05 210 / 0.3)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{
          background: state === "listening"
            ? "radial-gradient(ellipse 70% 70% at 50% 50%, oklch(0.72 0.18 200 / 0.12) 0%, transparent 70%)"
            : state === "thinking"
              ? "radial-gradient(ellipse 65% 65% at 50% 50%, oklch(0.55 0.22 250 / 0.1) 0%, transparent 70%)"
              : state === "speaking"
                ? "radial-gradient(ellipse 80% 80% at 50% 50%, oklch(0.72 0.18 200 / 0.15) 0%, transparent 70%)"
                : "radial-gradient(ellipse 60% 60% at 50% 50%, oklch(0.72 0.18 200 / 0.04) 0%, transparent 70%)",
        }}
      />
      <ArcReactor state={state} size={size} themeColor={hudConfig.primaryHex} />
      {wakeWordEnabled && isWakeWordListening && state === "idle" && (
        <div
          className="absolute"
          style={{
            width: size + 30,
            height: size + 30,
            borderRadius: "50%",
            border: "1px solid #00ccee33",
            boxShadow: "0 0 15px #00ccee22",
            animation: "arc-pulse 3s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}
      {!compact && (
        <div className="mt-4 w-48 sm:w-64">
          <WaveformVisualizer active={state === "speaking"} />
        </div>
      )}
      {state === "thinking" && (
        <div className="flex gap-2 mt-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: "#4488ff",
                boxShadow: "0 0 6px #4488ff",
                animation: `thinking-dots 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      )}
      {wakeWordEnabled && state === "idle" && (
        <div className="mt-3 text-xs font-mono tracking-widest" style={{ color: "#00ccee55" }}>
          SAY "HEY SENTINEL" TO ACTIVATE
        </div>
      )}
    </div>
  );

  const chatPanel = useMemo(() => (
    <div
      className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      style={{ scrollbarWidth: "thin", scrollbarColor: "#00ccee33 transparent", background: "transparent" }}
    >
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
          <div className="text-sm font-mono tracking-widest text-center" style={{ color: "#00ccee" }}>
            SENTINEL ONLINE
          </div>
          <div className="text-xs font-mono tracking-wider text-center max-w-xs" style={{ color: "#00ccee88", fontFamily: "'Exo 2', sans-serif" }}>
            Press the microphone button, use the text input, or enable wake-word mode and say "Hey SENTINEL".
          </div>
        </div>
      ) : (
        messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
      )}
      <div ref={messagesEndRef} />
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [messages, messagesEndRef]);

  const inputBar = useMemo(() => (
    <div
      className="border-t p-3"
      style={{ borderColor: "oklch(0.72 0.18 200 / 0.25)", background: "oklch(0.05 0.01 220 / 0.75)", backdropFilter: "blur(8px)", boxShadow: "0 -1px 0 oklch(0.72 0.18 200 / 0.1) inset" }}
    >
      {/* Image preview thumbnail */}
      {imagePreviewUrl && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <img src={imagePreviewUrl} alt="Attached" className="w-12 h-12 object-cover rounded-sm" style={{ border: "1px solid rgba(0,200,255,0.4)" }} />
          <span className="text-xs font-mono" style={{ color: "rgba(0,200,255,0.6)" }}>{imageFile?.name}</span>
          <button type="button" onClick={clearImage} className="ml-auto text-xs font-mono" style={{ color: "rgba(255,80,80,0.6)" }}>✕</button>
        </div>
      )}
      <form onSubmit={handleTextSubmitWithImage} className="flex gap-2 items-center flex-wrap">
        <button
          type="button"
          onClick={toggleWakeWord}
          disabled={!isListeningSupported}
          className="flex-shrink-0 w-9 h-9 rounded-sm flex items-center justify-center transition-all duration-200 disabled:opacity-30"
          style={{
            background: wakeWordEnabled ? "oklch(0.72 0.18 200 / 0.15)" : "oklch(0.09 0.015 220)",
            border: wakeWordEnabled ? "1px solid #00ccee88" : "1px solid oklch(0.22 0.05 210 / 0.4)",
            color: wakeWordEnabled ? "#00ccee" : "#00ccee44",
            boxShadow: wakeWordEnabled ? "0 0 8px #00ccee33" : "none",
          }}
          title={wakeWordEnabled ? 'Disable "Hey SENTINEL" wake-word' : 'Enable "Hey SENTINEL" wake-word'}
        >
          <Radio size={14} />
        </button>

        <button
          type="button"
          onClick={handleMicClick}
          disabled={state === "thinking"}
          className="relative flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-40"
          style={{
            background:
              state === "listening" ? "oklch(0.72 0.18 200 / 0.2)"
              : state === "speaking" ? "oklch(0.55 0.22 250 / 0.2)"
              : "oklch(0.13 0.02 220)",
            border:
              state === "listening" ? "2px solid #00ffff"
              : state === "speaking" ? "2px solid #4488ff"
              : "2px solid oklch(0.35 0.1 200 / 0.5)",
            animation: state === "listening" ? "mic-pulse 1.2s ease-in-out infinite" : "none",
          }}
          title={state === "idle" ? "Start listening (Space)" : state === "listening" ? "Stop listening" : state === "speaking" ? "Stop speaking" : "Processing..."}
        >
          {state === "speaking" ? <MicOff size={18} style={{ color: "#4488ff" }} />
           : state === "listening" ? <MicOff size={18} style={{ color: "#00ffff" }} />
           : <Mic size={18} style={{ color: isListeningSupported ? "#00ccee" : "#666" }} />}
        </button>

        {/* Image upload button */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="flex-shrink-0 w-9 h-9 rounded-sm flex items-center justify-center transition-all duration-200"
          style={{
            background: imageFile ? "oklch(0.72 0.18 200 / 0.15)" : "oklch(0.09 0.015 220)",
            border: imageFile ? "1px solid #00ccee88" : "1px solid oklch(0.22 0.05 210 / 0.4)",
            color: imageFile ? "#00ccee" : "#00ccee44",
          }}
          title="Attach image for analysis"
        >
          <ImagePlus size={14} />
        </button>

        <div className="flex-1 min-w-0 relative" style={{ minWidth: "120px" }}>
          <input
            ref={inputRef}
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={
              state === "listening" ? "Listening..." :
              state === "thinking" ? "Processing..." :
              state === "speaking" ? "SENTINEL is speaking..." :
              wakeWordEnabled ? 'Say "Hey SENTINEL" or type here...' :
              "Type a command or question..."
            }
            disabled={state === "thinking" || state === "listening"}
            className="w-full px-4 py-3 text-sm rounded-sm outline-none transition-all duration-200"
            style={{
              background: "oklch(0.09 0.015 220)",
              border: "1px solid oklch(0.35 0.1 200 / 0.4)",
              color: "#b0e8f0",
              caretColor: "#00ccee",
              fontFamily: "'Exo 2', sans-serif",
            }}
            onFocus={(e) => { e.target.style.borderColor = "oklch(0.72 0.18 200 / 0.7)"; e.target.style.boxShadow = "0 0 8px oklch(0.72 0.18 200 / 0.2)"; }}
            onBlur={(e) => { e.target.style.borderColor = "oklch(0.35 0.1 200 / 0.4)"; e.target.style.boxShadow = "none"; }}
          />
        </div>

        <div className="relative">
          <VoiceSettingsPanel
            voiceSettings={voiceSettings}
            elevenLabsVoices={elevenLabsVoices}
            onUpdate={updateVoiceSettings}
            homeZipCode={userPreferences?.homeZipCode}
            onSaveZip={(zip) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (trpc as any).sentinel.savePreferences.mutate({ homeZipCode: zip });
            }}
          />
        </div>

        <button
          type="submit"
          disabled={!textInput.trim() || state === "thinking" || state === "listening"}
          className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-sm flex items-center justify-center transition-all duration-160 disabled:opacity-30"
          style={{ background: "oklch(0.72 0.18 200 / 0.15)", border: "1px solid oklch(0.72 0.18 200 / 0.5)", color: "#00ccee" }}
          onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)"; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
          title="Send message"
        >
          <Send size={16} />
        </button>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            className="flex-shrink-0 w-9 h-9 rounded-sm flex items-center justify-center transition-all duration-160 opacity-50 hover:opacity-100"
            style={{ background: "transparent", border: "1px solid oklch(0.35 0.1 200 / 0.3)", color: "#00ccee88" }}
            title="Clear conversation"
          >
            <Trash2 size={14} />
          </button>
        )}
      </form>

      <div className="flex items-center justify-between mt-2 px-1 gap-2 overflow-hidden">
        <div className="text-xs font-mono tracking-wider truncate min-w-0" style={{ color: "#00ccee44" }}>
          {state === "listening" && <span style={{ color: "#00ffff88" }}>● LISTENING</span>}
          {state === "thinking" && <span style={{ color: "#4488ff88" }}>◈ PROCESSING...</span>}
          {state === "speaking" && <span style={{ color: "#00ccee88" }}>◉ SPEAKING — TAP MIC TO STOP</span>}
          {state === "idle" && wakeWordEnabled && isWakeWordListening && <span style={{ color: "#00ccee66" }}>◎ SAY "HEY SENTINEL"</span>}
          {state === "idle" && !wakeWordEnabled && messages.length > 0 && <span>READY</span>}
        </div>
        <div className="flex-shrink-0 flex items-center gap-1 text-xs font-mono" style={{ color: "#00ccee33" }}>
          <Volume2 size={10} />
          <span className="hidden sm:inline">{voiceName ? voiceName.split(" ").slice(0, 2).join(" ") : "DEFAULT VOICE"}</span>
        </div>
      </div>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [state, textInput, wakeWordEnabled, isWakeWordListening, voiceName, messages.length, handleTextSubmitWithImage, handleMicClick, toggleWakeWord, clearHistory, isListeningSupported, voiceSettings, elevenLabsVoices, updateVoiceSettings, imageFile, imagePreviewUrl]);

  const leftSidePanel = useMemo(() => (
    <aside
      className="flex flex-col gap-4 p-4 border-r overflow-y-auto"
      style={{ borderColor: "oklch(0.72 0.18 200 / 0.2)", width: "14rem", flexShrink: 0, background: "oklch(0.05 0.01 220 / 0.6)", backdropFilter: "blur(10px)" }}
    >
      <HudInfoPanel title="SYSTEM STATUS">
        <HudInfoRow label="AI CORE" value="ONLINE" valueColor="#00ff88" />
        <HudInfoRow label="VOICE I/O" value={isListeningSupported ? "ACTIVE" : "LIMITED"} valueColor={isListeningSupported ? "#00ccee" : "#ffaa00"} />
        <HudInfoRow label="TTS ENGINE" value={isTtsSupported ? "ACTIVE" : "UNAVAIL"} valueColor={isTtsSupported ? "#00ccee" : "#ffaa00"} />
        <HudInfoRow label="NEURAL NET" value="GPT-5" valueColor="#4488ff" />
        <HudInfoRow label="WAKE-WORD" value={wakeWordEnabled ? (isWakeWordListening ? "LISTENING" : "STANDBY") : "OFF"} valueColor={wakeWordEnabled ? "#00ff88" : "#00ccee44"} />
      </HudInfoPanel>

      <HudInfoPanel title="SESSION">
        <HudInfoRow label="EXCHANGES" value={String(messages.filter(m => m.role === "user").length)} valueColor="#00ccee" />
        <HudInfoRow label="PROTOCOL" value="EN-US" valueColor="#00ccee" />
        {lastToolsUsed.length > 0 && <HudInfoRow label="LAST TOOL" value={lastToolsUsed[0]?.toUpperCase() ?? ""} valueColor="#4488ff" />}
      </HudInfoPanel>

      <HudInfoPanel title="TOOLS">
        <div className="space-y-1 text-xs font-mono" style={{ color: "#00ccee66" }}>
          {[
            { name: "WEATHER", color: "#4488ff" },
            { name: "WEB SEARCH", color: "#00ccee" },
            { name: "TIME & DATE", color: "#ffcc44" },
            { name: "CALENDAR", color: calendarConnected ? "#00ff88" : "#666" },
            { name: "GMAIL", color: calendarConnected ? "#cc88ff" : "#666", badge: calendarConnected && gmailUnreadCount > 0 ? gmailUnreadCount : null },
            { name: "SPOTIFY", color: spotifyConnected ? "#1db954" : "#666" },
            { name: "REMINDERS", color: "#ff9933" },
          ].map((tool) => (
            <div key={tool.name} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: tool.color, boxShadow: `0 0 4px ${tool.color}` }} />
              <span style={{ color: tool.color + "cc" }}>{tool.name}</span>
              {"badge" in tool && tool.badge != null && (
                <span
                  className="ml-auto text-xs font-mono font-bold px-1 rounded-sm"
                  style={{
                    background: "#cc88ff22",
                    border: "1px solid #cc88ff55",
                    color: "#cc88ff",
                    fontSize: "8px",
                    lineHeight: "14px",
                    minWidth: "14px",
                    textAlign: "center",
                  }}
                >
                  {tool.badge > 99 ? "99+" : tool.badge}
                </span>
              )}
            </div>
          ))}
        </div>
        <a
          href="/api/calendar/connect"
          className="mt-2 flex items-center gap-1.5 text-xs font-mono px-2 py-1.5 rounded-sm transition-all duration-200 hover:opacity-100"
          style={{
            background: calendarConnected ? "oklch(0.55 0.22 150 / 0.15)" : "oklch(0.09 0.015 220)",
            border: calendarConnected ? "1px solid #00ff8844" : "1px solid oklch(0.22 0.05 210 / 0.4)",
            color: calendarConnected ? "#00ff88" : "#00ccee66",
            opacity: 0.8,
          }}
        >
          <CalendarDays size={10} />
          {calendarConnected ? "CALENDAR LINKED" : "CONNECT CALENDAR"}
        </a>
        <a
          href="/api/spotify/connect"
          className="mt-1 flex items-center gap-1.5 text-xs font-mono px-2 py-1.5 rounded-sm transition-all duration-200 hover:opacity-100"
          style={{
            background: spotifyConnected ? "oklch(0.55 0.22 145 / 0.15)" : "oklch(0.09 0.015 220)",
            border: spotifyConnected ? "1px solid #1db95444" : "1px solid oklch(0.22 0.05 210 / 0.4)",
            color: spotifyConnected ? "#1db954" : "#00ccee66",
            opacity: 0.8,
          }}
        >
          <Music size={10} />
          {spotifyConnected ? "SPOTIFY LINKED" : "CONNECT SPOTIFY"}
        </a>
        {spotifyConnected && (
          <div className="mt-2">
            <NowPlayingWidget
              track={nowPlaying?.track ?? null}
              playing={nowPlaying?.playing ?? false}
            />
          </div>
        )}
      </HudInfoPanel>

      <HudInfoPanel title="CONTROLS">
        <div className="text-xs font-mono space-y-1" style={{ color: "#00ccee66" }}>
          <div>SPACE — Toggle mic</div>
          <div>ENTER — Send text</div>
          <div>RADIO — Wake-word</div>
        </div>
      </HudInfoPanel>

      <HudThemePanel
        theme={theme}
        intensity={intensity}
        onThemeChange={setTheme}
        onIntensityChange={setIntensity}
      />

      {/* Reminder panel */}
      <ReminderPanel />

      {/* Blueprint schematic diagrams */}
      <div className="flex flex-col gap-3 mt-auto">
        <BlueprintSchematic type="radar" width={176} height={110} state={state} label="PROXIMITY SCAN" sublabel="ACTIVE" color={hudConfig.primaryHex} />
        <BlueprintSchematic type="barchart" width={176} height={70} state={state} label="NEURAL LOAD" sublabel="%" color={hudConfig.primaryHex} />
      </div>
    </aside>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [messages, lastToolsUsed, calendarConnected, spotifyConnected, nowPlaying, wakeWordEnabled, isWakeWordListening, isListeningSupported, isTtsSupported, gmailUnreadCount, state]);

  const rightSidePanel = useMemo(() => (
    <aside
      className="flex flex-col gap-4 p-4 border-l overflow-y-auto"
      style={{ borderColor: "oklch(0.72 0.18 200 / 0.2)", width: "13rem", flexShrink: 0, background: "oklch(0.05 0.01 220 / 0.6)", backdropFilter: "blur(10px)" }}
    >
      <HudInfoPanel title="DIAGNOSTICS">
        <HudInfoRow label="UPTIME" value={<LiveUptime />} valueColor="#00ccee" />
        <HudInfoRow label="LATENCY" value="< 2s" valueColor="#00ff88" />
        <HudInfoRow label="CONTEXT" value={`${messages.length} MSG`} valueColor="#00ccee" />
      </HudInfoPanel>

      <HudInfoPanel title="INTEGRATIONS">
        <HudInfoRow label="CALENDAR" value={calendarConnected ? "LINKED" : "OFF"} valueColor={calendarConnected ? "#00ff88" : "#666"} />
        <HudInfoRow label="GMAIL" value={calendarConnected ? "LINKED" : "OFF"} valueColor={calendarConnected ? "#cc88ff" : "#666"} />
        <HudInfoRow label="SPOTIFY" value={spotifyConnected ? "LINKED" : "OFF"} valueColor={spotifyConnected ? "#1db954" : "#666"} />
      </HudInfoPanel>

      <HudInfoPanel title="CAPABILITIES">
        <div className="space-y-1 text-xs font-mono" style={{ color: "#00ccee66" }}>
          {["REASONING", "ANALYSIS", "RESEARCH", "CODING", "WRITING", "MATH", "WEATHER", "FORECAST", "WEB SEARCH", "NEWS", "STOCKS", "CALENDAR", "GMAIL", "SPOTIFY", "REMINDERS", "IMAGE ANALYSIS", "MEMORY"].map((cap) => (
            <div key={cap} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#00ccee", boxShadow: "0 0 4px #00ccee" }} />
              {cap}
            </div>
          ))}
        </div>
      </HudInfoPanel>

      {/* Weather forecast panel */}
      {userPreferences?.homeZipCode && (
        <WeatherForecastPanel location={userPreferences.homeZipCode} />
      )}

      {/* Stock ticker panel */}
      <StockTickerPanel />

      {/* Blueprint schematic diagrams */}
      <div className="flex flex-col gap-3">
        <BlueprintSchematic type="rings" width={168} height={120} state={state} label="ARC REACTOR" sublabel="CORE" color={hudConfig.primaryHex} />
        <BlueprintSchematic type="oscilloscope" width={168} height={70} state={state} label="AUDIO WAVEFORM" sublabel="Hz" color={hudConfig.primaryHex} />
        <BlueprintSchematic type="grid" width={168} height={80} state={state} label="SPATIAL MAP" sublabel="3D" color={hudConfig.primaryHex} />
      </div>

      <div className="mt-auto">
        <div className="text-xs font-mono tracking-widest mb-2" style={{ color: "#00ccee44" }}>AUDIO MONITOR</div>
        <WaveformVisualizer active={state === "speaking" || state === "listening"} barCount={14} />
      </div>
    </aside>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [messages, state, calendarConnected, spotifyConnected, userPreferences]);

  const bottomStatusBar = useMemo(() => (
    <div
      className="flex flex-wrap gap-4 px-4 py-3 border-t text-xs font-mono"
      style={{ borderColor: "oklch(0.72 0.18 200 / 0.2)", background: "oklch(0.05 0.01 220 / 0.75)", backdropFilter: "blur(8px)", color: "#00ccee55" }}
    >
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#00ff88", boxShadow: "0 0 4px #00ff88" }} />
        <span>AI CORE: ONLINE</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#00ccee", boxShadow: "0 0 4px #00ccee" }} />
        <span>VOICE I/O: {isListeningSupported ? "ACTIVE" : "LIMITED"}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#4488ff", boxShadow: "0 0 4px #4488ff" }} />
        <span>NEURAL NET: GPT-5</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: calendarConnected ? "#00ff88" : "#666" }} />
        <span>CALENDAR: {calendarConnected ? "LINKED" : "DISCONNECTED"}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: spotifyConnected ? "#1db954" : "#666" }} />
        <span>SPOTIFY: {spotifyConnected ? "LINKED" : "DISCONNECTED"}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span>EXCHANGES: {messages.filter(m => m.role === "user").length}</span>
      </div>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [isListeningSupported, calendarConnected, spotifyConnected, messages]);

  // ── Error display ────────────────────────────────────────────────────────
  const errorBanner = combinedError ? (
    <div
      className="mx-4 mb-2 px-4 py-2 text-xs font-mono rounded-sm border animate-fade-in-up"
      style={{
        background: "oklch(0.12 0.05 25 / 0.8)",
        borderColor: "oklch(0.6 0.22 25 / 0.5)",
        color: "oklch(0.8 0.15 25)",
      }}
    >
      ⚠ {combinedError}
    </div>
  ) : null;

  // ── Layout switcher in status bar ────────────────────────────────────────
  const layoutSwitcherEl = useMemo(() => (
    <LayoutSwitcher layout={layout} onCycle={cycleLayout} onSelect={setLayout} />
  ), [layout, cycleLayout, setLayout]);

  // ── RENDER: Standard (3-column landscape) ───────────────────────────────
  if (layout === "standard") {
    return (
      <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: "oklch(0.05 0.01 220)", fontFamily: "'Orbitron', monospace" }} onClick={handleFirstInteraction}>
        <HexGrid state={state} intensity={intensity} color={hudConfig.primaryHex} />
        <HudScanLine />
        <HudCornerBrackets state={state} />
        <HudStatusBar status={statusText} model={voiceName ? `VOICE: ${voiceName.split(" ")[0]}` : undefined} extra={layoutSwitcherEl} />
        <div className="flex flex-1 overflow-hidden relative z-10" style={{ minHeight: 0 }}>
          <div className="hidden lg:flex relative overflow-hidden">
            <HudParticles state={state} side="left" width={40} height={800} intensity={intensity} color={hudConfig.primaryHex} accent={hudConfig.accent} />
            {leftSidePanel}
          </div>
          <main className="flex flex-col flex-1 overflow-hidden relative">
            {/* News ticker at very bottom of main column */}
            {/* Ghost arc reactor watermark — centered, scrolled over by chat */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
              style={{ opacity: (state === "idle" ? 0.13 : state === "thinking" ? 0.22 : state === "speaking" ? 0.2 : 0.18) * intensity, transition: "opacity 0.8s ease" }}
            >
              <ArcReactor state={state} size={580} themeColor={hudConfig.primaryHex} />
            </div>
            {/* Radial glow behind reactor */}
            <div
              className="absolute inset-0 pointer-events-none z-0 transition-all duration-700"
              style={{
                background: state === "listening"
                  ? "radial-gradient(ellipse 55% 55% at 50% 50%, oklch(0.72 0.18 200 / 0.08) 0%, transparent 70%)"
                  : state === "thinking"
                    ? "radial-gradient(ellipse 50% 50% at 50% 50%, oklch(0.55 0.22 250 / 0.07) 0%, transparent 70%)"
                  : state === "speaking"
                    ? "radial-gradient(ellipse 60% 60% at 50% 50%, oklch(0.72 0.18 200 / 0.1) 0%, transparent 70%)"
                    : "radial-gradient(ellipse 45% 45% at 50% 50%, oklch(0.72 0.18 200 / 0.03) 0%, transparent 70%)",
              }}
            />
            {/* Chat + input scroll over the watermark */}
            <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
              {chatPanel}
              {errorBanner}
              {inputBar}
              <NewsTicker />
            </div>
          </main>
          <div className="hidden xl:flex relative overflow-hidden">
            <HudParticles state={state} side="right" width={40} height={800} intensity={intensity} color={hudConfig.primaryHex} accent={hudConfig.accent} />
            {rightSidePanel}
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: Portrait (single column, tall) ───────────────────────────────
  if (layout === "portrait") {
    return (
      <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: "oklch(0.05 0.01 220)", fontFamily: "'Orbitron', monospace" }} onClick={handleFirstInteraction}>
        <HexGrid state={state} intensity={intensity} color={hudConfig.primaryHex} />
        <HudScanLine />
        <HudCornerBrackets state={state} />
        <HudStatusBar status={statusText} model={voiceName ? `VOICE: ${voiceName.split(" ")[0]}` : undefined} extra={layoutSwitcherEl} />

        <div className="flex flex-col flex-1 overflow-hidden relative z-10" style={{ minHeight: 0 }}>
          {/* Ghost arc reactor watermark for portrait */}
          <div className="flex-1 overflow-hidden relative flex flex-col">
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
              style={{ opacity: (state === "idle" ? 0.13 : state === "thinking" ? 0.22 : state === "speaking" ? 0.2 : 0.18) * intensity, transition: "opacity 0.8s ease" }}
            >
              <ArcReactor state={state} size={480} themeColor={hudConfig.primaryHex} />
            </div>
            <div
              className="absolute inset-0 pointer-events-none z-0 transition-all duration-700"
              style={{
                background: state === "listening"
                  ? "radial-gradient(ellipse 55% 55% at 50% 50%, oklch(0.72 0.18 200 / 0.08) 0%, transparent 70%)"
                  : state === "thinking"
                    ? "radial-gradient(ellipse 50% 50% at 50% 50%, oklch(0.55 0.22 250 / 0.07) 0%, transparent 70%)"
                  : state === "speaking"
                    ? "radial-gradient(ellipse 60% 60% at 50% 50%, oklch(0.72 0.18 200 / 0.1) 0%, transparent 70%)"
                    : "radial-gradient(ellipse 45% 45% at 50% 50%, oklch(0.72 0.18 200 / 0.03) 0%, transparent 70%)",
              }}
            />
            <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
              {chatPanel}
              {errorBanner}
              {inputBar}
              <NewsTicker />
            </div>
          </div>

          {/* Compact tools/controls row at bottom */}
          <div
            className="flex items-center justify-between px-4 py-2 border-t text-xs font-mono flex-wrap gap-2"
            style={{ borderColor: "oklch(0.22 0.05 210 / 0.3)", color: "#00ccee44", background: "oklch(0.07 0.012 220 / 0.9)", flexShrink: 0 }}
          >
            <div className="flex gap-3 flex-wrap">
              {[
                { name: "WEATHER", color: "#4488ff" },
                { name: "SEARCH", color: "#00ccee" },
                { name: "TIME", color: "#ffcc44" },
                { name: "CAL", color: calendarConnected ? "#00ff88" : "#555" },
                { name: "SPT", color: spotifyConnected ? "#1db954" : "#555" },
              ].map((t) => (
                <span key={t.name} className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: t.color, boxShadow: `0 0 3px ${t.color}` }} />
                  <span style={{ color: t.color + "99" }}>{t.name}</span>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <a href="/api/calendar/connect" className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity" style={{ color: calendarConnected ? "#00ff88" : "#00ccee55" }}>
                <CalendarDays size={10} />
                {calendarConnected ? "CAL" : "CAL+"}
              </a>
              <a href="/api/spotify/connect" className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity" style={{ color: spotifyConnected ? "#1db954" : "#00ccee55" }}>
                <Music size={10} />
                {spotifyConnected ? "SPT" : "SPT+"}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: Compact (mobile-first, chat dominant) ────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: "oklch(0.05 0.01 220)", fontFamily: "'Orbitron', monospace" }} onClick={handleFirstInteraction}>
      <HexGrid state={state} intensity={intensity} color={hudConfig.primaryHex} />
      <HudScanLine />
      {/* Minimal top bar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b relative z-20 flex-shrink-0"
        style={{ borderColor: "oklch(0.22 0.05 210 / 0.4)", background: "oklch(0.07 0.012 220 / 0.95)" }}
      >
        <div className="flex items-center gap-3">
          <ArcReactor state={state} size={36} themeColor={hudConfig.primaryHex} />
          <div>
            <div className="text-xs font-mono tracking-widest" style={{ color: "#00ccee" }}>SENTINEL</div>
            <div className="text-xs font-mono" style={{ color: "#00ccee55", fontSize: "0.6rem" }}>{statusText}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Integration status dots */}
          <div className="flex items-center gap-1.5 mr-1">
            <div
              className="w-2 h-2 rounded-full"
              title={calendarConnected ? "Calendar connected" : "Calendar not connected"}
              style={{ background: calendarConnected ? "#00ff88" : "#333", boxShadow: calendarConnected ? "0 0 4px #00ff88" : "none" }}
            />
            <div
              className="w-2 h-2 rounded-full"
              title={spotifyConnected ? "Spotify connected" : "Spotify not connected"}
              style={{ background: spotifyConnected ? "#1db954" : "#333", boxShadow: spotifyConnected ? "0 0 4px #1db954" : "none" }}
            />
          </div>
          {state === "thinking" && (
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "#4488ff", animation: `thinking-dots 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          )}
          {layoutSwitcherEl}
        </div>
      </div>

      {/* Chat fills all available space */}
      <div className="flex flex-col flex-1 overflow-hidden relative z-10">
        {chatPanel}
        {errorBanner}
        {inputBar}
        <NewsTicker />
      </div>
    </div>
  );
}

// ── Helper components ────────────────────────────────────────────────────────

function HudInfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-sm p-3 relative"
      style={{
        background: "oklch(0.09 0.015 220 / 0.8)",
        border: "1px solid oklch(0.22 0.05 210 / 0.4)",
      }}
    >
      <div
        className="text-xs font-mono tracking-widest mb-2 pb-1 border-b"
        style={{ color: "#00ccee88", borderColor: "oklch(0.22 0.05 210 / 0.3)" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function HudInfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs font-mono py-0.5">
      <span style={{ color: "#00ccee55" }}>{label}</span>
      <span style={{ color: valueColor ?? "#00ccee" }}>{value}</span>
    </div>
  );
}

function LiveUptime() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return <span>{h}:{m}:{s}</span>;
}
