'use strict';
const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const archiver = require('archiver');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const ROOT_DIR = path.resolve(__dirname, '../../..');
const dbPath   = () => path.resolve(ROOT_DIR, process.env.DB_PATH || 'Data/projectdb');

// GET /api/backup/download — streams a zip of the DB directory
router.get('/download', requireAuth, (req, res) => {
  const src = dbPath();

  if (!fs.existsSync(src)) {
    return res.status(404).json({ error: 'Database directory not found at: ' + src });
  }

  const date     = new Date().toISOString().slice(0, 10);
  const filename = `projectplan-backup-${date}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    console.error('Backup failed:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Backup failed: ' + err.message });
  });

  archive.pipe(res);
  archive.directory(src, 'projectdb');
  archive.finalize();
});

// GET /api/backup/info — returns DB path and size for the UI
router.get('/info', requireAuth, (req, res) => {
  const src = dbPath();
  if (!fs.existsSync(src)) return res.json({ exists: false, path: src });

  let totalBytes = 0;
  try {
    for (const f of fs.readdirSync(src)) {
      const stat = fs.statSync(path.join(src, f));
      if (stat.isFile()) totalBytes += stat.size;
    }
  } catch (e) { /* ignore */ }

  res.json({
    exists: true,
    path:   src,
    size:   (totalBytes / 1024).toFixed(1) + ' KB'
  });
});

module.exports = router;
