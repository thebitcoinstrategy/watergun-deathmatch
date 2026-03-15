import { Server, matchMaker } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { DeathMatchRoom } from './rooms/DeathMatchRoom';

const app = express();
app.use(cors());

// API: query room info by roomCode (used by lobby to show map before joining)
app.get('/api/room-info/:roomCode', async (req, res) => {
  try {
    const rooms = await matchMaker.query({ name: 'deathmatch' });
    const match = rooms.find((r: any) => r.metadata?.roomCode === req.params.roomCode);
    if (match) {
      res.json({ exists: true, mapId: match.metadata?.mapId || 'aqua_park', players: match.clients });
    } else {
      res.json({ exists: false });
    }
  } catch {
    res.json({ exists: false });
  }
});

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
