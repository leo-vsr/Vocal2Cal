import { useState, useEffect } from "react";
import { EventCard } from "./EventCard";
import type { CreatedEvent, VoiceAction } from "@/types";

export function History() {
  const [actions, setActions] = useState<VoiceAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchHistory() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/history", { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          setActions(data.actions);
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [isOpen]);

  return (
    <div className="w-full max-w-md">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-300">
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-medium">Historique</span>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <svg
                className="w-6 h-6 text-slate-400 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          ) : actions.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">
              Aucun historique pour le moment
            </p>
          ) : (
            actions.map((action) => (
              <div
                key={action.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-slate-300 text-sm italic">
                    &ldquo;{action.rawText}&rdquo;
                  </p>
                  <time className="text-slate-600 text-xs shrink-0">
                    {new Date(action.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <div className="space-y-2">
                  {(action.events as CreatedEvent[]).map((event, i) => (
                    <EventCard key={i} event={event} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
