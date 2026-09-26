// 能力系統。
//
// 分三層,故意分開:
//   1. ABILITIES  —— 能力表。加新能力 = 加一行,包埋佢自己嘅三語文字,唔使去 i18n.js 加
//   2. 出現規則   —— 邊幾個會出現喺卡片度(稀有度權重、已滿級唔再出)
//   3. 經濟       —— 重抽價錢
// 呢個機制之後會重新設計,所以規則同能力表要分得開,換規則唔使郁能力。

const RARITY_COLOR = { '普通': '#A9B3D6', '稀有': '#4FD1C5', '傳說': '#F2C94C' };

// ⚠️ 臨時:稀有度出現權重仲未設計(唔應該只係三個數字,見 NOTES G1)。
// 而家用最簡單嘅固定權重頂住,方便之後整個換走。
const RARITY_WEIGHT = { '普通': 60, '稀有': 30, '傳說': 10 };

const REROLL_COST = 300;        // 重抽一張要幾多晶體
const REROLL_COST_STEP = 0;     // 每抽一次加幾多(0 = 唔遞增)
const OFFER_COUNT = 3;          // 一次出幾多張卡

// icon 係 32×32 viewBox 嘅 SVG path,直接來自設計圖
const ABILITIES = [
  {
    id: 'spread', cat: '攻擊', rarity: '普通', max: 3,
    name: { 'zh-Hant': '散射砲', 'zh-Hans': '散射炮', en: 'Spread Cannon' },
    desc: {
      'zh-Hant': '子彈變成扇形,每級多一發。',
      'zh-Hans': '子弹变成扇形,每级多一发。',
      en: 'Fires a wider fan. One more bullet per level.',
    },
    icon: 'M16 28 V6 M16 28 L7 8 M16 28 L25 8',
    apply: () => { player.level = Math.min(5, player.level + 1); },
  },
  {
    id: 'rapid', cat: '攻擊', rarity: '普通', max: 3,
    name: { 'zh-Hant': '加速槍機', 'zh-Hans': '加速枪机', en: 'Rapid Loader' },
    desc: {
      'zh-Hant': '每級射速加快 12%。',
      'zh-Hans': '每级射速加快 12%。',
      en: 'Fire 12% faster per level.',
    },
    icon: 'M6 26 L16 6 L26 26 M11 20 H21',
    apply: () => { player.fireRateMult *= .88; },
  },
  {
    id: 'thrust', cat: '輔助', rarity: '普通', max: 3,
    name: { 'zh-Hant': '推進器', 'zh-Hans': '推进器', en: 'Thrusters' },
    desc: {
      'zh-Hant': '每級移動速度加快 12%。',
      'zh-Hans': '每级移动速度加快 12%。',
      en: 'Move 12% faster per level.',
    },
    icon: 'M6 12 H20 M10 20 H24 M20 6 L28 12 L20 18',
    apply: () => { player.speed = Math.round(player.speed * 1.12); },
  },
  {
    id: 'shield', cat: '防禦', rarity: '普通', max: 3,
    name: { 'zh-Hant': '能量護盾', 'zh-Hans': '能量护盾', en: 'Energy Shield' },
    desc: {
      'zh-Hant': '即刻加一層護盾,可以擋一次傷害。',
      'zh-Hans': '即刻加一层护盾,可以挡一次伤害。',
      en: 'Adds one shield layer that blocks a hit.',
    },
    icon: 'M16 3 L27 9.5 V22.5 L16 29 L5 22.5 V9.5 Z M16 9 L22 12.5 V19.5 L16 23 L10 19.5 V12.5 Z',
    apply: () => { player.shield++; },
  },
  {
    id: 'magnet', cat: '輔助', rarity: '稀有', max: 2,
    name: { 'zh-Hant': '磁吸', 'zh-Hans': '磁吸', en: 'Magnet' },
    desc: {
      'zh-Hant': '大幅擴大執道具嘅範圍。',
      'zh-Hans': '大幅扩大捡道具的范围。',
      en: 'Greatly widens the pickup radius.',
    },
    icon: 'M8 6 V17 A8 8 0 0 0 24 17 V6 M8 11 H13 M19 11 H24',
    apply: () => { player.magnet += 45; },
  },
  {
    id: 'life', cat: '防禦', rarity: '傳說', max: 1,
    name: { 'zh-Hant': '額外生命', 'zh-Hans': '额外生命', en: 'Extra Life' },
    desc: {
      'zh-Hant': '即刻 +1 條命,每局只可以揀一次。',
      'zh-Hans': '即刻 +1 条命,每局只可以拣一次。',
      en: 'Gain one life. Once per run.',
    },
    icon: 'M16 27 L5 16 A6 6 0 0 1 16 8 A6 6 0 0 1 27 16 Z',
    apply: () => { player.lives++; },
  },
];

