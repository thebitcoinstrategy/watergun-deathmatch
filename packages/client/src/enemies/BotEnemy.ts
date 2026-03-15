import * as THREE from 'three';
import { PLAYER_SPEED, PLAYER_MAX_HEALTH, MAP_SIZE } from '@watergun/shared';
import { createBlockyCharacter, animateCharacter } from '../rendering/PlayerRenderer';
import { WaterEffect } from '../rendering/WaterEffect';
import type { SceneManager } from '../rendering/SceneManager';

const BOT_COLORS = ['#f44336', '#e91e63', '#9c27b0', '#ff9800', '#ffeb3b', '#8bc34a'];
const BOT_NAMES = ['Splasher', 'Drizzle', 'Tsunami', 'Squirt', 'Puddle', 'Soaker'];

// Spawn points at the edges of the map
const EDGE_SPAWN_POINTS = [
  new THREE.Vector3(-17, 0, -17),
  new THREE.Vector3(17, 0, -17),
  new THREE.Vector3(-17, 0, 17),
  new THREE.Vector3(17, 0, 17),
  new THREE.Vector3(0, 0, -18),
  new THREE.Vector3(0, 0, 18),
  new THREE.Vector3(-18, 0, 0),
  new THREE.Vector3(18, 0, 0),
];

type BotState = 'patrol' | 'chase' | 'attack' | 'flee' | 'dead';

export class BotEnemy {
  model: THREE.Group;
  position: THREE.Vector3;
  health: number = PLAYER_MAX_HEALTH;
  kills: number = 0;
  deaths: number = 0;
  name: string;
  color: string;

  private velocityY = 0;
  private isGrounded = true;
  private state: BotState = 'patrol';
  private patrolTarget: THREE.Vector3;
  private patrolTimer = 0;
  private shootTimer = 0;
  private shootAnimTimer = 0;
  private headPitch = 0;
  private respawnTimer = 0;
  private yaw = 0;
  private scene: THREE.Scene;
  private waterEffect: WaterEffect;
  private sceneManager: SceneManager;
  private nameSprite: THREE.Sprite;
  private healthBarBg: THREE.Mesh;
  private healthBarFill: THREE.Mesh;
  private index: number;

  constructor(scene: THREE.Scene, waterEffect: WaterEffect, index: number, sceneManager?: SceneManager) {
    this.scene = scene;
    this.waterEffect = waterEffect;
    this.sceneManager = sceneManager!;
    this.index = index;
    this.color = BOT_COLORS[index % BOT_COLORS.length];
    this.name = BOT_NAMES[index % BOT_NAMES.length];

    this.model = createBlockyCharacter(this.color);
    this.position = this.getEdgeSpawnPoint();
    this.model.position.copy(this.position);
    scene.add(this.model);

    this.patrolTarget = this.getRandomPatrolPoint();

    // Name label
    this.nameSprite = this.createNameSprite(this.name);
    this.nameSprite.position.y = 2.5;
    this.model.add(this.nameSprite);

    // Health bar above name
    const barWidth = 1.0;
    const barHeight = 0.08;
    this.healthBarBg = new THREE.Mesh(
      new THREE.PlaneGeometry(barWidth, barHeight),
      new THREE.MeshBasicMaterial({ color: '#333333', transparent: true, opacity: 0.6 })
    );
    this.healthBarBg.position.y = 2.35;
    this.model.add(this.healthBarBg);

    this.healthBarFill = new THREE.Mesh(
      new THREE.PlaneGeometry(barWidth, barHeight),
      new THREE.MeshBasicMaterial({ color: '#4caf50' })
    );
    this.healthBarFill.position.y = 2.35;
    this.model.add(this.healthBarFill);
  }

