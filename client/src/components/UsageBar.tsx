import { useEffect, useState } from "react";
import type { UsageData } from "@/types";

export function UsageBar({ refreshKey }: { refreshKey?: number }) {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch("/api/usage", { credentials: "include" })
      .then((r) => r.json())
      .then((data: UsageData) => {
        if (typeof data.used === "number") setUsage(data);
      })
      .catch(() => {});
  }, [refreshKey]);

  if (!usage) return null;

  const pct = Math.min((usage.used / usage.limit) * 100, 100);

  const barColor =
    pct >= 85
      ? "bg-red-500"
      : pct >= 60
        ? "bg-amber-400"
        : "bg-blue-500";

  return (
    <div className="w-full max-w-md space-y-1.5">
      <div className="flex justify-between items-center text-xs text-slate-500">
        <span>Appels aujourd&apos;hui</span>
        <span>
          {usage.used} / {usage.limit}
        </span>
      </div>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
