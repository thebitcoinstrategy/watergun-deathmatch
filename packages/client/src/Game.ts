import * as THREE from 'three';
import { PLAYER_SPEED, GRAVITY, PLAYER_JUMP_FORCE, MAP_SIZE, PLAYER_MAX_HEALTH, WATER_DAMAGE } from '@watergun/shared';
import { SceneManager } from './rendering/SceneManager';
import { CameraController } from './camera/CameraController';
import { InputManager } from './input/InputManager';
import { createBlockyCharacter, animateCharacter } from './rendering/PlayerRenderer';
import { WaterEffect } from './rendering/WaterEffect';
import { BotEnemy } from './enemies/BotEnemy';
import { NetworkClient } from './networking/Client';
import { SoundManager } from './audio/SoundManager';

const NUM_BOTS = 2;
const ROUND_TIME = 300; // 5 minutes

const EDGE_SPAWNS = [
  new THREE.Vector3(-17, 0, -17), new THREE.Vector3(17, 0, -17),
  new THREE.Vector3(-17, 0, 17), new THREE.Vector3(17, 0, 17),
  new THREE.Vector3(0, 0, -18), new THREE.Vector3(0, 0, 18),
  new THREE.Vector3(-18, 0, 0), new THREE.Vector3(18, 0, 0),
];

export class Game {
  private sceneManager: SceneManager;
  private cameraController: CameraController;
  private inputManager: InputManager;
  private waterEffect: WaterEffect;

  private player: THREE.Group;
  private playerPosition: THREE.Vector3;
  private playerVelocityY = 0;
  private isGrounded = true;
  private playerHealth = PLAYER_MAX_HEALTH;
  private playerKills = 0;
  private playerDeaths = 0;
  private isDead = false;
  private respawnTimer = 0;
  private isInPool = false;
  private isOnSlide = false;

  // Offline mode
  private bots: BotEnemy[] = [];
  private isOnline = false;

  // Online mode
  private networkClient: NetworkClient | null = null;
  private remotePlayers: Map<string, THREE.Group> = new Map();
  private remotePlayerNames: Map<string, THREE.Sprite> = new Map();
  private networkBotModels: Map<string, THREE.Group> = new Map();
  private networkBotNames: Map<string, THREE.Sprite> = new Map();
  private networkProjectileMeshes: Map<string, THREE.Mesh> = new Map();
  private inputSeq = 0;

  private killFeed: { text: string; time: number }[] = [];
  private clock: THREE.Clock;
  private lastShootTime = 0;
  private shotThisFrame = false;
  private fireInterval = 1 / 5;
  private damageFlashTimer = 0;
  private hitMarkerTimer = 0;
  private playerName = 'Player';
  private soundManager: SoundManager;
  private roundTimer = ROUND_TIME;
  private roundOver = false;
  private showScoreboard = false;
  private roomCode = '';

  constructor(canvas: HTMLCanvasElement) {
    this.sceneManager = new SceneManager(canvas);
    this.cameraController = new CameraController();
    this.inputManager = new InputManager();
    this.waterEffect = new WaterEffect(this.sceneManager.scene);
    this.soundManager = new SoundManager();
    this.clock = new THREE.Clock();

    // Add cameras to scene so their children (viewmodel gun) render
    this.cameraController.addToScene(this.sceneManager.scene);

    this.player = createBlockyCharacter('#4fc3f7');
    this.playerPosition = new THREE.Vector3(0, 0, 5);
    this.player.position.copy(this.playerPosition);
    this.sceneManager.scene.add(this.player);

    // Camera is always first-person; no toggle needed
    this.player.visible = false;

    this.inputManager.onToggleMute = () => {
      const muted = this.soundManager.toggleMute();
      document.getElementById('mute-indicator')!.textContent = muted ? 'Muted (M)' : '';
    };

    // Click canvas to acquire pointer lock (desktop)
    canvas.addEventListener('click', () => {
      if (!this.inputManager.isTouchDevice && !this.inputManager.isPointerLocked()) {
        this.inputManager.requestPointerLock();
      }
    });
  }

