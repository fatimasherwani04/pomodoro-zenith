// ============================================================
//  ZENITH — app.js  |  Full Pomodoro App Engine
// ============================================================

// ── Quotes ──────────────────────────────────────────────────
const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "It's not that I'm so smart, it's just that I stay with problems longer.", author: "Albert Einstein" },
  { text: "Deep work is the ability to focus without distraction on a cognitively demanding task.", author: "Cal Newport" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "Small steps every day lead to big changes over time.", author: "Anonymous" },
  { text: "Concentration is the secret of strength.", author: "Ralph Waldo Emerson" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "The more I practice, the luckier I get.", author: "Gary Player" },
  { text: "An hour of planning can save you ten hours of doing.", author: "Dale Carnegie" },
  { text: "You can do anything, but not everything.", author: "David Allen" },
  { text: "Productivity is never an accident. It is always the result of a commitment to excellence.", author: "Paul J. Meyer" },
  { text: "Amateurs sit and wait for inspiration. The rest of us just get up and go to work.", author: "Stephen King" },
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "It always seems impossible until it is done.", author: "Nelson Mandela" },
];

// ── Settings ─────────────────────────────────────────────────
let settings = {
  focus: 25, short: 5, long: 15,
  sessionsBeforeLong: 4, autoBreak: false, notifs: false
};

// ── State ────────────────────────────────────────────────────
let state = {
  mode: 'pomodoro',           // pomodoro | short | long
  timeLeft: 25 * 60,
  totalTime: 25 * 60,
  running: false,
  timer: null,
  sessionNum: 1,
  completedSessions: 0,
  activeTaskId: null,
  quoteIndex: 0,
  mood: null,
  audioCtx: null,
  ambienceSounds: {},         // active oscillator/noise nodes
  activeAmbienceKeys: new Set(),
};

// ── Stats ─────────────────────────────────────────────────────
let stats = loadStats();
function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem('zenith_stats') || '{}');
    const today = todayKey();
    return {
      sessions: s.sessions || 0,
      minutes: s.minutes || 0,
      tasksDone: s.tasksDone || 0,
      bestStreak: s.bestStreak || 0,
      dayStreak: s.dayStreak || 0,
      lastActiveDate: s.lastActiveDate || null,
      weekly: s.weekly || {},
      day: s.day === today ? s.day : today,
    };
  } catch { return { sessions:0, minutes:0, tasksDone:0, bestStreak:0, dayStreak:0, lastActiveDate:null, weekly:{}, day:todayKey() }; }
}
function saveStats() {
  stats.day = todayKey();
  localStorage.setItem('zenith_stats', JSON.stringify(stats));
}
function todayKey() { return new Date().toISOString().split('T')[0]; }

// ── Tasks ─────────────────────────────────────────────────────
let tasks = JSON.parse(localStorage.getItem('zenith_tasks') || '[]');
function saveTasks() { localStorage.setItem('zenith_tasks', JSON.stringify(tasks)); }

// ── Init ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadSettingsFromStorage();
  renderTasks();
  updateTimerDisplay();
  buildSessionDots();
  updateStats();
  buildWeeklyChart();
  nextQuote();
  spawnParticles();
  checkDayStreak();
  updateStreakDisplay();

  document.getElementById('taskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  document.querySelectorAll('.alert-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.alert-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });

  // Load settings into UI
  document.getElementById('setFocus').value   = settings.focus;
  document.getElementById('setShort').value   = settings.short;
  document.getElementById('setLong').value    = settings.long;
  document.getElementById('setSessions').value = settings.sessionsBeforeLong;
});

