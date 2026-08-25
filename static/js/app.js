/* ============================================================
   GAME SURVIVAL LABIRIN — aplikasi
   Navigasi layar, soal, sesi, leaderboard, admin, input sentuh,
   dan perlindungan anti pull-to-refresh.
   ============================================================ */
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const App = {
  name: localStorage.getItem('ss_name') || '',
  questions: [],
  adminToken: localStorage.getItem('ss_admin') || '',
  S: null,               // sesi aktif
  activeScreen: 'splash',
  qState: null,
};

/* ---------------- util ---------------- */
function normName(s) {
  return (s || '').trim().replace(/\s+/g, ' ').slice(0, 16);
}

async function api(path, opts) {
  opts = opts || {};
  const r = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
  return d;
}

async function adminApi(path, opts) {
  opts = opts || {};
  const init = { method: opts.method, body: opts.body };
  init.headers = Object.assign(
    { 'Content-Type': 'application/json' },
    opts.headers || {},
    { Authorization: 'Bearer ' + App.adminToken }
  );
  const r = await fetch(path, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) {
    App.adminToken = '';
    localStorage.removeItem('ss_admin');
    showAdminLogin();
    throw new Error('Sesi admin habis, silakan masuk lagi.');
  }
  if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
  return d;
}

/* ============================================================
   STORE — abstraksi data
   mode 'server' : Flask Python berjalan (fitur penuh:
                   CRUD soal, skor bersama, sesi bersama)
   mode 'local'  : GitHub Pages / tanpa server (mode HP:
                   soal bawaan, sesi & skor per perangkat)
   ============================================================ */
const Store = {
  mode: 'local',
  _initPromise: null,

  init() {
    if (!this._initPromise) this._initPromise = this._detect();
    return this._initPromise;
  },

  async _detect() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch('api/healthz', { signal: ctrl.signal });
      clearTimeout(t);
      const ct = r.headers.get('content-type') || '';
      this.mode = (r.ok && ct.indexOf('json') !== -1) ? 'server' : 'local';
    } catch (e) {
      this.mode = 'local';
    }
    return this.mode;
  },

  /* ---- soal ---- */
  async loadQuestions() {
    if (this.mode === 'server') {
      const d = await api('api/questions/public');
      return d.questions || [];
    }
    return typeof DEFAULT_QUESTIONS !== 'undefined' ? DEFAULT_QUESTIONS : [];
  },

  /* ---- sesi ---- */
  async getSession(name) {
    const n = normName(name);
    if (!n) return null;
    if (this.mode === 'server') {
      const d = await api('api/sessions/' + encodeURIComponent(n));
      return d.found ? d.session : null;
    }
    const raw = localStorage.getItem('ss_session_' + n.toLowerCase());
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  },

  saveSession(name, payload) {
    const n = normName(name);
    if (!n) return;
    if (this.mode === 'server') {
      api('api/sessions/' + encodeURIComponent(n), {
        method: 'POST', body: JSON.stringify(payload),
      }).catch(() => {});
      return;
    }
    payload.name = n;
    payload.updatedAt = Date.now();
    try {
      localStorage.setItem('ss_session_' + n.toLowerCase(), JSON.stringify(payload));
    } catch (e) { /* storage penuh — abaikan */ }
  },

  deleteSession(name) {
    const n = normName(name);
    if (!n) return Promise.resolve();
    if (this.mode === 'server') {
      return api('api/sessions/' + encodeURIComponent(n), { method: 'DELETE' }).catch(() => {});
    }
    localStorage.removeItem('ss_session_' + n.toLowerCase());
    return Promise.resolve();
  },

  /* ---- papan skor ---- */
  async getLeaderboard() {
    if (this.mode === 'server') {
      const d = await api('api/leaderboard');
      return d.leaderboard || [];
    }
    const raw = localStorage.getItem('ss_leaderboard');
    let rows = [];
    try { rows = raw ? JSON.parse(raw) : []; } catch (e) { rows = []; }
    rows.sort((a, b) => (b.score - a.score) || (b.stage - a.stage));
    return rows.slice(0, 20);
  },

  async submitScore(entry) {
    if (this.mode === 'server') {
      const d = await api('api/leaderboard', { method: 'POST', body: JSON.stringify(entry) });
      return d.rank;
    }
    const raw = localStorage.getItem('ss_leaderboard');
    let rows = [];
    try { rows = raw ? JSON.parse(raw) : []; } catch (e) { rows = []; }
    entry.time = Date.now();
    rows.push(entry);
    rows.sort((a, b) => (b.score - a.score) || (b.stage - a.stage));
    rows = rows.slice(0, 100);
    try { localStorage.setItem('ss_leaderboard', JSON.stringify(rows)); } catch (e) {}
    const rank = 1 + rows.filter(r =>
      (r.score > entry.score) || (r.score === entry.score && r.stage > entry.stage)
    ).length;
    return rank;
  },
};

