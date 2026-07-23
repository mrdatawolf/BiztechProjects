(function () {
  if (!requireAuth()) return;

  var projectId = parseInt(new URLSearchParams(window.location.search).get('id'));
  if (!projectId) { window.location.href = '/dashboard.html'; return; }

  document.getElementById('backLink').href = '/project.html?id=' + projectId;

  var user = getUser();
  if (user) document.getElementById('userName').textContent = user.name;

  document.getElementById('signOutLink').addEventListener('click', function (e) {
    e.preventDefault();
    localStorage.removeItem('token'); localStorage.removeItem('user');
    window.location.href = '/login.html';
  });

  // Set default date to today
  document.getElementById('dateInput').value = new Date().toISOString().slice(0, 10);

  var projectData = null;
  var entries = [];

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function showAlert(msg, type) {
    var alertEl = document.getElementById('alertEl');
    var div = document.createElement('div');
    div.className = 'alert alert-' + (type || 'err');
    div.textContent = msg;
    alertEl.innerHTML = '';
    alertEl.appendChild(div);
    if (type === 'ok') setTimeout(function () { alertEl.innerHTML = ''; }, 3000);
  }

  function showFormAlert(msg, type) {
    var formAlert = document.getElementById('formAlert');
    formAlert.innerHTML = '';
    if (!msg) return;
    var div = document.createElement('div');
    div.className = 'alert alert-' + (type || 'err');
    div.style.marginTop = 'var(--s3)';
    div.style.marginBottom = '0';
    div.textContent = msg;
    formAlert.appendChild(div);
  }

  // ── Populate phase/task selects ────────────────────────────────────────
  function populateSelects() {
    var phSel = document.getElementById('phaseSelect');
    phSel.innerHTML = '';
    (projectData.phases || []).forEach(function (ph) {
      var op = document.createElement('option'); op.value = ph.id; op.textContent = ph.name;
      phSel.appendChild(op);
    });
    updateTaskSelect();
    phSel.addEventListener('change', updateTaskSelect);
  }

  function updateTaskSelect() {
    var phId = parseInt(document.getElementById('phaseSelect').value);
    var ph = (projectData.phases || []).find(function (p) { return p.id === phId; });
    var tSel = document.getElementById('taskSelect');
    tSel.innerHTML = '';
    if (ph) {
      ph.tasks.forEach(function (t) {
        var op = document.createElement('option'); op.value = t.id; op.textContent = t.name;
        tSel.appendChild(op);
      });
    }
  }

  // ── Summary cards ──────────────────────────────────────────────────────
  function renderSummary() {
    var totalHours = 0;
    var byUser = {}, byPhase = {};

    entries.forEach(function (e) {
      var h = parseFloat(e.hours) || 0;
      totalHours += h;
      byUser[e.user_name] = (byUser[e.user_name] || 0) + h;
      byPhase[e.phase_name] = (byPhase[e.phase_name] || 0) + h;
    });

    var cards = [
      '<div class="sumcard"><div class="sumlbl">Total Hours</div><div class="sumval">' + totalHours.toFixed(1) + '</div><div class="sumsub">' + entries.length + ' entries</div></div>'
    ];

    Object.keys(byUser).forEach(function (name) {
      cards.push('<div class="sumcard"><div class="sumlbl">' + escHtml(name) + '</div><div class="sumval">' + byUser[name].toFixed(1) + 'h</div><div class="sumsub">by this person</div></div>');
    });

    Object.keys(byPhase).forEach(function (name) {
      cards.push('<div class="sumcard"><div class="sumlbl">' + escHtml(name) + '</div><div class="sumval">' + byPhase[name].toFixed(1) + 'h</div><div class="sumsub">this phase</div></div>');
    });

    document.getElementById('summaryEl').innerHTML = cards.join('');
  }

  // ── Entries table ──────────────────────────────────────────────────────
  function renderEntries() {
    var el = document.getElementById('entriesEl');
    if (!entries.length) {
      el.innerHTML = '<div class="empty-state" style="padding:var(--s10) 0;text-align:center;color:var(--txtm)">No time logged yet. Use the form above to add your first entry.</div>';
      return;
    }

    // Group by phase
    var phases = [];
    var phaseMap = {};
    entries.forEach(function (e) {
      if (!phaseMap[e.phase_id]) {
        phaseMap[e.phase_id] = { name: e.phase_name, rows: [] };
        phases.push(e.phase_id);
      }
      phaseMap[e.phase_id].rows.push(e);
    });

    var html = '<div class="tl-section"><table class="tl-table"><thead><tr>' +
      '<th>Date</th><th>User</th><th>Task</th><th>Hours</th><th>Note</th><th></th>' +
      '</tr></thead><tbody>';

    phases.forEach(function (phId) {
      var ph = phaseMap[phId];
      var phTotal = ph.rows.reduce(function (s, r) { return s + parseFloat(r.hours); }, 0);
      html += '<tr class="tl-phase-row"><td colspan="6">' + escHtml(ph.name) + ' — ' + phTotal.toFixed(1) + 'h total</td></tr>';
      ph.rows.forEach(function (e) {
        var isOwn = user && e.user_id === user.id;
        html += '<tr data-entry="' + e.id + '">' +
          '<td>' + (e.date ? e.date.slice(0, 10) : '') + '</td>' +
          '<td>' + escHtml(e.user_name) + '</td>' +
          '<td>' + escHtml(e.task_name) + '</td>' +
          '<td class="tl-hours">' + parseFloat(e.hours).toFixed(1) + 'h</td>' +
          '<td style="color:var(--txtm)">' + escHtml(e.note) + '</td>' +
          '<td style="white-space:nowrap">' + (isOwn ? '<button class="iBtn del" style="opacity:1" data-del-entry="' + e.id + '" title="Delete entry"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>' : '') + '</td>' +
          '</tr>';
      });
    });

    html += '</tbody></table></div>';
    el.innerHTML = html;

    el.querySelectorAll('[data-del-entry]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Delete this time entry?')) return;
        try {
          await apiFetch('/time-entries/' + btn.dataset.delEntry, { method: 'DELETE' });
          await loadEntries();
        } catch (err) { showAlert(err.message); }
      });
    });
  }

  // ── Log time ───────────────────────────────────────────────────────────
  document.getElementById('logBtn').addEventListener('click', async function () {
    var btn = this;
    var taskId = parseInt(document.getElementById('taskSelect').value);
    var hours = parseFloat(document.getElementById('hoursInput').value);
    var date = document.getElementById('dateInput').value;
    var note = document.getElementById('noteInput').value.trim();

    if (!taskId) return showFormAlert('Please select a task.');
    if (!hours || hours <= 0) return showFormAlert('Please enter a valid number of hours.');

    btn.disabled = true; btn.textContent = 'Logging…';
    showFormAlert('');
    try {
      await apiFetch('/time-entries', {
        method: 'POST',
        body: JSON.stringify({ task_id: taskId, hours: hours, date: date || null, note: note })
      });
      document.getElementById('hoursInput').value = '';
      document.getElementById('noteInput').value = '';
      await loadEntries();
      showFormAlert('Time logged successfully!', 'ok');
    } catch (err) {
      showFormAlert(err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Log';
    }
  });

  // ── Load ───────────────────────────────────────────────────────────────
  async function loadEntries() {
    entries = await apiFetch('/time-entries?project_id=' + projectId);
    renderSummary();
    renderEntries();
  }

  async function init() {
    try {
      projectData = await apiFetch('/projects/' + projectId);
      document.getElementById('projTitle').textContent = projectData.title || 'Project';
      document.getElementById('projClient').textContent = projectData.client || '';
      document.title = (projectData.title || 'Project') + ' — Time Log';
      populateSelects();
      await loadEntries();
    } catch (err) {
      showAlert('Failed to load project: ' + err.message);
    }
  }

  init();
})();
