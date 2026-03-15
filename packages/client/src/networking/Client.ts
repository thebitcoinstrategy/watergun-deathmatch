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
  pantsColor: string;
  hat: string;
  sunglasses: boolean;
  isShooting: boolean;
  isDead: boolean;
  spawnProtection: number;
  speedBoostTimer: number;
  weapon: string;
}

export interface NetworkEnergyDrink {
  id: string;
  x: number;
  z: number;
}

export interface NetworkWeaponPickup {
  id: string;
  x: number;
  z: number;
  weaponId: string;
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
  weaponId?: string;
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
  private _energyDrinks: Map<string, NetworkEnergyDrink> = new Map();
  private _weaponPickups: Map<string, NetworkWeaponPickup> = new Map();
  private _healthPacks: Map<string, { id: string; x: number; z: number }> = new Map();

  onKill: KillCallback | null = null;
  onHit: HitCallback | null = null;
  onPlayerJoined: PlayerJoinCallback | null = null;
  onPlayerLeft: PlayerLeaveCallback | null = null;
  onDrinkPickup: ((playerName: string) => void) | null = null;
  onWeaponPickup: ((playerName: string, weaponName: string) => void) | null = null;
  onHealthPickup: ((playerName: string) => void) | null = null;
  onVoiceOffer: ((fromId: string, sdp: string) => void) | null = null;
  onVoiceAnswer: ((fromId: string, sdp: string) => void) | null = null;
  onVoiceIce: ((fromId: string, candidate: RTCIceCandidateInit) => void) | null = null;

  constructor(serverUrl: string) {
    this.client = new ColyseusClient(serverUrl);
  }

  private _serverMapId: string = '';

  get myId(): string { return this._myId; }
  get connected(): boolean { return this.room !== null; }
  get roomId(): string { return this.room?.roomId ?? ''; }
  get serverMapId(): string { return this._serverMapId; }

  async joinOrCreate(roomCode: string, name: string, color?: string, numBots?: number, mapId?: string, pantsColor?: string, hat?: string, sunglasses?: boolean): Promise<string> {
    this.room = await this.client.joinOrCreate('deathmatch', { roomCode, name, color, numBots, mapId, pantsColor, hat, sunglasses });
    this._myId = this.room.sessionId;

    // Wait for server to tell us which map the room is using before setting up other listeners
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 2000);
      this.room!.onMessage('roomInfo', (data: { mapId: string }) => {
        this._serverMapId = data.mapId;
        clearTimeout(timeout);
        resolve();
      });
    });

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
      energyDrinks?: Record<string, NetworkEnergyDrink>;
      weaponPickups?: Record<string, NetworkWeaponPickup>;
      healthPacks?: Record<string, { id: string; x: number; z: number }>;
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

      // Update energy drinks
      if (data.energyDrinks) {
        this._energyDrinks.clear();
        for (const [key, drink] of Object.entries(data.energyDrinks)) {
          this._energyDrinks.set(key, drink);
        }
      }

      // Update weapon pickups
      if (data.weaponPickups) {
        this._weaponPickups.clear();
        for (const [key, pickup] of Object.entries(data.weaponPickups)) {
          this._weaponPickups.set(key, pickup);
        }
      }

      // Update health packs
      if (data.healthPacks) {
        this._healthPacks.clear();
        for (const [key, pack] of Object.entries(data.healthPacks)) {
          this._healthPacks.set(key, pack);
        }
      }
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

    this.room.onMessage('drinkPickup', (data: { playerId: string; playerName: string }) => {
      this.onDrinkPickup?.(data.playerName);
    });

    this.room.onMessage('weaponPickup', (data: { playerName: string; weaponName: string }) => {
      this.onWeaponPickup?.(data.playerName, data.weaponName);
    });

    this.room.onMessage('healthPickup', (data: { playerName: string }) => {
      this.onHealthPickup?.(data.playerName);
    });

    this.room.onMessage('playerLeft', (data: { name: string }) => {
      this.onPlayerLeft?.(data.name);
    });

    // Voice chat signaling
    this.room.onMessage('voiceOffer', (data: { fromId: string; sdp: string }) => {
      this.onVoiceOffer?.(data.fromId, data.sdp);
    });
    this.room.onMessage('voiceAnswer', (data: { fromId: string; sdp: string }) => {
      this.onVoiceAnswer?.(data.fromId, data.sdp);
    });
    this.room.onMessage('voiceIce', (data: { fromId: string; candidate: RTCIceCandidateInit }) => {
      this.onVoiceIce?.(data.fromId, data.candidate);
    });
  }

  sendVoiceSignal(type: string, data: any): void {
    this.room?.send(type, data);
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
    sdx?: number;
    sdy?: number;
    sdz?: number;
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

  getEnergyDrinks(): Map<string, NetworkEnergyDrink> {
    return this._energyDrinks;
  }

  getWeaponPickups(): Map<string, NetworkWeaponPickup> {
    return this._weaponPickups;
  }

  getHealthPacks(): Map<string, { id: string; x: number; z: number }> {
    return this._healthPacks;
  }

  disconnect(): void {
    this.room?.leave();
    this.room = null;
    this._players.clear();
    this._bots.clear();
    this._energyDrinks.clear();
    this._weaponPickups.clear();
    this._healthPacks.clear();
    this._projectiles = [];
  }
}
