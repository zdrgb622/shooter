// 擦彈:敵彈 / 敵機 / 星蛇條身擦身而過就儲氣,儲滿之後放手(停火)放炸彈。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const DT = 1 / 60;

function setup() {
  const game = loadGame();
  game.startClean();
  game.run('player.graze = 0; player.fireHeld = false;');
  return { game, g: game.g };
}

// 喺戰機旁邊放一粒唔會撞到、但喺擦彈範圍入面嘅敵彈(水平飛過)
function bulletPassing(g, gap) {
  const p = g.player;
  const off = p.r + 5.5 + gap;
  g.ebullets.push({ x: p.x - 60, y: p.y - off, vx: 300, vy: 0, r: 5.5 });
}

test('敵彈擦身而過:加分,而且一粒只計一次', () => {
  const { g } = setup();
  bulletPassing(g, g.GRAZE.ring / 2);
  for (let i = 0; i < 30; i++) g.updateBullets(DT);
  assert.equal(g.player.graze, g.GRAZE.bullet);
  assert.equal(g.player.hp, g.player.maxHp, '擦唔係中');
});

test('離得太遠唔計', () => {
  const { g } = setup();
  bulletPassing(g, g.GRAZE.ring + 6);
  for (let i = 0; i < 30; i++) g.updateBullets(DT);
  assert.equal(g.player.graze, 0);
});

test('敵機擦身而過:加 GRAZE.ship 分,一隻只計一次', () => {
  const { g } = setup();
  g.spawnEnemy('grunt');
  const e = g.enemies[0];
  e.vy = 0; e.sway = 0;
  e.bx = e.x = g.player.x + e.r + g.player.r + g.GRAZE.ring / 2;
  e.y = g.player.y;
  for (let i = 0; i < 20; i++) g.updateEnemies(DT);
  assert.equal(g.player.graze, g.GRAZE.ship);
  assert.equal(g.player.hp, g.player.maxHp);
});

test('無敵期間唔計(唔可以中槍之後喺彈幕任刷)', () => {
  const { g } = setup();
  g.player.inv = 2;
  bulletPassing(g, g.GRAZE.ring / 2);
  for (let i = 0; i < 30; i++) g.updateBullets(DT);
  assert.equal(g.player.graze, 0);
});

test('中彈:儲咗嘅擦彈唔會清(血量制,唔再罰)', () => {
  const { g } = setup();
  g.player.graze = 8;
  g.hitPlayer();
  assert.equal(g.player.graze, 8);
});

test('炸彈模式:儲滿 + 放手:清晒敵彈、敵機扣血、儲氣清零', () => {
  const { game, g } = setup();
  game.run("GRAZE.release = 'bomb'");
  g.player.graze = g.GRAZE.full;
  g.spawnEnemy('gunner');
  const e = g.enemies[0];
  e.y = 200;
  const hp = e.hp;
  for (let i = 0; i < 5; i++) g.ebullets.push({ x: 100 + i * 40, y: 300, vx: 0, vy: 0, r: 5.5 });

  game.pointerDown(240, 600);
  game.step(2);
  assert.equal(g.player.graze, g.GRAZE.full, '撳住開火唔會放');
  game.pointerUp();
  game.step(2);
  assert.equal(g.player.graze, 0);
  assert.equal(g.ebullets.length, 0, '敵彈應該清晒');
  assert.equal(e.hp, hp - g.GRAZE.bombDamage);
});

test('未儲滿放手:乜都唔發生', () => {
  const { game, g } = setup();
  g.player.graze = g.GRAZE.full - 1;
  g.ebullets.push({ x: 100, y: 300, vx: 0, vy: 0, r: 5.5 });
  game.pointerDown(240, 600);
  game.step(2);
  game.pointerUp();
  game.step(2);
  assert.equal(g.player.graze, g.GRAZE.full - 1);
  assert.equal(g.ebullets.length, 1);
});

