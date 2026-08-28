import {
  ControllerInput,
  Player,
  PlayerClientHUDState,
  MatchResults,
  GameEventPayload,
  SerpentArenaState,
  SerpentFood,
  SerpentBodyPoint,
} from '../../types';
import {
  ArenaLeaderboardEntry,
  BodyJoint,
  FoodPellet,
  FoodType,
  GoldenStormZone,
  SingularityVortexZone,
  PathHistoryPoint,
  SerpentArenaConfig,
  SerpentPlayerEntity,
  SnakeSkinId,
  BotPersonality,
  SerpentModifierId,
  SerpentModifiersConfig,
} from './types';
import { SerpentSkinRenderer, SNAKE_SKIN_CONFIGS } from './SerpentSkinRenderer';
import { SerpentParticleSystem } from './SerpentParticleSystem';
import { SerpentAIBrain } from './SerpentAIBrain';
import { soundManager } from '../../audio/SoundManager';

const DEFAULT_CONFIG: SerpentArenaConfig = {
  arenaRadius: 1350,
  roundDuration: 120, // 2 minutes per match
  targetFoodCount: 320,
  goldenStormInterval: 35, // Every 35 seconds
  singularityVortexInterval: 45, // Every 45 seconds
  baseSpeed: 195,
  boostSpeed: 351, // 1.8x base speed
  segmentSpacing: 13,
  baseSegmentLength: 25,
  minBoostLength: 12,
  boostMassBurnRate: 2.2, // Segments shed per second while boosting
  respawnEnabled: false, // Authoritative Last-Man-Standing mode
  respawnDelaySeconds: 3.0,
};

export class SerpentArenaEngine {
  private config: SerpentArenaConfig;
  private activeModifiers: Set<SerpentModifierId> = new Set();
  private growthMultiplier: number = 1.0;
  private scoreMultiplier: number = 1.0;

  private serpents: Record<string, SerpentPlayerEntity> = {};
  private foods: FoodPellet[] = [];
  private goldenStorm: GoldenStormZone | null = null;
  private nextGoldenStormTimer: number;
  private singularityVortex: SingularityVortexZone | null = null;
  private nextSingularityVortexTimer: number;

  private matchTimeRemaining: number;
  public isMatchOver: boolean = false;
  public winnerId: string | null = null;
  private matchOverTriggered: boolean = false;
  private gameTime: number = 0;

  public get isGameOver(): boolean {
    return this.isMatchOver;
  }

  public get isMatchFinished(): boolean {
    return this.isMatchOver;
  }

  public get state(): string {
    return this.isMatchOver ? 'finished' : 'playing';
  }

  // Particle & Audio Engine
  private particleSystem: SerpentParticleSystem;
  private eventListeners: Array<(event: GameEventPayload) => void> = [];

  // Camera & Viewport
  private camera = { x: 0, y: 0, targetX: 0, targetY: 0, zoom: 1.0, targetZoom: 1.0 };
  private screenShake = { intensity: 0, duration: 0 };

  // Performance Spatial Grid for Food Optimization
  private foodGridSize = 120;
  private foodSpatialMap: Map<string, FoodPellet[]> = new Map();

  constructor(
    playersOrConfig?: Record<string, Player> | Partial<SerpentArenaConfig>,
    maybeConfig?: Partial<SerpentArenaConfig>
  ) {
    let resolvedConfig: Partial<SerpentArenaConfig> = {};
    let initialPlayers: Record<string, Player> | null = null;

    if (playersOrConfig) {
      // Check if playersOrConfig is a players map
      const firstVal = Object.values(playersOrConfig)[0];
      if (firstVal && typeof firstVal === 'object' && 'id' in firstVal && 'name' in firstVal) {
        initialPlayers = playersOrConfig as Record<string, Player>;
        resolvedConfig = maybeConfig || {};
      } else {
        resolvedConfig = playersOrConfig as Partial<SerpentArenaConfig>;
      }
    }

    this.config = { ...DEFAULT_CONFIG, ...resolvedConfig };
    this.applyModifiers(this.config.modifiers);

    SerpentAIBrain.reset();
    this.particleSystem = new SerpentParticleSystem();
    this.nextGoldenStormTimer = this.hasModifier('chaos_mode') ? 5 : 15; // First storm spawns at 15s (or 5s in Chaos Mode)
    this.nextSingularityVortexTimer = this.hasModifier('chaos_mode') ? 10 : 25; // First vortex at 25s (or 10s in Chaos Mode)
    
    // Set match duration (if roundDuration === 0, endless mode with infinite timer)
    this.matchTimeRemaining = (this.config.roundDuration && this.config.roundDuration > 0)
      ? this.config.roundDuration
      : Infinity;

    this.initAmbientFood();

    if (initialPlayers) {
      for (const pid in initialPlayers) {
        this.addPlayer(initialPlayers[pid]);
      }
    }
  }

  // -------------------------------------------------------------
  // GAME MODIFIERS SYSTEM
  // -------------------------------------------------------------

  private applyModifiers(modifiers?: SerpentModifierId[] | SerpentModifiersConfig): void {
    if (!modifiers) return;

    if (Array.isArray(modifiers)) {
      for (const mod of modifiers) {
        const normalized = String(mod).toLowerCase().replace(/[\s-]+/g, '_') as SerpentModifierId;
        this.activeModifiers.add(normalized);
      }
    } else if (typeof modifiers === 'object') {
      if (modifiers.turboSpeed) this.activeModifiers.add('turbo_speed');
      if (modifiers.doubleGrowth) this.activeModifiers.add('double_growth');
      if (modifiers.tinyArena) this.activeModifiers.add('tiny_arena');
      if (modifiers.chaosMode) this.activeModifiers.add('chaos_mode');
    }

    // 1. Turbo Speed (1.5x base speed & boost speed)
    if (this.hasModifier('turbo_speed')) {
      this.config.baseSpeed = Math.round(this.config.baseSpeed * 1.5);
      this.config.boostSpeed = Math.round(this.config.boostSpeed * 1.5);
    }

    // 2. Double Growth (2x food pellets value & growth)
    if (this.hasModifier('double_growth')) {
      this.growthMultiplier = 2.0;
      this.scoreMultiplier = 2.0;
    }

    // 3. Tiny Arena (60% arena radius)
    if (this.hasModifier('tiny_arena')) {
      this.config.arenaRadius = Math.round(this.config.arenaRadius * 0.6);
    }

    // 4. Chaos Mode (frequent golden storms & rapid food spawn)
    if (this.hasModifier('chaos_mode')) {
      this.config.goldenStormInterval = 12; // Every 12s
      this.config.singularityVortexInterval = 16; // Every 16s
      this.config.targetFoodCount = Math.round(this.config.targetFoodCount * 1.35);
    }
  }

  public hasModifier(modifier: SerpentModifierId): boolean {
    return this.activeModifiers.has(modifier);
  }

  public getActiveModifiers(): SerpentModifierId[] {
    return Array.from(this.activeModifiers);
  }

  // -------------------------------------------------------------
  // MATCH LIFECYCLE & PLAYER MANAGEMENT
  // -------------------------------------------------------------

  public addPlayer(player: Player): void {
    const skin: SnakeSkinId = (player.skin as SnakeSkinId) || 'synth';
    const isBot = !!player.isBot;
    const personality: BotPersonality =
      player.botArchetype ||
      (['aggressive', 'defensive', 'collector', 'ambusher', 'chaotic'][
        Math.floor(Math.random() * 5)
      ] as BotPersonality);

    // Distributed angular intervals around arena, facing inward to center
    const currentCount = Object.keys(this.serpents).length;
    const spawnAngle = (currentCount * 2.399963) % (Math.PI * 2);
    const spawnDist = this.config.arenaRadius * 0.5;
    const startX = Math.cos(spawnAngle) * spawnDist;
    const startY = Math.sin(spawnAngle) * spawnDist;
    const startAngle = Math.atan2(-startY, -startX); // Facing center

    const baseLength = this.config.baseSegmentLength;
    const body: BodyJoint[] = [];
    const history: PathHistoryPoint[] = [];

    // Pre-populate initial spine and trajectory history
    for (let i = 0; i < baseLength; i++) {
      const segDist = i * this.config.segmentSpacing;
      const segX = startX - Math.cos(startAngle) * segDist;
      const segY = startY - Math.sin(startAngle) * segDist;
      const radius = this.computeSegmentRadius(i, baseLength, 18);

      body.push({ x: segX, y: segY, angle: startAngle, radius });
      history.push({ x: segX, y: segY, angle: startAngle, distance: -segDist });
    }

    this.serpents[player.id] = {
      id: player.id,
      name: player.name,
      color: player.color || '#00F5A0',
      skin,
      isBot,
      botPersonality: isBot ? personality : undefined,

      x: startX,
      y: startY,
      prevX: startX,
      prevY: startY,
      vx: Math.cos(startAngle) * this.config.baseSpeed,
      vy: Math.sin(startAngle) * this.config.baseSpeed,
      angle: startAngle,
      targetAngle: startAngle,
      angularVelocity: 0,
      speed: this.config.baseSpeed,
      baseSpeed: this.config.baseSpeed,
      boostSpeed: this.config.boostSpeed,
      turnSpeed: 4.2,
      headRadius: 18,

      score: player.score || 0,
      mass: baseLength,
      length: baseLength,
      targetLength: baseLength,
      energy: 100,
      maxEnergy: 100,
      isBoosting: false,
      boostDistanceAccumulator: 0,
      continuousBoostDuration: 0,
      isOverheating: false,

      body,
      history,
      totalDistanceTraveled: 0,

      isDead: false,
      kills: 0,
      deaths: 0,
      invulnerableTimer: 2.5, // 2.5s spawn shield
      eyeBlinkTimer: 2 + Math.random() * 3,
      eyeBlinkState: 0,
      lookAtOffsetAngle: 0,

      pulseTime: Math.random() * 10,
      skinSeed: Math.random() * 1000,
      difficulty: isBot
        ? this.config.difficulty === 'easy'
          ? 'easy'
          : this.config.difficulty === 'hard' || this.config.difficulty === 'extreme'
          ? 'hard'
          : 'medium'
        : undefined,
      hyperBoostTimer: 0,
      ghostHuntTimer: 0,
    };
  }

  public removePlayer(playerId: string): void {
    if (this.serpents[playerId]) {
      delete this.serpents[playerId];
    }
  }

