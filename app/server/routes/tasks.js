'use strict';
const express = require('express');
const { db, touchProject } = require('../db');

async function projectIdForTask(taskId) {
  const r = await db.query(
    'SELECT ph.project_id FROM tasks t JOIN phases ph ON ph.id = t.phase_id WHERE t.id = $1',
    [taskId]
  );
  return r.rows[0]?.project_id;
}

async function projectIdForPhase(phaseId) {
  const r = await db.query('SELECT project_id FROM phases WHERE id = $1', [phaseId]);
  return r.rows[0]?.project_id;
}
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/tasks
router.post('/', requireAuth, async (req, res) => {
  const { phase_id, name, assignee = '', due_date = null, priority = 'm', expected_hours = null } = req.body;
  if (!phase_id || !name) return res.status(400).json({ error: 'phase_id and name are required' });
  try {
    const posResult = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM tasks WHERE phase_id = $1',
      [phase_id]
    );
    const pos = posResult.rows[0].pos;
    const result = await db.query(
      `INSERT INTO tasks (phase_id, position, name, assignee, due_date, priority, expected_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [phase_id, pos, name, assignee, due_date || null, priority, expected_hours || null]
    );
    await touchProject(await projectIdForPhase(phase_id));
    res.status(201).json({ ...result.rows[0], hours_logged: '0' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// POST /api/tasks/reorder — update positions (and optionally phase_id) for a list of tasks
router.post('/reorder', requireAuth, async (req, res) => {
  const { phase_id, task_ids } = req.body;
  if (!phase_id || !Array.isArray(task_ids)) {
    return res.status(400).json({ error: 'phase_id and task_ids array required' });
  }
  try {
    for (let i = 0; i < task_ids.length; i++) {
      await db.query(
        'UPDATE tasks SET position = $1, phase_id = $2 WHERE id = $3',
        [i, phase_id, task_ids[i]]
      );
    }
    await touchProject(await projectIdForPhase(phase_id));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reorder tasks' });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const allowed = ['name', 'assignee', 'due_date', 'priority', 'done', 'expected_hours'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });

  const sets = fields.map((f, i) => `${f} = $${i + 1}`);
  const values = fields.map(f => req.body[f] === '' && f === 'due_date' ? null : req.body[f]);
  values.push(id);

  try {
    const result = await db.query(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Task not found' });
    await touchProject(await projectIdForTask(id));
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const projId = await projectIdForTask(id);
    await db.query('DELETE FROM tasks WHERE id = $1', [id]);
    await touchProject(projId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
