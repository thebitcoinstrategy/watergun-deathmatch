import * as THREE from 'three';

export interface ProjectileOptions {
  radius?: number;
  color?: string;
  trailColor?: string;
  emissiveColor?: string;
  gravity?: number;
  maxAge?: number;
}

interface WaterProjectile {
  mesh: THREE.Mesh;
  trail: THREE.Line;
  trailPositions: THREE.Vector3[];
  velocity: THREE.Vector3;
  age: number;
  maxAge: number;
  gravity: number;
  ownerId: string; // 'player' or bot name
  dripTimer: number;
}

/** A generic particle with position, velocity, lifetime */
interface Particle {
  points: THREE.Points;
  age: number;
  maxAge: number;
  velocitiesX: number[];
  velocitiesY: number[];
  velocitiesZ: number[];
  gravity: number;
  fadeStart: number; // fraction of maxAge when fading begins
}

/** A water droplet mesh that falls with gravity */
interface Droplet {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
}

/** A ripple ring that expands outward on water/ground */
interface Ripple {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
  growRate: number;
}

/** Mist/spray sprite that drifts */
interface MistSprite {
  sprite: THREE.Sprite;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
}

export class WaterEffect {
  private projectiles: WaterProjectile[] = [];
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private droplets: Droplet[] = [];
  private ripples: Ripple[] = [];
  private mists: MistSprite[] = [];

