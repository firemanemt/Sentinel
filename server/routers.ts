import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { createCheckoutSession, createPortalSession, getSubscriptionStatus, PLANS } from "./stripe";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import type { Tool, Message } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getWeather, webSearch, getWeatherForecast } from "./tools";
import { getTopHeadlines } from "./news";
import { getStockQuotes, searchStockSymbol } from "./stocks";
import {
  isCalendarConnected,
  getUpcomingEvents,
  getTodayEvents,
  createEvent as createGoogleEvent,
  summarizeInbox,
  getUnreadCount,
} from "./googleCalendar";
import {
  isSpotifyConnected,
  getCurrentTrack,
  getCurrentTrackData,
  playMusic,
  pauseMusic,
  skipTrack,
  previousTrack,
  setVolume,
  searchSpotify,
} from "./spotify";
import {
  saveMessage,
  getSessionMessages,
  clearSessionMessages,
  createReminder,
  getUpcomingReminders,
  deleteReminder,
  snoozeReminder,
  loadUserPreferences,
  saveUserPreferences,
  loadFacts,
  saveFact,
  deleteFact,
  getDiscordLostPetCases as getLostPetCases,
  searchLostPetCases,
} from "./db";
import {
  isGithubConnected,
  isGithubConnectedForUser,
  setGithubToken,
  saveGithubToken,
  disconnectGithub,
  getAuthenticatedUser,
  getRepos,
  getPullRequests,
  getIssues,
  getNotifications,
  markNotificationRead,
} from "./github";
import {
  isSlackConnected,
  isSlackConnectedForUser,
  setSlackToken,
  saveSlackToken,
  disconnectSlack,
  getWorkspaceInfo,
  getChannels as getSlackChannels,
  getMessages as getSlackMessages,
  sendMessage as sendSlackMessage,
} from "./slack";
import {
  isDiscordConnected,
  isDiscordConnectedForUser,
  setDiscordBotToken,
  saveDiscordToken,
  disconnectDiscord,
  getBotUser as getDiscordBotUser,
  getGuilds,
  getGuildChannels,
  getMessages as getDiscordMessages,
  sendMessage as sendDiscordMessage,
} from "./discordBot";
import {
  isHomeAssistantConnected,
  isHomeAssistantConnectedForUser,
  setHomeAssistantConfig,
  saveHomeAssistantConfig,
  disconnectHomeAssistant,
  getApiStatus as getHaStatus,
  getStates,
  getStatesByDomain,
  callService,
  toggleEntity,
  turnOn,
  turnOff,
  setLightBrightness,
  setClimateTemperature,
  groupStatesByDomain,
} from "./homeAssistant";
import {
  upsertIntegrationToken,
  deleteIntegrationToken,
} from "./db";
import {
  getDirections,
  geocodeAddress,
  isSimpleRoutingConfigured,
  formatDuration,
  formatDistance,
  buildInstruction,
} from "./simpleRouting";
import { getWeatherData, getAirQuality } from "./openMeteo";
import { getNwsAlerts, getNwsPoint, alertSeverityColor, alertIcon } from "./nws";
import { getMorningConfig, saveMorningConfig, ALL_SECTIONS } from "./morningRoutine";
import {
  isOutlookConnected,
  getOutlookTodayEvents,
  getOutlookEvents,
  createOutlookEvent,
} from "./outlookCalendar";
import {
  isAppleConnected,
  getAppleTodayEvents,
  getAppleEvents,
  createAppleEvent,
} from "./appleCalendar";
import {
  saveAppleCalDavConfig,
  deleteAppleCalDavConfig,
} from "./db";
import { saveAppleConfig } from "./appleCalendar";

const SENTINEL_SYSTEM_PROMPT = `You are SENTINEL (Just A Rather Very Intelligent System), the AI assistant created for and dedicated to serving your user. You are modelled after the SENTINEL from the Iron Man universe.

Your personality:
- Professional, composed, and precise — you speak with the measured confidence of a trusted advisor
- Subtly witty — you may occasionally deploy dry British humour, but never at the expense of helpfulness
- Respectful — you address the user with courtesy, occasionally using "sir" or "ma'am" when appropriate, but not excessively
- Concise — you do not ramble; every sentence serves a purpose
- Knowledgeable — you have broad expertise and approach problems analytically

Your speech patterns:
- Speak in clear, well-structured sentences
- Avoid slang, contractions where possible, and overly casual language
- You may use phrases like "Certainly", "Of course", "I should point out", "Might I suggest", "Indeed"
- When delivering information, be direct and precise
- A touch of dry wit is acceptable, particularly when the situation calls for levity

Tool usage:
- When the user asks about weather or current conditions for any location, ALWAYS use the get_weather tool
- When the user asks a factual question you are uncertain about, or asks you to look something up, use the web_search tool
- When the user asks about time, date, day of the week, or current datetime, use the get_current_time tool
- When the user asks about their schedule, calendar, upcoming events, or what is happening today/this week, use the get_calendar_events tool
- When the user asks to schedule, create, add, or book an event or meeting, use the create_calendar_event tool
- When the user asks to play music, play a song/artist/playlist, resume, pause, skip, go back, or control volume, use the appropriate Spotify tool
- When the user asks what is currently playing, use the get_current_track tool
- When the user asks to set a reminder, remind them of something, or create an alert, use the set_reminder tool
- When the user asks what reminders they have, use the get_reminders tool
- When the user asks to check email, read inbox, or how many unread messages they have, use the read_email tool
- When the user asks for news, headlines, or what is happening in the world, use the get_news tool
- When the user asks about a stock price, market, or financial instrument, use the get_stock_quotes tool
- When the user asks for a weather forecast or multi-day outlook, use the get_weather_forecast tool
- When the user tells you something personal (their name, preferences, location, interests), use the remember_fact tool to store it
- When the user asks what you know about them or asks you to recall something, use the recall_facts tool
- When the user asks you to forget something, use the forget_fact tool
- When the user asks about lost pets, missing animals, lost pet cases, or pet alerts, use the get_lost_pet_cases tool to retrieve recent cases from the Discord #case-alerts channel
- When the user searches for a specific lost pet by type, location, breed, or owner name, use the search_lost_pet_cases tool
- When the user asks about their GitHub repos, pull requests, issues, or notifications, use the appropriate GitHub tool
- When the user asks to read Discord messages from a channel, use the get_discord_messages tool
- When the user asks to send a Discord message, use the send_discord_message tool
- When the user asks to read Slack messages from a channel, use the get_slack_messages tool
- When the user asks to send a Slack message, use the send_slack_message tool
- When the user asks about smart home devices, lights, switches, or thermostats, use the get_ha_devices tool
- When the user asks to turn on/off or toggle a smart home device, use the toggle_ha_device tool
- When the user asks to set a light brightness, use the set_ha_brightness tool
- When the user asks to set a thermostat temperature, use the set_ha_temperature tool
- After receiving tool results, synthesise the information into a natural spoken response — do not read out raw data

Important rules:
- You are always referred to as SENTINEL
- You never break character
- You are helpful above all else — wit is secondary to utility
- BREVITY IS PARAMOUNT. Keep every response as short as possible. One to three sentences maximum for most tasks. Never repeat information you just stated. Never narrate your own process (do NOT say things like "Creating the event now", "Scheduling...", "Confirming details", "Saving the event", "All set" — just do it and report the result in one sentence).
- After completing an action (creating a calendar event, setting a reminder, playing music), confirm it in ONE sentence only. Example: "Done — Joe's party is on your calendar for the twenty-fifth at two." NOT a paragraph.
- Do NOT ask follow-up questions unless absolutely necessary. If you have enough information to act, act. If the user wants to add more details they will tell you.
- You are speaking aloud via text-to-speech, so avoid markdown formatting, bullet points, or symbols in your responses — write in natural spoken prose
- For calendar events, present times in a human-friendly spoken format, e.g. "three-thirty in the afternoon" or "half past two"
- Always use imperial measurements: temperatures in Fahrenheit, distances in miles, speeds in miles per hour, weights in pounds and ounces, heights in feet and inches — never use metric units unless the user explicitly requests them
- For reminders, confirm the time back to the user in a natural spoken way — one sentence
- When the user says "Good morning", "good morning SENTINEL", "morning SENTINEL", or any morning greeting, ALWAYS call the morning_briefing tool first. This will simultaneously queue Highway to Hell by AC/DC on Spotify AND gather the weather, calendar, email, and reminders data. Then deliver the full briefing in a single spoken response in the style of the Iron Man 2 scene — witty, confident, and efficient. Keep the briefing to 3-4 sentences maximum.`;

