let last = performance.now();

requestAnimationFrame(function frame(now) {
  const dt = Math.min((now - last) / 1000, .05);
  last = now;
  pollGamepad();
  update(dt);
  draw();
  requestAnimationFrame(frame);
});
