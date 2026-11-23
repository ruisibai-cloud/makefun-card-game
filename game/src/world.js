// The duel's rules and state, with no drawing and no browser in it: two duelists at 30 HP,
// hands of five, three embers a turn, block that fades at your next turn, smoulder that burns at
// the start of your next turn. The player plays cards, ends the turn, and the enemy plays one
// card per call to enemyPlayOne(), so the caller can pace its turn with animation. Every action
// returns the events it caused, so the caller can sound and log them without the world knowing
// about screens or sound.
import { ENERGY_PER_TURN, HAND_SIZE, SCORE, START_HP } from './config.js';
import { buildDeck, drawCards, shuffle } from './deck.js';
import { intentOf, planPlays } from './ai.js';

export const PHASE_PLAYER = 'player';
export const PHASE_ENEMY = 'enemy';
export const PHASE_WON = 'won';
export const PHASE_LOST = 'lost';

function freshSide() {
  return { hp: START_HP, block: 0, burn: 0, energy: ENERGY_PER_TURN, hand: [], drawPile: [], discard: [] };
}

export function createWorld(random) {
  const state = {
    phase: PHASE_PLAYER,
    turn: 1,
    player: freshSide(),
    enemy: freshSide(),
    intent: { text: 'Waiting…', kind: 'wait', attack: 0, block: 0 },
    log: [],
    damageDealt: 0,
    lastPlay: null,
  };

  function log(message) {
    state.log.push(message);
    if (state.log.length > 6) state.log.shift();
  }

  function dealDamage(target, amount, events, source) {
    const blocked = Math.min(target.block, amount);
    target.block -= blocked;
    const hurt = amount - blocked;
    target.hp -= hurt;
    if (hurt > 0) events.push({ type: 'damage', amount: hurt, side: target === state.player ? 'player' : 'enemy', source });
    if (target === state.enemy) state.damageDealt += hurt;
    return hurt;
  }

  function recomputeIntent() {
    state.intent = intentOf(state.enemy.hand, state.enemy.energy, state.enemy, state.player);
  }

  function checkEnd() {
    if (state.enemy.hp <= 0) {
      state.enemy.hp = 0;
      state.phase = PHASE_WON;
      log('The Ash Warden falls. Victory!');
    } else if (state.player.hp <= 0) {
      state.player.hp = 0;
      state.phase = PHASE_LOST;
      log('Your flame goes out. Defeat.');
    }
  }

  /** Smoulder burns at the start of a side's turn, through block, then clears. */
  function burnTick(side, events) {
    if (side.burn <= 0) return;
    const amount = side.burn;
    side.burn = 0;
    side.hp -= amount;
    events.push({ type: 'burn', amount, side: side === state.player ? 'player' : 'enemy' });
    if (side === state.enemy) state.damageDealt += amount;
    log(`${side === state.player ? 'You' : 'The Warden'} smoulder for ${amount}.`);
  }

  function startPlayerTurn() {
    const me = state.player;
    me.block = 0;
    const events = [];
    burnTick(me, events);
    checkEnd();
    if (state.phase === PHASE_LOST) return events;
    me.energy = ENERGY_PER_TURN;
    drawCards(me.hand, me.drawPile, me.discard, HAND_SIZE - me.hand.length, random);
    // The enemy's hand for its coming turn is drawn now, so its intent is real and readable.
    drawCards(state.enemy.hand, state.enemy.drawPile, state.enemy.discard, HAND_SIZE - state.enemy.hand.length, random);
    state.enemy.energy = ENERGY_PER_TURN;
    recomputeIntent();
    return events;
  }

  function reset() {
    state.phase = PHASE_PLAYER;
    state.turn = 1;
    state.player = freshSide();
    state.enemy = freshSide();
    state.log = [];
    state.damageDealt = 0;
    state.lastPlay = null;
    for (const side of [state.player, state.enemy]) {
      side.drawPile = buildDeck();
      shuffle(side.drawPile, random);
    }
    drawCards(state.player.hand, state.player.drawPile, state.player.discard, HAND_SIZE, random);
    drawCards(state.enemy.hand, state.enemy.drawPile, state.enemy.discard, HAND_SIZE, random);
    recomputeIntent();
    log('The duel begins. Play cards, then End Turn.');
  }

  function canPlay(side, index) {
    const who = side === 'player' ? state.player : state.enemy;
    if (state.phase !== (side === 'player' ? PHASE_PLAYER : PHASE_ENEMY)) return false;
    const card = who.hand[index];
    return card !== undefined && card.def.cost <= who.energy;
  }

  /**
   * Play one card from a side's hand. Returns the events it caused, or null when the play is
   * illegal (wrong phase, not enough embers, no such card).
   */
  function playCard(side, index) {
    if (!canPlay(side, index)) return null;
    const me = side === 'player' ? state.player : state.enemy;
    const foe = side === 'player' ? state.enemy : state.player;
    const [card] = me.hand.splice(index, 1);
    me.discard.push(card);
    me.energy -= card.def.cost;
    const def = card.def;
    const events = [{ type: 'play', side, card }];
    state.lastPlay = { side, card, turn: state.turn };
    log(`${side === 'player' ? 'You play' : 'The Warden plays'} ${def.name}.`);
    if (def.kind === 'damage' || def.kind === 'surge' || def.kind === 'tempest' || def.kind === 'burn') {
      dealDamage(foe, def.value, events, def.id);
    }
    if (def.kind === 'burn') {
      foe.burn += def.burn;
      events.push({ type: 'smoulder', amount: def.burn, side: side === 'player' ? 'enemy' : 'player' });
    }
    if (def.kind === 'surge') {
      me.energy += def.energy;
      events.push({ type: 'energy', amount: def.energy, side });
    }
    if (def.kind === 'block') {
      me.block += def.value;
      events.push({ type: 'block', amount: def.value, side });
    }
    if (def.kind === 'heal' || def.kind === 'roots') {
      const healed = Math.min(def.value, START_HP - me.hp);
      me.hp += healed;
      events.push({ type: 'heal', amount: healed, side });
    }
    if (def.kind === 'draw' || def.kind === 'roots' || def.kind === 'tempest') {
      const drew = drawCards(me.hand, me.drawPile, me.discard, def.draw ?? def.value, random);
      events.push({ type: 'draw', amount: drew, side });
    }
    checkEnd();
    if (state.phase === PHASE_PLAYER) recomputeIntent();
    return events;
  }

  /** The player ends the turn: their hand is discarded and the enemy's turn begins. */
  function endPlayerTurn() {
    if (state.phase !== PHASE_PLAYER) return [];
    const me = state.player;
    while (me.hand.length > 0) me.discard.push(me.hand.pop());
    state.phase = PHASE_ENEMY;
    const foe = state.enemy;
    foe.block = 0;
    const events = [];
    burnTick(foe, events);
    checkEnd();
    if (state.phase === PHASE_ENEMY) {
      foe.energy = ENERGY_PER_TURN;
      log('The Warden takes the table.');
    }
    return events;
  }

  /**
   * One step of the enemy's turn: play its best card, or, with nothing worth playing, discard
   * its hand and hand the table back. Returns { done, played, events }.
   */
  function enemyPlayOne() {
    if (state.phase !== PHASE_ENEMY) return { done: true, played: null, events: [] };
    const plays = planPlays(state.enemy.hand, state.enemy.energy, state.enemy, state.player);
    if (plays.length === 0) {
      const foe = state.enemy;
      while (foe.hand.length > 0) foe.discard.push(foe.hand.pop());
      state.turn += 1;
      state.phase = PHASE_PLAYER;
      const events = startPlayerTurn();
      log(`Turn ${state.turn}. Your move.`);
      return { done: true, played: null, events };
    }
    const events = playCard('enemy', plays[0]);
    if (state.phase === PHASE_LOST) return { done: true, played: state.lastPlay?.card ?? null, events };
    return { done: false, played: state.lastPlay?.card ?? null, events };
  }

  function score() {
    return state.damageDealt + state.player.hp * SCORE.perHp + (state.phase === PHASE_WON ? SCORE.winBonus : 0);
  }

  reset();
  return { state, reset, canPlay, playCard, endPlayerTurn, enemyPlayOne, startPlayerTurn, recomputeIntent, score };
}
