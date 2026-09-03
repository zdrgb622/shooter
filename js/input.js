const keys = {};
const pointer = { x: null, y: null, down: false };

addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.code === 'KeyP' && game.state === 'playing') game.paused = !game.paused;
  if (e.code === 'KeyL' && game.state !== 'playing') cycleLang();
  if (game.state === 'title' && (e.code === 'Space' || e.code === 'Enter')) startRun();
  if (game.state === 'over' && (e.code === 'KeyR' || e.code === 'Space')) { newGame(); startRun(); }
});

addEventListener('keyup', e => keys[e.code] = false);

function toCanvas(e) {
  const r = cv.getBoundingClientRect();
  pointer.x = (e.clientX - r.left) / r.width * W;
  pointer.y = (e.clientY - r.top) / r.height * H;
}

const hitLangButton = () => langButtons.find(b =>
  pointer.x >= b.x && pointer.x <= b.x + b.w && pointer.y >= b.y && pointer.y <= b.y + b.h);

const hitPause = () => pauseActive() &&
  pointer.x >= pauseButton.x && pointer.x <= pauseButton.x + pauseButton.w &&
  pointer.y >= pauseButton.y && pointer.y <= pauseButton.y + pauseButton.h;

cv.addEventListener('pointerdown', e => {
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
  startWave();
}
