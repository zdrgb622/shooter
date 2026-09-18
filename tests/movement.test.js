// 所有輸入都經 moveIntent() * player.speed 決定速度。
// 鍵盤同手掣最高 1 倍,手指 / 滑鼠最高 POINTER_SPEED_MULT 倍。
// 測試讀返遊戲而家嘅 player.speed,所以改速度唔使改測試。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const DT = 1 / 60;

// 由 x=90 行到 x=390,回傳用咗幾多秒同最高速
function race(game, setInput, perFrame) {
  const { g } = game;
  game.startClean();
  g.player.x = 90; g.player.y = 500; g.player.inv = 99;
  setInput();
  let frames = 0, peak = 0;
  while (g.player.x < 389.5 && frames < 600) {
    if (perFrame) perFrame();
    g.pollGamepad();
    const before = g.player.x;
    g.updatePlayer(DT);
    peak = Math.max(peak, (g.player.x - before) / DT);
    frames++;
  }
  return { seconds: frames * DT, peak };
}

test('鍵盤最高速 = player.speed', () => {
  const game = loadGame();
  const r = race(game, () => game.key('ArrowRight'));
  assert.ok(Math.abs(r.peak - game.g.player.speed) < 1, `peak ${r.peak}`);
});

test('手掣推盡同鍵盤一樣快', () => {
  const game = loadGame();
  const kb = race(game, () => game.key('ArrowRight'));
  game.key('ArrowRight', false);
  const pad = game.plugGamepad();
  const stick = race(game, () => { pad.axes[0] = 1; });
  assert.ok(Math.abs(stick.peak - kb.peak) < 1, `pad ${stick.peak} vs kb ${kb.peak}`);
});

test('手掣推一半 = 一半速度(死區之後重新計)', () => {
  const game = loadGame();
  const pad = game.plugGamepad();
  // 死區 0.2:推 0.6 → (0.6 - 0.2) / 0.8 = 0.5
  const r = race(game, () => { pad.axes[0] = 0.6; });
  assert.ok(Math.abs(r.peak - game.g.player.speed * 0.5) < 1, `peak ${r.peak}`);
});

test('手指最高速 = player.speed * POINTER_SPEED_MULT', () => {
  const game = loadGame();
  const { g } = game;
  const r = race(game, () => { g.pointer.down = true; g.pointer.x = 390; g.pointer.y = 526; });
  const expected = g.player.speed * g.POINTER_SPEED_MULT;
  assert.ok(Math.abs(r.peak - expected) < 1, `peak ${r.peak}, expected ${expected}`);
});

test('手指會準確停喺目標,唔會衝過龍', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.player.inv = 99;
  g.pointer.down = true; g.pointer.x = 300; g.pointer.y = 526;  // 戰機停喺手指上面 26px
  for (let i = 0; i < 120; i++) g.updatePlayer(DT);
  assert.ok(Math.abs(g.player.x - 300) < 0.01, `x ${g.player.x}`);
  assert.ok(Math.abs(g.player.y - 500) < 0.01, `y ${g.player.y}`);
});

test('斜行唔會快過直行', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.key('ArrowRight'); game.key('ArrowUp');
  const x0 = g.player.x, y0 = g.player.y;
  g.updatePlayer(DT);
  const speed = Math.hypot(g.player.x - x0, g.player.y - y0) / DT;
  assert.ok(Math.abs(speed - g.player.speed) < 1, `diagonal ${speed}`);
});

test('十字鍵斜行都唔會快過直行', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  const pad = game.plugGamepad();
  pad.press(15); pad.press(12);  // 右 + 上
  g.pollGamepad();
  const x0 = g.player.x, y0 = g.player.y;
  g.updatePlayer(DT);
  const speed = Math.hypot(g.player.x - x0, g.player.y - y0) / DT;
  assert.ok(Math.abs(speed - g.player.speed) < 1, `diagonal ${speed}`);
});
