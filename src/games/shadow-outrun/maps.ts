import { ShadowOutrunMap, MapType, WallObstacle, ShadowFlickerLight, ShadowLaserBarrier } from './types';

// Helper to create walls concisely
function createWall(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  material: WallObstacle['material'] = 'yellow_wallpaper',
  isGlass: boolean = false
): WallObstacle {
  return { id, x, y, width, height, material, isGlass };
}

// -----------------------------------------------------------------------------
// 1. BACKROOMS LABYRINTH MAP (Endless yellow hallways, partitions, buzzing lights)
// -----------------------------------------------------------------------------
const backroomsWalls: WallObstacle[] = [
  // Outer Boundaries
  createWall('b_bound_top', 0, 0, 2400, 40, 'yellow_wallpaper'),
  createWall('b_bound_bottom', 0, 1560, 2400, 40, 'yellow_wallpaper'),
  createWall('b_bound_left', 0, 0, 40, 1600, 'yellow_wallpaper'),
  createWall('b_bound_right', 2360, 0, 40, 1600, 'yellow_wallpaper'),

  // Central Hub & Maze Partitions
  createWall('b_c1', 500, 200, 40, 400, 'yellow_wallpaper'),
  createWall('b_c2', 500, 200, 300, 40, 'yellow_wallpaper'),
  createWall('b_c3', 950, 150, 40, 350, 'yellow_wallpaper'),
  createWall('b_c4', 750, 450, 400, 40, 'yellow_wallpaper'),

  createWall('b_c5', 1350, 100, 40, 400, 'yellow_wallpaper'),
  createWall('b_c6', 1550, 300, 350, 40, 'yellow_wallpaper'),
  createWall('b_c7', 1850, 200, 40, 450, 'yellow_wallpaper'),

  // Midfield Rooms and Corridors
  createWall('b_m1', 250, 750, 350, 40, 'yellow_wallpaper'),
  createWall('b_m2', 250, 750, 40, 300, 'yellow_wallpaper'),
  createWall('b_m3', 450, 900, 40, 350, 'yellow_wallpaper'),
  createWall('b_m4', 650, 650, 40, 400, 'yellow_wallpaper'),

  // Central Partition Pillar Complex
  createWall('b_center_box1', 1050, 650, 300, 40, 'yellow_wallpaper'),
  createWall('b_center_box2', 1050, 950, 300, 40, 'yellow_wallpaper'),
  createWall('b_center_p1', 1050, 650, 40, 120, 'yellow_wallpaper'),
  createWall('b_center_p2', 1310, 830, 40, 160, 'yellow_wallpaper'),
  createWall('b_center_pillar', 1170, 770, 60, 60, 'yellow_wallpaper'),

  // East Side Corridor Labyrinth
  createWall('b_e1', 1500, 600, 40, 350, 'yellow_wallpaper'),
  createWall('b_e2', 1500, 750, 300, 40, 'yellow_wallpaper'),
  createWall('b_e3', 1950, 600, 40, 500, 'yellow_wallpaper'),
  createWall('b_e4', 1650, 1000, 340, 40, 'yellow_wallpaper'),

  // South Wing Partitions
  createWall('b_s1', 250, 1250, 450, 40, 'yellow_wallpaper'),
  createWall('b_s2', 850, 1200, 40, 360, 'yellow_wallpaper'),
  createWall('b_s3', 850, 1350, 350, 40, 'yellow_wallpaper'),
  createWall('b_s4', 1350, 1200, 40, 360, 'yellow_wallpaper'),
  createWall('b_s5', 1500, 1300, 450, 40, 'yellow_wallpaper'),
  createWall('b_s6', 2100, 1150, 40, 300, 'yellow_wallpaper'),
  createWall('b_s7', 1850, 1400, 40, 160, 'yellow_wallpaper'),

  // Extra Corner Pillars
  createWall('b_p_nw', 250, 250, 80, 80, 'yellow_wallpaper'),
  createWall('b_p_ne', 2100, 250, 80, 80, 'yellow_wallpaper'),
  createWall('b_p_sw', 450, 1400, 80, 80, 'yellow_wallpaper'),
  createWall('b_p_se', 2100, 1450, 80, 80, 'yellow_wallpaper'),
];

