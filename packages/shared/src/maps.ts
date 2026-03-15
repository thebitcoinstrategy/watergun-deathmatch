export type MapId = 'aqua_park' | 'pirate_cove' | 'neon_city' | 'sky_fortress' | 'jungle_temple' | 'mega_arena';

export interface MapCoverBox {
  x: number; z: number; w: number; h: number; d: number;
}

export interface MapSpawn {
  x: number; z: number;
}

export interface MapPoolConfig {
  x: number; z: number; w: number; d: number; depth: number;
}

export interface MapRampConfig {
  minX: number; maxX: number;
  startZ: number; endZ: number;   // startZ = high end, endZ = low end
  topHeight: number;
  bottomHeight: number;
  slideForce: number;             // 0 = walkable ramp, >0 = push slide
}

export interface MapLadderConfig {
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  bottomHeight: number;
  topHeight: number;
  direction?: 'z' | 'x';         // axis along which height changes (default 'z')
}

export interface GroundPlatform {
  x: number; z: number;
  w: number; d: number;
  y?: number;           // elevation (default 0)
  color?: string;       // override ground color
}

export interface MapFloorSection {
  x: number; z: number;
  w: number; d: number;
  height: number;         // floor elevation
  thickness?: number;     // slab thickness (default 0.3)
  color?: string;
  railings?: ('north' | 'south' | 'east' | 'west')[];
}

export interface MapDef {
  id: MapId;
  name: string;
  covers: MapCoverBox[];
  spawns: MapSpawn[];
  // Visual theme
  groundColor: string;
  wallColor: string;
  coverColor: string;
  skyColor: string;
  fogColor: string;
  gridColor: string;
  // Optional features
  pools?: MapPoolConfig[];
  hasSlide?: boolean;
  hasMirrors?: boolean;
  ramps?: MapRampConfig[];
  ladders?: MapLadderConfig[];
  // Ground shape
  showDefaultGround?: boolean;  // default true
  showBoundaryWalls?: boolean;  // default true
  groundPlatforms?: GroundPlatform[];
  floors?: MapFloorSection[];
}

// ============ AQUA PARK (original map) ============
const AQUA_PARK: MapDef = {
  id: 'aqua_park',
  name: 'Aqua Park',
  groundColor: '#7cb342',
  wallColor: '#8d6e63',
  coverColor: '#78909c',
  skyColor: '#87ceeb',
  fogColor: '#87ceeb',
  gridColor: '#689f38',
  hasMirrors: true,
  hasSlide: true,
  pools: [
    { x: 14, z: -14, w: 8, d: 6, depth: 0.8 },
    { x: -14, z: 14, w: 6, d: 8, depth: 0.6 },
    { x: 0, z: 14, w: 5, d: 4, depth: 0.5 },
  ],
  ramps: [
    { minX: -14.65, maxX: -13.35, startZ: 10, endZ: 16, topHeight: 3.2, bottomHeight: 0, slideForce: 6 },
  ],
  ladders: [
    { minX: -14.5, maxX: -13.5, minZ: 8.3, maxZ: 10.0, bottomHeight: 0, topHeight: 3.2 },
  ],
  spawns: [
    { x: -17, z: -17 }, { x: 17, z: -17 },
    { x: -17, z: 17 }, { x: 17, z: 17 },
  ],
  covers: [
    { x: -8, z: -8, w: 3, h: 2.5, d: 0.5 },
    { x: 8, z: 8, w: 3, h: 2.5, d: 0.5 },
    { x: -6, z: 6, w: 0.5, h: 2.5, d: 3 },
    { x: 6, z: -6, w: 0.5, h: 2.5, d: 3 },
    { x: 0, z: 0, w: 2, h: 1.5, d: 2 },
    { x: -12, z: 0, w: 4, h: 3, d: 0.5 },
    { x: 12, z: 0, w: 4, h: 3, d: 0.5 },
    { x: 0, z: -12, w: 0.5, h: 3, d: 4 },
    { x: -5, z: -14, w: 2, h: 2, d: 2 },
    { x: 5, z: 14, w: 2, h: 2, d: 2 },
    { x: 4, z: 0, w: 2, h: 1, d: 2 },
    { x: -4, z: 0, w: 2, h: 1, d: 2 },
    { x: 0, z: 5, w: 2, h: 1.2, d: 2 },
    { x: 0, z: -5, w: 2, h: 1.2, d: 2 },
    { x: 10, z: -10, w: 2, h: 1.5, d: 2 },
    { x: -10, z: 10, w: 2, h: 1.5, d: 2 },
    { x: 6, z: 3, w: 0.5, h: 2.5, d: 4 },
    { x: -6, z: -3, w: 0.5, h: 2.5, d: 4 },
    { x: 3, z: -9, w: 1.5, h: 1, d: 1.5 },
    { x: -3, z: 9, w: 1.5, h: 1, d: 1.5 },
    { x: 15, z: 5, w: 2, h: 1.5, d: 2 },
    { x: -15, z: -5, w: 2, h: 1.5, d: 2 },
    { x: 10, z: 4, w: 3, h: 2, d: 0.5 },
    { x: 11.25, z: 5.5, w: 0.5, h: 2, d: 3 },
    { x: -10, z: -4, w: 3, h: 2, d: 0.5 },
    { x: -11.25, z: -5.5, w: 0.5, h: 2, d: 3 },
  ],
};

