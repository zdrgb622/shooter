// 冒煙測試:成個遊戲由開始跑到打 BOSS 都唔會爆。
// 唔檢查細節,只係確保冇任何 exception —— 大改動之後第一個要睇嘅就係呢個。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

test('START_WAVE 係 1(試完後期記得改返先好 commit)', () => {
  const { g } = loadGame();
  assert.equal(g.START_WAVE, 1, `js/core.js 嘅 START_WAVE 而家係 ${g.START_WAVE}`);
});

test('載入之後停喺標題畫面', () => {
  const { g } = loadGame();
  assert.equal(g.game.state, 'title');
});

test('開局跑 20 秒遊戲時間唔會爆', () => {
  const game = loadGame();
  game.g.startRun();
  game.g.player.inv = 1e9;   // 無敵,等佢跑夠時間
  assert.doesNotThrow(() => game.step(60 * 20));
  assert.equal(game.g.game.state, 'playing');
});

test('第 5 波係 BOSS,打得死', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.run('game.wave = 4; startWave();');
  game.step(90);
  const boss = g.enemies.find(e => e.type === 'boss');
  assert.ok(boss, '應該出咗 BOSS');

  // 直接叫 updateBullets:如果行成個 step,BOSS 會喺子彈判定之前先郁咗位
  boss.y = 200;   // 啱啱出場時仲喺畫面上面,子彈會先被當成出界刪走
  boss.hp = 1;
  g.bullets.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, r: 4 });
  assert.doesNotThrow(() => g.updateBullets(1 / 60));
  assert.equal(g.game.state, 'finale', '打低 BOSS 會入過場');

  // BOSS 要演完先真正消失,所以要行到碎片炸開嗰下
  game.step(Math.ceil(60 * (g.FINALE.burst + .1)));
  assert.ok(!g.enemies.includes(boss), 'BOSS 應該死咗');
  assert.equal(g.powerups.length, 3, 'BOSS 死咗應該掉三件寶');
});

test('Game over 之後可以重新開始', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.player.lives = 1;
  g.hitPlayer();
  assert.equal(g.game.state, 'over');
  game.key('KeyR');
  assert.equal(g.game.state, 'playing');
  assert.equal(g.player.lives, 3);
});
