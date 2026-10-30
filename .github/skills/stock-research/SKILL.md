---
name: stock-research
description: Use when the user wants to research a stock/ticker/company for investing — e.g. "research NVDA", "/research-stock AAPL", "deep dive on Micron", "what's the bull/bear case for IREN", "should I buy/sell X", "refresh NVDA", "X just reported earnings", "compare MU vs NVDA". Runs independent web-based due diligence (NOT grounded in this app's stored metrics), writes a full knowledge report plus a decision layer (valuation models, price scenarios, price levels, buy/sell verdict) under the gitignored research/ folder, and saves a concise note + structured verdict into the app.
---

# Stock Research — Independent Web Discovery

This skill performs **independent, web-sourced investment research** on a single company. It does its **own discovery** from public/free sources. It must **not** treat this repo's stored Alpha Vantage cache or screener metrics as the basis of the analysis — those are the app's own numbers, not research. Two narrow exceptions are allowed: the app's **13F Funds data** (SEC-sourced positioning context, see `decision/4_sentiment_positioning.md`), and the user's **own holdings/lots**, with permission. The app touchpoints at the end are the Research Notes and the structured verdict — see the `research-notes-writer` skill.

## Modes — pick one first

| Mode | Trigger | What it does |
|---|---|---|
| **full** (default) | "research X", no `research/<TICKER>/` folder yet | All phases below, knowledge layer + decision layer. |
| **refresh** | "research X" when `research/<TICKER>/` already exists, or "refresh/update X" | Archive the previous decision layer, re-verify facts, rebuild the decision layer, write `CHANGES.md`, and score past calls. See *Refresh mode*. If an older report has no `decision/` folder, refresh just adds it. The knowledge files only get updated where facts changed. |
| **earnings** | "X reported", "post-earnings update on X", or within ~10 days after a report | A quick update against the monitoring checklist and the scenario drivers. See *Earnings mode*. |
| **compare** | "compare X vs Y", "which is better: X, Y, Z" | A relative-value ranking across 2–5 tickers. See *Compare mode*. |

If the mode is ambiguous (e.g. the folder exists and the last report is less than 30 days old), ask: *refresh*, or *earnings*?

## Guardrails (non-negotiable)

The report has two layers with different rules:

- **Knowledge layer** (`00`–`06`, deep-dives, `HOW_IT_WORKS.md`, `PRIMER.md`) — descriptive and fundamentals-only. It explains the business and what the market is pricing in. It does not state its own price targets. The one exception is the decision box in `00_summary.md`, which copies its figures from `decision/`.
- **Decision layer** (`decision/`) — this is where valuation models, price scenarios, price levels and a buy/hold/sell verdict go. The user uses it to make their own buy/sell decisions, so it must commit to a view. Hedging everything into "it depends" is a failure.

Rules for both layers:
- **Ground every number.** Each forecast input (growth, margin, multiple, discount rate, share count) traces to a cited source, a stated historical base rate, or an explicit labelled assumption. A price that can't be traced back to its inputs is not allowed.
- **Never give a bare single-point price.** Every price target is a **probability-weighted set of scenarios**, each one built as *driver × multiple*, with sensitivity shown.
- **Forecasts are model outputs, not facts.** Label them as such, give the "as of" price/date, and state what would make them wrong.
- Prefer **primary and free sources**; grade every source (see Citation Quality).
- Distinguish **fact vs. estimate vs. opinion**. Never fabricate figures. If data can't be verified, say so, and lower confidence.
- **Separate the verdict from the user's personal situation**, unless the user supplied that situation (holdings, cost basis, portfolio weight, tax status). If they did, the verdict addresses their position directly.
- Always end reports and notes with the standard disclaimer (below).

## Inputs — refine intent first

Before researching, confirm (ask once, concisely; assume sensible defaults if the user says "just go"):
1. **Investment style** — value / growth / turnaround / dividend (default: balanced).
2. **Holding horizon** — short (<6mo) / medium (6–18mo) / long (1–3yr+) (default: long).
3. **Focus areas** — pick 2–3: business quality, financial quality, industry, valuation, governance, catalysts, risks.
4. **Risk tolerance** — conservative / balanced / aggressive (default: balanced).
5. **Position context (optional)** — do they already hold it? If so: shares, cost basis, portfolio weight, and whether the lots are short- or long-term. This changes the verdict (e.g. *Trim* vs. *Avoid*), so ask, but don't block on it. Use only what the user tells you. You may read the user's own holding/lot data from the app (`GET /api/stocks/:id/lots`) **only with their permission**. App metrics are still not a research source.

Style adaptation:
- **Value** → balance sheet strength, normalized earnings, margin of safety, FCF yield.
- **Growth** → TAM, unit economics, competitive positioning, durability of growth.
- **Turnaround** → liquidity/solvency, cash runway, catalysts, option value.
- **Dividend** → payout sustainability, FCF coverage, dividend history.

## Free / preferred sources

- **A-grade:** SEC EDGAR filings (10-K, 10-Q, 8-K, proxy), company IR site, official earnings releases & transcripts.
- **B-grade:** reputable industry/analyst research, trade publications.
- **C-grade:** mainstream financial news, Yahoo/Google Finance data pages, well-known finance sites.
- **D/E:** blogs, forums, social posts — use only for sentiment signals, never as fact.

Prefer the **latest** available information (most recent quarter, recent news, latest guidance). Note the "as of" date for time-sensitive claims.

## Research phases

Run these phases (parallelize discovery where the runtime allows). Keep each grounded in cited sources.

1. **Business foundation** — what the company does, revenue mix, customers, geography, strategy.
2. **Industry & competition** — market structure, cycle stage, key competitors, share trends, secular tailwinds/headwinds, regulation.
3. **Financial quality** — 3–5yr trend in revenue, margins, EPS, FCF; balance sheet (debt, liquidity); capital allocation. **Cross-validate** earnings vs. operating cash flow (OCF/NI), and the company vs. ≥1 peer.
4. **Moat & quality** — competitive advantages, pricing power, returns on capital, durability (rate moat 0–5).
5. **Valuation context (descriptive)** — current multiples (P/E, EV/EBITDA, P/S, P/B, FCF yield) vs. history and peers; reverse-DCF of what's priced in; earnings-quality adjustments. This file explains the valuation; the models and targets go in `decision/`.
6. **Bull / bear / risks** — 3+ bull points, **3+ bear/risk points** (mandatory), key debates, and what would change the thesis.
7. **Decision layer** — valuation models, price scenarios, price levels, sentiment and positioning, red-team critique, then the verdict (see *Decision layer* below). Build it after phases 1–6, because the scenario drivers have to come from them.
8. **Synthesis** — signal rating + action rating + thesis + monitoring checklist in `00_summary.md`.
9. **Teaching docs** — translate the report for a non-expert reader: a finance-side primer and a domain-side deep-dive (see below). Write these **last**, once you know which terms and concepts the report actually used. That includes the decision-layer terms.

## Decision layer (`decision/`)

This layer turns the research into a buy/sell judgment. Every file in it opens with the **as-of price, date and time**. It has six files, a machine-readable `decision.json`, a running `log.md`, and a `data/` folder. Write them in order: the verdict comes last, after the red-team pass.

### `decision/1_valuation_models.md` — independent fair-value estimates

Run **at least three methods that don't depend on each other**, picked to fit the business:

| Business type | Required / preferred methods |
|---|---|
| Profitable, steady FCF | FCF-to-firm **DCF** · reverse DCF · forward multiples vs. peers & own history |
| High-growth / not yet profitable | DCF with an explicit path to steady-state margins · EV/Sales-to-growth vs. peers · reverse DCF (what year-10 revenue/margin is needed) |
| Dividend / income (utilities, REITs, MLPs) | Dividend/distribution discount model · yield vs. own history & spread to the 10-yr Treasury · DCF |
| Banks / insurers | Residual income / P/TBV vs. ROTE · P/E vs. history · dividend model |
| Conglomerate / multi-segment | **Sum-of-the-parts** (each segment at a peer multiple) · DCF |
| Commodity producers (miners, E&P) | **NAV** at strip & mid-cycle prices · EV/EBITDA at mid-cycle · FCF yield at multiple commodity decks |
| Cyclicals (semis, memory, autos, industrials) | **Normalized mid-cycle earnings** × through-cycle multiple · P/B vs. ROE across past cycles · DCF |

Requirements:
- **Derive the discount rate (WACC)**: risk-free rate (cite the current 10-yr), equity risk premium (cite it, e.g. Damodaran), beta (cite it), cost of debt, and the capital weights. Then **also show the result at a fixed 10% hurdle rate**, so tickers can be compared.
- **Use a sensitivity grid** for every DCF: WACC (±2pp) × terminal growth (or exit multiple) at minimum, and a second grid on the main operating driver (growth or margin).
- **Show multiples-based values** as a range: the stock's own 5-yr low / median / high multiple and the peer median, applied to forward estimates (cite the consensus source).
- **Football field**: one table and one ASCII bar chart of low / mid / high per-share value for each method, with the current price marked.
- **Triangulate** into a single **fair-value range** (low–mid–high). Give the weight on each method and say why (e.g. "DCF weighted 50% because FCF is stable; multiples 20% because the peer set is distorted by AMD"). Then state the **margin of safety** = (mid fair value − price) / mid fair value.

### `decision/2_scenarios_forecast.md` — price forecasts with grounded reasoning

- Build **Bear / Base / Bull** scenarios (add a tail "Disaster" or "Blue-sky" case if the distribution is clearly skewed) for **two horizons: 12 months and 3 years**.
- Build each scenario's price as **fundamental driver × valuation multiple** (e.g. FY+2 EPS × P/E, or FCF/share ÷ (WACC − g)). Show the arithmetic. Do the same for the driver itself: revenue growth × margin × share count, each input cited or tied to guidance, consensus, or a historical base rate.
- **Assign probabilities that sum to 100%** and justify them with evidence: base rates (how often has the company hit guidance? how deep were past cycle drawdowns?), the current position in the cycle, and how strong each side of the debate in `06` is.
- Report the **probability-weighted expected price**, **expected total return** (dividends included), **annualized IRR** for the 3-yr case, and the **downside-to-upside ratio** (bear loss ÷ bull gain).
- **Compare the result with sell-side consensus** (mean, low, high target and the number of analysts). Explain where you differ and why. If you agree with consensus, explain what the market might be missing anyway.
- **Pre-mortem**: "It's 12 months later and the stock is down 40% — what most likely happened?" Name the 2–3 most probable paths and the early signs of each.
- **Base-rate check**: does the base case require something the company or industry has rarely done (e.g. >25% revenue CAGR for 5 years, margins above any peer's best)? Say so explicitly.

### `decision/3_price_levels.md` — support, resistance and entry/exit zones

Ground every level in **data that was actually downloaded**, not prose from a news article.

- **Price history**: download ≥3 years of daily OHLCV and save it to `decision/data/prices.csv`. Free source (no key): `https://query1.finance.yahoo.com/v8/finance/chart/<TICKER>?range=5y&interval=1d` (send a browser `User-Agent` header). Compute levels with a small script saved as `decision/data/levels.py` so they can be reproduced. Cite the source as `[Yahoo Finance chart API, <date>, C]`.
- **Technical levels**: 52-wk high/low, 50/200-day SMAs (and whether they're crossing), swing pivots from recent highs/lows, high-volume price zones (a volume-by-price histogram), unfilled gaps, anchored VWAP from the last earnings date, 14-day RSI, and 14-day ATR plus 1-yr realized volatility. List each level with how many times it has held or failed.
- **Fundamental levels**: the price at which the stock would trade at (a) its 5-yr trough forward multiple, (b) a target FCF/dividend yield, (c) the bear-case and base-case fair values from file 1, (d) net cash or tangible book per share where relevant. Where a technical and a fundamental level line up, that confluence is the strongest support. Call it out.
- **Expected move**: the 1-σ 1-month and 12-month ranges from realized volatility. If available, add the options-implied move for the next earnings report (cite the source).
- **Zone map**: one ASCII price ladder from the bear value to the bull value, marking every level, the current price, and the zones defined in file 6.
- **Catalyst calendar**: next earnings date, investor days, product events, regulatory or legal deadlines, lock-up expiries, index events. These are the dates where levels tend to break.

### `decision/4_sentiment_positioning.md` — who else is buying or selling, and what's expected

This file measures what the market already believes. Crowded consensus lowers the payoff even when the thesis is right. Cover each item with its as-of date and source:

- **Analyst estimate revisions**: how next-FY EPS and revenue consensus moved over 30 / 90 days (up/down, %), and the count of upward vs. downward revisions. Add the earnings-surprise history for the last 8 quarters (beat/miss %, and how the stock reacted). Free sources: StockAnalysis, Yahoo Finance analysis pages, Zacks, earnings-call transcripts.
- **Analyst ratings**: rating distribution, mean/high/low target, and recent upgrades and downgrades.
- **Insider activity**: open-market buys and sells over the last 6–12 months from **SEC Form 4** (EDGAR full-text search or `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=<TICKER>&type=4`). Separate discretionary trades from 10b5-1 plan sales and option exercises. Cluster buying by several insiders is the meaningful signal.
- **Short interest**: % of float, days to cover, and the trend across the last few reports (Nasdaq / FINRA / exchange data, or a C-grade aggregator). Add the borrow fee if available.
- **Institutional positioning (13F)**: a quarter-over-quarter summary of which notable funds initiated, added, trimmed or exited, and how concentrated ownership is. The app's Funds data may be used here; it is SEC 13F data, read via `GET http://localhost:3001/api/funds/screener` and filtered to the ticker. Cite it as `[SEC 13F via PersonalHub Funds, <quarter>, A]`, and note the 45-day filing lag. If the app isn't running, use EDGAR or a C-grade 13F aggregator instead.
- **Options and flow (if available)**: implied volatility vs. realized, put/call ratio, skew.
- **Read-across**: give a one-paragraph judgment on whether positioning is **crowded long**, **neutral**, or **washed out / contrarian**, and how that shifts the scenario probabilities in file 2. If it does shift them, go back and update file 2.

### `decision/5_red_team.md` — adversarial review before the verdict

Before writing the verdict, attack your own model.

- **Independent critic**: if the runtime supports sub-agents, launch a separate reviewer (e.g. a `rubber-duck` / critique agent) with files `05`, `06`, `decision/1`–`4` and this brief: *"Find the 5 assumptions most likely to be wrong, the evidence the analyst ignored, and any arithmetic or double-counting errors. Argue the opposite of the current lean."* If there are no sub-agents, do the critique as a deliberate separate pass, written from the other side's point of view.
- **Record each challenge** in a table: challenge · severity (High/Med/Low) · evidence · response (**Accepted → what changed** / **Rejected → why**, with a citation).
- **Arithmetic audit**: re-run `decision/data/*.py` and confirm the markdown numbers match.
- **Steelman the other side**: one paragraph, the strongest case for the opposite action.
- Accepted High-severity challenges **must** change files 1–4 before the verdict is written. List those changes here.

### `decision/6_verdict.md` — the call

- **Action rating** (one of): **Strong Buy · Buy · Accumulate on weakness · Hold · Trim · Sell · Avoid**. It combines the fundamentals (signal rating), price vs. fair value, the shape of the risk/reward, and the user's style, horizon and risk tolerance. If the user gave position context, rate *their position* (e.g. "Hold existing, don't add above $X").
- **Conviction**: High / Medium / Low, with the 2–3 things that set it (data quality, how wide the scenarios are, how well the method results agree).
- **Price plan**:
  - **Buy zone** (the full position becomes justified below this price; ≥15–25% margin of safety depending on risk tolerance)
  - **Starter / accumulate zone**
  - **Hold zone**
  - **Trim zone** (expected return no longer pays for the risk)
  - **Sell / exit zone**

  Tie every boundary to a level in files 1–3. Zones must be contiguous and ordered by price: buy < starter < hold < trim < sell.
- **Thesis-break triggers**: 3–5 specific **fundamental** invalidation conditions (e.g. "gross margin < 60% for two quarters", "top customer cuts capex guide"). Add a **price-based review level** (e.g. a close below the 200-day *and* the bear-case value). That level means *re-underwrite the thesis*, not an automatic sell.
- **Position sizing framework** that scales with conviction, volatility (ATR/beta) and risk tolerance: suggested max portfolio weight, starter fraction, and how to scale in (e.g. thirds at defined levels). If the user is already overweight, say so.
- **If the user holds it**: their gain/loss vs. cost basis. Tax-aware notes: short- vs. long-term lots, and how many days until the lots turn long-term. When trimming, say which lots to trim first, conceptually (specific ID / highest cost).
- **Decision scorecard**: score each from −2 to +2 — Quality · Growth · Valuation · Balance sheet · Momentum/technicals · Sentiment & positioning (from file 4) · Catalysts. Give a one-line reason per row.
- **What would change my mind**: the upgrade triggers and the downgrade triggers.
- **Review date**: when to re-run (usually after the next earnings report, or when price reaches a zone boundary).

### `decision/decision.json` — machine-readable verdict

Mirror the verdict in this exact shape. The app ingests it, so keep the keys and types exact. Prices are **dollars (numbers)**, probabilities are **0–1**, dates are `YYYY-MM-DD`:

```json
{
  "schemaVersion": 1,
  "symbol": "NVDA",
  "asOf": "2026-10-15",
  "priceAtAnalysis": 219.2,
  "mode": "full",
  "signal": "strong",
  "action": "accumulate",
  "conviction": "medium",
  "fairValue": { "low": 170, "mid": 235, "high": 300 },
  "marginOfSafetyPct": 6.7,
  "scenarios": [
    { "name": "bear", "probability": 0.25, "price12m": 150, "price3y": 140, "driver": "FY28 EPS $7.50 × 20x" },
    { "name": "base", "probability": 0.5,  "price12m": 245, "price3y": 310, "driver": "FY28 EPS $11 × 26x" },
    { "name": "bull", "probability": 0.25, "price12m": 300, "price3y": 420, "driver": "FY28 EPS $13 × 30x" }
  ],
  "expectedPrice12m": 235,
  "expectedReturn12mPct": 7.2,
  "zones": { "buyBelow": 185, "accumulateBelow": 205, "trimAbove": 270, "sellAbove": 320 },
  "levels": [
    { "price": 194, "type": "support", "label": "200-day SMA + trough fwd P/E confluence" },
    { "price": 236.5, "type": "resistance", "label": "52-wk high" }
  ],
  "thesisBreakers": ["Data-center revenue declines QoQ for 2 straight quarters", "Gross margin < 65% (non-GAAP)"],
  "reviewPriceBelow": 165,
  "nextReviewDate": "2026-11-19",
  "scorecard": { "quality": 2, "growth": 2, "valuation": 0, "balanceSheet": 2, "momentum": 1, "sentiment": -1, "catalysts": 1 },
  "reportPath": "research/NVDA/"
}
```

Allowed values: `signal` ∈ `strong|neutral|caution`; `action` ∈ `strong-buy|buy|accumulate|hold|trim|sell|avoid`; `conviction` ∈ `high|medium|low`; `mode` ∈ `full|refresh|earnings`; `levels[].type` ∈ `support|resistance|fair-value|review`. Zone keys: the hold zone runs from `accumulateBelow` to `trimAbove`, and the starter/accumulate zone from `buyBelow` to `accumulateBelow`. Scenario probabilities must sum to 1. The server validates all of this and rejects bad payloads with a 400.

### `decision/log.md` — decision journal (append-only)

One row per run, newest last. **Never edit past rows**, except to fill in their outcome columns later:

| Date | Mode | Price | Action | Conviction | FV mid | E[12m] | Bear/Base/Bull 12m | Outcome @12m (filled later) | Grade |
|---|---|---|---|---|---|---|---|---|---|

The grade is filled in once 12 months have passed (see *Refresh mode → scoring*).

### `decision/data/`

Raw downloaded data (`prices.csv` and any estimate snapshots) plus the calculation scripts (`levels.py`, and `dcf.py` if a model is non-trivial). Model numbers in the markdown must match what the scripts produce.

### `decision/history/<YYYY-MM-DD>/`

Archived copies of the decision layer from earlier runs. Refresh and earnings modes create these.

## Refresh mode

Use refresh when `research/<TICKER>/` already exists.

1. **Archive**: copy the current `decision/` files (everything except `history/`, `log.md` and `data/`) into `decision/history/<previous asOf date>/`. If there is no `decision/` folder yet, skip this step.
2. **Re-verify**: check for every filing, earnings report, guidance change and major news item since the last report's as-of date. Update knowledge files **only where facts changed**, and mark each edited section `_(updated YYYY-MM-DD)_`. Don't rewrite good prose that is still correct.
3. **Rebuild** the decision layer in full: fresh prices, fresh models, fresh red-team pass.
4. **Write `CHANGES.md`** at the top of the ticker folder. Put the newest run first and keep older entries. Include:
   - what changed in the facts (bullets with citations)
   - what changed in the thesis (strengthened / weakened / broken)
   - a before → after table for signal, action, conviction, fair-value mid, expected 12m price and zones
   - whether any thesis-break trigger or monitoring item fired
5. **Score past calls**: for every `log.md` row that is ≥12 months old and ungraded, fill in the outcome: actual price, total return vs. the S&P 500 (SPY) over the same window, and which scenario band the actual price landed in. Grade it:
   - **✅** — the action was right in direction, and the price landed inside the bear–bull band
   - **⚠️** — the direction was right but the price was outside the band, or the reverse
   - **❌** — wrong

   Add one sentence on *what we missed*. Summarize the hit rate in `CHANGES.md`. If the bands keep getting breached in the same direction, widen them or reconsider the probabilities from then on.
6. **Append** a new row to `log.md`, and update `00_summary.md`, `decision.json` and the in-app note.

## Earnings mode

A focused update shortly after a quarterly report. It doesn't redo the knowledge layer.

1. Archive the decision layer exactly as in refresh step 1.
2. Write `updates/<YYYY-MM-DD>_<FQ>.md` (e.g. `updates/2026-11-19_Q3FY27.md`) covering:
   - **Results vs. consensus vs. our base-case drivers**: a table of revenue, gross margin, operating margin, EPS, FCF and the key segment KPIs, with columns *actual · consensus · our base · beat/miss*.
   - **Guidance**: new vs. prior guide vs. consensus.
   - **Call takeaways**: 3–6 bullets, citing the transcript or release (grade A).
   - **Monitoring checklist**: go through `00_summary.md` item by item and mark each ✅ / ⚠️ / ❌.
   - **Thesis-break triggers**: the status of each.
   - **Stock reaction**: the move vs. the options-implied move, and whether any level in file 3 broke.
   - **Impact**: which scenario drivers and probabilities change, and why.
3. Update `decision/1`, `2`, `3` and `6` (and `4` if revisions or positioning shifted). Re-run the scripts. Do a **light** red-team: one critique pass on the changed assumptions only, appended to `5_red_team.md` under a dated heading.
4. Update `decision.json` (`mode: "earnings"`), append a row to `log.md`, refresh the decision box in `00_summary.md`, and **modify** today's in-app note (or append a new one).

## Compare mode

Ranks 2–5 tickers so the user can choose where the next dollar goes.

1. For each ticker, reuse `research/<TICKER>/decision/decision.json` if it is **≤45 days old and no earnings report has happened since**. Otherwise, run earnings or refresh mode on it first. If the ticker has no report at all, tell the user a full run is needed (or do one if they agree).
2. Write `research/_compare/<YYYY-MM-DD>_<T1>-<T2>[-<T3>…].md` with:
   - **Side-by-side table**: price, action, conviction, fair-value mid, margin of safety, E[12m return], 3-yr IRR (base and probability-weighted), downside-to-upside ratio, the scorecard rows, net cash/debt, ROIC, revenue growth, forward P/E and EV/EBITDA.
   - **Risk-adjusted ranking**: expected return ÷ bear-case drawdown. A higher conviction breaks ties.
   - **Correlation and overlap**: whether they share drivers (same end-market, same customers, same commodity). If they're highly correlated, owning several is concentration rather than diversification. Use the 1-yr daily return correlation from each ticker's `prices.csv`.
   - **Recommendation**: rank order for new money, and what would flip the ranking. If the user holds any of the tickers, include a "swap" analysis: is selling A to buy B worth the tax cost?
3. Don't write in-app notes in compare mode, unless the user asks.

## Teaching docs (two mandatory outputs)

Research reports accumulate jargon fast — financial, industry and technical. Every report therefore ships **two** explainers, aimed at different gaps. Keep them separate; do not merge them, and do not duplicate content between them.

### `PRIMER.md` — the finance side ("how to read this report")

Makes the numbers legible to someone who has never read a financial statement.

- **Ground every definition in this company's real figures.** Each term gets a plain definition plus a "→ <TICKER>'s actual number". Never ship a generic glossary.
- **Only define terms the report actually uses.** Sweep the analysis files and cover what's there.
- **No jargon inside the explanations.** If a definition needs another term, define that too. Use everyday analogies (a balance sheet is a photograph; a cash flow statement is a bank statement).
- Required sections: (1) the facets of a business, each answered in one line for this company with a pointer to the relevant file; (2) how the three financial statements fit together, including a top-to-bottom walk down this company's actual income statement; (3) a themed glossary (income statement · cash flow · balance sheet · valuation · quality & efficiency · business-model/cycle words); (4) 3–5 ways *this* company's numbers can mislead, each with a worked example from its own history; (5) conventions (fiscal year, TTM, YoY/QoQ, A–E grades, what signal ratings do and don't mean); (6) what the report is not.
- **Link to `HOW_IT_WORKS.md` for all domain vocabulary** rather than defining it here in one-liners.

### `HOW_IT_WORKS.md` — the domain side ("how this business and industry actually work")

Teaches the **industry, the product and the business model** in depth. This is a genuine explainer, **not a glossary** — the most common failure mode is reducing rich domain concepts to one-line definitions. If a concept drives the investment case, it gets a section with a diagram, not a table row.

- **Company- and industry-specific. No financial ratios** — those belong in `PRIMER.md`.
- **Explain mechanism, not just meaning.** Don't say "HBM is stacked memory"; explain *why* stacking is necessary, how it's physically built, and *why making it starves ordinary supply*. Aim for the reader being able to re-explain it to someone else.
- **Tie every technical fact back to the economics.** After each mechanism, answer "so what does this mean for the company?" The physics is only worth teaching because it explains the moat, the cycle, or the margin.
- **Use diagrams.** Mermaid for flows, cycles, value chains and dependency maps; ASCII art for physical structures (chip cross-sections, stacks, hierarchies). Prefer Markdown + Mermaid over slide decks — slides cap the depth and assume a presenter.
- Suggested spine (adapt to the industry): what the product fundamentally is and why anyone needs it · how it physically works · how it's made and why that's hard · the flagship/premium product and what changed · the full current product portfolio · the segments and who the customers really are · how the industry got its current structure · the dominant industry dynamic (for cyclicals, the cycle itself, drawn as a loop) · how money is actually made (unit economics) · the value chain and its chokepoints · the live strategic battles · how to follow the industry yourself · ten things worth remembering.
- Label general engineering/industry principles as such; cite all company- and market-specific claims with A–E grades.

Both files follow the knowledge-layer guardrails: they explain and don't recommend, and they end with the standard disclaimer. `PRIMER.md` **must also define every decision-layer term the report uses** (WACC, DCF, terminal growth, sensitivity grid, margin of safety, probability-weighted expected value, IRR, support/resistance, SMA, ATR, realized/implied volatility, VWAP, short interest, days to cover, estimate revisions, Form 4, 10b5-1), each grounded in this ticker's actual numbers. Add a short **"How to read the decision layer"** section: what an action rating does and doesn't mean, why the target is a range, and how to use the zones.

## Cross-validation (mandatory)

- Profit vs. cash: is OCF tracking net income? Flag large divergences.
- Company vs. peer: compare 2–3 key ratios/margins against at least one competitor.
- Bear case: at least 3 concrete downside risks with triggers.

## Citation quality

Every material factual claim gets an inline citation: `[Source, date, A–E]` with a URL in the sources list. Reports include a `sources` section listing each with its grade.

## Signal rating (fundamentals only) vs. action rating (price-aware)

Two separate ratings appear side by side. A great business at a bad price is 🟢🟢🟢 + *Hold/Trim*. A mediocre business at a distressed price can be 🟡🟡🟡 + *Buy*.

**Signal rating** — how good is the business, regardless of price:
- 🟢🟢🟢 **Strong** — durable moat, healthy financials, attractive vs. history/peers.
- 🟡🟡🟡 **Neutral** — fairly valued or mixed signals / limited margin of safety.
- 🔴🔴 **Caution** — deteriorating fundamentals, weak balance sheet, or stretched valuation.

**Action rating** — what to do at today's price (from `decision/6_verdict.md`): **Strong Buy · Buy · Accumulate on weakness · Hold · Trim · Sell · Avoid**, with conviction High/Medium/Low.

State the top 3 reasons for and against.

## `00_summary.md` — decision box

`00_summary.md` keeps its current structure: signal, thesis, top 3 for/against, monitoring checklist. Add a **Decision box** right after the signal line:

```
| Action | Conviction | Price (as of) | Fair value (low–mid–high) | Margin of safety | E[12m] / return | 3-yr IRR (prob-wtd) |
| Zones: Buy < $X · Accumulate < $Y · Hold · Trim > $Z · Sell > $W | Review below: $R | Next review: YYYY-MM-DD |
```

Link to `decision/6_verdict.md` for the reasoning.

## Outputs

**1. Full report → `research/<TICKER>/` (gitignored):**

```
research/<TICKER>/
├── 00_summary.md          # signal + decision box, thesis, top reasons, monitoring checklist
├── CHANGES.md             # refresh-mode delta log (newest first) incl. scored past calls
├── 01_business.md
├── 02_industry.md
├── 03_financials.md       # incl. cross-validation
├── 04_moat.md
├── 05_valuation.md        # descriptive valuation context (multiples, history, peers, reverse-DCF)
├── 06_bull_bear_risks.md
├── decision/
│   ├── 1_valuation_models.md
│   ├── 2_scenarios_forecast.md
│   ├── 3_price_levels.md
│   ├── 4_sentiment_positioning.md
│   ├── 5_red_team.md
│   ├── 6_verdict.md
│   ├── decision.json      # machine-readable verdict (ingested by the app)
│   ├── log.md             # append-only decision journal
│   ├── data/              # prices.csv, levels.py, dcf.py …
│   └── history/<date>/    # archived prior decision layers
├── updates/               # earnings-mode updates: <YYYY-MM-DD>_<FQ>.md
├── HOW_IT_WORKS.md        # domain deep-dive: industry, product, technology, business model
├── PRIMER.md              # finance-side explainer + glossary, grounded in this company's numbers
└── sources.md             # every source with A–E grade + URL + date
```
Use `<TICKER>` uppercased (e.g. `research/NVDA/`). Follow the format enforced by `.github/instructions/stock-research.instructions.md`. `CHANGES.md` and `updates/` only exist after a refresh or earnings run. Compare-mode output goes in `research/_compare/`.

Additional deep-dive files (e.g. `07_<topic>.md`) may be added when a subject warrants it — note any such addition in `sources.md`, and make sure the teaching docs cover the terms they introduce.

**2. Concise note + structured verdict → the app:**
Hand off to the **`research-notes-writer`** skill. It saves a short HTML summary into the stock's `notesHtml`: signal, action and conviction, fair-value range, zones, a 2–3 sentence thesis, top reasons, key risks, a sources line and the disclaimer. It can append a new dated section, create notes if empty, or modify an existing same-date section. It also **posts `decision/decision.json`** to the stock's research-decision endpoint, so the app can show the verdict and zones against the live price.

## Standard disclaimer (append to every report and note)

> Personal research generated by an AI model from public sources — not advice from a licensed financial professional. Price targets and zones are model outputs built on stated assumptions and can be wrong. Verify all figures against primary sources. All investing carries risk including loss of principal.
