// 能力選擇嘅流程。UI 喺 js/ui.js,所有 DOM 操作都守住 pickEl,
// 所以喺冇真 DOM 嘅 Node 入面一樣測得到成個流程。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

test('打完 BOSS 波會開能力選擇,唔係 BOSS 波就直接開下一波', () => {
  const game = loadGame();
  const { g } = game;

  game.startClean();
  game.run(`game.wave = ${5}; game.queue.length = 0; enemies.length = 0; game.gap = 0;`);
  game.step(90);                                  // 等過 1.2 秒嘅間場
  assert.equal(g.game.state, 'picking', 'BOSS 波之後應該揀能力');

  const game2 = loadGame();
  game2.startClean();
  game2.run('game.wave = 4; game.queue.length = 0; enemies.length = 0; game.gap = 0;');
  game2.step(90);
  assert.equal(game2.g.game.state, 'playing');
  assert.equal(game2.g.game.wave, 5, '普通波之後直接開下一波');
});

test('BOSS 一死即刻入過場,過場完先入能力畫面', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.run('game.wave = 5; enemies.length = 0; spawnEnemy("boss");');
  const boss = g.enemies[0];
  boss.hp = 1;
  boss.y = 200;
  g.bullets.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, r: 4 });
  g.updateBullets(1 / 60);
  assert.equal(g.game.state, 'finale', '死嗰一刻即刻入過場,唔會吉住');

  const pickFrames = Math.ceil(60 * g.FINALE.pick / g.FINALE_SPEED);   // 除返速度,唔好當佢係 1
  game.step(pickFrames - 6);
  assert.equal(g.game.state, 'finale', '過場未完唔應該跳走');

  game.step(12);
  assert.equal(g.game.state, 'picking', '過場完先入能力畫面');
});

test('揀能力嗰陣遊戲定格', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.eshoot(100, 100, Math.PI / 2, 300);
  g.openPicker();
  const y0 = g.ebullets[0].y;
  game.step(60);
  assert.equal(g.ebullets[0].y, y0, '敵彈唔應該再郁');
});

test('未揀就確認唔到', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.openPicker();
  assert.equal(g.confirmPick(), false);
  assert.equal(g.game.state, 'picking', '仲留喺揀嘢畫面');
});

test('揀完確認:拎到能力、開下一波、返回遊戲', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.run('game.wave = 5;');
  g.openPicker();

  const id = g.pickOffers[0];
  g.choosePick(id);
  assert.equal(g.confirmPick(), true);

  assert.equal(g.player.abilities[id], 1, '應該拎到 Lv1');
  assert.equal(g.game.state, 'playing');
  assert.equal(g.game.wave, 6, '確認之後應該開下一波');
});

test('撳多次同一張可以取消', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.openPicker();
  const id = g.pickOffers[0];
  g.choosePick(id);
  g.choosePick(id);
  assert.equal(g.confirmPick(), false, '取消咗就唔應該確認到');
});

test('重抽:扣錢、換張新卡、唔夠錢唔換', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.openPicker();

  g.game.crystals = 0;
  const before = g.pickOffers.slice();
  assert.equal(g.rerollAt(0), false, '冇錢唔應該換到');
  assert.deepEqual(g.pickOffers.slice(), before);

  g.game.crystals = 10000;
  const cost = g.rerollCost();
  assert.equal(g.rerollAt(0), true);
  assert.equal(g.game.crystals, 10000 - cost, '應該扣咗錢');
  assert.notEqual(g.pickOffers[0], before[0], '張卡應該換咗');
  assert.equal(new Set(g.pickOffers).size, g.pickOffers.length, '換完唔可以同其他卡重複');
});

test('重抽咗自己揀緊嗰張,會自動取消選擇', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.openPicker();
  g.game.crystals = 10000;
  g.choosePick(g.pickOffers[0]);
  g.rerollAt(0);
  assert.equal(g.confirmPick(), false, '揀咗嗰張已經冇咗,唔應該仲確認到');
});
