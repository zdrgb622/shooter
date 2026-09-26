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

// 設計圖係 44×44。但手機上 canvas 縮到約 0.75,44 座標 px 得 33 真 px,
// 低過觸控下限,所以「撳得到嘅範圍」比「畫出嚟嘅框」四邊各闊 PAUSE_PAD。
const pauseButton = { x: W - 60, y: 14, w: 44, h: 44 };
const PAUSE_PAD = 8;

// 個掣存唔存在由 game.state 決定,唔係由「畫過未」決定。
// 如果攞繪圖時設嘅 flag 做判斷,輸入層就要靠繪圖層行過先 work —— 隱性依賴,好易踩。
const pauseActive = () => game.state === 'playing';

function drawPauseButton() {
  if (!pauseActive()) return;

  const { x, y, w, h } = pauseButton;
  const hover = pointer.x !== null &&
    pointer.x >= x - PAUSE_PAD && pointer.x <= x + w + PAUSE_PAD &&
    pointer.y >= y - PAUSE_PAD && pointer.y <= y + h + PAUSE_PAD;

  if (hover) { ctx.fillStyle = 'rgba(232,236,255,.12)'; ctx.fillRect(x, y, w, h); }
  ctx.strokeStyle = ART.hudText;
  ctx.globalAlpha = .8;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + .75, y + .75, w - 1.5, h - 1.5);

  const cx = x + w / 2, cy = y + h / 2;
  ctx.fillStyle = ART.hudText;
  if (game.paused) {
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 9); ctx.lineTo(cx + 9, cy); ctx.lineTo(cx - 6, cy + 9);
    ctx.closePath(); ctx.fill();
  } else {
    ctx.fillRect(cx - 6, cy - 9, 3.5, 18);
    ctx.fillRect(cx + 2.5, cy - 9, 3.5, 18);
  }
  ctx.globalAlpha = 1;
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
  // 玩家子彈:設計圖嘅「導彈」款
  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(.9, .9);
    ctx.translate(-6, -10);
    drawShapes(SHOT, ART.shot);
    ctx.restore();
  }

  ctx.shadowBlur = 12;
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

  if (p.shield > 0) {
    ctx.strokeStyle = 'rgba(79,209,197,.75)';
    ctx.lineWidth = 2;
    for (let i = 0; i < p.shield; i++) {
      ctx.beginPath(); ctx.arc(0, 0, 24 + i * 5, 0, 7); ctx.stroke();
    }
  }

  ctx.scale(.72, .72);
  ctx.translate(-28, -30);

  // 火焰喺機尾(本地 y=58)向下拉長,每幀跳動一下
  ctx.save();
  ctx.translate(0, 58); ctx.scale(1, rand(.75, 1.35)); ctx.translate(0, -58);
  drawShapes(SHIP.flame, ART.flame);
  drawShapes(SHIP.flameIn, ART.flameIn);
  ctx.restore();

  drawShapes(SHIP.body, ART.pBody, ART.pTrim, 2);
  drawShapes(SHIP.trim, ART.pTrim);
  drawShapes(SHIP.accent, ART.pAccent);
  ctx.restore();
}

