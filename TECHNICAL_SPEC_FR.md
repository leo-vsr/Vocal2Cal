# Présentation

## Objectif

Une PWA permettant aux utilisateurs de dicter des événements de calendrier par la voix. L'application transcrit la parole, utilise l'IA pour extraire les données structurées (titre, date, heure), et crée automatiquement les événements dans Google Calendar. Déployée en serverless sur Vercel.

## Utilisateurs

Tout détenteur d'un compte Google souhaitant ajouter rapidement des événements à son agenda, sans les mains. L'application supporte plusieurs événements en une seule phrase (ex : *"Réunion demain à 10h et dentiste mardi à 16h30"*).

# Stack Technique

## Frontend

React 19, TypeScript, Vite, TailwindCSS 4.

## Backend

Node.js, Express, TypeScript, Prisma ORM.

## Base de données

PostgreSQL (Supabase) : Postgres managé avec connection pooling intégré.

## Authentification

Google OAuth 2.0 via Passport.js : authentification déléguée avec scope Google Calendar API.

## IA

Gemini 2.5 Flash : NLP multilingue avec sortie JSON native (`responseMimeType: "application/json"`).

## DevOps

Hébergement : Vercel (serverless). Déploiement automatique au push.

# Fonctionnalités principales

## Authentification

- Google OAuth 2.0 (SSO) via Passport.js
- Authentification par session avec `express-session`
- Scopes : `openid`, `email`, `profile`, `calendar.events`
- Rafraîchissement automatique du token à expiration
- Session stockée côté serveur, cookie envoyé au client (`httpOnly`, `secure` en production)

## Reconnaissance vocale

- Web Speech API (navigateurs Chromium : Chrome, Edge)
- Écoute continue en français (`fr-FR`)
- Affichage en temps réel de la transcription
- Bouton start/stop avec retour visuel (animation pulsée)

## Parsing IA des événements

- Gemini 2.5 Flash extrait des événements structurés à partir de texte en langage naturel
- Supporte plusieurs événements en une seule phrase
- Contextualisé : injecte la date du jour, le jour de la semaine et l'heure dans le prompt
- Gère les dates relatives : "demain", "lundi prochain", "dans 3 jours"
- Heure par défaut (09:00) et durée (+1h) si non précisées
- Sortie JSON forcée via `responseMimeType: "application/json"`
- Sortie : tableau JSON de `{ title, date, startTime, endTime, description }`

## Intégration Google Calendar

- Création automatique des événements sur le calendrier principal de l'utilisateur
- Gestion du rafraîchissement du token OAuth (ré-auth transparente si expiré)
- Chaque événement créé inclut un lien direct vers Google Calendar
- Fuseau horaire : détecté automatiquement depuis le navigateur de l'utilisateur (`Intl.DateTimeFormat`), fallback sur `Europe/Paris`

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
5. **Gemini 2.5 Flash** analyse le texte → événements JSON structurés
6. Le token Google OAuth est rafraîchi si expiré
7. Les événements sont créés via l'**API Google Calendar**
8. L'action est sauvegardée dans Supabase (`VoiceAction`)
9. La réponse est envoyée au client → les événements sont affichés avec des liens Calendar

## Choix architecturaux

- **TypeScript de bout en bout** : les interfaces partagées (`ParsedEvent`, `CreatedEvent`, `User`) entre client et serveur évitent les dérives de contrat.
- **Supabase** : PostgreSQL managé avec connection pooling (Session Pooler, port 6543) élimine la gestion d'infrastructure. Pas besoin d'un pool de connexions séparé comme PgBouncer.
- **Prisma ORM** : types TypeScript générés automatiquement depuis le schéma, assurant la sécurité au compile-time sur toutes les requêtes BDD.
- **Serverless (Vercel)** : l'app Express est encapsulée en une seule serverless function (`api/vercel.ts`). Les preview deployments sont créés automatiquement par PR. Scale to zero au repos.
- **Gemini `responseMimeType`** : en forçant `application/json` au niveau du modèle, on évite le markdown fencing et le JSON malformé. Combiné avec une température basse (0.1), la sortie est déterministe et parseable.
- **Auth par session plutôt que JWT** : plus simple pour un flux OAuth rendu côté serveur. La session est stockée en mémoire (dev) ou pourrait être sauvegardée via un store (production). L'approche par cookie évite la gestion de tokens côté client.

# Modèle de données (Supabase / Prisma)

## Tables

### User

- id : String (cuid), clé primaire
- googleId : String, unique — identifiant Google
- email : String?, email du profil Google
- name : String?, nom d'affichage du profil Google
- image : String?, URL de l'avatar Google
- accessToken : Text?, token d'accès OAuth (côté serveur uniquement)
- refreshToken : Text?, token de rafraîchissement OAuth (côté serveur uniquement)
- tokenExpiry : DateTime?, rafraîchi automatiquement si expiré
- createdAt : DateTime
- updatedAt : DateTime

### VoiceAction

- id : String (cuid), clé primaire
- userId : String, FK → User.id (suppression en cascade)
- rawText : Text, transcription originale
- events : Json, tableau de `{ title, date, startTime, endTime, description? }`
- status : String, défaut : "success"
- createdAt : DateTime

## Relations

- User → VoiceAction : one-to-many (un utilisateur a plusieurs actions vocales)
- VoiceAction → User : many-to-one avec suppression en cascade (supprimer un utilisateur supprime toutes ses actions)

# Points d'entrée API

| Méthode | Chemin | Auth | Description |
| --- | --- | --- | --- |
| GET | /api/auth/google | Non | Lance le flux OAuth Google |
| GET | /api/auth/google/callback | Non | Callback OAuth → session → redirige vers le client |
| GET | /api/auth/me | Oui | Retourne le profil utilisateur ou 401 |
| POST | /api/auth/logout | Oui | Détruit la session |
| POST | /api/parse-events | Oui | Endpoint principal : texte → IA → événements Calendar |
| GET | /api/history | Oui | 20 dernières actions vocales de l'utilisateur |
| GET | /api/usage | Oui | `{ used, limit }` — compteur d'utilisation IA quotidien |
| GET | /api/health | Non | Vérification de santé |

## Format des erreurs

Toutes les erreurs suivent un format uniforme : `{ error: string }`.

- 400 : Saisie manquante
- 401 : Non authentifié / `SESSION_EXPIRED` (déclenche une ré-auth côté client)
- 422 : Aucun événement détecté dans la phrase
- 429 : Limite quotidienne IA atteinte
- 500 : Erreur interne du serveur

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

## Communication Client-Serveur

- Tous les appels API utilisent `fetch` avec `credentials: "include"` pour les sessions par cookie
- Le serveur de dev Vite proxy les requêtes `/api/*` vers `http://localhost:3001` en développement
- En production, les routes Vercel dirigent `/api/*` → serverless function
- Les réponses sont d'abord parsées en texte, puis `JSON.parse` avec fallback d'erreur pour gérer les réponses malformées

# Guide de délégation en équipe

- **Dév frontend** : possède `client/`. Consomme l'API telle que documentée ci-dessus. Pas besoin de connaître Gemini ou les détails de Calendar.
- **Dév backend** : possède `api/`. Implémente les contrats des sections Modèle de données et API. Pas besoin de connaître React ou le styling.
- **DevOps** : possède `vercel.json` + variables d'environnement + provisionnement Supabase.
- **IA / Prompt engineering** : possède le prompt dans `lib/gemini.ts`. Peut itérer indépendamment tant que l'interface `ParsedEvent` reste stable.
