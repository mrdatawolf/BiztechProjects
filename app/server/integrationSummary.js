'use strict';

function publicBaseUrl(req) {
  return (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`)
    .replace(/\/+$/, '');
}

function projectSummary(row, req) {
  const taskTotal = Number(row.task_total) || 0;
  const taskDone = Number(row.task_done) || 0;
  const progress = taskTotal > 0
    ? Math.round(taskDone / taskTotal * 100)
    : (row.status === 'Complete' ? 100 : 0);
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    paused: row.paused,
    pause_reason: row.pause_reason,
    task_total: taskTotal,
    task_done: taskDone,
    progress,
    updated_at: row.updated_at,
    web_url: `${publicBaseUrl(req)}/project.html?id=${row.id}`
  };
}

module.exports = { projectSummary };
