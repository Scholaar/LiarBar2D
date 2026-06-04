import { DECK_COMPOSITION, JOKER_COUNT, type CardValue } from 'shared';

export class CardDeck {
  private cards: CardValue[] = [];

  constructor() {
    this.reset();
  }

  get size(): number {
    return this.cards.length;
  }

  reset(): void {
    this.cards = [];
    for (const [card, count] of Object.entries(DECK_COMPOSITION)) {
      for (let i = 0; i < count; i++) {
        this.cards.push(card as CardValue);
      }
    }
    for (let i = 0; i < JOKER_COUNT; i++) {
      this.cards.push('Joker');
    }
    this.shuffle();
  }

  private shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw(): CardValue | null {
    return this.cards.pop() ?? null;
  }

  dealHand(count: number): CardValue[] {
    if (count > this.cards.length) {
      throw new Error(`Not enough cards: requested ${count}, available ${this.cards.length}`);
    }
    const hand: CardValue[] = [];
    for (let i = 0; i < count; i++) {
      hand.push(this.cards.pop()!);
    }
    return hand;
  }
}
