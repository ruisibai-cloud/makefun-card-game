// Every tuning number and colour in one place. The table is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** Both duelists start here; first to 0 loses. */
export const START_HP = 30;

/** Embers (energy) a side gets at the start of its turn. */
export const ENERGY_PER_TURN = 3;

/** Cards drawn at the start of a turn, up to this hand size. */
export const HAND_SIZE = 5;

/** Copies of each card definition in a deck. */
export const DECK_COPIES = 2;

/** How long, in seconds, the enemy waits between its plays, so its turn reads. */
export const ENEMY_PLAY_DELAY = 0.85;

/** Card art, in logical pixels. */
export const CARD = { width: 148, height: 208, radius: 14 };

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberfall-duel.best';

/** Score: damage dealt, plus this per HP left at the end, plus the win bonus. */
export const SCORE = { perHp: 2, winBonus: 100 };

export const PALETTE = {
  backdrop: '#14100c',
  table: '#1e3a2f',
  tableEdge: '#2c5240',
  felt: '#234534',
  panel: '#241c14',
  panelEdge: '#4a3823',
  text: '#f5ecd7',
  muted: '#b8a888',
  gold: '#f2c94c',
  ember: '#ff7a3c',
  hp: '#e5534b',
  hpBack: '#3a2320',
  block: '#7db4e8',
  enemy: '#c98ae8',
  flame: '#e5534b',
  flameDark: '#8f2a22',
  stone: '#7db4e8',
  stoneDark: '#33567e',
  sprout: '#7cc96a',
  sproutDark: '#356b2a',
  storm: '#c98ae8',
  stormDark: '#6d3a80',
  cardFace: '#f7f0dd',
  cardInk: '#2a2118',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
