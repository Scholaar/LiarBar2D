# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Liar's Bar (骗子酒馆) — a real-time multiplayer bluffing card game for 4 players. Players take turns declaring they're playing the target card; opponents can challenge lies. Losers face Russian roulette with escalating odds. Last player standing wins.

## Commands

```bash
# Dev servers (run concurrently in separate terminals)
npm run dev:server          # Colyseus + Express on ws://localhost:2567
npm run dev:client          # Vite HMR on http://localhost:3000

# Server tests
cd server && npx vitest run              # run once
cd server && npx vitest                  # watch mode
cd server && npx vitest run src/game/__tests__/CardDeck.test.ts  # single file

# Client build
npm run build:client        # tsc + vite build → client/dist/

# Docker
docker compose up -d        # server:2567 + nginx:80/443
```

## Architecture

```
liars-bar-2d/
├── shared/types.ts          # Shared types & constants (imported as 'shared')
├── server/                  # Colyseus game server (Node.js + Express)
│   └── src/
│       ├── index.ts         # Server entry, defines lobby + game_room rooms
│       ├── schema/          # Colyseus Schema classes (GameRoomState, Player, ChatMessage)
│       ├── rooms/           # LobbyRoom (room listing) + GameRoom (core game logic)
│       ├── game/            # Pure game engines: CardDeck, RuleEngine, RouletteEngine
│       ├── db/              # SQLite player stats/leaderboard (better-sqlite3)
│       └── __tests__/       # Vitest tests
├── client/                  # React SPA (Vite + TypeScript)
│   └── src/
│       ├── App.tsx          # React Router: /login, /lobby, /room/:roomId
│       ├── pages/           # LoginPage, LobbyPage, GameRoom
│       ├── components/      # CreateRoomModal, RoomListModal, LeaderboardModal
│       ├── game/            # colyseus-client.ts (singleton), useGameState.ts, keyboard.ts
│       └── styles/          # global.css (design tokens, minimalist dark theme)
└── docs/
```

## Key Architectural Decisions

### State Synchronization (Bypass Colyseus Schema)

The server **does not** rely on Colyseus Schema change-tracking for client sync. Instead, every state mutation calls `broadcastSyncState()` which manually serializes the full game state and sends it to each client via `client.send('sync_state', ...)`. This was done to work around Colyseus serialization issues with MapSchema/ArraySchema.

Per-client hand privacy: each client's `sync_state` payload contains full player data but only that client's own hand — other players see `hand: []`. The server builds a different payload per client in the broadcast loop.

### Dual State Input on Client

`useGameState.ts` merges two state sources:
1. **Colyseus Schema** (`gameRoom.onStateChange`) — automatic schema changes
2. **Manual sync_state** messages (`gameRoom.onMessage('sync_state')`) — the primary source from `broadcastSyncState()`

`mergeState()` prefers values from `sync_state`, falling back to schema state.

### Client Singleton Pattern

`gameClient` (exported from `colyseus-client.ts`) is a module-level singleton wrapping Colyseus `Client`. It holds references to `_lobbyRoom` and `_gameRoom` — only one game room at a time. Pages check `gameClient.gameRoom` before joining (to prevent double-joins from React StrictMode double-mount).

### Game Phase State Machine

```
waiting → ready → dealing → playing → roulette → round_end → (loop to dealing)
                                                        ↓
                                                   game_over → (continue) → dealing
```

- `waiting`: players joining, can toggle ready
- `ready`: all 4 present + ready, host can start
- `dealing`: brief phase, cards dealt, target card assigned
- `playing`: active turns, 15s timeout per turn
- `roulette`: challenge resolution + roulette spin animation (staged with setTimeout delays)
- `round_end`: 1s pause before next round
- `game_over`: winner determined, host can start new round via `continue_game`

### Roulette Visual Sequencing

Roulette is staged with server-side timers:
1. Challenge info shown for 3s (`roulettePlayerId = null`, players see who challenged whom)
2. Roulette spin for 1.5s (`rouletteGotShot = null`, "spinning" state)
3. Result revealed for 2.5s, then `finishRound()`

### Shared Constants (`shared/types.ts`)

All gameplay constants live here and are imported by both server and client:
- `DECK_COMPOSITION`: 6 each of A/K/Q/J
- `JOKER_COUNT`: 2
- `MAX_PLAYERS`: 4
- `CARDS_PER_PLAYER`: 5
- `TURN_TIMEOUT_SECONDS`: 999 (effectively disabled, originally 15)
- `ROULETTE_SLOTS`: 6
- `RECONNECT_TIMEOUT_SECONDS`: 60

### Card System

- Deck: 26 cards total (A/K/Q/J ×6 + Joker ×2)
- Joker acts as the declared target card when played — always counts as "truth"
- Target card each round is randomly chosen from A/K/Q/J (never Joker)

### Roulette Mechanics

`rouletteCount` tracks how many times a player has survived. Bullet count = `rouletteCount + 1`, capped at 6 (guaranteed death on 6th spin).

### Database

SQLite via `better-sqlite3`. Stores player win/loss records keyed by player name (case-insensitive). Used for leaderboard. Database file: `server/data/liarsbar.db`.

### Keyboard Controls (GameRoom)

| Key | Action |
|-----|--------|
| ← → | Select card in hand |
| Space | Toggle card for play queue |
| Enter | Play selected cards |
| C | Challenge previous player |
| T | Toggle chat input |

Skip when focused on INPUT/TEXTAREA elements.

### UI Design System

Recently refactored to minimalist dark theme using:
- **Style**: Flat Design + Swiss Minimalism + OLED Dark
- **Icons**: lucide-react (no emojis)
- **Colors**: zinc palette backgrounds (zinc-950 base), rose-500 accent (primary actions), amber-400 (roulette), sky-400 (info)
- **Typography**: Inter (weights 300-700) with CJK fallbacks
- **Spacing**: 4px base grid system
- **Effects**: No gradients, no shadows, 4px border-radius, 150-200ms transitions
- CSS custom properties defined in `client/src/styles/global.css`

### Server File Structure Dependency

The server imports `MAX_PLAYERS`, `TURN_TIMEOUT_SECONDS`, `RECONNECT_TIMEOUT_SECONDS` from the `shared` package (configured via TypeScript project references). The client imports shared types via Vite alias `shared → ../shared/types`.

### Colyseus Monitor

Available at `http://localhost:2567/colyseus` in development — shows active rooms, player counts, message rates.
