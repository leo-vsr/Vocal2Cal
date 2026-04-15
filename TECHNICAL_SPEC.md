# Overview

## Goal

Vocal2Cal is a React + Express application that lets users dictate calendar requests in French, transcribe them with Gemini, review the transcript, extract structured events with Gemini again, and create those events in Google Calendar.

## Product Scope

- Browser-based audio capture
- Server-side speech-to-text and event parsing
- Google OAuth and Google Calendar creation
- Credit-based usage with Stripe subscriptions and top-ups
- Personal history and usage tracking
- Admin overview for platform metrics and user management

# Technical Stack

| Area | Current choice | Notes |
| --- | --- | --- |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4 | UI, dashboard, pricing, settings, admin |
| Motion/UI | Framer Motion | Used across the recorder, history, and dashboard transitions |
| Backend | Express + TypeScript | Session-based API exposed under `/api/*` |
| ORM | Prisma | PostgreSQL schema and generated client |
| Database | PostgreSQL | Supabase-friendly setup with pooled runtime URL + direct CLI URL |
| Auth | Passport Google OAuth 2.0 + `express-session` | Backed by a signed auth cookie for session recovery |
| AI | Google Gemini `generateContent` | Used for both transcription and event extraction |
| Current default models | `gemini-2.5-flash` | Default for both parsing and transcription unless overridden by env vars |
| Billing | Stripe | Checkout, Billing Portal, subscription lifecycle, top-ups, webhooks |
| Deployment | Vercel | `vercel.json` routes API to `api/vercel.ts` and serves the client build |

# Core Features

## Authentication

- Google OAuth 2.0 login with scopes:
  - `openid`
  - `email`
  - `profile`
  - `https://www.googleapis.com/auth/calendar.events`
- User profiles are upserted in Prisma on OAuth callback.
- Access and refresh tokens are stored server-side in the `User` table.
- The API uses `express-session`, but it also writes a signed `vocal2cal_auth` cookie so the user ID can be restored across requests and serverless invocations.
- Google access tokens are refreshed on demand through `https://oauth2.googleapis.com/token`.

## Voice Capture and Transcription

- Runtime capture uses `navigator.mediaDevices.getUserMedia()` and `MediaRecorder`.
- The client does **not** use the Web Speech API at runtime.
- Supported recording flow:
  1. Capture audio in the browser.
  2. If the browser emits WebM, convert it to WAV in the client for Gemini compatibility.
  3. Base64-encode the normalized audio.
  4. Send it to `POST /api/transcribe-audio`.
- The backend forwards the audio to Gemini with a transcription prompt and returns `{ transcript }`.
- `transcribe-audio` currently accepts Gemini-compatible MIME types normalized to:
  - `audio/ogg`
  - `audio/mp3`
  - `audio/wav`
  - `audio/flac`
  - `audio/aac`
  - `audio/aiff`
- The request is rejected above roughly `20 MB` of base64 payload.

## Event Parsing and Calendar Creation

- After transcription, the user can edit the transcript before submission.
- `POST /api/parse-events` sends plain text and browser timezone to the backend.
- The backend injects current date and time context into the Gemini parsing prompt.
- Gemini is asked to return raw JSON only, with:
  - `title`
  - `date`
  - `startTime`
  - `endTime`
  - `description`
- Relative time interpretation is prompt-driven, with defaults of:
  - date: today when omitted
  - time: `09:00` when omitted
  - duration: `+1 hour` when omitted
- Parsed events are inserted into the user's primary Google Calendar.
- Successful requests are stored in `VoiceAction`.
- One credit is deducted after successful event creation, and a `CreditTransaction` of type `USAGE` is written.

## Credits, Plans, and Billing

- Users start on `FREE` with `5` credits by Prisma default.
- Paid plans:
  - `STARTER`: `60` credits / month
  - `PRO`: `180` credits / month
  - `BUSINESS`: `600` credits / month
- Top-up packs:
  - `BOOST_20`
  - `BOOST_80`
  - `BOOST_200`
- Top-ups are restricted to active subscribers whose balance has reached `0`.
- Billing behaviors implemented in the API:
  - new subscription checkout
  - top-up checkout
  - live upgrade preview with Stripe proration preview
  - immediate upgrades
  - scheduled downgrades at period end
  - cancel at period end
  - resume a scheduled cancellation
  - Stripe Billing Portal session
- Stripe webhooks handle:
  - `checkout.session.completed`
  - `invoice.paid`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

## History, Usage, and Admin