  startOffline(name: string): void {
    this.playerName = name;
    this.isOnline = false;

    for (let i = 0; i < NUM_BOTS; i++) {
      this.bots.push(new BotEnemy(this.sceneManager.scene, this.waterEffect, i, this.sceneManager));
    }

    this.beginGame();
  }

  async startOnline(networkClient: NetworkClient, name: string, roomCode?: string): Promise<void> {
    this.playerName = name;
    this.isOnline = true;
    this.networkClient = networkClient;
    this.roomCode = roomCode || networkClient.roomId;

    networkClient.onKill = (killer, _victim, victimName) => {
      const killerName = killer === networkClient.myId ? 'You' : killer;
      this.addKillFeedEntry(`${killerName} soaked ${victimName}!`);
      if (killer === networkClient.myId) {
        this.soundManager.playKill();
      }
    };

    networkClient.onHit = (attackerId, _victimId) => {
      if (attackerId === networkClient.myId) {
        this.hitMarkerTimer = 0.15;
        this.soundManager.playSplash();
      }
    };

    networkClient.onPlayerJoined = (playerName) => {
      this.addKillFeedEntry(`${playerName} joined the game`);
    };

    networkClient.onPlayerLeft = (playerName) => {
      this.addKillFeedEntry(`${playerName} left the game`);
    };

    this.beginGame();
  }

  private beginGame(): void {
    this.soundManager.init();
    this.inputManager.requestPointerLock();
    document.getElementById('hud')!.style.display = 'block';

    // Always show crosshair
    document.getElementById('crosshair')!.style.display = 'block';

    // Show touch controls on mobile
    if (this.inputManager.isTouchDevice) {
      this.inputManager.showTouchControls();
      // Hide desktop-only hints
      document.getElementById('controls-hint')!.style.display = 'none';
    }

    const connectionInfo = document.getElementById('connection-info')!;
    if (this.isOnline && this.networkClient) {
      // Build shareable link using simple room code
      const url = new URL(window.location.href);
      url.searchParams.set('room', this.roomCode);
      const shareUrl = url.toString();
      window.history.replaceState({}, '', shareUrl);

      connectionInfo.style.display = 'block';
      connectionInfo.innerHTML = `Room: <strong>${this.roomCode}</strong> ` +
        `<button id="copy-link-btn" style="pointer-events:auto;background:#4fc3f7;border:none;color:#fff;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:12px;margin-left:6px;">Copy Link</button>` +
        `<span id="copy-confirm" style="display:none;color:#4caf50;font-size:11px;margin-left:6px;">Copied!</span>`;

      document.getElementById('copy-link-btn')!.addEventListener('click', () => {
        navigator.clipboard.writeText(shareUrl).then(() => {
          const confirm = document.getElementById('copy-confirm')!;
          confirm.style.display = 'inline';
          setTimeout(() => { confirm.style.display = 'none'; }, 2000);
        });
      });
    }

    // New round button
    document.getElementById('btn-new-round')!.addEventListener('click', () => {
      this.roundTimer = ROUND_TIME;
      this.roundOver = false;
      this.playerKills = 0;
      this.playerDeaths = 0;
      for (const bot of this.bots) {
        bot.kills = 0;
        bot.deaths = 0;
      }
      this.respawnPlayer();
      document.getElementById('round-over-screen')!.style.display = 'none';
    });

    this.loop();
  }

  private returnToLobby(): void {
    // Clean up
    if (this.networkClient) {
      this.networkClient.disconnect();
      this.networkClient = null;
    }
    for (const bot of this.bots) bot.dispose();
    this.bots = [];

    // Reset state
    this.playerKills = 0;
    this.playerDeaths = 0;
    this.playerHealth = PLAYER_MAX_HEALTH;
    this.isDead = false;
    this.roundTimer = ROUND_TIME;
    this.roundOver = false;

    // Hide HUD, show lobby
    document.getElementById('hud')!.style.display = 'none';
    document.getElementById('round-over-screen')!.style.display = 'none';
    document.getElementById('scoreboard-overlay')!.style.display = 'none';
    this.inputManager.hideTouchControls();

    // Exit pointer lock
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    // Clean URL
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.pathname);

