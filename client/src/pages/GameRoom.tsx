import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gameClient } from '../game/colyseus-client';
import { useGameState } from '../game/useGameState';
import { bindGameKeys } from '../game/keyboard';
import { Player } from '../../../server/src/schema/GameRoomState';
import {
  Users,
  Clock,
  Crown,
  Skull,
  User,
  Wifi,
  WifiOff,
  Check,
  Circle,
  Play,
  LogOut,
  AlertTriangle,
  Search,
  Send,
  MessageCircle,
  X,
  RefreshCw,
  Crosshair,
  Swords,
  Shield,
  Zap,
  Gamepad2,
} from 'lucide-react';

/* ================================================================
   Sub-components
   ================================================================ */

const GameHeader: React.FC<{
  state: any;
  mySessionId: any;
  displayTimer: number;
}> = ({ state, mySessionId, displayTimer }) => {
  const playerCount = state?.playerOrder?.length || 0;
  const isWaiting = state?.phase === 'waiting' || state?.phase === 'ready';
  const currentPlayer = state?.players?.get(state?.currentTurnId);
  const isMyTurn = state?.currentTurnId === mySessionId;

  return (
    <div style={{
      position: 'absolute', top: 'var(--space-3)', left: 'var(--space-3)',
      zIndex: 10, minWidth: 200,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-sm)',
      padding: 'var(--space-3) var(--space-4)',
      fontSize: 'var(--text-sm)',
    }}>
      {isWaiting ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-secondary)' }}>
          <Users size={16} />
          <span>{playerCount}/4</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
            {state?.phase === 'ready' ? '准备中' : '等待中'}
          </span>
        </div>
      ) : (
        <>
          {state?.targetCard && (
            <div style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              目标牌：
              <span style={{ fontSize: 'var(--text-xl)', marginLeft: 'var(--space-1)' }}>
                {state.targetCard}
              </span>
            </div>
          )}
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
            第 {state?.roundNumber} 轮
            {currentPlayer && (
              <span>
                {' · '}
                <span style={{
                  color: isMyTurn ? 'var(--color-info)' : 'var(--accent)',
                  fontWeight: 600,
                }}>
                  {currentPlayer.name}{isMyTurn ? '（你）' : ''}
                </span>
              </span>
            )}
          </div>
          {state?.phase === 'playing' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
              color: 'var(--accent)', fontSize: 'var(--text-sm)',
              fontWeight: 600, marginTop: 'var(--space-1)',
            }}>
              <Clock size={14} />
              剩余 {displayTimer} 秒
            </div>
          )}
        </>
      )}
    </div>
  );
};

const PlayerSlot: React.FC<{
  player: any;
  isCurrentTurn: boolean;
}> = ({ player, isCurrentTurn }) => {
  const isAlive = player?.isAlive;
  const isConnected = player?.isConnected;

  return (
    <div style={{
      background: isCurrentTurn ? 'var(--accent-subtle)' : 'var(--bg-surface)',
      border: `1px solid ${isCurrentTurn ? 'var(--accent)' : (player?.isReady ? 'var(--color-success)' : 'var(--border-subtle)')}`,
      borderRadius: 'var(--radius-sm)',
      padding: 'var(--space-2) var(--space-4)',
      textAlign: 'center',
      opacity: isAlive ? 1 : 0.4,
      minWidth: 130,
      transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
    }}>
      <div style={{
        fontWeight: 600,
        fontSize: 'var(--text-sm)',
        color: isAlive ? 'var(--text-primary)' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 'var(--space-1)',
      }}>
        {isAlive ? <User size={14} /> : <Skull size={14} />}
        {player?.name}
        {player?.isHost && <Crown size={12} color="var(--color-warning)" />}
        {!isConnected && <WifiOff size={12} color="var(--color-danger)" />}
      </div>
      {isAlive && (
        <div style={{
          fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
          marginTop: 'var(--space-1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 'var(--space-2)',
        }}>
          <span>手牌 ×{player?.hand?.length || 0}</span>
          {player?.isReady && (
            <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Check size={10} /> 准备
            </span>
          )}
          {player?.rouletteCount > 0 && (
            <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
              ×{player.rouletteCount}
            </span>
          )}
        </div>
      )}
      {!isAlive && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
          已淘汰
        </div>
      )}
    </div>
  );
};