let toastT = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2300);
}

let bannerT = null;
function banner(title, sub) {
  $('#bTitle').textContent = title;
  $('#bSub').textContent = sub || '';
  const b = $('#banner');
  b.classList.remove('show');
  void b.offsetWidth;
  b.classList.add('show');
  clearTimeout(bannerT);
  bannerT = setTimeout(() => b.classList.remove('show'), 1700);
}

function confirmBox(msg) {
  return new Promise(resolve => {
    $('#confMsg').textContent = msg;
    $('#confirmBox').classList.remove('hidden');
    const ok = $('#confOk'), no = $('#confCancel');
    const done = v => {
      $('#confirmBox').classList.add('hidden');
      ok.onclick = no.onclick = null;
      resolve(v);
    };
    ok.onclick = () => { SFX.sfx.tap(); done(true); };
    no.onclick = () => { SFX.sfx.tap(); done(false); };
  });
}

/* ---------------- navigasi ---------------- */
function go(id) {
  const cur = $('#scr-' + App.activeScreen);
  const nxt = $('#scr-' + id);
  if (!nxt || cur === nxt) return;
  App.activeScreen = id;
  if (cur) cur.classList.remove('active');
  nxt.classList.add('active');
  if (id === 'lb') loadLb();
  if (id === 'admin') refreshAdminUI();
  if (id === 'home') checkResumeBtn();
  if (id === 'game') App.hudSync(true);
}

/* ---------------- splash ---------------- */
function bindSplash() {
  const done = () => {
    if (App.activeScreen !== 'splash') return;
    SFX.ensure();
    SFX.sfx.splash();
    go('home');
  };
  $('#scr-splash').addEventListener('click', () => { SFX.ensure(); SFX.sfx.tap(); done(); });
  setTimeout(done, 3000);
}

/* ---------------- home ---------------- */
function bindHome() {
  $('#btnPlay').addEventListener('click', () => { SFX.sfx.tap(); go('name'); onNameScreen(); });
  $('#btnContinue').addEventListener('click', () => { SFX.sfx.tap(); resumeSession(); });
  $('#btnScore').addEventListener('click', () => { SFX.sfx.tap(); go('lb'); });
  $('#btnFitur').addEventListener('click', () => { SFX.sfx.tap(); go('fitur'); });
  $('#btnAdmin').addEventListener('click', () => { SFX.sfx.tap(); go('admin'); });
  $('#btnSound').addEventListener('click', () => {
    const m = SFX.toggle();
    $('#sndIco').textContent = m ? '🔇' : '🔊';
    $('#sndLabel').textContent = m ? 'Senyap' : 'Suara';
    if (!m) SFX.sfx.tap();
    toast(m ? 'Suara dimatikan' : 'Suara menyala 🔊');
  });
  if (SFX.isMuted()) { $('#sndIco').textContent = '🔇'; $('#sndLabel').textContent = 'Senyap'; }
  $$('[data-back]').forEach(b => b.addEventListener('click', () => {
    SFX.sfx.tap();
    go(b.dataset.back);
  }));
}

async function checkResumeBtn() {
  const btn = $('#btnContinue');
  if (!App.name) { btn.classList.add('hidden'); return; }
  try {
    const s = await Store.getSession(App.name);
    if (s) {
      btn.classList.remove('hidden');
      $('#contInfo').textContent = 'Level ' + s.stage + ' • Skor ' + s.score + ' • ' + s.name;
    } else btn.classList.add('hidden');
  } catch (e) { btn.classList.add('hidden'); }
}

/* ---------------- layar nama ---------------- */
let nameCheckT = null;
function onNameScreen() {
  if (App.name) $('#inpName').value = App.name;
  checkNameInput();
}

function checkNameInput() {
  clearTimeout(nameCheckT);
  nameCheckT = setTimeout(async () => {
    const n = normName($('#inpName').value);
    if (!n) {
      $('#newBox').classList.remove('hidden');
      $('#resumeBox').classList.add('hidden');
      return;
    }
    App.name = n;
    try {
      const d = await Store.getSession(n);
      if (d) {
      $('#newBox').classList.add('hidden');
      $('#resumeBox').classList.remove('hidden');
      $('#resumeInfo').textContent = 'Oh! Petualangan ' + d.name + ' tersimpan di Level ' + d.stage + ' (skor ' + d.score + ').';
      } else {
        $('#newBox').classList.remove('hidden');
        $('#resumeBox').classList.add('hidden');
      }
    } catch (e) {
      $('#newBox').classList.remove('hidden');
      $('#resumeBox').classList.add('hidden');
    }
  }, 350);
}