const backroomsLights: ShadowFlickerLight[] = [
  { x: 400, y: 350, radius: 180, intensity: 0.6, baseIntensity: 0.6, color: '#ffee88', flickerSpeed: 12, flickerPhase: 0.1 },
  { x: 1200, y: 300, radius: 240, intensity: 0.8, baseIntensity: 0.8, color: '#fff3aa', flickerSpeed: 8, flickerPhase: 1.5 },
  { x: 2000, y: 400, radius: 200, intensity: 0.7, baseIntensity: 0.7, color: '#ffee88', flickerSpeed: 15, flickerPhase: 2.3 },
  { x: 600, y: 900, radius: 220, intensity: 0.5, baseIntensity: 0.5, color: '#e6c86e', flickerSpeed: 20, flickerPhase: 3.8 },
  { x: 1200, y: 800, radius: 260, intensity: 0.9, baseIntensity: 0.9, color: '#fffbcf', flickerSpeed: 6, flickerPhase: 0.7 },
  { x: 1800, y: 850, radius: 200, intensity: 0.65, baseIntensity: 0.65, color: '#ffee88', flickerSpeed: 11, flickerPhase: 4.2 },
  { x: 500, y: 1350, radius: 200, intensity: 0.75, baseIntensity: 0.75, color: '#fff3aa', flickerSpeed: 14, flickerPhase: 5.1 },
  { x: 1200, y: 1400, radius: 220, intensity: 0.6, baseIntensity: 0.6, color: '#e6c86e', flickerSpeed: 18, flickerPhase: 1.2 },
  { x: 1950, y: 1300, radius: 230, intensity: 0.8, baseIntensity: 0.8, color: '#ffee88', flickerSpeed: 7, flickerPhase: 2.9 },
];

// -----------------------------------------------------------------------------
// 2. DUNGEON CATACOMBS MAP (Dark stone pillars, prison cells, secret corridors)
// -----------------------------------------------------------------------------
const dungeonWalls: WallObstacle[] = [
  // Outer Stone Citadel
  createWall('d_bound_top', 0, 0, 2400, 48, 'stone_pillar'),
  createWall('d_bound_bottom', 0, 1552, 2400, 48, 'stone_pillar'),
  createWall('d_bound_left', 0, 0, 48, 1600, 'stone_pillar'),
  createWall('d_bound_right', 2352, 0, 48, 1600, 'stone_pillar'),

  // North Prison Cells (West & East)
  createWall('d_cell_w1', 200, 200, 400, 36, 'stone_pillar'),
  createWall('d_cell_w2', 200, 200, 36, 300, 'stone_pillar'),
  createWall('d_cell_w3', 600, 200, 36, 180, 'stone_pillar'), // Gap for cell door

  createWall('d_cell_e1', 1800, 200, 400, 36, 'stone_pillar'),
  createWall('d_cell_e2', 2164, 200, 36, 300, 'stone_pillar'),
  createWall('d_cell_e3', 1800, 200, 36, 180, 'stone_pillar'),

  // Catacomb Pillars (Colonnade Array)
  createWall('d_pil_1', 450, 650, 70, 70, 'stone_pillar'),
  createWall('d_pil_2', 450, 950, 70, 70, 'stone_pillar'),
  createWall('d_pil_3', 750, 650, 70, 70, 'stone_pillar'),
  createWall('d_pil_4', 750, 950, 70, 70, 'stone_pillar'),

  createWall('d_pil_5', 1580, 650, 70, 70, 'stone_pillar'),
  createWall('d_pil_6', 1580, 950, 70, 70, 'stone_pillar'),
  createWall('d_pil_7', 1880, 650, 70, 70, 'stone_pillar'),
  createWall('d_pil_8', 1880, 950, 70, 70, 'stone_pillar'),

  // Central Crypt / Sacrificial Chamber
  createWall('d_crypt_top', 1000, 500, 400, 36, 'stone_pillar'),
  createWall('d_crypt_bot', 1000, 1064, 400, 36, 'stone_pillar'),
  createWall('d_crypt_left_t', 1000, 500, 36, 180, 'stone_pillar'),
  createWall('d_crypt_left_b', 1000, 920, 36, 180, 'stone_pillar'),
  createWall('d_crypt_right_t', 1364, 500, 36, 180, 'stone_pillar'),
  createWall('d_crypt_right_b', 1364, 920, 36, 180, 'stone_pillar'),
  createWall('d_sarcophagus', 1130, 730, 140, 140, 'stone_pillar'),

  // South Torture Chamber & Escape Tunnels
  createWall('d_s_wall1', 200, 1250, 500, 36, 'stone_pillar'),
  createWall('d_s_wall2', 550, 1250, 36, 300, 'stone_pillar'),
  createWall('d_s_wall3', 900, 1250, 600, 36, 'stone_pillar'),
  createWall('d_s_wall4', 1700, 1250, 500, 36, 'stone_pillar'),
  createWall('d_s_wall5', 1850, 1250, 36, 300, 'stone_pillar'),

  // Secret Maze Barriers
  createWall('d_sec_1', 850, 250, 36, 250, 'stone_pillar'),
  createWall('d_sec_2', 1514, 250, 36, 250, 'stone_pillar'),
  createWall('d_sec_3', 300, 800, 150, 36, 'stone_pillar'),
  createWall('d_sec_4', 1950, 800, 150, 36, 'stone_pillar'),
];

