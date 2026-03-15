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

    this.room.onMessage('kill', (data: { killer: string; victim: string; victimName: string }) => {
      this.onKill?.(data.killer, data.victim, data.victimName);
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
  }): void {
    this.room?.send('input', input);
  }

  getPlayers(): Map<string, NetworkPlayer> {
    const players = new Map<string, NetworkPlayer>();
    if (!this.room) return players;

    this.room.state.players.forEach((player: any, key: string) => {
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
    });

    return players;
  }

  getBots(): Map<string, NetworkBot> {
    const bots = new Map<string, NetworkBot>();
    if (!this.room) return bots;

    this.room.state.bots.forEach((bot: any, key: string) => {
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
    });

    return bots;
  }

  getProjectiles(): NetworkProjectile[] {
    if (!this.room) return [];

    const projectiles: NetworkProjectile[] = [];
    this.room.state.projectiles.forEach((proj: any) => {
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
    });

    return projectiles;
  }

  getMyPlayer(): NetworkPlayer | null {
    return this.getPlayers().get(this._myId) ?? null;
  }

  disconnect(): void {
    this.room?.leave();
    this.room = null;
  }
}
