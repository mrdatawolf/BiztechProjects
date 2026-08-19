'use strict';
const express = require('express');
const { db } = require('../db');
const { requireIntegrationAuth } = require('../middleware/integrationAuth');
const { validateId } = require('../middleware/validateId');
const { projectSummary } = require('../integrationSummary');

const router = express.Router();
router.use(requireIntegrationAuth);

const SUMMARY_SELECT = `
  SELECT p.id, p.title, p.status, p.paused, p.pause_reason, p.updated_at,
    COALESCE(tc.task_total, 0) AS task_total,
    COALESCE(tc.task_done, 0) AS task_done
  FROM projects p
  LEFT JOIN (
    SELECT ph.project_id,
           COUNT(t.id) AS task_total,
           COUNT(t.id) FILTER (WHERE t.done) AS task_done
    FROM phases ph
    LEFT JOIN tasks t ON t.phase_id = ph.id
    GROUP BY ph.project_id
  ) tc ON tc.project_id = p.id`;

// GET /api/integrations/projects — summaries for project pickers and batch refreshes
router.get('/projects', async (req, res) => {
  try {
    const result = await db.query(`${SUMMARY_SELECT} ORDER BY p.created_at DESC`);
    res.json(result.rows.map(row => projectSummary(row, req)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load project summaries' });
  }
});

// GET /api/integrations/projects/:id/summary — one canonical project rollup
router.get('/projects/:id/summary', validateId, async (req, res) => {
  try {
    const result = await db.query(`${SUMMARY_SELECT} WHERE p.id = $1`, [req.idParam]);
    if (!result.rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json(projectSummary(result.rows[0], req));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load project summary' });
  }
});

module.exports = router;
