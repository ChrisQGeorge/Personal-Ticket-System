// === STATE ===
let serverUrl = '';
let currentUser = null;
let profiles = [];
let currentTicket = null;
let gameStats = null;
let createAttrs = []; // Array of {name, type, goal, current}

// === HELPERS ===
const $ = (sel) => document.querySelector(sel);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

async function api(path, options = {}) {
  const url = serverUrl + path;
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function priorityClass(priority) {
  return 'priority-' + priority.replace(' ', '-');
}

// === GAME BAR ===
function updateGameBar() {
  if (!gameStats || !gameStats.gamification_enabled) {
    hide($('#game-bar'));
    return;
  }
  show($('#game-bar'));
  $('#game-level').textContent = `Lv.${gameStats.current_level}`;
  $('#game-rank').textContent = gameStats.rank_title;
  $('#game-xp').textContent = `${gameStats.total_xp.toLocaleString()} XP`;

  const streak = gameStats.current_streak;
  $('#game-streak').textContent = streak > 0 ? `${streak >= 3 ? '\uD83D\uDD25' : ''}${streak} streak` : '';
  const combo = gameStats.combo_count;
  $('#game-combo').textContent = combo > 0 ? `\u26A1${combo}x` : '';

  // XP bar
  const range = gameStats.xp_for_next_level - gameStats.xp_for_current_level;
  const progress = range > 0 ? ((gameStats.total_xp - gameStats.xp_for_current_level) / range) * 100 : 0;
  $('#xp-bar-fill').style.width = `${Math.min(100, progress)}%`;
}

function showGameEvent(containerId, event) {
  const container = $(containerId);
  if (!event) { hide(container); return; }

  show(container);

  if (event.xp_earned != null) {
    // Completion or creation event
    container.className = 'game-event xp-gain';
    let html = `<div class="game-event-xp">+${event.xp_earned} XP</div>`;

    if (event.leveled_up) {
      html += `<div class="game-event-levelup">\uD83C\uDF89 LEVEL UP! Level ${event.new_level} \u2014 ${event.rank_title}</div>`;
    }

    if (event.new_achievements && event.new_achievements.length > 0) {
      event.new_achievements.forEach(a => {
        html += `<div class="game-event-achievement">\uD83C\uDFC6 ${a.name} (+${a.xp} XP)</div>`;
      });
    }

    const details = [];
    if (event.streak > 0) details.push(`\uD83D\uDD25 ${event.streak} streak`);
    if (event.combo > 1) details.push(`\u26A1 ${event.combo}x combo`);
    if (details.length) html += `<div class="game-event-details">${details.join(' \u00B7 ')}</div>`;

    container.innerHTML = html;
  } else if (event.xp_lost != null) {
    // Skip event
    container.className = 'game-event xp-loss';
    let html = `<div class="game-event-xp">-${event.xp_lost} XP</div>`;
    if (event.combo_reset) html += `<div class="game-event-details">Combo reset!</div>`;
    container.innerHTML = html;
  }

  // Auto-hide after 4s
  setTimeout(() => hide(container), 4000);
}

// === SCREENS ===
function showScreen(screen) {
  hide($('#setup-screen'));
  hide($('#login-screen'));
  hide($('#app-screen'));
  show($(screen));
}

// === INIT ===
async function init() {
  const data = await chrome.storage.sync.get(['serverUrl']);
  serverUrl = data.serverUrl || '';

  if (!serverUrl) {
    showScreen('#setup-screen');
    hide($('#logout-btn'));
    hide($('#user-badge'));
    return;
  }

  // Try to check auth
  try {
    currentUser = await api('/api/auth/me');
    await loadAppData();
    showScreen('#app-screen');
    show($('#logout-btn'));
    $('#user-badge').textContent = currentUser.username;
    show($('#user-badge'));
  } catch (e) {
    showScreen('#login-screen');
    $('#server-display').textContent = serverUrl;
    hide($('#logout-btn'));
    hide($('#user-badge'));
  }
}

async function loadAppData() {
  try {
    profiles = await api('/api/profiles');
    populateProfileSelects();
  } catch (e) { profiles = []; }

  try {
    gameStats = await api('/api/gamification/stats');
    updateGameBar();
  } catch (e) { gameStats = null; }
}

function populateProfileSelects() {
  ['#create-profile', '#queue-profile'].forEach(sel => {
    const select = $(sel);
    select.innerHTML = '';
    profiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
  });
}

// === SETUP ===
$('#setup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hide($('#setup-error'));
  const url = $('#setup-url').value.trim().replace(/\/+$/, '');

  try {
    const res = await fetch(url + '/api/health', { credentials: 'include' });
    if (!res.ok) throw new Error('Server not reachable');

    serverUrl = url;
    await chrome.storage.sync.set({ serverUrl });
    showScreen('#login-screen');
    $('#server-display').textContent = serverUrl;
  } catch (err) {
    show($('#setup-error'));
    $('#setup-error').textContent = 'Cannot connect to server. Check the URL and try again.';
  }
});

