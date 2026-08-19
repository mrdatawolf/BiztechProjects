'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');
const { DEFAULT_PHASES, SIMPLE_PHASE } = require('../data/defaultPhases');

const router = express.Router();

const PROJECT_STATUSES = ['New', 'In Progress', 'Complete'];
const PROJECT_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const PHASE_STATUSES = ['Not Started', 'In Progress', 'Complete'];
const TASK_PRIORITIES = ['h', 'm', 'l'];

// POST /api/projects/import
router.post('/import', requireAuth, async (req, res) => {
  const { project, phases, links = [] } = req.body;
  if (!project || !Array.isArray(phases)) {
    return res.status(400).json({ error: 'Invalid import format — expected { project, phases }' });
  }

  // Project-level fields fail the whole import loudly rather than silently
  // coercing to a default — the file is either well-formed or it isn't.
  const status = project.status || 'New';
  if (!PROJECT_STATUSES.includes(status)) {
    return res.status(400).json({ error: `project.status must be one of: ${PROJECT_STATUSES.join(', ')}` });
  }
  const priority = project.priority || 'medium';
  if (!PROJECT_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `project.priority must be one of: ${PROJECT_PRIORITIES.join(', ')}` });
  }
  let teamSize = 1;
  if (project.team_size !== undefined && project.team_size !== null && project.team_size !== '') {
    teamSize = parseInt(project.team_size, 10);
    if (!Number.isInteger(teamSize) || teamSize <= 0) {
      return res.status(400).json({ error: 'project.team_size must be a positive integer' });
    }
  }

  try {
    const newProject = await db.transaction(async (tx) => {
      let teamLeadId = null;
      if (project.team_lead && project.team_lead.trim()) {
        const match = await tx.query(
          'SELECT id FROM users WHERE lower(trim(name)) = lower(trim($1)) LIMIT 1',
          [project.team_lead]
        );
        if (match.rows.length) teamLeadId = match.rows[0].id;
      }
      const proj = await tx.query(
        `INSERT INTO projects
           (title, description, client, team_size, team_lead, team_lead_id,
            status, priority, due_date, paused, pause_reason, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [
          project.title || 'Imported Project',
          project.description || '',
          project.client || '',
          teamSize,
          project.team_lead || '',
          teamLeadId,
          status,
          priority,
          project.due_date || null,
          !!project.paused,
          project.pause_reason || '',
          req.user.id
        ]
      );
      const created = proj.rows[0];

      for (let pi = 0; pi < phases.length; pi++) {
        const ph = phases[pi];
        // A single malformed phase/task shouldn't sink the whole import —
        // fall back to the schema default instead of rejecting the file.
        const phaseStatus = PHASE_STATUSES.includes(ph.status) ? ph.status : 'Not Started';
        const phRow = await tx.query(
          `INSERT INTO phases (project_id, position, name, subtitle, duration, status, notes, color_class)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [
            created.id, pi,
            ph.name || '', ph.subtitle || '', ph.duration || '',
            phaseStatus, ph.notes || '',
            ph.color_class || 'p1'
          ]
        );
        const phaseId = phRow.rows[0].id;

        for (let ti = 0; ti < (ph.tasks || []).length; ti++) {
          const t = ph.tasks[ti];
          const taskPriority = TASK_PRIORITIES.includes(t.priority) ? t.priority : 'm';
          const boardStatus = ['backlog','ready','in_progress','review','done'].includes(t.board_status)
            ? t.board_status : (t.done ? 'done' : 'backlog');
          const actualSeconds = Number.isSafeInteger(Number(t.actual_seconds)) && Number(t.actual_seconds) >= 0
            ? Number(t.actual_seconds) : 0;
          await tx.query(
            `INSERT INTO tasks (phase_id, position, name, assignee, due_date, priority, done, expected_hours, board_status, board_position, actual_seconds, timer_started_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                     CASE WHEN $9 = 'in_progress' THEN now() ELSE NULL END)`,
            [phaseId, ti, t.name || '', t.assignee || '', t.due_date || null,
             taskPriority, boardStatus === 'done', t.expected_hours || null, boardStatus,
             Number.isInteger(t.board_position) ? t.board_position : ti, actualSeconds]
          );
        }

        for (let di = 0; di < (ph.deliverables || []).length; di++) {
          const d = ph.deliverables[di];
          await tx.query(
            `INSERT INTO deliverables (phase_id, position, label) VALUES ($1, $2, $3)`,
            [phaseId, di, d.label || '']
          );
        }

        for (let hi = 0; hi < (ph.hardware || []).length; hi++) {
          const h = ph.hardware[hi];
          await tx.query(
            `INSERT INTO hardware (phase_id, position, label, delivered) VALUES ($1, $2, $3, $4)`,
            [phaseId, hi, h.label || '', !!h.delivered]
          );
        }
      }

      for (let li = 0; li < links.length; li++) {
        const l = links[li];
        if (!l || !l.label || !l.url) continue;
        await tx.query(
          `INSERT INTO project_links (project_id, position, label, url) VALUES ($1, $2, $3, $4)`,
          [created.id, li, l.label, l.url]
        );
      }

      return created;
    });

    res.status(201).json(newProject);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to import project' });
  }
});