test('鍵盤:放開空白鍵都會放', () => {
  const { game, g } = setup();
  g.player.graze = g.GRAZE.full;
  game.key('Space', true);
  game.step(2);
  game.key('Space', false);
  game.step(1);
  assert.equal(g.player.graze, 0);
});

test('暫停 / 揀能力嗰陣放手唔算,返嚟唔會無端端放炸彈', () => {
  const { game, g } = setup();
  g.player.graze = g.GRAZE.full;
  game.pointerDown(240, 600);
  game.step(2);
  g.game.paused = true;
  game.pointerUp();
  game.step(2);
  g.game.paused = false;
  game.step(2);
  assert.equal(g.player.graze, g.GRAZE.full);

  game.pointerDown(240, 600);
  game.step(2);
  g.game.state = 'picking';
  game.pointerUp();
  game.step(2);
  g.game.state = 'playing';
  game.step(2);
  assert.equal(g.player.graze, g.GRAZE.full);
});

// ---------- 星蛇 ----------

function withSerpent() {
  const { game, g } = setup();
  game.run("spawnBoss('serpent')");
  return { game, g, b: g.enemies[0] };
}

// 戰機擺喺第 k 節側邊 d px
function besideSegment(b, k, d) {
  const a = b.segA[k] + Math.PI / 2;
  return { x: b.segX[k] + Math.cos(a) * d, y: b.segY[k] + Math.sin(a) * d, r: 13 };
}

// 記低每一下擦彈係喺星蛇邊一步發生
function logGrazeStages(game) {
  game.run(`globalThis.GRAZE_LOG = [];
    { const orig = addGraze;
      addGraze = function (n, x, y) { if (player.inv <= 0) GRAZE_LOG.push(enemies[0] && enemies[0].stage); return orig(n, x, y); }; }`);
}

test('星蛇:每節每招只計一次,下一招重新計', () => {
  const { game, g, b } = withSerpent();
  for (let i = 0; i < 60 * 3; i++) g.updateBoss(b, DT);
  b.stage = 'dash';                                         // 當佢攻擊緊
  const ring = g.GRAZE.ring;
  assert.equal(g.serpentGraze(b, { x: -9999, y: -9999, r: 13 }, ring), 0);
  const p = besideSegment(b, 12, g.SERPENT.grazeR + 13 + ring / 2);
  assert.ok(g.serpentGraze(b, p, ring) >= 1, '應該擦到');
  assert.equal(g.serpentGraze(b, p, ring), 0, '同一招再擦同一節唔計');
  game.run('nextMove(enemies[0])');
  assert.equal(b.grazed, 0, '下一招重新計');
});

test('星蛇:觀望、卡住、縮返嗰陣貼住佢都唔計', () => {
  const { game, g, b } = withSerpent();
  game.run(`{ const b = enemies[0]; b.move = serpentLurk(1); b.cycle = 0; b.done = 0; b.moveEnd = false;
             b.moveDur = b.move.start(b); }`);
  const ring = g.GRAZE.ring, d = g.SERPENT.grazeR + 13 + ring / 2;
  for (const stage of ['watch', 'stuck', 'back']) {
    for (let i = 0; i < 60 * 20 && b.stage !== stage; i++) g.updateBoss(b, DT);
    assert.equal(b.stage, stage);
    const p = besideSegment(b, 8, d);
    g.serpentGraze(b, p, ring);
    assert.equal(g.serpentGraze(b, p, ring), 0, `${stage} 唔應該計`);
  }
});

