// Decks, draw piles and discard piles. A deck is two copies of every card definition, shuffled
// with the world's seeded random, so the same seed deals the same hands.
import { CARD_DEFS } from './cards.js';
import { DECK_COPIES } from './config.js';

let nextId = 1;

export function buildDeck() {
  const deck = [];
  for (let copy = 0; copy < DECK_COPIES; copy += 1) {
    for (const def of CARD_DEFS) {
      deck.push({ uid: nextId, def });
      nextId += 1;
    }
  }
  return deck;
}

/** Fisher-Yates shuffle, in place, on the world's random. */
export function shuffle(pile, random) {
  for (let index = pile.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [pile[index], pile[other]] = [pile[other], pile[index]];
  }
}

/**
 * Draw `count` cards from `drawPile` into `hand`. When the draw pile runs out, the discard pile
 * is shuffled back in; when both are empty, the hand stays short. Returns how many were drawn.
 */
export function drawCards(hand, drawPile, discardPile, count, random) {
  let drawn = 0;
  for (let index = 0; index < count; index += 1) {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break;
      while (discardPile.length > 0) drawPile.push(discardPile.pop());
      shuffle(drawPile, random);
    }
    hand.push(drawPile.pop());
    drawn += 1;
  }
  return drawn;
}
