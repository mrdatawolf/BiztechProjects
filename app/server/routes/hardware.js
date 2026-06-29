'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/hardware
router.post('/', requireAuth, async (req, res) => {
  const { phase_id, label } = req.body;
  if (!phase_id || !label) return res.status(400).json({ error: 'phase_id and label are required' });
  try {
    const posResult = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM hardware WHERE phase_id = $1',
      [phase_id]
    );
    const pos = posResult.rows[0].pos;
    const result = await db.query(
      'INSERT INTO hardware (phase_id, position, label) VALUES ($1, $2, $3) RETURNING *',
      [phase_id, pos, label]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create hardware item' });
  }
});

// PATCH /api/hardware/:id/delivered — toggle delivered
router.patch('/:id/delivered', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const result = await db.query(
      'UPDATE hardware SET delivered = NOT delivered WHERE id = $1 RETURNING *',
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Hardware item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update hardware item' });
  }
});

// DELETE /api/hardware/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await db.query('DELETE FROM hardware WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete hardware item' });
  }
});

module.exports = router;
