import type { Express, Request, Response } from "express";
import { invokeLLM } from "./_core/llm";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const multerLib = require("multer") as any;
const multer = multerLib.default ?? multerLib;
const memoryStorage = (multerLib.memoryStorage ?? multerLib.default?.memoryStorage);
const upload = multer({ storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

export function registerImageAnalysisRoute(app: Express) {
  // POST /api/analyze-image — accepts an image file + optional question
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.post("/api/analyze-image", upload.single("image"), async (req: Request, res: Response) => {
    const file = (req as any).file as { buffer: Buffer; mimetype: string; originalname?: string } | undefined;
    if (!file || !file.buffer || file.buffer.length === 0) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }

    const question = typeof (req.body as { question?: string }).question === "string"
      ? (req.body as { question: string }).question.trim().slice(0, 500)
      : "Describe what you see in this image in detail.";

    try {
      // Convert image to base64 data URL
      const base64 = file.buffer.toString("base64");
      const mimeType = file.mimetype || "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const result = await invokeLLM({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `You are SENTINEL, the AI assistant. You are analysing an image provided by your user. 
Respond in your characteristic professional, precise, and occasionally witty manner.
Describe what you observe clearly and concisely. If the user has asked a specific question, answer it directly.
Keep your response suitable for text-to-speech — no markdown, no bullet points, just natural spoken prose.`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "high" },
              },
              {
                type: "text",
                text: question,
              },
            ] as unknown as string,
          },
        ],
        maxTokens: 1024,
      });

      const reply = result?.choices?.[0]?.message?.content;
      if (typeof reply !== "string" || !reply.trim()) {
        res.status(500).json({ error: "No analysis returned" });
        return;
      }

      res.json({ analysis: reply.trim() });
    } catch (err) {
      console.error("[ImageAnalysis] Error:", err);
      res.status(500).json({ error: "Image analysis failed" });
    }
  });
}