const BASE_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather conditions for any city or location.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "The city or location name, e.g. 'London', 'New York'" },
        },
        required: ["location"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for factual information, current events, or any topic.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Get the current date, time, day of the week, and timezone.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_reminder",
      description: "Set a reminder that SENTINEL will announce aloud at the specified time.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "The reminder message to announce" },
          dueAt: { type: "string", description: "ISO 8601 datetime when the reminder should fire, e.g. 2026-07-14T18:00:00" },
        },
        required: ["text", "dueAt"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_reminders",
      description: "Get the user's upcoming reminders.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_news",
      description: "Fetch the latest news headlines. Optionally filter by category.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["general", "technology", "business", "sports", "science", "health", "entertainment"],
            description: "News category to fetch",
          },
          maxResults: { type: "number", description: "Number of headlines to return (1-10)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stock_quotes",
      description: "Get real-time stock prices for one or more ticker symbols.",
      parameters: {
        type: "object",
        properties: {
          symbols: {
            type: "array",
            items: { type: "string" },
            description: "Array of stock ticker symbols, e.g. ['AAPL', 'TSLA', 'NVDA']",
          },
        },
        required: ["symbols"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_stock_symbol",
      description: "Search for a stock ticker symbol by company name.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Company name to search for" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weather_forecast",
      description: "Get a multi-day weather forecast for a location.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City or location name" },
          days: { type: "number", description: "Number of forecast days (1-7, default 5)" },
        },
        required: ["location"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remember_fact",
      description: "Store a key fact about the user for future reference.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Short identifier for the fact, e.g. 'user_name', 'favorite_sport'" },
          value: { type: "string", description: "The fact value to remember" },
        },
        required: ["key", "value"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recall_facts",
      description: "Retrieve all stored facts about the user.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "forget_fact",
      description: "Delete a stored fact about the user.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "The fact key to delete" },
        },
        required: ["key"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "morning_briefing",
      description: "Trigger the Iron Man-style morning briefing. Plays Highway to Hell by AC/DC on Spotify (if connected) and gathers today's weather, calendar events, unread email count, and upcoming reminders. Call this whenever the user says good morning or any morning greeting.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "snooze_reminder",
      description: "Snooze a reminder by a given number of minutes, rescheduling it to fire later.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "The reminder ID to snooze" },
          minutes: { type: "number", description: "Number of minutes to snooze the reminder" },
        },
        required: ["id", "minutes"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_lost_pet_cases",
      description: "Retrieve lost pet cases from the Discord #case-alerts channel. Returns recent cases with details about missing pets, locations, and owner contact information.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["unassigned", "in_progress", "resolved"], description: "Filter cases by status (optional)" },
          limit: { type: "number", description: "Number of cases to return (default 10, max 50)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_lost_pet_cases",
      description: "Search lost pet cases by pet type, location, description, or owner name.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (pet type, location, breed, owner name, etc.)" },
          limit: { type: "number", description: "Number of results to return (default 10, max 50)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weather_detail",
      description: "Get detailed current weather including temperature, humidity, wind, pressure, UV index, and visibility for any location using Open-Meteo.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City or location name, e.g. 'Miami, FL'" },
        },
        required: ["location"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_air_quality",
      description: "Get current air quality index (AQI), PM2.5, PM10, ozone, NO2, SO2, and CO for any location.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City or location name" },
        },
        required: ["location"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_nws_alerts",
      description: "Get active NWS weather alerts, watches, warnings, and advisories for a US location.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "US city or location name" },
        },
        required: ["location"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_directions",
      description: "Get turn-by-turn driving, walking, or cycling directions between two locations.",
      parameters: {
        type: "object",
        properties: {
          origin: { type: "string", description: "Starting address or location" },
          destination: { type: "string", description: "Destination address or location" },
          profile: {
            type: "string",
            enum: ["driving", "walking", "cycling"],
            description: "Travel mode (default: driving)",
          },
        },
        required: ["origin", "destination"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_window",
      description: "Open a specific SENTINEL window or app panel on the user's screen. Use this when the user asks to open, show, or navigate to a specific section.",
      parameters: {
        type: "object",
        properties: {
          windowType: {
            type: "string",
            enum: ["maps", "weather", "calendar", "notes", "files", "spotify", "github", "discord", "slack", "home-assistant", "integrations", "settings"],
            description: "The window type to open",
          },
        },
        required: ["windowType"],
        additionalProperties: false,
      },
    },
  },
];

const CALENDAR_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_calendar_events",
      description: "Get the user's upcoming Google Calendar events.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "week"],
            description: "Whether to fetch today's events or the next 7 days",
          },
        },
        required: ["period"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a new event in the user's Google Calendar.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event title or name" },
          startDateTime: { type: "string", description: "Start date and time in ISO 8601 format" },
          endDateTime: { type: "string", description: "End date and time in ISO 8601 format" },
          description: { type: "string", description: "Optional event description" },
          location: { type: "string", description: "Optional event location" },
        },
        required: ["title", "startDateTime", "endDateTime"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_email",
      description: "Read and summarize the user's Gmail inbox, including unread count and recent messages.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
];

const SPOTIFY_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "spotify_play",
      description: "Play music on Spotify. Can search for and play a specific song, artist, or resume playback.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Song name, artist, or playlist to search for and play. Omit to resume current playback." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "spotify_pause",
      description: "Pause Spotify playback.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "spotify_skip",
      description: "Skip to the next track on Spotify.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "spotify_previous",
      description: "Go back to the previous track on Spotify.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "spotify_volume",
      description: "Set the Spotify playback volume.",
      parameters: {
        type: "object",
        properties: {
          percent: { type: "number", description: "Volume level from 0 to 100" },
        },
        required: ["percent"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_track",
      description: "Get the currently playing track on Spotify.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "spotify_search",
      description: "Search Spotify for tracks, artists, or playlists without playing.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          type: { type: "string", enum: ["track", "artist", "playlist"], description: "Type of search" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

const GITHUB_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_github_repos",
      description: "List the user's GitHub repositories.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max number of repos to return (default 10)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_github_prs",
      description: "Get open pull requests for a GitHub repository.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string", description: "Repository owner (username or org)" },
          repo: { type: "string", description: "Repository name" },
        },
        required: ["owner", "repo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_github_issues",
      description: "Get issues for a GitHub repository.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string", description: "Repository owner" },
          repo: { type: "string", description: "Repository name" },
          state: { type: "string", enum: ["open", "closed", "all"], description: "Issue state filter" },
        },
        required: ["owner", "repo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_github_notifications",
      description: "Get the user's unread GitHub notifications.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
];

const DISCORD_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_discord_messages",
      description: "Read recent messages from a Discord channel.",
      parameters: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "The Discord channel ID to read messages from" },
          limit: { type: "number", description: "Number of messages to retrieve (default 20, max 50)" },
        },
        required: ["channelId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_discord_message",
      description: "Send a message to a Discord channel.",
      parameters: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "The Discord channel ID to send the message to" },
          content: { type: "string", description: "The message content to send" },
        },
        required: ["channelId", "content"],
        additionalProperties: false,
      },
    },
  },
];

const SLACK_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_slack_messages",
      description: "Read recent messages from a Slack channel.",
      parameters: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "The Slack channel ID to read messages from" },
          limit: { type: "number", description: "Number of messages to retrieve (default 20)" },
        },
        required: ["channelId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_slack_message",
      description: "Send a message to a Slack channel.",
      parameters: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "The Slack channel ID to send the message to" },
          text: { type: "string", description: "The message text to send" },
        },
        required: ["channelId", "text"],
        additionalProperties: false,
      },
    },
  },
];

