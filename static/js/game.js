/* ============================================================
   GAME SURVIVAL LABIRIN — mesin game
   Labirin dibuat prosedural (seed bisa diulang untuk
   melanjutkan sesi), monster berburu memakai BFS,
   player dikontrol tombol layar / usap / keyboard.
   ============================================================ */
'use strict';

/* ---- konfigurasi level (bisa diubah di sini) ---- */
const STAGES = [
  { cols: 9,  rows: 9,  monsters: 1, time: 50 },
  { cols: 11, rows: 11, monsters: 2, time: 60 },
  { cols: 13, rows: 13, monsters: 2, time: 65 },
  { cols: 15, rows: 15, monsters: 3, time: 75 },
  { cols: 17, rows: 17, monsters: 3, time: 85 },
  { cols: 19, rows: 19, monsters: 4, time: 95 },
];
const MAX_STAGE = STAGES.length;

/* ---------------- RNG & labirin ---------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRS = {
  n: { x: 0, y: -1, w: 'n', o: 's' },
  e: { x: 1, y: 0, w: 'e', o: 'w' },
  s: { x: 0, y: 1, w: 's', o: 'n' },
  w: { x: -1, y: 0, w: 'w', o: 'e' },
};
const DIR_LIST = ['n', 'e', 's', 'w'];

function genMaze(cols, rows, rng) {
  const cells = [];
  for (let y = 0; y < rows; y++) {
    const r = [];
    for (let x = 0; x < cols; x++) r.push({ n: true, e: true, s: true, w: true });
    cells.push(r);
  }
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const stack = [[0, 0]];
  visited[0][0] = true;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const opts = [];
    for (const k of DIR_LIST) {
      const d = DIRS[k], nx = cx + d.x, ny = cy + d.y;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !visited[ny][nx]) opts.push(k);
    }
    if (!opts.length) { stack.pop(); continue; }
    const k = opts[(rng() * opts.length) | 0], d = DIRS[k];
    const nx = cx + d.x, ny = cy + d.y;
    cells[cy][cx][d.w] = false;
    cells[ny][nx][d.o] = false;
    visited[ny][nx] = true;
    stack.push([nx, ny]);
  }
  // buka beberapa "jalan pintas" agar tetap seru tapi tidak frustrasi
  const extra = Math.floor(cols * rows * 0.07);
  for (let i = 0; i < extra; i++) {
    const x = (rng() * cols) | 0, y = (rng() * rows) | 0;
    const k = DIR_LIST[(rng() * 4) | 0], d = DIRS[k];
    const nx = x + d.x, ny = y + d.y;
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
    if (!cells[y][x][d.w]) continue;
    cells[y][x][d.w] = false;
    cells[ny][nx][d.o] = false;
  }
  return cells;
}

function bfsDist(cells, cols, rows, sx, sy) {
  const dist = Array.from({ length: rows }, () => Array(cols).fill(-1));
  const q = [[sx, sy]];
  dist[sy][sx] = 0;
  let head = 0;
  while (head < q.length) {
    const [x, y] = q[head++];
    for (const k of DIR_LIST) {
      if (cells[y][x][DIRS[k].w]) continue;
      const nx = x + DIRS[k].x, ny = y + DIRS[k].y;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (dist[ny][nx] !== -1) continue;
      dist[ny][nx] = dist[y][x] + 1;
      q.push([nx, ny]);
    }
  }
  return dist;
}

/* ---------------- objek game ---------------- */
const Game = {
  canvas: null, ctx: null, wrap: null,
  cells: null, cols: 9, rows: 9,
  stage: 1, seed: 0, rng: null,
  px: 0, py: 0, safeX: 0, safeY: 0, facing: 1,
  monsters: [], coins: new Set(), coinsGot: 0,
  lives: 3, score: 0,
  timeMax: 50, timeLeft: 50,
  state: 'idle', paused: false,
  invuln: 0, holdDir: null, _holdUntil: 0,
  playerAcc: 0, popups: [], _flash: 0, _lastSec: 99,
  STEP: 0.14,
  cb: {},

  init() {
    this.canvas = document.getElementById('maze');
    this.ctx = this.canvas.getContext('2d');
    this.wrap = document.getElementById('mazeWrap');
  },

  /* bangun ulang stage deterministik dari seed */
  setupStage(stage, seed, keep) {
    const cfg = STAGES[stage - 1];
    this.stage = stage;
    this.cols = cfg.cols; this.rows = cfg.rows;
    this.seed = seed;
    this.rng = mulberry32(((seed ^ 0x9E3779B9) >>> 0) + stage * 101);
    this.cells = genMaze(this.cols, this.rows, this.rng);
    this.px = 0; this.py = 0; this.safeX = 0; this.safeY = 0; this.facing = 1;

    // koin
    this.coins = new Set();
    const target = Math.min(14, 3 + stage * 2);
    let guard = 0;
    while (this.coins.size < target && guard++ < 900) {
      const x = (this.rng() * this.cols) | 0, y = (this.rng() * this.rows) | 0;
      if ((x === 0 && y === 0) || (x === this.cols - 1 && y === this.rows - 1)) continue;
      this.coins.add(x + '_' + y);
    }

    // monster (dijauhkan dari titik mulai)
    const dist = bfsDist(this.cells, this.cols, this.rows, 0, 0);
    const cand = [];
    for (let y = 0; y < this.rows; y++)
      for (let x = 0; x < this.cols; x++)
        if (dist[y][x] > (this.cols + this.rows) / 5) cand.push([x, y]);
    for (let i = cand.length - 1; i > 0; i--) {
      const j = (this.rng() * (i + 1)) | 0;
      [cand[i], cand[j]] = [cand[j], cand[i]];
    }
    this.monsters = [];
    for (let i = 0; i < cfg.monsters && i < cand.length; i++) {
      this.monsters.push({
        x: cand[i][0], y: cand[i][1],
        acc: this.rng() * 0.3,
        stepInt: Math.max(0.42, 0.52 - stage * 0.02 + this.rng() * 0.2),
        prev: '', ai: 0, dist: null,
      });
    }

    this.timeMax = cfg.time;
    this.timeLeft = cfg.time;
    if (keep) {
      this.lives = keep.lives; this.score = keep.score; this.coinsGot = keep.coinsGot;
    } else {
      this.lives = 3; this.score = 0; this.coinsGot = 0;
    }
    this.invuln = 1.5;
    this.playerAcc = 0;
    this.popups = [];
    this._flash = 0;
    this._lastSec = this.timeLeft;
    this.holdDir = null;
    this.state = 'playing';
    this.paused = false;
  },

  setHold(d) { if (this.state === 'playing' && !this.paused) this.holdDir = d; },
  clearHold() { this.holdDir = null; },
  queueStep(d) { this.holdDir = d; this._holdUntil = performance.now() + 260; },

  update(dt) {
    if (this.state !== 'playing') return;
    this.timeLeft -= dt;
    const sec = Math.ceil(this.timeLeft);
    if (sec !== this._lastSec) {
      this._lastSec = sec;
      if (sec <= 10 && sec > 0) SFX.sfx.tick();
    }
    if (this.timeLeft <= 0) { this.timeLeft = 0; this._loseLife('time'); return; }

    // gerak pemain
    this.playerAcc += dt;
    if (this.holdDir) {
      let guardN = 0;
      while (this.playerAcc >= this.STEP && this.state === 'playing' && guardN++ < 4) {
        this.playerAcc -= this.STEP;
        if (!this.tryMove(this.holdDir)) { this.playerAcc = 0; break; }
      }
    } else this.playerAcc = 0;

    if (this.invuln > 0) this.invuln -= dt;

    // monster
    for (const m of this.monsters) {
      m.acc += dt;
      if (m.acc >= m.stepInt && this.state === 'playing') {
        m.acc = 0;
        this._monsterStep(m);
      }
    }
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter(p => p.t < 0.9);
  },

  tryMove(dir) {
    const d = DIRS[dir];
    const c = this.cells[this.py][this.px];
    if (c[d.w]) return false;
    const nx = this.px + d.x, ny = this.py + d.y;
    if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) return false;
    this.safeX = this.px; this.safeY = this.py;
    this.px = nx; this.py = ny;
    if (dir === 'w') this.facing = -1;
    else if (dir === 'e') this.facing = 1;
    SFX.sfx.move();

    const key = nx + '_' + ny;
    if (this.coins.has(key)) {
      this.coins.delete(key);
      this.coinsGot++; this.score += 10;
      this.popups.push({ x: nx, y: ny, txt: '+10', t: 0, c: '#E89B05' });
      SFX.sfx.coin();
      vibrate(12);
    }
    for (const m of this.monsters) {
      if (m.x === nx && m.y === ny) this._hitPlayer();
    }
    if (this.state === 'playing' && nx === this.cols - 1 && ny === this.rows - 1) this._exit();
    return true;
  },

  _monsterStep(m) {
    m.ai -= 1;
    if (m.ai <= 0) {
      m.ai = 2;
      m.dist = bfsDist(this.cells, this.cols, this.rows, this.px, this.py);
    }
    const dmap = m.dist;
    let best = null, bd = Infinity;
    for (const k of DIR_LIST) {
      if (this.cells[m.y][m.x][DIRS[k].w]) continue;
      const nx = m.x + DIRS[k].x, ny = m.y + DIRS[k].y;
      if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
      const dd = (dmap && dmap[ny][nx] !== undefined && dmap[ny][nx] !== -1) ? dmap[ny][nx] : 1e9;
      if (dd < bd || (dd === bd && Math.random() < 0.5)) { bd = dd; best = k; }
    }
    if (best === null) { m.prev = m.prev; return; }
    // hindari bolak-balik kalau ada opsi lain yang setara
    if (m.prev && best === m.prev && Math.random() < 0.6) {
      const alt = [];
      for (const k of DIR_LIST) {
        if (k === m.prev) continue;
        if (this.cells[m.y][m.x][DIRS[k].w]) continue;
        const nx = m.x + DIRS[k].x, ny = m.y + DIRS[k].y;
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
        const dd = (dmap && dmap[ny][nx] !== undefined && dmap[ny][nx] !== -1) ? dmap[ny][nx] : 1e9;
        if (dd <= bd + 1) alt.push(k);
      }
      if (alt.length) best = alt[(Math.random() * alt.length) | 0];
    }
    m.prev = best;
    const d = DIRS[best];
    m.x += d.x; m.y += d.y;
    if (m.x === this.px && m.y === this.py) this._hitPlayer();
  },

  _hitPlayer() {
    if (this.invuln > 0 || this.state !== 'playing') return;
    this._loseLife('monster');
    if (this.state !== 'playing') return;
    this.px = this.safeX; this.py = this.safeY;
    this.invuln = 1.8;
  },

  _loseLife(reason) {
    if (this.state !== 'playing') return;
    this.lives--;
    this._flash = 0.6;
    SFX.sfx.hit();
    vibrate(reason === 'time' ? 60 : [40, 40, 40]);
    if (this.lives <= 0) {
      this.state = 'over';
      if (this.cb.onGameOver) this.cb.onGameOver();
      return;
    }
    if (reason === 'time') {
      const keep = { lives: this.lives, score: this.score, coinsGot: this.coinsGot };
      if (typeof toast === 'function') toast('⏰ Waktu habis! Level diulang...');
      this.setupStage(this.stage, this.seed, keep);
    }
    if (this.cb.onLifeLost) this.cb.onLifeLost(reason, this.lives);
  },

  _exit() {
    if (this.state !== 'playing') return;
    this.state = 'cleared';
    this.score += 100;
    SFX.sfx.stage();
    vibrate([40, 60, 40]);
    if (this.cb.onStageCleared) this.cb.onStageCleared(this.stage);
  },

  /* ---------------- render ---------------- */
  draw(t) {
    if (!this.cells || !this.ctx) return;
    const ctx = this.ctx, cv = this.canvas;
    const w = this.wrap.clientWidth, h = this.wrap.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cell = Math.floor(Math.min(w / this.cols, h / this.rows));
    const ox = Math.floor((w - cell * this.cols) / 2);
    const oy = Math.floor((h - cell * this.rows) / 2);
    this.cell = cell; this.ox = ox; this.oy = oy;

    // lantai
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#F6E9C6' : '#FBF2DA';
        ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }

    // gerbang pelarian
    const ex = ox + (this.cols - 1) * cell + cell / 2;
    const ey = oy + (this.rows - 1) * cell + cell / 2;
    const grd = ctx.createRadialGradient(ex, ey, cell * 0.05, ex, ey, cell * 0.62);
    grd.addColorStop(0, 'rgba(18,181,165,0.85)');
    grd.addColorStop(1, 'rgba(18,181,165,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(ex, ey, cell * 0.62, 0, 7); ctx.fill();
    const pr = cell * (0.3 + 0.05 * Math.sin(t / 300));
    ctx.strokeStyle = '#0E9488';
    ctx.lineWidth = Math.max(2, cell * 0.1);
    ctx.setLineDash([cell * 0.2, cell * 0.15]);
    ctx.lineDashOffset = -t / 40;
    ctx.beginPath(); ctx.arc(ex, ey, pr, 0, 7); ctx.stroke();
    ctx.setLineDash([]);

    // koin
    for (const key of this.coins) {
      const p = key.split('_');
      const x = +p[0], y = +p[1];
      const cx = ox + x * cell + cell / 2, cy = oy + y * cell + cell / 2;
      const r = cell * 0.24 * (1 + 0.08 * Math.sin(t / 250 + x * 3 + y));
      ctx.fillStyle = '#E8A40C';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#FFD966';
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.66, 0, 7); ctx.fill();
      ctx.strokeStyle = '#B8770A';
      ctx.lineWidth = Math.max(1, r * 0.16);
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.42, 0, 7); ctx.stroke();
    }

    // monster
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const m of this.monsters) {
      const cx = ox + m.x * cell + cell / 2;
      const cy = oy + m.y * cell + cell / 2 + Math.sin(t / 300 + m.x * 2 + m.y) * cell * 0.06;
      const g2 = ctx.createRadialGradient(cx, cy, cell * 0.05, cx, cy, cell * 0.55);
      g2.addColorStop(0, 'rgba(239,71,111,0.5)');
      g2.addColorStop(1, 'rgba(239,71,111,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(cx, cy, cell * 0.55, 0, 7); ctx.fill();
      ctx.font = Math.floor(cell * 0.78) + 'px "Noto Color Emoji","Apple Color Emoji",sans-serif';
      ctx.fillText('\u{1F47E}', cx, cy);
    }

    // pemain
    const pcx = ox + this.px * cell + cell / 2;
    const pcy = oy + this.py * cell + cell / 2 + Math.sin(t / 220) * cell * 0.05;
    if (this.invuln > 0) ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t / 90));
    ctx.save();
    ctx.translate(pcx, pcy);
    ctx.scale(this.facing, 1);
    ctx.font = Math.floor(cell * 0.82) + 'px "Noto Color Emoji","Apple Color Emoji",sans-serif';
    ctx.fillText('\u{1F9D2}', 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;

    // dinding
    ctx.strokeStyle = '#22406B';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, cell * 0.13);
    ctx.beginPath();
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const c = this.cells[y][x];
        const X = ox + x * cell, Y = oy + y * cell;
        if (c.n) { ctx.moveTo(X, Y); ctx.lineTo(X + cell, Y); }
        if (c.w) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + cell); }
        if (x === this.cols - 1 && c.e) { ctx.moveTo(X + cell, Y); ctx.lineTo(X + cell, Y + cell); }
        if (y === this.rows - 1 && c.s) { ctx.moveTo(X, Y + cell); ctx.lineTo(X + cell, Y + cell); }
      }
    }
    ctx.stroke();

    // tulisan poin melayang
    for (const p of this.popups) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 0.9);
      ctx.fillStyle = p.c;
      ctx.font = '800 ' + Math.max(12, cell * 0.5) + 'px "Baloo 2",Nunito,sans-serif';
      ctx.fillText(p.txt, ox + p.x * cell + cell / 2, oy + p.y * cell + cell * 0.35 - p.t * cell * 0.9);
      ctx.globalAlpha = 1;
    }

    // kilat merah saat tertangkap
    if (this._flash > 0) {
      ctx.fillStyle = 'rgba(239,71,111,' + (this._flash * 0.35).toFixed(3) + ')';
      ctx.fillRect(0, 0, w, h);
      this._flash -= 0.035;
    }
  },
};

