---
name: Stock Research (Independent Web Discovery)
description: Use when the user wants to research a stock/ticker/company for investing — e.g. "research NVDA", "/research-stock AAPL", "deep dive on Micron", "what's the bull/bear case for IREN". Runs independent web-based due diligence (NOT grounded in this app's stored metrics), writes a full report under the gitignored research/ folder, and saves a concise note into the stock's Research Notes in the app.
---

# Stock Research — Independent Web Discovery

This skill performs **independent, web-sourced investment research** on a single company. It does its **own discovery** from public/free sources. It must **not** treat this repo's stored Alpha Vantage cache, screener, or 13F data as the basis of the analysis — those are the app's own numbers, not research. (The only app touchpoint is the final step: saving a concise note into the stock's Research Notes — see the `research-notes-writer` skill.)

## Guardrails (non-negotiable)

- **Educational only. Not investment advice.** Do not tell the user to buy or sell.
- **No price targets or price predictions.** The signal rating is a fundamentals-only judgment, not a forecast.
- Prefer **primary and free sources**; grade every source (see Citation Quality).
- Distinguish **fact vs. estimate vs. opinion**. Never fabricate figures. If data can't be verified, say so.
- Always end reports and notes with the standard disclaimer (below).

## Inputs — refine intent first

Before researching, confirm (ask once, concisely; assume sensible defaults if the user says "just go"):
1. **Investment style** — value / growth / turnaround / dividend (default: balanced).
2. **Holding horizon** — short (<6mo) / medium (6–18mo) / long (1–3yr+) (default: long).
3. **Focus areas** — pick 2–3: business quality, financial quality, industry, valuation, governance, catalysts, risks.
4. **Risk tolerance** — conservative / balanced / aggressive (default: balanced).

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
5. **Valuation (relative + light intrinsic)** — current multiples (P/E, EV/EBITDA, P/S, P/B, FCF yield) vs. history and peers; a simple scenario/DCF sketch if inputs are reliable. **No single price target** — describe ranges and what they imply.
6. **Bull / bear / risks** — 3+ bull points, **3+ bear/risk points** (mandatory), key debates, and what would change the thesis.
7. **Synthesis** — signal rating + thesis + monitoring checklist.

## Cross-validation (mandatory)

- Profit vs. cash: is OCF tracking net income? Flag large divergences.
- Company vs. peer: compare 2–3 key ratios/margins against at least one competitor.
- Bear case: at least 3 concrete downside risks with triggers.

## Citation quality

Every material factual claim gets an inline citation: `[Source, date, A–E]` with a URL in the sources list. Reports include a `sources` section listing each with its grade.

## Signal rating (fundamentals only)

- 🟢🟢🟢 **Strong** — durable moat, healthy financials, attractive vs. history/peers.
- 🟡🟡🟡 **Neutral** — fairly valued or mixed signals / limited margin of safety.
- 🔴🔴 **Caution** — deteriorating fundamentals, weak balance sheet, or stretched valuation.

State the top 3 reasons for and against.

## Outputs

**1. Full report → `research/<TICKER>/` (gitignored):**

```
research/<TICKER>/
├── 00_summary.md          # signal, thesis, top reasons, monitoring checklist
├── 01_business.md
├── 02_industry.md
├── 03_financials.md       # incl. cross-validation
├── 04_moat.md
├── 05_valuation.md
├── 06_bull_bear_risks.md
└── sources.md             # every source with A–E grade + URL + date
```
Use `<TICKER>` uppercased (e.g. `research/NVDA/`). Follow the format enforced by `.github/instructions/stock-research.instructions.md`.

**2. Concise note → the stock's Research Notes (in-app):**
Hand off to the **`research-notes-writer`** skill to save a short HTML summary (signal, 2–3 sentence thesis, top reasons, key risks, sources line, disclaimer) into the stock's `notesHtml` via the API. Append a new dated section, create notes if empty, or modify an existing same-date section.

## Standard disclaimer (append to every report and note)

> Educational research only — not investment advice, not a recommendation, and not a price forecast. Verify all figures against primary sources. All investing carries risk including loss of principal.
