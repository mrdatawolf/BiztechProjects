# API.md — ProjectPlan REST API

All endpoints are served under `/api` on the ProjectPlan server (default
`http://localhost:3000`). Request and response bodies are JSON.

## Authentication

Every route except `POST /api/auth/register` and `POST /api/auth/login`
requires a JWT, obtained from either of those two, sent as:

```
Authorization: Bearer <token>
```

Tokens expire after `JWT_EXPIRES_IN` (default `7d`). A missing, invalid, or
expired token returns `401`.

## Conventions

- Errors are always `{ "error": "human-readable message" }`.
- IDs in the URL path (`:id`) must be positive integers; anything else
  returns `400 { "error": "Invalid id" }`.
- `PATCH` routes accept a partial body — only the fields you send are
  updated. Sending no recognized fields returns `400`.
- Timestamps and dates come back as ISO 8601 strings.

## Quick reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create an account |
| POST | `/api/auth/login` | — | Log in |
| GET | `/api/auth/me` | ✓ | Current user |
| GET | `/api/users` | ✓ | List users (for assignee/PM pickers) |
| GET | `/api/projects` | ✓ | List all projects |
| POST | `/api/projects` | ✓ | Create a project (seeds default phases) |
| POST | `/api/projects/import` | ✓ | Create a project from an exported JSON file |
| GET | `/api/projects/:id` | ✓ | Full nested project (phases, tasks, links, …) |
| PATCH | `/api/projects/:id` | ✓ | Update project fields |
| DELETE | `/api/projects/:id` | ✓ | Delete a project (cascades) |
| POST | `/api/phases` | ✓ | Add a phase to a project |
| POST | `/api/phases/reorder` | ✓ | Reorder phases |
| PATCH | `/api/phases/:id` | ✓ | Update a phase |
| DELETE | `/api/phases/:id` | ✓ | Delete a phase (cascades) |
| POST | `/api/tasks` | ✓ | Add a task to a phase |
| POST | `/api/tasks/reorder` | ✓ | Reorder tasks |
| PATCH | `/api/tasks/:id` | ✓ | Update a task |
| DELETE | `/api/tasks/:id` | ✓ | Delete a task |
| POST | `/api/deliverables` | ✓ | Add a deliverable to a phase |
| PATCH | `/api/deliverables/:id` | ✓ | Rename a deliverable |
| DELETE | `/api/deliverables/:id` | ✓ | Delete a deliverable |
| POST | `/api/hardware` | ✓ | Add a hardware item to a phase |
| PATCH | `/api/hardware/:id/delivered` | ✓ | Toggle delivered |
| DELETE | `/api/hardware/:id` | ✓ | Delete a hardware item |
| GET | `/api/time-entries` | ✓ | List time entries for a project or task |
| POST | `/api/time-entries` | ✓ | Log time |
| PATCH | `/api/time-entries/:id` | ✓ | Edit your own time entry |
| DELETE | `/api/time-entries/:id` | ✓ | Delete your own time entry |
| POST | `/api/links` | ✓ | Add a project link |
| PATCH | `/api/links/:id` | ✓ | Edit a project link |
| DELETE | `/api/links/:id` | ✓ | Delete a project link |
| GET | `/api/backup/download` | ✓ | Download a zip of the database directory |
| GET | `/api/backup/info` | ✓ | Database path and size |

---

## Auth

### `POST /api/auth/register`

Body: `email`, `name`, `password` (min 6 chars) — all required.

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","name":"Alice","password":"secret123"}'
```

```json
{ "token": "eyJhbGciOi...", "user": { "id": 1, "email": "alice@example.com", "name": "Alice" } }
```

`409` if the email is already registered.

### `POST /api/auth/login`

Body: `email`, `password`.

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"secret123"}'
```

```json
{ "token": "eyJhbGciOi...", "user": { "id": 1, "email": "alice@example.com", "name": "Alice" } }
```

### `GET /api/auth/me`

```bash
curl http://localhost:3000/api/auth/me -H "Authorization: Bearer $TOKEN"
```

```json
{ "id": 1, "email": "alice@example.com", "name": "Alice" }
```

---

## Users

### `GET /api/users`

Returns every user, for populating assignee/team-lead pickers.

```bash
curl http://localhost:3000/api/users -H "Authorization: Bearer $TOKEN"
```

```json
[{ "id": 1, "name": "Alice", "email": "alice@example.com" }]
```

---

## Projects

### `GET /api/projects`

List all projects with rollup task counts and estimated hours.

```bash
curl http://localhost:3000/api/projects -H "Authorization: Bearer $TOKEN"
```

```json
[{
  "id": 1, "title": "E-Commerce Platform Redesign", "status": "In Progress",
  "priority": "medium", "paused": false, "team_lead_name": "Alice",
  "task_total": "24", "task_done": "10", "est_hours": "180.00"
}]
```

