# Personal Hub — Copilot Instructions

## Overview

Personal productivity platform with modular sub-applications. React SPA frontend + Express/SQLite backend in an npm workspaces monorepo. Single-user, local-first — no authentication. Ships with a **Net Worth Tracker**, a **Stocks** research workspace, and an **ultra-modern Todo / Planning** app.

## Project Structure

```
PersonalHub/
├── config/
│   ├── networth/            # Net Worth JSON configs (version-controlled)
│   │   ├── family-members.json
│   │   ├── categories.json
│   │   └── goals.json
│   └── todo/                # (reserved for future todo configs)
├── data/                    # SQLite DBs (gitignored)
├── packages/
│   ├── shared/              # @networth/shared — TypeScript types & utility functions
│   ├── server/              # Express API (port 3001) — Drizzle ORM + better-sqlite3
│   │   └── src/
│   │       ├── apps/
│   │       │   ├── networth/ # Net Worth route aggregator + routes/
│   │       │   ├── stocks/   # Stocks dashboard/detail routes + Alpha Vantage helper
│   │       │   └── todo/     # Todo routes (groups, todos, stats)
│   │       ├── db/           # Drizzle ORM + SQLite setup
│   │       └── lib/          # Shared server helpers (config.ts)
│   └── client/              # Vite + React SPA (port 5173) — TanStack Query, Recharts, Tailwind v4
│       └── src/
│           ├── apps/
│           │   ├── networth/ # Net Worth pages/ + api.ts
│           │   ├── stocks/   # Stocks pages/, api.ts, theme hook + editor
│           │   └── todo/     # Todo pages/, api.ts + 16 components/
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
- Copy `.env.example` to `.env` and set `ALPHA_VANTAGE_API_KEY` to enable manual stock metric refreshes. Server startup loads the repo root `.env` first, then `packages/server/.env`.

## Documentation Maintenance

- When updating `README.md` or `.github/copilot-instructions.md`, inspect the relevant git diff first and document only the contributor-relevant delta.
- Prefer an incremental baseline file such as `.github/doc-sync-state.json` so documentation reviews can compare `lastReviewedCommit..HEAD` instead of rescanning the full repository.

## Architecture Decisions

- **Multi-app platform**: Each app has its own directory under `config/`, `server/src/apps/`, and `client/src/apps/`. Platform-level code (Layout, Home page, shared API instance) lives outside app directories.
- **Namespaced API routes**: Each app's server routes are mounted at `/api/<appName>/*` (e.g., `/api/networth/snapshots`). The app router aggregator in `src/apps/<appName>/index.ts` mounts sub-routes.
- **Config vs DB split**: App configurations (family members, categories, goals) are JSON files in `config/<appName>/` (version-controlled). Data lives in SQLite at `data/` (gitignored). The Todo app stores everything (groups + todos) in SQLite since they are fully dynamic user data.
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
- **Environment loading**: Server startup loads the repo root `.env` first and `packages/server/.env` second via `dotenv`.

### DB Schema (Net Worth)

```
snapshots: id (TEXT PK), date (TEXT YYYY-MM-DD), note (TEXT), created_at (TEXT ISO)
entries:   id (TEXT PK), snapshot_id (FK→snapshots CASCADE), member_id, category_id, type ('asset'|'liability'), name, value (INTEGER cents)
```

Indexes on `snapshot_id`, `member_id`, `type`.

### DB Schema (Todo)

```
todo_groups:            id (TEXT PK), name, color (hex), icon (Lucide name), sort_order (INT), created_at
todos:                  id (TEXT PK), group_id (FK→todo_groups CASCADE), title, description (markdown TEXT),
                        priority ('high'|'medium'|'low'), status ('open'|'completed'),
                        due_date (YYYY-MM-DD), recurrence (JSON TEXT), parent_id (FK→todos CASCADE, nullable),
                        sort_order (INT), completed_at, created_at, updated_at
recurring_completions:  id (TEXT PK), todo_id (FK→todos CASCADE), completion_date (YYYY-MM-DD), completed_at
```

Indexes on `group_id`, `parent_id`, `status`, `due_date`. Unique index on `(todo_id, completion_date)`.

### DB Schema (Stocks)

```
stocks:              id (TEXT PK), symbol (unique), company_name, exchange, sector, industry,
                     tracking_mode ('watchlist'|'holding'|'both'), status ('active'|'archived'),
                     thesis, notes_html, shares_milli, average_cost_basis, conviction,
                     manual_* override fields, last_manual_update_at, last_synced_at, created_at, updated_at
stock_metrics_cache: id (TEXT PK), stock_id (FK→stocks CASCADE, unique), source, refresh_state,
                     current_price, analyst_target_price, pe_ratio, pb_ratio, ps_ratio,
                     eps_growth, market_cap, beta, analyst_rating, fetched_at, error_message,
                     created_at, updated_at
stock_versions:      id (TEXT PK), stock_id (FK→stocks CASCADE), source ('manual'|'api-refresh'|'restore'),
                     payload (JSON TEXT), created_at
```

Indexes on `symbol`, `tracking_mode`, `status`, `updated_at`, `stock_id`, and `created_at`.

**Key design decisions:**
- Subtasks are todos with `parentId` set (same table, max 1 level deep).
- Recurring todos stay `status='open'`; each completion is logged in `recurring_completions`.
- `recurrence` is a JSON-stringified `RecurrenceRule` (`{ frequency, interval, weekdays?, endDate?, exceptions? }`).
- Groups are fully dynamic (SQLite, not JSON config) — users create/edit/delete from UI.
- `sort_order` enables drag-and-drop reordering within groups.

## Client Patterns (packages/client)

- **React 19 + Vite + Tailwind CSS v4** with `@theme` custom properties for colors (primary=indigo, success=green, danger=red, warning=amber).
- **TanStack Query v5** for all data fetching. Query keys are arrays: `['snapshots']`, `['snapshot', id]`, `['trends']`, `['insights-summary']`, `['goals']`, `['members']`, `['categories']`, `['todo-groups']`, `['todos']`, `['todo', id]`, `['todo-stats']`, `['todo-calendar', month]`, `['stocks-dashboard']`, `['stocks-summary']`, `['stock', id]`. Mutations invalidate related query keys on success.
- **App-scoped API layer**: Each app has its own `api.ts` at `src/apps/<appName>/api.ts` with an axios instance (`baseURL: '/api/<appName>'`). Platform-level shared API at `src/lib/api.ts` (`baseURL: '/api'`).
- **React Router v7** — Layout as parent route with `<Outlet />`. App pages are nested under `/<appName>/*`. Platform pages (Home, Help) are at root level.
- **Lucide React** for icons — imported as components. Dynamic icon lookup in `IconLookup.tsx` converts kebab-case names to PascalCase for `lucide-react`'s `icons` map.
- **Recharts** for charts — always wrapped in `<ResponsiveContainer>`. Y-axis uses `$Xk` format. Tooltip shows `$X,XXX`.
- **Form state**: Controlled components with `useState`. Dollar amounts displayed to user, converted to/from cents on save/load via `dollarsToCents()`/`centsToDollars()`. Draft entries use a `key` field for React list keys (not persisted).
- **Card styling**: `bg-white rounded-xl border border-gray-200 p-6`.
- **Button styling**: `bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors`.
- **ConfirmModal**: Reusable confirmation dialog at `src/components/ConfirmModal.tsx` for all destructive actions (deletes).
- **Frontend design guidance**: For substantial UI work or new app surfaces, consult `.github/skills/frontend-design/SKILL.md` and preserve app-local visual identity instead of flattening everything into the platform default.

### Todo App Client Stack

- **@dnd-kit** (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`) for Kanban drag-and-drop between groups and reordering within groups. `DndContext` at board level, `useSortable` on each card, `useDroppable` on each column. `DragOverlay` for ghost card preview.
- **Calendar drag-and-drop** also uses `@dnd-kit/core` so users can reschedule one-off todos by moving their due date between calendar days. Dragging a recurring instance detaches that occurrence into a standalone todo.
- **Framer Motion** for layout animations (card enter/exit via `AnimatePresence`, inline expand via `motion.div`, page transitions, modal entrance, calendar month slide).
- **React Spring** (`@react-spring/web`) for spring-physics animated counters in stats widgets and checkbox bounce.
- **Tiptap** (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`) for rich-text WYSIWYG notes on todos. Notion-like minimal toolbar.
- **date-fns** for all date operations — calendar grid generation, recurrence expansion, relative date comparisons.
- **16 components** in `src/apps/todo/components/`: PriorityBadge, StatusBadge, QuickAdd, IconSuggest, GroupManager, RecurrenceEditor, TiptapEditor, TodoCard, TodoDetail, KanbanColumn, KanbanBoard, TodayFocus, OverdueUpcoming, CompletionStats, CalendarGrid, CalendarDay.
- **Priority colors** defined in `index.css` `@theme` block: `--color-priority-high` (red), `--color-priority-medium` (amber), `--color-priority-low` (green).

## File Naming

- **React components/pages**: PascalCase (e.g., `Dashboard.tsx`, `Layout.tsx`)
- **Utilities/config**: camelCase (e.g., `api.ts`, `config.ts`)
- **API routes**: kebab-case URLs (`/api/networth/snapshots`, `/api/networth/insights/trends`, `/api/todo/groups`, `/api/todo/todos`, `/api/todo/stats`)

## Data Model Notes

### Net Worth
- **Goals** support two target types: `'netWorth'` (total net worth) or `'category'` (specific asset/liability category by `categoryId`). Default is `'netWorth'` for backward compatibility. Goals are stored in `config/networth/goals.json`, not the database.
- **Carry-forward**: Cloning a snapshot pre-fills all entries from a previous snapshot so the user only updates changed values.
- **Snapshot entries** reference `memberId` and `categoryId` by string ID — these IDs come from the JSON config, not the database.

### Todo
- **Groups** are dynamic (SQLite). Each group has a name, color (hex), icon (Lucide), and sort_order. Users create/edit/delete from the UI via a modal with auto-icon suggestion.
- **Todos** belong to a group. They have priority (high/medium/low), status (open/completed), optional due date, optional recurrence rule, optional markdown description, and sort_order.
- **Subtasks** are regular todos with `parentId` pointing to a parent todo. Max one level deep. They inherit the parent's group.
- **Recurrence** uses `RecurrenceRule`: `{ frequency: 'daily'|'weekly'|'monthly'|'yearly', interval: number, weekdays?: number[], endDate?: string, exceptions?: string[] }`. Recurring todos always stay `status='open'`; completions go into `recurring_completions` table keyed by `(todoId, completionDate)`.
- **Calendar expansion**: The `/api/todo/stats/calendar` endpoint expands recurring todos into per-date instances for a given month, merging with one-off todos and skipping any dates listed in `recurrence.exceptions`.
- **Recurring instance detach**: `POST /api/todo/todos/:id/detach` records the original date as a recurrence exception and creates a standalone todo on the new date when a recurring calendar instance is moved.
- **Icon suggestion**: Client-side keyword→icon map (e.g., "work"→briefcase, "fitness"→dumbbell). The `IconSuggest` component auto-suggests as the user types a group name.
- **Inline expand**: TodoDetail opens below the card (Todoist-style) using Framer Motion `AnimatePresence` height animation. It shows title edit, Tiptap notes, subtask list, priority/date/recurrence/group controls.

### Stocks
- **Tracking modes**: A stock can be a watchlist idea, a holding, or both.
- **Version history**: Every save writes a full payload snapshot into `stock_versions`; the `stocks` table stores the latest editable state for fast reads.
- **Alpha Vantage refresh**: Manual refresh only in v1. `POST /api/stocks/:id/refresh` updates `stock_metrics_cache` and may append an `api-refresh` version when metadata changes.
- **Manual overrides**: Current price, target price, P/E, P/B, P/S, and EPS growth can be set manually and override cached API values in effective metrics.
- **Notes editor**: Stocks reuse the Todo app's Tiptap editor for long-form research notes.
- **Stocks dashboard**: `/stocks` shows active tracked names, derived upside percentage, refresh state, and position value. `/stocks/:id` combines metrics, version history, and the full editor.

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
