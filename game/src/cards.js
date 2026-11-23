// The card set: twelve original cards in four suits. A suit is told apart by colour AND shape
// (flame, shield, leaf, bolt), never by text alone. Each definition names its cost in embers and
// its effect; the world applies the effect, the renderer draws the shape.
//
// Effect kinds:
//   damage  deal `value` damage to the foe
//   block   gain `value` block (absorbs damage until your next turn)
//   heal    restore `value` HP, up to the starting total
//   draw    draw `value` cards
//   burn    deal `value` damage and set the foe smouldering for `burn` (taken at the start of
//           their next turn, then cleared)
//   surge   deal `value` damage and gain `energy` embers
//   tempest deal `value` damage and draw `draw` cards
//   roots   heal `value` and draw `draw` cards
import { PALETTE } from './config.js';

export const SUIT_FLAME = 'flame';
export const SUIT_STONE = 'stone';
export const SUIT_SPROUT = 'sprout';
export const SUIT_STORM = 'storm';

export const SUITS = {
  [SUIT_FLAME]: { name: 'Flame', color: PALETTE.flame, dark: PALETTE.flameDark, verb: 'Burn them down.' },
  [SUIT_STONE]: { name: 'Stone', color: PALETTE.stone, dark: PALETTE.stoneDark, verb: 'Stand unbroken.' },
  [SUIT_SPROUT]: { name: 'Sprout', color: PALETTE.sprout, dark: PALETTE.sproutDark, verb: 'Grow back stronger.' },
  [SUIT_STORM]: { name: 'Storm', color: PALETTE.storm, dark: PALETTE.stormDark, verb: 'Strike twice.' },
};

/** Every card in the game, in the order the deck is built from them. */
export const CARD_DEFS = [
  { id: 'ember-strike', name: 'Ember Strike', suit: SUIT_FLAME, cost: 1, kind: 'damage', value: 4, text: 'Deal 4 damage.' },
  { id: 'wildfire', name: 'Wildfire', suit: SUIT_FLAME, cost: 2, kind: 'damage', value: 7, text: 'Deal 7 damage.' },
  { id: 'inferno', name: 'Inferno', suit: SUIT_FLAME, cost: 3, kind: 'damage', value: 11, text: 'Deal 11 damage.' },
  { id: 'pebble-guard', name: 'Pebble Guard', suit: SUIT_STONE, cost: 1, kind: 'block', value: 5, text: 'Gain 5 block.' },
  { id: 'rampart', name: 'Rampart', suit: SUIT_STONE, cost: 2, kind: 'block', value: 9, text: 'Gain 9 block.' },
  { id: 'bastion', name: 'Bastion', suit: SUIT_STONE, cost: 3, kind: 'block', value: 14, text: 'Gain 14 block.' },
  { id: 'mend', name: 'Mend', suit: SUIT_SPROUT, cost: 1, kind: 'heal', value: 4, text: 'Heal 4 HP.' },
  { id: 'deep-roots', name: 'Deep Roots', suit: SUIT_SPROUT, cost: 2, kind: 'roots', value: 7, draw: 1, text: 'Heal 7 HP. Draw 1 card.' },
  { id: 'bloom', name: 'Bloom', suit: SUIT_SPROUT, cost: 1, kind: 'draw', value: 2, text: 'Draw 2 cards.' },
  { id: 'spark-jolt', name: 'Spark Jolt', suit: SUIT_STORM, cost: 1, kind: 'surge', value: 3, energy: 1, text: 'Deal 3 damage. Gain 1 ember.' },
  { id: 'smolder', name: 'Smolder', suit: SUIT_STORM, cost: 2, kind: 'burn', value: 2, burn: 3, text: 'Deal 2 damage. Smoulder 3.' },
  { id: 'tempest', name: 'Tempest', suit: SUIT_STORM, cost: 3, kind: 'tempest', value: 6, draw: 1, text: 'Deal 6 damage. Draw 1 card.' },
];

export function cardDef(id) {
  return CARD_DEFS.find((def) => def.id === id) ?? null;
}
