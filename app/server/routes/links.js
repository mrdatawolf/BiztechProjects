'use strict';
const express = require('express');
const { db, touchProject } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/links
router.post('/', requireAuth, async (req, res) => {
  const { project_id, label, url } = req.body;
  if (!project_id || !label || !url) {
    return res.status(400).json({ error: 'project_id, label, and url are required' });
  }
  try {
    const posResult = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM project_links WHERE project_id = $1',
      [project_id]
    );
    const pos = posResult.rows[0].pos;
    const result = await db.query(
      'INSERT INTO project_links (project_id, position, label, url) VALUES ($1, $2, $3, $4) RETURNING *',
      [project_id, pos, label.trim(), url.trim()]
    );
    await touchProject(project_id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create link' });
  }
});

// PATCH /api/links/:id
router.patch('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const allowed = ['label', 'url'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });
  const sets = fields.map((f, i) => `${f} = $${i + 1}`);
  const values = [...fields.map(f => req.body[f]), id];
  try {
    const result = await db.query(
      `UPDATE project_links SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Link not found' });
    const proj = await db.query('SELECT project_id FROM project_links WHERE id = $1', [id]);
    await touchProject(proj.rows[0]?.project_id);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update link' });
  }
});

// DELETE /api/links/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const proj = await db.query('SELECT project_id FROM project_links WHERE id = $1', [id]);
    await db.query('DELETE FROM project_links WHERE id = $1', [id]);
    await touchProject(proj.rows[0]?.project_id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

module.exports = router;
