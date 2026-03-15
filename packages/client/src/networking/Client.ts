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
export type PlayerJoinCallback = (name: string) => void;
export type PlayerLeaveCallback = (name: string) => void;

export class NetworkClient {
  private client: ColyseusClient;
  private room: Room | null = null;
  private _myId: string = '';

  // Live references to schema objects, tracked via onAdd/onRemove
  private _players: Map<string, any> = new Map();
  private _bots: Map<string, any> = new Map();
  private _projectiles: Map<string, any> = new Map();

  onKill: KillCallback | null = null;
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
    const state = this.room.state as any;

    // Track players via onAdd/onRemove (recommended Colyseus pattern)
    state.players.onAdd((player: any, key: string) => {
      console.log('[Network] Player added:', key, player.name);
      this._players.set(key, player);
    });
    state.players.onRemove((_player: any, key: string) => {
      console.log('[Network] Player removed:', key);
      this._players.delete(key);
    });

    // Track bots
    state.bots.onAdd((bot: any, key: string) => {
      console.log('[Network] Bot added:', key, bot.name);
      this._bots.set(key, bot);
    });
    state.bots.onRemove((_bot: any, key: string) => {
      this._bots.delete(key);
    });

    // Track projectiles
    state.projectiles.onAdd((proj: any, index: number) => {
      this._projectiles.set(proj.id, proj);
    });
    state.projectiles.onRemove((proj: any, _index: number) => {
      this._projectiles.delete(proj.id);
    });

    // Message handlers
    this.room.onMessage('kill', (data: { killer: string; victim: string; victimName: string }) => {
      this.onKill?.(data.killer, data.victim, data.victimName);
    });

    this.room.onMessage('playerJoined', (data: { name: string }) => {
      this.onPlayerJoined?.(data.name);
    });

    this.room.onMessage('playerLeft', (data: { name: string }) => {
      this.onPlayerLeft?.(data.name);
    });

    // Debug: log state changes
    this.room.onStateChange((state: any) => {
      console.log('[Network] State changed - players:', this._players.size, 'bots:', this._bots.size, 'projectiles:', this._projectiles.size);
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
  }): void {
    this.room?.send('input', input);
  }

  getPlayers(): Map<string, NetworkPlayer> {
    const players = new Map<string, NetworkPlayer>();
    for (const [key, player] of this._players) {
      players.set(key, {
        id: player.id,
        name: player.name,
        x: player.x,
        y: player.y,
        z: player.z,
        rotY: player.rotY,
        rotX: player.rotX,
        health: player.health,
        kills: player.kills,
        deaths: player.deaths,
        color: player.color,
        isShooting: player.isShooting,
        isDead: player.isDead,
      });
    }
    return players;
  }

  getBots(): Map<string, NetworkBot> {
    const bots = new Map<string, NetworkBot>();
    for (const [key, bot] of this._bots) {
      bots.set(key, {
        id: bot.id,
        name: bot.name,
        x: bot.x,
        y: bot.y,
        z: bot.z,
        rotY: bot.rotY,
        health: bot.health,
        kills: bot.kills,
        deaths: bot.deaths,
        color: bot.color,
        isDead: bot.isDead,
      });
    }
    return bots;
  }

  getProjectiles(): NetworkProjectile[] {
    const projectiles: NetworkProjectile[] = [];
    for (const [, proj] of this._projectiles) {
      projectiles.push({
        id: proj.id,
        x: proj.x,
        y: proj.y,
        z: proj.z,
        vx: proj.vx,
        vy: proj.vy,
        vz: proj.vz,
        ownerId: proj.ownerId,
      });
    }
    return projectiles;
  }

  getMyPlayer(): NetworkPlayer | null {
    return this.getPlayers().get(this._myId) ?? null;
  }

  disconnect(): void {
    this.room?.leave();
    this.room = null;
    this._players.clear();
    this._bots.clear();
    this._projectiles.clear();
  }
}
