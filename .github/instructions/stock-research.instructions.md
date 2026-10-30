---
applyTo: "research/**"
description: Format and integrity rules for generated stock research files.
---

# Stock Research Output Rules

These rules apply to any file created under `research/**` (the gitignored home for generated stock research).

## Structure
- One folder per ticker: `research/<TICKER>/` with `<TICKER>` uppercased.
- Standard knowledge files: `00_summary.md`, `01_business.md`, `02_industry.md`, `03_financials.md`, `04_moat.md`, `05_valuation.md`, `06_bull_bear_risks.md`, `HOW_IT_WORKS.md`, `PRIMER.md`, `sources.md`.
- Standard decision files: `decision/1_valuation_models.md`, `decision/2_scenarios_forecast.md`, `decision/3_price_levels.md`, `decision/4_sentiment_positioning.md`, `decision/5_red_team.md`, `decision/6_verdict.md`, `decision/decision.json`, `decision/log.md`, and `decision/data/` (downloaded data + calculation scripts).
- Created by later runs: `CHANGES.md` (refresh mode, newest first), `updates/<YYYY-MM-DD>_<FQ>.md` (earnings mode), and `decision/history/<YYYY-MM-DD>/` (archived earlier decision layers). Compare-mode output goes in `research/_compare/<YYYY-MM-DD>_<T1>-<T2>….md`.
- Optional deep-dive files may be added as `07_<topic>.md`, `08_<topic>.md`, … when a subject warrants it. Record the addition in `sources.md`.
- `00_summary.md` leads with the signal rating (🟢🟢🟢 / 🟡🟡🟡 / 🔴🔴), then a **decision box** (action, conviction, as-of price, fair-value range, margin of safety, E[12m], 3-yr IRR, zones, review level, next review date), then a 2–3 sentence thesis, the top 3 for / top 3 against, and a monitoring checklist.

## Decision layer rules
- Every decision file opens with the **as-of price, date and time**.
- **Valuation models**: at least 3 independent methods chosen to fit the business type. Show the WACC derivation plus the result at a 10% hurdle rate, a sensitivity grid for every DCF, a football-field table and chart, and a triangulated fair-value range with the weight on each method and the reason for it.
- **Price forecasts** are Bear/Base/Bull (plus a tail case if the distribution is skewed) at 12 months and 3 years. Each price = fundamental driver × multiple, with the arithmetic shown. Probabilities sum to 100% and each is justified. Report the probability-weighted price, the expected return/IRR, and the downside-to-upside ratio. **Never publish a bare single-point target.**
- **Price levels** must be computed from downloaded OHLCV saved to `decision/data/prices.csv`, using a script saved in `decision/data/`. No levels copied from news articles. Mark where technical and fundamental levels line up.
- **Red team** runs before the verdict. Accepted High-severity challenges must change the upstream files.
- **Verdict**: one action rating (Strong Buy · Buy · Accumulate on weakness · Hold · Trim · Sell · Avoid) plus conviction. Zones are contiguous and ordered (buy < accumulate < hold < trim < sell), and each boundary is tied to a level from files 1–3. Include 3–5 fundamental thesis-break triggers, a price-based review level, a position-sizing framework and a −2..+2 scorecard.
- `decision.json` follows the schema in the `stock-research` skill exactly and agrees with `6_verdict.md`.
- `log.md` is append-only. Past rows may only gain outcome/grade columns.

## Teaching docs — two required files, kept separate

### `HOW_IT_WORKS.md` — the domain deep-dive
- **Required in every report.** Teaches the **industry, product, technology and business model** — company-specific, in depth.
- **This is an explainer, not a glossary.** The failure mode to avoid is reducing rich domain concepts to one-line table rows. Concepts that drive the investment case get their own section with a diagram.
- **No financial ratios here** — those belong in `PRIMER.md`.
- Explain **mechanism, not just meaning**, and after each mechanism answer "so what does this mean for the company's economics?"
- Use **Mermaid** for flows, cycles, value chains and dependency maps; **ASCII art** for physical structures. Markdown + diagrams is the required format — not slide decks.
- Label general engineering/industry principles as such; cite every company- and market-specific claim with an A–E grade.

### `PRIMER.md` — the finance-side explainer
- **Required in every report.** Written for a reader who has never read a financial statement.
- Must cover: the facets of a business (what it sells and to whom · market and competitors · whether the money is real · moat · what you're paying · what could go wrong · management and capital allocation), how the three financial statements fit together, a themed glossary of the **financial** terms the report uses (including the decision-layer terms: WACC, DCF, margin of safety, expected value, IRR, support/resistance, ATR, volatility, short interest, estimate revisions, Form 4), common ways the numbers mislead, report conventions (fiscal year, TTM, A–E grades, signal vs. action ratings), a "how to read the decision layer" section, and what the report is not.
- **Every definition is grounded in this company's actual figures** ("→ <TICKER>'s number"). No generic glossaries.
- Link to `HOW_IT_WORKS.md` for domain vocabulary rather than defining it in one-liners.

Both files are part of the knowledge layer: they explain rather than recommend, and they end with the disclaimer.

## Integrity
- **Knowledge layer** (`00`–`06`, deep-dives, teaching docs) is descriptive: no price targets of its own, apart from the `00_summary.md` decision box, which copies its figures from `decision/`.
- **Decision layer** commits to a view. Every forecast input traces to a citation, a stated base rate, or a labelled assumption. Forecasts are labelled as model outputs.
- Every material factual claim carries an inline citation `[Source, date, A–E]`; `sources.md` lists each source with its grade and URL.
- Grade sources A–E (A = SEC filings/company IR; B = industry/analyst research; C = mainstream finance news; D/E = blogs/forums/social, sentiment only).
- Distinguish fact vs. estimate vs. opinion. Never fabricate figures; mark unverifiable claims explicitly.
- Include an "as of" date for time-sensitive data and prefer the latest available information.
- Mandatory cross-validation: earnings vs. operating cash flow, company vs. ≥1 peer, and ≥3 concrete bear risks.

## Disclaimer (required at the end of `00_summary.md`, `decision/6_verdict.md`, and every in-app note)
> Personal research generated by an AI model from public sources — not advice from a licensed financial professional. Price targets and zones are model outputs built on stated assumptions and can be wrong. Verify all figures against primary sources. All investing carries risk including loss of principal.