  public respawnPlayer(playerId: string): void {
    const snake = this.serpents[playerId];
    if (!snake) return;

    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = this.config.arenaRadius * 0.45;
    const startX = Math.cos(spawnAngle) * spawnDist;
    const startY = Math.sin(spawnAngle) * spawnDist;
    const startAngle = Math.atan2(-startY, -startX);

    const baseLength = this.config.baseSegmentLength;
    const body: BodyJoint[] = [];
    const history: PathHistoryPoint[] = [];

    for (let i = 0; i < baseLength; i++) {
      const segDist = i * this.config.segmentSpacing;
      const segX = startX - Math.cos(startAngle) * segDist;
      const segY = startY - Math.sin(startAngle) * segDist;
      const radius = this.computeSegmentRadius(i, baseLength, 18);

      body.push({ x: segX, y: segY, angle: startAngle, radius });
      history.push({ x: segX, y: segY, angle: startAngle, distance: -segDist });
    }

    snake.x = startX;
    snake.y = startY;
    snake.prevX = startX;
    snake.prevY = startY;
    snake.vx = Math.cos(startAngle) * this.config.baseSpeed;
    snake.vy = Math.sin(startAngle) * this.config.baseSpeed;
    snake.angle = startAngle;
    snake.targetAngle = startAngle;
    snake.speed = this.config.baseSpeed;
    snake.length = baseLength;
    snake.targetLength = baseLength;
    snake.mass = baseLength;
    snake.body = body;
    snake.history = history;
    snake.totalDistanceTraveled = 0;
    snake.isDead = false;
    snake.deathTime = undefined;
    snake.respawnTime = undefined;
    snake.invulnerableTimer = 2.5;
    snake.isBoosting = false;
    snake.continuousBoostDuration = 0;
    snake.isOverheating = false;
  }

  // -------------------------------------------------------------
  // MAIN ENGINE TICK (60FPS AUTHORITATIVE SIMULATION)
  // -------------------------------------------------------------

  public tick(dt: number, inputs: Record<string, ControllerInput>): void {
    if (this.isMatchOver) return;

    // Clamp delta time to prevent physics spiraling or tunneling
    const clampedDt = Math.min(0.05, Math.max(0.001, dt));
    this.gameTime += clampedDt;

    // Match Timer Countdown
    this.matchTimeRemaining -= clampedDt;
    if (this.matchTimeRemaining <= 0) {
      this.matchTimeRemaining = 0;
      this.triggerMatchOver(undefined, 'TIME EXPIRED!');
      return;
    }

    // 1. UPDATE GOLDEN STORM EVENT
    this.updateGoldenStorm(clampedDt);

    // 2. UPDATE SINGULARITY VORTEX EVENT
    this.updateSingularityVortex(clampedDt);

    // 3. AMBIENT FOOD REPOPULATION
    this.maintainAmbientFood();

    // 4. UPDATE AI BOT INPUTS
    this.processBotInputs(clampedDt, inputs);

    // 5. UPDATE SERPENT PHYSICS, MOVEMENT & BOOSTING
    this.updateSerpents(clampedDt, inputs);

    // 6. UPDATE FOOD & MAGNETIC ATTRACTION
    this.updateFood(clampedDt);

    // 7. DETECT COLLISIONS (Continuous Swept Line Segment & Head-to-Head)
    this.processCollisions();

    // 8. CHECK AUTHORITATIVE WIN/LOSS COMPLETION
    this.checkMatchConditions();

    // 9. RESPAWN TIMER TICK
    this.processRespawns(clampedDt);

    // 10. UPDATE PARTICLES & SCREEN SHAKE
    this.particleSystem.update(clampedDt);
    if (this.screenShake.duration > 0) {
      this.screenShake.duration -= clampedDt;
      if (this.screenShake.duration <= 0) this.screenShake.intensity = 0;
    }
  }

  // -------------------------------------------------------------
  // SERPENT PHYSICS & SEGMENT FOLLOWING
  // -------------------------------------------------------------

