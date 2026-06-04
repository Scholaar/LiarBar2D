import { describe, it, expect } from 'vitest';
import { RouletteEngine } from '../RouletteEngine';

describe('RouletteEngine', () => {
  const engine = new RouletteEngine();

  it('should return bullet count = rouletteCount + 1', () => {
    expect(engine.getBulletCount(0)).toBe(1);
    expect(engine.getBulletCount(1)).toBe(2);
    expect(engine.getBulletCount(2)).toBe(3);
    expect(engine.getBulletCount(3)).toBe(4);
  });

  it('should return probability = bulletCount / 6', () => {
    expect(engine.getProbability(0)).toBeCloseTo(1 / 6);
    expect(engine.getProbability(1)).toBeCloseTo(2 / 6);
    expect(engine.getProbability(2)).toBeCloseTo(3 / 6);
    expect(engine.getProbability(3)).toBeCloseTo(4 / 6);
  });

  it('spin should return boolean result', () => {
    const result = engine.spin(0);
    expect(typeof result).toBe('boolean');
  });

  it('bullet count should never exceed 6', () => {
    expect(engine.getBulletCount(5)).toBe(6);
    expect(engine.getBulletCount(100)).toBe(6);
  });

  it('should determine if eliminated based on spin result', () => {
    expect(engine.isEliminated(true)).toBe(true);
    expect(engine.isEliminated(false)).toBe(false);
  });
});
