# Personal Hub

A personal productivity platform with a modular app architecture. React SPA frontend + Express/SQLite backend in an npm workspaces monorepo. Single-user, local-first — no authentication.

## Apps

| App | Route | Description | Status |
|-----|-------|-------------|--------|
| **Net Worth** | `/networth` | Track assets and liabilities for each family member, view trends, and get insights | Active |
| **Planning / Todo** | `/todo` | Ultra-modern task management with Kanban board, calendar view, recurring tasks, subtasks, rich-text notes, and drag-and-drop | Active |
| **Stocks** | `/stocks` | Track watchlist ideas and holdings with valuation metrics, Alpha Vantage refresh, rich research notes with image support, version history, dashboard search/sort/filters, custom presets, and an AI-powered research agent | Active |

## Architecture

```
PersonalHub/
├── config/
│   ├── networth/                # Net Worth JSON configs
│   │   ├── family-members.json
│   │   ├── categories.json
│   │   └── goals.json
│   └── todo/                    # (reserved for future todo configs)
├── data/                        # SQLite databases (gitignored)
├── packages/
│   ├── shared/                  # @networth/shared — TypeScript types & utilities
│   ├── server/                  # Express API server (port 3001)
│   │   └── src/
│   │       ├── apps/
│   │       │   ├── networth/    # Net Worth routes
│   │       │   ├── stocks/      # Stocks routes, Alpha Vantage, MCP agent, presets
│   │       │   └── todo/        # Todo routes (groups, todos, stats)
│   │       ├── db/              # Drizzle ORM + SQLite
│   │       └── lib/             # Shared server helpers
│   └── client/                  # Vite + React SPA (port 5173)
│       └── src/
│           ├── apps/
│           │   ├── networth/    # Net Worth pages & API
│           │   ├── stocks/      # Stocks pages, API, editor, theme & Agent chat
│           │   └── todo/        # Todo pages, API & 16 components
│           ├── components/      # Platform-level components (Layout, etc.)
│           ├── lib/             # Shared client helpers
│           └── pages/           # Platform-level pages (Home)
└── package.json                 # npm workspaces root
```

**Key decisions:**
- **App-scoped structure**: Each app has its own directory under `config/`, `server/src/apps/`, and `client/src/apps/`
- **Namespaced API routes**: Each app is mounted at `/api/<appName>/*`
- **Config vs DB split**: App configurations are JSON files in `config/<appName>/` (version-controlled). Data lives in SQLite at `data/` (gitignored). The Todo app stores everything (groups + todos) in SQLite since they are dynamic user data.
- **Monetary values**: Stored as integers in cents. Liabilities are negative. Net worth = `SUM(all values)`
- **No authentication**: Personal tool — all data accessible to anyone with UI access

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node.js)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the app

If you want manual Alpha Vantage refreshes in the Stocks app, create a local `.env` from `.env.example` and set `ALPHA_VANTAGE_API_KEY` before starting the server. To enable the AI-powered Stock Research Agent, also set `GITHUB_MODELS_TOKEN` (a GitHub PAT with `models:read` permission).

```bash
npm run dev
```

- **Server** starts on `http://localhost:3001`
- **Client** starts on `http://localhost:5173`

The client proxies all `/api` requests to the server.

### 3. Open in browser

Navigate to **http://localhost:5173** — the Home page shows all available apps.

---

## API Endpoints

### Platform

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |

### Net Worth (`/api/networth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/networth/members` | Get family members config |
| PUT | `/api/networth/members` | Update family members config |
| GET | `/api/networth/categories` | Get asset/liability categories |
| PUT | `/api/networth/categories` | Update categories config |
| GET | `/api/networth/goals` | Get financial goals |
| PUT | `/api/networth/goals` | Update financial goals |
| GET | `/api/networth/snapshots` | List all snapshots with summary totals |
| POST | `/api/networth/snapshots` | Create a new snapshot with entries |
| GET | `/api/networth/snapshots/:id` | Get a snapshot with all its entries |
| PUT | `/api/networth/snapshots/:id` | Update a snapshot (replace entries) |
| DELETE | `/api/networth/snapshots/:id` | Delete a snapshot and its entries |
| POST | `/api/networth/snapshots/:id/carry-forward` | Clone a snapshot's entries |
| GET | `/api/networth/insights/trends` | Time-series net worth data for charts |
| GET | `/api/networth/insights/summary` | Current totals, changes, breakdowns |