// ============ PIRATE COVE (multi-level ship & dock combat) ============
const PIRATE_COVE: MapDef = {
  id: 'pirate_cove',
  name: 'Pirate Cove',
  groundColor: '#d7ccc8',   // Sandy beach
  wallColor: '#5d4037',
  coverColor: '#6d4c41',
  skyColor: '#ffcc80',
  fogColor: '#ffcc80',
  gridColor: '#8d6e63',
  showDefaultGround: false,
  showBoundaryWalls: false,
  groundPlatforms: [
    // Sandy dock area (most of the map)
    { x: 0, z: -5, w: 40, d: 25, color: '#a1887f' },
    // Beach sand (south)
    { x: 0, z: 12, w: 40, d: 12, color: '#d7ccc8' },
    // Wooden dock planks
    { x: -14, z: 0, w: 6, d: 12, y: 0.15, color: '#6d4c41' },
    { x: 14, z: 0, w: 6, d: 12, y: 0.15, color: '#6d4c41' },
  ],
  floors: [
    // Ship upper deck (captain's area)
    { x: -5, z: 0, w: 3, d: 5, height: 3, thickness: 0.2, color: '#5d4037', railings: ['north', 'south', 'west'] },
    // NW watch platform
    { x: -15, z: -15, w: 4, d: 4, height: 4.5, thickness: 0.25, color: '#5d4037', railings: ['north', 'south', 'east', 'west'] },
    // SE watch platform
    { x: 15, z: 15, w: 4, d: 4, height: 4.5, thickness: 0.25, color: '#5d4037', railings: ['north', 'south', 'east', 'west'] },
  ],
  pools: [
    { x: 0, z: 17, w: 14, d: 4, depth: 1.0 },   // Harbor water (south)
    { x: -17, z: 0, w: 4, d: 10, depth: 0.8 },   // West dock water
    { x: 17, z: 0, w: 4, d: 10, depth: 0.8 },    // East dock water
  ],
  ladders: [
    // Port gangplank (south side of ship - walk from ground up to deck)
    { minX: -1.5, maxX: 1.5, minZ: -6, maxZ: -3.25, bottomHeight: 0, topHeight: 2 },
    // Starboard gangplank (north side - walk from deck down to ground)
    { minX: -1.5, maxX: 1.5, minZ: 3.25, maxZ: 6, bottomHeight: 2, topHeight: 0 },
    // NW tower ladder (climb up tower face)
    { minX: -16, maxX: -14.5, minZ: -12.5, maxZ: -11, bottomHeight: 0, topHeight: 4.5 },
    // SE tower ladder
    { minX: 14.5, maxX: 16, minZ: 11, maxZ: 12.5, bottomHeight: 0, topHeight: 4.5 },
  ],
  spawns: [
    { x: -17, z: -17 }, { x: 17, z: -17 },
    { x: -17, z: 17 }, { x: 17, z: 17 },
    { x: -17, z: 0 }, { x: 17, z: 0 },
  ],
  covers: [
    // === CENTRAL SHIP (deck at h=2, walls at h=3.5) ===
    { x: 0, z: 0, w: 14, h: 2, d: 6 },          // Ship deck floor (stand on top)
    { x: 0, z: -3.25, w: 14, h: 3.5, d: 0.5 },  // Port wall
    { x: 0, z: 3.25, w: 14, h: 3.5, d: 0.5 },   // Starboard wall
    { x: -7.25, z: 0, w: 0.5, h: 3.5, d: 6 },   // Stern
    { x: 7.25, z: 0, w: 0.5, h: 3.5, d: 6 },    // Bow
    // Masts (tall pillars on deck)
    { x: 4, z: 0, w: 0.5, h: 7, d: 0.5 },        // Front mast
    { x: -3, z: 0, w: 0.5, h: 7, d: 0.5 },       // Rear mast
    // Captain's cabin (elevated structure on stern, stand on top at h=4)
    { x: -5, z: 0, w: 3, h: 4, d: 4 },

    // === WATCHTOWER CORNERS (h=4.5, step access) ===
    { x: -15, z: -15, w: 3, h: 4.5, d: 3 },      // NW tower
    { x: -15, z: -12, w: 2.5, h: 1.5, d: 2 },    // NW step 1
    { x: -15, z: -13, w: 2, h: 3, d: 1.5 },      // NW step 2
    { x: 15, z: 15, w: 3, h: 4.5, d: 3 },        // SE tower
    { x: 15, z: 12, w: 2.5, h: 1.5, d: 2 },      // SE step 1
    { x: 15, z: 13, w: 2, h: 3, d: 1.5 },        // SE step 2

    // Smaller corner towers
    { x: 15, z: -15, w: 2.5, h: 3.5, d: 2.5 },   // NE tower
    { x: -15, z: 15, w: 2.5, h: 3.5, d: 2.5 },   // SW tower

    // === DOCK SCAFFOLDING (elevated platforms) ===
    { x: -13, z: 7, w: 4, h: 2.5, d: 4 },        // West dock platform
    { x: -13, z: 10, w: 3, h: 1, d: 2 },          // West dock step
    { x: 13, z: -7, w: 4, h: 2.5, d: 4 },        // East dock platform
    { x: 13, z: -10, w: 3, h: 1, d: 2 },          // East dock step

    // === BARREL & CRATE CLUSTERS ===
    { x: -10, z: -8, w: 2, h: 1.2, d: 2 },
    { x: -8, z: -9, w: 1.5, h: 1.5, d: 1.5 },
    { x: 10, z: 8, w: 2, h: 1.2, d: 2 },
    { x: 8, z: 9, w: 1.5, h: 1.5, d: 1.5 },
    { x: -8, z: 14, w: 1.5, h: 1, d: 1.5 },
    { x: 8, z: -14, w: 1.5, h: 1, d: 1.5 },
    { x: -5, z: -12, w: 2, h: 1.3, d: 1.5 },
    { x: 5, z: 12, w: 2, h: 1.3, d: 1.5 },

    // Tall crate stacks (h=2-3)
    { x: -10, z: 5, w: 2, h: 2, d: 2 },
    { x: 10, z: -5, w: 2, h: 2, d: 2 },
    { x: 7, z: 10, w: 1.5, h: 2.5, d: 1.5 },
    { x: -7, z: -10, w: 1.5, h: 2.5, d: 1.5 },

    // Cannon emplacements
    { x: -8, z: -16, w: 2, h: 0.8, d: 1.5 },
    { x: 8, z: 16, w: 2, h: 0.8, d: 1.5 },
    { x: -16, z: -8, w: 1.5, h: 0.8, d: 2 },
    { x: 16, z: 8, w: 1.5, h: 0.8, d: 2 },

    // Rope coil piles
    { x: 5, z: -8, w: 1.5, h: 0.6, d: 1.5 },
    { x: -5, z: 8, w: 1.5, h: 0.6, d: 1.5 },

    // Gangplank railing posts
    { x: -2, z: -4.5, w: 0.3, h: 2.5, d: 0.3 },
    { x: 2, z: -4.5, w: 0.3, h: 2.5, d: 0.3 },
    { x: -2, z: 4.5, w: 0.3, h: 2.5, d: 0.3 },
    { x: 2, z: 4.5, w: 0.3, h: 2.5, d: 0.3 },
  ],
};

