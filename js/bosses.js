// BOSS 表(Plan B):一隻 BOSS = BOSSES 入面一個 object,齊晒佢嘅樣、血、點郁、每個階段用咩招。
// 加新 BOSS = 加一個 entry,唔使改 updateBoss / updateBullets / drawEnemy。結構詳解見 ENEMIES.md。
//
// ── 招式(move)──
// 一個階段有一串招,打完一招先揀下一招(輪住嚟)。**轉階段只會喺兩招之間發生**,
// 所以出咗預警嘅攻擊一定會出完,唔會亮咗燈但冇射。
//   { dur: 秒, start(b) → 可以回傳實際秒數, update(b, dt) }
// 招入面用 b.cycle 做時鐘(每招由 0 開始),b.done 做 bitmask 記住「呢一下出咗未」。
// 招想自己話幾時完(例如要等成條蛇離開畫面),start 回傳 Infinity,完嗰陣設 b.moveEnd = true。
//
// ── 階段 ──
// { over: 血量比例, moves: [...], enter(b)?, draw?, edge?, core? }
// 血量比例大過 over 就係呢個階段,由上至下第一個符合嘅 —— 一下爆傷跨咗兩個門檻,會直接去最低嗰個。
// draw / edge / core 可以覆蓋 BOSS 預設嘅樣,即係「打到第二階段轉樣」。

function bossPhase(b) {
  const phases = BOSSES[b.kind].phases, ratio = b.hp / b.maxhp;
  for (let i = 0; i < phases.length; i++) if (ratio > phases[i].over) return i + 1;
  return phases.length;
}

// 第幾隻 BOSS 波出邊隻(WAVE.bosses 輪住嚟)
function bossForWave(w) {
  const list = WAVE.bosses;
  const k = Math.max(1, Math.round(w / WAVE.bossEvery));
  return list[(k - 1) % list.length];
}

function spawnBoss(kind) {
  const def = BOSSES[kind];
  const hp = Math.round(def.hp(game.wave));
  const b = { type: 'boss', kind, x: W / 2, bx: W / 2, y: -100, r: def.r, hp, maxhp: hp,
              t: 0, flash: 0, score: def.score, color: def.color,
              edge: def.edge, core: def.core,
              phase: 0, cycle: 0, done: 0, move: null, moveDur: 0, moveIdx: -1, moveEnd: false,
              mode: 0, fireT: 0, hitX: W / 2, hitY: H / 2, hitK: -1, pflash: 0 };
  if (def.init) def.init(b);
  enemies.push(b);
  nextMove(b);          // 第一招即刻揀好,亦即係入第一階段
  return b;
}

// 由而家嘅血量決定階段,要轉就轉
function enterPhase(b, p) {
  const def = BOSSES[b.kind], ph = def.phases[p - 1];
  const first = b.phase === 0;
  b.phase = p;
  b.moveIdx = -1;
  b.edge = ph.edge || def.edge;
  b.core = ph.core || def.core;
  if (ph.enter) ph.enter(b);
  if (first) return;
  // 轉階段嗰一下要有個「爆」,否則個樣突然變咗會似 bug 多過似演出
  shake(16);
  explode(bossFocusX(b), bossFocusY(b), b.edge || b.color, 40, 300);
  b.pflash = 1;
}

function nextMove(b) {
  const def = BOSSES[b.kind];
  const p = bossPhase(b);
  if (p !== b.phase) enterPhase(b, p);
  const moves = def.phases[p - 1].moves;
  b.moveIdx = (b.moveIdx + 1) % moves.length;
  b.move = moves[b.moveIdx];
  b.cycle = 0; b.done = 0; b.moveEnd = false;
  b.grazed = 0;         // 擦彈:每招重新計(星蛇每節每招只畀擦一次)
  const d = b.move.start ? b.move.start(b) : undefined;
  b.moveDur = d === undefined ? b.move.dur : d;
}

function updateBoss(b, dt) {
  const def = BOSSES[b.kind];
  b.pflash = Math.max(0, b.pflash - dt * 2);
  if (def.enter && def.enter(b, dt)) return;      // 仲入緊場:唔出招
  if (def.cruise) def.cruise(b, dt);
  b.cycle += dt;
  b.move.update(b, dt);
  if (b.moveEnd || b.cycle >= b.moveDur) nextMove(b);   // 打完一套先揀下一招(連 check 階段)
}

// 某個時刻到咗、而且今招未出過 → 出手一次
function bossDue(b, at, bit) {
  if (b.cycle < at || (b.done & bit)) return false;
  b.done |= bit;
  return true;
}

// 爆炸、轉階段、過場用嘅「焦點」:BOSS 喺畫面入面就用佢個位,唔係就用最後中彈嗰點
// (星蛇個頭可能已經衝咗出畫面,但條尾仲喺度俾人打)
const bossOnScreenAt = b => b.x > 0 && b.x < W && b.y > 0 && b.y < H;
const bossFocusX = b => clamp(bossOnScreenAt(b) ? b.x : b.hitX, 40, W - 40);
const bossFocusY = b => clamp(bossOnScreenAt(b) ? b.y : b.hitY, 80, H - 80);


// =====================================================================
// 水晶核
// =====================================================================

// 第一階段招式循環(秒)。每一下都有預警:尖端先着燈 / 碎片先彈警示圈,
// 玩家睇得出下一步,先可以走位 —— 舊嗰三招係冇預警嘅。
const BOSS_CYCLE = 6;
const BOSS_VOLLEY_AT = .45;    // 第一個尖端幾時開火
const BOSS_TIP_GAP = .25;      // 尖端之間差幾耐
const BOSS_TIP_GLOW = .65;     // 着燈維持幾耐
const BOSS_FLING_WARN = 2.6;   // 碎片警示圈幾時出
const BOSS_FLING_AT = 2.9;     // 碎片幾時掟出嚟
const BOSS_FLING_ANGLES = [150, 90, 30];

