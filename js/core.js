const cv = document.getElementById('game'); // get element game(html canvas)
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;

const rand = (a, b) => a + Math.random() * (b - a); // generate a random number from [a, b)
const clamp = (v, a, b) => v < a ? a : v > b ? b : v; // ensure the v are only in [a to b]
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

const PU = {  // power up
  power: { c: '#ffd35c', t: 'P' },
  shield: { c: '#6cc8ff', t: 'S' },
  life: { c: '#ff7ba8', t: '♥' }
};

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },  // get localstorage value value k
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }  // set a localstorage value k
};

let player, bullets, ebullets, enemies, powerups, particles, game;
let highScore = +(store.get('stardrift_high') || 0);

function newGame() {  // set up a new game or restart
  player = { x: W / 2, y: H - 110, r: 13, speed: 440, cool: 0, level: 1, lives: 3, shield: 0, inv: 2 };
  bullets = []; ebullets = []; enemies = []; powerups = []; particles = [];
  game = { state: 'title', paused: false, score: 0, wave: 0, queue: [], waveTime: 0, gap: 0,
           bannerBoss: false, bannerT: 0, shake: 0, clearShots: false };
}
newGame();

const stars = [];
for (let i = 0; i < 100; i++) { // background star
  const layer = i % 3;
  stars.push({ x: rand(0, W), y: rand(0, H), z: layer, v: 100 + layer * 45, s: .6 + layer * .7 });
}

function explode(x, y, color, n, spread = 260) {  // explosion in (x, y)
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = 400;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                     life: rand(.25, .5), max: .8, size: rand(.6, 10), color });
  }
}

const shake = n => game.shake = Math.max(game.shake, n);
