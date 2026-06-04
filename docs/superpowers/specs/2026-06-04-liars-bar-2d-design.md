# 骗子酒馆 2D 浏览器版 — 设计文档

> 2026-06-04 | 状态：已确认

## 1. 项目概述

实现一个多人实时联机"吹牛牌"网页游戏，对标《Liar's Bar》。4 名玩家通过撒谎、质疑和俄罗斯轮盘决出最后存活者。

**部署目标**：公网可访问，朋友们通过浏览器在线游玩。

---

## 2. 技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| 游戏服务器 | **Colyseus 0.15.x** | 内置房间管理、Schema 状态同步、断线重连，直接对应核心需求 |
| 后端运行时 | **Node.js 20 LTS** | Colyseus 的运行环境，前后端统一语言 |
| 前端框架 | **React 18 + TypeScript** | 组件化适合卡牌 UI，社区最大 |
| 构建工具 | **Vite 5** | 极快的 HMR，TypeScript 原生支持 |
| 动画 | **Framer Motion + CSS Transitions** | 声明式动画，React 天然集成 |
| 数据库 | **SQLite (better-sqlite3)** | 零配置嵌入，足够支撑朋友间娱乐的胜率记录 |
| 部署 | **Docker Compose + Nginx** | 一键部署，Nginx 代理静态文件 + WebSocket |

**Monorepo 结构**：`client/` (React) + `server/` (Colyseus) + `shared/` (共享类型)

---

## 3. 系统架构

```
浏览器 (React + Vite)
    ↕ WebSocket
Colyseus Server (Node.js)
    ├── LobbyRoom — 房间列表 / 创建 / 加入
    ├── GameRoom  — 核心游戏逻辑 / 状态机
    └── SQLite     — 玩家胜率持久化
```

**核心原则**：
- **服务端权威**：发牌、质疑判定、轮盘结果全部在服务端执行，客户端只发送意图
- **状态驱动 UI**：Colyseus Schema 定义全部游戏状态，客户端监听变化驱动渲染
- **乐观 UI + 权威回滚**：出牌时客户端立即展示动画，服务端返回后以权威状态为准

---

## 4. 游戏状态机

7 个阶段，严格流转：

```
WAITING → READY → DEALING → PLAYING ⇄ ROULETTE → ROUND_END
                                                    ↓
                                               GAME_OVER (仅剩1人)
```

- **WAITING**：等待玩家加入（最多 4 人），房主可踢人
- **READY**：玩家点击准备，4 人全准备后房主可开始
- **DEALING**：系统发牌（每人 5 张）+ 随机指定目标牌（A/K/Q/J）
- **PLAYING**：当前玩家选牌出牌（1-3张），下家可选相信（pass）或质疑（challenge）
- **ROULETTE**：质疑判定后失败方开枪，rouletteCount 递增，子弹数 = count + 1
- **ROUND_END**：检查胜利条件，清桌重新发牌或结束
- **GAME_OVER**：展示胜利者、淘汰顺序、本局统计

---

## 5. Colyseus Schema 定义

```
GameRoomState:
  roomName: string
  phase: "waiting"|"ready"|"dealing"|"playing"|"roulette"|"round_end"|"game_over"
  players: MapSchema<Player>
  playerOrder: ArraySchema<string>     // 按加入顺序
  currentTurnId: string
  targetCard: "A"|"K"|"Q"|"J"
  roundNumber: uint8
  timeoutSeconds: uint8                // 15s 倒计时
  lastClaimCard: string                // 上家声称的牌
  lastClaimCount: uint8                // 上家声称的数量
  lastPlayerId: string                 // 上家 id
  messages: ArraySchema<ChatMessage>
  winnerId: string

Player:
  id: string
  name: string
  isReady: boolean
  isHost: boolean
  isAlive: boolean
  isConnected: boolean
  hand: ArraySchema<string>            // 仅本人可见
  selectedCards: ArraySchema<string>   // 仅本人可见
  rouletteCount: uint8                 // 存活次数，子弹数 = count + 1
  wins: uint8
  losses: uint8
```

