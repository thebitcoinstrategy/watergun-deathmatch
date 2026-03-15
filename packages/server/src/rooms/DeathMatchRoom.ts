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

// Collision boxes matching client SceneManager.buildMap()
// Each box: { minX, maxX, minZ, maxZ, height }
interface CollisionBox {
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  height: number;
}

function box(x: number, z: number, w: number, h: number, d: number): CollisionBox {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, height: h };
}

const COLLISION_BOXES: CollisionBox[] = [
  // Boundary walls
  box(0, -20, 40, 4, 0.5),
  box(0, 20, 40, 4, 0.5),
  box(-20, 0, 0.5, 4, 40),
  box(20, 0, 0.5, 4, 40),
  // Cover objects (matching client SceneManager)
  box(-8, -8, 3, 2.5, 0.5),
  box(8, 8, 3, 2.5, 0.5),
  box(-6, 6, 0.5, 2.5, 3),
  box(6, -6, 0.5, 2.5, 3),
  box(0, 0, 2, 1.5, 2),
  box(-12, 0, 4, 3, 0.5),
  box(12, 0, 4, 3, 0.5),
  box(0, -12, 0.5, 3, 4),
  box(-5, -14, 2, 2, 2),
  box(5, 14, 2, 2, 2),
  box(4, 0, 2, 1, 2),
  box(-4, 0, 2, 1, 2),
  box(0, 5, 2, 1.2, 2),
  box(0, -5, 2, 1.2, 2),
  box(10, -10, 2, 1.5, 2),
  box(-10, 10, 2, 1.5, 2),
  box(6, 3, 0.5, 2.5, 4),
  box(-6, -3, 0.5, 2.5, 4),
  box(3, -9, 1.5, 1, 1.5),
  box(-3, 9, 1.5, 1, 1.5),
  box(15, 5, 2, 1.5, 2),
  box(-15, -5, 2, 1.5, 2),
  box(10, 4, 3, 2, 0.5),
  box(11.25, 5.5, 0.5, 2, 3),
  box(-10, -4, 3, 2, 0.5),
  box(-11.25, -5.5, 0.5, 2, 3),
];

interface PlayerInput {
  seq: number;
  dx: number;
  dz: number;
  rotY: number;
  rotX: number;
  jump: boolean;
  shoot: boolean;
  px?: number; // client position for projectile origin
  py?: number;
  pz?: number;
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

    // Handle player input
    this.onMessage('input', (client: Client, input: PlayerInput) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.isDead) return;

      // Update rotation immediately so projectile direction is correct
      player.rotY = input.rotY;
      player.rotX = input.rotX;

