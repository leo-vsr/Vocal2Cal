import type { CreatedEvent } from "@/types";

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function EventCard({ event }: { event: CreatedEvent }) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-base truncate">
            {event.title}
          </h3>
          <p className="text-slate-400 text-sm mt-1 capitalize">
            {formatDate(event.date)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <svg
              className="w-4 h-4 text-slate-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-slate-400 text-sm">
              {event.startTime} — {event.endTime}
            </span>
          </div>
          {event.description && (
            <p className="text-slate-500 text-sm mt-2">{event.description}</p>
          )}
        </div>

        {event.htmlLink && (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-blue-400 hover:text-blue-300 transition-colors"
            title="Voir dans Google Agenda"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
