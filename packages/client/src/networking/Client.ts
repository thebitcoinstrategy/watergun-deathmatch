import { Client as ColyseusClient, Room } from 'colyseus.js';

export interface NetworkPlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  rotX: number;
  health: number;
  kills: number;
  deaths: number;
  color: string;
  isShooting: boolean;
  isDead: boolean;
}

export interface NetworkBot {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  health: number;
  kills: number;
  deaths: number;
  color: string;
  isDead: boolean;
}

export interface NetworkProjectile {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ownerId: string;
}

export type KillCallback = (killer: string, victim: string, victimName: string) => void;
export type HitCallback = (attackerId: string, victimId: string) => void;
export type PlayerJoinCallback = (name: string) => void;
export type PlayerLeaveCallback = (name: string) => void;

export class NetworkClient {
  private client: ColyseusClient;
  private room: Room | null = null;
  private _myId: string = '';

  // Game state received via broadcast messages (JSON)
  private _players: Map<string, NetworkPlayer> = new Map();
  private _bots: Map<string, NetworkBot> = new Map();
  private _projectiles: NetworkProjectile[] = [];

  onKill: KillCallback | null = null;
  onHit: HitCallback | null = null;
  onPlayerJoined: PlayerJoinCallback | null = null;
  onPlayerLeft: PlayerLeaveCallback | null = null;

  constructor(serverUrl: string) {
    this.client = new ColyseusClient(serverUrl);
  }

  get myId(): string { return this._myId; }
  get connected(): boolean { return this.room !== null; }
  get roomId(): string { return this.room?.roomId ?? ''; }

  async joinOrCreate(roomCode: string, name: string): Promise<string> {
    this.room = await this.client.joinOrCreate('deathmatch', { roomCode, name });
    this._myId = this.room.sessionId;
    this.setupListeners();
    return roomCode;
  }

  private setupListeners(): void {
    if (!this.room) return;

    // Receive full game state every server tick (20Hz) via JSON broadcast
    this.room.onMessage('gameState', (data: {
      players: Record<string, NetworkPlayer>;
      bots: Record<string, NetworkBot>;
      projectiles: NetworkProjectile[];
    }) => {
      // Update players
      this._players.clear();
      for (const [key, player] of Object.entries(data.players)) {
        this._players.set(key, player);
      }

      // Update bots
      this._bots.clear();
      for (const [key, bot] of Object.entries(data.bots)) {
        this._bots.set(key, bot);
      }

      // Update projectiles
      this._projectiles = data.projectiles;
    });

    // Message handlers
    this.room.onMessage('kill', (data: { killer: string; victim: string; victimName: string }) => {
      this.onKill?.(data.killer, data.victim, data.victimName);
    });

    this.room.onMessage('hit', (data: { attackerId: string; victimId: string }) => {
      this.onHit?.(data.attackerId, data.victimId);
    });

    this.room.onMessage('playerJoined', (data: { name: string }) => {
      this.onPlayerJoined?.(data.name);
    });

    this.room.onMessage('playerLeft', (data: { name: string }) => {
      this.onPlayerLeft?.(data.name);
    });
  }

  sendInput(input: {
    seq: number;
    dx: number;
    dz: number;
    rotY: number;
    rotX: number;
    jump: boolean;
    shoot: boolean;
    px: number;
    py: number;
    pz: number;
  }): void {
    this.room?.send('input', input);
  }

  reportHit(victimId: string): void {
    this.room?.send('clientHit', { victimId });
  }

  getPlayers(): Map<string, NetworkPlayer> {
    return this._players;
  }

  getBots(): Map<string, NetworkBot> {
    return this._bots;
  }

  getProjectiles(): NetworkProjectile[] {
    return this._projectiles;
  }

  getMyPlayer(): NetworkPlayer | null {
    return this._players.get(this._myId) ?? null;
  }

  disconnect(): void {
    this.room?.leave();
    this.room = null;
    this._players.clear();
    this._bots.clear();
    this._projectiles = [];
  }
}
