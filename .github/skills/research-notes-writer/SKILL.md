---
name: Research Notes Writer
description: Use to save a concise research summary into a stock's Research Notes (notesHtml) in this app's Stocks API. Handles finding the stock by symbol, creating it if it isn't tracked yet, and appending a new dated note / creating notes if empty / modifying an existing same-date note. Called at the end of the Stock Research workflow.
---

# Research Notes Writer

Saves a **concise HTML summary** into a stock's **Research Notes** (the `notesHtml` / Research Journal field) via the running dev server's Stocks API. This is the only step of stock research that touches app data.

## Prerequisites

- Dev server running (`npm run dev`) — API base: `http://localhost:3001/api/stocks`.
- A concise summary produced by the `stock-research` skill.

## Note format (Tiptap-compatible HTML)

`notesHtml` is rich HTML rendered by Tiptap. Keep it simple: `<h3>`, `<p>`, `<ul><li>`, `<strong>`, `<em>`, `<a href>`. Start each note with a hidden marker + a dated heading so it can be located and modified later:

```html
<!-- research-note:2026-07-16 -->
<h3>📈 Research Note — 2026-07-16 · 🟡🟡🟡 Neutral</h3>
<p><strong>Thesis:</strong> 2–3 sentence summary of the setup.</p>
<p><strong>For:</strong></p>
<ul><li>reason 1</li><li>reason 2</li><li>reason 3</li></ul>
<p><strong>Against / risks:</strong></p>
<ul><li>risk 1</li><li>risk 2</li><li>risk 3</li></ul>
<p><em>Sources: SEC 10-Q (A), earnings call (A), news (C). Full report: research/&lt;TICKER&gt;/</em></p>
<p><em>Educational research only — not investment advice or a price forecast.</em></p>
```

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

## Notes

- Sending only `{ notesHtml }` to `PUT /:id` is safe — the server merges with existing fields and records a `manual` version.
- Do not include price targets or buy/sell advice in the note (see the `stock-research` guardrails).
- Keep the in-app note concise; the long-form analysis lives in `research/<TICKER>/`.
