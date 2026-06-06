import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';

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
      backgroundColor: 'var(--bg-base)',
      padding: 'var(--space-6)',
    }}>
      {/* Logo / Title */}
      <h1 style={{
        fontSize: 'var(--text-5xl)',
        fontWeight: 700,
        color: 'var(--text-primary)',
        letterSpacing: '-0.02em',
        marginBottom: 'var(--space-2)',
      }}>
        骗子酒馆
      </h1>
      <p style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--text-muted)',
        marginBottom: 'var(--space-12)',
        letterSpacing: '0.05em',
      }}>
        Liar&rsquo;s Bar
      </p>

      {/* Input */}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入昵称"
        maxLength={12}
        autoFocus
        style={{
          width: 280,
          padding: 'var(--space-3) var(--space-4)',
          fontSize: 'var(--text-base)',
          textAlign: 'center',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-primary)',
          outline: 'none',
          transition: 'border-color var(--transition-fast)',
        }}
      />

      {/* Submit */}
      <button
        onClick={handleStart}
        disabled={!name.trim()}
        style={{
          marginTop: 'var(--space-4)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-12)',
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          background: 'var(--accent)',
          color: '#fff',
          borderRadius: 'var(--radius-sm)',
          transition: 'background-color var(--transition-fast)',
        }}
      >
        <LogIn size={18} />
        进入酒馆
      </button>
    </div>
  );
};