// 尖端着燈嘅光度(0 = 冇);render 同 update 共用同一條時序,唔會各計各
function bossTipGlow(b, i) {
  const u = b.cycle - i * BOSS_TIP_GAP;
  if (u < 0 || u > BOSS_TIP_GLOW) return 0;
  return 1 - u / BOSS_TIP_GLOW;
}

const bossFlingWarn = b =>
  b.cycle >= BOSS_FLING_WARN && b.cycle < BOSS_FLING_AT
    ? (b.cycle - BOSS_FLING_WARN) / (BOSS_FLING_AT - BOSS_FLING_WARN) : 0;

// 由本地座標(BOSS 圖係 300×180)換做畫面座標
const bossLocalToWorld = (b, lx, ly) => {
  const s = b.r * 2 / 190;
  return [b.x + (lx - 150) * s, b.y + (ly - BOSS_CORE_Y) * s];
};

function volleyFromTip(b, i) {
  const tips = BOSS_ART.tips;
  const [x, y] = bossLocalToWorld(b, tips[i][0], tips[i][1]);
  const spread = -30 + i * (tips.length > 1 ? 60 / (tips.length - 1) : 0);
  for (const d of [-10, 0, 10]) {
    eshoot(x, y, Math.PI / 2 - (spread + d) * Math.PI / 180, 320, '#4FD1C5');
  }
}

// 碎片掟向玩家:沿一條弧線飛過去,唔係直線,所以要記住成條路徑
function flingShards(b) {
  for (const deg of BOSS_FLING_ANGLES) {
    const a = deg * Math.PI / 180 + b.t * SHARD_SPIN;
    const [x, y] = bossLocalToWorld(b, 150 + Math.cos(a) * 138, BOSS_CORE_Y + Math.sin(a) * 46);
    ebullets.push({
      x, y, vx: 0, vy: 0, r: 8, color: '#4FD1C5',
      path: { x0: x, y0: y, cx: (x + player.x) / 2, cy: y + 140,
              x1: player.x, y1: player.y, t: 0, dur: 1.2 },
    });
  }
}

// 第一階段:一招 = 一個 5 秒循環(尖端逐個齊射 → 掟碎片)
const CRYSTAL_CYCLE = {
  dur: BOSS_CYCLE,
  update(b) {
    b.mode = b.cycle < BOSS_FLING_WARN ? 0 : 1;      // 核心顏色跟招式轉
    for (let i = 0; i < BOSS_ART.tips.length; i++) {
      if (bossDue(b, BOSS_VOLLEY_AT + i * BOSS_TIP_GAP, 1 << i)) volleyFromTip(b, i);
    }
    if (bossDue(b, BOSS_FLING_AT, 1 << 30)) flingShards(b);
  },
};

// 第二階段:舊嗰三招,每招 4.5 秒輪住嚟。冇預警、越傷越密。
function crystalBarrage(mode) {
  return {
    dur: 4.5,
    start(b) { b.mode = mode; b.fireT = .4; },
    update(b, dt) {
      b.fireT -= dt;
      if (b.fireT > 0) return;
      const hurt = 1 - b.hp / b.maxhp;
      if (mode === 0) {
        b.fireT = .85 - hurt * .3;
        const a = aimAt(b.x, b.y + 40);
        for (const off of [-.22, 0, .22]) eshoot(b.x, b.y + 40, a + off, 250);
      } else if (mode === 1) {
        b.fireT = 1.5 - hurt * .5;
        const n = 14 + Math.floor(hurt * 10);
        for (let i = 0; i < n; i++) eshoot(b.x, b.y + 20, (i / n) * Math.PI * 2 + b.t, 175, '#ffb35c');
      } else {
        b.fireT = .16;
        eshoot(b.x + Math.sin(b.t * 7) * 42, b.y + 34, Math.PI / 2 + Math.sin(b.t * 3) * .5, 300, '#9b8bff');
      }
    },
  };
}


// =====================================================================
// 虛空星蛇
// =====================================================================
// 一條 24 節嘅身(頭 + 23 節)。成條身行喺同一條「路」上面:個頭喺 b.s(行咗幾遠),
// 每一節喺 b.s 減一段固定距離 —— 即係「跟住個頭行過嘅位」,轉彎會自然跟住彎。
// 招式只需要決定條路點畫、個頭幾時行到邊;身體自己會跟。
//
// 每一招都由畫面外開始、喺畫面外結束,所以兩招之間可以靜雞雞換一條路,玩家睇唔到佢瞬移。

const SERPENT = {
  nodes: 24,          // 頭 + 23 節(設計:節數 24)
  headGap: 34,        // 頭中心到第一節
  gap: 39,            // 節與節
  thick: .8,          // 粗幼(設計:0.8)
  hitR: 19,           // 一節俾子彈打中嘅半徑(尾四節會跟住縮細)
  touchR: 15,         // 一節撞到戰機嘅半徑 —— 細過畫出嚟,對玩家寬鬆啲
  grazeR: 28,         // 擦彈由呢個半徑再加 GRAZE.ring 計 —— 跟畫出嚟嘅身(連腳約 31),唔跟 touchR。
                      // 用 touchR 嘅話擦彈範圍會縮入畫出嚟嘅身入面,玩家睇住唔撞到就已經擦唔到
  headHitR: 24, headTouchR: 19, headFront: 10,   // 個頭個圓心喺頭中心前面少少
};

// 每一節離個頭幾遠,同埋大細(尾四節逐節細,照設計)
const SERPENT_OFF = [], SERPENT_SCALE = [];
for (let k = 0; k < SERPENT.nodes; k++) {
  SERPENT_OFF.push(k === 0 ? 0 : SERPENT.headGap + SERPENT.gap * (k - 1));
  const fromTail = SERPENT.nodes - 1 - k;
  SERPENT_SCALE.push(k > 0 && fromTail < 4 ? .72 + .07 * fromTail : 1);
}
const SERPENT_LEN = SERPENT_OFF[SERPENT.nodes - 1];

