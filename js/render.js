const HULL = {
  grunt: [[0, 16], [15, -6], [6, -14], [-6, -14], [-15, -6]],
  darter: [[0, 15], [10, -13], [0, -7], [-10, -13]],
  gunner: [[-20, -10], [20, -10], [13, 14], [-13, 14]],
  boss: [[0, 46], [50, 10], [40, -26], [16, -36], [-16, -36], [-40, -26], [-50, 10]]
};

function draw() {
  ctx.save();
  if (game.shake > .3) ctx.translate(rand(-game.shake, game.shake) * .35, rand(-game.shake, game.shake) * .35);

  drawBackground();
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  for (const u of powerups) drawPowerup(u);
  for (const e of enemies) drawEnemy(e);
  drawBullets();
  if (game.state === 'playing') drawPlayer();
  ctx.restore();

  drawHUD();
  if (game.state === 'title') drawTitle();
  else langButtons.length = 0;
  if (game.state === 'over') drawOver();
  if (game.paused && game.state === 'playing') center(t('paused'), 28, '#cfe0ff', H / 2, t('resume'));
  drawPauseButton();
}

// 60 座標 px 而唔係 44:手機上 canvas 被 CSS 縮到約 0.75,44 會變 33 真 px,細過觸控下限
const pauseButton = { x: W - 68, y: 8, w: 60, h: 60 };

// 個掣存唔存在由 game.state 決定,唔係由「畫過未」決定。
// 如果攞繪圖時設嘅 flag 做判斷,輸入層就要靠繪圖層行過先 work —— 隱性依賴,好易踩。
const pauseActive = () => game.state === 'playing';

function drawPauseButton() {
  if (!pauseActive()) return;

  const { x, y, w, h } = pauseButton;
  const hover = pointer.x !== null &&
    pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;

  ctx.fillStyle = hover ? 'rgba(127,240,255,.14)' : 'rgba(8,13,28,.5)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(127,240,255,.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);

  const cx = x + w / 2, cy = y + h / 2;
  ctx.fillStyle = '#cfe8ff';
  if (game.paused) {
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 11); ctx.lineTo(cx + 11, cy); ctx.lineTo(cx - 7, cy + 11);
    ctx.closePath(); ctx.fill();
  } else {
    ctx.fillRect(cx - 9, cy - 11, 6, 22);
    ctx.fillRect(cx + 3, cy - 11, 6, 22);
  }
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#070b1a'); g.addColorStop(.55, '#050813'); g.addColorStop(1, '#0b0718');
  ctx.fillStyle = g;
  ctx.fillRect(-30, -30, W + 60, H + 60);

  for (const s of stars) {
    ctx.fillStyle = ['#2c3a63', '#5a6da0', '#c7d6ff'][s.z];
    ctx.fillRect(s.x, s.y, s.s, s.s * 2.4);
  }
}

