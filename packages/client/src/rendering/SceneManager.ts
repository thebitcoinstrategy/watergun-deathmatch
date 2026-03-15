import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { MAP_SIZE, WALL_HEIGHT } from '@watergun/shared';

export interface PoolZone {
  min: THREE.Vector2;
  max: THREE.Vector2;
  waterY: number;
}

export interface SlideZone {
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  direction: THREE.Vector3;
  boundingBox: THREE.Box3;
}

export interface SlideRamp {
  minX: number;
  maxX: number;
  startZ: number;    // z at the top
  endZ: number;      // z at the bottom
  topHeight: number;  // y at startZ
  bottomHeight: number; // y at endZ
  slideForceZ: number; // push force when sliding down (positive = +z direction)
}

export interface LadderRamp {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  bottomHeight: number;
  topHeight: number;
}

export interface CollisionBox {
  min: THREE.Vector2;  // x, z
  max: THREE.Vector2;  // x, z
  height: number;
}

export interface PortalZone {
  x: number;
  z: number;
  width: number;
  facing: 'north' | 'south' | 'east' | 'west';
}

export class SceneManager {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  pools: PoolZone[] = [];
  slides: SlideZone[] = [];
  slideRamps: SlideRamp[] = [];
  ladderRamps: LadderRamp[] = [];
  collisionBoxes: CollisionBox[] = [];
  portalMirrors: PortalZone[] = [];
  private waterMeshes: THREE.Mesh[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();

    // Sky color
    this.scene.background = new THREE.Color('#87ceeb');
    this.scene.fog = new THREE.Fog('#87ceeb', 60, 120);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(20, 30, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    this.scene.add(sunLight);

    // Build the map
    this.buildMap();

    // Handle resize
    window.addEventListener('resize', this.onResize.bind(this));
  }

  private buildMap(): void {
    // Ground
    const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#7cb342' });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid overlay for blocky feel
    const gridHelper = new THREE.GridHelper(MAP_SIZE, MAP_SIZE, '#689f38', '#689f38');
    gridHelper.position.y = 0.01;
    (gridHelper.material as THREE.Material).opacity = 0.15;
    (gridHelper.material as THREE.Material).transparent = true;
    this.scene.add(gridHelper);

    const wallMat = new THREE.MeshStandardMaterial({ color: '#8d6e63' });
    const coverMat = new THREE.MeshStandardMaterial({ color: '#78909c' });
    const half = MAP_SIZE / 2;

    // Boundary walls
    const wallConfigs = [
      { w: MAP_SIZE, h: WALL_HEIGHT, d: 0.5, x: 0, z: -half },
      { w: MAP_SIZE, h: WALL_HEIGHT, d: 0.5, x: 0, z: half },
      { w: 0.5, h: WALL_HEIGHT, d: MAP_SIZE, x: -half, z: 0 },
      { w: 0.5, h: WALL_HEIGHT, d: MAP_SIZE, x: half, z: 0 },
    ];

    for (const cfg of wallConfigs) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d),
        wallMat
      );
      wall.position.set(cfg.x, cfg.h / 2, cfg.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);

