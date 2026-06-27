$base = "http://localhost:3001/api/todo"
$today = Get-Date
function D([int]$d) { ($today.AddDays($d)).ToString("yyyy-MM-dd") }

$groups = Invoke-RestMethod "$base/groups"
$work     = ($groups | Where-Object { $_.name -eq "Work" }).id
$personal = ($groups | Where-Object { $_.name -eq "Personal" }).id
$health   = ($groups | Where-Object { $_.name -eq "Health" }).id
$learn    = ($groups | Where-Object { $_.name -eq "Learning" }).id

function New-Todo($body) {
  Invoke-RestMethod "$base/todos" -Method Post -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 6)
}

function Add-Sub($parentId, $groupId, $title, $status) {
  $t = New-Todo @{ groupId = $groupId; title = $title; parentId = $parentId }
  if ($status -eq "completed") {
    Invoke-RestMethod "$base/todos/$($t.id)" -Method Put -ContentType "application/json" -Body (@{ status = "completed" } | ConvertTo-Json) | Out-Null
  }
  return $t
}

# ---------------- WORK ----------------
$t = New-Todo @{ groupId = $work; title = "Ship Q2 analytics dashboard release"; priority = "high"; dueDate = (D 1); description = "<p>Final review, changelog, and staged rollout to production.</p>" }
Add-Sub $t.id $work "Write release notes" "completed" | Out-Null
Add-Sub $t.id $work "Run Lighthouse perf audit" "completed" | Out-Null
Add-Sub $t.id $work "Tag v2.4.0 and deploy" "open" | Out-Null

New-Todo @{ groupId = $work; title = "Review pull requests"; priority = "medium"; dueDate = (D 0); recurrence = @{ frequency = "daily"; interval = 1 } } | Out-Null
New-Todo @{ groupId = $work; title = "Prep architecture deck for design review"; priority = "high"; dueDate = (D 3) } | Out-Null
New-Todo @{ groupId = $work; title = "Migrate SQLite indexes for funds screener"; priority = "medium"; dueDate = (D 5) } | Out-Null
New-Todo @{ groupId = $work; title = "1:1 with manager"; priority = "low"; dueDate = (D 2); recurrence = @{ frequency = "weekly"; interval = 1; weekdays = @(3) } } | Out-Null
New-Todo @{ groupId = $work; title = "Investigate Plaid token refresh edge case"; priority = "high"; dueDate = (D -1) } | Out-Null
$wd = New-Todo @{ groupId = $work; title = "Draft 2026 roadmap one-pager"; priority = "medium"; dueDate = (D 7) }
Invoke-RestMethod "$base/todos/$($wd.id)" -Method Put -ContentType "application/json" -Body (@{ status = "completed" } | ConvertTo-Json) | Out-Null

# ---------------- PERSONAL ----------------
$t = New-Todo @{ groupId = $personal; title = "Plan weekend trip to Tahoe"; priority = "medium"; dueDate = (D 4); description = "<p>Cabin, drive route, and packing list.</p>" }
Add-Sub $t.id $personal "Book cabin on Airbnb" "completed" | Out-Null
Add-Sub $t.id $personal "Reserve rental car" "open" | Out-Null
Add-Sub $t.id $personal "Make playlist" "open" | Out-Null

New-Todo @{ groupId = $personal; title = "Pay credit card bill"; priority = "high"; dueDate = (D 2); recurrence = @{ frequency = "monthly"; interval = 1 } } | Out-Null
New-Todo @{ groupId = $personal; title = "Call mom"; priority = "medium"; dueDate = (D 0); recurrence = @{ frequency = "weekly"; interval = 1; weekdays = @(0) } } | Out-Null
New-Todo @{ groupId = $personal; title = "Renew car registration"; priority = "high"; dueDate = (D -2) } | Out-Null
New-Todo @{ groupId = $personal; title = "Water the plants"; priority = "low"; dueDate = (D 1); recurrence = @{ frequency = "daily"; interval = 2 } } | Out-Null
$pd = New-Todo @{ groupId = $personal; title = "Submit reimbursement receipts"; priority = "low"; dueDate = (D -3) }
Invoke-RestMethod "$base/todos/$($pd.id)" -Method Put -ContentType "application/json" -Body (@{ status = "completed" } | ConvertTo-Json) | Out-Null

# ---------------- HEALTH ----------------
New-Todo @{ groupId = $health; title = "Morning run (5k)"; priority = "medium"; dueDate = (D 0); recurrence = @{ frequency = "weekly"; interval = 1; weekdays = @(1,3,5) } } | Out-Null
New-Todo @{ groupId = $health; title = "Annual physical checkup"; priority = "high"; dueDate = (D 9) } | Out-Null
New-Todo @{ groupId = $health; title = "Dentist appointment"; priority = "medium"; dueDate = (D 6) } | Out-Null
New-Todo @{ groupId = $health; title = "Meal prep for the week"; priority = "low"; dueDate = (D 1); recurrence = @{ frequency = "weekly"; interval = 1; weekdays = @(0) } } | Out-Null
$hd = New-Todo @{ groupId = $health; title = "Refill prescription"; priority = "high"; dueDate = (D -1) }
Invoke-RestMethod "$base/todos/$($hd.id)" -Method Put -ContentType "application/json" -Body (@{ status = "completed" } | ConvertTo-Json) | Out-Null

# ---------------- LEARNING ----------------
$t = New-Todo @{ groupId = $learn; title = "Finish Rust ownership chapter"; priority = "medium"; dueDate = (D 3); description = "<p>Chapters 4-6 of <em>The Rust Programming Language</em>.</p>" }
Add-Sub $t.id $learn "Read chapter 4: Ownership" "completed" | Out-Null
Add-Sub $t.id $learn "Read chapter 5: Structs" "open" | Out-Null
Add-Sub $t.id $learn "Do exercises" "open" | Out-Null

New-Todo @{ groupId = $learn; title = "Build a small MCP server demo"; priority = "high"; dueDate = (D 8) } | Out-Null
New-Todo @{ groupId = $learn; title = "Read one engineering blog post"; priority = "low"; dueDate = (D 0); recurrence = @{ frequency = "daily"; interval = 1 } } | Out-Null
New-Todo @{ groupId = $learn; title = "Practice system design (1 problem)"; priority = "medium"; dueDate = (D 2); recurrence = @{ frequency = "weekly"; interval = 1; weekdays = @(6) } } | Out-Null
$ld = New-Todo @{ groupId = $learn; title = "Watch Tailwind v4 migration talk"; priority = "low"; dueDate = (D -1) }
Invoke-RestMethod "$base/todos/$($ld.id)" -Method Put -ContentType "application/json" -Body (@{ status = "completed" } | ConvertTo-Json) | Out-Null

Write-Host "Seed complete."
$all = Invoke-RestMethod "$base/todos"
Write-Host "Total parent todos: $($all.Count)"
