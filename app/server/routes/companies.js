'use strict';
const XLSX = require('xlsx');
const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const CACHE_MS = 60 * 1000;
let cache = null;
let cacheTime = 0;

function readCompanies() {
  const raw = process.env.COMPANIES_LIST;
  if (!raw) throw new Error('COMPANIES_LIST is not configured');

  const filePath = decodeURIComponent(raw);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const names = new Set();
  rows.slice(1).forEach((row) => {
    const name = row && row[0] != null ? String(row[0]).trim() : '';
    if (name) names.add(name);
  });

  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

router.get('/', requireAuth, async (req, res) => {
  try {
    if (!cache || Date.now() - cacheTime > CACHE_MS) {
      cache = readCompanies();
      cacheTime = Date.now();
    }
    res.json({ companies: cache });
  } catch (err) {
    console.error('Failed to load companies list:', err.message);
    res.status(503).json({ error: 'Companies list is unavailable: ' + err.message });
  }
});

module.exports = router;
