export interface ParsedEvent {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
}

function getGeminiParseModel() {
  return process.env.GEMINI_PARSE_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

function getGeminiTranscribeModel() {
  return process.env.GEMINI_TRANSCRIBE_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

function getGeminiApiKey() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY manquant");
  }

  return process.env.GEMINI_API_KEY;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

function userFriendlyGeminiError(status: number): string {
  switch (status) {
    case 503:
    case 429:
      return "Le service IA est temporairement surchargé. Réessayez dans quelques secondes.";
    case 400:
      return "Requête invalide envoyée au service IA.";
    case 401:
    case 403:
      return "Clé API Gemini invalide ou expirée. Contactez l'administrateur.";
    case 404:
      return "Modèle IA introuvable. Contactez l'administrateur.";
    default:
      return "Une erreur inattendue est survenue avec le service IA. Réessayez.";
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 503 || status === 429;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateTextFromGemini(
  model: string,
  parts: Array<Record<string, unknown>>,
  responseMimeType = "text/plain"
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`;
  const body = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType,
    },
  });

  let lastStatus = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAY_MS * attempt);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (response.ok) {
      const data = await response.json();
      return (
        data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("")?.trim() ||
        ""
      );
    }

    lastStatus = response.status;
    const errBody = await response.text();
    console.error(`Gemini API error (attempt ${attempt + 1}/${MAX_RETRIES + 1}, status ${lastStatus}):`, errBody);

    if (!isRetryableStatus(lastStatus)) {
      throw new Error(userFriendlyGeminiError(lastStatus));
    }
  }

  throw new Error(userFriendlyGeminiError(lastStatus));
}

export async function parseEventsFromText(text: string, timezone?: string): Promise<ParsedEvent[]> {
  getGeminiApiKey();

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const dayOfWeek = now.toLocaleDateString("fr-FR", { weekday: "long" });
  const currentTime = now.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const prompt = `Tu es un assistant qui extrait des événements d'agenda à partir d'une phrase en français.

Date d'aujourd'hui : ${today} (${dayOfWeek})
Heure actuelle : ${currentTime}

Phrase de l'utilisateur : "${text}"

Extrais TOUS les événements mentionnés et retourne un tableau JSON avec pour chaque événement :
- "title" : le titre de l'événement (en français, clair et concis)
- "date" : la date au format YYYY-MM-DD
- "startTime" : l'heure de début au format HH:MM (24h)
- "endTime" : l'heure de fin au format HH:MM (24h). Si non précisée, ajoute 1h à l'heure de début.
- "description" : une description courte optionnelle

Règles :
- "demain" = le jour suivant aujourd'hui
- "lundi prochain", "mardi", etc. = le prochain jour de la semaine correspondant
- Si aucune date n'est précisée, utilise la date d'aujourd'hui
- Si aucune heure n'est précisée, utilise 09:00 par défaut

Réponds UNIQUEMENT avec le tableau JSON brut valide (guillemets doubles, pas de virgule trailing), sans markdown, sans backticks, sans explication. Exemple de format attendu :
[{"title":"Coiffeur","date":"2026-03-06","startTime":"14:00","endTime":"15:00","description":""}]`;

  const responseText = (await generateTextFromGemini(getGeminiParseModel(), [{ text: prompt }], "application/json")) || "[]";

  console.log("Gemini raw response:", responseText);

  // Clean markdown fences if present
  let cleaned = responseText
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Extract JSON array
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  // Remove trailing commas before ] or }
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  const events: ParsedEvent[] = JSON.parse(cleaned);
  return events;
}

export async function transcribeAudioToText(audioBase64: string, mimeType: string) {
  getGeminiApiKey();

  const prompt = `Transcris fidèlement cette dictée vocale en français.

Règles :
- Réponds uniquement avec le texte transcrit.
- N'ajoute aucune explication.
- Si l'audio est vide ou incompréhensible, réponds avec une chaîne vide.`;

  const responseText = await generateTextFromGemini(getGeminiTranscribeModel(), [
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: audioBase64,
      },
    },
  ]);

  return responseText.trim();
}
