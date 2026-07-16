/**
 * SENTINEL Sound Engine
 * All sounds synthesized via Web Audio API — no external files required.
 * Sounds are designed to feel like Iron Man HUD audio cues.
 */

import { useCallback, useRef, useEffect } from "react";

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch {
    return null;
  }
}

// Shared lazy AudioContext — created on first user interaction
let _ctx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (!_ctx) _ctx = getAudioContext();
  return _ctx;
}

function resumeCtx() {
  const c = ctx();
  if (c && c.state === "suspended") void c.resume();
  return c;
}

// ── Sound primitives ──────────────────────────────────────────────────────────

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  gainPeak = 0.15,
  startTime?: number,
  endFrequency?: number,
) {
  const c = resumeCtx();
  if (!c) return;
  const t = startTime ?? c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();

  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = 1.5;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t);
  if (endFrequency !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(endFrequency, t + duration);
  }

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(gainPeak, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);

  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function playNoise(duration: number, gainPeak = 0.05, filterFreq = 2000, startTime?: number) {
  const c = resumeCtx();
  if (!c) return;
  const t = startTime ?? c.currentTime;

  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const source = c.createBufferSource();
  source.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 2;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(gainPeak, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);

  source.start(t);
}

// ── Composed sounds ───────────────────────────────────────────────────────────

/** Boot-up sequence: ascending tones + noise burst */
function playBootSound() {
  const c = resumeCtx();
  if (!c) return;
  const now = c.currentTime;
  // Rising arpeggio
  playTone(220, 0.12, "sawtooth", 0.08, now);
  playTone(330, 0.12, "sawtooth", 0.08, now + 0.1);
  playTone(440, 0.12, "sawtooth", 0.08, now + 0.2);
  playTone(660, 0.18, "sawtooth", 0.1, now + 0.32);
  playTone(880, 0.3, "sine", 0.12, now + 0.45, 1100);
  // Noise burst at end
  playNoise(0.15, 0.06, 3000, now + 0.45);
  // Final chime
  playTone(1320, 0.5, "sine", 0.08, now + 0.7);
  playTone(1760, 0.4, "sine", 0.05, now + 0.75);
}

/** Short click when mic activates */
function playMicActivate() {
  const c = resumeCtx();
  if (!c) return;
  const now = c.currentTime;
  playTone(880, 0.06, "square", 0.1, now);
  playTone(1200, 0.08, "sine", 0.08, now + 0.05);
  playNoise(0.04, 0.04, 4000, now);
}

/** Short click when mic deactivates */
function playMicDeactivate() {
  const c = resumeCtx();
  if (!c) return;
  const now = c.currentTime;
  playTone(1200, 0.06, "square", 0.08, now);
  playTone(800, 0.08, "sine", 0.06, now + 0.04);
}

/** Subtle repeating blip while thinking — returns a stop function */
function startThinkingBlips(): () => void {
  const c = resumeCtx();
  if (!c) return () => {};
  let active = true;
  let timeout: ReturnType<typeof setTimeout>;

  const scheduleBlip = () => {
    if (!active) return;
    const now = c.currentTime;
    const freq = 600 + Math.random() * 400;
    playTone(freq, 0.04, "sine", 0.04, now);
    timeout = setTimeout(scheduleBlip, 300 + Math.random() * 400);
  };

  scheduleBlip();
  return () => {
    active = false;
    clearTimeout(timeout);
  };
}

/** Chime when SENTINEL starts responding */
function playResponseChime() {
  const c = resumeCtx();
  if (!c) return;
  const now = c.currentTime;
  playTone(660, 0.15, "sine", 0.1, now);
  playTone(880, 0.15, "sine", 0.08, now + 0.08);
  playTone(1100, 0.25, "sine", 0.07, now + 0.16);
}

/** Soft tick for button interactions */
function playButtonTick() {
  const c = resumeCtx();
  if (!c) return;
  const now = c.currentTime;
  playTone(1400, 0.04, "square", 0.06, now);
  playNoise(0.03, 0.02, 5000, now);
}

/** Error / warning buzz */
function playErrorBuzz() {
  const c = resumeCtx();
  if (!c) return;
  const now = c.currentTime;
  playTone(220, 0.2, "sawtooth", 0.12, now, 180);
  playTone(180, 0.2, "sawtooth", 0.08, now + 0.15, 150);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface SentinelSounds {
  playBoot: () => void;
  playMicOn: () => void;
  playMicOff: () => void;
  playThinkingStart: () => void;
  playThinkingStop: () => void;
  playResponse: () => void;
  playClick: () => void;
  playError: () => void;
  /** Must be called on a user gesture to unlock AudioContext */
  unlock: () => void;
}

export function useSentinelSounds(enabled = true): SentinelSounds {
  const stopThinkingRef = useRef<(() => void) | null>(null);
  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const unlock = useCallback(() => {
    resumeCtx();
  }, []);

  const playBoot = useCallback(() => {
    if (!enabledRef.current) return;
    playBootSound();
  }, []);

  const playMicOn = useCallback(() => {
    if (!enabledRef.current) return;
    playMicActivate();
  }, []);

  const playMicOff = useCallback(() => {
    if (!enabledRef.current) return;
    playMicDeactivate();
  }, []);

  const playThinkingStart = useCallback(() => {
    if (!enabledRef.current) return;
    stopThinkingRef.current?.();
    stopThinkingRef.current = startThinkingBlips();
  }, []);

  const playThinkingStop = useCallback(() => {
    stopThinkingRef.current?.();
    stopThinkingRef.current = null;
  }, []);

  const playResponse = useCallback(() => {
    if (!enabledRef.current) return;
    stopThinkingRef.current?.();
    stopThinkingRef.current = null;
    playResponseChime();
  }, []);

  const playClick = useCallback(() => {
    if (!enabledRef.current) return;
    playButtonTick();
  }, []);

  const playError = useCallback(() => {
    if (!enabledRef.current) return;
    playErrorBuzz();
  }, []);

  // Stop thinking blips on unmount
  useEffect(() => {
    return () => {
      stopThinkingRef.current?.();
    };
  }, []);

  return { playBoot, playMicOn, playMicOff, playThinkingStart, playThinkingStop, playResponse, playClick, playError, unlock };
}
