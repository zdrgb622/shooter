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


// ---------- B2:操作說明要跟實際用嘅輸入 ----------
// 手機冇鍵盤,但標題畫面一直寫住「方向鍵 / WASD」、「按空白鍵開始」,
// 所以手機玩家永遠唔會知拖住畫面就得。

const MODES = ['key', 'touch', 'pad'];

test('跟輸入方式變嘅字串,三種語言 × 三種輸入都齊', () => {
  const { g } = loadGame();
  for (const { code } of g.LANGS) {
    for (const [name, v] of Object.entries(g.STRINGS[code])) {
      if (typeof v === 'string') continue;
      assert.deepEqual(Object.keys(v).sort(), MODES.slice().sort(), `${code}.${name} 唔齊`);
    }
  }
});

test('手機版唔會提鍵盤,手掣版會講手掣', () => {
  const game = loadGame();
  const { g } = game;
  const lines = () =>
    ['ctlMove', 'ctlShoot', 'ctlPause', 'start', 'restart', 'resume', 'langLabel'].map(k => g.t(k));

  game.run("inputMode = 'touch'");
  const touch = lines().join(' | ');
  for (const word of ['方向鍵', 'WASD', '空白鍵', '按 R', '按 P']) {
    assert.ok(!touch.includes(word), `手機版唔應該提「${word}」:${touch}`);
  }
  assert.ok(touch.includes('撳'), '手機版要講撳 / 拖');

  game.run("inputMode = 'pad'");
  const padText = lines().join(' | ');
  assert.ok(padText.includes('搖桿') && padText.includes('Start'), `手掣版要講手掣:${padText}`);

  game.run("inputMode = 'key'");
  assert.ok(lines().join(' | ').includes('空白鍵'), '鍵盤版照舊');
});

test('冇 coarse pointer 就當係鍵盤', () => {
  const { g } = loadGame();      // harness 嘅 matchMedia 永遠 false
  assert.equal(g.inputMode, 'key');
});

test('撳過乜就跟乜:鍵盤 / 手指 / 手掣', () => {
  const game = loadGame();
  const { g } = game;

  game.pointerDown(100, 100);                  // 預設係手指
  assert.equal(g.inputMode, 'touch');

  game.key('KeyL');
  assert.equal(g.inputMode, 'key', '撳過鍵盤就當佢有鍵盤');

  const pad = game.plugGamepad();
  pad.axes[0] = 1;
  g.pollGamepad();
  assert.equal(g.inputMode, 'pad');
});

test('滑鼠唔算手指', () => {
  const game = loadGame();
  const { g } = game;
  game.pointerDown(100, 100, 'mouse');
  assert.equal(g.inputMode, 'key', '用滑鼠嘅人有鍵盤,照講鍵盤嘅操作');
});

test('插住手掣但用手指,提示跟最後用過嗰樣', () => {
  const game = loadGame();
  const { g } = game;
  const pad = game.plugGamepad();
  pad.press(0);
  g.pollGamepad();
  assert.equal(g.inputMode, 'pad');

  game.pointerDown(100, 100);
  assert.equal(g.inputMode, 'touch', '手掣擺喺一邊唔用,就唔應該再講手掣');
});
