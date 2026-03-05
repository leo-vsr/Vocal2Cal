# Vocal2Cal

> Planificateur vocal d'événements Google Calendar — Dictez vos événements en français et ils sont automatiquement ajoutés à votre Google Agenda.

---

# Présentation

## Objectif

Une PWA permettant aux utilisateurs de dicter des événements de calendrier par la voix en français. L'application transcrit la parole, utilise l'IA pour extraire les données structurées (titre, date, heure), et crée automatiquement les événements dans Google Calendar. Déployée en serverless sur Vercel.

## Utilisateurs

Tout détenteur d'un compte Google souhaitant ajouter rapidement des événements à son agenda, sans les mains. L'application supporte plusieurs événements en une seule phrase (ex : *"Réunion demain à 10h et dentiste mardi à 16h30"*).

---

# Stack Technique

## Frontend

React 19, TypeScript, Vite, TailwindCSS 4.

## Backend

Node.js, Express, TypeScript, Prisma ORM.

## Base de données

PostgreSQL (Supabase) — Postgres managé avec connection pooling intégré.

## Authentification

Google OAuth 2.0 via Passport.js — authentification déléguée avec scope Google Calendar API.

## IA

Gemini 1.5 Flash — NLP multilingue avec sortie JSON native (`responseMimeType: "application/json"`).

## DevOps

Hébergement : Vercel (serverless). Déploiement automatique au push. Réseau edge, scale to zero.

---

# Fonctionnalités principales

## Reconnaissance vocale

- Utilise la Web Speech API (navigateurs Chromium : Chrome, Edge)
- Écoute continue en français (`fr-FR`)
- Affichage en temps réel de la transcription
- Bouton start/stop avec retour visuel (animation pulsée)

## Parsing IA des événements

- Gemini 1.5 Flash extrait des événements structurés à partir de texte français en langage naturel
- Supporte plusieurs événements en une seule phrase
- Contextualisé : injecte la date du jour, le jour de la semaine et l'heure dans le prompt
- Gère les dates relatives : "demain", "lundi prochain", "dans 3 jours"
- Heure par défaut (09:00) et durée (+1h) si non précisées
- Sortie : tableau JSON de `{ title, date, startTime, endTime, description }`

## Intégration Google Calendar

- Création automatique des événements sur le calendrier principal de l'utilisateur
- Gestion du rafraîchissement du token OAuth (ré-auth transparente si expiré)
- Chaque événement créé inclut un lien direct vers Google Calendar
- Fuseau horaire : `Europe/Paris`

## Limitation d'usage

- Limite quotidienne d'appels IA configurable (`DAILY_AI_LIMIT`, défaut : 50)
- Limite globale tous utilisateurs confondus (comptée via les enregistrements `VoiceAction` en BDD)
- Réinitialisation automatique à minuit
- Retourne HTTP 429 quand la limite est atteinte

## Historique

- 20 dernières actions vocales stockées par utilisateur
- Chaque enregistrement contient la transcription brute et les événements créés
- Panneau d'historique dépliable dans l'interface

## PWA

- Installable sur mobile (manifest + Service Worker)
- Thème sombre, design responsive mobile-first
- Support des safe areas pour iPhone X+

---

# Architecture système

## Couches

| Couche | Composant | Responsabilité |
| --- | --- | --- |
| Présentation | React SPA (`client/`) | UI, capture vocale, gestion d'état |
| API | Express (`api/`) | Routage, sessions, middleware auth |
| Logique métier | Handlers + `lib/` | Parsing IA, Calendar API, rate limiting |
| Persistance | Supabase (PostgreSQL) | Utilisateurs, tokens OAuth, historique |

## Flux principal (voix → agenda)

1. L'utilisateur parle → la **Web Speech API** transcrit en texte
2. Le client envoie `POST /api/parse-events` avec la transcription
3. Le middleware `requireAuth` vérifie la session
4. La limite quotidienne d'utilisation IA est vérifiée en BDD
5. **Gemini 1.5 Flash** analyse le texte → événements JSON structurés
6. Le token Google OAuth est rafraîchi si expiré
7. Les événements sont créés via l'**API Google Calendar**
8. L'action est sauvegardée dans Supabase (`VoiceAction`)
9. La réponse est envoyée au client → les événements sont affichés avec des liens Calendar

---

# Modèle de données (Supabase / Prisma)

## Tables

### User

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | Clé primaire |
| `googleId` | String | Unique — identifiant Google |
| `email` | String? | Email du profil Google |
| `name` | String? | Nom d'affichage du profil Google |
| `image` | String? | URL de l'avatar Google |
| `accessToken` | Text? | Token d'accès OAuth (côté serveur uniquement) |
| `refreshToken` | Text? | Token de rafraîchissement OAuth (côté serveur uniquement) |
| `tokenExpiry` | DateTime? | Rafraîchi automatiquement si expiré |
| `createdAt` | DateTime | Horodatage de création |
| `updatedAt` | DateTime | Horodatage de dernière mise à jour |

### VoiceAction

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | Clé primaire |
| `userId` | String | FK → `User.id` (suppression en cascade) |
| `rawText` | Text | Transcription française originale |
| `events` | Json | Tableau de `{ title, date, startTime, endTime, description? }` |
| `status` | String | Défaut : `"success"` |
| `createdAt` | DateTime | Horodatage de création |

---

# Points d'entrée API