// ── Timer ─────────────────────────────────────────────────────
function toggleTimer() {
  if (state.running) pauseTimer(); else startTimer();
}
function startTimer() {
  state.running = true;
  document.getElementById('mainBtn').textContent = '⏸ Pause';
  document.getElementById('mainBtn').classList.remove('paused');
  document.getElementById('timerStatus').textContent = state.mode === 'pomodoro' ? 'Deep focus mode 🧠' : 'Resting...';
  document.getElementById('timerGlow').classList.add('active');
  document.querySelector('.timer-ring').classList.add('running');
  setStatus('Typing...');
  updateDocTitle();

  state.timer = setInterval(() => {
    if (state.timeLeft <= 0) { sessionComplete(); return; }
    state.timeLeft--;
    updateTimerDisplay();
    updateRing();
    updateDocTitle();

    // Add minutes to stats
    if (state.mode === 'pomodoro' && state.timeLeft % 60 === 0) {
      stats.minutes++;
      const wk = stats.weekly[todayKey()] || 0;
      stats.weekly[todayKey()] = wk + 1;
      saveStats();
      updateStats();
    }
  }, 1000);
}
function pauseTimer() {
  state.running = false;
  clearInterval(state.timer);
  document.getElementById('mainBtn').textContent = '▶ Resume';
  document.getElementById('mainBtn').classList.add('paused');
  document.getElementById('timerStatus').textContent = 'Paused';
  document.getElementById('timerGlow').classList.remove('active');
  document.querySelector('.timer-ring').classList.remove('running');
  document.title = 'Zenith — Paused';
}
function resetTimer() {
  clearInterval(state.timer);
  state.running = false;
  state.timeLeft = state.totalTime;
  document.getElementById('mainBtn').textContent = '▶ Start';
  document.getElementById('mainBtn').classList.remove('paused');
  document.getElementById('timerStatus').textContent = 'Ready to focus';
  document.getElementById('timerGlow').classList.remove('active');
  document.querySelector('.timer-ring').classList.remove('running');
  updateTimerDisplay();
  updateRing();
  document.title = 'Zenith — Focus Timer';
}
function skipSession() { sessionComplete(); }

