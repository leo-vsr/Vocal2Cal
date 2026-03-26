import { Router, Request, Response } from "express";
import { requireAdmin } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/admin/users — List all users with stats
router.get("/users", requireAdmin, async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      credits: true,
      plan: true,
      createdAt: true,
      _count: { select: { voiceActions: true, payments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ users });
});

// GET /api/admin/stats — Global platform statistics
router.get("/stats", requireAdmin, async (_req: Request, res: Response) => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);
  const startOfMonth = new Date(now);
  startOfMonth.setDate(now.getDate() - 30);

  const [
    totalUsers,
    totalActions,
    actionsToday,
    actionsWeek,
    actionsMonth,
    totalRevenue,
    revenueMonth,
    planDistribution,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.voiceAction.count(),
    prisma.voiceAction.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.voiceAction.count({ where: { createdAt: { gte: startOfWeek } } }),
    prisma.voiceAction.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.payment.aggregate({
      where: { status: "completed" },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "completed", createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.user.groupBy({
      by: ["plan"],
      _count: true,
    }),
  ]);

  // Estimate API cost: ~$0.0001 per call (Gemini Flash)
  const estimatedApiCostPerCall = 0.0001;
  const estimatedTotalApiCost = totalActions * estimatedApiCostPerCall;
  const estimatedMonthApiCost = actionsMonth * estimatedApiCostPerCall;

  res.json({
    users: {
      total: totalUsers,
      planDistribution: planDistribution.map((p) => ({
        plan: p.plan,
        count: p._count,
      })),
    },
    actions: {
      total: totalActions,
      today: actionsToday,
      week: actionsWeek,
      month: actionsMonth,
    },
    revenue: {
      total: (totalRevenue._sum.amount || 0) / 100, // cents → euros
      month: (revenueMonth._sum.amount || 0) / 100,
    },
    apiCosts: {
      estimatedTotal: Math.round(estimatedTotalApiCost * 100) / 100,
      estimatedMonth: Math.round(estimatedMonthApiCost * 100) / 100,
      costPerCall: estimatedApiCostPerCall,
    },
    margin: {
      totalRevenue: (totalRevenue._sum.amount || 0) / 100,
      totalCosts: Math.round(estimatedTotalApiCost * 100) / 100,
      netProfit: Math.round(((totalRevenue._sum.amount || 0) / 100 - estimatedTotalApiCost) * 100) / 100,
    },
  });
});

// POST /api/admin/grant-credits — Grant credits to a user
router.post("/grant-credits", requireAdmin, async (req: Request, res: Response) => {
  const { userId, amount, reason } = req.body as {
    userId?: string;
    amount?: number;
    reason?: string;
  };

  if (!userId || !amount || amount <= 0) {
    res.status(400).json({ error: "userId et amount (> 0) requis" });
    return;
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    });

    await prisma.creditTransaction.create({
      data: {
        userId,
        type: "ADMIN_GRANT",
        amount,
        balance: updatedUser.credits,
        description: reason || `Attribution admin de ${amount} crédits`,
      },
    });

    res.json({ success: true, newBalance: updatedUser.credits });
  } catch {
    res.status(404).json({ error: "Utilisateur introuvable" });
  }
});

// POST /api/admin/set-role — Change user role
router.post("/set-role", requireAdmin, async (req: Request, res: Response) => {
  const { userId, role } = req.body as { userId?: string; role?: string };

  if (!userId || !role || !["USER", "ADMIN"].includes(role)) {
    res.status(400).json({ error: "userId et role (USER/ADMIN) requis" });
    return;
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role: role as "USER" | "ADMIN" },
    });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: "Utilisateur introuvable" });
  }
});

export default router;