### `POST /api/projects`

Creates a project and seeds it with the default four phases
(Discovery & Planning, Design & Prototyping, Development & Integration,
Testing/Deployment & Handoff), each with its standard tasks and
deliverables.

Body (all optional): `title`, `description`, `client`.

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"New Client Site","client":"Acme Co"}'
```

```json
{ "id": 5, "title": "New Client Site", "client": "Acme Co", "status": "New", "priority": "medium", "..." : "..." }
```

### `POST /api/projects/import`

Creates a project from a previously-exported JSON file (see the
**Export / Import** section of `README.md`). Body: `{ project, phases, links }`.

- `project.status` must be one of `New`, `In Progress`, `Complete` (400 if not).
- `project.priority` must be one of `low`, `medium`, `high`, `critical` (400 if not).
- `project.team_size`, if present, must be a positive integer (400 if not).
- A malformed phase `status` or task `priority` falls back to the schema
  default instead of failing the whole import.

```bash
curl -X POST http://localhost:3000/api/projects/import \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data-binary @project-plan-export.json
```

```json
{ "id": 6, "title": "Imported Project", "status": "New", "..." : "..." }
```

### `GET /api/projects/:id`

Full nested project: phases (each with `tasks`, `deliverables`,
`hardware`) and top-level `links`.

```bash
curl http://localhost:3000/api/projects/5 -H "Authorization: Bearer $TOKEN"
```

```json
{
  "id": 5, "title": "New Client Site", "status": "New",
  "phases": [{ "id": 12, "name": "Discovery & Planning", "tasks": [ /* ... */ ], "deliverables": [ /* ... */ ], "hardware": [] }],
  "links": []
}
```

### `PATCH /api/projects/:id`

Body: any of `title`, `description`, `client`, `team_size`, `team_lead_id`,
`status`, `paused`, `pause_reason`.

```bash
curl -X PATCH http://localhost:3000/api/projects/5 \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"In Progress"}'
```

```json
{ "id": 5, "status": "In Progress", "..." : "..." }
```

### `DELETE /api/projects/:id`

Deletes the project and cascades to its phases, tasks, deliverables,
hardware, time entries, and links.

```bash
curl -X DELETE http://localhost:3000/api/projects/5 -H "Authorization: Bearer $TOKEN"
```

```json
{ "ok": true }
```

---

## Phases

### `POST /api/phases`

Body: `project_id`, `name` required; `subtitle`, `duration`, `color_class`
optional.

```bash
curl -X POST http://localhost:3000/api/phases \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"project_id":5,"name":"Maintenance","duration":"Ongoing"}'
```

```json
{ "id": 20, "project_id": 5, "position": 4, "name": "Maintenance", "status": "Not Started" }
```

### `POST /api/phases/reorder`

Body: `ids` — array of phase IDs in the new order.

```bash
curl -X POST http://localhost:3000/api/phases/reorder \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"ids":[13,12,14,15]}'
```

```json
{ "ok": true }
```

### `PATCH /api/phases/:id`

Body: any of `name`, `subtitle`, `duration`, `status`, `notes`, `color_class`.

```bash
curl -X PATCH http://localhost:3000/api/phases/12 \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"Complete"}'
```

```json
{ "id": 12, "status": "Complete", "..." : "..." }
```

### `DELETE /api/phases/:id`

Cascades to the phase's tasks, deliverables, and hardware.

```bash
curl -X DELETE http://localhost:3000/api/phases/12 -H "Authorization: Bearer $TOKEN"
```

```json
{ "ok": true }
```

---

## Tasks

### `POST /api/tasks`

Body: `phase_id`, `name` required; `assignee`, `due_date` (`YYYY-MM-DD`),
`priority` (`h`/`m`/`l`, default `m`), `expected_hours` (non-negative
number) optional.

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"phase_id":12,"name":"Set up CI pipeline","priority":"h","expected_hours":4}'
```

```json
{ "id": 88, "phase_id": 12, "name": "Set up CI pipeline", "priority": "h", "done": false, "hours_logged": "0" }
```

### `POST /api/tasks/reorder`

