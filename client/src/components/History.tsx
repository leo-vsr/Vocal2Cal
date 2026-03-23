import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { EventCard } from "./EventCard";
import type { CreatedEvent, VoiceAction } from "@/types";

function getCardVariants(index: number) {
  const isEven = index % 2 === 0;
  return {
    hidden: {
      opacity: 0,
      x: isEven ? -40 : 40,
      scale: 0.92,
      filter: "blur(4px)",
    },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1] as const,
        delay: index * 0.12,
      },
    },
  };
}

function TimelineItem({ action, index, total }: { action: VoiceAction; index: number; total: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });
  const isLast = index === total - 1;

  return (
    <div ref={ref} className="relative flex gap-4">
      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0 w-8">
        {/* Dot */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 1 } : {}}
          transition={{ type: "spring", stiffness: 500, damping: 25, delay: index * 0.12 }}
          className="relative z-10 w-3 h-3 rounded-full bg-gradient-to-br from-blue-400 to-violet-400 shadow-[0_0_8px_rgba(99,102,241,0.4)] mt-1.5"
        >
          <motion.div
            animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: index * 0.3 }}
            className="absolute inset-0 rounded-full bg-blue-400"
          />
        </motion.div>
        {/* Connector line */}
        {!isLast && (
          <motion.div
            initial={{ scaleY: 0, opacity: 0 }}
            animate={isInView ? { scaleY: 1, opacity: 1 } : {}}
            transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.12 + 0.15 }}
            className="w-px flex-1 origin-top bg-gradient-to-b from-blue-500/30 via-violet-500/15 to-transparent"
          />
        )}
      </div>

      {/* Card */}
      <motion.div
        variants={getCardVariants(index)}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        whileHover={{ y: -3, transition: { type: "spring", stiffness: 400, damping: 20 } }}
        className="flex-1 glass rounded-2xl p-4 mb-4"
      >
        {/* Header: quote + time */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-slate-300 text-sm italic leading-relaxed flex-1 min-w-0">
            &ldquo;{action.rawText}&rdquo;
          </p>
          <motion.time
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: index * 0.12 + 0.25 }}
            className="text-slate-500 text-[10px] uppercase tracking-wider shrink-0 bg-white/5 px-2 py-0.5 rounded-full"
          >
            {new Date(action.createdAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </motion.time>
        </div>

        {/* Events inside */}
        <div className="space-y-1">
          {(action.events as CreatedEvent[]).map((event, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{
                duration: 0.35,
                ease: "easeOut" as const,
                delay: index * 0.12 + 0.3 + i * 0.08,
              }}
            >
              <EventCard event={event} compact />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

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
          <AnimatePresence>
            {isOpen && actions.length > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium"
              >
                {actions.length}
              </motion.span>
            )}
          </AnimatePresence>
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
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const }}
            className="overflow-hidden"
          >
            <div className="mt-5 pl-1">
              {isLoading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-3 py-10"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-400"
                  />
                  <p className="text-slate-600 text-xs">Chargement...</p>
                </motion.div>
              ) : actions.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-10"
                >
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mx-auto mb-4"
                  >
                    <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </motion.div>
                  <p className="text-slate-500 text-sm">Aucun historique</p>
                  <p className="text-slate-600 text-xs mt-1">Vos futures dictées apparaîtront ici</p>
                </motion.div>
              ) : (
                <div>
                  {actions.map((action, index) => (
                    <TimelineItem
                      key={action.id}
                      action={action}
                      index={index}
                      total={actions.length}
                    />
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