const PlayArea: React.FC<{ state: any }> = ({ state }) => (
  <div style={{
    flex: 1, display: 'flex', justifyContent: 'center',
    margin: '0 var(--space-4)',
  }}>
    <div style={{
      width: '100%', maxWidth: 400, minHeight: 120,
      background: 'var(--bg-surface)',
      border: `1px dashed var(--border-default)`,
      borderRadius: 'var(--radius-sm)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {state?.lastPlayerId ? (
        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          {state.lastClaimCount} 张 {state.lastClaimCard}
        </span>
      ) : (
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          出牌区
        </span>
      )}
    </div>
  </div>
);

/* ================================================================
   Main GameRoom Component
   ================================================================ */

export const GameRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { state, send, getMyPlayer, sessionId } = useGameState();

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
  const [showChat, setShowChat] = useState(false);
  const [chatText, setChatText] = useState('');
  const [disconnected, setDisconnected] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);

  // Local countdown timer
  const [displayTimer, setDisplayTimer] = useState(15);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state?.phase !== 'playing') {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    setDisplayTimer(state.timeoutSeconds ?? 15);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDisplayTimer((prev) => {
        if (prev <= 1) {
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [state?.phase, state?.timeoutSeconds, state?.currentTurnId]);

  // Join room
  useEffect(() => {
    let didJoin = false;
    (async () => {
      if (gameClient.gameRoom) return;
      try {
        didJoin = true;
        await gameClient.joinGameRoom(roomId!);
      } catch {
        navigate('/lobby');
      }
    })();
    return () => {
      if (didJoin) gameClient.leaveGameRoom();
    };
  }, [roomId, navigate]);

  // State change subscription
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const gameRoom = gameClient.gameRoom;
    if (!gameRoom) return;
    const onChange = gameRoom.onStateChange(() => forceUpdate((n) => n + 1));
    const onLeave = () => setDisconnected(true);
    gameRoom.onLeave(onLeave);
    const onRoomClosed = gameRoom.onMessage('room_closed', () => setRoomClosed(true));
    return () => {
      onChange.clear();
      gameRoom.onLeave(() => {});
      if (typeof onRoomClosed.unbind === 'function') onRoomClosed.unbind();
    };
  }, []);

  // Keyboard bindings
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
        const hand = Array.from(player.hand);
        const cards = Array.from(selectedCards).map((i) => hand[i]);
        if (cards.length < 1 || cards.length > 3) return;
        send('play_cards', { cards, declaredCard: state.targetCard, declaredCount: cards.length });
        setSelectedCards(new Set());
      },
      onChallenge: () => { send('challenge'); },
      onChat: () => { setShowChat((prev) => !prev); },
    });
  }, [selectedIdx, selectedCards, state, getMyPlayer, send]);

  // ---- Loading state ----
  if (!state) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', backgroundColor: 'var(--bg-base)',
      }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-lg)' }}>
          连接中...
        </p>
      </div>
    );
  }

  const myPlayer = getMyPlayer();
  if (!sessionId) return null;

  const order = state.playerOrder;
  const myIdx = order.indexOf(sessionId);
  const allPlayers = order.map((id) => state.players.get(id)).filter(Boolean) as Player[];
  const opponents = allPlayers.filter((p) => p.id !== sessionId);

  const topPlayer = opponents.length >= 3
    ? (() => { const topId = order[(myIdx + 2) % 4]; return topId ? state.players.get(topId) || null : null; })()
    : null;
  const sideOpponents = topPlayer
    ? opponents.filter((p) => p.id !== topPlayer.id)
    : opponents;

  const isWaiting = state.phase === 'waiting' || state.phase === 'ready';
  const isAllReady = state.playerOrder.length === 4
    && state.playerOrder.every((id) => state.players.get(id)?.isReady);

  /* ================================================================
     Render
     ================================================================ */
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-base)',
      position: 'relative',
      color: 'var(--text-primary)',
    }}>
      {/* ---- Overlay: Disconnected ---- */}
      {disconnected && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: 'var(--bg-overlay)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 'var(--space-4)',
        }}>
          <WifiOff size={40} color="var(--accent)" />
          <p style={{ color: 'var(--text-primary)', fontSize: 'var(--text-lg)', fontWeight: 500 }}>
            连接断开，重连中...
          </p>
        </div>
      )}

      {/* ---- Overlay: Room Closed ---- */}
      {roomClosed && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: 'var(--bg-overlay)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 'var(--space-6)',
        }}>
          <AlertTriangle size={40} color="var(--accent)" />
          <p style={{ color: 'var(--text-primary)', fontSize: 'var(--text-lg)', fontWeight: 600 }}>
            房间已解散
          </p>
          <button
            onClick={() => navigate('/lobby')}
            style={{
              padding: 'var(--space-3) var(--space-8)',
              fontSize: 'var(--text-sm)', fontWeight: 600,
              background: 'var(--accent)', color: '#fff',
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              cursor: 'pointer',
            }}>
            <LogOut size={16} />
            返回大厅
          </button>
        </div>
      )}

      {/* ---- Header ---- */}
      <GameHeader state={state} mySessionId={sessionId} displayTimer={displayTimer} />

      {/* ---- Top-right: Exit/Disband buttons ---- */}
      {isWaiting && (
        <div style={{
          position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)',
          zIndex: 10, display: 'flex', gap: 'var(--space-2)',
        }}>
          <button
            onClick={() => { gameClient.leaveGameRoom(); navigate('/lobby'); }}
            style={{
              padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-xs)',
              background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
            }}>
            <LogOut size={14} />
            退出
          </button>
          {myPlayer?.isHost && (
            <button
              onClick={() => send('disband_room')}
              style={{
                padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-xs)',
                background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                fontWeight: 600,
              }}>
              <AlertTriangle size={14} />
              解散
            </button>
          )}
        </div>
      )}

      {/* ---- Chat input overlay ---- */}
      {showChat && (
        <div style={{
          position: 'absolute', bottom: 120, left: 'var(--space-4)',
          zIndex: 50, display: 'flex', gap: 'var(--space-2)',
        }}>
          <input
            autoFocus
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && chatText.trim()) {
                send('chat', { text: chatText.trim() });
                setChatText('');
              } else if (e.key === 'Escape') {
                setShowChat(false);
                setChatText('');
              }
            }}
            placeholder="输入聊天内容..."
            style={{
              width: 240, padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--text-xs)', background: 'var(--bg-surface)',
              color: 'var(--text-primary)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)', outline: 'none',
            }}
          />
          <button
            onClick={() => { setShowChat(false); setChatText(''); }}
            style={{
              padding: 'var(--space-2)', background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
            }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ---- Top player ---- */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-2) 0' }}>
        {topPlayer && (
          <PlayerSlot player={topPlayer} isCurrentTurn={state.currentTurnId === topPlayer.id} />
        )}
      </div>

      {/* ---- Middle: side players + play area ---- */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-4)',
      }}>
        <div style={{ width: 140 }}>
          {sideOpponents[0] && (
            <PlayerSlot player={sideOpponents[0]} isCurrentTurn={state.currentTurnId === sideOpponents[0].id} />
          )}
        </div>
        <PlayArea state={state} />
        <div style={{ width: 140 }}>
          {sideOpponents[1] && (
            <PlayerSlot player={sideOpponents[1]} isCurrentTurn={state.currentTurnId === sideOpponents[1].id} />
          )}
        </div>
      </div>

      {/* ---- Bottom: chat + hand + actions ---- */}
      <div style={{
        display: 'flex', padding: 'var(--space-3) var(--space-4)',
        gap: 'var(--space-3)', alignItems: 'flex-end',
      }}>
        {/* Chat panel */}
        <div style={{
          width: 200, height: 100, overflowY: 'auto',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: 'var(--space-2)', fontSize: 'var(--text-xs)',
        }}>
          <div style={{
            color: 'var(--text-muted)', fontSize: 'var(--text-xs)',
            marginBottom: 'var(--space-1)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
          }}>
            <MessageCircle size={10} /> 聊天
          </div>
          {[...state.messages].slice(-20).map((msg: any, i: number) => (
            <div key={i} style={{ lineHeight: 1.5 }}>
              <span style={{ color: 'var(--color-info)', fontWeight: 500 }}>{msg.playerName}: </span>
              <span style={{ color: 'var(--text-secondary)' }}>{msg.text}</span>
            </div>
          ))}
        </div>

        {/* Hand cards */}
        <div style={{
          flex: 1, display: 'flex', justifyContent: 'center',
          gap: 'var(--space-1)', alignItems: 'flex-end',
        }}>
          {myPlayer?.hand?.map((card: string, idx: number) => {
            const isSelected = selectedCards.has(idx);
            const isFocused = idx === selectedIdx;
            return (
              <div
                key={idx}
                onClick={() => setSelectedIdx(idx)}
                onDoubleClick={() => {
                  setSelectedCards((prev) => {
                    const next = new Set(prev);
                    if (next.has(idx)) next.delete(idx);
                    else next.add(idx);
                    return next;
                  });
                }}
                style={{
                  width: 52, height: 74,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#fafafa',
                  color: '#09090b',
                  border: isFocused
                    ? '2px solid var(--color-warning)'
                    : isSelected
                      ? '2px solid var(--accent)'
                      : '1px solid #d4d4d8',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 700,
                  transform: isSelected ? 'translateY(-8px)' : 'none',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'transform var(--transition-fast), border-color var(--transition-fast)',
                  position: 'relative',
                }}>
                {card}
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'var(--accent)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10,
                  }}>
                    <Check size={10} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
          minWidth: 110,
        }}>
          {isWaiting ? (
            <>
              <button
                onClick={() => send('ready')}
                style={{
                  padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  background: myPlayer?.isReady ? 'var(--bg-elevated)' : 'var(--color-success)',
                  color: myPlayer?.isReady ? 'var(--text-secondary)' : '#000',
                  border: myPlayer?.isReady ? '1px solid var(--border-default)' : 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 'var(--space-1)',
                }}>
                {myPlayer?.isReady ? <X size={14} /> : <Check size={14} />}
                {myPlayer?.isReady ? '取消准备' : '准备'}
              </button>
              {myPlayer?.isHost && (
                <button
                  onClick={() => send('start_game')}
                  disabled={!isAllReady}
                  style={{
                    padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    background: isAllReady ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: isAllReady ? '#fff' : 'var(--text-muted)',
                    borderRadius: 'var(--radius-sm)',
                    border: isAllReady ? 'none' : '1px solid var(--border-subtle)',
                    cursor: isAllReady ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 'var(--space-1)',
                  }}>
                  <Gamepad2 size={14} />
                  开始游戏
                </button>
              )}
              {myPlayer?.isHost && !isAllReady && (
                <div style={{
                  fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
                  textAlign: 'center',
                }}>
                  4人全部准备后可开始
                </div>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => send('challenge')}
                disabled={state.currentTurnId !== sessionId || !state.lastPlayerId || state.lastPlayerId === sessionId}
                style={{
                  padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  background: 'var(--accent)', color: '#fff',
                  borderRadius: 'var(--radius-sm)', border: 'none',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 'var(--space-1)',
                }}>
                <Swords size={14} />
                质疑 (C)
              </button>
              <button
                onClick={() => send('pass')}
                disabled={state.currentTurnId !== sessionId || !state.lastPlayerId || state.lastPlayerId === sessionId}
                style={{
                  padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)',
                  fontWeight: 500,
                  background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 'var(--space-1)',
                }}>
                <Shield size={14} />
                相信
              </button>
              <button
                disabled={state.currentTurnId !== sessionId || selectedCards.size === 0}
                onClick={() => {
                  if (!myPlayer || selectedCards.size === 0 || !state) return;
                  const hand = Array.from(myPlayer.hand);
                  const cards = Array.from(selectedCards).map((i) => hand[i]);
                  send('play_cards', { cards, declaredCard: state.targetCard, declaredCount: cards.length });
                  setSelectedCards(new Set());
                }}
                style={{
                  padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  background: 'var(--color-info)', color: '#000',
                  borderRadius: 'var(--radius-sm)', border: 'none',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 'var(--space-1)',
                }}>
                <Send size={14} />
                出牌 (↵)
              </button>
            </>
          )}
        </div>
      </div>

      {/* ---- Overlay: Roulette ---- */}
      {state.phase === 'roulette' && (
        <RouletteOverlay state={state} sessionId={sessionId} />
      )}

      {/* ---- Overlay: Game Over ---- */}
      {state.phase === 'game_over' && (
        <GameOverOverlay state={state} sessionId={sessionId} navigate={navigate} send={send} />
      )}
    </div>
  );
};

