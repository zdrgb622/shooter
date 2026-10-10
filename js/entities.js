const SPREAD = {
  1: [0],
  2: [-.05, .05],
  3: [-.2, 0, .2],
  4: [-.34, -.11, .11, .34],
  5: [-.42, -.22, 0, .22, .42]
};

// ---------- 波次 ----------
// ---------- 一波點樣砌出嚟 ----------
// 全部設定集中喺呢度,想試唔同嘅關卡設置就淨係改呢舊嘢,唔使郁下面嘅邏輯。
// 詳細點改、改完會點,見 TUNING.md 第 4 節。
const WAVE = {
  count: w => Math.max(20, 5 + w * 2),                    // 一波幾多隻
  gap: w => Math.max(.25, .85 - w * .05),    // 一隻隻之間隔幾耐(秒)
  lead: .9,                                 // 開波之後幾耐出第一隻
  bossLead: 1.4,                            // BOSS 波幾耐出 BOSS
  bossEvery: 3,                             // 幾多波一隻 BOSS
  bosses: ['crystal', 'serpent'],           // BOSS 波輪住出邊隻(名喺 js/bosses.js 嘅 BOSSES)

  // 出邊種怪:喺已經解鎖(wave >= from)嘅項目之間按 weight 抽。
  // 加一種新怪 = 加一行,唔使改下面任何嘢。
  mix: [
    { type: 'gunner', from: 1, weight: 22 },
    { type: 'darter', from: 2, weight: 23 },
    { type: 'grunt', from: 1, weight: 55 },
  ],
};

// 試關卡設置用:寫咗嘢落去就會取代上面嘅隨機砌法(BOSS 波除外)。
// 每項 { at: 第幾秒, type: 'grunt' | 'darter' | 'gunner', x: 0(最左)~ 1(最右),唔寫就隨機 }。
// 例:[{ at: 1, type: 'grunt', x: .2 }, { at: 1, type: 'grunt', x: .8 }]
// 試完記得改返 null 先好 commit —— npm test 會提你。
let WAVE_SCRIPT = null;   // let 唔係 const:測試要換走佢嚟驗證呢個功能

function rollEnemyType(w) {
  const open = WAVE.mix.filter(m => w >= m.from);
  const total = open.reduce((sum, m) => sum + m.weight, 0);
  let roll = Math.random() * total;
  return (open.find(m => (roll -= m.weight) < 0) || open[open.length - 1]).type;
}

function buildWave(w) {
  if (WAVE_SCRIPT) return WAVE_SCRIPT.map(e => ({ t: e.at, type: e.type, x: e.x }));
  const gapT = WAVE.gap(w);
  const queue = [];
  for (let i = 0; i < WAVE.count(w); i++) {
    queue.push({ t: WAVE.lead + i * gapT, type: rollEnemyType(w) });
  }
  return queue;
}

function startWave() {
  game.wave++;
  game.waveTime = 0;
  game.gap = 0;
  game.bannerBoss = game.wave % WAVE.bossEvery === 0;
  game.queue = game.bannerBoss ? [{ t: WAVE.bossLead, type: 'boss' }] : buildWave(game.wave);
  game.bannerT = 1.8;
}

function updateWave(dt) {
  game.waveTime += dt;
  while (game.queue.length && game.queue[0].t <= game.waveTime) {
    const next = game.queue.shift();
    spawnEnemy(next.type, next.x);
  }
  if (!game.queue.length && !enemies.length) {
    game.gap += dt;
    if (game.gap > 1.2) {
      // 夠波數就揀能力,揀完由 closePicker() 開下一波
      if (pickDue()) openPicker();
      else startWave();
    }
  }
}

