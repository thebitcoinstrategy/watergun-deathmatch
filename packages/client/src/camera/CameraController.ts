import * as THREE from 'three';
import { FirstPersonCam } from './FirstPersonCam';
import { ThirdPersonCam } from './ThirdPersonCam';
import { ViewmodelGun } from '../rendering/ViewmodelGun';

export type CameraMode = 'first-person' | 'third-person';

export class CameraController {
  private firstPerson: FirstPersonCam;
  private thirdPerson: ThirdPersonCam;
  private viewmodelGun: ViewmodelGun;
  private mode: CameraMode = 'first-person';

  constructor() {
    this.firstPerson = new FirstPersonCam();
    this.thirdPerson = new ThirdPersonCam();

    // Create the FPS viewmodel gun and attach it to the FPS camera
    this.viewmodelGun = new ViewmodelGun();
    this.firstPerson.camera.add(this.viewmodelGun.group);
    this.viewmodelGun.setVisible(true); // Start in first person
  }

  toggle(): CameraMode {
    if (this.mode === 'first-person') {
      this.mode = 'third-person';
      this.thirdPerson.setRotation(this.firstPerson.getYaw(), 0.3);
      this.viewmodelGun.setVisible(false);
    } else {
      this.mode = 'first-person';
      this.firstPerson.setRotation(this.thirdPerson.getYaw(), 0);
      this.viewmodelGun.setVisible(true);
    }
    return this.mode;
  }

  getMode(): CameraMode { return this.mode; }

  /** Both cameras must be in the scene graph for their children to render */
  addToScene(scene: THREE.Scene): void {
    scene.add(this.firstPerson.camera);
    scene.add(this.thirdPerson.camera);
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.mode === 'first-person'
      ? this.firstPerson.camera
      : this.thirdPerson.camera;
  }

  handleMouseMove(dx: number, dy: number): void {
    if (this.mode === 'first-person') {
      this.firstPerson.handleMouseMove(dx, dy);
    } else {
      this.thirdPerson.handleMouseMove(dx, dy);
    }
  }

  update(playerPosition: THREE.Vector3): void {
    if (this.mode === 'first-person') {
      this.firstPerson.update(playerPosition);
    } else {
      this.thirdPerson.update(playerPosition);
    }
  }

  updateViewmodel(dt: number, isMoving: boolean, isShooting: boolean): void {
    this.viewmodelGun.update(dt, isMoving, isShooting);
  }

  getYaw(): number {
    return this.mode === 'first-person'
      ? this.firstPerson.getYaw()
      : this.thirdPerson.getYaw();
  }

  getPitch(): number {
    return this.mode === 'first-person'
      ? this.firstPerson.getPitch()
      : this.thirdPerson.getPitch();
  }
}
