# Vocal2Cal

Vocal2Cal turns spoken or dictated calendar requests into Google Calendar events. The browser records audio, the API transcribes it with Gemini, the user can review the transcript, and the backend creates the events in Google Calendar.

## Current Product Scope

- Browser microphone capture with `getUserMedia` + `MediaRecorder`
- Server-side transcription via Gemini through `POST /api/transcribe-audio`
- Structured event extraction via Gemini through `POST /api/parse-events`
- Google OAuth login and Google Calendar event creation
- Credit-based usage, Stripe subscriptions, top-ups, and billing portal
- Per-user history, usage metrics, and an admin overview
- Vercel deployment target with PostgreSQL persistence

## Important Implementation Note

The runtime voice flow does **not** use the Web Speech API. The client records audio, optionally converts WebM to WAV for Gemini compatibility, then sends the audio to the API for transcription.

Current default AI model configuration in the repository:

- `GEMINI_PARSE_MODEL=gemini-2.5-flash`
- `GEMINI_TRANSCRIBE_MODEL=gemini-2.5-flash`
- `GEMINI_MODEL` can still be used as a shared fallback

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS 4, Framer Motion
- Backend: Express, TypeScript, Prisma, Passport
- Database: PostgreSQL (Supabase-friendly)
- Auth: Google OAuth 2.0 + cookie/session-based auth
- AI: Google Gemini via `generateContent`
- Billing: Stripe Checkout, Billing Portal, subscriptions, top-ups, webhooks
- Deployment: Vercel (`vercel.json`, `api/vercel.ts`)

## Repository Layout

- `client/`: React SPA and UI components
- `api/`: Express API, Prisma schema, Google/Gemini/Stripe integrations
- `README.md`: project overview and setup
- `TECHNICAL_SPEC.md`: English technical specification
- `TECHNICAL_SPEC_FR.md`: French technical specification

## Project Status

Private repository. Internal project documentation only.

## Quick Start

```bash
npm install
cp api/.env.example api/.env
cd api && npx prisma db push && cd ..
npm run dev
```

Local URLs:

- Client: `http://localhost:5173`
- API: `http://localhost:3001`

## Useful Commands

- `npm install`: install root, API, and client dependencies
- `npm run dev`: start API and client together
- `npm run build`: build both apps
- `npm run build --prefix api`: compile backend into `api/dist`
- `npm run build --prefix client`: type-check and build the frontend
- `cd api && npx prisma generate`: regenerate Prisma client
- `cd api && npx prisma db push`: apply schema changes in development

## Billing and Credits

- New users start on the `FREE` plan with `5` credits.
- `STARTER`, `PRO`, and `BUSINESS` grant `60`, `180`, and `600` credits per billing cycle.
- Top-ups are only available to active subscribers whose balance has reached `0`.
- One credit is deducted after a successful `parse-events` request that creates Google Calendar events.

## Documentation

- [Technical Specification (EN)](./TECHNICAL_SPEC.md)
- [Technical Specification (FR)](./TECHNICAL_SPEC_FR.md)

## Current Notes

- PWA metadata is present (`manifest.json`, icons, `sw.js`), but `sw.js` is not currently registered in `client/src/main.tsx`, so offline caching is not active.
- There is no automated test suite yet. Treat `npm run build` plus manual checks for auth, dictation, history, usage, billing, and admin as the minimum validation path.
