// 暫停時唔可以搖:update() 停晒,game.shake 唔會衰減,
// 再逐幀隨機位移就會永遠震落去。
const shakeActive = () => game.shake > .3 && !game.paused;

function draw() {
  ctx.save();
  if (shakeActive()) ctx.translate(rand(-game.shake, game.shake) * .35, rand(-game.shake, game.shake) * .35);

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

  if (game.state === 'finale') drawFinale();
  drawHUD();
  if (game.state === 'title') drawTitle();
  else langButtons.length = 0;
  if (game.state === 'over') drawOver();
  if (game.paused && game.state === 'playing') center(t('paused'), 28, '#cfe0ff', H / 2, t('resume'));
  drawPauseButton();
}

// 最終版 HUD 整體 0.75,所以個掣畫 44 × 0.75 ≈ 36。
// 但手機上 canvas 再縮約 0.75,36 座標 px 得 27 真 px,遠低過觸控下限,
// 所以「撳得到嘅範圍」比「畫出嚟嘅框」四邊各闊 PAUSE_PAD:36 + 24 = 60 座標 px ≈ 45 真 px。
const pauseButton = { x: W - 48, y: 12, w: 36, h: 36 };
const PAUSE_PAD = 12;

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
    ctx.moveTo(cx - 5, cy - 7.5); ctx.lineTo(cx + 7.5, cy); ctx.lineTo(cx - 5, cy + 7.5);
    ctx.closePath(); ctx.fill();
  } else {
    ctx.fillRect(cx - 5, cy - 7.5, 3, 15);
    ctx.fillRect(cx + 2, cy - 7.5, 3, 15);
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
    // 無人機自轉同上下浮 —— 純粹畫面,唔影響碰撞,所以做喺呢度而唔係 entities.js
    if (e.type === 'gunner') {
      ctx.translate(0, Math.sin(e.t * 2) * DRONE_BOB);
      ctx.rotate(e.t * DRONE_SPIN);
    }
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
    drawBossArt(e);
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

// HUD 照最終版設計:**冇底色**(設計嘅「HUD 底色深淺」係 0),整體大細 0.75,
// 底部 0.825。頂部放晶體、連擊、波數同暫停掣,打 BOSS 時多一條血條;左下角放命同火力。
const HUD_K = .75, HUD_BOT_K = .825;
const bossOnScreen = () => enemies.find(e => e.type === 'boss');

function drawHUD() {
  const boss = bossOnScreen();
  ctx.textBaseline = 'top';

  const label = (text, x, align) => {
    ctx.font = `${Math.round(12 * HUD_K)}px "Chakra Petch", monospace`;
    ctx.textAlign = align;
    ctx.globalAlpha = .7; ctx.fillStyle = ART.hudText;
    ctx.fillText(text, x, 12);
    ctx.globalAlpha = 1;
  };
  const value = (text, x, align, color) => {
    ctx.font = `700 ${Math.round(28 * HUD_K)}px "Chakra Petch", monospace`;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.fillText(text, x, 23);
  };

  label(t('score'), 12, 'left');
  value(game.crystals, 12, 'left', ART.hudText);

  if (game.combo > 1) {
    label(t('combo'), W / 2, 'center');
    value('x' + game.combo, W / 2, 'center', ART.hudHi);
  }

  label(t('wave'), W - 66, 'right');
  value(game.wave, W - 66, 'right', ART.hudText);

  ctx.font = `${Math.round(11 * HUD_K)}px "Chakra Petch", monospace`;
  ctx.textAlign = 'left';
  ctx.globalAlpha = .55; ctx.fillStyle = ART.hudText;
  ctx.fillText(t('high') + ' ' + highScore, 12, 46);
  ctx.globalAlpha = 1;

  const finaleBar = game.state === 'finale' && game.finaleT < FINALE.barDrain
    ? game.finaleBar * (1 - game.finaleT / FINALE.barDrain) : null;
  if (boss || finaleBar !== null) {
    const pct = finaleBar !== null ? finaleBar : clamp(boss.hp / boss.maxhp, 0, 1);
    const y = 60, h = Math.round(8 * HUD_K);
    ctx.font = `700 ${Math.round(12 * HUD_K)}px "Chakra Petch", monospace`;
    ctx.textAlign = 'left';
    ctx.fillStyle = ART.eLight;
    ctx.fillText('CRYSTAL CORE', 12, y - 2);
    const barX = 108;
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(barX, y, W - barX - 12, h);
    ctx.fillStyle = ART.eLight;
    ctx.fillRect(barX, y, (W - barX - 12) * pct, h);
  }

  drawBottomPanel();

  if (game.bannerT > 0 && game.state === 'playing') {
    ctx.globalAlpha = clamp(game.bannerT, 0, 1);
    center(game.bannerBoss ? t('bossBanner') : t('wave') + ' ' + game.wave, 30, '#eaf3ff', H / 2 - 60);
    ctx.globalAlpha = 1;
  }
}

function drawBottomPanel() {
  const x = 14, y = H - 46;
  const heart = Math.round(18 * HUD_BOT_K), gap = Math.round(20 * HUD_BOT_K);

  ctx.font = `${heart}px "Chakra Petch", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = ART.pAccent;
  for (let i = 0; i < Math.max(0, player.lives); i++) ctx.fillText('♥', x + i * gap, y);

  const bw = Math.round(10 * HUD_BOT_K), bh = Math.round(9 * HUD_BOT_K), bgap = bw + 3;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < player.level ? ART.hudHi : 'rgba(232,236,255,.18)';
    ctx.fillRect(x + i * bgap, y + heart + 6, bw, bh);
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

// ---------- 打低 BOSS 嘅過場 ----------
// 時序全部喺 entities.js 嘅 FINALE,更新同繪圖用同一份,唔會各計各。

// 由 a 到 b 之間嘅進度,0 到 1
const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

function drawFinale() {
  const ft = game.finaleT, x = game.finaleX, y = game.finaleY;

  // 三個擴散光環
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    const u = span(ft, FINALE.ring + k * .25, FINALE.ring + k * .25 + FINALE.ringLife);
    if (u <= 0 || u >= 1) continue;
    ctx.globalAlpha = 1 - u;
    ctx.strokeStyle = k === 1 ? ART.hudHi : BOSS_TONE.core;
    ctx.beginPath(); ctx.arc(x, y, 10 + u * 320, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 全屏白光:一閃即收
  if (ft >= FINALE.flash && ft < FINALE.flashEnd) {
    const a = ft < FINALE.flashPeak
      ? span(ft, FINALE.flash, FINALE.flashPeak)
      : 1 - span(ft, FINALE.flashPeak, FINALE.flashEnd);
    ctx.globalAlpha = a * .9;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // 暗場
  const dim = span(ft, FINALE.dim, FINALE.dimEnd) * .55;
  if (dim > 0) {
    ctx.globalAlpha = dim;
    ctx.fillStyle = ART.bg || '#0B1026';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // 三行字:放大淡入 → 停一陣 → 縮細淡出
  if (ft < FINALE.textIn) return;
  const a = ft < FINALE.textHold ? span(ft, FINALE.textIn, FINALE.textFull)
                                : 1 - span(ft, FINALE.textHold, FINALE.textOut);
  if (a <= 0) return;
  const scale = ft < FINALE.textFull ? 1.5 - .5 * span(ft, FINALE.textIn, FINALE.textFull)
                                    : 1 - .05 * span(ft, FINALE.textHold, FINALE.textOut);

  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(W / 2, 300);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '14px "Chakra Petch", monospace';
  ctx.fillStyle = BOSS_TONE.core;
  ctx.fillText(t('bossDefeated'), 0, -44);

  ctx.font = '700 44px "Chakra Petch", monospace';
  ctx.fillStyle = ART.hudText;
  ctx.fillText(t('stageClear', game.wave), 0, 0);

  ctx.font = '16px "Noto Sans TC", monospace';
  ctx.fillStyle = ART.hudHi;
  ctx.fillText(t('gotCrystals', game.finaleReward), 0, 40);
  ctx.restore();
}
