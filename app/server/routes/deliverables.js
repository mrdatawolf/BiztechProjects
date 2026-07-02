'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');

const router = express.Router();

// POST /api/deliverables
router.post('/', requireAuth, async (req, res) => {
  const { phase_id, label } = req.body;
  if (!phase_id || !label) return res.status(400).json({ error: 'phase_id and label are required' });
  try {
    const posResult = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM deliverables WHERE phase_id = $1',
      [phase_id]
    );
    const pos = posResult.rows[0].pos;
    const result = await db.query(
      'INSERT INTO deliverables (phase_id, position, label) VALUES ($1, $2, $3) RETURNING *',
      [phase_id, pos, label]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create deliverable' });
  }
});

// PATCH /api/deliverables/:id
router.patch('/:id', requireAuth, validateId, async (req, res) => {
  const id = req.idParam;
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: 'label is required' });
  try {
    const result = await db.query(
      'UPDATE deliverables SET label = $1 WHERE id = $2 RETURNING *',
      [label, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Deliverable not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update deliverable' });
  }
});

// DELETE /api/deliverables/:id
router.delete('/:id', requireAuth, validateId, async (req, res) => {
  const id = req.idParam;
  try {
    await db.query('DELETE FROM deliverables WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete deliverable' });
  }
});

module.exports = router;