function drawBullets() {
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#8ef2ff';
  ctx.fillStyle = '#eafcff';
  for (const b of bullets) ctx.fillRect(b.x - 2, b.y - 9, 4, 16);
  for (const b of ebullets) {
    ctx.shadowColor = b.color; ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function drawPlayer() {
  const p = player;
  if (p.inv > 0 && Math.floor(p.inv * 14) % 2 === 0) return;
  ctx.save();
  ctx.translate(p.x, p.y);

  const flame = rand(10, 20);
  ctx.fillStyle = '#ff9a3c'; ctx.globalAlpha = .9;
  ctx.beginPath(); ctx.moveTo(-5, 12); ctx.lineTo(0, 12 + flame); ctx.lineTo(5, 12); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.shadowBlur = 16; ctx.shadowColor = '#3fe0ff';
  ctx.fillStyle = '#7ff0ff';
  ctx.beginPath();
  ctx.moveTo(0, -20); ctx.lineTo(9, 6); ctx.lineTo(20, 14); ctx.lineTo(6, 12);
  ctx.lineTo(0, 17); ctx.lineTo(-6, 12); ctx.lineTo(-20, 14); ctx.lineTo(-9, 6);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#0d2b45';
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(4, 4); ctx.lineTo(-4, 4); ctx.fill();

  if (p.shield > 0) {
    ctx.strokeStyle = 'rgba(108,200,255,.75)';
    ctx.lineWidth = 2;
    for (let i = 0; i < p.shield; i++) {
      ctx.beginPath(); ctx.arc(0, 0, 24 + i * 5, 0, 7); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x, e.y);

  ctx.beginPath();
  HULL[e.type].forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.shadowBlur = 14; ctx.shadowColor = e.color;
  ctx.fillStyle = e.color; ctx.fill();
  if (e.flash > 0) {
    ctx.globalAlpha = e.flash * .55; ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.shadowBlur = 0;

  if (e.type === 'gunner') {
    ctx.fillStyle = '#2b0a1b';
    ctx.fillRect(-6, -4, 12, 10);
  } else if (e.type === 'boss') {
    ctx.fillStyle = '#2a0512';
    ctx.beginPath(); ctx.arc(0, -2, 20, 0, 7); ctx.fill();
    ctx.fillStyle = ['#ff5470', '#ffb35c', '#9b8bff'][e.mode];
    ctx.beginPath(); ctx.arc(0, -2, 11 + Math.sin(e.t * 6) * 2, 0, 7); ctx.fill();
  }
  ctx.restore();

  if (e.type === 'boss') {
    const w = W - 80, pct = clamp(e.hp / e.maxhp, 0, 1);
    ctx.fillStyle = '#1b2440'; ctx.fillRect(40, 50, w, 8);
    ctx.fillStyle = pct > .3 ? '#ff5470' : '#ffd35c';
    ctx.fillRect(40, 50, w * pct, 8);
  }
}

function drawPowerup(u) {
  const info = PU[u.kind];
  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.rotate(Math.sin(u.t * 2) * .3);
  ctx.shadowBlur = 16; ctx.shadowColor = info.c;
  ctx.strokeStyle = info.c; ctx.lineWidth = 2;
  ctx.strokeRect(-11, -11, 22, 22);
  ctx.shadowBlur = 0;
  ctx.fillStyle = info.c;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(info.t, 0, 1);
  ctx.restore();
}

function drawHUD() {
  ctx.font = '14px monospace';
  ctx.textBaseline = 'top';

  ctx.textAlign = 'left';
  ctx.fillStyle = '#cfe0ff';
  ctx.fillText(t('score') + ' ' + game.score, 12, 10);
  ctx.fillStyle = '#5f7099';
  ctx.fillText(t('high') + ' ' + highScore, 12, 27);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#7ff0ff';
  ctx.fillText(t('wave') + ' ' + game.wave, W - 78, 10);
  ctx.fillStyle = '#ff7ba8';
  ctx.fillText('♥'.repeat(Math.max(0, player.lives)), W - 78, 27);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd35c';
  ctx.fillText(t('power') + ' ' + '▮'.repeat(player.level), W / 2, 10);

  if (game.bannerT > 0 && game.state === 'playing') {
    ctx.globalAlpha = clamp(game.bannerT, 0, 1);
    center(game.bannerBoss ? t('bossBanner') : t('wave') + ' ' + game.wave, 30, '#eaf3ff', H / 2 - 60);
    ctx.globalAlpha = 1;
  }
}

function center(text, size, color, y, sub) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px "SF Mono", Menlo, monospace`;
  ctx.fillText(text, W / 2, y);
  if (sub) {
    ctx.font = '15px "SF Mono", Menlo, monospace';
    ctx.fillStyle = '#7b8db5';
    ctx.fillText(sub, W / 2, y + size + 14);
  }
}

function drawTitle() {
  ctx.fillStyle = 'rgba(5,7,15,.72)';
  ctx.fillRect(0, 0, W, H);
  center(t('title'), 44, '#7ff0ff', H / 2 - 90);
  center(t('subtitle'), 16, '#3f5a8a', H / 2 - 46);

  const lines = [t('ctlMove'), t('ctlShoot'), t('ctlPause'), '', t('drops'), t('bossInfo')];
  ctx.font = '14px "SF Mono", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8fa2cc';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + 10 + i * 24));

  if (Math.floor(performance.now() / 450) % 2) center(t('start'), 20, '#ffd35c', H / 2 + 195);
  drawLangPicker();
}

const langButtons = [];

function drawLangPicker() {
  langButtons.length = 0;
  const bw = 64, bh = 34, gap = 12;
  const y = H - 92;
  let x = (W - (LANGS.length * bw + (LANGS.length - 1) * gap)) / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '12px "SF Mono", Menlo, monospace';
  ctx.fillStyle = '#5f7099';
  ctx.fillText(t('langLabel'), W / 2, y - 18);

  for (const L of LANGS) {
    const on = L.code === lang;
    const hover = pointer.x !== null &&
      pointer.x >= x && pointer.x <= x + bw && pointer.y >= y && pointer.y <= y + bh;
    if (on || hover) {
      ctx.fillStyle = on ? 'rgba(127,240,255,.16)' : 'rgba(127,240,255,.06)';
      ctx.fillRect(x, y, bw, bh);
    }
    ctx.strokeStyle = on ? '#7ff0ff' : '#31456f';
    ctx.lineWidth = on ? 2 : 1;
    ctx.strokeRect(x + .5, y + .5, bw - 1, bh - 1);
    ctx.font = `${on ? 'bold ' : ''}16px "SF Mono", Menlo, monospace`;
    ctx.fillStyle = on ? '#eaf3ff' : '#7b8db5';
    ctx.fillText(L.label, x + bw / 2, y + bh / 2 + 1);
    langButtons.push({ x, y, w: bw, h: bh, code: L.code });
    x += bw + gap;
  }
}

function drawOver() {
  ctx.fillStyle = 'rgba(5,7,15,.78)';
  ctx.fillRect(0, 0, W, H);
  center(t('gameOver'), 40, '#ff5470', H / 2 - 70);
  center(t('finalScore', game.score), 24, '#eaf3ff', H / 2 - 10);
  center(t('reached', game.wave), 16, '#7b8db5', H / 2 + 26);
  center(t('best', highScore), 16, '#ffd35c', H / 2 + 54);
  if (Math.floor(performance.now() / 450) % 2) center(t('restart'), 20, '#7ff0ff', H / 2 + 120);
}
