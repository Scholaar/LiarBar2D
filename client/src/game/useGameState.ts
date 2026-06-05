import { useState, useEffect, useCallback } from 'react';
import { Room } from 'colyseus.js';
import type { GameRoomState } from '../../../server/src/schema/GameRoomState';
import { gameClient } from './colyseus-client';

export function useGameState() {
  const [room, setRoom] = useState<Room<GameRoomState> | null>(null);
  const [state, setState] = useState<GameRoomState | null>(null);

  useEffect(() => {
    const gameRoom = gameClient.gameRoom;
    console.log(`[useGameState] init — gameClient.gameRoom=${!!gameRoom}, state keys=${gameRoom ? Object.keys(gameRoom.state || {}) : 'N/A'}`);
    if (gameRoom) {
      setRoom(gameRoom as any);
      setState(gameRoom.state as any);
      console.log(`[useGameState] init — room and state set, sessionId=${gameRoom.sessionId}`);

      const onChange = gameRoom.onStateChange((newState) => {
        console.log(`[useGameState] onStateChange fired`);
        setState({ ...(newState as any) });
      });

      return () => {
        console.log(`[useGameState] cleanup — clearing onChange`);
        onChange.clear();
      };
    } else {
      console.warn(`[useGameState] init — gameClient.gameRoom is NULL!`);
    }
  }, []);

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
    if (!room || !state) return null;
    return state.players.get(room.sessionId);
  }, [room, state]);

  return { room, state, send, getMyPlayer, sessionId: room?.sessionId };
}
