import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EventCard } from "./EventCard";
import type { CreatedEvent, VoiceAction } from "@/types";

function getHistoryItemVariants(index: number) {
  const isEven = index % 2 === 0;
  const xOffset = isEven ? -30 : 30;
  const rotateOffset = isEven ? -1.5 : 1.5;

  return {
    hidden: {
      opacity: 0,
      x: xOffset,
      y: 10,
      rotate: rotateOffset,
      scale: 0.96,
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      rotate: 0,
      scale: 1,
      transition: {
        duration: 0.45,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
        delay: index * 0.1,
      },
    },
  };
}

const innerEventVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut" as const,
      delay: i * 0.06,
    },
  }),
};

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
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full glass-strong flex items-center justify-between py-3.5 px-5 rounded-2xl transition-colors group"
      >
        <div className="flex items-center gap-2.5 text-slate-300">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/15 to-violet-500/10 border border-white/5 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-blue-400"
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
          </div>
          <span className="font-medium text-sm">Historique</span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors"
        >
          <svg
            className="w-4 h-4 text-slate-400"
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
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4">
              {isLoading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-3 py-10"
                >
                  <svg
                    className="w-6 h-6 text-blue-400/60 animate-spin"
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
                  <p className="text-slate-600 text-xs">Chargement...</p>
                </motion.div>
              ) : actions.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-10"
                >
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <p className="text-slate-500 text-sm">
                    Aucun historique pour le moment
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {actions.map((action, index) => (
                    <motion.div
                      key={action.id}
                      variants={getHistoryItemVariants(index)}
                      initial="hidden"
                      animate="visible"
                      whileHover={{ scale: 1.015, y: -2 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className="glass rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/15 to-violet-500/10 border border-white/5 flex items-center justify-center mt-0.5">
                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                          </div>
                          <p className="text-slate-300 text-sm italic leading-relaxed">
                            &ldquo;{action.rawText}&rdquo;
                          </p>
                        </div>
                        <time className="text-slate-600 text-xs shrink-0 bg-white/5 px-2 py-1 rounded-md">
                          {new Date(action.createdAt).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      <div className="space-y-2 pl-10">
                        {(action.events as CreatedEvent[]).map((event, i) => (
                          <motion.div
                            key={i}
                            variants={innerEventVariants}
                            initial="hidden"
                            animate="visible"
                            custom={i}
                          >
                            <EventCard event={event} />
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
