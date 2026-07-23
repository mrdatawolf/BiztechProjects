'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { db, initDb, migrateDb } = require('./db');
const { daysAgo, DEMO_PASSWORD, USERS, PROJECTS } = require('./seedData');

const FORCE = process.argv.includes('--force');

// ── Seed runner ───────────────────────────────────────────────────────────────
async function seed() {
  await initDb();
  await migrateDb();

  const existing = await db.query('SELECT COUNT(*) AS c FROM users');
  if (parseInt(existing.rows[0].c) > 0) {
    if (!FORCE) {
      console.log('Database already contains data. Run with --force to wipe and re-seed.');
      process.exit(0);
    }
    console.log('--force: clearing existing data…');
    await db.exec(`
      DELETE FROM time_entries;
      DELETE FROM deliverables;
      DELETE FROM tasks;
      DELETE FROM phases;
      DELETE FROM project_links;
      DELETE FROM projects;
      DELETE FROM users;
    `);
  }

  // Users
  console.log('Creating users…');
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIds = [];
  for (const u of USERS) {
    const r = await db.query(
      'INSERT INTO users (email, name, password) VALUES ($1, $2, $3) RETURNING id',
      [u.email, u.name, hash]
    );
    userIds.push(r.rows[0].id);
    console.log(`  ✓ ${u.name} <${u.email}>`);
  }

  // Projects
  for (const proj of PROJECTS) {
    console.log(`\nCreating project: ${proj.title}`);

    const pr = await db.query(
      `INSERT INTO projects
         (title, description, client, status, priority, due_date,
          team_size, team_lead, paused, pause_reason, created_by,
          created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
               now() - interval '${Math.floor(Math.random()*30)+10} days',
               now() - interval '${Math.floor(Math.random()*3)+1} days')
       RETURNING id`,
      [
        proj.title, proj.description, proj.client, proj.status,
        proj.priority, proj.due_date || null,
        proj.team_size, proj.team_lead,
        proj.paused || false, proj.pause_reason || '',
        userIds[0],
      ]
    );
    const projectId = pr.rows[0].id;

    // Links
    for (let i = 0; i < (proj.links || []).length; i++) {
      const l = proj.links[i];
      await db.query(
        'INSERT INTO project_links (project_id, position, label, url) VALUES ($1,$2,$3,$4)',
        [projectId, i, l.label, l.url]
      );
    }

    // Phases + tasks + deliverables
    const phaseIds  = [];
    const taskIdMap = {};  // taskIdMap[phaseIdx][taskIdx] = taskId

    for (let pi = 0; pi < proj.phases.length; pi++) {
      const ph = proj.phases[pi];
      const phr = await db.query(
        `INSERT INTO phases
           (project_id, position, name, subtitle, duration, status, notes, color_class)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [projectId, pi, ph.name, ph.subtitle, ph.duration, ph.status, ph.notes, ph.color_class]
      );
      const phaseId = phr.rows[0].id;
      phaseIds.push(phaseId);
      taskIdMap[pi] = [];

      for (let ti = 0; ti < ph.tasks.length; ti++) {
        const t = ph.tasks[ti];
        const tr = await db.query(
          `INSERT INTO tasks
             (phase_id, position, name, priority, expected_hours, done)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [phaseId, ti, t.name, t.priority, t.expected_hours || null, t.done]
        );
        taskIdMap[pi].push(tr.rows[0].id);
      }

      for (let di = 0; di < (ph.deliverables || []).length; di++) {
        await db.query(
          'INSERT INTO deliverables (phase_id, position, label) VALUES ($1,$2,$3)',
          [phaseId, di, ph.deliverables[di]]
        );
      }
    }

    console.log(`  ✓ ${proj.phases.length} phases, ${proj.phases.reduce((s,p)=>s+p.tasks.length,0)} tasks`);

    // Time entries
    for (const te of (proj.timeEntries || [])) {
      const taskId = taskIdMap[te.phaseIdx]?.[te.taskIdx];
      if (!taskId) continue;
      const userId = userIds[te.userIdx] || userIds[0];
      await db.query(
        `INSERT INTO time_entries (task_id, user_id, hours, date, note)
         VALUES ($1,$2,$3,$4,$5)`,
        [taskId, userId, te.hours, daysAgo(te.daysAgo), te.note]
      );
    }
    console.log(`  ✓ ${(proj.timeEntries||[]).length} time entries`);
  }

  console.log('\n✅  Seed complete!\n');
  console.log('Demo credentials (all users share the same password):');
  for (const u of USERS) {
    console.log(`  ${u.name.padEnd(18)} ${u.email.padEnd(38)} password: ${DEMO_PASSWORD}`);
  }
}

seed()
  .then(() => process.exit(0))
  .catch(err => { console.error('Seed failed:', err); process.exit(1); });
