// 晶體同連擊:打死敵機賺晶體,連擊倍數乘上去,中彈或者停手太耐就斷。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

// 生一隻敵機再即刻打死佢,回傳今次賺到幾多晶體
function killOne(game, type = 'grunt') {
  const { g } = game;
  g.spawnEnemy(type);
  const e = g.enemies[g.enemies.length - 1];
  const before = g.game.crystals;
  g.killEnemy(e, g.enemies.indexOf(e));
  return { gained: g.game.crystals - before, score: e.score };
}

test('打死敵機會賺晶體,第一下冇加成', () => {
  const game = loadGame();
  game.startClean();
  const { gained, score } = killOne(game);
  assert.equal(gained, score);
  assert.equal(game.g.game.combo, 1);
});

test('連擊會累積,而且真係乘咗落晶體度', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  killOne(game);                       // combo 變 1
  const { gained, score } = killOne(game);
  assert.equal(g.game.combo, 2);
  assert.equal(gained, Math.round(score * (1 + 1 * g.COMBO_STEP)),
    '第二下應該用 combo 1 嘅倍數');
  assert.ok(gained > score, '有連擊應該賺多啲');
});

test('倍數會封頂', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.game.combo = g.COMBO_MAX + 500;
  assert.equal(g.comboMult(), 1 + g.COMBO_MAX * g.COMBO_STEP);
});

test('中彈即刻斷連擊', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  killOne(game); killOne(game); killOne(game);
  assert.equal(g.game.combo, 3);
  g.hitPlayer();
  assert.equal(g.game.combo, 0);
});

test('有護盾擋到都一樣斷連擊', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.player.shield = 1;
  killOne(game);
  g.hitPlayer();
  assert.equal(g.player.shield, 0, '護盾應該擋咗');
  assert.equal(g.player.lives, 3, '唔應該扣命');
  assert.equal(g.game.combo, 0, '但連擊一樣要斷');
});

test('停手太耐會斷,未夠時間唔會斷', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.player.inv = 1e9;          // 唔好畀跌落嚟嘅敵機撞到,撞到會斷連擊
  killOne(game);

  game.step(Math.floor(60 * (g.COMBO_WINDOW - 0.5)));
  assert.equal(g.game.combo, 1, '未夠 COMBO_WINDOW 唔應該斷');

  game.step(60);
  assert.equal(g.game.combo, 0, '過咗 COMBO_WINDOW 應該斷');
});

test('暫停唔會斷連擊', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  killOne(game);
  g.game.paused = true;
  game.step(60 * (g.COMBO_WINDOW + 2));
  assert.equal(g.game.combo, 1);
});

test('最高紀錄跟晶體走', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.game.crystals = 12345;
  g.player.lives = 1;
  g.player.inv = 0;
  g.hitPlayer();
  assert.equal(g.game.state, 'over');
  assert.equal(g.highScore, 12345);
  assert.equal(game.storage.stardrift_high, '12345');
});
