import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameClient } from '../game/colyseus-client';
import { CreateRoomModal } from '../components/CreateRoomModal';
import { RoomListModal } from '../components/RoomListModal';

export const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showRoomList, setShowRoomList] = useState(false);
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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0d1117 70%)',
      gap: 16,
    }}>
      <h1 style={{ color: '#e94560', fontSize: 36 }}>🃏 骗子酒馆</h1>
      <p style={{ color: '#8b949e' }}>欢迎，{playerName}</p>

      <button
        onClick={() => setShowCreateRoom(true)}
        style={{
          padding: '14px 40px',
          fontSize: 18,
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #e94560, #c23152)',
          color: '#fff',
          width: 240,
        }}
      >
        🏠 创建房间
      </button>

      <button
        onClick={() => setShowRoomList(true)}
        style={{
          padding: '14px 40px',
          fontSize: 18,
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #53a8b6, #3a7d8c)',
          color: '#fff',
          width: 240,
        }}
      >
        🔍 加入房间
      </button>

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
    </div>
  );
};