// ============ NEON CITY (vertical cyberpunk rooftop warfare) ============
const NEON_CITY: MapDef = {
  id: 'neon_city',
  name: 'Neon City',
  groundColor: '#37474f',
  wallColor: '#263238',
  coverColor: '#455a64',
  skyColor: '#1a1a2e',
  fogColor: '#1a1a2e',
  gridColor: '#00e5ff',
  groundPlatforms: [
    // Elevated sidewalks along edges
    { x: -18, z: 0, w: 4, d: 40, y: 0.2, color: '#546e7a' },
    { x: 18, z: 0, w: 4, d: 40, y: 0.2, color: '#546e7a' },
    { x: 0, z: -18, w: 32, d: 4, y: 0.2, color: '#546e7a' },
    { x: 0, z: 18, w: 32, d: 4, y: 0.2, color: '#546e7a' },
  ],
  floors: [
    // Elevated walkway connecting NW to NE building
    { x: 0, z: -12, w: 14, d: 2.5, height: 3.5, thickness: 0.2, color: '#455a64', railings: ['north', 'south'] },
    // Elevated walkway connecting SW to SE building
    { x: 0, z: 12, w: 14, d: 2.5, height: 3.5, thickness: 0.2, color: '#455a64', railings: ['north', 'south'] },
  ],
  pools: [
    { x: 0, z: 0, w: 4, d: 4, depth: 0.3 },     // Central neon fountain
  ],
  ladders: [
    // NW building access ramp (Z direction)
    { minX: -14, maxX: -11, minZ: -9.5, maxZ: -8, bottomHeight: 0, topHeight: 2.5 },
    // SE building access ramp
    { minX: 11, maxX: 14, minZ: 8, maxZ: 9.5, bottomHeight: 0, topHeight: 2.5 },
  ],
  spawns: [
    { x: -17, z: -17 }, { x: 17, z: -17 },
    { x: -17, z: 17 }, { x: 17, z: 17 },
    { x: 0, z: -17 }, { x: 0, z: 17 },
  ],
  covers: [
    // === CORNER BUILDINGS (rooftop combat) ===
    { x: -12, z: -12, w: 5, h: 5, d: 5 },        // NW building (tallest)
    { x: 12, z: -12, w: 5, h: 4, d: 5 },         // NE building
    { x: -12, z: 12, w: 5, h: 4, d: 5 },         // SW building
    { x: 12, z: 12, w: 5, h: 5, d: 5 },          // SE building (tallest)

    // === STAIRCASE ACCESS TO ROOFTOPS ===
    // NW building stairs (3 steps approaching from +Z)
    { x: -12, z: -8.5, w: 3.5, h: 1.5, d: 1.5 },  // step 1
    { x: -12, z: -9.5, w: 3, h: 3, d: 1 },         // step 2
    // NW side access from +X
    { x: -9, z: -12, w: 1.5, h: 2.5, d: 3 },       // side step

    // NE building stairs
    { x: 12, z: -8.5, w: 3.5, h: 1.3, d: 1.5 },
    { x: 12, z: -9.5, w: 3, h: 2.6, d: 1 },

    // SW building stairs
    { x: -12, z: 8.5, w: 3.5, h: 1.3, d: 1.5 },
    { x: -12, z: 9.5, w: 3, h: 2.6, d: 1 },

    // SE building stairs
    { x: 12, z: 8.5, w: 3.5, h: 1.5, d: 1.5 },
    { x: 12, z: 9.5, w: 3, h: 3, d: 1 },
    { x: 9, z: 12, w: 1.5, h: 2.5, d: 3 },

    // === CENTRAL STRUCTURES ===
    { x: 0, z: 0, w: 2, h: 3.5, d: 2 },          // Central monument (tall)
    { x: -5, z: -5, w: 3, h: 2.5, d: 3 },        // Inner block NW
    { x: 5, z: 5, w: 3, h: 2.5, d: 3 },          // Inner block SE
    { x: -5, z: 5, w: 3, h: 2, d: 3 },           // Inner block SW
    { x: 5, z: -5, w: 3, h: 2, d: 3 },           // Inner block NE

    // === ALLEY WALLS (tight corridors) ===
    { x: 0, z: -7, w: 0.5, h: 3.5, d: 5 },
    { x: 0, z: 7, w: 0.5, h: 3.5, d: 5 },
    { x: -7, z: 0, w: 5, h: 3.5, d: 0.5 },
    { x: 7, z: 0, w: 5, h: 3.5, d: 0.5 },

    // === ELEVATED MID-PLATFORMS (jump between buildings) ===
    { x: -8, z: -8, w: 2, h: 2, d: 2 },
    { x: 8, z: 8, w: 2, h: 2, d: 2 },
    { x: -8, z: 8, w: 2, h: 2, d: 2 },
    { x: 8, z: -8, w: 2, h: 2, d: 2 },

    // Parkour stepping stones between buildings (mid-height)
    { x: 0, z: -12, w: 2, h: 3, d: 2 },          // between NW-NE
    { x: 0, z: 12, w: 2, h: 3, d: 2 },           // between SW-SE
    { x: -12, z: 0, w: 2, h: 3, d: 2 },          // between NW-SW
    { x: 12, z: 0, w: 2, h: 3, d: 2 },           // between NE-SE

    // === GROUND COVER ===
    { x: -17, z: 0, w: 2, h: 1.2, d: 2 },        // AC units
    { x: 17, z: 0, w: 2, h: 1.2, d: 2 },
    { x: 0, z: -17, w: 2, h: 1.2, d: 2 },
    { x: 0, z: 17, w: 2, h: 1.2, d: 2 },

    // Billboard pillars
    { x: -17, z: -8, w: 0.8, h: 5, d: 0.8 },
    { x: 17, z: 8, w: 0.8, h: 5, d: 0.8 },

    // Dumpsters
    { x: 7, z: -17, w: 2.5, h: 1.3, d: 1.5 },
    { x: -7, z: 17, w: 2.5, h: 1.3, d: 1.5 },

    // Ramp blocks (stepped)
    { x: -17, z: 8, w: 3, h: 1, d: 3 },
    { x: -17, z: 11, w: 3, h: 2, d: 3 },
    { x: 17, z: -8, w: 3, h: 1, d: 3 },
    { x: 17, z: -11, w: 3, h: 2, d: 3 },
  ],
};

