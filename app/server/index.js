'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ENV_PATH = path.join(__dirname, '../../.env');
require('dotenv').config({ path: ENV_PATH });
const express = require('express');
const { initDb, migrateDb } = require('./db');

const PLACEHOLDER_SECRET = 'replace_with_a_long_random_string';

// Fresh installs get JWT_SECRET from .env.example's placeholder — generate and
// persist a real one so a default install isn't forgeable by anyone who has
// read the public repo.
function ensureJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET !== PLACEHOLDER_SECRET) return;

  const secret = crypto.randomBytes(48).toString('hex');
  const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const line = `JWT_SECRET=${secret}`;
  let updated;
  if (/^JWT_SECRET=.*$/m.test(existing)) {
    updated = existing.replace(/^JWT_SECRET=.*$/m, line);
  } else {
    updated = existing.replace(/\n?$/, '') + `\n${line}\n`;
  }
  fs.writeFileSync(ENV_PATH, updated);
  process.env.JWT_SECRET = secret;
  console.log(`[ProjectPlan] Generated a new JWT_SECRET and saved it to ${ENV_PATH}`);
}

ensureJwtSecret();

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/projects',     require('./routes/projects'));
app.use('/api/phases',       require('./routes/phases'));
app.use('/api/tasks',        require('./routes/tasks'));
app.use('/api/deliverables', require('./routes/deliverables'));
app.use('/api/hardware',     require('./routes/hardware'));
app.use('/api/time-entries', require('./routes/timeEntries'));
app.use('/api/links',        require('./routes/links'));
app.use('/api/templates',    require('./routes/templates'));
app.use('/api/backup',       require('./routes/backup'));
app.use('/api/docs',         require('./routes/docs'));

// Bare /api in a browser lands on the docs.
app.get('/api', (req, res) => res.redirect('/api/docs'));

// Unmatched API routes get a JSON 404 instead of falling through to the
// login-page catch-all below.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Serve login page for any unmatched GET (direct URL navigation)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

initDb()
  .then(() => migrateDb())
  .then(() => {
    app.listen(PORT, HOST, () => {
      const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
      console.log(`Server running at http://${displayHost}:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });
