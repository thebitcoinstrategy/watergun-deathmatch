import { Room, Client } from 'colyseus';
import { GameRoomState, PlayerSchema, ProjectileSchema, BotSchema } from '../schemas/GameState';

const MAP_SIZE = 40;
const PLAYER_SPEED = 8;
const GRAVITY = -25;
const JUMP_FORCE = 8;
const MAX_HEALTH = 100;
const WATER_DAMAGE = 10;
const WATER_SPEED = 30;
const NUM_BOTS = 1;

const PLAYER_COLORS = ['#4fc3f7', '#f44336', '#e91e63', '#9c27b0', '#ff9800', '#ffeb3b', '#8bc34a', '#00bcd4'];
const BOT_COLORS = ['#f44336', '#e91e63', '#9c27b0', '#ff9800', '#ffeb3b', '#8bc34a'];
const BOT_NAMES = ['Splasher', 'Drizzle', 'Tsunami', 'Squirt', 'Puddle', 'Soaker'];

const EDGE_SPAWNS = [
  { x: -17, z: -17 }, { x: 17, z: -17 },
  { x: -17, z: 17 }, { x: 17, z: 17 },
  { x: 0, z: -18 }, { x: 0, z: 18 },
  { x: -18, z: 0 }, { x: 18, z: 0 },
];

interface PlayerInput {
  seq: number;
  dx: number;
  dz: number;
  rotY: number;
  rotX: number;
  jump: boolean;
  shoot: boolean;
}

let projectileCounter = 0;

export class DeathMatchRoom extends Room<GameRoomState> {
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private lastTickTime = Date.now();
  private playerInputs: Map<string, PlayerInput> = new Map();

