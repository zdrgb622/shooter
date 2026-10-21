// 調數面板(js/tune.js)。
// 最緊要係第一個測試:面板每一條 slider 都要真係搵到遊戲入面一個數字。
// code 入面改咗名(例如 HP.bullet → HP.shot)而 TUNE_GROUPS 冇跟住改,呢度會紅。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

test('每條 slider 都對到一個數字,而且原本數值喺 slider 範圍入面', () => {
  const { run } = loadGame();
  const items = run('TUNE_ITEMS');
  assert.ok(items.length > 10);
  for (const it of items) {
    const v = run(`tuneGet(${JSON.stringify(it.path)})`);
    assert.equal(typeof v, 'number', `${it.path} 唔係數字(係 ${v})`);
    assert.ok(isFinite(v), `${it.path} = ${v}`);
    assert.ok(v >= it.min && v <= it.max, `${it.path} = ${v},但 slider 得 ${it.min}~${it.max}`);
  }
});

test('冇調過嘢:遊戲同冇面板一樣', () => {
  const { g, run } = loadGame();
  assert.deepEqual({ ...run('tuneChanges()') }, {});
  g.startRun();
  assert.equal(g.game.wave, g.START_WAVE);
  assert.equal(g.player.speed, 440);
});

test('改中彈扣血,中彈就照新數扣', () => {
  const game = loadGame();
  game.startClean();
  game.run(`tuneSet('HP.bullet', 7)`);
  const before = game.g.player.hp;
  game.run('hitPlayer()');
  assert.equal(game.g.player.hp, before - 7);
});

test('移動速度即刻套落而家架機,新一局都仲係', () => {
  const { g, run } = loadGame();
  run(`tuneSet('PLAYER.speed', 600)`);
  assert.equal(g.player.speed, 600);
  run('newGame()');
  assert.equal(g.player.speed, 600);
});

test('由第幾波開始', () => {
  const { g, run } = loadGame();
  run(`tuneSet('RUN.startWave', 7)`);
  run('newGame(); startRun()');
  assert.equal(g.game.wave, 7);
});

test('BOSS 血量倍數', () => {
  const { run } = loadGame();
  const base = run('BOSSES.serpent.hp(3)');
  run(`tuneSet('BOSS_HP.serpent', 2)`);
  assert.equal(run('BOSSES.serpent.hp(3)'), base * 2);
});

test('改動存落瀏覽器,reload 之後仲喺度', () => {
  const first = loadGame();
  first.run(`tuneSet('GRAZE.full', 20); tuneSave()`);
  const saved = first.storage.stardrift_tune;
  assert.match(saved, /GRAZE\.full/);

  // 模擬 reload:用同一份 localStorage 再載入
  const second = loadGame();
  second.storage.stardrift_tune = saved;
  second.run('tuneLoad()');
  assert.equal(second.run('GRAZE.full'), 20);
});

test('複製出嚟嘅文字有路徑、舊數同新數', () => {
  const { run } = loadGame();
  run(`tuneSet('COMET.rise', .6)`);
  const text = run('tuneReport()');
  assert.match(text, /COMET\.rise: 0\.45 → 0\.6/);
});

test('頭槌時間調長咗,星蛇照打唔會爆', () => {
  const game = loadGame();
  game.startClean();
  game.run(`tuneSet('SERPENT_LURK.stuck', 2); tuneSet('SERPENT_LURK.watch', 3.5)`);
  game.run(`game.wave = 2; spawnBoss('serpent')`);
  game.g.player.inv = 1e9;
  assert.doesNotThrow(() => game.step(60 * 25));
});
