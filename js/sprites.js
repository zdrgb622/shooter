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

// 動畫參數(設計 demo 嘅 spin / shimmer / bob)
const SHARD_SPIN = .35;      // 碎片環繞速度,弧度 / 秒
const DRONE_SPIN = 1.1;      // 無人機自轉,弧度 / 秒
const DRONE_BOB = 3.5;       // 無人機上下浮嘅幅度(只係畫面,唔影響碰撞)
const SHIMMER_RATE = .28;    // 水晶閃光幾耐一轉

const BOSS_ART = (() => {
  // 「原本」排列:一舊大水晶企中間,兩邊一對對細啲嘅向外排
  const pairs = [[59, 156, 126, 29, 2], [106, 146, 82, 17, 1], [138, 136, 58, 12, 1], [160, 128, 42, 9, 1]];
  const specs = [{ bx: 150, by: 180, h: 180, w: 42, ang: 0, depth: 0 }];
  for (let j = 1; j < 5; j++) {
    const side = j % 2 ? -1 : 1, k = Math.ceil(j / 2), q = pairs[Math.min(k, 4) - 1];
    specs.push({ bx: 150 + side * q[0], by: q[1], h: q[2], w: q[3], ang: side * q[4], depth: -k });
  }
  specs.sort((a, b) => a.depth - b.depth);        // 由後排到前

  const crystals = specs.map(q => crystal(q.bx, q.by, q.h, q.w, q.ang));
  // 招式「晶簇齊射」由每個尖端射出,由左至右排好,等扇形角度算得順
  const tips = crystals.map(k => k.body[0]).slice().sort((a, b) => a[0] - b[0]);
  const z = 1.45;   // 「原本」排列嘅核心大過其他排列
  return {
    crystals,
    tips,
    bodies: crystals.map(k => k.body),   // 受傷閃白時要成堆一齊畫,預先砌好唔使每幀 map
    core: [[150, BOSS_CORE_Y - 22 * z], [150 + 16 * z, BOSS_CORE_Y], [150, BOSS_CORE_Y + 22 * z], [150 - 16 * z, BOSS_CORE_Y]],
    pupil: [[150, BOSS_CORE_Y - 9 * z], [150 + 6 * z, BOSS_CORE_Y], [150, BOSS_CORE_Y + 9 * z], [150 - 6 * z, BOSS_CORE_Y]],
  };
})();

// 環繞碎片:每幀要重新計位置。用預先開好嘅陣列原地改值,
// 唔好每幀 new —— 每秒 60 幀 × 12 粒碎片就係大量垃圾,正正係 B6 懷疑緊嗰樣嘢。
const SHARD_POOL = Array.from({ length: 12 }, (_, i) => ({
  a0: i / 12 * Math.PI * 2 + .3,
  sz: 5 + (i % 3) * 2,
  pts: [[0, 0], [0, 0], [0, 0], [0, 0]],
}));
const shardsBack = [], shardsFront = [];

function bossShards(t) {
  shardsBack.length = 0;
  shardsFront.length = 0;
  for (const s of SHARD_POOL) {
    const a = s.a0 + t * SHARD_SPIN;
    const x = 150 + Math.cos(a) * 138, y = BOSS_CORE_Y + Math.sin(a) * 46, sz = s.sz;
    s.pts[0][0] = x;           s.pts[0][1] = y - sz * 1.6;
    s.pts[1][0] = x + sz * .7; s.pts[1][1] = y;
    s.pts[2][0] = x;           s.pts[2][1] = y + sz * 1.6;
    s.pts[3][0] = x - sz * .7; s.pts[3][1] = y;
    (Math.sin(a) < 0 ? shardsBack : shardsFront).push(s.pts);
  }
  return { back: shardsBack, front: shardsFront };
}

// 水晶閃光:平時暗,間唔中「叮」一下。每舊水晶錯開相位,唔會一齊閃。
function crystalShimmer(t, i) {
  const u = (t * SHIMMER_RATE + i * .19) % 1;
  return .2 + .8 * Math.max(0, 1 - Math.abs(u - .86) / .07);
}