// ============ SKY FORTRESS (floating platforms, extreme verticality) ============
const SKY_FORTRESS: MapDef = {
  id: 'sky_fortress',
  name: 'Sky Fortress',
  groundColor: '#cfd8dc',
  wallColor: '#b0bec5',
  coverColor: '#eceff1',
  skyColor: '#81d4fa',
  fogColor: '#81d4fa',
  gridColor: '#4fc3f7',
  showDefaultGround: false,
  showBoundaryWalls: false,
  pools: [
    { x: -14, z: 14, w: 4, d: 4, depth: 0.4 },   // Cloud pool SW
    { x: 14, z: -14, w: 4, d: 4, depth: 0.4 },    // Cloud pool NE
  ],
  ladders: [
    // Ramp up to west satellite
    { minX: -12, maxX: -10, minZ: -1.5, maxZ: 1.5, bottomHeight: 0, topHeight: 2, direction: 'x' },
    // Ramp up to south satellite
    { minX: -1.5, maxX: 1.5, minZ: 10, maxZ: 12, bottomHeight: 0, topHeight: 3 },
  ],
  spawns: [
    { x: -17, z: -17 }, { x: 17, z: -17 },
    { x: -17, z: 17 }, { x: 17, z: 17 },
    { x: 0, z: -17 }, { x: 0, z: 17 },
  ],
  covers: [
    // === CENTRAL TOWER (3-tier pyramid) ===
    { x: 0, z: 0, w: 7, h: 2, d: 7 },            // Base tier (stand at h=2)
    { x: 0, z: 0, w: 4.5, h: 4, d: 4.5 },        // Mid tier (stand at h=4)
    { x: 0, z: 0, w: 2.5, h: 6, d: 2.5 },        // Top tier (stand at h=6)

    // === SATELLITE PLATFORMS ===
    { x: 0, z: -14, w: 6, h: 3, d: 5 },          // North platform (h=3)
    { x: 0, z: 14, w: 6, h: 3, d: 5 },           // South platform (h=3)
    { x: 14, z: 0, w: 5, h: 4, d: 6 },           // East platform (h=4)
    { x: -14, z: 0, w: 5, h: 2, d: 6 },          // West platform (h=2)

    // === PILLAR BRIDGES (hop across at elevation) ===
    // North bridge (h=3) - center to north
    { x: 0, z: -5, w: 1.8, h: 3, d: 1.8 },
    { x: 0, z: -7.5, w: 1.8, h: 3, d: 1.8 },
    { x: 0, z: -10, w: 1.8, h: 3, d: 1.8 },

    // South bridge (h=3) - center to south
    { x: 0, z: 5, w: 1.8, h: 3, d: 1.8 },
    { x: 0, z: 7.5, w: 1.8, h: 3, d: 1.8 },
    { x: 0, z: 10, w: 1.8, h: 3, d: 1.8 },

    // East bridge (h=4) - center to east
    { x: 5, z: 0, w: 1.8, h: 4, d: 1.8 },
    { x: 7.5, z: 0, w: 1.8, h: 4, d: 1.8 },
    { x: 10, z: 0, w: 1.8, h: 4, d: 1.8 },

    // West bridge (h=2) - center to west
    { x: -5, z: 0, w: 1.8, h: 2, d: 1.8 },
    { x: -7.5, z: 0, w: 1.8, h: 2, d: 1.8 },
    { x: -10, z: 0, w: 1.8, h: 2, d: 1.8 },

    // === DIAGONAL OUTPOSTS ===
    { x: 10, z: -10, w: 3.5, h: 2.5, d: 3.5 },   // NE outpost
    { x: -10, z: -10, w: 3.5, h: 3, d: 3.5 },    // NW outpost
    { x: 10, z: 10, w: 3.5, h: 3, d: 3.5 },      // SE outpost
    { x: -10, z: 10, w: 3.5, h: 2.5, d: 3.5 },   // SW outpost

    // Step-up blocks near outposts
    { x: 10, z: -7, w: 2, h: 1, d: 2 },
    { x: -10, z: -7, w: 2, h: 1.2, d: 2 },
    { x: 10, z: 7, w: 2, h: 1.2, d: 2 },
    { x: -10, z: 7, w: 2, h: 1, d: 2 },

    // === CORNER GROUND COVER ===
    { x: -17, z: -17, w: 2.5, h: 1, d: 2.5 },
    { x: 17, z: -17, w: 2.5, h: 1, d: 2.5 },
    { x: -17, z: 17, w: 2.5, h: 1, d: 2.5 },
    { x: 17, z: 17, w: 2.5, h: 1, d: 2.5 },

    // Scattered low cover
    { x: -6, z: -14, w: 1.5, h: 1.2, d: 1.5 },
    { x: 6, z: 14, w: 1.5, h: 1.2, d: 1.5 },
    { x: -14, z: 6, w: 1.5, h: 1.2, d: 1.5 },
    { x: 14, z: -6, w: 1.5, h: 1.2, d: 1.5 },
    { x: -17, z: -6, w: 2, h: 0.8, d: 2 },
    { x: 17, z: 6, w: 2, h: 0.8, d: 2 },

    // Tall beacon pillars
    { x: -17, z: 0, w: 0.8, h: 5, d: 0.8 },
    { x: 17, z: 0, w: 0.8, h: 5, d: 0.8 },
    { x: 0, z: -17, w: 0.8, h: 5, d: 0.8 },
    { x: 0, z: 17, w: 0.8, h: 5, d: 0.8 },
  ],
};

