import * as THREE from 'three';
import { PLAYER_SPEED, GRAVITY, PLAYER_JUMP_FORCE, MAP_SIZE, PLAYER_MAX_HEALTH, WATER_DAMAGE } from '@watergun/shared';
import { WEAPONS, DEFAULT_WEAPON, PICKUP_WEAPON_IDS, NUM_WEAPON_PICKUPS, WEAPON_PICKUP_RADIUS, WEAPON_RESPAWN_DELAY } from '@watergun/shared';
import type { WeaponId } from '@watergun/shared';
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
];

const SPAWN_PROTECTION_TIME = 5; // seconds of invulnerability after spawn

const NUM_ENERGY_DRINKS = 3;
const SPEED_BOOST_DURATION = 5;
const SPEED_BOOST_COOLDOWN = 5;
const SPEED_BOOST_MULTIPLIER = 1.6;
const DRINK_PICKUP_RADIUS = 1.5;
const DRINK_RESPAWN_DELAY = 8;

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
  private spawnProtection = SPAWN_PROTECTION_TIME;
  private speedBoostTimer = 0;
  private speedBoostCooldown = 0;
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

  // Energy drinks
  private energyDrinkMeshes: Map<string, THREE.Group> = new Map();
  private offlineDrinks: { id: string; x: number; z: number }[] = [];
  private offlineDrinkRespawnTimers: number[] = [];
  private offlineDrinkCounter = 0;

  // Weapons
  private currentWeapon: WeaponId = DEFAULT_WEAPON;
  private weaponPickupMeshes: Map<string, THREE.Group> = new Map();
  private offlineWeaponPickups: { id: string; x: number; z: number; weaponId: WeaponId }[] = [];
  private offlineWeaponPickupRespawnTimers: number[] = [];
  private offlineWeaponPickupCounter = 0;

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
    const initSpawn = EDGE_SPAWNS[Math.floor(Math.random() * EDGE_SPAWNS.length)];
    this.playerPosition = new THREE.Vector3(
      initSpawn.x + (Math.random() - 0.5) * 3,
      0,
      initSpawn.z + (Math.random() - 0.5) * 3
    );
    this.player.position.copy(this.playerPosition);
    this.sceneManager.scene.add(this.player);

    // Hide own model from main camera but keep visible for mirror reflection
    // Layer 1 = "mirror only" — main camera disabled layer 1, Reflector sees all layers
    this.setPlayerMirrorOnly();

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

  /** Put the local player on layer 1 only (invisible to main camera, visible to mirror) */
  private setPlayerMirrorOnly(): void {
    this.player.traverse((obj) => {
      obj.layers.set(1);
    });
  }

  private setPlayerColor(color: string): void {
    this.sceneManager.scene.remove(this.player);
    this.player = createBlockyCharacter(color);
    this.player.position.copy(this.playerPosition);
    this.setPlayerMirrorOnly();
    this.sceneManager.scene.add(this.player);
  }

  startOffline(name: string, color?: string): void {
    this.playerName = name;
    this.isOnline = false;
    if (color) this.setPlayerColor(color);

    for (let i = 0; i < NUM_BOTS; i++) {
      this.bots.push(new BotEnemy(this.sceneManager.scene, this.waterEffect, i, this.sceneManager));
    }

    // Spawn energy drinks
    for (let i = 0; i < NUM_ENERGY_DRINKS; i++) {
      this.spawnOfflineDrink();
    }

    // Spawn weapon pickups
    for (let i = 0; i < NUM_WEAPON_PICKUPS; i++) {
      this.spawnOfflineWeaponPickup();
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

    networkClient.onDrinkPickup = (playerName) => {
      this.addKillFeedEntry(`${playerName} got a Speed Boost!`);
    };

    networkClient.onWeaponPickup = (playerName, weaponName) => {
      this.addKillFeedEntry(`${playerName} picked up ${weaponName}!`);
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

    // Spawn protection countdown
    if (this.spawnProtection > 0) {
      this.spawnProtection = Math.max(0, this.spawnProtection - dt);
    }

    // Speed boost countdown
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer = Math.max(0, this.speedBoostTimer - dt);
      if (this.speedBoostTimer <= 0) {
        this.speedBoostCooldown = SPEED_BOOST_COOLDOWN;
      }
    }
    if (this.speedBoostCooldown > 0) {
      this.speedBoostCooldown = Math.max(0, this.speedBoostCooldown - dt);
    }

    this.updatePlayerMovement(dt);
    if (!this.roundOver) this.updateShooting(elapsed);
    this.waterEffect.update(dt);
    this.checkProjectileWallCollisions();
    this.checkProjectileHitsOffline();
    this.updateBots(dt, elapsed);
    this.updateEnergyDrinksOffline(dt);
    this.updateWeaponPickupsOffline(dt);
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
          const dmg = proj.ownerId === 'player' ? WEAPONS[this.currentWeapon].damage : WATER_DAMAGE;
          const killed = bot.takeDamage(dmg);
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

  /** Remove projectiles that hit walls/cover objects */
  private checkProjectileWallCollisions(): void {
    const projectiles = this.waterEffect.getProjectiles();
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pos = projectiles[i].position;
      for (const box of this.sceneManager.collisionBoxes) {
        if (pos.y < box.height &&
            pos.x >= box.min.x && pos.x <= box.max.x &&
            pos.z >= box.min.y && pos.z <= box.max.y) {
          this.waterEffect.removeProjectileAt(i);
          break;
        }
      }
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
        this.player.visible = false; // Fully hidden when dead
        this.soundManager.playDeath();
      }
      if (!myPlayer.isDead && this.isDead) {
        // Server says we respawned
        this.isDead = false;
        this.playerHealth = PLAYER_MAX_HEALTH;
        this.spawnProtection = SPAWN_PROTECTION_TIME;
        this.playerPosition.set(myPlayer.x, myPlayer.y, myPlayer.z);
        this.player.visible = true; // Visible again (mirror-only via layers)
        this.currentWeapon = DEFAULT_WEAPON;
        this.cameraController.setViewmodelWeapon(DEFAULT_WEAPON);
        this.fireInterval = 1 / WEAPONS[DEFAULT_WEAPON].fireRate;
      }

      // Sync spawn protection from server
      if (myPlayer.spawnProtection !== undefined) {
        this.spawnProtection = myPlayer.spawnProtection;
      }

      // Sync speed boost from server
      if (myPlayer.speedBoostTimer !== undefined) {
        this.speedBoostTimer = myPlayer.speedBoostTimer;
      }

      // Sync weapon from server
      if (myPlayer.weapon && myPlayer.weapon !== this.currentWeapon) {
        this.currentWeapon = myPlayer.weapon as WeaponId;
        this.cameraController.setViewmodelWeapon(this.currentWeapon);
        this.fireInterval = 1 / WEAPONS[this.currentWeapon].fireRate;
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

    // Local projectile updates, wall collision, and client-side hit detection
    this.waterEffect.update(dt);
    this.checkProjectileWallCollisions();
    this.checkProjectileHitsOnline();

    // Energy drinks
    this.updateEnergyDrinksOnline();

    // Weapon pickups
    this.updateWeaponPickupsOnline();

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
    const boostMult = this.speedBoostTimer > 0 ? SPEED_BOOST_MULTIPLIER : 1.0;
    const speedMult = (this.isInPool ? 0.5 : 1.0) * boostMult;

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
    if (this.spawnProtection > 0) return; // can't shoot during spawn protection
    const weapon = WEAPONS[this.currentWeapon];
    const interval = 1 / weapon.fireRate;
    const wantToShoot = weapon.fireMode === 'auto'
      ? this.inputManager.isShootingHeld()
      : this.inputManager.isShooting();
    if (wantToShoot && elapsed - this.lastShootTime >= interval) {
      this.lastShootTime = elapsed;
      this.shotThisFrame = true;
      this.shootWater();
    }
  }

  private shootWater(): void {
    const yaw = this.cameraController.getYaw();
    const camera = this.cameraController.getCamera();

    const baseDirection = new THREE.Vector3(0, 0, -1);
    baseDirection.applyQuaternion(camera.quaternion);

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

    const weapon = WEAPONS[this.currentWeapon];
    const options = {
      radius: weapon.projectileRadius,
      color: weapon.projectileColor,
      trailColor: weapon.trailColor,
      emissiveColor: weapon.emissiveColor,
      gravity: weapon.gravity,
      maxAge: weapon.maxAge,
    };

    for (let i = 0; i < weapon.pellets; i++) {
      const dir = baseDirection.clone();
      if (weapon.spread > 0) {
        dir.x += (Math.random() - 0.5) * weapon.spread;
        dir.y += (Math.random() - 0.5) * weapon.spread;
        dir.z += (Math.random() - 0.5) * weapon.spread;
        dir.normalize();
      }
      this.waterEffect.shoot(origin, dir, weapon.speed, 'player', options);
    }
    this.soundManager.playShoot();
  }

  private takeDamage(amount: number, attackerName: string): void {
    if (this.isDead) return;
    if (this.spawnProtection > 0) return; // invulnerable during spawn protection
    this.playerHealth -= amount;
    this.damageFlashTimer = 0.2;
    this.soundManager.playHurt();

    if (this.playerHealth <= 0) {
      this.playerHealth = 0;
      this.isDead = true;
      this.playerDeaths++;
      this.respawnTimer = 3;
      this.player.visible = false; // Fully hidden when dead
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
    this.spawnProtection = SPAWN_PROTECTION_TIME;
    this.currentWeapon = DEFAULT_WEAPON;
    this.cameraController.setViewmodelWeapon(DEFAULT_WEAPON);
    this.fireInterval = 1 / WEAPONS[DEFAULT_WEAPON].fireRate;
    const spawn = EDGE_SPAWNS[Math.floor(Math.random() * EDGE_SPAWNS.length)];
    this.playerPosition.set(
      spawn.x + (Math.random() - 0.5) * 3,
      0,
      spawn.z + (Math.random() - 0.5) * 3
    );
    this.player.position.copy(this.playerPosition);
    this.player.visible = true; // Visible again (mirror-only via layers)
  }

  private addKillFeedEntry(text: string): void {
    this.killFeed.push({ text, time: 4 });
  }

  private createEnergyDrinkMesh(): THREE.Group {
    const group = new THREE.Group();
    // Can body
    const canGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.6, 8);
    const canMat = new THREE.MeshStandardMaterial({ color: 0x00e676, metalness: 0.6, roughness: 0.3 });
    const can = new THREE.Mesh(canGeo, canMat);
    can.position.y = 0.5;
    group.add(can);
    // Top ring
    const ringGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.05, 8);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.2 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.8;
    group.add(ring);
    // Glow ring on ground
    const glowGeo = new THREE.RingGeometry(0.3, 0.6, 16);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x00e676, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;
    group.add(glow);
    return group;
  }

  private spawnOfflineDrink(): void {
    const half = MAP_SIZE / 2 - 3;
    const id = `drink_${++this.offlineDrinkCounter}`;
    const x = (Math.random() - 0.5) * half * 2;
    const z = (Math.random() - 0.5) * half * 2;
    this.offlineDrinks.push({ id, x, z });
    const mesh = this.createEnergyDrinkMesh();
    mesh.position.set(x, 0, z);
    this.sceneManager.scene.add(mesh);
    this.energyDrinkMeshes.set(id, mesh);
  }

  private updateEnergyDrinksOffline(dt: number): void {
    // Respawn timers
    for (let i = this.offlineDrinkRespawnTimers.length - 1; i >= 0; i--) {
      this.offlineDrinkRespawnTimers[i] -= dt;
      if (this.offlineDrinkRespawnTimers[i] <= 0) {
        this.offlineDrinkRespawnTimers.splice(i, 1);
        this.spawnOfflineDrink();
      }
    }

    // Check pickup
    if (this.speedBoostTimer <= 0 && this.speedBoostCooldown <= 0) {
      for (let i = this.offlineDrinks.length - 1; i >= 0; i--) {
        const drink = this.offlineDrinks[i];
        const dx = this.playerPosition.x - drink.x;
        const dz = this.playerPosition.z - drink.z;
        if (Math.sqrt(dx * dx + dz * dz) < DRINK_PICKUP_RADIUS) {
          this.speedBoostTimer = SPEED_BOOST_DURATION;
          // Remove mesh
          const mesh = this.energyDrinkMeshes.get(drink.id);
          if (mesh) {
            this.sceneManager.scene.remove(mesh);
            this.energyDrinkMeshes.delete(drink.id);
          }
          this.offlineDrinks.splice(i, 1);
          this.offlineDrinkRespawnTimers.push(DRINK_RESPAWN_DELAY);
          this.addKillFeedEntry('Speed Boost activated!');
          break;
        }
      }
    }

    // Animate cans (bob + rotate)
    const t = performance.now() / 1000;
    this.energyDrinkMeshes.forEach((mesh) => {
      mesh.children[0].position.y = 0.5 + Math.sin(t * 3) * 0.1;
      mesh.children[0].rotation.y = t * 2;
    });
  }

  private updateEnergyDrinksOnline(): void {
    if (!this.networkClient) return;
    const serverDrinks = this.networkClient.getEnergyDrinks();

    // Remove meshes for drinks that no longer exist
    this.energyDrinkMeshes.forEach((mesh, id) => {
      if (!serverDrinks.has(id)) {
        this.sceneManager.scene.remove(mesh);
        this.energyDrinkMeshes.delete(id);
      }
    });

    // Add meshes for new drinks
    serverDrinks.forEach((drink, id) => {
      if (!this.energyDrinkMeshes.has(id)) {
        const mesh = this.createEnergyDrinkMesh();
        mesh.position.set(drink.x, 0, drink.z);
        this.sceneManager.scene.add(mesh);
        this.energyDrinkMeshes.set(id, mesh);
      }
    });

    // Animate
    const t = performance.now() / 1000;
    this.energyDrinkMeshes.forEach((mesh) => {
      mesh.children[0].position.y = 0.5 + Math.sin(t * 3) * 0.1;
      mesh.children[0].rotation.y = t * 2;
    });
  }

  // === WEAPON PICKUPS ===
  private createWeaponPickupMesh(weaponId: WeaponId): THREE.Group {
    const wpn = WEAPONS[weaponId];
    const group = new THREE.Group();
    // Gun shape (box)
    const bodyGeo = new THREE.BoxGeometry(0.25, 0.2, 0.6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: wpn.gunBodyColor, metalness: 0.4, roughness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    group.add(body);
    // Tank on top
    const tankGeo = new THREE.BoxGeometry(0.2, 0.15, 0.3);
    const tankMat = new THREE.MeshStandardMaterial({ color: wpn.gunTankColor, transparent: true, opacity: 0.8 });
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.y = 0.8;
    group.add(tank);
    // Glow ring on ground
    const glowGeo = new THREE.RingGeometry(0.4, 0.7, 16);
    const glowMat = new THREE.MeshBasicMaterial({ color: wpn.projectileColor, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;
    group.add(glow);
    return group;
  }

  private spawnOfflineWeaponPickup(): void {
    const half = MAP_SIZE / 2 - 3;
    const id = `wpn_${++this.offlineWeaponPickupCounter}`;
    const weaponId = PICKUP_WEAPON_IDS[Math.floor(Math.random() * PICKUP_WEAPON_IDS.length)];
    const x = (Math.random() - 0.5) * half * 2;
    const z = (Math.random() - 0.5) * half * 2;
    this.offlineWeaponPickups.push({ id, x, z, weaponId });
    const mesh = this.createWeaponPickupMesh(weaponId);
    mesh.position.set(x, 0, z);
    this.sceneManager.scene.add(mesh);
    this.weaponPickupMeshes.set(id, mesh);
  }

  private updateWeaponPickupsOffline(dt: number): void {
    // Respawn timers
    for (let i = this.offlineWeaponPickupRespawnTimers.length - 1; i >= 0; i--) {
      this.offlineWeaponPickupRespawnTimers[i] -= dt;
      if (this.offlineWeaponPickupRespawnTimers[i] <= 0) {
        this.offlineWeaponPickupRespawnTimers.splice(i, 1);
        this.spawnOfflineWeaponPickup();
      }
    }

    // Check pickup
    for (let i = this.offlineWeaponPickups.length - 1; i >= 0; i--) {
      const pickup = this.offlineWeaponPickups[i];
      const dx = this.playerPosition.x - pickup.x;
      const dz = this.playerPosition.z - pickup.z;
      if (Math.sqrt(dx * dx + dz * dz) < WEAPON_PICKUP_RADIUS) {
        this.currentWeapon = pickup.weaponId;
        this.cameraController.setViewmodelWeapon(this.currentWeapon);
        this.fireInterval = 1 / WEAPONS[this.currentWeapon].fireRate;
        // Remove mesh
        const mesh = this.weaponPickupMeshes.get(pickup.id);
        if (mesh) {
          this.sceneManager.scene.remove(mesh);
          this.weaponPickupMeshes.delete(pickup.id);
        }
        this.offlineWeaponPickups.splice(i, 1);
        this.offlineWeaponPickupRespawnTimers.push(WEAPON_RESPAWN_DELAY);
        this.addKillFeedEntry(`Picked up ${WEAPONS[this.currentWeapon].name}!`);
        break;
      }
    }

    // Animate (bob + rotate)
    const t = performance.now() / 1000;
    this.weaponPickupMeshes.forEach((mesh) => {
      mesh.children[0].position.y = 0.6 + Math.sin(t * 3) * 0.1;
      mesh.children[0].rotation.y = t * 2;
      mesh.children[1].position.y = 0.8 + Math.sin(t * 3) * 0.1;
      mesh.children[1].rotation.y = t * 2;
    });
  }

  private updateWeaponPickupsOnline(): void {
    if (!this.networkClient) return;
    const serverPickups = this.networkClient.getWeaponPickups();

    // Remove meshes for pickups that no longer exist
    this.weaponPickupMeshes.forEach((mesh, id) => {
      if (!serverPickups.has(id)) {
        this.sceneManager.scene.remove(mesh);
        this.weaponPickupMeshes.delete(id);
      }
    });

    // Add meshes for new pickups
    serverPickups.forEach((pickup, id) => {
      if (!this.weaponPickupMeshes.has(id)) {
        const mesh = this.createWeaponPickupMesh(pickup.weaponId as WeaponId);
        mesh.position.set(pickup.x, 0, pickup.z);
        this.sceneManager.scene.add(mesh);
        this.weaponPickupMeshes.set(id, mesh);
      }
    });

    // Animate
    const t = performance.now() / 1000;
    this.weaponPickupMeshes.forEach((mesh) => {
      mesh.children[0].position.y = 0.6 + Math.sin(t * 3) * 0.1;
      mesh.children[0].rotation.y = t * 2;
      mesh.children[1].position.y = 0.8 + Math.sin(t * 3) * 0.1;
      mesh.children[1].rotation.y = t * 2;
    });
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

    // Spawn protection indicator
    const spawnProtEl = document.getElementById('spawn-protection-indicator')!;
    if (this.spawnProtection > 0 && !this.isDead) {
      spawnProtEl.style.display = 'block';
      spawnProtEl.textContent = `PROTECTED ${Math.ceil(this.spawnProtection)}s`;
    } else {
      spawnProtEl.style.display = 'none';
    }

    // Speed boost indicator
    const boostEl = document.getElementById('speed-boost-indicator')!;
    if (this.speedBoostTimer > 0) {
      boostEl.style.display = 'block';
      boostEl.textContent = `SPEED BOOST ${Math.ceil(this.speedBoostTimer)}s`;
    } else {
      boostEl.style.display = 'none';
    }

    document.getElementById('pool-indicator')!.style.display = this.isInPool ? 'block' : 'none';
    document.getElementById('slide-indicator')!.style.display = this.isOnSlide ? 'block' : 'none';

    // Weapon name
    const weaponNameEl = document.getElementById('weapon-name');
    if (weaponNameEl) {
      weaponNameEl.textContent = WEAPONS[this.currentWeapon].name;
    }

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
