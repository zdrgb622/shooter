const LANGS = [
  { code: 'zh-Hant', label: '繁' },
  { code: 'zh-Hans', label: '简' },
  { code: 'en', label: 'EN' }
];

const STRINGS = {
  'zh-Hant': {
    docTitle: '星際戰機 STARDRIFT',
    hint: '方向鍵 / WASD 移動 · 空白鍵射擊 · P 暫停 · 亦可用滑鼠拖住玩',
    title: '星際戰機',
    subtitle: 'S T A R D R I F T',
    ctlMove: { key: '方向鍵 / WASD  移動', touch: '拖住畫面  移動', pad: '左搖桿 / 十字鍵  移動' },
    ctlShoot: { key: '空白鍵  射擊（可長按）', touch: '撳住畫面  自動開火', pad: 'A 或 RT  射擊' },
    ctlPause: { key: 'P 或右上角掣  暫停', touch: '撳右上角  暫停', pad: 'Start  暫停' },
    drops: '黃色 P 加火力 · 藍色 S 加護盾 · 粉色 ♥ 加命',
    bossInfo: '每 5 波有 BOSS',
    start: { key: '按空白鍵開始', touch: '撳一下畫面開始', pad: '按 A 開始' },
    langLabel: { key: '語言（按 L 切換）', touch: '語言', pad: '語言' },
    score: '晶體',
    high: '最高',
    combo: 'COMBO',
    wave: 'WAVE',
    power: 'POWER',
    bossBanner: '⚠ BOSS 來襲',
    paused: '已暫停',
    resume: { key: '按 P 或撳右上角繼續', touch: '撳右上角繼續', pad: '按 Start 繼續' },
    gameOver: 'GAME OVER',
    finalScore: '晶體 {n}',
    reached: '打到第 {n} 波',
    best: '最高紀錄 {n}',
    restart: { key: '按 R 重新開始', touch: '撳一下畫面重新開始', pad: '按 A 重新開始' },
    pickStage: 'WAVE {n} CLEAR',
    pickTitle: '選擇一項能力',
    pickHold: '持有',
    pickUnit: '晶體',
    pickReroll: '重抽',
    bossDefeated: 'BOSS DEFEATED',
    stageClear: 'STAGE {n} CLEAR',
    gotCrystals: '獲得 {n} 晶體',
    weakTag: '破綻!',
    weakHint: '打頭 ×2 傷害'
  },
  'zh-Hans': {
    docTitle: '星际战机 STARDRIFT',
    hint: '方向键 / WASD 移动 · 空白键射击 · P 暂停 · 亦可用鼠标拖住玩',
    title: '星际战机',
    subtitle: 'S T A R D R I F T',
    ctlMove: { key: '方向键 / WASD  移动', touch: '拖住画面  移动', pad: '左摇杆 / 十字键  移动' },
    ctlShoot: { key: '空白键  射击（可长按）', touch: '按住画面  自动开火', pad: 'A 或 RT  射击' },
    ctlPause: { key: 'P 或右上角掣  暂停', touch: '点右上角  暂停', pad: 'Start  暂停' },
    drops: '黄色 P 加火力 · 蓝色 S 加护盾 · 粉色 ♥ 加命',
    bossInfo: '每 5 波有 BOSS',
    start: { key: '按空白键开始', touch: '点一下画面开始', pad: '按 A 开始' },
    langLabel: { key: '语言（按 L 切换）', touch: '语言', pad: '语言' },
    score: '晶体',
    high: '最高',
    combo: 'COMBO',
    wave: 'WAVE',
    power: 'POWER',
    bossBanner: '⚠ BOSS 来袭',
    paused: '已暂停',
    resume: { key: '按 P 或点右上角继续', touch: '点右上角继续', pad: '按 Start 继续' },
    gameOver: 'GAME OVER',
    finalScore: '晶体 {n}',
    reached: '打到第 {n} 波',
    best: '最高纪录 {n}',
    restart: { key: '按 R 重新开始', touch: '点一下画面重新开始', pad: '按 A 重新开始' },
    pickStage: 'WAVE {n} CLEAR',
    pickTitle: '选择一项能力',
    pickHold: '持有',
    pickUnit: '晶体',
    pickReroll: '重抽',
    bossDefeated: 'BOSS DEFEATED',
    stageClear: 'STAGE {n} CLEAR',
    gotCrystals: '获得 {n} 晶体',
    weakTag: '破绽!',
    weakHint: '打头 ×2 伤害'
  },
  en: {
    docTitle: 'STARDRIFT',
    hint: 'Arrow keys / WASD to move · Space to fire · P to pause · or drag with the mouse',
    title: 'STARDRIFT',
    subtitle: 'S P A C E   S H O O T E R',
    ctlMove: { key: 'Arrow keys / WASD  Move', touch: 'Drag anywhere  Move', pad: 'Left stick / D-pad  Move' },
    ctlShoot: { key: 'Space  Fire (hold)', touch: 'Hold  Auto-fire', pad: 'A or RT  Fire' },
    ctlPause: { key: 'P or top-right button  Pause', touch: 'Tap top-right  Pause', pad: 'Start  Pause' },
    drops: 'P = firepower · S = shield · ♥ = extra life',
    bossInfo: 'A BOSS every 5 waves',
    start: { key: 'PRESS SPACE TO START', touch: 'TAP TO START', pad: 'PRESS A TO START' },
    langLabel: { key: 'Language (press L)', touch: 'Language', pad: 'Language' },
    score: 'CRYSTAL',
    high: 'BEST',
    combo: 'COMBO',
    wave: 'WAVE',
    power: 'POWER',
    bossBanner: '⚠ BOSS INCOMING',
    paused: 'PAUSED',
    resume: { key: 'Press P or tap the top-right button', touch: 'Tap the top-right button to resume', pad: 'Press Start to resume' },
    gameOver: 'GAME OVER',
    finalScore: 'Crystals {n}',
    reached: 'Reached wave {n}',
    best: 'Best {n}',
    restart: { key: 'PRESS R TO RESTART', touch: 'TAP TO RESTART', pad: 'PRESS A TO RESTART' },
    pickStage: 'WAVE {n} CLEAR',
    pickTitle: 'Choose an upgrade',
    pickHold: 'Hold',
    pickUnit: 'crystals',
    pickReroll: 'Reroll',
    bossDefeated: 'BOSS DEFEATED',
    stageClear: 'STAGE {n} CLEAR',
    gotCrystals: '+{n} crystals',
    weakTag: 'OPENING!',
    weakHint: 'Head hits ×2'
  }
};

let lang = store.get('stardrift_lang');
if (!STRINGS[lang]) lang = 'zh-Hant';

// 有啲字串要跟輸入方式變(手機冇空白鍵、手掣冇 P 掣),嗰啲寫成 { key, touch, pad }。
// 喺呢度揀,所以所有叫 t() 嘅地方都唔使理玩家用咩嘢玩。
const t = (key, n) => {
  let s = STRINGS[lang][key];
  if (s && typeof s === 'object') s = s[inputMode] || s.key;
  return n === undefined ? s : s.replace('{n}', n);
};

function setLang(code) {
  if (!STRINGS[code]) return;
  lang = code;
  store.set('stardrift_lang', code);
  applyLang();
}

function cycleLang() {
  const i = LANGS.findIndex(l => l.code === lang);
  setLang(LANGS[(i + 1) % LANGS.length].code);
}

function applyLang() {
  document.documentElement.lang = lang;
  document.title = t('docTitle');
  document.getElementById('hint').textContent = t('hint');
}
applyLang();