  // Shared geometries/materials for performance
  private dropletGeo: THREE.SphereGeometry;
  private rippleGeo: THREE.RingGeometry;
  private mistTexture: THREE.Texture;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.dropletGeo = new THREE.SphereGeometry(0.04, 4, 4);
    this.rippleGeo = new THREE.RingGeometry(0.05, 0.15, 16);
    this.rippleGeo.rotateX(-Math.PI / 2);
    this.mistTexture = this.createMistTexture();
  }

  private createMistTexture(): THREE.Texture {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(0.5, 'rgba(200,230,255,0.3)');
    gradient.addColorStop(1, 'rgba(200,230,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  shoot(origin: THREE.Vector3, direction: THREE.Vector3, speed: number = 30, ownerId: string = 'player', options?: ProjectileOptions): void {
    const radius = options?.radius ?? 0.1;
    const color = options?.color ?? '#29b6f6';
    const trailColor = options?.trailColor ?? '#4fc3f7';
    const emissiveColor = options?.emissiveColor ?? '#0288d1';
    const gravity = options?.gravity ?? 9.8;
    const maxAge = options?.maxAge ?? 2;

    const geo = new THREE.SphereGeometry(radius, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      emissive: emissiveColor,
      emissiveIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin);
    mesh.castShadow = true;
    this.scene.add(mesh);

    // Create trail (longer, 12 segments)
    const trailGeo = new THREE.BufferGeometry();
    const trailPositions: THREE.Vector3[] = [];
    for (let i = 0; i < 12; i++) {
      trailPositions.push(origin.clone());
    }
    trailGeo.setFromPoints(trailPositions);
    const trailMat = new THREE.LineBasicMaterial({
      color: trailColor,
      transparent: true,
      opacity: 0.6,
      linewidth: 2,
    });
    const trail = new THREE.Line(trailGeo, trailMat);
    this.scene.add(trail);

    // Spawn muzzle mist spray at origin
    this.spawnMist(origin, direction, 3);

    this.projectiles.push({
      mesh,
      trail,
      trailPositions,
      velocity: direction.clone().multiplyScalar(speed),
      age: 0,
      maxAge,
      gravity,
      ownerId,
      dripTimer: 0,
    });
  }

  /** Create a big hit splash at a position (call on player/bot hit) */
  createHitSplash(position: THREE.Vector3): void {
    // Burst of particles
    this.createSplashParticles(position, 20, '#4fc3f7', 0.25, 4, 0.8);
    // Droplets flying outward
    this.spawnDroplets(position, 8, 3);
    // Mist cloud
    this.spawnMist(position, new THREE.Vector3(0, 1, 0), 5);
    // Ground ripple
    if (position.y <= 1) {
      this.spawnRipple(new THREE.Vector3(position.x, 0.02, position.z), 1.5);
    }
  }

  update(dt: number): { hitPosition: THREE.Vector3; ownerId: string }[] {
    const groundHits: { hitPosition: THREE.Vector3; ownerId: string }[] = [];

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
      p.velocity.y -= p.gravity * dt;

      // Update trail
      p.trailPositions.pop();
      p.trailPositions.unshift(p.mesh.position.clone());
      p.trail.geometry.setFromPoints(p.trailPositions);

      // Fade trail as projectile ages
      const trailMat = p.trail.material as THREE.LineBasicMaterial;
      trailMat.opacity = 0.6 * (1 - p.age / p.maxAge);

      // Drip droplets while flying
      p.dripTimer += dt;
      if (p.dripTimer > 0.06) {
        p.dripTimer = 0;
        this.spawnDroplets(p.mesh.position, 1, 1);
      }

      // Hit ground or expired
      if (p.mesh.position.y <= 0 || p.age >= p.maxAge) {
        if (p.mesh.position.y <= 0.5) {
          this.createGroundSplash(p.mesh.position);
        }
        groundHits.push({ hitPosition: p.mesh.position.clone(), ownerId: p.ownerId });
        this.removeProjectile(i);
      }
    }

    // Update splash particles
    this.updateParticles(dt);

    // Update droplets
    this.updateDroplets(dt);

    // Update ripples
    this.updateRipples(dt);

    // Update mist sprites
    this.updateMists(dt);

    return groundHits;
  }

  getProjectiles(): { position: THREE.Vector3; ownerId: string }[] {
    return this.projectiles.map(p => ({
      position: p.mesh.position.clone(),
      ownerId: p.ownerId,
    }));
  }

  removeProjectileAt(index: number): void {
    if (index >= 0 && index < this.projectiles.length) {
      const pos = this.projectiles[index].mesh.position;
      // Big splash on hit removal
      this.createSplashParticles(pos, 16, '#4fc3f7', 0.2, 3.5, 0.7);
      this.spawnDroplets(pos, 5, 2.5);
      if (pos.y <= 1) {
        this.spawnRipple(new THREE.Vector3(pos.x, 0.02, pos.z), 1.0);
      }
      this.removeProjectile(index);
    }
  }

  private removeProjectile(index: number): void {
    const p = this.projectiles[index];
    this.scene.remove(p.mesh);
    this.scene.remove(p.trail);
    p.mesh.geometry.dispose();
    (p.mesh.material as THREE.Material).dispose();
    p.trail.geometry.dispose();
    (p.trail.material as THREE.Material).dispose();
    this.projectiles.splice(index, 1);
  }

  // ===================== SPLASH PARTICLES =====================

  private createGroundSplash(position: THREE.Vector3): void {
    // Main upward burst
    this.createSplashParticles(position, 18, '#4fc3f7', 0.22, 4, 0.8);
    // Extra fine mist
    this.createSplashParticles(position, 10, '#b3e5fc', 0.1, 2, 0.5);
    // Droplets
    this.spawnDroplets(position, 6, 2.5);
    // Ripple on ground
    this.spawnRipple(new THREE.Vector3(position.x, 0.02, position.z), 1.2);
    // Mist spray
    this.spawnMist(position, new THREE.Vector3(0, 1, 0), 3);
  }

  private createSplashParticles(
    position: THREE.Vector3,
    count: number,
    color: string,
    size: number,
    maxVelY: number,
    maxAge: number
  ): void {
    const positions = new Float32Array(count * 3);
    const velocitiesX: number[] = [];
    const velocitiesY: number[] = [];
    const velocitiesZ: number[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x + (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 1] = Math.max(position.y, 0.05) + Math.random() * 0.1;
      positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.4;
      velocitiesX.push((Math.random() - 0.5) * 3);
      velocitiesY.push(1.5 + Math.random() * maxVelY);
      velocitiesZ.push((Math.random() - 0.5) * 3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.particles.push({
      points,
      age: 0,
      maxAge,
      velocitiesX,
      velocitiesY,
      velocitiesZ,
      gravity: 6,
      fadeStart: 0.3,
    });
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;

      const positions = p.points.geometry.attributes.position;
      for (let j = 0; j < positions.count; j++) {
        positions.setX(j, positions.getX(j) + p.velocitiesX[j] * dt);
        positions.setY(j, positions.getY(j) + p.velocitiesY[j] * dt);
        positions.setZ(j, positions.getZ(j) + p.velocitiesZ[j] * dt);
        p.velocitiesY[j] -= p.gravity * dt;
      }
      positions.needsUpdate = true;

      const mat = p.points.material as THREE.PointsMaterial;
      const t = p.age / p.maxAge;
      if (t > p.fadeStart) {
        mat.opacity = 1 - (t - p.fadeStart) / (1 - p.fadeStart);
      }
      mat.size *= (1 - dt * 0.5); // Shrink over time

      if (p.age >= p.maxAge) {
        this.scene.remove(p.points);
        p.points.geometry.dispose();
        mat.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  // ===================== DROPLETS =====================

  private spawnDroplets(position: THREE.Vector3, count: number, force: number): void {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: '#81d4fa',
        transparent: true,
        opacity: 0.7,
        emissive: '#29b6f6',
        emissiveIntensity: 0.2,
      });
      const mesh = new THREE.Mesh(this.dropletGeo, mat);
      mesh.position.set(
        position.x + (Math.random() - 0.5) * 0.2,
        Math.max(position.y, 0.05),
        position.z + (Math.random() - 0.5) * 0.2
      );
      this.scene.add(mesh);
      this.droplets.push({
        mesh,
        vx: (Math.random() - 0.5) * force,
        vy: 1 + Math.random() * force,
        vz: (Math.random() - 0.5) * force,
        age: 0,
        maxAge: 0.5 + Math.random() * 0.4,
      });
    }
  }

  private updateDroplets(dt: number): void {
    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const d = this.droplets[i];
      d.age += dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      d.vy -= 12 * dt; // Gravity

      const mat = d.mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.7 * (1 - d.age / d.maxAge);

      if (d.age >= d.maxAge || d.mesh.position.y < 0) {
        this.scene.remove(d.mesh);
        mat.dispose();
        this.droplets.splice(i, 1);
      }
    }
  }

  // ===================== RIPPLES =====================

  private spawnRipple(position: THREE.Vector3, maxScale: number): void {
    const mat = new THREE.MeshBasicMaterial({
      color: '#80deea',
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.rippleGeo, mat);
    mesh.position.copy(position);
    mesh.scale.set(0.3, 0.3, 0.3);
    this.scene.add(mesh);
    this.ripples.push({
      mesh,
      age: 0,
      maxAge: 0.8,
      growRate: maxScale / 0.8,
    });
  }

  private updateRipples(dt: number): void {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.age += dt;
      const s = r.mesh.scale.x + r.growRate * dt;
      r.mesh.scale.set(s, s, s);
      const mat = r.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5 * (1 - r.age / r.maxAge);

      if (r.age >= r.maxAge) {
        this.scene.remove(r.mesh);
        mat.dispose();
        this.ripples.splice(i, 1);
      }
    }
  }

  // ===================== MIST SPRITES =====================

  private spawnMist(position: THREE.Vector3, direction: THREE.Vector3, count: number): void {
    for (let i = 0; i < count; i++) {
      const spriteMat = new THREE.SpriteMaterial({
        map: this.mistTexture,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        color: '#b3e5fc',
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(
        position.x + (Math.random() - 0.5) * 0.3,
        Math.max(position.y, 0.1) + Math.random() * 0.2,
        position.z + (Math.random() - 0.5) * 0.3
      );
      const scale = 0.3 + Math.random() * 0.3;
      sprite.scale.set(scale, scale, 1);
      this.scene.add(sprite);
      this.mists.push({
        sprite,
        vx: direction.x * 0.5 + (Math.random() - 0.5) * 1.5,
        vy: direction.y * 0.8 + Math.random() * 1,
        vz: direction.z * 0.5 + (Math.random() - 0.5) * 1.5,
        age: 0,
        maxAge: 0.4 + Math.random() * 0.4,
      });
    }
  }

  private updateMists(dt: number): void {
    for (let i = this.mists.length - 1; i >= 0; i--) {
      const m = this.mists[i];
      m.age += dt;
      m.sprite.position.x += m.vx * dt;
      m.sprite.position.y += m.vy * dt;
      m.sprite.position.z += m.vz * dt;
      m.vy -= 2 * dt;
      // Grow and fade
      const s = m.sprite.scale.x + dt * 1.5;
      m.sprite.scale.set(s, s, 1);
      const mat = m.sprite.material as THREE.SpriteMaterial;
      mat.opacity = 0.35 * (1 - m.age / m.maxAge);

      if (m.age >= m.maxAge) {
        this.scene.remove(m.sprite);
        mat.dispose();
        this.mists.splice(i, 1);
      }
    }
  }
}
