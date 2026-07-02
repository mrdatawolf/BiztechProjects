# SECURE.md — Remediation Plan

Action plan from the 2026-07-02 code review. Each item below was approved by the
project owner; the "Explicitly declined" section at the bottom lists findings that
were reviewed and rejected — **do not implement those**.

Deployment context: this app runs on a trusted local LAN only. All users on the
network are trusted; the fixes below are about correctness and hygiene, not about
defending against hostile users.

General rules for the implementing agent:

- Keep the existing code style: CommonJS, `'use strict'`, plain Express handlers,
  vanilla JS on the frontend. No new frameworks, no TypeScript, no build step.
- Prefer small, surgical diffs. Each numbered task should be an independent commit.
- After each task, start the server (`./start.sh` or `cd app && npm run dev`) and
  exercise the affected flow by hand or with `curl` before moving on.

---

## 1. Auto-generate and persist `JWT_SECRET`

**Problem:** `start.sh`/`start.bat` copy `.env.example` → `.env`, so a fresh install
runs with the publicly-known placeholder secret `replace_with_a_long_random_string`.
Anyone on the network could forge a valid JWT for any user id.

**Decision:** Auto-generate a strong secret and persist it into `.env`. Do not just
crash with an error.

**Implementation:**

- In [app/server/index.js](app/server/index.js), before `initDb()` runs: if
  `process.env.JWT_SECRET` is missing, empty, or equal to
  `replace_with_a_long_random_string`, generate one with
  `require('crypto').randomBytes(48).toString('hex')`.
- Persist it back to the root `.env` file (`path.join(__dirname, '../../.env')`):
  replace the existing `JWT_SECRET=...` line if present, otherwise append one.
  Create `.env` if it does not exist.
- Set `process.env.JWT_SECRET` to the generated value in the same process so the
  current run uses it, and log a one-line notice
  (`Generated a new JWT_SECRET and saved it to .env`).
- Doing this in Node (not in the shell scripts) covers Linux, macOS, and Windows
  with one code path.

**Verify:** delete/blank `JWT_SECRET` in `.env`, start the server, confirm the file
now contains a 96-hex-char secret and login/register still work. Restart and confirm
the same secret is reused (existing tokens stay valid across restarts).

---

## 2. Make export → import round-trip lossless

