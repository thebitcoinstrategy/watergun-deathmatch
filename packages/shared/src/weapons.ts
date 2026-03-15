export type WeaponId = 'water_pistol' | 'super_soaker' | 'splash_shotgun' | 'water_sniper' | 'bubble_blaster' | 'water_balloon';
export type FireMode = 'semi' | 'auto';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  damage: number;
  fireRate: number;       // shots per second
  fireMode: FireMode;
  speed: number;
  gravity: number;
  pellets: number;
  spread: number;
  maxAge: number;
  projectileRadius: number;
  projectileColor: string;
  trailColor: string;
  emissiveColor: string;
  gunBodyColor: string;
  gunTankColor: string;
  isDefault?: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  water_pistol: {
    id: 'water_pistol', name: 'Water Pistol', damage: 10, fireRate: 5, fireMode: 'semi',
    speed: 30, gravity: 9.8, pellets: 1, spread: 0, maxAge: 2,
    projectileRadius: 0.1, projectileColor: '#29b6f6', trailColor: '#4fc3f7',
    emissiveColor: '#0288d1', gunBodyColor: '#ff6f00', gunTankColor: '#29b6f6', isDefault: true,
  },
  super_soaker: {
    id: 'super_soaker', name: 'Super Soaker', damage: 25, fireRate: 2, fireMode: 'semi',
    speed: 35, gravity: 9.8, pellets: 1, spread: 0, maxAge: 2,
    projectileRadius: 0.14, projectileColor: '#1565c0', trailColor: '#1976d2',
    emissiveColor: '#0d47a1', gunBodyColor: '#1565c0', gunTankColor: '#0d47a1',
  },
  splash_shotgun: {
    id: 'splash_shotgun', name: 'Splash Shotgun', damage: 8, fireRate: 1.5, fireMode: 'semi',
    speed: 25, gravity: 9.8, pellets: 5, spread: 0.12, maxAge: 1.2,
    projectileRadius: 0.08, projectileColor: '#00e5ff', trailColor: '#18ffff',
    emissiveColor: '#00b8d4', gunBodyColor: '#00838f', gunTankColor: '#00e5ff',
  },
  water_sniper: {
    id: 'water_sniper', name: 'Water Sniper', damage: 40, fireRate: 0.8, fireMode: 'semi',
    speed: 50, gravity: 9.8, pellets: 1, spread: 0, maxAge: 3,
    projectileRadius: 0.06, projectileColor: '#ffffff', trailColor: '#e0e0e0',
    emissiveColor: '#bbdefb', gunBodyColor: '#607d8b', gunTankColor: '#eceff1',
  },
  bubble_blaster: {
    id: 'bubble_blaster', name: 'Bubble Blaster', damage: 5, fireRate: 12, fireMode: 'auto',
    speed: 15, gravity: 3, pellets: 1, spread: 0.08, maxAge: 1.5,
    projectileRadius: 0.15, projectileColor: '#e040fb', trailColor: '#ea80fc',
    emissiveColor: '#aa00ff', gunBodyColor: '#9c27b0', gunTankColor: '#e040fb',
  },
  water_balloon: {
    id: 'water_balloon', name: 'Water Balloon', damage: 30, fireRate: 1, fireMode: 'semi',
    speed: 15, gravity: 20, pellets: 1, spread: 0, maxAge: 3,
    projectileRadius: 0.2, projectileColor: '#66bb6a', trailColor: '#81c784',
    emissiveColor: '#2e7d32', gunBodyColor: '#388e3c', gunTankColor: '#66bb6a',
  },
};

export const DEFAULT_WEAPON: WeaponId = 'water_pistol';
export const PICKUP_WEAPON_IDS: WeaponId[] = ['super_soaker', 'splash_shotgun', 'water_sniper', 'bubble_blaster', 'water_balloon'];
export const NUM_WEAPON_PICKUPS = 3;
export const WEAPON_PICKUP_RADIUS = 1.5;
export const WEAPON_RESPAWN_DELAY = 8;
