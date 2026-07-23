(function () {
  if (!requireAuth()) return;

  var user = getUser();
  if (user) document.getElementById('userName').textContent = user.name;

  document.getElementById('signOutLink').addEventListener('click', function (e) {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
  });

  var alertEl = document.getElementById('alertEl');
  function showAlert(msg, type) {
    var div = document.createElement('div');
    div.className = 'alert alert-' + (type || 'err');
    div.textContent = msg;
    alertEl.innerHTML = '';
    alertEl.appendChild(div);
    if (type === 'ok') setTimeout(function () { alertEl.innerHTML = ''; }, 3000);
  }

  var STATUS_CYCLE = { 'New': 'In Progress', 'In Progress': 'Complete', 'Complete': 'New' };
  function statusClass(s) {
    if (s === 'In Progress') return 'b-act';
    if (s === 'Complete') return 'b-done';
    if (s === 'Paused') return 'b-pause';
    return 'b-new';
  }
  function statusIcon(cls) {
    if (cls === 'b-act') return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    if (cls === 'b-done') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
    if (cls === 'b-pause') return '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
    return '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="7"/></svg>';
  }

  var SHOW_COMPLETED_KEY = 'pp_showCompleted';
  var showCompletedToggle = document.getElementById('showCompletedToggle');
  showCompletedToggle.checked = localStorage.getItem(SHOW_COMPLETED_KEY) !== '0';
  showCompletedToggle.addEventListener('change', function () {
    localStorage.setItem(SHOW_COMPLETED_KEY, showCompletedToggle.checked ? '1' : '0');
    renderProjects(lastProjects);
  });

  var VIEW_SCOPE_KEY = 'pp_viewScope';
  var myProjectsToggle = document.getElementById('myProjectsToggle');
  myProjectsToggle.checked = localStorage.getItem(VIEW_SCOPE_KEY) === 'mine';
  myProjectsToggle.addEventListener('change', function () {
    localStorage.setItem(VIEW_SCOPE_KEY, myProjectsToggle.checked ? 'mine' : 'all');
    renderProjects(lastProjects);
  });

  // Menus are position:fixed (see shared.css) so they can escape the
  // clipping of ancestors like .proj-card, which needs overflow:hidden for
  // its own corner accents. Since that decouples them from their trigger
  // button, we position them by hand here at open-time.
  function closeAllMenus() {
    document.querySelectorAll('.proj-menu-drop.open').forEach(function (d) { d.classList.remove('open'); });
  }

  function openMenu(btn, drop) {
    closeAllMenus();
    drop.style.visibility = 'hidden';
    drop.classList.add('open');
    var btnRect = btn.getBoundingClientRect();
    var dropRect = drop.getBoundingClientRect();
    var left = Math.min(btnRect.right - dropRect.width, window.innerWidth - dropRect.width - 8);
    left = Math.max(8, left);
    var top = btnRect.bottom + 4;
    if (top + dropRect.height > window.innerHeight - 8) {
      top = btnRect.top - dropRect.height - 4;
    }
    drop.style.left = left + 'px';
    drop.style.top = top + 'px';
    drop.style.visibility = '';
  }

  function toggleMenu(btn, drop) {
    var wasOpen = drop.classList.contains('open');
    closeAllMenus();
    if (!wasOpen) openMenu(btn, drop);
  }

  // A fixed-position menu goes stale relative to its button on scroll, so
  // just close it rather than track the button around.
  window.addEventListener('scroll', closeAllMenus, true);
  window.addEventListener('resize', closeAllMenus);

  var lastProjects = [];
  var NO_GROUP_KEY = '￿__none__';

  // Groups items by a key derived from getKey(item); items with a blank key
  // sort to the end instead of alphabetically, per name-of-the-group ordering.
  function groupBy(items, getKey) {
    var map = {};
    var order = [];
    items.forEach(function (item) {
      var name = (getKey(item) || '').trim();
      var key = name || NO_GROUP_KEY;
      if (!map[key]) { map[key] = { name: name, items: [] }; order.push(key); }
      map[key].items.push(item);
    });
    var named = order.filter(function (k) { return k !== NO_GROUP_KEY; });
    named.sort(function (a, b) { return map[a].name.localeCompare(map[b].name, undefined, { sensitivity: 'base' }); });
    if (map[NO_GROUP_KEY]) named.push(NO_GROUP_KEY);
    return named.map(function (k) { return map[k]; });
  }

  function hueFromString(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
    return Math.abs(h) % 360;
  }

  function cardHtml(p) {
    var total = parseInt(p.task_total) || 0;
    var done = parseInt(p.task_done) || 0;
    var pct = total > 0 ? Math.round(done / total * 100) : 0;
    var estHrs = parseFloat(p.est_hours) || 0;
    var paused = !!p.paused;
    var displayStatus = paused ? 'Paused' : p.status;
    var statCls = statusClass(displayStatus);
    var chipCls = 'stat-' + statCls.slice(2);
    var badgeCls = 'stat-badge ' + chipCls + (paused ? '' : ' badge-cycle');
    var badgeTitle = escHtml(displayStatus) + (paused ? ' — go to project to unpause' : ' — click to change status');
    var pmHue = p.team_lead_name ? hueFromString(p.team_lead_name) : null;
    var coHue = p.client ? hueFromString(p.client) : null;
    var bandCls = (pmHue !== null ? ' band-pm' : '') + (coHue !== null ? ' band-co' : '');
    var bandStyle = (pmHue !== null ? '--pm-h:' + pmHue + ';' : '') + (coHue !== null ? '--co-h:' + coHue + ';' : '');
    return '<div class="proj-card ' + chipCls + bandCls + '" data-id="' + p.id + '" style="' + bandStyle + '">' +
      '<div class="proj-card-hd">' +
        '<div class="proj-info">' +
          '<div class="proj-title">' + escHtml(p.title) + '</div>' +
          (p.client ? '<div class="proj-client">' + escHtml(p.client) + '</div>' : '') +
          (p.team_lead_name ? '<div class="proj-pm">PM: ' + escHtml(p.team_lead_name) + '</div>' : '') +
        '</div>' +
        '<span class="' + badgeCls + '" data-badge-id="' + p.id + '" data-status="' + escHtml(p.status) + '" data-paused="' + paused + '" title="' + badgeTitle + '" aria-label="' + escHtml(displayStatus) + '">' + statusIcon(statCls) + '</span>' +
      '</div>' +
      '<div class="pbar-wrap"><div class="pbar" style="width:' + pct + '%"></div></div>' +
      '<div class="proj-stats">' +
        '<span>' + pct + '% complete</span>' +
        '<span>' + done + ' / ' + total + ' tasks</span>' +
        (estHrs > 0 ? '<span>~' + estHrs + 'h est</span>' : '') +
      '</div>' +
      (paused && p.pause_reason ? '<div class="proj-pause-note" style="font-size:var(--xs);color:var(--txtm);padding:var(--s2) 0;border-top:1px solid var(--div)"><span style="font-weight:600;text-transform:uppercase;letter-spacing:.07em">Paused: </span>' + escHtml(p.pause_reason) + '</div>' : '') +
      '<div class="proj-card-ft">' +
        '<a href="/project.html?id=' + p.id + '" class="btn btn-g" style="font-size:var(--xs);padding:var(--s1) var(--s3)">Open →</a>' +
        '<div class="proj-menu">' +
          '<button class="proj-menu-btn" data-menu="' + p.id + '" aria-label="Project menu">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>' +
          '</button>' +
          '<div class="proj-menu-drop" id="menu-' + p.id + '">' +
            '<button class="proj-menu-item danger" data-del="' + p.id + '" data-title="' + escHtml(p.title) + '">Delete</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderProjects(projects) {
    lastProjects = projects;
    var grid = document.getElementById('projGrid');
    if (!projects.length) {
      grid.style.removeProperty('--pm-cols');
      grid.innerHTML = '<div class="empty-state"><h2>No projects yet</h2><p>Create your first project to get started.</p></div>';
      return;
    }

    var showCompleted = showCompletedToggle.checked;
    var myProjectsOnly = myProjectsToggle.checked;
    var currentUserId = user && user.id;
    var visible = projects.filter(function (p) {
      var displayStatus = p.paused ? 'Paused' : p.status;
      if (!showCompleted && displayStatus === 'Complete') return false;
      if (myProjectsOnly && p.team_lead_id && String(p.team_lead_id) !== String(currentUserId)) return false;
      return true;
    });
    if (!visible.length) {
      grid.style.removeProperty('--pm-cols');
      grid.innerHTML = '<div class="empty-state"><h2>No projects to show</h2><p>Try toggling “Show completed” or “Mine + No PM only” above.</p></div>';
      return;
    }

    var pmGroups = groupBy(visible, function (p) { return p.team_lead_name; });
    grid.style.setProperty('--pm-cols', pmGroups.length);
    grid.innerHTML = pmGroups.map(function (pmGrp) {
      var clientGroups = groupBy(pmGrp.items, function (p) { return p.client; });
      return '<div class="pm-col">' +
        '<div class="pm-col-hd"><span class="pm-col-name">' + escHtml(pmGrp.name || 'No PM') + '</span><span class="pm-col-count">' + pmGrp.items.length + '</span></div>' +
        clientGroups.map(function (clientGrp) {
          return '<div class="pm-client-grp">' +
            (clientGrp.name ? '<div class="pm-client-hd">' + escHtml(clientGrp.name) + '</div>' : '') +
            clientGrp.items.map(cardHtml).join('') +
          '</div>';
        }).join('') +
      '</div>';
    }).join('');

    // Open project on card click (not on menu)
    grid.querySelectorAll('.proj-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.proj-menu')) return;
        window.location.href = '/project.html?id=' + card.dataset.id;
      });
    });

    // Menu toggle
    grid.querySelectorAll('[data-menu]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var drop = document.getElementById('menu-' + btn.dataset.menu);
        toggleMenu(btn, drop);
      });
    });

    // Delete
    grid.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        e.stopPropagation();
        if (!confirm('Delete project "' + btn.dataset.title + '"? This cannot be undone.')) return;
        try {
          await apiFetch('/projects/' + btn.dataset.del, { method: 'DELETE' });
          loadProjects();
        } catch (err) {
          showAlert(err.message);
        }
      });
    });

    // Badge click — cycle status (skip if paused)
    grid.querySelectorAll('[data-badge-id]').forEach(function (badge) {
      badge.addEventListener('click', async function (e) {
        e.stopPropagation();
        if (badge.dataset.paused === 'true') return;
        var id = badge.dataset.badgeId;
        var next = STATUS_CYCLE[badge.dataset.status] || 'New';
        try {
          await apiFetch('/projects/' + id, { method: 'PATCH', body: JSON.stringify({ status: next }) });
          var proj = lastProjects.find(function (p) { return String(p.id) === String(id); });
          if (proj) proj.status = next;
          renderProjects(lastProjects);
        } catch (err) {
          showAlert(err.message);
          loadProjects();
        }
      });
    });

  }

  // Close menus on outside click
  document.addEventListener('click', closeAllMenus);

  async function loadProjects() {
    try {
      var projects = await apiFetch('/projects');
      renderProjects(projects);
    } catch (err) {
      showAlert(err.message);
    }
  }

  // ── Markdown import ────────────────────────────────────────────────────
  // Turns a ProjectPlan markdown outline (see PROJECT_TEMPLATE.md) into the
  // { title, phases } shape the /projects/import metadata modal fills the
  // rest of. Recognized per-phase sections: Goal → subtitle, Tasks →
  // tasks[], Deliverables → deliverables[]; any other heading is folded
  // into notes so nothing in the source file is silently dropped.
  function parseMarkdownProject(text) {
    var lines = text.replace(/\r\n/g, '\n').split('\n');
    var title = null;
    var phaseBlocks = [];
    var current = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^-{3,}\s*$/.test(line.trim())) continue; // markdown "---" separator

      var h1 = line.match(/^#\s+(.+)$/);
      var h2 = line.match(/^##\s+(.+)$/);
      var h3 = line.match(/^###\s+(.+)$/);

      if (h1 && title === null) {
        title = h1[1].replace(/^Project:\s*/i, '').trim();
        continue;
      }
      if (h2) {
        current = { heading: h2[1].trim(), sections: [] };
        phaseBlocks.push(current);
        continue;
      }
      if (h3 && current) {
        current.sections.push({ heading: h3[1].trim(), lines: [] });
        continue;
      }
      if (current && current.sections.length) {
        current.sections[current.sections.length - 1].lines.push(line);
      }
    }

    if (!title || !phaseBlocks.length) return null;

    function bullets(ls) {
      return ls
        .map(function (l) { return l.replace(/^\s*[-*]\s+/, '').trim(); })
        .filter(function (l) { return l.length > 0; });
    }

    var phases = phaseBlocks.map(function (block, idx) {
      var name = block.heading.replace(/^Phase\s*\d+\s*-\s*/i, '').trim() || block.heading;
      var subtitle = '';
      var tasks = [];
      var deliverables = [];
      var notesParts = [];

      block.sections.forEach(function (sec) {
        var key = sec.heading.toLowerCase();
        if (key === 'goal') {
          subtitle = sec.lines.join(' ').trim();
        } else if (key === 'tasks') {
          tasks = bullets(sec.lines).map(function (b) { return { name: b, priority: 'm' }; });
        } else if (key === 'deliverables') {
          deliverables = bullets(sec.lines).map(function (b) { return { label: b }; });
        } else {
          var body = bullets(sec.lines).map(function (b) { return '- ' + b; }).join('\n');
          notesParts.push('**' + sec.heading + '**\n' + body);
        }
      });

      return {
        position: idx, name: name, subtitle: subtitle, duration: '',
        color_class: 'p' + ((idx % 4) + 1),
        notes: notesParts.join('\n\n'),
        tasks: tasks, deliverables: deliverables
      };
    });

    return { title: title, phases: phases };
  }

  var importMdBackdrop = document.getElementById('importMdBackdrop');
  var importMdParsed = null;
  var importMdUsersLoaded = false;

  async function ensureImportMdUsers() {
    if (importMdUsersLoaded) return;
    try {
      var users = await apiFetch('/users');
      var sel = document.getElementById('importMdTeamLead');
      users.forEach(function (u) {
        var opt = document.createElement('option');
        opt.value = u.name;
        opt.textContent = u.name;
        sel.appendChild(opt);
      });
      importMdUsersLoaded = true;
    } catch (err) { /* leave the dropdown as Unassigned-only */ }
  }

  async function openImportMdModal(parsed) {
    importMdParsed = parsed;
    document.getElementById('importMdTitle').value = parsed.title;
    document.getElementById('importMdClient').value = '';
    document.getElementById('importMdStatus').value = 'New';
    document.getElementById('importMdPriority').value = 'medium';
    document.getElementById('importMdDueDate').value = '';
    document.getElementById('importMdTeamSize').value = 1;
    document.getElementById('importMdTeamLead').value = '';
    await ensureImportMdUsers();
    importMdBackdrop.style.display = 'flex';
  }

  function closeImportMdModal() {
    importMdBackdrop.style.display = 'none';
    importMdParsed = null;
  }

  document.getElementById('importMdClose').addEventListener('click', closeImportMdModal);
  document.getElementById('importMdCancel').addEventListener('click', closeImportMdModal);

  document.getElementById('importMdSubmit').addEventListener('click', async function () {
    if (!importMdParsed) return;
    var btn = this;
    var title = document.getElementById('importMdTitle').value.trim();
    if (!title) { showAlert('Title is required.'); return; }
    var payload = {
      project: {
        title: title,
        description: '',
        client: document.getElementById('importMdClient').value.trim(),
        status: document.getElementById('importMdStatus').value,
        priority: document.getElementById('importMdPriority').value,
        due_date: document.getElementById('importMdDueDate').value || null,
        team_size: parseInt(document.getElementById('importMdTeamSize').value, 10) || 1,
        team_lead: document.getElementById('importMdTeamLead').value,
        paused: false
      },
      phases: importMdParsed.phases,
      links: []
    };
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      await runImport(payload);
    } catch (err) {
      showAlert(err.message || 'Import failed.');
      btn.disabled = false; btn.textContent = 'Create Project';
    }
  });

  async function runImport(payload) {
    var project = await apiFetch('/projects/import', { method: 'POST', body: JSON.stringify(payload) });
    window.location.href = '/project.html?id=' + project.id;
  }

  var IMPORT_BTN_HTML = document.getElementById('importBtn').innerHTML;

  document.getElementById('importBtn').addEventListener('click', function () {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', async function () {
    var file = this.files[0];
    if (!file) return;
    this.value = '';
    var isMarkdown = /\.(md|markdown)$/i.test(file.name);
    var btn = document.getElementById('importBtn');
    btn.disabled = true; btn.textContent = 'Reading…';
    try {
      var text = await file.text();
      if (isMarkdown) {
        var parsed = parseMarkdownProject(text);
        if (!parsed) {
          showAlert('Invalid file — expected a "# Project:" title and at least one "## Phase" section.');
          return;
        }
        await openImportMdModal(parsed);
        return;
      }
      var data = JSON.parse(text);
      if (!data.project || !Array.isArray(data.phases)) {
        showAlert('Invalid file — must be a ProjectPlan export JSON.');
        return;
      }
      btn.textContent = 'Importing…';
      await runImport(data);
    } catch (err) {
      showAlert(err.message || 'Import failed — check the file format.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = IMPORT_BTN_HTML;
    }
  });

  var newProjectBtn = document.getElementById('newProjectBtn');
  var newProjectDrop = document.getElementById('newProjectDrop');
  var newProjectBtnHtml = newProjectBtn.innerHTML;

  newProjectBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleMenu(newProjectBtn, newProjectDrop);
  });

  async function createProject(body) {
    newProjectDrop.classList.remove('open');
    newProjectBtn.disabled = true; newProjectBtn.textContent = 'Creating…';
    try {
      var project = await apiFetch('/projects', { method: 'POST', body: JSON.stringify(body) });
      window.location.href = '/project.html?id=' + project.id;
    } catch (err) {
      showAlert(err.message);
      newProjectBtn.disabled = false;
      newProjectBtn.innerHTML = newProjectBtnHtml;
    }
  }

  // Rebuilds the New Project dropdown: the two built-in scaffolds, any
  // custom templates saved via project.html's "Save as Template", and a
  // link into the template manager. Re-run whenever lastTemplates changes.
  function renderNewProjectMenu() {
    var html =
      '<button class="proj-menu-item" data-template="full">Scaffolded — 4 phases</button>' +
      '<button class="proj-menu-item" data-template="simple">Simple — 1 phase, 1 task</button>';
    if (lastTemplates.length) {
      html += '<div class="proj-menu-sep"></div>';
      html += lastTemplates.map(function (t) {
        return '<button class="proj-menu-item" data-template-id="' + t.id + '">' + escHtml(t.name) + '</button>';
      }).join('');
    }
    html += '<div class="proj-menu-sep"></div>';
    html += '<button class="proj-menu-item" id="manageTemplatesItem">Manage templates…</button>';
    newProjectDrop.innerHTML = html;

    newProjectDrop.querySelectorAll('[data-template]').forEach(function (item) {
      item.addEventListener('click', function () { createProject({ template: item.dataset.template }); });
    });
    newProjectDrop.querySelectorAll('[data-template-id]').forEach(function (item) {
      item.addEventListener('click', function () { createProject({ template_id: item.dataset.templateId }); });
    });
    document.getElementById('manageTemplatesItem').addEventListener('click', function () {
      newProjectDrop.classList.remove('open');
      openManageTemplatesModal();
    });
  }

  var lastTemplates = [];
  async function loadTemplates() {
    try {
      lastTemplates = await apiFetch('/templates');
    } catch (err) {
      lastTemplates = [];
    }
    renderNewProjectMenu();
  }

  // ── Manage Templates ──────────────────────────────────────────────────
  var manageTemplatesBackdrop = document.getElementById('manageTemplatesBackdrop');
  var templatesList = document.getElementById('templatesList');

  function openManageTemplatesModal() {
    renderTemplatesList();
    manageTemplatesBackdrop.style.display = 'flex';
  }
  function closeManageTemplatesModal() {
    manageTemplatesBackdrop.style.display = 'none';
  }
  document.getElementById('manageTemplatesClose').addEventListener('click', closeManageTemplatesModal);
  manageTemplatesBackdrop.addEventListener('click', function (e) {
    if (e.target === manageTemplatesBackdrop) closeManageTemplatesModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && manageTemplatesBackdrop.style.display !== 'none') closeManageTemplatesModal();
  });

  function renderTemplatesList() {
    if (!lastTemplates.length) {
      templatesList.innerHTML = '<div class="modal-list-empty">No saved templates yet — open a project and use “Save as Template” to create one.</div>';
      return;
    }
    templatesList.innerHTML = lastTemplates.map(function (t) {
      return '<div class="modal-row">' +
        '<div><div class="modal-row-name">' + escHtml(t.name) + '</div>' +
        '<div class="modal-row-meta">' + t.phase_count + ' phase' + (t.phase_count === 1 ? '' : 's') + ', ' + t.task_count + ' task' + (t.task_count === 1 ? '' : 's') + '</div></div>' +
        '<div class="modal-row-actions">' +
          '<button class="modal-row-btn" data-rename="' + t.id + '" aria-label="Rename template" title="Rename">✎</button>' +
          '<button class="modal-row-btn danger" data-remove="' + t.id + '" aria-label="Delete template" title="Delete">✕</button>' +
        '</div></div>';
    }).join('');

    templatesList.querySelectorAll('[data-rename]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var tmpl = lastTemplates.find(function (t) { return String(t.id) === btn.dataset.rename; });
        var name = prompt('Template name:', tmpl ? tmpl.name : '');
        if (!name || !name.trim() || (tmpl && name.trim() === tmpl.name)) return;
        try {
          await apiFetch('/templates/' + btn.dataset.rename, { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) });
          await loadTemplates();
          renderTemplatesList();
        } catch (err) { showAlert(err.message); }
      });
    });
    templatesList.querySelectorAll('[data-remove]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var tmpl = lastTemplates.find(function (t) { return String(t.id) === btn.dataset.remove; });
        if (!confirm('Delete template "' + (tmpl ? tmpl.name : '') + '"? This cannot be undone.')) return;
        try {
          await apiFetch('/templates/' + btn.dataset.remove, { method: 'DELETE' });
          await loadTemplates();
          renderTemplatesList();
        } catch (err) { showAlert(err.message); }
      });
    });
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  loadTemplates();
  loadProjects();
})();
