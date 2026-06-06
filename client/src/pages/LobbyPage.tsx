import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameClient } from '../game/colyseus-client';
import { CreateRoomModal } from '../components/CreateRoomModal';
import { RoomListModal } from '../components/RoomListModal';
import { LeaderboardModal } from '../components/LeaderboardModal';
import {
  Home,
  Search,
  Trophy,
  User,
} from 'lucide-react';

export const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showRoomList, setShowRoomList] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [playerName] = useState(() =>
    localStorage.getItem('playerName') || 'Player'
  );

  useEffect(() => {
    gameClient.joinLobby().catch(console.error);
    return () => {
      gameClient.leaveLobby();
    };
  }, []);

  const handleRoomCreated = (roomId: string) => {
    setShowCreateRoom(false);
    navigate(`/room/${roomId}`);
  };

  const handleRoomJoined = (roomId: string) => {
    setShowRoomList(false);
    navigate(`/room/${roomId}`);
  };

  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-4) var(--space-6)',
    fontSize: 'var(--text-base)',
    fontWeight: 600,
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    width: 260,
    justifyContent: 'flex-start',
    transition: 'background-color var(--transition-fast), border-color var(--transition-fast)',
    cursor: 'pointer',
    outline: 'none',
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: 'var(--bg-base)',
      gap: 'var(--space-3)',
    }}>
      {/* Header */}
      <h1 style={{
        fontSize: 'var(--text-3xl)',
        fontWeight: 700,
        color: 'var(--text-primary)',
        letterSpacing: '-0.01em',
        marginBottom: 'var(--space-1)',
      }}>
        骗子酒馆
      </h1>
      <p style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-8)',
      }}>
        <User size={14} />
        {playerName}
      </p>

      {/* Menu */}
      <button
        onClick={() => setShowCreateRoom(true)}
        style={btnStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-elevated)';
          e.currentTarget.style.borderColor = 'var(--accent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-surface)';
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
        }}
      >
        <Home size={20} />
        创建房间
      </button>

      <button
        onClick={() => setShowRoomList(true)}
        style={btnStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-elevated)';
          e.currentTarget.style.borderColor = 'var(--color-info)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-surface)';
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
        }}
      >
        <Search size={20} />
        加入房间
      </button>

      <button
        onClick={() => setShowLeaderboard(true)}
        style={btnStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-elevated)';
          e.currentTarget.style.borderColor = 'var(--color-warning)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-surface)';
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
        }}
      >
        <Trophy size={20} />
        排行榜
      </button>

      {/* Modals */}
      {showCreateRoom && (
        <CreateRoomModal
          onClose={() => setShowCreateRoom(false)}
          onCreated={handleRoomCreated}
        />
      )}
      {showRoomList && (
        <RoomListModal
          onClose={() => setShowRoomList(false)}
          onJoin={handleRoomJoined}
        />
      )}
      {showLeaderboard && (
        <LeaderboardModal
          onClose={() => setShowLeaderboard(false)}
        />
      )}
    </div>
  );
};
