import { ROULETTE_SLOTS } from 'shared';

export class RouletteEngine {
  getBulletCount(rouletteCount: number): number {
    return Math.min(rouletteCount + 1, ROULETTE_SLOTS);
  }

  getProbability(rouletteCount: number): number {
    return this.getBulletCount(rouletteCount) / ROULETTE_SLOTS;
  }

  spin(rouletteCount: number): boolean {
    const bulletCount = this.getBulletCount(rouletteCount);
    const landedSlot = Math.floor(Math.random() * ROULETTE_SLOTS) + 1;
    return landedSlot <= bulletCount;
  }

  isEliminated(gotShot: boolean): boolean {
    return gotShot;
  }
}
