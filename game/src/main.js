// Harbor Lights — original canvas game for make.fun best-game-01
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const W = 960, H = 540;
let dpr = 1;

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const keys = Object.create(null);
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if (state.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) startGame();
  if (state.mode === 'over' && (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyR')) startGame();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('pointerdown', () => {
  if (state.mode === 'title' || state.mode === 'over') startGame();
});

function rnd(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

const state = {
  mode: 'title', // title | play | over
  t: 0,
  score: 0,
  lives: 3,
  level: 1,
  best: Number(localStorage.getItem('hl_best') || 0),
  boat: { x: W * 0.2, y: H * 0.5, vx: 0, vy: 0, angle: 0 },
  lanterns: [],
  reefs: [],
  pier: null,
  waves: [],
  flash: 0,
  message: '',
};

function announce(msg) { statusEl.textContent = msg; }

function spawnLantern() {
  state.lanterns.push({
    x: rnd(80, W - 80),
    y: rnd(60, H - 60),
    r: 10,
    glow: rnd(0, Math.PI * 2),
  });
}

function spawnReef() {
  state.reefs.push({
    x: rnd(120, W - 40),
    y: rnd(40, H - 40),
    r: rnd(14, 26),
    rot: rnd(0, Math.PI),
  });
}

function placePier() {
  state.pier = {
    x: W - 70,
    y: rnd(80, H - 80),
    w: 48,
    h: 70,
    lit: false,
    pulse: 0,
  };
}

function startGame() {
  state.mode = 'play';
  state.t = 0;
  state.score = 0;
  state.lives = 3;
  state.level = 1;
  state.boat = { x: 100, y: H * 0.5, vx: 0, vy: 0, angle: 0 };
  state.lanterns = [];
  state.reefs = [];
  state.flash = 0;
  state.message = '';
  for (let i = 0; i < 4; i++) spawnLantern();
  for (let i = 0; i < 3; i++) spawnReef();
  placePier();
  announce('Harbor Lights started. Collect lanterns, then dock at the pier.');
}

function hit(a, b, ar, br) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy < (ar + br) * (ar + br);
}

function update(dt) {
  state.t += dt;
  if (state.flash > 0) state.flash -= dt;

  if (state.mode !== 'play') return;

  const b = state.boat;
  const accel = 180 + state.level * 8;
  const drag = 0.92;
  let ax = 0, ay = 0;
  if (keys.ArrowLeft || keys.KeyA) ax -= 1;
  if (keys.ArrowRight || keys.KeyD) ax += 1;
  if (keys.ArrowUp || keys.KeyW) ay -= 1;
  if (keys.ArrowDown || keys.KeyS) ay += 1;
  if (ax || ay) {
    const len = Math.hypot(ax, ay) || 1;
    b.vx += (ax / len) * accel * dt;
    b.vy += (ay / len) * accel * dt;
    b.angle = Math.atan2(b.vy, b.vx);
  }
  b.vx *= Math.pow(drag, dt * 60);
  b.vy *= Math.pow(drag, dt * 60);
  b.x = clamp(b.x + b.vx * dt, 24, W - 24);
  b.y = clamp(b.y + b.vy * dt, 24, H - 24);

  for (const L of state.lanterns) L.glow += dt * 3;
  if (state.pier) state.pier.pulse += dt * 2;

  for (let i = state.lanterns.length - 1; i >= 0; i--) {
    const L = state.lanterns[i];
    if (hit(b, L, 16, L.r)) {
      state.lanterns.splice(i, 1);
      state.score += 10 * state.level;
      state.flash = 0.2;
      if (state.pier) state.pier.lit = state.lanterns.length === 0;
      announce(`Lantern collected. Score ${state.score}.`);
    }
  }

  for (const R of state.reefs) {
    if (hit(b, R, 14, R.r - 4)) {
      state.lives -= 1;
      state.flash = 0.35;
      b.x = 100;
      b.y = H * 0.5;
      b.vx = b.vy = 0;
      announce(`Hit a reef. Lives left ${state.lives}.`);
      if (state.lives <= 0) {
        state.mode = 'over';
        if (state.score > state.best) {
          state.best = state.score;
          localStorage.setItem('hl_best', String(state.best));
        }
        announce(`Game over. Score ${state.score}. Press Enter to restart.`);
      }
      break;
    }
  }

  const P = state.pier;
  if (P && P.lit) {
    const docked =
      b.x > P.x - P.w * 0.5 - 10 &&
      b.x < P.x + P.w * 0.5 + 10 &&
      b.y > P.y - P.h * 0.5 - 10 &&
      b.y < P.y + P.h * 0.5 + 10;
    if (docked) {
      state.score += 50 * state.level;
      state.level += 1;
      state.lanterns = [];
      state.reefs = [];
      const nL = 3 + state.level;
      const nR = 2 + Math.floor(state.level * 1.2);
      for (let i = 0; i < nL; i++) spawnLantern();
      for (let i = 0; i < nR; i++) spawnReef();
      placePier();
      b.x = 100;
      b.y = H * 0.5;
      b.vx = b.vy = 0;
      state.flash = 0.4;
      announce(`Docked! Level ${state.level}. Score ${state.score}.`);
    }
  }
}

