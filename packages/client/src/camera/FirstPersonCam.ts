import * as THREE from 'three';

export class FirstPersonCam {
  camera: THREE.PerspectiveCamera;
  private pitch = 0;
  private yaw = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      75,
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
    this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
  }

  update(playerPosition: THREE.Vector3, crouching = false): void {
    // Camera at eye level (lower when crouching)
    const eyeHeight = crouching ? 1.0 : 1.7;
    this.camera.position.set(playerPosition.x, playerPosition.y + eyeHeight, playerPosition.z);

    // Look direction from yaw and pitch
    const lookDir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    const target = this.camera.position.clone().add(lookDir);
    this.camera.lookAt(target);
  }

  getYaw(): number { return this.yaw; }
  getPitch(): number { return this.pitch; }
  setRotation(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = pitch;
  }
}
