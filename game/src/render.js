// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 table is
// scaled to fit the window and centred. Cards slide to their places (each card's drawn position
// eases toward its target every frame), the last played card takes the spotlight in the middle,
// and damage numbers float up from where they land. Suits are told apart by colour AND shape:
// flame, shield, leaf and bolt are drawn as paths, never as text or emoji.
import { CARD, FIELD, FONT, PALETTE, START_HP } from './config.js';
import { SUITS, SUIT_FLAME, SUIT_SPROUT, SUIT_STONE, SUIT_STORM } from './cards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const HAND_Y = 468;
const HAND_GAP = 162;
const ENEMY_Y = 18;
const SPOTLIGHT_MS = 1400;

function roundRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

/** The four suit shapes, drawn centred on (cx, cy) at size `s`, in the suit's colour. */
function drawSuitShape(context, suit, cx, cy, s, color) {
  context.fillStyle = color;
  context.beginPath();
  if (suit === SUIT_FLAME) {
    // A flame: a teardrop leaning right, with a hollow lick.
    context.moveTo(cx, cy - s);
    context.bezierCurveTo(cx + s * 0.75, cy - s * 0.25, cx + s * 0.6, cy + s * 0.55, cx, cy + s * 0.8);
    context.bezierCurveTo(cx - s * 0.6, cy + s * 0.55, cx - s * 0.75, cy - s * 0.25, cx, cy - s);
    context.fill();
    context.fillStyle = '#ffd27a';
    context.beginPath();
    context.moveTo(cx, cy + s * 0.55);
    context.bezierCurveTo(cx + s * 0.3, cy + s * 0.2, cx + s * 0.2, cy - s * 0.2, cx, cy - s * 0.35);
    context.bezierCurveTo(cx - s * 0.2, cy - s * 0.2, cx - s * 0.3, cy + s * 0.2, cx, cy + s * 0.55);
    context.fill();
  } else if (suit === SUIT_STONE) {
    // A shield.
    context.moveTo(cx - s * 0.7, cy - s * 0.7);
    context.lineTo(cx + s * 0.7, cy - s * 0.7);
    context.lineTo(cx + s * 0.7, cy + s * 0.1);
    context.bezierCurveTo(cx + s * 0.7, cy + s * 0.6, cx + s * 0.3, cy + s * 0.85, cx, cy + s);
    context.bezierCurveTo(cx - s * 0.3, cy + s * 0.85, cx - s * 0.7, cy + s * 0.6, cx - s * 0.7, cy + s * 0.1);
    context.closePath();
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.35)';
    context.fillRect(cx - s * 0.12, cy - s * 0.45, s * 0.24, s * 1.05);
  } else if (suit === SUIT_SPROUT) {
    // A leaf: two arcs meeting at the tips, with a stem.
    context.moveTo(cx, cy - s);
    context.bezierCurveTo(cx + s * 0.9, cy - s * 0.4, cx + s * 0.7, cy + s * 0.6, cx, cy + s * 0.8);
    context.bezierCurveTo(cx - s * 0.7, cy + s * 0.6, cx - s * 0.9, cy - s * 0.4, cx, cy - s);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = Math.max(2, s * 0.08);
    context.beginPath();
    context.moveTo(cx, cy - s * 0.7);
    context.lineTo(cx, cy + s * 0.95);
    context.stroke();
  } else if (suit === SUIT_STORM) {
    // A bolt.
    context.moveTo(cx + s * 0.25, cy - s);
    context.lineTo(cx - s * 0.55, cy + s * 0.1);
    context.lineTo(cx - s * 0.05, cy + s * 0.1);
    context.lineTo(cx - s * 0.25, cy + s);
    context.lineTo(cx + s * 0.55, cy - s * 0.1);
    context.lineTo(cx + s * 0.05, cy - s * 0.1);
    context.closePath();
    context.fill();
  }
}

