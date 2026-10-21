// 調數面板:一邊玩一邊拉數值,即刻生效,唔使改 code 再 reload。
//
// 點開:網址後面加 ?tune(例如 index.html?tune),之後撳 T 或者右上角「調數」掣。
//       正常玩家冇 ?tune 就乜都見唔到。
// 改過嘅數值存喺呢部機嘅瀏覽器,reload 都仲喺度;「全部還原」清走。
// 調啱咗:撳「複製改動」,將段字貼俾 Claude;喺 Claude artifact 入面玩就撳「交俾 Claude」。
// 面板淨係改記憶體入面嘅數值,唔會改 code —— 要寫返入 code 先算數。
//
// 要加一個新數值:喺 TUNE_GROUPS 加一行就得。tests/tune.test.js 會檢查每個 path
// 都真係搵到一個數字,所以 code 入面改咗名,呢度冇跟住改,npm test 會紅。

// 有啲數值唔喺任何 object 入面(寫死喺 newGame() 或者係 const 數字),
// 就放喺呢幾個「替身」度,再由下面嘅 wrapper 套返落遊戲。
const TUNE_PLAYER = { speed: player.speed, level: player.level };
const TUNE_RUN = { startWave: START_WAVE };
const TUNE_BOSS_HP = { crystal: 1, serpent: 1 };     // BOSS 血量倍數

const TUNE_ROOTS = {
  PLAYER: TUNE_PLAYER, RUN: TUNE_RUN, BOSS_HP: TUNE_BOSS_HP,
  HP, GRAZE, COMET, WAVE, SERPENT, SERPENT_LURK, SERPENT_CHARGE,
};

// next: true = 下一局先生效(撳「重新開始」)
const TUNE_GROUPS = [
  { name: '玩家', items: [
    { path: 'PLAYER.speed', label: '移動速度', unit: 'px/秒', min: 200, max: 800, step: 10 },
    { path: 'PLAYER.level', label: '開局火力', min: 1, max: 5, step: 1, next: true },
    { path: 'HP.max', label: '開局血量', min: 40, max: 300, step: 5, next: true },
    { path: 'HP.bullet', label: '中一粒敵彈扣血', min: 0, max: 60, step: 1 },
    { path: 'HP.touch', label: '撞到敵機扣血', min: 0, max: 80, step: 1 },
    { path: 'HP.inv', label: '中彈後無敵', unit: '秒', min: 0, max: 5, step: .1 },
    { path: 'HP.heal', label: '執 ♥ 補血', min: 0, max: 100, step: 5 },
  ] },
  { name: '擦彈', items: [
    { path: 'GRAZE.ring', label: '擦彈範圍', unit: 'px', min: 0, max: 40, step: 1 },
    { path: 'GRAZE.full', label: '儲滿要幾多分', min: 2, max: 40, step: 1 },
    { path: 'GRAZE.bullet', label: '擦子彈得分', min: 0, max: 5, step: 1 },
    { path: 'GRAZE.ship', label: '擦敵機得分', min: 0, max: 6, step: 1 },
    { path: 'GRAZE.serpent', label: '擦星蛇一節得分', min: 0, max: 5, step: 1 },
  ] },
  { name: '彗星爆衝', items: [
    { path: 'COMET.rise', label: '衝上去用幾耐', unit: '秒', min: .15, max: 1.2, step: .01 },
    { path: 'COMET.away', label: '出咗畫面等幾耐', unit: '秒', min: 0, max: 1.5, step: .05 },
    { path: 'COMET.back', label: '飛返原位用幾耐', unit: '秒', min: .1, max: 1.2, step: .01 },
    { path: 'COMET.reach', label: '撞擊闊度', unit: 'px', min: 20, max: 200, step: 5 },
    { path: 'COMET.bossDamage', label: '撞 BOSS 扣血', min: 0, max: 100, step: 1 },
  ] },
  { name: '波次', items: [
    { path: 'RUN.startWave', label: '由第幾波開始', min: 1, max: 30, step: 1, next: true },
    { path: 'WAVE.lead', label: '開波後幾耐出第一隻', unit: '秒', min: 0, max: 3, step: .1 },
    { path: 'WAVE.bossEvery', label: '幾多波一隻 BOSS', min: 1, max: 8, step: 1 },
    { path: 'WAVE.bossLead', label: 'BOSS 波幾耐出 BOSS', unit: '秒', min: 0, max: 4, step: .1 },
  ] },
  { name: 'BOSS', items: [
    { path: 'BOSS_HP.crystal', label: '水晶核血量', unit: '倍', min: .2, max: 3, step: .1, next: true },
    { path: 'BOSS_HP.serpent', label: '星蛇血量', unit: '倍', min: .2, max: 3, step: .1, next: true },
    { path: 'SERPENT_CHARGE.warn', label: '星蛇衝刺預警', unit: '秒', min: .3, max: 2.5, step: .05 },
    { path: 'SERPENT_CHARGE.speed', label: '星蛇衝刺速度', unit: 'px/秒', min: 400, max: 2000, step: 50 },
    { path: 'SERPENT_LURK.watch', label: '頭槌前望住你', unit: '秒', min: .5, max: 4, step: .1 },
    { path: 'SERPENT_LURK.pull', label: '頭槌縮頸蓄力', unit: '秒', min: .2, max: 2, step: .05 },
    { path: 'SERPENT_LURK.stuck', label: '頭槌撞完卡住(破綻)', unit: '秒', min: 0, max: 2.5, step: .05 },
    { path: 'SERPENT.touchR', label: '星蛇撞到你嘅半徑', unit: 'px', min: 6, max: 30, step: 1 },
  ] },
];
const TUNE_ITEMS = TUNE_GROUPS.flatMap(g => g.items);

