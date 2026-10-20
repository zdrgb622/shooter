// 虛空星蛇。重點:
//   1. 條身真係跟住個頭行過嘅路
//   2. 每招都喺畫面外開始、畫面外結束 —— 換路嗰陣玩家睇唔到佢瞬移
//   3. 每一下攻擊之前都有預警,而且預警夠早
//   4. 頭槌向住「鎖定嗰刻」玩家個位一直撞到畫面邊(撞牆);撞完卡住打頭雙倍
//   5. 衝刺瞄住玩家當刻個位直線衝過畫面

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const DT = 1 / 60;

function serpent() {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.player.inv = 1e9;
  game.run("enemies.length = 0; spawnBoss('serpent');");
  return { game, g, b: g.enemies[0] };
}

// 跳過排招,直接出指定嗰招
function force(game, b, expr) {
  game.run(`{ const b = enemies[0]; b.move = ${expr}; b.cycle = 0; b.done = 0; b.moveEnd = false;
             b.moveDur = b.move.start(b); }`);
}

// 行到呢招完為止(有上限,唔會無限loop)
function runMove(g, b, onFrame) {
  const startIdx = b.moveIdx, move = b.move;
  for (let i = 0; i < 60 * 30; i++) {
    g.updateBoss(b, DT);
    if (b.move !== move || b.moveIdx !== startIdx) return i;
    if (onFrame) onFrame(i);
  }
  throw new Error('一招行咗 30 秒都未完');
}

test('條身跟住個頭:頭到第一節 34,之後每節 39', () => {
  const { g, b } = serpent();
  // 啱啱出場:成條蛇擺喺入場嗰段直路上面,距離應該啱啱好
  const d = k => Math.hypot(b.segX[k] - b.segX[k - 1], b.segY[k] - b.segY[k - 1]);
  assert.ok(Math.abs(d(1) - g.SERPENT.headGap) < .5, `頭到第一節 ${d(1)}`);
  for (let k = 2; k < g.SERPENT.nodes; k++) assert.ok(Math.abs(d(k) - g.SERPENT.gap) < .5, `第 ${k} 節 ${d(k)}`);
});

test('轉彎時條身會跟住彎,唔係成條直住移動', () => {
  const { g, b } = serpent();
  for (let i = 0; i < 60 * 1.6; i++) g.updateBoss(b, DT);     // 游入嚟,個頭去到彎位
  const angles = new Set(Array.from(b.segA, a => a.toFixed(2)));
  assert.ok(angles.size > 4, '個頭轉咗彎,但條身仲喺直路,應該有好多個唔同方向');
});

for (const [name, expr] of [['潛伏(一下頭槌)', 'serpentLurk(1)'], ['潛伏(兩下頭槌)', 'serpentLurk(2)'],
                            ['衝向玩家', 'serpentCharge()'],
                            ['三連衝', "serpentDash('C')"], ['包圍', "serpentDash('D')"]]) {
  test(`${name}:由畫面外開始,喺畫面外結束`, () => {
    const { game, g, b } = serpent();
    force(game, b, expr);
    assert.equal(g.serpentHidden(b), true, '一出招個樣應該喺畫面外');
    let seen = false, hiddenAtEnd = false;
    runMove(g, b, () => {
      if (!g.serpentHidden(b)) seen = true;
      hiddenAtEnd = g.serpentHidden(b);
    });
    assert.ok(seen, '中間應該有入過畫面');
    assert.equal(hiddenAtEnd, true, '完嗰陣要成條離開晒畫面,下一招先可以換路');
  });
}

// 每款衝刺:由預警出現,到個頭真係衝到預警嗰個位,最少要有幾耐
const MIN_WARNING = .75;

