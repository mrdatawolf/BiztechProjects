'use strict';

const { db } = require('./db');

function mostRecentCutoff(now) {
  const cutoff = new Date(now);
  cutoff.setHours(17, 0, 0, 0);
  if (now < cutoff) cutoff.setDate(cutoff.getDate() - 1);
  return cutoff;
}

function nextCutoff(now) {
  const cutoff = new Date(now);
  cutoff.setHours(17, 0, 0, 0);
  if (now >= cutoff) cutoff.setDate(cutoff.getDate() + 1);
  return cutoff;
}

async function moveExpiredTasksToReady(cutoff) {
  await db.transaction(async (tx) => {
    const maxResult = await tx.query(
      `SELECT p.project_id, COALESCE(MAX(t.board_position), -1) AS max_position
       FROM tasks t JOIN phases p ON p.id = t.phase_id
       WHERE t.board_status = 'ready'
       GROUP BY p.project_id`
    );
    const nextPositions = new Map(maxResult.rows.map(row => [row.project_id, Number(row.max_position) + 1]));
    const active = await tx.query(
      `SELECT t.id, p.project_id FROM tasks t JOIN phases p ON p.id = t.phase_id
       WHERE t.board_status = 'in_progress' AND t.timer_started_at IS NOT NULL
         AND t.timer_started_at <= $1
       ORDER BY p.project_id, t.timer_started_at, t.id`,
      [cutoff.toISOString()]
    );
    for (const task of active.rows) {
      const position = nextPositions.get(task.project_id) || 0;
      await tx.query(
        `UPDATE tasks SET
           actual_seconds = actual_seconds + GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ($1::timestamptz - timer_started_at))))::bigint,
           timer_started_at = NULL,
           board_status = 'ready',
           board_position = $2,
           done = false
         WHERE id = $3`,
        [cutoff.toISOString(), position, task.id]
      );
      nextPositions.set(task.project_id, position + 1);
    }
    return active.rows.length;
  });
}

function startBoardTimerScheduler() {
  // Reconcile timers that crossed 5 PM while the server was not running.
  moveExpiredTasksToReady(mostRecentCutoff(new Date())).catch(err => {
    console.error('[ProjectPlan] Failed to reconcile the 5 PM board cutoff:', err);
  });

  function schedule() {
    const now = new Date();
    const cutoff = nextCutoff(now);
    const delay = cutoff.getTime() - now.getTime();
    setTimeout(async () => {
      try {
        await moveExpiredTasksToReady(cutoff);
      } catch (err) {
        console.error('[ProjectPlan] Failed to run the 5 PM board cutoff:', err);
      } finally {
        schedule();
      }
    }, delay);
  }
  schedule();
}

module.exports = { startBoardTimerScheduler, moveExpiredTasksToReady, mostRecentCutoff, nextCutoff };