const dungeonLights: ShadowFlickerLight[] = [
  { x: 350, y: 350, radius: 220, intensity: 0.85, baseIntensity: 0.85, color: '#ff7722', flickerSpeed: 10, flickerPhase: 0.4 },
  { x: 2050, y: 350, radius: 220, intensity: 0.85, baseIntensity: 0.85, color: '#ff7722', flickerSpeed: 11, flickerPhase: 2.1 },
  { x: 1200, y: 400, radius: 260, intensity: 0.9, baseIntensity: 0.9, color: '#ffaa33', flickerSpeed: 7, flickerPhase: 1.1 },
  { x: 1200, y: 800, radius: 300, intensity: 1.0, baseIntensity: 1.0, color: '#ff4400', flickerSpeed: 5, flickerPhase: 3.5 },
  { x: 1200, y: 1200, radius: 250, intensity: 0.8, baseIntensity: 0.8, color: '#ff8822', flickerSpeed: 9, flickerPhase: 4.8 },
  { x: 400, y: 1400, radius: 200, intensity: 0.7, baseIntensity: 0.7, color: '#ff6611', flickerSpeed: 13, flickerPhase: 0.9 },
  { x: 2000, y: 1400, radius: 200, intensity: 0.7, baseIntensity: 0.7, color: '#ff6611', flickerSpeed: 12, flickerPhase: 5.7 },
];

