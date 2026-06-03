'use strict';
const express = require('express');
const { db, touchProject } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/phases
router.post('/', requireAuth, async (req, res) => {
  const { project_id, name, subtitle = '', duration = '', color_class = 'p1' } = req.body;
  if (!project_id || !name) return res.status(400).json({ error: 'project_id and name are required' });
  try {
    const posResult = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM phases WHERE project_id = $1',
      [project_id]
    );
    const pos = posResult.rows[0].pos;
    const result = await db.query(
      `INSERT INTO phases (project_id, position, name, subtitle, duration, color_class)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [project_id, pos, name, subtitle, duration, color_class]
    );
    await touchProject(project_id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create phase' });
  }
});

// PATCH /api/phases/:id
router.patch('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const allowed = ['name', 'subtitle', 'duration', 'status', 'notes', 'color_class'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });

  const sets = fields.map((f, i) => `${f} = $${i + 1}`);
  const values = fields.map(f => req.body[f]);
  values.push(id);

  try {
    const result = await db.query(
      `UPDATE phases SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Phase not found' });
    await touchProject(result.rows[0].project_id);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update phase' });
  }
});

// DELETE /api/phases/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const ph = await db.query('SELECT project_id FROM phases WHERE id = $1', [id]);
    await db.query('DELETE FROM phases WHERE id = $1', [id]);
    if (ph.rows.length) await touchProject(ph.rows[0].project_id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete phase' });
  }
});

module.exports = router;
