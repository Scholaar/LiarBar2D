import React, { useState, useEffect } from 'react';
import { gameClient } from '../game/colyseus-client';
import { X, Trophy, Medal } from 'lucide-react';

interface LeaderboardEntry {
  name: string;
  wins: number;
  losses: number;
  winRate: number;
  gamesPlayed: number;
}

interface Props {
  onClose: () => void;
}

export const LeaderboardModal: React.FC<Props> = ({ onClose }) => {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lobby = gameClient.lobbyRoom;
    if (!lobby) {
      setLoading(false);
      return;
    }

    const handler = lobby.onMessage('leaderboard', (entries: LeaderboardEntry[]) => {
      setData(entries);
      setLoading(false);
    });

    lobby.send('get_leaderboard');

    return () => {
      if (typeof handler.unbind === 'function') handler.unbind();
    };
  }, []);

  const rankColors = ['#fbbf24', '#94a3b8', '#d97706']; // gold, silver, bronze

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'var(--bg-overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fade-in var(--transition-fast)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-6)',
        minWidth: 440,
        maxHeight: '80vh',
        overflowY: 'auto',
        animation: 'slide-up var(--transition-base)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 'var(--space-4)',
        }}>
          <h2 style={{
            fontSize: 'var(--text-lg)', fontWeight: 600,
            color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          }}>
            <Trophy size={20} color="var(--color-warning)" />
            排行榜
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

        {/* Content */}
        {loading ? (
          <p style={{
            color: 'var(--text-muted)', textAlign: 'center',
            padding: 'var(--space-10)',
            fontSize: 'var(--text-sm)',
          }}>加载中...</p>
        ) : data.length === 0 ? (
          <p style={{
            color: 'var(--text-muted)', textAlign: 'center',
            padding: 'var(--space-10)',
            fontSize: 'var(--text-sm)',
          }}>暂无数据</p>
        ) : (
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: 'var(--text-sm)',
          }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <th style={{ ...thStyle, width: 40 }}>#</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>玩家</th>
                <th style={thStyle}>胜</th>
                <th style={thStyle}>负</th>
                <th style={thStyle}>胜率</th>
                <th style={thStyle}>场次</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry, i) => (
                <tr
                  key={entry.name}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <td style={{
                    ...tdStyle,
                    color: i < 3 ? rankColors[i] : 'var(--text-muted)',
                    fontWeight: i < 3 ? 700 : 400,
                  }}>
                    {i < 3
                      ? <Medal size={16} fill={rankColors[i]} color={rankColors[i]} style={{ display: 'inline' }} />
                      : i + 1
                    }
                  </td>
                  <td style={{
                    ...tdStyle, textAlign: 'left',
                    color: 'var(--text-primary)', fontWeight: 500,
                  }}>
                    {entry.name}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-success)', fontWeight: 500 }}>
                    {entry.wins}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-danger)', fontWeight: 500 }}>
                    {entry.losses}
                  </td>
                  <td style={{
                    ...tdStyle,
                    color: entry.winRate >= 0.5 ? 'var(--color-success)' : 'var(--color-danger)',
                    fontWeight: 500,
                  }}>
                    {(entry.winRate * 100).toFixed(0)}%
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>
                    {entry.gamesPlayed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-xs)',
  color: 'var(--text-muted)',
  fontWeight: 600,
  textAlign: 'center',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-sm)',
  textAlign: 'center',
};