// === LOGIN ===
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hide($('#login-error'));
  $('#login-btn').disabled = true;

  try {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: $('#login-username').value.trim(),
        password: $('#login-password').value,
      }),
    });
    currentUser = res.user;
    await loadAppData();
    showScreen('#app-screen');
    show($('#logout-btn'));
    $('#user-badge').textContent = currentUser.username;
    show($('#user-badge'));
  } catch (err) {
    show($('#login-error'));
    $('#login-error').textContent = 'Invalid credentials';
  } finally {
    $('#login-btn').disabled = false;
  }
});

$('#change-server-btn').addEventListener('click', () => {
  chrome.storage.sync.remove('serverUrl');
  serverUrl = '';
  showScreen('#setup-screen');
});

// === LOGOUT ===
$('#logout-btn').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) {}
  currentUser = null;
  showScreen('#login-screen');
  $('#server-display').textContent = serverUrl;
  hide($('#logout-btn'));
  hide($('#user-badge'));
  hide($('#game-bar'));
});

// === SETTINGS ===
$('#settings-btn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// === TABS ===
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));
    show($(`#tab-${tab.dataset.tab}`));

    if (tab.dataset.tab === 'queue') loadQueueTicket();
  });
});

// === CREATE TICKET ===
// === CUSTOM ATTRIBUTES (Create form) ===
function defaultValueForType(t) {
  if (t === 'number') return 0;
  if (t === 'boolean') return false;
  return '';
}

function renderCreateAttrs() {
  const container = $('#create-attrs');
  container.innerHTML = '';
  createAttrs.forEach((attr, i) => {
    const row = document.createElement('div');
    row.className = 'attr-row';

    // Top: name + type + remove
    const top = document.createElement('div');
    top.className = 'attr-row-top';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Attribute name';
    nameInput.value = attr.name || '';
    nameInput.maxLength = 100;
    nameInput.addEventListener('input', (e) => { createAttrs[i].name = e.target.value; });

    const typeSelect = document.createElement('select');
    ['text', 'number', 'boolean', 'date'].forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t === 'boolean' ? 'Yes/No' : t.charAt(0).toUpperCase() + t.slice(1);
      if (t === attr.type) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', (e) => {
      const newType = e.target.value;
      createAttrs[i].type = newType;
      createAttrs[i].goal = defaultValueForType(newType);
      createAttrs[i].current = defaultValueForType(newType);
      renderCreateAttrs();
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'attr-remove';
    removeBtn.textContent = '\u00d7';
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', () => {
      createAttrs.splice(i, 1);
      renderCreateAttrs();
    });

    top.appendChild(nameInput);
    top.appendChild(typeSelect);
    top.appendChild(removeBtn);

    // Values: goal + current
    const values = document.createElement('div');
    values.className = 'attr-row-values';

    ['goal', 'current'].forEach((field) => {
      const wrap = document.createElement('div');
      const lbl = document.createElement('label');
      lbl.textContent = field === 'goal' ? 'Goal' : 'Current';
      wrap.appendChild(lbl);

      let input;
      if (attr.type === 'boolean') {
        input = document.createElement('select');
        ['false', 'true'].forEach((v) => {
          const opt = document.createElement('option');
          opt.value = v;
          opt.textContent = v === 'true' ? 'Yes' : 'No';
          if (String(attr[field]) === v) opt.selected = true;
          input.appendChild(opt);
        });
        input.addEventListener('change', (e) => {
          createAttrs[i][field] = e.target.value === 'true';
        });
      } else if (attr.type === 'number') {
        input = document.createElement('input');
        input.type = 'number';
        input.step = 'any';
        input.value = attr[field] == null ? '' : attr[field];
        input.addEventListener('input', (e) => {
          createAttrs[i][field] = e.target.value === '' ? null : parseFloat(e.target.value);
        });
      } else if (attr.type === 'date') {
        input = document.createElement('input');
        input.type = 'date';
        input.value = typeof attr[field] === 'string' ? attr[field] : '';
        input.addEventListener('input', (e) => {
          createAttrs[i][field] = e.target.value;
        });
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = attr[field] == null ? '' : String(attr[field]);
        input.addEventListener('input', (e) => {
          createAttrs[i][field] = e.target.value;
        });
      }
      wrap.appendChild(input);
      values.appendChild(wrap);
    });

    row.appendChild(top);
    row.appendChild(values);
    container.appendChild(row);
  });
}