// x 係 0(最左)到 1(最右),唔傳就隨機 —— 寫關卡嘅時候用得着
function spawnEnemy(type, at) {
  if (type === 'boss') { spawnBoss(bossForWave(game.wave)); return; }   // 見 js/bosses.js
  const x = at === undefined ? rand(45, W - 45) : 45 + clamp(at, 0, 1) * (W - 90);
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
    // 同一幀通常仲有好多粒敵彈撞到。冇呢行就會一粒扣一次命,lives 變負數、爆炸疊幾次。
    // 另一條分支本來就有設 inv,得呢條冇 —— 所以淨係死嗰下會出事。
    p.inv = 999;
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

// 子彈打唔打中、戰機撞唔撞到。BOSS 唔一定係一個圓(星蛇係一條 24 節嘅身),
// 所以 BOSS 可以喺 BOSSES 表自己答;冇寫就當係一個半徑 r 嘅圓。
function enemyHit(e, b) {            // 回傳傷害,0 = 冇中
  const def = e.type === 'boss' && BOSSES[e.kind];
  if (def && def.hit) return def.hit(e, b);
  return dist2(b, e) < (b.r + e.r) ** 2 ? 1 : 0;
}

function enemyTouches(e, p) {
  const def = e.type === 'boss' && BOSSES[e.kind];
  if (def && def.touches) return def.touches(e, p);
  return dist2(e, p) < (e.r + p.r) ** 2;
}

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

    // 飛出畫面底就當走咗。BOSS 例外 —— 星蛇衝刺會成條衝出畫面再返嚟
    if (e.type !== 'boss' && e.y > H + 70) { enemies.splice(i, 1); continue; }

    if (player.inv <= 0 && enemyTouches(e, player)) {
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

// 過場時序(秒,由 BOSS 中最後一擊嗰刻計起)。照設計圖,改 FINALE_SPEED 就可以整體快慢。
const FINALE_SPEED = 1.75;
const FINALE = {
  barDrain: .9,    // 血條瀉到 0 用幾耐
  ring: .75,       // 第一個光環;第二、三個各遲 .25
  ringLife: 1.35,
  burst: .84,      // 碎片炸開 + BOSS 真正消失
  flash: .93, flashPeak: 1.11, flashEnd: 1.65,
  dim: 1.38, dimEnd: 2.1,
  textIn: 1.47, textFull: 1.83, textHold: 2.7, textOut: 3.09,
  pick: 2.91,      // 能力畫面開始滑上嚟(滑完 .63 秒到位)
};

// BOSS 中咗最後一擊:唔即刻剷走,留低佢演完過場先
function startFinale(boss) {
  boss.dying = true;
  game.state = 'finale';
  game.finaleT = 0;
  game.finaleDone = 0;
  game.finaleX = bossFocusX(boss);
  game.finaleY = bossFocusY(boss);
  game.finaleKind = boss.kind;             // BOSS 爆咗之後 HUD 仲要知道寫邊個名
  game.finaleColor = boss.core || BOSS_TONE.core;
  game.finaleBar = clamp((boss.hp + (boss.lastDmg || 1)) / boss.maxhp, 0, 1);   // 最後一擊之前條血條去到邊
  game.finaleReward = boss.score;
  game.clearShots = true;      // BOSS 死咗,佢臨死前射嗰啲彈唔應該喺度等玩家返嚟食
  shake(18);
}

function updateFinale(dt) {
  game.finaleT += dt * FINALE_SPEED;
  const t = game.finaleT;
  const boss = enemies.find(e => e.dying);
  if (boss) boss.t += dt;        // 碎片繼續轉,BOSS 唔會突然定格

  if (t >= FINALE.burst && !(game.finaleDone & 1)) {
    game.finaleDone |= 1;
    if (boss) {
      const x = game.finaleX, y = game.finaleY, def = BOSSES[boss.kind];
      if (def.burst) def.burst(boss);
      explode(x, y, boss.color, 90, 460);
      drop(x - 26, y, 'power');
      drop(x + 26, y, 'shield');
      drop(x, y, 'life');
      enemies.splice(enemies.indexOf(boss), 1);
    }
    shake(26);
  }

  if (t >= FINALE.pick && !(game.finaleDone & 2)) {
    game.finaleDone |= 2;
    if (pickDue()) {
      openPicker(true);          // true = 由下面滑上嚟
    } else {
      game.state = 'playing';    // 唔使揀嘢就接返落去,等 updateWave 開下一波
      game.gap = 0;
    }
  }
}

function killEnemy(e, i, scored = true) {
  if (scored) {
    game.crystals += Math.round(e.score * comboMult());
    game.combo++;
    game.comboT = COMBO_WINDOW;
  }
  // BOSS:唔即刻剷走,交畀過場處理(爆炸同掉寶都喺 updateFinale() 入面做)。
  // 同「使唔使揀能力」冇關係 —— BOSS 幾多波一隻同幾多波揀一次可以唔同。
  if (e.type === 'boss') return startFinale(e);

  enemies.splice(i, 1);
  explode(e.x, e.y, e.color, 22, 260);
  shake(6);
  const r = Math.random();
  if (r < .1) drop(e.x, e.y, 'power');
  else if (r < .15) drop(e.x, e.y, 'shield');
  else if (r < .165) drop(e.x, e.y, 'life');
}

// ---------- 子彈 ----------
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < -20 || b.x < -20 || b.x > W + 20) { bullets.splice(i, 1); continue; }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      const dmg = enemyHit(e, b);
      if (dmg) {
        bullets.splice(i, 1);
        e.hp -= dmg; e.flash = 1; e.lastDmg = dmg;
        e.hitX = b.x; e.hitY = b.y;     // 過場要知最後一槍喺邊(星蛇個頭可能喺畫面外)
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

  // 清場:一定要喺所有 loop 之外做(見 DEVLOG 第一篇),亦要喺下面啲 state 閘之前 ——
  // 過場同揀能力都會標呢個旗,擺喺最尾嘅話呢兩個 state 永遠行唔到。
  if (game.clearShots) { ebullets.length = 0; game.clearShots = false; }

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
  if (game.state === 'finale') { updateFinale(dt); return; }
  if (game.state !== 'playing') return;

  updatePlayer(dt);
  updateWave(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updatePowerups(dt);
}
