import * as THREE from 'three';
import type { WeaponId } from '@watergun/shared';

/**
 * First-person viewmodel water gun — always visible in bottom-right of screen,
 * like Counter-Strike weapon view. Attached directly to the camera.
 * Each weapon has a unique 3D model built from box/cylinder geometry.
 */
export class ViewmodelGun {
  group: THREE.Group;
  private weaponGroup: THREE.Group;
  private bobTime = 0;
  private recoilAmount = 0;
  private basePosition: THREE.Vector3;
  private currentWeapon: WeaponId = 'water_pistol';

  constructor() {
    this.group = new THREE.Group();
    this.weaponGroup = new THREE.Group();
    this.group.add(this.weaponGroup);

    this.basePosition = new THREE.Vector3(0.28, -0.22, -0.45);
    this.group.position.copy(this.basePosition);
    this.group.rotation.set(0, -0.05, 0);

    this.buildWeapon('water_pistol');
  }

  setWeapon(weaponId: WeaponId): void {
    if (weaponId === this.currentWeapon) return;
    this.currentWeapon = weaponId;
    this.buildWeapon(weaponId);
  }

  private buildWeapon(weaponId: WeaponId): void {
    // Clear previous weapon meshes
    while (this.weaponGroup.children.length > 0) {
      const child = this.weaponGroup.children[0];
      this.weaponGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    // Build hand + arm (shared across all weapons)
    this.buildArm();

    // Build weapon-specific model
    switch (weaponId) {
      case 'water_pistol': this.buildWaterPistol(); break;
      case 'super_soaker': this.buildSuperSoaker(); break;
      case 'splash_shotgun': this.buildSplashShotgun(); break;
      case 'water_sniper': this.buildWaterSniper(); break;
      case 'bubble_blaster': this.buildBubbleBlaster(); break;
      case 'squirt_minigun': this.buildSquirtMinigun(); break;
      case 'water_balloon': this.buildWaterBalloon(); break;
    }

    // Apply render-on-top to all meshes
    this.weaponGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.renderOrder = 999;
        (child.material as THREE.Material).depthTest = false;
      }
    });
  }

  private buildArm(): void {
    const handMat = new THREE.MeshStandardMaterial({ color: '#ffcc99' });
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.18), handMat);
    hand.position.set(0, -0.08, 0.05);
    this.weaponGroup.add(hand);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.12), handMat.clone());
    forearm.position.set(0.02, -0.22, 0.12);
    forearm.rotation.x = 0.3;
    this.weaponGroup.add(forearm);

    const sleeveMat = new THREE.MeshStandardMaterial({ color: '#4fc3f7' });
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.14), sleeveMat);
    sleeve.position.set(0.02, -0.32, 0.18);
    sleeve.rotation.x = 0.3;
    this.weaponGroup.add(sleeve);
  }

  private addMesh(geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, opts?: { transparent?: boolean; opacity?: number; metalness?: number; roughness?: number; rotX?: number; rotY?: number; rotZ?: number }): THREE.Mesh {
    const mat = new THREE.MeshStandardMaterial({
      color,
      transparent: opts?.transparent ?? false,
      opacity: opts?.opacity ?? 1,
      metalness: opts?.metalness ?? 0,
      roughness: opts?.roughness ?? 0.6,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (opts?.rotX) mesh.rotation.x = opts.rotX;
    if (opts?.rotY) mesh.rotation.y = opts.rotY;
    if (opts?.rotZ) mesh.rotation.z = opts.rotZ;
    this.weaponGroup.add(mesh);
    return mesh;
  }

  // ──────────────────────────────────────────────
  // WATER PISTOL — small, compact pistol shape
  // ──────────────────────────────────────────────
  private buildWaterPistol(): void {
    // Body — short barrel
    this.addMesh(new THREE.BoxGeometry(0.08, 0.08, 0.4), '#ff6f00', 0, 0, -0.12);
    // Handle
    this.addMesh(new THREE.BoxGeometry(0.07, 0.14, 0.07), '#e65100', 0, -0.1, 0.05, { rotX: 0.15 });
    // Small water tank on top
    this.addMesh(new THREE.BoxGeometry(0.1, 0.14, 0.14), '#29b6f6', 0, 0.09, -0.04, { transparent: true, opacity: 0.75 });
    // Pump slide
    this.addMesh(new THREE.BoxGeometry(0.04, 0.04, 0.16), '#ff8f00', 0, 0.1, -0.18);
    // Nozzle tip
    this.addMesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), '#e65100', 0, 0, -0.37);
    // Nozzle ring
    this.addMesh(new THREE.BoxGeometry(0.065, 0.065, 0.02), '#bdbdbd', 0, 0, -0.42, { metalness: 0.5 });
  }

  // ──────────────────────────────────────────────
  // SUPER SOAKER — big pump-action with large tank
  // ──────────────────────────────────────────────
  private buildSuperSoaker(): void {
    // Thick barrel
    this.addMesh(new THREE.BoxGeometry(0.1, 0.1, 0.55), '#1565c0', 0, 0, -0.18);
    // Under-barrel pump rail
    this.addMesh(new THREE.BoxGeometry(0.06, 0.04, 0.35), '#0d47a1', 0, -0.06, -0.12);
    // Pump handle (slides)
    this.addMesh(new THREE.BoxGeometry(0.08, 0.06, 0.1), '#bbdefb', 0, -0.06, -0.05);
    // Handle / grip
    this.addMesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), '#0d47a1', 0, -0.13, 0.06, { rotX: 0.2 });
    // Big water tank — large box on top
    this.addMesh(new THREE.BoxGeometry(0.14, 0.18, 0.22), '#0d47a1', 0, 0.13, -0.06, { transparent: true, opacity: 0.7 });
    // Tank cap
    this.addMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8), '#bbdefb', 0, 0.24, -0.06, { metalness: 0.6 });
    // Wide nozzle
    this.addMesh(new THREE.BoxGeometry(0.08, 0.08, 0.06), '#1565c0', 0, 0, -0.49);
    this.addMesh(new THREE.CylinderGeometry(0.04, 0.05, 0.05, 8), '#bdbdbd', 0, 0, -0.53, { rotX: Math.PI / 2, metalness: 0.5 });
    // Shoulder stock
    this.addMesh(new THREE.BoxGeometry(0.06, 0.08, 0.14), '#0d47a1', 0, -0.02, 0.18);
    this.addMesh(new THREE.BoxGeometry(0.06, 0.12, 0.04), '#0d47a1', 0, -0.06, 0.26);
  }

  // ──────────────────────────────────────────────
  // SPLASH SHOTGUN — wide-bore, double barrel
  // ──────────────────────────────────────────────
  private buildSplashShotgun(): void {
    // Two side-by-side barrels
    this.addMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), '#00838f', -0.03, 0, -0.2, { rotX: Math.PI / 2 });
    this.addMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), '#00838f', 0.03, 0, -0.2, { rotX: Math.PI / 2 });
    // Barrel binder
    this.addMesh(new THREE.BoxGeometry(0.1, 0.04, 0.04), '#005f56', 0, 0, -0.35);
    this.addMesh(new THREE.BoxGeometry(0.1, 0.04, 0.04), '#005f56', 0, 0, -0.15);
    // Wide muzzle cap
    this.addMesh(new THREE.BoxGeometry(0.12, 0.1, 0.03), '#00e5ff', 0, 0, -0.47, { metalness: 0.3 });
    // Pump forestock
    this.addMesh(new THREE.BoxGeometry(0.1, 0.08, 0.12), '#00838f', 0, -0.05, -0.05);
    // Handle
    this.addMesh(new THREE.BoxGeometry(0.07, 0.16, 0.07), '#005f56', 0, -0.12, 0.06, { rotX: 0.15 });
    // Water tank — flat and wide, under the barrels
    this.addMesh(new THREE.BoxGeometry(0.12, 0.06, 0.18), '#00e5ff', 0, 0.06, -0.1, { transparent: true, opacity: 0.7 });
    // Stock
    this.addMesh(new THREE.BoxGeometry(0.07, 0.07, 0.16), '#00838f', 0, -0.01, 0.2);
  }

  // ──────────────────────────────────────────────
  // WATER SNIPER — long, thin, scoped rifle
  // ──────────────────────────────────────────────
  private buildWaterSniper(): void {
    // Very long thin barrel
    this.addMesh(new THREE.BoxGeometry(0.05, 0.05, 0.7), '#607d8b', 0, 0, -0.25);
    // Scope — cylinder on top
    this.addMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8), '#37474f', 0, 0.08, -0.2, { rotX: Math.PI / 2 });
    // Scope lenses (front + back)
    this.addMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 8), '#bbdefb', 0, 0.08, -0.31, { rotX: Math.PI / 2, metalness: 0.8 });
    this.addMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 8), '#bbdefb', 0, 0.08, -0.09, { rotX: Math.PI / 2, metalness: 0.8 });
    // Scope mount
    this.addMesh(new THREE.BoxGeometry(0.02, 0.04, 0.04), '#455a64', 0, 0.05, -0.15);
    this.addMesh(new THREE.BoxGeometry(0.02, 0.04, 0.04), '#455a64', 0, 0.05, -0.25);
    // Slim handle
    this.addMesh(new THREE.BoxGeometry(0.06, 0.15, 0.06), '#455a64', 0, -0.1, 0.06, { rotX: 0.15 });
    // Water tank — slim tube alongside barrel
    this.addMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.25, 8), '#eceff1', 0.04, -0.01, -0.1, { rotX: Math.PI / 2, transparent: true, opacity: 0.7 });
    // Muzzle tip
    this.addMesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), '#90a4ae', 0, 0, -0.63);
    this.addMesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), '#cfd8dc', 0, 0, -0.62, { metalness: 0.5 });
    // Bipod legs (folded back)
    this.addMesh(new THREE.BoxGeometry(0.015, 0.1, 0.015), '#455a64', -0.03, -0.08, -0.4, { rotX: 0.3 });
    this.addMesh(new THREE.BoxGeometry(0.015, 0.1, 0.015), '#455a64', 0.03, -0.08, -0.4, { rotX: 0.3 });
    // Long stock
    this.addMesh(new THREE.BoxGeometry(0.05, 0.06, 0.2), '#607d8b', 0, 0, 0.22);
    this.addMesh(new THREE.BoxGeometry(0.06, 0.08, 0.04), '#546e7a', 0, -0.02, 0.34);
  }

  // ──────────────────────────────────────────────
  // BUBBLE BLASTER — round, bubbly, toy-like
  // ──────────────────────────────────────────────
  private buildBubbleBlaster(): void {
    // Round bulbous body
    this.addMesh(new THREE.SphereGeometry(0.08, 10, 10), '#9c27b0', 0, 0, -0.05);
    // Flared barrel — cone shape
    this.addMesh(new THREE.CylinderGeometry(0.03, 0.06, 0.3, 10), '#ab47bc', 0, 0, -0.26, { rotX: Math.PI / 2 });
    // Wide bell muzzle
    this.addMesh(new THREE.CylinderGeometry(0.07, 0.04, 0.06, 10), '#e040fb', 0, 0, -0.42, { rotX: Math.PI / 2 });
    // Bubble tank — transparent sphere on top
    this.addMesh(new THREE.SphereGeometry(0.07, 10, 10), '#e040fb', 0, 0.1, -0.05, { transparent: true, opacity: 0.5 });
    // Small bubbles decoration on tank
    this.addMesh(new THREE.SphereGeometry(0.02, 6, 6), '#f48fb1', 0.04, 0.15, -0.02, { transparent: true, opacity: 0.6 });
    this.addMesh(new THREE.SphereGeometry(0.015, 6, 6), '#ce93d8', -0.03, 0.16, -0.07, { transparent: true, opacity: 0.6 });
    this.addMesh(new THREE.SphereGeometry(0.018, 6, 6), '#f48fb1', 0.01, 0.17, -0.04, { transparent: true, opacity: 0.6 });
    // Round handle
    this.addMesh(new THREE.CylinderGeometry(0.03, 0.04, 0.14, 8), '#7b1fa2', 0, -0.1, 0.04, { rotX: 0, rotZ: 0 });
    // Trigger guard — small ring
    this.addMesh(new THREE.BoxGeometry(0.06, 0.02, 0.06), '#7b1fa2', 0, -0.04, 0.01);
  }

  // ──────────────────────────────────────────────
  // SQUIRT MINI-GUN — multi-barrel rotary gun
  // ──────────────────────────────────────────────
  private buildSquirtMinigun(): void {
    // Central barrel hub
    this.addMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10), '#f9a825', 0, 0, -0.35, { rotX: Math.PI / 2, metalness: 0.4 });
    // 4 rotating barrels around the hub
    const barrelOffsets = [
      [0.035, 0.035], [-0.035, 0.035], [0.035, -0.035], [-0.035, -0.035],
    ];
    for (const [ox, oy] of barrelOffsets) {
      this.addMesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), '#fdd835', ox, oy, -0.2, { rotX: Math.PI / 2, metalness: 0.3 });
    }
    // Barrel shroud
    this.addMesh(new THREE.CylinderGeometry(0.07, 0.05, 0.06, 10), '#e0a800', 0, 0, -0.12, { rotX: Math.PI / 2, metalness: 0.3 });
    // Main body box behind the barrels
    this.addMesh(new THREE.BoxGeometry(0.12, 0.12, 0.2), '#f9a825', 0, 0, 0);
    // Handle — vertical grip
    this.addMesh(new THREE.BoxGeometry(0.07, 0.16, 0.07), '#e65100', 0, -0.12, 0.03, { rotX: 0.1 });
    // Top handle / carry grip
    this.addMesh(new THREE.BoxGeometry(0.04, 0.04, 0.14), '#fdd835', 0, 0.09, -0.02);
    this.addMesh(new THREE.BoxGeometry(0.04, 0.06, 0.02), '#fdd835', 0, 0.07, -0.09);
    this.addMesh(new THREE.BoxGeometry(0.04, 0.06, 0.02), '#fdd835', 0, 0.07, 0.05);
    // Ammo tank — big cylinder on the side
    this.addMesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 8), '#ffee58', 0.08, -0.04, -0.02, { transparent: true, opacity: 0.7 });
    // Feed tube from tank to body
    this.addMesh(new THREE.CylinderGeometry(0.01, 0.01, 0.06, 6), '#fbc02d', 0.06, 0, -0.02, { rotZ: Math.PI / 2 });
  }

  // ──────────────────────────────────────────────
  // WATER BALLOON — slingshot launcher
  // ──────────────────────────────────────────────
  private buildWaterBalloon(): void {
    // Slingshot Y-frame handle
    this.addMesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), '#5d4037', 0, -0.06, 0);
    // Y fork — left prong
    this.addMesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), '#5d4037', -0.05, 0.1, -0.02, { rotZ: -0.35 });
    // Y fork — right prong
    this.addMesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), '#5d4037', 0.05, 0.1, -0.02, { rotZ: 0.35 });
    // Elastic bands (left + right)
    this.addMesh(new THREE.BoxGeometry(0.01, 0.01, 0.16), '#e0e0e0', -0.07, 0.16, -0.1);
    this.addMesh(new THREE.BoxGeometry(0.01, 0.01, 0.16), '#e0e0e0', 0.07, 0.16, -0.1);
    // Pouch (center, connecting bands)
    this.addMesh(new THREE.BoxGeometry(0.06, 0.02, 0.06), '#795548', 0, 0.15, -0.18);
    // Water balloon sitting in the pouch
    this.addMesh(new THREE.SphereGeometry(0.06, 10, 10), '#66bb6a', 0, 0.06, -0.18, { transparent: true, opacity: 0.85 });
    // Balloon knot
    this.addMesh(new THREE.SphereGeometry(0.015, 6, 6), '#388e3c', 0, 0.12, -0.18);
    // Water sloshing inside (inner sphere, slightly offset)
    this.addMesh(new THREE.SphereGeometry(0.04, 8, 8), '#81c784', 0, 0.05, -0.19, { transparent: true, opacity: 0.5 });
    // Grip wrap on handle
    this.addMesh(new THREE.BoxGeometry(0.055, 0.08, 0.055), '#4e342e', 0, -0.1, 0);
  }

  update(dt: number, isMoving: boolean, isShooting: boolean): void {
    if (isMoving) {
      this.bobTime += dt * 8;
    } else {
      this.bobTime += dt * 1.5;
    }

    const bobX = isMoving ? Math.sin(this.bobTime) * 0.008 : Math.sin(this.bobTime) * 0.002;
    const bobY = isMoving ? Math.abs(Math.cos(this.bobTime)) * 0.01 : Math.sin(this.bobTime * 0.7) * 0.002;

    if (isShooting) {
      this.recoilAmount = Math.min(this.recoilAmount + dt * 15, 1);
    } else {
      this.recoilAmount = Math.max(this.recoilAmount - dt * 8, 0);
    }

    const recoilZ = this.recoilAmount * 0.03;
    const recoilRot = this.recoilAmount * 0.06;

    this.group.position.set(
      this.basePosition.x + bobX,
      this.basePosition.y + bobY,
      this.basePosition.z + recoilZ
    );
    this.group.rotation.x = recoilRot;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
