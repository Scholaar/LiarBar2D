import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gameClient } from '../game/colyseus-client';
import { useGameState } from '../game/useGameState';
import { bindGameKeys } from '../game/keyboard';
import type { Player } from '../../../server/src/schema/GameRoomState';

// Placeholder components (to be replaced by actual implementations)
const GameHeader: React.FC<{ state: any; mySessionId: any }> = ({ state, mySessionId }) => (
  <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(26,26,46,0.9)', border: '1px solid #f0a500', borderRadius: 8, padding: '10px 14px', zIndex: 10 }}>
    {state?.targetCard && <div style={{ color: '#f0a500', fontSize: 14 }}>🎯 目标牌：<strong style={{ fontSize: 20 }}>{state.targetCard}</strong></div>}
    <div style={{ color: '#ccc', fontSize: 12, marginTop: 4 }}>第 {state?.roundNumber} 轮</div>
    {state?.phase === 'playing' && <div style={{ color: '#e94560', fontSize: 14, fontWeight: 'bold', marginTop: 4 }}>⏱ 剩余 {state?.timeoutSeconds} 秒</div>}
  </div>
);

const PlayerSlot: React.FC<{ player: any; position: string; isCurrentTurn: boolean }> = ({ player, isCurrentTurn }) => (
  <div style={{
    background: isCurrentTurn ? '#1e3a5f' : '#161b22',
    border: `2px solid ${isCurrentTurn ? '#e94560' : '#555'}`,
    borderRadius: 8, padding: '8px 14px', textAlign: 'center',
    opacity: player?.isAlive ? 1 : 0.5,
    filter: player?.isAlive ? 'none' : 'grayscale(100%)',
  }}>
    <div style={{ fontWeight: 'bold', fontSize: 13, color: player?.isAlive ? '#e6edf3' : '#666' }}>
      {player?.isAlive ? '👤' : '💀'} {player?.name}
    </div>
    {player?.isAlive && <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>
      🂠 ×{player?.hand?.length || 0}
    </div>}
  </div>
);

