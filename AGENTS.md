# Repository Guidelines

## Project Structure & Module Organization
`Vocal2Cal` is split into two apps:
- `client/`: React 19 + Vite frontend. Main code lives in `client/src`, with UI in `components/`, hooks in `hooks/`, and shared types in `types/`. Static assets are in `client/public/`.
- `api/`: Express + TypeScript backend. Routes live in `api/src/routes`, integrations in `api/src/lib`, auth middleware in `api/src/middleware`, and the Prisma schema in `api/prisma/schema.prisma`.
- Root files (`package.json`, `README.md`, `TECHNICAL_SPEC*.md`) coordinate local development and document the product.

## Build, Test, and Development Commands
- `npm install`: installs root dependencies, then `api/` and `client/`.
- `npm run dev`: starts both apps concurrently. Frontend runs on `http://localhost:5173`, API on `http://localhost:3001`.
- `npm run build`: builds both projects.
- `npm run build --prefix api`: compiles the backend to `api/dist/`.
- `npm run build --prefix client`: runs TypeScript checks and creates the Vite production bundle.
- `cd api && npx prisma generate`: regenerates the Prisma client after schema changes.
- `cd api && npx prisma db push`: applies schema changes to the configured database in development.

## Coding Style & Naming Conventions
Use TypeScript with strict mode enabled in both apps. Follow the existing style:
- 2-space indentation and double quotes.
- React components and hooks use `PascalCase` and `camelCase` respectively, for example `EventCard.tsx` and `useAuth.ts`.
- Keep backend modules small and grouped by responsibility (`routes`, `lib`, `middleware`).
- Prefer the `@/*` import alias inside `client/` for `src/*` imports.

## Testing Guidelines
There is no automated test suite in the repository yet. Until one is added:
- Treat `npm run build` as the minimum validation step before opening a PR.
- Manually verify the login flow, voice parsing flow, and history/usage UI locally.
- Add tests next to the code they cover when introducing a framework.

## Commit & Pull Request Guidelines
Recent history follows short conventional-style subjects such as `feat: ...` and `style: ...`. Keep commits focused and imperative.

For pull requests:
- describe the user-visible change and any backend/config impact,
- link the related issue or task,
- include screenshots or short recordings for UI changes,
- mention any required `api/.env` or Prisma setup for reviewers.

## Security & Configuration Tips
Never commit secrets. Keep local credentials in `api/.env`; the example template is `api/.env.example`. The API depends on Google OAuth, Gemini, and PostgreSQL connection settings, so document any new environment variables in both the example file and the PR.