/** One line of effect text for a card, with its big number: "7" + "damage". */
function effectLine(def) {
  switch (def.kind) {
    case 'damage': return { big: String(def.value), small: 'damage' };
    case 'surge': return { big: String(def.value), small: 'damage +1 ember' };
    case 'tempest': return { big: String(def.value), small: 'damage, draw 1' };
    case 'burn': return { big: String(def.value), small: `dmg + smoulder ${def.burn}` };
    case 'block': return { big: String(def.value), small: 'block' };
    case 'heal': return { big: String(def.value), small: 'heal' };
    case 'roots': return { big: String(def.value), small: 'heal, draw 1' };
    case 'draw': return { big: String(def.value), small: 'draw cards' };
    default: return { big: '', small: '' };
  }
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const positions = new Map();
  const floaters = [];
  let spotlight = null;
  let lastHandRects = [];
  let lastEndRect = null;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight ?? ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ?? ''} ${size}px ${FONT}`.trim());
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function hpBar(x, y, width, hp, maxHp, block, burn) {
    context.fillStyle = PALETTE.hpBack;
    roundRect(context, x, y, width, 26, 8);
    context.fill();
    const fill = Math.max(0, (hp / maxHp) * width);
    context.fillStyle = PALETTE.hp;
    if (fill > 0) {
      roundRect(context, x, y, fill, 26, 8);
      context.fill();
    }
    context.textBaseline = 'middle';
    text(`${hp} / ${maxHp}`, x + width / 2, y + 14, 17, PALETTE.text, 'center', '600');
    let extra = x + width + 12;
    if (block > 0) {
      drawSuitShape(context, SUIT_STONE, extra + 11, y + 13, 11, PALETTE.block);
      text(String(block), extra + 28, y + 14, 18, PALETTE.block, 'left', '700');
      extra += 56;
    }
    if (burn > 0) {
      drawSuitShape(context, SUIT_FLAME, extra + 11, y + 13, 11, PALETTE.ember);
      text(String(burn), extra + 28, y + 14, 18, PALETTE.ember, 'left', '700');
    }
    context.textBaseline = 'alphabetic';
  }

  function energyPips(x, y, energy, max) {
    text('Embers', x, y - 8, 15, PALETTE.muted, 'left', '600');
    for (let i = 0; i < max; i += 1) {
      const cx = x + 16 + i * 34;
      context.fillStyle = i < energy ? PALETTE.ember : '#3a2c1e';
      context.beginPath();
      context.arc(cx, y + 16, 13, 0, Math.PI * 2);
      context.fill();
      if (i < energy) drawSuitShape(context, SUIT_FLAME, cx, y + 16, 7, '#ffd27a');
    }
  }

  function drawCardFace(card, x, y, w, h, faceUp) {
    const def = card.def;
    const suit = SUITS[def.suit];
    context.save();
    context.shadowColor = 'rgba(0,0,0,0.45)';
    context.shadowBlur = 12;
    context.shadowOffsetY = 5;
    context.fillStyle = faceUp ? PALETTE.cardFace : '#5a3d6e';
    roundRect(context, x, y, w, h, CARD.radius * (w / CARD.width));
    context.fill();
    context.restore();
    if (!faceUp) {
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 2;
      roundRect(context, x + 8, y + 8, w - 16, h - 16, 8);
      context.stroke();
      drawSuitShape(context, SUIT_FLAME, x + w / 2, y + h / 2, Math.min(w, h) * 0.22, PALETTE.gold);
      return;
    }
    // Header band in the suit colour.
    context.fillStyle = suit.color;
    roundRect(context, x, y, w, h * 0.24, CARD.radius * (w / CARD.width));
    context.fill();
    context.fillRect(x, y + h * 0.16, w, h * 0.08);
    // Cost gem.
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.arc(x + 24 * (w / CARD.width), y + 24 * (h / CARD.height), 17 * (w / CARD.width), 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.cardInk;
    text(String(def.cost), x + 24 * (w / CARD.width), y + 31 * (h / CARD.height), 24 * (w / CARD.width), PALETTE.cardInk, 'center', '800');
    // Name, nudged right of the cost gem.
    text(def.name, x + w / 2 + 8 * (w / CARD.width), y + h * 0.19, 17 * (w / CARD.width), '#ffffff', 'center', '700');
    // Suit art.
    drawSuitShape(context, def.suit, x + w / 2, y + h * 0.46, w * 0.22, suit.color);
    // Effect: big number, small label, then the rules text.
    const line = effectLine(def);
    text(line.big, x + w / 2, y + h * 0.72, 34 * (w / CARD.width), PALETTE.cardInk, 'center', '800');
    text(line.small, x + w / 2, y + h * 0.80, 13 * (w / CARD.width), PALETTE.cardInk, 'center', '600');
    // The rules line shrinks until it fits the card, so no text ever spills off the face.
    let rulesSize = 12.5 * (w / CARD.width);
    context.font = `${rulesSize}px ${FONT}`;
    while (rulesSize > 9 && context.measureText(def.text).width > w - 14) {
      rulesSize -= 0.5;
      context.font = `${rulesSize}px ${FONT}`;
    }
    context.fillStyle = suit.dark;
    context.textAlign = 'center';
    context.fillText(def.text, x + w / 2, y + h * 0.90);
  }

  function handTargets(hand) {
    const n = hand.length;
    return hand.map((card, i) => {
      const offset = i - (n - 1) / 2;
      return {
        card,
        index: i,
        x: FIELD.width / 2 + offset * HAND_GAP - CARD.width / 2,
        y: HAND_Y + Math.abs(offset) * 10,
        rot: offset * 0.045,
      };
    });
  }

  function drawTable(state, ui) {
    context.fillStyle = PALETTE.table;
    roundRect(context, 10, 10, FIELD.width - 20, FIELD.height - 20, 24);
    context.fill();
    context.fillStyle = PALETTE.felt;
    roundRect(context, 26, 26, FIELD.width - 52, FIELD.height - 52, 18);
    context.fill();
    // Turn banner, down the left side where the enemy's hand never reaches.
    context.textBaseline = 'alphabetic';
    text(`Turn ${state.turn}`, 40, 208, 22, PALETTE.text, 'left', '700');
    text(state.phase === 'enemy' ? 'The Warden plays…' : 'Your turn — play cards, then End Turn', 40, 234, 15, PALETTE.muted, 'left');
  }

  function drawEnemy(state) {
    const foe = state.enemy;
    // Portrait: a masked warden in a ring.
    context.fillStyle = PALETTE.panel;
    context.beginPath();
    context.arc(118, 96, 52, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.enemy;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(118, 96, 52, 0, Math.PI * 2);
    context.stroke();
    drawSuitShape(context, SUIT_STORM, 118, 92, 30, PALETTE.enemy);
    text('ASH WARDEN', 186, 74, 22, PALETTE.text, 'left', '700');
    hpBar(186, 88, 300, foe.hp, START_HP, foe.block, foe.burn);
    // Intent chip: what the Warden is about to do.
    const intent = state.intent;
    const chipColor = intent.kind === 'attack' ? PALETTE.flame : intent.kind === 'block' ? PALETTE.stone : intent.kind === 'heal' ? PALETTE.sprout : PALETTE.muted;
    context.fillStyle = 'rgba(20,16,12,0.72)';
    roundRect(context, 186, 128, 300, 34, 10);
    context.fill();
    context.fillStyle = chipColor;
    context.beginPath();
    context.arc(206, 145, 8, 0, Math.PI * 2);
    context.fill();
    text(`Intent: ${intent.text}`, 222, 152, 17, PALETTE.text, 'left', '600');
    // Enemy hand, face down, fanned at the top right.
    const n = foe.hand.length;
    for (let i = 0; i < n; i += 1) {
      const offset = i - (n - 1) / 2;
      const w = 84;
      const h = 118;
      const x = FIELD.width / 2 + 210 + offset * 64 - w / 2;
      const y = ENEMY_Y + Math.abs(offset) * 6;
      context.save();
      context.translate(x + w / 2, y + h / 2);
      context.rotate(offset * 0.06);
      drawCardFace(foe.hand[i], -w / 2, -h / 2, w, h, false);
      context.restore();
    }
    text(`${n} cards`, FIELD.width - 40, 168, 15, PALETTE.muted, 'right');
  }

  function drawPlayer(state, ui) {
    const me = state.player;
    text('YOU', 40, 452, 22, PALETTE.text, 'left', '700');
    hpBar(40, 466, 300, me.hp, START_HP, me.block, me.burn);
    energyPips(40, 512, me.energy, 6);
    // Deck and discard piles.
    const piles = [
      { label: 'Draw', count: me.drawPile.length, x: 1092, y: 300 },
      { label: 'Discard', count: me.discard.length, x: 1092, y: 440 },
    ];
    for (const pile of piles) {
      context.fillStyle = 'rgba(20,16,12,0.55)';
      roundRect(context, pile.x, pile.y, 120, 96, 10);
      context.fill();
      text(pile.label, pile.x + 60, pile.y + 30, 15, PALETTE.muted, 'center', '600');
      text(String(pile.count), pile.x + 60, pile.y + 70, 30, PALETTE.text, 'center', '800');
    }
    // End Turn button.
    const rect = { x: 1064, y: 596, w: 176, h: 56 };
    lastEndRect = rect;
    const active = state.phase === 'player';
    context.fillStyle = active ? PALETTE.gold : '#4a4033';
    roundRect(context, rect.x, rect.y, rect.w, rect.h, 12);
    context.fill();
    text('END TURN', rect.x + rect.w / 2, rect.y + 37, 22, active ? '#2a2118' : PALETTE.muted, 'center', '800');
    text('E', rect.x + rect.w - 14, rect.y + 20, 13, active ? '#6b5a2e' : PALETTE.muted, 'right', '700');
    // Log.
    const lines = state.log.slice(-4);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], 40, 330 + i * 22, 15, PALETTE.muted, 'left');
    }
  }

  function drawHand(state, ui) {
    const targets = handTargets(state.player.hand);
    lastHandRects = [];
    for (const target of targets) {
      const key = target.card.uid;
      let pos = positions.get(key);
      if (!pos) {
        pos = { x: target.x, y: target.y + 120, rot: 0 };
        positions.set(key, pos);
      }
      // Ease toward the target; hovered cards lift.
      const hovered = ui.hover === target.index && state.phase === 'player';
      const ty = hovered ? target.y - 26 : target.y;
      pos.x += (target.x - pos.x) * 0.22;
      pos.y += (ty - pos.y) * 0.22;
      pos.rot += (target.rot - pos.rot) * 0.22;
      const affordable = state.player.energy >= target.card.def.cost;
      context.save();
      context.translate(pos.x + CARD.width / 2, pos.y + CARD.height / 2);
      context.rotate(pos.rot);
      if (hovered) context.scale(1.05, 1.05);
      drawCardFace(target.card, -CARD.width / 2, -CARD.height / 2, CARD.width, CARD.height, true);
      context.restore();
      if (!affordable) {
        context.fillStyle = 'rgba(20,16,12,0.45)';
        roundRect(context, pos.x, pos.y, CARD.width, CARD.height, CARD.radius);
        context.fill();
      }
      lastHandRects.push({ index: target.index, x: pos.x, y: pos.y, w: CARD.width, h: CARD.height });
      // Keyboard hint under each card.
      text(String(target.index + 1), pos.x + CARD.width / 2, pos.y + CARD.height + 18, 13, PALETTE.muted, 'center');
    }
    // Drop positions of cards no longer in hand.
    for (const key of [...positions.keys()]) {
      if (!state.player.hand.some((card) => card.uid === key)) positions.delete(key);
    }
  }

  function drawSpotlight(ui) {
    if (!spotlight) return;
    const age = ui.time - spotlight.at;
    if (age > SPOTLIGHT_MS) {
      spotlight = null;
      return;
    }
    const alpha = age < SPOTLIGHT_MS - 300 ? 1 : (SPOTLIGHT_MS - age) / 300;
    const scale = 0.62 + Math.min(0.1, age / 4000);
    const w = CARD.width * scale;
    const h = CARD.height * scale;
    const x = FIELD.width / 2 - w / 2;
    const y = 196 + (spotlight.side === 'enemy' ? -20 : 40);
    context.save();
    context.globalAlpha = alpha;
    drawCardFace(spotlight.card, x, y, w, h, true);
    text(spotlight.side === 'enemy' ? 'The Warden plays' : 'You play', FIELD.width / 2, y + h + 24, 17, PALETTE.gold, 'center', '700');
    context.restore();
  }

  function drawFloaters(ui) {
    for (let i = floaters.length - 1; i >= 0; i -= 1) {
      const floater = floaters[i];
      const age = ui.time - floater.at;
      if (age > 1200) {
        floaters.splice(i, 1);
        continue;
      }
      const rise = (age / 1200) * 46;
      context.save();
      context.globalAlpha = age > 800 ? (1200 - age) / 400 : 1;
      text(floater.text, floater.x, floater.y - rise, 30, floater.color, 'center', '800');
      context.restore();
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 190 + lines.length * 34;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10, 8, 6, 0.62)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(context, x, y, width, height, 18);
    context.fill();
    context.strokeStyle = accent;
    context.lineWidth = 3;
    roundRect(context, x, y, width, height, 18);
    context.stroke();
    text(title, FIELD.width / 2, y + 74, 46, accent, 'center', '800');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 128 + i * 34, 21, PALETTE.text, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 20, PALETTE.gold, 'center', '600');
  }

  function drawTitle(state, best) {
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // A fan of the four suits behind the title.
    const suits = [SUIT_FLAME, SUIT_STONE, SUIT_SPROUT, SUIT_STORM];
    for (let i = 0; i < suits.length; i += 1) {
      const offset = i - 1.5;
      context.save();
      context.translate(FIELD.width / 2 + offset * 170, 330);
      context.rotate(offset * 0.14);
      context.globalAlpha = 0.9;
      drawSuitShape(context, suits[i], 0, 0, 52, SUITS[suits[i]].color);
      context.restore();
    }
    text('EMBERFALL', FIELD.width / 2, 150, 84, PALETTE.gold, 'center', '800');
    text('DUEL', FIELD.width / 2, 226, 84, PALETTE.text, 'center', '800');
    text('A duel of flame, stone, sprout and storm.', FIELD.width / 2, 272, 22, PALETTE.muted, 'center');
    text('You and the Ash Warden start at 30 life. Play cards with embers,', FIELD.width / 2, 470, 19, PALETTE.text, 'center');
    text('read the Warden\u2019s intent, and be the last flame standing.', FIELD.width / 2, 498, 19, PALETTE.text, 'center');
    text('Click a card to play it · keys 1–5 play cards · E ends your turn · P pauses', FIELD.width / 2, 548, 17, PALETTE.muted, 'center');
    text(`Best score ${best}`, FIELD.width / 2, 596, 19, PALETTE.gold, 'center', '600');
    text('Press Space or click to start', FIELD.width / 2, 648, 24, PALETTE.text, 'center', '700');
  }

  function draw(state, screen, best, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    drawTable(state, ui);
    drawEnemy(state);
    drawPlayer(state, ui);
    drawHand(state, ui);
    // The spotlight belongs to live play: on the end screen the panel owns the middle.
    if (screen === SCREEN_PLAY) drawSpotlight(ui);
    drawFloaters(ui);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The Warden waits. Your embers keep.'], 'Press P to resume', PALETTE.muted);
    } else if (screen === SCREEN_OVER) {
      const won = state.phase === 'won';
      const lines = [
        won ? 'The Ash Warden falls. Your flame stands last.' : 'Your flame goes out. The Warden stands.',
        `Damage dealt ${state.damageDealt}  ·  HP left ${state.player.hp}  ·  Turns ${state.turn}`,
        `Score ${ui.score}   ·   Best ${best}`,
      ];
      drawPanel(won ? 'VICTORY' : 'DEFEAT', lines, 'Press Space or click to duel again', won ? PALETTE.gold : PALETTE.hp);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    /** The rectangles the last draw put the player's hand cards in (for hit-testing). */
    handRects() {
      return lastHandRects;
    },
    endTurnRect() {
      return lastEndRect;
    },
    /** Put a played card in the middle of the table for a moment. */
    spotlightCard(card, side, time) {
      spotlight = { card, side, at: time };
    },
    /** A number that floats up from a point (damage, healing, block). */
    floater(textValue, x, y, color, time) {
      floaters.push({ text: textValue, x, y, color, at: time });
    },
    resetFx() {
      positions.clear();
      floaters.length = 0;
      spotlight = null;
    },
    /** Convert a client point to table coordinates. */
    toTable(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const px = (clientX - rect.left) * ratio;
      const py = (clientY - rect.top) * ratio;
      return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
    },
  };
}
