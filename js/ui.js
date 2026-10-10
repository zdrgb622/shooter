// 能力選擇 overlay(DOM,唔係畫喺 canvas)。
//
// 分工:狀態同規則喺 abilities.js,呢度淨係負責「顯示」同「收使用者嘅動作」。
// 所有 DOM 操作都守住 pickEl 存唔存在,咁 Node 測試(冇真 DOM)一樣行得。
//
// 畫面更新係「淨係改郁咗嗰部分」:開畫面先整一次完整 HTML,之後撳卡、重抽
// 都只係改對應嗰張卡同頂部嘅錢,唔會成個 innerHTML 重建 —— 重建會閃一閃,似 reload。

const pickEl = document.getElementById('pick');

let pickOffers = [];      // 而家出緊嘅卡(ability id)

function openPicker(slideIn = false) {
  game.state = 'picking';
  // 場上剩低嘅敵彈唔可以留到揀完先至飛埋嚟 —— 玩家一返到遊戲就食彈,
  // 完全避唔到。用旗唔直接清,因為呢度可能係喺 update() 行緊 loop 嗰陣被叫。
  game.clearShots = true;
  pickOffers = offerAbilities();
  renderPicker();
  if (pickEl) pickEl.classList.toggle('slide', slideIn);
}

function closePicker() {
  pickOffers = [];
  if (pickEl) pickEl.hidden = true;
  game.state = 'playing';
  startWave();
}

// 撳一下就即裝,冇「揀 → 確認」兩步。
// 隻 game 要做到可以放空個腦玩(見 NOTES D1),唔想為咗一張卡要停低嚟諗同再撳多一次。
// 代價:撳錯就冇得回頭。重抽掣係另一粒掣,所以唔會撳重抽嗰陣誤裝。
function choosePick(id) {
  if (!pickOffers.includes(id)) return false;
  takeAbility(id);
  closePicker();
  return true;
}

function rerollAt(i) {
  if (!canAffordReroll()) return false;
  payReroll();
  pickOffers[i] = rerollOne(pickOffers, i);
  replaceCard(i);
  syncBank();
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
  `;
  pickEl.hidden = false;
  pickEl.scrollTop = 0;
  syncBank();
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

if (pickEl) {
  pickEl.addEventListener('click', e => {
    const card = e.target.closest('[data-pick]');
    const reroll = e.target.closest('[data-reroll]');
    if (reroll) rerollAt(+reroll.dataset.reroll);          // 重抽掣要行先,佢喺卡入面
    else if (card) choosePick(card.dataset.pick);
  });
}
