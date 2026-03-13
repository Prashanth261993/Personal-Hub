# Personal Hub — Copilot Instructions

## Overview

Personal productivity platform with modular sub-applications. React SPA frontend + Express/SQLite backend in an npm workspaces monorepo. Single-user, local-first — no authentication. Currently ships with a **Net Worth Tracker** app; more apps (Todo, Stock Portfolio, etc.) can be added.

## Project Structure

```
PersonalHub/
├── config/
│   ├── networth/            # Net Worth JSON configs (version-controlled)
│   │   ├── family-members.json
│   │   ├── categories.json
│   │   └── goals.json
│   └── todo/                # Todo configs (future)
├── data/                    # SQLite DBs (gitignored)
├── packages/
│   ├── shared/              # @networth/shared — TypeScript types & utility functions
│   ├── server/              # Express API (port 3001) — Drizzle ORM + better-sqlite3
│   │   └── src/
│   │       ├── apps/
│   │       │   ├── networth/ # Net Worth route aggregator + routes/
│   │       │   └── todo/     # Todo routes (future)
│   │       ├── db/           # Drizzle ORM + SQLite setup
│   │       └── lib/          # Shared server helpers (config.ts)
│   └── client/              # Vite + React SPA (port 5173) — TanStack Query, Recharts, Tailwind v4
│       └── src/
│           ├── apps/
│           │   ├── networth/ # Net Worth pages/ + api.ts
│           │   └── todo/     # Todo pages (future)
│           ├── components/   # Platform-level (Layout, ConfirmModal, IconLookup)
│           ├── lib/          # Shared client API (axios instance)
│           └── pages/        # Platform-level pages (Home)
└── package.json             # npm workspaces root
```

**Dependency graph:** `shared` ← `server`, `shared` ← `client`. Build order: shared → server → client.

## Key Commands

- `npm run dev` — starts both server (tsx watch) and client (Vite) via concurrently
- `npm run build` — builds all packages in dependency order
- `npm run db:studio` — opens Drizzle Studio to browse the SQLite database

## Architecture Decisions

- **Multi-app platform**: Each app has its own directory under `config/`, `server/src/apps/`, and `client/src/apps/`. Platform-level code (Layout, Home page, shared API instance) lives outside app directories.
- **Namespaced API routes**: Each app's server routes are mounted at `/api/<appName>/*` (e.g., `/api/networth/snapshots`). The app router aggregator in `src/apps/<appName>/index.ts` mounts sub-routes.
- **Config vs DB split**: App configurations (family members, categories, goals) are JSON files in `config/<appName>/` (version-controlled). Data lives in SQLite at `data/` (gitignored).
- **Monetary values**: All amounts stored as **integers in cents** to avoid floating-point issues. Liabilities stored as **negative values**. Net worth = `SUM(all values)`.
- **No authentication**: Personal tool — all data accessible to anyone with UI access.
- **Dev proxy**: Vite proxies `/api/*` to `http://localhost:3001`.
- **Collapsible sidebar**: Platform navigation uses a left sidebar with expandable app sections. Collapse state persisted in localStorage.

## TypeScript Conventions

- **Strict mode** enabled (`tsconfig.base.json`), all packages inherit from it.
- **ESM throughout**: All packages use `"type": "module"`.
- **Server imports** require `.js` extension for local files (Node.js ESM requirement): `import { db } from '../../../db/index.js'`.
- **Client imports** do not need extensions (Vite handles resolution).
- **Shared package** uses only named exports (interfaces, utility functions). Server routes and client pages use default exports.

## Server Patterns (packages/server)

- **Express + Drizzle ORM** with synchronous better-sqlite3 (`.all()`, `.get()`, `.run()`).
- **App router aggregator**: Each app has `src/apps/<appName>/index.ts` that imports all route files and exports a single `Router`, mounted in `src/index.ts` at `/api/<appName>`.
- **Route files** in `src/apps/<appName>/routes/` export a default `Router` instance.
- **Config access** via typed helpers in `src/lib/config.ts`: `getMembers()`, `saveMembers()`, `getCategories()`, etc. These read/write JSON files in `config/<appName>/`.
- **Error responses** follow: `res.status(code).json({ error: 'message' })`. Always wrap handlers in try-catch with `console.error` + 500 response.
- **IDs** are UUIDs generated with `uuid.v4()`.
- **Inline migrations** run on every server startup via `runMigrations()` — all `CREATE TABLE IF NOT EXISTS` statements in `src/db/migrate.ts`.
- **SQLite pragmas**: WAL journal mode, foreign keys ON.

