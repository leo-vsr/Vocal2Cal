import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useInView, type MotionValue } from "framer-motion";
import { EventCard } from "./EventCard";
import type { CreatedEvent, VoiceAction } from "@/types";

function ParallaxCard({ action, index }: { action: VoiceAction; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const parallaxY = useTransform(
    scrollYProgress,
    [0, 1],
    [index % 2 === 0 ? 30 : 50, index % 2 === 0 ? -30 : -50]
  );
  const parallaxRotate = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [index % 2 === 0 ? 1 : -1, 0, index % 2 === 0 ? -0.5 : 0.5]
  );
  const parallaxScale = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], [0.95, 1, 1, 0.97]);

  const eventsCount = (action.events as CreatedEvent[]).length;

  return (
    <motion.div
      ref={ref}
      style={{ y: parallaxY, rotate: parallaxRotate, scale: parallaxScale }}
      initial={{ opacity: 0, y: 40, filter: "blur(6px)" }}
      animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
      transition={{
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1] as const,
        delay: index * 0.1,
      }}
      whileHover={{ y: -4, transition: { type: "spring", stiffness: 300, damping: 20 } }}
      className="glass rounded-2xl p-5 h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/15 border border-white/5 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <span className="text-slate-500 text-[10px] uppercase tracking-wider">
            {new Date(action.createdAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-green-500/10 px-2 py-0.5 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-green-400/80 text-[10px] font-medium">
            {eventsCount} evt
          </span>
        </div>
      </div>

      {/* Transcript */}
      <p className="text-slate-300 text-sm italic leading-relaxed mb-4">
        &ldquo;{action.rawText}&rdquo;
      </p>

      {/* Gradient divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-4" />

      {/* Events */}
      <div className="space-y-1.5 flex-1">
        {(action.events as CreatedEvent[]).map((event, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: index % 2 === 0 ? -15 : 15 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{
              duration: 0.4,
              ease: "easeOut" as const,
              delay: index * 0.1 + 0.2 + i * 0.07,
            }}
          >
            <EventCard event={event} compact />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function ParallaxOrb({ className, progress, speed }: {
  className: string;
  progress: MotionValue<number>;
  speed: number;
}) {
  const y = useTransform(progress, [0, 1], [0, speed]);
  return <motion.div style={{ y }} className={className} />;
}

function HistoryGrid({ actions }: { actions: VoiceAction[] }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  return (
    <div ref={sectionRef} className="relative">
      {/* Parallax background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <ParallaxOrb
          progress={scrollYProgress}
          speed={-80}
          className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-blue-500/[0.04] blur-3xl"
        />
        <ParallaxOrb
          progress={scrollYProgress}
          speed={-120}
          className="absolute top-1/3 -right-16 w-60 h-60 rounded-full bg-violet-500/[0.04] blur-3xl"
        />
        <ParallaxOrb
          progress={scrollYProgress}
          speed={-50}
          className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full bg-cyan-500/[0.03] blur-2xl"
        />
      </div>

      {/* Grid of cards */}
      <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {actions.map((action, index) => (
          <ParallaxCard key={action.id} action={action} index={index} />
        ))}
      </div>
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
    <div className="w-full max-w-3xl mx-auto px-2">
      {/* Toggle button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
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

      {/* Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const }}
            className="overflow-hidden"
          >
            <div className="mt-6">
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
                <HistoryGrid actions={actions} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
