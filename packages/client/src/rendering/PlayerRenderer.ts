import * as THREE from 'three';

export interface CharacterOptions {
  shirtColor: string;
  pantsColor: string;
  hat: 'none' | 'cap' | 'cowboy' | 'tophat' | 'headband';
  sunglasses: boolean;
}

const DEFAULT_OPTIONS: CharacterOptions = {
  shirtColor: '#4fc3f7',
  pantsColor: '#2196f3',
  hat: 'none',
  sunglasses: false,
};

/**
 * Creates a blocky Roblox-style character from BoxGeometry pieces.
 * Accepts either a color string (legacy) or a CharacterOptions object.
 */
export function createBlockyCharacter(colorOrOpts: string | CharacterOptions = '#4fc3f7'): THREE.Group {
  const opts: CharacterOptions = typeof colorOrOpts === 'string'
    ? { ...DEFAULT_OPTIONS, shirtColor: colorOrOpts }
    : { ...DEFAULT_OPTIONS, ...colorOrOpts };

  const character = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: opts.shirtColor });
  const pantsMat = new THREE.MeshStandardMaterial({ color: opts.pantsColor });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#ffcc99' });

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), skinMat);
  head.position.y = 1.85;
  head.castShadow = true;
  character.add(head);

  // Face
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#222222' });
  const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), eyeMat);
  leftEye.position.set(-0.15, 0.08, 0.35);
  head.add(leftEye);
  const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), eyeMat);
  rightEye.position.set(0.15, 0.08, 0.35);
  head.add(rightEye);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.05), eyeMat);
  mouth.position.set(0, -0.15, 0.35);
  head.add(mouth);

  // Sunglasses
  if (opts.sunglasses) {
    const glassMat = new THREE.MeshStandardMaterial({ color: '#111111', metalness: 0.8, roughness: 0.2 });
    const leftLens = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.05), glassMat);
    leftLens.position.set(-0.15, 0.08, 0.36);
    head.add(leftLens);
    const rightLens = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.05), glassMat);
    rightLens.position.set(0.15, 0.08, 0.36);
    head.add(rightLens);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), glassMat);
    bridge.position.set(0, 0.08, 0.36);
    head.add(bridge);
  }

  // Hat
  if (opts.hat === 'cap') {
    const capMat = new THREE.MeshStandardMaterial({ color: opts.shirtColor });
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.2, 0.72), capMat);
    crown.position.set(0, 0.45, 0);
    head.add(crown);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.3), capMat);
    brim.position.set(0, 0.36, 0.4);
    head.add(brim);
  } else if (opts.hat === 'cowboy') {
    const cowboyMat = new THREE.MeshStandardMaterial({ color: '#6d4c41' });
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.55), cowboyMat);
    crown.position.set(0, 0.52, 0);
    head.add(crown);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.9), cowboyMat);
    brim.position.set(0, 0.36, 0);
    head.add(brim);
  } else if (opts.hat === 'tophat') {
    const topMat = new THREE.MeshStandardMaterial({ color: '#212121' });
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), topMat);
    crown.position.set(0, 0.6, 0);
    head.add(crown);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 0.75), topMat);
    brim.position.set(0, 0.36, 0);
    head.add(brim);
  } else if (opts.hat === 'headband') {
    const bandMat = new THREE.MeshStandardMaterial({ color: '#f44336' });
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.72), bandMat);
    band.position.set(0, 0.2, 0);
    head.add(band);
  }

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), shirtMat);
  torso.position.y = 1.1;
  torso.castShadow = true;
  character.add(torso);

  // Left arm
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), shirtMat);
  leftArm.position.set(-0.55, 1.1, 0);
  leftArm.castShadow = true;
  character.add(leftArm);

  // Right arm
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), shirtMat);
  rightArm.position.set(0.55, 1.1, 0);
  rightArm.rotation.x = -0.5;
  rightArm.castShadow = true;
  character.add(rightArm);

  // Left leg
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.4), pantsMat);
  leftLeg.position.set(-0.2, 0.4, 0);
  leftLeg.castShadow = true;
  character.add(leftLeg);

  // Right leg
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.4), pantsMat);
  rightLeg.position.set(0.2, 0.4, 0);
  rightLeg.castShadow = true;
  character.add(rightLeg);

  // Water gun
  const gunGroup = new THREE.Group();
  const gunHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.18, 0.1),
    new THREE.MeshStandardMaterial({ color: '#e65100' })
  );
  gunHandle.position.set(0, -0.09, 0);
  gunHandle.castShadow = true;
  gunGroup.add(gunHandle);

  const gunBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.55),
    new THREE.MeshStandardMaterial({ color: '#ff6f00' })
  );
  gunBody.position.set(0, 0.02, 0.15);
  gunBody.castShadow = true;
  gunGroup.add(gunBody);

  const gunTank = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.22, 0.22),
    new THREE.MeshStandardMaterial({ color: '#29b6f6', transparent: true, opacity: 0.8 })
  );
  gunTank.position.set(0, 0.16, 0.08);
  gunGroup.add(gunTank);

  const nozzle = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.18),
    new THREE.MeshStandardMaterial({ color: '#e65100' })
  );
  nozzle.position.set(0, 0.02, 0.5);
  gunGroup.add(nozzle);

  const pump = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.06, 0.2),
    new THREE.MeshStandardMaterial({ color: '#ff8f00' })
  );
  pump.position.set(0, 0.14, 0.3);
  gunGroup.add(pump);

  gunGroup.position.set(0.55, 0.75, -0.45);
  gunGroup.rotation.x = -0.3;
  character.add(gunGroup);

  character.userData = {
    head, torso, leftArm, rightArm, leftLeg, rightLeg, gunGroup,
  };

  return character;
}

/**
 * Simple procedural walk animation.
 */
export function animateCharacter(
  character: THREE.Group,
  time: number,
  isMoving: boolean,
  shootTimer: number = 0,
  headPitch: number = 0,
): void {
  const { head, leftArm, rightArm, leftLeg, rightLeg, gunGroup } = character.userData;
  if (!leftArm) return;

  const recoil = shootTimer > 0 ? Math.sin(shootTimer * Math.PI / 0.3) * 0.4 : 0;

  if (isMoving) {
    const swing = Math.sin(time * 8) * 0.4;
    leftArm.rotation.x = swing;
    rightArm.rotation.x = -0.5 + Math.sin(time * 8) * 0.1 - recoil;
    leftLeg.rotation.x = -swing;
    rightLeg.rotation.x = swing;
  } else {
    leftArm.rotation.x = 0;
    rightArm.rotation.x = -0.5 - recoil;
    leftLeg.rotation.x = 0;
    rightLeg.rotation.x = 0;
  }

  if (gunGroup) {
    gunGroup.rotation.x = -0.3 - recoil * 0.5;
  }

  if (head) {
    head.rotation.x = headPitch;
  }
}
