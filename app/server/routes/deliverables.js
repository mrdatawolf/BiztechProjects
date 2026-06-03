'use strict';
const express = require('express');
const { db, touchProject } = require('../db');

async function projectIdForDeliverable(delId) {
  const r = await db.query(
    'SELECT ph.project_id FROM deliverables d JOIN phases ph ON ph.id = d.phase_id WHERE d.id = $1',
    [delId]
  );
  return r.rows[0]?.project_id;
}
const { requireAuth } = require('../middleware/auth');

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
    const projR = await db.query('SELECT project_id FROM phases WHERE id = $1', [phase_id]);
    await touchProject(projR.rows[0]?.project_id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create deliverable' });
  }
});

// PATCH /api/deliverables/:id
router.patch('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: 'label is required' });
  try {
    const result = await db.query(
      'UPDATE deliverables SET label = $1 WHERE id = $2 RETURNING *',
      [label, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Deliverable not found' });
    await touchProject(await projectIdForDeliverable(id));
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update deliverable' });
  }
});

// DELETE /api/deliverables/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const projId = await projectIdForDeliverable(id);
    await db.query('DELETE FROM deliverables WHERE id = $1', [id]);
    await touchProject(projId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete deliverable' });
  }
});

module.exports = router;
