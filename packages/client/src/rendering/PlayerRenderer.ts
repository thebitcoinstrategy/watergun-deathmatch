import * as THREE from 'three';

/**
 * Creates a blocky Roblox-style character from BoxGeometry pieces.
 * The water gun is held in the right hand, clearly separate from the body.
 */
export function createBlockyCharacter(color: string = '#4fc3f7'): THREE.Group {
  const character = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#ffcc99' });

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), skinMat);
  head.position.y = 1.85;
  head.castShadow = true;
  character.add(head);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), mat);
  torso.position.y = 1.1;
  torso.castShadow = true;
  character.add(torso);

  // Left arm
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), mat);
  leftArm.position.set(-0.55, 1.1, 0);
  leftArm.castShadow = true;
  character.add(leftArm);

  // Right arm (angled forward to hold gun)
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), mat);
  rightArm.position.set(0.55, 1.1, 0);
  rightArm.rotation.x = -0.5; // Arm angled forward
  rightArm.castShadow = true;
  character.add(rightArm);

  // Left leg
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.4), mat.clone());
  (leftLeg.material as THREE.MeshStandardMaterial).color.set('#2196f3');
  leftLeg.position.set(-0.2, 0.4, 0);
  leftLeg.castShadow = true;
  character.add(leftLeg);

  // Right leg
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.4), mat.clone());
  (rightLeg.material as THREE.MeshStandardMaterial).color.set('#2196f3');
  rightLeg.position.set(0.2, 0.4, 0);
  rightLeg.castShadow = true;
  character.add(rightLeg);

  // Water gun — held in right hand, clearly separate from body
  const gunGroup = new THREE.Group();

  // Gun handle (grip)
  const gunHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.18, 0.1),
    new THREE.MeshStandardMaterial({ color: '#e65100' })
  );
  gunHandle.position.set(0, -0.09, 0);
  gunHandle.castShadow = true;
  gunGroup.add(gunHandle);

  // Gun body (main barrel)
  const gunBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.55),
    new THREE.MeshStandardMaterial({ color: '#ff6f00' })
  );
  gunBody.position.set(0, 0.02, 0.15);
  gunBody.castShadow = true;
  gunGroup.add(gunBody);

  // Gun tank (water reservoir on top)
  const gunTank = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.22, 0.22),
    new THREE.MeshStandardMaterial({ color: '#29b6f6', transparent: true, opacity: 0.8 })
  );
  gunTank.position.set(0, 0.16, 0.08);
  gunGroup.add(gunTank);

  // Gun nozzle (tip)
  const nozzle = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.18),
    new THREE.MeshStandardMaterial({ color: '#e65100' })
  );
  nozzle.position.set(0, 0.02, 0.5);
  gunGroup.add(nozzle);

  // Pump handle on top
  const pump = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.06, 0.2),
    new THREE.MeshStandardMaterial({ color: '#ff8f00' })
  );
  pump.position.set(0, 0.14, 0.3);
  gunGroup.add(pump);

  // Position gun in right hand — offset from body so it's clearly held
  gunGroup.position.set(0.55, 0.75, -0.45);
  gunGroup.rotation.x = -0.3; // Angled slightly to match arm
  character.add(gunGroup);

  // Store references for animation
  character.userData = {
    head,
    torso,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    gunGroup,
  };

  return character;
}

/**
 * Simple procedural walk animation.
 * The right arm stays mostly still (holding gun), left arm and legs swing.
 * shootTimer > 0 triggers a recoil animation on the gun arm.
 * headPitch tilts the head to look up/down at targets.
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

  // Shoot recoil on right arm and gun
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

  // Gun recoil (kick back)
  if (gunGroup) {
    gunGroup.rotation.x = -0.3 - recoil * 0.5;
  }

  // Head look direction (pitch up/down)
  if (head) {
    head.rotation.x = headPitch;
  }
}
