import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { role: true },
  });

  if (!user || user.role !== "ADMIN") {
    res.status(403).json({ error: "Accès réservé aux administrateurs" });
    return;
  }

  next();
}

export async function requireCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
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
