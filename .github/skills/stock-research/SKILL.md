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
8. **Teaching docs** — translate the report for a non-expert reader: a finance-side primer and a domain-side deep-dive (see below). Write these **last**, once you know which terms and concepts the report actually used.

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

Both files carry the same guardrails as the rest of the report: no advice, no price targets, standard disclaimer at the end.

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
├── HOW_IT_WORKS.md        # domain deep-dive: industry, product, technology, business model
├── PRIMER.md              # finance-side explainer + glossary, grounded in this company's numbers
└── sources.md             # every source with A–E grade + URL + date
```
Use `<TICKER>` uppercased (e.g. `research/NVDA/`). Follow the format enforced by `.github/instructions/stock-research.instructions.md`.

Additional deep-dive files (e.g. `07_<topic>.md`) may be added when a subject warrants it — note any such addition in `sources.md`, and make sure the teaching docs cover the terms they introduce.

**2. Concise note → the stock's Research Notes (in-app):**
Hand off to the **`research-notes-writer`** skill to save a short HTML summary (signal, 2–3 sentence thesis, top reasons, key risks, sources line, disclaimer) into the stock's `notesHtml` via the API. Append a new dated section, create notes if empty, or modify an existing same-date section.

## Standard disclaimer (append to every report and note)

> Educational research only — not investment advice, not a recommendation, and not a price forecast. Verify all figures against primary sources. All investing carries risk including loss of principal.
