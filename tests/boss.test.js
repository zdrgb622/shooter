// BOSS 第一階段嘅兩招:晶簇齊射、碎片護衛。
// 重點唔係「有冇射嘢出嚟」,而係**預警一定要行先**—— 冇預警嘅攻擊玩家閃唔到,
// 呢個就係呢兩招同舊嗰三招嘅分別。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function bossAt(waveCycle = 0) {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.run('enemies.length = 0; game.queue.length = 0; spawnBoss("crystal");');
  const b = g.enemies[0];
  b.y = 140;                 // 當佢已經飛到定位,唔使等入場
  b.cycle = waveCycle;
  b.done = 0;
  g.ebullets.length = 0;
  return { game, g, b };
}

test('滿血時係第一階段,半血之後轉第二階段', () => {
  const { g, b } = bossAt();
  assert.equal(g.bossPhase(b), 1);
  b.hp = b.maxhp * .4;
  assert.equal(g.bossPhase(b), 2);
});

test('晶簇齊射:每個尖端射 3 發,五個尖端合共 15 發', () => {
  const { g, b } = bossAt();
  for (let i = 0; i < 60 * 2; i++) g.updateBoss(b, 1 / 60);   // 跑到齊射出晒
  assert.equal(g.ebullets.length, 15);
});

test('齊射係扇形:最左尖端射向左下,最右射向右下', () => {
  const { g, b } = bossAt();
  g.volleyFromTip(b, 0);
  const left = g.ebullets[1];                                 // 三發之中間嗰發
  g.ebullets.length = 0;
  g.volleyFromTip(b, g.BOSS_ART.tips.length - 1);
  const right = g.ebullets[1];
  assert.ok(left.vx < 0, '最左嗰個尖端應該射向左');
  assert.ok(right.vx > 0, '最右嗰個尖端應該射向右');
  assert.ok(left.vy > 0 && right.vy > 0, '兩邊都應該向下');
});

test('尖端一定係先着燈,之後先開火', () => {
  const { g, b } = bossAt();
  const fireAt = g.BOSS_VOLLEY_AT;
  b.cycle = fireAt - .1;
  assert.ok(g.bossTipGlow(b, 0) > 0, '開火之前應該已經着緊燈');
  g.updateBoss(b, 1 / 60);
  assert.equal(g.ebullets.length, 0, '未到時間唔應該開火');

  b.cycle = fireAt;
  g.updateBoss(b, 1 / 60);
  assert.equal(g.ebullets.length, 3, '到時間先射三發');
});

test('同一個循環入面唔會重複開火', () => {
  const { g, b } = bossAt();
  b.cycle = g.BOSS_VOLLEY_AT;
  for (let i = 0; i < 20; i++) g.updateBoss(b, 0);            // dt = 0,時間唔會行
  assert.equal(g.ebullets.length, 3, '同一時刻唔應該射足 20 次');
});

test('碎片護衛:警示圈行先,之後先掟碎片', () => {
  const { g, b } = bossAt();
  b.cycle = g.BOSS_FLING_WARN + .05;
  b.done = 0b11111;          // 齊射喺呢個循環早段,當佢哋已經出咗
  assert.ok(g.bossFlingWarn(b) > 0, '呢個時候應該出緊警示圈');
  g.updateBoss(b, 1 / 60);
  assert.equal(g.ebullets.length, 0, '警示期間唔應該已經掟咗');

  b.cycle = g.BOSS_FLING_AT;
  g.updateBoss(b, 1 / 60);
  assert.equal(g.ebullets.length, 3, '三粒碎片');
  assert.ok(g.ebullets.every(s => s.path), '碎片應該行弧線,唔係直線');
});

test('掟出嚟嘅碎片會飛到玩家嗰邊,到咗之後改行直線', () => {
  const { game, g, b } = bossAt();
  g.player.x = 200; g.player.y = 600;
  b.cycle = g.BOSS_FLING_AT;
  b.done = 0b11111;
  g.updateBoss(b, 1 / 60);
  const shard = g.ebullets[0];
  const startDist = Math.hypot(shard.x - g.player.x, shard.y - g.player.y);

  for (let i = 0; i < 60 * 1.2; i++) g.updateBullets(1 / 60);
  const near = g.ebullets.find(s => s === shard);
  assert.ok(near, '碎片唔應該中途消失');
  assert.ok(Math.hypot(near.x - 200, near.y - 600) < startDist * .2, '應該飛到咗玩家嗰邊');

  g.updateBullets(1 / 60);
  assert.equal(near.path, null, '到咗終點就唔再跟路徑');
  assert.ok(Math.hypot(near.vx, near.vy) > 0, '之後要有速度繼續飛出畫面');
});

test('過咗半血唔會即刻轉階段,要打完而家呢一招先轉', () => {
  const { g, b } = bossAt();
  b.hp = b.maxhp * .3;
  g.updateBoss(b, 1 / 60);
  assert.equal(b.phase, 1, '一招未打完,唔應該半途轉');

  let frames = 0;
  while (b.phase === 1 && frames++ < 60 * (g.BOSS_CYCLE + 1)) g.updateBoss(b, 1 / 60);
  assert.equal(b.phase, 2, '打完呢個循環就應該轉');

  g.ebullets.length = 0;
  for (let i = 0; i < 60 * 2; i++) g.updateBoss(b, 1 / 60);
  assert.ok(g.ebullets.length > 0, '第二階段照樣會開火');
  assert.ok(g.ebullets.every(s => !s.path), '第二階段嘅彈唔行弧線');
});

test('亮咗燈嘅齊射一定會射出嚟,就算中途跌穿半血', () => {
  // 舊做法每幀睇血量,尖端着緊燈嗰陣跌穿 50% 就即刻轉階段,燈亮咗但冇射 —— 失約嘅預警
  const { g, b } = bossAt();
  b.cycle = g.BOSS_VOLLEY_AT - .2;
  assert.ok(g.bossTipGlow(b, 0) > 0, '前提:第一個尖端已經着緊燈');
  b.hp = b.maxhp * .3;
  for (let i = 0; i < 60 * 2; i++) g.updateBoss(b, 1 / 60);
  assert.equal(g.ebullets.filter(s => s.color === '#4FD1C5').length, 15, '五個尖端都要射晒');
});

test('一下爆傷跨過幾個門檻,直接去最低嗰個階段', () => {
  const { g, b } = bossAt();
  g.BOSSES.crystal.phases.splice(1, 0, { over: .3, moves: g.BOSSES.crystal.phases[1].moves });
  b.hp = b.maxhp * .1;
  assert.equal(g.bossPhase(b), 3, '唔係一級一級咁跌');
});