function bindName() {
  $('#inpName').addEventListener('input', checkNameInput);
  $('#inpName').addEventListener('keydown', e => { if (e.key === 'Enter') startNew(); });
  $('#btnStart').addEventListener('click', startNew);
  $('#btnResume').addEventListener('click', () => { SFX.sfx.tap(); resumeSession(); });
  $('#btnRestart').addEventListener('click', async () => {
    SFX.sfx.tap();
    const n = normName($('#inpName').value) || App.name;
    if (n && (await confirmBox('Mulai petualangan baru untuk ' + n + '? Progress lama akan dihapus.'))) startNew();
  });
  $('#btnDelete').addEventListener('click', async () => {
    const n = normName($('#inpName').value) || App.name;
    if (!n) return;
    if (await confirmBox('Hapus semua progress ' + n + '?')) {
      try { await Store.deleteSession(n); } catch (e) {}
      toast('Progress dihapus 🗑️');
      checkNameInput();
    }
  });
  $('#btnBackName').addEventListener('click', () => { SFX.sfx.tap(); go('home'); });
}

function startNew() {
  const n = normName($('#inpName').value);
  if (!n) { toast('Tulis namamu dulu ya 😊'); SFX.sfx.wrong(); return; }
  SFX.sfx.tap();
  App.name = n;
  localStorage.setItem('ss_name', n);
  App.S = { name: n, stage: 1, lives: 3, score: 0, coinsGot: 0, used: [], seed: (Math.random() * 1e9) | 0 };
  Store.deleteSession(n);
  saveSession();
  go('game');
  Game.setupStage(1, App.S.seed, null);
  SFX.sfx.stage();
  banner('LEVEL 1 — MULAI! 🏃', 'Tahan tombol panah / usap labirin. Cari 🌀!');
}

async function resumeSession() {
  if (!App.name) { go('name'); onNameScreen(); return; }
  try {
    const s = await Store.getSession(App.name);
    if (!s) { toast('Sesi tidak ditemukan, ayo mulai baru!'); go('name'); onNameScreen(); return; }
    App.S = {
      name: s.name, stage: s.stage, lives: s.lives, score: s.score,
      coinsGot: s.coins, used: s.usedQuestions || [],
      seed: s.seed || ((Math.random() * 1e9) | 0),
    };
    SFX.sfx.tap();
    go('game');
    Game.setupStage(App.S.stage, App.S.seed, { lives: App.S.lives, score: App.S.score, coinsGot: App.S.coinsGot });
    banner('LEVEL ' + App.S.stage + ' — LANJUT! 🏃', 'Halo lagi, ' + App.S.name + '!');
  } catch (e) { toast('Gagal memuat sesi. Coba mulai baru.'); }
}

function saveSession() {
  if (!App.S) return;
  Store.saveSession(App.S.name, {
    stage: App.S.stage, lives: App.S.lives, score: Game.score,
    coins: App.S.coinsGot, seed: App.S.seed, usedQuestions: App.S.used,
  });
}

/* ---------------- HUD ---------------- */
const _hudCache = {};
function hudSet(id, txt) {
  if (_hudCache[id] !== txt) { _hudCache[id] = txt; const el = $('#' + id); if (el) el.textContent = txt; }
}

App.hudSync = function () {
  const g = Game;
  if (!g.cells) return;
  hudSet('hudStage', 'Level ' + g.stage);
  hudSet('hudLives', '❤️'.repeat(Math.max(0, Math.min(3, g.lives))) + '🖤'.repeat(Math.max(0, 3 - Math.min(3, g.lives))));
  hudSet('hudScore', String(g.score));
  hudSet('hudCoins', '🪙 ' + g.coinsGot);
  const frac = Math.max(0, g.timeLeft / g.timeMax);
  const fill = $('#timeFill');
  fill.style.width = (frac * 100).toFixed(1) + '%';
  fill.classList.toggle('low', g.timeLeft < 10);
  hudSet('timeNum', String(Math.ceil(g.timeLeft)));
};

/* ---------------- callback game ---------------- */
Game.cb.onStageCleared = function (stage) {
  App.S.lives = Game.lives;
  App.S.score = Game.score;
  App.S.coinsGot = Game.coinsGot;
  saveSession();
  Fx.burst(window.innerWidth / 2, window.innerHeight * 0.42, 34);
  banner('LEVEL ' + stage + ' LOLOS! 🎉', '+100 poin! Sekarang jawab soalnya...');
  setTimeout(openQuestion, 1500);
};

