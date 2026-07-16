import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "../authRoutes";
import { registerOAuthRoutes } from "./oauth";
import { registerCalendarRoutes } from "../calendarRoutes";
import { registerOutlookCalendarRoutes } from "../outlookCalendarRoutes";
import { registerTtsRoutes } from "../ttsRoutes";
import { registerSpotifyRoutes } from "../spotifyRoutes";
import { registerImageAnalysisRoute } from "../imageAnalysisRoute";
import { registerStorageProxy } from "./storageProxy";
import discordWebhookRouter from "../discordWebhook";
import commandCenterRouter from "../commandCenterRoutes";
import { stripeRouter } from "../stripeRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getPendingReminders, markReminderFired } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Tokens are now loaded per-user on demand from the database.
  // No global singleton restoration needed at startup.
  console.log("[SENTINEL] Server starting — per-user token model active.");

  const app = express();
  const server = createServer(app);
  // ️ Stripe webhook MUST be registered BEFORE express.json() to preserve raw body
  app.use("/api/stripe", stripeRouter);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerAuthRoutes(app);
  registerOAuthRoutes(app);
  registerCalendarRoutes(app);
  registerOutlookCalendarRoutes(app);
  registerTtsRoutes(app);
  registerSpotifyRoutes(app);
  registerImageAnalysisRoute(app);
  app.use(discordWebhookRouter);
  app.use('/api/command-center', commandCenterRouter);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Start reminder polling loop — checks every 30 seconds for due reminders
  // Due reminders are exposed via GET /api/reminders/due so the frontend can
  // pick them up and speak them aloud via ElevenLabs TTS.
  const dueReminderQueue: Array<{ id: number; text: string }> = [];

  setInterval(async () => {
    try {
      const pending = await getPendingReminders(0);
      for (const reminder of pending) {
        await markReminderFired(reminder.id);
        dueReminderQueue.push({ id: reminder.id, text: reminder.text });
        console.log(`[Reminders] Reminder due: "${reminder.text}" (id=${reminder.id})`);
      }
    } catch (err) {
      console.warn("[Reminders] Polling error:", err);
    }
  }, 30_000);

  // Endpoint: frontend polls this to get any reminders that just fired
  app.get("/api/reminders/due", (_req, res) => {
    const due = dueReminderQueue.splice(0); // drain the queue
    res.json({ reminders: due });
  });
}

startServer().catch(console.error);
