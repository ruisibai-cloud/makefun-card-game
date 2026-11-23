// The Ash Warden's brain: a greedy planner with readable intent. planPlays() scores every
// affordable card in the enemy hand and returns the plays in order; intentOf() summarises the
// plan so the player can read what is coming and counter it (block before a big attack, race
// before a heal). Both are pure functions of the state, so the intent shown during the player's
// turn is the plan the enemy will actually run.
import { START_HP } from './config.js';

/** Damage a card would deal right now, after the foe's block. */
function damageOf(def, foe) {
  if (def.kind !== 'damage' && def.kind !== 'surge' && def.kind !== 'tempest' && def.kind !== 'burn') return 0;
  return Math.max(0, def.value - foe.block);
}

/** One card's worth, in the current position: damage first, survival when hurt, draw when idle. */
function scoreCard(def, me, foe, energy) {
  if (def.cost > energy) return -1;
  const hurt = START_HP - me.hp;
  switch (def.kind) {
    case 'damage': {
      const damage = damageOf(def, foe);
      // Lethal damage is worth everything; otherwise damage per ember.
      if (damage >= foe.hp) return 1000 + damage;
      return damage * 10 + def.value - def.cost;
    }
    case 'surge': {
      const damage = damageOf(def, foe);
      if (damage >= foe.hp) return 1000 + damage;
      return damage * 10 + 12;
    }
    case 'tempest': {
      const damage = damageOf(def, foe);
      if (damage >= foe.hp) return 1000 + damage;
      return damage * 10 + 8;
    }
    case 'burn': {
      const damage = damageOf(def, foe);
      if (damage + def.burn >= foe.hp) return 1000 + damage;
      return damage * 10 + def.burn * 6;
    }
    case 'block':
      // Block matters when the foe can hurt you next turn; near full HP it is nearly worthless.
      return me.hp <= 12 ? def.value * 8 : me.hp <= 20 ? def.value * 4 : def.value * 1;
    case 'heal':
      return hurt <= 0 ? -1 : Math.min(def.value, hurt) * 8;
    case 'roots':
      return hurt <= 0 ? 6 : Math.min(def.value, hurt) * 8 + 6;
    case 'draw':
      return 5;
    default:
      return 0;
  }
}

/**
 * The enemy's whole turn as a list of hand indexes to play, in order, greedily re-scored after
 * each play (energy falls, block and HP move). Stops when nothing affordable is worth playing.
 */
export function planPlays(hand, energy, me, foe) {
  const plays = [];
  let left = energy;
  const mine = { ...me };
  const theirs = { ...foe };
  const remaining = hand.map((card, index) => ({ card, index }));
  for (;;) {
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < remaining.length; i += 1) {
      const score = scoreCard(remaining[i].card.def, mine, theirs, left);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best === -1) break;
    const { card, index } = remaining.splice(best, 1)[0];
    plays.push(index);
    left -= card.def.cost;
    // Apply the play to the simulated position so the next pick sees the new state.
    if (card.def.kind === 'damage' || card.def.kind === 'surge' || card.def.kind === 'tempest' || card.def.kind === 'burn') {
      const hit = Math.max(0, card.def.value - theirs.block);
      theirs.block = Math.max(0, theirs.block - card.def.value);
      theirs.hp -= hit;
      if (card.def.kind === 'burn') theirs.hp -= card.def.burn;
      if (card.def.kind === 'surge') left += card.def.energy;
    } else if (card.def.kind === 'block') {
      mine.block += card.def.value;
    } else if (card.def.kind === 'heal') {
      mine.hp = Math.min(START_HP, mine.hp + card.def.value);
    } else if (card.def.kind === 'roots') {
      mine.hp = Math.min(START_HP, mine.hp + card.def.value);
    }
    if (theirs.hp <= 0) break;
  }
  return plays;
}

/**
 * What the enemy is about to do, in one line: the attack and block its plan adds up to, or the
 * trick it is setting up. The renderer draws this beside the enemy portrait every turn.
 */
export function intentOf(hand, energy, me, foe) {
  const plays = planPlays(hand, energy, me, foe);
  let attack = 0;
  let block = 0;
  let special = null;
  for (const index of plays) {
    const def = hand[index].def;
    if (def.kind === 'damage' || def.kind === 'surge' || def.kind === 'tempest') attack += def.value;
    else if (def.kind === 'burn') {
      attack += def.value;
      special = 'smoulder';
    } else if (def.kind === 'block') block += def.value;
    else if (def.kind === 'heal' || def.kind === 'roots') special = 'mend';
    else if (def.kind === 'draw') special = 'scheme';
  }
  if (plays.length === 0) return { text: 'Waiting…', kind: 'wait', attack: 0, block: 0 };
  if (attack > 0 && block > 0) return { text: `Attack ${attack} · Block ${block}`, kind: 'attack', attack, block };
  if (attack > 0) return { text: special === 'smoulder' ? `Attack ${attack} + Smoulder` : `Attack ${attack}`, kind: 'attack', attack, block };
  if (block > 0) return { text: `Block ${block}`, kind: 'block', attack, block };
  if (special === 'mend') return { text: 'Mending', kind: 'heal', attack, block };
  return { text: 'Scheming', kind: 'scheme', attack, block };
}
