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
                   t: 0, fireT: 2, mode: 0, modeT: 4, flash: 0, score: 3000, color: '#ff4d6d' });
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

function updateBoss(b, dt) {
  if (b.y < 135) { b.y += 55 * dt; return; }
  b.x = W / 2 + Math.sin(b.t * .65) * (W / 2 - 75);
  b.y = 135 + Math.sin(b.t * 1.3) * 14;
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
    b.x += b.vx * dt; b.y += b.vy * dt; // moving ebullets
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