  private updateSerpents(dt: number, inputs: Record<string, ControllerInput>): void {
    for (const id in this.serpents) {
      const snake = this.serpents[id];
      if (snake.isDead) continue;

      // Record previous head position for Continuous Collision Detection (CCD)
      snake.prevX = snake.x;
      snake.prevY = snake.y;

      const input = inputs[id];

      // Invulnerability Countdown
      if (snake.invulnerableTimer > 0) {
        snake.invulnerableTimer = Math.max(0, snake.invulnerableTimer - dt);
      }

      // Eye blinking & animation
      snake.eyeBlinkTimer -= dt;
      if (snake.eyeBlinkTimer <= 0) {
        snake.eyeBlinkState = 1;
        if (snake.eyeBlinkTimer < -0.15) {
          snake.eyeBlinkState = 0;
          snake.eyeBlinkTimer = 2.5 + Math.random() * 4;
        }
      }
      snake.pulseTime += dt;

      // 1. PROCESS TURNING & STEERING ANGLE (Smooth angular slerp/interpolation without snapping)
      if (input && input.magnitude > 0.1) {
        snake.targetAngle = input.angle;
      }

      // Natural shortest-arc angular interpolation
      const angleDiff = this.shortestAngleDiff(snake.angle, snake.targetAngle);
      const maxTurnThisFrame = snake.turnSpeed * dt;
      snake.angle += Math.max(-maxTurnThisFrame, Math.min(maxTurnThisFrame, angleDiff));
      snake.angle = (snake.angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      snake.lookAtOffsetAngle = angleDiff;

      // 2. PROCESS POWERUPS & TACTICAL BOOST
      if (snake.hyperBoostTimer > 0) {
        snake.hyperBoostTimer = Math.max(0, snake.hyperBoostTimer - dt);
        snake.isBoosting = true;
        snake.speed = this.config.boostSpeed * 1.35;
        snake.continuousBoostDuration = 0;
        snake.isOverheating = false;
      }

      if (snake.ghostHuntTimer > 0) {
        snake.ghostHuntTimer = Math.max(0, snake.ghostHuntTimer - dt);
      }

      const wantsBoost = !!(input && input.action1) || snake.hyperBoostTimer > 0;
      const minAllowedLength = 5;
      const canBoost = (snake.length > minAllowedLength || snake.hyperBoostTimer > 0) && !snake.isDead;

      if (wantsBoost && canBoost) {
        snake.isBoosting = true;
        if (snake.hyperBoostTimer <= 0) {
          snake.speed = this.config.boostSpeed;
          snake.continuousBoostDuration = (snake.continuousBoostDuration || 0) + dt;

          // Overheat Warning at >= 3.0s
          snake.isOverheating = snake.continuousBoostDuration >= 3.0;

          // Check if past 3.5s critical threshold for rapid mass & score burn
          const isCriticalOverheat = snake.continuousBoostDuration > 3.5;

          // When critical overheat: 4x mass burn rate + active score burn
          const burnMultiplier = isCriticalOverheat ? 4.2 : 1.0;
          const lengthBurn = this.config.boostMassBurnRate * burnMultiplier * dt;
          snake.targetLength = Math.max(minAllowedLength, snake.targetLength - lengthBurn);
          snake.length = Math.max(minAllowedLength, snake.length - lengthBurn);

          if (isCriticalOverheat) {
            // Rapidly burn score while overheating
            snake.score = Math.max(0, snake.score - Math.floor(35 * dt));
          }

          // Track distance traveled in boost to drop shed pellets behind tail
          const stepDist = snake.speed * dt;
          // Spawns glowing food pellets behind tail (faster accumulation when critical overheat)
          snake.boostDistanceAccumulator += isCriticalOverheat ? stepDist * 2.2 : stepDist;

          if (snake.boostDistanceAccumulator >= 40) {
            snake.boostDistanceAccumulator = 0;
            this.dropShedPellet(snake);
          }
        }

        // Emit boost sparks and intense overheat flames from tail
        if (snake.body.length > 0) {
          const tail = snake.body[snake.body.length - 1];
          const skin = SNAKE_SKIN_CONFIGS[snake.skin] || SNAKE_SKIN_CONFIGS.synth;
          this.particleSystem.emitBoostTrail(tail.x, tail.y, tail.angle, snake.hyperBoostTimer > 0 ? '#00E5FF' : skin.particleColor);

          if (snake.isOverheating && snake.hyperBoostTimer <= 0) {
            this.particleSystem.emitOverheatFlames(tail.x, tail.y);
          }
        }
      } else {
        snake.isBoosting = false;
        snake.speed = snake.baseSpeed;
        snake.continuousBoostDuration = Math.max(0, (snake.continuousBoostDuration || 0) - dt * 2.5);
        if (snake.continuousBoostDuration < 2.5) {
          snake.isOverheating = false;
        }
      }

      // 3. ADVANCE HEAD POSITION
      snake.vx = Math.cos(snake.angle) * snake.speed;
      snake.vy = Math.sin(snake.angle) * snake.speed;
      const stepDistance = snake.speed * dt;

      snake.x += snake.vx * dt;
      snake.y += snake.vy * dt;
      snake.totalDistanceTraveled += stepDistance;

      // Update Head Radius dynamically based on snake length
      snake.headRadius = Math.min(26, 16 + Math.log2(Math.max(1, snake.length / 20)) * 2.5);

      // 4. RECORD PATH HISTORY POINT
      snake.history.unshift({
        x: snake.x,
        y: snake.y,
        angle: snake.angle,
        distance: snake.totalDistanceTraveled,
      });

      // Smoothly grow/shrink length towards targetLength (smooth target length interpolation)
      snake.length += (snake.targetLength - snake.length) * Math.min(1.0, dt * 6.0);
      const currentSegmentCount = Math.max(5, Math.floor(snake.length));

      // 5. UPDATE MULTI-JOINT SPINE (EXACT PIECEWISE DISTANCE SAMPLING)
      this.updateSnakeSpine(snake, currentSegmentCount);

      // 6. PRUNE EXCESS TRAJECTORY HISTORY (Prevent memory bloat)
      const maxPathDistanceNeeded = currentSegmentCount * this.config.segmentSpacing + 120;
      const oldestDistance = snake.totalDistanceTraveled - maxPathDistanceNeeded;

      while (
        snake.history.length > 10 &&
        snake.history[snake.history.length - 1].distance < oldestDistance
      ) {
        snake.history.pop();
      }
    }
  }

  /**
   * Samples exact spline joint positions along the recorded history path.
   * This guarantees 100% jitter-free multi-joint spine following without rubber-banding.
   */
  private updateSnakeSpine(snake: SerpentPlayerEntity, segmentCount: number): void {
    const spacing = this.config.segmentSpacing;
    const history = snake.history;

    // Resize body array to match current segment count
    while (snake.body.length < segmentCount) {
      const last = snake.body[snake.body.length - 1] || {
        x: snake.x,
        y: snake.y,
        angle: snake.angle,
        radius: 12,
      };
      snake.body.push({ ...last });
    }
    if (snake.body.length > segmentCount) {
      snake.body.length = segmentCount;
    }

    // Head is always index 0
    snake.body[0].x = snake.x;
    snake.body[0].y = snake.y;
    snake.body[0].angle = snake.angle;
    snake.body[0].radius = snake.headRadius;

    let historyIndex = 0;

    for (let i = 1; i < segmentCount; i++) {
      const targetDist = snake.totalDistanceTraveled - i * spacing;

      // Find the two history nodes enclosing targetDist
      while (
        historyIndex < history.length - 1 &&
        history[historyIndex + 1].distance >= targetDist
      ) {
        historyIndex++;
      }

      const p1 = history[historyIndex];
      const p2 = history[historyIndex + 1] || p1;

      let segX = p1.x;
      let segY = p1.y;
      let segAngle = p1.angle;

      const segSpan = p1.distance - p2.distance;
      if (segSpan > 0.0001) {
        const t = (p1.distance - targetDist) / segSpan;
        const clampedT = Math.max(0, Math.min(1, t));
        segX = p1.x + (p2.x - p1.x) * clampedT;
        segY = p1.y + (p2.y - p1.y) * clampedT;
        segAngle = this.interpolateAngle(p1.angle, p2.angle, clampedT);
      }

      snake.body[i].x = segX;
      snake.body[i].y = segY;
      snake.body[i].angle = segAngle;
      snake.body[i].radius = this.computeSegmentRadius(i, segmentCount, snake.headRadius);
    }
  }

  private computeSegmentRadius(index: number, total: number, headRadius: number): number {
    const progress = index / Math.max(1, total); // 0 (near head) to 1 (tail tip)
    const baseR = headRadius * 0.85;
    // Gentle taper toward tail
    return Math.max(6, baseR * (1 - progress * 0.45));
  }

  // -------------------------------------------------------------
  // FOOD & MAGNETIC ATTRACTION SIMULATION
  // -------------------------------------------------------------

  private initAmbientFood(): void {
    this.foods = [];
    for (let i = 0; i < this.config.targetFoodCount; i++) {
      this.spawnFoodPellet('normal', undefined, undefined, this.growthMultiplier);
    }
  }

  private maintainAmbientFood(): void {
    if (this.foods.length < this.config.targetFoodCount) {
      const batchSize = this.hasModifier('chaos_mode') ? 12 : 5;
      const needed = Math.min(batchSize, this.config.targetFoodCount - this.foods.length);
      for (let i = 0; i < needed; i++) {
        const rand = Math.random();
        const type: FoodType = rand < 0.05 ? 'hyper_boost' : rand < 0.09 ? 'ghost_hunt' : rand < 0.16 ? 'magnetic' : 'normal';
        this.spawnFoodPellet(type, undefined, undefined, this.growthMultiplier);
      }
    }
  }

  private spawnFoodPellet(type: FoodType, x?: number, y?: number, valueMultiplier: number = 1): FoodPellet {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (this.config.arenaRadius - 80);

    let px = x !== undefined ? x : Math.cos(angle) * dist;
    let py = y !== undefined ? y : Math.sin(angle) * dist;

    // Strictly clamp all food pellets within arena boundaries (leaving perimeter margin)
    const maxPelletDist = this.config.arenaRadius - 40;
    const pelletDist = Math.hypot(px, py);
    if (pelletDist > maxPelletDist) {
      const scale = maxPelletDist / (pelletDist || 1);
      px *= scale;
      py *= scale;
    }

    let value = 1 * valueMultiplier;
    let baseRadius = 4.5;
    let color = '#00F5A0';
    let glowColor = 'rgba(0, 245, 160, 0.4)';

    const NEON_COLORS = ['#00F5A0', '#00E5FF', '#FF3366', '#FFB224', '#9D4EDD', '#FF7700'];

    switch (type) {
      case 'normal':
        color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
        glowColor = color;
        value = 1 * valueMultiplier;
        baseRadius = 4.5;
        break;

      case 'shed':
        color = '#00E5FF';
        glowColor = 'rgba(0, 229, 255, 0.6)';
        value = 1.4 * valueMultiplier;
        baseRadius = 5.0;
        break;

      case 'jackpot':
        color = '#FFB224';
        glowColor = 'rgba(255, 178, 36, 0.8)';
        value = 3.5 * valueMultiplier;
        baseRadius = 8.0;
        break;

      case 'magnetic':
        color = '#FF007F';
        glowColor = 'rgba(255, 0, 127, 0.7)';
        value = 2.0 * valueMultiplier;
        baseRadius = 6.0;
        break;

      case 'golden_orb':
        color = '#FFD700';
        glowColor = 'rgba(255, 215, 0, 0.9)';
        value = 8.0 * valueMultiplier;
        baseRadius = 11.0;
        break;

      case 'hyper_boost':
        color = '#00E5FF';
        glowColor = 'rgba(0, 229, 255, 0.95)';
        value = 4.0 * valueMultiplier;
        baseRadius = 9.0;
        break;

      case 'ghost_hunt':
        color = '#C77DFF';
        glowColor = 'rgba(199, 125, 255, 0.95)';
        value = 4.0 * valueMultiplier;
        baseRadius = 9.5;
        break;
    }

    const pellet: FoodPellet = {
      id: `food_${Date.now()}_${Math.random()}`,
      type,
      x: px,
      y: py,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      value,
      radius: baseRadius,
      baseRadius,
      color,
      glowColor,
      pulsePhase: Math.random() * Math.PI * 2,
      spawnTime: this.gameTime,
    };

    this.foods.push(pellet);

    // Announce powerup drops to the host overlay
    if (type === 'hyper_boost') {
      this.emitEvent({
        type: 'announcement',
        payload: {
          text: '⚡ HYPER BOOST DROPPED!',
          color: '#00E5FF',
          duration: 2500,
        },
      });
    } else if (type === 'ghost_hunt') {
      this.emitEvent({
        type: 'announcement',
        payload: {
          text: '👻 GHOST HUNT DROPPED!',
          color: '#A855F7',
          duration: 2500,
        },
      });
    }

    return pellet;
  }

  private dropShedPellet(snake: SerpentPlayerEntity): void {
    if (snake.body.length === 0) return;
    const tail = snake.body[snake.body.length - 1];
    const skin = SNAKE_SKIN_CONFIGS[snake.skin] || SNAKE_SKIN_CONFIGS.synth;

    const shed = this.spawnFoodPellet('shed', tail.x, tail.y, this.growthMultiplier);
    shed.color = skin.headPrimary;
    shed.glowColor = skin.glowColor;
  }

  private updateFood(dt: number): void {
    const magnetRangeBase = 85;
    const maxPelletDist = this.config.arenaRadius - 35;

    for (let i = this.foods.length - 1; i >= 0; i--) {
      const food = this.foods[i];
      food.pulsePhase += dt * 3;
      food.radius = food.baseRadius + Math.sin(food.pulsePhase) * 1.2;

      // Check magnetic suction from all living serpents
      for (const id in this.serpents) {
        const snake = this.serpents[id];
        if (snake.isDead) continue;

        const dx = snake.x - food.x;
        const dy = snake.y - food.y;
        const dist = Math.hypot(dx, dy);

        // Magnetic range is wider for magnetic pellets or boosting serpents
        const pullRadius = food.type === 'magnetic' ? magnetRangeBase * 1.8 : magnetRangeBase;

        if (dist < pullRadius && dist > 0.001) {
          // Accelerate food directly into snake mouth
          const pullForce = (1 - dist / pullRadius) * 520;
          food.vx += (dx / dist) * pullForce * dt;
          food.vy += (dy / dist) * pullForce * dt;
          food.x += food.vx * dt;
          food.y += food.vy * dt;

          // Guard against food being thrown outside perimeter
          const currentFDist = Math.hypot(food.x, food.y);
          if (currentFDist > maxPelletDist) {
            const fScale = maxPelletDist / (currentFDist || 1);
            food.x *= fScale;
            food.y *= fScale;
            food.vx = 0;
            food.vy = 0;
          }
        }

        // Consumption threshold
        const eatRadius = snake.headRadius + food.radius * 0.8;
        if (dist < eatRadius) {
          this.consumeFood(snake, food);
          this.foods.splice(i, 1);
          break;
        }
      }
    }
  }

  private consumeFood(snake: SerpentPlayerEntity, food: FoodPellet): void {
    const points = Math.floor(food.value * 10 * this.scoreMultiplier);
    const growth = food.value * 0.45 * this.growthMultiplier;

    snake.score += points;
    snake.targetLength += growth;
    snake.mass += growth;

    // Visual feedback
    this.particleSystem.emitFoodAbsorbed(food.x, food.y, food.color);

    if (food.type === 'hyper_boost') {
      snake.hyperBoostTimer = 5.0;
      this.particleSystem.addFloatingText(`⚡ 5s HYPER-BOOST!`, food.x, food.y - 15, '#00E5FF');
      soundManager.playPowerup(750);
      this.emitEvent({
        type: 'announcement',
        payload: {
          text: `⚡ ${snake.name} ACTIVATED HYPER BOOST!`,
          color: '#00E5FF',
          duration: 2500,
          title: `${snake.name} TRIGGERED HYPER-BOOST!`,
          description: '5 seconds of limitless super-speed!',
        },
      });
    } else if (food.type === 'ghost_hunt') {
      snake.ghostHuntTimer = 10.0;
      this.particleSystem.addFloatingText(`👻 10s GHOST HUNT!`, food.x, food.y - 15, '#C77DFF');
      soundManager.playPowerup(550);
      this.emitEvent({
        type: 'announcement',
        payload: {
          text: `👻 ${snake.name} ACTIVATED GHOST HUNT!`,
          color: '#A855F7',
          duration: 2500,
          title: `${snake.name} BECAME A PHANTOM!`,
          description: 'Can phase through serpents and bounce off barriers for 10s!',
        },
      });
    } else if (food.type === 'golden_orb') {
      this.particleSystem.addFloatingText(`+${points} GOLDEN!`, food.x, food.y - 10, '#FFD700');
      soundManager.playPickup(880);
    } else if (food.type === 'jackpot') {
      this.particleSystem.addFloatingText(`+${points}`, food.x, food.y - 10, '#FFB224');
      soundManager.playPickup(650);
    } else {
      soundManager.playPickup(480 + Math.min(400, snake.score * 0.5));
    }

    // Trigger HUD event for local players
    this.emitEvent({
      type: 'score',
      targetPlayerId: snake.id,
      payload: { points, text: `+${points}` },
    });
  }

  // -------------------------------------------------------------
  // GOLDEN ENERGY STORM EVENT (CENTER RING CLUSTERS)
  // -------------------------------------------------------------

  private updateGoldenStorm(dt: number): void {
    if (!this.goldenStorm) {
      this.nextGoldenStormTimer -= dt;
      if (this.nextGoldenStormTimer <= 0) {
        this.spawnGoldenStorm();
      }
    } else {
      this.goldenStorm.remainingTime -= dt;
      this.goldenStorm.pulsePhase += dt * 4;

      // Spawn clusters of magnetic golden fragments within storm radius (center ring)
      const spawnInterval = this.hasModifier('chaos_mode') ? 0.25 : 0.38;
      if (this.gameTime - this.goldenStorm.lastSpawnTime > spawnInterval) {
        this.goldenStorm.lastSpawnTime = this.gameTime;

        const clusterCount = this.hasModifier('chaos_mode') ? 2 : 1;
        for (let c = 0; c < clusterCount; c++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * (this.goldenStorm.radius * 0.85);
          const gx = this.goldenStorm.x + Math.cos(angle) * dist;
          const gy = this.goldenStorm.y + Math.sin(angle) * dist;

          const pelletType: FoodType = Math.random() > 0.35 ? 'golden_orb' : 'magnetic';
          this.spawnFoodPellet(pelletType, gx, gy, this.growthMultiplier);
        }
      }

      this.particleSystem.emitGoldenStormParticles(this.goldenStorm);

      if (this.goldenStorm.remainingTime <= 0) {
        this.goldenStorm = null;
        this.nextGoldenStormTimer = this.config.goldenStormInterval;
      }
    }
  }

  private spawnGoldenStorm(): void {
    // Golden Energy Storm spawns in center ring
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (this.config.arenaRadius * 0.28);

    this.goldenStorm = {
      id: `storm_${Date.now()}`,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      radius: 280,
      maxRadius: 280,
      duration: 16,
      remainingTime: 16,
      intensity: 1.0,
      pulsePhase: 0,
      lastSpawnTime: this.gameTime,
    };

    // Pre-spawn an initial cluster of golden pellets
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 200;
      this.spawnFoodPellet('golden_orb', this.goldenStorm.x + Math.cos(a) * d, this.goldenStorm.y + Math.sin(a) * d, this.growthMultiplier);
    }

    soundManager.playHunterStinger();
    this.particleSystem.addFloatingText(
      '⚡ GOLDEN ENERGY STORM IN CENTER RING! ⚡',
      this.goldenStorm.x,
      this.goldenStorm.y,
      '#FFD700'
    );

    this.emitEvent({
      type: 'announcement',
      payload: {
        title: 'GOLDEN ENERGY STORM',
        description: 'High-value magnetic golden fragments surging in the center ring!',
      },
    });
  }

