import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import type { Message } from "@/components/MessageBubble";
import { trpc } from "@/lib/trpc";
import { useWhisperRecorder } from "./useWhisperRecorder";

export type SentinelState = "idle" | "listening" | "thinking" | "speaking";

function getOrCreateSessionId(): string {
  const key = "sentinel_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = nanoid(16);
    localStorage.setItem(key, id);
  }
  return id;
}

export interface VoiceSettings {
  voiceKey: string;
  rate: number;
  pitch: number;
  reverbIntensity: number; // 0.0 = dry, 1.0 = full reverb
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceKey: "daniel",
  rate: 1.0,
  pitch: 0.85,
  reverbIntensity: 0.55,
};

function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem("sentinel_voice_settings");
    if (raw) return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(raw) as Partial<VoiceSettings> };
  } catch { /* ignore */ }
  return { ...DEFAULT_VOICE_SETTINGS };
}

function saveVoiceSettings(s: VoiceSettings): void {
  localStorage.setItem("sentinel_voice_settings", JSON.stringify(s));
}

function selectBritishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const priorities = [
    (v: SpeechSynthesisVoice) => v.lang === "en-GB" && v.name.toLowerCase().includes("daniel"),
    (v: SpeechSynthesisVoice) => v.lang === "en-GB" && !v.name.toLowerCase().includes("female"),
    (v: SpeechSynthesisVoice) => v.lang === "en-GB",
    (v: SpeechSynthesisVoice) => v.lang.startsWith("en"),
  ];
  for (const pred of priorities) {
    const match = voices.find(pred);
    if (match) return match;
  }
  return voices[0] ?? null;
}

