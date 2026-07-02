'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');

const router = express.Router();

// POST /api/tasks/reorder
router.post('/reorder', requireAuth, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.query('UPDATE tasks SET position = $1 WHERE id = $2', [i, ids[i]]);
      }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reorder tasks' });
  }
});

// Returns { value } on success, { error } on invalid input. expected_hours is
// optional, so null/empty/undefined all mean "no value".
function parseExpectedHours(raw) {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  const n = parseFloat(raw);
  if (isNaN(n) || n < 0) return { error: 'expected_hours must be a non-negative number' };
  return { value: n };
}

// POST /api/tasks
router.post('/', requireAuth, async (req, res) => {
  const { phase_id, name, assignee = '', due_date = null, priority = 'm' } = req.body;
  if (!phase_id || !name) return res.status(400).json({ error: 'phase_id and name are required' });

  const expectedHours = parseExpectedHours(req.body.expected_hours);
  if (expectedHours.error) return res.status(400).json({ error: expectedHours.error });

  try {
    const posResult = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM tasks WHERE phase_id = $1',
      [phase_id]
    );
    const pos = posResult.rows[0].pos;
    const result = await db.query(
      `INSERT INTO tasks (phase_id, position, name, assignee, due_date, priority, expected_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [phase_id, pos, name, assignee, due_date || null, priority, expectedHours.value]
    );
    res.status(201).json({ ...result.rows[0], hours_logged: '0' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', requireAuth, validateId, async (req, res) => {
  const id = req.idParam;
  const allowed = ['name', 'assignee', 'due_date', 'priority', 'done', 'expected_hours'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });

  let expectedHours;
  if (fields.includes('expected_hours')) {
    expectedHours = parseExpectedHours(req.body.expected_hours);
    if (expectedHours.error) return res.status(400).json({ error: expectedHours.error });
  }

  const sets = fields.map((f, i) => `${f} = $${i + 1}`);
  const values = fields.map(f => {
    if (f === 'expected_hours') return expectedHours.value;
    return req.body[f] === '' && f === 'due_date' ? null : req.body[f];
  });
  values.push(id);

  try {
    const result = await db.query(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', requireAuth, validateId, async (req, res) => {
  const id = req.idParam;
  try {
    await db.query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
