import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { DeathMatchRoom } from './rooms/DeathMatchRoom';

const app = express();
app.use(cors());

// Serve built client files in production
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// Fallback: serve index.html for any non-API route (SPA support)
app.get('*', (_req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.json({ status: 'Water Gun Deathmatch Server', rooms: 'active' });
    }
  });
});

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define('deathmatch', DeathMatchRoom).filterBy(['roomCode']);

const port = Number(process.env.PORT) || 2567;
httpServer.listen(port, () => {
  console.log(`Water Gun server listening on port ${port}`);
  console.log(`WebSocket: ws://localhost:${port}`);
});
