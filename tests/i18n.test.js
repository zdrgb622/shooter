// 三種語言嘅字串要齊,中途切語言唔可以爆。

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

test('三種語言嘅 key 完全一樣', () => {
  const { g } = loadGame();
  const [first, ...rest] = g.LANGS.map(l => l.code);
  const base = Object.keys(g.STRINGS[first]).sort();
  for (const code of rest) {
    assert.deepEqual(Object.keys(g.STRINGS[code]).sort(), base, `${code} 同 ${first} 唔一致`);
  }
});

test('預設係繁體', () => {
  const { g } = loadGame();
  assert.equal(g.lang, 'zh-Hant');
});

test('{n} 會被換成數字', () => {
  const { g } = loadGame();
  assert.equal(g.t('reached', 7), '打到第 7 波');
});

test('語言選擇會記低', () => {
  const game = loadGame();
  game.g.setLang('en');
  assert.equal(game.storage.stardrift_lang, 'en');
});

test('打緊 BOSS 中途切晒三種語言都唔會爆', () => {
  const game = loadGame();
  const { g } = game;
  game.startClean();
  game.run('game.wave = 4; startWave();');
  for (const { code } of g.LANGS) {
    g.setLang(code);
    assert.doesNotThrow(() => game.step(30));
  }
});