---

## 6. 页面与路由

| 路由 | 页面 | 内容 |
|------|------|------|
| `/login` | LoginPage | 输入昵称，进入大厅 |
| `/lobby` | LobbyPage | 创建房间弹窗 / 房间列表弹窗 |
| `/room/:id` | GameRoom | 游戏桌面（核心） |

**游戏桌面布局**（用户始终在下方）：

```
┌──────────────────────────────────────────┐
│ 🎯 目标牌 Q · 第3轮 · 轮到 Player1 · 12s │  ← 左上角信息栏
├──────────────────────────────────────────┤
│              👤 Player 2                  │  ← 上方对手
│         (手牌背面) (ready ✓)              │
├──────┬────────────────────────┬──────────┤
│👤 P3 │   🃏 桌面出牌区       │ 💀 P4   │  ← 左右对手
│观战中│   上家声明：2张Q       │ 已淘汰   │
├──────┴────────────────────────┴──────────┤
│ 💬 聊天区        │ 🂠🂠🂠🂠🂠  │ 🕵️质疑 │  ← 手牌 + 按钮
│ Player2: 你撒谎! │ 手牌铺开   │ 🎯出牌  │
└──────────────────────────────────────────┘
```

### React 组件树

```
App
├── LoginPage
├── LobbyPage
│   ├── CreateRoomModal
│   └── RoomListModal
└── GameRoom
    ├── GameHeader        ← 左上角信息栏
    ├── PlayerSlot ×3     ← 上/左/右对手
    ├── PlayArea          ← 中央桌面出牌区
    ├── ChatPanel         ← 左下角聊天
    ├── HandArea          ← 手牌 + 键盘交互
    ├── ActionButtons     ← 右下按钮
    ├── RouletteOverlay   ← 轮盘动画
    └── GameOverModal     ← 结算
```

---

## 7. 键盘交互

| 按键 | 操作 |
|------|------|
| ← → | 在手牌间移动选择光标 |
| Space | 选中/取消当前卡牌（加入出牌队列，上移 6px + 金色边框） |
| Enter | 确认出牌 |
| C | 质疑上家 |
| T | 打开聊天输入框 |

---

## 8. 动画方案

| 场景 | 描述 | 技术 | 时长 |
|------|------|------|------|
| 俄罗斯轮盘 | 装弹→弹仓旋转减速→扣扳机（中枪红光/幸存绿光） | Framer Motion spring + CSS shake | ~3.5s |
| 发牌 | 牌从牌堆飞向各玩家手牌区，逐张间隔 ~150ms | Framer Motion animate position | ~2s |
| 质疑揭示 | 上家实牌 3D 翻转展示 + 红/绿色闪烁 | CSS 3D transform rotateY | ~1.5s |
| 手牌选中 | 上移 6px + 金色边框 + 轻微放大 | CSS transition 0.15s | 0.15s |
| 出牌到桌面 | 卡牌从手牌区飞向中央桌面 | Framer Motion layoutId | ~0.5s |
| 玩家淘汰 | 头像变灰 + 💀 + 卡牌散落 | CSS filter + Framer Motion | ~1s |
| 轮到提示 | 当前玩家边框脉冲发光 | CSS @keyframes pulse | 持续 |
| 倒计时 | 数字绿→黄→红 + 进度条缩短 | CSS transition | 实时 |

---

## 9. 服务端权威验证

每次客户端操作都经过服务端验证：

| 操作 | 客户端发送 | 服务端验证 |
|------|-----------|-----------|
| 出牌 | `{ cards, declaredCard, declaredCount }` | 手牌包含、数量 1-3、轮到该玩家、移除已出手牌、Joker 处理 |
| 质疑 | `{ }` | 有上家出牌可质疑、轮到该玩家、公开实牌并判定 |
| 准备 | `{ }` | 阶段为 READY、切换准备状态 |
| 开始 | `{ }`（房主） | 发送者为房主、人数=4、全部准备 |
| 超时 | 服务端自动 | 15s 计时器到期 → 自动随机出牌 |