Game.cb.onLifeLost = function (reason, lives) {
  if (App.S) App.S.lives = lives;
  saveSession();
};

Game.cb.onGameOver = function () {
  showResult(false);
};

/* ---------------- soal ---------------- */
const QTIME = 20;
let qTimer = null;
let qRemaining = 0;

async function ensureQuestions() {
  if (App.questions.length) return;
  try {
    App.questions = await Store.loadQuestions();
  } catch (e) { App.questions = []; }
}

async function openQuestion() {
  await ensureQuestions();
  if (!App.questions.length) {
    toast('⚠️ Belum ada soal. Guru, silakan tambah lewat menu Admin.');
    advanceAfterQuestion();
    return;
  }
  let pool = App.questions.filter(q => !App.S.used.includes(q.id));
  if (!pool.length) { App.S.used = []; pool = App.questions.slice(); }
  const q = pool[(Math.random() * pool.length) | 0];
  App.S.used.push(q.id);
  const order = q.choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [order[i], order[j]] = [order[j], order[i]];
  }
  openQuestionUI(q, order, false);
}

function openQuestionUI(q, order, preview) {
  App.qState = { q, preview, locked: false, ok: false, correctIdx: order.indexOf(q.answer) };
  const catEl = $('#qcat');
  catEl.textContent = q.category;
  catEl.className = 'cat ' + (q.category === 'Sejarah' ? 'cat-sejarah' : q.category === 'Kearifan Lokal' ? 'cat-kearifan' : 'cat-budaya');
  $('#qdiff').textContent = '★'.repeat(q.difficulty) + '☆'.repeat(3 - q.difficulty);
  $('#qtext').textContent = q.question;

  const wrap = $('#qopts');
  wrap.innerHTML = '';
  order.forEach((orig, pos) => {
    const b = document.createElement('button');
    b.className = 'qopt';
    const letEl = document.createElement('span');
    letEl.className = 'qlet';
    letEl.textContent = String.fromCharCode(65 + pos);
    const txtEl = document.createElement('span');
    txtEl.className = 'qtxt';
    txtEl.textContent = q.choices[orig] || '—';
    b.appendChild(letEl); b.appendChild(txtEl);
    b.addEventListener('click', () => answerQuestion(pos));
    wrap.appendChild(b);
  });

  $('#qexpl').classList.add('hidden');
  $('#qnext').classList.add('hidden');
  $('#qmodal').classList.remove('hidden');
  SFX.sfx.tap();
  startQTimer();
}

function startQTimer() {
  stopQTimer();
  qRemaining = QTIME;
  renderQTimer();
  qTimer = setInterval(() => {
    qRemaining -= 0.1;
    if (qRemaining <= 0) { qRemaining = 0; renderQTimer(); answerQuestion(-1); return; }
    renderQTimer();
  }, 100);
}

function stopQTimer() { if (qTimer) { clearInterval(qTimer); qTimer = null; } }

function renderQTimer() {
  const r = 17, C = 2 * Math.PI * r;
  const ring = $('#qring');
  ring.style.strokeDashoffset = (C * (1 - qRemaining / QTIME)).toFixed(1);
  ring.style.stroke = qRemaining < 6 ? '#EF476F' : '#0E7C86';
  $('#qtl').textContent = Math.ceil(qRemaining);
}

function answerQuestion(i) {
  const st = App.qState;
  if (!st || st.locked) return;
  st.locked = true;
  stopQTimer();
  const btns = $$('#qopts .qopt');
  btns.forEach(b => { b.disabled = true; });
  const ok = i === st.correctIdx;
  st.ok = ok;

  if (ok) {
    btns[st.correctIdx].classList.add('correct');
    SFX.sfx.correct();
    vibrate([30, 50, 30]);
    Fx.burst(window.innerWidth / 2, window.innerHeight * 0.5, 26);
    if (!st.preview) {
      Game.score += 50;
      if (App.S) App.S.score = Game.score;
      toast('+50 poin! Jawaban benar ✅');
    }
  } else {
    if (i >= 0) btns[i].classList.add('wrong');
    btns[st.correctIdx].classList.add('correct');
    btns.forEach((b, j) => { if (j !== st.correctIdx && j !== i) b.classList.add('dim'); });
    SFX.sfx.wrong();
    vibrate(120);
    if (!st.preview && App.S) {
      Game.lives--;
      App.S.lives = Game.lives;
      App.hudSync(true);
      toast(i < 0 ? '⏰ Waktu habis!' : '❌ Belum tepat. Pelajari lagi ya!');
    }
  }

  const e = $('#qexpl');
  const expl = st.q.explanation || '';
  e.textContent = expl;
  e.classList.toggle('hidden', !expl);
  const nb = $('#qnext');
  nb.classList.remove('hidden');
  nb.textContent = st.preview ? 'Tutup' : 'Lanjut ▶';
}

