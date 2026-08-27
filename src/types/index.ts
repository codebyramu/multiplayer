export type GameId = 
  | 'neon-relay' 
  | 'void-tag' 
  | 'relic-rush' 
  | 'last-platform' 
  | 'serpent-arena'
  | 'shadow-outrun';

export interface GameMetadata {
  id: GameId;
  title: string;
  subtitle: string;
  tagline: string;
  category: 'RACE / CIRCUIT' | 'SURVIVAL / TAG' | 'COLLECTION / BRAWL' | 'COLLAPSE / ARENA' | 'SNAKE / BATTLE ROYALE';
  accentColor: string;
  accentHex: string;
  glowColor: string;
  description: string;
  playersLabel: string;
  durationLabel: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  controlsDescription: string;
  icon: string;
  badge: string;
  coverImage?: string;
  isFlagship?: boolean;
}

export interface Player {
  id: string;
  socketId: string;
  name: string;
  avatar: string;
  color: string;
  skin?: string;
  isHost: boolean;
  isOwner?: boolean;
  isBot?: boolean;
  botArchetype?: 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic';
  difficulty?: 'easy' | 'medium' | 'hard';
  isReady: boolean;
  score: number;
  ping: number;
  connected: boolean;
  lastActive: number;
}

export type TournamentMode = 'single' | 'best_of_3' | 'best_of_5' | 'all_5' | 'custom' | 'mystery';

export interface TournamentStanding {
  playerId: string;
  name: string;
  avatar: string;
  color: string;
  isBot?: boolean;
  botArchetype?: string;
  totalPoints: number;
  pointsGainedLastRound?: number;
  roundPlacements: number[];
  roundScores: number[];
  wins: number;
  podiums: number;
  rank: number;
}

export interface TournamentRoundHistory {
  roundNumber: number;
  gameId: GameId;
  results: MatchResults;
  pointsAwarded: Record<string, number>;
}

export interface TournamentState {
  mode: TournamentMode;
  currentRound: number;
  totalRounds: number;
  gameSequence: GameId[];
  isActive: boolean;
  isComplete: boolean;
  standings: TournamentStanding[];
  roundHistory: TournamentRoundHistory[];
  grandChampion: TournamentStanding | null;
}

export type MatchState = 
  | 'idle'
  | 'lobby'
  | 'countdown'
  | 'playing'
  | 'final_duel'
  | 'ending'
  | 'results';

export interface GameModifiers {
  turboSpeed: boolean;          // 1.5x - 2.0x base speed across all modes
  doubleGrowthOrScore: boolean; // 2x score & growth multipliers
  lowGravity: boolean;          // Higher jump / floaty physics / lower friction
  chaosMode: boolean;           // Extreme speed + frequent hazards + instant cooldowns
}

export type BotDifficulty = 'easy' | 'medium' | 'hard';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameDifficulty = 'easy' | 'medium' | 'normal' | 'hard' | 'extreme';

export type ShadowOutrunMapId = 'backrooms' | 'dungeon' | 'cyber-vault';

export interface RoomState {
  code: string;
  hostSocketId: string;
  selectedGame: GameId;
  state: MatchState;
  players: Record<string, Player>;
  botCount: number;
  config: {
    roundDuration: number; // in seconds
    difficulty: 'easy' | 'medium' | 'normal' | 'hard' | 'extreme';
    powerupsEnabled: boolean;
    modifiers?: GameModifiers;
    selectedMap?: ShadowOutrunMapId;
  };
  mapVoting?: { [mapId: string]: number };
  playerMapVotes?: Record<string, string>; // playerId -> mapId
  selectedMap?: ShadowOutrunMapId;
  tournament?: TournamentState;
  playlistMode?: TournamentMode;
  playlistSequence?: GameId[];
  localIp?: string;
  createdAt: number;
}

export interface ControllerInput {
  x: number;          // -1.0 to 1.0 (analog stick / drag vector)
  y: number;          // -1.0 to 1.0
  angle: number;      // 0 to 2*PI radians
  magnitude: number;  // 0.0 to 1.0
  action1: boolean;   // Primary Action: Boost / Jump / Dash / Tackle
  action2: boolean;   // Secondary Action: Shockwave / EMP / Shield / Warp
  action3?: boolean;  // Special / Emote
  timestamp: number;
}

export interface PlayerClientHUDState {
  playerId: string;
  rank: number;
  totalPlayers: number;
  score: number;
  status: 'alive' | 'eliminated' | 'hunter' | 'survivor' | 'winner' | 'racing' | 'finished';
  action1Cooldown: number; // 0.0 to 1.0
  action2Cooldown: number; // 0.0 to 1.0
  customStatName?: string;
  customStatValue?: string | number;
  message?: string;
}

export interface EmoteReaction {
  id: string;
  emoji: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  x: number; // 0.1 to 0.9 normalized screen position
  timestamp: number;
}

export interface GameEventPayload {
  type: 'eliminate' | 'score' | 'powerup' | 'haptic' | 'hit' | 'announcement' | 'emote';
  targetPlayerId?: string;
  payload?: {
    intensity?: 'light' | 'medium' | 'heavy';
    duration?: number;
    text?: string;
    points?: number;
    title?: string;
    description?: string;
    emoji?: string;
    senderName?: string;
    senderColor?: string;
    /** Powerup announcement accent color (hex string, e.g. '#00E5FF') */
    color?: string;
  };
}