function drawWater() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#123347');
  g.addColorStop(1, '#0a1c28');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(120,180,200,0.08)';
  ctx.lineWidth = 1;
  for (let y = 40; y < H; y += 28) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) {
      const yy = y + Math.sin(x * 0.02 + state.t * 1.2 + y) * 4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

function drawBoat() {
  const b = state.boat;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);
  ctx.fillStyle = '#e8d5a3';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-14, 10);
  ctx.lineTo(-10, 0);
  ctx.lineTo(-14, -10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6b3f2a';
  ctx.fillRect(-4, -2, 8, 4);
  // mast lantern
  ctx.beginPath();
  ctx.fillStyle = '#ffd27a';
  ctx.arc(2, -14, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLantern(L) {
  const pulse = 0.6 + 0.4 * Math.sin(L.glow);
  ctx.save();
  ctx.translate(L.x, L.y);
  ctx.fillStyle = `rgba(255, 200, 90, ${0.15 * pulse})`;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb84d';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(-2, 7, 4, 6);
  ctx.restore();
}

function drawReef(R) {
  ctx.save();
  ctx.translate(R.x, R.y);
  ctx.rotate(R.rot);
  ctx.fillStyle = '#2f4a3a';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const rr = R.r * (0.7 + (i % 2) * 0.3);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPier(P) {
  ctx.save();
  ctx.translate(P.x, P.y);
  ctx.fillStyle = '#3b2a1a';
  ctx.fillRect(-P.w / 2, -P.h / 2, P.w, P.h);
  ctx.fillStyle = '#6a4a2a';
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(-P.w / 2, i * 12 - 2, P.w, 4);
  }
  if (P.lit) {
    const a = 0.5 + 0.5 * Math.sin(P.pulse);
    ctx.fillStyle = `rgba(120, 220, 255, ${0.25 + 0.25 * a})`;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9fe7ff';
    ctx.beginPath();
    ctx.arc(0, -P.h / 2 - 8, 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#445';
    ctx.beginPath();
    ctx.arc(0, -P.h / 2 - 8, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = 'rgba(8,16,24,0.55)';
  ctx.fillRect(12, 12, 280, 78);
  ctx.fillStyle = '#e7f2f8';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText(`Score  ${state.score}`, 24, 36);
  ctx.fillText(`Lives  ${'◆'.repeat(Math.max(0, state.lives))}`, 24, 58);
  ctx.fillText(`Level  ${state.level}`, 24, 78);
  ctx.fillStyle = 'rgba(8,16,24,0.45)';
  ctx.fillRect(W - 160, 12, 148, 36);
  ctx.fillStyle = '#9ec3d4';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(`Best ${state.best}`, W - 148, 36);

  if (state.mode === 'play' && state.pier && state.pier.lit) {
    ctx.fillStyle = '#9fe7ff';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText('Pier is lit — dock to clear the level', W / 2 - 130, 36);
  }
}

function drawTitle() {
  drawWater();
  ctx.fillStyle = 'rgba(5,12,18,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f0f7fb';
  ctx.font = '700 48px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Harbor Lights', W / 2, H * 0.36);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = '#a8c8d8';
  ctx.fillText('Steer with arrows or WASD. Collect lanterns, then dock at the glowing pier.', W / 2, H * 0.46);
  ctx.fillText('Avoid dark reefs. Survive as many night runs as you can.', W / 2, H * 0.52);
  ctx.fillStyle = '#ffd27a';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText('Press Enter / Space or click to set sail', W / 2, H * 0.64);
  if (state.best) {
    ctx.fillStyle = '#9ec3d4';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`Best run: ${state.best}`, W / 2, H * 0.72);
  }
  ctx.textAlign = 'left';
}

function drawOver() {
  ctx.fillStyle = 'rgba(5,12,18,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0f7fb';
  ctx.font = '700 42px system-ui, sans-serif';
  ctx.fillText('Night over', W / 2, H * 0.38);
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = '#a8c8d8';
  ctx.fillText(`Score ${state.score}   ·   Best ${state.best}`, W / 2, H * 0.48);
  ctx.fillStyle = '#ffd27a';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText('Enter / R / click to sail again', W / 2, H * 0.58);
  ctx.textAlign = 'left';
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  if (state.mode === 'title') {
    drawTitle();
  } else {
    drawWater();
    if (state.pier) drawPier(state.pier);
    for (const R of state.reefs) drawReef(R);
    for (const L of state.lanterns) drawLantern(L);
    drawBoat();
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,220,140,${state.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    drawHUD();
    if (state.mode === 'over') drawOver();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
announce('Harbor Lights title screen. Press Enter to start.');