// 潛伏・頭槌嘅時間(秒)。照設計嘅 9 秒動畫拆出嚟。
const SERPENT_LURK = {
  swimIn: 1.6,        // 由畫面外游入嚟
  watch: 2.0,         // 個頭跟住玩家轉
  lock: .18,          // 鎖定:眼轉紅、準星彈出
  pull: .99,          // 縮頸蓄力
  pullBack: 70,       // 縮幾多
  hold: .27,
  lunge: .315,        // 撞落去
  stuck: .855,        // 撞完卡住 = 破綻,打頭雙倍
  back: 1.17,         // 縮返
  rest: .5,
  swimOut: 1.4,       // 游返出畫面
  restUp: 100,        // 成條潛伏路線向上搬幾多 px:越大企得越後(0 = 設計圖個位,個頭停喺 (330, 330))
  wallGap: 40,        // 頭槌撞到牆:個頭中心停喺離畫面邊幾遠(頭尖 44px,咁個嘴啱啱插入牆)
  minReach: 140,      // 頭槌最少撞幾遠(玩家貼住佢都唔會得個縮頸)
};
const LURK_HB = ['watch', 'lock', 'pull', 'hold', 'lunge', 'stuck', 'back', 'rest']
  .reduce((sum, k) => sum + SERPENT_LURK[k], 0);   // 一下頭槌由望到收要幾耐

// 設計圖嘅路線(畫面座標,同遊戲一樣 480×720)。直接抄設計檔,方便對返。
const SERPENT_PATHS = {
  lurk: 'M 1700 110 L 520 110 C 410 110, 225 105, 215 195 C 205 275, 408.9 220.5, 353.4 297.5 L 330 330',
  C: 'M 110 -2090 L 110 -90 L 110 810 L 585 810 L 585 -90 L 370 -90 L 370 810 L -105 810 L -105 -90 L 240 -90 L 240 1892',
  // 包圍:圍住 (240, 430) 打圈,實際會搬去玩家附近
  D: 'M 65 -1090 L 65 -90 L 65 430 L 66.1 445.2 L 68.6 460.2 L 72.3 474.9 L 77.3 489.2 L 83.6 503 L 90.9 516.1 L 99.4 528.5 L 108.9 540 L 119.3 550.7 L 130.6 560.4 L 142.6 569.1 L 155.4 576.6 L 168.7 583 L 182.4 588.2 L 196.6 592.1 L 210.9 594.8 L 225.5 596.3 L 240 596.4 L 254.5 595.3 L 268.7 593 L 282.7 589.4 L 296.3 584.6 L 309.3 578.7 L 321.8 571.7 L 333.5 563.6 L 344.5 554.6 L 354.7 544.7 L 363.8 533.9 L 372 522.5 L 379.2 510.4 L 385.2 497.7 L 390.1 484.6 L 393.9 471.2 L 396.4 457.6 L 397.7 443.8 L 397.9 430 L 396.8 416.3 L 394.5 402.8 L 391.1 389.5 L 386.5 376.7 L 380.9 364.3 L 374.2 352.5 L 366.6 341.4 L 358 331 L 348.6 321.4 L 338.4 312.7 L 327.5 305 L 316.1 298.2 L 304.1 292.5 L 291.7 287.9 L 279 284.4 L 266.1 282 L 253.1 280.8 L 240 280.7 L 227 281.8 L 214.2 283.9 L 201.7 287.2 L 189.6 291.5 L 177.9 296.9 L 166.8 303.2 L 156.3 310.4 L 146.5 318.6 L 137.5 327.5 L 129.3 337.1 L 122 347.4 L 115.7 358.2 L 110.3 369.5 L 106 381.2 L 102.7 393.2 L 100.5 405.4 L 99.3 417.7 L 99.3 430 L 100.3 442.2 L 102.4 454.3 L 105.5 466 L 109.6 477.5 L 114.6 488.5 L 120.6 498.9 L 127.5 508.8 L 135.1 518 L 143.5 526.5 L 152.6 534.1 L 162.3 541 L 172.5 546.9 L 183.1 551.9 L 194.2 556 L 205.4 559 L 216.9 561.1 L 228.4 562.1 L 240 562.1 L 251.5 561.2 L 262.8 559.2 L 273.8 556.3 L 284.5 552.4 L 294.8 547.6 L 304.6 542 L 313.9 535.5 L 322.5 528.3 L 330.4 520.4 L 337.6 511.9 L 344 502.8 L 349.5 493.2 L 354.2 483.2 L 357.9 472.9 L 360.7 462.4 L 362.6 451.6 L 363.6 440.8 L 363.6 430 L 362.6 419.3 L 360.8 408.7 L 358 398.4 L 354.3 388.4 L 349.8 378.8 L 344.5 369.6 L 338.5 361 L 331.7 353 L 324.3 345.7 L 316.4 339 L 307.9 333.1 L 298.9 327.9 L 289.6 323.6 L 280 320.1 L 270.1 317.5 L 260.1 315.8 L 250.1 315 L 240 315 C 170 315, 150 175, 150 -90 L 150 -1172',
};

// 衝刺(C、D)嘅時間軸:[秒, 個頭行到條路邊度] 一對對,中間直線插值(照設計 keyframes)。
// warns:預警幾時出幾時收(秒),同埋畫邊種。
const SERPENT_DASH = {
  C: {   // 三連衝:唔兜圈,左、右、中連插三次
    keys: [0, 1000, 1.0, 2000, 1.90, 2900, 2.96, 4490, 3.86, 5390, 5.008, 7110, 6.99, 9092],
    warns: [{ kind: 'col', x: 110, t0: .05, t1: 1.30 },
            { kind: 'col', x: 370, t0: 1.90, t1: 3.26 },
            { kind: 'col', x: 240, t0: 3.86, t1: 5.31 }],
  },
  D: {   // 包圍:圍住玩家打圈,越收越細,中間留一個安全位
    keys: [0, 1000, 1.0, 1520, 4.07, 3115, 5.76, 4635.3],
    warns: [{ kind: 'ring', r: 183, t0: .05, t1: 1.30 },
            { kind: 'safe', r: 62, t0: 1.0, t1: 4.37 }],
    centre: [240, 430],
  },
};

