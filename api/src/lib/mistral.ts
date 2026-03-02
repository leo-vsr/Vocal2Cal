export interface ParsedEvent {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
}

export async function parseEventsFromText(text: string): Promise<ParsedEvent[]> {
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

Réponds UNIQUEMENT avec le tableau JSON brut, sans markdown, sans backticks, sans explication.`;

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erreur Mistral API: ${err}`);
  }

  const data = await response.json();
  const responseText =
    data.choices?.[0]?.message?.content?.trim() || "[]";

  // Clean potential markdown formatting
  const cleaned = responseText
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const events: ParsedEvent[] = JSON.parse(cleaned);
  return events;
}
