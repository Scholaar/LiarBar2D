import { useState, useEffect, useCallback } from 'react';
import { Room } from 'colyseus.js';
import type { GameRoomState } from '../../../server/src/schema/GameRoomState';
import { gameClient } from './colyseus-client';

export function useGameState() {
  const [room, setRoom] = useState<Room<GameRoomState> | null>(null);
  const [state, setState] = useState<GameRoomState | null>(null);

  useEffect(() => {
    const gameRoom = gameClient.gameRoom;
    if (gameRoom) {
      setRoom(gameRoom as any);
      setState(gameRoom.state as any);

      const onChange = gameRoom.onStateChange((newState) => {
        setState({ ...(newState as any) });
      });

      return () => {
        onChange.clear();
      };
    }
  }, []);

  const send = useCallback(
    (type: string, data?: any) => {
      if (room) {
        room.send(type, data);
      }
    },
    [room]
  );

  const getMyPlayer = useCallback(() => {
    if (!room || !state) return null;
    return state.players.get(room.sessionId);
  }, [room, state]);

  return { room, state, send, getMyPlayer, sessionId: room?.sessionId };
}
