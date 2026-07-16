import type { Express, Request, Response } from "express";
import { transcribeAudio } from "./_core/voiceTranscription";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const multerLib = require("multer") as any;
const multer = multerLib.default ?? multerLib;
const memoryStorage = (multerLib.memoryStorage ?? multerLib.default?.memoryStorage);
const upload = multer({ storage: memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

// ElevenLabs voice IDs — best Sentinel-like British male voices
const VOICE_OPTIONS: Record<string, string> = {
  daniel: "onwK4e9ZLuTAKqWW03F9",   // Daniel — deep, authoritative British
  george: "JBFqnCBsd6RMkjVDRZzb",   // George — warm British male
  charlie: "IKne3meq5aSn9XLyUdCD",  // Charlie — natural British male
  adam: "pNInz6obpgDQGcFmaJgB",     // Adam — clear American (fallback)
};

const DEFAULT_VOICE_ID = VOICE_OPTIONS.daniel;
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

export function registerTtsRoutes(app: Express) {
  app.post("/api/tts", async (req: Request, res: Response) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "TTS service not configured" });
      return;
    }

    const { text, voiceId } = req.body as { text?: string; voiceId?: string };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "text is required" });
      return;
    }

    // Truncate to 5000 chars to stay within ElevenLabs limits
    const truncated = text.trim().slice(0, 5000);
    const selectedVoiceId = voiceId && VOICE_OPTIONS[voiceId]
      ? VOICE_OPTIONS[voiceId]
      : DEFAULT_VOICE_ID;

    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/${selectedVoiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text: truncated,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.80,
            style: 0.15,
            use_speaker_boost: true,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[TTS] ElevenLabs error:", response.status, errText);
        res.status(502).json({ error: "TTS service error", detail: errText });
        return;
      }

      const audioBuffer = await response.arrayBuffer();
      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.byteLength),
        "Cache-Control": "no-store",
      });
      res.send(Buffer.from(audioBuffer));
    } catch (err) {
      console.error("[TTS] Fetch error:", err);
      res.status(500).json({ error: "TTS request failed" });
    }
  });

  // Whisper transcription endpoint — accepts raw audio blob from MediaRecorder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.post("/api/transcribe", upload.single("audio"), async (req: Request, res: Response) => {
    const file = (req as any).file as { buffer: Buffer; mimetype: string } | undefined;
    if (!file || !file.buffer || file.buffer.length === 0) {
      res.status(400).json({ error: "No audio file provided" });
      return;
    }

    try {
      // Upload audio buffer to S3 and get a signed URL for Whisper
      const { storagePut, storageGetSignedUrl } = await import("./storage");
      const key = `transcriptions/tmp_${Date.now()}.webm`;
      const { key: storedKey } = await storagePut(key, file.buffer, file.mimetype || "audio/webm");
      const signedUrl = await storageGetSignedUrl(storedKey);

      const result = await transcribeAudio({ audioUrl: signedUrl, language: "en" });

      if ("error" in result) {
        console.error("[Transcribe] Whisper error:", result);
        res.status(500).json({ error: result.error });
        return;
      }

      res.json({ text: result.text, language: result.language });
    } catch (err) {
      console.error("[Transcribe] Error:", err);
      res.status(500).json({ error: "Transcription failed" });
    }
  });

  // Expose available voices list to the frontend
  app.get("/api/tts/voices", (_req: Request, res: Response) => {
    res.json({
      voices: Object.entries(VOICE_OPTIONS).map(([key, id]) => ({
        key,
        id,
        label: key.charAt(0).toUpperCase() + key.slice(1),
      })),
      default: "daniel",
    });
  });
}