function advanceAfterQuestion() {
  if (!App.S) return;
  saveSession();
  if (App.S.lives <= 0) { showResult(false); return; }
  if (App.S.stage >= MAX_STAGE) { showResult(true); return; }
  App.S.stage++;
  Game.setupStage(App.S.stage, App.S.seed, {
    lives: App.S.lives, score: Game.score, coinsGot: App.S.coinsGot,
  });
  banner('LEVEL ' + App.S.stage + ' — MULAI! 🏃', 'Labirin makin besar... awas ya!');
}

/* ---------------- tombol lanjut di modal soal ---------------- */
function bindQuestion() {
  $('#qnext').addEventListener('click', () => {
    SFX.sfx.tap();
    stopQTimer();
    $('#qmodal').classList.add('hidden');
    if (App.qState && !App.qState.preview) advanceAfterQuestion();
  });
}

/* ---------------- jeda ---------------- */
function openPause() {
  if (App.activeScreen !== 'game' || Game.state !== 'playing' || !$('#pauseov').classList.contains('hidden')) return;
  Game.paused = true;
  Game.holdDir = null;
  Game._pressed.clear();
  if (window.__resetDpad) window.__resetDpad();
  $('#pauseInfo').textContent = 'Level ' + Game.stage + ' • Skor ' + Game.score + ' • Nyawa ' + Game.lives;
  $('#pauseov').classList.remove('hidden');
  SFX.sfx.tap();
}

function closePause() {
  $('#pauseov').classList.add('hidden');
  Game.paused = false;
}

function bindPause() {
  $('#btnPause').addEventListener('click', openPause);
  $('#btnResumeGame').addEventListener('click', () => { SFX.sfx.tap(); closePause(); });
  $('#btnRestartStage').addEventListener('click', () => {
    SFX.sfx.tap();
    const st = Game.stage;
    Game.setupStage(st, Game.seed, { lives: Game.lives, score: Game.score, coinsGot: Game.coinsGot });
    closePause();
    banner('LEVEL ' + st + ' DIULANGI 🔁', 'Semangat lagi!');
    if (App.S) { App.S.stage = st; saveSession(); }
  });
  $('#btnExitSave').addEventListener('click', () => {
    SFX.sfx.tap();
    if (App.S) saveSession();
    Game.state = 'idle';
    Game.paused = true;
    $('#pauseov').classList.add('hidden');
    go('home');
    toast('💾 Progres tersimpan, ' + (App.S ? App.S.name : '') + '!');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) openPause();
  });
}

/* ---------------- hasil ---------------- */
function bindResult() {
  $('#btnAgain').addEventListener('click', () => { SFX.sfx.tap(); go('name'); onNameScreen(); });
  $('#btnHome').addEventListener('click', () => { SFX.sfx.tap(); go('home'); });
}

function showResult(win) {
  Game.paused = true;
  Game.state = 'idle';
  const score = Game.score, stage = Game.stage, coins = Game.coinsGot;
  if (App.S) Store.deleteSession(App.S.name).catch(() => {});
  if (App.name) {
    Store.submitScore({ name: App.name, score, stage, completed: win })
      .then(rank => { $('#resRank').textContent = rank ? '#' + rank : '—'; })
      .catch(() => { $('#resRank').textContent = '—'; });
  }
  $('#resEmoji').textContent = win ? '🏆' : '💪';
  $('#resTitle').textContent = win ? 'Luar Biasa!' : 'Belum Berhasil!';
  $('#resSub').textContent = win
    ? 'Hebat, ' + App.name + '! Kamu lolos semua labirin dan jadi pahlawan Sidorjo! 🎊'
    : 'Jangan menyerah, ' + App.name + '! Coba lagi, kamu pasti bisa!';
  $('#resScore').textContent = String(score);
  $('#resStage').textContent = stage + '/' + MAX_STAGE;
  $('#resCoins').textContent = String(coins);
  $('#resRank').textContent = '…';
  go('result');
  if (win) {
    SFX.sfx.win();
    Fx.startRain();
    Fx.rainT = 6;
    setTimeout(() => Fx.stopRain(), 6500);
  } else {
    SFX.sfx.over();
  }
}