// ============ JUNGLE TEMPLE (tiered pyramid, dense ruins) ============
const JUNGLE_TEMPLE: MapDef = {
  id: 'jungle_temple',
  name: 'Jungle Temple',
  groundColor: '#558b2f',
  wallColor: '#4e342e',
  coverColor: '#795548',
  skyColor: '#aed581',
  fogColor: '#81c784',
  gridColor: '#33691e',
  groundPlatforms: [
    // Dirt paths between ruins
    { x: 0, z: 0, w: 14, d: 14, y: 0.05, color: '#6d4c41' },
    // Moss-covered stone around temples
    { x: -13, z: -13, w: 6, d: 6, y: 0.08, color: '#4e342e' },
    { x: 13, z: -13, w: 6, d: 6, y: 0.08, color: '#4e342e' },
    { x: -13, z: 13, w: 6, d: 6, y: 0.08, color: '#4e342e' },
    { x: 13, z: 13, w: 6, d: 6, y: 0.08, color: '#4e342e' },
  ],
  floors: [
    // Temple balconies (NW and SE ruins)
    { x: -13, z: -13, w: 5, d: 5, height: 3.5, thickness: 0.2, color: '#5d4037', railings: ['north', 'east'] },
    { x: 13, z: 13, w: 5, d: 5, height: 3.5, thickness: 0.2, color: '#5d4037', railings: ['south', 'west'] },
  ],
  pools: [
    { x: -14, z: -14, w: 5, d: 5, depth: 0.8 },   // NW sacred pool
    { x: 14, z: 14, w: 5, d: 5, depth: 0.8 },      // SE sacred pool
    { x: 0, z: -16, w: 6, d: 3, depth: 0.5 },      // North waterfall pool
  ],
  ladders: [
    // North pyramid ramp (walk up to tier 1)
    { minX: -1.5, maxX: 1.5, minZ: -7, maxZ: -5.5, bottomHeight: 0, topHeight: 1.5 },
    // South pyramid ramp
    { minX: -1.5, maxX: 1.5, minZ: 5.5, maxZ: 7, bottomHeight: 1.5, topHeight: 0 },
    // West vine bridge ramp
    { minX: -11, maxX: -9, minZ: -1, maxZ: 1, bottomHeight: 0, topHeight: 2.5, direction: 'x' },
    // East vine bridge ramp
    { minX: 9, maxX: 11, minZ: -1, maxZ: 1, bottomHeight: 2.5, topHeight: 0, direction: 'x' },
  ],
  spawns: [
    { x: -17, z: -17 }, { x: 17, z: -17 },
    { x: -17, z: 17 }, { x: 17, z: 17 },
    { x: -17, z: 0 }, { x: 17, z: 0 },
  ],
  covers: [
    // === CENTRAL PYRAMID (4 tiers) ===
    { x: 0, z: 0, w: 11, h: 1.5, d: 11 },        // Tier 1 base (stand at h=1.5)
    { x: 0, z: 0, w: 8, h: 3, d: 8 },            // Tier 2 (stand at h=3)
    { x: 0, z: 0, w: 5, h: 4.5, d: 5 },          // Tier 3 (stand at h=4.5)
    { x: 0, z: 0, w: 2.5, h: 6, d: 2.5 },        // Tier 4 summit (stand at h=6)

    // Pyramid approach steps (easier access to tier 1)
    { x: 0, z: -6.5, w: 3, h: 0.7, d: 1.5 },     // North steps
    { x: 0, z: 6.5, w: 3, h: 0.7, d: 1.5 },      // South steps
    { x: 6.5, z: 0, w: 1.5, h: 0.7, d: 3 },      // East steps
    { x: -6.5, z: 0, w: 1.5, h: 0.7, d: 3 },     // West steps

    // === TEMPLE RUINS (4 corners) ===
    // NW temple ruin
    { x: -13, z: -13, w: 4, h: 3.5, d: 4 },
    { x: -11, z: -15, w: 0.5, h: 2.5, d: 3.5 },  // Broken wall
    { x: -13, z: -10, w: 2.5, h: 1.2, d: 2 },    // Rubble step

    // NE temple ruin
    { x: 13, z: -13, w: 4, h: 4, d: 4 },
    { x: 15, z: -13, w: 0.5, h: 2, d: 3.5 },
    { x: 13, z: -10, w: 2.5, h: 1.3, d: 2 },

    // SW temple ruin
    { x: -13, z: 13, w: 4, h: 4, d: 4 },
    { x: -15, z: 13, w: 0.5, h: 2, d: 3.5 },
    { x: -13, z: 10, w: 2.5, h: 1.3, d: 2 },

    // SE temple ruin
    { x: 13, z: 13, w: 4, h: 3.5, d: 4 },
    { x: 11, z: 15, w: 0.5, h: 2.5, d: 3.5 },
    { x: 13, z: 10, w: 2.5, h: 1.2, d: 2 },

    // === VINE BRIDGE PILLARS (connecting ruins at elevation) ===
    // West bridge (NW to SW at h=2.5)
    { x: -13, z: -6, w: 1.3, h: 2.5, d: 1.3 },
    { x: -13, z: -3, w: 1.3, h: 2.5, d: 1.3 },
    { x: -13, z: 0, w: 1.3, h: 2.5, d: 1.3 },
    { x: -13, z: 3, w: 1.3, h: 2.5, d: 1.3 },
    { x: -13, z: 6, w: 1.3, h: 2.5, d: 1.3 },

    // East bridge (NE to SE at h=2.5)
    { x: 13, z: -6, w: 1.3, h: 2.5, d: 1.3 },
    { x: 13, z: -3, w: 1.3, h: 2.5, d: 1.3 },
    { x: 13, z: 0, w: 1.3, h: 2.5, d: 1.3 },
    { x: 13, z: 3, w: 1.3, h: 2.5, d: 1.3 },
    { x: 13, z: 6, w: 1.3, h: 2.5, d: 1.3 },

    // === ALTAR PLATFORMS ===
    { x: -7, z: 7, w: 2.5, h: 1.8, d: 2.5 },
    { x: 7, z: -7, w: 2.5, h: 1.8, d: 2.5 },

    // === STONE PILLARS (tall, narrow) ===
    { x: -8, z: -8, w: 0.8, h: 4.5, d: 0.8 },
    { x: 8, z: 8, w: 0.8, h: 4.5, d: 0.8 },
    { x: 5, z: -5, w: 0.6, h: 3.5, d: 0.6 },
    { x: -5, z: 5, w: 0.6, h: 3.5, d: 0.6 },

    // === GROUND COVER (vegetation blocks, rubble) ===
    { x: -6, z: -15, w: 2, h: 0.8, d: 2 },
    { x: 6, z: 15, w: 2, h: 0.8, d: 2 },
    { x: -16, z: 6, w: 2, h: 0.8, d: 2 },
    { x: 16, z: -6, w: 2, h: 0.8, d: 2 },
    { x: -16, z: -3, w: 1.5, h: 1, d: 3 },
    { x: 16, z: 3, w: 1.5, h: 1, d: 3 },
    { x: -3, z: -16, w: 3, h: 1, d: 1.5 },
    { x: 3, z: 16, w: 3, h: 1, d: 1.5 },

    // Fallen column
    { x: 9, z: 0, w: 4, h: 0.6, d: 0.8 },
    { x: -9, z: 0, w: 4, h: 0.6, d: 0.8 },

    // Mid-height stepping stones (parkour between ruins and pyramid)
    { x: -8, z: 0, w: 2, h: 1.5, d: 2 },
    { x: 8, z: 0, w: 2, h: 1.5, d: 2 },
    { x: 0, z: -9, w: 2, h: 1.5, d: 2 },
    { x: 0, z: 9, w: 2, h: 1.5, d: 2 },
  ],
};

