import { ControllerInput, Player, PlayerClientHUDState, MatchResults, GameEventPayload } from '../../types';

export type SnakeSkinId = 'synth' | 'mecha' | 'cosmic' | 'glitch' | 'molten';
export type BotPersonality = 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic';

export interface SkinConfig {
  id: SnakeSkinId;
  name: string;
  tagline: string;
  headPrimary: string;
  headSecondary: string;
  bodyGradient: [string, string, string];
  glowColor: string;
  eyeColor: string;
  pupilColor: string;
  spineColor: string;
  particleColor: string;
  accentHex: string;
}

export type FoodType = 'normal' | 'shed' | 'jackpot' | 'magnetic' | 'golden_orb' | 'hyper_boost' | 'ghost_hunt';

export interface FoodPellet {
  id: string;
  type: FoodType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  radius: number;
  baseRadius: number;
  color: string;
  glowColor: string;
  pulsePhase: number;
  spawnTime: number;
  magnetTargetId?: string;
  isAttracted?: boolean;
}

export interface BodyJoint {
  x: number;
  y: number;
  angle: number;
  radius: number;
}

export interface PathHistoryPoint {
  x: number;
  y: number;
  angle: number;
  distance: number; // Cumulative distance from start
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  scale: number;
  alpha: number;
  vy: number;
  life: number;
  maxLife: number;
}

export interface ParticleEffect {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape?: 'circle' | 'square' | 'star' | 'spark' | 'ember';
  rotation?: number;
  rotationSpeed?: number;
}

export interface GoldenStormZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  duration: number;
  remainingTime: number;
  intensity: number;
  pulsePhase: number;
  lastSpawnTime: number;
}

export interface SingularityVortexZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  pullRadius: number;
  duration: number;
  remainingTime: number;
  intensity: number;
  pulsePhase: number;
  rotationAngle: number;
}

export type SerpentModifierId = 'turbo_speed' | 'double_growth' | 'tiny_arena' | 'chaos_mode';

export interface SerpentModifiersConfig {
  turboSpeed?: boolean;
  doubleGrowth?: boolean;
  tinyArena?: boolean;
  chaosMode?: boolean;
}

export interface SerpentPlayerEntity {
  id: string;
  name: string;
  color: string;
  skin: SnakeSkinId;
  isBot: boolean;
  botPersonality?: BotPersonality;
  
  // Physics & Navigation
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  angularVelocity: number;
  speed: number;
  baseSpeed: number;
  boostSpeed: number;
  turnSpeed: number;
  headRadius: number;
  
  // Progression & Mass
  score: number;
  mass: number;
  length: number;
  targetLength: number;
  energy: number;
  maxEnergy: number;
  isBoosting: boolean;
  boostDistanceAccumulator: number;
  continuousBoostDuration: number;
  isOverheating: boolean;
  
  // Multi-Joint Spine & History
  body: BodyJoint[];
  history: PathHistoryPoint[];
  totalDistanceTraveled: number;
  
  // Combat & State
  isDead: boolean;
  deathTime?: number;
  respawnTime?: number;
  kills: number;
  deaths: number;
  killedBy?: string;
  invulnerableTimer: number;
  eyeBlinkTimer: number;
  eyeBlinkState: number; // 0 to 1
  lookAtOffsetAngle: number;
  
  // Visual & Powerup states
  pulseTime: number;
  skinSeed: number;
  isWinner?: boolean;
  difficulty?: 'easy' | 'medium' | 'hard';
  hyperBoostTimer: number; // 5-second automatic free hyper boost
  ghostHuntTimer: number;  // 10-second ethereal pass-through and wall bounce immunity

  // Spatial Broadphase Bounding Box
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
}

export interface SerpentArenaConfig {
  arenaRadius: number;
  roundDuration: number;
  targetFoodCount: number;
  goldenStormInterval: number;
  singularityVortexInterval: number;
  baseSpeed: number;
  boostSpeed: number;
  segmentSpacing: number;
  baseSegmentLength: number;
  minBoostLength: number;
  boostMassBurnRate: number; // Length shed per second
  respawnEnabled: boolean;
  respawnDelaySeconds: number;
  modifiers?: SerpentModifierId[] | SerpentModifiersConfig;
  difficulty?: 'easy' | 'medium' | 'hard' | 'normal' | 'extreme';
}

export interface ArenaLeaderboardEntry {
  id: string;
  name: string;
  score: number;
  length: number;
  kills: number;
  deaths: number;
  color: string;
  isBot: boolean;
  skin: SnakeSkinId;
  isDead: boolean;
  status: 'alive' | 'eliminated' | 'winner';
}

