import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Non authentifié" });
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