  onCreate(options: { roomCode?: string }) {
    this.setState(new GameRoomState());
    this.maxClients = 8;
    console.log(`[Room ${this.roomId}] Created with roomCode="${options.roomCode || '1'}"`);

    // Store room code in metadata for display
    this.setMetadata({ roomCode: options.roomCode || '1' });

    // Spawn bots
    for (let i = 0; i < NUM_BOTS; i++) {
      const bot = new BotSchema();
      bot.id = `bot_${i}`;
      bot.name = BOT_NAMES[i % BOT_NAMES.length];
      bot.color = BOT_COLORS[i % BOT_COLORS.length];
      bot.health = MAX_HEALTH;
      const spawn = this.getEdgeSpawn();
      bot.x = spawn.x;
      bot.z = spawn.z;
      bot.patrolTargetX = (Math.random() - 0.5) * (MAP_SIZE - 6);
      bot.patrolTargetZ = (Math.random() - 0.5) * (MAP_SIZE - 6);
      this.state.bots.set(bot.id, bot);
    }

    // Handle player input — just store the latest, applied in gameTick
    this.onMessage('input', (client: Client, input: PlayerInput) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.isDead) return;

      // Store latest input for this player
      this.playerInputs.set(client.sessionId, input);

      // Shooting needs immediate response (not deferred to tick)
      if (input.shoot) {
        const now = Date.now();
        if (now - player.lastShootTime >= 200) {
          player.lastShootTime = now;
          player.isShooting = true;
          this.spawnProjectile(player);
        }
      } else {
        player.isShooting = false;
      }
    });

    // Game tick at 20Hz
    this.tickInterval = setInterval(() => this.gameTick(), 50);
  }

  onJoin(client: Client, options: { name?: string }) {
    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.name = options.name || `Player ${this.state.players.size + 1}`;
    player.color = PLAYER_COLORS[this.state.players.size % PLAYER_COLORS.length];
    player.health = MAX_HEALTH;

    const spawn = this.getEdgeSpawn();
    player.x = spawn.x;
    player.z = spawn.z;

    this.state.players.set(client.sessionId, player);
    console.log(`[Room ${this.roomId}] Player "${player.name}" joined (${client.sessionId}). Total players: ${this.state.players.size}`);

    // Notify all clients
    this.broadcast('playerJoined', { name: player.name });
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      this.broadcast('playerLeft', { name: player.name });
      this.state.players.delete(client.sessionId);
      this.playerInputs.delete(client.sessionId);
    }
  }

  onDispose() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
  }

  private gameTick() {
    const now = Date.now();
    const dt = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    // Apply stored player inputs (once per tick, using actual dt)
    this.state.players.forEach((player) => {
      const input = this.playerInputs.get(player.id);
      if (!input || player.isDead) return;

      player.rotY = input.rotY;
      player.rotX = input.rotX;

      const moveX = -input.dx * Math.cos(input.rotY) - input.dz * Math.sin(input.rotY);
      const moveZ = input.dx * Math.sin(input.rotY) - input.dz * Math.cos(input.rotY);

      player.x += moveX * PLAYER_SPEED * dt;
      player.z += moveZ * PLAYER_SPEED * dt;

      if (input.jump && player.isGrounded) {
        player.velocityY = JUMP_FORCE;
        player.isGrounded = false;
      }
    });

    // Update players (gravity, bounds, respawn)
    this.state.players.forEach((player) => {
      if (player.isDead) {
        player.respawnTimer -= dt;
        if (player.respawnTimer <= 0) {
          this.respawnPlayer(player);
        }
        return;
      }

      // Gravity
      player.velocityY += GRAVITY * dt;
      player.y += player.velocityY * dt;
      if (player.y <= 0) {
        player.y = 0;
        player.velocityY = 0;
        player.isGrounded = true;
      }

      // Bounds
      const half = MAP_SIZE / 2 - 1;
      player.x = Math.max(-half, Math.min(half, player.x));
      player.z = Math.max(-half, Math.min(half, player.z));
    });

    // Update bots
    this.state.bots.forEach((bot) => {
      this.updateBot(bot, dt);
    });

    // Update projectiles
    for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
      const proj = this.state.projectiles.at(i);
      if (!proj) continue;
      proj.age += dt;
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.z += proj.vz * dt;
      proj.vy -= 9.8 * dt;

      // Remove if hit ground or expired
      if (proj.y <= 0 || proj.age >= 2) {
        this.state.projectiles.splice(i, 1);
        continue;
      }

      // Check hits against players
      let hitSomething = false;
      const px = proj.x, py = proj.y, pz = proj.z;
      const projOwner = proj.ownerId;
      this.state.players.forEach((player) => {
        if (hitSomething || player.isDead || player.id === projOwner) return;
        if (this.pointInPlayerBox(px, py, pz, player.x, player.y, player.z)) {
          hitSomething = true;
          this.damagePlayer(player, projOwner);
        }
      });

      // Check hits against bots
      if (!hitSomething) {
        this.state.bots.forEach((bot) => {
          if (hitSomething || bot.isDead || bot.id === projOwner) return;
          if (this.pointInPlayerBox(px, py, pz, bot.x, bot.y, bot.z)) {
            hitSomething = true;
            this.damageBot(bot, projOwner);
          }
        });
      }

      if (hitSomething) {
        this.state.projectiles.splice(i, 1);
      }
    }

    // Broadcast full game state as JSON (bypasses schema sync issues)
    const playersData: Record<string, any> = {};
    this.state.players.forEach((p) => {
      playersData[p.id] = {
        id: p.id, name: p.name, x: p.x, y: p.y, z: p.z,
        rotY: p.rotY, rotX: p.rotX, health: p.health,
        kills: p.kills, deaths: p.deaths, color: p.color,
        isShooting: p.isShooting, isDead: p.isDead,
      };
    });

    const botsData: Record<string, any> = {};
    this.state.bots.forEach((b) => {
      botsData[b.id] = {
        id: b.id, name: b.name, x: b.x, y: b.y, z: b.z,
        rotY: b.rotY, health: b.health, kills: b.kills,
        deaths: b.deaths, color: b.color, isDead: b.isDead,
      };
    });

    const projectilesData: any[] = [];
    for (let i = 0; i < this.state.projectiles.length; i++) {
      const pr = this.state.projectiles.at(i);
      if (!pr) continue;
      projectilesData.push({
        id: pr.id, x: pr.x, y: pr.y, z: pr.z,
        vx: pr.vx, vy: pr.vy, vz: pr.vz, ownerId: pr.ownerId,
      });
    }

    this.broadcast('gameState', { players: playersData, bots: botsData, projectiles: projectilesData });
  }

  private updateBot(bot: BotSchema, dt: number) {
    if (bot.isDead) {
      bot.respawnTimer -= dt;
      if (bot.respawnTimer <= 0) {
        bot.isDead = false;
        bot.health = MAX_HEALTH;
        const spawn = this.getEdgeSpawn();
        bot.x = spawn.x;
        bot.z = spawn.z;
        bot.state = 'patrol';
        bot.patrolTargetX = (Math.random() - 0.5) * (MAP_SIZE - 6);
        bot.patrolTargetZ = (Math.random() - 0.5) * (MAP_SIZE - 6);
      }
      return;
    }

    // Find closest player
    const closest = this.findClosestPlayer(bot.x, bot.z);

    // State transitions
    if (bot.health < 30 && closest.dist < 8) {
      bot.state = 'flee';
    } else if (closest.dist < 15 && closest.player) {
      bot.state = closest.dist < 12 ? 'attack' : 'chase';
    } else {
      bot.state = 'patrol';
    }

    switch (bot.state) {
      case 'patrol': {
        bot.patrolTimer += dt;
        const ptDx = bot.patrolTargetX - bot.x;
        const ptDz = bot.patrolTargetZ - bot.z;
        const ptDist = Math.sqrt(ptDx * ptDx + ptDz * ptDz);
        if (ptDist < 1 || bot.patrolTimer > 5) {
          bot.patrolTargetX = (Math.random() - 0.5) * (MAP_SIZE - 6);
          bot.patrolTargetZ = (Math.random() - 0.5) * (MAP_SIZE - 6);
          bot.patrolTimer = 0;
        } else {
          const speed = PLAYER_SPEED * 0.4;
          bot.x += (ptDx / ptDist) * speed * dt;
          bot.z += (ptDz / ptDist) * speed * dt;
          bot.rotY = Math.atan2(ptDx, ptDz);
        }
        break;
      }
      case 'chase': {
        if (closest.player) {
          const dx = closest.player.x - bot.x;
          const dz = closest.player.z - bot.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist > 0.5) {
            bot.x += (dx / dist) * PLAYER_SPEED * 0.7 * dt;
            bot.z += (dz / dist) * PLAYER_SPEED * 0.7 * dt;
            bot.rotY = Math.atan2(dx, dz);
          }
        }
        break;
      }
      case 'attack': {
        if (closest.player) {
          const dx = closest.player.x - bot.x;
          const dz = closest.player.z - bot.z;
          bot.rotY = Math.atan2(dx, dz);

          // Shoot
          bot.shootTimer += dt;
          if (bot.shootTimer >= 0.3) {
            bot.shootTimer = 0;
            this.botShoot(bot, closest.player);
          }
        }
        break;
      }
      case 'flee': {
        if (closest.player) {
          const dx = bot.x - closest.player.x;
          const dz = bot.z - closest.player.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist > 0.1) {
            bot.x += (dx / dist) * PLAYER_SPEED * 0.8 * dt;
            bot.z += (dz / dist) * PLAYER_SPEED * 0.8 * dt;
            bot.rotY = Math.atan2(dx, dz);
          }
        }
        break;
      }
    }

    // Gravity
    bot.velocityY += GRAVITY * dt;
    bot.y += bot.velocityY * dt;
    if (bot.y <= 0) {
      bot.y = 0;
      bot.velocityY = 0;
      bot.isGrounded = true;
    }

    // Bounds
    const half = MAP_SIZE / 2 - 1;
    bot.x = Math.max(-half, Math.min(half, bot.x));
    bot.z = Math.max(-half, Math.min(half, bot.z));
  }

  private botShoot(bot: BotSchema, target: PlayerSchema) {
    const dx = target.x - bot.x;
    const dy = (target.y + 1.2) - (bot.y + 1.2);
    const dz = target.z - bot.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 0.1) return;

    const proj = new ProjectileSchema();
    proj.id = `proj_${++projectileCounter}`;
    proj.ownerId = bot.id;
    proj.x = bot.x + Math.sin(bot.rotY) * 0.8;
    proj.y = bot.y + 0.85;
    proj.z = bot.z + Math.cos(bot.rotY) * 0.8;

    // Direction with inaccuracy
    const inaccuracy = 0.15;
    proj.vx = ((dx / dist) + (Math.random() - 0.5) * inaccuracy) * 25;
    proj.vy = ((dy / dist) + (Math.random() - 0.5) * 0.1) * 25;
    proj.vz = ((dz / dist) + (Math.random() - 0.5) * inaccuracy) * 25;

    this.state.projectiles.push(proj);
  }

  private spawnProjectile(player: PlayerSchema) {
    const proj = new ProjectileSchema();
    proj.id = `proj_${++projectileCounter}`;
    proj.ownerId = player.id;

    // Calculate direction from player rotation (matches client camera formula)
    const dirX = Math.sin(player.rotY) * Math.cos(player.rotX);
    const dirY = Math.sin(player.rotX);
    const dirZ = Math.cos(player.rotY) * Math.cos(player.rotX);

    // Gun nozzle offset (matches client shootWater origin)
    const rightX = -Math.cos(player.rotY);
    const rightZ = Math.sin(player.rotY);
    const fwdX = Math.sin(player.rotY);
    const fwdZ = Math.cos(player.rotY);

    proj.x = player.x + rightX * 0.3 + fwdX * 0.5;
    proj.y = player.y + 1.5;
    proj.z = player.z + rightZ * 0.3 + fwdZ * 0.5;
    proj.vx = dirX * WATER_SPEED;
    proj.vy = dirY * WATER_SPEED;
    proj.vz = dirZ * WATER_SPEED;

    this.state.projectiles.push(proj);
  }

  private findClosestPlayer(bx: number, bz: number): { player: PlayerSchema | null; dist: number } {
    let closestDist = Infinity;
    let closestPlayer: PlayerSchema | null = null;
    this.state.players.forEach((player) => {
      if (player.isDead) return;
      const dist = Math.sqrt((bx - player.x) ** 2 + (bz - player.z) ** 2);
      if (dist < closestDist) {
        closestDist = dist;
        closestPlayer = player;
      }
    });
    return { player: closestPlayer, dist: closestDist };
  }

  private pointInPlayerBox(px: number, py: number, pz: number, bx: number, by: number, bz: number): boolean {
    return px >= bx - 0.5 && px <= bx + 0.5 &&
           py >= by && py <= by + 2.2 &&
           pz >= bz - 0.5 && pz <= bz + 0.5;
  }

  private damagePlayer(player: PlayerSchema, attackerId: string) {
    player.health -= WATER_DAMAGE;
    if (player.health <= 0) {
      player.health = 0;
      player.isDead = true;
      player.deaths++;
      player.respawnTimer = 3;

      // Credit kill
      const attacker = this.state.players.get(attackerId);
      if (attacker) {
        attacker.kills++;
      }
      const botAttacker = this.state.bots.get(attackerId);
      if (botAttacker) {
        botAttacker.kills++;
      }

      this.broadcast('kill', { killer: attackerId, victim: player.id, victimName: player.name });
    }
  }

  private damageBot(bot: BotSchema, attackerId: string) {
    bot.health -= WATER_DAMAGE;
    if (bot.health <= 0) {
      bot.health = 0;
      bot.isDead = true;
      bot.deaths++;
      bot.respawnTimer = 3;

      // Credit kill
      const attacker = this.state.players.get(attackerId);
      if (attacker) {
        attacker.kills++;
      }

      this.broadcast('kill', { killer: attackerId, victim: bot.id, victimName: bot.name });
    }
  }

  private respawnPlayer(player: PlayerSchema) {
    player.isDead = false;
    player.health = MAX_HEALTH;
    const spawn = this.getEdgeSpawn();
    player.x = spawn.x;
    player.z = spawn.z;
    player.y = 0;
    player.velocityY = 0;
  }

  private getEdgeSpawn(): { x: number; z: number } {
    const spawn = EDGE_SPAWNS[Math.floor(Math.random() * EDGE_SPAWNS.length)];
    return {
      x: spawn.x + (Math.random() - 0.5) * 3,
      z: spawn.z + (Math.random() - 0.5) * 3,
    };
  }
}
