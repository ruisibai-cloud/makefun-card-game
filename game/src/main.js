// Boot and the one loop: input is read every frame, the enemy's turn is paced one card at a
// time so it reads, and the renderer paints what is there. The game moves between four screens:
// title, play, paused and game over.
//
// ?seed=N fixes the deal. ?shot=start|play|end|loss (with &seed=N) stages that scene instead of
// running the loop, paints it until the cards settle and sets window.__shotReady.
import { BEST_KEY, ENEMY_PLAY_DELAY, PALETTE } from './config.js';
import { createRandom } from './random.js';
import { createWorld, PHASE_ENEMY, PHASE_LOST, PHASE_PLAYER, PHASE_WON } from './world.js';
import { ACTION_CONFIRM, ACTION_END, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const ui = { time: 0, hover: -1, score: world.score() };
  if (scene.spotlight) renderer.spotlightCard(scene.spotlight.card, scene.spotlight.side, 0);
  let painted = 0;
  function paint() {
    ui.time = painted * 16;
    renderer.draw(world.state, scene.screen, scene.best, ui);
    painted += 1;
    if (painted < 45) requestAnimationFrame(paint);
    else {
      window.__handRects = renderer.handRects();
      window.__shotReady = true;
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let hover = -1;
  let mouse = null;
  let enemyTimer = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  /** Turn the world's events into sound, floaters and the spotlight. */
  function handleEvents(events, now) {
    for (const event of events) {
      if (event.type === 'play') {
        audio.playCard();
        renderer.spotlightCard(event.card, event.side, now);
      } else if (event.type === 'damage') {
        audio.hit();
        const target = event.side === 'player' ? { x: 190, y: 460 } : { x: 336, y: 84 };
        renderer.floater(`-${event.amount}`, target.x, target.y, PALETTE.hp, now);
      } else if (event.type === 'burn') {
        const target = event.side === 'player' ? { x: 190, y: 460 } : { x: 336, y: 84 };
        renderer.floater(`-${event.amount} smoulder`, target.x, target.y, PALETTE.ember, now);
      } else if (event.type === 'block') {
        audio.block();
        const target = event.side === 'player' ? { x: 190, y: 460 } : { x: 336, y: 84 };
        renderer.floater(`+${event.amount} block`, target.x, target.y, PALETTE.block, now);
      } else if (event.type === 'heal' && event.amount > 0) {
        audio.heal();
        const target = event.side === 'player' ? { x: 190, y: 460 } : { x: 336, y: 84 };
        renderer.floater(`+${event.amount}`, target.x, target.y, PALETTE.sprout, now);
      } else if (event.type === 'draw' && event.amount > 0) {
        audio.draw();
      }
    }
    if (world.state.phase === PHASE_WON || world.state.phase === PHASE_LOST) {
      const won = world.state.phase === PHASE_WON;
      const finalScore = world.score();
      if (finalScore > best) {
        best = finalScore;
        saveBest(best);
      }
      screen = SCREEN_OVER;
      if (won) audio.win();
      else audio.lose();
      announce(won ? `Victory. Score ${finalScore}.` : `Defeat. Score ${finalScore}.`);
    }
  }

  function startGame() {
    world.reset();
    renderer.resetFx();
    enemyTimer = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Your turn.');
  }

  function tryPlay(index, now) {
    if (screen !== SCREEN_PLAY || world.state.phase !== PHASE_PLAYER) return;
    const events = world.playCard('player', index);
    if (events) handleEvents(events, now);
  }

  function tryEndTurn(now) {
    if (screen !== SCREEN_PLAY || world.state.phase !== PHASE_PLAYER) return;
    enemyTimer = 0;
    handleEvents(world.endPlayerTurn(), now);
    announce("The Warden's turn.");
  }

  function handleActions(now) {
    const { flags, plays, clicks } = input.takeActions();
    if (flags || plays.length > 0 || clicks.length > 0) audio.unlock();
    if (flags & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (flags & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
      return;
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      if (flags & ACTION_CONFIRM || clicks.length > 0) startGame();
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    for (const index of plays) tryPlay(index, now);
    if (flags & ACTION_END) tryEndTurn(now);
    for (const click of clicks) {
      const point = renderer.toTable(click.x, click.y);
      const end = renderer.endTurnRect();
      if (end && point.x >= end.x && point.x <= end.x + end.w && point.y >= end.y && point.y <= end.y + end.h) {
        tryEndTurn(now);
        continue;
      }
      const rects = renderer.handRects();
      for (const rect of rects) {
        if (point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h) {
          tryPlay(rect.index, now);
          break;
        }
      }
    }
  }

  canvas.addEventListener('pointermove', (event) => {
    mouse = renderer.toTable(event.clientX, event.clientY);
  });
  canvas.addEventListener('pointerleave', () => {
    mouse = null;
    hover = -1;
  });

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    handleActions(now);
    // The enemy plays one card per beat, so its turn reads instead of flashing past.
    if (screen === SCREEN_PLAY && world.state.phase === PHASE_ENEMY) {
      enemyTimer += dt;
      if (enemyTimer >= ENEMY_PLAY_DELAY) {
        enemyTimer = 0;
        const result = world.enemyPlayOne();
        handleEvents(result.events, now);
        if (result.done && world.state.phase === PHASE_PLAYER) {
          announce(`Turn ${world.state.turn}. Your move.`);
        }
      }
    }
    // Hover follows the mouse over the hand.
    hover = -1;
    if (mouse && screen === SCREEN_PLAY) {
      for (const rect of renderer.handRects()) {
        if (mouse.x >= rect.x && mouse.x <= rect.x + rect.w && mouse.y >= rect.y && mouse.y <= rect.y + rect.h) {
          hover = rect.index;
          break;
        }
      }
    }
    renderer.draw(world.state, screen, best, { time: now, hover, score: world.score() });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberfall Duel. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
