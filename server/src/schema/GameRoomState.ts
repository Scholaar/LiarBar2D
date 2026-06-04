import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';
import type { GamePhase, TargetCard } from 'shared';

export class ChatMessage extends Schema {
  @type('string') playerId: string = '';
  @type('string') playerName: string = '';
  @type('string') text: string = '';
  @type('number') timestamp: number = 0;
}

export class Player extends Schema {
  @type('string') id: string = '';
  @type('string') name: string = '';
  @type('boolean') isReady: boolean = false;
  @type('boolean') isHost: boolean = false;
  @type('boolean') isAlive: boolean = true;
  @type('boolean') isConnected: boolean = true;

  // 仅本人可见的手牌
  @type(['string']) hand = new ArraySchema<string>();
  @type(['string']) selectedCards = new ArraySchema<string>();

  // 轮盘状态
  @type('uint8') rouletteCount: number = 0;

  // 统计
  @type('uint8') wins: number = 0;
  @type('uint8') losses: number = 0;
}

export class GameRoomState extends Schema {
  @type('string') roomName: string = '';
  @type('string') phase: GamePhase = 'waiting';
  @type('string') roomId: string = '';

  @type({ map: Player }) players = new MapSchema<Player>();
  @type(['string']) playerOrder = new ArraySchema<string>();

  @type('string') currentTurnId: string = '';
  @type('string') targetCard: TargetCard | '' = '';
  @type('uint8') roundNumber: number = 0;
  @type('uint8') timeoutSeconds: number = 15;

  @type('string') lastClaimCard: string = '';
  @type('uint8') lastClaimCount: number = 0;
  @type('string') lastPlayerId: string = '';
  @type(['string']) lastActualCards = new ArraySchema<string>();

  @type([ChatMessage]) messages = new ArraySchema<ChatMessage>();

  @type('string') winnerId: string = '';
  @type(['string']) eliminationOrder = new ArraySchema<string>();
}
