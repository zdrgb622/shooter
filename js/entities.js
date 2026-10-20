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
  if (p.dash) { updateComet(dt); return; }     // 彗星爆衝緊:唔聽操作、唔開火
  p.inv = Math.max(0, p.inv - dt);
  p.cool -= dt;

  const move = moveIntent(p, dt);
  p.x += move.x * p.speed * dt;
  p.y += move.y * p.speed * dt;
  p.x = clamp(p.x, p.r, W - p.r);
  p.y = clamp(p.y, p.r + 40, H - p.r);

  // 擦彈儲滿之後「放手」(手機)/「停火」(電腦、手掣)= 由開火變唔開火嗰一下就放
  const firing = wantsFire();
  if (!firing && p.fireHeld && p.graze >= GRAZE.full) releaseGraze();
  p.fireHeld = firing;
  if (firing && p.cool <= 0) fire();
}

function fire() {
  for (const a of SPREAD[Math.min(player.level, 5)]) {
    bullets.push({ x: player.x + Math.sin(a) * 24, y: player.y - 16,
                   vx: Math.sin(a) * 640, vy: -Math.cos(a) * 640, r: 4 });
  }
  player.cool = Math.max(.05, (.16 - player.level * .012) * player.fireRateMult);
}

// 中彈 / 撞機。dmg 預設係一粒敵彈嘅傷害;撞機嗰邊傳 HP.touch。
// 唔會跌火力、唔會清擦彈、唔會將架機搬返去起點 —— 扣血 + 無敵時間就係全部懲罰。
function hitPlayer(dmg = HP.bullet) {
  const p = player;
  if (p.inv > 0) return;
  game.combo = 0; game.comboT = 0;
  if (p.shield > 0) {
    p.shield--; p.inv = 1.2; shake(10);
    explode(p.x, p.y, '#6cc8ff', 26, 220);
    return;
  }
  p.hp = Math.max(0, p.hp - dmg);
  explode(p.x, p.y, '#ffffff', 40, 380);
  shake(18);
  // 兩條分支都一定要設 inv:同一幀通常仲有好多粒敵彈撞到,
  // 冇 inv 就會一粒扣一次、爆炸疊幾次(B4)
  if (p.hp <= 0) {
    game.state = 'over';
    p.inv = 999;
    if (game.crystals > highScore) { highScore = game.crystals; store.set('stardrift_high', highScore); }
  } else {
    p.inv = HP.inv;
  }
}

// ---------- 擦彈 ----------
// 敵彈 / 敵機 / 星蛇條身喺架機身邊擦過(差少少冇撞到)就儲氣。
// 儲滿之後放手(手機)或者停火(電腦)就放炸彈:清晒敵彈,畫面入面每隻敵機扣血。
// 數值點調見 TUNING.md「擦彈」。
const GRAZE = {
  ring: 16,          // 擦彈範圍:撞到嘅距離再闊幾多 px。大啲 = 易擦,細啲 = 要貼得更近
  full: 12,          // 儲滿要幾多分
  bullet: 1,         // 擦一粒敵彈幾多分
  ship: 2,           // 擦一隻敵機幾多分(機身大、會郁,危險啲)
  serpent: 1,        // 擦星蛇一節幾多分(每節每招只計一次)
  bombDamage: 3,     // 炸彈對畫面入面每隻敵機(連 BOSS)扣幾多血
  bombInv: .6,       // 放完炸彈無敵幾耐(秒)
  release: 'comet',  // 放手出咩招:'comet' 彗星爆衝(照設計檔)/ 'bomb' 清晒敵彈嘅炸彈(第一版)
};

// 加分 + 火花。無敵期間唔計 —— 否則中一槍之後可以喺彈幕入面任刷
function addGraze(n, x, y) {
  const p = player;
  if (p.inv > 0 || p.graze >= GRAZE.full) return;
  p.graze = Math.min(GRAZE.full, p.graze + n);
  p.grazeFlash = 1;
  if (p.graze >= GRAZE.full) p.fullT = 0;        // 啱啱儲滿:白熱「爆」一下
  fx.push({ kind: 'spark', x, y, t: 0 });
}

// 每隻敵機只計一次。BOSS 由 BOSSES 表自己答(星蛇逐節計),冇寫就唔計 ——
// 水晶核喺頂慢慢郁,貼住佢企定就可以一路刷
function grazeEnemy(e) {
  const p = player;
  if (e.type === 'boss') {
    const def = BOSSES[e.kind];
    const n = def.graze ? def.graze(e, p, GRAZE.ring) : 0;
    if (n) addGraze(n * GRAZE.serpent, p.x, p.y);
    return;
  }
  if (!e.grazed && dist2(e, p) < (e.r + p.r + GRAZE.ring) ** 2) {
    e.grazed = true;
    addGraze(GRAZE.ship, (e.x + p.x) / 2, (e.y + p.y) / 2);
  }
}