// GET /api/projects — list all projects with task counts
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, lead.name AS team_lead_name,
        COALESCE(tc.total, 0)     AS task_total,
        COALESCE(tc.done, 0)      AS task_done,
        COALESCE(tc.est_hours, 0) AS est_hours
      FROM projects p
      LEFT JOIN users lead ON lead.id = p.team_lead_id
      LEFT JOIN (
        SELECT ph.project_id,
               COUNT(t.id)                        AS total,
               COUNT(t.id) FILTER (WHERE t.done)  AS done,
               SUM(t.expected_hours)              AS est_hours
        FROM phases ph
        JOIN tasks t ON t.phase_id = ph.id
        GROUP BY ph.project_id
      ) tc ON tc.project_id = p.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

// POST /api/projects — create project + seed phases/tasks/deliverables
router.post('/', requireAuth, async (req, res) => {
  const { title = 'New Application Project', description = '', client = '', template, template_id } = req.body;
  try {
    let phasesToSeed;
    if (template_id) {
      const tmplId = parseInt(template_id, 10);
      if (!Number.isInteger(tmplId)) {
        return res.status(400).json({ error: 'Invalid template_id' });
      }
      const tmplResult = await db.query('SELECT definition FROM templates WHERE id = $1', [tmplId]);
      if (!tmplResult.rows.length) {
        return res.status(404).json({ error: 'Template not found' });
      }
      phasesToSeed = JSON.parse(tmplResult.rows[0].definition);
    } else {
      phasesToSeed = template === 'simple' ? SIMPLE_PHASE : DEFAULT_PHASES;
    }

    const project = await db.transaction(async (tx) => {
      const proj = await tx.query(
        `INSERT INTO projects (title, description, client, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [title, description, client, req.user.id]
      );
      const created = proj.rows[0];

      for (const ph of phasesToSeed) {
        const phRow = await tx.query(
          `INSERT INTO phases (project_id, position, name, subtitle, duration, color_class)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [created.id, ph.position, ph.name, ph.subtitle, ph.duration, ph.color_class]
        );
        const phaseId = phRow.rows[0].id;

        for (const t of ph.tasks) {
          await tx.query(
            `INSERT INTO tasks (phase_id, position, name, priority) VALUES ($1, $2, $3, $4)`,
            [phaseId, t.position, t.name, t.priority]
          );
        }
        for (let i = 0; i < ph.deliverables.length; i++) {
          await tx.query(
            `INSERT INTO deliverables (phase_id, position, label) VALUES ($1, $2, $3)`,
            [phaseId, i, ph.deliverables[i]]
          );
        }
      }

      return created;
    });

    res.status(201).json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/projects/:id — full nested project
router.get('/:id', requireAuth, validateId, async (req, res) => {
  const id = req.idParam;
  try {
    const projResult = await db.query(
      `SELECT p.*, lead.name AS team_lead_name
       FROM projects p
       LEFT JOIN users lead ON lead.id = p.team_lead_id
       WHERE p.id = $1`,
      [id]
    );
    if (!projResult.rows.length) return res.status(404).json({ error: 'Project not found' });
    const project = projResult.rows[0];

    const phasesResult = await db.query(
      'SELECT * FROM phases WHERE project_id = $1 ORDER BY position',
      [id]
    );

    const phases = [];
    for (const phase of phasesResult.rows) {
      const tasksResult = await db.query(
        `SELECT t.*,
           COALESCE(SUM(te.hours), 0) AS hours_logged
         FROM tasks t
         LEFT JOIN time_entries te ON te.task_id = t.id
         WHERE t.phase_id = $1
         GROUP BY t.id
         ORDER BY t.position`,
        [phase.id]
      );
      const delsResult = await db.query(
        'SELECT * FROM deliverables WHERE phase_id = $1 ORDER BY position',
        [phase.id]
      );
      const hwResult = await db.query(
        'SELECT * FROM hardware WHERE phase_id = $1 ORDER BY position',
        [phase.id]
      );
      phases.push({
        ...phase,
        tasks: tasksResult.rows,
        deliverables: delsResult.rows,
        hardware: hwResult.rows
      });
    }

    const linksResult = await db.query(
      'SELECT * FROM project_links WHERE project_id = $1 ORDER BY position',
      [id]
    );

    res.json({ ...project, phases, links: linksResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load project' });
  }
});

// PATCH /api/projects/:id
router.patch('/:id', requireAuth, validateId, async (req, res) => {
  const id = req.idParam;
  const allowed = ['title', 'description', 'client', 'team_size', 'team_lead_id', 'status', 'paused', 'pause_reason'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });

  const sets = fields.map((f, i) => `${f} = $${i + 1}`);
  sets.push(`updated_at = now()`);
  const values = fields.map(f => f === 'team_lead_id' ? (req.body[f] || null) : req.body[f]);
  values.push(id);

  try {
    const result = await db.query(
      `UPDATE projects SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', requireAuth, validateId, async (req, res) => {
  const id = req.idParam;
  try {
    await db.query('DELETE FROM projects WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