### DB Schema (Net Worth)

```
snapshots: id (TEXT PK), date (TEXT YYYY-MM-DD), note (TEXT), created_at (TEXT ISO)
entries:   id (TEXT PK), snapshot_id (FK→snapshots CASCADE), member_id, category_id, type ('asset'|'liability'), name, value (INTEGER cents)
```

Indexes on `snapshot_id`, `member_id`, `type`.

## Client Patterns (packages/client)

- **React 19 + Vite + Tailwind CSS v4** with `@theme` custom properties for colors (primary=indigo, success=green, danger=red, warning=amber).
- **TanStack Query v5** for all data fetching. Query keys are arrays: `['snapshots']`, `['snapshot', id]`, `['trends']`, `['insights-summary']`, `['goals']`, `['members']`, `['categories']`. Mutations invalidate related query keys on success.
- **App-scoped API layer**: Each app has its own `api.ts` at `src/apps/<appName>/api.ts` with an axios instance (`baseURL: '/api/<appName>'`). Platform-level shared API at `src/lib/api.ts` (`baseURL: '/api'`).
- **React Router v7** — Layout as parent route with `<Outlet />`. App pages are nested under `/<appName>/*`. Platform pages (Home, Help) are at root level.
- **Lucide React** for icons — imported as components. Dynamic icon lookup in `IconLookup.tsx` converts kebab-case names to PascalCase for `lucide-react`'s `icons` map.
- **Recharts** for charts — always wrapped in `<ResponsiveContainer>`. Y-axis uses `$Xk` format. Tooltip shows `$X,XXX`.
- **Form state**: Controlled components with `useState`. Dollar amounts displayed to user, converted to/from cents on save/load via `dollarsToCents()`/`centsToDollars()`. Draft entries use a `key` field for React list keys (not persisted).
- **Card styling**: `bg-white rounded-xl border border-gray-200 p-6`.
- **Button styling**: `bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors`.
- **ConfirmModal**: Reusable confirmation dialog at `src/components/ConfirmModal.tsx` for all destructive actions (deletes).

## File Naming

- **React components/pages**: PascalCase (e.g., `Dashboard.tsx`, `Layout.tsx`)
- **Utilities/config**: camelCase (e.g., `api.ts`, `config.ts`)
- **API routes**: kebab-case URLs (`/api/networth/snapshots`, `/api/networth/insights/trends`)

## Data Model Notes

- **Goals** support two target types: `'netWorth'` (total net worth) or `'category'` (specific asset/liability category by `categoryId`). Default is `'netWorth'` for backward compatibility. Goals are stored in `config/networth/goals.json`, not the database.
- **Carry-forward**: Cloning a snapshot pre-fills all entries from a previous snapshot so the user only updates changed values.
- **Snapshot entries** reference `memberId` and `categoryId` by string ID — these IDs come from the JSON config, not the database.

## When Adding a New App

1. **Config**: Create `config/<appName>/` with JSON config files.
2. **Shared types**: Add to `packages/shared/src/index.ts` (named exports). Add `AppDefinition` entry if needed.
3. **Server routes**: Create `packages/server/src/apps/<appName>/` with `index.ts` (router aggregator) and `routes/` directory. Mount in `src/index.ts` at `/api/<appName>`.
4. **Client API**: Create `packages/client/src/apps/<appName>/api.ts` with an axios instance (`baseURL: '/api/<appName>'`).
5. **Client pages**: Create `packages/client/src/apps/<appName>/pages/` with page components. Add routes in `App.tsx` under `/<appName>/*`.
6. **Navigation**: Add a sidebar section in `Layout.tsx` and a summary card on `Home.tsx`.
7. **New DB tables**: Add to `packages/server/src/db/schema.ts` and `src/db/migrate.ts`.

## When Adding Features to an Existing App

1. **New shared type**: Add to `packages/shared/src/index.ts` (named export).
2. **New API endpoint**: Create or extend a route file in `packages/server/src/apps/<appName>/routes/`, register in the app's `index.ts` router.
3. **New client data**: Add typed fetch function in `packages/client/src/apps/<appName>/api.ts`, consume via `useQuery`/`useMutation` in the page component.
4. **New page**: Create in `packages/client/src/apps/<appName>/pages/`, add route in `App.tsx`, add nav link in `Layout.tsx`.
5. **New config**: Add JSON file in `config/<appName>/`, add read/write helpers in `packages/server/src/lib/config.ts`, add type in shared package.
