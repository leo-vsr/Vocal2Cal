import { Router, Request, Response } from "express";
import passport from "passport";
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
  StrategyOptions,
} from "passport-google-oauth20";
import { prisma } from "../lib/prisma";
import { clearAuthCookie, getAuthenticatedUserId, setAuthCookie } from "../lib/auth-cookie";

const router = Router();

// ─── Passport config ─────────────────────────────────

const strategyOptions: StrategyOptions = {
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
  scope: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.events",
  ],
};

passport.use(
  new GoogleStrategy(
    strategyOptions,
    async (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: VerifyCallback
    ) => {
      try {
        const email = profile.emails?.[0]?.value || null;
        const image = profile.photos?.[0]?.value || null;

        const user = await prisma.user.upsert({
          where: { googleId: profile.id },
          update: {
            name: profile.displayName,
            email,
            image,
            accessToken,
            ...(refreshToken && { refreshToken }),
            tokenExpiry: new Date(Date.now() + 3600 * 1000),
          },
          create: {
            googleId: profile.id,
            name: profile.displayName,
            email,
            image,
            accessToken,
            refreshToken: refreshToken || null,
            tokenExpiry: new Date(Date.now() + 3600 * 1000),
          },
        });

        done(null, user);
      } catch (err) {
        done(err as Error);
      }
    }
  )
);

passport.serializeUser((user: Express.User, done) => {
  done(null, (user as { id: string }).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// ─── Routes ──────────────────────────────────────────

router.get("/google", passport.authenticate("google"));

router.get("/google/callback", (req: Request, res: Response, next) => {
  passport.authenticate("google", (err: Error | null, user: Express.User | false, info: unknown) => {
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

    if (err) {
      console.error("[oauth] Authentication error:", err.message, err);
      return res.redirect(clientUrl);
    }

    if (!user) {
      console.error("[oauth] No user returned. Info:", info);
      return res.redirect(clientUrl);
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error("[oauth] Login error:", loginErr);
        return res.redirect(clientUrl);
      }

      const userId = (user as { id: string }).id;
      req.session.userId = userId;
      setAuthCookie(res, userId);

      req.session.save(() => {
        res.redirect(clientUrl);
      });
    });
  })(req, res, next);
});

router.get("/me", async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      credits: true,
      plan: true,
    },
  });

  if (!user) {
    clearAuthCookie(res);
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  setAuthCookie(res, user.id);

  res.json({
    user,
  });
});

router.post("/logout", (req: Request, res: Response) => {
  clearAuthCookie(res);
  req.logout(() => {
    if (!req.session) {
      res.json({ success: true });
      return;
    }

    req.session.destroy(() => {
      res.clearCookie("connect.sid", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
      });
      res.json({ success: true });
    });
  });
});

export default router;