// -----------------------------------------------------------------------------
// 3. CYBER VAULT MAP (High-security lasers, glass partition vaults, neon corridors)
// -----------------------------------------------------------------------------
const cyberVaultWalls: WallObstacle[] = [
  // Outer Cyber Titanium Wall
  createWall('cv_bound_top', 0, 0, 2400, 44, 'metal_crate'),
  createWall('cv_bound_bottom', 0, 1556, 2400, 44, 'metal_crate'),
  createWall('cv_bound_left', 0, 0, 44, 1600, 'metal_crate'),
  createWall('cv_bound_right', 2356, 0, 44, 1600, 'metal_crate'),

  // Glass Partition Laboratories (Permeable to flashlight, solid to movement!)
  createWall('cv_glass_nw', 250, 200, 400, 28, 'cyber_glass', true),
  createWall('cv_glass_nw_v', 250, 200, 28, 350, 'cyber_glass', true),
  createWall('cv_glass_ne', 1750, 200, 400, 28, 'cyber_glass', true),
  createWall('cv_glass_ne_v', 2122, 200, 28, 350, 'cyber_glass', true),
  createWall('cv_glass_sw', 250, 1350, 400, 28, 'cyber_glass', true),
  createWall('cv_glass_sw_v', 250, 1050, 28, 328, 'cyber_glass', true),
  createWall('cv_glass_se', 1750, 1350, 400, 28, 'cyber_glass', true),
  createWall('cv_glass_se_v', 2122, 1050, 28, 328, 'cyber_glass', true),

  // Central High-Security Core Vault (Double Ring)
  createWall('cv_vault_t1', 950, 450, 500, 36, 'metal_crate'),
  createWall('cv_vault_b1', 950, 1114, 500, 36, 'metal_crate'),
  createWall('cv_vault_l1', 950, 450, 36, 220, 'metal_crate'),
  createWall('cv_vault_l2', 950, 930, 36, 220, 'metal_crate'),
  createWall('cv_vault_r1', 1414, 450, 36, 220, 'metal_crate'),
  createWall('cv_vault_r2', 1414, 930, 36, 220, 'metal_crate'),

  // Inner Vault Safe Pillar
  createWall('cv_inner_safe', 1120, 720, 160, 160, 'neon_barrier'),

  // Server Racks & Corridors
  createWall('cv_rack_w1', 550, 600, 180, 40, 'metal_crate'),
  createWall('cv_rack_w2', 550, 750, 180, 40, 'metal_crate'),
  createWall('cv_rack_w3', 550, 900, 180, 40, 'metal_crate'),

  createWall('cv_rack_e1', 1670, 600, 180, 40, 'metal_crate'),
  createWall('cv_rack_e2', 1670, 750, 180, 40, 'metal_crate'),
  createWall('cv_rack_e3', 1670, 900, 180, 40, 'metal_crate'),

  // North & South Perimeter Barriers
  createWall('cv_north_bar', 1050, 220, 300, 36, 'neon_barrier'),
  createWall('cv_south_bar', 1050, 1344, 300, 36, 'neon_barrier'),
];

const cyberVaultLights: ShadowFlickerLight[] = [
  { x: 450, y: 350, radius: 240, intensity: 0.8, baseIntensity: 0.8, color: '#00e5ff', flickerSpeed: 5, flickerPhase: 0.2 },
  { x: 1950, y: 350, radius: 240, intensity: 0.8, baseIntensity: 0.8, color: '#ff007f', flickerSpeed: 6, flickerPhase: 1.8 },
  { x: 1200, y: 800, radius: 340, intensity: 1.0, baseIntensity: 1.0, color: '#00f5a0', flickerSpeed: 4, flickerPhase: 0 },
  { x: 450, y: 1200, radius: 240, intensity: 0.8, baseIntensity: 0.8, color: '#ff007f', flickerSpeed: 7, flickerPhase: 2.7 },
  { x: 1950, y: 1200, radius: 240, intensity: 0.8, baseIntensity: 0.8, color: '#00e5ff', flickerSpeed: 5, flickerPhase: 4.1 },
  { x: 1200, y: 220, radius: 220, intensity: 0.7, baseIntensity: 0.7, color: '#9d4edd', flickerSpeed: 8, flickerPhase: 3.3 },
  { x: 1200, y: 1380, radius: 220, intensity: 0.7, baseIntensity: 0.7, color: '#9d4edd', flickerSpeed: 8, flickerPhase: 1.0 },
];

const cyberVaultLasers: ShadowLaserBarrier[] = [
  { id: 'laser_n', x1: 850, y1: 340, x2: 1550, y2: 340, color: '#ff0055', state: 'pulsing', cycleTimer: 0, cycleDuration: 4.0 },
  { id: 'laser_s', x1: 850, y1: 1260, x2: 1550, y2: 1260, color: '#ff0055', state: 'pulsing', cycleTimer: 2.0, cycleDuration: 4.0 },
  { id: 'laser_w', x1: 350, y1: 700, x2: 350, y2: 1000, color: '#00e5ff', state: 'on', cycleTimer: 0, cycleDuration: 5.0 },
  { id: 'laser_e', x1: 2050, y1: 700, x2: 2050, y2: 1000, color: '#00e5ff', state: 'on', cycleTimer: 0, cycleDuration: 5.0 },
];