function setTimerMode(mode, btn) {
  clearInterval(state.timer);
  state.running = false;
  state.mode = mode;
  document.querySelectorAll('.mode-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const times = { pomodoro: settings.focus, short: settings.short, long: settings.long };
  state.totalTime = times[mode] * 60;
  state.timeLeft  = state.totalTime;
  document.getElementById('mainBtn').textContent = '▶ Start';
  document.getElementById('mainBtn').classList.remove('paused');
  document.getElementById('timerStatus').textContent = mode === 'pomodoro' ? 'Ready to focus' : 'Take it easy';
  document.getElementById('timerGlow').classList.remove('active');
  document.querySelector('.timer-ring').classList.remove('running');

  // Color theme
  document.body.classList.remove('break-mode','long-break-mode');
  if (mode === 'short') document.body.classList.add('break-mode');
  if (mode === 'long')  document.body.classList.add('long-break-mode');

  updateTimerDisplay();
  updateRing();
  document.title = 'Zenith — Focus Timer';
}

function updateTimerDisplay() {
  const m = Math.floor(state.timeLeft / 60).toString().padStart(2,'0');
  const s = (state.timeLeft % 60).toString().padStart(2,'0');
  document.getElementById('timerDisplay').textContent = `${m}:${s}`;
}
function updateDocTitle() {
  const m = Math.floor(state.timeLeft / 60).toString().padStart(2,'0');
  const s = (state.timeLeft % 60).toString().padStart(2,'0');
  const label = state.mode === 'pomodoro' ? '🍅' : '☕';
  document.title = `${label} ${m}:${s} — Zenith`;
}

// ── Ring ──────────────────────────────────────────────────────
function updateRing() {
  const circ = 2 * Math.PI * 130; // 816.81
  const pct  = state.timeLeft / state.totalTime;
  const offset = circ * (1 - pct);
  document.getElementById('progressRing').style.strokeDashoffset = offset;

  // Move dot along ring
  const angle = (1 - pct) * 2 * Math.PI - Math.PI / 2;
  const cx = 150 + 130 * Math.cos(angle);
  const cy = 150 + 130 * Math.sin(angle);
  const dot = document.getElementById('ringDot');
  dot.setAttribute('cx', cx);
  dot.setAttribute('cy', cy);
}

// ── Session Complete ──────────────────────────────────────────
function sessionComplete() {
  clearInterval(state.timer);
  state.running = false;
  document.getElementById('timerGlow').classList.remove('active');
  document.querySelector('.timer-ring').classList.remove('running');

  playAlertSound();

  if (state.mode === 'pomodoro') {
    state.completedSessions++;
    stats.sessions++;
    const wk = stats.weekly[todayKey()] || 0;
    stats.weekly[todayKey()] = wk;
    if (stats.sessions > stats.bestStreak) stats.bestStreak = stats.sessions;
    stats.lastActiveDate = todayKey();
    saveStats();
    updateStats();
    buildWeeklyChart();
    buildSessionDots();
    showToast('🎉 Focus session complete! Great work!');
    sendNotification('Session Complete!', 'Time for a break. You earned it! 🎉');
  } else {
    showToast('☕ Break over! Ready to focus again?');
    sendNotification('Break Over!', "Let's get back to it! 💪");
  }

  // Show modal
  showModal();
}

function showModal() {
  const isPomodoro = state.mode === 'pomodoro';
  document.getElementById('modalEmoji').textContent   = isPomodoro ? '🎉' : '⚡';
  document.getElementById('modalTitle').textContent   = isPomodoro ? 'Focus Session Complete!' : 'Break Complete!';
  document.getElementById('modalMsg').textContent     = isPomodoro ? 'Amazing focus! Take a well-deserved break.' : "Feeling refreshed? Let's get back to work!";
  document.getElementById('modalSessions').textContent = stats.sessions;
  document.getElementById('modalMinutes').textContent  = stats.minutes;
  const nextLabel = isPomodoro ? (state.completedSessions % settings.sessionsBeforeLong === 0 ? 'Start Long Break →' : 'Start Short Break →') : 'Start Focus →';
  document.getElementById('modalNextBtn').textContent = nextLabel;
  document.getElementById('sessionModal').classList.remove('hidden');
  nextQuote();
}

function startNext() {
  closeModal();
  if (state.mode === 'pomodoro') {
    const isLong = state.completedSessions % settings.sessionsBeforeLong === 0;
    const nextMode = isLong ? 'long' : 'short';
    const btn = document.querySelector(`.mode-tab[data-mode="${nextMode}"]`);
    setTimerMode(nextMode, btn);
    btn.classList.add('active');
    document.querySelectorAll('.mode-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === nextMode));
  } else {
    const btn = document.querySelector('.mode-tab[data-mode="pomodoro"]');
    setTimerMode('pomodoro', btn);
    document.querySelectorAll('.mode-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === 'pomodoro'));
  }
  if (settings.autoBreak) startTimer();
}
function closeModal() { document.getElementById('sessionModal').classList.add('hidden'); }

// ── Session Dots ──────────────────────────────────────────────
function buildSessionDots() {
  const wrap = document.getElementById('sessionDots');
  wrap.innerHTML = '';
  for (let i = 0; i < settings.sessionsBeforeLong; i++) {
    const dot = document.createElement('div');
    dot.className = 'session-dot' +
      (i < state.completedSessions % settings.sessionsBeforeLong ? ' done' : '') +
      (i === state.completedSessions % settings.sessionsBeforeLong ? ' current' : '');
    wrap.appendChild(dot);
  }
}

// ── Tasks ─────────────────────────────────────────────────────
function addTask() {
  const input = document.getElementById('taskInput');
  const text = input.value.trim();
  if (!text) return;
  tasks.push({ id: Date.now(), text, done: false });
  input.value = '';
  saveTasks();
  renderTasks();
}
function renderTasks() {
  const list = document.getElementById('taskList');
  if (!tasks.length) { list.innerHTML = '<div class="task-empty">No tasks yet. Add one above! ✨</div>'; updateTaskCount(); return; }
  list.innerHTML = tasks.map(t => `
    <div class="task-item ${t.done ? 'done' : ''} ${state.activeTaskId === t.id ? 'active' : ''}" onclick="selectTask(${t.id})">
      <div class="task-check" onclick="event.stopPropagation(); toggleTask(${t.id})">${t.done ? '✓' : ''}</div>
      <span class="task-text">${escHtml(t.text)}</span>
      <span class="task-del" onclick="event.stopPropagation(); deleteTask(${t.id})">✕</span>
    </div>`).join('');
  updateTaskCount();
}
function toggleTask(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.done = !t.done;
  if (t.done) { stats.tasksDone++; saveStats(); updateStats(); showToast('✅ Task complete! Keep going!'); }
  saveTasks(); renderTasks();
}
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  if (state.activeTaskId === id) { state.activeTaskId = null; updateActiveTask(); }
  saveTasks(); renderTasks();
}
function selectTask(id) {
  state.activeTaskId = state.activeTaskId === id ? null : id;
  renderTasks(); updateActiveTask();
}
function updateActiveTask() {
  const t = tasks.find(t => t.id === state.activeTaskId);
  document.getElementById('activeTaskText').textContent = t ? t.text : 'No task selected — pick one from the list';
}
function updateTaskCount() {
  const done = tasks.filter(t => t.done).length;
  document.getElementById('taskCount').textContent = `${done}/${tasks.length}`;
}
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Quotes ────────────────────────────────────────────────────
function nextQuote() {
  const card = document.getElementById('quoteCard');
  card.style.opacity = '0'; card.style.transform = 'translateY(8px)';
  setTimeout(() => {
    state.quoteIndex = (state.quoteIndex + 1) % QUOTES.length;
    const q = QUOTES[state.quoteIndex];
    document.getElementById('quoteText').textContent   = q.text;
    document.getElementById('quoteAuthor').textContent = '— ' + q.author;
    card.style.transition = 'all 0.4s ease';
    card.style.opacity = '1'; card.style.transform = 'translateY(0)';
  }, 200);
}

// ── Stats ─────────────────────────────────────────────────────
function updateStats() {
  document.getElementById('statSessions').textContent = stats.sessions;
  document.getElementById('statMinutes').textContent  = stats.minutes;
  document.getElementById('statTasks').textContent    = stats.tasksDone;
  document.getElementById('statStreak').textContent   = stats.bestStreak;
}
function resetStats() {
  if (!confirm('Reset all stats for today?')) return;
  stats.sessions = 0; stats.minutes = 0; stats.tasksDone = 0;
  saveStats(); updateStats(); buildWeeklyChart(); showToast('Stats reset!');
}

function buildWeeklyChart() {
  const wrap = document.getElementById('weeklyBars');
  const days = document.getElementById('weeklyDays');
  const today = new Date();
  const dayNames = ['S','M','T','W','T','F','S'];
  let html = '', daysHtml = '';
  const max = Math.max(1, ...Object.values(stats.weekly));

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const val = stats.weekly[key] || 0;
    const pct = Math.max(4, (val / max) * 100);
    const isToday = i === 0;
    html += `<div class="weekly-bar ${isToday ? 'today' : ''}" style="height:${pct}%" title="${val} min"></div>`;
    daysHtml += `<div class="weekly-day">${dayNames[d.getDay()]}</div>`;
  }
  wrap.innerHTML = html;
  days.innerHTML = daysHtml;
}

// ── Streak ────────────────────────────────────────────────────
function checkDayStreak() {
  const today = todayKey();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yKey = yesterday.toISOString().split('T')[0];
  if (stats.lastActiveDate === yKey) stats.dayStreak++;
  else if (stats.lastActiveDate !== today) stats.dayStreak = 0;
  saveStats();
}
function updateStreakDisplay() {
  document.getElementById('streakCount').textContent = stats.dayStreak;
}

// ── Mood ─────────────────────────────────────────────────────
function setMood(el) {
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  state.mood = el.dataset.mood;
  const msgs = { focused:'Perfect mood to focus! Let\'s go! 🎯', tired:'Take it slow — short sessions work great. 💙', motivated:'You\'re on fire! Make the most of it! ⚡', creative:'Channel that creativity! 🎨', stressed:'Breathe. One step at a time. 🌿', calm:'Perfect state for deep work. 🌿' };
  showToast(msgs[state.mood] || 'Mood set!');
}

// ── Settings ──────────────────────────────────────────────────
function toggleSettings() {
  const card = document.getElementById('settingsCard');
  card.style.display = card.style.display === 'none' ? 'block' : 'none';
}
function saveSettings() {
  settings.focus   = parseInt(document.getElementById('setFocus').value) || 25;
  settings.short   = parseInt(document.getElementById('setShort').value) || 5;
  settings.long    = parseInt(document.getElementById('setLong').value)  || 15;
  settings.sessionsBeforeLong = parseInt(document.getElementById('setSessions').value) || 4;
  settings.autoBreak = document.getElementById('toggleBreak').classList.contains('on');
  localStorage.setItem('zenith_settings', JSON.stringify(settings));
  resetTimer();
  buildSessionDots();
  toggleSettings();
  showToast('✅ Settings saved!');
}
function loadSettingsFromStorage() {
  try {
    const s = JSON.parse(localStorage.getItem('zenith_settings') || '{}');
    Object.assign(settings, s);
    state.totalTime = settings.focus * 60;
    state.timeLeft  = state.totalTime;
  } catch {}
}

// ── Notifications ─────────────────────────────────────────────
function requestNotifPermission(el) {
  if ('Notification' in window) {
    Notification.requestPermission().then(p => {
      if (p === 'granted') { el.classList.add('on'); settings.notifs = true; showToast('🔔 Notifications enabled!'); }
      else showToast('❌ Notification permission denied.');
    });
  }
}
function sendNotification(title, body) {
  if (settings.notifs && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '🍅' });
  }
}