// 'M x y L x y C x1 y1, x2 y2, x y' → [['M', x, y], ['L', x, y], ['C', x1, y1, x2, y2, x, y]]
// 載入時 parse 一次,之後每次出招重用。
function parsePath(str) {
  const tok = str.replace(/,/g, ' ').trim().split(/\s+/);
  const out = [];
  for (let i = 0; i < tok.length;) {
    const c = tok[i++];
    const n = c === 'C' ? 6 : 2;
    const cmd = [c];
    for (let j = 0; j < n; j++) cmd.push(+tok[i++]);
    out.push(cmd);
  }
  return out;
}
const SERPENT_CMDS = {};
for (const k in SERPENT_PATHS) SERPENT_CMDS[k] = parsePath(SERPENT_PATHS[k]);

// ---------- 條路 ----------
// 每隻星蛇自己有一條路:預先開好嘅陣列,出招時加點,每幀淨係讀 —— 唔會每幀 new 嘢(見 NOTES B6)。
const PATH_MAX = 1024;

function pathReset(b) { b.pn = 0; }

function pathPush(b, x, y) {
  const n = b.pn;
  if (n > 0 && Math.abs(x - b.px[n - 1]) < .01 && Math.abs(y - b.py[n - 1]) < .01) return;
  if (n >= PATH_MAX) { pathCompact(b); return pathPush(b, x, y); }
  b.px[n] = x; b.py[n] = y;
  b.pl[n] = n ? b.pl[n - 1] + Math.hypot(x - b.px[n - 1], y - b.py[n - 1]) : 0;
  b.pn = n + 1;
}

// 三次貝茲曲線拆做好多段直線,每段大約 6px
function pathCubic(b, x1, y1, x2, y2, x3, y3) {
  const x0 = b.px[b.pn - 1], y0 = b.py[b.pn - 1];
  const est = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
  const n = Math.max(8, Math.ceil(est / 6));
  for (let i = 1; i <= n; i++) {
    const u = i / n, v = 1 - u;
    pathPush(b, v * v * v * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3,
                v * v * v * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3);
  }
}

// 用設計圖嘅路線重新起一條路。dx / dy 平移,mirror 左右反轉。
function pathFrom(b, cmds, dx = 0, dy = 0, mirror = false) {
  pathReset(b);
  const X = x => (mirror ? W - x : x) + dx;
  for (const c of cmds) {
    if (c[0] === 'C') pathCubic(b, X(c[1]), c[2] + dy, X(c[3]), c[4] + dy, X(c[5]), c[6] + dy);
    else pathPush(b, X(c[1]), c[2] + dy);
  }
}

// 條路太長就剷走條尾都已經行過咗嘅舊點
function pathCompact(b) {
  const keepFrom = b.s - SERPENT_LEN - 200;
  let j = 0;
  while (j < b.pn - 2 && b.pl[j + 1] < keepFrom) j++;
  if (j === 0) { b.pn = PATH_MAX - 1; return; }   // 剷唔到(唔應該發生):寧願食咗最後一點都唔好爆
  b.px.copyWithin(0, j, b.pn); b.py.copyWithin(0, j, b.pn); b.pl.copyWithin(0, j, b.pn);
  b.pn -= j;
}

// 剷走個頭前面嘅路,喺 s 嗰點收尾 —— 之後就可以由個頭而家個位駁一條新路出去
function pathTruncate(b, s) {
  pathAt(b, s);
  const x = PAX, y = PAY;
  let i = b.pn - 1;
  while (i > 0 && b.pl[i] > s) i--;
  b.pn = i + 1;
  pathPush(b, x, y);
}

// 條路上面 s 嗰點嘅位置同方向。寫入 PAX / PAY / PAA,唔回傳新 object(唔想每幀 new)。
let PAX = 0, PAY = 0, PAA = 0;
function pathAt(b, s) {
  const n = b.pn, L = b.pl;
  let i;
  if (n < 2) { PAX = b.px[0]; PAY = b.py[0]; PAA = 0; return; }
  if (s <= L[0]) i = 0;
  else if (s >= L[n - 1]) i = n - 2;          // 超出條路:沿最後一段延長
  else {
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (L[mid] <= s) lo = mid; else hi = mid; }
    i = lo;
  }
  const len = L[i + 1] - L[i] || 1e-6;
  const u = (s - L[i]) / len;
  const x0 = b.px[i], y0 = b.py[i], x1 = b.px[i + 1], y1 = b.py[i + 1];
  PAX = x0 + (x1 - x0) * u;
  PAY = y0 + (y1 - y0) * u;
  PAA = Math.atan2(y1 - y0, x1 - x0);
}

// 按 b.s 擺好每一節,順便將個頭個位寫入 b.x / b.y(HUD、過場、瞄準都用佢)
function serpentPlace(b) {
  for (let k = 0; k < SERPENT.nodes; k++) {
    pathAt(b, b.s - SERPENT_OFF[k]);
    b.segX[k] = PAX; b.segY[k] = PAY; b.segA[k] = PAA;
  }
  b.x = b.segX[0]; b.y = b.segY[0]; b.angle = b.segA[0];
}

// 成條蛇有冇一粒喺畫面入面。margin 夠大,連個頭嘅牙都計埋。
function serpentHidden(b) {
  const m = 80;
  for (let k = 0; k < SERPENT.nodes; k++) {
    const x = b.segX[k], y = b.segY[k];
    if (x > -m && x < W + m && y > -m && y < H + m) return false;
  }
  return true;
}

