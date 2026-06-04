import { Room, Client, matchMaker } from 'colyseus';

interface RoomListing {
  roomId: string;
  roomName: string;
  playerCount: number;
  maxPlayers: number;
  phase: string;
}

export class LobbyRoom extends Room {
  onCreate(): void {
    this.onMessage('list_rooms', (client: Client) => {
      this.sendRoomList(client);
    });
  }

  async onJoin(client: Client): Promise<void> {
    await this.sendRoomList(client);
  }

  private async sendRoomList(client: Client): Promise<void> {
    const rooms = await this.getRoomList();
    client.send('room_list', rooms);
  }

  private async getRoomList(): Promise<RoomListing[]> {
    try {
      const rooms = await matchMaker.query({});
      const gameRooms = rooms.filter((r) => r.name === 'game_room');
      return gameRooms.map((r) => ({
        roomId: r.roomId,
        roomName: (r.metadata as any)?.roomName || 'Unknown',
        playerCount: r.clients,
        maxPlayers: (r.metadata as any)?.maxPlayers || 4,
        phase: (r.metadata as any)?.phase || 'waiting',
      }));
    } catch {
      return [];
    }
  }
}