function tuneGet(path) {
  const [root, key] = path.split('.');
  return TUNE_ROOTS[root][key];
}

function tuneSet(path, v) {
  const [root, key] = path.split('.');
  TUNE_ROOTS[root][key] = v;
  if (path === 'PLAYER.speed') player.speed = v;   // 呢個即刻套落而家架機
}

// 載入時嘅原本數值,用嚟判斷「改咗乜」同還原
const TUNE_DEFAULT = Object.fromEntries(TUNE_ITEMS.map(it => [it.path, tuneGet(it.path)]));

// ---------- 套返落遊戲 ----------
const tuneNewGame0 = newGame;
newGame = function () {
  tuneNewGame0();
  player.speed = TUNE_PLAYER.speed;
  player.level = TUNE_PLAYER.level;
};

const tuneStartRun0 = startRun;
startRun = function () {
  tuneStartRun0();
  if (TUNE_RUN.startWave !== START_WAVE) {
    game.wave = TUNE_RUN.startWave - 1;
    startWave();
  }
};

for (const k of Object.keys(TUNE_BOSS_HP)) {
  const base = BOSSES[k].hp;
  BOSSES[k].hp = w => base(w) * TUNE_BOSS_HP[k];
}

// ---------- 儲存 ----------
const TUNE_KEY = 'stardrift_tune';

function tuneChanges() {
  const out = {};
  for (const it of TUNE_ITEMS) if (tuneGet(it.path) !== TUNE_DEFAULT[it.path]) out[it.path] = tuneGet(it.path);
  return out;
}

function tuneSave() { store.set(TUNE_KEY, JSON.stringify(tuneChanges())); }

function tuneLoad() {
  let saved = {};
  try { saved = JSON.parse(store.get(TUNE_KEY) || '{}') || {}; } catch {}
  for (const it of TUNE_ITEMS) {
    const v = saved[it.path];
    if (typeof v === 'number' && isFinite(v)) tuneSet(it.path, v);
  }
}

// 俾人睇 / 貼俾 Claude 嘅文字
function tuneReport() {
  const ch = tuneChanges(), keys = Object.keys(ch);
  if (!keys.length) return 'STARDRIFT 調數:冇改動';
  const label = Object.fromEntries(TUNE_ITEMS.map(it => [it.path, it.label]));
  return [`STARDRIFT 調數(${keys.length} 項)`,
    ...keys.map(k => `${k}: ${TUNE_DEFAULT[k]} → ${ch[k]}    // ${label[k]}`)].join('\n');
}

tuneLoad();
newGame();   // core.js 已經開咗一局,用調過嘅數值再開過

// ---------- 面板(淨係 ?tune 先起) ----------
const TUNE_ON = (() => {
  try { return !!globalThis.STARDRIFT_TUNE || /[?&]tune\b/.test(location.search); } catch { return false; }
})();

if (TUNE_ON && typeof document !== 'undefined' && document.createElement) tuneBuildPanel();

