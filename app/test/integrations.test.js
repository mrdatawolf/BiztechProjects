'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { tokensMatch } = require('../server/middleware/integrationAuth');
const { projectSummary } = require('../server/integrationSummary');

test('integration tokens require matching non-empty values', () => {
  assert.equal(tokensMatch('secret', 'secret'), true);
  assert.equal(tokensMatch('secret', 'different'), false);
  assert.equal(tokensMatch('', ''), false);
});

test('project summary calculates task progress and configured URL', () => {
  process.env.PUBLIC_BASE_URL = 'https://projects.example.test/';
  const summary = projectSummary({
    id: 5, title: 'Site', status: 'In Progress', paused: false,
    pause_reason: '', task_total: '24', task_done: '10', updated_at: 'now'
  }, { protocol: 'http', get: () => 'ignored' });
  assert.equal(summary.progress, 42);
  assert.equal(summary.task_total, 24);
  assert.equal(summary.web_url, 'https://projects.example.test/project.html?id=5');
  delete process.env.PUBLIC_BASE_URL;
});

test('completed project without tasks reports complete', () => {
  const summary = projectSummary({
    id: 7, title: 'Empty', status: 'Complete', paused: false,
    pause_reason: '', task_total: '0', task_done: '0', updated_at: 'now'
  }, { protocol: 'http', get: () => 'localhost:3000' });
  assert.equal(summary.progress, 100);
});
