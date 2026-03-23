import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { EventCard } from "./EventCard";
import type { CreatedEvent } from "@/types";

const COOLDOWN_MS = 1500;

const slideUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.25 } },
};

const eventsStagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const eventItem = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: "easeOut" as const } },
};

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
  const [isCooldown, setIsCooldown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggleRecording = useCallback(() => {
    if (isCooldown) return;

    if (isListening) {
      stopListening();
      setIsCooldown(true);
      cooldownTimer.current = setTimeout(() => setIsCooldown(false), COOLDOWN_MS);
    } else {
      setCreatedEvents([]);
      setApiError(null);
      startListening();
      setIsCooldown(true);
      cooldownTimer.current = setTimeout(() => setIsCooldown(false), COOLDOWN_MS);
    }
  }, [isCooldown, isListening, startListening, stopListening]);

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

  const isDisabled = !isSupported || isProcessing || isCooldown;

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Microphone Button */}
      <div className="relative flex items-center justify-center">
        {/* Ambient glow behind button */}
        <div className={`absolute w-40 h-40 sm:w-48 sm:h-48 rounded-full transition-all duration-700 ${
          isListening
            ? "bg-red-500/10 blur-3xl scale-110"
            : "bg-blue-500/8 blur-2xl"
        }`} />
        <AnimatePresence>
          {isListening && (
            <>
              <motion.div
                key="ping"
                initial={{ scale: 1, opacity: 0.4 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                className="absolute inset-0 rounded-full bg-blue-500/20"
              />
              <motion.div
                key="glow"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.1, 0.25, 0.1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -inset-3 rounded-full bg-blue-500/10"
              />
            </>
          )}
        </AnimatePresence>
        <motion.button
          onClick={handleToggleRecording}
          disabled={isDisabled}
          whileHover={!isDisabled ? { scale: 1.08 } : undefined}
          whileTap={!isDisabled ? { scale: 0.92 } : undefined}
          animate={
            isListening
              ? { backgroundColor: "#ef4444", scale: 1.1, boxShadow: "0 0 30px rgba(239,68,68,0.3)" }
              : { backgroundColor: "#3b82f6", scale: 1, boxShadow: "0 0 20px rgba(59,130,246,0.3)" }
          }
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center ${
            isListening ? "glow-red" : "glow-blue"
          } ${
            isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
          }`}
          aria-label={
            isListening
              ? "Arrêter l'enregistrement"
              : "Commencer l'enregistrement"
          }
        >
          <AnimatePresence mode="wait">
            {isListening ? (
              <motion.svg
                key="stop"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90 }}
                transition={{ duration: 0.25 }}
                className="w-10 h-10 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </motion.svg>
            ) : (
              <motion.svg
                key="mic"
                initial={{ scale: 0, rotate: 90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: -90 }}
                transition={{ duration: 0.25 }}
                className="w-10 h-10 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Status Text */}
      <AnimatePresence mode="wait">
        <motion.p
          key={!isSupported ? "unsupported" : isListening ? "listening" : isProcessing ? "processing" : isCooldown ? "cooldown" : "idle"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="text-sm text-slate-400"
        >
          {!isSupported
            ? "Navigateur non supporté"
            : isListening
              ? "Parlez maintenant..."
              : isProcessing
                ? "Traitement en cours..."
                : isCooldown
                  ? "Patientez..."
                  : "Appuyez pour dicter"}
        </motion.p>
      </AnimatePresence>

      {/* Speech Error */}
      <AnimatePresence>
        {speechError && (
          <motion.div
            variants={slideUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-md glass rounded-2xl p-4 border-red-500/15 text-red-400 text-sm text-center"
          >
            {speechError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcript Display */}
      <AnimatePresence>
        {transcript && (
          <motion.div
            variants={slideUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-md glass-strong rounded-2xl p-5"
          >
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Transcription
            </p>
            <p className="text-white text-lg leading-relaxed">{transcript}</p>

            <AnimatePresence>
              {!isListening && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex gap-3 mt-4 overflow-hidden"
                >
                  <motion.button
                    onClick={handleSendToCalendar}
                    disabled={isProcessing}
                    whileHover={!isProcessing ? { scale: 1.02 } : undefined}
                    whileTap={!isProcessing ? { scale: 0.98 } : undefined}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
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
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      resetTranscript();
                      setApiError(null);
                    }}
                    whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.2)" }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-white/10 text-white py-3 px-4 rounded-xl transition-colors"
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
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Error */}
      <AnimatePresence>
        {apiError && (
          <motion.div
            variants={slideUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-md glass rounded-2xl p-4 border-red-500/15 text-red-400 text-sm text-center"
          >
            {apiError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Created Events */}
      <AnimatePresence>
        {createdEvents.length > 0 && (
          <motion.div
            variants={eventsStagger}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className="w-full max-w-md space-y-3"
          >
            <motion.div
              variants={eventItem}
              className="flex items-center gap-2 text-green-400"
            >
              <motion.svg
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
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
              </motion.svg>
              <p className="text-sm font-medium">
                {createdEvents.length} événement
                {createdEvents.length > 1 ? "s" : ""} créé
                {createdEvents.length > 1 ? "s" : ""}
              </p>
            </motion.div>
            {createdEvents.map((event, i) => (
              <motion.div key={i} variants={eventItem}>
                <EventCard event={event} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
