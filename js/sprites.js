// 戰機、敵機、子彈嘅外形同顏色,全部照設計圖(GameSpace mockup,480×720「午夜街機」)。
//
// 設計圖用 SVG path 字串,呢度轉成點陣列,由 canvas 直接畫 —— 唔用 Path2D,
// 因為測試嘅假 canvas 冇呢個 API。
//
// 形狀嘅座標係「本地座標」:戰機 56×64,敵機 48×48,子彈 12×20。
// 畫嘅時候先平移到中心、再按實體半徑縮放,所以改半徑外形會跟住大細。

const ART = {
  pBody: '#1B2350', pTrim: '#E8ECFF', pAccent: '#FF7A45', flame: '#FF7A45', flameIn: '#FFF3D6',
  eBody: '#132A3A', eDetail: '#4FD1C5', eLight: '#EC6FA7',
  shot: '#FF7A45', eShot: '#EC6FA7',
  hudBg: 'rgba(11, 16, 38, .7)', hudText: '#E8ECFF', hudHi: '#F2C94C',
};

// 左右對稱:畀半邊,鏡返另一半(同設計圖同一個做法)
function sym(half, cx) {
  const mirrored = half.slice().reverse().map(q => [2 * cx - q[0], q[1]]);
  return half.concat(mirrored.filter((q, i, arr) =>
    !(i === 0 && q[0] === cx) && !(i === arr.length - 1 && q[0] === cx)));
}

// 一對鏡像多邊形(左右各一件)
const mir = (pts, cx) => [pts, pts.map(q => [2 * cx - q[0], q[1]])];

// 橢圓 / 正多邊形
function ell(cx, cy, rx, ry, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

const circ = (cx, cy, r) => ({ cx, cy, r });   // 圓形另外處理,唔使用幾十個點

// ---------- 戰機(本地 56×64,中心 28,30;設計嘅「隱形」款) ----------

const SHIP = {
  body: [sym([[28, 0], [54, 56], [40, 52], [28, 60]], 28)],
  trim: mir([[28, 22], [44, 50], [42, 51], [28, 26]], 28),
  accent: [[[28, 22], [30, 34], [26, 34]]],
  flame: [[[24, 58], [28, 76], [32, 58]]],
  flameIn: [[[26, 58], [28, 68], [30, 58]]],
};

// ---------- 敵機(本地 48×48,中心 24,24) ----------

const ENEMY_ART = {
  '截擊機': {
    body: [sym([[24, 2], [27, 10], [38, 4], [38, 12], [30, 20], [44, 32], [46, 40], [30, 34], [24, 46]], 24)],
    detail: [[[24, 40], [27, 30], [21, 30]]],
    light: [circ(4, 39, 2), circ(44, 39, 2)],
  },
  '無人機': {
    body: [ell(24, 24, 20, 20, 8)],
    detail: [ell(24, 24, 10, 10, 20)],
    light: [circ(24, 24, 4),
            [[23, 0], [25, 0], [25, 6], [23, 6]], [[23, 42], [25, 42], [25, 48], [23, 48]],
            [[0, 23], [6, 23], [6, 25], [0, 25]], [[42, 23], [48, 23], [48, 25], [42, 25]]],
  },
  '水晶': {
    body: [[[24, 1], [40, 20], [24, 47], [8, 20]]],
    detail: [[[24, 1], [28, 20], [24, 47], [20, 20]]],
    light: [[[12, 18], [16, 14], [17, 22]], circ(24, 20, 2.5)],
  },
};

// 遊戲入面三種敵機各用邊一款外形。加新敵機就喺呢度加一行。
const ENEMY_STYLE = { grunt: '水晶', darter: '截擊機', gunner: '無人機' };

// ---------- 子彈(本地 12×20,設計嘅「導彈」款) ----------

const SHOT = [sym([[6, 0], [8, 5], [8, 16], [10, 20], [6, 18]], 6)];

// ---------- 畫 ----------

// shapes 入面每件可以係點陣列(多邊形)或者 {cx, cy, r}(圓)
function drawShapes(shapes, fill, stroke, lineWidth) {
  ctx.beginPath();
  for (const s of shapes) {
    if (s.r !== undefined) {
      ctx.moveTo(s.cx + s.r, s.cy);
      ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
    } else {
      s.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath();
    }
  }
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth || 1.6; ctx.lineJoin = 'round'; ctx.stroke(); }
}

