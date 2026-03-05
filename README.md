# Vocal2Cal

Voice-powered Google Calendar event planner — Dictate your events in French and they are automatically added to your Google Calendar.

## Quick Start

```bash
git clone https://github.com/leo-vsr/Vocal2Cal.git
cd Vocal2Cal
npm install
cp api/.env.example api/.env   # fill in your credentials
cd api && npx prisma db push && cd ..
npm run dev
```

- **Client**: http://localhost:5173
- **API**: http://localhost:3001

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS 4
- **Backend**: Node.js + Express + TypeScript + Prisma
- **Database**: PostgreSQL (Supabase)
- **Auth**: Google OAuth 2.0 (Passport.js)
- **AI**: Gemini 2.5 Flash
- **Hosting**: Vercel (serverless)

## Documentation

- [Technical Specification (EN)](./TECHNICAL_SPEC.md)
- [Spécification Technique (FR)](./TECHNICAL_SPEC_FR.md)

## Environment Variables

See [`api/.env.example`](./api/.env.example) for the full list.

## License

MIT
