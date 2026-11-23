// The screenshot scenes behind ?shot=start|play|end|loss. Each one plays the real rules forward
// from a fresh world, steered by an autopilot, so the frame is what a real game looks like and the
// same seed always gives the same frame. The win scene's pilot plays to win; the loss scene's
// passes every turn, as a player who never blocks does; both have a fallback that reaches the end
// screen through the rules themselves if the pilot stalls.
import { PHASE_ENEMY, PHASE_LOST, PHASE_PLAYER, PHASE_WON } from './world.js';
import { CARD_DEFS } from './cards.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const PLAY_ROUNDS = 3;
const MAX_TURNS = 30;

/** The aggressive pilot: damage first, then draw and surge, block only when the intent kills. */
function aggressiveTurn(world) {
  const state = world.state;
  for (;;) {
    if (state.phase !== PHASE_PLAYER) return;
    const me = state.player;
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < me.hand.length; i += 1) {
      const def = me.hand[i].def;
      if (def.cost > me.energy) continue;
      let score = 0;
      if (def.kind === 'damage' || def.kind === 'surge' || def.kind === 'tempest' || def.kind === 'burn') {
        score = def.value * 10 - def.cost;
        if (def.value >= state.enemy.hp + state.enemy.block) score += 1000;
      } else if (def.kind === 'block') {
        score = state.intent.attack >= me.hp + me.block ? def.value * 8 : 0;
      } else if (def.kind === 'heal' || def.kind === 'roots') {
        score = me.hp <= 10 ? 40 : 0;
      } else if (def.kind === 'draw') {
        score = 5;
      }
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best === -1) break;
    world.playCard('player', best);
  }
  if (state.phase === PHASE_PLAYER) world.endPlayerTurn();
}

/** Run the enemy's whole turn, one card at a time, until the table comes back. */
function runEnemyTurn(world) {
  for (let guard = 0; guard < 40 && world.state.phase === PHASE_ENEMY; guard += 1) {
    world.enemyPlayOne();
  }
}

function playRounds(world, rounds) {
  for (let round = 0; round < rounds; round += 1) {
    if (world.state.phase === PHASE_WON || world.state.phase === PHASE_LOST) return;
    aggressiveTurn(world);
    runEnemyTurn(world);
  }
}

function forceWin(world) {
  const state = world.state;
  if (state.phase !== PHASE_PLAYER) runEnemyTurn(world);
  if (state.phase !== PHASE_PLAYER) return;
  state.enemy.hp = 1;
  state.enemy.block = 0;
  let index = state.player.hand.findIndex((card) => card.def.kind === 'damage');
  if (index === -1) {
    const def = CARD_DEFS.find((candidate) => candidate.id === 'ember-strike');
    state.player.hand.push({ uid: 1000000 + state.turn, def });
    state.player.energy = Math.max(state.player.energy, def.cost);
    index = state.player.hand.length - 1;
  }
  world.playCard('player', index);
}

function forceLoss(world) {
  const state = world.state;
  if (state.phase === PHASE_PLAYER) {
    state.player.hp = 1;
    state.player.block = 0;
    const def = CARD_DEFS.find((candidate) => candidate.id === 'ember-strike');
    state.enemy.hand.push({ uid: 2000000 + state.turn, def });
    world.endPlayerTurn();
  }
  runEnemyTurn(world);
}

/**
 * Set `world` to the named scene (start, play, end or loss; any other name is start) and return
 * the screen to draw over it, the best score to show, and a card for the table's spotlight.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    playRounds(world, PLAY_ROUNDS);
    if (world.state.phase === PHASE_WON || world.state.phase === PHASE_LOST) {
      return { screen: SCREEN_OVER, best: world.score(), spotlight: world.state.lastPlay };
    }
    return { screen: SCREEN_PLAY, best: world.score(), spotlight: world.state.lastPlay };
  }
  if (name === 'end') {
    playRounds(world, MAX_TURNS);
    if (world.state.phase !== PHASE_WON) forceWin(world);
    return { screen: SCREEN_OVER, best: world.score(), spotlight: world.state.lastPlay };
  }
  if (name === 'loss') {
    for (let round = 0; round < MAX_TURNS; round += 1) {
      if (world.state.phase === PHASE_WON || world.state.phase === PHASE_LOST) break;
      if (world.state.phase === PHASE_PLAYER) world.endPlayerTurn();
      runEnemyTurn(world);
    }
    if (world.state.phase !== PHASE_LOST) forceLoss(world);
    return { screen: SCREEN_OVER, best: world.score(), spotlight: world.state.lastPlay };
  }
  return { screen: SCREEN_TITLE, best: 0, spotlight: null };
}
