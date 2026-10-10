// 能力選擇嘅流程。UI 喺 js/ui.js,所有 DOM 操作都守住 pickEl,
// 所以喺冇真 DOM 嘅 Node 入面一樣測得到成個流程。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

test('夠波數就揀能力,唔夠就直接開下一波', () => {
  const game = loadGame();
  const { g } = game;
  const due = game.findWave({ boss: null, pick: true });

  game.startClean();
  game.run(`game.wave = ${due}; game.queue.length = 0; enemies.length = 0; game.gap = 0;`);
  game.step(90);                                  // 等過 1.2 秒嘅間場
  assert.equal(g.game.state, 'picking', '夠波數就應該揀能力');

  const notDue = game.findWave({ boss: null, pick: false });
  if (notDue === null) return;                    // PICK_EVERY = 1 就每波都揀

  const game2 = loadGame();
  game2.startClean();
  game2.run(`game.wave = ${notDue}; game.queue.length = 0; enemies.length = 0; game.gap = 0;`);
  game2.step(90);
  assert.equal(game2.g.game.state, 'playing');
  assert.equal(game2.g.game.wave, notDue + 1, '唔使揀就直接開下一波');
});

test('BOSS 一死即刻入過場,過場完先入能力畫面', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  const w = game.findWave({ boss: true, pick: true });
  game.run(`game.wave = ${w}; enemies.length = 0; spawnBoss("crystal");`);
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
  g.spawnEnemy('grunt');
  const e = g.enemies[0];
  const y0 = e.y;
  g.openPicker();
  game.step(60);
  assert.equal(e.y, y0, '敵機唔應該再郁');
});

test('開能力畫面會清走場上嘅敵彈', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.eshoot(240, 300, Math.PI / 2, 300);
  g.eshoot(200, 280, Math.PI / 2, 300);
  g.openPicker();

  game.step(2);
  assert.equal(g.ebullets.length, 0, '揀完返到遊戲唔應該即刻食彈');
});

test('揀能力同過場嗰陣,架機仲要喺畫面度', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  assert.equal(g.shipOnScreen(), true, '打緊梗係要有');

  g.openPicker();
  assert.equal(g.shipOnScreen(), true, '揀能力嗰陣唔可以唔見咗架機');

  game.run("game.state = 'finale';");
  assert.equal(g.shipOnScreen(), true, '過場都要留喺度');

  game.run("game.state = 'over';");
  assert.equal(g.shipOnScreen(), false, '死咗就唔使畫');
  game.run("game.state = 'title';");
  assert.equal(g.shipOnScreen(), false, '未開局都唔使畫');
});

test('撳一下就即裝,唔使再撳確認', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.run('game.wave = 5;');
  g.openPicker();

  const id = g.pickOffers[0];
  assert.equal(g.choosePick(id), true);

  assert.equal(g.player.abilities[id], 1, '應該即刻拎到 Lv1');
  assert.equal(g.game.state, 'playing', '唔使再確認,即刻返遊戲');
  assert.equal(g.game.wave, 6, '順便開下一波');
  assert.equal(g.pickOffers.length, 0, '啲卡要收返');
});

test('撳唔喺場嘅卡唔會中招', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.openPicker();
  const gone = g.ABILITIES.map(a => a.id).find(id => !g.pickOffers.includes(id));
  assert.equal(g.choosePick(gone), false, '只有而家出緊嗰三張先裝得到');
  assert.equal(g.game.state, 'picking');
});

test('已滿級嘅能力唔會再出', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.run("player.abilities = { life: 1 };");   // life 嘅 max 係 1
  g.openPicker();
  assert.ok(!g.pickOffers.includes('life'), '滿咗就唔應該再出');
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

test('重抽唔會順手裝咗嘢', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.openPicker();
  g.game.crystals = 10000;
  g.rerollAt(0);
  assert.equal(g.game.state, 'picking', '重抽之後仲要留喺揀嘢畫面');
  assert.equal(Object.keys(g.player.abilities).length, 0, '唔應該裝到任何嘢');
});