/* ---------------- leaderboard ---------------- */
async function loadLb() {
  const list = $('#lbList');
  list.innerHTML = '<div class="lb-empty">Memuat skor...</div>';
  try {
    const rows = await Store.getLeaderboard();
    if (!rows.length) {
      list.innerHTML = '<div class="lb-empty">🏆<br>Belum ada skor.<br>Jadilah yang pertama!</div>';
      return;
    }
    list.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    rows.slice(0, 10).forEach((r, i) => {
      const div = document.createElement('div');
      div.className = 'lbrow' + (i < 3 ? ' r' + (i + 1) : '') +
        (App.name && r.name.toLowerCase() === App.name.toLowerCase() ? ' me' : '');
      div.style.animationDelay = (i * 0.05) + 's';
      const rk = document.createElement('span'); rk.className = 'rk';
      rk.textContent = i < 3 ? medals[i] : '#' + (i + 1);
      const nm = document.createElement('span'); nm.className = 'nm';
      nm.textContent = r.name;
      if (r.completed) { const sm = document.createElement('small'); sm.textContent = '🏁 selesai semua'; nm.appendChild(sm); }
      const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = r.score;
      const st = document.createElement('span'); st.className = 'st'; st.textContent = 'Lv ' + r.stage;
      div.appendChild(rk); div.appendChild(nm); div.appendChild(sc); div.appendChild(st);
      list.appendChild(div);
    });
  } catch (e) {
    list.innerHTML = '<div class="lb-empty">Gagal memuat skor.</div>';
  }
}

function bindLb() {
  $('#btnLbRefresh').addEventListener('click', () => { SFX.sfx.tap(); loadLb(); });
}

/* ---------------- ADMIN ---------------- */
let adminQs = [];

function refreshAdminUI() {
  if (Store.mode === 'local') {
    $('#adminOffline').classList.remove('hidden');
    $('#adminLogin').classList.add('hidden');
    $('#adminMain').classList.add('hidden');
    $('#adminBadge').classList.add('hidden');
    return;
  }
  const logged = !!App.adminToken;
  $('#adminOffline').classList.add('hidden');
  $('#adminLogin').classList.toggle('hidden', logged);
  $('#adminMain').classList.toggle('hidden', !logged);
  $('#adminBadge').classList.toggle('hidden', !logged);
  if (logged) loadQList();
}

function showAdminLogin() {
  App.adminToken = '';
  localStorage.removeItem('ss_admin');
  refreshAdminUI();
}

function bindAdmin() {
  $('#btnAdminLogin').addEventListener('click', adminLogin);
  $('#adminPw').addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
  $('#btnAdminOut').addEventListener('click', () => { SFX.sfx.tap(); showAdminLogin(); toast('Keluar dari mode admin'); });
  $('#btnQAdd').addEventListener('click', () => { SFX.sfx.tap(); openQForm(null); });
  $('#qfCancel').addEventListener('click', () => { SFX.sfx.tap(); $('#qForm').classList.add('hidden'); });
  $('#qfSave').addEventListener('click', saveQForm);
  $$('#qfAns input').forEach(r => r.addEventListener('change', () => {
    $$('#qfAns label').forEach(l => l.classList.remove('sel'));
    r.closest('label').classList.add('sel');
  }));
  $('#btnAdminPw').addEventListener('click', () => {
    SFX.sfx.tap();
    $('#pwOld').value = ''; $('#pwNew').value = ''; $('#pwNew2').value = '';
    $('#pwForm').classList.remove('hidden');
  });
  $('#pwCancel').addEventListener('click', () => { SFX.sfx.tap(); $('#pwForm').classList.add('hidden'); });
  $('#pwSave').addEventListener('click', async () => {
    const o = $('#pwOld').value, n1 = $('#pwNew').value, n2 = $('#pwNew2').value;
    if (n1 !== n2) { toast('Sandi baru tidak sama ✋'); return; }
    try {
      await adminApi('api/admin/password', { method: 'POST', body: JSON.stringify({ current: o, new: n1 }) });
      $('#pwForm').classList.add('hidden');
      SFX.sfx.correct();
      toast('Kata sandi admin diganti 🔑');
    } catch (e) { SFX.sfx.wrong(); toast(e.message); }
  });
}

async function adminLogin() {
  const pw = $('#adminPw').value;
  try {
    const d = await api('api/admin/login', { method: 'POST', body: JSON.stringify({ password: pw }) });
    App.adminToken = d.token;
    localStorage.setItem('ss_admin', d.token);
    SFX.sfx.correct();
    toast('Halo, Pak/Bu Guru! 👨‍🏫');
    refreshAdminUI();
  } catch (e) {
    SFX.sfx.wrong();
    toast('Kata sandi salah ❌');
  }
}

