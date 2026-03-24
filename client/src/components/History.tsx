import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EventCard } from "./EventCard";
import type { CreatedEvent, VoiceAction } from "@/types";

const popProfiles = [
  {
    hidden: {
      opacity: 0,
      x: -120,
      y: 18,
      rotate: -8,
      rotateY: 110,
      transformPerspective: 1000,
      scale: 0.84,
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      rotate: 0,
      rotateY: 0,
      transformPerspective: 1000,
      scale: 1,
    },
    hover: { x: 4, y: -6, scale: 1.02 },
    transition: { type: "spring" as const, stiffness: 220, damping: 17 },
  },
  {
    hidden: {
      opacity: 0,
      y: 82,
      scale: 0.34,
      rotate: -12,
      filter: "blur(16px)",
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      rotate: 0,
      filter: "blur(0px)",
    },
    hover: { y: -10, scale: 1.04 },
    transition: { duration: 0.62, ease: [0.16, 1, 0.3, 1] as const },
  },
  {
    hidden: {
      opacity: 0,
      x: 120,
      y: -10,
      rotate: 10,
      rotateY: -110,
      transformPerspective: 1000,
      scale: 0.86,
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      rotate: 0,
      rotateY: 0,
      transformPerspective: 1000,
      scale: 1,
    },
    hover: { x: -4, y: -7, rotate: 1 },
    transition: { type: "spring" as const, stiffness: 200, damping: 16 },
  },
  {
    hidden: {
      opacity: 0,
      y: 110,
      scaleX: 0.94,
      scaleY: 0.18,
      rotate: 8,
      filter: "blur(10px)",
    },
    visible: {
      opacity: 1,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotate: 0,
      filter: "blur(0px)",
    },
    hover: { y: -9, scale: 1.03, rotate: 1.2 },
    transition: { type: "spring" as const, stiffness: 180, damping: 15 },
  },
  {
    hidden: {
      opacity: 0,
      x: 130,
      y: 90,
      scale: 0.68,
      rotate: 18,
      clipPath: "inset(35% 20% 35% 20% round 24px)",
      filter: "blur(14px)",
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      rotate: 0,
      clipPath: "inset(0% 0% 0% 0% round 24px)",
      filter: "blur(0px)",
    },
    hover: { x: 3, y: -8, scale: 1.025 },
    transition: { duration: 0.56, ease: [0.22, 1, 0.36, 1] as const },
  },
  {
    hidden: {
      opacity: 0,
      x: -95,
      y: 70,
      rotate: -16,
      scale: 0.76,
      filter: "blur(12px)",
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      rotate: 0,
      scale: 1,
      filter: "blur(0px)",
    },
    hover: { y: -8, rotate: -1, scale: 1.03 },
    transition: { type: "spring" as const, stiffness: 190, damping: 16 },
  },
];

const gridVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: (index: number) => popProfiles[index % popProfiles.length].hidden,
  visible: (index: number) => {
    const profile = popProfiles[index % popProfiles.length];

    return {
      ...profile.visible,
      transition: {
        ...profile.transition,
        delay: 0.14 + index * 0.1,
      },
    };
  },
  hover: (index: number) => popProfiles[index % popProfiles.length].hover,
};

const cardContentVariants = {
  hidden: {},
  visible: (index: number) => ({
    transition: {
      delayChildren: 0.08 + (index % 3) * 0.03,
      staggerChildren: 0.05,
    },
  }),
  hover: {
    transition: {
      staggerChildren: 0.018,
    },
  },
};

const cardSectionVariants = {
  hidden: (index: number) => ({
    opacity: 0,
    y: 10 + (index % 2) * 6,
    x: index % 2 === 0 ? -8 : 8,
    scale: 0.94,
    filter: "blur(4px)",
  }),
  visible: {
    opacity: 1,
    y: 0,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.34,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
  hover: (index: number) => ({
    y: index % 2 === 0 ? -1.5 : 1.5,
    rotate: index % 2 === 0 ? -0.8 : 0.8,
    transition: {
      duration: 0.18,
    },
  }),
};

const eventListVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.04,
      staggerChildren: 0.035,
    },
  },
  hover: {
    transition: {
      staggerChildren: 0.012,
    },
  },
};

function HistoryCard({ action, index }: { action: VoiceAction; index: number }) {
  const events = action.events as CreatedEvent[];

  return (
    <motion.article
      className="glass rounded-2xl p-5 h-full flex flex-col"
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
    >
      <motion.div custom={index} variants={cardContentVariants} className="flex h-full flex-col">
        <motion.div
          custom={index}
          variants={cardSectionVariants}
          className="mb-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/5 bg-gradient-to-br from-blue-500/20 to-violet-500/15">
              <svg className="h-3.5 w-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              {new Date(action.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5">
            <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
            <span className="text-[10px] font-medium text-green-400/80">
              {events.length} evt
            </span>
          </div>
        </motion.div>

        <motion.p
          custom={index + 1}
          variants={cardSectionVariants}
          className="mb-4 text-sm italic leading-relaxed text-slate-300"
        >
          &ldquo;{action.rawText}&rdquo;
        </motion.p>

        <motion.div
          custom={index + 2}
          variants={cardSectionVariants}
          className="mb-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />

        <motion.div variants={eventListVariants} className="flex-1 space-y-1.5">
          {events.map((event, eventIndex) => (
            <motion.div
              key={`${action.id}-${eventIndex}`}
              custom={eventIndex}
              variants={cardSectionVariants}
            >
              <EventCard event={event} compact />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </motion.article>
  );
}

function HistoryStack({ actions }: { actions: VoiceAction[] }) {
  return (
    <motion.div
      className="mx-auto flex w-full max-w-2xl flex-col gap-4 sm:gap-5"
      variants={gridVariants}
      initial="hidden"
      animate="visible"
    >
      {actions.map((action, index) => (
        <HistoryCard key={action.id} action={action} index={index} />
      ))}
    </motion.div>
  );
}

export function History() {
  const [actions, setActions] = useState<VoiceAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [overflowHidden, setOverflowHidden] = useState(true);
  const isOpenRef = useRef(isOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

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

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const handleToggle = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsOpen(!isOpen);
  };

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-2xl px-2">
      <motion.button
        onClick={handleToggle}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full max-w-md mx-auto glass-strong flex items-center justify-between py-3.5 px-5 rounded-2xl transition-colors group"
      >
        <div className="flex items-center gap-2.5 text-slate-300">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/15 to-violet-500/10 border border-white/5 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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
            onAnimationStart={() => setOverflowHidden(true)}
            onAnimationComplete={() => {
              if (!isOpenRef.current) return;

              setOverflowHidden(false);
              timerRef.current = setTimeout(() => {
                contentRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
                timerRef.current = null;
              }, 60);
            }}
            className={overflowHidden ? "overflow-hidden" : ""}
          >
            <div ref={contentRef} className="mt-6">
              {isLoading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-3 py-12"
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
                  className="text-center py-12"
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
                <HistoryStack actions={actions} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
