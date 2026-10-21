// 暫停時唔可以搖:update() 停晒,game.shake 唔會衰減,
// 再逐幀隨機位移就會永遠震落去。
const shakeActive = () => game.shake > .3 && !game.paused;

// 一局開咗、架機仲未爆:揀能力、過場都計。只有標題同 game over 冇架機。
const shipOnScreen = () => game.state === 'playing' || game.state === 'picking' || game.state === 'finale';

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
  drawBomb();
  drawFx('blast');
  // 揀能力同過場嗰陣架機都要留喺度 —— 突然唔見咗會以為自己死咗
  if (shipOnScreen()) drawPlayer();
  drawFx('spark');
  ctx.restore();
  if (shipOnScreen()) drawChargeFlashes();

  if (game.state === 'finale') drawFinale();
  drawHUD();
  if (game.state === 'finale' && BOSSES[game.finaleKind] && BOSSES[game.finaleKind].drawFinaleHud)
    BOSSES[game.finaleKind].drawFinaleHud();   // 例如爆完之後 HUD 淡落去
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
    if (b.big) {                      // 集火彈:粗啲、長啲、發光
      ctx.shadowColor = ART.shot; ctx.shadowBlur = 10;
      ctx.scale(1.5, 1.9);
    } else ctx.scale(.9, .9);
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