// -----------------------------------------------------------------------------
// COIN & SPAWN POINT GENERATORS
// -----------------------------------------------------------------------------
const commonSpawnPoints = [
  { x: 1200, y: 800, role: 'catcher' as const }, // Catcher in central vantage point
  { x: 200, y: 200, role: 'thief' as const },
  { x: 2200, y: 200, role: 'thief' as const },
  { x: 200, y: 1400, role: 'thief' as const },
  { x: 2200, y: 1400, role: 'thief' as const },
  { x: 1200, y: 200, role: 'thief' as const },
  { x: 1200, y: 1400, role: 'thief' as const },
  { x: 600, y: 800, role: 'thief' as const },
  { x: 1800, y: 800, role: 'thief' as const },
];

const backroomsCoinSpawns = [
  { x: 380, y: 350, type: 'coin' as const },
  { x: 680, y: 320, type: 'coin' as const },
  { x: 1100, y: 220, type: 'diamond' as const },
  { x: 1600, y: 180, type: 'coin' as const },
  { x: 2100, y: 350, type: 'coin' as const },
  { x: 350, y: 800, type: 'loot_bag' as const },
  { x: 550, y: 820, type: 'coin' as const },
  { x: 850, y: 600, type: 'coin' as const },
  { x: 850, y: 900, type: 'coin' as const },
  { x: 1200, y: 720, type: 'diamond' as const },
  { x: 1200, y: 880, type: 'diamond' as const },
  { x: 1550, y: 680, type: 'coin' as const },
  { x: 1750, y: 850, type: 'coin' as const },
  { x: 2150, y: 800, type: 'loot_bag' as const },
  { x: 400, y: 1100, type: 'coin' as const },
  { x: 400, y: 1450, type: 'coin' as const },
  { x: 700, y: 1400, type: 'coin' as const },
  { x: 1100, y: 1450, type: 'diamond' as const },
  { x: 1500, y: 1450, type: 'coin' as const },
  { x: 1750, y: 1200, type: 'coin' as const },
  { x: 2000, y: 1350, type: 'coin' as const },
  { x: 2200, y: 1200, type: 'loot_bag' as const },
  { x: 800, y: 300, type: 'coin' as const },
  { x: 1600, y: 450, type: 'coin' as const },
  { x: 1400, y: 1050, type: 'coin' as const },
  { x: 1000, y: 1050, type: 'coin' as const },
];

const dungeonCoinSpawns = [
  { x: 380, y: 320, type: 'loot_bag' as const },
  { x: 400, y: 450, type: 'coin' as const },
  { x: 2000, y: 320, type: 'loot_bag' as const },
  { x: 2000, y: 450, type: 'coin' as const },
  { x: 1200, y: 250, type: 'coin' as const },
  { x: 1200, y: 350, type: 'coin' as const },
  { x: 600, y: 650, type: 'coin' as const },
  { x: 600, y: 950, type: 'coin' as const },
  { x: 1800, y: 650, type: 'coin' as const },
  { x: 1800, y: 950, type: 'coin' as const },
  { x: 1200, y: 650, type: 'diamond' as const },
  { x: 1200, y: 950, type: 'diamond' as const },
  { x: 1070, y: 800, type: 'diamond' as const },
  { x: 1330, y: 800, type: 'diamond' as const },
  { x: 350, y: 1400, type: 'loot_bag' as const },
  { x: 750, y: 1400, type: 'coin' as const },
  { x: 1200, y: 1400, type: 'coin' as const },
  { x: 1650, y: 1400, type: 'coin' as const },
  { x: 2050, y: 1400, type: 'loot_bag' as const },
  { x: 300, y: 950, type: 'coin' as const },
  { x: 2100, y: 950, type: 'coin' as const },
  { x: 800, y: 800, type: 'coin' as const },
  { x: 1600, y: 800, type: 'coin' as const },
  { x: 950, y: 380, type: 'coin' as const },
  { x: 1450, y: 380, type: 'coin' as const },
];

