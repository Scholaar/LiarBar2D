# 🃏 骗子酒馆 · Liar's Bar

> 多人实时联机吹牛卡牌游戏 — 撒谎、质疑、俄罗斯轮盘，最后存活者获胜。

## 游戏简介

4 名玩家轮流声明出牌，但你**可以撒谎**。下一位玩家可以选择**相信**（继续）或**质疑**（揭穿）。质疑失败者接受**俄罗斯轮盘**惩罚 — 子弹数随幸存次数递增，直至中枪淘汰。最后存活者获胜。

### 牌型

| 牌面 | 数量 | 说明 |
|------|------|------|
| A / K / Q / J | 各 6 张 | 普通牌 |
| Joker | 2 张 | 万能牌，声明为目标牌时视为真话 |

### 轮盘机制

| 第 N 次开枪 | 子弹数 | 中枪概率 |
|------------|--------|---------|
| 1 | 1 | 1/6 |
| 2 | 2 | 2/6 |
| 3 | 3 | 3/6 |
| 4 | 4 | 4/6 |
| 5 | 5 | 5/6 |
| 6 | 6 | 必中 |

详细规则见 [rule.md](./rule.md)。

## 快速开始

### 环境要求

- Node.js ≥ 20
- npm ≥ 9

### 本地开发

```bash
# 安装依赖
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# 启动服务端（WebSocket :2567）
npm run dev:server

# 新终端，启动客户端（Vite :3000）
npm run dev:client
```

浏览器打开 `http://localhost:3000`，输入昵称即可开始。

### 运行测试

```bash
cd server
npx vitest run                    # 全部测试
npx vitest run <文件路径>          # 单个测试文件
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite |
| 后端 | Colyseus (WebSocket 游戏框架) + Express |
| 数据库 | SQLite (better-sqlite3) |
| 图标 | lucide-react |
| 部署 | Docker + Nginx |

## 项目结构

```
.
├── shared/          # 共享类型与常量
├── server/          # Colyseus 服务端
│   └── src/
│       ├── rooms/       # LobbyRoom / GameRoom
│       ├── schema/      # Colyseus Schema
│       ├── game/        # CardDeck / RuleEngine / RouletteEngine
│       └── db/          # SQLite 玩家统计
├── client/          # React 前端
│   └── src/
│       ├── pages/       # LoginPage / LobbyPage / GameRoom
│       ├── components/  # 弹窗组件
│       └── game/        # WebSocket 客户端 / 状态 Hook / 键盘绑定
└── docs/
```

## Docker 部署

```bash
docker compose up -d
```

- 游戏服务：`ws://<host>:2567`
- 静态资源：Nginx 反代 `:80` / `:443`

## 游戏操作

| 按键 | 功能 |
|------|------|
| ← → | 选择手牌 |
| 空格 | 选中/取消出牌 |
| 回车 | 出牌 |
| C | 质疑 |
| T | 聊天 |

## 设计风格

极简深色主题 — Flat Design + Swiss Minimalism。Inter 字体，锌色背景 + 玫瑰色强调，无渐变无阴影，4px 间距体系。
