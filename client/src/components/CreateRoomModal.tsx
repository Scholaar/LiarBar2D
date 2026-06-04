import React, { useState } from 'react';
import { gameClient } from '../game/colyseus-client';

interface Props {
  onClose: () => void;
  onCreated: (roomId: string) => void;
}

export const CreateRoomModal: React.FC<Props> = ({ onClose, onCreated }) => {
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!roomName.trim()) return;
    setLoading(true);
    try {
      const room = await gameClient.createGameRoom(roomName.trim());
      onCreated(room.id);
    } catch (err) {
      console.error('Failed to create room:', err);
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
        minWidth: 360, border: '1px solid #30363d',
      }}>
        <h2 style={{ marginBottom: 20, color: '#e94560' }}>创建房间</h2>
        <input
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="输入房间名称..."
          maxLength={20}
          autoFocus
          style={{ width: '100%', padding: '12px', fontSize: 15 }}
        />
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: 10, background: '#30363d', color: '#e6edf3' }}>
            取消
          </button>
          <button onClick={handleCreate}
            disabled={!roomName.trim() || loading}
            style={{ flex: 1, padding: 10, background: '#e94560', color: '#fff', fontWeight: 'bold' }}>
            {loading ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
};
