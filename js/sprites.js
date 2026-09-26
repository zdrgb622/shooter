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

// ---------- 背景(設計嘅「行星」款) ----------
// 設計用 SVG turbulence filter 整星雲,canvas 冇呢樣,用徑向漸層近似。
// 星星就繼續用 core.js 嗰批會飄嘅,靜態星星喺遊戲入面冇速度感。

const BG = {
  planet: '#2A3A6E', ring: '#4FD1C5', neb: '114, 36, 62', deep: '#0B1026',
  rot: -18 * Math.PI / 180,
};

function drawSpace() {
  ctx.fillStyle = BG.deep;
  ctx.fillRect(-30, -30, W + 60, H + 60);

  // 星雲
  const g = ctx.createRadialGradient(400, 230, 0, 400, 230, 210);
  g.addColorStop(0, `rgba(${BG.neb}, .5)`);
  g.addColorStop(1, `rgba(${BG.neb}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(160, 20, 480, 420);

  // 行星環:外圈減內圈,中間鏤空
  ctx.globalAlpha = .8;
  ctx.fillStyle = BG.ring;
  ctx.beginPath();
  ctx.ellipse(40, H - 60, 300, 60, BG.rot, 0, Math.PI * 2);
  ctx.ellipse(40, H - 60, 250, 44, BG.rot, 0, Math.PI * 2);
  ctx.fill('evenodd');
  ctx.globalAlpha = 1;

  // 行星本體 + 陰影
  ctx.fillStyle = BG.planet;
  ctx.beginPath(); ctx.arc(40, H - 60, 190, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = .55;
  ctx.fillStyle = BG.deep;
  ctx.beginPath(); ctx.ellipse(90, H - 100, 170, 190, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

// ---------- BOSS:設計嘅「水晶核」(本地 300×180,中心 150,90) ----------
// 排列「尖塔」、5 舊水晶、菱形核心,即係設計圖嘅預設。

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

const BOSS_ART = (() => {
  const specs = [{ bx: 150, by: 146, h: 176, w: 26, ang: 0, depth: 0 }];
  for (let j = 1; j < 5; j++) {
    const side = j % 2 ? -1 : 1, k = Math.ceil(j / 2);
    specs.push({ bx: 150 + side * k * 30, by: 148, h: Math.max(40, 124 - k * 26),
                 w: Math.max(9, 19 - k * 3), ang: side * (10 + k * 9), depth: -k });
  }
  specs.sort((a, b) => a.depth - b.depth);        // 由後排到前

  const coreY = 136;
  return {
    crystals: specs.map(q => crystal(q.bx, q.by, q.h, q.w, q.ang)),
    core: [[150, coreY - 22], [166, coreY], [150, coreY + 22], [134, coreY]],
    pupil: [[150, coreY - 9], [156, coreY], [150, coreY + 9], [144, coreY]],
  };
})();

function drawBossArt(e) {
  ctx.save();
  const s = e.r * 2 / 190;            // 本地 300 闊,縮到差唔多兩個半徑
  ctx.scale(s, s);
  ctx.translate(-150, -110);

  for (const k of BOSS_ART.crystals) {
    drawShapes([k.body], BOSS_TONE.body, BOSS_TONE.edge, 1.5);
    drawShapes([k.facet], BOSS_TONE.facet);
    drawShapes([k.light], BOSS_TONE.light);
  }
  // 核心跟住攻擊模式轉色,等玩家睇得出佢而家用緊邊招
  const coreColor = ['#EC6FA7', '#F2C94C', '#9B8BFF'][e.mode] || BOSS_TONE.core;
  ctx.save();
  ctx.translate(150, 136); ctx.scale(1 + Math.sin(e.t * 6) * .06, 1 + Math.sin(e.t * 6) * .06); ctx.translate(-150, -136);
  drawShapes([BOSS_ART.core], coreColor);
  drawShapes([BOSS_ART.pupil], BOSS_TONE.facet);
  ctx.restore();

  if (e.flash > 0) {
    ctx.globalAlpha = e.flash * .5;
    drawShapes(BOSS_ART.crystals.map(k => k.body), '#fff');
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
