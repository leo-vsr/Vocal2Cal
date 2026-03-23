import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { EventCard } from "./EventCard";
import type { CreatedEvent, VoiceAction } from "@/types";

const CARD_WIDTH = 280;
const CARD_GAP = 16;

function HistoryCarousel({ actions }: { actions: VoiceAction[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const dragX = useMotionValue(0);

  const totalWidth = actions.length * (CARD_WIDTH + CARD_GAP) - CARD_GAP;

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = CARD_WIDTH / 3;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    let newIndex = activeIndex;
    if (offset < -threshold || velocity < -200) {
      newIndex = Math.min(activeIndex + 1, actions.length - 1);
    } else if (offset > threshold || velocity > 200) {
      newIndex = Math.max(activeIndex - 1, 0);
    }
    setActiveIndex(newIndex);
  };

  const goTo = (index: number) => setActiveIndex(index);

  const animateX = -(activeIndex * (CARD_WIDTH + CARD_GAP));

  return (
    <div className="space-y-4">
      {/* Carousel track */}
      <div
        ref={containerRef}
        className="overflow-hidden -mx-1 px-1"
      >
        <motion.div
          drag="x"
          dragConstraints={{
            left: -(totalWidth - CARD_WIDTH + 20),
            right: 20,
          }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          animate={{ x: animateX }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ x: dragX }}
          className="flex cursor-grab active:cursor-grabbing"
          // Use gap via style to match CARD_GAP
        >
          {actions.map((action, index) => (
            <HistoryCard
              key={action.id}
              action={action}
              index={index}
              isActive={index === activeIndex}
              dragX={dragX}
              baseOffset={animateX}
            />
          ))}
        </motion.div>
      </div>

      {/* Pagination dots + nav */}
      {actions.length > 1 && (
        <div className="flex items-center justify-center gap-3">
          {/* Prev arrow */}
          <motion.button
            onClick={() => goTo(Math.max(0, activeIndex - 1))}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              activeIndex === 0
                ? "text-slate-700 cursor-default"
                : "text-slate-400 hover:text-white bg-white/5 hover:bg-white/10"
            }`}
            disabled={activeIndex === 0}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>

          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {actions.map((_, i) => (
              <motion.button
                key={i}
                onClick={() => goTo(i)}
                animate={{
                  width: i === activeIndex ? 20 : 6,
                  backgroundColor: i === activeIndex ? "rgb(96, 165, 250)" : "rgba(255,255,255,0.15)",
                }}
                whileHover={{ scale: 1.3 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="h-1.5 rounded-full"
              />
            ))}
          </div>

          {/* Next arrow */}
          <motion.button
            onClick={() => goTo(Math.min(actions.length - 1, activeIndex + 1))}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              activeIndex === actions.length - 1
                ? "text-slate-700 cursor-default"
                : "text-slate-400 hover:text-white bg-white/5 hover:bg-white/10"
            }`}
            disabled={activeIndex === actions.length - 1}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.button>
        </div>
      )}
    </div>
  );
}

function HistoryCard({
  action,
  index,
  isActive,
  dragX,
  baseOffset,
}: {
  action: VoiceAction;
  index: number;
  isActive: boolean;
  dragX: MotionValue<number>;
  baseOffset: number;
}) {
  const cardCenter = index * (CARD_WIDTH + CARD_GAP) + CARD_WIDTH / 2;

  const distance = useTransform(dragX, (latestX: number) => {
    const currentPos = latestX + baseOffset;
    return Math.abs(cardCenter + currentPos - CARD_WIDTH / 2);
  });

  const scale = useTransform(distance, [0, CARD_WIDTH], [1, 0.92]);
  const opacity = useTransform(distance, [0, CARD_WIDTH * 1.5], [1, 0.5]);

  return (
    <motion.div
      style={{
        width: CARD_WIDTH,
        minWidth: CARD_WIDTH,
        marginRight: CARD_GAP,
        scale,
        opacity,
      }}
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: isActive ? 1 : 0.92 }}
      transition={{
        delay: index * 0.08,
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1] as const,
      }}
      className="glass rounded-2xl p-5 flex flex-col pointer-events-none select-none"
    >
      {/* Time badge */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500/20 to-violet-500/15 flex items-center justify-center">
          <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <time className="text-slate-500 text-[10px] uppercase tracking-wider">
          {new Date(action.createdAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>

      {/* Voice transcript */}
      <p className="text-slate-300 text-sm italic leading-relaxed mb-4 line-clamp-2">
        &ldquo;{action.rawText}&rdquo;
      </p>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-3" />

      {/* Events */}
      <div className="space-y-1.5 flex-1">
        {(action.events as CreatedEvent[]).map((event, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 + 0.3 + i * 0.06, duration: 0.3, ease: "easeOut" }}
          >
            <EventCard event={event} compact />
          </motion.div>
        ))}
      </div>

      {/* Event count pill */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
        <span className="text-slate-500 text-[11px]">
          {(action.events as CreatedEvent[]).length} événement{(action.events as CreatedEvent[]).length > 1 ? "s" : ""} créé{(action.events as CreatedEvent[]).length > 1 ? "s" : ""}
        </span>
      </div>
    </motion.div>
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
            <div className="mt-5">
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
                <HistoryCarousel actions={actions} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