  private createNameSprite(name: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.roundRect(0, 0, 256, 64, 8);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5, 0.4, 1);
    return sprite;
  }

  private getEdgeSpawnPoint(): THREE.Vector3 {
    const point = EDGE_SPAWN_POINTS[this.index % EDGE_SPAWN_POINTS.length].clone();
    // Add slight randomness so bots don't stack
    point.x += (Math.random() - 0.5) * 3;
    point.z += (Math.random() - 0.5) * 3;
    return point;
  }

  private getRandomPatrolPoint(): THREE.Vector3 {
    const half = MAP_SIZE / 2 - 3;
    return new THREE.Vector3(
      (Math.random() - 0.5) * half * 2,
      0,
      (Math.random() - 0.5) * half * 2
    );
  }

  update(dt: number, elapsed: number, targets: { position: THREE.Vector3; isDead: boolean; name: string }[], cameraPosition: THREE.Vector3): void {
    if (this.state === 'dead') {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    // Find closest living target (player or other bot)
    let closestTarget: THREE.Vector3 | null = null;
    let closestDist = Infinity;
    for (const t of targets) {
      if (t.isDead || t.name === this.name) continue;
      const dist = this.position.distanceTo(t.position);
      if (dist < closestDist) {
        closestDist = dist;
        closestTarget = t.position;
      }
    }

    // State transitions based on closest target
    if (!closestTarget) {
      this.state = 'patrol';
    } else if (this.health < 30 && closestDist < 8) {
      this.state = 'flee';
    } else if (closestDist < 15) {
      this.state = closestDist < 12 ? 'attack' : 'chase';
    } else {
      this.state = 'patrol';
    }

    const targetPos = closestTarget ?? this.patrolTarget;

    // Execute state behavior
    switch (this.state) {
      case 'patrol':
        this.doPatrol(dt);
        break;
      case 'chase':
        this.doChase(dt, targetPos);
        break;
      case 'attack':
        this.doAttack(dt, elapsed, targetPos);
        break;
      case 'flee':
        this.doFlee(dt, targetPos);
        break;
    }

    // Gravity
    this.velocityY += -25 * dt;
    this.position.y += this.velocityY * dt;

    // Check slide ramps
    let groundLevel = 0;
    if (this.sceneManager) {
      const slideInfo = this.sceneManager.getSlideInfo(this.position.x, this.position.z);
      if (slideInfo) {
        groundLevel = slideInfo.height;
        if (slideInfo.slideForceZ > 0 && this.position.y <= groundLevel + 0.1) {
          this.position.z += slideInfo.slideForceZ * dt;
        }
      }
    }

    if (this.position.y <= groundLevel) {
      this.position.y = groundLevel;
      this.velocityY = 0;
      this.isGrounded = true;
    }

    // Collision with walls and covers
    if (this.sceneManager) {
      const resolved = this.sceneManager.resolveCollision(this.position.x, this.position.z, 0.4);
      this.position.x = resolved.x;
      this.position.z = resolved.z;
    }

    // Stay in bounds
    const half = MAP_SIZE / 2 - 1;
    this.position.x = Math.max(-half, Math.min(half, this.position.x));
    this.position.z = Math.max(-half, Math.min(half, this.position.z));

    // Update model
    this.model.position.copy(this.position);
    this.model.rotation.y = this.yaw + Math.PI;

    // Shoot animation timer
    if (this.shootAnimTimer > 0) this.shootAnimTimer -= dt;

    // Head pitch: look toward closest target vertically
    if (closestTarget) {
      const dy = (closestTarget.y + 1.2) - (this.position.y + 1.85);
      const dxz = Math.sqrt(
        (closestTarget.x - this.position.x) ** 2 +
        (closestTarget.z - this.position.z) ** 2
      );
      this.headPitch = dxz > 0.5 ? Math.atan2(-dy, dxz) : 0;
      this.headPitch = Math.max(-0.5, Math.min(0.5, this.headPitch));
    } else {
      this.headPitch = 0;
    }

    // Animation
    const isMoving = this.state !== 'attack';
    animateCharacter(this.model, elapsed, isMoving, this.shootAnimTimer, this.headPitch);

    // Make health bar face camera
    this.healthBarBg.lookAt(cameraPosition.x, this.position.y + 2.35, cameraPosition.z);
    this.healthBarFill.lookAt(cameraPosition.x, this.position.y + 2.35, cameraPosition.z);

    // Update health bar
    const healthPct = this.health / PLAYER_MAX_HEALTH;
    this.healthBarFill.scale.x = healthPct;
    this.healthBarFill.position.x = -(1 - healthPct) * 0.5;
    const fillMat = this.healthBarFill.material as THREE.MeshBasicMaterial;
    fillMat.color.set(healthPct > 0.5 ? '#4caf50' : healthPct > 0.25 ? '#ff9800' : '#f44336');
  }

  private doPatrol(dt: number): void {
    this.patrolTimer += dt;
    if (this.patrolTimer > 5 || this.position.distanceTo(this.patrolTarget) < 1) {
      this.patrolTarget = this.getRandomPatrolPoint();
      this.patrolTimer = 0;
    }

    this.moveToward(this.patrolTarget, PLAYER_SPEED * 0.4, dt);
  }

  private doChase(dt: number, target: THREE.Vector3): void {
    this.moveToward(target, PLAYER_SPEED * 0.7, dt);
  }

  private doAttack(dt: number, elapsed: number, target: THREE.Vector3): void {
    // Face the player
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    this.yaw = Math.atan2(dx, dz);

    // Strafe slightly while attacking
    const strafeAngle = this.yaw + Math.PI / 2;
    const strafeDir = Math.sin(elapsed * 2) * 0.5;
    this.position.x += Math.sin(strafeAngle) * strafeDir * PLAYER_SPEED * 0.3 * dt;
    this.position.z += Math.cos(strafeAngle) * strafeDir * PLAYER_SPEED * 0.3 * dt;

    // Shoot
    this.shootTimer += dt;
    if (this.shootTimer >= 0.3) {
      this.shootTimer = 0;
      this.shoot(target);
    }
  }

  private doFlee(dt: number, threat: THREE.Vector3): void {
    const awayTarget = new THREE.Vector3(
      this.position.x + (this.position.x - threat.x),
      0,
      this.position.z + (this.position.z - threat.z)
    );
    this.moveToward(awayTarget, PLAYER_SPEED * 0.8, dt);
  }

  private moveToward(target: THREE.Vector3, speed: number, dt: number): void {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.5) return;

    this.yaw = Math.atan2(dx, dz);
    this.position.x += (dx / dist) * speed * dt;
    this.position.z += (dz / dist) * speed * dt;

    // Random jump while moving
    if (this.isGrounded && Math.random() < 0.005) {
      this.velocityY = 8;
      this.isGrounded = false;
    }
  }

  private shoot(target: THREE.Vector3): void {
    const direction = new THREE.Vector3(
      target.x - this.position.x,
      (target.y + 1.2) - (this.position.y + 1.2),
      target.z - this.position.z
    ).normalize();

    // Add some inaccuracy
    direction.x += (Math.random() - 0.5) * 0.15;
    direction.y += (Math.random() - 0.5) * 0.1;
    direction.z += (Math.random() - 0.5) * 0.15;
    direction.normalize();

    // Shoot from the gun nozzle position (offset from body)
    const gunOffsetRight = 0.55;
    const gunOffsetForward = 0.7;
    const gunOffsetUp = 0.85;

    const origin = new THREE.Vector3(
      this.position.x + Math.sin(this.yaw) * gunOffsetForward + Math.cos(this.yaw) * gunOffsetRight,
      this.position.y + gunOffsetUp,
      this.position.z + Math.cos(this.yaw) * gunOffsetForward - Math.sin(this.yaw) * gunOffsetRight
    );

    this.waterEffect.shoot(origin, direction, 25, this.name);
    this.shootAnimTimer = 0.3;
  }

  takeDamage(amount: number): boolean {
    if (this.state === 'dead') return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.die();
      return true; // killed
    }
    return false;
  }

  private die(): void {
    this.state = 'dead';
    this.deaths++;
    this.model.visible = false;
    this.respawnTimer = 3;
  }

  private respawn(): void {
    this.state = 'patrol';
    this.health = PLAYER_MAX_HEALTH;
    this.position.copy(this.getEdgeSpawnPoint());
    this.model.position.copy(this.position);
    this.model.visible = true;
    this.patrolTarget = this.getRandomPatrolPoint();
  }

  getHitBox(): THREE.Box3 {
    return new THREE.Box3(
      new THREE.Vector3(this.position.x - 0.4, this.position.y, this.position.z - 0.25),
      new THREE.Vector3(this.position.x + 0.4, this.position.y + 2.2, this.position.z + 0.25)
    );
  }

  dispose(): void {
    this.scene.remove(this.model);
  }
}
