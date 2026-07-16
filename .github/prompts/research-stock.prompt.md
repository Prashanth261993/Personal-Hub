---
mode: agent
description: Run independent web-based investment research on a stock ticker, write a full report to research/<TICKER>/, and save a concise note to the stock's Research Notes.
---

# /research-stock

Research the stock: **${input:ticker:Ticker or company name (e.g. NVDA)}**

Act as the **Stock Researcher** agent and follow the `stock-research` and `research-notes-writer` skills.

Steps:
1. Briefly confirm my **investment style, horizon, focus areas, and risk tolerance** (assume value-leaning, long-term, balanced risk if I say "just go").
2. Do your **own** web-based discovery from free/primary sources (SEC EDGAR, company IR, earnings transcripts, reputable finance sites) — do **not** base the analysis on this app's stored metrics/screener/13F data. Prefer the latest information and cite every material fact with an A–E source grade.
3. Cross-validate (earnings vs. operating cash flow, vs. ≥1 peer, ≥3 bear risks).
4. Write the full report to `research/<TICKER>/` (uppercased) using the skill's file layout.
5. Save a concise, dated HTML summary into the stock's **Research Notes** via the API (append new / create if empty / modify same-date). If the ticker isn't tracked yet, offer to create it first.

Constraints: educational only — **no buy/sell advice and no price targets**. End with the standard disclaimer.

Report back the signal rating, thesis, top reasons for/against, the report path, and the in-app note status.