      this.collisionBoxes.push({
        min: new THREE.Vector2(cfg.x - cfg.w / 2, cfg.z - cfg.d / 2),
        max: new THREE.Vector2(cfg.x + cfg.w / 2, cfg.z + cfg.d / 2),
        height: cfg.h,
      });
    }

    // Cover objects — blocks you can jump on and hide behind
    const covers = [
      // Original covers
      { x: -8, z: -8, w: 3, h: 2.5, d: 0.5 },
      { x: 8, z: 8, w: 3, h: 2.5, d: 0.5 },
      { x: -6, z: 6, w: 0.5, h: 2.5, d: 3 },
      { x: 6, z: -6, w: 0.5, h: 2.5, d: 3 },
      { x: 0, z: 0, w: 2, h: 1.5, d: 2 },
      { x: -12, z: 0, w: 4, h: 3, d: 0.5 },
      { x: 12, z: 0, w: 4, h: 3, d: 0.5 },
      { x: 0, z: -12, w: 0.5, h: 3, d: 4 },
      { x: -5, z: -14, w: 2, h: 2, d: 2 },
      { x: 5, z: 14, w: 2, h: 2, d: 2 },
      // Extra jump platforms (lower blocks you can jump onto)
      { x: 4, z: 0, w: 2, h: 1, d: 2 },
      { x: -4, z: 0, w: 2, h: 1, d: 2 },
      { x: 0, z: 5, w: 2, h: 1.2, d: 2 },
      { x: 0, z: -5, w: 2, h: 1.2, d: 2 },
      // Stacked blocks for higher vantage points
      { x: 10, z: -10, w: 2, h: 1.5, d: 2 },
      { x: -10, z: 10, w: 2, h: 1.5, d: 2 },
      // Corridor walls
      { x: 6, z: 3, w: 0.5, h: 2.5, d: 4 },
      { x: -6, z: -3, w: 0.5, h: 2.5, d: 4 },
      // Small crates
      { x: 3, z: -9, w: 1.5, h: 1, d: 1.5 },
      { x: -3, z: 9, w: 1.5, h: 1, d: 1.5 },
      { x: 15, z: 5, w: 2, h: 1.5, d: 2 },
      { x: -15, z: -5, w: 2, h: 1.5, d: 2 },
      // L-shaped corners
      { x: 10, z: 4, w: 3, h: 2, d: 0.5 },
      { x: 11.25, z: 5.5, w: 0.5, h: 2, d: 3 },
      { x: -10, z: -4, w: 3, h: 2, d: 0.5 },
      { x: -11.25, z: -5.5, w: 0.5, h: 2, d: 3 },
    ];

    for (const c of covers) {
      const cover = new THREE.Mesh(
        new THREE.BoxGeometry(c.w, c.h, c.d),
        coverMat
      );
      cover.position.set(c.x, c.h / 2, c.z);
      cover.castShadow = true;
      cover.receiveShadow = true;
      this.scene.add(cover);

      this.collisionBoxes.push({
        min: new THREE.Vector2(c.x - c.w / 2, c.z - c.d / 2),
        max: new THREE.Vector2(c.x + c.w / 2, c.z + c.d / 2),
        height: c.h,
      });
    }

    // === MIRROR ===
    this.buildMirror();

    // === SWIMMING POOLS ===
    this.buildPools();

    // === WATER SLIDES ===
    this.buildSlides();
  }

  private buildMirror(): void {
    const mirrorWidth = 6;
    const mirrorHeight = 3;
    const frameThickness = 0.15;
    const frameDepth = 0.1;

    // Helper to build a mirror with frame at a given position/rotation
    const buildOneMirror = (
      pos: THREE.Vector3,
      rotY: number,
      framePos: THREE.Vector3,
      portalColor?: number
    ) => {
      const mirrorGeo = new THREE.PlaneGeometry(mirrorWidth, mirrorHeight);
      const mirror = new Reflector(mirrorGeo, {
        color: portalColor ?? 0x889999,
        textureWidth: 512,
        textureHeight: 512,
      });
      mirror.position.copy(pos);
      mirror.rotation.y = rotY;
      mirror.camera.layers.enable(1);
      this.scene.add(mirror);

      // Frame
      const frameMat = new THREE.MeshStandardMaterial({
        color: portalColor ? '#1a237e' : '#5d4037',
        metalness: portalColor ? 0.6 : 0.3,
        roughness: portalColor ? 0.2 : 0.6,
        emissive: portalColor ? new THREE.Color(portalColor).multiplyScalar(0.3) : undefined,
      });
      const frameParts = [
        { w: mirrorWidth + frameThickness * 2, h: frameThickness, lx: 0, ly: mirrorHeight / 2 + 0.2 + frameThickness / 2 },
        { w: mirrorWidth + frameThickness * 2, h: frameThickness, lx: 0, ly: -(mirrorHeight / 2 + 0.2) + 0.2 - frameThickness / 2 },
        { w: frameThickness, h: mirrorHeight + frameThickness * 2, lx: -(mirrorWidth / 2 + frameThickness / 2), ly: 0 },
        { w: frameThickness, h: mirrorHeight + frameThickness * 2, lx: mirrorWidth / 2 + frameThickness / 2, ly: 0 },
      ];
      for (const f of frameParts) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(f.w, f.h, frameDepth),
          frameMat
        );
        mesh.position.set(f.lx, f.ly, 0);
        const group = new THREE.Group();
        group.add(mesh);
        group.position.copy(framePos);
        group.rotation.y = rotY;
        this.scene.add(group);
      }

      // Portal glow effect (only for portal mirrors)
      if (portalColor) {
        const glowGeo = new THREE.PlaneGeometry(mirrorWidth + 0.4, mirrorHeight + 0.4);
        const glowMat = new THREE.MeshBasicMaterial({
          color: portalColor,
          transparent: true,
          opacity: 0.15,
          side: THREE.DoubleSide,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.copy(pos);
        glow.position.y = pos.y;
        glow.rotation.y = rotY;
        this.scene.add(glow);
      }
    };

    // 1. Original mirror on north wall (non-portal, just a mirror)
    buildOneMirror(
      new THREE.Vector3(0, mirrorHeight / 2 + 0.2, -19.7),
      0,
      new THREE.Vector3(0, mirrorHeight / 2 + 0.2, -19.65),
    );

    // 2. Portal mirror on east wall — facing west (-X)
    buildOneMirror(
      new THREE.Vector3(19.7, mirrorHeight / 2 + 0.2, 8),
      -Math.PI / 2,
      new THREE.Vector3(19.65, mirrorHeight / 2 + 0.2, 8),
      0x4fc3f7
    );
    this.portalMirrors.push({ x: 19.7, z: 8, width: mirrorWidth, facing: 'west' });

    // 3. Portal mirror on west wall — facing east (+X)
    buildOneMirror(
      new THREE.Vector3(-19.7, mirrorHeight / 2 + 0.2, -8),
      Math.PI / 2,
      new THREE.Vector3(-19.65, mirrorHeight / 2 + 0.2, -8),
      0xe040fb
    );
    this.portalMirrors.push({ x: -19.7, z: -8, width: mirrorWidth, facing: 'east' });
  }

  private buildPools(): void {
    const poolConfigs = [
      { x: 14, z: -14, w: 8, d: 6, depth: 0.8 },   // Corner pool
      { x: -14, z: 14, w: 6, d: 8, depth: 0.6 },    // Other corner pool
      { x: 0, z: 14, w: 5, d: 4, depth: 0.5 },      // Side pool (slide landing)
    ];

    const poolEdgeMat = new THREE.MeshStandardMaterial({ color: '#e0e0e0' });
    const poolBottomMat = new THREE.MeshStandardMaterial({ color: '#4dd0e1' });

    for (const pool of poolConfigs) {
      const edgeThickness = 0.3;
      const edgeHeight = 0.4;

      // Pool floor (slightly below ground)
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(pool.w, 0.1, pool.d),
        poolBottomMat
      );
      floor.position.set(pool.x, -pool.depth + 0.05, pool.z);
      floor.receiveShadow = true;
      this.scene.add(floor);

      // Pool edges (4 sides)
      const edges = [
        { x: pool.x, z: pool.z - pool.d / 2, w: pool.w + edgeThickness * 2, d: edgeThickness },
        { x: pool.x, z: pool.z + pool.d / 2, w: pool.w + edgeThickness * 2, d: edgeThickness },
        { x: pool.x - pool.w / 2, z: pool.z, w: edgeThickness, d: pool.d },
        { x: pool.x + pool.w / 2, z: pool.z, w: edgeThickness, d: pool.d },
      ];

      for (const edge of edges) {
        const edgeMesh = new THREE.Mesh(
          new THREE.BoxGeometry(edge.w, edgeHeight, edge.d),
          poolEdgeMat
        );
        edgeMesh.position.set(edge.x, edgeHeight / 2, edge.z);
        edgeMesh.castShadow = true;
        this.scene.add(edgeMesh);
      }

      // Water surface (animated later)
      const waterGeo = new THREE.PlaneGeometry(pool.w, pool.d, 16, 16);
      const waterMat = new THREE.MeshStandardMaterial({
        color: '#29b6f6',
        transparent: true,
        opacity: 0.6,
        metalness: 0.1,
        roughness: 0.2,
      });
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.set(pool.x, 0.05, pool.z);
      water.receiveShadow = true;
      this.scene.add(water);
      this.waterMeshes.push(water);

      // Pool zone for gameplay
      this.pools.push({
        min: new THREE.Vector2(pool.x - pool.w / 2, pool.z - pool.d / 2),
        max: new THREE.Vector2(pool.x + pool.w / 2, pool.z + pool.d / 2),
        waterY: 0.05,
      });
    }
  }

  private buildSlides(): void {
    // Small water slide
    {
      const slideTopHeight = 3.5;

      // Tower
      const tower2 = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, slideTopHeight, 1.8),
        new THREE.MeshStandardMaterial({ color: '#ff9800' })
      );
      tower2.position.set(-14, slideTopHeight / 2, 10);
      tower2.castShadow = true;
      this.scene.add(tower2);

      // Platform
      const platform2 = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 0.3, 2.5),
        new THREE.MeshStandardMaterial({ color: '#ff5722' })
      );
      platform2.position.set(-14, slideTopHeight, 10);
      platform2.castShadow = true;
      this.scene.add(platform2);

      // Slide segments curving into pool
      const segments2 = 5;
      for (let i = 0; i < segments2; i++) {
        const t = i / segments2;
        const segY = slideTopHeight * (1 - t) - 0.3;
        const segZ = 10 + t * 6;

        const seg = new THREE.Mesh(
          new THREE.BoxGeometry(1.3, 0.15, 1.5),
          new THREE.MeshStandardMaterial({ color: '#ff5722' })
        );
        seg.position.set(-14, segY, segZ);
        seg.rotation.x = Math.atan2(slideTopHeight / segments2, 6 / segments2);
        seg.castShadow = true;
        this.scene.add(seg);
      }

      // Ladder
      for (let i = 0; i < 6; i++) {
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.15, 0.3),
          new THREE.MeshStandardMaterial({ color: '#bdbdbd' })
        );
        step.position.set(-14, i * 0.6 + 0.3, 8.8);
        step.castShadow = true;
        this.scene.add(step);
      }

      this.slides.push({
        startPos: new THREE.Vector3(-14, slideTopHeight, 10),
        endPos: new THREE.Vector3(-14, 0, 16),
        direction: new THREE.Vector3(0, -slideTopHeight, 6).normalize(),
        boundingBox: new THREE.Box3(
          new THREE.Vector3(-15.5, -0.5, 9),
          new THREE.Vector3(-12.5, slideTopHeight + 1, 17)
        ),
      });

      // Slide 2 chute ramp
      this.slideRamps.push({
        minX: -14.65,
        maxX: -13.35,
        startZ: 10,
        endZ: 16,
        topHeight: slideTopHeight - 0.3,
        bottomHeight: 0,
        slideForceZ: 6,
      });

      // Slide 2 ladder ramp
      this.ladderRamps.push({
        minX: -14.5,
        maxX: -13.5,
        minZ: 8.3,
        maxZ: 10.0,
        bottomHeight: 0,
        topHeight: slideTopHeight - 0.3,
      });
    }

    // Decorative elements around pools
    const umbrellaColors = ['#f44336', '#2196f3', '#ffeb3b', '#4caf50'];
    const umbrellaPositions = [
      { x: 18, z: -11 }, { x: 10, z: -17 },
      { x: -17, z: 18 }, { x: -11, z: 11 },
    ];

    for (let i = 0; i < umbrellaPositions.length; i++) {
      const pos = umbrellaPositions[i];

      // Umbrella pole
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 3),
        new THREE.MeshStandardMaterial({ color: '#795548' })
      );
      pole.position.set(pos.x, 1.5, pos.z);
      pole.castShadow = true;
      this.scene.add(pole);

      // Umbrella top (octagonal cone)
      const umbrella = new THREE.Mesh(
        new THREE.ConeGeometry(1.5, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: umbrellaColors[i] })
      );
      umbrella.position.set(pos.x, 3.1, pos.z);
      umbrella.castShadow = true;
      this.scene.add(umbrella);
    }
  }

  updateWater(elapsed: number): void {
    for (const water of this.waterMeshes) {
      // Gentle bobbing effect
      const baseY = water.userData.baseY ?? water.position.y;
      water.userData.baseY = baseY;
      water.position.y = baseY + Math.sin(elapsed * 3) * 0.02;
    }
  }

  /** Push position out of any collision box. Returns corrected x,z. Height-aware: allows standing on top. */
  resolveCollision(x: number, z: number, radius: number, playerY: number = 0): { x: number; z: number } {
    for (const box of this.collisionBoxes) {
      // Skip if the player is on top of the box
      if (playerY >= box.height - 0.1) continue;

      // Expand box by player radius
      const minX = box.min.x - radius;
      const maxX = box.max.x + radius;
      const minZ = box.min.y - radius;
      const maxZ = box.max.y + radius;

      if (x > minX && x < maxX && z > minZ && z < maxZ) {
        // Find shortest push-out direction
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

  /** Get the top of any collision box the player is above. Only returns height if player is at or above the box top. */
  getBlockHeight(x: number, z: number, radius: number, playerY: number): number {
    let maxHeight = 0;
    for (const box of this.collisionBoxes) {
      // Only count blocks the player is above (can land on)
      if (playerY < box.height - 0.3) continue;

      const minX = box.min.x - radius;
      const maxX = box.max.x + radius;
      const minZ = box.min.y - radius;
      const maxZ = box.max.y + radius;

      if (x > minX && x < maxX && z > minZ && z < maxZ) {
        if (box.height > maxHeight) {
          maxHeight = box.height;
        }
      }
    }
    return maxHeight;
  }

  /** Get the ground height from slide ramps/ladders at this position. Returns null if not on any ramp. */
  getSlideInfo(x: number, z: number): { height: number; slideForceZ: number } | null {
    // Check slide chute ramps
    for (const ramp of this.slideRamps) {
      if (x >= ramp.minX && x <= ramp.maxX && z >= ramp.startZ && z <= ramp.endZ) {
        const t = (z - ramp.startZ) / (ramp.endZ - ramp.startZ);
        const height = ramp.topHeight * (1 - t) + ramp.bottomHeight * t;
        return { height, slideForceZ: ramp.slideForceZ };
      }
    }

    // Check ladder ramps
    for (const ladder of this.ladderRamps) {
      if (x >= ladder.minX && x <= ladder.maxX && z >= ladder.minZ && z <= ladder.maxZ) {
        const t = (z - ladder.minZ) / (ladder.maxZ - ladder.minZ);
        const height = ladder.bottomHeight * (1 - t) + ladder.topHeight * t;
        return { height, slideForceZ: 0 };
      }
    }

    return null;
  }

  isInPool(x: number, z: number): PoolZone | null {
    for (const pool of this.pools) {
      if (x >= pool.min.x && x <= pool.max.x && z >= pool.min.y && z <= pool.max.y) {
        return pool;
      }
    }
    return null;
  }

  private onResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }
}
