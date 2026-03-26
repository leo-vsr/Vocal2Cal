import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import authRoutes from "./routes/auth";
import eventRoutes from "./routes/events";
import stripeRoutes from "./routes/stripe";
import adminRoutes from "./routes/admin";

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Raw body for Stripe webhook (must be before express.json)
app.use(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" })
);

app.use(express.json({ limit: "25mb" }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "vocal2cal-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ─── Routes ──────────────────────────────────────────

app.use("/api/auth", authRoutes);
app.use("/api", eventRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/admin", adminRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Start (only in dev, not on Vercel) ──────────────

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`🚀 API server running on http://localhost:${PORT}`);
  });
}

export default app;
