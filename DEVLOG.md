# Devlog

Problems hit while building this game, and how each one was tracked down.
Written after the fact, but the investigation order is the real one.

---

## An intermittent crash that only showed up after wave 5

### Symptom

```
Uncaught TypeError: can't access property "x", b is undefined
```

Thrown from `updateBullets()` in `js/entities.js`, on the line right after the
enemy bullet is read out of the array.

The awkward part was reproducing it. Getting hit in the first minute never
crashed. Losing every life in the first minute never crashed. But somewhere
around wave 5 it started happening regularly. That made it look
time-dependent, which turned out to be the wrong lead.

### Investigation

A `console.log` went in at the top of the loop, printing the loop index, the
array length, the bullet being read, and the player's remaining lives and
shield. Three consecutive lines from a real crash:

| Where | `i` | `len` | `b` | `lives` |
|---|---|---|---|---|
| loop iteration | 5 | 6 | object | 2 |
| after splice, before `hitPlayer()` | 5 | 5 | undefined | 2 |
| next loop iteration | 4 | **0** | undefined | **1** |

`len` dropping from 5 to 0 between two iterations was the answer. Nothing in
the loop empties the array, but `hitPlayer()` did, and the loop calls it.

### Root cause

`updateBullets()` walks `ebullets` backwards. When a bullet hits the player it
splices that bullet out and calls `hitPlayer()`, which cleared every remaining
enemy bullet so the player does not respawn into a wall of them:

```js
// hitPlayer(), before
ebullets.length = 0;
```

So the loop was emptying the array it was still iterating. On the next
iteration `ebullets[i]` no longer existed, and reading `.x` off `undefined`
threw.

### Why it was intermittent

The loop counts down from `len - 1` to `0`. If the bullet that lands the hit
happens to sit at **index 0**, the array is emptied on the final iteration:
`i--` makes it `-1`, the loop condition fails, and it exits cleanly. Every
other index has at least one iteration left, and crashes.

So the crash probability is roughly `(n - 1) / n`, where `n` is the number of
enemy bullets alive at that moment:

| Enemy bullets on screen | Crash odds |
|---|---|
| 1 | 0% |
| 2 | 50% |
| 6 | 83% |
| 12 | 92% |
| 24 | 96% |

That is what made it look time-dependent. No enemy fires before wave 3, waves
3 and 4 usually have one or two bullets in flight, and the boss that arrives at
wave 5 opens with a 14 to 24 bullet radial spread. The variable was never
elapsed time. It was bullet count.

Three other paths never crash, which explains the rest of the noise in the
early reports: taking the hit on a shield returns before the clear, losing the
last life takes a different branch that does not clear, and colliding with an
enemy body calls `hitPlayer()` from the loop over `enemies`, which does not
care what happens to `ebullets`.

### Fix

Two options worked.

Adding `break` after `hitPlayer()` stops the loop before it can read a stale
index. It is correct in all three branches and it is one word. What it is not
is self-explanatory: the loop has to *know* that `hitPlayer()` empties the
array, and that knowledge lives nowhere in the code. The next loop over
`ebullets` written by anyone re-arms the same trap.

The one that shipped removes the hazard instead of stepping around it.
`hitPlayer()` no longer touches the array. It raises a flag, and `update()`
clears the array once every step has finished:

```js
// hitPlayer(), after
game.clearShots = true;

// end of update(), after every step has run
if (game.clearShots) { ebullets.length = 0; game.clearShots = false; }
```

Now the clear provably happens with no loop in progress, so any future loop
over `ebullets` is safe by construction.

### Verification

`requestAnimationFrame` is paused in a background tab, which makes
timing-based tests unreliable. Instead the test drives `update(1/60)` by hand
for 60 frames, which is fully deterministic and exercises exactly the loop that
failed.

A control run came first: temporarily restoring the old immediate clear
reproduced the identical error at 6, 12 and 24 bullets. That proved the test
could actually detect the bug rather than passing for free. The shipped version
then ran clean across the same three cases, with the shield and game-over
branches confirmed unchanged.

---

## A blank canvas with nothing in the console

The page loaded, the title never drew, and the console was empty. An empty
console usually means "nothing ran", not "nothing went wrong".

The high score is read at the top of `js/core.js`:

```js
let highScore = +(localStorage.getItem('stardrift_high') || 0);
```

That page was being served from a `data:` URL, which is an opaque origin. On an
opaque origin `localStorage` does not return `null`. The property access itself
throws `SecurityError`. The throw happened at the top of a plain script, so
every function below it was never defined, and the rest of the page had nothing
to run.