// 時間軸插值:[t0, s0, t1, s1, ...],用頭 n 個數
function keyS(keys, n, t) {
  if (t <= keys[0]) return keys[1];
  for (let i = 2; i < n; i += 2) {
    if (t <= keys[i]) {
      const u = (t - keys[i - 2]) / (keys[i] - keys[i - 2]);
      return keys[i - 1] + (keys[i + 1] - keys[i - 1]) * u;
    }
  }
  return keys[n - 1];
}

const easeOut = u => 1 - (1 - u) * (1 - u);
const easeIn = u => u * u;
const easeInOut = u => (u < .5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));

function serpentInit(b) {
  b.px = new Float64Array(PATH_MAX); b.py = new Float64Array(PATH_MAX); b.pl = new Float64Array(PATH_MAX);
  b.pn = 0; b.s = 0;
  b.segX = new Float64Array(SERPENT.nodes); b.segY = new Float64Array(SERPENT.nodes);
  b.segA = new Float64Array(SERPENT.nodes);
  b.gzX = new Float64Array(SERPENT.nodes); b.gzY = new Float64Array(SERPENT.nodes);   // 擦彈:上一幀每節喺邊
  b.gzMove = null;        // 上一幀係邊一招 —— 換咗招(條路換咗)嗰幀唔當係掃過
  b.angle = 0;
  b.aim = 0;              // 個頭望住玩家轉咗幾多(純畫面)
  b.stage = '';           // 潛伏入面而家做緊邊一步,畫圖用
  b.stageT = 0;
  b.weak = false;         // 撞完卡住:打頭雙倍
  b.eyesRed = false;
  b.lockX = 0; b.lockY = 0; b.reach = 0; b.restS = 0;
  b.impactT = -9;
  b.warns = [0, 1, 2].map(() => ({ kind: '', x: 0, y: 0, a: 0, r: 0, t0: 0, t1: 0 }));
  b.nWarn = 0;
  b.keys = new Float64Array(16); b.nKeys = 0; b.keyEnd = 0;   // 今次衝刺嘅時間軸(可能延後咗)
}

function setWarn(b, i, kind, x, y, t0, t1, a = 0, r = 0) {
  const w = b.warns[i];
  w.kind = kind; w.x = x; w.y = y; w.t0 = t0; w.t1 = t1; w.a = a; w.r = r;
  b.nWarn = Math.max(b.nWarn, i + 1);
}

// ---------- 潛伏・頭槌 ----------
// 由右上(或者左上)游入嚟,淨係露出一截身同個頭。個頭跟住玩家轉;
// 一鎖定就縮頸、眼轉紅、拉出預警線,然後成個頭撞落鎖定位置,撞完卡住一陣 = 破綻。
function serpentLurk(times) {
  const T = SERPENT_LURK;
  return {
    start(b) {
      b.mirror = Math.random() < .5;
      pathFrom(b, SERPENT_CMDS.lurk, 0, -T.restUp, b.mirror);
      b.restS = b.pl[b.pn - 1];                 // 停喺條路嘅盡頭
      b.s = 1000;                               // 個頭喺畫面外
      b.nWarn = 0; b.weak = false; b.eyesRed = false;
      serpentPlace(b);
      return Infinity;                          // 自己話幾時完:游返出畫面先算
    },
    update(b, dt) {
      let t = b.cycle;
      const R = b.restS;
      b.weak = false; b.eyesRed = false;
      let aiming = false, aimTarget = 0;

      if (t < T.swimIn) {
        b.stage = 'swim'; b.stageT = t;
        b.s = 1000 + (R - 1000) * easeOut(t / T.swimIn);
      } else if ((t -= T.swimIn) < times * LURK_HB) {
        const n = Math.floor(t / LURK_HB);
        let u = t - n * LURK_HB;
        const bit = n * 4;
        if (u < T.watch) {
          b.stage = 'watch'; b.stageT = u;
          b.s = R - 7 + 7 * Math.cos(u / 1.08 * Math.PI);    // 慢慢游吓游吓
          aiming = true; aimTarget = Math.atan2(player.y - b.y, player.x - b.x);
        } else {
          u -= T.watch;
          const lockT0 = b.cycle - u;                        // 今下頭槌由幾時開始鎖定(招入面嘅時間)
          if (bossDue(b, lockT0, 1 << bit)) serpentLock(b, lockT0);
          const lungeAt = T.lock + T.pull + T.hold;
          const stuckAt = lungeAt + T.lunge, backAt = stuckAt + T.stuck, restAt = backAt + T.back;
          b.eyesRed = u < backAt;
          if (u < T.lock) {
            b.stage = 'lock'; b.stageT = u; b.s = R;
            aiming = true; aimTarget = Math.atan2(b.lockY - b.y, b.lockX - b.x);
          } else if (u < T.lock + T.pull) {
            b.stage = 'pull'; b.stageT = u - T.lock;
            b.s = R - T.pullBack * easeOut((u - T.lock) / T.pull);
            aiming = true; aimTarget = Math.atan2(b.lockY - b.y, b.lockX - b.x);
          } else if (u < lungeAt) {
            b.stage = 'hold'; b.stageT = u - T.lock - T.pull; b.s = R - T.pullBack;
            aiming = true; aimTarget = Math.atan2(b.lockY - b.y, b.lockX - b.x);
          } else if (u < stuckAt) {
            b.stage = 'lunge'; b.stageT = u - lungeAt;
            const k = (u - lungeAt) / T.lunge;
            b.s = R - T.pullBack + (T.pullBack + b.reach) * Math.pow(k, 2.2);   // 越撞越快
          } else if (u < backAt) {
            b.stage = 'stuck'; b.stageT = u - stuckAt; b.s = R + b.reach; b.weak = true;
            if (bossDue(b, 0, 1 << (bit + 1))) {      // 撞落去嗰一下
              b.impactT = b.cycle;
              shake(12);
              explode(b.x, b.y, b.edge, 16, 200);
              // 撞牆嗰點(個嘴前面)再爆一堆火花
              const wx = clamp(b.x + Math.cos(b.angle) * T.wallGap, 4, W - 4);
              const wy = clamp(b.y + Math.sin(b.angle) * T.wallGap, 4, H - 4);
              explode(wx, wy, '#fff', 12, 260);
            }
          } else if (u < restAt) {
            b.stage = 'back'; b.stageT = u - backAt;
            b.s = R + b.reach * (1 - easeInOut((u - backAt) / T.back));
          } else {
            b.stage = 'rest'; b.stageT = u - restAt; b.s = R;
          }
        }
      } else {
        t -= times * LURK_HB;
        b.stage = 'swim'; b.stageT = t;
        b.s = R + (1000 - R) * easeIn(Math.min(1, t / T.swimOut));
        if (t >= T.swimOut) {
          b.s -= (t - T.swimOut) * 500;             // 仲未走晒就繼續退
          serpentPlace(b);
          if (serpentHidden(b)) b.moveEnd = true;
          return;
        }
      }

      serpentPlace(b);
      // 個頭跟住目標轉,最多轉 1 rad,慢慢追,唔會一下扭過去
      const want = aiming ? clamp(angleDiff(aimTarget, b.angle), -1, 1) : 0;
      b.aim += (want - b.aim) * Math.min(1, dt * 6);
    },
  };
}