  // -------------------------------------------------------------
  // SINGULARITY VORTEX EVENT (GRAVITATIONAL WELL)
  // -------------------------------------------------------------

  private updateSingularityVortex(dt: number): void {
    if (!this.singularityVortex) {
      this.nextSingularityVortexTimer -= dt;
      if (this.nextSingularityVortexTimer <= 0) {
        this.spawnSingularityVortex();
      }
    } else {
      const vortex = this.singularityVortex;
      vortex.remainingTime -= dt;
      vortex.pulsePhase += dt * 3.5;
      vortex.rotationAngle += dt * 2.2;

      // 1. Gravitational pull on all food pellets in range
      for (const food of this.foods) {
        const dx = vortex.x - food.x;
        const dy = vortex.y - food.y;
        const dist = Math.hypot(dx, dy);

        if (dist < vortex.pullRadius && dist > 15) {
          const pull = (1 - dist / vortex.pullRadius) * 360 * vortex.intensity;
          const tangentX = -dy / dist;
          const tangentY = dx / dist;

          // Radial inward suction + tangential orbital swirl
          food.vx += ((dx / dist) * pull + tangentX * pull * 0.45) * dt;
          food.vy += ((dy / dist) * pull + tangentY * pull * 0.45) * dt;
          food.x += food.vx * dt;
          food.y += food.vy * dt;
        }
      }

      // 2. Gravitational pull on nearby Serpents
      for (const id in this.serpents) {
        const snake = this.serpents[id];
        if (snake.isDead) continue;

        const dx = vortex.x - snake.x;
        const dy = vortex.y - snake.y;
        const dist = Math.hypot(dx, dy);

        if (dist < vortex.pullRadius && dist > 25) {
          const pullStrength = (1 - dist / vortex.pullRadius) * (snake.isBoosting ? 65 : 110) * vortex.intensity;
          const tangentX = -dy / dist;
          const tangentY = dx / dist;

          // Gently pull snake towards singularity
          snake.x += ((dx / dist) * pullStrength + tangentX * pullStrength * 0.25) * dt;
          snake.y += ((dy / dist) * pullStrength + tangentY * pullStrength * 0.25) * dt;

          // Cleanly guard against throwing snakes outside arena boundary
          const maxAllowedDist = this.config.arenaRadius - snake.headRadius - 15;
          const sDist = Math.hypot(snake.x, snake.y);
          if (sDist > maxAllowedDist) {
            const sScale = maxAllowedDist / sDist;
            snake.x *= sScale;
            snake.y *= sScale;
          }
        }
      }

      // 3. Emit accretion disk matter particles
      this.particleSystem.emitSingularityVortexParticles(vortex);

      if (vortex.remainingTime <= 0) {
        this.singularityVortex = null;
        this.nextSingularityVortexTimer = this.config.singularityVortexInterval;
      }
    }
  }

  private spawnSingularityVortex(): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (this.config.arenaRadius * 0.48);

    this.singularityVortex = {
      id: `singularity_${Date.now()}`,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      radius: 75,
      pullRadius: 460,
      duration: 14,
      remainingTime: 14,
      intensity: 1.0,
      pulsePhase: 0,
      rotationAngle: 0,
    };

    soundManager.playPowerup();
    this.particleSystem.addFloatingText(
      '🌀 SINGULARITY VORTEX FORMED! 🌀',
      this.singularityVortex.x,
      this.singularityVortex.y,
      '#C77DFF'
    );

