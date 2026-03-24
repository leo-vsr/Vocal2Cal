import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { parseEventsFromText, transcribeAudioToText } from "../lib/gemini";
import { getValidAccessToken, getCalendarClient, ReauthRequiredError } from "../lib/google";

const router = Router();

// Limite globale d'appels IA par jour (tous utilisateurs confondus)
const DAILY_LIMIT = parseInt(process.env.DAILY_AI_LIMIT || "50", 10);
const INCLUDE_DEV_HISTORY_MOCKS = process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_HISTORY_MOCKS !== "false";

interface DemoEvent {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
  htmlLink?: string;
}

function normalizeGeminiAudioMimeType(mimeType: string) {
  if (mimeType.startsWith("audio/ogg")) return "audio/ogg";
  if (mimeType.startsWith("audio/mp3") || mimeType.startsWith("audio/mpeg")) return "audio/mp3";
  if (mimeType.startsWith("audio/wav") || mimeType.startsWith("audio/x-wav")) return "audio/wav";
  if (mimeType.startsWith("audio/flac")) return "audio/flac";
  if (mimeType.startsWith("audio/aac")) return "audio/aac";
  if (mimeType.startsWith("audio/aiff")) return "audio/aiff";
  return null;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getDemoHistory(userId: string) {
  const now = new Date();
  const tomorrow = addDays(now, 1);
  const inFourDays = addDays(now, 4);
  const inFiveDays = addDays(now, 5);
  const nextWeek = addDays(now, 7);
  const demoActions: Array<{
    id: string;
    userId: string;
    rawText: string;
    events: DemoEvent[];
    status: string;
    createdAt: Date;
  }> = [
    {
      id: "demo-history-1",
      userId,
      rawText: "Démo : rendez-vous client demain à 09h30 puis point équipe à 14h.",
      events: [
        {
          title: "Rendez-vous client Acme",
          date: toIsoDate(tomorrow),
          startTime: "09:30",
          endTime: "10:30",
          description: "Démo UI - faux rendez-vous pour tester l'historique.",
        },
        {
          title: "Point équipe produit",
          date: toIsoDate(tomorrow),
          startTime: "14:00",
          endTime: "14:45",
          description: "Synchronisation hebdo avec l'équipe.",
        },
      ],
      status: "success",
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
    {
      id: "demo-history-2",
      userId,
      rawText: "Démo : dentiste vendredi à 11h et sport samedi à 18h30.",
      events: [
        {
          title: "Dentiste",
          date: toIsoDate(inFourDays),
          startTime: "11:00",
          endTime: "11:45",
          description: "Contrôle annuel.",
        },
        {
          title: "Séance de sport",
          date: toIsoDate(inFiveDays),
          startTime: "18:30",
          endTime: "19:30",
          description: "Créneau perso de démonstration.",
        },
      ],
      status: "success",
      createdAt: new Date(now.getTime() - 28 * 60 * 60 * 1000),
    },
    {
      id: "demo-history-3",
      userId,
      rawText: "Démo : déjeuner avec Sarah lundi prochain à 12h15.",
      events: [
        {
          title: "Déjeuner avec Sarah",
          date: toIsoDate(nextWeek),
          startTime: "12:15",
          endTime: "13:30",
          description: "Réservation au café du centre.",
        },
      ],
      status: "success",
      createdAt: new Date(now.getTime() - 52 * 60 * 60 * 1000),
    },
  ];

  return demoActions;
}

// POST /api/transcribe-audio — Transcribe browser-recorded audio to text
router.post("/transcribe-audio", requireAuth, async (req: Request, res: Response) => {
  const { audioBase64, mimeType } = req.body as {
    audioBase64?: string;
    mimeType?: string;
  };

  if (!audioBase64 || typeof audioBase64 !== "string") {
    res.status(400).json({ error: "Audio manquant" });
    return;
  }

  if (!mimeType || typeof mimeType !== "string") {
    res.status(400).json({ error: "Type MIME manquant" });
    return;
  }

  const normalizedMimeType = normalizeGeminiAudioMimeType(mimeType);
  if (!normalizedMimeType) {
    res.status(415).json({ error: "Format audio non supporté par la transcription" });
    return;
  }

  if (audioBase64.length > 20 * 1024 * 1024) {
    res.status(413).json({ error: "Audio trop volumineux" });
    return;
  }

  try {
    const transcript = await transcribeAudioToText(audioBase64, normalizedMimeType);
    res.json({ transcript });
  } catch (error) {
    console.error("Erreur transcribe-audio:", error);
    const message = error instanceof Error ? error.message : "Erreur interne du serveur";
    res.status(500).json({ error: message });
  }
});

// POST /api/parse-events — Parse text & create Google Calendar events
router.post("/parse-events", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { text, timezone } = req.body;
  const tz = timezone || "Europe/Paris";

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "Texte manquant" });
    return;
  }

  try {
    // 0. Check daily usage limit
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayUsage = await prisma.voiceAction.count({
      where: { createdAt: { gte: startOfDay } },
    });
    if (todayUsage >= DAILY_LIMIT) {
      res.status(429).json({ error: `Limite quotidienne atteinte (${DAILY_LIMIT} appels/jour). Réessayez demain.` });
      return;
    }

    // 1. Parse events with Gemini
    const parsedEvents = await parseEventsFromText(text.trim(), tz);

    if (!Array.isArray(parsedEvents) || parsedEvents.length === 0) {
      res.status(422).json({ error: "Aucun événement détecté dans votre phrase" });
      return;
    }

    // 2. Get valid Google access token
    const accessToken = await getValidAccessToken(userId);

    // 3. Create events in Google Calendar
    const calendar = getCalendarClient(accessToken);

    const createdEvents = [];
    for (const event of parsedEvents) {
      const calendarEvent = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: event.title,
          description: event.description || "",
          start: {
            dateTime: `${event.date}T${event.startTime}:00`,
            timeZone: tz,
          },
          end: {
            dateTime: `${event.date}T${event.endTime}:00`,
            timeZone: tz,
          },
        },
      });

      createdEvents.push({
        ...event,
        googleEventId: calendarEvent.data.id,
        htmlLink: calendarEvent.data.htmlLink,
      });
    }

    // 4. Save to history
    await prisma.voiceAction.create({
      data: {
        userId,
        rawText: text.trim(),
        events: createdEvents,
      },
    });

    res.json({ events: createdEvents });
  } catch (error) {
    if (error instanceof ReauthRequiredError) {
      res.status(401).json({ error: "SESSION_EXPIRED" });
      return;
    }
    console.error("Erreur parse-events:", error);
    const message = error instanceof Error ? error.message : "Erreur interne du serveur";
    res.status(500).json({ error: message });
  }
});

// GET /api/history — Fetch user's voice action history
router.get("/history", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  const storedActions = await prisma.voiceAction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const actions = INCLUDE_DEV_HISTORY_MOCKS
    ? [...getDemoHistory(userId), ...storedActions]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20)
    : storedActions;

  res.json({ actions });
});

// GET /api/usage — Fetch daily usage stats
router.get("/usage", requireAuth, async (req: Request, res: Response) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const used = await prisma.voiceAction.count({
    where: {
      createdAt: { gte: startOfDay },
    },
  });

  res.json({ used, limit: DAILY_LIMIT });
});

export default router;
