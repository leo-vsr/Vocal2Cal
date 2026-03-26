import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { AdminStats, AdminUser } from "@/types";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

export function AdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [statsRes, usersRes] = await Promise.all([
          fetch("/api/admin/stats", { credentials: "include" }),
          fetch("/api/admin/users", { credentials: "include" }),
        ]);

        if (!statsRes.ok || !usersRes.ok) {
          setError("Accès refusé ou erreur serveur");
          return;
        }

        const statsData = await statsRes.json();
        const usersData = await usersRes.json();
        setStats(statsData);
        setUsers(usersData.users);
      } catch {
        setError("Impossible de charger les données admin");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Utilisateurs", value: stats.users.total, color: "text-blue-400" },
          { label: "Appels IA (total)", value: stats.actions.total, color: "text-cyan-400" },
          { label: "Revenu total", value: `${stats.revenue.total.toFixed(2)}€`, color: "text-green-400" },
          { label: "Profit net", value: `${stats.margin.netProfit.toFixed(2)}€`, color: "text-emerald-400" },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: i * 0.06, duration: 0.3 }}
            className="glass rounded-2xl border border-white/6 p-5"
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{kpi.label}</p>
            <p className={`mt-2 text-2xl font-bold tracking-tight ${kpi.color}`}>{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Usage & Revenue breakdown */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="glass rounded-2xl border border-white/6 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Appels IA</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Aujourd&apos;hui</span><span className="text-white font-medium">{stats.actions.today}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">7 derniers jours</span><span className="text-white font-medium">{stats.actions.week}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">30 derniers jours</span><span className="text-white font-medium">{stats.actions.month}</span></div>
          </div>
        </div>

        <div className="glass rounded-2xl border border-white/6 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Revenu</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Total</span><span className="text-green-400 font-medium">{stats.revenue.total.toFixed(2)}€</span></div>
            <div className="flex justify-between"><span className="text-slate-400">30 derniers jours</span><span className="text-green-400 font-medium">{stats.revenue.month.toFixed(2)}€</span></div>
          </div>
        </div>

        <div className="glass rounded-2xl border border-white/6 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Co&ucirc;ts API (estimation)</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Total</span><span className="text-amber-400 font-medium">{stats.apiCosts.estimatedTotal.toFixed(4)}€</span></div>
            <div className="flex justify-between"><span className="text-slate-400">30 derniers jours</span><span className="text-amber-400 font-medium">{stats.apiCosts.estimatedMonth.toFixed(4)}€</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Par appel</span><span className="text-slate-300">{stats.apiCosts.costPerCall}€</span></div>
          </div>
        </div>
      </div>

      {/* Plan distribution */}
      <div className="glass rounded-2xl border border-white/6 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">R&eacute;partition des plans</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {stats.users.planDistribution.map((p) => (
            <div key={p.plan} className="flex items-center gap-2 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-sm">
              <span className="font-medium text-white">{p.plan}</span>
              <span className="text-slate-400">{p.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Users table */}
      <div className="glass rounded-2xl border border-white/6 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Utilisateurs ({users.length})</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/6 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <th className="pb-3 pr-4">Utilisateur</th>
                <th className="pb-3 pr-4">Plan</th>
                <th className="pb-3 pr-4">Cr&eacute;dits</th>
                <th className="pb-3 pr-4">Actions</th>
                <th className="pb-3 pr-4">R&ocirc;le</th>
                <th className="pb-3">Inscription</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/4">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      {u.image && <img src={u.image} alt="" className="h-6 w-6 rounded-full" />}
                      <div>
                        <p className="text-white">{u.name || "—"}</p>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-slate-300">{u.plan}</span>
                  </td>
                  <td className="py-3 pr-4 text-slate-300">{u.credits}</td>
                  <td className="py-3 pr-4 text-slate-300">{u._count.voiceActions}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-medium ${u.role === "ADMIN" ? "text-amber-400" : "text-slate-400"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 text-slate-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
