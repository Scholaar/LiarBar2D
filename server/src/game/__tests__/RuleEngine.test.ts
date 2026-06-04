import { describe, it, expect } from 'vitest';
import { RuleEngine } from '../RuleEngine';
import type { CardValue } from 'shared';

describe('RuleEngine', () => {
  const engine = new RuleEngine();

  describe('verifyClaim', () => {
    it('should return isTruth=true when all played cards match declared card', () => {
      const result = engine.verifyClaim(
        ['Q', 'Q'] as CardValue[],
        'Q',
        2
      );
      expect(result.isTruth).toBe(true);
    });

    it('should return isTruth=false when played cards do not match declared card', () => {
      const result = engine.verifyClaim(
        ['A', 'K'] as CardValue[],
        'Q',
        2
      );
      expect(result.isTruth).toBe(false);
    });

    it('should return isTruth=true when Joker is used as target card', () => {
      const result = engine.verifyClaim(
        ['Joker', 'Q'] as CardValue[],
        'Q',
        2
      );
      expect(result.isTruth).toBe(true);
    });

    it('should return isTruth=true when all cards are Jokers declared as target', () => {
      const result = engine.verifyClaim(
        ['Joker', 'Joker'] as CardValue[],
        'Q',
        2
      );
      expect(result.isTruth).toBe(true);
    });

    it('should detect partial lie when one non-matching card without Joker', () => {
      const result = engine.verifyClaim(
        ['Q', 'A'] as CardValue[],
        'Q',
        2
      );
      expect(result.isTruth).toBe(false);
    });

    it('should treat non-Joker non-target card as lie even with Joker present', () => {
      const result = engine.verifyClaim(
        ['Joker', 'A'] as CardValue[],
        'Q',
        2
      );
      expect(result.isTruth).toBe(false);
    });
  });

  describe('getNextAlivePlayer', () => {
    it('should return the next alive player cyclically', () => {
      const playerOrder = ['p1', 'p2', 'p3', 'p4'];
      const aliveSet = new Set(['p1', 'p2', 'p3', 'p4']);
      expect(engine.getNextAlivePlayer(playerOrder, aliveSet, 'p1')).toBe('p2');
      expect(engine.getNextAlivePlayer(playerOrder, aliveSet, 'p4')).toBe('p1');
    });

    it('should skip eliminated players', () => {
      const playerOrder = ['p1', 'p2', 'p3', 'p4'];
      const aliveSet = new Set(['p1', 'p3', 'p4']);
      expect(engine.getNextAlivePlayer(playerOrder, aliveSet, 'p1')).toBe('p3');
    });
  });

  describe('checkWinCondition', () => {
    it('should return winner id when only one player alive', () => {
      expect(engine.checkWinCondition(['p1'])).toBe('p1');
    });

    it('should return null when multiple players alive', () => {
      expect(engine.checkWinCondition(['p1', 'p2'])).toBeNull();
    });
  });
});