// 炸彈衝擊波:由架機位置一個大圈擴散出去
const BOMB_LIFE = .45;
function drawBomb() {
  const u = game.bombT / BOMB_LIFE;
  if (u >= 1) return;
  const r = 30 + (1 - (1 - u) * (1 - u)) * 820;
  ctx.save();
  ctx.globalAlpha = 1 - u;
  ctx.strokeStyle = ART.hudHi; ctx.lineWidth = 10 * (1 - u) + 2;
  ctx.beginPath(); ctx.arc(game.bombX, game.bombY, r, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = (1 - u) * .18;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ---------- 擦彈儲力:紅轉白 + 彗星爆衝(照設計檔「彗星爆衝+紅轉白」) ----------
// 儲緊:架機、背光、尾焰慢慢變紅,尾焰越嚟越長;儲滿即刻轉白熱。放手:變彗星衝上去。
const HEAT = {
  red: '#FF7A45',    // 儲力色
  white: '#7FE7FF',  // 滿格色(白熱)
  boom: '#FF7A45',   // 撞中敵機嘅火球色
  k: .85,            // 升溫強度:紅 / 白嘅最深程度
  flameW: .4,        // 尾焰闊度
  flameLen: 1,       // 尾焰最長
  cometW: .8,        // 彗星闊度
};

const SHIP_OUTLINE = [[28, 0], [54, 56], [40, 52], [28, 60], [16, 52], [2, 56]];
function shipPath() { ctx.beginPath(); polyPath(SHIP_OUTLINE); }

// 儲滿嗰下「爆」一爆:.9 → .65 → 1
const fullPulse = t => (t < .06 ? .9 : t < .18 ? .65 + .35 * (t - .06) / .12 : 1);

// 而家架機有幾熱。dash 中途用衝刺嘅時間,否則用擦彈儲咗幾多
function playerHeat() {
  const p = player, d = p.dash, C = COMET;
  if (d) {
    const t = d.t, fade = clamp(1 - t / .2, 0, 1), f = clamp(1 - t / .1, 0, 1);
    const back = t >= cometBackAt();
    return { glowRed: .25 * fade, glowWhite: fade, tintRed: 0,
             tintWhite: t < cometRiseEnd() ? 1 : t < cometRiseEnd() + .02 ? .6 : 0,
             flameX: back ? .8 : .6 + .65 * f, flameY: back ? .25 : .3 + .7 * f,
             flameRed: back ? 1 : .25 * f, flameWhite: back ? 0 : f };
  }
  const k = clamp(p.graze / GRAZE.full, 0, 1), full = k >= 1;
  return { glowRed: full ? .25 : .9 * k, glowWhite: full ? fullPulse(p.fullT) : 0,
           tintRed: full ? 0 : .65 * k, tintWhite: full ? fullPulse(p.fullT) : 0,
           flameX: .8 + .45 * k, flameY: .25 + .75 * k, flameRed: full ? .25 : 1, flameWhite: full ? 1 : 0 };
}

// 尾焰:本地座標(戰機圖 56×64),由 (28, 54) 向下噴
function drawFlame(h) {
  const fl = 1 + .09 * Math.sin(performance.now() / 11);         // 每幀跳動
  ctx.save();
  ctx.translate(28, 54);
  ctx.scale(HEAT.flameW * h.flameX * fl, HEAT.flameLen * h.flameY * (2 - fl));
  ctx.translate(-30, 0);
  const tear = (x0, depth, x1, color, a) => {
    ctx.globalAlpha = a; ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x0, 0); ctx.quadraticCurveTo(30, depth, x1, 0); ctx.closePath(); ctx.fill();
  };
  if (h.flameRed > 0) {
    tear(6, 98, 54, HEAT.red, .95 * h.flameRed);
    tear(15, 66, 45, '#FFB38A', h.flameRed);
    tear(23, 36, 37, '#FFE2C8', h.flameRed);
  }
  if (h.flameWhite > 0) {
    ctx.shadowColor = HEAT.white; ctx.shadowBlur = 6;
    tear(7, 104, 53, HEAT.white, .92 * h.flameWhite);
    ctx.shadowBlur = 0;
    tear(16, 74, 44, '#FFFFFF', h.flameWhite);
    ctx.globalAlpha = .55 * h.flameWhite; ctx.fillStyle = HEAT.red;
    ctx.beginPath(); polyPath([[30, 8], [35, 16], [30, 24], [25, 16]]); polyPath([[30, 30], [34, 37], [30, 44], [26, 37]]); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// 背光:紅 / 白嘅圓形光暈
function drawHeatGlow(h) {
  for (const [a, color] of [[h.glowRed, HEAT.red], [h.glowWhite, HEAT.white]]) {
    if (a <= 0) continue;
    const g = ctx.createRadialGradient(28, 32, 0, 28, 32, 75);
    g.addColorStop(0, color); g.addColorStop(.68, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a * HEAT.k; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(28, 32, 75, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// 彗星光罩:水滴形,包住架機向下拖
function drawCometAura(t) {
  const a = clamp(t / .1, 0, 1), sc = t < .1 ? .6 + .4 * a : 1 + .05 * clamp((t - .1) / (cometRiseEnd() - .1), 0, 1);
  ctx.save();
  ctx.translate(28, 30); ctx.scale(HEAT.cometW * sc, sc); ctx.translate(0, -2);
  ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, -44, 0, 136);
  g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.3, HEAT.white); g.addColorStop(1, 'rgba(127,231,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -44); ctx.bezierCurveTo(14, -38, 20, -8, 18, 20); ctx.bezierCurveTo(16, 56, 8, 100, 0, 136);
  ctx.bezierCurveTo(-8, 100, -16, 56, -18, 20); ctx.bezierCurveTo(-20, -8, -14, -38, 0, -44); ctx.fill();
  ctx.globalAlpha = .75 * a; ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(0, -30); ctx.bezierCurveTo(6, -24, 8, 0, 7, 20); ctx.bezierCurveTo(6, 50, 3, 80, 0, 104);
  ctx.bezierCurveTo(-3, 80, -6, 50, -7, 20); ctx.bezierCurveTo(-8, 0, -6, -24, 0, -30); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// 彗星拖出嚟嗰條光柱 + 殘影(畫面座標)
function drawCometTrail(d) {
  const t = d.t, t0 = COMET.crouch + COMET.stretch, tEnd = cometRiseEnd();
  if (t < t0 || t > tEnd + .6) return;
  const a = .9 * (t < tEnd ? 1 : 1 - (t - tEnd) / .6);
  const yb = d.y0 + 22, yt = t < tEnd ? player.y : d.y0 - d.dist;
  if (yb > yt) {
    const w = 28 * HEAT.cometW, g = ctx.createLinearGradient(0, yb, 0, yt);
    g.addColorStop(0, HEAT.white); g.addColorStop(.45, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = a; ctx.fillStyle = g;
    ctx.fillRect(d.x0 - w / 2, yt, w, yb - yt);
    const c = ctx.createLinearGradient(0, yb, 0, yt);
    c.addColorStop(0, '#FFFFFF'); c.addColorStop(.7, 'rgba(255,255,255,0)');
    ctx.fillStyle = c;
    ctx.fillRect(d.x0 - 4 * HEAT.cometW, yt, 8 * HEAT.cometW, yb - yt);
  }
  // 殘影:四個白色機影跟住後面
  for (let i = 0; i < 4; i++) {
    const tg = t - .03 * (i + 1);
    if (tg < t0 || t > tEnd + .13) continue;
    ctx.globalAlpha = (.4 - .1 * i) * (t < tEnd ? 1 : .3);
    ctx.save();
    ctx.translate(d.x0, d.y0 + cometOffset(d, tg));
    ctx.scale(.72 * .92, .72 * 1.15); ctx.translate(-28, -30);
    shipPath(); ctx.fillStyle = HEAT.white; ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// 儲滿嗰陣:架機四圍彈一個白圈;同埋「放手 / 停火」提示
function drawChargeCue() {
  const p = player, d = p.dash, full = p.graze >= GRAZE.full;
  if (full && !d && p.fullT < .45) {
    const t = p.fullT, sc = t < .03 ? .4 + .4 * t / .03 : .8 + 1.2 * (t - .03) / .42;
    ctx.globalAlpha = t < .03 ? t / .03 : 1 - (t - .03) / .42;
    ctx.strokeStyle = HEAT.white; ctx.lineWidth = 3; ctx.shadowColor = HEAT.white; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(p.x, p.y, 55 * sc, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
  // 提示:儲滿 .16 秒之後彈出嚟,放手之後 .3 秒淡走
  let a = 0, dy = 0, sc = 1;
  if (full && !d && p.fullT > .16) {
    const k = clamp((p.fullT - .16) / .1, 0, 1);
    a = k; dy = 6 * (1 - k); sc = .8 + .25 * k;
  } else if (d && d.t < .3) { a = 1 - d.t / .3; dy = -4 - 6 * d.t / .3; }
  if (a <= 0) return;
  const main = t('releaseCue'), sub = t('releaseCueSub');
  ctx.font = '900 13px "Noto Sans TC", sans-serif';
  const w1 = ctx.measureText(main).width;
  ctx.font = '10px "Chakra Petch", monospace';
  const w2 = ctx.measureText(sub).width;
  const w = 6 + 18 + 6 + w1 + 6 + w2 + 10, h = 32;
  const cx = d ? d.x0 : p.x, cy = d ? d.y0 : p.y;
  let x = cx + 30;
  if (x + w > W - 6) x = cx - 30 - w;                 // 貼住右邊就擺去左邊
  const y = cy - 50 + dy;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.fillStyle = '#E8ECFF';
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, w, h, 14) : ctx.rect(0, 0, w, h); ctx.fill();
  // 手指向上嘅圖示
  ctx.translate(6, 5);
  ctx.strokeStyle = '#0B1026'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(5, 9, 8, 12, 4) : ctx.rect(5, 9, 8, 12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(9, 6); ctx.lineTo(9, 1); ctx.moveTo(5, 4); ctx.lineTo(9, .5); ctx.lineTo(13, 4); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '900 13px "Noto Sans TC", sans-serif'; ctx.fillStyle = '#0B1026';
  ctx.fillText(main, 24, 11);
  ctx.font = '10px "Chakra Petch", monospace'; ctx.fillStyle = '#3A4480';
  ctx.fillText(sub, 24 + w1 + 6, 11);
  ctx.restore();
}

// 全畫面白閃:儲滿嗰下(淡)、放手嗰下(強啲)
function drawChargeFlashes() {
  const p = player, d = p.dash;
  let a = 0;
  if (p.graze >= GRAZE.full && !d && p.fullT < .2) a = p.fullT < .02 ? .25 * p.fullT / .02 : .25 * (1 - (p.fullT - .02) / .18);
  if (d && d.t < .2) a = d.t < .03 ? .35 * d.t / .03 : .35 * (1 - (d.t - .03) / .17);
  if (a <= 0) return;
  ctx.globalAlpha = a; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
}

// 特效:擦彈火花(八條光)、彗星撞中嘅火球(核心 + 光圈 + 六塊花瓣 + 分數)
function drawFx(kind) {
  for (const f of fx) {
    if (f.kind !== kind) continue;
    const t = f.t;
    ctx.save();
    ctx.translate(f.x, f.y);
    if (kind === 'spark') {
      const sc = t < .03 ? .3 + .85 * t / .03 : 1.15 + .35 * (t - .03) / .2;
      ctx.globalAlpha = t < .03 ? t / .03 : clamp(1 - (t - .03) / .2, 0, 1);
      ctx.scale(sc, sc);
      ctx.strokeStyle = '#FFF1B8'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(0, -5); ctx.moveTo(0, 5); ctx.lineTo(0, 12);
      ctx.moveTo(-12, 0); ctx.lineTo(-5, 0); ctx.moveTo(5, 0); ctx.lineTo(12, 0);
      ctx.moveTo(-8, -8); ctx.lineTo(-4, -4); ctx.moveTo(4, 4); ctx.lineTo(8, 8);
      ctx.moveTo(8, -8); ctx.lineTo(4, -4); ctx.moveTo(-4, 4); ctx.lineTo(-8, 8);
      ctx.stroke(); ctx.lineCap = 'butt';
    } else {
      // 六塊花瓣
      if (t < .5) {
        const sx = t < .05 ? .1 + .5 * t / .05 : .6 + .55 * (t - .05) / .45;
        ctx.globalAlpha = t < .05 ? t / .05 : 1 - (t - .05) / .45;
        for (let i = 0; i < 6; i++) {
          ctx.save();
          ctx.rotate((f.rot + i * 60) * Math.PI / 180);
          const g = ctx.createLinearGradient(0, 0, 105 * sx, 0);
          g.addColorStop(0, '#FFF1B8'); g.addColorStop(.5, HEAT.boom); g.addColorStop(1, 'rgba(255,77,109,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, -11, 105 * sx, 22, 11) : ctx.rect(0, -11, 105 * sx, 22); ctx.fill();
          ctx.restore();
        }
      }
      // 光圈
      if (t < .65) {
        const sc = t < .04 ? .2 + .15 * t / .04 : .35 + .9 * (t - .04) / .61;
        ctx.globalAlpha = t < .04 ? t / .04 : 1 - (t - .04) / .61;
        ctx.strokeStyle = HEAT.boom; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 120 * sc, 0, Math.PI * 2); ctx.stroke();
      }
      // 火球核心
      if (t < .85) {
        const sc = t < .05 ? .2 + .8 * t / .05 : t < .3 ? 1 + .05 * (t - .05) / .25 : 1.05 + .15 * (t - .3) / .55;
        ctx.globalAlpha = t < .05 ? t / .05 : t < .3 ? 1 - .15 * (t - .05) / .25 : .85 * (1 - (t - .3) / .55);
        const r = 105 * sc, g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, '#FFFFFF'); g.addColorStop(.2, '#FFF1B8'); g.addColorStop(.38, '#F2C94C');
        g.addColorStop(.56, HEAT.boom); g.addColorStop(.72, 'rgba(255,77,109,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      }
      // 分數升上去
      if (f.score) {
        const dy = t < .1 ? -6 * t / .1 : t < .9 ? -6 - 16 * (t - .1) / .8 : -22 - 6 * (t - .9) / .2;
        ctx.globalAlpha = t < .1 ? t / .1 : t < .9 ? 1 : clamp(1 - (t - .9) / .2, 0, 1);
        ctx.font = '700 14px "Chakra Petch", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#F2C94C';
        ctx.fillText('+' + f.score, 0, -20 + dy);
      }
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  const p = player, d = p.dash;
  if (!d && p.inv > 0 && Math.floor(p.inv * 14) % 2 === 0) return;
  const h = playerHeat();

  if (d) drawCometTrail(d);

  ctx.save();
  ctx.translate(p.x, p.y);
  // 啱啱儲滿:震一震
  if (!d && p.graze >= GRAZE.full && p.fullT < .3) ctx.translate(1.3 * Math.sin(p.fullT * 110), .9 * Math.cos(p.fullT * 90));

  if (p.shield > 0 && !d) {
    ctx.strokeStyle = 'rgba(79,209,197,.75)';
    ctx.lineWidth = 2;
    for (let i = 0; i < p.shield; i++) {
      ctx.beginPath(); ctx.arc(0, 0, 24 + i * 5, 0, 7); ctx.stroke();
    }
  }

  ctx.scale(.72, .72);
  // 彗星:蹲低嗰下壓扁,衝上去嗰陣拉長
  if (d) {
    const t = d.t, C = COMET;
    let sx = 1, sy = 1;
    if (t < C.crouch) { const u = t / C.crouch; sx = 1 + .12 * u; sy = 1 - .1 * u; }
    else if (t < C.crouch + C.stretch) { const u = (t - C.crouch) / C.stretch; sx = 1.12 - .2 * u; sy = .9 + .25 * u; }
    else if (t < cometRiseEnd()) { sx = .92; sy = 1.15; }
    ctx.scale(sx, sy);
  }
  ctx.translate(-28, -30);

  drawHeatGlow(h);
  if (h.flameRed > 0 || h.flameWhite > 0) drawFlame(h);
  if (d && d.t < cometRiseEnd()) drawCometAura(d.t);

  drawShapes(SHIP.body, ART.pBody, ART.pTrim, 2);
  drawShapes(SHIP.trim, ART.pTrim);
  drawShapes(SHIP.accent, ART.pAccent);
  // 機身中間一粒紅點(設計檔)
  ctx.fillStyle = '#FF4D6D'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(28, 34, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 升溫:先紅,滿咗轉白熱
  if (h.tintRed > 0) { ctx.globalAlpha = h.tintRed * HEAT.k; shipPath(); ctx.fillStyle = HEAT.red; ctx.fill(); }
  if (h.tintWhite > 0) {
    ctx.globalAlpha = h.tintWhite; shipPath(); ctx.fillStyle = HEAT.white; ctx.fill();
    ctx.globalAlpha = .6 * h.tintWhite; ctx.fillStyle = HEAT.red;
    ctx.beginPath(); polyPath([[28, 22], [30, 34], [26, 34]]); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawChargeCue();
}

function drawEnemy(e) {
  // BOSS 由 BOSSES 表自己畫(星蛇成條身喺畫面周圍,唔係圍住一個中心點)。
  // 階段可以有自己嘅 draw,即係「轉樣」。
  if (e.type === 'boss') {
    const def = BOSSES[e.kind], ph = def.phases[e.phase - 1];
    ((ph && ph.draw) || def.draw)(e);
    return;
  }
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
    // 漏咗喺 sprites.js 加外形:畫個圓頂住,至少睇得見、打得中,唔會靜雞雞隱形
    drawShapes([circ(0, 0, e.r)], ART.eBody, ART.eDetail, 2);
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

  const drain = finaleOf(game.finaleKind).barDrain;
  const finaleBar = game.state === 'finale' && game.finaleT < drain
    ? game.finaleBar * (1 - game.finaleT / drain) : null;
  if (boss || finaleBar !== null) {
    const pct = finaleBar !== null ? finaleBar : clamp(boss.hp / boss.maxhp, 0, 1);
    const def = BOSSES[boss ? boss.kind : game.finaleKind];
    const color = (boss && boss.edge) || game.finaleColor || ART.eLight;
    const y = 60, h = Math.round(8 * HUD_K);
    ctx.font = `700 ${Math.round(12 * HUD_K)}px "Chakra Petch", monospace`;
    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.fillText(def ? def.label : 'BOSS', 12, y - 2);
    const barX = 108;
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(barX, y, W - barX - 12, h);
    ctx.fillStyle = color;
    ctx.fillRect(barX, y, (W - barX - 12) * pct, h);
  }

  drawBottomPanel();

  if (game.bannerT > 0 && game.state === 'playing') {
    ctx.globalAlpha = clamp(game.bannerT, 0, 1);
    center(game.bannerBoss ? t('bossBanner') : t('wave') + ' ' + game.wave, 30, '#eaf3ff', H / 2 - 60);
    ctx.globalAlpha = 1;
  }
}

const HP_COLOR = '#FF4D6D';   // 玩家血條(紅)

function drawBottomPanel() {
  const x = 14, y = H - 46;
  const heart = Math.round(18 * HUD_BOT_K);

  // 血條:闊度跟最大血量變(「強化機體」之後會長啲)。白色嗰截 = 啱啱扣咗嘅血
  const p = player, unit = 1.1 * HUD_BOT_K;
  const bw0 = Math.round(p.maxHp * unit), bh0 = Math.round(10 * HUD_BOT_K), by = y + Math.round((heart - bh0) / 2);
  const k = clamp(p.hp / p.maxHp, 0, 1), kShown = clamp(p.hpShown / p.maxHp, 0, 1);
  const low = k <= HP.low && k > 0;
  ctx.fillStyle = 'rgba(232,236,255,.14)';
  ctx.fillRect(x, by, bw0, bh0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, by, Math.round(bw0 * kShown), bh0);
  ctx.globalAlpha = low ? .55 + .45 * Math.sin(performance.now() / 90) : 1;
  ctx.fillStyle = HP_COLOR;
  ctx.fillRect(x, by, Math.round(bw0 * k), bh0);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(232,236,255,.35)'; ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, by + .5, bw0 - 1, bh0 - 1);
  // 數值:例如 80/100。血少嗰陣轉紅
  ctx.font = `700 ${Math.round(11 * HUD_BOT_K)}px "Chakra Petch", monospace`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = low ? HP_COLOR : ART.hudText;
  ctx.fillText(Math.ceil(p.hp) + '/' + p.maxHp, x + bw0 + 6, by + bh0 / 2 + 1);
  ctx.textBaseline = 'top';

  const bw = Math.round(10 * HUD_BOT_K), bh = Math.round(9 * HUD_BOT_K), bgap = bw + 3;
  for (let i = 0; i < GUN.maxLevel; i++) {
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
  const own = BOSSES[game.finaleKind] && BOSSES[game.finaleKind].drawFinale;
  if (own) { own(); return; }                 // 呢隻 BOSS 有自己一套(例如星蛇嘅擊破演出)
  const ft = game.finaleT, x = game.finaleX, y = game.finaleY;

  // 三個擴散光環
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    const u = span(ft, FINALE.ring + k * .25, FINALE.ring + k * .25 + FINALE.ringLife);
    if (u <= 0 || u >= 1) continue;
    ctx.globalAlpha = 1 - u;
    ctx.strokeStyle = k === 1 ? ART.hudHi : (game.finaleColor || BOSS_TONE.core);
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
  ctx.fillStyle = game.finaleColor || BOSS_TONE.core;
  ctx.fillText(t('bossDefeated'), 0, -44);

  ctx.font = '700 44px "Chakra Petch", monospace';
  ctx.fillStyle = ART.hudText;
  ctx.fillText(t('stageClear', game.wave), 0, 0);

  ctx.font = '16px "Noto Sans TC", monospace';
  ctx.fillStyle = ART.hudHi;
  ctx.fillText(t('gotCrystals', game.finaleReward), 0, 40);
  ctx.restore();
}