### Todo (`/api/todo`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/todo/groups` | List all groups ordered by sort_order |
| POST | `/api/todo/groups` | Create a new group |
| PUT | `/api/todo/groups/reorder` | Batch reorder groups |
| PUT | `/api/todo/groups/:id` | Update a group |
| DELETE | `/api/todo/groups/:id` | Delete a group and its todos |
| GET | `/api/todo/todos` | List todos (filterable: `?groupId=`, `?status=`, `?priority=`, `?dueBefore=`, `?dueAfter=`) |
| POST | `/api/todo/todos` | Create a new todo |
| GET | `/api/todo/todos/:id` | Get todo with subtasks |
| PUT | `/api/todo/todos/:id` | Update a todo |
| DELETE | `/api/todo/todos/:id` | Delete a todo and its subtasks |
| PUT | `/api/todo/todos/:id/move` | Move todo to a different group |
| PUT | `/api/todo/todos/:id/complete` | Mark complete (recurring: logs completion, stays open) |
| PUT | `/api/todo/todos/:id/reopen` | Reopen a completed todo |
| POST | `/api/todo/todos/:id/detach` | Detach one recurring calendar instance into a standalone todo on a new date |
| PUT | `/api/todo/todos/reorder` | Batch reorder todos |
| GET | `/api/todo/stats` | Aggregated stats (open/completed counts, streaks, daily completions) |
| GET | `/api/todo/stats/calendar?month=YYYY-MM` | Calendar data with expanded recurring instances |

### Stocks (`/api/stocks`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stocks` | Dashboard summary plus all active tracked stocks |
| GET | `/api/stocks/summary` | Lightweight home-card summary for tracked names and upside |
| POST | `/api/stocks` | Create a stock record and initial version entry |
| GET | `/api/stocks/:id` | Get stock detail with effective metrics and version history |
| PUT | `/api/stocks/:id` | Update a stock record and append a version |
| DELETE | `/api/stocks/:id` | Delete a stock, its metrics cache, and version history |
| GET | `/api/stocks/:id/history` | List saved versions for a stock |
| POST | `/api/stocks/:id/refresh` | Manually refresh Alpha Vantage metrics for one stock |
| GET | `/api/stocks/presets` | List saved dashboard filter presets |
| POST | `/api/stocks/presets` | Create a filter preset |
| PUT | `/api/stocks/presets/:id` | Update a filter preset |
| DELETE | `/api/stocks/presets/:id` | Delete a filter preset |
| POST | `/api/stocks/agent/chat` | Chat with the AI research agent (SSE stream) |

---

## Client Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | App launcher with summary cards |
| `/networth` | Dashboard | Net worth summary, trend chart, pie charts |
| `/networth/admin` | Admin | Manage family members and categories |
| `/networth/snapshots` | Snapshots | List of all snapshots |
| `/networth/snapshots/new` | New Snapshot | Create a snapshot with entries |
| `/networth/snapshots/:id` | Edit Snapshot | View and modify a snapshot |
| `/networth/insights` | Insights | Trends, projections, goal tracking |
| `/todo` | Todo Dashboard | Quick add, today's focus, overdue/upcoming, stats, and Kanban board |
| `/todo/calendar` | Todo Calendar | Monthly calendar grid with todo chips per day and drag-to-reschedule support |
| `/stocks` | Stocks Dashboard | Finance-style dashboard for tracked stocks with upside and valuation metrics |
| `/stocks/new` | New Stock | Create a stock record with thesis, notes, and manual overrides |
| `/stocks/:id` | Stock Detail | Full-width metrics, research journal with image support, manual overrides, and version history |
| `/stocks/agent` | Stock Agent | AI-powered research assistant chat using Alpha Vantage via MCP |
| `/help` | Help | In-app guide |

---

## Adding a New App

1. **Config**: Create `config/<appName>/` with JSON config files
2. **Shared types**: Add types to `packages/shared/src/index.ts`
3. **Server routes**: Create `packages/server/src/apps/<appName>/` with route files and an `index.ts` router aggregator. Mount in `packages/server/src/index.ts` at `/api/<appName>`
4. **Client pages**: Create `packages/client/src/apps/<appName>/` with `api.ts` and `pages/` directory
5. **Routing**: Add routes in `packages/client/src/App.tsx` under `/<appName>/*`
6. **Navigation**: Add a sidebar section in `packages/client/src/components/Layout.tsx`
7. **Home card**: Add a summary card in `packages/client/src/pages/Home.tsx`

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both server and client in dev mode |
| `npm run build` | Build all packages for production |
| `npm run db:generate` | Generate Drizzle migration files |
| `npm run db:migrate` | Run Drizzle migrations |
| `npm run db:studio` | Open Drizzle Studio to browse the database |

