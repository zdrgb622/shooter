// 動畫:碎片環繞、水晶閃光。
// 呢啲係純畫面效果,但計算部分抽咗出嚟做純函數,所以測得到 ——
// 亦都順便守住「唔好每幀 new 一堆物件」呢個要求(見 NOTES B6)。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

test('碎片會環繞,唔同時間位置唔同', () => {
  const { g } = loadGame();
  const at0 = g.bossShards(0).front.map(p => p.map(q => q.slice()));
  const at1 = g.bossShards(1.5);
  const moved = at1.front.some((p, i) => at0[i] && p.some((q, j) => q[0] !== at0[i][j][0] || q[1] !== at0[i][j][1]));
  assert.ok(moved, '碎片應該郁咗位');
});

test('碎片轉一圈之後會返返原位', () => {
  const { g } = loadGame();
  const period = Math.PI * 2 / g.SHARD_SPIN;
  const a = g.bossShards(0).front.map(p => p.map(q => q.slice()));
  const b = g.bossShards(period);
  assert.equal(b.front.length, a.length);
  b.front.forEach((p, i) => p.forEach((q, j) => {
    assert.ok(Math.abs(q[0] - a[i][j][0]) < 1e-6, 'x 應該返返原位');
    assert.ok(Math.abs(q[1] - a[i][j][1]) < 1e-6, 'y 應該返返原位');
  }));
});

test('前後兩組加埋永遠係 12 粒', () => {
  const { g } = loadGame();
  for (let t = 0; t < 20; t += .37) {
    const s = g.bossShards(t);
    assert.equal(s.back.length + s.front.length, 12, `t=${t.toFixed(2)} 走漏咗碎片`);
  }
});

test('碎片唔會每幀整新物件(B6:唔好餵垃圾畀 GC)', () => {
  const { g } = loadGame();
  const first = g.bossShards(0).front[0];
  const second = g.bossShards(1).back.concat(g.bossShards(1).front);
  const reused = second.some(p => p === first);
  assert.ok(reused, '應該重用同一批陣列,唔係每次 new');
});

test('水晶閃光:平時暗,會週期性閃一閃', () => {
  const { g } = loadGame();
  let min = 1, max = 0;
  const period = 1 / g.SHIMMER_RATE;
  for (let t = 0; t < period; t += period / 400) {
    const v = g.crystalShimmer(t, 0);
    min = Math.min(min, v); max = Math.max(max, v);
  }
  assert.ok(min <= .21, `最暗應該近 0.2,而家 ${min}`);
  assert.ok(max > .95, `應該閃到近 1,而家 ${max}`);
});

test('每舊水晶錯開相位,唔會一齊閃', () => {
  const { g } = loadGame();
  const t = 3.1;
  const vals = [0, 1, 2, 3, 4].map(i => g.crystalShimmer(t, i));
  assert.ok(new Set(vals.map(v => v.toFixed(4))).size > 1, '五舊水晶唔應該同一個光度');
});