function drawBossArt(e) {
  ctx.save();
  // 中咗最後一擊之後會抽搐,直到爆開為止
  if (e.dying) ctx.translate(rand(-5, 5), rand(-2.5, 2.5));
  const s = e.r * 2 / 190;            // 本地 300 闊,縮到差唔多兩個半徑
  ctx.scale(s, s);
  ctx.translate(-150, -BOSS_CORE_Y);

  const shards = bossShards(e.t);
  drawShapes(shards.back, BOSS_TONE.facet, BOSS_TONE.edge, 1);

  // 碎片預警:掟出嚟之前先喺嗰三粒碎片位置彈個圈,等玩家知道要閃
  if (e.phase === 1) {
    const warn = bossFlingWarn(e);
    if (warn > 0) {
      ctx.strokeStyle = BOSS_TONE.core;
      ctx.lineWidth = 2;
      for (const deg of BOSS_FLING_ANGLES) {
        const a = deg * Math.PI / 180 + e.t * SHARD_SPIN;
        const x = 150 + Math.cos(a) * 138, y = BOSS_CORE_Y + Math.sin(a) * 46;
        ctx.globalAlpha = 1 - warn;
        ctx.beginPath(); ctx.arc(x, y, 6 + warn * 22, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  BOSS_ART.crystals.forEach((k, i) => {
    drawShapes([k.body], BOSS_TONE.body, BOSS_TONE.edge, 1.5);
    drawShapes([k.facet], BOSS_TONE.facet);
    ctx.globalAlpha = crystalShimmer(e.t, i);
    drawShapes([k.light], BOSS_TONE.light);
    ctx.globalAlpha = 1;
  });

  // 核心跟住攻擊模式轉色,等玩家睇得出佢而家用緊邊招
  const coreColor = ['#EC6FA7', '#F2C94C', '#9B8BFF'][e.mode] || BOSS_TONE.core;
  const pulse = 1 + Math.sin(e.t * 6) * .06;
  ctx.save();
  ctx.translate(150, BOSS_CORE_Y); ctx.scale(pulse, pulse); ctx.translate(-150, -BOSS_CORE_Y);
  drawShapes([BOSS_ART.core], coreColor);
  drawShapes([BOSS_ART.pupil], BOSS_TONE.facet);
  ctx.restore();

  drawShapes(shards.front, BOSS_TONE.facet, BOSS_TONE.edge, 1);

  // 尖端着燈:齊射之前逐個尖端亮一亮
  if (e.phase === 1) {
    ctx.fillStyle = BOSS_TONE.light;
    BOSS_ART.tips.forEach((tip, i) => {
      const g = bossTipGlow(e, i);
      if (g <= 0) return;
      ctx.globalAlpha = g;
      ctx.beginPath(); ctx.arc(tip[0], tip[1], 4 + g * 9, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  if (e.flash > 0) {
    ctx.globalAlpha = e.flash * .5;
    drawShapes(BOSS_ART.bodies, '#fff');
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// 水晶核喺 BOSSES 表入面嘅畫法:平移到 BOSS 個位再畫(drawBossArt 用本地座標)
function drawCrystalBoss(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  drawBossArt(e);
  ctx.restore();
}

// ---------- BOSS:虛空星蛇(本地座標,向住 +x;照設計嘅 SVG 抄) ----------

const SERPENT_ART = {
  outline: [[24.9, 10.3], [10.3, 24.9], [-10.3, 24.9], [-24.9, 10.3], [-24.9, -10.3], [-10.3, -24.9], [10.3, -24.9], [24.9, -10.3]],
  seg: [[23.1, 9.6], [9.6, 23.1], [-9.6, 23.1], [-23.1, 9.6], [-23.1, -9.6], [-9.6, -23.1], [9.6, -23.1], [23.1, -9.6]],
  segIn: [[13.8, 0], [6.9, 11.9], [-6.9, 11.9], [-13.8, 0], [-6.9, -11.9], [6.9, -11.9]],
  legs: [[-3, 26, -8, 39], [-3, -26, -8, -39]],          // 兩條腳,開放線段
  tail: [[-23, -8], [-55, 0], [-23, 8]],
  head: [[-25.5, -28.9], [15.3, -25.5], [44.2, -10.2], [44.2, 10.2], [15.3, 25.5], [-25.5, 28.9]],
  headIn: [[-15.3, -17], [11.9, -15.3], [25.5, 0], [11.9, 15.3], [-15.3, 17]],
  jawL: [[40.8, -11.9], [68, -22.1], [59.5, -5.1]],
  jawR: [[40.8, 11.9], [68, 22.1], [59.5, 5.1]],
  eyeL: [[17, -18.7], [30.6, -11.9], [20.4, -8.5]],
  eyeR: [[17, 18.7], [30.6, 11.9], [20.4, 8.5]],
};
const SERPENT_TONE = { body: '#132A3A', dark: '#0B1026', red: '#FF4D6D', redEdge: '#FFD6E0' };

// 多邊形:用 for 迴圈,唔用 forEach —— 呢度每幀要畫成百次,唔想每次都整一個新 function
function polyPath(pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function poly(pts, fill, stroke, lw) {
  ctx.beginPath(); polyPath(pts);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}

// 預警閃:先亮、之後喺 0.9 同 0.35 之間閃(每 0.35 秒一下),最尾 0.3 秒淡出 —— 照設計
function warnAlpha(now, t0, t1) {
  if (now < t0 || now >= t1) return 0;
  if (now < t0 + .12) return .9 * (now - t0) / .12;
  if (now > t1 - .3) return .95 * (t1 - now) / .3;
  const u = (now - t0 - .12) / .35;
  return .35 + .55 * Math.abs((u % 2) - 1);
}

function drawBadge(x, y, color) {         // 圓形「!」
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = SERPENT_TONE.dark;
  ctx.font = '700 26px "Chakra Petch", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('!', x, y + 1);
}

function drawDashedCircle(x, y, r, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
}

// 準星四個角(頭槌鎖定 / 觀望玩家都用)
function drawCorners(x, y, half, len, color, lw) {
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let sx = -1; sx <= 1; sx += 2) for (let sy = -1; sy <= 1; sy += 2) {
    ctx.moveTo(x + sx * half, y + sy * (half - len));
    ctx.lineTo(x + sx * half, y + sy * half);
    ctx.lineTo(x + sx * (half - len), y + sy * half);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

// 地上嘅預警(畫喺條蛇下面)
function drawSerpentWarnsUnder(e) {
  const now = e.cycle;
  for (let i = 0; i < e.nWarn; i++) {
    const w = e.warns[i];
    const a = warnAlpha(now, w.t0, w.t1);
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    if (w.kind === 'col') {                       // 一條直嘅衝刺路線
      ctx.fillStyle = e.core;
      ctx.globalAlpha = a * .16; ctx.fillRect(w.x - 28, 0, 56, H);
      ctx.globalAlpha = a; ctx.fillRect(w.x - 28, 0, 2, H); ctx.fillRect(w.x + 26, 0, 2, H);
    } else if (w.kind === 'diag') {               // 斜插嘅路線
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.a);
      ctx.fillStyle = e.core;
      ctx.globalAlpha = a * .16; ctx.fillRect(-900, -28, 1800, 56);
      ctx.globalAlpha = a; ctx.fillRect(-900, -28, 1800, 2); ctx.fillRect(-900, 26, 1800, 2);
      ctx.restore();
    } else if (w.kind === 'ring' || w.kind === 'safe') {   // 包圍:大圈 = 佢會兜嘅範圍,細圈 = 安全位
      drawDashedCircle(w.x, w.y, w.r, e.core);
    } else if (w.kind === 'lunge') {              // 頭槌:由個頭拉出嚟嘅紅色虛線
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.a);
      ctx.fillStyle = SERPENT_TONE.red;
      ctx.globalAlpha = a * .14;
      ctx.fillRect(0, -20, w.r, 40);
      ctx.globalAlpha = a;
      for (let x = 0; x < w.r; x += 20) ctx.fillRect(x, -1, Math.min(12, w.r - x), 2);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

// 浮喺條蛇上面嘅標記
function drawSerpentWarnsOver(e) {
  const now = e.cycle;
  for (let i = 0; i < e.nWarn; i++) {
    const w = e.warns[i];
    if (w.kind === 'lock') {                      // 頭槌準星:由大縮細、轉正
      if (now < w.t0 || now >= w.t1) continue;
      const u = Math.min(1, (now - w.t0) / .2);
      const fade = now > w.t1 - .3 ? (w.t1 - now) / .3 : 1;
      ctx.save(); ctx.translate(w.x, w.y);
      ctx.rotate((1 - u) * Math.PI / 4);
      ctx.globalAlpha = u * fade;
      const k = 1.8 - .8 * u;
      drawCorners(0, 0, 38 * k, 16 * k, SERPENT_TONE.red, 2.6);
      ctx.fillStyle = SERPENT_TONE.red;
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    const a = warnAlpha(now, w.t0, w.t1);
    if (a <= 0) continue;
    ctx.globalAlpha = Math.min(1, a + .1);
    if (w.kind === 'col' || w.kind === 'ring') drawBadge(w.x, 126, e.core);
    else if (w.kind === 'diag') {
      // 「!」擺喺條線入畫面附近(y = 150)
      const k = Math.abs(Math.sin(w.a)) > .1 ? (150 - w.y) / Math.sin(w.a) : 0;
      drawBadge(clamp(w.x + Math.cos(w.a) * k, 30, W - 30), 150, e.core);
    }
  }
  ctx.globalAlpha = 1;
}

function drawSerpent(e) {
  // 時間用 now,唔好叫 t —— t 係 i18n 嘅文字 function,遮住咗下面就攞唔到「破綻!」
  const now = e.t, th = SERPENT.thick, n = SERPENT.nodes;
  ctx.save();
  if (e.dying) ctx.translate(rand(-4, 4), rand(-2, 2));

  drawSerpentWarnsUnder(e);

  // 觀望緊:玩家四圍有個淡淡嘅框,話畀你知佢望住你
  if (e.stage === 'watch') {
    const pulse = .5 - .5 * Math.cos(now / 1.4 * Math.PI * 2);
    ctx.globalAlpha = .35 + .4 * pulse;
    drawCorners(player.x, player.y - 4, 42 * (1 + .12 * pulse), 14, e.core, 2);
    ctx.globalAlpha = 1;
  }

  // 身:由條尾畫起,個頭先會蓋喺最上面
  for (let k = n - 1; k >= 1; k--) {
    const x = e.segX[k], y = e.segY[k];
    if (x < -70 || x > W + 70 || y < -70 || y > H + 70) continue;   // 畫面外唔使畫
    const sc = SERPENT_SCALE[k], a = e.segA[k];
    const wave = 3 * Math.sin((now + k * .16) / 2.6 * Math.PI * 2);   // 身體左右輕輕擺(純畫面)
    ctx.save();
    ctx.translate(x - Math.sin(a) * wave, y + Math.cos(a) * wave);
    ctx.rotate(a);
    ctx.scale(sc, sc * th);
    if (k === n - 1) poly(SERPENT_ART.tail, e.edge, SERPENT_TONE.dark, 2);
    ctx.strokeStyle = e.edge; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let j = 0; j < 2; j++) {
      const l = SERPENT_ART.legs[j];
      ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]);
    }
    ctx.stroke(); ctx.lineCap = 'butt';
    poly(SERPENT_ART.outline, null, SERPENT_TONE.dark, 9);
    poly(SERPENT_ART.seg, SERPENT_TONE.body, e.edge, 2.4);
    poly(SERPENT_ART.segIn, SERPENT_TONE.dark, e.edge, 1);
    // 每節中間一粒光,錯開相位咁呼吸
    const p = .5 - .5 * Math.cos((now + k * .11) / 2.8 * Math.PI * 2);
    ctx.globalAlpha = .55 + .45 * p;
    ctx.fillStyle = e.core;
    ctx.beginPath(); ctx.arc(0, 0, 7.1 * (.85 + .3 * p), 0, Math.PI * 2); ctx.fill();
    const white = Math.max(e.pflash, k === e.hitK ? e.flash : 0);
    if (white > 0) { ctx.globalAlpha = white * .55; poly(SERPENT_ART.seg, '#fff'); }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // 頭
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle + e.aim);
  if (e.stage === 'stuck') {                     // 撞完卡住:個頭震吓震吓,越震越細
    const k = Math.max(0, 1 - e.stageT / SERPENT_LURK.stuck);
    ctx.translate(rand(-4, 4) * k, rand(-2, 2) * k);
    ctx.rotate(rand(-.09, .09) * k);
  }
  // 伸脷:觀望嗰陣間唔中「嘶」一下
  if (e.stage === 'watch' && (now % 2.4) < .3) {
    const f = Math.sin((now % 2.4) / .3 * Math.PI);
    ctx.strokeStyle = SERPENT_TONE.red; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(44, 0); ctx.lineTo(44 + 20 * f, 0);
    ctx.lineTo(44 + 28 * f, -6 * f);
    ctx.moveTo(44 + 20 * f, 0); ctx.lineTo(44 + 28 * f, 6 * f);
    ctx.stroke(); ctx.lineCap = 'butt';
  }
  ctx.scale(1, th);
  poly(SERPENT_ART.jawL, e.edge, SERPENT_TONE.dark, 2);
  poly(SERPENT_ART.jawR, e.edge, SERPENT_TONE.dark, 2);
  poly(SERPENT_ART.head, null, SERPENT_TONE.dark, 9);
  poly(SERPENT_ART.head, SERPENT_TONE.body, e.edge, 2.6);
  poly(SERPENT_ART.headIn, SERPENT_TONE.dark, e.edge, 1);
  if (e.eyesRed) {
    ctx.save(); ctx.scale(1.15, 1);
    poly(SERPENT_ART.eyeL, SERPENT_TONE.red, SERPENT_TONE.redEdge, 1);
    poly(SERPENT_ART.eyeR, SERPENT_TONE.red, SERPENT_TONE.redEdge, 1);
    ctx.restore();
  } else {
    ctx.globalAlpha = .75 + .25 * Math.sin(now * 2.2);
    poly(SERPENT_ART.eyeL, e.core); poly(SERPENT_ART.eyeR, e.core);
    ctx.globalAlpha = 1;
  }
  const white = Math.max(e.pflash, e.hitK === 0 ? e.flash : 0);
  if (white > 0) { ctx.globalAlpha = white * .55; poly(SERPENT_ART.head, '#fff'); ctx.globalAlpha = 1; }
  ctx.restore();

  drawSerpentWarnsOver(e);

  // 撞落去嗰下:撞擊圈 + 一閃白
  const since = e.cycle - e.impactT;
  if (since >= 0 && since < .6) {
    const u = since / .6;
    ctx.globalAlpha = 1 - u;
    ctx.strokeStyle = e.edge; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(e.lockX, e.lockY, 18 + u * 96, 0, Math.PI * 2); ctx.stroke();
    if (since < .27) {
      ctx.globalAlpha = .22 * (1 - since / .27);
      ctx.fillStyle = '#fff'; ctx.fillRect(-30, -30, W + 60, H + 60);
    }
    ctx.globalAlpha = 1;
  }

  // 「破綻!」:卡住嗰陣浮喺個頭上面
  if (e.weak) {
    const u = Math.min(1, e.stageT / .15);
    ctx.globalAlpha = u;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tx = clamp(e.x, 60, W - 60), ty = clamp(e.y - 62 + 8 * (1 - u), 90, H - 40);
    ctx.font = '900 18px "Noto Sans TC", sans-serif';
    ctx.fillStyle = e.edge;
    ctx.fillText(t('weakTag'), tx, ty);
    ctx.font = '11px "Noto Sans TC", sans-serif';
    ctx.fillStyle = ART.hudText;
    ctx.fillText(t('weakHint'), tx, ty + 20);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