    // Reload the page to reset everything cleanly
    window.location.href = url.pathname;
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.getElapsedTime();

    if (this.isOnline) {
      this.updateOnline(dt, elapsed);
    } else {
      this.updateOffline(dt, elapsed);
    }

    // Update FPS viewmodel gun (bob, recoil)
    const move = this.inputManager.getMovementVector();
    this.cameraController.updateViewmodel(dt, move.length() > 0, this.shotThisFrame);

    this.render();
  };

  // === OFFLINE MODE ===
  private updateOffline(dt: number, elapsed: number): void {
    if (!this.inputManager.isPointerLocked()) return;

    if (this.isDead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawnPlayer();
      this.updateBots(dt, elapsed);
      this.waterEffect.update(dt);
      this.sceneManager.updateWater(elapsed);
      this.cameraController.update(this.playerPosition);
      this.updateHUD();
      return;
    }

    // Round timer
    if (!this.roundOver) {
      this.roundTimer -= dt;
      if (this.roundTimer <= 0) {
        this.roundTimer = 0;
        this.roundOver = true;
      }
    }

    this.showScoreboard = this.inputManager.isTabHeld() || this.roundOver;

    this.updatePlayerMovement(dt);
    if (!this.roundOver) this.updateShooting(elapsed);
    this.waterEffect.update(dt);
    this.checkProjectileHitsOffline();
    this.updateBots(dt, elapsed);
    this.sceneManager.updateWater(elapsed);
    this.cameraController.update(this.playerPosition);
    this.updateHUD();
  }

  private updateBots(dt: number, elapsed: number): void {
    // Build target list: player + all bots
    const targets = [
      { position: this.playerPosition.clone(), isDead: this.isDead, name: '__player__' },
      ...this.bots.map(b => ({ position: b.position.clone(), isDead: b.health <= 0, name: b.name })),
    ];

    for (const bot of this.bots) {
      bot.update(dt, elapsed, targets, this.playerPosition);
    }
  }

  private checkProjectileHitsOffline(): void {
    const projectiles = this.waterEffect.getProjectiles();
    const playerBox = new THREE.Box3(
      new THREE.Vector3(this.playerPosition.x - 0.4, this.playerPosition.y, this.playerPosition.z - 0.25),
      new THREE.Vector3(this.playerPosition.x + 0.4, this.playerPosition.y + 2.2, this.playerPosition.z + 0.25)
    );

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];

      if (proj.ownerId !== 'player' && !this.isDead) {
        if (playerBox.containsPoint(proj.position)) {
          this.waterEffect.removeProjectileAt(i);
          this.takeDamage(WATER_DAMAGE, proj.ownerId);
          continue;
        }
      }

      // Check all projectiles against all bots (player shots + bot-vs-bot)
      let hitBot = false;
      for (const bot of this.bots) {
        if (bot.health <= 0) continue;
        if (proj.ownerId === bot.name) continue; // Don't hit self
        const botBox = bot.getHitBox();
        if (botBox.containsPoint(proj.position)) {
          this.waterEffect.removeProjectileAt(i);
          const killed = bot.takeDamage(WATER_DAMAGE);
          if (proj.ownerId === 'player') {
            this.hitMarkerTimer = 0.15;
            this.soundManager.playSplash();
          }
          if (killed) {
            if (proj.ownerId === 'player') {
              this.playerKills++;
              this.playerHealth = Math.min(PLAYER_MAX_HEALTH, this.playerHealth + 25);
              this.soundManager.playKill();
              this.addKillFeedEntry(`You soaked ${bot.name}!`);
            } else {
              this.addKillFeedEntry(`${proj.ownerId} soaked ${bot.name}!`);
              // Credit kill to attacking bot
              for (const attacker of this.bots) {
                if (attacker.name === proj.ownerId) {
                  attacker.kills++;
                  break;
                }
              }
            }
          }
          hitBot = true;
          break;
        }
      }
      if (hitBot) continue;
    }
  }

  /** Client-side hit detection for online mode — same logic as offline but against network entities */
  private checkProjectileHitsOnline(): void {
    if (!this.networkClient) return;
    const projectiles = this.waterEffect.getProjectiles();
    const players = this.networkClient.getPlayers();
    const bots = this.networkClient.getBots();

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];
      if (proj.ownerId !== 'player') continue; // Only check our own shots

      let hit = false;

      // Check against remote players
      players.forEach((player, id) => {
        if (hit) return;
        if (id === this.networkClient!.myId) return; // Don't hit self
        if (player.isDead) return;
        const box = new THREE.Box3(
          new THREE.Vector3(player.x - 0.5, player.y, player.z - 0.5),
          new THREE.Vector3(player.x + 0.5, player.y + 2.2, player.z + 0.5)
        );
        if (box.containsPoint(proj.position)) {
          hit = true;
          this.networkClient!.reportHit(player.id);
          this.hitMarkerTimer = 0.15;
          this.soundManager.playSplash();
        }
      });

      // Check against network bots
      if (!hit) {
        bots.forEach((bot, id) => {
          if (hit) return;
          if (bot.isDead) return;
          const box = new THREE.Box3(
            new THREE.Vector3(bot.x - 0.5, bot.y, bot.z - 0.5),
            new THREE.Vector3(bot.x + 0.5, bot.y + 2.2, bot.z + 0.5)
          );
          if (box.containsPoint(proj.position)) {
            hit = true;
            this.networkClient!.reportHit(bot.id);
            this.hitMarkerTimer = 0.15;
            this.soundManager.playSplash();
          }
        });
      }

      if (hit) {
        this.waterEffect.removeProjectileAt(i);
      }
    }
  }

  // === ONLINE MODE ===
  // Client-side hit detection: local projectiles check against server-synced entity positions.
  private updateOnline(dt: number, elapsed: number): void {
    if (!this.inputManager.isPointerLocked() || !this.networkClient) return;

    // Sync health/kills/deaths/death-state from server if available
    const myPlayer = this.networkClient.getMyPlayer();
    if (myPlayer) {
      this.playerHealth = myPlayer.health;
      this.playerKills = myPlayer.kills;
      this.playerDeaths = myPlayer.deaths;
      if (myPlayer.isDead && !this.isDead) {
        // Server says we died
        this.isDead = true;
        this.respawnTimer = 3;
        this.player.visible = false;
        this.soundManager.playDeath();
      }
      if (!myPlayer.isDead && this.isDead) {
        // Server says we respawned
        this.isDead = false;
        this.playerHealth = PLAYER_MAX_HEALTH;
        this.playerPosition.set(myPlayer.x, myPlayer.y, myPlayer.z);
        this.player.visible = false;
      }
    }

    if (this.isDead) {
      this.respawnTimer -= dt;
      this.sceneManager.updateWater(elapsed);
      this.cameraController.update(this.playerPosition);
      this.updateRemotePlayers();
      this.updateNetworkBots();
      this.updateNetworkProjectiles();
      this.updateHUD();
      return;
    }

    // Local movement (client-side prediction)
    this.updatePlayerMovement(dt);

    // Local shooting
    this.updateShooting(elapsed);

    // Local projectile updates and client-side hit detection
    this.waterEffect.update(dt);
    this.checkProjectileHitsOnline();

    // Send input to server so other players see us
    const move = this.inputManager.getMovementVector();
    const yaw = this.cameraController.getYaw();
    const pitch = this.cameraController.getPitch();
    this.networkClient.sendInput({
      seq: ++this.inputSeq,
      dx: move.x,
      dz: move.y,
      rotY: yaw,
      rotX: pitch,
      jump: this.inputManager.isJumping(),
      shoot: this.shotThisFrame,
      px: this.playerPosition.x,
      py: this.playerPosition.y,
      pz: this.playerPosition.z,
    });

    // Update remote entities from server
    this.updateRemotePlayers();
    this.updateNetworkBots();
    this.updateNetworkProjectiles();

    this.sceneManager.updateWater(elapsed);
    this.cameraController.update(this.playerPosition);
    this.updateHUD();
  }

  private updateRemotePlayers(): void {
    if (!this.networkClient) return;
    const players = this.networkClient.getPlayers();

    // Remove stale
    for (const [id, model] of this.remotePlayers) {
      if (!players.has(id) || id === this.networkClient.myId) {
        this.sceneManager.scene.remove(model);
        this.remotePlayers.delete(id);
        const nameSprite = this.remotePlayerNames.get(id);
        if (nameSprite) this.remotePlayerNames.delete(id);
      }
    }

    // Update or create
    players.forEach((player, id) => {
      if (id === this.networkClient!.myId) return;

      let model = this.remotePlayers.get(id);
      if (!model) {
        model = createBlockyCharacter(player.color);
        const nameSprite = this.createNameSprite(player.name);
        nameSprite.position.y = 2.5;
        model.add(nameSprite);
        this.remotePlayerNames.set(id, nameSprite);
        this.sceneManager.scene.add(model);
        this.remotePlayers.set(id, model);
      }

      model.visible = !player.isDead;

      // Detect movement by comparing to last known position
      const prevPos = model.userData.lastPos as THREE.Vector3 | undefined;
      const isMoving = prevPos
        ? Math.abs(player.x - prevPos.x) > 0.01 || Math.abs(player.z - prevPos.z) > 0.01
        : false;
      model.userData.lastPos = new THREE.Vector3(player.x, player.y, player.z);

      model.position.set(player.x, player.y, player.z);
      model.rotation.y = player.rotY + Math.PI;

      // Shoot recoil timer
      if (player.isShooting) {
        model.userData.shootTimer = 0.3;
      }
      const shootTimer = model.userData.shootTimer ?? 0;
      if (shootTimer > 0) {
        model.userData.shootTimer = shootTimer - 0.016;
      }

      animateCharacter(model, performance.now() / 1000, isMoving, shootTimer, -(player.rotX || 0));
    });
  }

  private updateNetworkBots(): void {
    if (!this.networkClient) return;
    const bots = this.networkClient.getBots();

    // Remove stale
    for (const [id, model] of this.networkBotModels) {
      if (!bots.has(id)) {
        this.sceneManager.scene.remove(model);
        this.networkBotModels.delete(id);
        this.networkBotNames.delete(id);
      }
    }

    bots.forEach((bot, id) => {
      let model = this.networkBotModels.get(id);
      if (!model) {
        model = createBlockyCharacter(bot.color);
        const nameSprite = this.createNameSprite(bot.name);
        nameSprite.position.y = 2.5;
        model.add(nameSprite);
        this.networkBotNames.set(id, nameSprite);
        this.sceneManager.scene.add(model);
        this.networkBotModels.set(id, model);
      }

      model.visible = !bot.isDead;

      const prevPos = model.userData.lastPos as THREE.Vector3 | undefined;
      const isMoving = prevPos
        ? Math.abs(bot.x - prevPos.x) > 0.01 || Math.abs(bot.z - prevPos.z) > 0.01
        : false;
      model.userData.lastPos = new THREE.Vector3(bot.x, bot.y, bot.z);

      model.position.set(bot.x, bot.y, bot.z);
      model.rotation.y = bot.rotY + Math.PI;
      animateCharacter(model, performance.now() / 1000, isMoving, 0, 0);
    });
  }

  private updateNetworkProjectiles(): void {
    if (!this.networkClient) return;
    const projectiles = this.networkClient.getProjectiles();
    const currentIds = new Set(projectiles.map(p => p.id));

    // Remove stale
    for (const [id, mesh] of this.networkProjectileMeshes) {
      if (!currentIds.has(id)) {
        this.sceneManager.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.networkProjectileMeshes.delete(id);
      }
    }

    // Update or create
    for (const proj of projectiles) {
      let mesh = this.networkProjectileMeshes.get(proj.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 8, 8),
          new THREE.MeshStandardMaterial({
            color: '#29b6f6',
            transparent: true,
            opacity: 0.85,
            emissive: '#0288d1',
            emissiveIntensity: 0.3,
          })
        );
        this.sceneManager.scene.add(mesh);
        this.networkProjectileMeshes.set(proj.id, mesh);
      }
      mesh.position.set(proj.x, proj.y, proj.z);
    }
  }

  // === SHARED ===
  private updatePlayerMovement(dt: number): void {
    const { dx, dy } = this.inputManager.getMouseDelta();
    this.cameraController.handleMouseMove(dx, dy);

    const move = this.inputManager.getMovementVector();
    const yaw = this.cameraController.getYaw();

    const pool = this.sceneManager.isInPool(this.playerPosition.x, this.playerPosition.z);
    this.isInPool = !!pool;
    const speedMult = this.isInPool ? 0.5 : 1.0;

    const moveX = -move.x * Math.cos(yaw) - move.y * Math.sin(yaw);
    const moveZ = move.x * Math.sin(yaw) - move.y * Math.cos(yaw);

    this.playerPosition.x += moveX * PLAYER_SPEED * speedMult * dt;
    this.playerPosition.z += moveZ * PLAYER_SPEED * speedMult * dt;

    // Collision with walls and cover objects (height-aware)
    const resolved = this.sceneManager.resolveCollision(this.playerPosition.x, this.playerPosition.z, 0.4, this.playerPosition.y);
    this.playerPosition.x = resolved.x;
    this.playerPosition.z = resolved.z;

    if (this.inputManager.isJumping() && this.isGrounded) {
      this.playerVelocityY = this.isInPool ? PLAYER_JUMP_FORCE * 1.3 : PLAYER_JUMP_FORCE;
      this.isGrounded = false;
    }

    const gravMult = this.isInPool ? 0.4 : 1.0;
    this.playerVelocityY += GRAVITY * gravMult * dt;
    this.playerPosition.y += this.playerVelocityY * dt;

    // Check slide/ladder ramps
    const slideInfo = this.sceneManager.getSlideInfo(this.playerPosition.x, this.playerPosition.z);
    this.isOnSlide = false;

    let groundLevel = pool ? pool.waterY - 0.3 : 0;

    // Check if standing on top of a block
    const blockHeight = this.sceneManager.getBlockHeight(this.playerPosition.x, this.playerPosition.z, 0.4, this.playerPosition.y);
    if (blockHeight > 0) {
      groundLevel = Math.max(groundLevel, blockHeight);
    }

    if (slideInfo) {
      groundLevel = Math.max(groundLevel, slideInfo.height);
      // Apply slide push force when on the chute and grounded
      if (slideInfo.slideForceZ > 0 && this.playerPosition.y <= groundLevel + 0.1) {
        this.isOnSlide = true;
        this.playerPosition.z += slideInfo.slideForceZ * dt;
      }
    }

    if (this.playerPosition.y <= groundLevel) {
      this.playerPosition.y = groundLevel;
      this.playerVelocityY = 0;
      this.isGrounded = true;
    }

    const half = MAP_SIZE / 2 - 1;
    this.playerPosition.x = Math.max(-half, Math.min(half, this.playerPosition.x));
    this.playerPosition.z = Math.max(-half, Math.min(half, this.playerPosition.z));

    this.player.position.copy(this.playerPosition);
    this.player.rotation.y = this.cameraController.getYaw() + Math.PI;

    const isMoving = move.length() > 0;
    animateCharacter(this.player, performance.now() / 1000, isMoving, 0, 0);
  }

  private updateShooting(elapsed: number): void {
    this.shotThisFrame = false;
    if (this.inputManager.isShooting() && elapsed - this.lastShootTime >= this.fireInterval) {
      this.lastShootTime = elapsed;
      this.shotThisFrame = true;
      this.shootWater();
    }
  }

  private shootWater(): void {
    const yaw = this.cameraController.getYaw();
    const camera = this.cameraController.getCamera();

    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion);

    // Right direction relative to yaw
    const rightX = -Math.cos(yaw);
    const rightZ = Math.sin(yaw);
    // Forward direction relative to yaw
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);

    // Shoot from gun nozzle position (first-person)
    const origin = new THREE.Vector3(
      this.playerPosition.x + rightX * 0.3 + fwdX * 0.5,
      this.playerPosition.y + 1.5,
      this.playerPosition.z + rightZ * 0.3 + fwdZ * 0.5
    );

    this.waterEffect.shoot(origin, direction, 30, 'player');
    this.soundManager.playShoot();
  }

  private takeDamage(amount: number, attackerName: string): void {
    if (this.isDead) return;
    this.playerHealth -= amount;
    this.damageFlashTimer = 0.2;
    this.soundManager.playHurt();

    if (this.playerHealth <= 0) {
      this.playerHealth = 0;
      this.isDead = true;
      this.playerDeaths++;
      this.respawnTimer = 3;
      this.player.visible = false;
      this.soundManager.playDeath();
      this.addKillFeedEntry(`${attackerName} soaked you!`);

      for (const bot of this.bots) {
        if (bot.name === attackerName) {
          bot.kills++;
          break;
        }
      }
    }
  }

  private respawnPlayer(): void {
    this.isDead = false;
    this.playerHealth = PLAYER_MAX_HEALTH;
    const spawn = EDGE_SPAWNS[Math.floor(Math.random() * EDGE_SPAWNS.length)];
    this.playerPosition.set(
      spawn.x + (Math.random() - 0.5) * 3,
      0,
      spawn.z + (Math.random() - 0.5) * 3
    );
    this.player.position.copy(this.playerPosition);
    this.player.visible = false;
  }

  private addKillFeedEntry(text: string): void {
    this.killFeed.push({ text, time: 4 });
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

  private updateHUD(): void {
    const healthPct = this.playerHealth / PLAYER_MAX_HEALTH;
    const healthFill = document.getElementById('health-fill')!;
    const healthText = document.getElementById('health-text')!;
    healthFill.style.width = `${healthPct * 100}%`;
    healthText.textContent = `${this.playerHealth}`;

    if (healthPct > 0.5) {
      healthFill.style.background = 'linear-gradient(to right, #4fc3f7, #29b6f6)';
    } else if (healthPct > 0.25) {
      healthFill.style.background = 'linear-gradient(to right, #ff9800, #f57c00)';
    } else {
      healthFill.style.background = 'linear-gradient(to right, #f44336, #d32f2f)';
    }

    document.getElementById('score-display')!.textContent =
      `Kills: ${this.playerKills} | Deaths: ${this.playerDeaths}`;

    // Round timer
    const mins = Math.floor(this.roundTimer / 60);
    const secs = Math.floor(this.roundTimer % 60);
    const timerEl = document.getElementById('round-timer')!;
    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    timerEl.style.color = this.roundTimer < 30 ? '#f44336' : 'white';

    // Hit marker
    const hitMarkerEl = document.getElementById('hit-marker')!;
    if (this.hitMarkerTimer > 0) {
      hitMarkerEl.style.display = 'block';
      this.hitMarkerTimer -= 0.016;
    } else {
      hitMarkerEl.style.display = 'none';
    }

    // Scoreboard
    const scoreboardEl = document.getElementById('scoreboard-overlay')!;
    if (this.showScoreboard) {
      scoreboardEl.style.display = 'block';
      const tbody = document.getElementById('scoreboard-body')!;
      tbody.innerHTML = '';

      // Build entries: player + bots
      const entries: { name: string; kills: number; deaths: number }[] = [
        { name: this.playerName + ' (You)', kills: this.playerKills, deaths: this.playerDeaths },
        ...this.bots.map(b => ({ name: b.name, kills: b.kills, deaths: b.deaths })),
      ];
      entries.sort((a, b) => b.kills - a.kills);

      for (const e of entries) {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${e.name}</td><td>${e.kills}</td><td>${e.deaths}</td>`;
        tbody.appendChild(row);
      }
    } else {
      scoreboardEl.style.display = 'none';
    }

    // Round over
    if (this.roundOver) {
      const roundOverEl = document.getElementById('round-over-screen')!;
      roundOverEl.style.display = 'flex';

      const allEntries = [
        { name: this.playerName, kills: this.playerKills },
        ...this.bots.map(b => ({ name: b.name, kills: b.kills })),
      ];
      allEntries.sort((a, b) => b.kills - a.kills);
      document.getElementById('round-winner')!.textContent =
        `Winner: ${allEntries[0].name} with ${allEntries[0].kills} kills!`;
    }

    // Kill feed
    const killFeedEl = document.getElementById('kill-feed')!;
    killFeedEl.innerHTML = '';
    for (let i = this.killFeed.length - 1; i >= 0; i--) {
      this.killFeed[i].time -= 0.016;
      if (this.killFeed[i].time <= 0) {
        this.killFeed.splice(i, 1);
        continue;
      }
      const entry = document.createElement('div');
      entry.className = 'kill-feed-entry';
      entry.textContent = this.killFeed[i].text;
      entry.style.opacity = `${Math.min(1, this.killFeed[i].time)}`;
      killFeedEl.appendChild(entry);
    }

    const damageOverlay = document.getElementById('damage-overlay')!;
    damageOverlay.style.opacity = this.damageFlashTimer > 0 ? `${this.damageFlashTimer * 3}` : '0';
    if (this.damageFlashTimer > 0) this.damageFlashTimer -= 0.016;

    const deathScreen = document.getElementById('death-screen')!;
    if (this.isDead && !this.roundOver) {
      deathScreen.style.display = 'flex';
      document.getElementById('respawn-timer')!.textContent =
        `Respawning in ${Math.ceil(this.respawnTimer)}...`;
    } else {
      deathScreen.style.display = 'none';
    }

    document.getElementById('pool-indicator')!.style.display = this.isInPool ? 'block' : 'none';
    document.getElementById('slide-indicator')!.style.display = this.isOnSlide ? 'block' : 'none';

    // Player list
    const playerListEl = document.getElementById('player-list')!;
    if (this.isOnline && this.networkClient) {
      const players = this.networkClient.getPlayers();
      const bots = this.networkClient.getBots();
      let html = `<div class="pl-title">Players (${players.size + bots.size})</div>`;
      players.forEach((p) => {
        const isMe = p.id === this.networkClient!.myId;
        const color = isMe ? '#4fc3f7' : '#fff';
        html += `<div class="pl-entry" style="color:${color}">${p.name}${isMe ? ' (You)' : ''} - ${p.kills}K</div>`;
      });
      bots.forEach((b) => {
        html += `<div class="pl-entry" style="color:#aaa">${b.name} [Bot] - ${b.kills}K</div>`;
      });
      playerListEl.innerHTML = html;
      playerListEl.style.display = 'block';
    } else if (!this.isOnline) {
      let html = `<div class="pl-title">Players (${1 + this.bots.length})</div>`;
      html += `<div class="pl-entry" style="color:#4fc3f7">${this.playerName} (You) - ${this.playerKills}K</div>`;
      for (const b of this.bots) {
        html += `<div class="pl-entry" style="color:#aaa">${b.name} [Bot] - ${b.kills}K</div>`;
      }
      playerListEl.innerHTML = html;
      playerListEl.style.display = 'block';
    }
  }

  private render(): void {
    this.sceneManager.render(this.cameraController.getCamera());
  }
}
