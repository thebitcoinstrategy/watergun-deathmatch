import * as THREE from 'three';

// Shared geometries for performance
const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 1, 6);
const leafConeGeo = new THREE.ConeGeometry(0.8, 1.2, 6);
const sphereGeo = new THREE.SphereGeometry(1, 8, 6);
const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 6);
const octaGeo = new THREE.OctahedronGeometry(1);

export function createPalmTree(height = 4, leafColor = '#2e7d32'): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6d4c41' });
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor });

  // Trunk (slightly curved via segments)
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(trunkGeo, trunkMat);
    seg.scale.set(1 - i * 0.1, height / 3, 1 - i * 0.1);
    seg.position.set(Math.sin(i * 0.2) * 0.1, (i + 0.5) * height / 3, 0);
    seg.castShadow = true;
    group.add(seg);
  }

  // Leaf clusters (4-5 cones radiating outward)
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const leaf = new THREE.Mesh(leafConeGeo, leafMat);
    leaf.position.set(Math.cos(angle) * 0.6, height - 0.3, Math.sin(angle) * 0.6);
    leaf.rotation.x = Math.cos(angle) * 0.8;
    leaf.rotation.z = -Math.sin(angle) * 0.8;
    leaf.scale.set(0.6, 0.8, 0.6);
    leaf.castShadow = true;
    group.add(leaf);
  }

  // Top tuft
  const top = new THREE.Mesh(sphereGeo, leafMat);
  top.position.set(0, height + 0.2, 0);
  top.scale.set(0.4, 0.3, 0.4);
  group.add(top);

  return group;
}

export function createTree(height = 3.5, trunkColor = '#5d4037', leafColor = '#388e3c'): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor });
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor });

  // Trunk
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.15, height * 0.6, 6),
    trunkMat
  );
  trunk.position.y = height * 0.3;
  trunk.castShadow = true;
  group.add(trunk);

  // Foliage layers (3 stacked cones)
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.2 - i * 0.3, 1.2, 7),
      leafMat
    );
    cone.position.y = height * 0.5 + i * 0.7;
    cone.castShadow = true;
    group.add(cone);
  }
  return group;
}

export function createBush(size = 0.6, color = '#43a047'): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color });
  const offsets = [
    { x: 0, y: 0, z: 0, s: 1 },
    { x: 0.3, y: 0.1, z: 0.2, s: 0.7 },
    { x: -0.25, y: 0.05, z: -0.15, s: 0.8 },
  ];
  for (const o of offsets) {
    const s = new THREE.Mesh(sphereGeo, mat);
    s.position.set(o.x * size, (o.y + 0.5) * size, o.z * size);
    s.scale.set(o.s * size, o.s * size * 0.8, o.s * size);
    s.castShadow = true;
    group.add(s);
  }
  return group;
}

export function createRock(size = 0.5, color = '#9e9e9e'): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.DodecahedronGeometry(size, 0);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = size * 0.4;
  mesh.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.3);
  mesh.scale.y = 0.6;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

export function createStreetLamp(height = 4, lightColor = 0xffe0b0): THREE.Group {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: '#424242', metalness: 0.5 });

  // Main pole
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.scale.set(1.2, height, 1.2);
  pole.position.y = height / 2;
  pole.castShadow = true;
  group.add(pole);

  // Arm
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.06, 0.06),
    poleMat
  );
  arm.position.set(0.4, height - 0.1, 0);
  group.add(arm);

  // Lamp housing
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.2, 0.3),
    new THREE.MeshStandardMaterial({ color: '#616161' })
  );
  housing.position.set(0.8, height - 0.2, 0);
  group.add(housing);

  // Bulb glow
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshBasicMaterial({ color: lightColor })
  );
  bulb.position.set(0.8, height - 0.35, 0);
  group.add(bulb);

  // Point light
  const light = new THREE.PointLight(lightColor, 0.6, 10);
  light.position.set(0.8, height - 0.4, 0);
  group.add(light);

  return group;
}

