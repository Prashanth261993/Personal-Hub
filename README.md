# Personal Hub

A personal productivity platform with a modular app architecture. React SPA frontend + Express/SQLite backend in an npm workspaces monorepo. Single-user, local-first — no authentication.

## Apps

| App | Route | Description | Status |
|-----|-------|-------------|--------|
| **Net Worth** | `/networth` | Track assets and liabilities for each family member, view trends, and get insights | Active |
| **Planning / Todo** | `/todo` | Task and project management | Coming Soon |

## Architecture

```
PersonalHub/
├── config/
│   ├── networth/                # Net Worth JSON configs
│   │   ├── family-members.json
│   │   ├── categories.json
│   │   └── goals.json
│   └── todo/                    # Todo JSON configs (future)
├── data/                        # SQLite databases (gitignored)
├── packages/
│   ├── shared/                  # @networth/shared — TypeScript types & utilities
│   ├── server/                  # Express API server (port 3001)
│   │   └── src/
│   │       ├── apps/
│   │       │   ├── networth/    # Net Worth routes
│   │       │   └── todo/        # Todo routes (future)
│   │       ├── db/              # Drizzle ORM + SQLite
│   │       └── lib/             # Shared server helpers
│   └── client/                  # Vite + React SPA (port 5173)
│       └── src/
│           ├── apps/
│           │   ├── networth/    # Net Worth pages & API
│           │   └── todo/        # Todo pages & API (future)
│           ├── components/      # Platform-level components (Layout, etc.)
│           ├── lib/             # Shared client helpers
│           └── pages/           # Platform-level pages (Home)
└── package.json                 # npm workspaces root
```

**Key decisions:**
- **App-scoped structure**: Each app has its own directory under `config/`, `server/src/apps/`, and `client/src/apps/`
- **Namespaced API routes**: Each app is mounted at `/api/<appName>/*`
- **Config vs DB split**: App configurations are JSON files in `config/<appName>/` (version-controlled). Data lives in SQLite at `data/` (gitignored)
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

## Data Backup

Since the SQLite database is gitignored, back it up periodically. The database file is at `data/networth.db`. You can copy this file or use the snapshots list page to review your data.
