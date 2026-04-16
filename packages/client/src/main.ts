import { Game } from './Game';
import { setupLobby } from './ui/LobbyScreen';
import { NetworkClient } from './networking/Client';
import type { MapId } from '@watergun/shared';

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Capture the beforeinstallprompt event for the install button
let deferredPrompt: any = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function showInstallScreen(): Promise<void> {
  return new Promise((resolve) => {
    const screen = document.getElementById('install-screen')!;
    const btnInstall = document.getElementById('btn-install')!;
    const btnSkip = document.getElementById('btn-skip-install')!;
    const iosHint = document.getElementById('install-ios-hint')!;

    screen.style.display = 'flex';

    if (isIOS()) {
      // iOS doesn't support beforeinstallprompt — show manual instructions
      btnInstall.style.display = 'none';
      iosHint.style.display = 'block';
    }

    btnInstall.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (result.outcome === 'accepted') {
          screen.style.display = 'none';
          resolve();
          return;
        }
      }
      // If prompt wasn't available or was dismissed, continue anyway
      screen.style.display = 'none';
      resolve();
    });

    btnSkip.addEventListener('click', () => {
      screen.style.display = 'none';
      resolve();
    });
  });
}

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

// Auto-detect server URL: in production (same origin), use page host; in dev, use port 2567
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const isDev = !!window.location.port && window.location.port !== '2567' && window.location.port !== '80' && window.location.port !== '443';
const SERVER_URL = import.meta.env.VITE_SERVER_URL || (isDev
  ? `${wsProtocol}//${window.location.hostname}:2567`
  : `${wsProtocol}//${window.location.host}`);

async function main() {
  // Show install prompt if not already installed as PWA
  if (!isStandalone()) {
    await showInstallScreen();
  }

  const result = await setupLobby();
  const statusEl = document.getElementById('connection-status')!;

  if (result.mode === 'offline') {
    const game = new Game(canvas, result.mapId);
    game.startOffline(result.name, result.color, result.pantsColor, result.hat, result.sunglasses);
  } else {
    statusEl.style.display = 'block';
    statusEl.textContent = `Joining room ${result.roomCode}...`;

    try {
      const client = new NetworkClient(SERVER_URL);
      await client.joinOrCreate(result.roomCode, result.name, result.color, result.numBots, result.mapId, result.pantsColor, result.hat, result.sunglasses);

      // Use the server's map (the room creator's map), not what we selected locally
      const actualMapId = (client.serverMapId || result.mapId) as MapId;
      const game = new Game(canvas, actualMapId);

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
