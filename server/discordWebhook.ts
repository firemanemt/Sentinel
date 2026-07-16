import { Router } from "express";
import { getDb } from "./db";
import { discordLostPetCases } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const router = Router();

interface DiscordEmbed {
  title?: string;
  fields?: Array<{ name: string; value: string }>;
}

interface DiscordMessage {
  embeds: DiscordEmbed[];
}

/**
 * Parse Discord embed fields into structured case data.
 */
function parseCase(embed: DiscordEmbed) {
  const fieldMap: Record<string, string> = {};
  if (embed.fields) {
    for (const field of embed.fields) {
      fieldMap[field.name.toLowerCase()] = field.value;
    }
  }

  // Extract case ID from title
  let caseId = "unknown";
  if (embed.title?.includes("Case ID:")) {
    const match = embed.title.match(/Case ID:\s*(\d+)/);
    if (match) caseId = `Case ID: ${match[1]}`;
  }

  // Parse contact field
  let ownerEmail = "";
  let ownerPhone = "";
  const contactRaw = fieldMap["contact"] || "";
  const emailMatch = contactRaw.match(/[\w.-]+@[\w.-]+\.[\w.-]+/);
  const phoneMatch = contactRaw.match(/\d{10}|\d{3}-\d{3}-\d{4}/);
  if (emailMatch) ownerEmail = emailMatch[0];
  if (phoneMatch) ownerPhone = phoneMatch[0];

  return {
    caseId,
    petType: fieldMap["pet type"] || fieldMap["pet_type"] || "",
    description: fieldMap["description"] || "",
    lastSeen: fieldMap["last seen"] || fieldMap["last_seen"] || "",
    ownerName: fieldMap["owner"] || "",
    ownerEmail,
    ownerPhone,
    location: fieldMap["location"] || "",
    status: fieldMap["status"] || "unassigned",
  };
}

/**
 * POST /api/discord/cases
 * Webhook endpoint that receives lost pet case embeds from Discord.
 */
router.post("/api/discord/cases", async (req, res) => {
  try {
    const payload = req.body as DiscordMessage;

    if (!payload.embeds || payload.embeds.length === 0) {
      return res.status(400).json({ error: "No embeds in payload" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const results = [];

    for (const embed of payload.embeds) {
      const parsed = parseCase(embed);

      // Check if case already exists by caseId
      const existing = await db
        .select()
        .from(discordLostPetCases)
        .where(eq(discordLostPetCases.caseId, parsed.caseId))
        .limit(1);

      if (existing.length === 0) {
        // Insert new case
        await db.insert(discordLostPetCases).values({
          caseId: parsed.caseId,
          messageId: `webhook-${Date.now()}`, // Webhook doesn't provide message ID
          petType: parsed.petType,
          description: parsed.description,
          lastSeen: parsed.lastSeen,
          ownerName: parsed.ownerName,
          ownerEmail: parsed.ownerEmail,
          ownerPhone: parsed.ownerPhone,
          location: parsed.location,
          status: parsed.status,
          postedAt: new Date(),
          rawEmbed: JSON.stringify(embed),
        });

        console.log(`[Discord Webhook] Stored case: ${parsed.caseId} - ${parsed.petType}`);
        results.push({
          caseId: parsed.caseId,
          petType: parsed.petType,
          status: "stored",
        });
      } else {
        results.push({
          caseId: parsed.caseId,
          petType: parsed.petType,
          status: "already_exists",
        });
      }
    }

    res.json({ success: true, cases: results });
  } catch (err) {
    console.error("[Discord Webhook] Error:", err);
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

export default router;
