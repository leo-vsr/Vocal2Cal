# Vocal2Cal

> Voice-powered Google Calendar event planner — Dictate your events in French and they are automatically added to your Google Calendar.

---

# Overview

## Goal

A PWA that lets users dictate calendar events by voice in French. The app transcribes speech, uses AI to extract structured event data (title, date, time), and automatically creates events in Google Calendar. Deployed serverless on Vercel.

## Users

Any Google account holder who wants a fast, hands-free way to add events to their calendar. The app supports multiple events in a single utterance (e.g. *"Meeting tomorrow at 10am and dentist on Tuesday at 4:30pm"*).

---

# Technical Stack

## Frontend

React 19, TypeScript, Vite, TailwindCSS 4.

## Backend

Node.js, Express, TypeScript, Prisma ORM.

## Database

PostgreSQL (Supabase) — managed Postgres with connection pooling.

## Auth

Google OAuth 2.0 via Passport.js — delegated auth with Google Calendar API scope.

## AI

Gemini 1.5 Flash — multilingual NLP with native JSON output (`responseMimeType: "application/json"`).

## DevOps

Hosting: Vercel (serverless). Auto-deploy on push. Edge network, scale to zero.

---

# Core Features

## Voice Recognition

- Uses the Web Speech API (Chromium browsers: Chrome, Edge)
- Continuous listening in French (`fr-FR`)
- Real-time transcript display
- Start/stop toggle with visual feedback (pulse animation)

## AI Event Parsing

- Gemini 1.5 Flash extracts structured events from natural language French text
- Supports multiple events in a single phrase
- Context-aware: injects current date, day of week, and time into the prompt
- Handles relative dates: "tomorrow", "next Monday", "in 3 days"
- Default time (09:00) and duration (+1h) when not specified
- Output: JSON array of `{ title, date, startTime, endTime, description }`

## Google Calendar Integration

- Automatic event creation on the user's primary calendar
- OAuth token refresh handling (transparent re-auth if token expired)
- Each created event includes a direct link to Google Calendar
- Timezone: `Europe/Paris`

## Rate Limiting

- Configurable daily AI call limit (`DAILY_AI_LIMIT` env var, default: 50)
- Global limit across all users (counted via `VoiceAction` records in DB)
- Resets automatically at midnight
- Returns HTTP 429 when limit reached

## History

- Last 20 voice actions stored per user
- Each record contains the raw transcript and created events
- Toggleable history panel in the UI

## PWA

- Installable on mobile (manifest + Service Worker)
- Dark theme, mobile-first responsive design
- Safe area support for iPhone X+

---

# System Architecture

## Layers

| Layer | Component | Responsibility |
| --- | --- | --- |
| Presentation | React SPA (`client/`) | UI, voice capture, state management |
| API | Express (`api/`) | Routing, sessions, auth middleware |
| Business Logic | Handlers + `lib/` | AI parsing, Calendar API, rate limiting |
| Persistence | Supabase (PostgreSQL) | Users, OAuth tokens, action history |

## Main Flow (voice → calendar)

1. User speaks → **Web Speech API** transcribes to text
2. Client sends `POST /api/parse-events` with transcript
3. `requireAuth` middleware verifies session
4. Daily AI usage limit checked against DB
5. **Gemini 1.5 Flash** parses text → structured JSON events
6. Google OAuth token refreshed if expired
7. Events created via **Google Calendar API**
8. Action saved to Supabase (`VoiceAction`)
9. Response sent to client → events displayed with Calendar links

---

# Data Model (Supabase / Prisma)

## Tables

### User

| Column | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | Primary key |
| `googleId` | String | Unique — Google identifier |
| `email` | String? | Google profile email |
| `name` | String? | Google profile display name |
| `image` | String? | Google profile avatar URL |
| `accessToken` | Text? | OAuth access token (server-side only) |
| `refreshToken` | Text? | OAuth refresh token (server-side only) |
| `tokenExpiry` | DateTime? | Auto-refreshed when expired |
| `createdAt` | DateTime | Record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

### VoiceAction

| Column | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | Primary key |
| `userId` | String | FK → `User.id` (cascade delete) |
| `rawText` | Text | Original French transcript |
| `events` | Json | Array of `{ title, date, startTime, endTime, description? }` |
| `status` | String | Default: `"success"` |
| `createdAt` | DateTime | Record creation timestamp |

---

# API Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/auth/google` | No | Initiates Google OAuth flow |
| `GET` | `/api/auth/google/callback` | No | OAuth callback → session → redirect to client |
| `GET` | `/api/auth/me` | Yes | Returns user profile or 401 |
| `POST` | `/api/auth/logout` | Yes | Destroys session |
| `POST` | `/api/parse-events` | Yes | Main endpoint: text → AI → Calendar events |
| `GET` | `/api/history` | Yes | Last 20 voice actions for the user |
| `GET` | `/api/usage` | Yes | `{ used, limit }` — daily AI usage counter |
| `GET` | `/api/health` | No | Health check |

