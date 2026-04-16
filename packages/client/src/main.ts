import { Game } from './Game';
import { setupLobby } from './ui/LobbyScreen';
import { NetworkClient } from './networking/Client';
import type { MapId } from '@watergun/shared';

// --- PWA Debug Log (visible overlay on mobile) ---
const debugLines: string[] = [];
function pwaLog(msg: string) {
  const ts = new Date().toLocaleTimeString();
  const line = `[${ts}] ${msg}`;
  console.log('[PWA]', msg);
  debugLines.push(line);
  const el = document.getElementById('pwa-debug');
  if (el) el.textContent = debugLines.slice(-15).join('\n');
}

// Capture the beforeinstallprompt event for the install button
let deferredPrompt: any = null;
let installPromptResolve: (() => void) | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  pwaLog('beforeinstallprompt fired!');
  e.preventDefault();
  deferredPrompt = e;
  // If the install screen is already waiting for this, unblock it
  if (installPromptResolve) {
    installPromptResolve();
    installPromptResolve = null;
  }
});

window.addEventListener('appinstalled', () => {
  pwaLog('appinstalled event — PWA installed!');
});

// Register service worker and wait until it's active
async function registerSW(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    pwaLog('No SW support');
    return;
  }
  pwaLog('Registering SW...');
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    pwaLog(`SW registered, scope: ${reg.scope}`);
    pwaLog(`SW state: installing=${!!reg.installing} waiting=${!!reg.waiting} active=${!!reg.active}`);

    // Wait for the SW to become active if it isn't yet
    if (!reg.active) {
      const sw = reg.installing || reg.waiting;
      if (sw) {
        await new Promise<void>((resolve) => {
          sw.addEventListener('statechange', () => {
            pwaLog(`SW state changed: ${sw.state}`);
            if (sw.state === 'activated') resolve();
          });
        });
      }
    }
    pwaLog('SW is active');

    // Also wait for navigator.serviceWorker.ready (belt and suspenders)
    await navigator.serviceWorker.ready;
    pwaLog('SW ready');
  } catch (err) {
    pwaLog(`SW register failed: ${err}`);
  }
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

async function showInstallScreen(): Promise<void> {
  const screen = document.getElementById('install-screen')!;
  const btnInstall = document.getElementById('btn-install')!;
  const btnSkip = document.getElementById('btn-skip-install')!;
  const iosHint = document.getElementById('install-ios-hint')!;

  // Register SW and wait for it to be active first
  await registerSW();

  // If beforeinstallprompt hasn't fired yet, wait up to 5 seconds for it
  if (!deferredPrompt) {
    pwaLog('Waiting for beforeinstallprompt (up to 5s)...');
    await Promise.race([
      new Promise<void>((resolve) => { installPromptResolve = resolve; }),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]);
    installPromptResolve = null;
  }

  if (!deferredPrompt && !isIOS()) {
    pwaLog('beforeinstallprompt never fired — skipping install screen');
    // Browser doesn't consider app installable or it's already installed
    return;
  }

  pwaLog(`Showing install screen, deferredPrompt=${!!deferredPrompt}, isIOS=${isIOS()}`);
  screen.style.display = 'flex';

  if (isIOS()) {
    btnInstall.style.display = 'none';
    iosHint.style.display = 'block';
  }

  return new Promise((resolve) => {
    btnInstall.addEventListener('click', async () => {
      pwaLog(`Install clicked, deferredPrompt=${!!deferredPrompt}`);
      if (deferredPrompt) {
        pwaLog('Calling prompt()...');
        deferredPrompt.prompt();
        pwaLog('Waiting for userChoice...');
        const result = await deferredPrompt.userChoice;
        pwaLog(`userChoice outcome: ${result.outcome}`);
        deferredPrompt = null;
        if (result.outcome === 'accepted') {
          pwaLog('User accepted install');
          screen.style.display = 'none';
          resolve();
          return;
        }
        pwaLog('User dismissed install');
      }
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
    pwaLog(`standalone=${isStandalone()}, iOS=${isIOS()}`);
    await showInstallScreen();
  } else {
    pwaLog('Running as installed PWA — skipping install screen');
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
