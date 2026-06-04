import express from 'express';
import { createServer } from 'http';
import { Server } from 'colyseus';
import { monitor } from '@colyseus/monitor';
import { LobbyRoom } from './rooms/LobbyRoom';
import { GameRoom } from './rooms/GameRoom';

const app = express();
const port = Number(process.env.PORT) || 2567;

app.use(express.json());

const gameServer = new Server({
  server: createServer(app),
});

gameServer.define('lobby', LobbyRoom);
gameServer.define('game_room', GameRoom);

app.use('/colyseus', monitor());

gameServer.listen(port).then(() => {
  console.log(`🎮 Liar's Bar server running on ws://localhost:${port}`);
  console.log(`📊 Colyseus monitor: http://localhost:${port}/colyseus`);
});