    this.emitEvent({
      type: 'announcement',
      payload: {
        title: 'SINGULARITY VORTEX',
        description: 'Gravitational anomaly pulling matter & serpents towards its core!',
      },
    });
  }

  // -------------------------------------------------------------
  // AUTHORITATIVE BODY COLLISION DETECTION & DEATH EXPLOSIONS
  // -------------------------------------------------------------

  private processCollisions(): void {
    const snakes = Object.values(this.serpents);

    for (const snake of snakes) {
      if (snake.isDead || snake.invulnerableTimer > 0) continue;

      const headX = snake.x;
      const headY = snake.y;
      const headR = snake.headRadius;

      // 1. ARENA BOUNDARY PERIMETER COLLISION
      const distFromCenter = Math.hypot(headX, headY);
      if (distFromCenter >= this.config.arenaRadius - headR * 0.8) {
        if (snake.ghostHuntTimer > 0) {
          // GHOST HUNT BOUNCE: Reflect smoothly inward, drop minor score/length penalty instead of dying!
          const inwardAngle = Math.atan2(-snake.y, -snake.x);
          snake.angle = inwardAngle;
          snake.targetAngle = inwardAngle;
          snake.score = Math.max(0, snake.score - 15);
          snake.length = Math.max(5, snake.length - 1);
          snake.targetLength = Math.max(5, snake.targetLength - 1);
          this.dropShedPellet(snake);
          this.particleSystem.emitExplosion(snake.x, snake.y, '#C77DFF', 15);
          this.particleSystem.addFloatingText('👻 GHOST BOUNCE (-15)', snake.x, snake.y - 25, '#C77DFF');
          soundManager.playHit();
          continue;
        }
        this.eliminateSnake(snake, undefined, 'CRASHED INTO PERIMETER ENERGY BARRIER!');
        continue;
      }

      // 2. CONTINUOUS HEAD-TO-HEAD & HEAD-TO-BODY COLLISION CHECKS
      for (const other of snakes) {
        if (other.id === snake.id || other.isDead) continue;

        // A. Continuous Head-to-Head Collision Check
        if (other.invulnerableTimer <= 0) {
          const headDist = this.distToSegment(snake.prevX, snake.prevY, snake.x, snake.y, other.x, other.y);
          if (headDist < headR + other.headRadius) {
            // Simultaneous head-on collision between 2 boosting snakes -> dual elimination with jackpots
            if (snake.isBoosting && other.isBoosting) {
              this.eliminateSnake(snake, other, 'BOOSTING HEAD-ON ANNIHILATION!');
              this.eliminateSnake(other, snake, 'BOOSTING HEAD-ON ANNIHILATION!');
            } else if (snake.length > other.length * 1.25) {
              this.eliminateSnake(other, snake, `RAMMED HEAD-ON BY ${snake.name}!`);
            } else if (other.length > snake.length * 1.25) {
              this.eliminateSnake(snake, other, `RAMMED HEAD-ON BY ${other.name}!`);
            } else {
              // Mutual double explosion!
              this.eliminateSnake(snake, other, 'HEAD-ON ANNIHILATION!');
              this.eliminateSnake(other, snake, 'HEAD-ON ANNIHILATION!');
            }
            break;
          }
        }

        // B. Continuous Head-to-Body Segment Collision Check (Against OTHER snake's body)
        // If snake has active GHOST HUNT, it can pass through ANY other snake's body segments without dying!
        if (snake.ghostHuntTimer > 0) {
          continue;
        }

        for (let s = 0; s < other.body.length; s++) {
          const seg = other.body[s];
          const dist = this.distToSegment(snake.prevX, snake.prevY, snake.x, snake.y, seg.x, seg.y);

          let minDist = dist;
          if (s < other.body.length - 1) {
            const nextSeg = other.body[s + 1];
            const capsuleDist = this.distSegmentToSegment(
              snake.prevX,
              snake.prevY,
              snake.x,
              snake.y,
              seg.x,
              seg.y,
              nextSeg.x,
              nextSeg.y
            );
            minDist = Math.min(dist, capsuleDist);
          }

          if (minDist < headR + seg.radius * 0.85) {
            this.eliminateSnake(
              snake,
              other,
              `CRASHED INTO ${other.name}'s BODY!`
            );
            break;
          }
        }

        if (snake.isDead) break;
      }
    }
  }

  private eliminateSnake(victim: SerpentPlayerEntity, killer?: SerpentPlayerEntity, reason?: string): void {
    if (victim.isDead) return;

    victim.isDead = true;
    victim.speed = 0;
    victim.vx = 0;
    victim.vy = 0;
    victim.isBoosting = false;
    victim.deaths = (victim.deaths || 0) + 1;
    victim.deathTime = this.gameTime;
    victim.respawnTime = this.config.respawnEnabled ? this.gameTime + this.config.respawnDelaySeconds : undefined;
    victim.killedBy = killer ? killer.name : 'Perimeter Barrier';

    // Killer rewards
    if (killer && killer.id !== victim.id) {
      killer.kills += 1;
      const killBonus = 150 + Math.floor(victim.score * 0.25);
      killer.score += killBonus;
      killer.targetLength += 8;

      this.particleSystem.addFloatingText(`KILL! +${killBonus}`, killer.x, killer.y - 30, '#FF3366');
      if (killer.kills >= 3) {
        this.particleSystem.addFloatingText('🔥 DOMINATING! 🔥', killer.x, killer.y - 50, '#FFB224');
      }
    }

    // Audio & Screen Shake
    soundManager.playElimination();
    this.screenShake = { intensity: 14, duration: 0.4 };

    // Massive Kinetic Death Particle Explosion
    const skinConfig = SNAKE_SKIN_CONFIGS[victim.skin] || SNAKE_SKIN_CONFIGS.synth;
    this.particleSystem.emitExplosion(victim.x, victim.y, skinConfig.headPrimary, 70);
    // Corpse particle disintegration for 1.2s for visual satisfaction
    this.particleSystem.emitCorpseDisintegration(victim.body, skinConfig.headPrimary, 1.2);
    this.particleSystem.addFloatingText(
      `${victim.name} ELIMINATED!`,
      victim.x,
      victim.y - 20,
      '#FF3366'
    );

    // CONVERT VICTIM'S ENTIRE BODY INTO A JACKPOT TRAIL OF ENERGY CRYSTALS
    const jackpotCount = Math.min(80, Math.max(15, Math.floor(victim.body.length * 0.75)));
    const step = Math.max(1, Math.floor(victim.body.length / jackpotCount));

    for (let i = 0; i < victim.body.length; i += step) {
      const seg = victim.body[i];
      const scatterX = seg.x + (Math.random() - 0.5) * 20;
      const scatterY = seg.y + (Math.random() - 0.5) * 20;
      this.spawnFoodPellet('jackpot', scatterX, scatterY, 1.2 * this.growthMultiplier);
    }

    // Notify clients & controllers
    this.emitEvent({
      type: 'eliminate',
      targetPlayerId: victim.id,
      payload: {
        title: 'SERPENT DESTROYED!',
        description: reason || 'Eliminated in combat',
        intensity: 'heavy',
      },
    });

    this.emitEvent({
      type: 'haptic',
      targetPlayerId: victim.id,
      payload: { intensity: 'heavy', duration: 400 },
    });
  }

  private checkMatchConditions(): void {
    if (this.isMatchOver) return;

    const allSnakes = Object.values(this.serpents);
    const totalSnakes = allSnakes.length;
    const livingSnakes = allSnakes.filter((s) => !s.isDead);

    // Last Man Standing Win Condition (when respawns are disabled)
    if (!this.config.respawnEnabled && totalSnakes >= 2) {
      if (livingSnakes.length === 1) {
        const survivor = livingSnakes[0];
        this.triggerMatchOver(survivor, `${survivor.name} IS THE LAST SERPENT STANDING!`);
      } else if (livingSnakes.length === 0) {
        // Mutual elimination of last serpents -> winner determined by deterministic tie-breaker
        const topWinner = this.getLeaderboard()[0];
        const winnerSnake = topWinner ? this.serpents[topWinner.id] : undefined;
        this.triggerMatchOver(winnerSnake, 'MUTUAL ELIMINATION!');
      }
    } else if (!this.config.respawnEnabled && totalSnakes === 1) {
      if (livingSnakes.length === 0) {
        this.triggerMatchOver(undefined, 'SERPENT DESTROYED!');
      }
    }
  }

  private processRespawns(dt: number): void {
    if (!this.config.respawnEnabled) return;

    for (const id in this.serpents) {
      const snake = this.serpents[id];
      if (snake.isDead && snake.respawnTime && this.gameTime >= snake.respawnTime) {
        this.respawnPlayer(id);
      }
    }
  }

  // -------------------------------------------------------------
  // AI BOT INPUT PROCESSING
  // -------------------------------------------------------------

  private processBotInputs(dt: number, inputs: Record<string, ControllerInput>): void {
    const diff =
      this.config.difficulty === 'easy'
        ? 'easy'
        : this.config.difficulty === 'hard' || this.config.difficulty === 'extreme'
        ? 'hard'
        : 'medium';

    for (const id in this.serpents) {
      const snake = this.serpents[id];
      if (snake.isBot && !snake.isDead) {
        inputs[id] = SerpentAIBrain.computeBotInput(
          snake,
          this.serpents,
          this.foods,
          this.goldenStorm,
          this.config.arenaRadius,
          dt,
          this.singularityVortex,
          diff
        );
      }
    }
  }

  // -------------------------------------------------------------
  // CANVAS 2D HIGH-PERFORMANCE RENDERER
  // -------------------------------------------------------------

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    focusPlayerId?: string
  ): void {
    ctx.save();

    // 1. UPDATE DYNAMIC CAMERA TRACKING
    this.updateCamera(width, height, focusPlayerId);

    // Apply Camera Transform & Screen Shake
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2, height / 2);

    // Apply Shake
    if (this.screenShake.intensity > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake.intensity;
      const shakeY = (Math.random() - 0.5) * this.screenShake.intensity;
      ctx.translate(shakeX, shakeY);
    }

    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // 2. RENDER DEEP CYBER ARENA GRID & STARFIELD
    this.renderArenaBackground(ctx);

    // 3. RENDER RANDOM EVENTS (SINGULARITY VORTEX & GOLDEN STORM)
    if (this.singularityVortex) {
      this.renderSingularityVortexZone(ctx, this.singularityVortex);
    }

    if (this.goldenStorm) {
      this.renderGoldenStormZone(ctx, this.goldenStorm);
    }

    // 4. RENDER GLOWING FOOD PELLETS & MAGNETICS
    this.renderFoodPellets(ctx);

    // 5. RENDER ALL SERPENTS (Leader with golden crown)
    const leaderboard = this.getLeaderboard();
    const leaderId = leaderboard.length > 0 ? leaderboard[0].id : '';

    // Render dead snakes' fading hulls, then living snakes
    for (const id in this.serpents) {
      const snake = this.serpents[id];
      SerpentSkinRenderer.renderSnake(ctx, snake, snake.id === leaderId, this.gameTime);
    }

    // 6. RENDER DYNAMIC PARTICLES & COMBAT FLOATING TEXT
    this.particleSystem.render(ctx);

    // 7. RENDER PERIMETER ENERGY BARRIER
    this.renderPerimeterBarrier(ctx);

    ctx.restore(); // Restore world transform

    // 8. RENDER SCREEN-SPACE HUD (Minimap, Match Timer, Live Leaderboard)
    this.renderScreenHUD(ctx, width, height, focusPlayerId, leaderboard);

    ctx.restore();
  }

  // -------------------------------------------------------------
  // CAMERA & BACKGROUND RENDERING
  // -------------------------------------------------------------

  /**
   * Dynamic Multiplayer Group Camera:
   * 1. Focuses strictly on living snake HEAD positions (heavily weighted toward human players + forward lookahead along headAngle).
   * 2. Dynamically encloses all living snake heads with a minimum 280px margin buffer on all sides so snake heads never go out of frame.
   * 3. Smooth lerp damping (0.08 to 0.12) to prevent jitter.
   */
  private updateCamera(width: number, height: number, focusPlayerId?: string): void {
    const validWidth = width > 0 && isFinite(width) ? width : 1600;
    const validHeight = height > 0 && isFinite(height) ? height : 900;
    const R = this.config.arenaRadius;
    const minArenaZoom = Math.min(validWidth, validHeight) / (R * 2.35); // Fits whole arena comfortably with padding
    const maxZoom = 1.08; // Intimate close-up when players are dueling closely

    // 1. If explicit focusPlayerId is requested and active, frame that player's head strictly
    if (focusPlayerId && this.serpents[focusPlayerId] && !this.serpents[focusPlayerId].isDead) {
      const p = this.serpents[focusPlayerId];
      const lookaheadDist = Math.min(110, p.speed * 0.35);
      const lookX = p.x + Math.cos(p.angle) * lookaheadDist;
      const lookY = p.y + Math.sin(p.angle) * lookaheadDist;

      this.camera.targetX = lookX;
      this.camera.targetY = lookY;

      // Minimum 280px margin buffer on all sides around head and lookahead
      const minX = Math.min(p.x, lookX);
      const maxX = Math.max(p.x, lookX);
      const minY = Math.min(p.y, lookY);
      const maxY = Math.max(p.y, lookY);

      const spanX = Math.max(100, (maxX - minX) + 280 * 2);
      const spanY = Math.max(100, (maxY - minY) + 280 * 2);
      const zoomX = validWidth / spanX;
      const zoomY = validHeight / spanY;
      let calculatedZoom = Math.min(zoomX, zoomY);
      if (!isFinite(calculatedZoom) || isNaN(calculatedZoom)) calculatedZoom = minArenaZoom;

      this.camera.targetZoom = Math.max(minArenaZoom, Math.min(maxZoom, calculatedZoom));
    } else {
      // 2. MULTIPLAYER GROUP CAMERA: Strictly compute from HEAD positions of living snakes
      const livingSnakes = Object.values(this.serpents).filter((s) => !s.isDead);

      if (livingSnakes.length === 0) {
        // No living snakes: smoothly center on arena origin and frame full arena
        this.camera.targetX = 0;
        this.camera.targetY = 0;
        this.camera.targetZoom = minArenaZoom;
      } else if (livingSnakes.length === 1) {
        // 1 Solo Survivor: Focus strictly on the champion's head with forward lookahead
        const survivor = livingSnakes[0];
        const lookaheadDist = Math.min(110, survivor.speed * 0.35);
        const lookX = survivor.x + Math.cos(survivor.angle) * lookaheadDist;
        const lookY = survivor.y + Math.sin(survivor.angle) * lookaheadDist;

        this.camera.targetX = lookX;
        this.camera.targetY = lookY;

        const minX = Math.min(survivor.x, lookX);
        const maxX = Math.max(survivor.x, lookX);
        const minY = Math.min(survivor.y, lookY);
        const maxY = Math.max(survivor.y, lookY);

        const spanX = Math.max(100, (maxX - minX) + 280 * 2);
        const spanY = Math.max(100, (maxY - minY) + 280 * 2);
        const zoomX = validWidth / spanX;
        const zoomY = validHeight / spanY;
        let calculatedZoom = Math.min(zoomX, zoomY);
        if (!isFinite(calculatedZoom) || isNaN(calculatedZoom)) calculatedZoom = minArenaZoom;

        this.camera.targetZoom = Math.max(minArenaZoom, Math.min(maxZoom, calculatedZoom));
      } else {
        // MULTIPLE LIVING SNAKES:
        // Calculate group center and encompass the furthest snake head with ample boundary margin
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let sumX = 0;
        let sumY = 0;

        for (const snake of livingSnakes) {
          const lookaheadDist = Math.min(140, snake.speed * 0.45);
          const headX = snake.x;
          const headY = snake.y;
          const lookX = headX + Math.cos(snake.angle) * lookaheadDist;
          const lookY = headY + Math.sin(snake.angle) * lookaheadDist;

          sumX += (headX + lookX) * 0.5;
          sumY += (headY + lookY) * 0.5;

          minX = Math.min(minX, headX, lookX);
          maxX = Math.max(maxX, headX, lookX);
          minY = Math.min(minY, headY, lookY);
          maxY = Math.max(maxY, headY, lookY);
        }

        const midX = sumX / livingSnakes.length;
        const midY = sumY / livingSnakes.length;

        // Find the maximum distance from the group midpoint to any snake's head/lookahead
        let maxDistFromMid = 0;
        for (const snake of livingSnakes) {
          const lookaheadDist = Math.min(140, snake.speed * 0.45);
          const lookX = snake.x + Math.cos(snake.angle) * lookaheadDist;
          const lookY = snake.y + Math.sin(snake.angle) * lookaheadDist;
          const d1 = Math.hypot(snake.x - midX, snake.y - midY);
          const d2 = Math.hypot(lookX - midX, lookY - midY);
          maxDistFromMid = Math.max(maxDistFromMid, d1, d2);
        }

        // Camera center is the dynamic midpoint
        this.camera.targetX = midX;
        this.camera.targetY = midY;

        // View diameter = (max distance from mid * 2) + generous margin (520px buffer) so heads NEVER leave screen
        const requiredSpan = Math.max(300, (maxDistFromMid * 2) + 520);
        const spanX = Math.max(requiredSpan, (maxX - minX) + 520);
        const spanY = Math.max(requiredSpan, (maxY - minY) + 520);

        const zoomX = validWidth / spanX;
        const zoomY = validHeight / spanY;
        let calculatedZoom = Math.min(zoomX, zoomY);
        if (!isFinite(calculatedZoom) || isNaN(calculatedZoom)) calculatedZoom = minArenaZoom;

        this.camera.targetZoom = Math.max(minArenaZoom, Math.min(maxZoom, calculatedZoom));
      }
    }

    // Safety checks against NaN/Infinity
    if (!isFinite(this.camera.targetX) || isNaN(this.camera.targetX)) this.camera.targetX = 0;
    if (!isFinite(this.camera.targetY) || isNaN(this.camera.targetY)) this.camera.targetY = 0;
    if (!isFinite(this.camera.targetZoom) || isNaN(this.camera.targetZoom) || this.camera.targetZoom <= 0) this.camera.targetZoom = minArenaZoom;

    if (!isFinite(this.camera.x) || isNaN(this.camera.x)) this.camera.x = this.camera.targetX;
    if (!isFinite(this.camera.y) || isNaN(this.camera.y)) this.camera.y = this.camera.targetY;
    if (!isFinite(this.camera.zoom) || isNaN(this.camera.zoom) || this.camera.zoom <= 0) this.camera.zoom = this.camera.targetZoom;

    // Smooth Lerp Damping (0.08 to 0.12) to prevent jitter
    this.camera.x += (this.camera.targetX - this.camera.x) * 0.10;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.10;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.085;
  }

  private renderArenaBackground(ctx: CanvasRenderingContext2D): void {
    const R = this.config.arenaRadius;

    // Outer Void Background
    ctx.fillStyle = '#06080E';
    ctx.fillRect(-R * 1.5, -R * 1.5, R * 3, R * 3);

    // Inner Arena Disc
    const grad = ctx.createRadialGradient(0, 0, 100, 0, 0, R);
    grad.addColorStop(0, '#0E131F');
    grad.addColorStop(0.7, '#090D16');
    grad.addColorStop(1, '#05070B');

    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Cyber Matrix Grid Lines
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.06)';
    ctx.lineWidth = 1;
    const gridSize = 100;

    for (let x = -R; x <= R; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, -R);
      ctx.lineTo(x, R);
      ctx.stroke();
    }

    for (let y = -R; y <= R; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(-R, y);
      ctx.lineTo(R, y);
      ctx.stroke();
    }

    // Concentric Arena Distance Rings
    ctx.strokeStyle = 'rgba(0, 245, 160, 0.08)';
    ctx.setLineDash([8, 12]);
    for (let r = 200; r < R; r += 250) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.restore();
  }

  private renderPerimeterBarrier(ctx: CanvasRenderingContext2D): void {
    const R = this.config.arenaRadius;

    ctx.save();

    // Outer Neon Glow Barrier
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#FF3366';

    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.strokeStyle = '#FF3366';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Inner Secondary Electric Cyan Ring
    ctx.shadowColor = '#00E5FF';
    ctx.beginPath();
    ctx.arc(0, 0, R - 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Hazard chevrons along perimeter
    const tickCount = 64;
    const pulse = Math.sin(this.gameTime * 3) * 0.3 + 0.7;

    ctx.fillStyle = `rgba(255, 51, 102, ${pulse * 0.8})`;
    for (let i = 0; i < tickCount; i++) {
      const a = (i / tickCount) * Math.PI * 2 + this.gameTime * 0.1;
      const x1 = Math.cos(a) * (R - 18);
      const y1 = Math.sin(a) * (R - 18);
      const x2 = Math.cos(a) * R;
      const y2 = Math.sin(a) * R;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#FF3366';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderGoldenStormZone(ctx: CanvasRenderingContext2D, zone: GoldenStormZone): void {
    ctx.save();
    ctx.translate(zone.x, zone.y);

    // Outer Swirling Vortex
    const grad = ctx.createRadialGradient(0, 0, 20, 0, 0, zone.radius);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    grad.addColorStop(0.3, 'rgba(255, 215, 0, 0.3)');
    grad.addColorStop(0.8, 'rgba(255, 178, 36, 0.15)');
    grad.addColorStop(1, 'rgba(255, 215, 0, 0)');

    ctx.beginPath();
    ctx.arc(0, 0, zone.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Rotating Lightning Arcs
    ctx.rotate(this.gameTime * 1.5);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 20]);
    ctx.beginPath();
    ctx.arc(0, 0, zone.radius * 0.75, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, zone.radius * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  private renderSingularityVortexZone(ctx: CanvasRenderingContext2D, vortex: SingularityVortexZone): void {
    ctx.save();
    ctx.translate(vortex.x, vortex.y);

    // 1. Outer Gravitational Influence Distortion Wave
    const pulseR = vortex.pullRadius * (0.85 + Math.sin(vortex.pulsePhase) * 0.15);
    const gradField = ctx.createRadialGradient(0, 0, 30, 0, 0, pulseR);
    gradField.addColorStop(0, 'rgba(157, 78, 221, 0.25)');
    gradField.addColorStop(0.5, 'rgba(255, 0, 127, 0.12)');
    gradField.addColorStop(1, 'rgba(14, 19, 31, 0)');

    ctx.beginPath();
    ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
    ctx.fillStyle = gradField;
    ctx.fill();

    // 2. Swirling Accretion Disk
    ctx.save();
    ctx.rotate(vortex.rotationAngle);

    const accretionGrad = ctx.createRadialGradient(0, 0, vortex.radius * 0.4, 0, 0, vortex.radius * 2.2);
    accretionGrad.addColorStop(0, '#FFFFFF');
    accretionGrad.addColorStop(0.2, '#00E5FF');
    accretionGrad.addColorStop(0.5, '#FF007F');
    accretionGrad.addColorStop(0.85, '#7B2CBF');
    accretionGrad.addColorStop(1, 'rgba(36, 0, 70, 0)');

    ctx.beginPath();
    ctx.arc(0, 0, vortex.radius * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = accretionGrad;
    ctx.fill();

    // Spiral accretion arms
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 18]);
    ctx.beginPath();
    ctx.arc(0, 0, vortex.radius * 1.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#FF007F';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([18, 24]);
    ctx.beginPath();
    ctx.arc(0, 0, vortex.radius * 1.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();

    // 3. Photon Sphere & Event Horizon Core (Void Black)
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#FF007F';
    ctx.beginPath();
    ctx.arc(0, 0, vortex.radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#040208';
    ctx.fill();

    // Intense Photon Ring Glow
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  private renderFoodPellets(ctx: CanvasRenderingContext2D): void {
    for (const food of this.foods) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);

      if (food.type === 'hyper_boost') {
        // Cyan lightning pill with pulsating energy ring
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#00E5FF';
        ctx.fillStyle = '#00E5FF';
        ctx.fill();

        // Inner white energy core
        ctx.beginPath();
        ctx.arc(food.x, food.y, food.radius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // Outer pulsing ring
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(food.x, food.y, food.radius * 1.4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (food.type === 'ghost_hunt') {
        // Spectral violet phantom orb with ethereal halo
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#C77DFF';
        ctx.fillStyle = '#C77DFF';
        ctx.fill();

        // Inner phantom core
        ctx.beginPath();
        ctx.arc(food.x, food.y, food.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // Outer spectral ring
        ctx.strokeStyle = '#E0AAFF';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(food.x, food.y, food.radius * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (food.type === 'golden_orb') {
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#FFD700';
        ctx.fillStyle = '#FFD700';
        ctx.fill();

        // Inner white shine
        ctx.beginPath();
        ctx.arc(food.x - food.radius * 0.25, food.y - food.radius * 0.25, food.radius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      } else if (food.type === 'jackpot') {
        ctx.shadowBlur = 10;
        ctx.shadowColor = food.glowColor;
        ctx.fillStyle = food.color;
        ctx.fill();
      } else {
        ctx.fillStyle = food.color;
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // -------------------------------------------------------------
  // SCREEN HUD: LEADERBOARD, MINIMAP, AND MATCH TIMER
  // -------------------------------------------------------------

  private renderScreenHUD(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    focusPlayerId: string | undefined,
    leaderboard: ArenaLeaderboardEntry[]
  ): void {
    ctx.save();

    // 1. TOP LEADERBOARD OVERLAY (Top Right)
    this.renderHUDLeaderboard(ctx, width, leaderboard, focusPlayerId);

    // 2. MATCH TIMER (Top Center)
    this.renderHUDTimer(ctx, width);

    // 3. CIRCULAR MINIMAP RADAR (Bottom Right)
    this.renderHUDMinimap(ctx, width, height, focusPlayerId);

    // 4. PERSONAL STATS (Bottom Left)
    if (focusPlayerId && this.serpents[focusPlayerId]) {
      this.renderHUDSnakeStats(ctx, height, this.serpents[focusPlayerId]);
    }

    ctx.restore();
  }

  private renderHUDLeaderboard(
    ctx: CanvasRenderingContext2D,
    width: number,
    leaderboard: ArenaLeaderboardEntry[],
    focusPlayerId?: string
  ): void {
    const boxW = 220;
    const startX = width - boxW - 20;
    const startY = 20;
    const rowH = 24;
    const displayCount = Math.min(5, leaderboard.length);

    ctx.fillStyle = 'rgba(11, 13, 18, 0.85)';
    ctx.strokeStyle = 'rgba(0, 245, 160, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(startX, startY, boxW, 36 + displayCount * rowH, 8);
    ctx.fill();
    ctx.stroke();

    // Header
    ctx.fillStyle = '#00F5A0';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🏆 ARENA LEADERBOARD', startX + 12, startY + 22);

    // Rows
    for (let i = 0; i < displayCount; i++) {
      const entry = leaderboard[i];
      const rowY = startY + 48 + i * rowH;
      const isSelf = entry.id === focusPlayerId;

      if (isSelf) {
        ctx.fillStyle = 'rgba(0, 245, 160, 0.15)';
        ctx.fillRect(startX + 4, rowY - 14, boxW - 8, rowH - 2);
      }

      ctx.fillStyle = isSelf ? '#00F5A0' : entry.color;
      ctx.font = isSelf ? 'bold 12px monospace' : '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`#${i + 1} ${entry.name}`, startX + 12, rowY);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`${entry.score}`, startX + boxW - 12, rowY);
    }
  }

  private renderHUDTimer(ctx: CanvasRenderingContext2D, width: number): void {
    const mins = Math.floor(this.matchTimeRemaining / 60);
    const secs = Math.floor(this.matchTimeRemaining % 60);
    const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    const isUrgent = this.matchTimeRemaining <= 15;

    ctx.save();
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';

    const textW = ctx.measureText(timeStr).width + 30;
    ctx.fillStyle = 'rgba(11, 13, 18, 0.85)';
    ctx.strokeStyle = isUrgent ? '#FF3366' : '#00E5FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(width / 2 - textW / 2, 16, textW, 36, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isUrgent ? '#FF3366' : '#FFFFFF';
    ctx.fillText(timeStr, width / 2, 42);
    ctx.restore();
  }

  private renderHUDMinimap(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    focusPlayerId?: string
  ): void {
    const mapRadius = 70;
    const mapCenterX = width - mapRadius - 20;
    const mapCenterY = height - mapRadius - 20;
    const arenaR = this.config.arenaRadius;
    const scale = mapRadius / arenaR;

    ctx.save();

    // Radar Disc Background
    ctx.beginPath();
    ctx.arc(mapCenterX, mapCenterY, mapRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(11, 13, 18, 0.85)';
    ctx.fill();
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Radar Sweep Line
    const sweepAngle = this.gameTime * 2.5;
    ctx.beginPath();
    ctx.moveTo(mapCenterX, mapCenterY);
    ctx.lineTo(
      mapCenterX + Math.cos(sweepAngle) * mapRadius,
      mapCenterY + Math.sin(sweepAngle) * mapRadius
    );
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Golden Storm Blip
    if (this.goldenStorm) {
      const gx = mapCenterX + this.goldenStorm.x * scale;
      const gy = mapCenterY + this.goldenStorm.y * scale;
      ctx.beginPath();
      ctx.arc(gx, gy, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
      ctx.fill();
    }

    // Singularity Vortex Blip
    if (this.singularityVortex) {
      const vx = mapCenterX + this.singularityVortex.x * scale;
      const vy = mapCenterY + this.singularityVortex.y * scale;
      ctx.beginPath();
      ctx.arc(vx, vy, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 0, 127, 0.75)';
      ctx.fill();
    }

    // Serpents' Blips
    for (const id in this.serpents) {
      const s = this.serpents[id];
      if (s.isDead) continue;

      const px = mapCenterX + s.x * scale;
      const py = mapCenterY + s.y * scale;
      const isSelf = s.id === focusPlayerId;

      ctx.beginPath();
      ctx.arc(px, py, isSelf ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isSelf ? '#FFFFFF' : s.color;
      ctx.fill();

      if (isSelf) {
        ctx.strokeStyle = '#00F5A0';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private renderHUDSnakeStats(
    ctx: CanvasRenderingContext2D,
    height: number,
    snake: SerpentPlayerEntity
  ): void {
    const boxW = 200;
    const boxH = 68;
    const startX = 20;
    const startY = height - boxH - 20;

    ctx.fillStyle = 'rgba(11, 13, 18, 0.85)';
    ctx.strokeStyle = snake.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(startX, startY, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${snake.name}`, startX + 12, startY + 22);

    ctx.font = '12px monospace';
    ctx.fillStyle = '#00F5A0';
    ctx.fillText(`SCORE: ${snake.score}`, startX + 12, startY + 42);

    ctx.fillStyle = '#00E5FF';
    ctx.fillText(`LENGTH: ${Math.floor(snake.length)} | KILLS: ${snake.kills}`, startX + 12, startY + 58);
  }

  // -------------------------------------------------------------
  // STATE EXPORT & HUD SYNC API
  // -------------------------------------------------------------

  public getPlayerHUDState(playerId: string): PlayerClientHUDState {
    const snake = this.serpents[playerId];
    const leaderboard = this.getLeaderboard();
    const total = leaderboard.length;
    const rankIndex = leaderboard.findIndex((e) => e.id === playerId);
    const rank = rankIndex !== -1 ? rankIndex + 1 : total;

    if (!snake) {
      return {
        playerId,
        rank: 1,
        totalPlayers: total,
        score: 0,
        status: 'alive',
        action1Cooldown: 0,
        action2Cooldown: 0,
      };
    }

    let status: 'alive' | 'eliminated' | 'winner' = 'alive';
    if (this.isMatchOver) {
      status = (this.winnerId === playerId || (rankIndex === 0 && !this.winnerId)) ? 'winner' : 'eliminated';
    } else if (snake.isDead) {
      status = 'eliminated';
    }

    // Boost Overheat gauge ratio: 0.0 to 1.0 (reaches warning at >= 0.85 (3.0s), critical overheat at 1.0 (3.5s))
    const boostGaugeRatio = Math.min(1.0, (snake.continuousBoostDuration || 0) / 3.5);
    const canBoost = snake.length > this.config.minBoostLength && !snake.isDead;

    let message: string | undefined = undefined;
    if (status === 'winner') {
      message = '🏆 ARENA CHAMPION!';
    } else if (snake.isDead) {
      message = `ELIMINATED BY ${snake.killedBy || 'BARRIER'}`;
    } else if (snake.continuousBoostDuration > 3.5) {
      message = '🔥 CRITICAL OVERHEAT! BURNING MASS! 🔥';
    } else if (snake.continuousBoostDuration >= 3.0) {
      message = '⚠️ OVERHEAT WARNING! RELEASE BOOST!';
    }

    return {
      playerId,
      rank,
      totalPlayers: total,
      score: snake.score,
      status,
      action1Cooldown: !canBoost ? 1.0 : boostGaugeRatio,
      action2Cooldown: 0,
      customStatName: 'LENGTH',
      customStatValue: Math.floor(snake.length),
      message,
    };
  }

  /**
   * Deterministic Leaderboard sorting:
   * 1. Score (highest)
   * 2. Length (longest)
   * 3. Kills (most kills)
   * 4. Least Deaths (fewest deaths)
   * 5. Deterministic ID string comparison
   */
  private compareSerpents(a: SerpentPlayerEntity, b: SerpentPlayerEntity): number {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const aLen = Math.floor(a.length);
    const bLen = Math.floor(b.length);
    if (bLen !== aLen) {
      return bLen - aLen;
    }
    if (b.kills !== a.kills) {
      return b.kills - a.kills;
    }
    const aDeaths = a.deaths || 0;
    const bDeaths = b.deaths || 0;
    if (aDeaths !== bDeaths) {
      return aDeaths - bDeaths;
    }
    return a.id.localeCompare(b.id);
  }

  public getLeaderboard(): ArenaLeaderboardEntry[] {
    const sorted = Object.values(this.serpents).sort((a, b) => this.compareSerpents(a, b));
    return sorted.map((s, index) => {
      let status: 'alive' | 'eliminated' | 'winner' = 'alive';
      if (this.isMatchOver) {
        status = (this.winnerId === s.id || (index === 0 && !this.winnerId)) ? 'winner' : 'eliminated';
      } else if (s.isDead) {
        status = 'eliminated';
      }
      return {
        id: s.id,
        name: s.name,
        score: s.score,
        length: Math.floor(s.length),
        kills: s.kills,
        deaths: s.deaths || 0,
        isDead: s.isDead,
        status,
        color: s.color,
        isBot: s.isBot,
        skin: s.skin,
      };
    });
  }

  public getState(): SerpentArenaState {
    const serpentsOut: Record<string, any> = {};
    for (const id in this.serpents) {
      const s = this.serpents[id];
      serpentsOut[id] = {
        id: s.id,
        name: s.name,
        color: s.color,
        skin: s.skin,
        isBot: s.isBot,
        botArchetype: s.botPersonality,
        x: s.x,
        y: s.y,
        angle: s.angle,
        targetAngle: s.targetAngle,
        speed: s.speed,
        baseSpeed: s.baseSpeed,
        boostSpeed: s.boostSpeed,
        isBoosting: s.isBoosting,
        energy: s.energy,
        score: s.score,
        length: Math.floor(s.length),
        targetLength: Math.floor(s.targetLength),
        body: s.body.map((b) => ({ x: b.x, y: b.y, angle: b.angle })),
        history: s.history.slice(0, 50).map((h) => ({ x: h.x, y: h.y })),
        isDead: s.isDead,
        kills: s.kills,
        deaths: s.deaths || 0,
        invulnerableTimer: s.invulnerableTimer,
      };
    }

    const foodsOut: SerpentFood[] = this.foods.map((f) => ({
      id: f.id,
      x: f.x,
      y: f.y,
      value: f.value,
      color: f.color,
      radius: f.radius,
      isGolden: f.type === 'golden_orb',
      isMagnetized: f.type === 'magnetic',
    }));

    const specialZones: any[] = [];
    if (this.goldenStorm) {
      specialZones.push({
        type: 'golden_storm',
        x: this.goldenStorm.x,
        y: this.goldenStorm.y,
        radius: this.goldenStorm.radius,
        timer: this.goldenStorm.remainingTime,
      });
    }

    if (this.singularityVortex) {
      specialZones.push({
        type: 'black_hole',
        x: this.singularityVortex.x,
        y: this.singularityVortex.y,
        radius: this.singularityVortex.radius,
        timer: this.singularityVortex.remainingTime,
      });
    }

    const leaderboard = this.getLeaderboard().map((l) => ({
      id: l.id,
      name: l.name,
      length: l.length,
      score: l.score,
      color: l.color,
    }));

    return {
      arenaRadius: this.config.arenaRadius,
      foods: foodsOut,
      serpents: serpentsOut,
      specialZones,
      leaderboard,
    };
  }

  public getResults(): MatchResults {
    const leaderboard = this.getLeaderboard();
    const winner = leaderboard[0] || {
      id: '',
      name: 'Champion',
      score: 0,
      color: '#00F5A0',
      skin: 'synth',
    };

    const mostKills = [...leaderboard].sort((a, b) => b.kills - a.kills)[0];

    return {
      gameId: 'serpent-arena',
      winnerId: this.winnerId || winner.id,
      winnerName: winner.name,
      winnerAvatar: 'crown',
      winnerColor: winner.color,
      rankings: leaderboard.map((entry, idx) => ({
        id: entry.id,
        name: entry.name,
        score: entry.score,
        rank: idx + 1,
        avatar: entry.skin,
        color: entry.color,
        isBot: entry.isBot,
        statSummary: `${entry.length} Length | ${entry.kills} Kills | ${entry.deaths || 0} Deaths`,
      })),
      durationSeconds: this.config.roundDuration - this.matchTimeRemaining,
      mvpStat: mostKills && mostKills.kills > 0 ? `Apex Predator: ${mostKills.name} (${mostKills.kills} Kills)` : undefined,
    };
  }

  // -------------------------------------------------------------
  // EVENT LISTENER SUBSCRIPTIONS
  // -------------------------------------------------------------

  public onEvent(callback: (event: GameEventPayload) => void): void {
    this.eventListeners.push(callback);
  }

  private emitEvent(event: GameEventPayload): void {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  private triggerMatchOver(winner?: SerpentPlayerEntity, announcementText?: string): void {
    if (this.isMatchOver || this.matchOverTriggered) return;

    this.isMatchOver = true;
    this.matchOverTriggered = true;

    if (!winner) {
      const leaderboard = this.getLeaderboard();
      if (leaderboard.length > 0) {
        winner = this.serpents[leaderboard[0].id];
      }
    }

    if (winner) {
      winner.isWinner = true;
      this.winnerId = winner.id;
      this.particleSystem.emitVictoryBurst(winner.x, winner.y);
      this.particleSystem.addFloatingText('👑 ARENA CHAMPION! 👑', winner.x, winner.y - 45, '#FFD700');
    }

    soundManager.playVictoryFanfare();
    const results = this.getResults();
    this.emitEvent({
      type: 'announcement',
      payload: {
        title: announcementText || 'MATCH COMPLETED!',
        description: `Winner: ${results.winnerName} with ${results.rankings[0]?.score || 0} pts!`,
      },
    });
  }

  /**
   * Calculates minimum distance from point (px, py) to line segment [(x1, y1), (x2, y2)].
   * Used for Continuous Collision Detection (CCD) to prevent tunneling through bodies.
   */
  private distToSegment(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    px: number,
    py: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) {
      return Math.hypot(px - x1, py - y1);
    }
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  /**
   * Calculates minimum distance between two 2D line segments [P1, P2] and [P3, P4].
   * Used for swept capsule-to-capsule CCD to prevent high-speed tunneling.
   */
  private distSegmentToSegment(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number
  ): number {
    const d1 = this.distToSegment(x1, y1, x2, y2, x3, y3);
    const d2 = this.distToSegment(x1, y1, x2, y2, x4, y4);
    const d3 = this.distToSegment(x3, y3, x4, y4, x1, y1);
    const d4 = this.distToSegment(x3, y3, x4, y4, x2, y2);
    return Math.min(d1, d2, d3, d4);
  }


  private shortestAngleDiff(current: number, target: number): number {
    let diff = (target - current) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  }

  private interpolateAngle(a: number, b: number, t: number): number {
    const diff = this.shortestAngleDiff(a, b);
    return a + diff * t;
  }

  // -------------------------------------------------------------
  // DEV / QA SPECIALIST API
  // -------------------------------------------------------------

  public spawnBot(personality?: BotPersonality, name?: string, color?: string): string {
    const archetypes: BotPersonality[] = ['aggressive', 'defensive', 'collector', 'ambusher', 'chaotic'];
    const chosenArchetype = personality || archetypes[Math.floor(Math.random() * archetypes.length)];
    const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const botColors = ['#FF3366', '#FFB224', '#00E5FF', '#9D4EDD', '#00F5A0', '#FF7700'];
    const botColor = color || botColors[Math.floor(Math.random() * botColors.length)];
    const botName = name || `[AI] ${chosenArchetype.toUpperCase()}_BOT`;

    const skins: SnakeSkinId[] = ['synth', 'mecha', 'cosmic', 'glitch', 'molten'];
    const skin = skins[Math.floor(Math.random() * skins.length)];

    this.addPlayer({
      id: botId,
      socketId: `socket_${botId}`,
      name: botName,
      avatar: 'robot',
      color: botColor,
      skin,
      isHost: false,
      isBot: true,
      botArchetype: chosenArchetype,
      isReady: true,
      score: 0,
      ping: 0,
      connected: true,
      lastActive: Date.now(),
    });

    this.particleSystem.addFloatingText(`BOT SPAWNED (${chosenArchetype.toUpperCase()})`, 0, 0, '#00F5A0');
    return botId;
  }

  public forceEliminate(playerId: string, reason: string = 'DEV QA FORCED ELIMINATION'): void {
    const victim = this.serpents[playerId];
    if (victim && !victim.isDead) {
      this.eliminateSnake(victim, undefined, reason);
    }
  }

  public forceWin(playerId: string): void {
    const winner = this.serpents[playerId];
    if (winner) {
      winner.isDead = false;
      winner.score += 1000;
      this.triggerMatchOver(winner, `DEV QA: ${winner.name} FORCED VICTORY!`);
    } else {
      this.triggerMatchOver(undefined, 'DEV QA: FORCED MATCH WIN!');
    }
  }

  public triggerEvent(type: 'golden_storm' | 'singularity_vortex' | 'jackpot_rain' = 'golden_storm'): void {
    if (type === 'golden_storm') {
      this.spawnGoldenStorm();
    } else if (type === 'singularity_vortex') {
      this.spawnSingularityVortex();
    } else if (type === 'jackpot_rain') {
      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (this.config.arenaRadius * 0.7);
        this.spawnFoodPellet('jackpot', Math.cos(angle) * dist, Math.sin(angle) * dist, 2.0);
      }
      soundManager.playVictoryFanfare();
      this.particleSystem.addFloatingText('💎 JACKPOT RAIN EVENT! 💎', 0, 0, '#FFB224');
    } else {
      this.spawnGoldenStorm();
    }
  }

  public setModifiers(modifiers: Partial<{ turboSpeed: boolean; doubleGrowthOrScore: boolean; lowGravity: boolean; chaosMode: boolean }>): void {
    if (modifiers.turboSpeed) {
      this.config.baseSpeed = 340;
      this.config.boostSpeed = 580;
    } else {
      this.config.baseSpeed = 195;
      this.config.boostSpeed = 351;
    }

    if (modifiers.doubleGrowthOrScore) {
      this.growthMultiplier = 2.0;
      this.scoreMultiplier = 2.0;
    } else {
      this.growthMultiplier = 1.0;
      this.scoreMultiplier = 1.0;
    }

    if (modifiers.chaosMode) {
      this.config.baseSpeed = 380;
      this.config.boostSpeed = 640;
      this.config.goldenStormInterval = 12;
      this.config.singularityVortexInterval = 16;
    }
  }

  public setPlayerConnected(playerId: string, connected: boolean): void {
    const snake = this.serpents[playerId];
    if (snake) {
      if (!connected) {
        this.particleSystem.addFloatingText(`${snake.name} DISCONNECTED`, snake.x, snake.y, '#FF3366');
      } else {
        this.particleSystem.addFloatingText(`${snake.name} RECONNECTED`, snake.x, snake.y, '#00F5A0');
      }
    }
  }
}