// ============ MEGA ARENA (massive, multi-biome, extreme complexity) ============
const MEGA_ARENA: MapDef = {
  id: 'mega_arena',
  name: 'Mega Arena',
  groundColor: '#546e7a',
  wallColor: '#37474f',
  coverColor: '#607d8b',
  skyColor: '#e65100',
  fogColor: '#bf360c',
  gridColor: '#ff6d00',
  groundPlatforms: [
    // Raised platform areas per compound
    { x: -14, z: -12, w: 10, d: 8, y: 0.15, color: '#455a64' },  // NW military
    { x: 14, z: -13, w: 10, d: 10, y: 0.1, color: '#6d4c41' },    // NE ruins
    { x: -13, z: 13, w: 10, d: 10, y: 0.12, color: '#546e7a' },   // SW industrial
    { x: 13, z: 13, w: 10, d: 10, y: 0.15, color: '#4e342e' },    // SE fortress
  ],
  floors: [
    // NW watchtower upper floor
    { x: -17, z: -12, w: 3, d: 3, height: 4, thickness: 0.2, color: '#455a64', railings: ['north', 'south', 'east', 'west'] },
    // SE turret upper floor
    { x: 16, z: 13, w: 3, d: 3, height: 5.5, thickness: 0.2, color: '#4e342e', railings: ['north', 'south', 'east', 'west'] },
    // North bridge walkway
    { x: 0, z: -13, w: 20, d: 2.5, height: 3, thickness: 0.2, color: '#607d8b', railings: ['north', 'south'] },
    // South bridge walkway
    { x: 0, z: 13, w: 20, d: 2.5, height: 3, thickness: 0.2, color: '#607d8b', railings: ['north', 'south'] },
  ],
  pools: [
    { x: -14, z: -14, w: 6, d: 6, depth: 0.8 },  // NW lava pool
    { x: 14, z: 14, w: 6, d: 6, depth: 0.8 },     // SE lava pool
    { x: 0, z: 0, w: 4, d: 4, depth: 0.5 },       // Center pit
    { x: -14, z: 14, w: 4, d: 4, depth: 0.6 },    // SW pool
    { x: 14, z: -14, w: 4, d: 4, depth: 0.6 },    // NE pool
  ],
  ramps: [
    // Central fortress slide (north face)
    { minX: -1, maxX: 1, startZ: -4, endZ: -8, topHeight: 5, bottomHeight: 0, slideForce: 4 },
    // Central fortress slide (south face)
    { minX: -1, maxX: 1, startZ: 4, endZ: 8, topHeight: 5, bottomHeight: 0, slideForce: 4 },
  ],
  ladders: [
    // Central fortress access ladders
    { minX: -4, maxX: -2.5, minZ: -1, maxZ: 1, bottomHeight: 0, topHeight: 3, direction: 'x' },
    { minX: 2.5, maxX: 4, minZ: -1, maxZ: 1, bottomHeight: 3, topHeight: 0, direction: 'x' },
    // NW compound ramp
    { minX: -16.5, maxX: -14.5, minZ: -10, maxZ: -8, bottomHeight: 0, topHeight: 2.5 },
    // SE compound ramp
    { minX: 14.5, maxX: 16.5, minZ: 8, maxZ: 10, bottomHeight: 0, topHeight: 2.5 },
    // West bridge ramp
    { minX: -12, maxX: -10, minZ: 4, maxZ: 6, bottomHeight: 0, topHeight: 3.5 },
    // East bridge ramp
    { minX: 10, maxX: 12, minZ: -6, maxZ: -4, bottomHeight: 0, topHeight: 3.5 },
  ],
  spawns: [
    { x: -17, z: -17 }, { x: 17, z: -17 },
    { x: -17, z: 17 }, { x: 17, z: 17 },
    { x: -17, z: 0 }, { x: 17, z: 0 },
    { x: 0, z: -17 }, { x: 0, z: 17 },
  ],
  covers: [
    // ===== CENTRAL FORTRESS (5-tier mega structure) =====
    { x: 0, z: 0, w: 8, h: 2, d: 8 },            // Tier 1 base
    { x: 0, z: 0, w: 6, h: 3.5, d: 6 },          // Tier 2
    { x: 0, z: 0, w: 4, h: 5, d: 4 },            // Tier 3
    { x: 0, z: 0, w: 2.5, h: 6.5, d: 2.5 },      // Tier 4
    { x: 0, z: 0, w: 1.2, h: 8, d: 1.2 },        // Tier 5 spire

    // Fortress buttresses (stepping stones to climb)
    { x: -5, z: -5, w: 2, h: 1, d: 2 },
    { x: 5, z: 5, w: 2, h: 1, d: 2 },
    { x: -5, z: 5, w: 2, h: 1, d: 2 },
    { x: 5, z: -5, w: 2, h: 1, d: 2 },

    // ===== NW COMPOUND (military base style) =====
    { x: -14, z: -12, w: 6, h: 3, d: 4 },        // Main building
    { x: -14, z: -8, w: 4, h: 2.5, d: 2 },       // Annex
    { x: -17, z: -12, w: 2, h: 4, d: 2 },        // Guard tower
    { x: -11, z: -14, w: 2, h: 1.5, d: 3 },      // Wall segment
    { x: -17, z: -8, w: 2, h: 1, d: 2 },         // Sandbag
    { x: -12, z: -10, w: 1.5, h: 1.8, d: 1.5 },  // Crate stack

    // ===== NE COMPOUND (ruins style) =====
    { x: 14, z: -13, w: 5, h: 4, d: 5 },         // Ruined tower
    { x: 11, z: -15, w: 0.5, h: 3, d: 4 },       // Broken wall E
    { x: 17, z: -13, w: 0.5, h: 2.5, d: 6 },     // Broken wall W
    { x: 14, z: -9, w: 3, h: 1.5, d: 2 },        // Rubble step
    { x: 12, z: -11, w: 1.5, h: 2, d: 1.5 },     // Pillar

    // ===== SW COMPOUND (industrial) =====
    { x: -13, z: 13, w: 5, h: 3.5, d: 5 },       // Factory block
    { x: -13, z: 9, w: 3, h: 2, d: 2 },          // Pipe stack
    { x: -16, z: 13, w: 2, h: 5, d: 2 },         // Smokestack
    { x: -10, z: 15, w: 2, h: 1.2, d: 3 },       // Conveyor belt
    { x: -15, z: 10, w: 1.5, h: 1.5, d: 1.5 },   // Barrel

    // ===== SE COMPOUND (fortress/castle) =====
    { x: 13, z: 13, w: 5, h: 4.5, d: 5 },        // Keep
    { x: 16, z: 13, w: 2, h: 5.5, d: 2 },        // Turret
    { x: 13, z: 16, w: 2, h: 5.5, d: 2 },        // Turret 2
    { x: 10, z: 13, w: 2, h: 2, d: 3 },          // Low wall
    { x: 13, z: 10, w: 3, h: 2, d: 2 },          // Low wall 2
    { x: 11, z: 11, w: 1.5, h: 1, d: 1.5 },      // Step to keep
    { x: 12, z: 12, w: 1.5, h: 2.5, d: 1.5 },    // Mid step

    // ===== CONNECTING BRIDGES (elevated walkways via pillar chains) =====
    // North corridor (NW to NE at h=3)
    { x: -8, z: -13, w: 2, h: 3, d: 2 },
    { x: -4, z: -13, w: 2, h: 3, d: 2 },
    { x: 0, z: -13, w: 2, h: 3, d: 2 },
    { x: 4, z: -13, w: 2, h: 3, d: 2 },
    { x: 8, z: -13, w: 2, h: 3, d: 2 },

    // South corridor (SW to SE at h=3)
    { x: -8, z: 13, w: 2, h: 3, d: 2 },
    { x: -4, z: 13, w: 2, h: 3, d: 2 },
    { x: 0, z: 13, w: 2, h: 3, d: 2 },
    { x: 4, z: 13, w: 2, h: 3, d: 2 },
    { x: 8, z: 13, w: 2, h: 3, d: 2 },

    // West corridor (NW to SW at h=3.5)
    { x: -14, z: -4, w: 2, h: 3.5, d: 2 },
    { x: -14, z: 0, w: 2, h: 3.5, d: 2 },
    { x: -14, z: 4, w: 2, h: 3.5, d: 2 },

    // East corridor (NE to SE at h=3.5)
    { x: 14, z: -4, w: 2, h: 3.5, d: 2 },
    { x: 14, z: 0, w: 2, h: 3.5, d: 2 },
    { x: 14, z: 4, w: 2, h: 3.5, d: 2 },

    // ===== DIAGONAL OUTPOSTS =====
    { x: -8, z: -8, w: 3, h: 2.5, d: 3 },
    { x: 8, z: -8, w: 3, h: 2.5, d: 3 },
    { x: -8, z: 8, w: 3, h: 2.5, d: 3 },
    { x: 8, z: 8, w: 3, h: 2.5, d: 3 },

    // ===== MID-FIELD COVER (scattered) =====
    // Trenches (low walls)
    { x: -6, z: 0, w: 0.5, h: 1.5, d: 6 },
    { x: 6, z: 0, w: 0.5, h: 1.5, d: 6 },
    { x: 0, z: -6, w: 6, h: 1.5, d: 0.5 },
    { x: 0, z: 6, w: 6, h: 1.5, d: 0.5 },

    // Scattered rocks / debris
    { x: -9, z: 4, w: 1.5, h: 0.8, d: 1.5 },
    { x: 9, z: -4, w: 1.5, h: 0.8, d: 1.5 },
    { x: -4, z: 9, w: 1.5, h: 0.8, d: 1.5 },
    { x: 4, z: -9, w: 1.5, h: 0.8, d: 1.5 },
    { x: -10, z: -3, w: 2, h: 1.2, d: 1 },
    { x: 10, z: 3, w: 2, h: 1.2, d: 1 },
    { x: 3, z: 10, w: 1, h: 1.2, d: 2 },
    { x: -3, z: -10, w: 1, h: 1.2, d: 2 },

    // ===== CORNER BUNKERS (small, low) =====
    { x: -17, z: -17, w: 3, h: 1.5, d: 3 },
    { x: 17, z: -17, w: 3, h: 1.5, d: 3 },
    { x: -17, z: 17, w: 3, h: 1.5, d: 3 },
    { x: 17, z: 17, w: 3, h: 1.5, d: 3 },

    // ===== TALL OBELISKS (vertical landmarks) =====
    { x: -7, z: -17, w: 0.8, h: 6, d: 0.8 },
    { x: 7, z: 17, w: 0.8, h: 6, d: 0.8 },
    { x: -17, z: 7, w: 0.8, h: 6, d: 0.8 },
    { x: 17, z: -7, w: 0.8, h: 6, d: 0.8 },

    // ===== UPPER PLATFORMS (sniper perches) =====
    { x: -17, z: -4, w: 3, h: 4.5, d: 3 },
    { x: 17, z: 4, w: 3, h: 4.5, d: 3 },
    // Step access to sniper perches
    { x: -17, z: -1, w: 2, h: 1.5, d: 2 },
    { x: -17, z: -2.5, w: 1.5, h: 3, d: 1.5 },
    { x: 17, z: 1, w: 2, h: 1.5, d: 2 },
    { x: 17, z: 2.5, w: 1.5, h: 3, d: 1.5 },
  ],
};

export const MAPS: Record<MapId, MapDef> = {
  aqua_park: AQUA_PARK,
  pirate_cove: PIRATE_COVE,
  neon_city: NEON_CITY,
  sky_fortress: SKY_FORTRESS,
  jungle_temple: JUNGLE_TEMPLE,
  mega_arena: MEGA_ARENA,
};

export const MAP_IDS: MapId[] = ['aqua_park', 'pirate_cove', 'neon_city', 'sky_fortress', 'jungle_temple', 'mega_arena'];
export const DEFAULT_MAP: MapId = 'aqua_park';
