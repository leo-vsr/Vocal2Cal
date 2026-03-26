import { useEffect, useState, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, useInView } from "framer-motion";
import type { UsageData } from "@/types";

const PLAN_LABELS: Record<string, string> = {
  FREE: "Découverte",
  STARTER: "Starter",
  PRO: "Pro",
  BUSINESS: "Business",
};

interface UsageBarProps {
  refreshKey?: number;
  className?: string;
}

export function UsageBar({ refreshKey, className = "" }: UsageBarProps) {
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
        if (typeof data.credits === "number") setUsage(data);
      })
      .catch(() => {});
  }, [refreshKey]);

  useEffect(() => {
    if (usage && isInView) {
      const pct = usage.credits > 0 ? Math.min(100, Math.max(5, (usage.credits / Math.max(usage.credits, 50)) * 100)) : 0;
      motionWidth.set(pct);
    }
  }, [usage, isInView, motionWidth]);

  if (!usage) return null;

  const barColor =
    usage.credits <= 2
      ? "bg-red-500"
      : usage.credits <= 10
        ? "bg-amber-400"
        : "bg-blue-500";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`w-full max-w-md space-y-2 ${className}`.trim()}
    >
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-500">
          Cr&eacute;dits restants &middot; <span className="text-slate-400">{PLAN_LABELS[usage.plan] || usage.plan}</span>
        </span>
        <span className={`font-semibold ${usage.credits <= 2 ? "text-red-400" : "text-slate-300"}`}>
          {usage.credits}
        </span>
      </div>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: widthPercent }}
        />
      </div>
      <div className="flex justify-between items-center text-[10px] text-slate-600">
        <span>Aujourd&apos;hui : {usage.usage.today} appel{usage.usage.today !== 1 ? "s" : ""}</span>
        <span>Moy. {usage.usage.avgPerDay}/jour</span>
      </div>
    </motion.div>
  );
}
