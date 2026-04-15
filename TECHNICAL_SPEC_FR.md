# Presentation

## Objectif

Vocal2Cal est une application React + Express qui permet de dicter des demandes d'agenda en francais, de les transcrire avec Gemini, de relire la transcription, d'extraire des evenements structures avec Gemini, puis de creer ces evenements dans Google Calendar.

## Perimetre produit

- Capture audio dans le navigateur
- Transcription serveur et parsing d'evenements via IA
- Authentification Google OAuth et creation dans Google Calendar
- Usage a credits avec abonnements Stripe et recharges
- Historique utilisateur et suivi de consommation
- Vue admin pour les indicateurs plateforme et la gestion des utilisateurs

# Stack technique

| Domaine | Choix actuel | Notes |
| --- | --- | --- |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4 | UI, dashboard, pricing, settings, admin |
| Motion/UI | Framer Motion | Utilise sur le recorder, l'historique et les transitions |
| Backend | Express + TypeScript | API sessionnee exposee sous `/api/*` |
| ORM | Prisma | Schema PostgreSQL et client genere |
| Base de donnees | PostgreSQL | Setup compatible Supabase avec URL runtime pooler + URL CLI directe |
| Authentification | Passport Google OAuth 2.0 + `express-session` | Complete par un cookie signe pour restaurer l'identite |
| IA | Google Gemini `generateContent` | Utilisee pour la transcription et l'extraction d'evenements |
| Modeles par defaut | `gemini-2.5-flash` | Par defaut pour la transcription et le parsing sauf surcharge via env |
| Paiement | Stripe | Checkout, Billing Portal, cycle d'abonnement, recharges, webhooks |
| Deploiement | Vercel | `vercel.json` route l'API vers `api/vercel.ts` et sert le build client |

# Fonctionnalites principales

## Authentification

- Connexion Google OAuth 2.0 avec les scopes :
  - `openid`
  - `email`
  - `profile`
  - `https://www.googleapis.com/auth/calendar.events`
- Le profil utilisateur est cree ou mis a jour dans Prisma au callback OAuth.
- Les tokens Google sont stockes cote serveur dans la table `User`.
- L'API utilise `express-session`, mais ecrit aussi un cookie signe `vocal2cal_auth` pour pouvoir retrouver `userId` sur les requetes suivantes et en contexte serverless.
- Les access tokens Google sont rafraichis a la demande via `https://oauth2.googleapis.com/token`.

## Capture vocale et transcription

- La capture runtime utilise `navigator.mediaDevices.getUserMedia()` et `MediaRecorder`.
- Le flux vocal runtime n'utilise **pas** la Web Speech API.
- Flux supporte :
  1. Capture de l'audio dans le navigateur.
  2. Si le navigateur produit du WebM, conversion en WAV cote client pour la compatibilite Gemini.
  3. Encodage base64 de l'audio normalise.
  4. Envoi vers `POST /api/transcribe-audio`.
- Le backend envoie ensuite l'audio a Gemini avec un prompt de transcription et renvoie `{ transcript }`.
- `transcribe-audio` accepte actuellement les types MIME Gemini compatibles normalises en :
  - `audio/ogg`
  - `audio/mp3`
  - `audio/wav`
  - `audio/flac`
  - `audio/aac`
  - `audio/aiff`
- La requete est refusee au-dela d'environ `20 MB` de payload base64.

## Parsing et creation dans Google Calendar

- Apres transcription, l'utilisateur peut relire et corriger le texte avant envoi.
- `POST /api/parse-events` envoie le texte et le fuseau horaire du navigateur au backend.
- Le backend injecte la date et l'heure courantes dans le prompt Gemini.
- Gemini doit renvoyer du JSON brut avec :
  - `title`
  - `date`
  - `startTime`
  - `endTime`
  - `description`
- L'interpretation des dates relatives est guidee par prompt, avec les valeurs par defaut suivantes :
  - date : aujourd'hui si absente
  - heure : `09:00` si absente
  - duree : `+1 heure` si absente
- Les evenements parsés sont inseres dans le calendrier principal Google de l'utilisateur.
- Les requetes reussies sont stockees dans `VoiceAction`.
- Un credit est retire apres creation reussie des evenements, et une `CreditTransaction` de type `USAGE` est creee.

## Credits, offres et facturation

- Les utilisateurs commencent sur le plan `FREE` avec `5` credits par defaut Prisma.
- Plans payants :
  - `STARTER` : `60` credits / mois
  - `PRO` : `180` credits / mois
  - `BUSINESS` : `600` credits / mois
- Packs de recharge :
  - `BOOST_20`
  - `BOOST_80`
  - `BOOST_200`
- Les recharges sont reservees aux abonnes actifs dont le solde est tombe a `0`.
- Comportements Stripe implementes :
  - souscription d'un nouvel abonnement
  - paiement d'une recharge
  - previsualisation de prorata pour upgrade
  - upgrade immediat
  - downgrade planifie en fin de periode
  - resiliation en fin de periode
  - reprise d'une resiliation planifiee
  - ouverture du portail de facturation Stripe
