// shared/types.ts

/** 牌面值 */
export type CardValue = 'A' | 'K' | 'Q' | 'J' | 'Joker';

/** 游戏阶段 */
export type GamePhase =
  | 'waiting'
  | 'ready'
  | 'dealing'
  | 'playing'
  | 'roulette'
  | 'round_end'
  | 'game_over';

/** 目标牌（不含 Joker） */
export type TargetCard = 'A' | 'K' | 'Q' | 'J';

/** 客户端 → 服务端消息类型 */
export type ClientMessage =
  | { type: 'create_room'; roomName: string }
  | { type: 'join_room'; roomId: string }
  | { type: 'leave_room' }
  | { type: 'ready' }
  | { type: 'unready' }
  | { type: 'start_game' }
  | { type: 'kick_player'; playerId: string }
  | { type: 'play_cards'; cards: string[]; declaredCard: TargetCard; declaredCount: number }
  | { type: 'challenge' }
  | { type: 'pass' }
  | { type: 'chat'; text: string };

/** 聊天消息 */
export interface ChatMessageData {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

/** 玩家信息（公开可见） */
export interface PlayerPublicInfo {
  id: string;
  name: string;
  isReady: boolean;
  isHost: boolean;
  isAlive: boolean;
  isConnected: boolean;
  rouletteCount: number;
  cardCount: number;
}

/** 牌组常量 */
export const DECK_COMPOSITION: Record<Exclude<CardValue, 'Joker'>, number> = {
  A: 6,
  K: 6,
  Q: 6,
  J: 6,
};

export const JOKER_COUNT = 2;
export const TOTAL_CARDS = 26;
export const CARDS_PER_PLAYER = 5;
export const MAX_PLAYERS = 4;
export const TURN_TIMEOUT_SECONDS = 15;
export const RECONNECT_TIMEOUT_SECONDS = 60;
export const ROULETTE_SLOTS = 6;
