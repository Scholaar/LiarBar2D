import { useState, useEffect, useCallback, useRef } from 'react';
import { Room } from 'colyseus.js';
import { GameRoomState, Player } from '../../../server/src/schema/GameRoomState';
import { gameClient } from './colyseus-client';

interface SyncedState {
  phase: string;
  roomName: string;
  roomId: string;
  playerOrder: string[];
  players: Map<string, Player>;
  currentTurnId: string;
  targetCard: string;
  roundNumber: number;
  timeoutSeconds: number;
  lastClaimCard: string;
  lastClaimCount: number;
  lastPlayerId: string;
  lastActualCards: string[];
  messages: any[];
  winnerId: string;
  eliminationOrder: string[];
  roulettePlayerId: string | null;
  rouletteGotShot: boolean | null;
  challengeChallengerId: string | null;
  challengeDefenderId: string | null;
  challengeActualCards: string[];
  challengeTargetCard: string;
  challengeDeclaredCount: number;
  challengeIsTruth: boolean;
}

export function useGameState() {
  const [room, setRoom] = useState<Room<GameRoomState> | null>(null);
  const schemaStateRef = useRef<GameRoomState | null>(null);
  const emptyState: SyncedState = { phase: '', roomName: '', roomId: '', playerOrder: [], players: new Map(), currentTurnId: '', targetCard: '', roundNumber: 0, timeoutSeconds: 15, lastClaimCard: '', lastClaimCount: 0, lastPlayerId: '', lastActualCards: [], messages: [], winnerId: '', eliminationOrder: [], roulettePlayerId: null, rouletteGotShot: false, challengeChallengerId: null, challengeDefenderId: null, challengeActualCards: [], challengeTargetCard: '', challengeDeclaredCount: 0, challengeIsTruth: false };
  const syncStateRef = useRef<SyncedState>(emptyState);
  const [stateVersion, setStateVersion] = useState(0);

  const mergeState = useCallback((): SyncedState => {
    const schema = schemaStateRef.current;
    const sync = syncStateRef.current;
    return {
      phase: sync.phase ?? (schema as any)?.phase ?? '',
      roomName: sync.roomName ?? (schema as any)?.roomName ?? '',
      roomId: sync.roomId ?? (schema as any)?.roomId ?? '',
      playerOrder: sync.playerOrder ?? (schema as any)?.playerOrder ?? [],
      players: sync.players ?? (schema as any)?.players ?? new Map(),
      currentTurnId: sync.currentTurnId ?? (schema as any)?.currentTurnId ?? '',
      targetCard: sync.targetCard ?? (schema as any)?.targetCard ?? '',
      roundNumber: sync.roundNumber ?? (schema as any)?.roundNumber ?? 0,
      timeoutSeconds: sync.timeoutSeconds ?? (schema as any)?.timeoutSeconds ?? 15,
      lastClaimCard: sync.lastClaimCard ?? (schema as any)?.lastClaimCard ?? '',
      lastClaimCount: sync.lastClaimCount ?? (schema as any)?.lastClaimCount ?? 0,
      lastPlayerId: sync.lastPlayerId ?? (schema as any)?.lastPlayerId ?? '',
      lastActualCards: sync.lastActualCards ?? (schema as any)?.lastActualCards ?? [],
      messages: sync.messages ?? (schema as any)?.messages ?? [],
      winnerId: sync.winnerId ?? (schema as any)?.winnerId ?? '',
      eliminationOrder: sync.eliminationOrder ?? (schema as any)?.eliminationOrder ?? [],
      roulettePlayerId: sync.roulettePlayerId ?? null,
      rouletteGotShot: sync.rouletteGotShot ?? false,
      challengeChallengerId: sync.challengeChallengerId ?? null,
      challengeDefenderId: sync.challengeDefenderId ?? null,
      challengeActualCards: sync.challengeActualCards ?? [],
      challengeTargetCard: sync.challengeTargetCard ?? '',
      challengeDeclaredCount: sync.challengeDeclaredCount ?? 0,
      challengeIsTruth: sync.challengeIsTruth ?? false,
    };
  }, []);

  const [state, setState] = useState<SyncedState>(emptyState);

  useEffect(() => {
    const gameRoom = gameClient.gameRoom;
    console.log(`[useGameState] init — gameClient.gameRoom=${!!gameRoom}`);
    if (gameRoom) {
      schemaStateRef.current = gameRoom.state as any;
      setRoom(gameRoom as any);

      // Apply initial state
      const merged = mergeState();
      setState(merged);
      setStateVersion((n) => n + 1);
      console.log(`[useGameState] init — sessionId=${gameRoom.sessionId}, phase=${merged.phase}, playerCount=${merged.playerOrder?.length}`);

      const onChange = gameRoom.onStateChange((newState) => {
        schemaStateRef.current = newState as any;
        const merged = mergeState();
        setState(merged);
        setStateVersion((n) => n + 1);
        console.log(`[useGameState] onStateChange — phase=${merged.phase}, playerCount=${merged.playerOrder?.length}`);
      });

      // Handle manual sync_state messages from server
      const onSyncState = gameRoom.onMessage('sync_state', (data: any) => {
        console.log(`[useGameState] sync_state received — phase=${data.phase}, playerCount=${data.playerOrder?.length}`);
        // Build Player instances from synced data
        const playersMap = new Map<string, Player>();
        if (data.players) {
          for (const p of data.players) {
            const player = new Player();
            player.id = p.id;
            player.name = p.name;
            player.isReady = p.isReady;
            player.isHost = p.isHost;
            player.isAlive = p.isAlive;
            player.isConnected = p.isConnected;
            if (p.hand) p.hand.forEach((c: string) => player.hand.push(c));
            player.rouletteCount = p.rouletteCount;
            playersMap.set(p.id, player);
          }
        }
        syncStateRef.current = {
          phase: data.phase ?? '',
          roomName: data.roomName ?? '',
          roomId: data.roomId ?? '',
          playerOrder: data.playerOrder || [],
          players: playersMap,
          currentTurnId: data.currentTurnId ?? '',
          targetCard: data.targetCard ?? '',
          roundNumber: data.roundNumber ?? 0,
          timeoutSeconds: data.timeoutSeconds ?? 15,
          lastClaimCard: data.lastClaimCard ?? '',
          lastClaimCount: data.lastClaimCount ?? 0,
          lastPlayerId: data.lastPlayerId ?? '',
          lastActualCards: data.lastActualCards || [],
          messages: data.messages || [],
          winnerId: data.winnerId ?? '',
          eliminationOrder: data.eliminationOrder || [],
          roulettePlayerId: data.roulettePlayerId ?? null,
          rouletteGotShot: data.rouletteGotShot ?? false,
          challengeChallengerId: data.challengeChallengerId ?? null,
          challengeDefenderId: data.challengeDefenderId ?? null,
          challengeActualCards: data.challengeActualCards ?? [],
          challengeTargetCard: data.challengeTargetCard ?? '',
          challengeDeclaredCount: data.challengeDeclaredCount ?? 0,
          challengeIsTruth: data.challengeIsTruth ?? false,
        };
        const merged = mergeState();
        setState(merged);
        setStateVersion((n) => n + 1);
      });

      return () => {
        console.log(`[useGameState] cleanup — clearing handlers`);
        onChange.clear();
        // onMessage returns nanoevents subscription with .unbind()
        if (typeof onSyncState === 'function') {
          onSyncState();
        } else if (onSyncState && typeof onSyncState.unbind === 'function') {
          onSyncState.unbind();
        } else if (onSyncState && typeof onSyncState.clear === 'function') {
          onSyncState.clear();
        }
      };
    } else {
      console.warn(`[useGameState] init — gameClient.gameRoom is NULL!`);
    }
  }, [mergeState]);

  const send = useCallback(
    (type: string, data?: any) => {
      console.log(`[useGameState] send('${type}') called, room=${!!room}, sessionId=${room?.sessionId}`);
      if (room) {
        room.send(type, data);
        console.log(`[useGameState] send('${type}') — message sent`);
      } else {
        console.warn(`[useGameState] send('${type}') — room is null, message NOT sent!`);
      }
    },
    [room]
  );

  const getMyPlayer = useCallback(() => {
    if (!room || !state.players) return null;
    return state.players.get(room.sessionId) || null;
  }, [room, state]);

  return { room, state, send, getMyPlayer, sessionId: room?.sessionId };
}
