const cv = document.getElementById('game'); // get element game(html canvas)
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;

const rand = (a, b) => a + Math.random() * (b - a); // generate a random number from [a, b)
const clamp = (v, a, b) => v < a ? a : v > b ? b : v; // ensure the v are only in [a to b]
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

const PU = {  // power up
  power: { c: '#ffd35c', t: 'P' },
  shield: { c: '#6cc8ff', t: 'S' },
  life: { c: '#ff7ba8', t: '♥' }
};

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },  // get localstorage value value k
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }  // set a localstorage value k
};

let player, bullets, ebullets, enemies, powerups, particles, fx, game;   // fx = 一次性特效(擦彈火花、彗星火球)
let highScore = +(store.get('stardrift_high') || 0);

// 而家用緊邊種輸入:'key' 鍵盤 / 'touch' 手指 / 'pad' 手掣。
// 標題畫面嘅操作說明同「按空白鍵開始」之類嘅提示要跟實際用嘅嘢 —— 手機冇空白鍵。
// 擺喺 core.js(而唔係 input.js)係因為 i18n.js 要用佢揀字串,而 i18n.js 載入早過 input.js。
// 一開始靠 pointer: coarse 猜(手機多數係 coarse),之後 input.js 跟最後用過嘅嘢更新。
let inputMode = (() => {
  try { return matchMedia('(pointer: coarse)').matches ? 'touch' : 'key'; } catch { return 'key'; }
})();

// 測試用:想一開波就去第幾波,改呢個數就得,例如 20(5 嘅倍數係 BOSS 波)。
// 正常玩要係 1,試完記得改返先好 commit —— npm test 會提你。
const START_WAVE = 1;

// 連擊:連續打死敵機而冇中彈就累積,倍數直接乘晶體收入。
// COMBO_WINDOW 秒內冇再殺嘢就斷;中彈即刻清零。
const PICK_EVERY = 3;        // 每幾波揀一次能力。同 WAVE.bossEvery(BOSS 幾多波一隻)無關
const COMBO_WINDOW = 3;      // 幾耐冇擊殺就斷(秒)
const COMBO_STEP = .02;      // 每一個連擊加幾多倍
const COMBO_MAX = 50;        // 連擊數上限,即最高 1 + 50 × .02 = 2 倍

// 血量:取代以前嘅「幾條命」。中彈扣血 + 一段無敵時間,
// 但唔會跌火力、唔會清擦彈、架機唔會飛返去起點。數值點調見 TUNING.md 第 1 節。
const HP = {
  max: 100,          // 開局血量(亦係上限,「強化機體」能力會加)
  bullet: 20,        // 中一粒敵彈扣幾多
  touch: 30,         // 撞到敵機 / BOSS 扣幾多
  inv: 2.4,          // 中彈之後無敵幾耐(秒)—— 同以前死咗復活一樣
  heal: 30,          // 執到 ♥ 補幾多
  low: .3,           // 血少過幾多(比例)血條轉紅閃
};

function newGame() {  // set up a new game or restart
  player = { x: W / 2, y: H - 110, r: 13, speed: 440, cool: 0, level: 1, shield: 0, inv: 2,
             hp: HP.max, maxHp: HP.max,
             hpShown: HP.max,    // 血條上面「啱啱扣咗」嗰截白色,慢慢追落去 hp
             abilities: {},      // { 能力 id: 等級 },每局清零
             fireRateMult: 1,    // 能力改射速用,1 = 原速
             magnet: 0,          // 能力改執道具範圍用,0 = 原本
             graze: 0,           // 擦彈儲咗幾多(到 GRAZE.full 就滿)
             grazeFlash: 0,      // 啱啱擦到:儲氣圈閃一閃
             fireHeld: false,    // 上一幀係咪開緊火 —— 由開火變停火嗰下先放
             fullT: 9,           // 儲滿咗幾耐(秒)—— 白熱「爆」一下嗰陣用
             dash: null };       // 彗星爆衝緊:{ t, x0, y0, dist, hit: [] },冇就 null
  bullets = []; ebullets = []; enemies = []; powerups = []; particles = []; fx = [];
  game = { state: 'title', paused: false, crystals: 0, combo: 0, comboT: 0,
           wave: 0, queue: [], waveTime: 0, gap: 0,
           bannerBoss: false, bannerT: 0, shake: 0, clearShots: false, rerolls: 0,
           bombT: 9, bombX: 0, bombY: 0 };   // 炸彈衝擊波(bombT 由放嗰刻計起)
}
newGame();

const stars = [];
for (let i = 0; i < 100; i++) { // background star
  const layer = i % 3;
  stars.push({ x: rand(0, W), y: rand(0, H), z: layer, v: 100 + layer * 45, s: .6 + layer * .7 });
}

function explode(x, y, color, n, spread = 260) {  // explosion in (x, y)
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = 400;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                     life: rand(.25, .5), max: .8, size: rand(.6, 10), color });
  }
}

const shake = n => game.shake = Math.max(game.shake, n);

// 連擊倍數。1 倍起,連擊越多越高,到 COMBO_MAX 封頂
const comboMult = () => 1 + Math.min(game.combo, COMBO_MAX) * COMBO_STEP;

// 而家呢一波打完使唔使揀能力。同「幾多波一隻 BOSS」(WAVE.bossEvery)係兩件事,
// 兩個數唔同都行得通:BOSS 照演過場,只係之後唔一定有卡揀。
const pickDue = () => game.wave % PICK_EVERY === 0;
