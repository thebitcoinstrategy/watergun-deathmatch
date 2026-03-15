import * as THREE from 'three';

export class ThirdPersonCam {
  camera: THREE.PerspectiveCamera;
  private pitch = 0.3; // Slightly looking down
  private yaw = 0;
  private distance = 5;
  private offset = new THREE.Vector3(0.8, 2, 0); // Slightly right and up (over-shoulder)

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  handleMouseMove(dx: number, dy: number): void {
    const sensitivity = 0.002;
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    this.pitch = Math.max(-0.5, Math.min(1.2, this.pitch));
  }

  update(playerPosition: THREE.Vector3): void {
    // Camera position: behind and above the player
    const camX = playerPosition.x - Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance + this.offset.x * Math.cos(this.yaw);
    const camY = playerPosition.y + Math.sin(this.pitch) * this.distance + this.offset.y;
    const camZ = playerPosition.z - Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance - this.offset.x * Math.sin(this.yaw);

    // Keep camera above ground
    const finalY = Math.max(camY, 1.0);

    this.camera.position.set(camX, finalY, camZ);

    // Look at player's head area
    const lookTarget = new THREE.Vector3(
      playerPosition.x,
      playerPosition.y + 1.5,
      playerPosition.z
    );
    this.camera.lookAt(lookTarget);
  }

  getYaw(): number { return this.yaw; }
  getPitch(): number { return this.pitch; }
  setRotation(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = pitch;
  }
}
