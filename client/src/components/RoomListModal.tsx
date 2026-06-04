import React, { useState, useEffect } from 'react';
import { gameClient } from '../game/colyseus-client';

interface Props {
  onClose: () => void;
  onJoin: (roomId: string) => void;
}

interface RoomInfo {
  roomId: string;
  roomName: string;
  playerCount: number;
  maxPlayers: number;
  phase: string;
}

export const RoomListModal: React.FC<Props> = ({ onClose, onJoin }) => {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const lobby = gameClient.lobbyRoom;
    if (!lobby) return;

    const handler = (data: RoomInfo[]) => {
      setRooms(data.filter((r) => r.phase === 'waiting' || r.phase === 'ready'));
    };

    lobby.onMessage('room_list', handler);
    lobby.send('list_rooms');

    const interval = setInterval(() => lobby.send('list_rooms'), 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleJoin = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await gameClient.joinGameRoom(selected);
      onJoin(selected);
    } catch (err) {
      console.error('Failed to join room:', err);
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: '#161b22', borderRadius: 12, padding: 32,
        minWidth: 400, maxHeight: '70vh', overflowY: 'auto',
        border: '1px solid #30363d',
      }}>
        <h2 style={{ marginBottom: 16, color: '#53a8b6' }}>可加入的房间</h2>

        {rooms.length === 0 && (
          <p style={{ color: '#8b949e', textAlign: 'center', padding: 24 }}>
            暂无可加入的房间
          </p>
        )}

        {rooms.map((room) => (
          <div key={room.roomId}
            onClick={() => setSelected(room.roomId)}
            style={{
              padding: '12px 16px',
              marginBottom: 8,
              borderRadius: 8,
              cursor: 'pointer',
              background: selected === room.roomId ? '#1e3a5f' : '#21262d',
              border: selected === room.roomId ? '1px solid #53a8b6' : '1px solid transparent',
            }}>
            <div style={{ fontWeight: 'bold' }}>{room.roomName}</div>
            <div style={{ color: '#8b949e', fontSize: 13, marginTop: 4 }}>
              👥 {room.playerCount}/{room.maxPlayers} · {room.phase}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: 10, background: '#30363d', color: '#e6edf3' }}>
            取消
          </button>
          <button onClick={handleJoin}
            disabled={!selected || loading}
            style={{ flex: 1, padding: 10, background: '#53a8b6', color: '#fff', fontWeight: 'bold' }}>
            {loading ? '加入中...' : '加入'}
          </button>
        </div>
      </div>
    </div>
  );
};
