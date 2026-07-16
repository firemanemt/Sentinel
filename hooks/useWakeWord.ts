import { useCallback, useEffect, useRef, useState } from "react";

const WAKE_PHRASES = ["hey sentinel", "sentinel", "hey sentinel,", "ok sentinel", "okay sentinel"];

function matchesWakeWord(transcript: string): boolean {
  const lower = transcript.toLowerCase().trim();
  return WAKE_PHRASES.some((phrase) => lower.startsWith(phrase));
}

function stripWakeWord(transcript: string): string {
  const lower = transcript.toLowerCase().trim();
  for (const phrase of WAKE_PHRASES) {
    if (lower.startsWith(phrase)) {
      const remainder = transcript.slice(phrase.length).trim();
      // Remove leading punctuation like comma or period
      return remainder.replace(/^[,.\s]+/, "").trim();
    }
  }
  return transcript.trim();
}

interface UseWakeWordOptions {
  enabled: boolean;
  onWakeWordDetected: (commandAfterWakeWord?: string) => void;
  onError?: (msg: string) => void;
}

export function useWakeWord({ enabled, onWakeWordDetected, onError }: UseWakeWordOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null);
  const enabledRef = useRef(enabled);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const createRecognition = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SpeechRecognitionCtor();
    recognition.lang = "en-GB";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    return recognition;
  }, []);

  const start = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    const recognition = createRecognition();
    if (!recognition) {
      onError?.("Wake-word detection requires Chrome or Edge browser.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript: string = result[0]?.transcript ?? "";

        if (matchesWakeWord(transcript)) {
          const command = stripWakeWord(transcript);
          recognition.stop();
          recognitionRef.current = null;
          setIsListening(false);
          onWakeWordDetected(command || undefined);
          return;
        }
      }
    };

    recognition.onstart = () => setIsListening(true);

    recognition.onerror = (e: { error: string }) => {
      if (e.error === "not-allowed") {
        onError?.("Microphone access denied. Wake-word detection disabled.");
        setIsListening(false);
        return;
      }
      // For other errors (network, aborted), auto-restart
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      // Auto-restart if still enabled
      if (enabledRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (enabledRef.current) start();
        }, 500);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // Already started or other error — ignore
    }
  }, [createRecognition, onWakeWordDetected, onError]);

  const stop = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  // Start/stop based on enabled prop
  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { isListening };
}
