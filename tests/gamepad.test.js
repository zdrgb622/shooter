// 手掣:死區、十字鍵、開火,同埋 Start / A 只認「啱啱撳落」嗰一下。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

test('死區內嘅漂移當冇推', () => {
  const game = loadGame();
  const { g } = game;
  const pad = game.plugGamepad();
  pad.axes[0] = 0.12; pad.axes[1] = -0.08;
  g.pollGamepad();
  assert.equal(g.pad.x, 0);
  assert.equal(g.pad.y, 0);
});

test('A 或 RT 開火', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  const pad = game.plugGamepad();
  pad.press(0); g.pollGamepad(); assert.equal(g.pad.fire, true);
  pad.press(0, false); pad.press(7); g.pollGamepad(); assert.equal(g.pad.fire, true);
  pad.press(7, false); g.pollGamepad(); assert.equal(g.pad.fire, false);
});

test('標題畫面撳 A 開始', () => {
  const game = loadGame();
  const { g } = game;
  const pad = game.plugGamepad();
  pad.press(0);
  g.pollGamepad();
  assert.equal(g.game.state, 'playing');
});

test('撳住 A 死咗,唔會即刻重新開始', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  const pad = game.plugGamepad();
  pad.press(0); g.pollGamepad();       // 一路撳住 A 開火
  g.game.state = 'over';                 // 死咗
  g.pollGamepad(); g.pollGamepad();
  assert.equal(g.game.state, 'over');
  pad.press(0, false); g.pollGamepad(); // 放手
  pad.press(0); g.pollGamepad();        // 再撳
  assert.equal(g.game.state, 'playing');
});

test('Start 撳一下切換一次,撳住唔會連環切換', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  const pad = game.plugGamepad();
  pad.press(9);
  // 每幀都要檢查:只睇最後結果嘅話,切換單數次都會啱啱好係 true
  for (let i = 0; i < 4; i++) {
    g.pollGamepad();
    assert.equal(g.game.paused, true, `撳住第 ${i + 1} 幀`);
  }
  pad.press(9, false); g.pollGamepad();
  pad.press(9); g.pollGamepad();
  assert.equal(g.game.paused, false);
});

test('拔走手掣之後輸入清零', () => {
  const game = loadGame();
  const { g } = game;
  const pad = game.plugGamepad();
  pad.axes[0] = 1; pad.press(0);
  g.pollGamepad();
  game.unplugGamepad();
  g.pollGamepad();
  assert.equal(g.pad.x, 0);
  assert.equal(g.pad.fire, false);
});
