# Plan: Hedge Fund 13F Tracker App (`funds`)

> Multi-session implementation plan. Each phase is self-contained and shippable.
> Update the **Status** column as phases complete so a future session can resume.

## Goal

Add a new sub-app — **Funds** — to Personal Hub that parses SEC EDGAR **13F-HR** filings
of well-known institutional managers (hedge funds), lets the user track funds, view their
latest reported holdings, see quarter-over-quarter changes, screen holdings across funds,
and cross-link holdings to the existing Stocks app.

All data comes from **SEC EDGAR** (https://www.sec.gov / https://data.sec.gov) — fully free,
no API key. The pipeline must respect SEC fair-access rules:

- A descriptive `User-Agent` header is **required** on every request.
- Stay under ~10 requests/second (we use a conservative single-flight + small delay).
- 13F data is **quarterly** and filed up to **45 days after** quarter end (lagging dataset).

### Key domain facts / gotchas

- 13F covers **long US-listed equity / options positions only** — no shorts, no cash, no
  non-US holdings. It is an incomplete picture of a fund.
- Filings report **CUSIP + issuer name**, never a ticker. There is **no complete free
  CUSIP→ticker source** (CUSIP data is licensed). We bridge this with best-effort
  name/CUSIP matching against our own `stocks` table + manual confirmation.
- The 13F `value` column is reported in **whole dollars** for modern filings (post the 2023
  rule change; previously thousands). Phase 1 only fetches the **latest** filing, so we treat
  `value` as whole dollars → store as cents (`value * 100`). When backfilling older filings
  (Phase 2), detect period date < 2023-Q1 and multiply by 1000 first.
- A fund = a **CIK** (Central Index Key), zero-padded to 10 digits for the submissions API.

## Architecture (mirrors the Stocks app)

```
config/funds/seed.json                         # version-controlled famous-fund seed list
packages/shared/src/index.ts                   # Fund / FundFiling / FundHolding / HoldingDelta types
packages/server/src/apps/funds/
  index.ts                                      # router aggregator → /api/funds
  lib/secEdgar.ts                               # SEC fetch + rate-limit + XML parse
  lib/seed.ts                                   # seed funds into DB on startup
  routes/funds.ts                               # CRUD, refresh, holdings
  routes/screener.ts                            # (Phase 3) cross-fund screening
packages/client/src/apps/funds/
  api.ts                                        # axios baseURL '/api/funds'
  pages/Dashboard.tsx                           # tracked funds grid
  pages/FundDetail.tsx                          # holdings + (Phase 2) deltas
  pages/Screener.tsx                            # (Phase 3) cross-fund screen
```

### DB schema (added to `schema.ts` + `migrate.ts`)

```
funds            id, cik (unique), name, status ('active'|'archived'),
                 last_synced_at, created_at, updated_at
fund_filings     id, fund_id (FK→funds CASCADE), accession_number (unique),
                 period_of_report (YYYY-MM-DD), quarter ('YYYY-Q#'),
                 filed_at, total_value_cents, position_count, created_at
fund_holdings    id, filing_id (FK→fund_filings CASCADE), issuer_name, cusip,
                 ticker (nullable), stock_id (FK→stocks SET NULL, nullable),
                 value_cents, shares, put_call (nullable),
                 pct_of_portfolio (real), created_at
cusip_map        cusip (PK), ticker, source ('auto'|'manual'), updated_at   # Phase 2
```

Indexes: `fund_filings.fund_id`, `fund_filings.quarter`, `fund_holdings.filing_id`,
`fund_holdings.cusip`, `fund_holdings.stock_id`.

## Conventions to follow (from copilot-instructions)

- Monetary values stored as **integer cents**.
- Server local imports use `.js` extension; ESM throughout.
- Routes mounted at `/api/funds/*`; route files export default `Router`.
- Errors: `res.status(code).json({ error })` + `console.error`, always try/catch.
- IDs via `uuid.v4()`; config read/write helpers in `src/lib/config.ts`.
- Client: TanStack Query v5, array query keys, mutations set `meta.successMessage`.
- Card style `bg-white rounded-xl border border-gray-200 p-6`; primary button style per instructions.
- New deps: server `fast-xml-parser` (13F info-table parsing).

---

## Phase 1 — Track funds, manual refresh, view latest holdings  ·  Status: ✅ DONE

Smallest end-to-end vertical slice. Pre-seeds well-known funds; user refreshes a fund to pull
its most recent 13F-HR from SEC; views the holdings table.

1. **Shared types**: `Fund`, `FundFiling`, `FundHolding`, `FundDetailResponse`,
   `FundsDashboardRow`, `FundsHomeSummary`, `RefreshFundResponse`.
2. **DB**: add `funds`, `fund_filings`, `fund_holdings` tables to `schema.ts` + `migrate.ts`.
3. **Config**: `config/funds/seed.json` + `getFundSeed()` helper in `config.ts`.
4. **SEC client** (`lib/secEdgar.ts`):
   - `getSubmissions(cik)` → latest 13F-HR accession + report/filing dates.
   - `getInfoTableHoldings(cik, accessionNumber)` → fetch filing index, locate info-table
     XML, parse rows (issuer, cusip, value, shares, putCall).
   - Token-bucket / single-flight rate limiter + required `User-Agent`.
5. **Seed** (`lib/seed.ts`): insert seed funds not already present; called on startup.
6. **Routes** (`routes/funds.ts`):
   - `GET /api/funds` — tracked funds + latest filing summary (dashboard rows).
   - `GET /api/funds/summary` — home card counts.
   - `GET /api/funds/:id` — fund + filings list + latest holdings.
   - `GET /api/funds/:id/holdings?filingId=` — holdings for a filing.
   - `POST /api/funds/:id/refresh` — pull latest 13F-HR, upsert filing + holdings.
   - `POST /api/funds` (add by CIK) / `DELETE /api/funds/:id`.
7. **Wiring**: mount router in `index.ts`, call seed after migrations.
8. **Client api** (`api.ts`) + pages **Dashboard** (grid + add-by-CIK + refresh) and
   **FundDetail** (filing switcher + holdings table).
9. **Platform**: route group `/funds/*` in `App.tsx`, sidebar section in `Layout.tsx`
   (icon `Building2`), summary card on `Home.tsx`.

**Done when**: pre-seeded funds appear, a refresh pulls real holdings from SEC, and the
holdings table renders with value / shares / % of portfolio.

**Verified**: build passes (shared → server → client); live SEC fetch for Berkshire
(CIK 0001067983) returned the 2026-03-31 13F-HR with 90 parsed holdings and correct cent
values. Note: 13F info tables list one row per investment manager, so a single issuer can
appear in multiple rows — Phase 1 stores them as-is (no per-issuer aggregation); aggregation
is deferred to Phase 2.

## Phase 2 — Quarter-over-quarter deltas + cross-link to Stocks  ·  Status: ✅ DONE

1. Backfill: `POST /api/funds/:id/refresh` fetches the last N (e.g. 4–8) filings, handling the
   pre-2023 thousands→dollars unit rule by period date.
2. `cusip_map` table + best-effort auto-link: match `fund_holdings.issuer_name`/`cusip`
   against `stocks` (company name / symbol) and SEC `company_tickers.json`; set `stock_id`/`ticker`.
3. `POST /api/funds/holdings/:id/link` — manual map a holding to a tracked stock.
4. `GET /api/funds/:id/deltas?from=&to=` — compute `new | add | trim | exit | hold` per position
   with share/value/% change.
5. Client: FundDetail gains a **Changes** tab (color-coded deltas) and links to Stock Detail
   when `stock_id` is set.

_Verified live (Berkshire CIK 0001067983): refresh backfilled 5 prior filings; `/deltas` returned
45 positions with correct new/add/trim/exit/hold classification; auto-link + the post-import
backfill pass resolved 61/90 tickers on the latest filing via SEC `company_tickers.json`._

## Phase 3 — Cross-fund screener  ·  Status: ✅ DONE

1. `GET /api/funds/screener` — aggregate across funds: most-owned tickers, # funds holding,
   total value, conviction (avg % of portfolio), filters/sort.
2. Client `pages/Screener.tsx` — searchable/sortable table; reuse preset/filter UX from Stocks
   if useful.
3. Sidebar child link **Screener**.

_Verified live: `/screener` aggregates each fund's latest filing by CUSIP (collapsing duplicate
manager rows), then across funds with `fundCount`, `totalValueCents`, and avg conviction.
`screener.ts` is mounted before the `:id` route so `/screener` isn't captured as a fund id._

## Phase 4 — Documentation sync  ·  Status: ✅ DONE  (ALWAYS LAST)

Capture everything built in Phases 1–3 into project docs:

1. **`README.md`** — add a Funds app section (purpose, routes, data source, free-tier notes).
2. **`.github/copilot-instructions.md`** — add:
   - Funds app to the overview + Project Structure tree.
   - DB Schema (Funds) block.
   - Funds architecture notes (SEC EDGAR client, rate-limit/User-Agent, CUSIP caveat,
     value-units rule, manual-refresh model, cross-link approach).
   - Query keys (`['funds']`, `['fund', id]`, `['fund-holdings', filingId]`, `['funds-summary']`).
   - Server dep `fast-xml-parser`.
3. **`.github/doc-sync-state.json`** — update `lastReviewedCommit` to the latest commit.
4. Update `/memories/repo/` with a `funds-app.md` summary.

Review the relevant git diff first and document only the contributor-relevant delta.