const PlayArea: React.FC<{ state: any }> = ({ state }) => (
  <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
    <div style={{ width: '100%', maxWidth: 400, minHeight: 140, background: 'rgba(30,58,30,0.3)', border: '2px dashed #2d6a4f', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {state?.lastPlayerId ? (
        <span style={{ color: '#e6edf3' }}>{state.lastClaimCount} 张 {state.lastClaimCard}</span>
      ) : (
        <span style={{ color: '#2d6a4f' }}>桌面出牌区</span>
      )}
    </div>
  </div>
);

export const GameRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { state, send, getMyPlayer, sessionId } = useGameState();

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
  const [showChat, setShowChat] = useState(false);
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await gameClient.joinGameRoom(roomId!);
      } catch {
        navigate('/lobby');
      }
    })();
    return () => { gameClient.leaveGameRoom(); };
  }, [roomId, navigate]);

  // Force re-render on state change
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const gameRoom = gameClient.gameRoom;
    if (!gameRoom) return;
    const onChange = gameRoom.onStateChange(() => forceUpdate((n) => n + 1));
    const onLeave = () => setDisconnected(true);
    gameRoom.onLeave(onLeave);
    return () => {
      onChange.clear();
      gameRoom.onLeave(() => {});
    };
  }, []);

  useEffect(() => {
    return bindGameKeys({
      onLeft: () => setSelectedIdx((i) => Math.max(0, i - 1)),
      onRight: () => {
        const player = getMyPlayer();
        if (player) setSelectedIdx((i) => Math.min((player.hand?.length || 1) - 1, i + 1));
      },
      onSelect: () => {
        setSelectedCards((prev) => {
          const next = new Set(prev);
          if (next.has(selectedIdx)) next.delete(selectedIdx);
          else next.add(selectedIdx);
          return next;
        });
      },
      onPlay: () => {
        if (selectedCards.size === 0) return;
        const player = getMyPlayer();
        if (!player || !state) return;
        const cards = Array.from(selectedCards).map((i) => player.hand[i]);
        if (cards.length < 1 || cards.length > 3) return;
        send('play_cards', { cards, declaredCard: state.targetCard, declaredCount: cards.length });
        setSelectedCards(new Set());
      },
      onChallenge: () => { send('challenge'); },
      onChat: () => { setShowChat((prev) => !prev); },
    });
  }, [selectedIdx, selectedCards, state, getMyPlayer, send]);

  if (!state) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d1117' }}>
      <p style={{ color: '#e94560', fontSize: 20 }}>连接中...</p>
    </div>;
  }

  const myPlayer = getMyPlayer();
  if (!sessionId) return null;

  const order = state.playerOrder;
  const myIdx = order.indexOf(sessionId);
  const allPlayers = order.map((id) => state.players.get(id)).filter(Boolean) as Player[];
  const opponents = allPlayers.filter((p) => p.id !== sessionId);

  const topPlayer = opponents.length >= 3
    ? (() => { const topIdx = (myIdx + 2) % 4; const topId = order[topIdx]; return topId ? state.players.get(topId) || null : null; })()
    : null;
  const sideOpponents = topPlayer
    ? opponents.filter((p) => p.id !== topPlayer.id)
    : opponents;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0d1117 70%)', position: 'relative' }}>
      {disconnected && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#e94560', fontSize: 24 }}>连接断开，重连中...</p>
        </div>
      )}

      <GameHeader state={state} mySessionId={sessionId} />

      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
        {topPlayer && <PlayerSlot player={topPlayer} position="top" isCurrentTurn={state.currentTurnId === topPlayer.id} />}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
        <div style={{ width: 140 }}>
          {sideOpponents[0] && <PlayerSlot player={sideOpponents[0]} position="left" isCurrentTurn={state.currentTurnId === sideOpponents[0].id} />}
        </div>
        <PlayArea state={state} />
        <div style={{ width: 140 }}>
          {sideOpponents[1] && <PlayerSlot player={sideOpponents[1]} position="right" isCurrentTurn={state.currentTurnId === sideOpponents[1].id} />}
        </div>
      </div>

      {/* Bottom: chat + hand + buttons */}
      <div style={{ display: 'flex', padding: '12px 16px', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ width: 220, background: 'rgba(13,17,23,0.9)', border: '1px solid #333', borderRadius: 8, padding: 8, height: 100, overflowY: 'auto', fontSize: 11 }}>
          <div style={{ color: '#53a8b6', fontSize: 10, marginBottom: 4 }}>💬 聊天</div>
          {[...state.messages].slice(-20).map((msg: any, i: number) => (
            <div key={i} style={{ lineHeight: 1.4 }}><span style={{ color: '#f0a500' }}>{msg.playerName}: </span><span style={{ color: '#ccc' }}>{msg.text}</span></div>
          ))}
        </div>

        {/* Hand cards */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 2, alignItems: 'flex-end' }}>
          {myPlayer?.hand?.map((card: string, idx: number) => (
            <div key={idx} style={{
              background: '#fff', color: '#000',
              border: idx === selectedIdx ? '3px solid #ffd700' : (selectedCards.has(idx) ? '3px solid #f0a500' : '1px solid #ccc'),
              borderRadius: 6, padding: '10px 12px', fontSize: 15, fontWeight: 'bold',
              transform: selectedCards.has(idx) ? 'translateY(-8px)' : 'none',
              boxShadow: idx === selectedIdx ? '0 0 12px rgba(255,215,0,0.5)' : 'none',
              cursor: 'pointer', userSelect: 'none',
              transition: 'transform 0.15s',
            }} onClick={() => setSelectedIdx(idx)}>
              {card === 'Joker' ? '🃏' : card}
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button disabled={state.currentTurnId !== sessionId || !state.lastPlayerId || state.lastPlayerId === sessionId}
            onClick={() => send('challenge')}
            style={{ padding: '10px 18px', fontSize: 14, fontWeight: 'bold', background: '#e94560', color: '#fff', borderRadius: 8 }}>
            🕵️ 质疑 (C)
          </button>
          <button onClick={() => send('pass')}
            disabled={state.currentTurnId !== sessionId || !state.lastPlayerId || state.lastPlayerId === sessionId}
            style={{ padding: '10px 18px', fontSize: 14, background: '#30363d', color: '#e6edf3', borderRadius: 8 }}>
            ✓ 相信
          </button>
          <button disabled={state.currentTurnId !== sessionId || selectedCards.size === 0}
            onClick={() => {
              if (!myPlayer || selectedCards.size === 0 || !state) return;
              const cards = Array.from(selectedCards).map((i) => myPlayer.hand[i]);
              send('play_cards', { cards, declaredCard: state.targetCard, declaredCount: cards.length });
              setSelectedCards(new Set());
            }}
            style={{ padding: '10px 18px', fontSize: 14, fontWeight: 'bold', background: '#53a8b6', color: '#fff', borderRadius: 8 }}>
            🎯 出牌 (↵)
          </button>
        </div>
      </div>

      {state.phase === 'roulette' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80 }}>
          🔫
        </div>
      )}

      {state.phase === 'game_over' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 160, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#161b22', border: '2px solid #f0a500', borderRadius: 16, padding: 40, textAlign: 'center' }}>
            <h1 style={{ color: state.winnerId === sessionId ? '#f0a500' : '#e94560', fontSize: 36 }}>
              {state.winnerId === sessionId ? '🎉 你赢了！' : '💀 游戏结束'}
            </h1>
            <p style={{ color: '#e6edf3', fontSize: 18, marginTop: 8 }}>
              胜利者：<strong style={{ color: '#f0a500' }}>{state.players.get(state.winnerId)?.name}</strong>
            </p>
            <button onClick={() => navigate('/lobby')} style={{ marginTop: 24, padding: '12px 40px', fontSize: 16, fontWeight: 'bold', background: 'linear-gradient(135deg, #e94560, #c23152)', color: '#fff', borderRadius: 8 }}>
              返回大厅
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
