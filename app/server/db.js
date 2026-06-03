'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { PGlite } = require('@electric-sql/pglite');

const db = new PGlite(process.env.DB_PATH || './data/projectdb');

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

module.exports = { db, initDb };