export function createNeonLamp(height = 3.5, color = 0x00ffff): THREE.Group {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: '#263238', metalness: 0.6 });

  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.scale.set(1, height, 1);
  pole.position.y = height / 2;
  group.add(pole);

  // Neon tube ring
  const tube = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.04, 8, 12),
    new THREE.MeshBasicMaterial({ color })
  );
  tube.position.y = height;
  tube.rotation.x = Math.PI / 2;
  group.add(tube);

  const light = new THREE.PointLight(color, 0.5, 8);
  light.position.y = height;
  group.add(light);

  return group;
}

export function createFenceSection(length: number, height = 1.2, color = '#795548'): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color });
  const numPosts = Math.ceil(length / 1.5) + 1;
  const spacing = length / (numPosts - 1);

  for (let i = 0; i < numPosts; i++) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, height, 0.08),
      mat
    );
    post.position.set(i * spacing - length / 2, height / 2, 0);
    post.castShadow = true;
    group.add(post);
  }

  // Horizontal rails
  for (const ry of [height * 0.3, height * 0.7]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.05, 0.05),
      mat
    );
    rail.position.set(0, ry, 0);
    group.add(rail);
  }
  return group;
}

export function createBarrel(color = '#6d4c41'): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color });

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.3, 0.8, 8),
    mat
  );
  body.position.y = 0.4;
  body.castShadow = true;
  group.add(body);

  // Rings
  const ringMat = new THREE.MeshStandardMaterial({ color: '#424242', metalness: 0.5 });
  for (const ry of [0.15, 0.65]) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.37, 0.37, 0.04, 8),
      ringMat
    );
    ring.position.y = ry;
    group.add(ring);
  }
  return group;
}

export function createCrate(size = 0.8, color = '#8d6e63'): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color });
  const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
  box.position.y = size / 2;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);

  // Cross planks
  const plankMat = new THREE.MeshStandardMaterial({ color: '#6d4c41' });
  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(size * 1.02, 0.05, size * 0.15),
    plankMat
  );
  plank.position.y = size / 2;
  plank.position.z = size / 2 + 0.01;
  group.add(plank);
  return group;
}

export function createTorch(flameColor = '#ff6600'): THREE.Group {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6),
    new THREE.MeshStandardMaterial({ color: '#5d4037' })
  );
  pole.position.y = 0.75;
  pole.castShadow = true;
  group.add(pole);

  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: flameColor })
  );
  flame.position.y = 1.6;
  group.add(flame);

  const light = new THREE.PointLight(new THREE.Color(flameColor).getHex(), 0.5, 8);
  light.position.y = 1.7;
  group.add(light);

  return group;
}

export function createBanner(color = '#f44336', width = 0.8, height = 1.2): THREE.Group {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({ color: '#5d4037' }));
  pole.scale.y = height + 1;
  pole.position.y = (height + 1) / 2;
  group.add(pole);

  const fabric = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide })
  );
  fabric.position.set(width / 2 + 0.05, height + 0.5, 0);
  group.add(fabric);
  return group;
}

export function createCrystal(size = 0.4, color = 0x4fc3f7): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
  const crystal = new THREE.Mesh(octaGeo, mat);
  crystal.scale.set(size, size * 1.5, size);
  crystal.position.y = size * 1.5;
  crystal.rotation.y = Math.random() * Math.PI;
  group.add(crystal);

  const glow = new THREE.PointLight(color, 0.3, 5);
  glow.position.y = size * 1.5;
  group.add(glow);
  return group;
}