async function loadQList() {
  const list = $('#qList');
  try {
    const d = await adminApi('api/questions');
    adminQs = d.questions || [];
    $('#qCount').textContent = adminQs.length + ' soal';
    list.innerHTML = '';
    if (!adminQs.length) {
      list.innerHTML = '<div class="lb-empty">Belum ada soal. Tekan ➕ Soal Baru.</div>';
      return;
    }
    adminQs.forEach(q => {
      const div = document.createElement('div');
      div.className = 'qitem';
      const top = document.createElement('div'); top.className = 'qitem-top';
      const cat = document.createElement('span');
      cat.className = 'cat ' + (q.category === 'Sejarah' ? 'cat-sejarah' : q.category === 'Kearifan Lokal' ? 'cat-kearifan' : 'cat-budaya');
      cat.textContent = q.category;
      const df = document.createElement('span'); df.className = 'qdiff';
      df.textContent = '★'.repeat(q.difficulty);
      const del = document.createElement('button'); del.className = 'qdel'; del.textContent = '🗑️';
      del.addEventListener('click', () => deleteQ(q));
      top.appendChild(cat); top.appendChild(df); top.appendChild(del);
      const p = document.createElement('p'); p.textContent = q.question;
      const act = document.createElement('div'); act.className = 'qitem-actions';
      const bTry = document.createElement('button'); bTry.className = 'btn sm ghost'; bTry.textContent = '▶️ Coba';
      bTry.addEventListener('click', () => { SFX.sfx.tap(); openQuestionUI(q, q.choices.map((_, i) => i), true); });
      const bEd = document.createElement('button'); bEd.className = 'btn sm ghost'; bEd.textContent = '✏️ Edit';
      bEd.addEventListener('click', () => { SFX.sfx.tap(); openQForm(q.id); });
      act.appendChild(bTry); act.appendChild(bEd);
      div.appendChild(top); div.appendChild(p); div.appendChild(act);
      list.appendChild(div);
    });
  } catch (e) {
    toast(e.message || 'Gagal memuat soal');
  }
}

async function deleteQ(q) {
  if (!(await confirmBox('Hapus soal ini?\n"' + q.question.slice(0, 70) + '..."'))) return;
  try {
    await adminApi('api/questions/' + q.id, { method: 'DELETE' });
    SFX.sfx.tap();
    toast('Soal dihapus 🗑️');
    loadQList();
  } catch (e) { SFX.sfx.wrong(); toast(e.message); }
}

function openQForm(id) {
  const q = id ? adminQs.find(x => x.id === id) : null;
  $('#qfTitle').textContent = q ? '✏️ Edit Soal' : '➕ Soal Baru';
  $('#qfCat').value = q ? q.category : 'Sejarah';
  $('#qfDiff').value = q ? String(q.difficulty) : '1';
  $('#qfQ').value = q ? q.question : '';
  const ch = q ? q.choices : ['', '', '', ''];
  $('#qfA').value = ch[0] || ''; $('#qfB').value = ch[1] || '';
  $('#qfC').value = ch[2] || ''; $('#qfD').value = ch[3] || '';
  $('#qfExpl').value = q ? (q.explanation || '') : '';
  const ans = q ? q.answer : 0;
  $$('#qfAns input').forEach(r => {
    const on = +r.value === ans;
    r.checked = on;
    r.closest('label').classList.toggle('sel', on);
  });
  $('#qForm').dataset.editId = id || '';
  $('#qForm').classList.remove('hidden');
}

async function saveQForm() {
  const ans = +($$('#qfAns input').find(r => r.checked) || { value: 0 }).value;
  const body = {
    category: $('#qfCat').value,
    difficulty: +$('#qfDiff').value,
    question: $('#qfQ').value,
    choices: [$('#qfA').value, $('#qfB').value, $('#qfC').value, $('#qfD').value],
    answer: ans,
    explanation: $('#qfExpl').value,
  };
  const editId = $('#qForm').dataset.editId;
  try {
    if (editId) {
      await adminApi('api/questions/' + editId, { method: 'PUT', body: JSON.stringify(body) });
      toast('Soal diperbarui ✅');
    } else {
      await adminApi('api/questions', { method: 'POST', body: JSON.stringify(body) });
      toast('Soal ditambahkan ✅');
    }
    SFX.sfx.correct();
    $('#qForm').classList.add('hidden');
    loadQList();
  } catch (e) {
    SFX.sfx.wrong();
    toast(e.message || 'Gagal menyimpan');
  }
}