test('星蛇:一幀郁好遠都擦得到(計成段掃過,唔會跳過)', () => {
  const { g, b } = withSerpent();
  const ring = g.GRAZE.ring, p = { x: 240, y: 400, r: 13 };
  const r = g.SERPENT.grazeR * g.SERPENT_SCALE[5] + p.r + ring;
  b.stage = 'dash';
  b.x = b.y = -5000;
  b.segX.fill(-5000); b.segY.fill(-5000);
  g.serpentGraze(b, p, ring);                               // 記低「上一幀」
  b.segX[5] = p.x + 100; b.segY[5] = p.y + 40;
  assert.equal(g.serpentGraze(b, p, ring), 0, '由好遠瞬移過嚟:唔當掃過,而且呢點未入範圍');
  b.segX[5] = p.x - 100;                                    // 一幀郁咗 200px,橫過戰機側邊 40px
  assert.ok(Math.hypot(100, 40) > r, '前提:兩個端點都喺範圍外,淨係睇點會跳過');
  assert.equal(g.serpentGraze(b, p, ring), 1, '掃過嗰段經過擦彈範圍,應該計');
});

test('星蛇頭槌實戰:撞出去嗰陣擦到,縮返嗰陣唔計', () => {
  const { game, g, b } = withSerpent();
  logGrazeStages(game);
  game.run(`{ const b = enemies[0]; b.move = serpentLurk(1); b.cycle = 0; b.done = 0; b.moveEnd = false;
             b.moveDur = b.move.start(b); }`);
  g.player.x = 200; g.player.y = 600;
  for (let i = 0; i < 60 * 20 && b.stage !== 'pull'; i++) g.updateEnemies(DT);
  const w = b.warns.find(w => w.kind === 'lunge');
  const ux = Math.cos(w.a), uy = Math.sin(w.a);
  g.player.x = w.x + ux * w.r * .15 - uy * 40;              // 撞擊線側邊 40px,近起點(好多節會經過)
  g.player.y = w.y + uy * w.r * .15 + ux * 40;
  const move = b.move;
  for (let i = 0; i < 60 * 30 && b.move === move; i++) g.updateEnemies(DT);
  const stages = g.GRAZE_LOG;
  assert.ok(stages.filter(s => s === 'lunge').length >= 5, `撞出去應該擦到好多節:${stages}`);
  assert.equal(stages.filter(s => s !== 'lunge').length, 0, `其他時候唔應該計:${stages}`);
  assert.equal(g.player.hp, g.player.maxHp, '前提:冇撞到');
});

test('衝向玩家:企喺預警帶外面(睇落冇撞到)都擦得到', () => {
  // 預警帶半闊 28,戰機畫出嚟半闊約 19 → 中心離條線 47 先算「成架機喺帶外面」
  for (let t = 0; t < 6; t++) {                             // 方向隨機,試多幾次
    const { game, g, b } = withSerpent();
    g.player.x = 240; g.player.y = 560;
    game.run(`{ const b = enemies[0]; b.move = serpentCharge(); b.cycle = 0; b.done = 0; b.moveEnd = false;
               b.moveDur = b.move.start(b); }`);
    const w = b.warns[0];
    g.player.x = 240 - Math.sin(w.a) * 47; g.player.y = 560 + Math.cos(w.a) * 47;
    const move = b.move;
    for (let i = 0; i < 60 * 10 && b.move === move; i++) g.updateEnemies(DT);
    assert.ok(g.player.graze > 0, `${Math.round(w.a * 180 / Math.PI)}° 應該擦到`);
    assert.equal(g.player.hp, g.player.maxHp, '前提:冇撞到');
  }
});

test('水晶核唔計擦彈(貼住佢企定唔可以一路刷)', () => {
  const { game, g } = setup();
  game.run("spawnBoss('crystal')");
  const b = g.enemies[0];
  b.y = 135;
  g.player.x = b.x; g.player.y = b.y + b.r + g.player.r + g.GRAZE.ring / 2;
  g.grazeEnemy(b);
  assert.equal(g.player.graze, 0);
});

test('炸彈模式:打死 BOSS 會正常入過場', () => {
  const { game, g } = setup();
  game.run("GRAZE.release = 'bomb'");
  game.run("spawnBoss('crystal')");
  const b = g.enemies[0];
  b.y = 135; b.hp = 1;
  g.player.graze = g.GRAZE.full;
  g.releaseGraze();
  assert.equal(g.game.state, 'finale');
});

