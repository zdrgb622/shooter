// 暫停:P / Escape、畫面右上角個掣、手掣 Start。
// 最重要嘅一點:撳個掣唔可以令戰機飛去手指位置同開火(個 canvas 本身就係控制器)。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const buttonCenter = g => [g.pauseButton.x + g.pauseButton.w / 2, g.pauseButton.y + g.pauseButton.h / 2];

test('撳 pause 掣會暫停,而且唔會當成拖動', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.pointerDown(...buttonCenter(g));
  assert.equal(g.game.paused, true);
  assert.equal(g.pointer.down, false);
});

test('撳住個掣恢復,戰機唔會飛過去、唔會開火', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.pointerDown(...buttonCenter(g)); game.pointerUp();   // 暫停
  const x0 = g.player.x, y0 = g.player.y;
  game.pointerDown(...buttonCenter(g));                     // 恢復,唔放手
  assert.equal(g.game.paused, false);
  game.step(10);
  assert.equal(g.player.x, x0);
  assert.equal(g.player.y, y0);
  assert.equal(g.bullets.length, 0);
});

test('對照組:撳畫面其他位置會拖動同開火', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  const x0 = g.player.x, y0 = g.player.y;
  game.pointerDown(100, 300);
  game.step(10);
  assert.ok(g.player.x !== x0 || g.player.y !== y0, '戰機應該有郁');
  assert.ok(g.bullets.length > 0, '應該有開火');
});

test('暫停時遊戲定格', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.eshoot(100, 100, Math.PI / 2, 300);
  game.key('KeyP');
  const y0 = g.ebullets[0].y;
  game.step(30);
  assert.equal(g.ebullets[0].y, y0);
});

test('暫停連背景星星都停', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.step(5);
  const before = g.stars.map(s => s.y);
  game.key('KeyP');
  game.step(30);
  assert.deepEqual(g.stars.map(s => s.y), before, '暫停時星星唔應該再飄');

  game.key('KeyP');
  game.step(5);
  assert.notDeepEqual(g.stars.map(s => s.y), before, '恢復之後要再飄返');
});

test('P 同 Escape 都可以暫停 / 恢復', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.key('KeyP'); assert.equal(g.game.paused, true);
  game.key('KeyP'); assert.equal(g.game.paused, false);
  game.key('Escape'); assert.equal(g.game.paused, true);
  game.key('Escape'); assert.equal(g.game.paused, false);
});

test('標題畫面個掣唔生效', () => {
  const game = loadGame();
  const { g } = game;
  assert.equal(g.game.state, 'title');
  assert.equal(g.pauseActive(), false);
});
