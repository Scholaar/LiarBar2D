import React, { useState, useEffect } from 'react';
import { gameClient } from '../game/colyseus-client';
import { X, Users, LogIn } from 'lucide-react';

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-overlay)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
      animation: 'fade-in var(--transition-fast)',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    onKeyDown={handleKeyDown}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-6)',
        minWidth: 400,
        maxHeight: '70vh',
        overflowY: 'auto',
        animation: 'slide-up var(--transition-base)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 'var(--space-4)',
        }}>
          <h2 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            可加入的房间
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer',
              padding: 'var(--space-1)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Empty state */}
        {rooms.length === 0 && (
          <p style={{
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: 'var(--space-10) var(--space-6)',
            fontSize: 'var(--text-sm)',
          }}>
            暂无可加入的房间
          </p>
        )}

        {/* Room list */}
        {rooms.map((room) => (
          <div
            key={room.roomId}
            onClick={() => setSelected(room.roomId)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              marginBottom: 'var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              background: selected === room.roomId
                ? 'var(--accent-subtle)'
                : 'var(--bg-base)',
              border: selected === room.roomId
                ? '1px solid var(--accent)'
                : '1px solid var(--border-subtle)',
              transition: 'background-color var(--transition-fast), border-color var(--transition-fast)',
            }}>
            <div>
              <div style={{
                fontWeight: 600,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
              }}>
                {room.roomName}
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                color: 'var(--text-muted)', fontSize: 'var(--text-xs)',
                marginTop: 'var(--space-1)',
              }}>
                <Users size={12} />
                {room.playerCount}/{room.maxPlayers}
                <span style={{
                  display: 'inline-block', width: 4, height: 4,
                  borderRadius: '50%', background: 'var(--text-muted)',
                }} />
                {room.phase === 'ready' ? '准备中' : '等待中'}
              </div>
            </div>
            {selected === room.roomId && (
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--accent)',
              }} />
            )}
          </div>
        ))}

        {/* Actions */}
        <div style={{
          display: 'flex', gap: 'var(--space-3)',
          marginTop: 'var(--space-4)',
        }}>
          <button onClick={onClose}
            style={{
              flex: 1, padding: 'var(--space-3)',
              background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)',
              fontWeight: 500, border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}>
            取消
          </button>
          <button onClick={handleJoin}
            disabled={!selected || loading}
            style={{
              flex: 1, padding: 'var(--space-3)',
              background: 'var(--color-info)', color: '#000',
              borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)',
              fontWeight: 600, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 'var(--space-2)', cursor: 'pointer',
            }}>
            <LogIn size={16} />
            {loading ? '加入中...' : '加入'}
          </button>
        </div>
      </div>
    </div>
  );
};
