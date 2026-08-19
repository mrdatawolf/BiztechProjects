(function () {
  if (!requireAuth()) return;

  var projectId = parseInt(new URLSearchParams(window.location.search).get('id'));
  if (!projectId) { window.location.href = '/dashboard.html'; return; }

  var tlLink = document.getElementById('timelogLink');
  if (tlLink) tlLink.href = '/timelog.html?id=' + projectId;

  var state = null;
  var dirty = new Set();
  var userMap = {};
  var BOARD_LANES = [
    { id: 'backlog', label: 'Backlog' },
    { id: 'ready', label: 'Ready' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'review', label: 'Review' },
    { id: 'done', label: 'Done' }
  ];
  var boardClock = null;

  function taskActualSeconds(task) {
    var seconds = parseInt(task.actual_seconds, 10) || 0;
    if (task.timer_started_at) {
      seconds += Math.max(0, Math.floor((Date.now() - new Date(task.timer_started_at).getTime()) / 1000));
    }
    return seconds;
  }

  function formatDuration(seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));
    var hours = Math.floor(seconds / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);
    if (hours) return hours + 'h ' + minutes + 'm';
    if (minutes) return minutes + 'm';
    return seconds + 's';
  }

  async function loadUsers() {
    try {
      var users = await apiFetch('/users');
      var select = document.getElementById('projLead');
      users.forEach(function (u) {
        userMap[u.id] = u.name;
        var opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = u.name;
        select.appendChild(opt);
      });
    } catch (err) {
      showAlert('Failed to load users: ' + err.message);
    }
  }

  async function loadCompanies() {
    var select = document.getElementById('projClient');
    try {
      var data = await apiFetch('/companies');
      select.innerHTML = '<option value="">Select client…</option>';
      (data.companies || []).forEach(function (name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
      });
      if (state && state.client) {
        select.value = state.client;
        if (select.selectedIndex === -1) {
          var current = document.createElement('option');
          current.value = state.client;
          current.textContent = state.client;
          select.insertBefore(current, select.firstChild.nextSibling);
          select.value = state.client;
        }
      }
    } catch (err) {
      select.innerHTML = '';
      var current = document.createElement('option');
      current.value = state ? (state.client || '') : '';
      current.textContent = current.value || '(unavailable)';
      select.appendChild(current);
      select.disabled = true;
      showAlert('Failed to load companies list: ' + err.message);
    }
  }

  var alertEl = document.getElementById('alertEl');
  function showAlert(msg, type) {
    var div = document.createElement('div');
    div.className = 'alert alert-' + (type || 'err');
    div.textContent = msg;
    alertEl.innerHTML = '';
    alertEl.appendChild(div);
    if (type === 'ok') setTimeout(function () { alertEl.innerHTML = ''; }, 3000);
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function markDirty(key) { dirty.add(key); }

  // ── Stats ──────────────────────────────────────────────────────────────
  function updateStats() {
    var tot = 0, dn = 0, act = null, estHrs = 0;
    state.phases.forEach(function (ph) {
      tot += ph.tasks.length;
      ph.tasks.forEach(function (t) {
        if (t.done) dn++;
        estHrs += parseFloat(t.expected_hours) || 0;
      });
      if (ph.status === 'In Progress' && !act) act = ph;
    });
    var pct = tot > 0 ? Math.round(dn / tot * 100) : 0;
    var estEl = document.getElementById('tEstHours');
    if (estEl) estEl.textContent = estHrs > 0 ? estHrs + 'h' : '—';
    document.getElementById('oPct').textContent = pct + '%';
    document.getElementById('oBar').style.width = pct + '%';
    document.getElementById('tTotal').textContent = tot;
    document.getElementById('tDone').textContent = dn + ' completed';
    var badge = document.getElementById('statusBadge');
    if (act) {
      document.getElementById('aPhName').textContent = 'Phase ' + (state.phases.indexOf(act) + 1);
      document.getElementById('aPhDesc').textContent = act.name;
    } else if (pct === 100 && tot > 0) {
      document.getElementById('aPhName').textContent = 'Complete';
      document.getElementById('aPhDesc').textContent = 'All phases done';
      if (!state.paused && state.status !== 'Complete') {
        state.status = 'Complete';
        applyBadge(badge, state.status, state.paused);
        markDirty('project');
        apiFetch('/projects/' + projectId, { method: 'PATCH', body: JSON.stringify({ status: 'Complete' }) }).catch(function () {});
      } else if (!state.paused) {
        applyBadge(badge, state.status, state.paused);
      }
    } else {
      document.getElementById('aPhName').textContent = '—';
      document.getElementById('aPhDesc').textContent = 'Not started';
    }
  }

  function updPhStats(phaseId) {
    var ph = state.phases.find(function (p) { return p.id === phaseId; });
    if (!ph) return;
    var tot = ph.tasks.length, dn = 0, estHrs = 0;
    ph.tasks.forEach(function (t) {
      if (t.done) dn++;
      estHrs += parseFloat(t.expected_hours) || 0;
    });
    var pct = tot > 0 ? Math.round(dn / tot * 100) : 0;
    var pb = document.getElementById('pb' + phaseId); if (pb) pb.style.width = pct + '%';
    var pp = document.getElementById('pp' + phaseId); if (pp) pp.textContent = pct + '%';
    var tl = document.getElementById('ptl' + phaseId); if (tl) tl.textContent = 'Tasks (' + dn + '/' + tot + ')';
    var pe = document.getElementById('pest' + phaseId); if (pe) pe.textContent = estHrs > 0 ? '~' + estHrs + 'h est' : '';
    updateStats();
  }

  // ── Task row ───────────────────────────────────────────────────────────
  function mkRow(task, phaseId) {
    var row = document.createElement('div');
    row.className = 'trow' + (task.done ? ' done' : '');
    row.id = 'tr' + task.id;
    row.dataset.taskId = task.id;

    var drag = document.createElement('span'); drag.className = 'drag-handle';
    drag.innerHTML = '<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/><circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/></svg>';
    row.appendChild(drag);

    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.className = 'tck'; cb.checked = task.done;
    cb.addEventListener('change', async function () {
      task.done = cb.checked;
      task.board_status = task.done ? 'done' : 'backlog';
      if (task.done) row.classList.add('done'); else row.classList.remove('done');
      updPhStats(phaseId);
      // Auto-promote project from New → In Progress on first completed task
      if (task.done && state.status === 'New' && !state.paused) {
        state.status = 'In Progress';
        applyBadge(document.getElementById('statusBadge'), state.status, state.paused);
        markDirty('project');
        apiFetch('/projects/' + projectId, { method: 'PATCH', body: JSON.stringify({ status: 'In Progress' }) }).catch(function () {});
      }
      try {
        var updatedTask = await apiFetch('/tasks/' + task.id, { method: 'PATCH', body: JSON.stringify({ done: task.done }) });
        Object.assign(task, updatedTask);
        renderBoard();
      } catch (err) {
        task.done = !task.done; cb.checked = task.done;
        task.board_status = task.done ? 'done' : 'backlog';
        if (task.done) row.classList.add('done'); else row.classList.remove('done');
        updPhStats(phaseId);
        showAlert(err.message);
      }
    });
    row.appendChild(cb);

    var bd = document.createElement('div'); bd.className = 'tbody';

    var nm = document.createElement('div'); nm.className = 'tname';
    nm.contentEditable = 'true'; nm.spellcheck = false; nm.textContent = task.name;
    nm.addEventListener('blur', function () {
      if (task.name !== this.textContent) { task.name = this.textContent; markDirty('task:' + task.id); saveTask(task); }
    });
    bd.appendChild(nm);

    var meta = document.createElement('div'); meta.className = 'tmeta';

    // Hours logged badge
    var hrs = parseFloat(task.hours_logged) || 0;
    if (hrs > 0) {
      var hb = document.createElement('span'); hb.className = 'hours-badge';
      hb.textContent = hrs + 'h logged';
      meta.appendChild(hb);
    }

    // Estimated hours input
    var es = document.createElement('span'); es.className = 'tmf';
    es.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 14"/></svg>';
    var ei = document.createElement('input'); ei.type = 'number'; ei.className = 'editable';
    ei.placeholder = 'Est h'; ei.min = '0'; ei.step = '0.5';
    ei.value = task.expected_hours != null ? task.expected_hours : '';
    ei.style.cssText = 'font-size:var(--xs);width:52px';
    ei.title = 'Estimated hours';
    ei.addEventListener('change', function () {
      var val = parseFloat(this.value);
      task.expected_hours = isNaN(val) ? null : val;
      markDirty('task:' + task.id);
      updPhStats(phaseId);
      saveTask(task);
    });
    es.appendChild(ei); meta.appendChild(es);

    // Actual hours are editable except while the board timer is running.
    var actual = document.createElement('span'); actual.className = 'tmf';
    actual.title = task.timer_started_at ? 'Actual time is running' : 'Actual hours';
    var actualLabel = document.createElement('span'); actualLabel.textContent = 'Actual'; actual.appendChild(actualLabel);
    var actualInput = document.createElement('input'); actualInput.type = 'number'; actualInput.className = 'editable';
    actualInput.min = '0'; actualInput.step = '0.01'; actualInput.style.cssText = 'font-size:var(--xs);width:62px';
    actualInput.value = (taskActualSeconds(task) / 3600).toFixed(2);
    actualInput.disabled = !!task.timer_started_at;
    actualInput.addEventListener('change', async function () {
      var hours = Number(this.value);
      if (!Number.isFinite(hours) || hours < 0) { this.value = (taskActualSeconds(task) / 3600).toFixed(2); return; }
      var previous = task.actual_seconds;
      task.actual_seconds = Math.round(hours * 3600);
      try {
        await apiFetch('/tasks/' + task.id, { method: 'PATCH', body: JSON.stringify({ actual_seconds: task.actual_seconds }) });
        flashSaved();
        renderBoard();
      } catch (err) {
        task.actual_seconds = previous;
        this.value = (taskActualSeconds(task) / 3600).toFixed(2);
        showAlert(err.message);
      }
    });
    actual.appendChild(actualInput); meta.appendChild(actual);

    // Assignee
    var as = document.createElement('span'); as.className = 'tmf';
    as.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>';
    var ai = document.createElement('input'); ai.className = 'editable'; ai.placeholder = 'Assignee';
    ai.value = task.assignee || ''; ai.style.cssText = 'font-size:var(--xs);width:80px';
    ai.addEventListener('change', function () { task.assignee = this.value; markDirty('task:' + task.id); saveTask(task); });
    as.appendChild(ai); meta.appendChild(as);

    // Due date
    var ds = document.createElement('span'); ds.className = 'tmf';
    ds.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
    var di = document.createElement('input'); di.type = 'date'; di.className = 'editable';
    di.value = task.due_date ? task.due_date.slice(0, 10) : ''; di.style.cssText = 'font-size:var(--xs)';
    di.addEventListener('change', function () { task.due_date = this.value; markDirty('task:' + task.id); saveTask(task); });
    ds.appendChild(di); meta.appendChild(ds);

    // Priority
    var pmap = { h: 'ph', m: 'pm', l: 'pl' };
    var ps = document.createElement('span'); ps.className = 'tmf';
    var dot = document.createElement('span'); dot.className = 'pdot ' + (pmap[task.priority] || 'pm');
    ps.appendChild(dot);
    var psel = document.createElement('select'); psel.className = 'editable';
    psel.style.cssText = 'font-size:var(--xs);padding:0 4px';
    [['h','High'],['m','Med'],['l','Low']].forEach(function (o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1];
      if (o[0] === task.priority) op.selected = true;
      psel.appendChild(op);
    });
    psel.addEventListener('change', function () {
      task.priority = this.value; dot.className = 'pdot ' + pmap[this.value];
      markDirty('task:' + task.id);
      saveTask(task);
    });
    ps.appendChild(psel); meta.appendChild(ps);
    bd.appendChild(meta);
    row.appendChild(bd);

    var acts = document.createElement('div'); acts.className = 'tacts';
    var db2 = document.createElement('button'); db2.className = 'iBtn del'; db2.title = 'Delete task';
    db2.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
    db2.addEventListener('click', async function () {
      if (!confirm('Delete this task?')) return;
      try {
        await apiFetch('/tasks/' + task.id, { method: 'DELETE' });
        var ph = state.phases.find(function (p) { return p.id === phaseId; });
        if (ph) ph.tasks = ph.tasks.filter(function (t) { return t.id !== task.id; });
        row.parentNode.removeChild(row);
        updPhStats(phaseId);
      } catch (err) { showAlert(err.message); }
    });
    acts.appendChild(db2); row.appendChild(acts);
    return row;
  }

  // ── Phase card ─────────────────────────────────────────────────────────
  var tlsColors = ['tl1','tl2','tl3','tl4'];

  function mkCard(ph, idx) {
    var tot = ph.tasks.length, dn = 0;
    ph.tasks.forEach(function (t) { if (t.done) dn++; });
    var pct = tot > 0 ? Math.round(dn / tot * 100) : 0;

    var tlsCls = tlsColors[idx % 4];
    var card = document.createElement('div');
    card.className = 'pcard ' + ph.color_class;
    card.dataset.phaseId = ph.id;

    // Header
    var hd = document.createElement('div'); hd.className = 'phd';
    var num = document.createElement('div'); num.className = 'pnum'; num.textContent = idx + 1; hd.appendChild(num);

    var info = document.createElement('div'); info.className = 'pinfo';
    var ti = document.createElement('input'); ti.className = 'editable pti'; ti.value = ph.name;
    ti.addEventListener('change', function () { ph.name = this.value; markDirty('phase:' + ph.id); savePhase(ph); renderTL(); });
    info.appendChild(ti);

    var si = document.createElement('input'); si.className = 'editable psi'; si.value = ph.subtitle || '';
    si.addEventListener('change', function () { ph.subtitle = this.value; markDirty('phase:' + ph.id); savePhase(ph); });
    info.appendChild(si);

    var pr = document.createElement('div'); pr.className = 'pprow';
    var pw = document.createElement('div'); pw.className = 'ppwrap';
    var bw = document.createElement('div'); bw.className = 'pbar-wrap';
    var pb = document.createElement('div'); pb.className = 'pbar'; pb.id = 'pb' + ph.id; pb.style.width = pct + '%';
    bw.appendChild(pb); pw.appendChild(bw); pr.appendChild(pw);
    var pl = document.createElement('span'); pl.className = 'pplbl'; pl.id = 'pp' + ph.id; pl.textContent = pct + '%';
    pr.appendChild(pl);
    var phEstHrs = ph.tasks.reduce(function (s, t) { return s + (parseFloat(t.expected_hours) || 0); }, 0);
    var estLbl = document.createElement('span'); estLbl.id = 'pest' + ph.id;
    estLbl.style.cssText = 'font-size:var(--xs);color:var(--txtm);margin-left:var(--s2)';
    estLbl.textContent = phEstHrs > 0 ? '~' + phEstHrs + 'h est' : '';
    pr.appendChild(estLbl);
    info.appendChild(pr);
    hd.appendChild(info);

    var pacts = document.createElement('div'); pacts.className = 'pacts';
    var sel = document.createElement('select'); sel.className = 'ssel';
    ['Not Started','In Progress','Complete'].forEach(function (s) {
      var op = document.createElement('option'); op.value = s; op.textContent = s;
      if (s === ph.status) op.selected = true; sel.appendChild(op);
    });
    sel.addEventListener('change', async function () {
      ph.status = this.value;
      updateStats();
      if (this.value === 'In Progress' && !state.paused && state.status === 'New') {
        state.status = 'In Progress';
        applyBadge(document.getElementById('statusBadge'), state.status, state.paused);
        markDirty('project');
        apiFetch('/projects/' + projectId, { method: 'PATCH', body: JSON.stringify({ status: 'In Progress' }) }).catch(function () {});
        var sd = document.getElementById('startDate');
        if (sd.textContent === '—') sd.textContent = new Date().toLocaleDateString();
      }
      try {
        await apiFetch('/phases/' + ph.id, { method: 'PATCH', body: JSON.stringify({ status: ph.status }) });
      } catch (err) { showAlert(err.message); }
    });
    pacts.appendChild(sel); hd.appendChild(pacts);
    card.appendChild(hd);

    // Tasks
    var ts = document.createElement('div'); ts.className = 'tksec';
    var th = document.createElement('div'); th.className = 'tkh';
    var tl = document.createElement('span'); tl.className = 'tklbl'; tl.id = 'ptl' + ph.id;
    tl.textContent = 'Tasks (' + dn + '/' + tot + ')';
    var ab = document.createElement('button'); ab.className = 'addbtn';
    ab.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Task';
    ab.addEventListener('click', function () { addTask(ph.id); });
    th.appendChild(tl); th.appendChild(ab); ts.appendChild(th);
    var tlist = document.createElement('div'); tlist.id = 'tl' + ph.id;
    ph.tasks.forEach(function (t) { tlist.appendChild(mkRow(t, ph.id)); });
    ts.appendChild(tlist); card.appendChild(ts);

    new Sortable(tlist, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: async function () {
        var ids = Array.from(tlist.querySelectorAll('[data-task-id]')).map(function (el) { return parseInt(el.dataset.taskId); });
        var phObj = state.phases.find(function (p) { return p.id === ph.id; });
        if (phObj) phObj.tasks.sort(function (a, b) { return ids.indexOf(a.id) - ids.indexOf(b.id); });
        try {
          await apiFetch('/tasks/reorder', { method: 'POST', body: JSON.stringify({ ids: ids }) });
        } catch (err) { showAlert(err.message); }
      }
    });

    // Deliverables
    var ds = document.createElement('div'); ds.className = 'delsec';
    var dl = document.createElement('div'); dl.className = 'dellbl'; dl.textContent = 'Deliverables'; ds.appendChild(dl);
    var dw = document.createElement('div'); dw.className = 'deltags'; dw.id = 'dels' + ph.id;
    ph.deliverables.forEach(function (d) { dw.appendChild(mkDelTag(d, ph.id)); });
    ds.appendChild(dw);
    // Add deliverable
    var da = document.createElement('div'); da.className = 'del-add';
    var dinput = document.createElement('input'); dinput.placeholder = 'Add deliverable…';
    var dadd = document.createElement('button'); dadd.className = 'addbtn'; dadd.textContent = '+ Add';
    dadd.addEventListener('click', function () { addDeliverable(ph.id, dinput); });
    dinput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addDeliverable(ph.id, dinput); } });
    da.appendChild(dinput); da.appendChild(dadd); ds.appendChild(da);
    card.appendChild(ds);

    // Hardware
    var hs = document.createElement('div'); hs.className = 'hwsec';
    var hl = document.createElement('div'); hl.className = 'hwlbl'; hl.textContent = 'Hardware'; hs.appendChild(hl);
    var hw = document.createElement('div'); hw.className = 'hwtags'; hw.id = 'hws' + ph.id;
    (ph.hardware || []).forEach(function (h) { hw.appendChild(mkHwTag(h, ph.id)); });
    hs.appendChild(hw);
    // Add hardware
    var ha = document.createElement('div'); ha.className = 'del-add';
    var hinput = document.createElement('input'); hinput.placeholder = 'Add hardware item…';
    var hadd = document.createElement('button'); hadd.className = 'addbtn'; hadd.textContent = '+ Add';
    hadd.addEventListener('click', function () { addHardware(ph.id, hinput); });
    hinput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addHardware(ph.id, hinput); } });
    ha.appendChild(hinput); ha.appendChild(hadd); hs.appendChild(ha);
    card.appendChild(hs);

    // Notes
    var ns = document.createElement('div'); ns.className = 'notesec';
    var nl = document.createElement('div'); nl.className = 'notelbl'; nl.textContent = 'Phase Notes'; ns.appendChild(nl);
    var nt = document.createElement('textarea'); nt.className = 'noteta'; nt.rows = 2;
    nt.placeholder = 'Add notes, blockers, or context…'; nt.value = ph.notes || '';
    nt.addEventListener('change', function () { ph.notes = this.value; markDirty('phase:' + ph.id); savePhase(ph); });
    ns.appendChild(nt); card.appendChild(ns);

    return card;
  }

  function mkDelTag(del, phaseId) {
    var span = document.createElement('span'); span.className = 'deltag'; span.id = 'del' + del.id;
    span.textContent = del.label;
    var x = document.createElement('span'); x.className = 'deltag-del'; x.textContent = '×';
    x.addEventListener('click', async function () {
      try {
        await apiFetch('/deliverables/' + del.id, { method: 'DELETE' });
        var ph = state.phases.find(function (p) { return p.id === phaseId; });
        if (ph) ph.deliverables = ph.deliverables.filter(function (d) { return d.id !== del.id; });
        var el = document.getElementById('del' + del.id); if (el) el.parentNode.removeChild(el);
      } catch (err) { showAlert(err.message); }
    });
    span.appendChild(x);
    return span;
  }

  async function addDeliverable(phaseId, input) {
    var label = input.value.trim();
    if (!label) return;
    try {
      var del = await apiFetch('/deliverables', { method: 'POST', body: JSON.stringify({ phase_id: phaseId, label: label }) });
      var ph = state.phases.find(function (p) { return p.id === phaseId; });
      if (ph) ph.deliverables.push(del);
      var dw = document.getElementById('dels' + phaseId); if (dw) dw.appendChild(mkDelTag(del, phaseId));
      input.value = '';
    } catch (err) { showAlert(err.message); }
  }

  function mkHwTag(hw, phaseId) {
    var span = document.createElement('span');
    span.className = 'hwtag' + (hw.delivered ? ' hwtag-done' : '');
    span.id = 'hw' + hw.id;
    var lbl = document.createElement('span'); lbl.className = 'hwtag-lbl'; lbl.textContent = hw.label;
    var dbtn = document.createElement('button'); dbtn.className = 'hwtag-deliver'; dbtn.textContent = hw.delivered ? 'Delivered' : 'Deliver';
    dbtn.addEventListener('click', async function () {
      try {
        var updated = await apiFetch('/hardware/' + hw.id + '/delivered', { method: 'PATCH' });
        hw.delivered = updated.delivered;
        span.className = 'hwtag' + (hw.delivered ? ' hwtag-done' : '');
        dbtn.textContent = hw.delivered ? 'Delivered' : 'Deliver';
      } catch (err) { showAlert(err.message); }
    });
    var x = document.createElement('span'); x.className = 'deltag-del'; x.textContent = '×';
    x.addEventListener('click', async function () {
      try {
        await apiFetch('/hardware/' + hw.id, { method: 'DELETE' });
        var ph = state.phases.find(function (p) { return p.id === phaseId; });
        if (ph) ph.hardware = ph.hardware.filter(function (h) { return h.id !== hw.id; });
        var el = document.getElementById('hw' + hw.id); if (el) el.parentNode.removeChild(el);
      } catch (err) { showAlert(err.message); }
    });
    span.appendChild(lbl); span.appendChild(dbtn); span.appendChild(x);
    return span;
  }

  async function addHardware(phaseId, input) {
    var label = input.value.trim();
    if (!label) return;
    try {
      var item = await apiFetch('/hardware', { method: 'POST', body: JSON.stringify({ phase_id: phaseId, label: label }) });
      var ph = state.phases.find(function (p) { return p.id === phaseId; });
      if (ph) { if (!ph.hardware) ph.hardware = []; ph.hardware.push(item); }
      var hw = document.getElementById('hws' + phaseId); if (hw) hw.appendChild(mkHwTag(item, phaseId));
      input.value = '';
    } catch (err) { showAlert(err.message); }
  }

  async function addTask(phaseId) {
    var nm = prompt('Task name:'); if (!nm || !nm.trim()) return;
    try {
      var task = await apiFetch('/tasks', { method: 'POST', body: JSON.stringify({ phase_id: phaseId, name: nm.trim() }) });
      var ph = state.phases.find(function (p) { return p.id === phaseId; });
      if (ph) ph.tasks.push(task);
      var tlist = document.getElementById('tl' + phaseId); if (tlist) tlist.appendChild(mkRow(task, phaseId));
      updPhStats(phaseId);
      renderBoard();
    } catch (err) { showAlert(err.message); }
  }

  async function addPhase() {
    var nm = prompt('Phase name:'); if (!nm || !nm.trim()) return;
    var colorClass = 'p' + ((state.phases.length % 4) + 1);
    try {
      var phase = await apiFetch('/phases', { method: 'POST', body: JSON.stringify({ project_id: projectId, name: nm.trim(), color_class: colorClass }) });
      phase.tasks = []; phase.deliverables = []; phase.hardware = [];
      state.phases.push(phase);
      document.getElementById('phasesEl').appendChild(mkCard(phase, state.phases.length - 1));
      renderTL();
      updateStats();
    } catch (err) { showAlert(err.message); }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  function renderPhases() {
    var el = document.getElementById('phasesEl'); el.innerHTML = '';
    state.phases.forEach(function (ph, i) { el.appendChild(mkCard(ph, i)); });

    new Sortable(el, {
      handle: '.phd',
      animation: 150,
      onEnd: async function () {
        var ids = Array.from(el.querySelectorAll('[data-phase-id]')).map(function (c) { return parseInt(c.dataset.phaseId); });
        state.phases.sort(function (a, b) { return ids.indexOf(a.id) - ids.indexOf(b.id); });
        updateStats();
        renderTL();
        try {
          await apiFetch('/phases/reorder', { method: 'POST', body: JSON.stringify({ ids: ids }) });
        } catch (err) { showAlert(err.message); }
      }
    });
  }

  function allBoardTasks() {
    var tasks = [];
    state.phases.forEach(function (ph) {
      ph.tasks.forEach(function (task) {
        // Older API responses remain usable during a rolling upgrade.
        if (!task.board_status) task.board_status = task.done ? 'done' : 'backlog';
        tasks.push({ task: task, phase: ph });
      });
    });
    return tasks;
  }

  function boardCard(item) {
    var task = item.task;
    var card = document.createElement('div');
    card.className = 'board-card';
    card.dataset.taskId = task.id;

    var title = document.createElement('div');
    title.className = 'board-card-title';
    title.textContent = task.name;
    card.appendChild(title);

    var meta = document.createElement('div');
    meta.className = 'board-card-meta';
    var dot = document.createElement('span');
    dot.className = 'board-priority p' + (task.priority || 'm');
    dot.title = ({ h: 'High priority', m: 'Medium priority', l: 'Low priority' })[task.priority] || 'Medium priority';
    meta.appendChild(dot);
    var phase = document.createElement('span');
    phase.className = 'board-phase';
    phase.textContent = item.phase.name;
    meta.appendChild(phase);
    if (task.assignee) {
      var assignee = document.createElement('span');
      assignee.textContent = '· ' + task.assignee;
      meta.appendChild(assignee);
    }
    if (task.due_date) {
      var due = document.createElement('span');
      due.textContent = '· ' + new Date(task.due_date.slice(0, 10) + 'T00:00:00').toLocaleDateString();
      meta.appendChild(due);
    }
    var elapsed = document.createElement('span');
    elapsed.className = 'board-actual';
    elapsed.dataset.taskId = task.id;
    elapsed.textContent = '· ' + formatDuration(taskActualSeconds(task)) + (task.timer_started_at ? ' running' : ' actual');
    meta.appendChild(elapsed);
    card.appendChild(meta);
    return card;
  }

  function boardPayload() {
    var lanes = {};
    BOARD_LANES.forEach(function (lane) {
      var list = document.querySelector('.board-list[data-status="' + lane.id + '"]');
      lanes[lane.id] = Array.from(list.querySelectorAll('.board-card')).map(function (card) {
        return parseInt(card.dataset.taskId);
      });
    });
    return lanes;
  }

  async function saveBoardOrder() {
    var lanes = boardPayload();
    var previous = {};
    allBoardTasks().forEach(function (item) { previous[item.task.id] = item.task.board_status; });
    BOARD_LANES.forEach(function (lane) {
      lanes[lane.id].forEach(function (id, position) {
        var item = allBoardTasks().find(function (entry) { return entry.task.id === id; });
        if (item) {
          item.task.board_status = lane.id;
          item.task.board_position = position;
          item.task.done = lane.id === 'done';
        }
      });
    });
    updateStats();
    try {
      var result = await apiFetch('/tasks/board/reorder', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, lanes: lanes })
      });
      (result.tasks || []).forEach(function (updated) {
        var item = allBoardTasks().find(function (entry) { return entry.task.id === updated.id; });
        if (item) Object.assign(item.task, updated);
      });
      flashSaved();
      renderBoard();
    } catch (err) {
      allBoardTasks().forEach(function (item) {
        item.task.board_status = previous[item.task.id];
        item.task.done = previous[item.task.id] === 'done';
      });
      renderBoard();
      showAlert('Card move failed: ' + err.message);
    }
  }

  function renderBoard() {
    if (!state) return;
    var board = document.getElementById('boardView');
    board.innerHTML = '';
    var tasks = allBoardTasks();
    BOARD_LANES.forEach(function (lane) {
      var column = document.createElement('section'); column.className = 'board-lane';
      var header = document.createElement('div'); header.className = 'board-lane-hd';
      var label = document.createElement('span'); label.textContent = lane.label; header.appendChild(label);
      var laneTasks = tasks.filter(function (item) { return item.task.board_status === lane.id; })
        .sort(function (a, b) { return (parseInt(a.task.board_position) || 0) - (parseInt(b.task.board_position) || 0); });
      var count = document.createElement('span'); count.className = 'board-count'; count.textContent = laneTasks.length; header.appendChild(count);
      column.appendChild(header);
      var list = document.createElement('div'); list.className = 'board-list'; list.dataset.status = lane.id;
      laneTasks.forEach(function (item) { list.appendChild(boardCard(item)); });
      if (!laneTasks.length) {
        var empty = document.createElement('div'); empty.className = 'board-empty'; empty.textContent = 'Drop tasks here'; list.appendChild(empty);
      }
      column.appendChild(list); board.appendChild(column);
      new Sortable(list, {
        group: 'project-board', animation: 150, draggable: '.board-card',
        ghostClass: 'sortable-ghost', onEnd: saveBoardOrder
      });
    });
    clearInterval(boardClock);
    boardClock = setInterval(function () {
      allBoardTasks().forEach(function (item) {
        if (!item.task.timer_started_at) return;
        var elapsed = board.querySelector('.board-actual[data-task-id="' + item.task.id + '"]');
        if (elapsed) elapsed.textContent = '· ' + formatDuration(taskActualSeconds(item.task)) + ' running';
      });
    }, 1000);
  }

  function selectView(view) {
    var boardSelected = view === 'board';
    document.getElementById('planView').style.display = boardSelected ? 'none' : '';
    document.getElementById('boardView').style.display = boardSelected ? 'grid' : 'none';
    document.getElementById('planViewBtn').classList.toggle('active', !boardSelected);
    document.getElementById('boardViewBtn').classList.toggle('active', boardSelected);
    document.getElementById('planViewBtn').setAttribute('aria-selected', String(!boardSelected));
    document.getElementById('boardViewBtn').setAttribute('aria-selected', String(boardSelected));
    if (boardSelected) renderBoard(); else renderPhases();
    localStorage.setItem('projectView', view);
  }

  function renderTL() {
    var el = document.getElementById('tlEl'); el.innerHTML = '';
    state.phases.forEach(function (ph, i) {
      var tlsCls = tlsColors[i % 4];
      var cell = document.createElement('div'); cell.className = 'tlcell ' + tlsCls;
      var lb = document.createElement('div'); lb.className = 'tlph'; lb.textContent = 'Phase ' + (i + 1); cell.appendChild(lb);
      var nm = document.createElement('div'); nm.className = 'tlnm'; nm.textContent = ph.name; cell.appendChild(nm);
      var rw = document.createElement('div'); rw.className = 'tlrng';
      var ri = document.createElement('input'); ri.className = 'editable'; ri.value = ph.duration || '';
      ri.style.cssText = 'font-size:var(--xs);width:100%';
      ri.addEventListener('change', function () { ph.duration = this.value; markDirty('phase:' + ph.id); savePhase(ph); });
      rw.appendChild(ri); cell.appendChild(rw);
      var bar = document.createElement('div'); bar.className = 'tlbar'; cell.appendChild(bar);
      el.appendChild(cell);
    });
  }

  var STATUS_CYCLE = { 'New': 'In Progress', 'In Progress': 'Complete', 'Complete': 'New' };
  var STATUS_MAP   = { 'New': ['New','b-new'], 'In Progress': ['In Progress','b-act'], 'Complete': ['Complete','b-done'] };

  function applyBadge(badge, status, paused) {
    if (paused) {
      badge.textContent = 'Paused';
      badge.className = 'badge b-pause';
      badge.title = 'Uncheck "Paused" to change status';
    } else {
      var sm = STATUS_MAP[status] || STATUS_MAP['New'];
      badge.textContent = sm[0];
      badge.className = 'badge ' + sm[1] + ' badge-cycle';
      badge.title = 'Click to change status';
    }
  }

  // ── Auto-save helpers ──────────────────────────────────────────────────
  var saveStatusEl = document.getElementById('saveStatus');
  var saveStatusTimer = null;
  function flashSaved() {
    clearTimeout(saveStatusTimer);
    saveStatusEl.textContent = 'Saved';
    saveStatusEl.style.opacity = '1';
    saveStatusTimer = setTimeout(function () { saveStatusEl.style.opacity = '0'; }, 1500);
  }

  async function saveProjectFields() {
    var prEl = document.getElementById('pauseReason');
    if (state.paused && !prEl.value.trim()) {
      prEl.style.borderColor = 'var(--err)';
      prEl.focus();
      return;
    }
    try {
      await apiFetch('/projects/' + projectId, {
        method: 'PATCH',
        body: JSON.stringify({
          title: document.getElementById('projTitle').value,
          description: document.getElementById('projDesc').value,
          client: document.getElementById('projClient').value,
          team_size: parseInt(document.getElementById('teamSize').value) || 1,
          team_lead_id: document.getElementById('projLead').value || null,
          status: state.status,
          paused: state.paused,
          pause_reason: prEl.value
        })
      });
      dirty.delete('project');
      flashSaved();
    } catch (err) { showAlert('Auto-save failed: ' + err.message); }
  }

  async function savePhase(ph) {
    try {
      await apiFetch('/phases/' + ph.id, {
        method: 'PATCH',
        body: JSON.stringify({ name: ph.name, subtitle: ph.subtitle, duration: ph.duration, notes: ph.notes })
      });
      dirty.delete('phase:' + ph.id);
      flashSaved();
    } catch (err) { showAlert('Auto-save failed: ' + err.message); }
  }

  async function saveTask(task) {
    try {
      var payload = { name: task.name, assignee: task.assignee, due_date: task.due_date || '', priority: task.priority, expected_hours: task.expected_hours };
      if (!task.timer_started_at) payload.actual_seconds = parseInt(task.actual_seconds, 10) || 0;
      await apiFetch('/tasks/' + task.id, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      dirty.delete('task:' + task.id);
      flashSaved();
    } catch (err) { showAlert('Auto-save failed: ' + err.message); }
  }

  function hydrateHeader() {
    document.title = (state.title || 'Project') + ' — ProjectPlan';
    document.getElementById('projTitle').value = state.title || '';
    document.getElementById('projDesc').value = state.description || '';
    document.getElementById('teamSize').value = state.team_size || 1;
    var projLeadSel = document.getElementById('projLead');
    projLeadSel.value = state.team_lead_id ? String(state.team_lead_id) : '';
    if (projLeadSel.selectedIndex === -1) projLeadSel.value = '';

    var badge = document.getElementById('statusBadge');
    applyBadge(badge, state.status, state.paused);

    if (state.created_at) {
      document.getElementById('startDate').textContent = new Date(state.created_at).toLocaleDateString();
    }

    // Paused checkbox
    var pausedCheck = document.getElementById('pausedCheck');
    var pauseReason = document.getElementById('pauseReason');
    pausedCheck.checked = !!state.paused;
    pauseReason.value = state.pause_reason || '';
    pauseReason.style.display = state.paused ? '' : 'none';

    pausedCheck.addEventListener('change', async function () {
      state.paused = pausedCheck.checked;
      pauseReason.style.display = state.paused ? '' : 'none';
      applyBadge(badge, state.status, state.paused);
      if (state.paused) {
        pauseReason.focus();
      } else {
        state.pause_reason = '';
        pauseReason.value = '';
        markDirty('project');
        await saveProjectFields();
      }
    });

    pauseReason.addEventListener('input', function () {
      state.pause_reason = pauseReason.value;
      if (pauseReason.value.trim()) pauseReason.style.borderColor = '';
    });
    pauseReason.addEventListener('blur', function () {
      state.pause_reason = pauseReason.value;
      if (pauseReason.value.trim()) pauseReason.style.borderColor = '';
      markDirty('project');
      saveProjectFields();
    });

    // Badge click cycles status (disabled while paused)
    badge.addEventListener('click', async function () {
      if (state.paused) return;
      state.status = STATUS_CYCLE[state.status] || 'New';
      applyBadge(badge, state.status, false);
      markDirty('project');
      try {
        await apiFetch('/projects/' + projectId, { method: 'PATCH', body: JSON.stringify({ status: state.status }) });
        flashSaved();
      } catch (err) { showAlert(err.message); }
    });

    ['projTitle','projDesc','teamSize'].forEach(function (id) {
      document.getElementById(id).addEventListener('blur', function () {
        markDirty('project');
        saveProjectFields();
      });
    });
    ['projClient','projLead'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', function () {
        markDirty('project');
        saveProjectFields();
      });
    });
  }

  // ── Save ───────────────────────────────────────────────────────────────
  document.getElementById('saveBtn').addEventListener('click', async function () {
    var btn = this;
    var pauseReason = document.getElementById('pauseReason');
    if (state.paused && !pauseReason.value.trim()) {
      pauseReason.style.borderColor = 'var(--err)';
      pauseReason.focus();
      return;
    }
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      var calls = [];
      if (dirty.has('project')) {
        calls.push(apiFetch('/projects/' + projectId, {
          method: 'PATCH',
          body: JSON.stringify({
            title: document.getElementById('projTitle').value,
            description: document.getElementById('projDesc').value,
            client: document.getElementById('projClient').value,
            team_size: parseInt(document.getElementById('teamSize').value) || 1,
            team_lead_id: document.getElementById('projLead').value || null,
            status: state.status,
            paused: state.paused,
            pause_reason: document.getElementById('pauseReason').value
          })
        }));
      }
      dirty.forEach(function (key) {
        if (key.startsWith('phase:')) {
          var phId = parseInt(key.slice(6));
          var ph = state.phases.find(function (p) { return p.id === phId; });
          if (ph) calls.push(apiFetch('/phases/' + phId, {
            method: 'PATCH',
            body: JSON.stringify({ name: ph.name, subtitle: ph.subtitle, duration: ph.duration, notes: ph.notes })
          }));
        }
        if (key.startsWith('task:')) {
          var tId = parseInt(key.slice(5));
          var task = null;
          state.phases.forEach(function (p) { p.tasks.forEach(function (t) { if (t.id === tId) task = t; }); });
          if (task) calls.push(apiFetch('/tasks/' + tId, {
            method: 'PATCH',
            body: JSON.stringify(Object.assign(
              { name: task.name, assignee: task.assignee, due_date: task.due_date || '', priority: task.priority, expected_hours: task.expected_hours },
              task.timer_started_at ? {} : { actual_seconds: parseInt(task.actual_seconds, 10) || 0 }
            ))
          }));
        }
      });
      await Promise.all(calls);
      dirty.clear();
      showAlert('Saved successfully', 'ok');
    } catch (err) {
      showAlert('Save failed: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save';
    }
  });

  document.getElementById('addPhaseBtn').addEventListener('click', addPhase);
  document.getElementById('planViewBtn').addEventListener('click', function () { selectView('plan'); });
  document.getElementById('boardViewBtn').addEventListener('click', function () { selectView('board'); });

  // ── Export ─────────────────────────────────────────────────────────────
  document.getElementById('expBtn').addEventListener('click', function () {
    var dat = {
      project: {
        title: state.title, description: state.description, client: state.client,
        team_size: state.team_size, team_lead: userMap[state.team_lead_id] || '',
        status: state.status, priority: state.priority, due_date: state.due_date,
        paused: state.paused, pause_reason: state.pause_reason
      },
      phases: state.phases,
      links: (state.links || []).map(function (l) { return { label: l.label, url: l.url }; })
    };
    var blob = new Blob([JSON.stringify(dat, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = (state.title || 'project-plan').toLowerCase().replace(/\s+/g, '-') + '.json'; a.click();
  });

  // ── Save as Template ──────────────────────────────────────────────────
  var templateModalBackdrop = document.getElementById('templateModalBackdrop');
  var templateNameInput = document.getElementById('templateNameInput');
  var templateModalSaveBtn = document.getElementById('templateModalSave');

  function openTemplateModal() {
    templateNameInput.value = '';
    templateModalBackdrop.style.display = 'flex';
    templateNameInput.focus();
  }
  function closeTemplateModal() {
    templateModalBackdrop.style.display = 'none';
  }

  document.getElementById('saveTemplateBtn').addEventListener('click', openTemplateModal);
  document.getElementById('templateModalClose').addEventListener('click', closeTemplateModal);
  document.getElementById('templateModalCancel').addEventListener('click', closeTemplateModal);
  templateModalBackdrop.addEventListener('click', function (e) {
    if (e.target === templateModalBackdrop) closeTemplateModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && templateModalBackdrop.style.display !== 'none') closeTemplateModal();
  });
  templateNameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') templateModalSaveBtn.click();
  });

  templateModalSaveBtn.addEventListener('click', async function () {
    var name = templateNameInput.value.trim();
    if (!name) { templateNameInput.focus(); return; }
    templateModalSaveBtn.disabled = true;
    try {
      var definition = (state.phases || []).map(function (ph, pi) {
        return {
          position: pi, name: ph.name, subtitle: ph.subtitle, duration: ph.duration, color_class: ph.color_class,
          tasks: (ph.tasks || []).map(function (t, ti) { return { position: ti, name: t.name, priority: t.priority }; }),
          deliverables: (ph.deliverables || []).map(function (d) { return d.label; })
        };
      });
      await apiFetch('/templates', { method: 'POST', body: JSON.stringify({ name: name, definition: definition }) });
      closeTemplateModal();
      showAlert('Template "' + name + '" saved.', 'ok');
    } catch (err) {
      showAlert(err.message);
    } finally {
      templateModalSaveBtn.disabled = false;
    }
  });

  // ── Load ───────────────────────────────────────────────────────────────
  async function loadProject() {
    try {
      state = await apiFetch('/projects/' + projectId);
      hydrateHeader();
      await loadCompanies();
      renderPhases();
      renderTL();
      renderBoard();
      updateStats();
      selectView(localStorage.getItem('projectView') === 'board' ? 'board' : 'plan');
    } catch (err) {
      showAlert('Failed to load project: ' + err.message);
    }
  }

  loadUsers().then(loadProject);
})();