- `/api/history` returns up to `20` recent actions for the current user.
- `/api/usage` returns:
  - current credit balance
  - current plan
  - live subscription status summary
  - usage counts for today, last 7 days, and last 30 days
  - recent credit transactions
- Admin-only routes expose:
  - user list
  - platform KPIs
  - revenue estimates
  - estimated AI costs
  - manual credit grants
  - role changes

## PWA and Mobile Status

- `client/index.html` links to `manifest.json` and mobile web app metadata.
- Icons and a `sw.js` file are present in `client/public/`.
- `sw.js` is **not** currently registered in `client/src/main.tsx`, so offline caching should be treated as inactive.

# System Architecture

## Layers

| Layer | Main files | Responsibility |
| --- | --- | --- |
| Presentation | `client/src/App.tsx`, `components/*` | Landing page, recorder, dashboard, pricing, settings, admin |
| Voice capture | `client/src/hooks/useSpeechRecognition.ts` | Record audio, normalize formats, call transcription API |
| API | `api/src/index.ts`, `routes/*` | Auth, voice flows, history, usage, Stripe, admin |
| Integrations | `api/src/lib/gemini.ts`, `google.ts`, `stripe.ts` | Gemini, Google OAuth token refresh, Calendar, Stripe |
| Persistence | `api/prisma/schema.prisma` | Users, actions, payments, credit ledger |

## Main Voice Flow

1. The browser captures audio with `MediaRecorder`.
2. The client optionally converts WebM to WAV.
3. The client sends `audioBase64` + `mimeType` to `POST /api/transcribe-audio`.
4. The backend calls Gemini transcription and returns `{ transcript }`.
5. The user can edit the transcript in the UI.
6. The client sends text + timezone to `POST /api/parse-events`.
7. The backend checks:
   - authentication
   - available credits
   - global `DAILY_AI_LIMIT`
8. The backend calls Gemini parsing with JSON output.
9. The backend refreshes the Google token if needed.
10. Events are inserted into Google Calendar.
11. The action is stored in `VoiceAction`.
12. The user's credits are decremented and a `CreditTransaction` is recorded.
13. The API returns created events and remaining credits.

## Auth Flow

1. `/api/auth/google` starts the OAuth flow.
2. `/api/auth/google/callback` upserts the user and stores `req.session.userId`.
3. The backend also writes the signed `vocal2cal_auth` cookie.
4. Future requests can authenticate through either:
   - `req.session.userId`
   - the signed auth cookie rehydrated into the session
5. `/api/auth/me` returns the frontend user payload including `role`, `credits`, and `plan`.

## Billing Flow

1. The client opens checkout via `/api/stripe/checkout`.
2. Stripe Checkout handles either a subscription or a top-up payment.
3. Webhooks persist `Payment` records and synchronize user credits and subscription metadata.
4. The settings page uses `/api/stripe/subscription-state` to render the current subscription state.
5. Upgrades are applied immediately; downgrades are scheduled with Stripe subscription schedules.

# Data Model

## Enums

- `Role`: `USER`, `ADMIN`
- `Plan`: `FREE`, `STARTER`, `PRO`, `BUSINESS`
- `TransactionType`: `SIGNUP_BONUS`, `PURCHASE`, `USAGE`, `ADMIN_GRANT`, `SUBSCRIPTION_RENEWAL`
- `PaymentKind`: `SUBSCRIPTION`, `TOP_UP`

## User

- Identity:
  - `id`
  - `name`
  - `email`
  - `image`
  - `googleId`
- Google auth:
  - `accessToken`
  - `refreshToken`
  - `tokenExpiry`
- Access and billing:
  - `role`
  - `credits`
  - `plan`
  - `stripeCustomerId`
  - `stripeSubscriptionId`
  - `subscriptionStatus`
  - `subscriptionCurrentPeriodEnd`
- Relations:
  - `voiceActions`
  - `payments`
  - `creditTransactions`

## VoiceAction

- `id`
- `userId`
- `rawText`
- `events` (JSON)
- `status`
- `createdAt`

Each row represents a successful text-to-calendar action stored in user history.

## Payment

- `id`
- `userId`
- `kind`
- `stripeSessionId`
- `stripePaymentId`
- `stripeInvoiceId`
- `stripeSubscriptionId`
- `plan`
- `amount`
- `currency`
- `creditsGranted`
- `status`
- `createdAt`

## CreditTransaction

- `id`
- `userId`
- `type`
- `amount`
- `balance`
- `description`
- `createdAt`