export interface MatchResults {
  gameId: GameId;
  winnerId: string;
  winnerName: string;
  winnerAvatar: string;
  winnerColor: string;
  rankings: Array<{
    id: string;
    name: string;
    score: number;
    rank: number;
    avatar: string;
    color: string;
    isBot?: boolean;
    statSummary?: string;
  }>;
  durationSeconds: number;
  mvpStat?: string;
}

// ----------------- GAME SPECIFIC INTERFACES ----------------- //

// 1. NEON RELAY
export interface NeonRelayState {
  checkpoints: Array<{
    id: number;
    x: number;
    y: number;
    radius: number;
    activeSequenceIndex: number;
  }>;
  racers: Record<string, {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    speed: number;
    boostEnergy: number;
    isBoosting: boolean;
    nextCheckpointIndex: number;
    lap: number;
    finished: boolean;
    finishRank?: number;
    trail: Array<{ x: number; y: number; alpha: number }>;
  }>;
  boostPads: Array<{ x: number; y: number; width: number; height: number; angle: number }>;
  lasers: Array<{ x1: number; y1: number; x2: number; y2: number; speed: number; offset: number }>;
}

// 2. VOID TAG
export interface VoidTagState {
  hunters: string[]; // Player IDs who are hunters
  survivors: string[];
  sanctuaries: Array<{
    id: number;
    x: number;
    y: number;
    radius: number;
    energy: number; // Drains when occupied
    maxEnergy: number;
  }>;
  nebulae: Array<{ x: number; y: number; radius: number }>; // Stealth zones
  players: Record<string, {
    x: number;
    y: number;
    vx: number;
    vy: number;
    isHunter: boolean;
    isEliminated: boolean;
    dashCooldown: number;
    empCooldown: number;
    isStealthed: boolean;
    survivalTime: number;
  }>;
}

// 3. RELIC RUSH
export interface RelicItem {
  id: string;
  type: 'bronze' | 'silver' | 'diamond' | 'mythic' | 'magnet' | 'shield' | 'warp';
  x: number;
  y: number;
  value: number;
  radius: number;
  spawnTime: number;
}

export interface RelicRushState {
  relics: RelicItem[];
  players: Record<string, {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    hoardedValue: number;
    shieldActive: boolean;
    shieldTimer: number;
    magnetTimer: number;
    tackleCooldown: number;
    isTackling: boolean;
  }>;
  hazardPits: Array<{ x: number; y: number; radius: number; pulsePhase: number }>;
}

// 4. LAST PLATFORM
export interface PlatformTile {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  size: number;
  state: 'stable' | 'warning' | 'crumbling' | 'collapsed' | 'respawning';
  fallProgress: number; // 0 (solid) to 1.0 (fallen into void)
  warningTimer: number;
}

export interface LastPlatformState {
  tiles: PlatformTile[];
  players: Record<string, {
    x: number;
    y: number;
    vx: number;
    vy: number;
    isGrounded: boolean;
    isJumping: boolean;
    jumpZ: number; // Height in jump
    jumpVz: number;
    isEliminated: boolean;
    eliminateTime?: number;
    pushCooldown: number;
    isShockwaving: boolean;
  }>;
  dangerRadius: number; // Shrinking storm radius
  suddenDeath: boolean;
}

// 5. SERPENT ARENA (FLAGSHIP)
export interface SerpentFood {
  id: string;
  x: number;
  y: number;
  value: number;
  color: string;
  radius: number;
  isGolden?: boolean;
  isMagnetized?: boolean;
}

export interface SerpentBodyPoint {
  x: number;
  y: number;
  angle: number;
}

export interface SerpentEntity {
  id: string;
  name: string;
  color: string;
  skin: 'synth' | 'mecha' | 'cosmic' | 'glitch' | 'molten' | string;
  isBot: boolean;
  botArchetype?: 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic';
  x: number;
  y: number;
  angle: number;
  targetAngle: number;
  speed: number;
  baseSpeed: number;
  boostSpeed: number;
  isBoosting: boolean;
  energy: number; // Consumed when boosting
  score: number;
  length: number; // Number of body segments
  targetLength: number;
  body: SerpentBodyPoint[]; // Head is [0], tail is [end]
  history: Array<{ x: number; y: number }>; // Detailed movement trajectory for smooth snake physics
  isDead: boolean;
  deathTime?: number;
  kills: number;
  invulnerableTimer: number; // Temporary grace period on spawn
}

export interface SerpentArenaState {
  arenaRadius: number;
  foods: SerpentFood[];
  serpents: Record<string, SerpentEntity>;
  specialZones: Array<{
    type: 'speed' | 'slow' | 'golden_storm' | 'black_hole';
    x: number;
    y: number;
    radius: number;
    timer: number;
  }>;
  leaderboard: Array<{ id: string; name: string; length: number; score: number; color: string }>;
}

// 6. SHADOW OUTRUN
export interface ShadowOutrunCoin {
  id: string;
  x: number;
  y: number;
  value: number;
  radius: number;
  isSpecial?: boolean;
}

export interface ShadowOutrunWall {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShadowOutrunState {
  mapId: ShadowOutrunMapId;
  catcherId: string;
  coins: ShadowOutrunCoin[];
  walls: ShadowOutrunWall[];
  players: Record<string, {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    isCatcher: boolean;
    isIlluminated: boolean;
    stamina: number;
    isSprinting: boolean;
    coinsCollected: number;
    isEliminated: boolean;
    score: number;
  }>;
  flashlight: {
    angle: number;
    coneAngle: number;
    range: number;
  };
}