/* ================================================================
   Overlay Components
   ================================================================ */

const RouletteOverlay: React.FC<{ state: any; sessionId: any }> = ({ state, sessionId }) => {
  const isShot = state.rouletteGotShot;
  const isSpinning = isShot === undefined || isShot === null;
  const roulettePlayer = state.roulettePlayerId ? state.players.get(state.roulettePlayerId) : null;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 150,
      background: 'var(--bg-overlay)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 'var(--space-4)',
      padding: 'var(--space-8)',
      textAlign: 'center',
    }}>
      {/* Stage 1: Challenge resolution */}
      {!state.roulettePlayerId && state.challengeChallengerId && state.challengeDefenderId && (
        <>
          <Swords size={36} color="var(--color-warning)" />
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {state.players.get(state.challengeChallengerId)?.name ?? '?'} 质疑{' '}
            {state.players.get(state.challengeDefenderId)?.name ?? '?'}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {state.players.get(state.challengeDefenderId)?.name ?? '?'} 出了{' '}
            {state.challengeDeclaredCount} 张 {state.challengeTargetCard}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            实际牌面：[{state.challengeActualCards?.join(', ') ?? '?'}]
          </div>
          <div style={{
            fontSize: 'var(--text-lg)', fontWeight: 700, marginTop: 'var(--space-2)',
            color: state.challengeIsTruth ? 'var(--accent)' : 'var(--color-success)',
          }}>
            {state.challengeIsTruth ? (
              <>说真话！质疑者接受轮盘赌</>
            ) : (
              <>吹牛！出牌者接受轮盘赌</>
            )}
          </div>
        </>
      )}

      {/* No challenge — direct roulette */}
      {!state.roulettePlayerId && !state.challengeChallengerId && (
        <>
          <Circle size={36} color="var(--text-muted)" />
          <div style={{ fontSize: 'var(--text-lg)', color: 'var(--text-secondary)' }}>
            所有人出完手牌，最后出牌者进行轮盘赌...
          </div>
        </>
      )}

      {/* Stage 2: Roulette result */}
      {roulettePlayer && (
        <>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-warning)' }}>
            {roulettePlayer.name} 进行轮盘赌
          </div>
          <div style={{ fontSize: 72, transition: 'transform var(--transition-slow)' }}>
            {isSpinning ? <Crosshair size={72} /> : isShot ? <Skull size={72} color="var(--accent)" /> : <Shield size={72} color="var(--color-success)" />}
          </div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>
            {isSpinning ? (
              <span style={{ color: 'var(--text-muted)' }}>转动中...</span>
            ) : isShot ? (
              <span style={{ color: 'var(--accent)' }}>中枪了！</span>
            ) : (
              <span style={{ color: 'var(--color-success)' }}>幸存！子弹 +1</span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const GameOverOverlay: React.FC<{
  state: any;
  sessionId: any;
  navigate: (path: string) => void;
  send: (action: string, payload?: any) => void;
}> = ({ state, sessionId, navigate, send }) => {
  const isWinner = state.winnerId === sessionId;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 160,
      background: 'var(--bg-overlay)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-10)',
        textAlign: 'center',
        animation: 'slide-up var(--transition-base)',
      }}>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          {isWinner ? (
            <Crown size={48} color="var(--color-warning)" />
          ) : (
            <Skull size={48} color="var(--accent)" />
          )}
        </div>
        <h1 style={{
          fontSize: 'var(--text-3xl)', fontWeight: 700,
          color: isWinner ? 'var(--color-warning)' : 'var(--accent)',
          marginBottom: 'var(--space-2)',
        }}>
          {isWinner ? '你赢了！' : '游戏结束'}
        </h1>
        <p style={{
          color: 'var(--text-secondary)', fontSize: 'var(--text-base)',
          marginBottom: 'var(--space-6)',
        }}>
          胜利者：<strong style={{ color: 'var(--color-warning)' }}>
            {state.players.get(state.winnerId)?.name}
          </strong>
        </p>
        <div style={{
          display: 'flex', gap: 'var(--space-3)',
          justifyContent: 'center',
        }}>
          <button
            onClick={() => navigate('/lobby')}
            style={{
              padding: 'var(--space-3) var(--space-6)', fontSize: 'var(--text-sm)',
              fontWeight: 600, background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            }}>
            <LogOut size={16} />
            返回大厅
          </button>
          <button
            onClick={() => send('continue_game')}
            style={{
              padding: 'var(--space-3) var(--space-6)', fontSize: 'var(--text-sm)',
              fontWeight: 600, background: 'var(--accent)',
              color: '#fff', borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            }}>
            <RefreshCw size={16} />
            继续游戏
          </button>
        </div>
      </div>
    </div>
  );
};
