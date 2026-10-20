// 防止 DEVLOG 第一篇嗰隻 crash 再出現:
// 敵彈撞中玩家時,hitPlayer() 喺 updateBullets() 行緊 loop 嘅時候清空 ebullets。
// 中彈嗰粒唔喺 index 0 就會爆,所以粒數越多越易爆。
// (而家中彈已經唔清敵彈,但「loop 入面唔好清陣列」呢條規矩照守,對照組證明點解。)

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

// 數「中彈爆炸」(白色嗰種)爆咗幾多次
function countHitBursts(game) {
  game.run(`globalThis.HIT_BURSTS = 0;
    { const orig = explode;
      explode = function (x, y, color, ...rest) { if (color === '#ffffff') HIT_BURSTS++; return orig(x, y, color, ...rest); }; }`);
}

for (const n of [6, 12, 24]) {
  test(`${n} 粒敵彈同時中彈唔會 crash,而且只扣一次血`, () => {
    const game = loadGame();
    const { g } = game;
    game.startClean();
    volley(game, n);

    assert.doesNotThrow(() => game.step(60));
    assert.equal(g.player.hp, g.HP.max - g.HP.bullet, '無敵時間入面其他子彈唔應該再扣');
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
      player.hp -= 20; player.inv = 2.4;
      ebullets.length = 0;
    };
  `);
  volley(game, 12);
  assert.throws(() => game.step(60), /undefined/);
});

test('中彈:扣血、有無敵,但唔跌火力、唔清擦彈、唔搬架機、唔清敵彈', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.player.level = 3;
  g.player.graze = 5;
  g.player.x = 100; g.player.y = 500;
  for (let i = 0; i < 4; i++) g.ebullets.push({ x: 300, y: 100 + i * 40, vx: 0, vy: 0, r: 5.5 });
  g.hitPlayer();
  assert.equal(g.player.hp, g.HP.max - g.HP.bullet);
  assert.equal(g.player.inv, g.HP.inv);
  assert.equal(g.player.level, 3, '唔應該跌火力');
  assert.equal(g.player.graze, 5, '唔應該清擦彈');
  assert.deepEqual([g.player.x, g.player.y], [100, 500], '唔應該搬返去起點');
  game.step(1);
  assert.equal(g.ebullets.length, 4, '唔應該清敵彈');
});

test('有護盾中彈:扣護盾,唔扣血,敵彈唔清', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.player.shield = 2;
  volley(game, 12);

  assert.doesNotThrow(() => game.step(30));
  assert.equal(g.player.hp, g.HP.max);
  assert.equal(g.player.shield, 1);
  assert.ok(g.ebullets.length > 0, '護盾分支唔應該清空敵彈');
});

test('執 ♥ 補血,唔會超過上限', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.player.hp = 10;
  g.drop(g.player.x, g.player.y, 'life');
  game.step(1);
  assert.equal(g.player.hp, 10 + g.HP.heal);
  g.player.hp = g.player.maxHp - 1;
  g.drop(g.player.x, g.player.y, 'life');
  game.step(1);
  assert.equal(g.player.hp, g.player.maxHp);
});

test('血扣晒:game over,唔會 crash', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.player.hp = 1;
  volley(game, 12);

  assert.doesNotThrow(() => game.step(30));
  assert.equal(g.game.state, 'over');
  assert.equal(g.player.hp, 0);
});

// B4:死嗰下以前冇設 inv,同一幀嘅其他子彈會繼續撞,爆炸疊幾次
test('血扣晒:多粒子彈同時中彈,只會爆一次', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  countHitBursts(game);
  g.player.hp = 1;
  volley(game, 12);

  game.step(30);
  assert.equal(g.game.state, 'over');
  assert.equal(g.HIT_BURSTS, 1, '12 粒子彈只應該算一下');
});

test('對照組:game over 分支唔設 inv,就會爆幾次', () => {
  // 證明上面個測試真係捉得到 B4
  const game = loadGame();
  const { g } = game;
  game.startClean();
  countHitBursts(game);
  game.run('player.hp = 1;');
  game.run(`
    const orig = hitPlayer;
    hitPlayer = function (dmg) {
      const before = player.inv;
      orig(dmg);
      if (game.state === 'over') player.inv = before;   // 還原舊行為
    };
  `);
  volley(game, 12);
  game.step(30);
  assert.ok(g.HIT_BURSTS > 1, '舊行為會一粒爆一次');
});
