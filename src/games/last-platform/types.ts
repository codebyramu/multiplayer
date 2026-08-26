import { ControllerInput, Player, PlayerClientHUDState, MatchResults, GameEventPayload } from '../../types';

export type TileState = 'stable' | 'warning' | 'crumbling' | 'collapsed' | 'respawning';

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface HexCoord {
  q: number;
  r: number;
  s: number; // q + r + s = 0
}

export interface PlatformTileData {
  id: number;
  q: number;
  r: number;
  s: number;
  ring: number;
  worldX: number;
  worldY: number;
  baseX: number; // original position before motion/oscillation
  baseY: number;
  size: number;
  height: number; // 3D prism extrusion height (e.g. 18-24px)
  
  // State machine
  state: TileState;
  stateTimer: number; // Seconds spent in current state
  warningDuration: number;
  crumblingDuration: number;
  fallProgress: number; // 0.0 (grounded) to 1.0 (vanished in void)
  fallVelocityZ: number;
  fallRotation: number;
  fallRotationSpeed: number;
  
  // Dynamic behavior
  isSteppedOn: boolean;
  stepCooldown: number;
  shakeIntensity: number;
  crackSeed: number; // Random seed to generate consistent crack lines
  glowPulsePhase: number;
  
  // Moving platform properties
  isMoving?: boolean;
  moveAngle?: number;
  moveRadius?: number;
  moveSpeed?: number;
  moveCenter?: Point2D;
}

export interface PlayerPhysicsState {
  id: string;
  name: string;
  avatar: string;
  color: string;
  skin?: string;
  isBot: boolean;
  botArchetype?: 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic';
  
  // Position & 3D Jump Elevation
  x: number;
  y: number;
  z: number; // Jump height (0 = ground, > 0 = airborne, < 0 = falling in void)
  vx: number;
  vy: number;
  vz: number; // Vertical jump/fall velocity
  
  // Orientation & Movement
  facingAngle: number;
  moveMagnitude: number;
  isGrounded: boolean;
  isAirborne: boolean;
  isFallingIntoVoid: boolean;
  fallTumbleAngle: number;
  fallTumbleSpeed: number;
  
  // Jump & Air Hop System
  canJump: boolean;
  jumpsRemaining: number;
  maxJumps: number; // 2 (Ground jump + 1 air hop)
  jumpCooldownTimer: number;
  
  // Air Dash Ability
  canDash: boolean;
  dashCooldown: number;
  dashCooldownMax: number;
  isDashing: boolean;
  dashDuration: number;
  dashVector: Point2D;
  
  // Gravity Shockwave Push Ability
  shockwaveCooldown: number;
  shockwaveCooldownMax: number;
  isShockwaving: boolean;
  shockwaveAnimTimer: number;
  
  // Electric Freeze Shot Ability (7s cooldown, 2s freeze duration)
  freezeShotCooldown: number;
  freezeShotCooldownMax: number;
  isFrozen: boolean;
  freezeTimer: number;
  
  // Status & Match Lifecycle
  isEliminated: boolean;
  eliminateTime: number;
  placementRank: number;
  score: number;
  kills: number;
  shovesLanded: number;
  airHopsUsed: number;
  timeSurvived: number;
  
  // Current tile context
  currentTileId: number | null;
  lastSafeTileId: number | null;
  lastSafeX: number;
  lastSafeY: number;
  
  // Visual polish
  trail: Array<{ x: number; y: number; z: number; alpha: number; color: string }>;
  hitFlashTimer: number;
  scale: number;
  opacity: number;
}

export interface ShockwaveEffect {
  id: string;
  sourcePlayerId: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  force: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape: 'circle' | 'square' | 'shard' | 'ring' | 'smoke' | 'spark';
  rotation: number;
  rotationSpeed: number;
  gravity: number;
  drag: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
  fontSize: number;
  alpha: number;
  life: number;
  maxLife: number;
  vy: number;
}

export interface EliminationBanner {
  id: string;
  playerId: string;
  playerName: string;
  playerColor: string;
  rank: number;
  totalPlayers: number;
  life: number;
  maxLife: number;
  alpha: number;
}

export interface LastPlatformConfig {
  gridRadius: number; // Number of hex rings (e.g. 5 = 61 tiles, 6 = 91 tiles)
  tileSize: number; // Hex tile outer radius in px (e.g. 48px)
  tileHeight: number; // 3D prism extrusion depth (e.g. 20px)
  roundDuration: number; // Total match duration in seconds
  suddenDeathThreshold: number; // Seconds remaining to trigger Sudden Death (e.g. 25s)
  playerMoveSpeed: number;
  playerJumpForce: number;
  playerAirHopForce: number;
  playerDashForce: number;
  gravity: number;
  shockwaveRadius: number;
  shockwaveForce: number;
  shockwaveCooldown: number;
  dashCooldown: number;
  warningDuration: number;
  crumblingDuration: number;
  movingPlatformsCount: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'normal' | 'extreme';
}

export interface ElectricFreezeProjectile {
  id: string;
  shooterId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  lifetime: number;
  radius: number;
}

export interface LastPlatformSnapshot {
  timeRemaining: number;
  elapsedTime: number;
  isSuddenDeath: boolean;
  suddenDeathTimer: number;
  dangerRadius: number;
  aliveCount: number;
  totalPlayers: number;
  tiles: PlatformTileData[];
  players: Record<string, PlayerPhysicsState>;
  shockwaves: ShockwaveEffect[];
  projectiles?: ElectricFreezeProjectile[];
}