// ── Alert Sound (Web Audio API) ───────────────────────────────
function getAudioCtx() {
  if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return state.audioCtx;
}
function playAlertSound() {
  const sel = document.querySelector('.alert-option.active');
  const sound = sel ? sel.dataset.sound : 'bell';
  const vol = parseFloat(document.getElementById('alertVol').value);
  playSound(sound, vol);
}
function previewAlertSound() { playAlertSound(); }

function playSound(type, vol = 0.7) {
  try {
    const ctx = getAudioCtx();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(vol, ctx.currentTime);

    if (type === 'bell') {
      // Bell — decaying sine
      [0, 0.1, 0.2].forEach((delay, i) => {
        const o = ctx.createOscillator();
        o.connect(gain);
        o.frequency.setValueAtTime(880 / (i + 1), ctx.currentTime + delay);
        o.type = 'sine';
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 1.5);
        o.start(ctx.currentTime + delay);
        o.stop(ctx.currentTime + delay + 1.5);
      });
    } else if (type === 'chime') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = freq; o.type = 'sine';
        g.gain.setValueAtTime(vol * 0.5, ctx.currentTime + i * 0.2);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 1);
        o.start(ctx.currentTime + i * 0.2);
        o.stop(ctx.currentTime + i * 0.2 + 1);
      });
    } else if (type === 'digital') {
      [440, 880, 440].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = freq; o.type = 'square';
        g.gain.setValueAtTime(vol * 0.15, ctx.currentTime + i * 0.15);
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.15 + 0.12);
        o.start(ctx.currentTime + i * 0.15);
        o.stop(ctx.currentTime + i * 0.15 + 0.15);
      });
    } else if (type === 'nature') {
      // Bird-like chirps
      [1200, 1500, 1200, 1800].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);
        o.frequency.linearRampToValueAtTime(freq * 1.2, ctx.currentTime + i * 0.18 + 0.08);
        g.gain.setValueAtTime(vol * 0.4, ctx.currentTime + i * 0.18);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.15);
        o.start(ctx.currentTime + i * 0.18);
        o.stop(ctx.currentTime + i * 0.18 + 0.18);
      });
    } else if (type === 'soft') {
      // Soft sine fade
      const o = ctx.createOscillator();
      o.connect(gain); o.type = 'sine'; o.frequency.value = 432;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol * 0.4, ctx.currentTime + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
      o.start(ctx.currentTime); o.stop(ctx.currentTime + 2);
    }
  } catch(e) { console.warn('Audio error:', e); }
}

