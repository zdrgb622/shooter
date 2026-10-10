const keys = {};
const pointer = { x: null, y: null, down: false };

addEventListener('keydown', e => {  // add event to the handler
  inputMode = 'key';            // 撳過鍵盤 = 有鍵盤,標題畫面就講鍵盤嘅操作
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();  // only when button is pressed will preventDefault()
  keys[e.code] = true;
  if ((e.code === 'KeyP' || e.code === 'Escape') && game.state === 'playing') game.paused = !game.paused;
  if (e.code === 'KeyL' && game.state !== 'playing') cycleLang();
  if (game.state === 'title' && (e.code === 'Space' || e.code === 'Enter')) startRun();
  if (game.state === 'over' && (e.code === 'KeyR' || e.code === 'Space')) { newGame(); startRun(); }
});

addEventListener('keyup', e => keys[e.code] = false);

function toCanvas(e) {
  const r = cv.getBoundingClientRect(); // return canvas(cv from core.js) information
  pointer.x = (e.clientX - r.left) / r.width * W; // W is the width of canvas/ r.width is the actrual showing width of canvas
  pointer.y = (e.clientY - r.top) / r.height * H;
}

const hitLangButton = () => langButtons.find(b =>
  pointer.x >= b.x && pointer.x <= b.x + b.w && pointer.y >= b.y && pointer.y <= b.y + b.h);

// 撳得到嘅範圍比畫出嚟嘅框四邊各闊 PAUSE_PAD,手機上先夠大隻手指撳
const hitPause = () => pauseActive() &&
  pointer.x >= pauseButton.x - PAUSE_PAD && pointer.x <= pauseButton.x + pauseButton.w + PAUSE_PAD &&
  pointer.y >= pauseButton.y - PAUSE_PAD && pointer.y <= pauseButton.y + pauseButton.h + PAUSE_PAD;

cv.addEventListener('pointerdown', e => {
  // 只有真係手指撳才當 touch。滑鼠唔算 —— 用滑鼠嘅人有鍵盤,照講鍵盤嘅操作
  if (e.pointerType === 'touch') inputMode = 'touch';
  cv.setPointerCapture(e.pointerId);
  pointer.down = true;
  toCanvas(e);

  // 要喺 playing 嘅 early return 之前處理,而且一定要放低 pointer.down ——
  // 否則 updatePlayer 會見到 pointer.down 而令戰機飛去手指位置同時開火
  if (hitPause()) {
    game.paused = !game.paused;
    pointer.down = false;
    return;
  }
  if (game.state === 'playing') return;

  const btn = hitLangButton();
  if (btn) { setLang(btn.code); return; }
  if (game.state === 'title') startRun();
  else { newGame(); startRun(); }
});
cv.addEventListener('pointermove', toCanvas);
cv.addEventListener('pointerup', () => { pointer.down = false; });

function startRun() {
  game.state = 'playing';
  game.wave = START_WAVE - 1;   // startWave() 會 +1
  startWave();
}

// ---------- 手掣 ----------
// Gamepad API 冇 event 話你知搖桿郁咗,要每幀自己去讀(輪詢),所以由 main.js 每幀叫 pollGamepad()
const PAD_DEADZONE = .2;   // 搖桿就算冇掂都會有少少漂移,細過呢個當 0
const pad = { x: 0, y: 0, fire: false };
let padPrev = { start: false, a: false };

function pollGamepad() {
  const gp = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(g => g && g.connected);
  if (!gp) { pad.x = pad.y = 0; pad.fire = false; return; }

  const btn = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
  const mag = Math.hypot(x, y);
  if (mag < PAD_DEADZONE) {
    x = y = 0;
  } else {
    // 死區以外重新由 0 開始計,推一半就係一半速度,唔會一過死區就跳去 20%
    const m = Math.min(1, (mag - PAD_DEADZONE) / (1 - PAD_DEADZONE));
    x = x / mag * m; y = y / mag * m;
  }
  if (btn(14)) x = -1;  // 十字鍵(標準 mapping 12 上、13 下、14 左、15 右)
  if (btn(15)) x = 1;
  if (btn(12)) y = -1;
  if (btn(13)) y = 1;
  pad.x = x; pad.y = y;

  const a = btn(0), start = btn(9);
  pad.fire = a || btn(7);  // A 或者 RT
  if (x || y || a || start || pad.fire) inputMode = 'pad';

  // 只認「啱啱撳落」嗰一下,唔係「撳住」—— 否則死嗰陣撳住 A 開火,會即刻重新開始
  if (start && !padPrev.start) {
    if (game.state === 'playing') game.paused = !game.paused;
    else if (game.state === 'title') startRun();
    else { newGame(); startRun(); }
  } else if (a && !padPrev.a && game.state !== 'playing') {
    if (game.state === 'title') startRun();
    else { newGame(); startRun(); }
  }
  padPrev = { start, a };
}

// ---------- 移動意圖 ----------
// 所有輸入方式都只係交一個「想去邊個方向、幾大力」出嚟,真正速度一律係 player.speed 乘佢,
// 所以「跑快啲」能力改 player.speed 會對所有輸入同時生效。
// 鍵盤同手掣長度最多 1;手指 / 滑鼠最多 POINTER_SPEED_MULT,
// 因為要追住隻手指,用 1 會覺得戰機拖拖拉拉。要調手感就改呢個數。
const POINTER_SPEED_MULT = 1.5;

function moveIntent(p, dt) {
  let x = 0, y = 0;
  if (keys.ArrowLeft || keys.KeyA) x--;
  if (keys.ArrowRight || keys.KeyD) x++;
  if (keys.ArrowUp || keys.KeyW) y--;
  if (keys.ArrowDown || keys.KeyS) y++;
  if (!x && !y) { x = pad.x; y = pad.y; }

  if (x || y) {
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  if (pointer.down && pointer.x !== null) {
    const dx = pointer.x - p.x, dy = pointer.y - 26 - p.y;
    const d = Math.hypot(dx, dy);
    if (d < .1) return { x: 0, y: 0 };
    // 就快到手指嗰陣行少啲,啱啱好停喺手指位,唔會衝過龍再兜返轉頭
    const m = Math.min(POINTER_SPEED_MULT, d / (p.speed * dt));
    return { x: dx / d * m, y: dy / d * m };
  }
  return { x: 0, y: 0 };
}

const wantsFire = () => keys.Space || pointer.down || pad.fire;
