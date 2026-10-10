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

test('BOSS 波出到 BOSS,而且 WAVE.bosses 輪住出', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  const w = game.findWave({ boss: true });
  game.run(`game.wave = ${w - 1}; startWave();`);
  game.step(90);
  const boss = g.enemies.find(e => e.type === 'boss');
  assert.ok(boss, '應該出咗 BOSS');
  assert.equal(boss.kind, g.bossForWave(w), '出嘅係 WAVE.bosses 排咗嗰隻');
});

// 每一隻 BOSS 都要打得死、有過場、會掉寶 —— 加新 BOSS 唔使改呢個測試
test('每一隻 BOSS 都打得死', () => {
  const { g } = loadGame();
  for (const kind of Object.keys(g.BOSSES)) {
    const game = loadGame();
    const { g } = game;
    game.startClean();
    g.player.inv = 1e9;
    game.run(`enemies.length = 0; spawnBoss('${kind}');`);
    const boss = g.enemies[0];

    // 等佢個頭入到畫面(水晶核要跌落嚟,星蛇要游入嚟)
    for (let i = 0; i < 60 * 6 && !(boss.x > 40 && boss.x < g.W - 40 && boss.y > 60 && boss.y < g.H - 60); i++) {
      game.step(1);
    }
    assert.ok(boss.y > 60 && boss.y < g.H - 60, `${kind} 應該入咗畫面`);

    // 直接叫 updateBullets:如果行成個 step,BOSS 會喺子彈判定之前先郁咗位
    boss.hp = 1;
    g.bullets.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, r: 4 });
    assert.doesNotThrow(() => g.updateBullets(1 / 60));
    assert.equal(g.game.state, 'finale', `打低 ${kind} 會入過場`);

    game.step(Math.ceil(60 * g.FINALE.burst / g.FINALE_SPEED) + 6);
    assert.ok(!g.enemies.includes(boss), `${kind} 應該死咗`);
    assert.equal(g.powerups.length, 3, `${kind} 死咗應該掉三件寶`);
  }
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