function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x, e.y);

  const art = ENEMY_ART[ENEMY_STYLE[e.type]];
  if (art) {
    ctx.save();
    const s = e.r * 2 * 1.15 / 48;         // 本地 48×48 縮到差唔多兩個半徑咁大
    ctx.scale(s, s);
    ctx.translate(-24, -24);
    drawShapes(art.body, ART.eBody, ART.eDetail, 1.6);
    drawShapes(art.detail, ART.eDetail);
    drawShapes(art.light, ART.eLight);
    if (e.flash > 0) {
      ctx.globalAlpha = e.flash * .55;
      drawShapes(art.body, '#fff');
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  } else {
    // BOSS 仲係用舊形狀,設計圖嘅「水晶核」未做
    ctx.beginPath();
    HULL[e.type].forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.shadowBlur = 14; ctx.shadowColor = e.color;
    ctx.fillStyle = e.color; ctx.fill();
    if (e.flash > 0) {
      ctx.globalAlpha = e.flash * .55; ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2a0512';
    ctx.beginPath(); ctx.arc(0, -2, 20, 0, 7); ctx.fill();
    ctx.fillStyle = ['#ff5470', '#ffb35c', '#9b8bff'][e.mode];
    ctx.beginPath(); ctx.arc(0, -2, 11 + Math.sin(e.t * 6) * 2, 0, 7); ctx.fill();
  }
  ctx.restore();
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

// HUD 照設計圖:頂部一條半透明帶(晶體、連擊、波數、暫停掣,打 BOSS 時多一條血條),
// 左下角一塊板(命同火力)。
const bossOnScreen = () => enemies.some(e => e.type === 'boss');

function drawHUD() {
  const boss = bossOnScreen() ? enemies.find(e => e.type === 'boss') : null;
  const stripH = boss ? 98 : 72;

  ctx.fillStyle = ART.hudBg;
  ctx.fillRect(0, 0, W, stripH);

  ctx.textBaseline = 'top';
  const label = (text, x, align) => {
    ctx.font = '11px "Chakra Petch", monospace';
    ctx.textAlign = align;
    ctx.globalAlpha = .7; ctx.fillStyle = ART.hudText;
    ctx.fillText(text, x, 14);
    ctx.globalAlpha = 1;
  };
  const value = (text, x, align, color, size) => {
    ctx.font = `700 ${size}px "Chakra Petch", monospace`;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.fillText(text, x, 28);
  };

  label(t('score'), 16, 'left');
  value(game.crystals, 16, 'left', ART.hudText, 26);

  if (game.combo > 1) {
    label(t('combo'), W / 2, 'center');
    value('x' + game.combo, W / 2, 'center', ART.hudHi, 26);
  }

  label(t('wave'), W - 72, 'right');
  value(game.wave, W - 72, 'right', ART.hudText, 20);

  ctx.font = '11px "Chakra Petch", monospace';
  ctx.textAlign = 'left';
  ctx.globalAlpha = .55; ctx.fillStyle = ART.hudText;
  ctx.fillText(t('high') + ' ' + highScore, 16, 56);
  ctx.globalAlpha = 1;

  if (boss) {
    const pct = clamp(boss.hp / boss.maxhp, 0, 1);
    ctx.font = '700 11px "Chakra Petch", monospace';
    ctx.fillStyle = ART.eLight;
    ctx.fillText('BOSS', 16, 78);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(58, 78, W - 74, 8);
    ctx.fillStyle = ART.eLight;
    ctx.fillRect(58, 78, (W - 74) * pct, 8);
  }

  drawBottomPanel();

  if (game.bannerT > 0 && game.state === 'playing') {
    ctx.globalAlpha = clamp(game.bannerT, 0, 1);
    center(game.bannerBoss ? t('bossBanner') : t('wave') + ' ' + game.wave, 30, '#eaf3ff', H / 2 - 60);
    ctx.globalAlpha = 1;
  }
}

function drawBottomPanel() {
  const lives = Math.max(0, player.lives);
  const wide = Math.max(lives * 18, 5 * 12) + 20;
  const x = 12, y = H - 62;

  ctx.fillStyle = ART.hudBg;
  ctx.fillRect(x, y, wide, 50);

  ctx.font = '15px "Chakra Petch", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = ART.pAccent;
  for (let i = 0; i < lives; i++) ctx.fillText('♥', x + 10 + i * 18, y + 8);

  for (let i = 0; i < 5; i++) {
    const on = i < player.level;
    ctx.fillStyle = on ? ART.hudHi : 'rgba(232,236,255,.18)';
    ctx.fillRect(x + 10 + i * 12, y + 32, 8, 10);
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
  center(t('finalScore', game.crystals), 24, '#eaf3ff', H / 2 - 10);
  center(t('reached', game.wave), 16, '#7b8db5', H / 2 + 26);
  center(t('best', highScore), 16, '#ffd35c', H / 2 + 54);
  if (Math.floor(performance.now() / 450) % 2) center(t('restart'), 20, '#7ff0ff', H / 2 + 120);
}
