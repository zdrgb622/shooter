// 喺 Node 入面載入成個遊戲,唔使開瀏覽器。
//
// 遊戲本身係普通 <script>,靠 global 變數溝通,所以做法係:
// 整一個假嘅 browser global(canvas、localStorage、手掣、事件),
// 然後用 node:vm 按 index.html 嘅次序逐個檔案喺入面行。
// requestAnimationFrame 係空嘅,所以主迴圈唔會自己跑 —— 測試自己叫 update() 一幀一幀推。

const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SCRIPTS = ['core', 'i18n', 'abilities', 'sprites', 'input', 'entities', 'bosses', 'render', 'ui', 'tune', 'main'];

const noop = () => {};

// 2D context:任何 method 都當冇嘢發生,任何屬性都照收
function fakeContext2d() {
  return new Proxy({}, {
    get: (_, key) => {
      if (key === 'measureText') return () => ({ width: 0 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop: noop });
      return noop;
    },
    set: () => true,
  });
}

function makeListeners() {
  const map = {};
  return {
    add: (type, fn) => { (map[type] ||= []).push(fn); },
    fire: (type, evt) => { for (const fn of map[type] || []) fn(evt); },
  };
}

function loadGame() {
  const win = makeListeners();
  const cvs = makeListeners();
  const storage = {};
  const gamepads = [];

  const canvas = {
    width: 480,
    height: 720,
    getContext: fakeContext2d,
    addEventListener: cvs.add,
    setPointerCapture: noop,
    // 1:1 對應 canvas 座標,等 clientX / clientY 可以直接當遊戲座標用
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 720 }),
  };
  const elements = { game: canvas, hint: { textContent: '' } };

  const sandbox = {
    console,
    performance,
    document: {
      getElementById: id => elements[id],
      documentElement: {},
      title: '',
    },
    localStorage: {
      getItem: k => (k in storage ? storage[k] : null),
      setItem: (k, v) => { storage[k] = String(v); },
    },
    navigator: { getGamepads: () => gamepads },
    addEventListener: win.add,
    requestAnimationFrame: noop,
    matchMedia: () => ({ matches: false }),
  };
  vm.createContext(sandbox);

  for (const name of SCRIPTS) {
    const file = path.join(ROOT, 'js', name + '.js');
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  }

  // 頂層 const / let 唔會變成 sandbox 嘅屬性,所以要喺 context 入面 eval 先攞得到
  const run = code => vm.runInContext(code, sandbox);
  const g = new Proxy({}, { get: (_, name) => run(name) });

  return {
    g,
    run,
    sandbox,
    storage,

    // 每幀 = 讀手掣 + update + draw,同 main.js 一樣次序
    step(frames = 1, dt = 1 / 60) {
      for (let i = 0; i < frames; i++) {
        g.pollGamepad();
        g.update(dt);
        g.draw();
      }
    },

    key(code, down = true) {
      win.fire(down ? 'keydown' : 'keyup', { code, preventDefault: noop });
    },

    // pointerType 預設 'touch'(手機);想當滑鼠就傳 'mouse',因為兩者影響 inputMode
    pointerDown(x, y, pointerType = 'touch') {
      cvs.fire('pointerdown', { clientX: x, clientY: y, pointerId: 1, pointerType });
    },
    pointerMove(x, y) { cvs.fire('pointermove', { clientX: x, clientY: y, pointerId: 1 }); },
    pointerUp() { cvs.fire('pointerup', { pointerId: 1 }); },

    // 標準 mapping 嘅假手掣;回傳嘅物件可以直接改 axes / 撳掣
    plugGamepad() {
      const pad = {
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
        press(i, down = true) { this.buttons[i].pressed = down; this.buttons[i].value = down ? 1 : 0; },
      };
      gamepads.length = 0;
      gamepads.push(pad);
      return pad;
    },
    unplugGamepad() { gamepads.length = 0; },

    // 搵一個合用嘅波數。千祈唔好喺測試度寫死「第 5 波」——
    // WAVE.bossEvery 同 PICK_EVERY 都係俾人試玩時調嘅,寫死就會無端端紅一堆。
    //   boss: true = 要 BOSS 波 / false = 要普通波
    //   pick: true = 打完要揀能力 / false = 唔使揀 / null = 唔理
    // 搵唔到就回傳 null(例如 PICK_EVERY 係 1,就冇「唔使揀」嘅波)。
    findWave({ boss = true, pick = null } = {}) {
      const every = run('WAVE.bossEvery'), p = run('PICK_EVERY');
      for (let w = 1; w <= 200; w++) {
        if ((w % every === 0) !== boss) continue;
        if (pick !== null && (w % p === 0) !== pick) continue;
        return w;
      }
      return null;
    },

    // 開一局,清走所有敵人同子彈,戰機放喺已知狀態 —— 大部分測試嘅起點。
    // 命、護盾、火力都明確設定,唔靠遊戲嘅預設值:
    // 咁調數(例如試玩時將 shield 調高)就唔會令一堆測試無端端紅。
    startClean() {
      run(`
        startRun();
        enemies.length = 0; game.queue.length = 0;
        bullets.length = 0; ebullets.length = 0; powerups.length = 0;
        player.x = W / 2; player.y = H - 110;
        player.inv = 0; player.hp = player.maxHp = player.hpShown = HP.max; player.shield = 0; player.level = 1;
        player.abilities = {}; player.fireRateMult = 1; player.magnet = 0;
        player.speed = 440;
        game.crystals = 0; game.combo = 0; game.comboT = 0;
        game.wave = 1; game.gap = 0;   // 唔好靠 START_WAVE,佢試玩時會被改
      `);
    },
  };
}

module.exports = { loadGame };
