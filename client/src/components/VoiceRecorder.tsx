import { useState, useRef, useCallback, useEffect } from "react";
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

interface VoiceRecorderProps {
  onSuccess?: () => void;
  isAdmin?: boolean;
}

export function VoiceRecorder({ onSuccess, isAdmin = false }: VoiceRecorderProps) {
  const {
    transcript,
    isListening,
    isTranscribing,
    error: speechError,
    isSupported,
    mode,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  const [isProcessing, setIsProcessing] = useState(false);
  const [createdEvents, setCreatedEvents] = useState<CreatedEvent[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isCooldown, setIsCooldown] = useState(false);
  const [entryMode, setEntryMode] = useState<"voice" | "text">("voice");
  const [manualPrompt, setManualPrompt] = useState("");
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

  const submitTextToCalendar = useCallback(async (sourceText: string) => {
    setIsProcessing(true);
    setApiError(null);

    try {
      const response = await fetch("/api/parse-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: sourceText, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
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
      onSuccess?.();
    } catch {
      setApiError("Impossible de contacter le serveur");
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess]);

  const handleSendToCalendar = async () => {
    const sourceText = isAdmin && entryMode === "text" ? manualPrompt.trim() : transcript.trim();
    if (!sourceText) return;

    await submitTextToCalendar(sourceText);

    if (isAdmin && entryMode === "text") {
      setManualPrompt("");
    } else {
      resetTranscript();
    }
  };

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) {
        clearTimeout(cooldownTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isAdmin && entryMode !== "voice") {
      setEntryMode("voice");
      setManualPrompt("");
    }
  }, [entryMode, isAdmin]);

  useEffect(() => {
    if (isAdmin && entryMode === "text" && isListening) {
      stopListening();
    }
  }, [entryMode, isAdmin, isListening, stopListening]);

  const isDisabled = !isSupported || isProcessing || isCooldown || isTranscribing;
  const canSubmitText = manualPrompt.trim().length > 0 && !isProcessing;

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {isAdmin && (
        <div className="glass inline-flex items-center gap-1 rounded-full border border-white/8 p-1">
          {[
            { id: "voice", label: "Vocal" },
            { id: "text", label: "Texte" },
          ].map((modeOption) => {
            const isActive = entryMode === modeOption.id;
            return (
              <motion.button
                key={modeOption.id}
                type="button"
                onClick={() => {
                  setEntryMode(modeOption.id as "voice" | "text");
                  setApiError(null);
                  setCreatedEvents([]);
                }}
                whileTap={{ scale: 0.97 }}
                className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="admin-entry-mode-pill"
                    className="absolute inset-0 rounded-full bg-white/10"
                    transition={{ type: "spring", stiffness: 360, damping: 28 }}
                  />
                )}
                <span className="relative z-10">{modeOption.label}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {isAdmin && entryMode === "text" ? (
        <motion.div
          variants={slideUp}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md glass-strong rounded-3xl border border-white/8 p-5 sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Mode admin</p>
              <h3 className="mt-2 text-lg font-semibold text-white">Saisie manuelle</h3>
            </div>
            <div className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-[11px] font-medium text-cyan-100">
              Sans micro
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Saisissez la demande telle que vous la dicteriez normalement. Le traitement reste identique au flux vocal.
          </p>

          <label className="mt-5 block">
            <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">Votre demande</span>
            <textarea
              value={manualPrompt}
              onChange={(event) => {
                setManualPrompt(event.target.value);
                setApiError(null);
              }}
              rows={5}
              placeholder="Exemple : demain coiffeur à 9h, jeudi foot de 18h à 19h30, puis le 30 mars piscine de 8h à 12h."
              className="min-h-[140px] w-full rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300/35"
            />
          </label>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <motion.button
              type="button"
              onClick={handleSendToCalendar}
              disabled={!canSubmitText}
              whileHover={canSubmitText ? { scale: 1.02 } : undefined}
              whileTap={canSubmitText ? { scale: 0.98 } : undefined}
              className="flex-1 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 text-sm font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex items-center justify-center gap-2">
                {isProcessing ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyse...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Créer les événements
                  </>
                )}
              </span>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => {
                setManualPrompt("");
                setApiError(null);
              }}
              whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.12)" }}
              whileTap={{ scale: 0.98 }}
              className="rounded-2xl bg-white/6 px-4 py-3 text-sm font-medium text-slate-200 transition-colors"
            >
              Effacer
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Microphone Button */}
          <motion.div
            className="relative flex items-center justify-center w-40 h-40 sm:w-48 sm:h-48"
            animate={{
              y: isListening ? [0, -8, 0] : [0, -10, 0],
              rotate: isListening ? [0, 1.5, -1.5, 0] : [0, 2, -2, 0],
            }}
            transition={{
              duration: isListening ? 3.6 : 5.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
        {/* Ambient glow behind button */}
        <div
          className={`absolute w-40 h-40 sm:w-48 sm:h-48 rounded-full transition-all duration-700 ${
            isListening
              ? "bg-red-500/10 blur-3xl scale-110"
              : "bg-blue-500/8 blur-2xl"
          }`}
        />
        <motion.div
          className="absolute top-5 left-7 h-24 w-24 rounded-full bg-blue-400/18 blur-2xl sm:h-28 sm:w-28"
          animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-6 right-5 h-20 w-20 rounded-full bg-white/40 blur-xl sm:h-24 sm:w-24"
          animate={{ scale: [1.04, 0.94, 1.04], x: [0, 8, 0] }}
          transition={{ duration: 4.1, repeat: Infinity, ease: "easeInOut" }}
        />
        <AnimatePresence>
          {isListening && (
            <>
              <motion.div
                key="ping"
                initial={{ scale: 1, opacity: 0.4 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                className="absolute inset-6 rounded-full bg-blue-500/20"
              />
              <motion.div
                key="glow"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.1, 0.25, 0.1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-3 rounded-full bg-blue-500/10"
              />
            </>
          )}
        </AnimatePresence>
        <motion.button
          onClick={handleToggleRecording}
          disabled={isDisabled}
          whileHover={!isDisabled ? { scale: 1.08, y: -8, rotate: -1.5 } : undefined}
          whileTap={!isDisabled ? { scale: 0.92 } : undefined}
          animate={
            isListening
              ? { backgroundColor: "#ef4444", scale: 1.1, boxShadow: "0 0 30px rgba(239,68,68,0.3)" }
              : { backgroundColor: "#3b82f6", scale: 1, boxShadow: "0 0 20px rgba(59,130,246,0.3)" }
          }
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full sm:h-28 sm:w-28 ${
            isListening ? "glow-red" : "glow-blue"
          } ${
            isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
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
                className="h-10 w-10 text-white"
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
                className="h-10 w-10 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      {/* Status Text */}
      <AnimatePresence mode="wait">
        <motion.p
          key={!isSupported ? "unsupported" : isListening ? "listening" : isTranscribing ? "transcribing" : isProcessing ? "processing" : isCooldown ? "cooldown" : "idle"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="text-sm text-slate-400"
        >
          {!isSupported
            ? "Navigateur non compatible"
            : isListening
              ? "Parlez maintenant..."
              : isTranscribing
                ? "Transcription audio..."
              : isProcessing
                ? "Traitement en cours..."
                : isCooldown
                  ? "Patientez..."
                  : mode === "recording"
                    ? "Appuyez pour enregistrer votre dictée"
                    : "Appuyez pour dicter"}
        </motion.p>
      </AnimatePresence>

      {mode === "recording" && isSupported && (
        <p className="max-w-md text-center text-xs leading-5 text-slate-500">
          Ce navigateur utilise un enregistrement audio temporaire puis une transcription serveur.
        </p>
      )}

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
        </>
      )}

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
