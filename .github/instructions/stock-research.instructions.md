---
applyTo: "research/**"
description: Format and integrity rules for generated stock research files.
---

# Stock Research Output Rules

These rules apply to any file created under `research/**` (the gitignored home for generated stock research).

## Structure
- One folder per ticker: `research/<TICKER>/` with `<TICKER>` uppercased.
- Standard files: `00_summary.md`, `01_business.md`, `02_industry.md`, `03_financials.md`, `04_moat.md`, `05_valuation.md`, `06_bull_bear_risks.md`, `sources.md`.
- `00_summary.md` leads with the signal rating (🟢🟢🟢 / 🟡🟡🟡 / 🔴🔴), a 2–3 sentence thesis, top 3 for / top 3 against, and a monitoring checklist.

## Integrity
- **No investment advice, no price targets, no price forecasts** — fundamentals-only judgments.
- Every material factual claim carries an inline citation `[Source, date, A–E]`; `sources.md` lists each source with its grade and URL.
- Grade sources A–E (A = SEC filings/company IR; B = industry/analyst research; C = mainstream finance news; D/E = blogs/forums/social, sentiment only).
- Distinguish fact vs. estimate vs. opinion. Never fabricate figures; mark unverifiable claims explicitly.
- Include an "as of" date for time-sensitive data and prefer the latest available information.
- Mandatory cross-validation: earnings vs. operating cash flow, company vs. ≥1 peer, and ≥3 concrete bear risks.

## Disclaimer (required at the end of `00_summary.md`)
> Educational research only — not investment advice, not a recommendation, and not a price forecast. Verify all figures against primary sources. All investing carries risk including loss of principal.