---

## 10. 断线重连

1. 客户端检测断开 → 显示"重连中..."遮罩
2. 服务端保留 sessionId + 玩家状态（isConnected = false），游戏继续
3. 客户端携带旧 sessionId 调用 `client.reconnect()`
4. Colyseus 匹配原 Room → 推送完整状态快照
5. 客户端恢复 → 移除遮罩
6. 超时 60s 未重连 → 服务端标记该玩家失败

---

## 11. 数据持久化

| 数据 | 存储 | 说明 |
|------|------|------|
| 玩家胜率 | SQLite (`players`) | { name, wins, losses, last_played }，按名称匹配 |
| 游戏状态 | 内存 | Colyseus Room 生命周期内 |
| 房间列表 | 内存 | LobbyRoom 管理 |
| 聊天记录 | 内存 | 不持久化 |

---

## 12. 部署

**推荐方案**：VPS（阿里云/腾讯云 2C2G）+ Docker Compose

```
docker-compose.yml:
  server:  Colyseus (port 2567, SQLite volume)
  nginx:   代理 :80/:443 → 静态文件 + WebSocket upgrade
```

- Nginx 提供静态文件（Vite build）+ WebSocket 代理
- Let's Encrypt 免费 SSL
- `docker compose up -d` 一键启动

---

## 13. 项目目录结构

```
LiarBar2D/
├── client/                    # React + Vite 前端
│   ├── src/
│   │   ├── pages/            # LoginPage, LobbyPage, GameRoom
│   │   ├── components/       # GameHeader, PlayerSlot, PlayArea, ChatPanel, HandArea, ...
│   │   ├── game/             # colyseus-client.ts, useGameState.ts, keyboard.ts
│   │   └── styles/
├── server/                    # Colyseus 后端
│   ├── src/
│   │   ├── rooms/            # LobbyRoom.ts, GameRoom.ts
│   │   ├── schema/           # GameRoomState.ts, Player.ts
│   │   ├── game/             # CardDeck.ts, RuleEngine.ts, RouletteEngine.ts
│   │   └── db/               # SQLite 操作
├── shared/                    # 共享类型
│   └── types.ts
├── docker-compose.yml
├── Dockerfile
└── nginx.conf
```

---

## 14. 游戏规则要点（服务端实现参考）

### 牌组
- A/K/Q/J 各 6 张，Joker 2 张，共 26 张
- 每轮每人发 5 张
- Joker 只能充当目标牌使用，被质疑时视为未撒谎

### 出牌
- 选择 1-3 张，声明牌型（目标牌）
- 可以撒谎（实际≠声明）

### 质疑
- 下家可选择相信（pass）或质疑（challenge）
- 撒谎 → 被质疑者失败；未撒谎 → 质疑者失败
- Joker 声明为目标牌 → 视为未撒谎

### 俄罗斯轮盘
- 初始 1 颗子弹 / 6 槽 → 概率 1/6
- 每存活一次，子弹+1（第 n 次 = n/6）
- 中枪即淘汰

ChatMessage:
  playerId: string
  playerName: string
  text: string
  timestamp: number
```

---

## 14. 游戏规则要点（服务端实现参考）

### 牌组
- A/K/Q/J 各 6 张，Joker 2 张，共 26 张
- 每轮每人发 5 张
- Joker 只能充当目标牌使用，被质疑时视为未撒谎

### 出牌
- 选择 1-3 张，声明牌型（目标牌）
- 可以撒谎（实际≠声明）

### 质疑
- 下家可选择相信（pass）或质疑（challenge）
- 撒谎 → 被质疑者失败；未撒谎 → 质疑者失败
- Joker 声明为目标牌 → 视为未撒谎

### 俄罗斯轮盘
- 初始 1 颗子弹 / 6 槽 → 概率 1/6
- 每存活一次，子弹+1（第 n 次 = n/6）
- 中枪即淘汰

### 胜利
- 最后 1 名存活玩家获胜

### 超时
- 每回合 15 秒，超时自动随机出牌