This table is the audit trail for usage, purchases, renewals, and admin grants.

# API Surface

## Auth and User

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/auth/google` | No | Start Google OAuth |
| GET | `/api/auth/google/callback` | No | Complete OAuth, create session, redirect to client |
| GET | `/api/auth/me` | Yes | Return current user payload |
| POST | `/api/auth/logout` | Yes | Clear cookies and destroy session |

## Voice, History, and Usage

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/transcribe-audio` | Yes + credits | Audio upload to Gemini transcription |
| POST | `/api/parse-events` | Yes + credits | Parse text, create Calendar events, deduct 1 credit on success |
| GET | `/api/history` | Yes | Last 20 actions, optionally mixed with dev mocks |
| GET | `/api/usage` | Yes | Credits, plan, subscription status, usage stats, transactions |
| GET | `/api/health` | No | Health check |

## Admin

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/admin/overview` | Admin | Dashboard payload with stats and users |
| GET | `/api/admin/users` | Admin | User list |
| GET | `/api/admin/stats` | Admin | Platform metrics only |
| POST | `/api/admin/grant-credits` | Admin | Add credits to a user |
| POST | `/api/admin/set-role` | Admin | Change `USER` / `ADMIN` role |

## Stripe and Billing

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/stripe/checkout` | Yes | Start subscription or top-up checkout |
| POST | `/api/stripe/change-plan-preview` | Yes | Preview proration for an upgrade or prepare downgrade metadata |
| POST | `/api/stripe/change-plan` | Yes | Apply an immediate upgrade |
| GET | `/api/stripe/subscription-state` | Yes | Resolve live Stripe subscription state |
| POST | `/api/stripe/schedule-plan-change` | Yes | Schedule downgrade at next billing cycle |
| POST | `/api/stripe/clear-scheduled-plan-change` | Yes | Remove a pending scheduled downgrade |
| POST | `/api/stripe/cancel-subscription` | Yes | Set `cancel_at_period_end=true` |
| POST | `/api/stripe/resume-subscription` | Yes | Remove a pending cancellation |
| POST | `/api/stripe/portal` | Yes | Open Stripe Billing Portal |
| POST | `/api/stripe/webhook` | No, signature checked | Stripe webhook endpoint |
| GET | `/api/stripe/plans` | No | Public pricing payload for plans and top-ups |

## Error Semantics

- `400`: invalid input, invalid plan, malformed request
- `401`: not authenticated or `SESSION_EXPIRED`
- `402`: `NO_CREDITS`
- `403`: forbidden admin or billing rule violation
- `404`: missing user or Stripe linkage
- `409`: Stripe state conflict or invalid subscription state transition
- `413`: audio payload too large
- `415`: unsupported audio format
- `422`: no events detected
- `429`: global daily limit reached
- `500`: integration or internal server failure

# Frontend Architecture

| File / component | Role |
| --- | --- |
| `client/src/App.tsx` | Main shell with `home`, `dashboard`, `pricing`, `settings`, and `admin` views |
| `client/src/components/VoiceRecorder.tsx` | Voice UI, transcript review, admin text-only mode, event creation |
| `client/src/components/EventCard.tsx` | Event display and Google Calendar link rendering |
| `client/src/components/History.tsx` | Lazy-loaded history panel |
| `client/src/components/UsageBar.tsx` | Compact credit and usage summary |
| `client/src/components/AdminPanel.tsx` | Admin dashboard |
| `client/src/hooks/useAuth.ts` | Fetch current user, sign-in redirect, logout |
| `client/src/hooks/useSpeechRecognition.ts` | Browser recording + transcription API wrapper |
| `client/vite.config.ts` | `@` alias and `/api` proxy to `http://localhost:3001` in development |

## Frontend Notes

- Pricing labels are currently hardcoded in `App.tsx` for presentation, even though the API also exposes `/api/stripe/plans`.
- Admin users can switch the recorder into a text-only mode that reuses the same backend parsing flow.
- The recorder shows an editable transcript instead of streaming interim browser speech recognition results.

# Configuration and Validation Notes

- `DAILY_AI_LIMIT` is a **global** limit based on today's `VoiceAction` count, not a per-user quota.
- Stripe is optional for core voice + calendar development, but required for billing features.
- `ADMIN_EMAILS` is not used by the current runtime; admin rights are stored in the database.
- There is no automated test suite yet. Use `npm run build` and manual smoke tests for:
  - Google login
  - audio transcription
  - event creation
  - history and usage
  - pricing and subscription flows
  - admin overview
