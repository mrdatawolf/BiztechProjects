'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');

const router = express.Router();
const BOARD_STATUSES = ['backlog', 'ready', 'in_progress', 'review', 'done'];

// POST /api/tasks/board/reorder
// The client submits the complete project board so lane changes and ordering
// are committed atomically and cannot leave duplicate positions behind.
router.post('/board/reorder', requireAuth, async (req, res) => {
  const projectId = parseInt(req.body.project_id, 10);
  const lanes = req.body.lanes;
  if (!Number.isInteger(projectId) || !lanes || typeof lanes !== 'object') {
    return res.status(400).json({ error: 'project_id and lanes are required' });
  }
  if (Object.keys(lanes).some(status => !BOARD_STATUSES.includes(status)) ||
      BOARD_STATUSES.some(status => !Array.isArray(lanes[status]))) {
    return res.status(400).json({ error: 'Invalid board lanes' });
  }

  const submittedIds = BOARD_STATUSES.flatMap(status => lanes[status].map(id => parseInt(id, 10)));
  if (submittedIds.some(id => !Number.isInteger(id)) || new Set(submittedIds).size !== submittedIds.length) {
    return res.status(400).json({ error: 'Task IDs must be unique integers' });
  }

  try {
    const result = await db.query(
      `SELECT t.id FROM tasks t JOIN phases p ON p.id = t.phase_id
       WHERE p.project_id = $1 ORDER BY t.id`,
      [projectId]
    );
    const projectIds = result.rows.map(row => row.id).sort((a, b) => a - b);
    const sortedSubmitted = submittedIds.slice().sort((a, b) => a - b);
    if (projectIds.length !== sortedSubmitted.length ||
        projectIds.some((id, i) => id !== sortedSubmitted[i])) {
      return res.status(400).json({ error: 'Board must contain every task in the project exactly once' });
    }

    await db.transaction(async (tx) => {
      for (const status of BOARD_STATUSES) {
        for (let position = 0; position < lanes[status].length; position++) {
          await tx.query(
            `UPDATE tasks SET
               actual_seconds = CASE
                 WHEN board_status = 'in_progress' AND $1 <> 'in_progress' AND timer_started_at IS NOT NULL
                 THEN actual_seconds + GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - timer_started_at))))::bigint
                 ELSE actual_seconds
               END,
               timer_started_at = CASE
                 WHEN board_status <> 'in_progress' AND $1 = 'in_progress' THEN now()
                 WHEN board_status = 'in_progress' AND $1 <> 'in_progress' THEN NULL
                 ELSE timer_started_at
               END,
               board_status = $1, board_position = $2, done = $3
             WHERE id = $4`,
            [status, position, status === 'done', lanes[status][position]]
          );
        }
      }
    });
    const updated = await db.query(
      `SELECT t.id, t.board_status, t.board_position, t.done, t.actual_seconds, t.timer_started_at
       FROM tasks t JOIN phases p ON p.id = t.phase_id
       WHERE p.project_id = $1`,
      [projectId]
    );
    res.json({ ok: true, tasks: updated.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to move board task' });
  }
});

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
  const allowed = ['name', 'assignee', 'due_date', 'priority', 'done', 'expected_hours', 'board_status', 'actual_seconds'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });
  if (fields.includes('board_status') && !BOARD_STATUSES.includes(req.body.board_status)) {
    return res.status(400).json({ error: 'Invalid board_status' });
  }
  if (fields.includes('actual_seconds')) {
    const seconds = Number(req.body.actual_seconds);
    if (!Number.isSafeInteger(seconds) || seconds < 0) {
      return res.status(400).json({ error: 'actual_seconds must be a non-negative integer' });
    }
    req.body.actual_seconds = seconds;
  }

  // The legacy checkbox and the board's Done lane are two views of the same
  // completion state. Keep them synchronized whichever view performs the edit.
  if (fields.includes('done') && !fields.includes('board_status')) {
    req.body.board_status = req.body.done ? 'done' : 'backlog';
    fields.push('board_status');
  } else if (fields.includes('board_status') && !fields.includes('done')) {
    req.body.done = req.body.board_status === 'done';
    fields.push('done');
  }

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
    const result = await db.transaction(async (tx) => {
      if (fields.includes('actual_seconds')) {
        const active = await tx.query('SELECT timer_started_at FROM tasks WHERE id = $1', [id]);
        if (!active.rows.length) return { rows: [] };
        if (active.rows[0].timer_started_at) {
          const conflict = new Error('Actual time cannot be edited while a task is in progress');
          conflict.status = 409;
          throw conflict;
        }
      }
      if (fields.includes('board_status')) {
        await tx.query(
          `UPDATE tasks SET
             actual_seconds = CASE
               WHEN board_status = 'in_progress' AND $1 <> 'in_progress' AND timer_started_at IS NOT NULL
               THEN actual_seconds + GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - timer_started_at))))::bigint
               ELSE actual_seconds
             END,
             timer_started_at = CASE
               WHEN board_status <> 'in_progress' AND $1 = 'in_progress' THEN now()
               WHEN board_status = 'in_progress' AND $1 <> 'in_progress' THEN NULL
               ELSE timer_started_at
             END
           WHERE id = $2`,
          [req.body.board_status, id]
        );
      }
      return tx.query(
        `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values
      );
    });
    if (!result.rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message });
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