for (const [v, expr] of [['衝向玩家', 'serpentCharge()'], ['C', "serpentDash('C')"], ['D', "serpentDash('D')"]]) {
  test(`衝刺 ${v}:每一下衝之前,預警最少早 ${MIN_WARNING} 秒`, () => {
    const { game, g, b } = serpent();
    g.player.x = 240; g.player.y = 560;
    force(game, b, expr);
    const arrived = [];
    let prevY = b.y;
    runMove(g, b, () => {
      for (let i = 0; i < b.nWarn; i++) {
        const w = b.warns[i];
        if (arrived[i] !== undefined || b.cycle < w.t0) continue;
        let hit = false;
        if (w.kind === 'col') hit = prevY < 0 && b.y >= 0 && Math.abs(b.x - w.x) < 30;    // 由頂衝入嗰條直路
        if (w.kind === 'charge') hit = b.x > 0 && b.x < g.W && b.y > 0 && b.y < g.H;      // 衝入畫面
        if (w.kind === 'ring') hit = Math.hypot(b.x - w.x, b.y - w.y) < w.r + 10;          // 去到個圈
        if (hit) arrived[i] = b.cycle - w.t0;
      }
      prevY = b.y;
    });
    const checked = b.warns.slice(0, b.nWarn).filter(w => w.kind !== 'safe');
    assert.ok(checked.length > 0);
    checked.forEach((w, i) => {
      assert.ok(arrived[i] !== undefined, `第 ${i + 1} 個預警(${w.kind})之後佢冇衝到嚟`);
      assert.ok(arrived[i] >= MIN_WARNING, `第 ${i + 1} 個預警(${w.kind})得 ${arrived[i].toFixed(2)} 秒`);
    });
  });
}

// 行到頭槌某一步
function untilStage(g, b, stage) {
  for (let i = 0; i < 60 * 20 && b.stage !== stage; i++) g.updateBoss(b, DT);
  assert.equal(b.stage, stage, `應該行到 ${stage}`);
}

test('頭槌向住「鎖定嗰刻」玩家個位撞到牆,唔係追住玩家而家個位', () => {
  const { game, g, b } = serpent();
  force(game, b, 'serpentLurk(1)');
  g.player.x = 180; g.player.y = 560;
  untilStage(g, b, 'pull');                        // 已經鎖定咗
  const line = b.warns.find(w => w.kind === 'lunge');
  g.player.x = 400; g.player.y = 620;              // 玩家閃開
  untilStage(g, b, 'stuck');
  const toWall = Math.min(b.x, g.W - b.x, b.y, g.H - b.y);
  assert.ok(toWall < g.SERPENT_LURK.wallGap + 10, `個頭應該貼住畫面邊,而家離邊 ${toWall | 0}`);
  const want = Math.atan2(560 - line.y, 180 - line.x);
  const got = Math.atan2(b.y - line.y, b.x - line.x);
  assert.ok(Math.abs(g.angleDiff(got, want)) < .05, '應該向住鎖定嗰點撞');
  assert.ok(Math.abs(g.angleDiff(got, Math.atan2(620 - line.y, 400 - line.x))) > .1, '唔應該追住玩家');
});

test('潛伏 restUp 越大,停定嗰陣企得越後(越高)', () => {
  const restY = up => {
    const { game, g, b } = serpent();
    game.run(`SERPENT_LURK.restUp = ${up}`);
    force(game, b, 'serpentLurk(1)');
    untilStage(g, b, 'watch');
    return b.y;
  };
  const y0 = restY(0), y1 = restY(120);
  assert.ok(Math.abs(y0 - y1 - 120) < 15, `restUp 0 → y ${y0 | 0},120 → y ${y1 | 0}`);
});

test('衝向玩家:條線會經過玩家起步時個位', () => {
  for (let i = 0; i < 10; i++) {                   // 起步位隨機,試多幾次
    const { game, g, b } = serpent();
    g.player.x = 100 + i * 30; g.player.y = 600 - i * 15;
    const px = g.player.x, py = g.player.y;
    force(game, b, 'serpentCharge()');
    let closest = Infinity;
    runMove(g, b, () => { closest = Math.min(closest, Math.hypot(b.x - px, b.y - py)); });
    assert.ok(closest < 15, `個頭最近離玩家 ${closest | 0}px`);
  }
});

