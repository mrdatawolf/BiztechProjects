# ProjectPlan

A self-hosted, multi-user project management tool for software development teams. Track projects through structured phases, manage tasks and deliverables, log time, and monitor progress — all from a clean web interface, with your data and authentication running entirely on your own machine.

---

## Features

- **Phase-based project structure** — Projects are organized into phases (Discovery, Design, Development, Deployment by default), each with tasks, deliverables, and notes
- **Task management** — Assignee, due date, priority, estimated hours, and completion tracking per task; drag-and-drop reordering within a phase
- **Task board** — Switch any project to a five-lane Board view and move tasks through Backlog, Ready, In Progress, Review, and Done
- **Automatic task timing** — Tasks time themselves while In Progress; actual time remains manually adjustable outside that lane, and active work returns to Ready at 5 PM server time
- **Progress tracking** — Per-phase and project-wide completion percentages update in real time as tasks are checked off
- **Estimated hours** — Set estimated hours per task; phase and project totals roll up automatically
- **Project status** — Click the status badge to cycle New → In Progress → Complete; mark a project Paused with an optional reason
- **Time logging** — Log hours against individual tasks with date and notes
- **Project links** — Store Figma, GitHub, staging, and doc URLs per project
- **Dashboard** — Card-based project list with progress bars, completion stats, and estimated hours at a glance
- **Export / Import** — Export any project as a JSON file; import it into any ProjectPlan instance
- **Multi-user** — JWT-based authentication with per-user project creation
- **Light / dark theme** — Persisted per browser
- **Print** — Clean print layout for sharing project plans
- **Local-first** — Data and auth run entirely on your machine in an embedded PostgreSQL database (PGlite); the UI fonts (Inter, Instrument Serif) are fetched from Google Fonts and fall back to system fonts if you're offline

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Web server | Express 4 |
| Database | [PGlite](https://github.com/electric-sql/pglite) (embedded PostgreSQL, file-based) |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Frontend | Vanilla HTML / CSS / JavaScript |
| Drag and drop | [SortableJS](https://sortablejs.github.io/Sortable/) |

---

## Requirements

- **Node.js v18 or later** — [nodejs.org](https://nodejs.org)
- npm (ships with Node.js)

No database server, Docker, or cloud account needed.

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/mrdatawolf/BiztechProjects.git
cd BiztechProjects
```

### 2. Configure environment

Copy the example env file and edit it:

```bash
cp .env.example .env
```

`JWT_SECRET` is generated automatically on first run and saved back to `.env` if it's left blank or unset, so no manual step is required. If you'd rather set your own, generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

and paste the output as the value for `JWT_SECRET` in `.env`.

### 3. Start the server

**Linux / macOS:**
```bash
./start.sh
```

**Windows:**
```bat
start.bat
```

The script will:
1. Check Node.js version
2. Copy `.env.example` → `.env` if no `.env` exists
3. Run `npm install` if `node_modules` is missing
4. Create the data directory
5. Run any pending database migrations
6. Start the server

Open your browser at **http://localhost:3000** (or the `PORT` set in `.env`).

---

## Configuration

All configuration lives in `.env` at the project root.

| Variable | Default | Description |
|---|---|---|
| `HOST` | `0.0.0.0` | Bind address. Use `127.0.0.1` to restrict to localhost. |
| `PORT` | `3000` | Port the server listens on. |
| `DB_PATH` | `Data/projectdb` | Path to the PGlite database directory, relative to the project root. Use `memory://` for a throw-away in-memory database. |
| `JWT_SECRET` | *(auto-generated)* | Secret used to sign login tokens. Must be kept private. Generated on first run and saved to `.env` if left blank. |
| `JWT_EXPIRES_IN` | `7d` | Session duration (e.g. `7d`, `24h`, `60m`). |
| `INTEGRATION_TOKEN` | *(disabled)* | Long-lived, read-only bearer token for trusted service integrations. |
| `PUBLIC_BASE_URL` | *(request host)* | Browser-facing server root used to build project links in integration responses. |

---

## Project Structure

```
BiztechProjects/
├── app/
│   ├── public/             # Frontend (HTML, CSS, JS)
│   │   ├── dashboard.html
│   │   ├── project.html
│   │   ├── timelog.html
│   │   ├── login.html
│   │   ├── css/
│   │   └── js/
│   └── server/             # Backend (Express)
│       ├── index.js        # Entry point — DB init + route registration
│       ├── db.js           # PGlite connection, initDb, migrateDb
│       ├── seed.js         # Demo data seeder
│       ├── middleware/
│       │   ├── auth.js       # JWT middleware
│       │   └── validateId.js # :id param validation
│       └── routes/
│           ├── auth.js
│           ├── users.js
│           ├── projects.js
│           ├── phases.js
│           ├── tasks.js
│           ├── deliverables.js
│           ├── hardware.js
│           ├── timeEntries.js
│           ├── links.js
│           └── backup.js
├── Data/                   # PGlite database files (git-ignored)
├── .env                    # Local config (git-ignored)
├── .env.example            # Config template
├── start.sh                # Linux/macOS startup script
└── start.bat               # Windows startup script
```

---

## Database Migrations

The app uses an additive migration strategy. On every startup, `initDb()` creates tables with `CREATE TABLE IF NOT EXISTS`, and `migrateDb()` runs `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements to bring older databases up to date. No manual migration steps are needed when updating to a new version — just restart the server.

---

## Updating

To update to a new version:

1. Copy the new `app/` folder into the project directory (your `Data/` folder and `.env` live outside `app/` and are unaffected)
2. Restart via `start.sh` or `start.bat` — dependencies and migrations run automatically

---

## Exporting and Importing Projects

**Export:** Open a project → click **Export JSON** in the toolbar. Saves a full JSON snapshot of the project including all phases, tasks, deliverables, hardware, notes, and project links.

**Import:** From the dashboard, click **Import JSON** and select a previously exported file. The project is created immediately and you are taken to it.

---

## Development

```bash
cd app
npm install
npm run dev   # starts server with nodemon (auto-restarts on file changes)
```

The server reads `.env` from the project root (one level up from `app/`).

---

## License

MIT