Storage access is now wrapped, so a hostile origin degrades to "no saved score"
instead of taking the whole script down:

```js
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};
```

Worth remembering: browser storage can throw rather than return empty, and a
throw at the top level of a script silently deletes everything after it.

---

## Switching language left stale text on screen

Adding Traditional Chinese, Simplified Chinese and English worked everywhere
except the wave banner, which kept whatever language was active when the wave
started.

The banner was being stored already translated:

```js
game.banner = 'WAVE ' + game.wave;
```

Once that string is in state, changing language cannot reach it. The fix was to
store the *fact* and translate at draw time:

```js
game.bannerBoss = game.wave % 5 === 0;
```

The renderer decides the wording every frame, so a language change is visible
immediately, mid-wave included. Same rule anywhere state and presentation get
mixed: keep the fact, render the words.

---

## A frozen game that was not a bug

While testing, the game appeared to stop dead. The loop was running, the state
said `playing`, but nothing moved and no error appeared.

`document.visibilityState` was `hidden`. Browsers pause
`requestAnimationFrame` in background tabs on purpose, to save power. The game
was behaving exactly as it should.

No code changed. What changed was the test method: anything timing-sensitive
now either runs in a foregrounded tab, or bypasses the frame loop entirely by
calling `update()` directly. Worth writing down, because "no error, nothing
happens" is a very easy thing to start patching around.

---

## git push rejected before it ever asked for credentials

The first push failed with two lines that point in different directions:

```
git: 'credential-manager-core' is not a git command.
remote: Invalid username or token. Password authentication is not supported.
```

The second line looks like an auth problem. The first one is the real cause.

`git config --show-origin --get-all credential.helper` showed two entries: the
system config correctly set `manager`, while the user config still set
`manager-core`, the name Git Credential Manager used before it was renamed.
That helper does not exist any more, so it errored out and the push fell
through to an unauthenticated attempt.

`git-credential-manager.exe` was present in the Git installation the whole
time. Removing the stale user-level entry let the correct system-level helper
take over, and the push went through on the next try.

---

## Dragging the ship was 12x faster than the keyboard

Keyboard movement used a fixed speed of 330 px/s. Dragging with a finger or
mouse used a different rule: each frame the ship closed a fixed fraction of the
gap to the pointer.

```js
p.x += (pointer.x - p.x) * Math.min(1, dt * 14);
```

That feels smooth, but it has no speed limit. The further the pointer, the
faster the ship. Simulated at 60 fps across 300 px:

| Input | Time | Peak speed |
|---|---|---|
| Keyboard | 0.91 s | 330 px/s |
| Finger / mouse | 0.32 s | 4200 px/s |

It first showed up as "the phone version is easier", but the real split was
pointer versus keyboard. A mouse on desktop had the same advantage.

It also would have broken a planned "move faster" upgrade: the drag path
never read the player's speed stat, so raising it would have done nothing for
anyone playing by touch.

### Fix

Every input now only reports an *intent*: a direction with a length from 0 to 1.
One line turns intent into motion, using the same speed for everyone:

```js
const move = moveIntent(p, dt);
p.x += move.x * p.speed * dt;
p.y += move.y * p.speed * dt;
```

For the pointer, the intent shrinks as the ship gets within one frame of the
finger, so it lands exactly on the target instead of overshooting and
oscillating. Gamepad support went through the same function, so an analogue
stick pushed halfway moves at half speed, and adding it needed no new speed
rules.

### Verification

Driving `updatePlayer()` frame by frame across the same 300 px: keyboard,
pointer and a fully pushed stick all take 0.92 s at a peak of 330 px/s. A
half-pushed stick peaks at 165 px/s, diagonal keyboard movement stays at
330 px/s, and the pointer stops within 0 px of its target.

---

## Smaller fixes

- **Boss health bar overlapped the HUD.** It was drawn at the same height as
  the high-score text. Moved below the HUD row.
- **Boss rendered solid white under sustained fire.** The hit flash replaced
  the fill colour outright, and continuous hits meant it never reverted.
  Changed to a translucent white overlay so the base colour stays visible.
- **Cross-file "go to definition" did not work.** The files are plain scripts
  sharing globals rather than ES modules, and the editor had no project root to
  anchor them to. A `jsconfig.json` at the repo root fixes it, and travels with
  the repo instead of living in one machine's settings.
