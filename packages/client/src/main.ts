import { Game } from './Game';
import { setupLobby } from './ui/LobbyScreen';
import { NetworkClient } from './networking/Client';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const game = new Game(canvas);

// Auto-detect server URL: in production (same origin), use page host; in dev, use port 2567
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const isDev = window.location.port === '3000' || window.location.port === '5173';
const SERVER_URL = import.meta.env.VITE_SERVER_URL || (isDev
  ? `${wsProtocol}//${window.location.hostname}:2567`
  : `${wsProtocol}//${window.location.host}`);

async function main() {
  const result = await setupLobby();
  const statusEl = document.getElementById('connection-status')!;

  if (result.mode === 'offline') {
    game.startOffline(result.name, result.color);
  } else {
    statusEl.style.display = 'block';
    statusEl.textContent = `Joining room ${result.roomCode}...`;

    try {
      const client = new NetworkClient(SERVER_URL);
      await client.joinOrCreate(result.roomCode, result.name, result.color);
      statusEl.textContent = `Connected to room ${result.roomCode}!`;

      setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
      await game.startOnline(client, result.name, result.roomCode);
    } catch (err) {
      statusEl.textContent = `Connection failed. Check server and try again.`;
      console.error('Connection error:', err);
      setTimeout(() => {
        statusEl.style.display = 'none';
        window.location.reload();
      }, 3000);
    }
  }
}

main();
