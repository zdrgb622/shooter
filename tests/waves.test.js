// 一波點樣砌出嚟。呢度係用嚟試關卡設置嘅,所以重點係:
// 改 WAVE 入面嘅設定真係會生效,而且 WAVE_SCRIPT 試完唔會唔覺意留低。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

test('WAVE_SCRIPT 係 null(試完後期記得改返先好 commit)', () => {
  const { g } = loadGame();
  assert.equal(g.WAVE_SCRIPT, null,
    'js/entities.js 嘅 WAVE_SCRIPT 仲寫住嘢,玩家會次次都打你寫嗰條試驗波');
});

test('BOSS 幾多波一隻,同幾多波揀一次能力,可以唔同', () => {
  const game = loadGame();
  const { g } = game;
  game.run('WAVE.bossEvery = 2;');
  game.startClean();
  game.run('game.wave = 1; enemies.length = 0; game.queue.length = 0; startWave();');
  game.step(120);
  assert.equal(g.enemies[0].type, 'boss', '第 2 波應該有 BOSS');
});

test('改 WAVE.count 同 WAVE.gap 即刻生效', () => {
  const game = loadGame();
  const { g } = game;
  game.run('WAVE.count = () => 4; WAVE.gap = () => 2; WAVE.lead = 1;');
  const q = g.buildWave(7);
  assert.equal(q.length, 4);
  // 跨 vm realm:vm 入面嘅陣列唔係外面嗰個 Array,要先搬出嚟先比較得到
  assert.deepEqual(Array.from(q, e => e.t), [1, 3, 5, 7], '第一隻等 lead,之後每隻隔 gap');
});

test('出乜怪跟 mix:未解鎖嘅唔會出', () => {
  const game = loadGame();
  const { g } = game;
  // 用測試自己嘅 mix,唔好靠遊戲而家調緊嗰套 —— 嗰啲係俾人試玩時改嘅
  game.run(`WAVE.mix = [
    { type: 'gunner', from: 3, weight: 22 },
    { type: 'darter', from: 2, weight: 23 },
    { type: 'grunt',  from: 1, weight: 55 },
  ];`);
  const typesAt = w => {
    const seen = new Set();
    for (let i = 0; i < 60; i++) g.buildWave(w).forEach(e => seen.add(e.type));
    return [...seen].sort();
  };
  assert.deepEqual(typesAt(1), ['grunt'], '第 1 波淨係 grunt');
  assert.deepEqual(typesAt(2), ['darter', 'grunt'], '第 2 波解鎖 darter');
  assert.deepEqual(typesAt(3), ['darter', 'grunt', 'gunner'], '第 3 波起三種都有');
});

test('加一種新怪落 mix 就出到,唔使改其他嘢', () => {
  const game = loadGame();
  const { g } = game;
  game.run("WAVE.mix = [{ type: 'grunt', from: 1, weight: 1 }, { type: 'darter', from: 1, weight: 1e6 }];");
  const types = new Set(g.buildWave(1).map(e => e.type));
  assert.ok(types.has('darter'), '權重大就應該幾乎次次抽到佢');
});

// ---------- WAVE_SCRIPT:自己寫一條波出嚟試 ----------

const SCRIPT = `WAVE_SCRIPT = [
  { at: 0.5, type: 'gunner', x: 0 },
  { at: 0.5, type: 'gunner', x: 1 },
  { at: 2.0, type: 'darter', x: .5 },
];`;

test('寫咗 WAVE_SCRIPT 就照佢出,時間同位置都跟足', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.run(SCRIPT);
  game.run('enemies.length = 0; startWave();');

  game.step(45);              // 0.75 秒
  assert.equal(g.enemies.length, 2, '頭兩隻一齊出');
  // 睇 bx(出場嗰個位)唔好睇 x —— 敵機一出場就會左右擺,x 已經唔係原位
  const xs = Array.from(g.enemies, e => e.bx).sort((a, b) => a - b);
  assert.equal(xs[0], 45, 'x: 0 = 最左');
  assert.equal(xs[1], g.W - 45, 'x: 1 = 最右');
  assert.ok(g.enemies.every(e => e.type === 'gunner'));

  game.step(90);              // 行多 1.5 秒
  assert.equal(g.enemies.filter(e => e.type === 'darter').length, 1, '夠鐘先出第三隻');
});

test('x 唔寫就隨機,唔會迫晒去同一個位', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.run("WAVE_SCRIPT = [{ at: 0, type: 'grunt' }];");
  const xs = new Set();
  for (let i = 0; i < 20; i++) {
    game.run('enemies.length = 0; game.wave = 0; startWave();');   // 每次都由第 1 波開始,唔好撞正 BOSS 波
    game.step(5);
    xs.add(g.enemies[0].bx);
  }
  assert.ok(xs.size > 15, `20 次應該散開,而家得 ${xs.size} 個唔同位置`);
});

test('BOSS 波唔受 WAVE_SCRIPT 影響', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.run(SCRIPT);
  const w = game.findWave({ boss: true });
  game.run(`enemies.length = 0; game.wave = ${w - 1}; startWave();`);
  game.step(120);
  assert.equal(g.enemies.length, 1);
  assert.equal(g.enemies[0].type, 'boss', 'BOSS 波照出 BOSS');
});
