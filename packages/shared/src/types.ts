export interface PlayerInput {
  seq: number;
  dx: number; // -1 to 1
  dz: number; // -1 to 1
  rotY: number; // yaw (radians)
  rotX: number; // pitch (radians)
  jump: boolean;
  shoot: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  rotX: number;
  health: number;
  kills: number;
  deaths: number;
  color: string;
}

export interface ProjectileState {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ownerId: string;
}