// BOSS 喺唔喺畫面:BOSSES 表可以自己答(星蛇個頭出咗畫面,條身可能仲喺度)
function bossVisible(b) {
  const def = BOSSES[b.kind];
  return def.visible ? def.visible(b) : bossOnScreenAt(b);
}

function releaseGraze() {
  if (GRAZE.release === 'comet') { startComet(); return; }
  const p = player;
  p.graze = 0;
  p.inv = Math.max(p.inv, GRAZE.bombInv);
  for (const b of ebullets) explode(b.x, b.y, b.color || '#ff8fb0', 2);
  game.clearShots = true;       // 唔好喺度直接清:跟 B1 規矩,喺 update() 開頭先清
  game.bombT = 0; game.bombX = p.x; game.bombY = p.y;
  shake(14);
  for (let j = enemies.length - 1; j >= 0; j--) {
    const e = enemies[j];
    if (e.dying) continue;
    if (e.type === 'boss' ? !bossVisible(e) : e.y < -e.r) continue;   // 未入畫面嘅唔計
    e.hp -= GRAZE.bombDamage; e.flash = 1; e.lastDmg = GRAZE.bombDamage;
    e.hitX = p.x; e.hitY = p.y;
    if (e.hp <= 0) killEnemy(e, j);
  }
}

// ---------- 彗星爆衝 ----------
// 照設計檔「彗星爆衝+紅轉白」:儲滿放手 → 蹲一蹲、拉長 → 變彗星直衝上畫面頂,
// 撞中嘅敵機原地爆火球 → 由畫面底飛返原位 → 閃一陣(仲係無敵)。成段唔聽操作、唔開火。
// 時間(秒)由放手計起;畫法喺 js/render.js 嘅 drawPlayer / drawFx。
const FX_LIFE = { spark: .25, blast: 1.15 };   // 特效幾耐消失(秒)

const COMET = {
  crouch: .08,       // 蹲低蓄勢
  stretch: .07,      // 拉長
  rise: .45,         // 衝上畫面頂(越衝越快)
  away: .3,          // 衝咗出畫面頂之後等幾耐先由下面返嚟(設計檔係 1.05 秒,太耐冇得玩)
  back: .49,         // 由畫面底飛返原位
  blink: .4,         // 返到位之後閃,仲係無敵
  reach: 60,         // 中線左右幾闊範圍內嘅敵機會被撞(px)
  damage: 40,        // 撞中普通敵機扣幾多血(即係撞中就死)
  bossDamage: 24,    // 撞中 BOSS 扣幾多(每次衝刺每隻 BOSS 只計一次)
};
// 衝上去嘅路程比例,每 .05 秒一格(抄設計檔 keyframes:47 → 101 → 161 … → 660 px)
const COMET_RISE = [0, .0717, .153, .244, .346, .457, .578, .709, .849, 1];

const cometRiseAt = u => {                 // u: 0 → 1
  const f = clamp(u, 0, 1) * (COMET_RISE.length - 1), i = Math.min(COMET_RISE.length - 2, Math.floor(f));
  return COMET_RISE[i] + (COMET_RISE[i + 1] - COMET_RISE[i]) * (f - i);
};
const cometRiseEnd = () => COMET.crouch + COMET.stretch + COMET.rise;
const cometBackAt = () => cometRiseEnd() + COMET.away;
const cometEnd = () => cometBackAt() + COMET.back;

function startComet() {
  const p = player;
  p.graze = 0;
  // 由而家個位衝到畫面頂之外(個頭過咗 y −190)
  p.dash = { t: 0, x0: p.x, y0: p.y, dist: p.y + 190, hit: [] };
  p.inv = Math.max(p.inv, cometEnd() + COMET.blink);
  shake(6);
}

// 第 t 秒架機離原位幾遠(y,負數 = 向上)
function cometOffset(d, t) {
  const C = COMET;
  if (t < C.crouch) return 10 * t / C.crouch;
  if (t < C.crouch + C.stretch) return 10 * (1 - (t - C.crouch) / C.stretch);
  if (t < cometRiseEnd()) return -d.dist * cometRiseAt((t - C.crouch - C.stretch) / C.rise);
  if (t < cometBackAt()) return -d.dist;
  const u = clamp((t - cometBackAt()) / C.back, 0, 1);
  const from = Math.max(240, H + 50 - d.y0);           // 由畫面底下面飛返上嚟
  return from * (1 - u) * (1 - u);
}

