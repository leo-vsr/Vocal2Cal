import { Router, Request, Response } from "express";
import passport from "passport";
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
  StrategyOptions,
} from "passport-google-oauth20";
import { prisma } from "../lib/prisma";

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

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req: Request, res: Response) => {
    // Store userId in session for our middleware
    if (req.user) {
      req.session.userId = (req.user as { id: string }).id;
    }
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    res.redirect(clientUrl);
  }
);

router.get("/me", (req: Request, res: Response) => {
  if (!req.session?.userId || !req.user) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const user = req.user as {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
    credits: number;
    plan: string;
  };

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      credits: user.credits,
      plan: user.plan,
    },
  });
});

router.post("/logout", (req: Request, res: Response) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });
});

export default router;
