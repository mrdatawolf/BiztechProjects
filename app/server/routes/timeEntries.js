'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');

const router = express.Router();

// GET /api/time-entries?project_id=N  or  ?task_id=N
router.get('/', requireAuth, async (req, res) => {
  const { project_id, task_id } = req.query;
  try {
    let result;
    if (project_id) {
      result = await db.query(
        `SELECT te.*, u.name AS user_name, t.name AS task_name,
                ph.name AS phase_name, ph.id AS phase_id
         FROM time_entries te
         JOIN users u ON u.id = te.user_id
         JOIN tasks t ON t.id = te.task_id
         JOIN phases ph ON ph.id = t.phase_id
         WHERE ph.project_id = $1
         ORDER BY te.date DESC, te.created_at DESC`,
        [project_id]
      );
    } else if (task_id) {
      result = await db.query(
        `SELECT te.*, u.name AS user_name
         FROM time_entries te
         JOIN users u ON u.id = te.user_id
         WHERE te.task_id = $1
         ORDER BY te.date DESC, te.created_at DESC`,
        [task_id]
      );
    } else {
      return res.status(400).json({ error: 'project_id or task_id query parameter required' });
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load time entries' });
  }
});

// POST /api/time-entries
router.post('/', requireAuth, async (req, res) => {
  const { task_id, hours, date, note = '' } = req.body;
  if (!task_id || hours == null) return res.status(400).json({ error: 'task_id and hours are required' });
  if (isNaN(parseFloat(hours)) || parseFloat(hours) <= 0) {
    return res.status(400).json({ error: 'hours must be a positive number' });
  }
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await db.query(
      `INSERT INTO time_entries (task_id, user_id, hours, date, note)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [task_id, req.user.id, parseFloat(hours), date || today, note]
    );
    const entry = result.rows[0];
    const userResult = await db.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    res.status(201).json({ ...entry, user_name: userResult.rows[0]?.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log time' });
  }
});

// PATCH /api/time-entries/:id — only owner can edit
router.patch('/:id', requireAuth, validateId, async (req, res) => {
  const id = req.idParam;
  const allowed = ['hours', 'date', 'note'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });

  if (fields.includes('hours')) {
    const hours = parseFloat(req.body.hours);
    if (isNaN(hours) || hours <= 0) {
      return res.status(400).json({ error: 'hours must be a positive number' });
    }
  }

  try {
    const check = await db.query('SELECT user_id FROM time_entries WHERE id = $1', [id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Entry not found' });
    if (check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own time entries' });
    }

    const sets = fields.map((f, i) => `${f} = $${i + 1}`);
    const values = fields.map(f => f === 'hours' ? parseFloat(req.body[f]) : req.body[f]);
    values.push(id);

    const result = await db.query(
      `UPDATE time_entries SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update time entry' });
  }
});

// DELETE /api/time-entries/:id — only owner can delete
router.delete('/:id', requireAuth, validateId, async (req, res) => {
  const id = req.idParam;
  try {
    const check = await db.query('SELECT user_id FROM time_entries WHERE id = $1', [id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Entry not found' });
    if (check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own time entries' });
    }
    await db.query('DELETE FROM time_entries WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
});

module.exports = router;