// ---------- 彗星爆衝(放手預設) ----------

// 儲滿再放手,行到彗星開始衝
function releaseComet(game, g) {
  g.player.graze = g.GRAZE.full;
  game.pointerDown(g.player.x, g.player.y);
  game.step(1);
  game.pointerUp();
  game.step(1);
}

test('彗星:放手就衝上畫面頂,再由下面飛返原位;成段無敵、唔聽操作', () => {
  const { game, g } = setup();
  g.player.x = 240; g.player.y = 600;
  releaseComet(game, g);
  const d = g.player.dash;
  assert.ok(d, '應該開始衝');
  assert.equal(g.player.graze, 0, '儲氣用晒');
  let minY = Infinity, minInv = Infinity, landed = null;
  game.key('ArrowLeft', true);                     // 撳住方向都唔應該郁
  for (let i = 0; i < 60 * 5 && !landed; i++) {
    game.step(1);
    if (g.player.dash) { minY = Math.min(minY, g.player.y); minInv = Math.min(minInv, g.player.inv); }
    else landed = { x: g.player.x, y: g.player.y, inv: g.player.inv };
  }
  game.key('ArrowLeft', false);
  assert.ok(landed, '應該衝完');
  assert.ok(minY < -100, `應該衝出畫面頂,最高去到 ${minY | 0}`);
  assert.ok(minInv > 0, '衝刺期間一直無敵');
  assert.deepEqual([Math.round(landed.x), Math.round(landed.y)], [d.x0, d.y0], '返到原位');
  assert.ok(landed.inv > 0, '返到位仲閃緊(無敵)');
});

test('彗星:撞中條路上面嘅敵機(會爆火球、彈分數),旁邊太遠嘅唔會', () => {
  const { game, g } = setup();
  g.player.x = 240; g.player.y = 600;
  g.spawnEnemy('gunner', 0); g.spawnEnemy('gunner', 1);
  const [onPath, far] = g.enemies;
  Object.assign(onPath, { x: 240 + 30, bx: 240 + 30, y: 300, vy: 0, drift: 0, hover: 0 });
  Object.assign(far, { x: 240 + g.COMET.reach + far.r + 40, bx: 240 + g.COMET.reach + far.r + 40, y: 300, vy: 0, drift: 0, hover: 0 });
  releaseComet(game, g);
  const crystals = g.game.crystals;
  game.step(Math.ceil(60 * g.cometRiseEnd()));
  assert.ok(!g.enemies.includes(onPath), '條路上面嗰隻應該死咗');
  assert.ok(g.enemies.includes(far), '太遠嗰隻唔應該中');
  assert.ok(g.game.crystals > crystals, '撞死都有錢');
  assert.ok(g.fx.some(f => f.kind === 'blast' && f.score > 0), '應該有火球同分數');
});

test('彗星:撞 BOSS 每次衝刺只扣一次', () => {
  const { game, g } = setup();
  g.player.x = 240; g.player.y = 600;
  game.run("spawnBoss('crystal')");
  const b = g.enemies[0];
  b.y = 200; b.x = 240;
  game.run('BOSSES.crystal.cruise = () => {};');   // 唔好畀佢郁走
  releaseComet(game, g);
  g.bullets.length = 0;                            // 撳住嗰陣射咗嘅普通子彈唔計
  const hp = b.hp;
  game.step(Math.ceil(60 * g.cometEnd()));
  assert.equal(b.hp, hp - g.COMET.bossDamage);
});

test('炸彈模式仍然用得', () => {
  const { game, g } = setup();
  game.run("GRAZE.release = 'bomb'");
  g.ebullets.push({ x: 100, y: 300, vx: 0, vy: 0, r: 5.5 });
  releaseComet(game, g);
  game.step(1);                                    // 清彈喺下一幀開頭先做
  assert.equal(g.player.dash, null, '炸彈模式唔會衝');
  assert.equal(g.ebullets.length, 0);
});
