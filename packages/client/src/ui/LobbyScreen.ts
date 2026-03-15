import * as THREE from 'three';
import { MAPS, type MapId } from '@watergun/shared';
import { createBlockyCharacter, type CharacterOptions } from '../rendering/PlayerRenderer';
import { SoundManager } from '../audio/SoundManager';

export interface LobbyResult {
  mode: 'offline' | 'online';
  name: string;
  roomCode: string;
  color: string;
  pantsColor: string;
  hat: string;
  sunglasses: boolean;
  numBots: number;
  mapId: MapId;
}

declare const __BUILD_TIME__: string;

function setupColorPicker(containerId: string, savedColor: string, onUpdate: () => void): () => string {
  const container = document.getElementById(containerId);
  if (!container) return () => '#4fc3f7';

  const swatches = container.querySelectorAll('.color-swatch');
  let selectedColor = savedColor;

  swatches.forEach((s) => {
    const c = (s as HTMLElement).dataset.color || '';
    if (c === savedColor) s.classList.add('selected');
    else s.classList.remove('selected');
  });

  swatches.forEach((swatch) => {
    swatch.addEventListener('click', () => {
      swatches.forEach((s) => s.classList.remove('selected'));
      swatch.classList.add('selected');
      selectedColor = (swatch as HTMLElement).dataset.color || '#4fc3f7';
      onUpdate();
    });
  });

  return () => selectedColor;
}

function setupMapGrid(): () => MapId {
  const grid = document.getElementById('map-grid');
  if (!grid) return () => 'aqua_park' as MapId;

  const cards = grid.querySelectorAll('.map-card');
  let selectedMap: MapId = 'aqua_park';

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      cards.forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedMap = (card as HTMLElement).dataset.map as MapId;
    });
  });

  return () => selectedMap;
}

function setupHatPicker(onUpdate: () => void): () => string {
  const picker = document.getElementById('hat-picker');
  if (!picker) return () => 'none';

  const options = picker.querySelectorAll('.hat-option');
  let selectedHat = 'none';

  options.forEach((opt) => {
    opt.addEventListener('click', () => {
      options.forEach((o) => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedHat = (opt as HTMLElement).dataset.hat || 'none';
      onUpdate();
    });
  });

  return () => selectedHat;
}

// 3D character preview in the lobby
class CharacterPreview {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private character: THREE.Group | null = null;
  private animFrame: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.width, canvas.height);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    this.camera = new THREE.PerspectiveCamera(35, canvas.width / canvas.height, 0.1, 20);
    this.camera.position.set(0, 1.3, 4.5);
    this.camera.lookAt(0, 1.0, 0);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2, 3, 3);
    this.scene.add(dir);
    const back = new THREE.DirectionalLight(0x4fc3f7, 0.3);
    back.position.set(-2, 1, -2);
    this.scene.add(back);

    // Floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 16),
      new THREE.MeshStandardMaterial({ color: '#263238' })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.scene.add(floor);

    this.animate();
  }

  updateCharacter(opts: CharacterOptions): void {
    if (this.character) {
      this.scene.remove(this.character);
    }
    this.character = createBlockyCharacter(opts);
    this.scene.add(this.character);
  }

  private animate = (): void => {
    this.animFrame = requestAnimationFrame(this.animate);
    if (this.character) {
      this.character.rotation.y += 0.008;
    }
    this.renderer.render(this.scene, this.camera);
  };

  destroy(): void {
    cancelAnimationFrame(this.animFrame);
    this.renderer.dispose();
  }
}

