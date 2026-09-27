const SPREAD = {
  1: [0],
  2: [-.05, .05],
  3: [-.2, 0, .2],
  4: [-.34, -.11, .11, .34],
  5: [-.42, -.22, 0, .22, .42]
};

// ---------- 波次 ----------
function startWave() {
  game.wave++;
  game.waveTime = 0;
  game.gap = 0;
  game.bannerBoss = game.wave % 5 === 0;
  if (game.bannerBoss) {
    game.queue = [{ t: 1.4, type: 'boss' }];
  } else {
    const n = 5 + game.wave * 2;
    const gapT = Math.max(0.3, 0.85 - game.wave * 0.04);
    game.queue = [];
    for (let i = 0; i < n; i++) {
      const roll = Math.random();
      let type = 'grunt';
      if (game.wave >= 3 && roll > .78) type = 'gunner';
      else if (game.wave >= 2 && roll > .55) type = 'darter';
      game.queue.push({ t: 0.9 + i * gapT, type });
    }
  }
  game.bannerT = 1.8;
}

function updateWave(dt) {
  game.waveTime += dt;
  while (game.queue.length && game.queue[0].t <= game.waveTime) spawnEnemy(game.queue.shift().type);
  if (!game.queue.length && !enemies.length) {
    game.gap += dt;
    if (game.gap > 1.2) {
      // 打完 BOSS 波就揀能力,揀完由 closePicker() 開下一波
      if (game.wave % PICK_EVERY === 0) openPicker();
      else startWave();
    }
  }
}

function spawnEnemy(type) {
  if (type === 'boss') {
    const hp = 55 + game.wave * 22;
    enemies.push({ type: 'boss', x: W / 2, bx: W / 2, y: -100, r: 50, hp, maxhp: hp,
                   t: 0, fireT: 2, mode: 0, modeT: 4, flash: 0, score: 3000, color: '#ff4d6d',
                   phase: 1, cycle: 0, done: 0 });   // 招式循環用:done 係 bitmask,記住今個循環邊幾下已經出咗
    return;
  }
  const x = rand(45, W - 45);
  const e = { type, x, bx: x, y: -40, t: rand(0, 6), flash: 0 };
  if (type === 'grunt')
    Object.assign(e, { r: 16, hp: 1 + Math.floor(game.wave / 4), vy: 85 + game.wave * 4,
                       sway: 42, score: 100, color: '#5ef2c7' });
  if (type === 'darter')
    Object.assign(e, { r: 13, hp: 2, vy: 200 + game.wave * 6, sway: 14, score: 160, color: '#ffd35c' });
  if (type === 'gunner')
    Object.assign(e, { r: 20, hp: 4 + game.wave, vy: 75, sway: 0, score: 280, color: '#ff6b9d',
                       hover: rand(80, 210), drift: rand(-70, 70), fireT: rand(.8, 1.8) });
  enemies.push(e);
}

// ---------- 玩家 ----------
function updatePlayer(dt) {
  const p = player;
  p.inv = Math.max(0, p.inv - dt);
  p.cool -= dt;

  const move = moveIntent(p, dt);
  p.x += move.x * p.speed * dt;
  p.y += move.y * p.speed * dt;
  p.x = clamp(p.x, p.r, W - p.r);
  p.y = clamp(p.y, p.r + 40, H - p.r);

  if (wantsFire() && p.cool <= 0) fire();
}

function fire() {
  for (const a of SPREAD[Math.min(player.level, 5)]) {
    bullets.push({ x: player.x + Math.sin(a) * 24, y: player.y - 16,
                   vx: Math.sin(a) * 640, vy: -Math.cos(a) * 640, r: 4 });
  }
  player.cool = Math.max(.05, (.16 - player.level * .012) * player.fireRateMult);
}

