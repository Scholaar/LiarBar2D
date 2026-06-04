import type { CardValue, TargetCard } from 'shared';

export interface VerificationResult {
  isTruth: boolean;
  reason: string;
}

export class RuleEngine {
  verifyClaim(
    actualCards: CardValue[],
    declaredCard: TargetCard,
    declaredCount: number
  ): VerificationResult {
    const allValid = actualCards.every(
      (card) => card === declaredCard || card === 'Joker'
    );

    if (allValid) {
      const hasJoker = actualCards.includes('Joker');
      return {
        isTruth: true,
        reason: hasJoker
          ? `Truth (Joker acts as ${declaredCard})`
          : `Truth (all cards are ${declaredCard})`,
      };
    }

    const invalidCards = actualCards.filter(
      (card) => card !== declaredCard && card !== 'Joker'
    );
    return {
      isTruth: false,
      reason: `Lie: played ${invalidCards.join(',')} which are not ${declaredCard}`,
    };
  }

  getNextAlivePlayer(
    playerOrder: string[],
    aliveSet: Set<string>,
    currentPlayerId: string
  ): string {
    const currentIndex = playerOrder.indexOf(currentPlayerId);
    for (let i = 1; i <= playerOrder.length; i++) {
      const nextIndex = (currentIndex + i) % playerOrder.length;
      const candidate = playerOrder[nextIndex];
      if (aliveSet.has(candidate)) {
        return candidate;
      }
    }
    return currentPlayerId;
  }

  checkWinCondition(alivePlayerIds: string[]): string | null {
    if (alivePlayerIds.length === 1) {
      return alivePlayerIds[0];
    }
    return null;
  }
}