const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// 由 (x, y) 沿 (ux, uy) 行幾遠會撞到畫面邊
function wallDist(x, y, ux, uy) {
  let d = Infinity;
  if (ux > 1e-6) d = Math.min(d, (W - x) / ux);
  else if (ux < -1e-6) d = Math.min(d, -x / ux);
  if (uy > 1e-6) d = Math.min(d, (H - y) / uy);
  else if (uy < -1e-6) d = Math.min(d, -y / uy);
  return d;
}

// 鎖定:記低玩家而家個位,由停定嗰點向住佢駁一條直線,一直撞到畫面邊(撞牆)
function serpentLock(b, t0) {
  const T = SERPENT_LURK;
  b.lockX = player.x; b.lockY = player.y;
  pathTruncate(b, b.restS);
  pathAt(b, b.restS);
  const sx = PAX, sy = PAY;
  const d = Math.hypot(b.lockX - sx, b.lockY - sy) || 1;
  const ux = (b.lockX - sx) / d, uy = (b.lockY - sy) / d;
  b.reach = Math.max(T.minReach, wallDist(sx, sy, ux, uy) - T.wallGap);
  pathPush(b, sx + ux * (b.reach + 300), sy + uy * (b.reach + 300));
  const lungeEnd = t0 + T.lock + T.pull + T.hold + T.lunge;
  setWarn(b, 0, 'lunge', sx, sy, t0 + .1, lungeEnd - .12, Math.atan2(uy, ux), b.reach + 20);
  setWarn(b, 1, 'lock', b.lockX, b.lockY, t0, lungeEnd + .3);
}

// ---------- 盤旋衝刺(C、D) ----------
function serpentDash(variant) {
  const D = SERPENT_DASH[variant];
  return {
    start(b) {
      let dx = 0, dy = 0;
      if (D.centre) {          // 包圍:搬去玩家附近,但要成個圈擺得落畫面
        dx = clamp(player.x, 180, W - 180) - D.centre[0];
        dy = clamp(player.y, 250, 520) - D.centre[1];
      }
      pathFrom(b, SERPENT_CMDS[variant], dx, dy);

      // 起步位要喺畫面外。包圍會搬去玩家附近,搬完可能露咗出嚟 ——
      // 咁就沿入場嗰段路再退後啲,用同一個速度行多嗰段,成條時間軸(連預警)一齊延後。
      b.s = D.keys[1];
      serpentPlace(b);
      const v = (D.keys[3] - D.keys[1]) / (D.keys[2] - D.keys[0]);
      let pre = 0;
      while (!serpentHidden(b) && pre < 1500) { pre += 20; b.s = D.keys[1] - pre; serpentPlace(b); }
      const lag = pre / v;
      b.nKeys = D.keys.length;
      for (let i = 0; i < D.keys.length; i += 2) { b.keys[i] = D.keys[i] + lag; b.keys[i + 1] = D.keys[i + 1]; }
      b.keys[0] = 0; b.keys[1] = D.keys[1] - pre;
      b.keyEnd = b.keys[b.nKeys - 2];

      b.stage = 'dash'; b.weak = false; b.eyesRed = true; b.aim = 0;
      b.nWarn = 0;
      D.warns.forEach((w, i) => {
        const cx = D.centre ? D.centre[0] + dx : (w.x || 0);
        const cy = D.centre ? D.centre[1] + dy : 0;
        setWarn(b, i, w.kind, cx, cy, w.t0 + lag, w.t1 + lag, 0, w.r || 0);
      });
      return Infinity;
    },
    update(b, dt) {
      const end = b.keyEnd;
      b.s = b.cycle <= end ? keyS(b.keys, b.nKeys, b.cycle) : b.keys[b.nKeys - 1] + (b.cycle - end) * 900;
      serpentPlace(b);
      if (b.cycle >= end && serpentHidden(b)) b.moveEnd = true;
    },
  };
}

// ---------- 衝向玩家 ----------
// 喺畫面外(頂、左或者右)出現,預警帶瞄住玩家當刻個位,等 warn 秒之後成條直線衝過畫面。
const SERPENT_CHARGE = {
  warn: 1.1,          // 預警出咗幾耐先衝(秒)—— 玩家有幾多時間閃
  speed: 1000,        // 衝幾快(px/秒)
  margin: 120,        // 起步時個頭喺畫面外幾遠
};