test('頭槌之前一定有預警線同準星', () => {
  const { game, g, b } = serpent();
  force(game, b, 'serpentLurk(1)');
  untilStage(g, b, 'pull');
  const kinds = b.warns.slice(0, b.nWarn).map(w => w.kind);
  assert.ok(kinds.includes('lunge') && kinds.includes('lock'));
  const line = b.warns[kinds.indexOf('lunge')];
  untilStage(g, b, 'stuck');
  const impactAt = b.cycle - b.stageT;
  assert.ok(impactAt - line.t0 >= 1, `預警線得 ${(impactAt - line.t0).toFixed(2)} 秒`);
});

test('撞完卡住:打頭雙倍,打身一倍;平時打頭一倍', () => {
  const { game, g, b } = serpent();
  force(game, b, 'serpentLurk(1)');
  const atHead = () => ({ x: b.x + Math.cos(b.angle) * 10, y: b.y + Math.sin(b.angle) * 10, r: 4 });
  untilStage(g, b, 'watch');
  assert.equal(g.serpentHit(b, atHead()), 1, '平時打頭一倍');

  untilStage(g, b, 'stuck');
  assert.equal(b.weak, true);
  assert.equal(g.serpentHit(b, atHead()), 2, '破綻:打頭雙倍');
  assert.equal(g.serpentHit(b, { x: b.segX[10], y: b.segY[10], r: 4 }), 1, '打身照舊一倍');
  assert.equal(g.serpentHit(b, { x: -500, y: -500, r: 4 }), 0, '打唔中就係 0');
});

test('撞到條身會扣血(撞機嘅傷害)', () => {
  const { g, b } = serpent();
  for (let i = 0; i < 60 * 2; i++) g.updateBoss(b, DT);
  g.player.inv = 0;
  g.player.x = b.segX[10]; g.player.y = b.segY[10];
  g.updateEnemies(0);
  assert.equal(g.player.hp, g.HP.max - g.HP.touch);
});

test('個頭衝出畫面底都唔會俾當成飛走咗刪走', () => {
  const { game, g, b } = serpent();
  force(game, b, "serpentDash('C')");
  let wentFar = false;
  for (let i = 0; i < 60 * 9.4; i++) {
    g.updateEnemies(DT);
    if (b.y > g.H + 200) wentFar = true;
  }
  assert.ok(wentFar, '前提:個頭真係衝咗出畫面底');
  assert.ok(g.enemies.includes(b), 'BOSS 唔應該被刪');
});

test('第二階段轉色,而且要等呢招打完先轉', () => {
  const { g, b } = serpent();
  const first = b.edge;
  b.hp = b.maxhp * .4;
  g.updateBoss(b, DT);
  assert.equal(b.phase, 1, '呢招未完唔應該轉');
  for (let i = 0; i < 60 * 30 && b.phase === 1; i++) g.updateBoss(b, DT);
  assert.equal(b.phase, 2);
  assert.notEqual(b.edge, first, '轉階段要轉樣');
  assert.equal(b.edge, g.BOSSES.serpent.phases[1].edge);
});

test('打死嗰陣個頭喺畫面外,過場嘅爆炸都喺畫面入面', () => {
  const { game, g, b } = serpent();
  force(game, b, "serpentDash('C')");
  for (let i = 0; i < 60 * 9.3 && !(b.y > g.H + 60); i++) g.updateBoss(b, DT);
  assert.ok(b.y > g.H, '前提:個頭已經衝出畫面底');
  const k = Array.from(b.segY).findIndex((y, i) => i > 0 && y > 100 && y < g.H - 100);
  assert.ok(k > 0, '前提:條身仲有一截喺畫面');
  b.hp = 1;
  g.bullets.push({ x: b.segX[k], y: b.segY[k], vx: 0, vy: 0, r: 4 });
  g.updateBullets(DT);
  assert.equal(g.game.state, 'finale');
  assert.ok(g.game.finaleX > 0 && g.game.finaleX < g.W && g.game.finaleY > 0 && g.game.finaleY < g.H,
    `爆炸點 (${g.game.finaleX | 0}, ${g.game.finaleY | 0}) 應該喺畫面入面`);
});