export function setupLobby(): Promise<LobbyResult> {
  return new Promise((resolve) => {
    // Build version
    const buildEl = document.getElementById('build-version');
    if (buildEl) {
      const buildDate = new Date(__BUILD_TIME__);
      buildEl.textContent = `Build: ${buildDate.toLocaleString()}`;
    }

    const lobby = document.getElementById('lobby-screen')!;
    const startScreen = document.getElementById('start-screen')!;
    const fullLobby = document.getElementById('full-lobby')!;
    const joinOnly = document.getElementById('join-only')!;

    // Restore saved values
    const savedName = localStorage.getItem('watergun_name') || '';
    const savedColor = localStorage.getItem('watergun_color') || '#4fc3f7';
    const savedPants = localStorage.getItem('watergun_pants') || '#2196f3';
    const savedHat = localStorage.getItem('watergun_hat') || 'none';
    const savedSunglasses = localStorage.getItem('watergun_sunglasses') === 'true';

    const nameInput = document.getElementById('player-name') as HTMLInputElement;
    const joinNameInput = document.getElementById('join-only-name') as HTMLInputElement;
    const sunglassesToggle = document.getElementById('sunglasses-toggle') as HTMLInputElement;
    if (savedName) {
      nameInput.value = savedName;
      joinNameInput.value = savedName;
    }
    sunglassesToggle.checked = savedSunglasses;

    // Restore hat selection
    const hatOptions = document.querySelectorAll('#hat-picker .hat-option');
    hatOptions.forEach((opt) => {
      if ((opt as HTMLElement).dataset.hat === savedHat) {
        hatOptions.forEach((o) => o.classList.remove('selected'));
        opt.classList.add('selected');
      }
    });

    // 3D preview
    let preview: CharacterPreview | null = null;
    const previewCanvas = document.getElementById('preview-canvas') as HTMLCanvasElement;

    const updatePreview = () => {
      const opts: CharacterOptions = {
        shirtColor: getColor(),
        pantsColor: getPantsColor(),
        hat: getHat() as CharacterOptions['hat'],
        sunglasses: sunglassesToggle.checked,
      };
      if (preview) preview.updateCharacter(opts);
    };

    // Setup pickers
    const getColor = setupColorPicker('color-picker', savedColor, updatePreview);
    const getPantsColor = setupColorPicker('pants-picker', savedPants, updatePreview);
    const getColorJoin = setupColorPicker('color-picker-join', savedColor, () => {});
    const getHat = setupHatPicker(updatePreview);
    const getMap = setupMapGrid();

    // Restore hat getter value
    const hatPicker = document.getElementById('hat-picker');
    if (hatPicker) {
      const opts = hatPicker.querySelectorAll('.hat-option');
      opts.forEach((opt) => {
        if ((opt as HTMLElement).dataset.hat === savedHat) {
          opts.forEach((o) => o.classList.remove('selected'));
          opt.classList.add('selected');
        }
      });
    }

    sunglassesToggle.addEventListener('change', updatePreview);

    nameInput.addEventListener('input', () => {
      localStorage.setItem('watergun_name', nameInput.value);
    });
    joinNameInput.addEventListener('input', () => {
      localStorage.setItem('watergun_name', joinNameInput.value);
    });

    // Lobby music
    const lobbySound = new SoundManager();

    // Check for room in URL
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');

    if (roomFromUrl) {
      // Pre-fill room code and skip straight to full lobby
      const roomInput = document.getElementById('room-code') as HTMLInputElement;
      if (roomInput) roomInput.value = roomFromUrl;

      // Skip start screen, go straight to lobby
      startScreen.style.display = 'none';
      lobby.style.display = 'flex';
      fullLobby.style.display = 'block';
      joinOnly.style.display = 'none';

      // Hide room settings that are controlled by the room creator
      const mapCol = document.querySelector('.lobby-col-right') as HTMLElement;
      // Hide room code, bot count, and Solo button — only show Multiplayer (join)
      const roomField = roomInput?.closest('.lobby-field') as HTMLElement;
      if (roomField) roomField.style.display = 'none';
      const botField = document.getElementById('bot-count')?.closest('.lobby-field') as HTMLElement;
      if (botField) botField.style.display = 'none';
      const soloBtn = document.getElementById('btn-offline') as HTMLElement;
      if (soloBtn) soloBtn.style.display = 'none';
      // Rename multiplayer button to "Join Game"
      const mpBtn = document.getElementById('btn-online') as HTMLElement;
      if (mpBtn) mpBtn.textContent = 'Join Game';

      // Fetch room info from server to show which map is being played
      const httpProto = window.location.protocol;
      const isDev = !!window.location.port && window.location.port !== '2567' && window.location.port !== '80' && window.location.port !== '443';
      const apiBase = import.meta.env.VITE_SERVER_URL
        ? import.meta.env.VITE_SERVER_URL.replace(/^wss?:/, httpProto)
        : isDev
          ? `${httpProto}//${window.location.hostname}:2567`
          : `${httpProto}//${window.location.host}`;

      // Show map column with "loading" state, then update with actual map
      if (mapCol) {
        mapCol.innerHTML = `
          <div class="lobby-field">
            <label>Room Map</label>
            <div style="padding:12px;text-align:center;color:#aaa;">Loading room info...</div>
          </div>`;
      }

      fetch(`${apiBase}/api/room-info/${encodeURIComponent(roomFromUrl)}`)
        .then((r) => r.json())
        .then((info: { exists: boolean; mapId?: string; players?: number }) => {
          if (mapCol) {
            if (info.exists && info.mapId) {
              const mapDef = MAPS[info.mapId as MapId];
              const mapName = mapDef ? mapDef.name : info.mapId;
              mapCol.innerHTML = `
                <div class="lobby-field">
                  <label>Room Map</label>
                  <div class="join-room-info">
                    <div class="join-room-map">${mapName}</div>
                    <div class="join-room-detail">Room: ${roomFromUrl} &bull; ${info.players || 0} player(s) in game</div>
                  </div>
                </div>`;
            } else {
              mapCol.innerHTML = `
                <div class="lobby-field">
                  <label>Room Info</label>
                  <div class="join-room-info">
                    <div class="join-room-map">New Room</div>
                    <div class="join-room-detail">Room "${roomFromUrl}" doesn't exist yet — you'll create it</div>
                  </div>
                </div>`;
            }
          }
        })
        .catch(() => {
          if (mapCol) {
            mapCol.innerHTML = `
              <div class="lobby-field">
                <label>Room Info</label>
                <div style="padding:12px;text-align:center;color:#aaa;">Could not fetch room info</div>
              </div>`;
          }
        });

      // Start 3D preview
      if (!preview && previewCanvas) {
        preview = new CharacterPreview(previewCanvas);
        updatePreview();
      }

      // Start lobby music
      lobbySound.startLobbyMusic();
      // Don't return — fall through to normal button handlers below
    }

    // Normal flow
    const showLobby = () => {
      startScreen.style.display = 'none';
      lobby.style.display = 'flex';
      fullLobby.style.display = 'block';
      joinOnly.style.display = 'none';

      // Start 3D preview
      if (!preview && previewCanvas) {
        preview = new CharacterPreview(previewCanvas);
        updatePreview();
      }

      // Start lobby music
      lobbySound.startLobbyMusic();
    };

    startScreen.addEventListener('click', showLobby);
    startScreen.addEventListener('touchend', (e) => {
      e.preventDefault();
      showLobby();
    });

    const saveAndResolve = (mode: 'offline' | 'online', roomCode: string, numBots: number) => {
      const name = nameInput.value || 'Player';
      const color = getColor();
      const pantsColor = getPantsColor();
      const hat = getHat();
      const sunglasses = sunglassesToggle.checked;
      const mapId = getMap();

      localStorage.setItem('watergun_name', name);
      localStorage.setItem('watergun_color', color);
      localStorage.setItem('watergun_pants', pantsColor);
      localStorage.setItem('watergun_hat', hat);
      localStorage.setItem('watergun_sunglasses', String(sunglasses));

      lobby.style.display = 'none';
      lobbySound.stopMusic();
      if (preview) preview.destroy();
      resolve({ mode, name, roomCode, color, pantsColor, hat, sunglasses, numBots, mapId });
    };

    document.getElementById('btn-offline')!.addEventListener('click', () => {
      saveAndResolve('offline', '', 2);
    });

    document.getElementById('btn-online')!.addEventListener('click', () => {
      const roomCode = (document.getElementById('room-code') as HTMLInputElement).value.trim() || '1';
      const numBots = parseInt((document.getElementById('bot-count') as HTMLSelectElement).value) || 0;
      saveAndResolve('online', roomCode, numBots);
    });
  });
}