function hitPlayer() {
  const p = player;
  if (p.inv > 0) return;
  game.combo = 0; game.comboT = 0;
  if (p.shield > 0) {
    p.shield--; p.inv = 1.2; shake(10);
    explode(p.x, p.y, '#6cc8ff', 26, 220);
    return;
  }
  p.lives--;
  p.level = Math.max(1, p.level - 1);
  explode(p.x, p.y, '#ffffff', 55, 380);
  shake(22);
  if (p.lives <= 0) {
    game.state = 'over';
    if (game.crystals > highScore) { highScore = game.crystals; store.set('stardrift_high', highScore); }
  } else {
    p.inv = 2.4; p.x = W / 2; p.y = H - 110;
    game.clearShots = true;
  }
}

// ---------- 敵機 ----------
function eshoot(x, y, a, sp, color = '#ff8fb0') {
  ebullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5.5, color });
}

const aimAt = (x, y) => Math.atan2(player.y - y, player.x - x);

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt * 7);

    if (e.type === 'boss') updateBoss(e, dt);
    else if (e.type === 'gunner') updateGunner(e, dt);
    else {
      e.y += e.vy * dt;
      e.x = clamp(e.bx + Math.sin(e.t * 2.2) * e.sway, e.r, W - e.r);
    }

    if (e.y > H + 70) { enemies.splice(i, 1); continue; }

    if (player.inv <= 0 && dist2(e, player) < (e.r + player.r) ** 2) {
      hitPlayer();
      if (e.type !== 'boss') killEnemy(e, i, false);
    }
  }
}

function updateGunner(e, dt) {
  if (e.y < e.hover) {
    e.y += e.vy * dt;
  } else {
    e.bx += e.drift * dt;
    if (e.bx < 50 || e.bx > W - 50) { e.drift *= -1; e.bx = clamp(e.bx, 50, W - 50); }
    e.fireT -= dt;
    if (e.fireT <= 0) {
      e.fireT = Math.max(.75, 1.9 - game.wave * .07);
      eshoot(e.x, e.y + 18, aimAt(e.x, e.y + 18), 230);
    }
  }
  e.x = e.bx + Math.sin(e.t * 1.5) * 12;
}

// 第一階段招式循環(秒)。每一下都有預警:尖端先着燈 / 碎片先彈警示圈,
// 玩家睇得出下一步,先可以走位 —— 舊嗰三招係冇預警嘅。
const BOSS_CYCLE = 5;
const BOSS_VOLLEY_AT = .45;    // 第一個尖端幾時開火
const BOSS_TIP_GAP = .25;      // 尖端之間差幾耐
const BOSS_TIP_GLOW = .65;     // 着燈維持幾耐
const BOSS_FLING_WARN = 2.6;   // 碎片警示圈幾時出
const BOSS_FLING_AT = 2.9;     // 碎片幾時掟出嚟
const BOSS_FLING_ANGLES = [150, 90, 30];

// 第一階段:兩招輪住嚟。打到一半血轉第二階段,用返舊嗰三招(冇預警、更亂)
const bossPhase = b => (b.hp / b.maxhp > .5 ? 1 : 2);

// 某個時刻到咗、而且今個循環未出過 → 出手一次
function bossDue(b, at, bit) {
  if (b.cycle < at || (b.done & bit)) return false;
  b.done |= bit;
  return true;
}

// 尖端着燈嘅光度(0 = 冇);render 同 update 共用同一條時序,唔會各計各
function bossTipGlow(b, i) {
  const u = b.cycle - i * BOSS_TIP_GAP;
  if (u < 0 || u > BOSS_TIP_GLOW) return 0;
  return 1 - u / BOSS_TIP_GLOW;
}

const bossFlingWarn = b =>
  b.cycle >= BOSS_FLING_WARN && b.cycle < BOSS_FLING_AT
    ? (b.cycle - BOSS_FLING_WARN) / (BOSS_FLING_AT - BOSS_FLING_WARN) : 0;

// 由本地座標(BOSS 圖係 300×180)換做畫面座標
const bossLocalToWorld = (b, lx, ly) => {
  const s = b.r * 2 / 190;
  return [b.x + (lx - 150) * s, b.y + (ly - BOSS_CORE_Y) * s];
};

