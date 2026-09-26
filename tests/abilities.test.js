// 能力系統:能力表、出現規則、重抽經濟。
// 全部邏輯喺 js/abilities.js,唔碰 DOM,所以喺 Node 度測得晒。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

test('每個能力都有齊三種語言嘅名同描述', () => {
  const { g } = loadGame();
  for (const a of g.ABILITIES) {
    for (const code of g.LANGS.map(l => l.code)) {
      assert.ok(a.name[code], `${a.id} 缺 ${code} 名`);
      assert.ok(a.desc[code], `${a.id} 缺 ${code} 描述`);
    }
    assert.ok(g.RARITY_COLOR[a.rarity], `${a.id} 稀有度 ${a.rarity} 冇顏色`);
    assert.ok(a.max >= 1, `${a.id} max 要 >= 1`);
  }
});

test('每個能力 apply 之後真係改到對應數值', () => {
  const checks = {
    spread: g => g.player.level,
    rapid: g => g.player.fireRateMult,
    thrust: g => g.player.speed,
    shield: g => g.player.shield,
    magnet: g => g.player.magnet,
    life: g => g.player.lives,
  };
  for (const a of loadGame().g.ABILITIES) {
    assert.ok(checks[a.id], `${a.id} 未有對應檢查,新加能力記得喺呢度加一行`);
    const game = loadGame();
    game.startClean();
    const before = checks[a.id](game.g);
    assert.equal(game.g.takeAbility(a.id), true);
    assert.notEqual(checks[a.id](game.g), before, `${a.id} 拎咗但乜都冇變`);
  }
});

test('等級唔會超過 max,滿咗就拎唔到', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  const a = g.ABILITIES.find(x => x.max > 1);
  for (let i = 0; i < a.max; i++) assert.equal(g.takeAbility(a.id), true, `第 ${i + 1} 級`);
  assert.equal(g.takeAbility(a.id), false, '超出 max 應該拎唔到');
  assert.equal(g.player.abilities[a.id], a.max);
});

test('出 3 張卡,唔會重複', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  for (let i = 0; i < 40; i++) {
    const offers = g.offerAbilities();
    assert.equal(offers.length, 3);
    assert.equal(new Set(offers).size, 3, '出咗重複嘅卡: ' + offers);
  }
});

test('已滿級嘅能力唔會再出', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.takeAbility('life');                       // life 嘅 max 係 1
  assert.equal(g.abilityMaxed(g.abilityById('life')), true);
  for (let i = 0; i < 60; i++) {
    assert.ok(!g.offerAbilities().includes('life'), '滿級咗仲出');
  }
});

test('能力少過 3 個可揀時,唔會硬塞夠三張', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  // 將所有能力食到滿,淨低一個
  for (const a of g.ABILITIES.slice(1)) {
    for (let i = 0; i < a.max; i++) g.takeAbility(a.id);
  }
  const offers = g.offerAbilities();
  assert.equal(offers.length, 1);
  assert.equal(offers[0], g.ABILITIES[0].id);
});

test('重抽唔會抽到場上已有嘅卡', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  const offers = g.offerAbilities();
  for (let i = 0; i < 40; i++) {
    const replacement = g.rerollOne(offers, 0);
    assert.ok(!offers.includes(replacement) || offers.length >= g.ABILITIES.length,
      '抽到重複: ' + replacement);
  }
});

test('重抽要俾錢,唔夠錢重抽唔到', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();

  g.game.crystals = g.rerollCost() - 1;
  assert.equal(g.canAffordReroll(), false);
  assert.equal(g.payReroll(), false);
  assert.equal(g.game.crystals, g.rerollCost() - 1, '失敗唔應該扣錢');

  g.game.crystals = g.rerollCost() + 500;
  const before = g.game.crystals, cost = g.rerollCost();
  assert.equal(g.payReroll(), true);
  assert.equal(g.game.crystals, before - cost);
});

test('重新開局會清走所有能力', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  g.takeAbility('shield');
  g.takeAbility('thrust');
  game.run('newGame()');
  assert.equal(Object.keys(g.player.abilities).length, 0);   // 跨 vm realm,唔可以同 {} 直接比
  assert.equal(g.player.fireRateMult, 1);
  assert.equal(g.player.magnet, 0);
});
