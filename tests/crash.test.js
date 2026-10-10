// 防止 DEVLOG 第一篇嗰隻 crash 再出現:
// 敵彈撞中玩家時,hitPlayer() 喺 updateBullets() 行緊 loop 嘅時候清空 ebullets。
// 中彈嗰粒唔喺 index 0 就會爆,所以粒數越多越易爆。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

// 喺玩家頭上一排射 n 粒子彈落嚟
function volley(game, n) {
  const { g } = game;
  for (let k = 0; k < n; k++) {
    g.eshoot(g.player.x - 15 + k * 3, g.player.y - 60, Math.PI / 2, 300);
  }
}

for (const n of [6, 12, 24]) {
  test(`${n} 粒敵彈同時中彈唔會 crash`, () => {
    const game = loadGame();
    const { g } = game;
    game.startClean();
    volley(game, n);

    assert.doesNotThrow(() => game.step(60));
    assert.equal(g.player.lives, 2, '應該扣咗一條命');
    assert.equal(g.ebullets.length, 0, '中彈之後敵彈應該清晒');
    assert.equal(g.game.clearShots, false, 'flag 用完要還原');
  });
}

test('對照組:還原舊寫法(loop 入面即刻清空)一定會 crash', () => {
  // 證明上面啲測試真係捉得到呢隻 bug,唔係點都會過
  const game = loadGame();
  game.startClean();
  game.run(`
    hitPlayer = function () {
      if (player.inv > 0) return;
      player.lives--; player.inv = 2.4;
      ebullets.length = 0;
    };
  `);
  volley(game, 12);
  assert.throws(() => game.step(60), /undefined/);
});

test('有護盾中彈:扣護盾,敵彈唔清', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.player.shield = 2;
  volley(game, 12);

  assert.doesNotThrow(() => game.step(30));
  assert.equal(g.player.lives, 3);
  assert.equal(g.player.shield, 1);
  assert.ok(g.ebullets.length > 0, '護盾分支唔應該清空敵彈');
});

test('最後一條命中彈:game over,唔會 crash', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.player.lives = 1;
  volley(game, 12);

  assert.doesNotThrow(() => game.step(30));
  assert.equal(g.game.state, 'over');
});

// B4:死嗰下唯一冇設 inv 嘅分支,所以同一幀嘅其他子彈會繼續扣命
test('最後一條命:多粒子彈同時中彈,命唔會變負數', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.player.lives = 1;
  volley(game, 12);

  game.step(30);
  assert.equal(g.game.state, 'over');
  assert.equal(g.player.lives, 0, '12 粒子彈只應該扣得一條命');
});

test('對照組:game over 分支唔設 inv,命就會變負數', () => {
  // 證明上面個測試真係捉得到 B4
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.run('player.lives = 1;');
  game.run(`
    const orig = hitPlayer;
    hitPlayer = function () {
      const before = player.inv;
      orig();
      if (game.state === 'over') player.inv = before;   // 還原舊行為
    };
  `);
  volley(game, 12);
  game.step(30);
  assert.ok(g.player.lives < 0, '舊行為會扣到負數');
});
