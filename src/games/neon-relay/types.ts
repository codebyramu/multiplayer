import type { Player, ControllerInput, PlayerClientHUDState, MatchResults, GameEventPayload } from '../../types';

export type { Player, ControllerInput, PlayerClientHUDState, MatchResults, GameEventPayload };

export interface Vector2D {
  x: number;
  y: number;
}

export interface LineSegment {
  p1: Vector2D;
  p2: Vector2D;
}

export interface CheckpointData {
  id: number;
  name?: string;
  x: number;
  y: number;
  radius: number;
  width: number;
  angle: number; // Gate perpendicular angle in radians
  isFinishLine: boolean;
  pulsePhase: number;
}

export interface BoostPadData {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number; // Direction hovercraft is propelled
  boostMultiplier: number;
  durationMs: number;
}

export interface LaserBarrierData {
  id: number;
  // Segment points
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  // Oscillation properties
  oscillationType: 'translate' | 'rotate' | 'cycle';
  periodSeconds: number;
  phaseOffset: number;
  amplitude: number; // Pixel shift for translate, or radians for rotate
  baseAngle?: number;
  center?: Vector2D;
  // State cycle: warning (dim), active (lethal), off (safe)
  activeWindowStart: number; // 0.0 - 1.0 of cycle
  activeWindowEnd: number;
  // Current runtime state
  currentP1: Vector2D;
  currentP2: Vector2D;
  isActive: boolean;
  isWarning: boolean;
}

export interface SuperchargeZone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number; // Highway direction
  speedMultiplier: number; // 2.0x
  thrustMultiplier: number;
  active: boolean;
  duration: number;
  remainingTime: number;
  pulsePhase: number;
  sectorIndex?: number;
}

export type NeonRelayModifierId = 'overdrive_nitro' | 'laser_hazard_storm' | 'mirrored_circuit';

export interface NeonRelayModifiersConfig {
  overdriveNitro?: boolean;     // Infinite boost
  laserHazardStorm?: boolean;   // More moving laser gates
  mirroredCircuit?: boolean;    // Mirrored track layout
}

export interface TrailNode {
  x: number;
  y: number;
  angle: number;
  speed: number;
  alpha: number;
  color: string;
  timestamp: number;
}

export interface HovercraftRacer {
  id: string;
  player: Player;
  // Spatial Physics
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  maxSpeed: number;
  angle: number; // Heading in radians
  angularVelocity: number;
  targetAngle: number;
  bankingAngle: number; // Visual banking tilt (-0.4 to 0.4 rad)
  radius: number; // Collision radius (approx 24px)
  
  // Drift & Dynamics
  thrust: number;
  isAccelerating: boolean;
  isDrifting: boolean;
  driftFactor: number;
  
  // Jump / Hop Obstacle Clearance
  jumpZ: number;
  jumpVz: number;
  isJumping: boolean;
  jumpCooldown: number;
  
  // Nitro & Boost System
  nitroEnergy: number; // 0.0 to 100.0
  maxNitroEnergy: number;
  isBoosting: boolean;
  nitroBurnRate: number; // Energy/sec
  nitroRechargeRate: number; // Energy/sec
  boostPadTimer: number; // Remaining seconds of pad boost
  boostPadCooldown: number; // Cooldown to prevent multi-kick glitches
  lastBoostPadId: number | null; // Id of most recent pad triggered
  
  // Supercharge Zone Status (2x Speed Highway)
  isSupercharged?: boolean;
  superchargeTimer?: number;

  // Drafting / Slipstream
  isDrafting: boolean;
  draftTargetId: string | null;
  draftTimer: number; // Continuous seconds in draft cone
  
  // Hazards & Status
  isStunned: boolean;
  stunTimer: number;
  invulnerableTimer: number;
  flashTimer: number;
  wallImpactTimer: number;
  
  // Progression & Sequence
  currentLap: number;
  nextCheckpointIndex: number;
  lastCapturedCheckpointIndex: number;
  lapTimes: number[];
  currentLapStartTime: number;
  raceStartTime: number;
  finishTime: number | null;
  finished: boolean;
  finishRank: number | null;
  progressDistance: number; // Total distance traveled + checkpoint weighting for real-time ranking
  
  // Visuals & Effects
  trail: TrailNode[];
  color: string;
  hoverBobPhase: number;
  engineHumPitch: number;
  
  // Bot AI State (if applicable)
  botState?: BotAIState;
}

export type NeonRelayBotArchetype = 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic' | 'precision' | 'nitro-junkie';

export interface BotAIState {
  archetype: NeonRelayBotArchetype;
  targetWaypointIndex: number;
  laneOffset: number; // Dynamic lateral offset from center racing line
  nitroCheckCooldown: number;
  hazardAvoidanceVector: Vector2D;
  reactionDelayTimer: number;
  steerSmooth: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface CircuitTrack {
  name: string;
  width: number;
  height: number;
  innerBoundaries: LineSegment[];
  outerBoundaries: LineSegment[];
  racingLineWaypoints: Vector2D[];
  checkpoints: CheckpointData[];
  boostPads: BoostPadData[];
  lasers: LaserBarrierData[];
  startingGrid: Array<{ x: number; y: number; angle: number }>;
  superchargeZones?: SuperchargeZone[];
  isMirrored?: boolean;
}

export interface NeonRelayConfig {
  totalLaps: number;
  roundDuration: number;
  baseMaxSpeed: number;
  nitroMaxSpeed: number;
  boostPadSpeed: number;
  baseThrust: number;
  nitroThrust: number;
  turnSpeed: number;
  driftFriction: number;
  forwardFriction: number;
  worldWidth: number;
  worldHeight: number;
  modifiers?: NeonRelayModifierId[] | NeonRelayModifiersConfig;
  superchargeZoneInterval?: number;
  randomEventsEnabled?: boolean;
  difficulty?: 'easy' | 'medium' | 'hard' | 'normal' | 'extreme';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  maxSize: number;
  color: string;
  glowColor: string;
  alpha: number;
  life: number;
  maxLife: number;
  type: 'flame' | 'spark' | 'smoke' | 'ring' | 'streak' | 'laser_arc' | 'text' | 'confetti' | 'checkered';
  text?: string;
  rotation?: number;
  vRot?: number;
  shape?: 'square' | 'circle' | 'star';
}

export interface CameraView {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
}