### Error Format

All errors follow a uniform format: `{ error: string }`.

| Code | Meaning |
| --- | --- |
| 400 | Missing input |
| 401 | Not authenticated / `SESSION_EXPIRED` (triggers re-auth) |
| 422 | No events detected in the phrase |
| 429 | Daily AI limit reached |
| 500 | Internal server error |

---

# Frontend Architecture

| Component / Hook | Role |
| --- | --- |
| `App.tsx` | Root layout, auth gate, orchestrates child components |
| `VoiceRecorder` | Mic button + voice capture, calls `POST /api/parse-events` |
| `EventCard` | Displays a created event with Google Calendar link |
| `History` | Lists past actions from `/api/history` |
| `UsageBar` | AI usage progress bar from `/api/usage` |
| `useAuth()` | Auth lifecycle: check `/me`, signIn (redirect), signOut |
| `useSpeechRecognition()` | Wraps Web Speech API (`fr-FR`), manages transcript |

---

# Project Structure

```
Vocal2Cal/
├── api/                    # Express backend
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   ├── src/
│   │   ├── index.ts        # Express entry point
│   │   ├── lib/
│   │   │   ├── prisma.ts   # Prisma client singleton
│   │   │   ├── mistral.ts  # Gemini AI event parsing
│   │   │   └── google.ts   # Google Calendar + OAuth helpers
│   │   ├── middleware/
│   │   │   └── auth.ts     # requireAuth middleware
│   │   └── routes/
│   │       ├── auth.ts     # Google OAuth routes
│   │       └── events.ts   # parse-events, history, usage routes
│   ├── vercel.ts           # Vercel serverless entry point
│   └── package.json
├── client/                 # React frontend
│   ├── public/             # Static assets (icons, manifest, sw)
│   ├── src/
│   │   ├── App.tsx         # Main component
│   │   ├── components/
│   │   │   ├── VoiceRecorder.tsx
│   │   │   ├── EventCard.tsx
│   │   │   ├── History.tsx
│   │   │   └── UsageBar.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useSpeechRecognition.ts
│   │   └── types/
│   │       ├── index.ts
│   │       └── speech.d.ts
│   └── package.json
├── vercel.json             # Vercel deployment config
└── package.json            # Root scripts (concurrently)
```

---

# Getting Started

## Prerequisites

- Node.js 18+
- A Supabase project (PostgreSQL)
- Google Cloud Console: OAuth 2.0 Client ID with Google Calendar API enabled
- Gemini API key (Google AI Studio)

## 1. Clone and install

```bash
git clone https://github.com/leo-vsr/Vocal2Cal.git
cd Vocal2Cal
npm install
```

## 2. Configure environment variables

```bash
cp api/.env.example api/.env
```

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Supabase PostgreSQL connection string (use Session Pooler, port 6543) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3001/api/auth/google/callback` (dev) |
| `GEMINI_API_KEY` | Gemini API key |
| `GEMINI_MODEL` | Model name (default: `gemini-1.5-flash`) |
| `DAILY_AI_LIMIT` | Max AI calls/day (default: `50`) |
| `SESSION_SECRET` | Random string, min 32 characters |
| `CLIENT_URL` | `http://localhost:5173` (dev) |
| `NODE_ENV` | `development` (dev) / `production` (prod) |

## 3. Initialize the database

```bash
cd api
npx prisma db push
```

## 4. Run in development

```bash
npm run dev
```

Starts both services concurrently:
- **API**: http://localhost:3001
- **Client**: http://localhost:5173

The Vite dev server proxies `/api/*` requests to the backend automatically.

---

# Deploying to Vercel

1. Push the repo to GitHub
2. Import the project in Vercel
3. Add all environment variables in Vercel project settings
4. Set `GOOGLE_CALLBACK_URL` to `https://<your-domain>.vercel.app/api/auth/google/callback`
5. Set `CLIENT_URL` to `https://<your-domain>.vercel.app`
6. Set `NODE_ENV` to `production`
7. In Google Cloud Console, add the Vercel domain to:
   - **Authorized JavaScript origins**: `https://<your-domain>.vercel.app`
   - **Authorized redirect URIs**: `https://<your-domain>.vercel.app/api/auth/google/callback`

---

# Team Delegation Guide

- **Frontend dev**: owns `client/`. Consumes the API as documented in the API Endpoints section. No need to know about Gemini or Calendar internals.
- **Backend dev**: owns `api/`. Implements the contracts from the Data Model and API sections. No need to know React or styling.
- **DevOps**: owns `vercel.json` + environment variables + Supabase provisioning.
- **AI / Prompt engineering**: owns the prompt in `lib/mistral.ts`. Can iterate independently as long as the `ParsedEvent` interface remains stable.