$('#create-attr-add').addEventListener('click', () => {
  createAttrs.push({
    name: '',
    type: 'text',
    goal: defaultValueForType('text'),
    current: defaultValueForType('text'),
  });
  renderCreateAttrs();
});

// === QUEUE CUSTOM ATTRIBUTES (Display) ===
function renderQueueAttrs(ticket) {
  const container = $('#queue-ticket-attrs');
  const attrs = ticket.custom_attributes || [];
  if (!attrs.length) {
    hide(container);
    return;
  }
  container.innerHTML = '';
  attrs.forEach((attr) => {
    const row = document.createElement('div');
    row.className = 'queue-attr';

    const name = document.createElement('span');
    name.className = 'queue-attr-name';
    name.textContent = attr.name;
    row.appendChild(name);

    const right = document.createElement('span');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '6px';

    if (attr.type === 'number') {
      const current = typeof attr.current === 'number' ? attr.current : 0;
      const goal = typeof attr.goal === 'number' ? attr.goal : 0;
      const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;

      const val = document.createElement('span');
      val.className = 'queue-attr-value';
      val.textContent = `${current} / ${goal}`;
      right.appendChild(val);

      const bar = document.createElement('div');
      bar.className = 'queue-attr-progress';
      const fill = document.createElement('div');
      fill.className = 'queue-attr-progress-fill';
      fill.style.width = `${pct}%`;
      bar.appendChild(fill);
      right.appendChild(bar);
    } else if (attr.type === 'boolean') {
      const badge = document.createElement('span');
      badge.className = `queue-attr-boolean ${attr.current ? 'true' : 'false'}`;
      badge.textContent = attr.current ? 'YES' : 'NO';
      right.appendChild(badge);
    } else {
      const val = document.createElement('span');
      val.className = 'queue-attr-value';
      const cur = attr.current == null || attr.current === '' ? '—' : String(attr.current);
      const goalStr = attr.goal == null || attr.goal === '' ? '' : ` / ${attr.goal}`;
      val.textContent = cur + goalStr;
      right.appendChild(val);
    }

    row.appendChild(right);
    container.appendChild(row);
  });
  show(container);
}

$('#create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hide($('#create-error'));
  hide($('#create-success'));
  hide($('#create-game-event'));
  $('#create-btn').disabled = true;

  const data = {
    title: $('#create-title').value.trim(),
    profile_id: parseInt($('#create-profile').value),
  };

  const desc = $('#create-description').value.trim();
  if (desc) data.description = desc;

  const priority = $('#create-priority').value;
  if (priority) data.priority = priority;

  const hours = parseFloat($('#create-hours').value);
  if (!isNaN(hours) && hours > 0) data.est_hours = hours;

  const due = $('#create-due').value;
  if (due) data.due_date = due;

  // Include custom attributes (filter out those without names)
  const validAttrs = createAttrs.filter((a) => a.name && a.name.trim());
  if (validAttrs.length) data.custom_attributes = validAttrs;

  try {
    const result = await api('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    show($('#create-success'));
    if (result.game_event) {
      showGameEvent('#create-game-event', result.game_event);
      // Refresh game bar
      gameStats = await api('/api/gamification/stats').catch(() => gameStats);
      updateGameBar();
    }

    // Reset form and attrs after delay
    setTimeout(() => {
      $('#create-form').reset();
      createAttrs = [];
      renderCreateAttrs();
      hide($('#create-success'));
      hide($('#create-game-event'));
    }, 3000);
  } catch (err) {
    show($('#create-error'));
    $('#create-error').textContent = 'Failed to create ticket';
  } finally {
    $('#create-btn').disabled = false;
  }
});