function volleyFromTip(b, i) {
  const tips = BOSS_ART.tips;
  const [x, y] = bossLocalToWorld(b, tips[i][0], tips[i][1]);
  const spread = -30 + i * (tips.length > 1 ? 60 / (tips.length - 1) : 0);
  for (const d of [-10, 0, 10]) {
    eshoot(x, y, Math.PI / 2 - (spread + d) * Math.PI / 180, 320, '#4FD1C5');
  }
}

// 碎片掟向玩家:沿一條弧線飛過去,唔係直線,所以要記住成條路徑
function flingShards(b) {
  for (const deg of BOSS_FLING_ANGLES) {
    const a = deg * Math.PI / 180 + b.t * SHARD_SPIN;
    const [x, y] = bossLocalToWorld(b, 150 + Math.cos(a) * 138, BOSS_CORE_Y + Math.sin(a) * 46);
    ebullets.push({
      x, y, vx: 0, vy: 0, r: 8, color: '#4FD1C5',
      path: { x0: x, y0: y, cx: (x + player.x) / 2, cy: y + 140,
              x1: player.x, y1: player.y, t: 0, dur: 1.2 },
    });
  }
}

function updateBossPhase1(b, dt) {
  b.cycle += dt;
  if (b.cycle >= BOSS_CYCLE) { b.cycle -= BOSS_CYCLE; b.done = 0; }
  b.mode = b.cycle < BOSS_FLING_WARN ? 0 : 1;

  for (let i = 0; i < BOSS_ART.tips.length; i++) {
    if (bossDue(b, BOSS_VOLLEY_AT + i * BOSS_TIP_GAP, 1 << i)) volleyFromTip(b, i);
  }
  if (bossDue(b, BOSS_FLING_AT, 1 << 30)) flingShards(b);
}

function updateBoss(b, dt) {
  if (b.y < 135) { b.y += 55 * dt; return; }
  b.x = W / 2 + Math.sin(b.t * .65) * (W / 2 - 75);
  b.y = 135 + Math.sin(b.t * 1.3) * 14;

  b.phase = bossPhase(b);
  if (b.phase === 1) return updateBossPhase1(b, dt);

  b.modeT -= dt;
  if (b.modeT <= 0) { b.mode = (b.mode + 1) % 3; b.modeT = 4.5; b.fireT = .4; }
  b.fireT -= dt;
  if (b.fireT > 0) return;

  const hurt = 1 - b.hp / b.maxhp;
  if (b.mode === 0) {
    b.fireT = .85 - hurt * .3;
    const a = aimAt(b.x, b.y + 40);
    for (const off of [-.22, 0, .22]) eshoot(b.x, b.y + 40, a + off, 250);
  } else if (b.mode === 1) {
    b.fireT = 1.5 - hurt * .5;
    const n = 14 + Math.floor(hurt * 10);
    for (let i = 0; i < n; i++) eshoot(b.x, b.y + 20, (i / n) * Math.PI * 2 + b.t, 175, '#ffb35c');
  } else {
    b.fireT = .16;
    eshoot(b.x + Math.sin(b.t * 7) * 42, b.y + 34, Math.PI / 2 + Math.sin(b.t * 3) * .5, 300, '#9b8bff');
  }
}

function killEnemy(e, i, scored = true) {
  enemies.splice(i, 1);
  const boss = e.type === 'boss';
  explode(e.x, e.y, e.color, boss ? 90 : 22, boss ? 460 : 260);
  shake(boss ? 24 : 6);
  if (scored) {
    game.crystals += Math.round(e.score * comboMult());
    game.combo++;
    game.comboT = COMBO_WINDOW;
  }
  if (boss) {
    drop(e.x - 26, e.y, 'power'); drop(e.x + 26, e.y, 'shield'); drop(e.x, e.y, 'life');
    // BOSS 一死就即刻揀能力,唔使等 updateWave 嗰 1.2 秒間場。
    // 爆炸粒子喺閘之上更新,所以揀嘢期間 BOSS 仍然爆緊,唔會突然靜晒。
    if (game.wave % PICK_EVERY === 0) openPicker();
  } else {
    const r = Math.random();
    if (r < .1) drop(e.x, e.y, 'power');
    else if (r < .15) drop(e.x, e.y, 'shield');
    else if (r < .165) drop(e.x, e.y, 'life');
  }
}