function serpentCharge() {
  const C = SERPENT_CHARGE;
  return {
    start(b) {
      const side = Math.floor(Math.random() * 3);     // 0 頂、1 左、2 右
      const x0 = side === 0 ? rand(60, W - 60) : side === 1 ? -C.margin : W + C.margin;
      const y0 = side === 0 ? -C.margin : rand(60, H * .45);
      const d = Math.hypot(player.x - x0, player.y - y0) || 1;
      const ux = (player.x - x0) / d, uy = (player.y - y0) / d;
      const back = SERPENT_LEN + 200;                 // 條身喺個頭後面,一樣喺畫面外
      pathReset(b);
      pathPush(b, x0 - ux * back, y0 - uy * back);
      pathPush(b, x0 + ux * 4000, y0 + uy * 4000);
      b.s = back;
      serpentPlace(b);
      b.stage = 'dash'; b.weak = false; b.eyesRed = true; b.aim = 0;
      // 預警:斜帶 + 「!」擺喺條線入畫面嗰點再入 40px,而且唔好高過 y 126(唔好遮住 HUD 血條)
      let enter = 0;
      if (x0 < 0) enter = Math.max(enter, -x0 / ux);
      if (x0 > W) enter = Math.max(enter, (W - x0) / ux);
      if (y0 < 0) enter = Math.max(enter, -y0 / uy);
      enter += 40;
      if (uy > 0 && y0 + uy * enter < 126) enter = (126 - y0) / uy;
      const ex = x0 + ux * enter, ey = y0 + uy * enter;
      b.nWarn = 0;
      setWarn(b, 0, 'charge', ex, ey, 0, C.warn + .4, Math.atan2(uy, ux));
      return Infinity;
    },
    update(b) {
      const t = b.cycle - C.warn;
      // 衝過咗、上一幀已經成條出晒畫面 → 收招
      if (b.s > SERPENT_LEN + 200 + 600 && serpentHidden(b)) { b.moveEnd = true; return; }
      b.s = SERPENT_LEN + 200 + Math.max(0, t) * C.speed;
      serpentPlace(b);
    },
  };
}

// ---------- 撞擊判定 ----------
// 回傳傷害:0 = 冇中,1 = 打中身 / 頭,2 = 卡住嗰陣打中頭
function serpentHit(b, bullet) {
  const hx = b.x + Math.cos(b.angle) * SERPENT.headFront, hy = b.y + Math.sin(b.angle) * SERPENT.headFront;
  if ((bullet.x - hx) ** 2 + (bullet.y - hy) ** 2 < (SERPENT.headHitR + bullet.r) ** 2) {
    b.hitK = 0;
    return b.weak ? 2 : 1;
  }
  for (let k = 1; k < SERPENT.nodes; k++) {
    const r = SERPENT.hitR * SERPENT_SCALE[k] + bullet.r;
    const dx = bullet.x - b.segX[k], dy = bullet.y - b.segY[k];
    if (dx * dx + dy * dy < r * r) { b.hitK = k; return 1; }
  }
  return 0;
}