- Les webhooks Stripe gerent :
  - `checkout.session.completed`
  - `invoice.paid`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

## Historique, usage et administration

- `/api/history` renvoie jusqu'a `20` actions recentes pour l'utilisateur courant.
- En developpement, des lignes d'historique de demonstration sont injectees sauf si `ENABLE_DEV_HISTORY_MOCKS="false"`.
- `/api/usage` renvoie :
  - le solde de credits
  - le plan courant
  - un resume de l'etat d'abonnement
  - les usages aujourd'hui, sur 7 jours et sur 30 jours
  - les dernieres transactions de credits
- Les routes admin exposent :
  - la liste des utilisateurs
  - les KPI plateforme
  - les revenus
  - une estimation des couts IA
  - l'attribution manuelle de credits
  - le changement de role

## Etat PWA et mobile

- `client/index.html` reference `manifest.json` et les metadonnees mobile web app.
- Les icones et un fichier `sw.js` sont presents dans `client/public/`.
- `sw.js` n'est **pas** enregistre actuellement dans `client/src/main.tsx`, donc le cache offline ne doit pas etre considere comme actif.

# Architecture systeme

## Couches

| Couche | Fichiers principaux | Responsabilite |
| --- | --- | --- |
| Presentation | `client/src/App.tsx`, `components/*` | Landing, recorder, dashboard, pricing, settings, admin |
| Capture vocale | `client/src/hooks/useSpeechRecognition.ts` | Enregistrer l'audio, normaliser les formats, appeler l'API de transcription |
| API | `api/src/index.ts`, `routes/*` | Auth, flux vocaux, historique, usage, Stripe, admin |
| Integrations | `api/src/lib/gemini.ts`, `google.ts`, `stripe.ts` | Gemini, refresh Google OAuth, Calendar, Stripe |
| Persistance | `api/prisma/schema.prisma` | Utilisateurs, actions, paiements, ledger de credits |

## Flux principal voix -> agenda

1. Le navigateur capture l'audio avec `MediaRecorder`.
2. Le client convertit eventuellement le WebM en WAV.
3. Le client envoie `audioBase64` + `mimeType` a `POST /api/transcribe-audio`.
4. Le backend appelle Gemini pour la transcription et renvoie `{ transcript }`.
5. L'utilisateur peut corriger la transcription dans l'UI.
6. Le client envoie texte + fuseau horaire a `POST /api/parse-events`.
7. Le backend verifie :
   - l'authentification
   - la presence de credits
   - la limite globale `DAILY_AI_LIMIT`
8. Le backend appelle Gemini pour le parsing JSON.
9. Le backend rafraichit le token Google si necessaire.
10. Les evenements sont inseres dans Google Calendar.
11. L'action est stockee dans `VoiceAction`.
12. Les credits de l'utilisateur sont decrementes et une `CreditTransaction` est ajoutee.
13. L'API renvoie les evenements crees et le solde restant.

## Flux d'authentification

1. `/api/auth/google` lance le flux OAuth.
2. `/api/auth/google/callback` cree ou met a jour l'utilisateur et renseigne `req.session.userId`.
3. Le backend ecrit aussi le cookie signe `vocal2cal_auth`.
4. Les requetes suivantes peuvent etre authentifiees via :
   - `req.session.userId`
   - le cookie signe rehydrate dans la session
5. `/api/auth/me` renvoie le payload front incluant `role`, `credits` et `plan`.

## Flux de facturation

1. Le client ouvre un checkout via `/api/stripe/checkout`.
2. Stripe Checkout gere soit un abonnement, soit une recharge.
3. Les webhooks persistent les `Payment` et synchronisent credits et etat d'abonnement.
4. La page Reglages utilise `/api/stripe/subscription-state` pour afficher l'etat Stripe courant.
5. Les upgrades sont immediats ; les downgrades passent par des subscription schedules Stripe.

# Modele de donnees

## Enums

- `Role` : `USER`, `ADMIN`
- `Plan` : `FREE`, `STARTER`, `PRO`, `BUSINESS`
- `TransactionType` : `SIGNUP_BONUS`, `PURCHASE`, `USAGE`, `ADMIN_GRANT`, `SUBSCRIPTION_RENEWAL`
- `PaymentKind` : `SUBSCRIPTION`, `TOP_UP`

## User

- Identite :
  - `id`
  - `name`
  - `email`
  - `image`
  - `googleId`
- Auth Google :
  - `accessToken`
  - `refreshToken`
  - `tokenExpiry`
- Acces et facturation :
  - `role`
  - `credits`
  - `plan`
  - `stripeCustomerId`
  - `stripeSubscriptionId`
  - `subscriptionStatus`
  - `subscriptionCurrentPeriodEnd`
- Relations :
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

Chaque ligne represente une action texte -> agenda reussie et visible dans l'historique utilisateur.

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

Cette table est la trace d'audit des usages, achats, renouvellements et attributions admin.

# Surface API

## Authentification et utilisateur

