import { ControllerInput, Player, PlayerClientHUDState, MatchResults, VoidTagState } from '../../types';

export interface Vector2D {
  x: number;
  y: number;
}

export interface VoidTagPlayerEntity {
  id: string;
  name: string;
  color: string;
  avatar: string;
  isBot: boolean;
  botArchetype?: 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic';
  
  // Physics & Transform
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  radius: number;
  mass: number;
  
  // Game Role & State
  isHunter: boolean;
  isInitialHunter: boolean;
  isEliminated: boolean;
  eliminatedTime?: number;
  transformationProgress: number; // 0 to 1 for corruption transformation animation
  transformationTimer: number;   // In seconds
  isInvulnerable: boolean;       // Short grace period right after transformation or spawn
  invulnerableTimer: number;
  
  // Stun State (from EMP)
  isStunned: boolean;
  stunTimer: number;
  
  // Abilities & Cooldowns
  dashCooldown: number;          // Current remaining cooldown (seconds)
  dashMaxCooldown: number;       // Base cooldown (e.g. 4.5s for survivor, 5.5s for hunter)
  dashActiveTimer: number;       // For visual trail effects during dash
  isDashing: boolean;
  
  empCooldown: number;           // Current remaining cooldown (seconds)
  empMaxCooldown: number;        // Base cooldown (e.g. 10.0s for survivor)
  empActiveTimer: number;        // For shockwave radius animation
  isBlastingEMP: boolean;
  
  // Stealth & Sanctuary
  isStealthed: boolean;          // Inside a nebula zone
  isInSanctuary: boolean;        // Inside a charged light sanctuary
  sanctuaryId: number | null;
  stealthAlpha: number;          // Smooth opacity transition for renderer (0.1 to 1.0)
  
  // Stats & Scoring
  score: number;
  survivalTime: number;          // Total seconds survived as uninfected
  tagCount: number;              // Number of survivors corrupted by this player
  empStunCount: number;          // Number of hunters stunned by this survivor
  sanctuaryTime: number;         // Time spent hiding in sanctuaries
  dashesUsed: number;
  
  // Visual Animation States
  tentaclePhases: number[];      // For hunter procedural tentacles
  trailHistory: Array<{ x: number; y: number; alpha: number; angle: number }>;
}

export interface SanctuaryZone {
  id: number;
  x: number;
  y: number;
  radius: number;
  energy: number;               // 0 to 100
  maxEnergy: number;            // 100
  isDepleted: boolean;
  rechargeRate: number;         // Energy / second recharged when empty
  drainRate: number;            // Energy / second drained per survivor inside
  rotationAngle: number;
  pulsePhase: number;
  glyphRadius: number;
}

export interface NebulaZone {
  id: number;
  x: number;
  y: number;
  radius: number;
  pulsePhase: number;
  cloudOffsets: Array<{ x: number; y: number; r: number; color: string; speed: number; phase: number }>;
}

export interface SpaceDebris {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  rotSpeed: number;
  vertices: Array<{ x: number; y: number }>;
  color: string;
  glowColor: string;
  mass: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  type: 'void_wisp' | 'corruption' | 'emp_spark' | 'sanctuary_ray' | 'dash_line' | 'star';
  rotation?: number;
  spin?: number;
}

export interface ShockwaveFX {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  sourcePlayerId: string;
}

export interface FloatingCombatText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  life: number;
  maxLife: number;
  vy: number;
}

export interface VoidTagEngineConfig {
  arenaWidth: number;
  arenaHeight: number;
  roundDuration: number;        // In seconds (e.g. 90)
  initialGracePeriod: number;   // In seconds (e.g. 3.0 before first hunter awakens)
  baseSurvivorSpeed: number;    // e.g. 270 px/s
  baseHunterSpeed: number;      // e.g. 325 px/s (approx ~20% faster)
  dashSpeedBonus: number;       // e.g. 600 px/s warp distance
  empRadius: number;            // e.g. 190 px
  empStunDuration: number;      // e.g. 1.5s
  tagDistance: number;          // e.g. 36 px (sum of radii)
  difficulty?: 'easy' | 'medium' | 'hard' | 'normal' | 'extreme';
}

export interface VoidTagEvent {
  type: 'hunter_chosen' | 'player_tagged' | 'emp_stun' | 'sanctuary_depleted' | 'dash_used' | 'last_survivor' | 'game_over' | 'victory_fanfare';
  playerId?: string;
  targetId?: string;
  text?: string;
  x?: number;
  y?: number;
  winnerId?: string;
}

export type VoidTagEventCallback = (event: VoidTagEvent) => void;