// === QUEUE ===
async function loadQueueTicket() {
  hide($('#queue-ticket'));
  hide($('#queue-empty'));
  hide($('#queue-error'));
  hide($('#queue-game-event'));
  show($('#queue-loading'));

  const profileId = $('#queue-profile').value;

  try {
    const ticket = await api(`/api/queue/next${profileId ? `?profile_id=${profileId}` : ''}`);
    currentTicket = ticket;
    renderQueueTicket(ticket);
    hide($('#queue-loading'));
    show($('#queue-ticket'));
  } catch (err) {
    hide($('#queue-loading'));
    if (err.message.includes('404') || err.message.includes('No tickets')) {
      show($('#queue-empty'));
    } else {
      show($('#queue-error'));
      $('#queue-error').textContent = 'Failed to load queue';
    }
  }
}

function renderQueueTicket(ticket) {
  $('#queue-ticket-id').textContent = `#${ticket.id}`;

  const priorityEl = $('#queue-ticket-priority');
  priorityEl.textContent = ticket.priority;
  priorityEl.className = `ticket-priority ${priorityClass(ticket.priority)}`;

  $('#queue-ticket-title').textContent = ticket.title;
  $('#queue-ticket-description').textContent = ticket.description || '';
  if (!ticket.description) hide($('#queue-ticket-description'));
  else show($('#queue-ticket-description'));

  $('#queue-ticket-due').textContent = ticket.due_date ? `\uD83D\uDCC5 ${ticket.due_date}` : '';
  $('#queue-ticket-hours').textContent = ticket.est_hours != null ? `\u23F1 ${ticket.est_hours}h` : '';
  $('#queue-ticket-skips').textContent = ticket.skip_count > 0 ? `\u21A9 ${ticket.skip_count} skips` : '';

  renderQueueAttrs(ticket);
}

$('#queue-complete-btn').addEventListener('click', async () => {
  if (!currentTicket) return;
  $('#queue-complete-btn').disabled = true;
  $('#queue-skip-btn').disabled = true;
  hide($('#queue-game-event'));

  try {
    const result = await api(`/api/queue/complete/${currentTicket.id}`, { method: 'POST' });

    if (result.game_event) {
      showGameEvent('#queue-game-event', result.game_event);
      gameStats = await api('/api/gamification/stats').catch(() => gameStats);
      updateGameBar();
    }

    // Load next ticket after brief delay
    setTimeout(() => loadQueueTicket(), result.game_event ? 1500 : 300);
  } catch (err) {
    show($('#queue-error'));
    $('#queue-error').textContent = 'Failed to complete ticket';
  } finally {
    $('#queue-complete-btn').disabled = false;
    $('#queue-skip-btn').disabled = false;
  }
});

$('#queue-skip-btn').addEventListener('click', async () => {
  if (!currentTicket) return;
  $('#queue-complete-btn').disabled = true;
  $('#queue-skip-btn').disabled = true;
  hide($('#queue-game-event'));

  try {
    const result = await api(`/api/queue/skip/${currentTicket.id}`, { method: 'POST' });

    if (result.game_event) {
      showGameEvent('#queue-game-event', result.game_event);
      gameStats = await api('/api/gamification/stats').catch(() => gameStats);
      updateGameBar();
    }

    setTimeout(() => loadQueueTicket(), result.game_event ? 1200 : 300);
  } catch (err) {
    show($('#queue-error'));
    $('#queue-error').textContent = 'Failed to skip ticket';
  } finally {
    $('#queue-complete-btn').disabled = false;
    $('#queue-skip-btn').disabled = false;
  }
});

$('#queue-profile').addEventListener('change', () => loadQueueTicket());

// === INIT ===
init();
