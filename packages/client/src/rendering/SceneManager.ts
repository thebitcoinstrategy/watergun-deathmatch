import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { MAP_SIZE, WALL_HEIGHT, MAPS, DEFAULT_MAP } from '@watergun/shared';
import type { MapId, MapDef } from '@watergun/shared';
import {
  createPalmTree, createTree, createBush, createRock, createStreetLamp,
  createNeonLamp, createFenceSection, createBarrel, createCrate, createTorch,
  createBanner, createCrystal, createLantern, createTotemPole, createTrashCan,
  createFireHydrant, createFloorSlab, createCloud,
} from './Decorations';

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
  direction?: 'z' | 'x';
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
  private mapDef: MapDef;

  constructor(canvas: HTMLCanvasElement, mapId: MapId = DEFAULT_MAP) {
    this.mapDef = MAPS[mapId];
    this.scene = new THREE.Scene();

    // Sky color from map theme
    this.scene.background = new THREE.Color(this.mapDef.skyColor);
    this.scene.fog = new THREE.Fog(this.mapDef.fogColor, 60, 120);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    this.buildLighting();

    // Build the map
    this.buildMap();

    // Handle resize
    window.addEventListener('resize', this.onResize.bind(this));
  }

  private buildLighting(): void {
    const mapId = this.mapDef.id;
    const isNeon = mapId === 'neon_city';
    const isSky = mapId === 'sky_fortress';
    const isJungle = mapId === 'jungle_temple';
    const isMega = mapId === 'mega_arena';

    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      isNeon ? 0.3 : isSky ? 0.8 : isJungle ? 0.5 : isMega ? 0.4 : 0.6
    );
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(
      isNeon ? 0x8888ff : isSky ? 0xffffff : isJungle ? 0xffe0b0 : isMega ? 0xff8a65 : 0xffffff,
      isNeon ? 0.5 : isSky ? 1.2 : isMega ? 0.7 : 1.0
    );
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

    // Neon City gets colored point lights
    if (isNeon) {
      const neonColors = [0xff00ff, 0x00ffff, 0xff6600, 0x00ff66];
      const neonPositions = [
        { x: -12, z: -12 }, { x: 12, z: -12 },
        { x: -12, z: 12 }, { x: 12, z: 12 },
      ];
      for (let i = 0; i < neonPositions.length; i++) {
        const light = new THREE.PointLight(neonColors[i], 1.5, 20);
        light.position.set(neonPositions[i].x, 5, neonPositions[i].z);
        this.scene.add(light);
      }
    }

    // Pirate Cove gets warm directional light
    if (mapId === 'pirate_cove') {
      sunLight.color.set(0xffe0b0);
    }

    // Sky Fortress gets bright rim light from below
    if (isSky) {
      const rimLight = new THREE.DirectionalLight(0x81d4fa, 0.3);
      rimLight.position.set(0, -10, 0);
      this.scene.add(rimLight);
    }

    // Jungle Temple gets dappled light
    if (isJungle) {
      const jungleLights = [
        { x: -13, z: -13, color: 0xffab00 },
        { x: 13, z: -13, color: 0xffab00 },
        { x: -13, z: 13, color: 0xffab00 },
        { x: 13, z: 13, color: 0xffab00 },
      ];
      for (const jl of jungleLights) {
        const light = new THREE.PointLight(jl.color, 0.6, 15);
        light.position.set(jl.x, 4, jl.z);
        this.scene.add(light);
      }
    }
  }

  private buildMap(): void {
    const map = this.mapDef;

    // Ground (conditionally shown)
    if (map.showDefaultGround !== false) {
      const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
      const groundMat = new THREE.MeshStandardMaterial({ color: map.groundColor });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      this.scene.add(ground);

      const gridHelper = new THREE.GridHelper(MAP_SIZE, MAP_SIZE, map.gridColor, map.gridColor);
      gridHelper.position.y = 0.01;
      (gridHelper.material as THREE.Material).opacity = map.id === 'neon_city' ? 0.3 : 0.15;
      (gridHelper.material as THREE.Material).transparent = true;
      this.scene.add(gridHelper);
    }

    // Ground platforms (custom shaped ground areas)
    if (map.groundPlatforms) {
      for (const gp of map.groundPlatforms) {
        const y = gp.y ?? 0;
        const platGeo = new THREE.BoxGeometry(gp.w, 0.15, gp.d);
        const platMat = new THREE.MeshStandardMaterial({ color: gp.color || map.groundColor });
        const plat = new THREE.Mesh(platGeo, platMat);
        plat.position.set(gp.x, y, gp.z);
        plat.receiveShadow = true;
        this.scene.add(plat);
      }
    }

    const wallMat = new THREE.MeshStandardMaterial({ color: map.wallColor });
    const coverMat = new THREE.MeshStandardMaterial({ color: map.coverColor });
    const half = MAP_SIZE / 2;

    // Neon City: emissive cover material
    if (map.id === 'neon_city') {
      coverMat.emissive = new THREE.Color('#1a237e');
      coverMat.emissiveIntensity = 0.15;
    }
    // Sky Fortress: slight metallic sheen
    if (map.id === 'sky_fortress') {
      coverMat.metalness = 0.2;
      coverMat.roughness = 0.6;
    }

    // Boundary walls (always add collision, conditionally show visual)
    const wallConfigs = [
      { w: MAP_SIZE, h: WALL_HEIGHT, d: 0.5, x: 0, z: -half },
      { w: MAP_SIZE, h: WALL_HEIGHT, d: 0.5, x: 0, z: half },
      { w: 0.5, h: WALL_HEIGHT, d: MAP_SIZE, x: -half, z: 0 },
      { w: 0.5, h: WALL_HEIGHT, d: MAP_SIZE, x: half, z: 0 },
    ];

    for (const cfg of wallConfigs) {
      if (map.showBoundaryWalls !== false) {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d),
          wallMat
        );
        wall.position.set(cfg.x, cfg.h / 2, cfg.z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.scene.add(wall);
      }

      this.collisionBoxes.push({
        min: new THREE.Vector2(cfg.x - cfg.w / 2, cfg.z - cfg.d / 2),
        max: new THREE.Vector2(cfg.x + cfg.w / 2, cfg.z + cfg.d / 2),
        height: cfg.h,
      });
    }

    // Cover objects from map definition
    for (const c of map.covers) {
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

    // Data-driven ramps and ladders (all maps)
    this.buildRampsAndLadders();

    // Floor sections (elevated walkable areas)
    if (map.floors) {
      for (const f of map.floors) {
        const slab = createFloorSlab(
          f.w, f.d, f.height,
          f.color || map.coverColor,
          f.thickness ?? 0.3,
          f.railings
        );
        slab.position.set(f.x, 0, f.z);
        this.scene.add(slab);

        // Add collision box so players can stand on the floor
        this.collisionBoxes.push({
          min: new THREE.Vector2(f.x - f.w / 2, f.z - f.d / 2),
          max: new THREE.Vector2(f.x + f.w / 2, f.z + f.d / 2),
          height: f.height + (f.thickness ?? 0.3) / 2,
        });
      }
    }

    // Map-specific features
    if (map.hasMirrors) this.buildMirrors();
    if (map.pools) this.buildPools(map.pools);
    if (map.hasSlide) this.buildAquaParkDecorations();

    // Map-specific decorations
    if (map.id === 'pirate_cove') this.buildPirateDecorations();
    if (map.id === 'neon_city') this.buildNeonDecorations();
    if (map.id === 'sky_fortress') this.buildSkyFortressDecorations();
    if (map.id === 'jungle_temple') this.buildJungleTempleDecorations();
    if (map.id === 'mega_arena') this.buildMegaArenaDecorations();
  }

  /** Build ramps and ladders from map definition data */
  private buildRampsAndLadders(): void {
    const map = this.mapDef;
    const rampMat = new THREE.MeshStandardMaterial({ color: map.coverColor });

    // Build slide ramps
    if (map.ramps) {
      for (const ramp of map.ramps) {
        this.slideRamps.push({
          minX: ramp.minX,
          maxX: ramp.maxX,
          startZ: ramp.startZ,
          endZ: ramp.endZ,
          topHeight: ramp.topHeight,
          bottomHeight: ramp.bottomHeight,
          slideForceZ: ramp.slideForce,
        });

        // Visual: angled segments
        const segments = 4;
        const zSpan = ramp.endZ - ramp.startZ;
        const hSpan = ramp.topHeight - ramp.bottomHeight;
        const w = ramp.maxX - ramp.minX;
        const cx = (ramp.minX + ramp.maxX) / 2;
        for (let i = 0; i < segments; i++) {
          const t = (i + 0.5) / segments;
          const segZ = ramp.startZ + t * zSpan;
          const segY = ramp.topHeight - t * hSpan;
          const seg = new THREE.Mesh(
            new THREE.BoxGeometry(w, 0.15, Math.abs(zSpan) / segments + 0.1),
            rampMat
          );
          seg.position.set(cx, segY, segZ);
          seg.rotation.x = Math.atan2(hSpan / segments, zSpan / segments);
          seg.castShadow = true;
          this.scene.add(seg);
        }
      }
    }

    // Build ladders
    if (map.ladders) {
      for (const ladder of map.ladders) {
        this.ladderRamps.push({
          minX: ladder.minX,
          maxX: ladder.maxX,
          minZ: ladder.minZ,
          maxZ: ladder.maxZ,
          bottomHeight: ladder.bottomHeight,
          topHeight: ladder.topHeight,
          direction: ladder.direction,
        });

        // Visual: step meshes
        const hDiff = Math.abs(ladder.topHeight - ladder.bottomHeight);
        const numSteps = Math.max(2, Math.ceil(hDiff / 0.5));
        const isXDir = ladder.direction === 'x';
        const w = ladder.maxX - ladder.minX;
        const d = ladder.maxZ - ladder.minZ;
        const cx = (ladder.minX + ladder.maxX) / 2;
        const cz = (ladder.minZ + ladder.maxZ) / 2;

        for (let i = 0; i < numSteps; i++) {
          const t = (i + 0.5) / numSteps;
          const h = ladder.bottomHeight + t * (ladder.topHeight - ladder.bottomHeight);
          let sx: number, sz: number;
          if (isXDir) {
            sx = ladder.minX + t * (ladder.maxX - ladder.minX);
            sz = cz;
          } else {
            sx = cx;
            sz = ladder.minZ + t * (ladder.maxZ - ladder.minZ);
          }
          const step = new THREE.Mesh(
            new THREE.BoxGeometry(isXDir ? w / numSteps : w * 0.8, 0.12, isXDir ? d * 0.8 : d / numSteps),
            rampMat
          );
          step.position.set(sx, h, sz);
          step.castShadow = true;
          this.scene.add(step);
        }
      }
    }
  }

  private buildMirrors(): void {
    const mirrorWidth = 6;
    const mirrorHeight = 3;
    const frameThickness = 0.15;
    const frameDepth = 0.1;

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
        glow.rotation.y = rotY;
        this.scene.add(glow);
      }
    };

    // Mirror on north wall
    buildOneMirror(
      new THREE.Vector3(0, mirrorHeight / 2 + 0.2, -19.7),
      0,
      new THREE.Vector3(0, mirrorHeight / 2 + 0.2, -19.65),
    );

    // Portal on east wall
    buildOneMirror(
      new THREE.Vector3(19.7, mirrorHeight / 2 + 0.2, 8),
      -Math.PI / 2,
      new THREE.Vector3(19.65, mirrorHeight / 2 + 0.2, 8),
      0x4fc3f7
    );
    this.portalMirrors.push({ x: 19.7, z: 8, width: mirrorWidth, facing: 'west' });

    // Portal on west wall
    buildOneMirror(
      new THREE.Vector3(-19.7, mirrorHeight / 2 + 0.2, -8),
      Math.PI / 2,
      new THREE.Vector3(-19.65, mirrorHeight / 2 + 0.2, -8),
      0xe040fb
    );
    this.portalMirrors.push({ x: -19.7, z: -8, width: mirrorWidth, facing: 'east' });
  }

  private buildPools(poolConfigs: { x: number; z: number; w: number; d: number; depth: number }[]): void {
    const poolEdgeMat = new THREE.MeshStandardMaterial({ color: '#e0e0e0' });
    const poolBottomMat = new THREE.MeshStandardMaterial({ color: '#4dd0e1' });

    // Map-specific pool colors
    if (this.mapDef.id === 'neon_city') {
      poolBottomMat.color.set('#7c4dff');
      poolBottomMat.emissive = new THREE.Color('#7c4dff');
      poolBottomMat.emissiveIntensity = 0.3;
    }
    if (this.mapDef.id === 'jungle_temple') {
      poolBottomMat.color.set('#1b5e20');
    }
    if (this.mapDef.id === 'sky_fortress') {
      poolBottomMat.color.set('#b3e5fc');
      poolEdgeMat.color.set('#e1f5fe');
    }
    if (this.mapDef.id === 'mega_arena') {
      poolBottomMat.color.set('#ff3d00');
      poolBottomMat.emissive = new THREE.Color('#ff3d00');
      poolBottomMat.emissiveIntensity = 0.4;
      poolEdgeMat.color.set('#424242');
    }

    for (const pool of poolConfigs) {
      const edgeThickness = 0.3;
      const edgeHeight = 0.4;

      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(pool.w, 0.1, pool.d),
        poolBottomMat
      );
      floor.position.set(pool.x, -pool.depth + 0.05, pool.z);
      floor.receiveShadow = true;
      this.scene.add(floor);

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

      const waterColorMap: Record<string, string> = {
        neon_city: '#e040fb',
        jungle_temple: '#2e7d32',
        sky_fortress: '#81d4fa',
        mega_arena: '#ff6d00',
      };
      const waterColor = waterColorMap[this.mapDef.id] || '#29b6f6';
      const waterGeo = new THREE.PlaneGeometry(pool.w, pool.d, 16, 16);
      const waterMat = new THREE.MeshStandardMaterial({
        color: waterColor,
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

      this.pools.push({
        min: new THREE.Vector2(pool.x - pool.w / 2, pool.z - pool.d / 2),
        max: new THREE.Vector2(pool.x + pool.w / 2, pool.z + pool.d / 2),
        waterY: 0.05,
      });
    }
  }

  /** Aqua Park specific visual decorations (tower, slide chute, umbrellas) */
  private buildAquaParkDecorations(): void {
    const slideTopHeight = 3.5;

    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, slideTopHeight, 1.8),
      new THREE.MeshStandardMaterial({ color: '#ff9800' })
    );
    tower.position.set(-14, slideTopHeight / 2, 10);
    tower.castShadow = true;
    this.scene.add(tower);

    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.3, 2.5),
      new THREE.MeshStandardMaterial({ color: '#ff5722' })
    );
    platform.position.set(-14, slideTopHeight, 10);
    platform.castShadow = true;
    this.scene.add(platform);

    const segments = 5;
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const segY = slideTopHeight * (1 - t) - 0.3;
      const segZ = 10 + t * 6;
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.15, 1.5),
        new THREE.MeshStandardMaterial({ color: '#ff5722' })
      );
      seg.position.set(-14, segY, segZ);
      seg.rotation.x = Math.atan2(slideTopHeight / segments, 6 / segments);
      seg.castShadow = true;
      this.scene.add(seg);
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

    // Decorative umbrellas
    const umbrellaColors = ['#f44336', '#2196f3', '#ffeb3b', '#4caf50'];
    const umbrellaPositions = [
      { x: 18, z: -11 }, { x: 10, z: -17 },
      { x: -17, z: 18 }, { x: -11, z: 11 },
    ];
    for (let i = 0; i < umbrellaPositions.length; i++) {
      const pos = umbrellaPositions[i];
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 3),
        new THREE.MeshStandardMaterial({ color: '#795548' })
      );
      pole.position.set(pos.x, 1.5, pos.z);
      pole.castShadow = true;
      this.scene.add(pole);

      const umbrella = new THREE.Mesh(
        new THREE.ConeGeometry(1.5, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: umbrellaColors[i] })
      );
      umbrella.position.set(pos.x, 3.1, pos.z);
      umbrella.castShadow = true;
      this.scene.add(umbrella);
    }

    // Palm trees around the park
    const palmPositions = [
      { x: -18, z: -18 }, { x: 18, z: 18 },
      { x: -18, z: 8 }, { x: 18, z: -8 },
      { x: -8, z: -18 }, { x: 8, z: 18 },
    ];
    for (const p of palmPositions) {
      const palm = createPalmTree(4 + Math.random());
      palm.position.set(p.x, 0, p.z);
      this.scene.add(palm);
    }

    // Bushes around pool edges
    const bushPositions = [
      { x: 10, z: -11 }, { x: 18, z: -17 },
      { x: -17, z: 10 }, { x: -10, z: 18 },
    ];
    for (const b of bushPositions) {
      const bush = createBush(0.5 + Math.random() * 0.3);
      bush.position.set(b.x, 0, b.z);
      this.scene.add(bush);
    }

    // Rocks scattered
    for (const r of [{ x: -16, z: -12 }, { x: 16, z: 12 }, { x: 5, z: -16 }]) {
      const rock = createRock(0.3 + Math.random() * 0.3);
      rock.position.set(r.x, 0, r.z);
      this.scene.add(rock);
    }
  }

  private buildPirateDecorations(): void {
    const woodMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
    const ropeMat = new THREE.MeshStandardMaterial({ color: '#d7ccc8' });

    // Ship wheel on the bow
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: '#4e342e' })
    );
    wheel.position.set(5, 2.6, 0);
    wheel.rotation.x = Math.PI / 2;
    this.scene.add(wheel);

    // Torches on towers and corners
    const torchPositions = [
      { x: -15, z: -15 }, { x: 15, z: 15 },
      { x: -15, z: 15 }, { x: 15, z: -15 },
      { x: -13, z: 7 }, { x: 13, z: -7 },
    ];
    for (const pos of torchPositions) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2),
        woodMat
      );
      pole.position.set(pos.x, 1, pos.z);
      this.scene.add(pole);

      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ff6600' })
      );
      flame.position.set(pos.x, 2.1, pos.z);
      this.scene.add(flame);

      const light = new THREE.PointLight(0xff6600, 0.6, 10);
      light.position.set(pos.x, 2.5, pos.z);
      this.scene.add(light);
    }

    // Rope lines between masts
    const ropeGeo = new THREE.CylinderGeometry(0.02, 0.02, 7);
    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.position.set(0.5, 5.5, 0);
    rope.rotation.z = Math.PI / 2;
    this.scene.add(rope);

    // Cross-rope to captain's cabin
    const rope2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 5),
      ropeMat
    );
    rope2.position.set(-4, 4.5, 1.5);
    rope2.rotation.x = Math.PI / 6;
    rope2.rotation.z = Math.PI / 3;
    this.scene.add(rope2);

    // Anchor near ship
    const anchor = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.2, 0.3),
      new THREE.MeshStandardMaterial({ color: '#424242' })
    );
    anchor.position.set(8, 0.6, 4);
    this.scene.add(anchor);

    // Jolly roger flag on front mast
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.8),
      new THREE.MeshBasicMaterial({ color: '#212121', side: THREE.DoubleSide })
    );
    flag.position.set(4.8, 6.5, 0);
    this.scene.add(flag);

    // Gangplank railings (visual rope lines)
    const railPositions = [
      { x1: -2, z1: -6, x2: -2, z2: -3.25, y: 1.8 },
      { x1: 2, z1: -6, x2: 2, z2: -3.25, y: 1.8 },
      { x1: -2, z1: 3.25, x2: -2, z2: 6, y: 1.8 },
      { x1: 2, z1: 3.25, x2: 2, z2: 6, y: 1.8 },
    ];
    for (const rail of railPositions) {
      const len = Math.sqrt((rail.x2 - rail.x1) ** 2 + (rail.z2 - rail.z1) ** 2);
      const railMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, len),
        ropeMat
      );
      railMesh.position.set(
        (rail.x1 + rail.x2) / 2,
        rail.y,
        (rail.z1 + rail.z2) / 2
      );
      railMesh.rotation.x = Math.PI / 2;
      this.scene.add(railMesh);
    }

    // Barrels on dock
    for (const bp of [{ x: -13, z: 4 }, { x: -14, z: 5 }, { x: 13, z: -4 }, { x: 14, z: -5 }]) {
      const barrel = createBarrel('#6d4c41');
      barrel.position.set(bp.x, 0, bp.z);
      this.scene.add(barrel);
    }

    // Crates near ship
    for (const cp of [{ x: -9, z: -8 }, { x: 9, z: 8 }, { x: -5, z: -12 }]) {
      const crate = createCrate(0.7, '#8d6e63');
      crate.position.set(cp.x, 0, cp.z);
      this.scene.add(crate);
    }

    // Palm trees on beach (south)
    for (const pp of [{ x: -12, z: 16 }, { x: 5, z: 17 }, { x: -5, z: 15 }, { x: 12, z: 16 }]) {
      const palm = createPalmTree(3.5 + Math.random());
      palm.position.set(pp.x, 0, pp.z);
      this.scene.add(palm);
    }

    // Lanterns on dock posts
    for (const lp of [{ x: -11, z: 3 }, { x: -17, z: -3 }, { x: 11, z: -3 }, { x: 17, z: 3 }]) {
      const lantern = createLantern(0xff8f00);
      lantern.position.set(lp.x, 0, lp.z);
      this.scene.add(lantern);
    }

    // Fence along dock edges
    const dockFence1 = createFenceSection(10, 1, '#5d4037');
    dockFence1.position.set(-14, 0, -6);
    dockFence1.rotation.y = Math.PI / 2;
    this.scene.add(dockFence1);
    const dockFence2 = createFenceSection(10, 1, '#5d4037');
    dockFence2.position.set(14, 0, 6);
    dockFence2.rotation.y = Math.PI / 2;
    this.scene.add(dockFence2);
  }

  private buildNeonDecorations(): void {
    // Neon strip lights on building edges (updated positions for new layout)
    const neonPairs: { pos: THREE.Vector3; length: number; rotY: number; color: number }[] = [
      { pos: new THREE.Vector3(-12, 5.2, -9.6), length: 5, rotY: 0, color: 0xff00ff },
      { pos: new THREE.Vector3(12, 5.2, 9.6), length: 5, rotY: 0, color: 0x00ffff },
      { pos: new THREE.Vector3(-9.6, 4.2, 12), length: 5, rotY: Math.PI / 2, color: 0xff6600 },
      { pos: new THREE.Vector3(9.6, 5.2, -12), length: 5, rotY: Math.PI / 2, color: 0x00ff66 },
      // Additional neon on mid-platforms
      { pos: new THREE.Vector3(0, 3.2, -12), length: 2, rotY: 0, color: 0xff0066 },
      { pos: new THREE.Vector3(0, 3.2, 12), length: 2, rotY: 0, color: 0x6600ff },
      { pos: new THREE.Vector3(-12, 3.2, 0), length: 2, rotY: Math.PI / 2, color: 0x00ff99 },
      { pos: new THREE.Vector3(12, 3.2, 0), length: 2, rotY: Math.PI / 2, color: 0xff9900 },
    ];

    for (const strip of neonPairs) {
      const geo = new THREE.BoxGeometry(strip.length, 0.15, 0.15);
      const mat = new THREE.MeshBasicMaterial({ color: strip.color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(strip.pos);
      mesh.rotation.y = strip.rotY;
      this.scene.add(mesh);
    }

    // Glowing signs on walls
    const signConfigs = [
      { x: 0, z: -19.6, rotY: 0, text: 0x00ffff },
      { x: 0, z: 19.6, rotY: Math.PI, text: 0xff00ff },
    ];
    for (const sign of signConfigs) {
      const signGeo = new THREE.PlaneGeometry(4, 1.5);
      const signMat = new THREE.MeshBasicMaterial({
        color: sign.text,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      });
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(sign.x, 3, sign.z);
      signMesh.rotation.y = sign.rotY;
      this.scene.add(signMesh);
    }

    // Vertical neon strips on staircase walls
    const vertNeons = [
      { x: -12, z: -8.5, h: 3, color: 0xff00ff },
      { x: 12, z: 8.5, h: 3, color: 0x00ffff },
    ];
    for (const vn of vertNeons) {
      const geo = new THREE.BoxGeometry(0.1, vn.h, 0.1);
      const mat = new THREE.MeshBasicMaterial({ color: vn.color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(vn.x, vn.h / 2, vn.z);
      this.scene.add(mesh);
    }

    // Neon lamps along streets
    const neonLampPositions = [
      { x: -18, z: -8, c: 0xff00ff }, { x: -18, z: 0, c: 0x00ffff },
      { x: -18, z: 8, c: 0xff6600 }, { x: 18, z: -8, c: 0x00ff66 },
      { x: 18, z: 0, c: 0xff0066 }, { x: 18, z: 8, c: 0x6600ff },
      { x: -8, z: -18, c: 0x00ffff }, { x: 8, z: -18, c: 0xff00ff },
      { x: -8, z: 18, c: 0xff9900 }, { x: 8, z: 18, c: 0x00ff99 },
    ];
    for (const nl of neonLampPositions) {
      const lamp = createNeonLamp(3.5, nl.c);
      lamp.position.set(nl.x, 0, nl.z);
      this.scene.add(lamp);
    }

    // Trash cans and fire hydrants (urban props)
    for (const tp of [{ x: -16, z: -5 }, { x: 16, z: 5 }, { x: -5, z: 16 }, { x: 5, z: -16 }]) {
      const trash = createTrashCan('#424242');
      trash.position.set(tp.x, 0, tp.z);
      this.scene.add(trash);
    }
    for (const hp of [{ x: -17, z: -14 }, { x: 17, z: 14 }]) {
      const hydrant = createFireHydrant('#d32f2f');
      hydrant.position.set(hp.x, 0, hp.z);
      this.scene.add(hydrant);
    }
  }

  private buildSkyFortressDecorations(): void {
    // Crystal beacons on tower tiers
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x4fc3f7 });
    const beaconPositions = [
      { x: 0, y: 6.5, z: 0 },   // Tower peak
      { x: 3, y: 2.3, z: 3 },    // Base tier corners
      { x: -3, y: 2.3, z: -3 },
      { x: 3, y: 2.3, z: -3 },
      { x: -3, y: 2.3, z: 3 },
    ];
    for (const bp of beaconPositions) {
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.3),
        beaconMat
      );
      crystal.position.set(bp.x, bp.y, bp.z);
      this.scene.add(crystal);

      const glow = new THREE.PointLight(0x4fc3f7, 0.5, 8);
      glow.position.set(bp.x, bp.y + 0.3, bp.z);
      this.scene.add(glow);
    }

    // Flags on satellite platforms
    const flagColors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44];
    const flagPositions = [
      { x: 0, z: -14 }, { x: 0, z: 14 },
      { x: 14, z: 0 }, { x: -14, z: 0 },
    ];
    const flagHeights = [3, 3, 4, 2];
    for (let i = 0; i < flagPositions.length; i++) {
      const fp = flagPositions[i];
      const h = flagHeights[i];
      // Flag pole
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 2),
        new THREE.MeshStandardMaterial({ color: '#90a4ae' })
      );
      pole.position.set(fp.x, h + 1, fp.z);
      this.scene.add(pole);

      // Flag
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 0.6),
        new THREE.MeshBasicMaterial({ color: flagColors[i], side: THREE.DoubleSide })
      );
      flag.position.set(fp.x + 0.5, h + 1.7, fp.z);
      this.scene.add(flag);
    }

    // Cloud puffs below the arena (atmospheric) using Decorations
    for (let i = 0; i < 15; i++) {
      const cloud = createCloud(3 + Math.random() * 3);
      cloud.position.set(
        (Math.random() - 0.5) * 50,
        -3 - Math.random() * 6,
        (Math.random() - 0.5) * 50
      );
      this.scene.add(cloud);
    }

    // Crystals on platform edges
    const crystalPositions = [
      { x: -14, z: -3, c: 0x4fc3f7 }, { x: -14, z: 3, c: 0x4fc3f7 },
      { x: 14, z: -3, c: 0x81d4fa }, { x: 14, z: 3, c: 0x81d4fa },
      { x: -3, z: -14, c: 0xe1f5fe }, { x: 3, z: -14, c: 0xe1f5fe },
      { x: -3, z: 14, c: 0xb3e5fc }, { x: 3, z: 14, c: 0xb3e5fc },
      { x: -10, z: -10, c: 0x4fc3f7 }, { x: 10, z: 10, c: 0x4fc3f7 },
    ];
    for (const cp of crystalPositions) {
      const crystal = createCrystal(0.3 + Math.random() * 0.2, cp.c);
      crystal.position.set(cp.x, 0, cp.z);
      this.scene.add(crystal);
    }

    // Banners on beacon pillars
    for (const bp of [{ x: -17, z: 0 }, { x: 17, z: 0 }, { x: 0, z: -17 }, { x: 0, z: 17 }]) {
      const banner = createBanner('#81d4fa', 0.8, 1);
      banner.position.set(bp.x, 3, bp.z);
      this.scene.add(banner);
    }
  }

  private buildJungleTempleDecorations(): void {
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });

    // Torches on temple ruins
    const torchPositions = [
      { x: -13, z: -11 }, { x: -11, z: -13 },
      { x: 13, z: -11 }, { x: 11, z: -13 },
      { x: -13, z: 11 }, { x: -11, z: 13 },
      { x: 13, z: 11 }, { x: 11, z: 13 },
    ];
    for (const pos of torchPositions) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.5),
        stoneMat
      );
      pole.position.set(pos.x, 0.75, pos.z);
      this.scene.add(pole);

      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ff8f00' })
      );
      flame.position.set(pos.x, 1.6, pos.z);
      this.scene.add(flame);

      const light = new THREE.PointLight(0xff8f00, 0.4, 8);
      light.position.set(pos.x, 2, pos.z);
      this.scene.add(light);
    }

    // Vine meshes between bridge pillars (west side)
    const vineMat = new THREE.MeshStandardMaterial({ color: '#2e7d32' });
    for (let z = -6; z <= 6; z += 3) {
      // West side vines
      const vine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 2.5),
        vineMat
      );
      vine.position.set(-13, 1.25, z);
      this.scene.add(vine);

      // East side vines
      const vine2 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 2.5),
        vineMat
      );
      vine2.position.set(13, 1.25, z);
      this.scene.add(vine2);
    }

    // Stone face on pyramid summit
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.5, 0.3),
      new THREE.MeshStandardMaterial({ color: '#8d6e63', metalness: 0.1 })
    );
    face.position.set(0, 5, -1.4);
    this.scene.add(face);

    // Eye glows on stone face
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffab00' });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
    leftEye.position.set(-0.3, 5.2, -1.55);
    this.scene.add(leftEye);
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
    rightEye.position.set(0.3, 5.2, -1.55);
    this.scene.add(rightEye);
    const faceLight = new THREE.PointLight(0xffab00, 0.5, 6);
    faceLight.position.set(0, 5.2, -2);
    this.scene.add(faceLight);

    // Leaf canopy patches (semi-transparent green planes)
    const leafMat = new THREE.MeshBasicMaterial({
      color: '#33691e',
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const canopyPositions = [
      { x: -15, z: -6, w: 6, d: 4 },
      { x: 15, z: 6, w: 6, d: 4 },
      { x: -6, z: 15, w: 4, d: 6 },
      { x: 6, z: -15, w: 4, d: 6 },
    ];
    for (const cp of canopyPositions) {
      const leaf = new THREE.Mesh(
        new THREE.PlaneGeometry(cp.w, cp.d),
        leafMat
      );
      leaf.rotation.x = -Math.PI / 2;
      leaf.position.set(cp.x, 5, cp.z);
      this.scene.add(leaf);
    }

    // Trees around the jungle perimeter
    const treePositions = [
      { x: -18, z: -18 }, { x: -18, z: 0 }, { x: -18, z: 18 },
      { x: 18, z: -18 }, { x: 18, z: 0 }, { x: 18, z: 18 },
      { x: 0, z: -18 }, { x: 0, z: 18 },
      { x: -16, z: 8 }, { x: 16, z: -8 },
    ];
    for (const tp of treePositions) {
      const tree = createTree(3 + Math.random() * 1.5, '#4e342e', '#2e7d32');
      tree.position.set(tp.x, 0, tp.z);
      this.scene.add(tree);
    }

    // Bushes scattered around ruins
    for (const bp of [
      { x: -15, z: -10 }, { x: 15, z: 10 }, { x: -10, z: 15 }, { x: 10, z: -15 },
      { x: -7, z: 8 }, { x: 7, z: -8 }, { x: -16, z: -6 }, { x: 16, z: 6 },
    ]) {
      const bush = createBush(0.4 + Math.random() * 0.3, '#388e3c');
      bush.position.set(bp.x, 0, bp.z);
      this.scene.add(bush);
    }

    // Totem poles near temple entrances
    for (const tp of [{ x: -15, z: -11 }, { x: -11, z: -15 }, { x: 15, z: 11 }, { x: 11, z: 15 }]) {
      const totem = createTotemPole(2.5, '#5d4037');
      totem.position.set(tp.x, 0, tp.z);
      this.scene.add(totem);
    }

    // Rocks near paths
    for (const rp of [{ x: -7, z: -5 }, { x: 7, z: 5 }, { x: -4, z: 10 }, { x: 4, z: -10 }]) {
      const rock = createRock(0.4 + Math.random() * 0.3, '#6d4c41');
      rock.position.set(rp.x, 0, rp.z);
      this.scene.add(rock);
    }
  }

  private buildMegaArenaDecorations(): void {
    // Lava-colored pool bottom overrides
    // (pool colors handled in buildPools via mapId check)

    // Fortress spire beacon
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff6d00 });
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), beaconMat);
    beacon.position.set(0, 8.5, 0);
    this.scene.add(beacon);
    const beaconLight = new THREE.PointLight(0xff6d00, 1.5, 15);
    beaconLight.position.set(0, 9, 0);
    this.scene.add(beaconLight);

    // Obelisk glow tips
    const obeliskPositions = [
      { x: -7, z: -17 }, { x: 7, z: 17 },
      { x: -17, z: 7 }, { x: 17, z: -7 },
    ];
    for (const op of obeliskPositions) {
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 0.6, 4),
        beaconMat
      );
      tip.position.set(op.x, 6.3, op.z);
      this.scene.add(tip);
      const glow = new THREE.PointLight(0xff6d00, 0.4, 8);
      glow.position.set(op.x, 6.5, op.z);
      this.scene.add(glow);
    }

    // Smokestack embers (SW compound)
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xff3d00 });
    for (let i = 0; i < 5; i++) {
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.08), emberMat);
      ember.position.set(
        -16 + (Math.random() - 0.5) * 1,
        5.5 + Math.random() * 1.5,
        13 + (Math.random() - 0.5) * 1
      );
      this.scene.add(ember);
    }

    // Corner bunker flags
    const flagMat = new THREE.MeshBasicMaterial({ color: 0xff9100, side: THREE.DoubleSide });
    const bunkerFlags = [
      { x: -17, z: -17 }, { x: 17, z: -17 },
      { x: -17, z: 17 }, { x: 17, z: 17 },
    ];
    for (const bf of bunkerFlags) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 2),
        new THREE.MeshStandardMaterial({ color: '#455a64' })
      );
      pole.position.set(bf.x, 2.5, bf.z);
      this.scene.add(pole);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.5),
        flagMat
      );
      flag.position.set(bf.x + 0.4, 3.2, bf.z);
      this.scene.add(flag);
    }

    // Ambient lava glow from pools
    const lavaLightPositions = [
      { x: -14, z: -14 }, { x: 14, z: 14 },
      { x: 0, z: 0 },
    ];
    for (const lp of lavaLightPositions) {
      const light = new THREE.PointLight(0xff3d00, 0.4, 10);
      light.position.set(lp.x, 0.5, lp.z);
      this.scene.add(light);
    }

    // Street lamps in NW military compound
    for (const lp of [{ x: -17, z: -8 }, { x: -11, z: -12 }]) {
      const lamp = createStreetLamp(4, 0xffe0b0);
      lamp.position.set(lp.x, 0, lp.z);
      this.scene.add(lamp);
    }

    // Barrels in SW industrial area
    for (const bp of [{ x: -15, z: 10 }, { x: -10, z: 14 }, { x: -12, z: 16 }]) {
      const barrel = createBarrel('#546e7a');
      barrel.position.set(bp.x, 0, bp.z);
      this.scene.add(barrel);
    }

    // Crates in NE ruins
    for (const cp of [{ x: 12, z: -15 }, { x: 16, z: -10 }]) {
      const crate = createCrate(0.8, '#6d4c41');
      crate.position.set(cp.x, 0, cp.z);
      this.scene.add(crate);
    }

    // Torches on SE fortress
    for (const tp of [{ x: 11, z: 11 }, { x: 15, z: 15 }, { x: 11, z: 15 }, { x: 15, z: 11 }]) {
      const torch = createTorch('#ff6600');
      torch.position.set(tp.x, 0, tp.z);
      this.scene.add(torch);
    }

    // Rocks scattered around mid-field
    for (const rp of [{ x: -8, z: 4 }, { x: 8, z: -4 }, { x: 4, z: 8 }, { x: -4, z: -8 }]) {
      const rock = createRock(0.4, '#607d8b');
      rock.position.set(rp.x, 0, rp.z);
      this.scene.add(rock);
    }

    // Banners on obelisks
    for (const bp of [{ x: -7, z: -17 }, { x: 7, z: 17 }, { x: -17, z: 7 }, { x: 17, z: -7 }]) {
      const banner = createBanner('#ff6d00', 0.6, 0.9);
      banner.position.set(bp.x, 4, bp.z);
      this.scene.add(banner);
    }
  }

  updateWater(elapsed: number): void {
    for (const water of this.waterMeshes) {
      const baseY = water.userData.baseY ?? water.position.y;
      water.userData.baseY = baseY;
      water.position.y = baseY + Math.sin(elapsed * 3) * 0.02;
    }
  }

  /** Push position out of any collision box. Returns corrected x,z. Height-aware: allows standing on top. */
  resolveCollision(x: number, z: number, radius: number, playerY: number = 0): { x: number; z: number } {
    for (const box of this.collisionBoxes) {
      if (playerY >= box.height - 0.1) continue;

      const minX = box.min.x - radius;
      const maxX = box.max.x + radius;
      const minZ = box.min.y - radius;
      const maxZ = box.max.y + radius;

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

  /** Get the top of any collision box the player is above. */
  getBlockHeight(x: number, z: number, radius: number, playerY: number): number {
    let maxHeight = 0;
    for (const box of this.collisionBoxes) {
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

  /** Get the ground height from slide ramps/ladders at this position. */
  getSlideInfo(x: number, z: number): { height: number; slideForceZ: number } | null {
    for (const ramp of this.slideRamps) {
      if (x >= ramp.minX && x <= ramp.maxX && z >= ramp.startZ && z <= ramp.endZ) {
        const t = (z - ramp.startZ) / (ramp.endZ - ramp.startZ);
        const height = ramp.topHeight * (1 - t) + ramp.bottomHeight * t;
        return { height, slideForceZ: ramp.slideForceZ };
      }
    }

    for (const ladder of this.ladderRamps) {
      if (x >= ladder.minX && x <= ladder.maxX && z >= ladder.minZ && z <= ladder.maxZ) {
        let t: number;
        if (ladder.direction === 'x') {
          t = (x - ladder.minX) / (ladder.maxX - ladder.minX);
        } else {
          t = (z - ladder.minZ) / (ladder.maxZ - ladder.minZ);
        }
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