export function useSentinel() {
  const [state, setState] = useState<SentinelState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState<string>("Daniel (ElevenLabs)");
  const [isListeningSupported, setIsListeningSupported] = useState(true);
  const [isTtsSupported] = useState(true);
  const [useWhisperMode, setUseWhisperMode] = useState(false); // true when Web Speech API unavailable
  const [lastToolsUsed, setLastToolsUsed] = useState<string[]>([]);
  const [voiceSettings, setVoiceSettingsState] = useState<VoiceSettings>(loadVoiceSettings);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<Array<{ key: string; id: string; label: string }>>([
    { key: "daniel", id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel (British, Default)" },
    { key: "george", id: "JBFqnCBsd6RMkjVDRZzb", label: "George (British, Warm)" },
    { key: "charlie", id: "IKne3meq5aSn9XLyUdCD", label: "Charlie (British, Crisp)" },
    { key: "brian", id: "nPczCjzI2devNBz1zQrb", label: "Brian (British, Formal)" },
    { key: "clyde", id: "2EiwWnXFnvU5JabPnv8n", label: "Clyde (British, Sophisticated)" },
    { key: "adam", id: "pNInz6obpgDQGcFmaJgB", label: "Adam (American, Professional)" },
    { key: "arnold", id: "EXAVITQu4vr4xnSDxMaL", label: "Arnold (American, Deep)" },
  ]);

  const sessionId = useRef(getOrCreateSessionId());
  const userCoordsRef = useRef<{ lat: number; lon: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const stateRef = useRef<SentinelState>("idle");
  const voiceSettingsRef = useRef(voiceSettings);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chatMutation = (trpc as any).sentinel.chat.useMutation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveMessageMutation = (trpc as any).sentinel.saveMessage.useMutation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clearHistoryMutation = (trpc as any).sentinel.clearHistory.useMutation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const historyQuery = (trpc as any).sentinel.getHistory.useQuery(
    { sessionId: sessionId.current },
    { enabled: true, refetchOnWindowFocus: false }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calendarStatusQuery = (trpc as any).sentinel.calendarStatus.useQuery(
    undefined,
    { refetchInterval: 5000 }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spotifyStatusQuery = (trpc as any).sentinel.spotifyStatus.useQuery(
    undefined,
    { refetchInterval: 5000 }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nowPlayingQuery = (trpc as any).sentinel.spotifyNowPlaying.useQuery(
    undefined,
    { refetchInterval: 10_000, enabled: spotifyConnected }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const preferencesQuery = (trpc as any).sentinel.getPreferences.useQuery(
    undefined,
    { refetchOnWindowFocus: false, staleTime: 60_000 }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const savePreferencesMutation = (trpc as any).sentinel.savePreferences.useMutation();

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { voiceSettingsRef.current = voiceSettings; }, [voiceSettings]);

  useEffect(() => {
    if (calendarStatusQuery.data) {
      setCalendarConnected((calendarStatusQuery.data as { connected: boolean }).connected);
    }
  }, [calendarStatusQuery.data]);

  useEffect(() => {
    if (spotifyStatusQuery.data) {
      setSpotifyConnected((spotifyStatusQuery.data as { connected: boolean }).connected);
    }
  }, [spotifyStatusQuery.data]);

  // Apply persistent preferences to voice settings on first load
  const prefsApplied = useRef(false);
  useEffect(() => {
    if (prefsApplied.current || !preferencesQuery.data) return;
    const prefs = preferencesQuery.data as {
      homeZipCode: string | null;
      preferredVoiceKey: string | null;
      preferredLayout: string | null;
      speechRate: number | null;
      reverbIntensity: number | null;
    };
    prefsApplied.current = true;
    const updates: Partial<VoiceSettings> = {};
    if (prefs.preferredVoiceKey) updates.voiceKey = prefs.preferredVoiceKey;
    if (prefs.speechRate != null) updates.rate = prefs.speechRate;
    if (prefs.reverbIntensity != null) updates.reverbIntensity = prefs.reverbIntensity;
    if (Object.keys(updates).length > 0) {
      setVoiceSettingsState(prev => ({ ...prev, ...updates }));
    }
  }, [preferencesQuery.data]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar") === "connected") {
      setCalendarConnected(true);
      calendarStatusQuery.refetch();
    }
    if (params.get("spotify_connected") === "true") {
      setSpotifyConnected(true);
      spotifyStatusQuery.refetch();
    }
    if (params.get("calendar") === "connected" || params.get("spotify_connected") === "true") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Silently capture browser geolocation once on mount
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userCoordsRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          console.log("[SENTINEL] Geolocation captured:", userCoordsRef.current);
        },
        () => { /* permission denied or unavailable — ignore */ },
        { timeout: 8000, maximumAge: 300_000 }
      );
    }
  }, []);

  useEffect(() => {
    fetch("/api/tts/voices")
      .then((r) => r.json())
      .then((data: { voices: Array<{ key: string; id: string; label: string }> }) => {
        if (data.voices?.length) setElevenLabsVoices(data.voices);
      })
      .catch(() => {});
  }, []);

  // Load persistent history
  useEffect(() => {
    if (historyLoaded || !historyQuery.data) return;
    const rows = historyQuery.data as Array<{ role: string; content: string; toolsUsed?: string[]; createdAt: Date }>;
    if (rows.length === 0) { setHistoryLoaded(true); return; }
    const loaded: Message[] = rows.map((r) => ({
      id: nanoid(),
      role: r.role === "assistant" ? "sentinel" : "user",
      content: r.content,
      timestamp: new Date(r.createdAt),
      toolsUsed: r.toolsUsed ?? [],
    })) as Message[];
    setMessages(loaded);
    setHistoryLoaded(true);

    if (loaded.length >= 2) {
      const lastUserMsg = [...loaded].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        const recapMsg: Message = {
          id: nanoid(),
          role: "sentinel",
          content: `Welcome back, sir. Resuming from our previous session — your last query was: "${lastUserMsg.content.slice(0, 80)}${lastUserMsg.content.length > 80 ? "..." : ""}". I have restored ${loaded.length} exchanges. How may I assist you today?`,
          timestamp: new Date(),
          toolsUsed: [],
        };
        setMessages((prev) => [...prev, recapMsg]);
      }
    }
  }, [historyQuery.data, historyLoaded]);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    const hasSpeechAPI = !!(w["SpeechRecognition"] || w["webkitSpeechRecognition"]);
    if (!hasSpeechAPI) {
      // No Web Speech API — use Whisper mode (MediaRecorder + server)
      setUseWhisperMode(true);
      console.log("[SENTINEL STT] Web Speech API not available, using Whisper mode");
    } else {
      console.log("[SENTINEL STT] Web Speech API available");
    }
  }, []);

  // Get or create AudioContext — always resume if suspended
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContext();
    }
    // Always attempt to resume — browsers require user gesture before audio plays
    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Build a metallic electronic reverb impulse response buffer
  const buildReverbIR = useCallback((audioContext: AudioContext, durationSec: number, decay: number): AudioBuffer => {
    const sampleRate = audioContext.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const ir = audioContext.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        // Exponential decay with metallic shimmer (slight comb filtering)
        const t = i / sampleRate;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / durationSec, decay);
        // Add metallic resonance at ~3kHz
        data[i] += Math.sin(2 * Math.PI * 3000 * t) * 0.04 * Math.exp(-t * 12);
      }
    }
    return ir;
  }, []);

  // Build the Web Audio processing chain and return the input node
  const buildAudioChain = useCallback((audioContext: AudioContext): { input: AudioNode; output: AudioNode } => {
    const settings = voiceSettingsRef.current;

    const hpFilter = audioContext.createBiquadFilter();
    hpFilter.type = "highpass";
    hpFilter.frequency.value = 180;
    hpFilter.Q.value = 0.8;

    const presenceEQ = audioContext.createBiquadFilter();
    presenceEQ.type = "peaking";
    presenceEQ.frequency.value = 3000;
    presenceEQ.gain.value = 4;
    presenceEQ.Q.value = 1.2;

    const waveshaper = audioContext.createWaveShaper();
    const curve = new Float32Array(256);
    const driveAmount = 8 + settings.reverbIntensity * 12;
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = ((Math.PI + driveAmount) * x) / (Math.PI + driveAmount * Math.abs(x));
    }
    waveshaper.curve = curve;
    waveshaper.oversample = "4x";

    const convolver = audioContext.createConvolver();
    convolver.buffer = buildReverbIR(audioContext, 0.6, 4.5);

    const dryGain = audioContext.createGain();
    const wetGain = audioContext.createGain();
    const reverbIntensity = Math.max(0, Math.min(1, settings.reverbIntensity));
    dryGain.gain.value = 1.0;
    wetGain.gain.value = reverbIntensity * 0.65;

    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 6;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;

    hpFilter.connect(presenceEQ);
    presenceEQ.connect(waveshaper);
    waveshaper.connect(dryGain);
    waveshaper.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(compressor);
    wetGain.connect(compressor);
    compressor.connect(audioContext.destination);

    return { input: hpFilter, output: compressor };
  }, [buildReverbIR]);

  // ElevenLabs TTS via server proxy — streams audio for minimal startup delay
  const speakWithElevenLabs = useCallback(async (text: string, onEnd?: () => void): Promise<boolean> => {
    const settings = voiceSettingsRef.current;
    try {
      // Force AudioContext to resume — critical when Spotify or other audio is active
      const audioContext = getAudioContext();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      // If still suspended after resume attempt, create a fresh context
      if (audioContext.state !== "running") {
        audioContextRef.current = new AudioContext();
        await audioContextRef.current.resume();
      }
      const ctx = audioContextRef.current!;

      console.log("[SENTINEL TTS] Calling /api/tts, AudioContext state:", ctx.state);
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 5000), voiceId: settings.voiceKey }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn("[SENTINEL TTS] Server returned", response.status, errText);
        return false;
      }

      // Download the full buffer but start playing as soon as decoding is done
      // (ElevenLabs returns mp3 which must be fully decoded before playback)
      const arrayBuffer = await response.arrayBuffer();
      console.log("[SENTINEL TTS] Received audio buffer, size:", arrayBuffer.byteLength);

      if (arrayBuffer.byteLength < 100) {
        console.warn("[SENTINEL TTS] Audio buffer too small, likely empty");
        return false;
      }

      // Re-check AudioContext state after the network round-trip
      if (ctx.state === "suspended") await ctx.resume();

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      console.log("[SENTINEL TTS] Decoded audio duration:", audioBuffer.duration.toFixed(2), "s");

      // Stop any currently playing audio
      try { currentSourceRef.current?.stop(); } catch { /* ignore */ }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = Math.max(0.5, Math.min(2.0, settings.rate));

      const { input } = buildAudioChain(ctx);
      source.connect(input);

      source.onended = () => {
        console.log("[SENTINEL TTS] Audio playback ended");
        if (stateRef.current === "speaking") setState("idle");
        onEnd?.();
      };

      currentSourceRef.current = source;
      // Set state to speaking BEFORE starting audio so bubble and audio are in sync
      setState("speaking");
      source.start(0);
      console.log("[SENTINEL TTS] Audio started playing");
      return true;
    } catch (err) {
      console.error("[SENTINEL TTS] ElevenLabs playback error:", err);
      return false;
    }
  }, [getAudioContext, buildAudioChain]);

  // Browser TTS fallback
  const speakWithBrowser = useCallback((text: string, onEnd?: () => void) => {
    console.log("[SENTINEL TTS] Using browser TTS fallback");
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setState("idle");
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = selectBritishVoice();
    if (voice) {
      utterance.voice = voice;
      console.log("[SENTINEL TTS] Browser voice:", voice.name);
    }
    utterance.rate = voiceSettingsRef.current.rate;
    utterance.pitch = voiceSettingsRef.current.pitch;
    utterance.volume = 1;
    utterance.onend = () => { setState("idle"); onEnd?.(); };
    utterance.onerror = (e) => {
      console.error("[SENTINEL TTS] Browser TTS error:", e);
      setState("idle");
      onEnd?.();
    };
    setState("speaking");
    window.speechSynthesis.speak(utterance);
  }, []);

  // Main speak — tries ElevenLabs, falls back to browser
  const speak = useCallback(async (text: string, onEnd?: () => void) => {
    if (!text.trim()) { setState("idle"); onEnd?.(); return; }

    const success = await speakWithElevenLabs(text, onEnd);
    if (!success) {
      console.warn("[SENTINEL TTS] ElevenLabs failed, trying browser TTS");
      setVoiceName("Browser TTS (fallback)");
      speakWithBrowser(text, onEnd);
    } else {
      setVoiceName("Daniel (ElevenLabs)");
    }
  }, [speakWithElevenLabs, speakWithBrowser]);

  const stopSpeaking = useCallback(() => {
    try { currentSourceRef.current?.stop(); } catch { /* ignore */ }
    window.speechSynthesis?.cancel();
    setState("idle");
  }, []);

  const updateVoiceSettings = useCallback((updates: Partial<VoiceSettings>) => {
    setVoiceSettingsState((prev) => {
      const next = { ...prev, ...updates };
      saveVoiceSettings(next);
      // Persist voice settings to DB so they survive across devices/sessions
      const dbUpdates: Record<string, string | number | null> = {};
      if (updates.voiceKey !== undefined) dbUpdates.preferredVoiceKey = updates.voiceKey;
      if (updates.rate !== undefined) dbUpdates.speechRate = updates.rate;
      if (updates.reverbIntensity !== undefined) dbUpdates.reverbIntensity = updates.reverbIntensity;
      if (Object.keys(dbUpdates).length > 0) {
        savePreferencesMutation.mutate(dbUpdates);
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setError(null);

      // Ensure AudioContext is initialized on user gesture (required by browsers)
      getAudioContext();

      const userMsg: Message = {
        id: nanoid(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setState("thinking");

      saveMessageMutation.mutateAsync({
        sessionId: sessionId.current,
        role: "user",
        content: text.trim(),
        toolsUsed: [],
      }).catch(() => {});

      try {
        // Build history from messages BEFORE the current user message was added.
        // Also exclude the recap message (it's a synthetic SENTINEL message, not a real exchange)
        // and deduplicate consecutive same-role messages to avoid API 400 errors.
        const historyRaw = messages
          .filter((m) => !m.content.startsWith("Welcome back, sir. Resuming from our previous session"))
          .slice(-10)
          .map((m) => ({
            role: m.role === "sentinel" ? ("assistant" as const) : ("user" as const),
            content: m.content,
          }));

        // Remove consecutive duplicate roles (e.g. assistant,assistant → keep last)
        const history = historyRaw.filter((m, i) => {
          if (i === 0) return true;
          // If same role as previous, skip the previous one (keep current)
          return true; // keep all, but collapse below
        }).reduce<Array<{ role: "user" | "assistant"; content: string }>>((acc, m) => {
          const last = acc[acc.length - 1];
          if (last && last.role === m.role) {
            // Merge: replace last with current (keep most recent of consecutive same-role)
            acc[acc.length - 1] = m;
          } else {
            acc.push(m);
          }
          return acc;
        }, []);

        const result = await chatMutation.mutateAsync({
          message: text.trim(),
          history,
          ...(userCoordsRef.current ? { userLat: userCoordsRef.current.lat, userLon: userCoordsRef.current.lon } : {}),
        }) as { reply: string; toolsUsed: string[] };

        setLastToolsUsed(result.toolsUsed ?? []);

        // Auto-detect zip code in user message and persist to preferences
        const zipMatch = text.match(/\b(\d{5})\b/);
        if (zipMatch && /zip|postal|location|home|live|here|weather/i.test(text)) {
          savePreferencesMutation.mutate({ homeZipCode: zipMatch[1] });
        }

        const sentinelMsg: Message = {
          id: nanoid(),
          role: "sentinel",
          content: result.reply,
          timestamp: new Date(),
          toolsUsed: result.toolsUsed,
        };

        // Kick off TTS fetch immediately — in parallel with React state update
        // so audio starts as soon as the bubble renders, not after a second round-trip
        const ttsPromise = speak(result.reply);

        setMessages((prev) => [...prev, sentinelMsg]);

        saveMessageMutation.mutateAsync({
          sessionId: sessionId.current,
          role: "assistant",
          content: result.reply,
          toolsUsed: result.toolsUsed ?? [],
        }).catch(() => {});

        // Await TTS completion
        await ttsPromise;
      } catch (err) {
        const rawMsg = err instanceof Error ? err.message : "Unknown error";
        // Translate raw API/LLM errors into friendly SENTINEL-style messages
        let friendlyMsg = rawMsg;
        if (rawMsg.includes("412") || rawMsg.toLowerCase().includes("usage exhausted") || rawMsg.toLowerCase().includes("precondition failed")) {
          friendlyMsg = "My cognitive systems are temporarily at capacity, sir. The AI usage quota has been reached. Please try again shortly.";
        } else if (rawMsg.includes("401") || rawMsg.toLowerCase().includes("unauthorized")) {
          friendlyMsg = "Authentication failure detected. Please verify your credentials and try again.";
        } else if (rawMsg.includes("429") || rawMsg.toLowerCase().includes("rate limit")) {
          friendlyMsg = "I'm receiving too many requests at once. Give me a moment to recover, sir.";
        } else if (rawMsg.includes("500") || rawMsg.toLowerCase().includes("internal server")) {
          friendlyMsg = "A server-side anomaly has occurred. I'll attempt to recover — please try again.";
        } else if (rawMsg.toLowerCase().includes("network") || rawMsg.toLowerCase().includes("fetch")) {
          friendlyMsg = "I've lost contact with the Sentinel servers. Please check your connection.";
        }
        setError(friendlyMsg);
        setState("idle");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, chatMutation, saveMessageMutation, speak, getAudioContext]
  );

  // Whisper recorder hook — used when Web Speech API is unavailable
  const whisperRecorder = useWhisperRecorder({
    onTranscript: (text) => {
      console.log("[SENTINEL STT] Whisper transcript:", text);
      sendMessage(text);
    },
    onError: (msg) => {
      setError(msg);
      setState("idle");
    },
    maxDurationMs: 30_000,
  });

  // Keep state in sync with whisper recorder
  useEffect(() => {
    if (whisperRecorder.isRecording) setState("listening");
    else if (whisperRecorder.isTranscribing) setState("thinking");
  }, [whisperRecorder.isRecording, whisperRecorder.isTranscribing]);

  const startListening = useCallback(() => {
    if (stateRef.current !== "idle") return;

    // Initialize AudioContext on user gesture
    getAudioContext();
    try { currentSourceRef.current?.stop(); } catch { /* ignore */ }
    window.speechSynthesis?.cancel();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type SRConstructor = new () => any;
    const w = window as unknown as Record<string, unknown>;
    const SpeechRecognitionCtor = (w["SpeechRecognition"] || w["webkitSpeechRecognition"]) as SRConstructor | undefined;

    // If no Web Speech API, or we've already switched to Whisper mode, use Whisper
    if (!SpeechRecognitionCtor || useWhisperMode) {
      console.log("[SENTINEL STT] Starting Whisper recording");
      whisperRecorder.startRecording();
      return;
    }

    // Try Web Speech API
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US"; // en-US has broader device support than en-GB
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      console.log("[SENTINEL STT] Web Speech API started");
      setState("listening");
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = (event.results[0]?.[0]?.transcript ?? "") as string;
      console.log("[SENTINEL STT] Web Speech result:", transcript);
      if (transcript.trim()) sendMessage(transcript);
      else setState("idle");
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.warn("[SENTINEL STT] Web Speech error:", event.error);
      if (event.error === "not-allowed") {
        setError("Microphone access denied. Please allow microphone access and try again.");
        setState("idle");
      } else if (event.error === "network" || event.error === "service-not-allowed" || event.error === "language-not-supported") {
        // Permanently switch to Whisper mode for this session
        console.warn("[SENTINEL STT] Switching to Whisper mode due to:", event.error);
        setUseWhisperMode(true);
        setState("idle");
        // Immediately retry with Whisper
        setTimeout(() => whisperRecorder.startRecording(), 100);
      } else {
        setState("idle");
      }
    };

    recognition.onend = () => {
      if (stateRef.current === "listening") setState("idle");
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.warn("[SENTINEL STT] Web Speech start failed, switching to Whisper:", err);
      setUseWhisperMode(true);
      whisperRecorder.startRecording();
    }
  }, [sendMessage, getAudioContext, useWhisperMode, whisperRecorder]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    whisperRecorder.stopRecording();
    setState("idle");
  }, [whisperRecorder]);

  // Poll for due reminders every 30 seconds and speak them aloud
  useEffect(() => {
    const pollDueReminders = async () => {
      try {
        const response = await fetch("/api/reminders/due");
        if (!response.ok) return;
        const data = await response.json() as { reminders: Array<{ id: number; text: string }> };
        for (const reminder of data.reminders) {
          const reminderText = `Reminder, sir: ${reminder.text}`;
          const reminderMsg: Message = {
            id: nanoid(),
            role: "sentinel",
            content: reminderText,
            timestamp: new Date(),
            toolsUsed: ["reminder"],
          };
          setMessages((prev) => [...prev, reminderMsg]);
          // Speak the reminder aloud
          await speak(reminderText);
        }
      } catch { /* ignore */ }
    };

    const interval = setInterval(() => void pollDueReminders(), 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak]);

  const clearHistory = useCallback(() => {
    try { currentSourceRef.current?.stop(); } catch { /* ignore */ }
    window.speechSynthesis?.cancel();
    setState("idle");
    setMessages([]);
    setError(null);
    setLastToolsUsed([]);
    clearHistoryMutation.mutateAsync({ sessionId: sessionId.current }).catch(() => {});
  }, [clearHistoryMutation]);

  const nowPlayingData = nowPlayingQuery.data as {
    playing: boolean;
    track: {
      name: string;
      artist: string;
      album: string;
      albumArt: string | null;
      isPlaying: boolean;
      progressMs: number;
      durationMs: number;
    } | null;
  } | undefined;

  return {
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
    nowPlaying: nowPlayingData ?? null,
    userPreferences: (preferencesQuery.data ?? null) as {
      homeZipCode: string | null;
      preferredVoiceKey: string | null;
      preferredLayout: string | null;
      speechRate: number | null;
      reverbIntensity: number | null;
    } | null,
    useWhisperMode,
    isTranscribing: whisperRecorder.isTranscribing,
    sessionId: sessionId.current,
    updateVoiceSettings,
    startListening,
    stopListening,
    stopSpeaking,
    sendMessage,
    clearHistory,
  };
}
