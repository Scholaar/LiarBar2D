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

  // Roulette visual tracking (not part of Colyseus state, sent via sync_state)
  private roulettePlayerId: string | null = null;
  private rouletteGotShot: boolean | null = null;

  // Challenge visual tracking
  private challengeChallengerId: string | null = null;
  private challengeDefenderId: string | null = null;
  private challengeActualCards: string[] = [];
  private challengeTargetCard: string = '';
  private challengeDeclaredCount: number = 0;
  private challengeIsTruth: boolean = false;

  onCreate(options: { roomName: string }): void {
    const state = new GameRoomState();
    // Set state FIRST so the serializer is wired up, THEN assign values
    // to ensure Colyseus Schema change tracking records all mutations.
    this.setState(state);

    state.roomName = options.roomName;
    state.roomId = this.roomId;
    state.phase = 'waiting';
    // Force a non-default value change to ensure encoding picks up primitive fields
    state.timeoutSeconds = 15;

    console.log(`[GameRoom] onCreate — roomId=${this.roomId}, roomName=${options.roomName}, phase=${state.phase}, playerOrder=${state.playerOrder.length}`);

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
    this.onMessage('disband_room', (client) => this.handleDisband(client));
    this.onMessage('continue_game', (client) => this.handleContinueGame(client));
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
    console.log(`[GameRoom] onJoin — sessionId=${client.sessionId}, playerName=${options.playerName}, playerCount=${this.state.playerOrder.length}, phase=${this.state.phase}`);
    this.updateMetadata();

    // Broadcast full state to all clients (including the new one)
    this.broadcastSyncState();
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (consented) {
      this.state.players.delete(client.sessionId);
      const idx = this.state.playerOrder.indexOf(client.sessionId);
      if (idx >= 0) this.state.playerOrder.splice(idx, 1);
      this.reassignHost();
      this.broadcastSyncState();
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
      this.broadcastSyncState();
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
      this.broadcastSyncState();
    }
  }

  // === 状态广播（绕过 Colyseus Schema 序列化问题） ===

  private broadcastSyncState(): void {
    // Build public player data (without hands)
    const allPlayers = Array.from(this.state.players.entries()).map(([id, p]) => ({
      id: p.id,
      name: p.name,
      isReady: p.isReady,
      isHost: p.isHost,
      isAlive: p.isAlive,
      isConnected: p.isConnected,
      hand: Array.from(p.hand),
      rouletteCount: p.rouletteCount,
    }));

    // Send per-client state — only include that client's own hand
    for (const client of this.clients) {
      const playersForClient = allPlayers.map((p) => ({
        ...p,
        hand: p.id === client.sessionId ? p.hand : [],
      }));

      client.send('sync_state', {
        phase: this.state.phase,
        roomName: this.state.roomName,
        roomId: this.state.roomId,
        playerOrder: Array.from(this.state.playerOrder),
        players: playersForClient,
        currentTurnId: this.state.currentTurnId,
        targetCard: this.state.targetCard,
        roundNumber: this.state.roundNumber,
        timeoutSeconds: this.state.timeoutSeconds,
        lastClaimCard: this.state.lastClaimCard,
        lastClaimCount: this.state.lastClaimCount,
        lastPlayerId: this.state.lastPlayerId,
        messages: Array.from(this.state.messages).map((m) => ({
          playerId: m.playerId,
          playerName: m.playerName,
          text: m.text,
          timestamp: m.timestamp,
        })),
        winnerId: this.state.winnerId,
        eliminationOrder: Array.from(this.state.eliminationOrder),
        roulettePlayerId: this.roulettePlayerId,
        rouletteGotShot: this.rouletteGotShot,
        challengeChallengerId: this.challengeChallengerId,
        challengeDefenderId: this.challengeDefenderId,
        challengeActualCards: this.challengeActualCards,
        challengeTargetCard: this.challengeTargetCard,
        challengeDeclaredCount: this.challengeDeclaredCount,
        challengeIsTruth: this.challengeIsTruth,
      });
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
    this.broadcastSyncState();
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

  private handleDisband(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.isHost) return;
    if (this.state.phase !== 'waiting' && this.state.phase !== 'ready') return;
    console.log(`[GameRoom] disband — host ${player.name} disbands room`);
    // Force-disconnect all clients, which will auto-dispose the room
    this.broadcast('room_closed', { message: '房主已解散房间' });
    setTimeout(() => this.disconnect(), 500);
  }

  private handleContinueGame(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (this.state.phase !== 'game_over') return;
    console.log(`[GameRoom] continue_game — ${player.name} starts new round`);
    // Reset game state
    this.state.winnerId = '';
    this.state.eliminationOrder.clear();
    // Revive all dead players and reset their state
    for (const [, p] of this.state.players) {
      p.isAlive = true;
      p.rouletteCount = 0;
      p.isReady = false;
    }
    // Start new round
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
    this.broadcastSyncState();
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
    this.broadcastSyncState();
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
    this.broadcastSyncState();
  }

  // === 相信 ===

  private handlePass(client: Client): void {
    if (this.state.phase !== 'playing') return;
    if (this.state.currentTurnId !== client.sessionId) return;
    if (!this.state.lastPlayerId) return;
    this.advanceToNextPlayer();
    this.broadcastSyncState();
  }

  // === 质疑 ===

  private handleChallenge(client: Client): void {
    console.log(`[GameRoom] handleChallenge — client=${client.sessionId}, phase=${this.state.phase}, currentTurnId=${this.state.currentTurnId}, lastPlayerId=${this.state.lastPlayerId}`);
    if (this.state.phase !== 'playing') return;
    if (this.state.currentTurnId !== client.sessionId) return;
    if (!this.state.lastPlayerId) return;

    const actualCards = [...this.state.lastActualCards];
    const result = this.ruleEngine.verifyClaim(
      actualCards as any,
      this.state.targetCard as TargetCard,
      this.state.lastClaimCount
    );

    // challenge success = defender lied and challenger caught them
    const challengeSuccess = !result.isTruth;
    const loserId = result.isTruth
      ? client.sessionId          // truth was told, challenger wrongly accused → challenger loses
      : this.state.lastPlayerId;  // lie was caught, defender loses

    // Store challenge info for visual display
    this.challengeChallengerId = client.sessionId;
    this.challengeDefenderId = this.state.lastPlayerId;
    this.challengeActualCards = actualCards;
    this.challengeTargetCard = this.state.targetCard;
    this.challengeDeclaredCount = this.state.lastClaimCount;
    this.challengeIsTruth = result.isTruth;

    console.log(`[GameRoom] handleChallenge — actualCards=[${actualCards.join(',')}], targetCard=${this.state.targetCard}, isTruth=${result.isTruth}, challengeSuccess=${challengeSuccess}, loserId=${loserId}`);

    this.executeRoulette(loserId);
  }

  // === 轮盘 ===

  private executeRoulette(playerId: string): void {
    this.state.phase = 'roulette';
    this.clearTurnTimer();

    const player = this.state.players.get(playerId);
    if (!player) return;
    const playerName = player.name;

    const hasChallenge = this.challengeChallengerId !== null;

    if (hasChallenge) {
      // Phase 1: Show challenge info first (3s), roulettePlayerId not set yet
      this.roulettePlayerId = null;
      this.rouletteGotShot = null;
      console.log(`[GameRoom] executeRoulette — showing challenge info first (no roulette player yet)`);
      this.broadcastSyncState();

      // Phase 2: After 3s, start roulette spin
      setTimeout(() => {
        if (this.state.phase !== 'roulette') return;
        this.doRouletteSpin(player, playerName);
      }, 3000);
    } else {
      // No challenge — start roulette directly
      this.roulettePlayerId = playerId;
      this.rouletteGotShot = null;
      console.log(`[GameRoom] executeRoulette — no challenge, roulette directly for ${playerName}`);
      this.broadcastSyncState();
      this.doRouletteSpin(player, playerName);
    }
  }

  private doRouletteSpin(player: Player, playerName: string): void {
    this.roulettePlayerId = player.id;
    this.rouletteGotShot = null as any;
    console.log(`[GameRoom] doRouletteSpin — spinning for ${playerName}`);
    this.broadcastSyncState();

    // After 1.5s, reveal result
    setTimeout(() => {
      if (this.state.phase !== 'roulette') return;

      const gotShot = this.rouletteEngine.spin(player.rouletteCount);
      this.rouletteGotShot = gotShot;
      console.log(`[GameRoom] doRouletteSpin — player=${playerName}, gotShot=${gotShot}`);

      if (gotShot) {
        player.isAlive = false;
        this.state.eliminationOrder.push(player.name);
        this.broadcastSyncState();
        if (this.checkGameEnd()) return;
      } else {
        player.rouletteCount++;
      }

      this.broadcastSyncState();

      // After 2.5s, clear and finish round
      setTimeout(() => {
        if (this.state.phase === 'roulette') {
          this.roulettePlayerId = null;
          this.rouletteGotShot = false;
          this.finishRound();
        }
      }, 2500);
    }, 1500);
  }

  private finishRound(): void {
    this.roulettePlayerId = null;
    this.rouletteGotShot = false;
    this.challengeChallengerId = null;
    this.challengeDefenderId = null;
    this.challengeActualCards = [];
    this.challengeTargetCard = '';
    this.challengeDeclaredCount = 0;
    this.challengeIsTruth = false;
    this.state.lastClaimCard = '';
    this.state.lastClaimCount = 0;
    this.state.lastPlayerId = '';
    this.state.lastActualCards.clear();

    if (this.checkGameEnd()) return;

    this.state.phase = 'round_end';
    this.broadcastSyncState();
    setTimeout(() => this.startNewRound(), 1000);
  }

  // === 胜利检查 ===

  private checkGameEnd(): boolean {
    const alivePlayers = Array.from(this.state.players.values()).filter(
      (p) => p.isAlive
    );
    const winner = this.ruleEngine.checkWinCondition(alivePlayers.map((p) => p.id));
    console.log(`[GameRoom] checkGameEnd — totalPlayers=${this.state.players.size}, aliveCount=${alivePlayers.length}, aliveIds=[${alivePlayers.map(p => p.id).join(',')}], winner=${winner}`);
    if (winner) {
      this.state.phase = 'game_over';
      this.state.winnerId = winner;
      this.clearTurnTimer();
      this.broadcastSyncState();

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
    const alivePlayers = Array.from(this.state.players.values()).filter((p) => p.isAlive);
    const aliveIds = new Set(alivePlayers.map((p) => p.id));
    // Players who still have cards — players with empty hands are skipped
    const canPlayIds = new Set(alivePlayers.filter((p) => p.hand.length > 0).map((p) => p.id));

    console.log(`[GameRoom] advanceToNextPlayer — currentTurnId=${this.state.currentTurnId}, aliveIds=[${Array.from(aliveIds).join(',')}], canPlayIds=[${Array.from(canPlayIds).join(',')}]`);

    // If all alive players have played all their cards and no one challenged,
    // the last player to play goes through roulette.
    if (canPlayIds.size === 0 && this.state.lastPlayerId) {
      const lastPlayer = this.state.players.get(this.state.lastPlayerId);
      if (lastPlayer && lastPlayer.isAlive) {
        console.log(`[GameRoom] advanceToNextPlayer — all cards played, no challenges, ${lastPlayer.name} goes to roulette`);
        this.executeRoulette(this.state.lastPlayerId);
        return;
      }
    }

    const nextPlayer = this.ruleEngine.getNextAlivePlayer(
      Array.from(this.state.playerOrder) as string[],
      canPlayIds.size > 0 ? canPlayIds : aliveIds,
      this.state.currentTurnId
    );

    console.log(`[GameRoom] advanceToNextPlayer — nextPlayer=${nextPlayer}, lastPlayerId=${this.state.lastPlayerId}`);

    if (
      this.state.lastPlayerId &&
      nextPlayer === this.state.lastPlayerId
    ) {
      console.log(`[GameRoom] advanceToNextPlayer — round finished (next === last), calling finishRound`);
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
    this.broadcastSyncState();
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
    this.broadcastSyncState();
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