test('每幀唔會 new 新陣列(B6)', () => {
  const { g, b } = serpent();
  const seg = b.segX, path = b.px;
  for (let i = 0; i < 60 * 40; i++) g.updateBoss(b, DT);    // 行過幾招,包括換路
  assert.equal(b.segX, seg, '節嘅位置陣列要重用');
  assert.equal(b.px, path, '條路嘅陣列要重用');
});

test('畫圖唔會爆(每一招、每一個階段)', () => {
  const { game, g, b } = serpent();
  for (let i = 0; i < 60 * 45; i++) {
    if (i === 60 * 20) b.hp = b.maxhp * .3;
    g.updateEnemies(DT);
    if (i % 5 === 0) assert.doesNotThrow(() => g.draw());
  }
});

// ---------- 擊破演出 ----------

// 打死星蛇:個頭喺畫面入面嗰陣打最後一槍
function killSerpent() {
  const { game, g, b } = serpent();
  for (let i = 0; i < 60 * 3; i++) g.updateBoss(b, DT);
  b.hp = 1;
  g.bullets.push({ x: b.x, y: b.y, vx: 0, vy: 0, r: 4 });
  g.updateBullets(DT);
  assert.equal(g.game.state, 'finale');
  return { game, g, b };
}
// 過場時間(原速秒數)換做幀數,除返星蛇自己嘅速度
const deathFrames = (g, sec) => Math.ceil(60 * sec / g.finaleSpeedOf('serpent'));

test('擊破:由條尾一節節爆上個頭', () => {
  const { g } = serpent();
  const n = g.SERPENT.nodes;
  for (let k = 1; k < n - 1; k++) {
    assert.ok(g.serpentDeathStart(k + 1) < g.serpentDeathStart(k), `第 ${k + 1} 節應該早過第 ${k} 節爆`);
  }
  assert.equal(g.serpentDeathStart(n - 1), g.SERPENT_DEATH.chain, '條尾第一個爆');
  assert.ok(g.serpentDeathStart(1) < g.SERPENT_DEATH.headSwell, '成條身爆完先到個頭');
});

test('擊破:過場入面真係逐節爆(條尾先)', () => {
  const { game, g, b } = killSerpent();
  const n = g.SERPENT.nodes, D = g.SERPENT_DEATH;
  game.step(deathFrames(g, g.serpentDeathStart(n - 1) + D.swell) + 1);
  assert.ok(b.deathDone & (1 << (n - 1)), '條尾應該爆咗');
  assert.ok(!(b.deathDone & (1 << 1)), '貼住個頭嗰節仲未爆');
  game.step(deathFrames(g, D.burst - D.chain));
  for (let k = 1; k < n; k++) assert.ok(b.deathDone & (1 << k), `第 ${k} 節應該爆咗`);
});

test('擊破:大爆炸先剷走 BOSS、掉寶;之後行得到落去,唔會卡死', () => {
  const { game, g, b } = killSerpent();
  const D = g.SERPENT_DEATH;
  game.step(deathFrames(g, D.burst) - 3);
  assert.ok(g.enemies.includes(b), '大爆炸之前條蛇仲喺度演緊');
  assert.equal(g.powerups.length, 0);
  game.step(6);
  assert.ok(!g.enemies.includes(b), '大爆炸之後先消失');
  assert.equal(g.powerups.length, 3, '照樣掉三件寶');
  assert.doesNotThrow(() => game.step(deathFrames(g, D.pick - D.burst) + 6));   // step 每幀都會畫
  assert.notEqual(g.game.state, 'finale', '過場一定要行完');
});

test('水晶核仲係用返通用過場', () => {
  const { g } = serpent();
  assert.equal(g.finaleOf('crystal'), g.FINALE);
  assert.equal(g.finaleSpeedOf('crystal'), g.FINALE_SPEED);
  assert.equal(g.finaleOf('serpent'), g.SERPENT_DEATH);
});
