'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Default phases matching the original template
const DEFAULT_PHASES = [
  {
    position: 0, name: 'Discovery & Planning', color_class: 'p1',
    subtitle: 'Define scope, gather requirements, design architecture',
    duration: 'Weeks 1-2',
    deliverables: ['Requirements Document', 'Architecture Diagram', 'Project Timeline', 'Stakeholder Sign-off'],
    tasks: [
      { position: 0, name: 'Define project scope and objectives', priority: 'h' },
      { position: 1, name: 'Gather functional requirements from stakeholders', priority: 'h' },
      { position: 2, name: 'Identify technical stack and dependencies', priority: 'm' },
      { position: 3, name: 'Create initial architecture diagram', priority: 'm' },
      { position: 4, name: 'Estimate timeline and resource needs', priority: 'l' },
      { position: 5, name: 'Get stakeholder approval on scope', priority: 'h' }
    ]
  },
  {
    position: 1, name: 'Design & Prototyping', color_class: 'p2',
    subtitle: 'UI/UX design, database schema, API contracts',
    duration: 'Weeks 3-4',
    deliverables: ['Wireframes / Mockups', 'Database Schema', 'API Specification', 'Design Review'],
    tasks: [
      { position: 0, name: 'Create wireframes or UI mockups', priority: 'h' },
      { position: 1, name: 'Design database schema', priority: 'h' },
      { position: 2, name: 'Define API endpoints and contracts', priority: 'm' },
      { position: 3, name: 'Review design with stakeholders', priority: 'm' },
      { position: 4, name: 'Set up development environments', priority: 'l' },
      { position: 5, name: 'Create version control repo and branching strategy', priority: 'l' }
    ]
  },
  {
    position: 2, name: 'Development & Integration', color_class: 'p3',
    subtitle: 'Build core features, integrate services, write tests',
    duration: 'Weeks 5-10',
    deliverables: ['Working Application', 'Test Suite', 'Integration Points', 'Code Review Complete'],
    tasks: [
      { position: 0, name: 'Build core application features (backend)', priority: 'h' },
      { position: 1, name: 'Build front-end interface', priority: 'h' },
      { position: 2, name: 'Implement authentication and authorization', priority: 'h' },
      { position: 3, name: 'Integrate third-party APIs/services', priority: 'm' },
      { position: 4, name: 'Write unit and integration tests', priority: 'm' },
      { position: 5, name: 'Conduct internal code review', priority: 'l' },
      { position: 6, name: 'Document code and functions', priority: 'l' }
    ]
  },
  {
    position: 3, name: 'Testing, Deployment & Handoff', color_class: 'p4',
    subtitle: 'QA, staging deploy, go-live, documentation',
    duration: 'Weeks 11-12',
    deliverables: ['QA Report', 'Production Deployment', 'User Documentation', 'Post-Launch Support Plan'],
    tasks: [
      { position: 0, name: 'Perform QA and user acceptance testing (UAT)', priority: 'h' },
      { position: 1, name: 'Fix bugs identified during testing', priority: 'h' },
      { position: 2, name: 'Deploy to staging environment', priority: 'm' },
      { position: 3, name: 'Final stakeholder review and sign-off', priority: 'h' },
      { position: 4, name: 'Deploy to production', priority: 'h' },
      { position: 5, name: 'Write user and admin documentation', priority: 'm' },
      { position: 6, name: 'Schedule post-launch support check-in', priority: 'l' }
    ]
  }
];

// POST /api/projects/import
router.post('/import', requireAuth, async (req, res) => {
  const { project, phases } = req.body;
  if (!project || !Array.isArray(phases)) {
    return res.status(400).json({ error: 'Invalid import format — expected { project, phases }' });
  }
  try {
    let teamLeadId = null;
    if (project.team_lead && project.team_lead.trim()) {
      const match = await db.query(
        'SELECT id FROM users WHERE lower(trim(name)) = lower(trim($1)) LIMIT 1',
        [project.team_lead]
      );
      if (match.rows.length) teamLeadId = match.rows[0].id;
    }
    const proj = await db.query(
      `INSERT INTO projects (title, description, client, team_size, team_lead, team_lead_id, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        project.title || 'Imported Project',
        project.description || '',
        project.client || '',
        project.team_size || 1,
        project.team_lead || '',
        teamLeadId,
        project.status || 'New',
        req.user.id
      ]
    );
    const newProject = proj.rows[0];

    for (let pi = 0; pi < phases.length; pi++) {
      const ph = phases[pi];
      const phRow = await db.query(
        `INSERT INTO phases (project_id, position, name, subtitle, duration, status, notes, color_class)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          newProject.id, pi,
          ph.name || '', ph.subtitle || '', ph.duration || '',
          ph.status || 'Not Started', ph.notes || '',
          ph.color_class || 'p1'
        ]
      );
      const phaseId = phRow.rows[0].id;

      for (let ti = 0; ti < (ph.tasks || []).length; ti++) {
        const t = ph.tasks[ti];
        await db.query(
          `INSERT INTO tasks (phase_id, position, name, assignee, due_date, priority, done, expected_hours)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [phaseId, ti, t.name || '', t.assignee || '', t.due_date || null,
           t.priority || 'm', t.done || false, t.expected_hours || null]
        );
      }

      for (let di = 0; di < (ph.deliverables || []).length; di++) {
        const d = ph.deliverables[di];
        await db.query(
          `INSERT INTO deliverables (phase_id, position, label) VALUES ($1, $2, $3)`,
          [phaseId, di, d.label || '']
        );
      }
    }

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
  const { title = 'New Application Project', description = '', client = '' } = req.body;
  try {
    const proj = await db.query(
      `INSERT INTO projects (title, description, client, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, description, client, req.user.id]
    );
    const project = proj.rows[0];

    for (const ph of DEFAULT_PHASES) {
      const phRow = await db.query(
        `INSERT INTO phases (project_id, position, name, subtitle, duration, color_class)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [project.id, ph.position, ph.name, ph.subtitle, ph.duration, ph.color_class]
      );
      const phaseId = phRow.rows[0].id;

      for (const t of ph.tasks) {
        await db.query(
          `INSERT INTO tasks (phase_id, position, name, priority) VALUES ($1, $2, $3, $4)`,
          [phaseId, t.position, t.name, t.priority]
        );
      }
      for (let i = 0; i < ph.deliverables.length; i++) {
        await db.query(
          `INSERT INTO deliverables (phase_id, position, label) VALUES ($1, $2, $3)`,
          [phaseId, i, ph.deliverables[i]]
        );
      }
    }

    res.status(201).json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/projects/:id — full nested project
router.get('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
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

    res.json({ ...project, phases });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load project' });
  }
});

// PATCH /api/projects/:id
router.patch('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
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
router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await db.query('DELETE FROM projects WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