function updateComet(dt) {
  const p = player, d = p.dash;
  const prevY = p.y;
  d.t += dt;
  p.x = d.x0;
  p.y = d.y0 + cometOffset(d, d.t);
  if (d.t >= cometEnd()) { p.y = d.y0; p.dash = null; p.cool = 0; return; }
  if (d.t < COMET.crouch + COMET.stretch || d.t >= cometRiseEnd()) return;

  // 衝上去嗰段:由上一幀到今幀經過嘅範圍,左右 reach 之內嘅敵機都撞(每隻每次只撞一下)
  const top = p.y - 30, bottom = prevY + 30;
  for (let j = enemies.length - 1; j >= 0; j--) {
    const e = enemies[j];
    if (e.dying || d.hit.includes(e)) continue;
    let hit = false;
    if (e.type === 'boss') {
      for (let y = bottom; y >= top && !hit; y -= 20) hit = enemyHit(e, { x: d.x0, y, r: COMET.reach }) > 0;
    } else {
      hit = Math.abs(e.x - d.x0) < COMET.reach + e.r && e.y > top - e.r && e.y < bottom + e.r;
    }
    if (!hit) continue;
    d.hit.push(e);
    const dmg = e.type === 'boss' ? COMET.bossDamage : COMET.damage;
    const gain = Math.round(e.score * comboMult());
    const hx = e.type === 'boss' ? d.x0 : e.x, hy = e.type === 'boss' ? p.y : e.y;
    e.hp -= dmg; e.flash = 1; e.lastDmg = dmg; e.hitX = hx; e.hitY = hy;
    fx.push({ kind: 'blast', x: hx, y: hy, t: 0, rot: d.hit.length * 20, score: e.hp <= 0 && e.type !== 'boss' ? gain : 0 });
    shake(8);
    if (e.hp <= 0) killEnemy(e, j);
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
      hitPlayer(HP.touch);
      if (e.type !== 'boss') killEnemy(e, i, false);
      continue;
    }
    grazeEnemy(e);
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

// 每隻 BOSS 可以有自己一套過場(BOSSES[kind].finale + finaleSpeed + drawFinale),冇寫就用上面通用嗰套。
// 自己嗰套最少要有 barDrain、burst、pick 三個時間,意思同上面一樣。
const finaleOf = kind => (BOSSES[kind] && BOSSES[kind].finale) || FINALE;
const finaleSpeedOf = kind => (BOSSES[kind] && BOSSES[kind].finaleSpeed) || FINALE_SPEED;

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
  game.finaleEdge = boss.edge || game.finaleColor;
  game.finaleBar = clamp((boss.hp + (boss.lastDmg || 1)) / boss.maxhp, 0, 1);   // 最後一擊之前條血條去到邊
  game.finaleReward = boss.score;
  game.clearShots = true;      // BOSS 死咗,佢臨死前射嗰啲彈唔應該喺度等玩家返嚟食
  shake(18);
}

function updateFinale(dt) {
  const F = finaleOf(game.finaleKind);
  game.finaleT += dt * finaleSpeedOf(game.finaleKind);
  const t = game.finaleT;
  const boss = enemies.find(e => e.dying);
  if (boss) {
    boss.t += dt;                // 碎片繼續轉,BOSS 唔會突然定格
    const def = BOSSES[boss.kind];
    if (def.finaleTick) def.finaleTick(boss, t);   // BOSS 自己嘅演出(例如星蛇一節節爆)
  }

  if (t >= F.burst && !(game.finaleDone & 1)) {
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

  if (t >= F.pick && !(game.finaleDone & 2)) {
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
    const d2 = dist2(b, player);
    if (player.inv <= 0 && d2 < (b.r + player.r) ** 2) {
      ebullets.splice(i, 1);
      hitPlayer();
      continue;
    }
    if (!b.grazed && d2 < (b.r + player.r + GRAZE.ring) ** 2) {
      b.grazed = true;
      addGraze(GRAZE.bullet, (b.x + player.x) / 2, (b.y + player.y) / 2);
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
      if (u.kind === 'life') player.hp = Math.min(player.maxHp, player.hp + HP.heal);
      explode(u.x, u.y, PU[u.kind].c, 16, 150);
    }
  }
}

// ---------- 每幀更新 ----------
function update(dt) {
  // 唔係打緊(暫停、揀能力、過場)嗰陣放手唔算 —— 否則返嚟一開波就會無端端放炸彈
  if (game.paused || game.state !== 'playing') player.fireHeld = false;
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
  game.bombT += dt;
  player.grazeFlash = Math.max(0, player.grazeFlash - dt * 5);
  player.fullT += dt;
  for (let i = fx.length - 1; i >= 0; i--) { fx[i].t += dt; if (fx[i].t > FX_LIFE[fx[i].kind]) fx.splice(i, 1); }
  // 血條白色嗰截:扣血之後停一停先慢慢追落去,補血就即刻跟上
  if (player.hpShown < player.hp) player.hpShown = player.hp;
  else if (game.state === 'playing') player.hpShown = Math.max(player.hp, player.hpShown - dt * 60);
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
