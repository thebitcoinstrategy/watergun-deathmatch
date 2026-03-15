import { Schema, MapSchema, type, ArraySchema } from '@colyseus/schema';

export class PlayerSchema extends Schema {
  @type('string') id: string = '';
  @type('string') name: string = '';
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') z: number = 0;
  @type('number') rotY: number = 0;
  @type('number') rotX: number = 0;
  @type('number') health: number = 100;
  @type('number') kills: number = 0;
  @type('number') deaths: number = 0;
  @type('string') color: string = '#4fc3f7';
  @type('boolean') isShooting: boolean = false;
  @type('boolean') isDead: boolean = false;

  // Server-side only (not synced)
  velocityY: number = 0;
  isGrounded: boolean = true;
  respawnTimer: number = 0;
  lastShootTime: number = 0;
}

export class ProjectileSchema extends Schema {
  @type('string') id: string = '';
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') z: number = 0;
  @type('number') vx: number = 0;
  @type('number') vy: number = 0;
  @type('number') vz: number = 0;
  @type('string') ownerId: string = '';

  age: number = 0;
}

export class BotSchema extends Schema {
  @type('string') id: string = '';
  @type('string') name: string = '';
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') z: number = 0;
  @type('number') rotY: number = 0;
  @type('number') health: number = 100;
  @type('number') kills: number = 0;
  @type('number') deaths: number = 0;
  @type('string') color: string = '#f44336';
  @type('boolean') isDead: boolean = false;

  // Server-side only
  velocityY: number = 0;
  isGrounded: boolean = true;
  state: string = 'patrol';
  patrolTargetX: number = 0;
  patrolTargetZ: number = 0;
  patrolTimer: number = 0;
  shootTimer: number = 0;
  respawnTimer: number = 0;
  targetPlayerId: string = '';
}

export class GameRoomState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type([ProjectileSchema]) projectiles = new ArraySchema<ProjectileSchema>();
  @type({ map: BotSchema }) bots = new MapSchema<BotSchema>();
}
