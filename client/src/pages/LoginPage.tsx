import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const handleStart = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem('playerName', trimmed);
    navigate('/lobby');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0d1117 70%)',
    }}>
      <h1 style={{ fontSize: 48, color: '#e94560', marginBottom: 8 }}>
        🃏 骗子酒馆
      </h1>
      <p style={{ color: '#8b949e', marginBottom: 40, fontSize: 16 }}>
        Liar's Bar · 多人吹牛卡牌游戏
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入你的昵称..."
        maxLength={12}
        autoFocus
        style={{
          width: 280,
          padding: '12px 16px',
          fontSize: 16,
          textAlign: 'center',
        }}
      />
      <button
        onClick={handleStart}
        disabled={!name.trim()}
        style={{
          marginTop: 16,
          padding: '12px 48px',
          fontSize: 18,
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #e94560, #c23152)',
          color: '#fff',
        }}
      >
        进入酒馆
      </button>
    </div>
  );
};