**Problem:** the JSON export/import silently drops data. Import
([app/server/routes/projects.js:71-139](app/server/routes/projects.js#L71-L139))
only recreates tasks and deliverables; export
([app/public/project.html:795](app/public/project.html#L795)) omits project links
and several project fields.

**Implementation:**

- **Export** (project.html `expBtn` handler): include in `dat.project` the fields
  `priority`, `due_date`, `paused`, `pause_reason`; add a top-level `links` array
  (label + url for each project link, in position order). `state.phases` already
  carries each phase's `hardware` array — leave that as is.
- **Import** (`POST /api/projects/import`):
  - Insert `priority`, `due_date`, `paused`, `pause_reason` on the project row,
    with the same defaults the schema uses when absent.
  - For each phase, recreate `hardware` rows (`label`, `delivered`, position from
    array index), mirroring the existing deliverables loop.
  - Recreate `project_links` rows from the top-level `links` array.
- Time entries and `hours_logged` are intentionally **not** imported (they belong
  to other users' logs); ignore them as today.
- Old export files without the new fields must still import cleanly — every new
  field needs a fallback (`|| default`), same pattern as the existing code.

**Verify:** create a project with hardware items, links, a priority, a due date,
and a paused state; export it; import the file; confirm every field survived.
Also import a pre-change export file (or hand-write a minimal
`{ project, phases }` JSON) and confirm it still works.

Note: task 10 (import validation) also touches this handler — coordinate the edits.

---

## 3. Validate PATCH bodies like their POSTs

**Problem:** `POST /api/time-entries` rejects non-positive/non-numeric `hours`, but
`PATCH /api/time-entries/:id`
([app/server/routes/timeEntries.js:68](app/server/routes/timeEntries.js#L68))
accepts anything. Same gap for `expected_hours` on
`PATCH /api/tasks/:id` ([app/server/routes/tasks.js:46](app/server/routes/tasks.js#L46)).

**Implementation:**

- In the time-entries PATCH: if `hours` is among the submitted fields, apply the
  exact same check as POST (`isNaN(parseFloat(hours)) || parseFloat(hours) <= 0`
  → 400 `hours must be a positive number`) and store the parsed float.
- In the tasks PATCH (and task POST, which currently doesn't check either): if
  `expected_hours` is present and not null/empty, require it to parse as a
  non-negative number, else 400. Empty string should mean "clear the field"
  (store NULL), matching how the frontend save sends it.

**Verify:** `curl -X PATCH` each route with `hours: -5`, `hours: "abc"`,
`expected_hours: "abc"` → expect 400s; valid values still save.

---

## 4. Wrap multi-statement writes in transactions

**Problem:** project create, import, and the reorder endpoints run many sequential
queries with no transaction; a mid-way failure leaves half-written data.

**Implementation:** PGlite supports `db.transaction(async (tx) => { ... })` where
`tx.query(...)` has the same signature as `db.query(...)`. Convert:

- `POST /api/projects` (create + seed default phases/tasks/deliverables) —
  [app/server/routes/projects.js:170-207](app/server/routes/projects.js#L170-L207)
- `POST /api/projects/import` — same file, lines 71-139
- `POST /api/tasks/reorder` — [app/server/routes/tasks.js:9-21](app/server/routes/tasks.js#L9-L21)
- `POST /api/phases/reorder` — [app/server/routes/phases.js:9-21](app/server/routes/phases.js#L9-L21)

Keep the response shapes identical. On error, the existing catch → 500 handling
stays; the transaction just guarantees rollback.

**Verify:** normal create/import/reorder still work end-to-end. For the rollback
path, temporarily break one mid-loop statement, confirm no orphan project/phase
rows exist afterwards, then remove the breakage.

---

## 5. Remove CORS

**Decision:** the frontend is served same-origin, so `cors()` is unnecessary.

**Implementation:** in [app/server/index.js](app/server/index.js) delete the
`app.use(cors())` line and the `require('cors')`; remove `cors` from
[app/package.json](app/package.json) dependencies and run `npm install` so the
lockfile updates.

**Verify:** log in and use the dashboard/project pages — everything is same-origin
so nothing should change.

---

## 6. Smaller fixes (all approved)

### 6a. `showAlert` → `textContent`

[app/public/dashboard.html:83](app/public/dashboard.html#L83) and
[app/public/project.html:152](app/public/project.html#L152) (check timelog.html and
login.html for the same pattern) build the alert with string-concatenated
`innerHTML`, injecting `msg` unescaped. Build the `<div class="alert alert-...">`
with `document.createElement` + `className`, set the message via `textContent`,
and keep the existing 3-second auto-clear for `ok` alerts.

### 6b. Fix the README to match the code

In [README.md](README.md):

- Task management feature bullet: drag-and-drop reordering works **within** a
  phase only — remove "and between phases".
- "Zero cloud dependency" bullet and intro: the pages load Inter and Instrument
  Serif from Google Fonts, so soften the claim (data and auth are fully local;
  fonts are fetched from Google and fall back to system fonts offline).
- Project structure tree: add `users.js` and `hardware.js` under `routes/`, and
  `seed.js` under `server/`.

### 6c. JSON 404 for unmatched `/api/*`

In [app/server/index.js](app/server/index.js), before the `app.get('*')`
login-page catch-all, add `app.use('/api', ...)` returning
`res.status(404).json({ error: 'Not found' })` so typo'd API calls fail loudly
instead of receiving login.html with a 200.

### 6d. Duplicate-email detection via Postgres error code

In [app/server/routes/auth.js:35](app/server/routes/auth.js#L35), replace
`err.message.includes('unique')` with a check on the Postgres error code
`23505` (unique_violation). PGlite may surface it as `err.code` or on a nested
property — inspect the actual error object once before wiring the check, and keep
the message check as a fallback if the code isn't exposed. Return **409**, not 400.

### 6e. Shared id-param validator

Every `/:id` route does `parseInt(req.params.id)`; a non-numeric id becomes `NaN`
and surfaces as a 500. Add a small middleware in `app/server/middleware/`
(e.g. `validateId.js`) that parses `req.params.id`, returns
`400 { error: 'Invalid id' }` unless it's a positive integer, and stores the parsed
value (e.g. `req.idParam`) for handlers to use. Apply it to all `/:id` routes in
projects, phases, tasks, deliverables, hardware, timeEntries, and links, and remove
the per-handler `parseInt` calls.

### 6f. Validate import payloads

In `POST /api/projects/import`, validate before inserting so bad files get a
helpful 400 instead of a CHECK-constraint 500:

- `project.status` ∈ `New | In Progress | Complete`
- `project.priority` ∈ `low | medium | high | critical` (added by task 2)
- each phase `status` ∈ `Not Started | In Progress | Complete`
- each task `priority` ∈ `h | m | l`
- `team_size` a positive integer if present

Invalid enum values may either 400 with a message naming the bad field, or be
coerced to the schema default — pick 400 for project-level fields and coercion
for per-task priority (one bad task shouldn't kill a whole import).

---

## Explicitly declined — do not implement

- **Registration gating / admin roles / restricting the backup endpoint** — open
  registration and shared full access are the intended trust model for this LAN
  deployment. Leave `/api/backup/download` available to all authenticated users.
- **Login rate limiting / stronger password policy** — declined as overkill;
  anyone on the LAN is already trusted.

---

## Suggested order

1 (secret) → 3 (PATCH validation) → 5 (CORS) → 6a/6c/6d/6e (small server/frontend
fixes) → 2 + 6f together (import/export) → 4 (transactions, since it rewrites the
handlers 2 and 6f just touched — or do 4 first if you prefer; just don't edit the
import handler in three separate passes) → 6b (README last, documenting reality).
