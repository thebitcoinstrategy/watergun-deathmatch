import * as THREE from 'three';

interface WaterProjectile {
  mesh: THREE.Mesh;
  trail: THREE.Line;
  trailPositions: THREE.Vector3[];
  velocity: THREE.Vector3;
  age: number;
  maxAge: number;
  ownerId: string; // 'player' or bot name
}

export class WaterEffect {
  private projectiles: WaterProjectile[] = [];
  private scene: THREE.Scene;
  private splashParticles: THREE.Points[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  shoot(origin: THREE.Vector3, direction: THREE.Vector3, speed: number = 30, ownerId: string = 'player'): void {
    const geo = new THREE.SphereGeometry(0.1, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: '#29b6f6',
      transparent: true,
      opacity: 0.85,
      emissive: '#0288d1',
      emissiveIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin);
    mesh.castShadow = true;
    this.scene.add(mesh);

    // Create trail
    const trailGeo = new THREE.BufferGeometry();
    const trailPositions: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      trailPositions.push(origin.clone());
    }
    trailGeo.setFromPoints(trailPositions);
    const trailMat = new THREE.LineBasicMaterial({
      color: '#4fc3f7',
      transparent: true,
      opacity: 0.5,
      linewidth: 2,
    });
    const trail = new THREE.Line(trailGeo, trailMat);
    this.scene.add(trail);

    this.projectiles.push({
      mesh,
      trail,
      trailPositions,
      velocity: direction.clone().multiplyScalar(speed),
      age: 0,
      maxAge: 2,
      ownerId,
    });
  }

  update(dt: number): { hitPosition: THREE.Vector3; ownerId: string }[] {
    const groundHits: { hitPosition: THREE.Vector3; ownerId: string }[] = [];

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
      p.velocity.y -= 9.8 * dt;

      // Update trail
      p.trailPositions.pop();
      p.trailPositions.unshift(p.mesh.position.clone());
      p.trail.geometry.setFromPoints(p.trailPositions);

      // Fade trail as projectile ages
      const trailMat = p.trail.material as THREE.LineBasicMaterial;
      trailMat.opacity = 0.5 * (1 - p.age / p.maxAge);

      // Hit ground or expired
      if (p.mesh.position.y <= 0 || p.age >= p.maxAge) {
        if (p.mesh.position.y <= 0.5) {
          this.createSplash(p.mesh.position);
        }
        groundHits.push({ hitPosition: p.mesh.position.clone(), ownerId: p.ownerId });
        this.removeProjectile(i);
      }
    }

    // Update splash particles
    for (let i = this.splashParticles.length - 1; i >= 0; i--) {
      const splash = this.splashParticles[i];
      splash.userData.age += dt;

      // Animate particles outward and up
      const positions = splash.geometry.attributes.position;
      for (let j = 0; j < positions.count; j++) {
        const vy = splash.userData.velocities[j];
        positions.setY(j, positions.getY(j) + vy * dt);
        splash.userData.velocities[j] -= 5 * dt;
      }
      positions.needsUpdate = true;

      const mat = splash.material as THREE.PointsMaterial;
      mat.opacity = 1 - splash.userData.age / 0.6;
      mat.size = 0.2 * (1 - splash.userData.age / 0.6);

      if (splash.userData.age >= 0.6) {
        this.scene.remove(splash);
        splash.geometry.dispose();
        mat.dispose();
        this.splashParticles.splice(i, 1);
      }
    }

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
      this.createSplash(this.projectiles[index].mesh.position);
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

  private createSplash(position: THREE.Vector3): void {
    const count = 12;
    const positions = new Float32Array(count * 3);
    const velocities: number[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 1] = Math.max(position.y, 0.05) + Math.random() * 0.1;
      positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.3;
      velocities.push(2 + Math.random() * 3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: '#4fc3f7',
      size: 0.2,
      transparent: true,
      opacity: 1,
    });

    const points = new THREE.Points(geo, mat);
    points.userData = { age: 0, velocities };
    this.scene.add(points);
    this.splashParticles.push(points);
  }
}