export function createLantern(color = 0xff8f00): THREE.Group {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });

  // Hanging pole
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.scale.set(0.8, 2, 0.8);
  pole.position.y = 1;
  group.add(pole);

  // Arm
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.04, 0.04),
    poleMat
  );
  arm.position.set(0.3, 2, 0);
  group.add(arm);

  // Lantern body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.3, 0.2),
    new THREE.MeshStandardMaterial({ color: '#3e2723' })
  );
  body.position.set(0.6, 1.8, 0);
  group.add(body);

  // Glow
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshBasicMaterial({ color })
  );
  bulb.position.set(0.6, 1.75, 0);
  group.add(bulb);

  const light = new THREE.PointLight(color, 0.4, 6);
  light.position.set(0.6, 1.75, 0);
  group.add(light);

  return group;
}

export function createTotemPole(height = 3, color = '#5d4037'): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color });

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.25, height, 8),
    mat
  );
  pole.position.y = height / 2;
  pole.castShadow = true;
  group.add(pole);

  // Face carvings (boxes)
  const faceMat = new THREE.MeshStandardMaterial({ color: '#8d6e63' });
  for (let i = 0; i < 3; i++) {
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.3, 0.1),
      faceMat
    );
    face.position.set(0, height * 0.3 + i * height * 0.25, 0.22);
    group.add(face);
  }

  return group;
}

export function createTrashCan(color = '#616161'): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.3 });
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.22, 0.7, 8),
    mat
  );
  body.position.y = 0.35;
  body.castShadow = true;
  group.add(body);
  return group;
}

export function createFireHydrant(color = '#d32f2f'): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color });
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.15, 0.5, 8),
    mat
  );
  body.position.y = 0.25;
  group.add(body);

  const top = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6),
    mat
  );
  top.position.y = 0.52;
  group.add(top);
  return group;
}

export function createFloorSlab(
  w: number, d: number, y: number,
  color: string, thickness = 0.3,
  railings?: ('north' | 'south' | 'east' | 'west')[]
): THREE.Group {
  const group = new THREE.Group();

  // Floor surface
  const floorMat = new THREE.MeshStandardMaterial({ color });
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(w, thickness, d),
    floorMat
  );
  slab.position.y = y;
  slab.receiveShadow = true;
  slab.castShadow = true;
  group.add(slab);

  // Support columns at corners
  const columnMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const columnH = y - thickness / 2;
  if (columnH > 0.5) {
    const corners = [
      { x: -w / 2 + 0.15, z: -d / 2 + 0.15 },
      { x: w / 2 - 0.15, z: -d / 2 + 0.15 },
      { x: -w / 2 + 0.15, z: d / 2 - 0.15 },
      { x: w / 2 - 0.15, z: d / 2 - 0.15 },
    ];
    for (const c of corners) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, columnH, 6),
        columnMat
      );
      col.position.set(c.x, columnH / 2, c.z);
      col.castShadow = true;
      group.add(col);
    }
  }

  // Railings
  if (railings) {
    const railMat = new THREE.MeshStandardMaterial({ color: '#9e9e9e', metalness: 0.4 });
    const railH = 1;
    for (const side of railings) {
      let rw: number, rd: number, rx: number, rz: number;
      if (side === 'north') { rw = w; rd = 0.05; rx = 0; rz = -d / 2; }
      else if (side === 'south') { rw = w; rd = 0.05; rx = 0; rz = d / 2; }
      else if (side === 'east') { rw = 0.05; rd = d; rx = w / 2; rz = 0; }
      else { rw = 0.05; rd = d; rx = -w / 2; rz = 0; }
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(rw, railH, rd),
        railMat
      );
      rail.position.set(rx, y + thickness / 2 + railH / 2, rz);
      group.add(rail);
    }
  }

  return group;
}

export function createCloud(size = 3): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const puff = new THREE.Mesh(sphereGeo, mat);
    puff.position.set(
      (Math.random() - 0.5) * size,
      (Math.random() - 0.5) * size * 0.3,
      (Math.random() - 0.5) * size * 0.6
    );
    const s = (0.5 + Math.random() * 0.5) * size * 0.4;
    puff.scale.set(s, s * 0.4, s * 0.7);
    group.add(puff);
  }
  return group;
}
