---
name: research-notes-writer
description: Use to save research output into this app's Stocks API — a concise dated note in the stock's Research Notes (notesHtml) and the structured verdict from decision.json (POST /api/stocks/:id/decisions). Handles finding the stock by symbol, creating it if it isn't tracked yet, and appending / creating / modifying same-date notes. Called at the end of the Stock Research workflow.
---

# Research Notes Writer

Saves research output into the app via the running dev server's Stocks API. It does two things:
1. writes a **concise HTML summary** into the stock's **Research Notes** (`notesHtml` / the Research Journal field)
2. posts the **structured verdict** (`research/<TICKER>/decision/decision.json`) so the app can show the action, fair value and price zones against the live price on the Stock Detail page and the dashboard

These are the only steps of stock research that touch app data.

## Prerequisites

- Dev server running (`npm run dev`) — API base: `http://localhost:3001/api/stocks`.
- A concise summary and a `decision.json` produced by the `stock-research` skill.

## Note format (Tiptap-compatible HTML)

`notesHtml` is rich HTML rendered by Tiptap. Keep it simple: `<h3>`, `<p>`, `<ul><li>`, `<strong>`, `<em>`, `<a href>`. Start each note with a hidden marker and a dated heading, so it can be found and modified later:

```html
<!-- research-note:2026-07-16 -->
<h3>📈 Research Note — 2026-07-16 · 🟡🟡🟡 Neutral · Accumulate (medium conviction)</h3>
<p><strong>Verdict @ $219.20:</strong> Fair value $170–$235–$300 (mid +7%). E[12m] $235 (bear $150 25% · base $245 50% · bull $300 25%).</p>
<p><strong>Zones:</strong> Buy &lt; $185 · Accumulate &lt; $205 · Hold · Trim &gt; $270 · Sell &gt; $320 · Re-underwrite below $165. Next review 2026-11-19.</p>
<p><strong>Thesis:</strong> 2–3 sentence summary of the setup.</p>
<p><strong>For:</strong></p>
<ul><li>reason 1</li><li>reason 2</li><li>reason 3</li></ul>
<p><strong>Against / risks:</strong></p>
<ul><li>risk 1</li><li>risk 2</li><li>risk 3</li></ul>
<p><strong>Thesis breakers:</strong> breaker 1; breaker 2.</p>
<p><em>Sources: SEC 10-Q (A), earnings call (A), news (C). Full report: research/&lt;TICKER&gt;/</em></p>
<p><em>AI-generated personal research — model outputs on stated assumptions, not advice from a licensed professional.</em></p>
```

In **earnings mode**, use the heading `📊 Earnings Update — <date> · <FQ>` and lead with results vs. our base case and any change of action or zones.

## Write modes

- **new** — stock has no `notesHtml`: set it to the note.
- **append** (default) — prepend the new dated section above existing notes (newest first), keeping all prior notes.
- **modify** — if a section with today's marker `<!-- research-note:YYYY-MM-DD -->` already exists, replace that section (from its marker up to the next `<!-- research-note:` marker or end) instead of adding a duplicate.

## Steps

1. **Resolve the stock by symbol** (case-insensitive):
   ```powershell
   $sym = 'NVDA'
   $dash = Invoke-RestMethod 'http://localhost:3001/api/stocks'
   $row = $dash.rows | Where-Object { $_.stock.symbol -eq $sym }
   ```
2. **If not tracked**, offer to create it, then use the returned id:
   ```powershell
   $created = Invoke-RestMethod -Method Post 'http://localhost:3001/api/stocks' -ContentType 'application/json' `
     -Body (@{ symbol = $sym; companyName = 'NVIDIA Corp'; trackingMode = 'watchlist' } | ConvertTo-Json)
   $id = $created.id
   ```
3. **Fetch current notes** (to append/modify correctly):
   ```powershell
   $detail = Invoke-RestMethod "http://localhost:3001/api/stocks/$id"
   $existing = $detail.notesHtml   # may be null/empty
   ```
4. **Compose** `$newNotes` per the write mode (new / append / modify). Preserve existing content when appending.
5. **Save** (this also creates a manual version snapshot server-side):
   ```powershell
   $body = @{ notesHtml = $newNotes } | ConvertTo-Json -Depth 4
   Invoke-RestMethod -Method Put "http://localhost:3001/api/stocks/$id" -ContentType 'application/json' -Body $body | Out-Null
   ```
6. **Post the structured verdict** (skip in compare mode). This upserts by `(stock, asOf)`, so re-running on the same day replaces that day's verdict:
   ```powershell
   $decision = Get-Content "research/$sym/decision/decision.json" -Raw
   Invoke-RestMethod -Method Post "http://localhost:3001/api/stocks/$id/decisions" -ContentType 'application/json' -Body $decision
   ```
   A `400` means the payload failed validation. Common causes: zones out of order, probabilities that don't sum to 1, a symbol mismatch, or prices given in cents instead of dollars. Fix `decision.json`, then retry. Don't loosen the data to get past the check.
   - `GET /api/stocks/:id/decisions` lists past verdicts, newest first.
   - `DELETE /api/stocks/:id/decisions/:decisionId` removes one.
   - The latest verdict appears as `research` on `GET /api/stocks/:id` and on each dashboard row. It includes the `priceZone` evaluated against the cached price, `fairValueUpsidePercent`, `reviewDue` and `belowReviewPrice`.

## Notes

- Sending only `{ notesHtml }` to `PUT /:id` is safe. The server merges it with the existing fields and records a `manual` version.
- Prices in `decision.json` are **dollars**. The app's own metrics are in cents. Don't mix them up.
- Keep the in-app note concise. The long-form analysis lives in `research/<TICKER>/`.