function tuneBuildPanel() {
  const fmt = (v, step) => {
    const d = (String(step).split('.')[1] || '').length;
    return (+v).toFixed(d);
  };

  const btn = document.createElement('button');
  btn.id = 'tune-toggle';
  btn.type = 'button';

  const panel = document.createElement('aside');
  panel.id = 'tune';
  panel.hidden = true;
  panel.setAttribute('aria-label', '調數面板');

  const rows = {};
  let html = `<header><strong>調數</strong><span id="tune-count"></span>
    <button type="button" id="tune-close" aria-label="收埋面板">×</button></header><div id="tune-body">`;
  for (const g of TUNE_GROUPS) {
    html += `<details open><summary>${g.name}</summary>`;
    for (const it of g.items) {
      const id = 'tune-' + it.path.replace('.', '-');
      html += `<div class="tune-row" data-path="${it.path}">
        <label for="${id}">${it.label}${it.next ? '<em>新一局</em>' : ''}</label>
        <output id="${id}-out"></output>
        <button type="button" class="tune-reset" aria-label="還原${it.label}" title="還原">↺</button>
        <input type="range" id="${id}" min="${it.min}" max="${it.max}" step="${it.step}">
      </div>`;
    }
    html += `</details>`;
  }
  html += `</div><footer>
    <button type="button" id="tune-restart">重新開始</button>
    <button type="button" id="tune-copy">複製改動</button>
    <button type="button" id="tune-send" hidden>交俾 Claude</button>
    <button type="button" id="tune-clear">全部還原</button>
    <p id="tune-msg" role="status"></p>
    <textarea id="tune-text" readonly hidden rows="5"></textarea>
  </footer>`;
  panel.innerHTML = html;
  document.body.append(btn, panel);

  for (const row of panel.querySelectorAll('.tune-row')) {
    const it = TUNE_ITEMS.find(x => x.path === row.dataset.path);
    rows[it.path] = { it, row, input: row.querySelector('input'), out: row.querySelector('output') };
  }

  const $ = id => panel.querySelector('#' + id);
  const msg = t => { $('tune-msg').textContent = t; };

  function refresh() {
    let n = 0;
    for (const { it, row, input, out } of Object.values(rows)) {
      const v = tuneGet(it.path), changed = v !== TUNE_DEFAULT[it.path];
      input.value = v;
      out.textContent = fmt(v, it.step) + (it.unit ? ' ' + it.unit : '');
      row.classList.toggle('changed', changed);
      if (changed) n++;
    }
    $('tune-count').textContent = n ? `改咗 ${n} 項` : '';
    btn.textContent = n ? `調數 · ${n}` : '調數';
  }

  function open(on) {
    panel.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
  }

  panel.addEventListener('input', e => {
    const r = Object.values(rows).find(x => x.input === e.target);
    if (!r) return;
    tuneSet(r.it.path, +e.target.value);
    tuneSave(); refresh(); msg('');
  });
  panel.addEventListener('click', e => {
    const reset = e.target.closest('.tune-reset');
    if (!reset) return;
    const path = reset.closest('.tune-row').dataset.path;
    tuneSet(path, TUNE_DEFAULT[path]);
    tuneSave(); refresh();
  });
  // 拉 slider 嘅方向鍵 / 撳掣嘅空白鍵唔好傳落遊戲(否則架機會郁、會開火)
  panel.addEventListener('keydown', e => e.stopPropagation());
  panel.addEventListener('keyup', e => e.stopPropagation());

  btn.addEventListener('click', () => open(panel.hidden));
  $('tune-close').addEventListener('click', () => open(false));
  addEventListener('keydown', e => { if (e.code === 'KeyT') open(panel.hidden); });

  $('tune-restart').addEventListener('click', () => {
    newGame(); startRun();
    msg(TUNE_RUN.startWave > 1 ? `由第 ${TUNE_RUN.startWave} 波開始` : '重新開始咗');
  });
  $('tune-clear').addEventListener('click', () => {
    for (const it of TUNE_ITEMS) tuneSet(it.path, TUNE_DEFAULT[it.path]);
    tuneSave(); refresh(); msg('全部還原咗。「新一局」嗰啲要重新開始先生效');
  });
  $('tune-copy').addEventListener('click', () => {
    const text = tuneReport(), box = $('tune-text');
    const fallback = () => { box.hidden = false; box.value = text; box.select(); msg('自動複製唔到,揀晒下面段字自己複製'); };
    try {
      navigator.clipboard.writeText(text).then(() => { box.hidden = true; msg('複製咗,貼俾 Claude 就得'); }, fallback);
    } catch { fallback(); }
  });

  // 喺 Claude artifact 入面:直接將改動存落 artifact 嘅資料庫,Claude 讀得到
  if (typeof window.claude?.use === 'function') {
    window.claude.use('db').then(db => {
      if (!db) return;
      const send = $('tune-send');
      send.hidden = false;
      send.addEventListener('click', async () => {
        send.disabled = true;
        try {
          await db.doc('tune/latest').set({
            changes: tuneChanges(), defaults: TUNE_DEFAULT, text: tuneReport(), savedAt: Date.now(),
          });
          msg('交咗。返去對話同 Claude 講一聲「得」就得');
        } catch (err) {
          msg('交唔到(' + (err && err.code || '出錯') + '),試吓「複製改動」');
        } finally { send.disabled = false; }
      });
    }, () => {});
  }

  refresh();
}
