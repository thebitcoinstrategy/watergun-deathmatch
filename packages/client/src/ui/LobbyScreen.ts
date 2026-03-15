export interface LobbyResult {
  mode: 'offline' | 'online';
  name: string;
  roomCode: string;
  color: string;
}

declare const __BUILD_TIME__: string;

function setupColorPicker(containerId: string, savedColor: string): () => string {
  const container = document.getElementById(containerId);
  if (!container) return () => '#4fc3f7';

  const swatches = container.querySelectorAll('.color-swatch');

  // Restore saved color
  let selectedColor = savedColor;
  swatches.forEach((s) => {
    const c = (s as HTMLElement).dataset.color || '';
    if (c === savedColor) {
      s.classList.add('selected');
    } else {
      s.classList.remove('selected');
    }
  });

  swatches.forEach((swatch) => {
    swatch.addEventListener('click', () => {
      swatches.forEach((s) => s.classList.remove('selected'));
      swatch.classList.add('selected');
      selectedColor = (swatch as HTMLElement).dataset.color || '#4fc3f7';
      localStorage.setItem('watergun_color', selectedColor);
    });
  });

  return () => selectedColor;
}

export function setupLobby(): Promise<LobbyResult> {
  return new Promise((resolve) => {
    // Show build version
    const buildEl = document.getElementById('build-version');
    if (buildEl) {
      const buildDate = new Date(__BUILD_TIME__);
      const formatted = buildDate.toLocaleString();
      buildEl.textContent = `Build: ${formatted}`;
    }

    const lobby = document.getElementById('lobby-screen')!;
    const startScreen = document.getElementById('start-screen')!;
    const fullLobby = document.getElementById('full-lobby')!;
    const joinOnly = document.getElementById('join-only')!;

    // Restore saved name and color from localStorage
    const savedName = localStorage.getItem('watergun_name') || '';
    const savedColor = localStorage.getItem('watergun_color') || '#4fc3f7';

    const nameInput = document.getElementById('player-name') as HTMLInputElement;
    const joinNameInput = document.getElementById('join-only-name') as HTMLInputElement;
    if (savedName) {
      nameInput.value = savedName;
      joinNameInput.value = savedName;
    }

    // Setup color pickers
    const getColor = setupColorPicker('color-picker', savedColor);
    const getColorJoin = setupColorPicker('color-picker-join', savedColor);

    // Save name on input change
    nameInput.addEventListener('input', () => {
      localStorage.setItem('watergun_name', nameInput.value);
    });
    joinNameInput.addEventListener('input', () => {
      localStorage.setItem('watergun_name', joinNameInput.value);
    });

    // Check for room in URL
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');

    if (roomFromUrl) {
      startScreen.style.display = 'none';
      lobby.style.display = 'flex';
      fullLobby.style.display = 'none';
      joinOnly.style.display = 'block';
      document.getElementById('join-only-room')!.textContent = roomFromUrl;

      document.getElementById('btn-join-direct')!.addEventListener('click', () => {
        const name = joinNameInput.value || 'Player';
        localStorage.setItem('watergun_name', name);
        const color = getColorJoin();
        localStorage.setItem('watergun_color', color);
        lobby.style.display = 'none';
        resolve({ mode: 'online', name, roomCode: roomFromUrl, color });
      });
      return;
    }

    // Normal flow
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

    document.getElementById('btn-offline')!.addEventListener('click', () => {
      const name = nameInput.value || 'Player';
      localStorage.setItem('watergun_name', name);
      const color = getColor();
      localStorage.setItem('watergun_color', color);
      lobby.style.display = 'none';
      resolve({ mode: 'offline', name, roomCode: '', color });
    });

    document.getElementById('btn-online')!.addEventListener('click', () => {
      const name = nameInput.value || 'Player';
      const roomCode = (document.getElementById('room-code') as HTMLInputElement).value.trim() || '1';
      localStorage.setItem('watergun_name', name);
      const color = getColor();
      localStorage.setItem('watergun_color', color);
      lobby.style.display = 'none';
      resolve({ mode: 'online', name, roomCode, color });
    });
  });
}
