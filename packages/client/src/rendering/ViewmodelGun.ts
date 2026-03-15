import * as THREE from 'three';

/**
 * First-person viewmodel water gun — always visible in bottom-right of screen,
 * like Counter-Strike weapon view. Attached directly to the camera.
 */
export class ViewmodelGun {
  group: THREE.Group;
  private bobTime = 0;
  private recoilAmount = 0;
  private basePosition: THREE.Vector3;

  constructor() {
    this.group = new THREE.Group();

    // Hand / grip area (skin-colored block = the hand holding it)
    const handMat = new THREE.MeshStandardMaterial({ color: '#ffcc99' });
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.18), handMat);
    hand.position.set(0, -0.08, 0.05);
    this.group.add(hand);

    // Forearm visible below
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.12), handMat);
    forearm.position.set(0.02, -0.22, 0.12);
    forearm.rotation.x = 0.3;
    this.group.add(forearm);

    // Sleeve (shirt color)
    const sleeveMat = new THREE.MeshStandardMaterial({ color: '#4fc3f7' });
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.14), sleeveMat);
    sleeve.position.set(0.02, -0.32, 0.18);
    sleeve.rotation.x = 0.3;
    this.group.add(sleeve);

    // Gun body (main barrel)
    const gunBodyMat = new THREE.MeshStandardMaterial({ color: '#ff6f00' });
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.4), gunBodyMat);
    gunBody.position.set(0, 0, -0.12);
    this.group.add(gunBody);

    // Gun handle
    const handleMat = new THREE.MeshStandardMaterial({ color: '#e65100' });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.07), handleMat);
    handle.position.set(0, -0.1, 0.05);
    handle.rotation.x = 0.15;
    this.group.add(handle);

    // Water tank on top
    const tankMat = new THREE.MeshStandardMaterial({
      color: '#29b6f6',
      transparent: true,
      opacity: 0.75,
    });
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.14), tankMat);
    tank.position.set(0, 0.09, -0.04);
    this.group.add(tank);

    // Pump on top
    const pumpMat = new THREE.MeshStandardMaterial({ color: '#ff8f00' });
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.16), pumpMat);
    pump.position.set(0, 0.1, -0.18);
    this.group.add(pump);

    // Nozzle tip
    const nozzleMat = new THREE.MeshStandardMaterial({ color: '#e65100' });
    const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), nozzleMat);
    nozzle.position.set(0, 0, -0.37);
    this.group.add(nozzle);

    // Nozzle ring
    const ringMat = new THREE.MeshStandardMaterial({ color: '#bdbdbd' });
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.065, 0.02), ringMat);
    ring.position.set(0, 0, -0.42);
    this.group.add(ring);

    // Position: bottom-right of screen, angled like CS
    this.basePosition = new THREE.Vector3(0.28, -0.22, -0.45);
    this.group.position.copy(this.basePosition);
    this.group.rotation.set(0, -0.05, 0); // Slight angle

    // Render on top of everything
    this.group.renderOrder = 999;
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.renderOrder = 999;
        (child.material as THREE.Material).depthTest = false;
      }
    });
  }

  update(dt: number, isMoving: boolean, isShooting: boolean): void {
    // Walk bob
    if (isMoving) {
      this.bobTime += dt * 8;
    } else {
      // Gentle idle sway
      this.bobTime += dt * 1.5;
    }

    const bobX = isMoving ? Math.sin(this.bobTime) * 0.008 : Math.sin(this.bobTime) * 0.002;
    const bobY = isMoving ? Math.abs(Math.cos(this.bobTime)) * 0.01 : Math.sin(this.bobTime * 0.7) * 0.002;

    // Recoil
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
