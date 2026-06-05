import { Room, Client, matchMaker } from 'colyseus';
import { GameRoomState, Player, ChatMessage } from '../schema/GameRoomState';
import { CardDeck } from '../game/CardDeck';
import { RuleEngine } from '../game/RuleEngine';
import { RouletteEngine } from '../game/RouletteEngine';
import { recordGameResult } from '../db';
import { MAX_PLAYERS, TURN_TIMEOUT_SECONDS, RECONNECT_TIMEOUT_SECONDS } from 'shared';
import type { TargetCard } from 'shared';

export class GameRoom extends Room<GameRoomState> {
  private deck: CardDeck = new CardDeck();
  private ruleEngine: RuleEngine = new RuleEngine();
  private rouletteEngine: RouletteEngine = new RouletteEngine();
  private turnTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  onCreate(options: { roomName: string }): void {
    const state = new GameRoomState();
    state.roomName = options.roomName;
    state.roomId = this.roomId;
    this.setState(state);

    this.setMetadata({
      roomName: options.roomName,
      maxPlayers: MAX_PLAYERS,
      phase: 'waiting',
    });

    this.registerMessageHandlers();
  }

  private registerMessageHandlers(): void {
    this.onMessage('ready', (client) => this.handleReady(client));
    this.onMessage('start_game', (client) => this.handleStartGame(client));
    this.onMessage('kick_player', (client, data: { playerId: string }) =>
      this.handleKickPlayer(client, data.playerId)
    );
    this.onMessage('play_cards', (client, data) =>
      this.handlePlayCards(client, data)
    );
    this.onMessage('challenge', (client) => this.handleChallenge(client));
    this.onMessage('pass', (client) => this.handlePass(client));
    this.onMessage('chat', (client, data: { text: string }) =>
      this.handleChat(client, data.text)
    );
  }

  // === 加入/离开/重连 ===

  onJoin(client: Client, options: { playerName: string }): void {
    const player = new Player();
    player.id = client.sessionId;
    player.name = options.playerName;
    player.isHost = this.state.players.size === 0;
    player.isConnected = true;

    this.state.players.set(client.sessionId, player);
    this.state.playerOrder.push(client.sessionId);
    this.updateMetadata();
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (consented) {
      this.state.players.delete(client.sessionId);
      const idx = this.state.playerOrder.indexOf(client.sessionId);
      if (idx >= 0) this.state.playerOrder.splice(idx, 1);
      this.reassignHost();
    } else {
      player.isConnected = false;
      const timer = setTimeout(() => {
        this.handleDisconnectTimeout(client.sessionId);
      }, RECONNECT_TIMEOUT_SECONDS * 1000);
      this.reconnectTimers.set(client.sessionId, timer);
    }
    this.updateMetadata();
  }

  private async handleDisconnectTimeout(sessionId: string): Promise<void> {
    const player = this.state.players.get(sessionId);
    if (player && !player.isConnected) {
      player.isAlive = false;
      this.state.eliminationOrder.push(player.name);
      this.checkGameEnd();
    }
    this.reconnectTimers.delete(sessionId);
  }

  onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.isConnected = true;
      const timer = this.reconnectTimers.get(client.sessionId);
      if (timer) {
        clearTimeout(timer);
        this.reconnectTimers.delete(client.sessionId);
      }
    }
  }

  // === 准备与开始 ===

  private handleReady(client: Client): void {
    console.log(`[GameRoom] handleReady called by client ${client.sessionId}, phase=${this.state.phase}`);
    if (this.state.phase !== 'waiting' && this.state.phase !== 'ready') {
      console.warn(`[GameRoom] handleReady rejected — wrong phase: ${this.state.phase}`);
      return;
    }
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      console.warn(`[GameRoom] handleReady rejected — player not found for sessionId ${client.sessionId}`);
      return;
    }
    player.isReady = !player.isReady;
    console.log(`[GameRoom] player ${player.name} isReady=${player.isReady}`);

    const allPlayers = Array.from(this.state.players.values());
    const allReady =
      allPlayers.length === MAX_PLAYERS && allPlayers.every((p) => p.isReady);
    if (allReady) {
      this.state.phase = 'ready';
    } else {
      this.state.phase = 'waiting';
    }
    this.updateMetadata();
  }

  private handleStartGame(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.isHost) return;
    if (this.state.phase !== 'ready') return;

    const allPlayers = Array.from(this.state.players.values());
    if (allPlayers.length !== MAX_PLAYERS) return;
    if (!allPlayers.every((p) => p.isReady)) return;

    this.startNewRound();
  }

  private handleKickPlayer(client: Client, targetId: string): void {
    const kicker = this.state.players.get(client.sessionId);
    if (!kicker || !kicker.isHost) return;
    if (this.state.phase !== 'waiting') return;

    const target = this.state.players.get(targetId);
    if (!target || target.isHost) return;

    const targetClient = this.clients.find((c) => c.sessionId === targetId);
    if (targetClient) {
      targetClient.leave(1000);
    }
    this.state.players.delete(targetId);
    const idx = this.state.playerOrder.indexOf(targetId);
    if (idx >= 0) this.state.playerOrder.splice(idx, 1);
  }

  private reassignHost(): void {
    if (this.state.players.size === 0) return;
    const firstPlayer = Array.from(this.state.players.values())[0];
    if (firstPlayer && !firstPlayer.isHost) {
      firstPlayer.isHost = true;
    }
  }

  // === 发牌与回合（Task 12 将完善这些方法）===

  private startNewRound(): void {
    this.state.phase = 'dealing';
    this.state.roundNumber++;

    this.deck.reset();
    for (const [, player] of this.state.players) {
      if (player.isAlive) {
        player.hand.clear();
        const cards = this.deck.dealHand(5);
        cards.forEach((c) => player.hand.push(c));
      }
    }

    const targets: TargetCard[] = ['A', 'K', 'Q', 'J'];
    this.state.targetCard = targets[Math.floor(Math.random() * targets.length)];

    this.state.lastClaimCard = '';
    this.state.lastClaimCount = 0;
    this.state.lastPlayerId = '';
    this.state.lastActualCards.clear();

    const firstAlive = this.state.playerOrder.find((id) => {
      const p = this.state.players.get(id);
      return p ? p.isAlive : false;
    });
    if (firstAlive) {
      this.state.currentTurnId = firstAlive;
    }

    this.state.phase = 'playing';
    this.state.timeoutSeconds = TURN_TIMEOUT_SECONDS;
    this.startTurnTimer();
    this.updateMetadata();
  }

  // === 出牌（占位 - Task 12 实现）===

  private handlePlayCards(
    client: Client,
    data: { cards: string[]; declaredCard: TargetCard; declaredCount: number }
  ): void {
    if (this.state.phase !== 'playing') return;
    if (this.state.currentTurnId !== client.sessionId) return;

    const player = this.state.players.get(client.sessionId);
    if (!player || !player.isAlive) return;

    const { cards, declaredCard, declaredCount } = data;
    if (cards.length < 1 || cards.length > 3) return;
    if (declaredCard !== this.state.targetCard) return;
    if (declaredCount !== cards.length) return;

    const handCopy = [...player.hand];
    for (const card of cards) {
      const idx = handCopy.indexOf(card);
      if (idx === -1) return;
      handCopy.splice(idx, 1);
    }

    for (const card of cards) {
      const idx = player.hand.indexOf(card);
      if (idx >= 0) {
        player.hand.splice(idx, 1);
      }
    }

    this.state.lastClaimCard = declaredCard;
    this.state.lastClaimCount = declaredCount;
    this.state.lastPlayerId = client.sessionId;
    this.state.lastActualCards.clear();
    cards.forEach((c) => this.state.lastActualCards.push(c));

    this.advanceToNextPlayer();
  }

  // === 相信 ===

  private handlePass(client: Client): void {
    if (this.state.phase !== 'playing') return;
    if (this.state.currentTurnId !== client.sessionId) return;
    if (!this.state.lastPlayerId) return;
    this.advanceToNextPlayer();
  }

  // === 质疑 ===

  private handleChallenge(client: Client): void {
    if (this.state.phase !== 'playing') return;
    if (this.state.currentTurnId !== client.sessionId) return;
    if (!this.state.lastPlayerId) return;

    const result = this.ruleEngine.verifyClaim(
      [...this.state.lastActualCards] as any,
      this.state.targetCard as TargetCard,
      this.state.lastClaimCount
    );

    const loserId = result.isTruth
      ? client.sessionId
      : this.state.lastPlayerId;

    this.executeRoulette(loserId);
  }

  // === 轮盘 ===

  private executeRoulette(playerId: string): void {
    this.state.phase = 'roulette';
    this.clearTurnTimer();

    const player = this.state.players.get(playerId);
    if (!player) return;

    const gotShot = this.rouletteEngine.spin(player.rouletteCount);

    if (gotShot) {
      player.isAlive = false;
      this.state.eliminationOrder.push(player.name);
      if (this.checkGameEnd()) return;
    } else {
      player.rouletteCount++;
    }

    setTimeout(() => {
      if (this.state.phase === 'roulette') {
        this.finishRound();
      }
    }, 3500);
  }

  private finishRound(): void {
    this.state.lastClaimCard = '';
    this.state.lastClaimCount = 0;
    this.state.lastPlayerId = '';
    this.state.lastActualCards.clear();

    if (this.checkGameEnd()) return;

    this.state.phase = 'round_end';
    setTimeout(() => this.startNewRound(), 1000);
  }

  // === 胜利检查 ===

  private checkGameEnd(): boolean {
    const alivePlayers = Array.from(this.state.players.values()).filter(
      (p) => p.isAlive
    );
    const winner = this.ruleEngine.checkWinCondition(alivePlayers.map((p) => p.id));
    if (winner) {
      this.state.phase = 'game_over';
      this.state.winnerId = winner;
      this.clearTurnTimer();

      const winnerPlayer = this.state.players.get(winner);
      const loserNames = this.state.eliminationOrder.slice();
      if (winnerPlayer) {
        recordGameResult(winnerPlayer.name, loserNames);
      }
      return true;
    }
    return false;
  }

  // === 回合推进 ===

  private advanceToNextPlayer(): void {
    const aliveIds = new Set(
      Array.from(this.state.players.values())
        .filter((p) => p.isAlive)
        .map((p) => p.id)
    );

    const nextPlayer = this.ruleEngine.getNextAlivePlayer(
      Array.from(this.state.playerOrder) as string[],
      aliveIds,
      this.state.currentTurnId
    );

    if (
      this.state.lastPlayerId &&
      nextPlayer === this.state.lastPlayerId
    ) {
      this.finishRound();
      return;
    }

    this.state.currentTurnId = nextPlayer;
    this.state.timeoutSeconds = TURN_TIMEOUT_SECONDS;
    this.startTurnTimer();
  }

  // === 计时器 ===

  private startTurnTimer(): void {
    this.clearTurnTimer();
    this.state.timeoutSeconds = TURN_TIMEOUT_SECONDS;
    this.turnTimer = setInterval(() => {
      this.state.timeoutSeconds--;
      if (this.state.timeoutSeconds <= 0) {
        this.clearTurnTimer();
        this.handleTimeout();
      }
    }, 1000);
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearInterval(this.turnTimer);
      this.turnTimer = null;
    }
  }

  private handleTimeout(): void {
    const player = this.state.players.get(this.state.currentTurnId);
    if (!player || !player.isAlive) return;

    if (player.hand.length > 0) {
      const randomIndex = Math.floor(Math.random() * player.hand.length);
      const randomCard = player.hand[randomIndex];
      if (randomCard) {
        this.state.lastClaimCard = this.state.targetCard;
        this.state.lastClaimCount = 1;
        this.state.lastPlayerId = this.state.currentTurnId;
        this.state.lastActualCards.clear();
        this.state.lastActualCards.push(randomCard);
        player.hand.splice(randomIndex, 1);
      }
    }

    this.advanceToNextPlayer();
  }

  // === 聊天 ===

  private handleChat(client: Client, text: string): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (!text || text.trim().length === 0) return;
    if (text.length > 200) return;

    const msg = new ChatMessage();
    msg.playerId = client.sessionId;
    msg.playerName = player.name;
    msg.text = text.trim();
    msg.timestamp = Date.now();

    this.state.messages.push(msg);
  }

  // === 工具 ===

  private updateMetadata(): void {
    this.setMetadata({
      roomName: this.state.roomName,
      maxPlayers: MAX_PLAYERS,
      phase: this.state.phase,
    });
  }

  onDispose(): void {
    this.clearTurnTimer();
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
  }
}