// ---------- 子彈 ----------
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < -20 || b.x < -20 || b.x > W + 20) { bullets.splice(i, 1); continue; }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (dist2(b, e) < (b.r + e.r) ** 2) { // when bullet hit enemy
        bullets.splice(i, 1);
        e.hp--; e.flash = 1;
        explode(b.x, b.y, '#cfe8ff', 4, 90);
        if (e.hp <= 0) killEnemy(e, j);
        break;
      }
    }
  }
  for (let i = ebullets.length - 1; i >= 0; i--) {  // iterate all bullets from enemy(ebullets)
    const b = ebullets[i];
    if (b.path) {
      // 掟出嚟嘅碎片行二次貝茲弧線;飛到終點就改返做直線,等出界嗰段照樣清得走
      const p = b.path;
      p.t += dt;
      const u = Math.min(1, p.t / p.dur), v = 1 - u;
      const nx = v * v * p.x0 + 2 * v * u * p.cx + u * u * p.x1;
      const ny = v * v * p.y0 + 2 * v * u * p.cy + u * u * p.y1;
      if (u >= 1) {
        const len = Math.hypot(nx - b.x, ny - b.y) || 1;
        b.vx = (nx - b.x) / len * 300; b.vy = (ny - b.y) / len * 300;
        b.path = null;
      }
      b.x = nx; b.y = ny;
    } else {
      b.x += b.vx * dt; b.y += b.vy * dt; // moving ebullets
    }
    if (b.y > H + 20 || b.y < -40 || b.x < -30 || b.x > W + 30) { ebullets.splice(i, 1); continue; }  // when ebullets outside boundry
    if (player.inv <= 0 && dist2(b, player) < (b.r + player.r) ** 2) {
      ebullets.splice(i, 1);
      hitPlayer();
    }
  }
}

// ---------- 掉寶 ----------
function drop(x, y, kind) {
  powerups.push({ x, y, kind, r: 13, t: rand(0, 6) });
}

function updatePowerups(dt) {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const u = powerups[i];
    u.t += dt;
    u.y += 95 * dt;
    u.x += Math.sin(u.t * 3) * 40 * dt;
    if (u.y > H + 30) { powerups.splice(i, 1); continue; }
    if (dist2(u, player) < (u.r + player.r + 6 + player.magnet) ** 2) {
      powerups.splice(i, 1);
      if (u.kind === 'power') { player.level = Math.min(5, player.level + 1); game.crystals += 50; }
      if (u.kind === 'shield') player.shield = Math.min(3, player.shield + 1);
      if (u.kind === 'life') player.lives = Math.min(6, player.lives + 1);
      explode(u.x, u.y, PU[u.kind].c, 16, 150);
    }
  }
}

// ---------- 每幀更新 ----------
function update(dt) {
  if (game.paused) return;   // 暫停:連背景星星同粒子都唔郁,成個畫面定格

  for (const s of stars) { s.y += s.v * dt; if (s.y > H) { s.y = -2; s.x = rand(0, W); } }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .94; p.vy *= .94;
    if (p.life <= 0) particles.splice(i, 1);
  }
  game.shake = Math.max(0, game.shake - dt * 45);
  if (game.bannerT > 0) game.bannerT -= dt;
  if (game.state === 'playing' && game.combo > 0) {
    game.comboT -= dt;
    if (game.comboT <= 0) { game.combo = 0; game.comboT = 0; }
  }
  if (game.state !== 'playing') return;

  updatePlayer(dt);
  updateWave(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updatePowerups(dt);

  // cleared out here, never inside hitPlayer(), so no loop is walking ebullets
  if (game.clearShots) { ebullets.length = 0; game.clearShots = false; }
}