// ---------- BOSS:設計嘅「水晶核」(本地 300×180,中心 150,90) ----------
// 最終版設定:排列「原本」、5 舊水晶、菱形核心、12 粒環繞碎片,冇能量連線 / 裂紋 / 護盾。

const BOSS_TONE = { body: '#132A3A', facet: '#0B1026', light: '#4FD1C5', edge: '#4FD1C5', core: '#EC6FA7' };

function crystal(bx, by, h, w, ang) {
  const r = ang * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
  const T = (x, y) => [bx + x * cs - y * sn, by + x * sn + y * cs];
  const tip = T(0, -h), rr = T(w, -h / 2), bot = T(0, 0), ll = T(-w, -h / 2);
  return {
    body: [tip, rr, bot, ll],
    facet: [tip, bot, ll],
    light: [T(0, -h * .97), T(w * .19, -h * .78), T(w * .05, -h * .78)],
  };
}

const BOSS_CORE_Y = 90;

const BOSS_ART = (() => {
  // 「原本」排列:一舊大水晶企中間,兩邊一對對細啲嘅向外排
  const pairs = [[59, 156, 126, 29, 2], [106, 146, 82, 17, 1], [138, 136, 58, 12, 1], [160, 128, 42, 9, 1]];
  const specs = [{ bx: 150, by: 180, h: 180, w: 42, ang: 0, depth: 0 }];
  for (let j = 1; j < 5; j++) {
    const side = j % 2 ? -1 : 1, k = Math.ceil(j / 2), q = pairs[Math.min(k, 4) - 1];
    specs.push({ bx: 150 + side * q[0], by: q[1], h: q[2], w: q[3], ang: side * q[4], depth: -k });
  }
  specs.sort((a, b) => a.depth - b.depth);        // 由後排到前

  // 環繞碎片:喺核心周圍轉一圈,喺核心後面嘅排後邊,前面嘅排前邊
  const back = [], front = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + .3;
    const x = 150 + Math.cos(a) * 138, y = BOSS_CORE_Y + Math.sin(a) * 46, sz = 5 + (i % 3) * 2;
    const shard = [[x, y - sz * 1.6], [x + sz * .7, y], [x, y + sz * 1.6], [x - sz * .7, y]];
    (Math.sin(a) < 0 ? back : front).push(shard);
  }

  const z = 1.45;   // 「原本」排列嘅核心大過其他排列
  return {
    crystals: specs.map(q => crystal(q.bx, q.by, q.h, q.w, q.ang)),
    shardsBack: back,
    shardsFront: front,
    core: [[150, BOSS_CORE_Y - 22 * z], [150 + 16 * z, BOSS_CORE_Y], [150, BOSS_CORE_Y + 22 * z], [150 - 16 * z, BOSS_CORE_Y]],
    pupil: [[150, BOSS_CORE_Y - 9 * z], [150 + 6 * z, BOSS_CORE_Y], [150, BOSS_CORE_Y + 9 * z], [150 - 6 * z, BOSS_CORE_Y]],
  };
})();

function drawBossArt(e) {
  ctx.save();
  const s = e.r * 2 / 190;            // 本地 300 闊,縮到差唔多兩個半徑
  ctx.scale(s, s);
  ctx.translate(-150, -BOSS_CORE_Y);

  drawShapes(BOSS_ART.shardsBack, BOSS_TONE.facet, BOSS_TONE.edge, 1);
  for (const k of BOSS_ART.crystals) {
    drawShapes([k.body], BOSS_TONE.body, BOSS_TONE.edge, 1.5);
    drawShapes([k.facet], BOSS_TONE.facet);
    drawShapes([k.light], BOSS_TONE.light);
  }

  // 核心跟住攻擊模式轉色,等玩家睇得出佢而家用緊邊招
  const coreColor = ['#EC6FA7', '#F2C94C', '#9B8BFF'][e.mode] || BOSS_TONE.core;
  const pulse = 1 + Math.sin(e.t * 6) * .06;
  ctx.save();
  ctx.translate(150, BOSS_CORE_Y); ctx.scale(pulse, pulse); ctx.translate(-150, -BOSS_CORE_Y);
  drawShapes([BOSS_ART.core], coreColor);
  drawShapes([BOSS_ART.pupil], BOSS_TONE.facet);
  ctx.restore();

  drawShapes(BOSS_ART.shardsFront, BOSS_TONE.facet, BOSS_TONE.edge, 1);

  if (e.flash > 0) {
    ctx.globalAlpha = e.flash * .5;
    drawShapes(BOSS_ART.crystals.map(k => k.body), '#fff');
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