/* ---------------- input game (sentuh & keyboard) ---------------- */
function bindGameInput() {
  const cv = $('#maze');

  // d-pad: input GANDA touch + mouse.
  // Dipilih dibanding Pointer Events karena beberapa browser HP lama &
  // WebView (Chrome tab-in-app, browser bawaan Android versi lama) tidak
  // mendukung Pointer Events → tombol jadi "mati". Touch event didukung
  // semua browser HP; mouse untuk desktop.
  // ketuk singkat = 1 langkah; tahan = jalan terus
  $$('#dpad .dkey').forEach(k => {
    const dir = k.dataset.dir;
    let down = false;
    let lastTouch = 0;

    const start = e => {
      // abaikan "mouse palsu" yang muncul setelah sentuhan (anti ganda)
      if (e.type === 'mousedown' && Date.now() - lastTouch < 700) return;
      if (e.type === 'mousedown' && e.button !== 0) return;
      if (down) return;
      down = true;
      try { e.preventDefault(); } catch (err) { /* abaikan */ }
      k.classList.add('pressed');
      Game.press(dir);
    };
    const stop = e => {
      if (!down) return;
      down = false;
      try { e.preventDefault(); } catch (err) { /* abaikan */ }
      k.classList.remove('pressed');
      Game.release(dir);
    };

    // sentuh (input utama di HP)
    k.addEventListener('touchstart', e => { lastTouch = Date.now(); start(e); }, { passive: false });
    k.addEventListener('touchend', stop, { passive: false });
    k.addEventListener('touchcancel', stop, { passive: false });
    // mouse (desktop / komputer)
    k.addEventListener('mousedown', start);
    k.addEventListener('mouseleave', stop);
    window.addEventListener('mouseup', stop);
    // menu kanan saat tahan lama di layar sentuh
    k.addEventListener('contextmenu', e => e.preventDefault());
    k._resetInput = () => {
      if (down) { down = false; k.classList.remove('pressed'); }
      Game.release(dir);
    };
  });

  // reset semua tombol saat jeda / layar berubah (anti tombol "nyangkut")
  window.__resetDpad = () => $$('#dpad .dkey').forEach(k => k._resetInput && k._resetInput());

  // usap di atas labirin
  let sw = null;
  cv.addEventListener('touchstart', e => {
    const t = e.changedTouches[0];
    sw = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  cv.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!sw) return;
    const t = e.touches[0];
    const dx = t.clientX - sw.x, dy = t.clientY - sw.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : (dy > 0 ? 's' : 'n');
    Game.queueStep(dir);
    sw = { x: t.clientX, y: t.clientY };
  }, { passive: false });
  cv.addEventListener('contextmenu', e => e.preventDefault());

  // keyboard (untuk uji di komputer)
  const km = {
    ArrowUp: 'n', KeyW: 'n',
    ArrowDown: 's', KeyS: 's',
    ArrowLeft: 'w', KeyA: 'w',
    ArrowRight: 'e', KeyD: 'e',
  };
  window.addEventListener('keydown', e => {
    const d = km[e.code];
    if (d) { e.preventDefault(); Game.press(d); }
  });
  window.addEventListener('keyup', e => {
    const d = km[e.code];
    if (d) Game.release(d);
  });
}

/* ---------------- anti pull-to-refresh ---------------- */
function bindScrollGuard() {
  // halaman ini sengaja TIDAK bisa digulir (layout fixed penuh).
  // Yang boleh digulir hanya area ber-class .pane (daftar admin/skor/fitur/form).
  document.addEventListener('touchmove', e => {
    if (e.target && e.target.closest && e.target.closest('.pane')) return;
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => {
    if (e.target.closest && !e.target.closest('input,textarea,select')) e.preventDefault();
  });

  // jangan zoom/pull saat memuncak di area .pane
  $$('.pane').forEach(el => {
    el.addEventListener('touchmove', () => {}, { passive: true });
  });
}

/* ---------------- init ---------------- */
async function init() {
  Fx.init();
  bindSplash();
  bindQuestion();
  bindHome();
  bindName();
  bindGameInput();
  bindLb();
  bindAdmin();
  bindPause();
  bindResult();
  bindScrollGuard();

  // deteksi mode: server Python ada, atau mode HP (GitHub Pages)
  await Store.init();
  if (Store.mode === 'local') {
    setTimeout(() => toast('📱 Mode HP: progres tersimpan di HP ini. Untuk skor bersama, jalankan di PC (python app.py).'), 1200);
  }

  // muat bank soal
  ensureQuestions().catch(() => {});

  if (App.name) $('#inpName').value = App.name;
  checkResumeBtn();
}

document.addEventListener('DOMContentLoaded', init);
