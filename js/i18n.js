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
    ctlMove: '方向鍵 / WASD  移動',
    ctlShoot: '空白鍵  射擊（可長按）',
    ctlPause: 'P 或右上角掣  暫停',
    drops: '黃色 P 加火力 · 藍色 S 加護盾 · 粉色 ♥ 加命',
    bossInfo: '每 5 波有 BOSS',
    start: '按空白鍵開始',
    langLabel: '語言（按 L 切換）',
    score: '晶體',
    high: '最高',
    combo: 'COMBO',
    wave: 'WAVE',
    power: 'POWER',
    bossBanner: '⚠ BOSS 來襲',
    paused: '已暫停',
    resume: '按 P 或撳右上角繼續',
    gameOver: 'GAME OVER',
    finalScore: '晶體 {n}',
    reached: '打到第 {n} 波',
    best: '最高紀錄 {n}',
    restart: '按 R 重新開始',
    pickStage: 'WAVE {n} CLEAR',
    pickTitle: '選擇一項能力',
    pickHold: '持有',
    pickUnit: '晶體',
    pickReroll: '重抽',
    pickConfirm: '裝  備'
  },
  'zh-Hans': {
    docTitle: '星际战机 STARDRIFT',
    hint: '方向键 / WASD 移动 · 空白键射击 · P 暂停 · 亦可用鼠标拖住玩',
    title: '星际战机',
    subtitle: 'S T A R D R I F T',
    ctlMove: '方向键 / WASD  移动',
    ctlShoot: '空白键  射击（可长按）',
    ctlPause: 'P 或右上角掣  暂停',
    drops: '黄色 P 加火力 · 蓝色 S 加护盾 · 粉色 ♥ 加命',
    bossInfo: '每 5 波有 BOSS',
    start: '按空白键开始',
    langLabel: '语言（按 L 切换）',
    score: '晶体',
    high: '最高',
    combo: 'COMBO',
    wave: 'WAVE',
    power: 'POWER',
    bossBanner: '⚠ BOSS 来袭',
    paused: '已暂停',
    resume: '按 P 或点右上角继续',
    gameOver: 'GAME OVER',
    finalScore: '晶体 {n}',
    reached: '打到第 {n} 波',
    best: '最高纪录 {n}',
    restart: '按 R 重新开始',
    pickStage: 'WAVE {n} CLEAR',
    pickTitle: '选择一项能力',
    pickHold: '持有',
    pickUnit: '晶体',
    pickReroll: '重抽',
    pickConfirm: '装  备'
  },
  en: {
    docTitle: 'STARDRIFT',
    hint: 'Arrow keys / WASD to move · Space to fire · P to pause · or drag with the mouse',
    title: 'STARDRIFT',
    subtitle: 'S P A C E   S H O O T E R',
    ctlMove: 'Arrow keys / WASD  Move',
    ctlShoot: 'Space  Fire (hold)',
    ctlPause: 'P or top-right button  Pause',
    drops: 'P = firepower · S = shield · ♥ = extra life',
    bossInfo: 'A BOSS every 5 waves',
    start: 'PRESS SPACE TO START',
    langLabel: 'Language (press L)',
    score: 'CRYSTAL',
    high: 'BEST',
    combo: 'COMBO',
    wave: 'WAVE',
    power: 'POWER',
    bossBanner: '⚠ BOSS INCOMING',
    paused: 'PAUSED',
    resume: 'Press P or tap the top-right button',
    gameOver: 'GAME OVER',
    finalScore: 'Crystals {n}',
    reached: 'Reached wave {n}',
    best: 'Best {n}',
    restart: 'PRESS R TO RESTART',
    pickStage: 'WAVE {n} CLEAR',
    pickTitle: 'Choose an upgrade',
    pickHold: 'Hold',
    pickUnit: 'crystals',
    pickReroll: 'Reroll',
    pickConfirm: 'E Q U I P'
  }
};

let lang = store.get('stardrift_lang');
if (!STRINGS[lang]) lang = 'zh-Hant';

const t = (key, n) => n === undefined ? STRINGS[lang][key] : STRINGS[lang][key].replace('{n}', n);

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
