import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { createServer } from "http";
import discordWebhookRouter from "./discordWebhook";

describe.skip("Discord Webhook Integration", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(discordWebhookRouter);

    server = createServer(app);
    port = 9999;

    await new Promise<void>((resolve, reject) => {
      server.listen(port, () => resolve());
      server.on("error", reject);
    });
  });

  afterAll(() => {
    return new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  it("should accept a Discord webhook payload with lost pet case embeds", async () => {
    const payload = {
      embeds: [
        {
          title: "Case ID: 12345",
          fields: [
            { name: "Pet Type", value: "Golden Retriever" },
            { name: "Description", value: "Missing since Tuesday morning" },
            { name: "Last Seen", value: "Downtown Park, 5th Avenue" },
            { name: "Owner", value: "John Smith" },
            { name: "Contact", value: "john@example.com, 555-1234" },
            { name: "Location", value: "New York, NY" },
            { name: "Status", value: "unassigned" },
          ],
        },
      ],
    };

    const response = await fetch(`http://localhost:${port}/api/discord/cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.cases).toBeDefined();
    expect(data.cases.length).toBeGreaterThan(0);
    expect(data.cases[0].caseId).toContain("Case ID:");
    expect(data.cases[0].petType).toBe("Golden Retriever");
  });

  it("should reject payload without embeds", async () => {
    const payload = { embeds: [] };

    const response = await fetch(`http://localhost:${port}/api/discord/cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("should parse case fields correctly", async () => {
    const payload = {
      embeds: [
        {
          title: "Case ID: 67890",
          fields: [
            { name: "Pet Type", value: "Siamese Cat" },
            { name: "Description", value: "Indoor cat, escaped through screen door" },
            { name: "Last Seen", value: "Backyard" },
            { name: "Owner", value: "Jane Doe" },
            { name: "Contact", value: "jane.doe@email.com, 555-9876" },
            { name: "Location", value: "Los Angeles, CA" },
            { name: "Status", value: "in_progress" },
          ],
        },
      ],
    };

    const response = await fetch(`http://localhost:${port}/api/discord/cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.cases.length).toBeGreaterThan(0);
    const firstCase = data.cases[0];
    expect(firstCase.petType).toBe("Siamese Cat");
    expect(["in_progress", "already_exists"]).toContain(firstCase.status);
    expect(firstCase.location).toBe("Los Angeles, CA");
  });
});
