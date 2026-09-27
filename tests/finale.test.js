// 打低 BOSS 之後嘅過場。
// 重點係次序同「唔可以卡死」:過場一定要行到底,唔可以中途停喺度接唔落去。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function killBoss() {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.run('game.wave = 5; enemies.length = 0; game.queue.length = 0; spawnEnemy("boss");');
  const boss = g.enemies[0];
  boss.y = 200;
  boss.hp = 1;
  g.bullets.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, r: 4 });
  g.updateBullets(1 / 60);
  return { game, g, boss };
}

test('BOSS 演完先消失,唔係中一槍就即刻冇咗', () => {
  const { game, g, boss } = killBoss();
  assert.ok(g.enemies.includes(boss), '過場一開始 BOSS 仲要喺度');
  assert.equal(boss.dying, true);

  game.step(Math.ceil(60 * (g.FINALE.burst - .1)));
  assert.ok(g.enemies.includes(boss), '未到爆開嗰下,BOSS 仲喺度');

  game.step(Math.ceil(60 * .2));
  assert.ok(!g.enemies.includes(boss), '爆開之後先消失');
});

test('掉寶同爆炸都係喺爆開嗰下先出,唔會早過個畫面', () => {
  const { game, g } = killBoss();
  assert.equal(g.powerups.length, 0, '一開始唔應該已經掉咗寶');

  game.step(Math.ceil(60 * (g.FINALE.burst + .1)));
  assert.equal(g.powerups.length, 3);
  assert.ok(g.particles.length > 50, '應該有大爆炸');
});

test('晶體即刻入帳,唔使等過場完', () => {
  const { g } = killBoss();
  assert.ok(g.game.crystals > 0, '打低咗就即刻有錢,過場只係畫面');
  assert.equal(g.game.finaleReward, 3000, '過場顯示嘅獎勵係 BOSS 嘅分值');
});

test('過場期間遊戲定格,但粒子照郁', () => {
  const { game, g } = killBoss();
  g.eshoot(100, 100, Math.PI / 2, 300);
  const y0 = g.ebullets[0].y;
  const n0 = g.particles.length;
  game.step(20);
  assert.equal(g.ebullets[0].y, y0, '敵彈唔應該再郁');
  assert.notEqual(g.particles.length, n0, '粒子要繼續演');
});

test('過場一定行得到尾,唔會卡喺中間', () => {
  const { game, g } = killBoss();
  game.step(Math.ceil(60 * (g.FINALE.pick + .5)));
  assert.equal(g.game.state, 'picking');
  assert.equal(g.pickOffers.length, 3, '應該已經抽好三張卡');
});

test('暫停會連過場都停', () => {
  const { game, g } = killBoss();
  game.step(10);
  const t0 = g.game.finaleT;
  g.game.paused = true;
  game.step(60);
  assert.equal(g.game.finaleT, t0, '暫停時過場唔應該繼續行');
});

test('唔係 BOSS 波打低 BOSS 就唔會有過場', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.run('game.wave = 4; enemies.length = 0; spawnEnemy("boss");');
  const boss = g.enemies[0];
  boss.y = 200; boss.hp = 1;
  g.bullets.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, r: 4 });
  g.updateBullets(1 / 60);
  assert.equal(g.game.state, 'playing');
  assert.ok(!g.enemies.includes(boss), '照舊即刻消失');
});
