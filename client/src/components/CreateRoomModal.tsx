import React, { useState } from 'react';
import { gameClient } from '../game/colyseus-client';
import { X, Plus } from 'lucide-react';

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-overlay)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
      animation: 'fade-in var(--transition-fast)',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-6)',
        minWidth: 360,
        animation: 'slide-up var(--transition-base)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 'var(--space-5)',
        }}>
          <h2 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            创建房间
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

        {/* Input */}
        <input
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="房间名称"
          maxLength={20}
          autoFocus
          style={{
            width: '100%',
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 'var(--text-base)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />

        {/* Actions */}
        <div style={{
          display: 'flex', gap: 'var(--space-3)',
          marginTop: 'var(--space-5)',
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: 'var(--space-3)',
              background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)',
              fontWeight: 500, border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}>
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={!roomName.trim() || loading}
            style={{
              flex: 1, padding: 'var(--space-3)',
              background: 'var(--accent)', color: '#fff',
              borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)',
              fontWeight: 600, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 'var(--space-2)', cursor: 'pointer',
            }}>
            <Plus size={16} />
            {loading ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
};
