import { Client, Room } from 'colyseus.js';
import { GameRoomState } from '../../../server/src/schema/GameRoomState';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:2567';

class GameClient {
  private client: Client;
  private _lobbyRoom: Room | null = null;
  private _gameRoom: Room<GameRoomState> | null = null;

  constructor() {
    this.client = new Client(WS_URL);
  }

  get lobbyRoom(): Room | null {
    return this._lobbyRoom;
  }

  get gameRoom(): Room<GameRoomState> | null {
    return this._gameRoom;
  }

  async joinLobby(): Promise<Room> {
    this._lobbyRoom = await this.client.joinOrCreate('lobby');
    return this._lobbyRoom;
  }

  async createGameRoom(roomName: string): Promise<Room<GameRoomState>> {
    const playerName = localStorage.getItem('playerName') || 'Player';
    this._gameRoom = await this.client.create('game_room', {
      roomName,
      playerName,
    }, GameRoomState);
    return this._gameRoom;
  }

  async joinGameRoom(roomId: string): Promise<Room<GameRoomState>> {
    const playerName = localStorage.getItem('playerName') || 'Player';
    this._gameRoom = await this.client.joinById(roomId, { playerName }, GameRoomState);
    return this._gameRoom;
  }

  async reconnectGameRoom(roomId: string, sessionId: string): Promise<Room<GameRoomState>> {
    const reconnectionToken = `${roomId}:${sessionId}`;
    this._gameRoom = await this.client.reconnect(reconnectionToken, GameRoomState);
    return this._gameRoom;
  }

  leaveGameRoom(): void {
    this._gameRoom?.leave();
    this._gameRoom = null;
  }

  leaveLobby(): void {
    this._lobbyRoom?.leave();
    this._lobbyRoom = null;
  }
}

export const gameClient = new GameClient();
