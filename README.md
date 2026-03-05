# Vocal2Cal

Voice-powered Google Calendar event planner — Dictate your events in French and they are automatically added to your Google Calendar.

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 19 + TypeScript + Vite + TailwindCSS 4 |
| **Backend** | Node.js + Express + TypeScript |
| **ORM** | Prisma |
| **Database** | PostgreSQL (Supabase) |
| **Auth** | Google OAuth 2.0 (Passport.js) |
| **AI** | Gemini 1.5 Flash (event parsing) |
| **Hosting** | Vercel (serverless) |

## Project Structure

```
Vocal2Cal/
├── api/                    # Express backend
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   ├── src/
│   │   ├── index.ts        # Express entry point
│   │   ├── lib/            # Prisma, Gemini, Google Calendar helpers
│   │   ├── middleware/      # Auth middleware
│   │   └── routes/         # Auth & Events routes
│   ├── vercel.ts           # Vercel serverless entry point
│   └── package.json
├── client/                 # React frontend
│   ├── public/             # Static assets (icons, manifest, sw)
│   ├── src/
│   │   ├── App.tsx         # Main component
│   │   ├── components/     # EventCard, History, UsageBar, VoiceRecorder
│   │   ├── hooks/          # useAuth, useSpeechRecognition
│   │   └── types/          # TypeScript types
│   └── package.json
├── vercel.json             # Vercel config
└── package.json            # Root scripts
```

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (PostgreSQL)
- Google Cloud Console: OAuth 2.0 Client ID with Google Calendar API enabled
- Gemini API key

### 1. Clone and install

```bash
git clone https://github.com/leo-vsr/Vocal2Cal.git
cd Vocal2Cal
npm install
```

### 2. Configure environment variables

Copy the example file and fill in the values:

```bash
cp api/.env.example api/.env
```

Required variables:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL (`http://localhost:3001/api/auth/google/callback` for local dev) |
| `GEMINI_API_KEY` | Gemini API key |
| `GEMINI_MODEL` | Gemini model name (default: `gemini-1.5-flash`) |
| `DAILY_AI_LIMIT` | Max AI calls per day across all users (default: `50`) |
| `SESSION_SECRET` | Express session secret (min 32 characters) |
| `CLIENT_URL` | Frontend URL (`http://localhost:5173` for local dev) |

### 3. Initialize the database

```bash
cd api
npx prisma db push
```

### 4. Run in development

```bash
# From the project root
npm run dev
```

This starts both services concurrently:
- **API**: `http://localhost:3001`
- **Client**: `http://localhost:5173`

The Vite dev server automatically proxies `/api/*` requests to the backend.

## Deploying to Vercel

1. Push the repo to GitHub
2. Import the project in Vercel
3. Add all environment variables in Vercel project settings
4. Set `GOOGLE_CALLBACK_URL` and `CLIENT_URL` to your Vercel domain
5. Add the Vercel domain to **Authorized JavaScript origins** and **Authorized redirect URIs** in Google Cloud Console

## Features

- **Voice recognition**: Uses the Web Speech API (Chrome/Edge)
- **AI parsing**: Gemini 1.5 Flash extracts calendar events from natural language in French
- **Google Calendar**: Automatic event creation with token refresh handling
- **Daily usage limit**: Configurable global rate limit to control AI costs
- **History**: Voice actions stored in database
- **PWA**: Installable on mobile with Service Worker
- **Responsive**: Mobile-first design with safe area support for iPhone X+