// ── Ambience Sounds (Web Audio noise) ────────────────────────
function toggleSound(key, btn) {
  if (state.activeAmbienceKeys.has(key)) {
    stopAmbience(key);
    state.activeAmbienceKeys.delete(key);
    btn.classList.remove('active');
  } else {
    startAmbience(key);
    state.activeAmbienceKeys.add(key);
    btn.classList.add('active');
  }
}
function setAmbienceVolume(val) {
  Object.values(state.ambienceSounds).forEach(n => { if (n && n.gain) n.gain.gain.setValueAtTime(parseFloat(val), getAudioCtx().currentTime); });
}
function startAmbience(key) {
  try {
    const ctx = getAudioCtx();
    const masterGain = ctx.createGain();
    masterGain.gain.value = parseFloat(document.getElementById('ambienceVol').value);
    masterGain.connect(ctx.destination);

    if (key === 'rain') {
      const bufSize = 2 * ctx.sampleRate;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 400; filter.Q.value = 0.8;
      src.connect(filter); filter.connect(masterGain);
      src.start();
      state.ambienceSounds[key] = { node: src, gain: masterGain, stop: () => src.stop() };
    } else if (key === 'forest') {
      const bufSize = 2 * ctx.sampleRate;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 600;
      src.connect(filter); filter.connect(masterGain);
      src.start();
      state.ambienceSounds[key] = { node: src, gain: masterGain, stop: () => src.stop() };
    } else if (key === 'cafe') {
      const bufSize = 2 * ctx.sampleRate;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 0.5;
      src.connect(filter); filter.connect(masterGain);
      src.start();
      state.ambienceSounds[key] = { node: src, gain: masterGain, stop: () => src.stop() };
    } else if (key === 'waves') {
      // LFO-modulated noise
      const bufSize = 2 * ctx.sampleRate;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.15; lfo.type = 'sine';
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.5;
      lfo.connect(lfoGain); lfoGain.connect(masterGain.gain);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 500;
      src.connect(filter); filter.connect(masterGain);
      src.start(); lfo.start();
      state.ambienceSounds[key] = { node: src, gain: masterGain, stop: () => { src.stop(); lfo.stop(); } };
    } else if (key === 'fire') {
      const bufSize = 2 * ctx.sampleRate;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 300;
      src.connect(filter); filter.connect(masterGain);
      src.start();
      state.ambienceSounds[key] = { node: src, gain: masterGain, stop: () => src.stop() };
    } else if (key === 'wind') {
      const bufSize = 2 * ctx.sampleRate;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass'; filter.frequency.value = 200;
      src.connect(filter); filter.connect(masterGain);
      src.start();
      state.ambienceSounds[key] = { node: src, gain: masterGain, stop: () => src.stop() };
    }
  } catch(e) { console.warn('Ambience error:', e); }
}
function stopAmbience(key) {
  const n = state.ambienceSounds[key];
  if (n && n.stop) { try { n.stop(); } catch {} }
  delete state.ambienceSounds[key];
}

// ── Particles ─────────────────────────────────────────────────
function spawnParticles() {
  const wrap = document.getElementById('particles');
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.animationDuration = (12 + Math.random() * 20) + 's';
    p.style.animationDelay    = (-Math.random() * 20) + 's';
    p.style.width = p.style.height = (1 + Math.random() * 2) + 'px';
    p.style.opacity = (0.1 + Math.random() * 0.4).toString();
    wrap.appendChild(p);
  }
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function setStatus(msg) {}