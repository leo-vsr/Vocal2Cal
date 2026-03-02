# Vocal2Cal v2

Planificateur vocal d'événements Google Agenda — Dictez vos événements en français et ils sont automatiquement ajoutés à votre agenda.

## Stack technique

| Couche | Technologie |
| --- | --- |
| **Frontend** | React 19 + TypeScript + Vite + TailwindCSS 4 |
| **Backend** | Node.js + Express + TypeScript |
| **ORM** | Prisma |
| **Base de données** | PostgreSQL (Supabase) |
| **Auth** | Google OAuth 2.0 (Passport.js) |
| **IA** | Mistral AI (parsing des événements) |
| **Hébergement** | Vercel |

## Structure du projet

```
Vocal2Cal-v2/
├── api/                    # Backend Express
│   ├── prisma/
│   │   └── schema.prisma   # Schéma de la BDD
│   ├── src/
│   │   ├── index.ts        # Point d'entrée Express
│   │   ├── lib/            # Prisma, Mistral, Google Calendar
│   │   ├── middleware/      # Auth middleware
│   │   └── routes/         # Auth & Events routes
│   └── package.json
├── client/                 # Frontend React
│   ├── public/             # Assets statiques (icons, manifest, sw)
│   ├── src/
│   │   ├── App.tsx         # Composant principal
│   │   ├── components/     # EventCard, History, UsageBar, VoiceRecorder
│   │   ├── hooks/          # useAuth, useSpeechRecognition
│   │   └── types/          # TypeScript types
│   └── package.json
├── vercel.json             # Config Vercel
└── package.json            # Scripts root
```

## Installation

### Prérequis

- Node.js 18+
- Un projet Supabase (PostgreSQL)
- Google Cloud Console : OAuth 2.0 Client ID avec Google Calendar API activée
- Clé API Mistral

### 1. Cloner et installer

```bash
git clone https://github.com/leo-vsr/Vocal2Cal-v2.git
cd Vocal2Cal-v2
npm install
```

### 2. Configurer les variables d'environnement

Copier le fichier d'exemple et remplir les valeurs :

```bash
cp api/.env.example api/.env
```

Variables requises :

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | URL PostgreSQL Supabase |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | Callback URL (`http://localhost:3001/api/auth/google/callback` en dev) |
| `MISTRAL_API_KEY` | Clé API Mistral |
| `SESSION_SECRET` | Secret pour les sessions Express |
| `CLIENT_URL` | URL du front (`http://localhost:5173` en dev) |

### 3. Initialiser la base de données

```bash
cd api
npx prisma db push
```

### 4. Lancer en développement

```bash
# Depuis la racine du projet
npm run dev
```

Cela lance simultanément :
- **API** : `http://localhost:3001`
- **Client** : `http://localhost:5173`

Le Vite dev server proxy automatiquement les requêtes `/api/*` vers le backend.

## Déploiement sur Vercel

1. Pousser le repo sur GitHub
2. Importer le projet dans Vercel
3. Configurer les variables d'environnement dans les settings Vercel
4. S'assurer que `GOOGLE_CALLBACK_URL` pointe vers le domaine Vercel

## Fonctionnalités

- **Reconnaissance vocale** : Utilise la Web Speech API (Chrome/Edge)
- **Parsing IA** : Mistral AI extrait les événements depuis du texte naturel en français
- **Google Calendar** : Création automatique des événements avec gestion du refresh token
- **Historique** : Stockage des actions vocales en BDD
- **PWA** : Installable sur mobile avec Service Worker
- **Responsive** : Optimisé mobile-first avec safe areas pour iPhone X+
