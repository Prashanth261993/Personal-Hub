---
mode: agent
description: Research a stock ticker (full / refresh / earnings / compare), write the knowledge report + decision layer to research/<TICKER>/, and save a concise note + structured verdict to the app.
---

# /research-stock

Research: **${input:ticker:Ticker(s) or request (e.g. NVDA · "refresh MU" · "NVDA earnings" · "compare MU NVDA")}**

Act as the **Stock Researcher** agent and follow the `stock-research` and `research-notes-writer` skills.

Steps:
1. Pick the **mode**: full / refresh / earnings / compare. If `research/<TICKER>/` already exists, default to refresh.
2. Briefly confirm my **investment style, horizon, focus areas and risk tolerance**, and ask whether I **hold it** (shares, cost basis). If I say "just go", assume value-leaning, long-term, balanced risk, not held.
3. Do your **own** web-based discovery from free/primary sources (SEC EDGAR, company IR, earnings transcripts, reputable finance sites). Don't base the analysis on this app's stored metrics or screener. 13F positioning data and my own holdings are allowed as context. Cite every material fact with an A–E grade.
4. Cross-validate: earnings vs. operating cash flow, ≥1 peer, ≥3 bear risks.
5. Build the **decision layer**: ≥3 valuation models → probability-weighted bear/base/bull scenarios (12m and 3y) → price levels computed from downloaded price data → sentiment and positioning → red-team critique → verdict with an action rating, conviction, price zones, thesis-break triggers and sizing.
6. Write everything to `research/<TICKER>/` (uppercased) using the skill's layout, including `decision/decision.json` and a `decision/log.md` row.
7. Save a concise, dated HTML note to the stock's **Research Notes**, and post the **structured verdict** to the app. If the ticker isn't tracked yet, offer to create it first.

Constraints: no bare single-point targets. Every forecast must show its drivers, its probabilities and its sources. End with the standard disclaimer.

Report back: signal, action and conviction, fair value range, E[12m], zones, thesis, top reasons for/against, what the red team changed, the report path, and the app status.
