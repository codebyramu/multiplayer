import { Player, ControllerInput, PlayerClientHUDState, MatchResults, GameEventPayload } from '../../types';

export type RelicTier = 'bronze' | 'silver' | 'diamond' | 'cosmic';
export type PowerupType = 'magnet' | 'shield' | 'warp';
export type RelicOrPowerupType = RelicTier | PowerupType;

export interface RelicEntity {
  id: string;
  type: RelicOrPowerupType;
  tier: RelicTier | 'powerup';
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;            // Height above ground for 3D bounce physics
  vz: number;           // Vertical bounce velocity
  value: number;        // Score point value (10, 25, 50, 100, or 0 for powerups)
  radius: number;
  color: string;
  glowColor: string;
  spawnTime: number;
  lifetime?: number;    // Despawn timer if untouched
  pickupGraceTimer: number; // Invulnerable to pickup right after scatter (e.g. 0.35s)
  rotation: number;
  rotationSpeed: number;
  sparkleTimer: number;
  isMagnetizedTo?: string; // Player ID pulling this relic
}

export interface PlayerRelicRushState {
  id: string;
  name: string;
  avatar: string;
  color: string;
  skin?: string;
  isBot: boolean;
  botArchetype?: 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic';
  
  // Spatial & Physics
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  speed: number;
  maxSpeed: number;
  acceleration: number;
  mass: number;
  
  // Gameplay & Score
  hoardedValue: number;      // Current collected treasure value
  bankedScore: number;       // Total accumulated / finalized score
  tacklesLanded: number;
  tacklesReceived: number;
  relicsCollectedCount: number;
  cosmicCoresClaimed: number;
  
  // Abilities & Cooldowns
  tackleCooldown: number;    // 0 = ready, counts down from e.g. 2.5s
  maxTackleCooldown: number;
  isTackling: boolean;
  tackleTimer: number;       // Active tackle dash timer (e.g. 0.35s)
  tackleHeading: number;     // Direction of dash
  
  // Active Powerups & Shield Ability
  activePowerup: PowerupType | null;
  powerupInventory: PowerupType | null;
  magnetTimer: number;       // Active magnet aura duration remaining
  shieldTimer: number;       // Active kinetic shield duration remaining
  isShieldActive: boolean;
  shieldCooldown: number;    // Kinetic shield base ability cooldown
  maxShieldCooldown: number;
  hoardAccumulator?: number; // Holding score accumulation timer
  
  // Status FX
  isStunned: boolean;
  stunTimer: number;
  damageFlashTimer: number;  // Red damage flash timer when tackled or taking hazard damage
  invulnerableTimer: number; // Grace period after tackle stun
  trail: Array<{ x: number; y: number; alpha: number; radius: number }>;
  
  // Decoy & Special
  decoyActive: boolean;
  decoyX?: number;
  decoyY?: number;
  decoyTimer?: number;
  
  // Bot AI specific memory
  aiTargetId?: string;
  aiTargetRelicId?: string;
  aiState?: 'scavenge' | 'hunt' | 'flee' | 'defend';
  aiDecisionTimer?: number;
}

export interface VaultHazardPit {
  id: string;
  x: number;
  y: number;
  radius: number;
  pulsePhase: number;
  pulseSpeed: number;
  intensity: number;
  active: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  z?: number;
  vz?: number;
  radius: number;
  color: string;
  alpha: number;
  maxLife: number;
  life: number;
  type: 'spark' | 'ring' | 'smoke' | 'shatter' | 'warp' | 'flux';
  rotation?: number;
  rotSpeed?: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  alpha: number;
  life: number;
  maxLife: number;
  vy: number;
  scale: number;
}

export interface Shockwave {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  lineWidth: number;
  alpha: number;
  speed: number;
}

export interface RelicRushEngineConfig {
  arenaWidth: number;
  arenaHeight: number;
  matchDuration: number;      // Seconds (e.g. 90)
  maxRelicsCount: number;     // e.g. 35
  cosmicCoreInterval: number; // Seconds between legendary core spawns
  powerupsEnabled: boolean;
  difficulty: 'easy' | 'medium' | 'normal' | 'hard' | 'extreme';
}

export interface SoundTriggerEvent {
  sound: 'click' | 'pickup' | 'boost' | 'zap' | 'hit' | 'elimination' | 'fanfare' | 'stinger';
  pitch?: number;
}
