import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { parseEventsFromText } from "../lib/mistral";
import { getValidAccessToken, getCalendarClient, ReauthRequiredError } from "../lib/google";

const router = Router();

// Limite globale d'appels IA par jour (tous utilisateurs confondus)
const DAILY_LIMIT = parseInt(process.env.DAILY_AI_LIMIT || "50", 10);

// POST /api/parse-events — Parse text & create Google Calendar events
router.post("/parse-events", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { text } = req.body;

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
    const parsedEvents = await parseEventsFromText(text.trim());

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
            timeZone: "Europe/Paris",
          },
          end: {
            dateTime: `${event.date}T${event.endTime}:00`,
            timeZone: "Europe/Paris",
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

  const actions = await prisma.voiceAction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

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
