// 主炮:P 幾多格就幾多條線。郁緊係窄扇形;企定慢慢收埋做一條集火光束,傷害有加成。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function setup(level = 3) {
  const game = loadGame();
  game.startClean();
  const { g } = game;
  g.player.level = level;
  g.player.inv = 1e9;
  return { game, g };
}

// 開一槍,回傳今次射出嚟嘅子彈
function shoot(g) {
  g.bullets.length = 0;
  g.player.cool = 0;
  g.fire();
  return g.bullets.slice();
}

test('郁緊:三條線,窄扇形散開', () => {
  const { game, g } = setup();
  game.key('ArrowLeft', true);
  game.step(10);
  assert.equal(g.player.focus, 0);
  const shots = shoot(g);
  assert.equal(shots.length, 3);
  const angles = shots.map(b => Math.atan2(b.vx, -b.vy)).sort((a, b) => a - b);
  assert.ok(Math.abs(angles[0] + g.GUN.spread) < 1e-9 && Math.abs(angles[2] - g.GUN.spread) < 1e-9, '兩邊各斜 spread');
  assert.ok(g.GUN.spread < .25, '係窄扇形,唔係以前咁闊');
});

test('企定:慢慢收埋,夠鐘變一粒集火彈,傷害有加成', () => {
  const { game, g } = setup();
  game.step(Math.ceil(60 * g.GUN.focusIn / 2));
  const half = shoot(g);
  assert.equal(half.length, 3, '未收埋晒仲係三條');
  const spreadHalf = Math.max(...half.map(b => Math.abs(b.vx)));
  assert.ok(spreadHalf > 0 && spreadHalf < Math.sin(g.GUN.spread) * 640, '收緊:角度細過郁緊嗰陣');

  game.step(Math.ceil(60 * g.GUN.focusIn));
  assert.equal(g.player.focus, 1);
  const focused = shoot(g);
  assert.equal(focused.length, 1, '收埋晒得一條');
  assert.equal(focused[0].vx, 0);
  assert.equal(focused[0].dmg, 3 * g.GUN.focusBonus);
});

test('一郁就散返開', () => {
  const { game, g } = setup();
  game.step(60);
  assert.equal(g.player.focus, 1);
  game.key('ArrowRight', true);
  game.step(Math.ceil(60 * g.GUN.focusOut) + 1);
  assert.equal(g.player.focus, 0);
  assert.equal(shoot(g).length, 3);
});

test('一條線(1 格 P)企定都係一條,唔會有加成', () => {
  const { game, g } = setup(1);
  game.step(60);
  const shots = shoot(g);
  assert.equal(shots.length, 1);
  assert.equal(shots[0].dmg, undefined);
});

test('集火彈打中扣嘅血 = 條數 × 加成', () => {
  const { g } = setup();
  g.spawnEnemy('gunner');
  const e = g.enemies[0];
  e.y = 300; e.hp = 100;
  g.bullets.push({ x: e.x, y: e.y, vx: 0, vy: 0, r: 6, dmg: 3 * g.GUN.focusBonus, big: true });
  g.updateBullets(1 / 60);
  assert.ok(Math.abs(e.hp - (100 - 3 * g.GUN.focusBonus)) < 1e-9);
});

test('P 最多 3 格', () => {
  const { game, g } = setup();
  g.drop(g.player.x, g.player.y, 'power');
  game.step(1);
  assert.equal(g.player.level, g.GUN.maxLevel);
});
