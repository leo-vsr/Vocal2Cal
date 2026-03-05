import { useState } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { EventCard } from "./EventCard";
import type { CreatedEvent } from "@/types";

export function VoiceRecorder({ onSuccess }: { onSuccess?: () => void }) {
  const {
    transcript,
    isListening,
    error: speechError,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  const [isProcessing, setIsProcessing] = useState(false);
  const [createdEvents, setCreatedEvents] = useState<CreatedEvent[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleToggleRecording = () => {
    if (isListening) {
      stopListening();
    } else {
      setCreatedEvents([]);
      setApiError(null);
      startListening();
    }
  };

  const handleSendToCalendar = async () => {
    if (!transcript.trim()) return;

    setIsProcessing(true);
    setApiError(null);

    try {
      const response = await fetch("/api/parse-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: transcript, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("Réponse invalide du serveur:", text);
        setApiError("Réponse invalide du serveur");
        return;
      }

      if (response.status === 401 && data.error === "SESSION_EXPIRED") {
        window.location.href = "/api/auth/google";
        return;
      }

      if (!response.ok) {
        setApiError(data.error || "Une erreur est survenue");
        return;
      }

      setCreatedEvents(data.events);
      resetTranscript();
      onSuccess?.();
    } catch {
      setApiError("Impossible de contacter le serveur");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Microphone Button */}
      <div className="relative">
        {isListening && (
          <>
            <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping-slow" />
            <div className="absolute -inset-3 rounded-full bg-blue-500/10 animate-pulse" />
          </>
        )}
        <button
          onClick={handleToggleRecording}
          disabled={!isSupported || isProcessing}
          className={`relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
            isListening
              ? "bg-red-500 hover:bg-red-600 scale-110 shadow-red-500/30"
              : "bg-blue-500 hover:bg-blue-600 shadow-blue-500/30"
          } ${!isSupported || isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-95"}`}
          aria-label={
            isListening
              ? "Arrêter l'enregistrement"
              : "Commencer l'enregistrement"
          }
        >
          {isListening ? (
            <svg
              className="w-10 h-10 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg
              className="w-10 h-10 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          )}
        </button>
      </div>

      {/* Status Text */}
      <p className="text-sm text-slate-400">
        {!isSupported
          ? "Navigateur non supporté"
          : isListening
            ? "Parlez maintenant..."
            : isProcessing
              ? "Traitement en cours..."
              : "Appuyez pour dicter"}
      </p>

      {/* Speech Error */}
      {speechError && (
        <div className="w-full max-w-md bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm text-center">
          {speechError}
        </div>
      )}

      {/* Transcript Display */}
      {transcript && (
        <div className="w-full max-w-md bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
            Transcription
          </p>
          <p className="text-white text-lg leading-relaxed">{transcript}</p>

          {!isListening && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSendToCalendar}
                disabled={isProcessing}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg
                      className="w-5 h-5 animate-spin"
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
                    Analyse...
                  </>
                ) : (
                  <>
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
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Créer les événements
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  resetTranscript();
                  setApiError(null);
                }}
                className="bg-white/10 hover:bg-white/20 text-white py-3 px-4 rounded-xl transition-colors"
                aria-label="Effacer"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* API Error */}
      {apiError && (
        <div className="w-full max-w-md bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm text-center">
          {apiError}
        </div>
      )}

      {/* Created Events */}
      {createdEvents.length > 0 && (
        <div className="w-full max-w-md space-y-3">
          <div className="flex items-center gap-2 text-green-400">
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
                d="M5 13l4 4L19 7"
              />
            </svg>
            <p className="text-sm font-medium">
              {createdEvents.length} événement
              {createdEvents.length > 1 ? "s" : ""} créé
              {createdEvents.length > 1 ? "s" : ""}
            </p>
          </div>
          {createdEvents.map((event, i) => (
            <EventCard key={i} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