const HOME_ASSISTANT_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_ha_devices",
      description: "Get the current state of all Home Assistant devices/entities. Optionally filter by domain (light, switch, climate, sensor, etc.).",
      parameters: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Optional entity domain to filter by, e.g. 'light', 'switch', 'climate'" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_ha_device",
      description: "Toggle a Home Assistant entity on or off.",
      parameters: {
        type: "object",
        properties: {
          entityId: { type: "string", description: "The entity ID to toggle, e.g. 'light.living_room'" },
        },
        required: ["entityId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_ha_brightness",
      description: "Set the brightness of a Home Assistant light.",
      parameters: {
        type: "object",
        properties: {
          entityId: { type: "string", description: "The light entity ID" },
          brightness: { type: "number", description: "Brightness from 0 to 100 percent" },
        },
        required: ["entityId", "brightness"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_ha_temperature",
      description: "Set the target temperature of a Home Assistant climate entity (thermostat).",
      parameters: {
        type: "object",
        properties: {
          entityId: { type: "string", description: "The climate entity ID" },
          temperature: { type: "number", description: "Target temperature in Fahrenheit" },
        },
        required: ["entityId", "temperature"],
        additionalProperties: false,
      },
    },
  },
];

function getCurrentTimeInfo() {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    iso: now.toISOString(),
    date: now.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    dayOfWeek: now.toLocaleDateString("en-GB", { weekday: "long" }),
    timezone,
    timestamp: now.getTime(),
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  sentinel: router({
    chat: protectedProcedure
      .input(
        z.object({
          message: z.string().min(1).max(2000),
          history: z
            .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
            .max(20)
            .optional()
            .default([]),
          userLat: z.number().optional(),
          userLon: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.user.id;
        const [calendarConnected, spotifyConnected, githubConnected, discordBotConnected, slackConnected, haConnected] = await Promise.all([
          isCalendarConnected(userId),
          Promise.resolve(isSpotifyConnected()),
          Promise.resolve(isGithubConnected()),
          Promise.resolve(isDiscordConnected()),
          Promise.resolve(isSlackConnected()),
          Promise.resolve(isHomeAssistantConnected()),
        ]);

        // Load persistent user preferences for context injection
        const userPrefs = await loadUserPreferences(userId);

        const contextNotes: string[] = [];
        // Inject live GPS coords if browser provided them
        if (input.userLat != null && input.userLon != null) {
          contextNotes.push(`The user's current GPS coordinates are lat=${input.userLat.toFixed(5)}, lon=${input.userLon.toFixed(5)}. When they ask about weather "here", "near me", or "my location" WITHOUT specifying a city, call get_weather_detail with location="${input.userLat.toFixed(4)},${input.userLon.toFixed(4)}" directly — do NOT ask for their location.`);
        } else if (userPrefs.homeZipCode) {
          contextNotes.push(`The user's home location is zip code ${userPrefs.homeZipCode}. When they ask about weather "here", "at home", or "my location" without specifying a city, use this zip code.`);
        }
        // Inject stored facts into context
        const storedFacts = await loadFacts(userId);
        if (storedFacts.length > 0) {
          const factLines = storedFacts.map(f => `${f.key}: ${f.value}`).join("\n");
          contextNotes.push(`Known facts about the user:\n${factLines}`);
        }

        const outlookConnected = isOutlookConnected();
        const appleCalConnected = isAppleConnected();
        const anyCalendarConnected = calendarConnected || outlookConnected || appleCalConnected;
        const calendarProviders: string[] = [];
        if (calendarConnected) calendarProviders.push("Google Calendar");
        if (outlookConnected) calendarProviders.push("Outlook Calendar");
        if (appleCalConnected) calendarProviders.push("Apple Calendar");

        if (anyCalendarConnected) {
          contextNotes.push(`Connected calendar providers: ${calendarProviders.join(", ")}. You can read and create calendar events across all connected providers.`);
          if (calendarConnected) contextNotes.push("Gmail is connected — you can read and summarize the user's inbox.");
        } else {
          contextNotes.push("No calendar is connected. If the user asks about calendar or email, inform them to connect Google Calendar, Outlook, or Apple Calendar via the Integrations window.");
        }
        if (spotifyConnected) {
          contextNotes.push("Spotify is connected — you can control music playback.");
        } else {
          contextNotes.push("Spotify is NOT connected. If the user asks to play music, inform them to connect Spotify via the Spotify button.");
        }
        if (githubConnected) {
          contextNotes.push("GitHub is connected — you can list repos, pull requests, issues, and notifications.");
        }
        if (discordBotConnected) {
          contextNotes.push("Discord is connected — you can read messages from channels and send messages.");
        }
        if (slackConnected) {
          contextNotes.push("Slack is connected — you can read messages from channels and send messages.");
        }
        if (haConnected) {
          contextNotes.push("Home Assistant is connected — you can list devices, toggle switches/lights, set brightness, and set thermostat temperature.");
        }

        const systemContent = SENTINEL_SYSTEM_PROMPT + "\n\nCurrent context:\n" + contextNotes.join("\n");

        // Sanitize history: replace null/undefined content with empty string.
        // When a previous assistant turn used tool_calls, the model may have returned
        // content: null. Replaying that null causes a 400 from the API.
        const sanitizedHistory = input.history.map((m) => ({
          role: m.role,
          content: m.content ?? "",
        }));

        const messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string }> = [
          { role: "system", content: systemContent },
          ...sanitizedHistory,
          { role: "user", content: input.message },
        ];

        // Build available tools based on connection status
        const availableTools: Tool[] = [
          ...BASE_TOOLS,
          ...(anyCalendarConnected ? CALENDAR_TOOLS : []),
          ...(spotifyConnected ? SPOTIFY_TOOLS : []),
          ...(githubConnected ? GITHUB_TOOLS : []),
          ...(discordBotConnected ? DISCORD_TOOLS : []),
          ...(slackConnected ? SLACK_TOOLS : []),
          ...(haConnected ? HOME_ASSISTANT_TOOLS : []),
        ];

        const firstResult = await invokeLLM({
          model: "gpt-4o-mini",
          messages,
          maxTokens: 2048,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: availableTools as any,
          toolChoice: "auto",
        });

        if (!firstResult?.choices?.length) {
          console.error("[SENTINEL] First LLM returned no choices. Full response:", JSON.stringify(firstResult).slice(0, 800));
          return { reply: "I appear to be experiencing a momentary lapse in processing. My apologies, sir.", toolsUsed: [] };
        }

        const firstChoice = firstResult.choices[0];
        if (!firstChoice) {
          console.error("[SENTINEL] First LLM had empty choices array. Full response:", JSON.stringify(firstResult).slice(0, 800));
          return { reply: "I appear to be experiencing a momentary lapse in processing. My apologies, sir.", toolsUsed: [] };
        }

        const toolCalls = firstChoice.message.tool_calls;
        const toolsUsed: string[] = [];

        if (!toolCalls || toolCalls.length === 0) {
          const reply =
            typeof firstChoice.message.content === "string"
              ? firstChoice.message.content
              : "I appear to be experiencing a momentary lapse in processing. My apologies, sir.";
          return { reply, toolsUsed };
        }

        // Strip the `index` field that the streaming API adds — it is not
        // part of the Chat Completions spec and causes the second call to fail.
        const cleanedToolCalls = toolCalls.map(({ id, type, function: fn }) => ({
          id,
          type,
          function: fn,
        }));

        const assistantMessage = {
          role: "assistant" as const,
          content: typeof firstChoice.message.content === "string" ? firstChoice.message.content : "",
          tool_calls: cleanedToolCalls,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolMessages: any[] = [assistantMessage];

        for (const call of toolCalls) {
          const fnName = call.function.name;
          let toolResult: string;

          try {
            const args = JSON.parse(call.function.arguments) as Record<string, unknown>;

            if (fnName === "get_weather") {
              const weather = await getWeather(String(args.location ?? ""));
              toolResult = JSON.stringify(weather);
              toolsUsed.push("weather");
            } else if (fnName === "web_search") {
              const search = await webSearch(String(args.query ?? ""));
              toolResult = JSON.stringify(search);
              toolsUsed.push("search");
            } else if (fnName === "get_current_time") {
              toolResult = JSON.stringify(getCurrentTimeInfo());
              toolsUsed.push("time");
            } else if (fnName === "get_calendar_events") {
              const period = args.period === "today" ? "today" : "week";
              try {
                const now = new Date();
                const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
                const [googleEvts, outlookEvts, appleEvts] = await Promise.allSettled([
                  calendarConnected
                    ? (period === "today" ? getTodayEvents(userId) : getUpcomingEvents(userId, 15, 7))
                    : Promise.resolve([]),
                  outlookConnected
                    ? (period === "today" ? getOutlookTodayEvents() : getOutlookEvents(now.toISOString(), weekEnd))
                    : Promise.resolve([]),
                  appleCalConnected
                    ? (period === "today" ? getAppleTodayEvents() : getAppleEvents(now.toISOString(), weekEnd))
                    : Promise.resolve([]),
                ]);
                const events = [
                  ...(googleEvts.status === "fulfilled" ? googleEvts.value.map(e => ({ ...e, source: "google" })) : []),
                  ...(outlookEvts.status === "fulfilled" ? outlookEvts.value : []),
                  ...(appleEvts.status === "fulfilled" ? appleEvts.value : []),
                ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
                toolResult = JSON.stringify({ period, events, count: events.length });
              } catch (calErr) {
                console.error("[SENTINEL] Calendar events fetch error:", calErr);
                toolResult = JSON.stringify({ error: calErr instanceof Error ? calErr.message : "Failed to fetch calendar events", period });
              }
              toolsUsed.push("calendar");
            } else if (fnName === "create_calendar_event") {
              // Create on the first connected provider (Google preferred, then Outlook, then Apple)
              const eventInput = {
                title: String(args.title ?? "New Event"),
                startDateTime: String(args.startDateTime ?? ""),
                endDateTime: String(args.endDateTime ?? ""),
                description: args.description ? String(args.description) : undefined,
                location: args.location ? String(args.location) : undefined,
              };
              let event;
              if (calendarConnected) {
                event = await createGoogleEvent(userId, eventInput);
              } else if (outlookConnected) {
                event = await createOutlookEvent(eventInput);
              } else if (appleCalConnected) {
                event = await createAppleEvent(eventInput);
              } else {
                throw new Error("No calendar provider connected.");
              }
              toolResult = JSON.stringify({ success: true, event });
              toolsUsed.push("calendar");
            } else if (fnName === "read_email") {
              const summary = await summarizeInbox(userId, 5);
              toolResult = JSON.stringify({ summary });
              toolsUsed.push("email");
            } else if (fnName === "set_reminder") {
              const dueAt = new Date(String(args.dueAt ?? ""));
              if (isNaN(dueAt.getTime())) {
                toolResult = JSON.stringify({ error: "Invalid date/time for reminder." });
              } else {
                const id = await createReminder(userId, { text: String(args.text ?? ""), dueAt });
                toolResult = JSON.stringify({ success: true, id, dueAt: dueAt.toISOString() });
                toolsUsed.push("reminder");
              }
            } else if (fnName === "get_reminders") {
              const upcoming = await getUpcomingReminders(userId, 10);
              toolResult = JSON.stringify({ reminders: upcoming });
              toolsUsed.push("reminder");
            } else if (fnName === "get_news") {
              const category = String(args.category ?? "general");
              const maxResults = Math.min(10, Math.max(1, Number(args.maxResults ?? 5)));
              const news = await getTopHeadlines(category, maxResults);
              toolResult = JSON.stringify(news);
              toolsUsed.push("news");
            } else if (fnName === "get_stock_quotes") {
              const symbols = Array.isArray(args.symbols) ? (args.symbols as string[]) : [String(args.symbols ?? "SPY")];
              const quotes = await getStockQuotes(symbols);
              toolResult = JSON.stringify(quotes);
              toolsUsed.push("stocks");
            } else if (fnName === "search_stock_symbol") {
              const results = await searchStockSymbol(String(args.query ?? ""));
              toolResult = JSON.stringify(results);
              toolsUsed.push("stocks");
            } else if (fnName === "get_weather_forecast") {
              const days = Math.min(7, Math.max(1, Number(args.days ?? 5)));
              const forecast = await getWeatherForecast(String(args.location ?? ""), days);
              toolResult = JSON.stringify(forecast);
              toolsUsed.push("weather");
            } else if (fnName === "remember_fact") {
              await saveFact(userId, String(args.key ?? ""), String(args.value ?? ""));
              toolResult = JSON.stringify({ success: true, key: args.key, value: args.value });
              toolsUsed.push("memory");
            } else if (fnName === "recall_facts") {
              const facts = await loadFacts(userId);
              toolResult = JSON.stringify({ facts });
              toolsUsed.push("memory");
            } else if (fnName === "forget_fact") {
              await deleteFact(userId, String(args.key ?? ""));
              toolResult = JSON.stringify({ success: true, key: args.key });
              toolsUsed.push("memory");
            } else if (fnName === "morning_briefing") {
              // Fully customizable Iron Man-style morning briefing
              const morningCfg = await getMorningConfig(userId);
              const prefs = await loadUserPreferences(userId);
              const loc = morningCfg.weatherLocation ?? prefs.homeZipCode ?? "New York";
              const enabledSections = new Set(morningCfg.sections);
              const briefingParts: Record<string, unknown> = {
                greeting: morningCfg.customGreeting,
                currentTime: getCurrentTimeInfo(),
                config: { sections: morningCfg.sections, wakeTime: morningCfg.wakeTime },
              };

              // 1. Music — play configured track on Spotify
              if (enabledSections.has("spotify") && spotifyConnected) {
                try {
                  await playMusic(morningCfg.musicQuery ?? "Highway to Hell AC/DC");
                  briefingParts.music = { playing: true, query: morningCfg.musicQuery };
                } catch {
                  briefingParts.music = { playing: false, reason: "Spotify unavailable" };
                }
              } else if (enabledSections.has("spotify")) {
                briefingParts.music = { playing: false, reason: "Spotify not connected" };
              }

              // 2. Detailed weather via Open-Meteo
              if (enabledSections.has("weather") || enabledSections.has("alerts") || enabledSections.has("forecast")) {
                try {
                  const coords = await geocodeAddress(loc);
                  if (coords) {
                    if (enabledSections.has("weather")) {
                      const wx = await getWeatherData(coords.lat, coords.lng);
                      briefingParts.weather = { location: loc, ...wx };
                    }
                    if (enabledSections.has("alerts")) {
                      const alerts = await getNwsAlerts(coords.lat, coords.lng);
                      briefingParts.alerts = { location: loc, alerts, count: alerts.length };
                    }
                    if (enabledSections.has("air")) {
                      const aq = await getAirQuality(coords.lat, coords.lng);
                      briefingParts.airQuality = { location: loc, ...aq };
                    }
                  }
                } catch {
                  briefingParts.weather = null;
                }
              }

              // 3. Calendar events
              if (enabledSections.has("calendar") && calendarConnected) {
                try {
                  briefingParts.events = await getTodayEvents(userId);
                } catch {
                  briefingParts.events = [];
                }
              }

              // 4. Unread email count
              if (enabledSections.has("email") && calendarConnected) {
                try {
                  briefingParts.unreadEmails = await getUnreadCount(userId);
                } catch {
                  briefingParts.unreadEmails = 0;
                }
              }

              // 5. Upcoming reminders
              if (enabledSections.has("reminders")) {
                try {
                  briefingParts.reminders = await getUpcomingReminders(userId, 5);
                } catch {
                  briefingParts.reminders = [];
                }
              }

              // 6. News headlines
              if (enabledSections.has("news")) {
                try {
                  briefingParts.news = await getTopHeadlines("general", 5);
                } catch {
                  briefingParts.news = [];
                }
              }

              // 7. Stock quotes
              if (enabledSections.has("stocks")) {
                try {
                  briefingParts.stocks = await getStockQuotes(["SPY", "QQQ", "BTC-USD"]);
                } catch {
                  briefingParts.stocks = [];
                }
              }

              toolResult = JSON.stringify(briefingParts);
              toolsUsed.push("briefing", "weather", "calendar", "spotify");
            } else if (fnName === "snooze_reminder") {
              const reminderId = Number(args.id ?? 0);
              const minutes = Number(args.minutes ?? 5);
              await snoozeReminder(reminderId, minutes);
              toolResult = JSON.stringify({ success: true, id: reminderId, snoozedMinutes: minutes });
              toolsUsed.push("reminder");
            } else if (fnName === "get_lost_pet_cases") {
              const status = args.status ? String(args.status) : undefined;
              const limit = Math.min(50, Math.max(1, Number(args.limit ?? 10)));
              const cases = await getLostPetCases(limit);
              toolResult = JSON.stringify({ cases, count: cases.length });
              toolsUsed.push("discord");
            } else if (fnName === "search_lost_pet_cases") {
              const query = String(args.query ?? "");
              const limit = Math.min(50, Math.max(1, Number(args.limit ?? 10)));
              const results = await searchLostPetCases(query, limit);
              toolResult = JSON.stringify({ results, count: results.length });
              toolsUsed.push("discord");
            } else if (fnName === "spotify_play") {
              const result = await playMusic(args.query ? String(args.query) : undefined);
              toolResult = JSON.stringify({ result });
              toolsUsed.push("spotify");
            } else if (fnName === "spotify_pause") {
              const result = await pauseMusic();
              toolResult = JSON.stringify({ result });
              toolsUsed.push("spotify");
            } else if (fnName === "spotify_skip") {
              const result = await skipTrack();
              toolResult = JSON.stringify({ result });
              toolsUsed.push("spotify");
            } else if (fnName === "spotify_previous") {
              const result = await previousTrack();
              toolResult = JSON.stringify({ result });
              toolsUsed.push("spotify");
            } else if (fnName === "spotify_volume") {
              const result = await setVolume(Number(args.percent ?? 50));
              toolResult = JSON.stringify({ result });
              toolsUsed.push("spotify");
            } else if (fnName === "get_current_track") {
              const result = await getCurrentTrack();
              toolResult = JSON.stringify({ result });
              toolsUsed.push("spotify");
            } else if (fnName === "spotify_search") {
              const type = (args.type as "track" | "artist" | "playlist") ?? "track";
              const result = await searchSpotify(String(args.query ?? ""), type);
              toolResult = JSON.stringify({ result });
              toolsUsed.push("spotify");
            } else if (fnName === "get_github_repos") {
              const limit = Math.min(50, Math.max(1, Number(args.limit ?? 10)));
              const repos = await getRepos(userId, limit);
              toolResult = JSON.stringify({ repos, count: repos.length });
              toolsUsed.push("github");
            } else if (fnName === "get_github_prs") {
              const prs = await getPullRequests(userId, String(args.owner ?? ""), String(args.repo ?? ""));
              toolResult = JSON.stringify({ prs, count: prs.length });
              toolsUsed.push("github");
            } else if (fnName === "get_github_issues") {
              const state = (args.state as "open" | "closed" | "all") ?? "open";
              const issues = await getIssues(userId, String(args.owner ?? ""), String(args.repo ?? ""), state);
              toolResult = JSON.stringify({ issues, count: issues.length });
              toolsUsed.push("github");
            } else if (fnName === "get_github_notifications") {
              const notifs = await getNotifications(userId, false);
              toolResult = JSON.stringify({ notifications: notifs, count: notifs.length });
              toolsUsed.push("github");
            } else if (fnName === "get_discord_messages") {
              const limit = Math.min(50, Math.max(1, Number(args.limit ?? 20)));
              const msgs = await getDiscordMessages(userId, String(args.channelId ?? ""), limit);
              toolResult = JSON.stringify({ messages: msgs, count: msgs.length });
              toolsUsed.push("discord");
            } else if (fnName === "send_discord_message") {
              const msg = await sendDiscordMessage(userId, String(args.channelId ?? ""), String(args.content ?? ""));
              toolResult = JSON.stringify({ success: true, message: msg });
              toolsUsed.push("discord");
            } else if (fnName === "get_slack_messages") {
              const limit = Math.min(50, Math.max(1, Number(args.limit ?? 20)));
              const msgs = await getSlackMessages(userId, String(args.channelId ?? ""), limit);
              toolResult = JSON.stringify({ messages: msgs, count: msgs.length });
              toolsUsed.push("slack");
            } else if (fnName === "send_slack_message") {
              const result = await sendSlackMessage(userId, String(args.channelId ?? ""), String(args.text ?? ""));
              toolResult = JSON.stringify({ success: true, ts: result.ts });
              toolsUsed.push("slack");
            } else if (fnName === "get_ha_devices") {
              const domain = args.domain ? String(args.domain) : undefined;
              const states = domain ? await getStatesByDomain(userId, domain as import("./homeAssistant").HaDomain) : await getStates(userId);
              toolResult = JSON.stringify({ devices: states, count: states.length });
              toolsUsed.push("home_assistant");
            } else if (fnName === "toggle_ha_device") {
              const result = await toggleEntity(userId, String(args.entityId ?? ""));
              toolResult = JSON.stringify({ success: true, result });
              toolsUsed.push("home_assistant");
            } else if (fnName === "set_ha_brightness") {
              const brightness = Math.round(Number(args.brightness ?? 50) * 2.55);
              const result = await turnOn(userId, String(args.entityId ?? ""), { brightness });
              toolResult = JSON.stringify({ success: true, result });
              toolsUsed.push("home_assistant");
            } else if (fnName === "set_ha_temperature") {
              const result = await callService(userId, "climate", "set_temperature", { entity_id: String(args.entityId ?? ""), temperature: Number(args.temperature ?? 70) });
              toolResult = JSON.stringify({ success: true, result });
              toolsUsed.push("home_assistant");
            } else if (fnName === "get_weather_detail") {
              // Geocode then call Open-Meteo for detailed current weather
              const loc = String(args.location ?? "");
              const coords = await geocodeAddress(loc);
              if (!coords) {
                toolResult = JSON.stringify({ error: `Could not geocode location: ${loc}` });
              } else {
                const data = await getWeatherData(coords.lat, coords.lng);
                toolResult = JSON.stringify({ location: loc, coords: { lat: coords.lat, lng: coords.lng }, ...data });
                toolsUsed.push("weather");
              }
            } else if (fnName === "get_air_quality") {
              const loc = String(args.location ?? "");
              const coords = await geocodeAddress(loc);
              if (!coords) {
                toolResult = JSON.stringify({ error: `Could not geocode location: ${loc}` });
              } else {
                const aq = await getAirQuality(coords.lat, coords.lng);
                toolResult = JSON.stringify({ location: loc, ...aq });
                toolsUsed.push("weather");
              }
            } else if (fnName === "get_nws_alerts") {
              const loc = String(args.location ?? "");
              const coords = await geocodeAddress(loc);
              if (!coords) {
                toolResult = JSON.stringify({ error: `Could not geocode location: ${loc}` });
              } else {
                const alerts = await getNwsAlerts(coords.lat, coords.lng);
                toolResult = JSON.stringify({ location: loc, alerts, count: alerts.length });
                toolsUsed.push("alerts");
              }
            } else if (fnName === "get_directions") {
              const origin = String(args.origin ?? "");
              const destination = String(args.destination ?? "");
              const rawProfile = (args.profile as string) ?? "driving";
              const profileMap: Record<string, "driving" | "walking" | "cycling"> = {
                "driving-car": "driving", "foot-walking": "walking", "cycling-regular": "cycling",
                "driving": "driving", "walking": "walking", "cycling": "cycling",
              };
              const profile = profileMap[rawProfile] ?? "driving";
              if (!origin || !destination) {
                toolResult = JSON.stringify({ error: "Origin and destination are required." });
              } else {
                const [originCoords, destCoords] = await Promise.all([geocodeAddress(origin), geocodeAddress(destination)]);
                if (!originCoords || !destCoords) {
                  toolResult = JSON.stringify({ error: "Could not geocode one or both addresses." });
                } else {
                  const routeResult = await getDirections(
                    [{ lat: originCoords.lat, lng: originCoords.lng }, { lat: destCoords.lat, lng: destCoords.lng }],
                    profile
                  );
                  const firstRoute = routeResult.routes[0];
                  const steps = firstRoute?.legs[0]?.steps?.slice(0, 10).map((s) => ({
                    instruction: buildInstruction(s),
                    distance: formatDistance(s.distance),
                    duration: formatDuration(s.duration),
                  })) ?? [];
                  // Include waypoints for map pre-fill
                  const routePayload = {
                    origin, destination, profile,
                    originCoords: { lat: originCoords.lat, lng: originCoords.lng },
                    destCoords: { lat: destCoords.lat, lng: destCoords.lng },
                    totalDistance: formatDistance(firstRoute?.distance ?? 0),
                    totalDuration: formatDuration(firstRoute?.duration ?? 0),
                    steps,
                  };
                  toolResult = JSON.stringify(routePayload);
                  // Auto-open maps window and pass route data
                  toolsUsed.push("directions");
                  toolsUsed.push(`open_window:maps:${JSON.stringify({ origin, destination, profile, originCoords: { lat: originCoords.lat, lng: originCoords.lng }, destCoords: { lat: destCoords.lat, lng: destCoords.lng } })}`);
                }
              }
            } else if (fnName === "open_window") {
              const windowType = String(args.windowType ?? "");
              toolResult = JSON.stringify({ action: "open_window", windowType, success: true });
              toolsUsed.push("open_window:" + windowType);
            } else {
              toolResult = JSON.stringify({ error: "Unknown tool" });
            }
          } catch (err) {
            toolResult = JSON.stringify({ error: err instanceof Error ? err.message : "Tool execution failed" });
          }

          toolMessages.push({
            role: "tool",
            tool_call_id: call.id,
            content: toolResult,
          });
        }

        let finalResult;
        try {
          const finalMessages = [...messages, ...toolMessages];
          console.log("[SENTINEL] Final LLM call — message count:", finalMessages.length, "roles:", finalMessages.map((m: { role: string }) => m.role).join(","));
          // Truncate tool results to prevent token limit errors on the synthesis call
          const truncatedMessages = finalMessages.map((m: Message & { tool_calls?: unknown }) => {
            if (m.role === "tool" && typeof m.content === "string" && m.content.length > 2000) {
              return { ...m, content: m.content.slice(0, 2000) + "\n[...truncated for brevity]" };
            }
            return m;
          }) as (Message & { tool_calls?: unknown })[];
          finalResult = await invokeLLM({
            model: "gpt-4o-mini",
            messages: truncatedMessages as Message[],
            maxTokens: 2048,
          });
        } catch (err) {
          console.error("[SENTINEL] Final LLM call failed:", err);
          return {
            reply: "I encountered a difficulty processing the tool results. My apologies, sir. Please try again.",
            toolsUsed,
          };
        }

        if (!finalResult?.choices?.length) {
          console.error("[SENTINEL] Final LLM returned no choices. Full response:", JSON.stringify(finalResult).slice(0, 800));
          return {
            reply: "I received an incomplete response from my neural network. My apologies, sir. Please try again.",
            toolsUsed,
          };
        }

        const finalChoice = finalResult.choices[0];
        const reply =
          typeof finalChoice?.message?.content === "string" && finalChoice.message.content.trim()
            ? finalChoice.message.content
            : "I appear to be experiencing a momentary lapse in processing. My apologies, sir.";

        return { reply, toolsUsed };
      }),

    // Morning Routine Config endpoints
    getMorningConfig: protectedProcedure
      .query(async ({ ctx }) => {
        const config = await getMorningConfig(ctx.user.id);
        return { config, allSections: ALL_SECTIONS };
      }),

    saveMorningConfig: protectedProcedure
      .input(z.object({
        sections: z.array(z.string()).optional(),
        wakeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        musicQuery: z.string().max(200).optional(),
        customGreeting: z.string().max(200).optional(),
        readAloud: z.boolean().optional(),
        weatherLocation: z.string().max(200).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const saved = await saveMorningConfig(ctx.user.id, input);
        return { success: true, config: saved };
      }),

    // Standalone status endpoints
    weather: publicProcedure
      .input(z.object({ location: z.string().min(1).max(200) }))
      .query(async ({ input }) => getWeather(input.location)),

    search: publicProcedure
      .input(z.object({ query: z.string().min(1).max(500) }))
      .query(async ({ input }) => webSearch(input.query)),

    currentTime: publicProcedure
      .query(() => getCurrentTimeInfo()),

    calendarStatus: protectedProcedure
      .query(async ({ ctx }) => ({ connected: await isCalendarConnected(ctx.user.id) })),

    spotifyStatus: protectedProcedure
      .query(() => ({ connected: isSpotifyConnected() })),

    spotifyNowPlaying: protectedProcedure
      .query(async () => {
        if (!isSpotifyConnected()) return { playing: false, track: null };
        try {
          const track = await getCurrentTrackData();
          return { playing: track !== null, track };
        } catch {
          return { playing: false, track: null };
        }
      }),

    calendarEvents: protectedProcedure
      .input(z.object({ period: z.enum(["today", "week"]) }))
      .query(async ({ input, ctx }) => {
        if (!await isCalendarConnected(ctx.user.id)) throw new Error("Google Calendar is not connected.");
        return input.period === "today" ? getTodayEvents(ctx.user.id) : getUpcomingEvents(ctx.user.id, 15, 7);
      }),

    // ── Outlook Calendar procedures ──────────────────────────────────────────

    outlookStatus: protectedProcedure
      .query(() => ({ connected: isOutlookConnected() })),

    outlookEvents: protectedProcedure
      .input(z.object({ period: z.enum(["today", "week"]) }))
      .query(async ({ input }) => {
        if (!isOutlookConnected()) throw new Error("Outlook Calendar is not connected.");
        if (input.period === "today") return getOutlookTodayEvents();
        const now = new Date();
        const start = now.toISOString();
        const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        return getOutlookEvents(start, end);
      }),

    createOutlookEvent: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        startDateTime: z.string(),
        endDateTime: z.string(),
        location: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        if (!isOutlookConnected()) throw new Error("Outlook Calendar is not connected.");
        return createOutlookEvent(input);
      }),

    disconnectOutlook: protectedProcedure
      .mutation(async ({ ctx }) => {
        const { saveOutlookTokens } = await import("./outlookCalendar");
        const { deleteMicrosoftTokens } = await import("./db");
        saveOutlookTokens(null);
        await deleteMicrosoftTokens(ctx.user.id);
        return { success: true };
      }),

    // ── Apple Calendar procedures ─────────────────────────────────────────────

    appleCalendarStatus: protectedProcedure
      .query(() => ({ connected: isAppleConnected() })),

    appleCalendarEvents: protectedProcedure
      .input(z.object({ period: z.enum(["today", "week"]) }))
      .query(async ({ input }) => {
        if (!isAppleConnected()) throw new Error("Apple Calendar is not connected.");
        if (input.period === "today") return getAppleTodayEvents();
        const now = new Date();
        const start = now.toISOString();
        const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        return getAppleEvents(start, end);
      }),

    createAppleEvent: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        startDateTime: z.string(),
        endDateTime: z.string(),
        location: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        if (!isAppleConnected()) throw new Error("Apple Calendar is not connected.");
        return createAppleEvent(input);
      }),

    connectAppleCalendar: protectedProcedure
      .input(z.object({
        appleId: z.string().email(),
        appPassword: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const config = { appleId: input.appleId, appPassword: input.appPassword };
        saveAppleConfig(config);
        await saveAppleCalDavConfig(ctx.user.id, config);
        return { success: true };
      }),

    disconnectAppleCalendar: protectedProcedure
      .mutation(async ({ ctx }) => {
        saveAppleConfig(null);
        await deleteAppleCalDavConfig(ctx.user.id);
        return { success: true };
      }),

    // ── Unified calendar events (all connected providers) ────────────────────

    allCalendarEvents: protectedProcedure
      .input(z.object({ period: z.enum(["today", "week"]) }))
      .query(async ({ input, ctx }) => {
        const results: Array<{
          id: string; title: string; start: string; end: string;
          location?: string; description?: string; isAllDay: boolean;
          source: "google" | "outlook" | "apple";
        }> = [];
        const now = new Date();
        const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const [googleEvents, outlookEvents, appleEvents] = await Promise.allSettled([
          (await isCalendarConnected(ctx.user.id))
            ? (input.period === "today" ? getTodayEvents(ctx.user.id) : getUpcomingEvents(ctx.user.id, 15, 7))
            : Promise.resolve([]),
          isOutlookConnected()
            ? (input.period === "today" ? getOutlookTodayEvents() : getOutlookEvents(now.toISOString(), weekEnd))
            : Promise.resolve([]),
          isAppleConnected()
            ? (input.period === "today" ? getAppleTodayEvents() : getAppleEvents(now.toISOString(), weekEnd))
            : Promise.resolve([]),
        ]);

        if (googleEvents.status === "fulfilled") {
          for (const e of googleEvents.value) {
            results.push({ ...e, source: "google" as const });
          }
        }
        if (outlookEvents.status === "fulfilled") results.push(...outlookEvents.value);
        if (appleEvents.status === "fulfilled") results.push(...appleEvents.value);

        results.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        return results;
      }),

    // Reminder endpoints
    createReminder: protectedProcedure
      .input(z.object({ text: z.string().min(1), dueAt: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const dueAt = new Date(input.dueAt);
        if (isNaN(dueAt.getTime())) throw new Error("Invalid date/time");
        const id = await createReminder(ctx.user.id, { text: input.text, dueAt });
        return { success: true, id };
      }),

    getReminders: protectedProcedure
      .query(async ({ ctx }) => getUpcomingReminders(ctx.user.id, 20)),

    deleteReminder: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteReminder(input.id);
        return { success: true };
      }),

    snoozeReminder: protectedProcedure
      .input(z.object({ id: z.number(), minutes: z.number().min(1).max(1440) }))
      .mutation(async ({ input }) => {
        await snoozeReminder(input.id, input.minutes);
        return { success: true };
      }),

    gmailUnreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        if (!await isCalendarConnected(ctx.user.id)) return { count: 0 };
        try {
          const count = await getUnreadCount(ctx.user.id);
          return { count };
        } catch {
          return { count: 0 };
        }
      }),

    spotifyPlay: protectedProcedure
      .mutation(async () => {
        if (!isSpotifyConnected()) return { success: false };
        try { await playMusic(); return { success: true }; } catch { return { success: false }; }
      }),

    spotifyPause: protectedProcedure
      .mutation(async () => {
        if (!isSpotifyConnected()) return { success: false };
        try { await pauseMusic(); return { success: true }; } catch { return { success: false }; }
      }),

    spotifySkip: protectedProcedure
      .mutation(async () => {
        if (!isSpotifyConnected()) return { success: false };
        try { await skipTrack(); return { success: true }; } catch { return { success: false }; }
      }),

    spotifyPrevious: protectedProcedure
      .mutation(async () => {
        if (!isSpotifyConnected()) return { success: false };
        try { await previousTrack(); return { success: true }; } catch { return { success: false }; }
      }),
    spotifyVolume: protectedProcedure
      .input(z.object({ volume: z.number().min(0).max(100) }))
      .mutation(async ({ input }) => {
        if (!isSpotifyConnected()) return { success: false };
        try { await setVolume(input.volume); return { success: true }; } catch { return { success: false }; }
      }),

    // User preferences endpoints
    getPreferences: protectedProcedure
      .query(async ({ ctx }) => {
        const prefs = await loadUserPreferences(ctx.user.id);
        return {
          homeZipCode: prefs.homeZipCode ?? null,
          preferredVoiceKey: prefs.preferredVoiceKey ?? null,
          preferredLayout: prefs.preferredLayout ?? null,
          speechRate: prefs.speechRate ? parseFloat(prefs.speechRate) : null,
          reverbIntensity: prefs.reverbIntensity ? parseFloat(prefs.reverbIntensity) : null,
        };
      }),

    savePreferences: protectedProcedure
      .input(z.object({
        homeZipCode: z.string().max(20).nullable().optional(),
        preferredVoiceKey: z.string().max(64).nullable().optional(),
        preferredLayout: z.string().max(32).nullable().optional(),
        speechRate: z.number().min(0.5).max(2.0).nullable().optional(),
        reverbIntensity: z.number().min(0).max(1).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await saveUserPreferences(ctx.user.id, {
          homeZipCode: input.homeZipCode ?? undefined,
          preferredVoiceKey: input.preferredVoiceKey ?? undefined,
          preferredLayout: input.preferredLayout ?? undefined,
          speechRate: input.speechRate != null ? String(input.speechRate) : undefined,
          reverbIntensity: input.reverbIntensity != null ? String(input.reverbIntensity) : undefined,
        });
        return { success: true };
      }),

    // Morning briefing endpoint
    morningBriefing: protectedProcedure
      .query(async ({ ctx }) => {
        const userId = ctx.user.id;
        const calendarConnected = await isCalendarConnected(userId);
        const prefs = await loadUserPreferences(userId);
        const location = prefs.homeZipCode ?? "New York";

        const [weather, events, unreadCount] = await Promise.allSettled([
          getWeather(location).catch(() => null),
          calendarConnected ? getTodayEvents(userId).catch(() => []) : Promise.resolve([]),
          calendarConnected ? getUnreadCount(userId).catch(() => 0) : Promise.resolve(0),
        ]);

        return {
          weather: weather.status === "fulfilled" ? weather.value : null,
          events: events.status === "fulfilled" ? events.value : [],
          unreadCount: unreadCount.status === "fulfilled" ? unreadCount.value : 0,
          timestamp: Date.now(),
        };
      }),

    // News endpoint
    getNews: publicProcedure
      .input(z.object({
        category: z.enum(["general", "technology", "business", "sports", "science", "health", "entertainment", "world"]).optional().default("general"),
        maxResults: z.number().min(1).max(20).optional().default(10),
      }))
      .query(async ({ input }) => getTopHeadlines(input.category, input.maxResults)),

    // Stocks endpoint
    getStocks: publicProcedure
      .input(z.object({ symbols: z.array(z.string().min(1).max(10)).min(1).max(15) }))
      .query(async ({ input }) => getStockQuotes(input.symbols)),

    // Stock symbol search
    searchStock: publicProcedure
      .input(z.object({ query: z.string().min(1).max(50) }))
      .query(async ({ input }) => {
        const results = await searchStockSymbol(input.query);
        return { results };
      }),

    // Weather forecast endpoint
    getWeatherForecast: publicProcedure
      .input(z.object({ location: z.string().min(1).max(200), days: z.number().min(1).max(7).optional().default(5) }))
      .query(async ({ input }) => getWeatherForecast(input.location, input.days)),

    // Open-Meteo full weather data
    getOpenMeteoWeather: publicProcedure
      .input(z.object({ lat: z.number(), lon: z.number() }))
      .query(async ({ input }) => getWeatherData(input.lat, input.lon)),

    // Open-Meteo air quality
    getAirQuality: publicProcedure
      .input(z.object({ lat: z.number(), lon: z.number() }))
      .query(async ({ input }) => getAirQuality(input.lat, input.lon)),

    // NWS alerts (US only)
    getNwsAlerts: publicProcedure
      .input(z.object({ lat: z.number(), lon: z.number() }))
      .query(async ({ input }) => {
        const alerts = await getNwsAlerts(input.lat, input.lon);
        return alerts.map((a) => ({
          ...a,
          severityColor: alertSeverityColor(a.severity),
          icon: alertIcon(a.event),
        }));
      }),

    // NWS point info (city/state name, US only)
    getNwsPoint: publicProcedure
      .input(z.object({ lat: z.number(), lon: z.number() }))
      .query(async ({ input }) => getNwsPoint(input.lat, input.lon)),

    // Memory / facts endpoints
    getFacts: protectedProcedure
      .query(async ({ ctx }) => loadFacts(ctx.user.id)),

    saveFact: protectedProcedure
      .input(z.object({ key: z.string().min(1).max(64), value: z.string().min(1).max(500) }))
      .mutation(async ({ input, ctx }) => {
        await saveFact(ctx.user.id, input.key, input.value);
        return { success: true };
      }),

    deleteFact: protectedProcedure
      .input(z.object({ key: z.string().min(1).max(64) }))
      .mutation(async ({ input, ctx }) => {
        await deleteFact(ctx.user.id, input.key);
        return { success: true };
      }),

    // Persistent memory endpoints
    getHistory: protectedProcedure
      .input(z.object({ sessionId: z.string().min(1).max(64) }))
      .query(async ({ input, ctx }) => {
        const messages = await getSessionMessages(ctx.user.id, input.sessionId, 50);
        return messages.map(m => ({
          role: m.role,
          content: m.content,
          toolsUsed: m.toolsUsed ? (JSON.parse(m.toolsUsed) as string[]) : [],
          createdAt: m.createdAt,
        }));
      }),

    saveMessage: protectedProcedure
      .input(z.object({
        sessionId: z.string().min(1).max(64),
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
        toolsUsed: z.array(z.string()).optional().default([]),
      }))
      .mutation(async ({ input, ctx }) => {
        await saveMessage({
          userId: ctx.user.id,
          sessionId: input.sessionId,
          role: input.role,
          content: input.content,
          toolsUsed: input.toolsUsed.length > 0 ? JSON.stringify(input.toolsUsed) : null,
        });
        return { success: true };
      }),

    clearHistory: protectedProcedure
      .input(z.object({ sessionId: z.string().min(1).max(64) }))
      .mutation(async ({ input, ctx }) => {
        await clearSessionMessages(ctx.user.id, input.sessionId);
        return { success: true };
      }),

    getLostPetCases: publicProcedure
      .input(z.object({
        status: z.enum(["unassigned", "in_progress", "resolved"]).optional(),
        limit: z.number().min(1).max(50).optional().default(10),
      }))
      .query(async ({ input }) => getLostPetCases(input.limit)),

    searchLostPetCases: publicProcedure
      .input(z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).optional().default(10),
      }))
      .query(async ({ input }) => searchLostPetCases(input.query, input.limit)),
  }),

  // ── GitHub ──────────────────────────────────────────────────────────────────
  github: router({
    status: protectedProcedure.query(async ({ ctx }) => ({ connected: await isGithubConnectedForUser(ctx.user.id) })),

    connect: protectedProcedure
      .input(z.object({ token: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        await saveGithubToken(ctx.user.id, input.token);
        return { success: true };
      }),

    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      await disconnectGithub(ctx.user.id);
      return { success: true };
    }),

    me: protectedProcedure.query(async ({ ctx }) => {
      if (!await isGithubConnectedForUser(ctx.user.id)) return null;
      try { return await getAuthenticatedUser(ctx.user.id); } catch { return null; }
    }),

    repos: protectedProcedure
      .input(z.object({ perPage: z.number().min(1).max(100).optional().default(20) }))
      .query(async ({ input, ctx }) => {
        if (!await isGithubConnectedForUser(ctx.user.id)) throw new Error("GitHub not connected");
        return getRepos(ctx.user.id, input.perPage);
      }),

    pullRequests: protectedProcedure
      .input(z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        state: z.enum(["open", "closed", "all"]).optional().default("open"),
      }))
      .query(async ({ input, ctx }) => {
        if (!await isGithubConnectedForUser(ctx.user.id)) throw new Error("GitHub not connected");
        return getPullRequests(ctx.user.id, input.owner, input.repo, input.state);
      }),

    issues: protectedProcedure
      .input(z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        state: z.enum(["open", "closed", "all"]).optional().default("open"),
      }))
      .query(async ({ input, ctx }) => {
        if (!await isGithubConnectedForUser(ctx.user.id)) throw new Error("GitHub not connected");
        return getIssues(ctx.user.id, input.owner, input.repo, input.state);
      }),

    notifications: protectedProcedure
      .input(z.object({ all: z.boolean().optional().default(false) }))
      .query(async ({ input, ctx }) => {
        if (!await isGithubConnectedForUser(ctx.user.id)) throw new Error("GitHub not connected");
        return getNotifications(ctx.user.id, input.all);
      }),

    markNotificationRead: protectedProcedure
      .input(z.object({ id: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (!await isGithubConnectedForUser(ctx.user.id)) throw new Error("GitHub not connected");
        await markNotificationRead(ctx.user.id, input.id);
        return { success: true };
      }),
  }),

  // ── Slack ───────────────────────────────────────────────────────────────────
  slack: router({
    status: protectedProcedure.query(async ({ ctx }) => ({ connected: await isSlackConnectedForUser(ctx.user.id) })),

    connect: protectedProcedure
      .input(z.object({ token: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        await saveSlackToken(ctx.user.id, input.token);
        return { success: true };
      }),

    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      await disconnectSlack(ctx.user.id);
      return { success: true };
    }),

    workspace: protectedProcedure.query(async ({ ctx }) => {
      if (!await isSlackConnectedForUser(ctx.user.id)) return null;
      try { return await getWorkspaceInfo(ctx.user.id); } catch { return null; }
    }),

    channels: protectedProcedure.query(async ({ ctx }) => {
      if (!await isSlackConnectedForUser(ctx.user.id)) throw new Error("Slack not connected");
      return getSlackChannels(ctx.user.id);
    }),

    messages: protectedProcedure
      .input(z.object({ channelId: z.string().min(1), limit: z.number().min(1).max(100).optional().default(20) }))
      .query(async ({ input, ctx }) => {
        if (!await isSlackConnectedForUser(ctx.user.id)) throw new Error("Slack not connected");
        return getSlackMessages(ctx.user.id, input.channelId, input.limit);
      }),

    sendMessage: protectedProcedure
      .input(z.object({ channelId: z.string().min(1), text: z.string().min(1).max(4000) }))
      .mutation(async ({ input, ctx }) => {
        if (!await isSlackConnectedForUser(ctx.user.id)) throw new Error("Slack not connected");
        return sendSlackMessage(ctx.user.id, input.channelId, input.text);
      }),
  }),

  // ── Discord Bot ─────────────────────────────────────────────────────────────
  discord: router({
    status: protectedProcedure.query(() => ({ connected: isDiscordConnected() })),

    connect: protectedProcedure
      .input(z.object({ token: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        await saveDiscordToken(ctx.user.id, input.token);
        return { success: true };
      }),

    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      await disconnectDiscord(ctx.user.id);
      return { success: true };
    }),

    botUser: protectedProcedure.query(async ({ ctx }) => {
      if (!await isDiscordConnectedForUser(ctx.user.id)) return null;
      try { return await getDiscordBotUser(ctx.user.id); } catch { return null; }
    }),

    guilds: protectedProcedure.query(async ({ ctx }) => {
      if (!await isDiscordConnectedForUser(ctx.user.id)) throw new Error("Discord not connected");
      return getGuilds(ctx.user.id);
    }),

    channels: protectedProcedure
      .input(z.object({ guildId: z.string().min(1) }))
      .query(async ({ input, ctx }) => {
        if (!await isDiscordConnectedForUser(ctx.user.id)) throw new Error("Discord not connected");
        return getGuildChannels(ctx.user.id, input.guildId);
      }),

    messages: protectedProcedure
      .input(z.object({ channelId: z.string().min(1), limit: z.number().min(1).max(100).optional().default(20) }))
      .query(async ({ input, ctx }) => {
        if (!await isDiscordConnectedForUser(ctx.user.id)) throw new Error("Discord not connected");
        return getDiscordMessages(ctx.user.id, input.channelId, input.limit);
      }),

    sendMessage: protectedProcedure
      .input(z.object({ channelId: z.string().min(1), content: z.string().min(1).max(2000) }))
      .mutation(async ({ input, ctx }) => {
        if (!await isDiscordConnectedForUser(ctx.user.id)) throw new Error("Discord not connected");
        return sendDiscordMessage(ctx.user.id, input.channelId, input.content);
      }),
  }),

  // ── Home Assistant ──────────────────────────────────────────────────────────
  maps: router({
    isConfigured: publicProcedure.query(() => ({
      simpleRouting: isSimpleRoutingConfigured(),
    })),

    geocode: publicProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        const result = await geocodeAddress(input.query);
        return result;
      }),

    getDirections: publicProcedure
      .input(
        z.object({
          origin: z.object({ lat: z.number(), lng: z.number() }),
          destination: z.object({ lat: z.number(), lng: z.number() }),
          profile: z.enum(["driving", "walking", "cycling"]).default("driving"),
        })
      )
      .query(async ({ input }) => {
        if (!isSimpleRoutingConfigured()) {
          throw new Error("Simple Routing API key not configured");
        }
        const result = await getDirections(
          [input.origin, input.destination],
          input.profile
        );
        if (result.code !== "Ok" || !result.routes.length) {
          throw new Error("No route found");
        }
        const route = result.routes[0];
        const steps = route.legs.flatMap((leg) =>
          leg.steps.map((step) => ({
            instruction: buildInstruction(step),
            distance: formatDistance(step.distance),
            duration: formatDuration(step.duration),
            maneuverType: step.maneuver.type,
            maneuverModifier: step.maneuver.modifier,
          }))
        );
        return {
          totalDistance: formatDistance(route.distance),
          totalDuration: formatDuration(route.duration),
          distanceMeters: route.distance,
          durationSeconds: route.duration,
          geometry: route.geometry,
          steps,
        };
      }),
  }),

  homeAssistant: router({
    getStatus: protectedProcedure.query(async ({ ctx }) => ({ connected: await isHomeAssistantConnectedForUser(ctx.user.id) })),

    connect: protectedProcedure
      .input(z.object({ url: z.string().url(), token: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        await saveHomeAssistantConfig(ctx.user.id, input.url, input.token);
        return { success: true };
      }),

    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      await disconnectHomeAssistant(ctx.user.id);
      return { success: true };
    }),

    ping: protectedProcedure.query(async ({ ctx }) => {
      if (!await isHomeAssistantConnectedForUser(ctx.user.id)) return { ok: false };
      try {
        await getHaStatus(ctx.user.id);
        return { ok: true };
      } catch {
        return { ok: false };
      }
    }),

    states: protectedProcedure.query(async ({ ctx }) => {
      if (!await isHomeAssistantConnectedForUser(ctx.user.id)) throw new Error("Home Assistant not connected");
      const states = await getStates(ctx.user.id);
      return groupStatesByDomain(states);
    }),

    statesByDomain: protectedProcedure
      .input(z.object({ domain: z.string().min(1) }))
      .query(async ({ input, ctx }) => {
        if (!await isHomeAssistantConnectedForUser(ctx.user.id)) throw new Error("Home Assistant not connected");
        return getStatesByDomain(ctx.user.id, input.domain);
      }),

    toggle: protectedProcedure
      .input(z.object({ entityId: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (!await isHomeAssistantConnectedForUser(ctx.user.id)) throw new Error("Home Assistant not connected");
        await toggleEntity(ctx.user.id, input.entityId);
        return { success: true };
      }),

    turnOn: protectedProcedure
      .input(z.object({ entityId: z.string().min(1), extra: z.record(z.string(), z.unknown()).optional().default({}) }))
      .mutation(async ({ input, ctx }) => {
        if (!await isHomeAssistantConnectedForUser(ctx.user.id)) throw new Error("Home Assistant not connected");
        await turnOn(ctx.user.id, input.entityId, input.extra as Record<string, unknown>);
        return { success: true };
      }),

    turnOff: protectedProcedure
      .input(z.object({ entityId: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (!await isHomeAssistantConnectedForUser(ctx.user.id)) throw new Error("Home Assistant not connected");
        await turnOff(ctx.user.id, input.entityId);
        return { success: true };
      }),

    setBrightness: protectedProcedure
      .input(z.object({ entityId: z.string().min(1), brightness: z.number().min(0).max(100) }))
      .mutation(async ({ input, ctx }) => {
        if (!await isHomeAssistantConnectedForUser(ctx.user.id)) throw new Error("Home Assistant not connected");
        await setLightBrightness(ctx.user.id, input.entityId, input.brightness);
        return { success: true };
      }),

    setTemperature: protectedProcedure
      .input(z.object({ entityId: z.string().min(1), temperature: z.number().min(40).max(100) }))
      .mutation(async ({ input, ctx }) => {
        if (!await isHomeAssistantConnectedForUser(ctx.user.id)) throw new Error("Home Assistant not connected");
        await setClimateTemperature(ctx.user.id, input.entityId, input.temperature);
        return { success: true };
      }),

    callService: protectedProcedure
      .input(z.object({
        domain: z.string().min(1),
        service: z.string().min(1),
        data: z.record(z.string(), z.unknown()).optional().default({}),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!await isHomeAssistantConnectedForUser(ctx.user.id)) throw new Error("Home Assistant not connected");
        await callService(ctx.user.id, input.domain, input.service, input.data as Record<string, unknown>);
        return { success: true };
      }),
  }),

  // ── Billing (Stripe) ─────────────────────────────────────────────────────
  billing: router({
    /** Get the current user's subscription status and plan info. */
    status: protectedProcedure.query(async ({ ctx }) => {
      const sub = await getSubscriptionStatus(ctx.user.id);
      return {
        ...sub,
        plans: PLANS,
      };
    }),

    /** Create a Stripe Checkout session for the Pro plan upgrade. */
    createCheckout: protectedProcedure.mutation(async ({ ctx }) => {
      const origin = (ctx.req as { headers: { origin?: string; host?: string; 'x-forwarded-proto'?: string } }).headers.origin
        ?? `${(ctx.req.headers['x-forwarded-proto'] ?? 'https')}://${ctx.req.headers.host}`
        ?? "http://localhost:3000";
      const url = await createCheckoutSession(
        ctx.user.id,
        ctx.user.email ?? "",
        ctx.user.name,
        origin
      );
      return { url };
    }),

    /** Create a Stripe Customer Portal session to manage subscription. */
    createPortal: protectedProcedure.mutation(async ({ ctx }) => {
      const origin = (ctx.req as { headers: { origin?: string; host?: string; 'x-forwarded-proto'?: string } }).headers.origin
        ?? `${(ctx.req.headers['x-forwarded-proto'] ?? 'https')}://${ctx.req.headers.host}`
        ?? "http://localhost:3000";
      const url = await createPortalSession(ctx.user.id, origin);
      return { url };
    }),
  }),
});

export type AppRouter = typeof appRouter;