function serpentTouches(b, p) {
  const hx = b.x + Math.cos(b.angle) * SERPENT.headFront, hy = b.y + Math.sin(b.angle) * SERPENT.headFront;
  if ((p.x - hx) ** 2 + (p.y - hy) ** 2 < (SERPENT.headTouchR + p.r) ** 2) return true;
  for (let k = 1; k < SERPENT.nodes; k++) {
    const r = SERPENT.touchR * SERPENT_SCALE[k] + p.r;
    const dx = p.x - b.segX[k], dy = p.y - b.segY[k];
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// ---------- 擦彈 ----------
// 只有攻擊緊先計:頭槌撞出去(lunge)同各款衝刺(dash)。觀望、卡住、縮返、游走都唔計 ——
// 嗰啲時候條身又慢又擺明喺度,貼住佢就可以安全咁刷(用家試玩:「收頭嗰陣可以刷」= 問題)
const SERPENT_GRAZE_STAGES = { lunge: true, dash: true };
const SERPENT_JUMP = 300;     // 一幀郁多過呢個數 = 換咗路(瞬移),唔當係掃過

// 點 (px, py) 去線段 (ax, ay)–(bx, by) 最近距離嘅平方
function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const u = len2 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0;
  const x = ax + dx * u - px, y = ay + dy * u - py;
  return x * x + y * y;
}

// 每節每招只計一次(b.grazed 係 bitmask)。回傳今幀新擦到幾多節。
// 用「上一幀位置 → 今幀位置」成段去計(掃過),唔係淨係睇今幀個點:
// 頭槌撞出去最快每幀郁 60–80px,淨係睇點嘅話一節會直接跳過個擦彈範圍
function serpentGraze(b, p, ring) {
  const fresh = b.gzMove !== b.move;
  b.gzMove = b.move;
  const counts = SERPENT_GRAZE_STAGES[b.stage] && !fresh;
  const hx = b.x + Math.cos(b.angle) * SERPENT.headFront, hy = b.y + Math.sin(b.angle) * SERPENT.headFront;
  let n = 0;
  for (let k = 0; k < SERPENT.nodes; k++) {
    const x = k ? b.segX[k] : hx, y = k ? b.segY[k] : hy;
    const ox = b.gzX[k], oy = b.gzY[k];
    b.gzX[k] = x; b.gzY[k] = y;
    const bit = 1 << k;
    if (!counts || (b.grazed & bit)) continue;
    const r = SERPENT.grazeR * SERPENT_SCALE[k] + p.r + ring;
    const jump = (x - ox) ** 2 + (y - oy) ** 2 > SERPENT_JUMP * SERPENT_JUMP;
    const d2 = jump ? (p.x - x) ** 2 + (p.y - y) ** 2 : segDist2(p.x, p.y, ox, oy, x, y);
    if (d2 < r * r) { b.grazed |= bit; n++; }
  }
  return n;
}

// ---------- 擊破演出(死亡動畫) ----------
// 照設計檔「虛空星蛇・擊破」:最後一擊 → 痛到亂扭、裂紋越閃越勁 → 由條尾一節節連環爆上個頭
// → 個頭掙扎幾下大爆炸 → 爆出金幣晶石吸去玩家度 → 「擊破」。
// 全部係由最後一擊計起嘅秒數(原速),實際時間要除 SERPENT_DEATH_SPEED。畫法喺 js/sprites.js。
const SERPENT_DEATH = {
  barDrain: .5,       // HUD 嘅 BOSS 血條瀉到 0
  flash: .25,         // 最後一擊白閃幾耐
  chain: 1.2,         // 條尾第一節開始脹
  chainGap: .09,      // 一節隔一節(成條爆完大約 2 秒,唔理有幾多節)
  swell: .1,          // 一節由開始脹到爆
  gone: .16,          // 一節由開始脹到完全冇咗
  pop: .5,            // 每節爆嗰下嘅光圈、碎片維持幾耐
  headSwell: 3.65,    // 個頭開始脹
  burst: 3.8,         // 大爆炸:BOSS 剷走、掉寶(同通用過場一樣叫 burst)
  burstLife: .9,      // 大爆炸光圈、光芒幾耐
  lootOut: 3.85,      // 金幣晶石爆出嚟
  lootSpread: 4.4,    // 散開到位
  lootFly: 4.85,      // 第一粒開始飛去玩家度
  lootGap: .04,       // 一粒隔一粒
  lootFlyDur: .38,    // 每粒飛幾耐
  bannerIn: 4.4, bannerFull: 4.6, bannerHold: 6.4, bannerOut: 6.6,   // 「擊破」大字
  hudFade: .4,        // 大爆炸之後 HUD 淡到 .25 用幾耐
  pick: 6.2,          // 能力畫面開始滑上嚟
};
const SERPENT_DEATH_SPEED = 1;   // 整體快慢。1 = 照設計(大約 6 秒);1.5 = 快一半

// 第 k 節(1 = 貼住個頭,nodes − 1 = 條尾)幾時開始脹。由條尾爆起,一路爆上個頭
function serpentDeathStart(k) {
  const D = SERPENT_DEATH, n = SERPENT.nodes;
  const slot = Math.round((n - 1 - k) * 22 / Math.max(1, n - 2));   // 0 = 條尾 … 22 = 貼住個頭
  return D.chain + D.chainGap * slot;
}

// 過場每幀:每節爆嗰下噴粒子、震一震(畫面部分喺 drawSerpent)
function serpentFinaleTick(b, ft) {
  if (!b.deathDone) b.deathDone = 0;
  for (let k = 1; k < SERPENT.nodes; k++) {
    if (ft < serpentDeathStart(k) + SERPENT_DEATH.swell || (b.deathDone & (1 << k))) continue;
    b.deathDone |= 1 << k;
    const x = b.segX[k], y = b.segY[k];
    if (x > -40 && x < W + 40 && y > -40 && y < H + 40) { explode(x, y, b.edge, 8, 200); shake(5); }
  }
}

// 金幣晶石:[款, 散開去邊(相對爆炸點), 轉一圈幾耐]。照設計檔 16 粒
const SERPENT_LOOT = [
  ['gem', -48, -20, .6], ['coin', -69, 44, .7], ['coin', -63, 37, .8], ['star', -19, -49, .9],
  ['coin', -42, -86, .6], ['gem', -93, 9, .7], ['coin', 31, -38, .8], ['coin', -76, 62, .9],
  ['coin', -56, 13, .6], ['coin', 62, 12, .7], ['gem', 51, -39, .8], ['coin', -41, 25, .9],
  ['coin', 65, -38, .6], ['coin', 35, -60, .7], ['coin', 99, -5, .8], ['gem', 33, -48, .9],
];


// =====================================================================
// BOSS 表
// =====================================================================

const BOSSES = {
  crystal: {
    label: 'CRYSTAL CORE',
    hp: w => 55 + w * 22,
    r: 50, score: 3000, color: '#ff4d6d',
    edge: '#EC6FA7', core: '#EC6FA7',
    draw: drawCrystalBoss,
    // 由畫面頂跌落嚟,未到位唔出招
    enter(b, dt) { if (b.y < 135) { b.y += 55 * dt; return true; } return false; },
    cruise(b) {
      b.x = W / 2 + Math.sin(b.t * .65) * (W / 2 - 75);
      b.y = 135 + Math.sin(b.t * 1.3) * 14;
    },
    phases: [
      { over: .5, moves: [CRYSTAL_CYCLE] },
      { over: 0, moves: [crystalBarrage(0), crystalBarrage(1), crystalBarrage(2)] },
    ],
  },

  serpent: {
    label: 'VOID SERPENT',
    hp: w => 300 + w * 40,
    r: SERPENT.headHitR, score: 3000, color: '#F2C94C',
    edge: '#F2C94C', core: '#EC6FA7',
    init: serpentInit,
    hit: serpentHit, touches: serpentTouches,
    graze: serpentGraze, visible: b => !serpentHidden(b),
    finale: SERPENT_DEATH, finaleSpeed: SERPENT_DEATH_SPEED, finaleTick: serpentFinaleTick,
    drawFinale: drawSerpentFinale, drawFinaleHud: drawSerpentFinaleHud,
    draw: drawSerpent,
    phases: [
      { over: .5, moves: [serpentLurk(1), serpentCharge(), serpentLurk(1), serpentCharge()] },
      // 第二階段轉色,招式更密
      { over: 0, edge: '#C77DFF', core: '#FF4D6D',
        moves: [serpentLurk(2), serpentDash('C'), serpentLurk(2), serpentDash('D')] },
    ],
  },
};
