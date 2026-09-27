// 能力選擇 overlay(DOM,唔係畫喺 canvas)。
//
// 分工:狀態同規則喺 abilities.js,呢度淨係負責「顯示」同「收使用者嘅動作」。
// 所有 DOM 操作都守住 pickEl 存唔存在,咁 Node 測試(冇真 DOM)一樣行得。
//
// 畫面更新係「淨係改郁咗嗰части」:開畫面先整一次完整 HTML,之後撳卡、重抽
// 都只係改對應嗰張卡同頂部嘅錢,唔會成個 innerHTML 重建 —— 重建會閃一閃,似 reload。

const pickEl = document.getElementById('pick');

let pickOffers = [];      // 而家出緊嘅卡(ability id)
let pickChosen = null;    // 玩家撳咗邊張,未確認

function openPicker(slideIn = false) {
  game.state = 'picking';
  pickOffers = offerAbilities();
  pickChosen = null;
  renderPicker();
  if (pickEl) pickEl.classList.toggle('slide', slideIn);
}

function closePicker() {
  pickOffers = [];
  pickChosen = null;
  if (pickEl) pickEl.hidden = true;
  game.state = 'playing';
  startWave();
}

function choosePick(id) {
  pickChosen = pickChosen === id ? null : id;   // 撳多次可以取消
  syncSelection();
}

function confirmPick() {
  if (!pickChosen) return false;
  takeAbility(pickChosen);
  closePicker();
  return true;
}

function rerollAt(i) {
  if (!canAffordReroll()) return false;
  payReroll();
  const replacement = rerollOne(pickOffers, i);
  if (pickChosen === pickOffers[i]) pickChosen = null;
  pickOffers[i] = replacement;
  replaceCard(i);
  syncBank();
  syncSelection();
  return true;
}

// ---------- 畫面 ----------

const svgIcon = (path, color, size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" stroke="${color}"
        stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
     <path d="${path}"></path>
   </svg>`;

const rerollIcon = `
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M13 8 A5 5 0 1 1 11.5 4.5 M13 2 V5 H10"></path>
  </svg>`;

function cardInner(id, i) {
  const a = abilityById(id);
  const col = RARITY_COLOR[a.rarity];
  const next = abilityLevel(id) + 1;
  return `
    <button class="body" data-pick="${id}">
      <span class="pick-icon" style="color:${col}">${svgIcon(a.icon, col, 30)}</span>
      <span class="pick-info">
        <span><span class="pick-name">${abText(a, 'name')}</span>
          <span class="pick-lv" style="background:${col}">Lv${next}${a.max > 1 ? '/' + a.max : ''}</span></span>
        <span class="pick-tags"><span style="color:${col}">${rarityText(a.rarity)}</span>
          <span style="color:var(--muted)">${catText(a.cat)}</span></span>
        <span class="pick-desc">${abText(a, 'desc')}</span>
      </span>
    </button>
    <button class="pick-reroll" data-reroll="${i}" title="${t('pickReroll')}" aria-label="${t('pickReroll')}">
      ${rerollIcon}
    </button>`;
}

function renderPicker() {
  if (!pickEl) return;
  const owned = Object.keys(player.abilities);

  pickEl.innerHTML = `
    <div>
      <div class="pick-stage">${t('pickStage', game.wave)}</div>
      <div class="pick-title">${t('pickTitle')}</div>
    </div>

    <div class="pick-bank">
      <span>${t('pickHold')} <b data-bank>0</b> ${t('pickUnit')}</span>
      <span>${t('pickReroll')} <span class="cost" data-cost>0</span></span>
    </div>

    ${owned.length ? `<div class="pick-owned">${owned.map(id => {
      const a = abilityById(id);
      return `<span>${svgIcon(a.icon, RARITY_COLOR[a.rarity], 14)}${abText(a, 'name')}
                <b style="color:${RARITY_COLOR[a.rarity]}">Lv${player.abilities[id]}</b></span>`;
    }).join('')}</div>` : ''}

    <div class="pick-cards">
      ${pickOffers.map((id, i) => `<div class="pick-card" data-card="${i}">${cardInner(id, i)}</div>`).join('')}
    </div>

    <button class="pick-confirm" data-confirm disabled>${t('pickConfirm')}</button>
  `;
  pickEl.hidden = false;
  pickEl.scrollTop = 0;
  syncBank();
  syncSelection();
}

// 只換一張卡,唔郁其他嘢
function replaceCard(i) {
  if (!pickEl) return;
  const card = pickEl.querySelector(`[data-card="${i}"]`);
  if (card) card.innerHTML = cardInner(pickOffers[i], i);
}

// 更新錢同重抽價,順便決定啲重抽掣灰唔灰
function syncBank() {
  if (!pickEl) return;
  const poor = !canAffordReroll();
  pickEl.querySelector('[data-bank]').textContent = game.crystals;
  const cost = pickEl.querySelector('[data-cost]');
  cost.textContent = rerollCost();
  cost.classList.toggle('poor', poor);
  pickEl.querySelectorAll('[data-reroll]').forEach(b => { b.disabled = poor; });
}

// 更新「揀咗邊張」同確認掣
function syncSelection() {
  if (!pickEl) return;
  pickEl.querySelectorAll('[data-card]').forEach(card => {
    const id = card.querySelector('[data-pick]').dataset.pick;
    card.classList.toggle('on', id === pickChosen);
  });
  pickEl.querySelector('[data-confirm]').disabled = !pickChosen;
}

if (pickEl) {
  pickEl.addEventListener('click', e => {
    const card = e.target.closest('[data-pick]');
    const reroll = e.target.closest('[data-reroll]');
    const confirm = e.target.closest('[data-confirm]');
    if (reroll) rerollAt(+reroll.dataset.reroll);
    else if (card) choosePick(card.dataset.pick);
    else if (confirm) confirmPick();
  });
}
