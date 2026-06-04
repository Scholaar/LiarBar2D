import { describe, it, expect } from 'vitest';
import { CardDeck } from '../CardDeck';

describe('CardDeck', () => {
  it('should create a deck with 26 cards (A/K/Q/J x6 + Joker x2)', () => {
    const deck = new CardDeck();
    expect(deck.size).toBe(26);
  });

  it('should have correct card distribution', () => {
    const deck = new CardDeck();
    const counts: Record<string, number> = {};
    while (deck.size > 0) {
      const card = deck.draw()!;
      counts[card] = (counts[card] || 0) + 1;
    }
    expect(counts['A']).toBe(6);
    expect(counts['K']).toBe(6);
    expect(counts['Q']).toBe(6);
    expect(counts['J']).toBe(6);
    expect(counts['Joker']).toBe(2);
  });

  it('should deal specified number of cards', () => {
    const deck = new CardDeck();
    const hand = deck.dealHand(5);
    expect(hand).toHaveLength(5);
    expect(deck.size).toBe(21);
  });

  it('should throw when dealing more cards than available', () => {
    const deck = new CardDeck();
    expect(() => deck.dealHand(30)).toThrow('Not enough cards');
  });

  it('should create a fresh deck each time', () => {
    const deck1 = new CardDeck();
    const deck2 = new CardDeck();
    const hand1 = deck1.dealHand(26);
    const hand2 = deck2.dealHand(26);
    expect(hand1.sort()).toEqual(hand2.sort());
  });
});
