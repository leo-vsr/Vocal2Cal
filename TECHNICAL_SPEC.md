# Overview

## Goal

A PWA that lets users dictate calendar events by voice. The app transcribes speech, uses AI to extract structured event data (title, date, time), and automatically creates events in Google Calendar. Deployed serverless on Vercel.

## Users

Any Google account holder who wants a fast, hands-free way to add events to their calendar. The app supports multiple events in a single utterance (e.g. *"Meeting tomorrow at 10am and dentist on Tuesday at 4:30pm"*).

# Technical Stack

## Frontend

React 19, TypeScript, Vite, TailwindCSS 4.

## Backend

Node.js, Express, TypeScript, Prisma ORM.

## Database

PostgreSQL (Supabase): managed Postgres with connection pooling.

## Auth

Google OAuth 2.0 via Passport.js: delegated auth with Google Calendar API scope.

## AI

Gemini 1.5 Flash: multilingual NLP with native JSON output (`responseMimeType: "application/json"`).

## DevOps

Hosting: Vercel (serverless). Auto-deploy on push.

# Core Features

## Authentication

- Google OAuth 2.0 (SSO) via Passport.js
- Session-based auth with `express-session`
- Scopes: `openid`, `email`, `profile`, `calendar.events`
- Automatic token refresh when expired
- Session stored server-side, cookie sent to client (`httpOnly`, `secure` in production)

## Voice Recognition

- Web Speech API (Chromium browsers: Chrome, Edge)
- Continuous listening in French (`fr-FR`)
- Real-time transcript display
- Start/stop toggle with visual feedback (pulse animation)

## AI Event Parsing

- Gemini 1.5 Flash extracts structured events from natural language text
- Supports multiple events in a single phrase
- Context-aware: injects current date, day of week, and time into the prompt
- Handles relative dates: "tomorrow", "next Monday", "in 3 days"
- Default time (09:00) and duration (+1h) when not specified
- Forced JSON output via `responseMimeType: "application/json"`
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

## Architectural Choices

- **TypeScript end-to-end**: shared interfaces (`ParsedEvent`, `CreatedEvent`, `User`) between client and server avoid contract drift.
- **Supabase**: managed PostgreSQL with connection pooling (Session Pooler, port 6543) eliminates infrastructure management. No need for a separate connection pool like PgBouncer.
- **Prisma ORM**: auto-generated TypeScript types from the schema ensure compile-time safety on all DB queries.
- **Serverless (Vercel)**: the Express app is wrapped as a single serverless function (`api/vercel.ts`). Preview deployments are created automatically per PR. Scale to zero when idle.
- **Gemini `responseMimeType`**: by forcing `application/json` at the model level, we avoid markdown fencing and malformed JSON. Combined with a low temperature (0.1), the output is deterministic and parseable.
- **Session-based auth over JWT**: simpler for a server-rendered OAuth flow. The session is stored in memory (dev) or could be backed by a store (production). Cookie-based approach avoids token management on the client.

# Data Model (Supabase / Prisma)

## Tables

### User

- id: String (cuid), primary key
- googleId: String, unique — Google identifier
- email: String?, Google profile email
- name: String?, Google profile display name
- image: String?, Google profile avatar URL
- accessToken: Text?, OAuth access token (server-side only)
- refreshToken: Text?, OAuth refresh token (server-side only)
- tokenExpiry: DateTime?, auto-refreshed when expired
- createdAt: DateTime
- updatedAt: DateTime

### VoiceAction

- id: String (cuid), primary key
- userId: String, FK → User.id (cascade delete)
- rawText: Text, original transcript
- events: Json, array of `{ title, date, startTime, endTime, description? }`
- status: String, default: "success"
- createdAt: DateTime

## Relationships

- User → VoiceAction: one-to-many (a user has many voice actions)
- VoiceAction → User: many-to-one with cascade delete (deleting a user deletes all their actions)

# API Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | /api/auth/google | No | Initiates Google OAuth flow |
| GET | /api/auth/google/callback | No | OAuth callback → session → redirect to client |
| GET | /api/auth/me | Yes | Returns user profile or 401 |
| POST | /api/auth/logout | Yes | Destroys session |
| POST | /api/parse-events | Yes | Main endpoint: text → AI → Calendar events |
| GET | /api/history | Yes | Last 20 voice actions for the user |
| GET | /api/usage | Yes | `{ used, limit }` — daily AI usage counter |
| GET | /api/health | No | Health check |

## Error Format

All errors follow a uniform format: `{ error: string }`.

- 400: Missing input
- 401: Not authenticated / `SESSION_EXPIRED` (triggers re-auth on client)
- 422: No events detected in the phrase
- 429: Daily AI limit reached
- 500: Internal server error

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

## Client-Server Communication

- All API calls use `fetch` with `credentials: "include"` for cookie-based sessions
- The Vite dev server proxies `/api/*` to `http://localhost:3001` in development
- In production, Vercel routes handle `/api/*` → serverless function
- Responses are parsed as text first, then `JSON.parse` with error fallback to handle malformed responses gracefully

# Team Delegation Guide

- **Frontend dev**: owns `client/`. Consumes the API as documented above. No need to know about Gemini or Calendar internals.
- **Backend dev**: owns `api/`. Implements the contracts from the Data Model and API sections. No need to know React or styling.
- **DevOps**: owns `vercel.json` + environment variables + Supabase provisioning.
- **AI / Prompt engineering**: owns the prompt in `lib/mistral.ts`. Can iterate independently as long as the `ParsedEvent` interface remains stable.
