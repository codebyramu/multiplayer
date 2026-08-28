import { Player, ControllerInput, PlayerClientHUDState, MatchResults, GameEventPayload, GameId } from '../../types';

export type ShadowRole = 'catcher' | 'thief' | 'deputy';

export type MapType = 'backrooms' | 'dungeon' | 'cyber_vault';

export interface WallObstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isGlass?: boolean;      // Transparent to flashlight beam, blocks movement
  material?: 'yellow_wallpaper' | 'stone_pillar' | 'cyber_glass' | 'metal_crate' | 'neon_barrier';
  color?: string;
  borderColor?: string;
}

export interface CoinEntity {
  id: string;
  x: number;
  y: number;
  value: number;           // Standard +50, Diamond +100
  radius: number;
  type: 'coin' | 'diamond' | 'loot_bag';
  pulsePhase: number;
  collected: boolean;
  collectedBy?: string;
  sparkleTimer: number;
}

export interface ShadowFlickerLight {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  baseIntensity: number;
  color: string;
  flickerSpeed: number;
  flickerPhase: number;
}

export interface ShadowLaserBarrier {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  state: 'on' | 'off' | 'pulsing';
  cycleTimer: number;
  cycleDuration: number;
}

export interface ShadowOutrunMap {
  id: MapType;
  name: string;
  subtitle: string;
  description: string;
  width: number;
  height: number;
  ambientColor: string;
  fogAlpha: number;
  wallFillColor: string;
  wallBorderColor: string;
  floorColor1: string;
  floorColor2: string;
  gridSize: number;
  walls: WallObstacle[];
  flickerLights: ShadowFlickerLight[];
  lasers?: ShadowLaserBarrier[];
  spawnPoints: Array<{ x: number; y: number; role?: ShadowRole }>;
  coinSpawnPoints: Array<{ x: number; y: number; type?: 'coin' | 'diamond' | 'loot_bag' }>;
}

export interface ShadowOutrunPlayer {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isBot: boolean;
  botArchetype?: 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic';
  
  // Role & State
  role: ShadowRole;
  isArrested: boolean;
  arrestedAt?: number;
  arrestedBy?: string;
  
  // Spatial & Physics
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  radius: number;
  
  // Speeds & Slow Mechanics
  baseSpeed: number;        // Thief = 230 px/s, Catcher = 207 px/s (90%)
  currentSpeed: number;
  isSlowed: boolean;        // True when inside active flashlight cone
  slowTimer: number;        // Grace period before slow clears
  speedMultiplier: number;  // 1.0 down to 0.65 (35% speed drop)
  
  // Flashlight (Catchers & Deputies)
  flashlightActive: boolean;
  beamRange: number;        // 260px
  coneSpread: number;       // 60 deg (Math.PI / 3)
  beamAngle: number;        // Facing angle
  flashlightColor: string;
  
  // Sprint / Ability
  dashCooldown: number;
  maxDashCooldown: number;
  isDashing: boolean;
  dashTimer: number;
  
  // Score & Stats
  score: number;
  coinsCollected: number;
  thievesCaught: number;
  survivalTime: number;
  lastScoreTime: number;
  
  // FX & Visuals
  trail: Array<{ x: number; y: number; alpha: number; size: number }>;
  alertState?: 'alert' | 'danger' | 'coin' | 'lost';
  alertTimer?: number;
  footstepTimer: number;
  
  // Bot AI State
  aiTargetX?: number;
  aiTargetY?: number;
  aiTargetPlayerId?: string;
  aiState?: 'patrol' | 'hunt' | 'flee' | 'scavenge' | 'flank';
  aiDecisionTimer?: number;
  aiTickCount?: number;
  aiStuckTimer?: number;
  lastX?: number;
  lastY?: number;
}

export interface ShadowParticle {
  id?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  life: number;
  maxLife: number;
  type?: 'dust' | 'sparkle' | 'coin' | 'siren' | 'smoke' | 'shadow';
}

export interface ShadowFloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  size: number;
  life: number;
  maxLife: number;
  vy: number;
}

export interface ShadowShockwave {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
  speed: number;
}

export interface ShadowOutrunEngineConfig {
  arenaWidth: number;
  arenaHeight: number;
  mapType: MapType;
  roundDuration: number;
  thiefSpeed: number;           // 230 px/s (100%)
  catcherSpeed: number;         // 207 px/s (90%)
  slowDownMultiplier: number;   // 0.65 (35% reduction = 149.5 px/s)
  tagDistance: number;          // 32 px
  flashlightRange: number;      // 260 px
  flashlightConeSpread: number; // 60 deg (Math.PI / 3)
  maxCoins: number;             // 36
  coinValue: number;            // 50 pts
  diamondValue: number;         // 100 pts
  arrestValue: number;          // 150 pts
  difficulty: 'easy' | 'medium' | 'normal' | 'hard' | 'extreme';
}