const cyberVaultCoinSpawns = [
  { x: 450, y: 350, type: 'loot_bag' as const },
  { x: 1950, y: 350, type: 'loot_bag' as const },
  { x: 450, y: 1200, type: 'loot_bag' as const },
  { x: 1950, y: 1200, type: 'loot_bag' as const },
  { x: 1200, y: 620, type: 'diamond' as const },
  { x: 1200, y: 980, type: 'diamond' as const },
  { x: 1020, y: 800, type: 'diamond' as const },
  { x: 1380, y: 800, type: 'diamond' as const },
  { x: 800, y: 600, type: 'coin' as const },
  { x: 800, y: 750, type: 'coin' as const },
  { x: 800, y: 900, type: 'coin' as const },
  { x: 1600, y: 600, type: 'coin' as const },
  { x: 1600, y: 750, type: 'coin' as const },
  { x: 1600, y: 900, type: 'coin' as const },
  { x: 1200, y: 120, type: 'diamond' as const },
  { x: 1200, y: 1480, type: 'diamond' as const },
  { x: 650, y: 250, type: 'coin' as const },
  { x: 1750, y: 250, type: 'coin' as const },
  { x: 650, y: 1350, type: 'coin' as const },
  { x: 1750, y: 1350, type: 'coin' as const },
  { x: 300, y: 600, type: 'coin' as const },
  { x: 2100, y: 600, type: 'coin' as const },
  { x: 1200, y: 800, type: 'diamond' as const }, // Grand Vault Diamond in center
];

// -----------------------------------------------------------------------------
// MAP REPOSITORY DICTIONARY
// -----------------------------------------------------------------------------
export const SHADOW_MAPS: Record<MapType, ShadowOutrunMap> = {
  backrooms: {
    id: 'backrooms',
    name: 'BACKROOMS LABYRINTH',
    subtitle: 'Level 0 - Eerie Fluorescent Corridors',
    description: 'Flickering lights, endless mono-yellow wallpaper partitions, and damp carpeting. Break line of sight to stay in the shadows!',
    width: 2400,
    height: 1600,
    ambientColor: '#121008',
    fogAlpha: 0.90,
    wallFillColor: '#caa746',
    wallBorderColor: '#8a6e25',
    floorColor1: '#262214',
    floorColor2: '#1e1a0f',
    gridSize: 80,
    walls: backroomsWalls,
    flickerLights: backroomsLights,
    spawnPoints: commonSpawnPoints,
    coinSpawnPoints: backroomsCoinSpawns,
  },
  dungeon: {
    id: 'dungeon',
    name: 'DUNGEON CATACOMBS',
    subtitle: 'Forgotten Crypts & Iron Cells',
    description: 'Pitch-black stone colonnades, secret escape routes, and blazing torch sconces. Maneuver behind stone pillars to evade capture.',
    width: 2400,
    height: 1600,
    ambientColor: '#0a0a10',
    fogAlpha: 0.93,
    wallFillColor: '#2b303c',
    wallBorderColor: '#181b22',
    floorColor1: '#14161f',
    floorColor2: '#0e1017',
    gridSize: 80,
    walls: dungeonWalls,
    flickerLights: dungeonLights,
    spawnPoints: commonSpawnPoints,
    coinSpawnPoints: dungeonCoinSpawns,
  },
  cyber_vault: {
    id: 'cyber_vault',
    name: 'CYBER VAULT',
    subtitle: 'High-Tech Security & Laser Grids',
    description: 'High-security titanium banks, glass partition vaults, and pulsing laser tripwires. Flashlights shine through glass, but thieves cannot pass!',
    width: 2400,
    height: 1600,
    ambientColor: '#040714',
    fogAlpha: 0.88,
    wallFillColor: '#101d36',
    wallBorderColor: '#00e5ff',
    floorColor1: '#080e22',
    floorColor2: '#050a18',
    gridSize: 80,
    walls: cyberVaultWalls,
    flickerLights: cyberVaultLights,
    lasers: cyberVaultLasers,
    spawnPoints: commonSpawnPoints,
    coinSpawnPoints: cyberVaultCoinSpawns,
  },
};
