import { useEffect, useState, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, useInView } from "framer-motion";
import type { UsageData } from "@/types";

export function UsageBar({ refreshKey }: { refreshKey?: number }) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  const motionWidth = useMotionValue(0);
  const springWidth = useSpring(motionWidth, { stiffness: 80, damping: 20 });
  const widthPercent = useTransform(springWidth, (v) => `${v}%`);

  useEffect(() => {
    fetch("/api/usage", { credentials: "include" })
      .then((r) => r.json())
      .then((data: UsageData) => {
        if (typeof data.used === "number") setUsage(data);
      })
      .catch(() => {});
  }, [refreshKey]);

  useEffect(() => {
    if (usage && isInView) {
      const pct = Math.min((usage.used / usage.limit) * 100, 100);
      motionWidth.set(pct);
    }
  }, [usage, isInView, motionWidth]);

  if (!usage) return null;

  const pct = Math.min((usage.used / usage.limit) * 100, 100);

  const barColor =
    pct >= 85
      ? "bg-red-500"
      : pct >= 60
        ? "bg-amber-400"
        : "bg-blue-500";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-md space-y-1.5"
    >
      <div className="flex justify-between items-center text-xs text-slate-500">
        <span>Appels aujourd&apos;hui</span>
        <span>
          {usage.used} / {usage.limit}
        </span>
      </div>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: widthPercent }}
        />
      </div>
    </motion.div>
  );
}