| Méthode | Chemin | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/auth/google` | Non | Lance le flux OAuth Google |
| `GET` | `/api/auth/google/callback` | Non | Callback OAuth → session → redirige vers le client |
| `GET` | `/api/auth/me` | Oui | Retourne le profil utilisateur ou 401 |
| `POST` | `/api/auth/logout` | Oui | Détruit la session |
| `POST` | `/api/parse-events` | Oui | Endpoint principal : texte → IA → événements Calendar |
| `GET` | `/api/history` | Oui | 20 dernières actions vocales de l'utilisateur |
| `GET` | `/api/usage` | Oui | `{ used, limit }` — compteur d'utilisation IA quotidien |
| `GET` | `/api/health` | Non | Vérification de santé |

### Format des erreurs

Toutes les erreurs suivent un format uniforme : `{ error: string }`.

| Code | Signification |
| --- | --- |
| 400 | Saisie manquante |
| 401 | Non authentifié / `SESSION_EXPIRED` (déclenche une ré-auth) |
| 422 | Aucun événement détecté dans la phrase |
| 429 | Limite quotidienne IA atteinte |
| 500 | Erreur interne du serveur |

---

# Architecture frontend

| Composant / Hook | Rôle |
| --- | --- |
| `App.tsx` | Layout racine, gate d'auth, orchestre les composants enfants |
| `VoiceRecorder` | Bouton micro + capture vocale, appelle `POST /api/parse-events` |
| `EventCard` | Affiche un événement créé avec lien Google Calendar |
| `History` | Liste les actions passées depuis `/api/history` |
| `UsageBar` | Barre de progression d'utilisation IA depuis `/api/usage` |
| `useAuth()` | Cycle de vie auth : check `/me`, signIn (redirect), signOut |
| `useSpeechRecognition()` | Encapsule la Web Speech API (`fr-FR`), gère le transcript |

---

# Structure du projet

```
Vocal2Cal/
├── api/                    # Backend Express
│   ├── prisma/
│   │   └── schema.prisma   # Schéma de la BDD
│   ├── src/
│   │   ├── index.ts        # Point d'entrée Express
│   │   ├── lib/
│   │   │   ├── prisma.ts   # Singleton Prisma client
│   │   │   ├── mistral.ts  # Parsing IA Gemini
│   │   │   └── google.ts   # Helpers Google Calendar + OAuth
│   │   ├── middleware/
│   │   │   └── auth.ts     # Middleware requireAuth
│   │   └── routes/
│   │       ├── auth.ts     # Routes Google OAuth
│   │       └── events.ts   # Routes parse-events, history, usage
│   ├── vercel.ts           # Point d'entrée serverless Vercel
│   └── package.json
├── client/                 # Frontend React
│   ├── public/             # Assets statiques (icônes, manifest, sw)
│   ├── src/
│   │   ├── App.tsx         # Composant principal
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
├── vercel.json             # Config de déploiement Vercel
└── package.json            # Scripts racine (concurrently)
```

---

# Installation

## Prérequis

- Node.js 18+
- Un projet Supabase (PostgreSQL)
- Google Cloud Console : OAuth 2.0 Client ID avec Google Calendar API activée
- Clé API Gemini (Google AI Studio)

## 1. Cloner et installer

```bash
git clone https://github.com/leo-vsr/Vocal2Cal.git
cd Vocal2Cal
npm install
```

## 2. Configurer les variables d'environnement

```bash
cp api/.env.example api/.env
```

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL Supabase (utiliser le Session Pooler, port 6543) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3001/api/auth/google/callback` (dev) |
| `GEMINI_API_KEY` | Clé API Gemini |
| `GEMINI_MODEL` | Nom du modèle (défaut : `gemini-1.5-flash`) |
| `DAILY_AI_LIMIT` | Max appels IA/jour (défaut : `50`) |
| `SESSION_SECRET` | Chaîne aléatoire, min 32 caractères |
| `CLIENT_URL` | `http://localhost:5173` (dev) |
| `NODE_ENV` | `development` (dev) / `production` (prod) |

## 3. Initialiser la base de données

```bash
cd api
npx prisma db push
```

## 4. Lancer en développement

```bash
npm run dev
```

Lance les deux services simultanément :
- **API** : http://localhost:3001
- **Client** : http://localhost:5173

Le serveur de développement Vite proxy automatiquement les requêtes `/api/*` vers le backend.

---

# Déploiement sur Vercel

1. Pousser le repo sur GitHub
2. Importer le projet dans Vercel
3. Ajouter toutes les variables d'environnement dans les settings du projet Vercel
4. Définir `GOOGLE_CALLBACK_URL` à `https://<votre-domaine>.vercel.app/api/auth/google/callback`
5. Définir `CLIENT_URL` à `https://<votre-domaine>.vercel.app`
6. Définir `NODE_ENV` à `production`
7. Dans Google Cloud Console, ajouter le domaine Vercel aux :
   - **Origines JavaScript autorisées** : `https://<votre-domaine>.vercel.app`
   - **URI de redirection autorisés** : `https://<votre-domaine>.vercel.app/api/auth/google/callback`

---

# Guide de délégation en équipe

- **Dév frontend** : possède `client/`. Consomme l'API telle que documentée dans la section Points d'entrée API. Pas besoin de connaître Gemini ou Calendar.
- **Dév backend** : possède `api/`. Implémente les contrats des sections Modèle de données et API. Pas besoin de connaître React ou le styling.
- **DevOps** : possède `vercel.json` + variables d'environnement + provisionnement Supabase.
- **IA / Prompt engineering** : possède le prompt dans `lib/mistral.ts`. Peut itérer indépendamment tant que l'interface `ParsedEvent` reste stable.