const RARITY_NAME = {
  '普通': { 'zh-Hant': '普通', 'zh-Hans': '普通', en: 'Common' },
  '稀有': { 'zh-Hant': '稀有', 'zh-Hans': '稀有', en: 'Rare' },
  '傳說': { 'zh-Hant': '傳說', 'zh-Hans': '传说', en: 'Legendary' },
};
const CAT_NAME = {
  '攻擊': { 'zh-Hant': '攻擊', 'zh-Hans': '攻击', en: 'Attack' },
  '防禦': { 'zh-Hant': '防禦', 'zh-Hans': '防御', en: 'Defence' },
  '輔助': { 'zh-Hant': '輔助', 'zh-Hans': '辅助', en: 'Support' },
};
const rarityText = r => RARITY_NAME[r][lang] || r;
const catText = c => CAT_NAME[c][lang] || c;

const abilityById = id => ABILITIES.find(a => a.id === id);

// 能力自己帶三語文字,所以攞文字唔使經 i18n.js 個大表
const abText = (ability, field) => ability[field][lang] || ability[field]['zh-Hant'];

const abilityLevel = id => player.abilities[id] || 0;
const abilityMaxed = a => abilityLevel(a.id) >= a.max;

// ---------- 出現規則(將來要換嘅就係呢一段) ----------

function offerAbilities(n = OFFER_COUNT) {
  const pool = ABILITIES.filter(a => !abilityMaxed(a));
  const picked = [];
  while (picked.length < n && picked.length < pool.length) {
    const left = pool.filter(a => !picked.includes(a));
    const total = left.reduce((sum, a) => sum + RARITY_WEIGHT[a.rarity], 0);
    let roll = Math.random() * total;
    const hit = left.find(a => (roll -= RARITY_WEIGHT[a.rarity]) <= 0) || left[left.length - 1];
    picked.push(hit);
  }
  return picked.map(a => a.id);
}

// 換走某一張,唔會換到已經喺場嘅其他卡
function rerollOne(offers, index) {
  const pool = ABILITIES.filter(a => !abilityMaxed(a) && !offers.includes(a.id));
  if (!pool.length) return offers[index];
  const total = pool.reduce((sum, a) => sum + RARITY_WEIGHT[a.rarity], 0);
  let roll = Math.random() * total;
  const hit = pool.find(a => (roll -= RARITY_WEIGHT[a.rarity]) <= 0) || pool[pool.length - 1];
  return hit.id;
}

// ---------- 經濟 ----------

const rerollCost = () => REROLL_COST + (game.rerolls || 0) * REROLL_COST_STEP;
const canAffordReroll = () => game.crystals >= rerollCost();

function payReroll() {
  if (!canAffordReroll()) return false;
  game.crystals -= rerollCost();
  game.rerolls = (game.rerolls || 0) + 1;
  return true;
}

// ---------- 拎能力 ----------

function takeAbility(id) {
  const a = abilityById(id);
  if (!a || abilityMaxed(a)) return false;
  player.abilities[id] = abilityLevel(id) + 1;
  a.apply(player.abilities[id]);
  return true;
}