Body: `ids` — array of task IDs in the new order (within a phase's task list).

```bash
curl -X POST http://localhost:3000/api/tasks/reorder \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"ids":[88,85,86,87]}'
```

```json
{ "ok": true }
```

### `PATCH /api/tasks/:id`

Body: any of `name`, `assignee`, `due_date`, `priority`, `done`,
`expected_hours`. `expected_hours` must be a non-negative number or an
empty string to clear it.

```bash
curl -X PATCH http://localhost:3000/api/tasks/88 \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"done":true}'
```

```json
{ "id": 88, "done": true, "..." : "..." }
```

### `DELETE /api/tasks/:id`

```bash
curl -X DELETE http://localhost:3000/api/tasks/88 -H "Authorization: Bearer $TOKEN"
```

```json
{ "ok": true }
```

---

## Deliverables

### `POST /api/deliverables`

Body: `phase_id`, `label` required.

```bash
curl -X POST http://localhost:3000/api/deliverables \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"phase_id":12,"label":"Architecture Diagram"}'
```

```json
{ "id": 30, "phase_id": 12, "position": 4, "label": "Architecture Diagram" }
```

### `PATCH /api/deliverables/:id`

Body: `label` required.

```bash
curl -X PATCH http://localhost:3000/api/deliverables/30 \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"label":"System Architecture Diagram"}'
```

```json
{ "id": 30, "label": "System Architecture Diagram" }
```

### `DELETE /api/deliverables/:id`

```bash
curl -X DELETE http://localhost:3000/api/deliverables/30 -H "Authorization: Bearer $TOKEN"
```

```json
{ "ok": true }
```

---

## Hardware

### `POST /api/hardware`

Body: `phase_id`, `label` required.

```bash
curl -X POST http://localhost:3000/api/hardware \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"phase_id":12,"label":"Switch - Cisco 3750"}'
```

```json
{ "id": 4, "phase_id": 12, "position": 0, "label": "Switch - Cisco 3750", "delivered": false }
```

### `PATCH /api/hardware/:id/delivered`

Toggles the `delivered` flag — no body needed.

```bash
curl -X PATCH http://localhost:3000/api/hardware/4/delivered -H "Authorization: Bearer $TOKEN"
```

```json
{ "id": 4, "delivered": true, "..." : "..." }
```

### `DELETE /api/hardware/:id`

```bash
curl -X DELETE http://localhost:3000/api/hardware/4 -H "Authorization: Bearer $TOKEN"
```

```json
{ "ok": true }
```

---

## Time Entries

### `GET /api/time-entries?project_id=N` or `?task_id=N`

Exactly one of the two query parameters is required.

```bash
curl "http://localhost:3000/api/time-entries?project_id=5" -H "Authorization: Bearer $TOKEN"
```

```json
[{ "id": 1, "task_id": 88, "user_name": "Alice", "task_name": "Set up CI pipeline", "hours": "2.00", "date": "2026-07-01T00:00:00.000Z" }]
```

### `POST /api/time-entries`

Body: `task_id`, `hours` (positive number) required; `date`
(`YYYY-MM-DD`, defaults to today), `note` optional. Logged against the
authenticated user.

```bash
curl -X POST http://localhost:3000/api/time-entries \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"task_id":88,"hours":2.5,"note":"Wrote pipeline config"}'
```

```json
{ "id": 9, "task_id": 88, "hours": "2.50", "date": "2026-07-02T00:00:00.000Z", "user_name": "Alice" }
```

### `PATCH /api/time-entries/:id`

Only the entry's owner may edit it (`403` otherwise). Body: any of
`hours` (positive number), `date`, `note`.

```bash
curl -X PATCH http://localhost:3000/api/time-entries/9 \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"hours":3}'
```

```json
{ "id": 9, "hours": "3.00", "..." : "..." }
```

### `DELETE /api/time-entries/:id`

Only the entry's owner may delete it (`403` otherwise).

```bash
curl -X DELETE http://localhost:3000/api/time-entries/9 -H "Authorization: Bearer $TOKEN"
```

```json
{ "ok": true }
```

---

## Links

### `POST /api/links`

Body: `project_id`, `label`, `url` required.

```bash
curl -X POST http://localhost:3000/api/links \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"project_id":5,"label":"GitHub Repo","url":"https://github.com/acme/site"}'
```

```json
{ "id": 2, "project_id": 5, "position": 0, "label": "GitHub Repo", "url": "https://github.com/acme/site" }
```

### `PATCH /api/links/:id`

Body: any of `label`, `url`.

```bash
curl -X PATCH http://localhost:3000/api/links/2 \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"url":"https://github.com/acme/site-v2"}'
```

```json
{ "id": 2, "url": "https://github.com/acme/site-v2" }
```

### `DELETE /api/links/:id`

```bash
curl -X DELETE http://localhost:3000/api/links/2 -H "Authorization: Bearer $TOKEN"
```

```json
{ "ok": true }
```

---

## Backup

### `GET /api/backup/download`

Streams a zip of the PGlite database directory. Any authenticated user
can call this — the entire database, including all users' password
hashes, is in the archive, so treat it accordingly.

```bash
curl http://localhost:3000/api/backup/download \
  -H "Authorization: Bearer $TOKEN" -o backup.zip
```

### `GET /api/backup/info`

```bash
curl http://localhost:3000/api/backup/info -H "Authorization: Bearer $TOKEN"
```

```json
{ "exists": true, "path": "/opt/ProjectPlan/Data/projectdb", "size": "184.3 KB" }
```
