'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const { initDb, migrateDb } = require('./db');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/projects',     require('./routes/projects'));
app.use('/api/phases',       require('./routes/phases'));
app.use('/api/tasks',        require('./routes/tasks'));
app.use('/api/deliverables', require('./routes/deliverables'));
app.use('/api/time-entries', require('./routes/timeEntries'));
app.use('/api/links',        require('./routes/links'));
app.use('/api/backup',       require('./routes/backup'));

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
