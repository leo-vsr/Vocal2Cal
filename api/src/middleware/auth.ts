import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { getAuthenticatedUserId } from "../lib/auth-cookie";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== "ADMIN") {
      res.status(403).json({ error: "Accès réservé aux administrateurs" });
      return;
    }

    next();
  } catch (error) {
    console.error("[auth] Failed to validate admin access", error);
    res.status(500).json({ error: "Impossible de vérifier les droits administrateur" });
  }
}

export async function requireCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });

  if (!user || user.credits <= 0) {
    res.status(402).json({ error: "NO_CREDITS", message: "Crédits insuffisants. Achetez un pack pour continuer." });
    return;
  }

  next();
}

// Extend express-session types
declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}
