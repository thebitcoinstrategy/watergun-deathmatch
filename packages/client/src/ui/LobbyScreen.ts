export interface LobbyResult {
  mode: 'offline' | 'online';
  name: string;
  roomCode: string;
}

export function setupLobby(): Promise<LobbyResult> {
  return new Promise((resolve) => {
    const lobby = document.getElementById('lobby-screen')!;
    const startScreen = document.getElementById('start-screen')!;
    const fullLobby = document.getElementById('full-lobby')!;
    const joinOnly = document.getElementById('join-only')!;

    // Check for room in URL
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');

    if (roomFromUrl) {
      // Direct link — skip start screen, show only name + join
      startScreen.style.display = 'none';
      lobby.style.display = 'flex';
      fullLobby.style.display = 'none';
      joinOnly.style.display = 'block';
      document.getElementById('join-only-room')!.textContent = roomFromUrl;

      document.getElementById('btn-join-direct')!.addEventListener('click', () => {
        const name = (document.getElementById('join-only-name') as HTMLInputElement).value || 'Player';
        lobby.style.display = 'none';
        resolve({ mode: 'online', name, roomCode: roomFromUrl });
      });
      return;
    }

    // Normal flow — show start screen first
    const showLobby = () => {
      startScreen.style.display = 'none';
      lobby.style.display = 'flex';
      fullLobby.style.display = 'block';
      joinOnly.style.display = 'none';
    };

    startScreen.addEventListener('click', showLobby);
    startScreen.addEventListener('touchend', (e) => {
      e.preventDefault();
      showLobby();
    });

    // Offline button
    document.getElementById('btn-offline')!.addEventListener('click', () => {
      const name = (document.getElementById('player-name') as HTMLInputElement).value || 'Player';
      lobby.style.display = 'none';
      resolve({ mode: 'offline', name, roomCode: '' });
    });

    // Play Online button
    document.getElementById('btn-online')!.addEventListener('click', () => {
      const name = (document.getElementById('player-name') as HTMLInputElement).value || 'Player';
      const roomCode = (document.getElementById('room-code') as HTMLInputElement).value.trim() || '1';
      lobby.style.display = 'none';
      resolve({ mode: 'online', name, roomCode });
    });
  });
}