---

## Configuration Files

Config files live in `config/<appName>/` and are version-controlled.

### .env

Server environment variables are loaded from the repo root `.env` first, then `packages/server/.env` as a fallback.

```env
PORT=3001
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here

# Stocks Agent (GitHub Models or any OpenAI-compatible endpoint)
GITHUB_MODELS_TOKEN=your_github_pat_with_models_read
AGENT_MODEL=gpt-4o-mini
AGENT_BASE_URL=https://models.github.ai/inference
```

### config/networth/family-members.json

```json
{
  "members": [
    { "id": "member-1", "name": "Alice", "color": "#4F46E5" },
    { "id": "member-2", "name": "Bob", "color": "#10B981" }
  ]
}
```

### config/networth/categories.json

Contains `assetCategories` and `liabilityCategories` arrays. Each category has an `id`, `name`, and `icon` (Lucide icon name).

### config/networth/goals.json

```json
{
  "goals": [
    {
      "id": "goal-1",
      "name": "Reach $500k combined",
      "targetValue": 50000000,
      "targetDate": "2027-12-31",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

> **Note:** `targetValue` is in cents (50000000 = $500,000).

---

## Todo App

The Planning / Todo app is a feature-rich task manager built with an ultra-modern UI:

- **Dashboard** — 5 widgets: Quick Add bar, Today's Focus, Overdue & Upcoming, Completion Stats (with animated counters and streak tracking), and a full Kanban board
- **Kanban Board** — groups as columns, drag-and-drop todos between groups via @dnd-kit, inline expand to edit
- **Calendar** — custom-built month grid with date-fns, todo chips per day, month navigation with slide animation, and drag-and-drop rescheduling between days
- **Priorities** — 3 levels (High/red, Medium/amber, Low/green) with color-coded badges
- **Recurring Tasks** — daily, weekly, monthly, yearly with custom intervals and weekday selection. Recurring todos stay open; completions are tracked per-date. Dragging a recurring calendar instance to a new day detaches that occurrence into a standalone todo and records the original date as a recurrence exception
- **Subtasks** — todos with a `parentId` (same table, max 1 level deep)
- **Rich Notes** — Tiptap WYSIWYG editor with bold, italic, headings, bullet list, task checklist, code blocks, links, images (paste/drag-drop as base64), and horizontal rules
- **Groups** — dynamic groups with custom name, color, and Lucide icon (auto-suggested from name keywords)
- **Animations** — Framer Motion for layout transitions, React Spring for animated counters and micro-interactions

### Todo Tech Stack

| Package | Purpose |
|---------|--------|
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag-and-drop for Kanban board and calendar rescheduling |
| `framer-motion` | Layout animations, presence, page transitions |
| `@react-spring/web` | Spring-physics animated counters |
| `@tiptap/react` + extensions | Rich-text WYSIWYG editor with image and link support |
| `date-fns` | Date manipulation for calendar and recurrence |

---

## Stocks App

The Stocks app is a finance-oriented research workspace for both watchlist ideas and held positions:

- **Tracking Modes** — each stock can be `watchlist`, `holding`, or `both`
- **Version History** — every save appends a full stock version snapshot so thesis and override changes remain auditable
- **Manual API Refresh** — Alpha Vantage refreshes are explicit, per-stock actions instead of background polling
- **Valuation Metrics** — dashboard and detail pages surface current price, analyst target, P/E, P/B, P/S, EPS growth, and derived upside percentage
- **Dashboard Search & Filters** — text search, 18 sort options, sector filter, 9 numeric range filters, and saved custom presets (`config/stocks/presets.json`)
- **Rich Research Notes** — full-width Research Journal section with Tiptap editor supporting images (paste, drag-drop, toolbar upload as base64), links, headings, and task lists
- **AI Research Agent** — chat-based assistant at `/stocks/agent` powered by GitHub Models (or any OpenAI-compatible endpoint) with Alpha Vantage tools via MCP. Supports real-time streaming via SSE
- **Dark Finance UI** — the Stocks experience has app-scoped dark/light theming without re-theming the rest of the platform
- **Toast Notifications** — global mutation feedback via `react-hot-toast` and TanStack Query `MutationCache`

### Stocks Data Model

- `stocks` stores the latest editable stock state
- `stock_metrics_cache` stores the latest Alpha Vantage-enriched metrics and refresh status
- `stock_versions` stores append-only historical snapshots for each save or API-driven metadata update

---

## Data Backup

Since the SQLite database is gitignored, back it up periodically. The database file is at `data/networth.db`. You can copy this file or use the snapshots list page to review your data.
