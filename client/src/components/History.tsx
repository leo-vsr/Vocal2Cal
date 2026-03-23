import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EventCard } from "./EventCard";
import type { CreatedEvent, VoiceAction } from "@/types";

const historyStagger = {
  visible: { transition: { staggerChildren: 0.07 } },
};

const historyItem = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
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
        whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.1)" }}
        whileTap={{ scale: 0.99 }}
        className="w-full flex items-center justify-between py-3 px-4 bg-white/5 border border-white/10 rounded-xl transition-colors"
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
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="w-5 h-5 text-slate-400"
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
        </motion.svg>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-4">
              {isLoading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center py-8"
                >
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
                </motion.div>
              ) : actions.length === 0 ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-slate-500 text-sm text-center py-6"
                >
                  Aucun historique pour le moment
                </motion.p>
              ) : (
                <motion.div
                  variants={historyStagger}
                  initial="hidden"
                  animate="visible"
                  className="space-y-4"
                >
                  {actions.map((action) => (
                    <motion.div
                      key={action.id}
                      variants={historyItem}
                      whileHover={{ scale: 1.01 }}
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
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