/* ---------------- konfeti / efek partikel ---------------- */
const Fx = {
  cv: null, ctx: null, ps: [], mode: 'off', rainT: 0,
  COLORS: ['#FF6B35', '#FFD166', '#06D6A0', '#4ECDC4', '#EF476F', '#845EC2'],

  init() {
    this.cv = document.getElementById('fx');
    this.ctx = this.cv.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    if (!this.cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = window.innerWidth * dpr;
    this.cv.height = window.innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },

  burst(x, y, n) {
    for (let i = 0; i < (n || 30); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 280;
      this.ps.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 130,
        g: 430, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12,
        life: 0, max: 1 + Math.random() * 0.9,
        size: 5 + Math.random() * 6,
        c: this.COLORS[(Math.random() * this.COLORS.length) | 0],
        shape: Math.random() < 0.5 ? 'r' : 'c',
      });
    }
  },

  startRain() { this.mode = 'rain'; this.rainT = 0; },
  stopRain() { this.mode = 'off'; },

  updateDraw(dt) {
    if (!this.ctx) return;
    const ctx = this.ctx, w = window.innerWidth, h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    if (this.mode === 'rain' && this.rainT > 0) {
      for (let i = 0; i < 3; i++) {
        this.ps.push({
          x: Math.random() * w, y: -12,
          vx: (Math.random() - 0.5) * 70, vy: 90 + Math.random() * 130,
          g: 220, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10,
          life: 0, max: 4, size: 5 + Math.random() * 6,
          c: this.COLORS[(Math.random() * this.COLORS.length) | 0],
          shape: Math.random() < 0.5 ? 'r' : 'c',
        });
      }
      this.rainT -= dt;
    }
    this.ps = this.ps.filter(p => {
      p.life += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      return p.life < p.max && p.y < h + 24;
    });
    for (const p of this.ps) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.c;
      if (p.shape === 'r') ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
      else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },
};

/* ---------------- loop utama ---------------- */
let _lastT = performance.now();
function _loop(t) {
  const dt = Math.min(0.05, (t - _lastT) / 1000);
  _lastT = t;
  if (!Game.paused) {
    Game.update(dt);
    if (t > Game._holdUntil && Game._holdUntil) Game.holdDir = null;
  }
  const scr = (typeof App !== 'undefined') ? App.activeScreen : null;
  if (scr === 'game' && Game.state !== 'idle') {
    Game.draw(t);
    if (typeof App !== 'undefined') App.hudSync();
  }
  Fx.updateDraw(dt);
  requestAnimationFrame(_loop);
}

document.addEventListener('DOMContentLoaded', () => {
  Game.init();
  Fx.init();
  requestAnimationFrame(_loop);
});
