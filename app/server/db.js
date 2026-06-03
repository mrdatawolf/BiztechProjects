'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { PGlite } = require('@electric-sql/pglite');

// Resolve relative to the project root (two levels up from server/) so the
// path is absolute and unambiguous regardless of working directory or OS.
const ROOT_DIR = path.resolve(__dirname, '../../');
const DB_PATH = path.resolve(ROOT_DIR, process.env.DB_PATH || 'Data/projectdb');
const db = new PGlite(DB_PATH);

async function initDb() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      email      TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      password   TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT 'New Application Project',
      description TEXT NOT NULL DEFAULT '',
      client      TEXT NOT NULL DEFAULT '',
      team_size   INTEGER NOT NULL DEFAULT 1,
      team_lead   TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'New'
                    CHECK (status IN ('New','In Progress','Complete')),
      created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ DEFAULT now(),
      updated_at  TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS phases (
      id          SERIAL PRIMARY KEY,
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      position    INTEGER NOT NULL DEFAULT 0,
      name        TEXT NOT NULL,
      subtitle    TEXT NOT NULL DEFAULT '',
      duration    TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'Not Started'
                    CHECK (status IN ('Not Started','In Progress','Complete')),
      notes       TEXT NOT NULL DEFAULT '',
      color_class TEXT NOT NULL DEFAULT 'p1'
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id        SERIAL PRIMARY KEY,
      phase_id  INTEGER NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
      position  INTEGER NOT NULL DEFAULT 0,
      name      TEXT NOT NULL,
      assignee  TEXT NOT NULL DEFAULT '',
      due_date  DATE,
      priority  TEXT NOT NULL DEFAULT 'm' CHECK (priority IN ('h','m','l')),
      done      BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS deliverables (
      id        SERIAL PRIMARY KEY,
      phase_id  INTEGER NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
      position  INTEGER NOT NULL DEFAULT 0,
      label     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id         SERIAL PRIMARY KEY,
      task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hours      DECIMAL(6,2) NOT NULL,
      date       DATE NOT NULL DEFAULT CURRENT_DATE,
      note       TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

async function migrateDb() {
  // Add expected_hours to tasks if not already present
  await db.exec(`
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS expected_hours DECIMAL(6,2);
  `);
  // Project-level fields: priority, due date, paused state
  await db.exec(`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
      CHECK (priority IN ('low','medium','high','critical'));
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS due_date DATE;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS paused BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS pause_reason TEXT NOT NULL DEFAULT '';
  `);
  // Per-project links (Figma, GitHub, staging URLs, docs, etc.)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS project_links (
      id         SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      position   INTEGER NOT NULL DEFAULT 0,
      label      TEXT NOT NULL,
      url        TEXT NOT NULL
    );
  `);
}

// Touch project updated_at whenever a child resource changes
async function touchProject(projectId) {
  if (!projectId) return;
  try {
    await db.query('UPDATE projects SET updated_at = now() WHERE id = $1', [parseInt(projectId)]);
  } catch (e) { /* non-fatal */ }
}

module.exports = { db, initDb, migrateDb, touchProject };