      // Accept client position (client has collision resolution, pools, slides)
      if (input.px !== undefined && input.py !== undefined && input.pz !== undefined) {
        // Sanity check: don't allow teleporting too far (anti-cheat basic)
        const dx = input.px - player.x;
        const dz = input.pz - player.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 5) { // Allow up to 5 units of desync correction
          player.x = input.px;
          player.y = input.py;
          player.z = input.pz;
        }
      }

      // Store latest input for this player
      this.playerInputs.set(client.sessionId, input);

      // Track shooting state for animation broadcast
      if (input.shoot) {
        player.isShooting = true;
      } else {
        player.isShooting = false;
      }
    });

    // Client-side hit detection: client reports when their projectile hits someone
    this.onMessage('clientHit', (client: Client, data: { victimId: string }) => {
      const attacker = this.state.players.get(client.sessionId);
      if (!attacker || attacker.isDead) return;

      // Rate limit: max 1 hit per 150ms per attacker
      const now = Date.now();
      if (now - attacker.lastShootTime < 150) return;
      attacker.lastShootTime = now;

      // Try to damage a player
      const victimPlayer = this.state.players.get(data.victimId);
      if (victimPlayer && !victimPlayer.isDead && victimPlayer.id !== client.sessionId) {
        this.damagePlayer(victimPlayer, client.sessionId);
        return;
      }

      // Try to damage a bot
      const victimBot = this.state.bots.get(data.victimId);
      if (victimBot && !victimBot.isDead) {
        this.damageBot(victimBot, client.sessionId);
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

    // Player movement is now driven by client position sync (sent with input)
    // Only handle gravity, jumping, and bounds on server as fallback
    this.state.players.forEach((player) => {
      const input = this.playerInputs.get(player.id);
      if (!input || player.isDead) return;

      player.rotY = input.rotY;
      player.rotX = input.rotX;

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

      const oldX = proj.x, oldY = proj.y, oldZ = proj.z;

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

      // Check if projectile hit a wall
      if (this.segmentHitsWall(oldX, oldY, oldZ, proj.x, proj.y, proj.z)) {
        this.state.projectiles.splice(i, 1);
        continue;
      }

      // Swept collision against players and bots
      const projOwner = proj.ownerId;
      let hitSomething = false;

      this.state.players.forEach((player) => {
        if (hitSomething || player.isDead || player.id === projOwner) return;
        if (this.rayIntersectsPlayerBox(oldX, oldY, oldZ, proj.x, proj.y, proj.z,
            player.x, player.y, player.z)) {
          hitSomething = true;
          this.damagePlayer(player, projOwner);
        }
      });

      if (!hitSomething) {
        this.state.bots.forEach((bot) => {
          if (hitSomething || bot.isDead || bot.id === projOwner) return;
          if (this.rayIntersectsPlayerBox(oldX, oldY, oldZ, proj.x, proj.y, proj.z,
              bot.x, bot.y, bot.z)) {
            hitSomething = true;
            this.damageBot(bot, projOwner);
          }
        });
      }

      if (hitSomething) {
        this.state.projectiles.splice(i, 1);
      }
    }

    // Broadcast full game state as JSON
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

    const closest = this.findClosestPlayer(bot.x, bot.z);

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

          bot.shootTimer += dt;
          if (bot.shootTimer >= 0.3) {
            bot.shootTimer = 0;
            // Only shoot if line of sight is clear
            if (this.hasLineOfSight(bot.x, bot.y + 1.2, bot.z, closest.player.x, closest.player.y + 1.2, closest.player.z)) {
              this.botShoot(bot, closest.player);
            }
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

    // Resolve bot collision with walls
    const resolved = this.resolveCollision(bot.x, bot.z, 0.4, bot.y);
    bot.x = resolved.x;
    bot.z = resolved.z;

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

    const inaccuracy = 0.15;
    proj.vx = ((dx / dist) + (Math.random() - 0.5) * inaccuracy) * 25;
    proj.vy = ((dy / dist) + (Math.random() - 0.5) * 0.1) * 25;
    proj.vz = ((dz / dist) + (Math.random() - 0.5) * inaccuracy) * 25;

    this.state.projectiles.push(proj);
  }

  // === COLLISION HELPERS ===

  /** Resolve entity collision against all wall/cover boxes */
  private resolveCollision(x: number, z: number, radius: number, entityY: number): { x: number; z: number } {
    for (const box of COLLISION_BOXES) {
      // Skip if entity is standing on top of the box
      if (entityY >= box.height - 0.1) continue;

      const minX = box.minX - radius;
      const maxX = box.maxX + radius;
      const minZ = box.minZ - radius;
      const maxZ = box.maxZ + radius;

      if (x > minX && x < maxX && z > minZ && z < maxZ) {
        const pushLeft = x - minX;
        const pushRight = maxX - x;
        const pushTop = z - minZ;
        const pushBottom = maxZ - z;
        const minPush = Math.min(pushLeft, pushRight, pushTop, pushBottom);

        if (minPush === pushLeft) x = minX;
        else if (minPush === pushRight) x = maxX;
        else if (minPush === pushTop) z = minZ;
        else z = maxZ;
      }
    }
    return { x, z };
  }

  /** Check if a line segment hits any wall (for projectile-wall collision) */
  private segmentHitsWall(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): boolean {
    for (const box of COLLISION_BOXES) {
      if (this.rayIntersectsAABB(x1, y1, z1, x2, y2, z2,
          box.minX, 0, box.minZ, box.maxX, box.height, box.maxZ)) {
        return true;
      }
    }
    return false;
  }

  /** Check if bot has line of sight to target (no walls in between) */
  private hasLineOfSight(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): boolean {
    return !this.segmentHitsWall(x1, y1, z1, x2, y2, z2);
  }

  /** Ray vs player hitbox AABB */
  private rayIntersectsPlayerBox(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    bx: number, by: number, bz: number
  ): boolean {
    return this.rayIntersectsAABB(x1, y1, z1, x2, y2, z2,
      bx - 0.6, by, bz - 0.6, bx + 0.6, by + 2.2, bz + 0.6);
  }

  /** Generic ray-segment vs AABB intersection test */
  private rayIntersectsAABB(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number
  ): boolean {
    // Check if either endpoint is inside
    if (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY && z1 >= minZ && z1 <= maxZ) return true;
    if (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY && z2 >= minZ && z2 <= maxZ) return true;

    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    let tmin = 0, tmax = 1;

    // X slab
    if (Math.abs(dx) < 1e-8) {
      if (x1 < minX || x1 > maxX) return false;
    } else {
      let t1 = (minX - x1) / dx, t2 = (maxX - x1) / dx;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }

    // Y slab
    if (Math.abs(dy) < 1e-8) {
      if (y1 < minY || y1 > maxY) return false;
    } else {
      let t1 = (minY - y1) / dy, t2 = (maxY - y1) / dy;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }

    // Z slab
    if (Math.abs(dz) < 1e-8) {
      if (z1 < minZ || z1 > maxZ) return false;
    } else {
      let t1 = (minZ - z1) / dz, t2 = (maxZ - z1) / dz;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }

    return true;
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

  private damagePlayer(player: PlayerSchema, attackerId: string) {
    player.health -= WATER_DAMAGE;
    this.broadcast('hit', { attackerId, victimId: player.id });
    if (player.health <= 0) {
      player.health = 0;
      player.isDead = true;
      player.deaths++;
      player.respawnTimer = 3;

      const attacker = this.state.players.get(attackerId);
      if (attacker) attacker.kills++;
      const botAttacker = this.state.bots.get(attackerId);
      if (botAttacker) botAttacker.kills++;

      this.broadcast('kill', { killer: attackerId, victim: player.id, victimName: player.name });
    }
  }

  private damageBot(bot: BotSchema, attackerId: string) {
    bot.health -= WATER_DAMAGE;
    this.broadcast('hit', { attackerId, victimId: bot.id });
    if (bot.health <= 0) {
      bot.health = 0;
      bot.isDead = true;
      bot.deaths++;
      bot.respawnTimer = 3;

      const attacker = this.state.players.get(attackerId);
      if (attacker) attacker.kills++;

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
