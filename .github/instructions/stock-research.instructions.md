---
applyTo: "research/**"
description: Format and integrity rules for generated stock research files.
---

# Stock Research Output Rules

These rules apply to any file created under `research/**` (the gitignored home for generated stock research).

## Structure
- One folder per ticker: `research/<TICKER>/` with `<TICKER>` uppercased.
- Standard files: `00_summary.md`, `01_business.md`, `02_industry.md`, `03_financials.md`, `04_moat.md`, `05_valuation.md`, `06_bull_bear_risks.md`, `HOW_IT_WORKS.md`, `PRIMER.md`, `sources.md`.
- Optional deep-dive files may be added as `07_<topic>.md`, `08_<topic>.md`, … when a subject warrants it. Record the addition in `sources.md`.
- `00_summary.md` leads with the signal rating (🟢🟢🟢 / 🟡🟡🟡 / 🔴🔴), a 2–3 sentence thesis, top 3 for / top 3 against, and a monitoring checklist.

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
- Must cover: the facets of a business (what it sells and to whom · market and competitors · whether the money is real · moat · what you're paying · what could go wrong · management and capital allocation), how the three financial statements fit together, a themed glossary of the **financial** terms the report uses, common ways the numbers mislead, report conventions (fiscal year, TTM, A–E grades, signal ratings), and what the report is not.
- **Every definition is grounded in this company's actual figures** ("→ <TICKER>'s number"). No generic glossaries.
- Link to `HOW_IT_WORKS.md` for domain vocabulary rather than defining it in one-liners.

Both files carry the same guardrails as the rest of the report: no advice, no price targets, disclaimer at the end.

## Integrity
- **No investment advice, no price targets, no price forecasts** — fundamentals-only judgments.
- Every material factual claim carries an inline citation `[Source, date, A–E]`; `sources.md` lists each source with its grade and URL.
- Grade sources A–E (A = SEC filings/company IR; B = industry/analyst research; C = mainstream finance news; D/E = blogs/forums/social, sentiment only).
- Distinguish fact vs. estimate vs. opinion. Never fabricate figures; mark unverifiable claims explicitly.
- Include an "as of" date for time-sensitive data and prefer the latest available information.
- Mandatory cross-validation: earnings vs. operating cash flow, company vs. ≥1 peer, and ≥3 concrete bear risks.

## Disclaimer (required at the end of `00_summary.md`)
> Educational research only — not investment advice, not a recommendation, and not a price forecast. Verify all figures against primary sources. All investing carries risk including loss of principal.