| Methode | Chemin | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/auth/google` | Non | Lance Google OAuth |
| GET | `/api/auth/google/callback` | Non | Termine OAuth, cree la session, redirige vers le client |
| GET | `/api/auth/me` | Oui | Retourne le payload utilisateur courant |
| POST | `/api/auth/logout` | Oui | Nettoie les cookies et detruit la session |

## Voix, historique et usage

| Methode | Chemin | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/transcribe-audio` | Oui + credits | Upload audio vers Gemini transcription |
| POST | `/api/parse-events` | Oui + credits | Parse le texte, cree les evenements, retire 1 credit en cas de succes |
| GET | `/api/history` | Oui | 20 dernieres actions, melangees aux mocks dev si actifs |
| GET | `/api/usage` | Oui | Credits, plan, etat abonnement, stats d'usage, transactions |
| GET | `/api/health` | Non | Health check |

## Administration

| Methode | Chemin | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/admin/overview` | Admin | Payload du dashboard admin avec stats et utilisateurs |
| GET | `/api/admin/users` | Admin | Liste des utilisateurs |
| GET | `/api/admin/stats` | Admin | Metriques plateforme uniquement |
| POST | `/api/admin/grant-credits` | Admin | Ajoute des credits a un utilisateur |
| POST | `/api/admin/set-role` | Admin | Change le role `USER` / `ADMIN` |

## Stripe et facturation

| Methode | Chemin | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/stripe/checkout` | Oui | Lance un checkout abonnement ou recharge |
| POST | `/api/stripe/change-plan-preview` | Oui | Previsualise le prorata d'un upgrade ou prepare un downgrade |
| POST | `/api/stripe/change-plan` | Oui | Applique un upgrade immediat |
| GET | `/api/stripe/subscription-state` | Oui | Resolut l'etat vivant de l'abonnement Stripe |
| POST | `/api/stripe/schedule-plan-change` | Oui | Planifie un downgrade au prochain cycle |
| POST | `/api/stripe/clear-scheduled-plan-change` | Oui | Supprime un downgrade deja planifie |
| POST | `/api/stripe/cancel-subscription` | Oui | Programme `cancel_at_period_end=true` |
| POST | `/api/stripe/resume-subscription` | Oui | Annule une resiliation programmee |
| POST | `/api/stripe/portal` | Oui | Ouvre le portail de facturation Stripe |
| POST | `/api/stripe/webhook` | Non, signature verifiee | Endpoint webhook Stripe |
| GET | `/api/stripe/plans` | Non | Payload public des abonnements et recharges |

## Semantique des erreurs

- `400` : saisie invalide, plan invalide, requete mal formee
- `401` : non authentifie ou `SESSION_EXPIRED`
- `402` : `NO_CREDITS`
- `403` : acces interdit admin ou regle de facturation non respectee
- `404` : utilisateur introuvable ou lien Stripe absent
- `409` : conflit d'etat Stripe ou transition d'abonnement invalide
- `413` : payload audio trop volumineux
- `415` : format audio non supporte
- `422` : aucun evenement detecte
- `429` : limite quotidienne globale atteinte
- `500` : echec d'integration ou erreur interne

# Architecture frontend

| Fichier / composant | Role |
| --- | --- |
| `client/src/App.tsx` | Shell principal avec les vues `home`, `dashboard`, `pricing`, `settings` et `admin` |
| `client/src/components/VoiceRecorder.tsx` | UI vocale, relecture de transcript, mode texte admin, creation d'evenements |
| `client/src/components/EventCard.tsx` | Affichage d'un evenement et lien Google Calendar |
| `client/src/components/History.tsx` | Panneau d'historique charge a la demande |
| `client/src/components/UsageBar.tsx` | Resume compact des credits et usages |
| `client/src/components/AdminPanel.tsx` | Dashboard admin |
| `client/src/hooks/useAuth.ts` | Chargement utilisateur courant, redirection login, logout |
| `client/src/hooks/useSpeechRecognition.ts` | Wrapper d'enregistrement navigateur + API transcription |
| `client/vite.config.ts` | Alias `@` et proxy `/api` vers `http://localhost:3001` en dev |

## Notes frontend

- Les labels et tarifs des plans sont actuellement codes en dur dans `App.tsx` pour l'affichage, meme si l'API expose aussi `/api/stripe/plans`.
- Les admins peuvent basculer le recorder en mode texte, qui reutilise le meme backend de parsing.
- Le recorder affiche une transcription editable, pas une reconnaissance vocale navigateur en streaming.

# Notes de configuration et validation

- `DAILY_AI_LIMIT` est une limite **globale** basee sur le nombre de `VoiceAction` du jour, pas un quota par utilisateur.
- Stripe est optionnel pour developper le coeur voix + agenda, mais obligatoire pour les parcours de facturation.
- `ADMIN_EMAILS` n'est pas utilise par le runtime actuel ; les droits admin sont stockes en base.
- Il n'existe pas encore de suite de tests automatisee. La validation minimale reste :
  - `npm run build`
  - connexion Google
  - transcription audio
  - creation d'evenements
  - historique et usage
  - pricing et abonnement
  - vue admin
