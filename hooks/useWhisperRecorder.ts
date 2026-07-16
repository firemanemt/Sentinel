/**
 * useWhisperRecorder — records audio via MediaRecorder and transcribes via Whisper server.
 * Used as a fallback when the Web Speech API is unavailable (iOS Safari, Firefox, etc.)
 */
import { useCallback, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "transcribing" | "error";

interface UseWhisperRecorderOptions {
  onTranscript: (text: string) => void;
  onError?: (msg: string) => void;
  maxDurationMs?: number; // auto-stop after this many ms (default 30s)
}

export function useWhisperRecorder({
  onTranscript,
  onError,
  maxDurationMs = 30_000,
}: UseWhisperRecorderOptions) {
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopRecording = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (recorderState !== "idle") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick the best supported MIME type
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks to release the mic
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });

        if (blob.size < 1000) {
          setRecorderState("idle");
          onError?.("No audio captured. Please try again.");
          return;
        }

        setRecorderState("transcribing");

        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");

          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: "Unknown error" })) as { error: string };
            throw new Error(err.error || `Server error ${response.status}`);
          }

          const data = await response.json() as { text: string };
          const transcript = data.text?.trim();

          if (!transcript) {
            onError?.("No speech detected. Please try again.");
            setRecorderState("idle");
            return;
          }

          setRecorderState("idle");
          onTranscript(transcript);
        } catch (err) {
          console.error("[Whisper] Transcription error:", err);
          onError?.(err instanceof Error ? err.message : "Transcription failed");
          setRecorderState("idle");
        }
      };

      recorder.onerror = () => {
        onError?.("Recording error. Please try again.");
        setRecorderState("error");
        setTimeout(() => setRecorderState("idle"), 2000);
      };

      recorder.start(250); // collect chunks every 250ms
      setRecorderState("recording");

      // Auto-stop after maxDurationMs
      autoStopTimerRef.current = setTimeout(() => {
        stopRecording();
      }, maxDurationMs);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        onError?.("Microphone access denied. Please allow microphone access and try again.");
      } else {
        onError?.(err instanceof Error ? err.message : "Could not start recording");
      }
      setRecorderState("idle");
    }
  }, [recorderState, onTranscript, onError, maxDurationMs, stopRecording]);

  return {
    recorderState,
    startRecording,
    stopRecording,
    isRecording: recorderState === "recording",
    isTranscribing: recorderState === "transcribing",
  };
}
