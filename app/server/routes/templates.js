'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');

const router = express.Router();

const TASK_PRIORITIES = ['h', 'm', 'l'];

// Reduces whatever phase/task/deliverable shape the client sends down to
// exactly the fields a template needs to reseed a new project — mirrors the
// built-in DEFAULT_PHASES/SIMPLE_PHASE shape in routes/projects.js.
function normalizeDefinition(definition) {
  return definition.map((ph, pi) => ({
    position: pi,
    name: ph.name || '',
    subtitle: ph.subtitle || '',
    duration: ph.duration || '',
    color_class: ph.color_class || 'p1',
    tasks: (ph.tasks || []).map((t, ti) => ({
      position: ti,
      name: t.name || '',
      priority: TASK_PRIORITIES.includes(t.priority) ? t.priority : 'm'
    })),
    deliverables: (ph.deliverables || []).map(d => (typeof d === 'string' ? d : (d && d.label) || ''))
  }));
}

// GET /api/templates — list saved templates with summary counts
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.id, t.name, t.definition, t.created_at, u.name AS created_by_name
      FROM templates t
      LEFT JOIN users u ON u.id = t.created_by
      ORDER BY t.created_at DESC
    `);
    const templates = result.rows.map(row => {
      let phases = [];
      try { phases = JSON.parse(row.definition) || []; } catch (e) { phases = []; }
      const taskCount = phases.reduce((sum, p) => sum + (p.tasks ? p.tasks.length : 0), 0);
      return {
        id: row.id,
        name: row.name,
        created_at: row.created_at,
        created_by_name: row.created_by_name,
        phase_count: phases.length,
        task_count: taskCount
      };
    });
    res.json(templates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

// POST /api/templates — save a phase/task/deliverable structure as a reusable template
router.post('/', requireAuth, async (req, res) => {
  const { name, definition } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Template name is required' });
  }
  if (!Array.isArray(definition) || !definition.length) {
    return res.status(400).json({ error: 'Template must include at least one phase' });
  }

  try {
    const normalized = normalizeDefinition(definition);
    const result = await db.query(
      `INSERT INTO templates (name, definition, created_by) VALUES ($1, $2, $3) RETURNING id, name, created_at`,
      [name.trim(), JSON.stringify(normalized), req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save template' });
  }
});

// PATCH /api/templates/:id — rename
router.patch('/:id', requireAuth, validateId, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Template name is required' });
  }
  try {
    const result = await db.query(
      'UPDATE templates SET name = $1 WHERE id = $2 RETURNING id, name, created_at',
      [name.trim(), req.idParam]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to rename template' });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', requireAuth, validateId, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM templates WHERE id = $1 RETURNING id', [req.idParam]);
    if (!result.rows.length) return res.status(404).json({ error: 'Template not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

module.exports = router;
