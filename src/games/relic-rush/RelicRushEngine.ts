import { Player, ControllerInput, PlayerClientHUDState, MatchResults, GameEventPayload } from '../../types';
import {
  RelicEntity,
  RelicTier,
  PowerupType,
  PlayerRelicRushState,
  VaultHazardPit,
  Particle,
  FloatingText,
  Shockwave,
  RelicRushEngineConfig,
} from './types';

export class RelicRushEngine {
  // Arena & Configuration
  public readonly width: number;
  public readonly height: number;
  public readonly minX: number = 70;
  public readonly maxX: number;
  public readonly minY: number = 70;
  public readonly maxY: number;

  private matchDuration: number;
  private matchTimeRemaining: number;
  public isGameOver: boolean = false;
  public isMatchOver: boolean = false;
  public state: 'playing' | 'finished' = 'playing';
  private config: RelicRushEngineConfig;

  // Entities
  private players: Map<string, PlayerRelicRushState> = new Map();
  private relics: Map<string, RelicEntity> = new Map();
  private hazardPits: VaultHazardPit[] = [];
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private shockwaves: Shockwave[] = [];

  // Spawning & Timers
  private nextRelicId: number = 1;
  private nextTextId: number = 1;
  private nextShockwaveId: number = 1;
  private relicSpawnTimer: number = 0;
  private cosmicCoreTimer: number = 0;
  private powerupSpawnTimer: number = 0;
  private globalTime: number = 0;

  // Screen shake & Announcements
  private screenShakeIntensity: number = 0;
  private screenShakeDuration: number = 0;
  private bannerText: string = 'COLLECT RELICS & SLAM RIVALS!';
  private bannerTimer: number = 4.0;
  private bannerColor: string = '#FFB224';

  // Callbacks
  public onSound?: (sound: 'click' | 'pickup' | 'boost' | 'zap' | 'hit' | 'elimination' | 'fanfare' | 'stinger', pitch?: number) => void;
  public onEvent?: (event: GameEventPayload) => void;

  constructor(
    playersMap: Record<string, Player>,
    configOverrides?: Partial<RelicRushEngineConfig>
  ) {
    this.width = configOverrides?.arenaWidth || 1920;
    this.height = configOverrides?.arenaHeight || 1080;
    this.maxX = this.width - 70;
    this.maxY = this.height - 70;

    this.matchDuration = configOverrides?.matchDuration || 90;
    this.matchTimeRemaining = this.matchDuration;

    this.config = {
      arenaWidth: this.width,
      arenaHeight: this.height,
      matchDuration: this.matchDuration,
      maxRelicsCount: configOverrides?.maxRelicsCount || 42,
      cosmicCoreInterval: configOverrides?.cosmicCoreInterval || 18,
      powerupsEnabled: configOverrides?.powerupsEnabled !== false,
      difficulty: configOverrides?.difficulty || 'normal',
    };

    this.initArenaHazards();
    this.initPlayers(playersMap);
    this.seedInitialRelics();
  }

  // -------------------------------------------------------------------------
  // DETERMINISTIC COMPARATOR & TIE-BREAKER
  // Rule: Score (desc) -> Gems Collected (desc) -> Least Times Tackled (asc) -> Player ID (asc)
  // -------------------------------------------------------------------------
  public static comparePlayers(a: PlayerRelicRushState, b: PlayerRelicRushState): number {
    if (b.bankedScore !== a.bankedScore) {
      return b.bankedScore - a.bankedScore;
    }
    if (b.relicsCollectedCount !== a.relicsCollectedCount) {
      return b.relicsCollectedCount - a.relicsCollectedCount;
    }
    if (a.tacklesReceived !== b.tacklesReceived) {
      return a.tacklesReceived - b.tacklesReceived;
    }
    return a.id.localeCompare(b.id);
  }

  // -------------------------------------------------------------------------
  // INITIALIZATION
  // -------------------------------------------------------------------------

  private initArenaHazards(): void {
    const cx = this.width / 2;
    const cy = this.height / 2;

    this.hazardPits = [
      {
        id: 'hazard_1',
        x: cx - 420,
        y: cy - 240,
        radius: 85,
        pulsePhase: 0,
        pulseSpeed: 1.5,
        intensity: 0.7,
        active: true,
      },
      {
        id: 'hazard_2',
        x: cx + 420,
        y: cy + 240,
        radius: 85,
        pulsePhase: Math.PI,
        pulseSpeed: 1.5,
        intensity: 0.7,
        active: true,
      },
      {
        id: 'hazard_3',
        x: cx - 420,
        y: cy + 240,
        radius: 85,
        pulsePhase: Math.PI * 0.5,
        pulseSpeed: 1.5,
        intensity: 0.7,
        active: true,
      },
      {
        id: 'hazard_4',
        x: cx + 420,
        y: cy - 240,
        radius: 85,
        pulsePhase: Math.PI * 1.5,
        pulseSpeed: 1.5,
        intensity: 0.7,
        active: true,
      },
    ];
  }

  private initPlayers(playersMap: Record<string, Player>): void {
    const playerList = Object.values(playersMap);
    const count = Math.max(1, playerList.length);
    const cx = this.width / 2;
    const cy = this.height / 2;
    const spawnRadius = Math.min(this.width, this.height) * 0.35;

    playerList.forEach((p, idx) => {
      const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(angle) * spawnRadius;
      const py = cy + Math.sin(angle) * spawnRadius;

      const playerState: PlayerRelicRushState = {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        color: p.color || '#00F5A0',
        skin: p.skin,
        isBot: !!p.isBot,
        botArchetype: p.botArchetype || 'collector',

        x: px,
        y: py,
        vx: 0,
        vy: 0,
        angle: angle + Math.PI,
        targetAngle: angle + Math.PI,
        speed: 0,
        maxSpeed: (() => {
          if (!p.isBot) return 340;
          const diff =
            this.config.difficulty === 'easy'
              ? 'easy'
              : this.config.difficulty === 'hard' || this.config.difficulty === 'extreme'
              ? 'hard'
              : 'medium';
          return diff === 'easy' ? 289 : diff === 'hard' ? 374 : 340;
        })(),
        acceleration: 850,
        mass: 1.0,

        hoardedValue: 0,
        bankedScore: 0,
        tacklesLanded: 0,
        tacklesReceived: 0,
        relicsCollectedCount: 0,
        cosmicCoresClaimed: 0,

        tackleCooldown: 0,
        maxTackleCooldown: 2.4,
        isTackling: false,
        tackleTimer: 0,
        tackleHeading: angle + Math.PI,

        activePowerup: null,
        powerupInventory: null,
        magnetTimer: 0,
        shieldTimer: 0,
        isShieldActive: false,
        shieldCooldown: 0,
        maxShieldCooldown: 6.0,
        hoardAccumulator: 0,

        isStunned: false,
        stunTimer: 0,
        damageFlashTimer: 0,
        invulnerableTimer: 0,
        trail: [],

        decoyActive: false,
        decoyX: 0,
        decoyY: 0,
        decoyTimer: 0,

        aiState: 'scavenge',
        aiDecisionTimer: Math.random() * 0.5,
      };

      this.players.set(p.id, playerState);
    });
  }

  private seedInitialRelics(): void {
    // Populate arena with initial diverse relics
    const initialCount = 28;
    for (let i = 0; i < initialCount; i++) {
      this.spawnRandomRelic();
    }
    // Spawn initial powerup beacons
    if (this.config.powerupsEnabled) {
      this.spawnPowerupRelic('magnet');
      this.spawnPowerupRelic('shield');
      this.spawnPowerupRelic('warp');
    }
  }

  // -------------------------------------------------------------------------
  // RELIC SPAWNING ECONOMY
  // -------------------------------------------------------------------------

  private spawnRelic(
    tier: RelicTier,
    x?: number,
    y?: number,
    vx = 0,
    vy = 0,
    vz = 0
  ): RelicEntity {
    const id = `relic_${this.nextRelicId++}`;
    const margin = 120;
    const rawX = x !== undefined ? x : margin + Math.random() * (this.width - margin * 2);
    const rawY = y !== undefined ? y : margin + Math.random() * (this.height - margin * 2);

    // Strict clamping within arena boundaries
    const posX = Math.max(this.minX, Math.min(this.maxX, rawX));
    const posY = Math.max(this.minY, Math.min(this.maxY, rawY));

    let value = 10;
    let radius = 13;
    let color = '#FFB224'; // Bronze / Amber
    let glowColor = 'rgba(255, 178, 36, 0.6)';

    switch (tier) {
      case 'bronze':
        value = 10;
        radius = 13;
        color = '#E69500';
        glowColor = 'rgba(230, 149, 0, 0.6)';
        break;
      case 'silver':
        value = 25;
        radius = 17;
        color = '#00E5FF';
        glowColor = 'rgba(0, 229, 255, 0.75)';
        break;
      case 'diamond':
        value = 50;
        radius = 21;
        color = '#00F5A0';
        glowColor = 'rgba(0, 245, 160, 0.85)';
        break;
      case 'cosmic':
        value = 100;
        radius = 28;
        color = '#FF007F';
        glowColor = 'rgba(255, 0, 127, 0.95)';
        break;
    }

    const relic: RelicEntity = {
      id,
      type: tier,
      tier,
      x: posX,
      y: posY,
      vx,
      vy,
      z: vz > 0 ? 15 : 0,
      vz,
      value,
      radius,
      color,
      glowColor,
      spawnTime: this.globalTime,
      pickupGraceTimer: vz > 0 || vx !== 0 || vy !== 0 ? 0.35 : 0,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 3,
      sparkleTimer: Math.random(),
    };

    this.relics.set(id, relic);
    return relic;
  }

  private spawnRandomRelic(x?: number, y?: number): RelicEntity {
    const roll = Math.random();
    let tier: RelicTier = 'bronze';
    if (roll > 0.88) {
      tier = 'diamond';
    } else if (roll > 0.60) {
      tier = 'silver';
    } else {
      tier = 'bronze';
    }
    return this.spawnRelic(tier, x, y);
  }

  private spawnCosmicCore(): void {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const x = cx + (Math.random() - 0.5) * 320;
    const y = cy + (Math.random() - 0.5) * 220;

    this.spawnRelic('cosmic', x, y, 0, 0, 8);

    // Announce Cosmic Core
    this.bannerText = '🌟 LEGENDARY COSMIC CORE SPAWNED (+100 PTS)!';
    this.bannerTimer = 4.5;
    this.bannerColor = '#FF007F';
    this.triggerShockwave(x, y, 240, '#FF007F', 6);
    this.addScreenShake(8, 0.4);

    if (this.onSound) {
      this.onSound('stinger', 600);
    }
    if (this.onEvent) {
      this.onEvent({
        type: 'announcement',
        payload: {
          title: 'COSMIC CORE SPAWNED!',
          description: 'A 100-Point Legendary Core has materialized in the vault!',
        },
      });
    }
  }

  private spawnPowerupRelic(forcedType?: PowerupType, x?: number, y?: number): RelicEntity {
    const types: PowerupType[] = ['magnet', 'shield', 'warp'];
    const pType = forcedType || types[Math.floor(Math.random() * types.length)];
    const id = `powerup_${this.nextRelicId++}`;
    const margin = 140;
    const rawX = x !== undefined ? x : margin + Math.random() * (this.width - margin * 2);
    const rawY = y !== undefined ? y : margin + Math.random() * (this.height - margin * 2);

    const posX = Math.max(this.minX, Math.min(this.maxX, rawX));
    const posY = Math.max(this.minY, Math.min(this.maxY, rawY));

    let color = '#00E5FF';
    let glowColor = 'rgba(0, 229, 255, 0.8)';
    if (pType === 'shield') {
      color = '#9D4EDD';
      glowColor = 'rgba(157, 78, 221, 0.8)';
    } else if (pType === 'warp') {
      color = '#FFE600';
      glowColor = 'rgba(255, 230, 0, 0.8)';
    }

    const powerupEntity: RelicEntity = {
      id,
      type: pType,
      tier: 'powerup',
      x: posX,
      y: posY,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      value: 0,
      radius: 18,
      color,
      glowColor,
      spawnTime: this.globalTime,
      pickupGraceTimer: 0,
      rotation: 0,
      rotationSpeed: 2.0,
      sparkleTimer: 0,
    };

    this.relics.set(id, powerupEntity);
    return powerupEntity;
  }

  // -------------------------------------------------------------------------
  // MAIN SIMULATION TICK
  // -------------------------------------------------------------------------

  public tick(dt: number, inputs: Record<string, ControllerInput>): void {
    const clampedDt = Math.min(dt, 0.1);

    // If match is finished, lock all gameplay actions but allow visual FX to settle
    if (this.isGameOver) {
      this.updateVisualFX(clampedDt);
      return;
    }

    this.globalTime += clampedDt;

    // Match Timer
    this.matchTimeRemaining = Math.max(0, this.matchTimeRemaining - clampedDt);
    if (this.matchTimeRemaining <= 0 && !this.isGameOver) {
      this.finishMatch();
      return;
    }

    // Banner ticker decay
    if (this.bannerTimer > 0) {
      this.bannerTimer -= clampedDt;
    }

    // Screen shake decay
    if (this.screenShakeDuration > 0) {
      this.screenShakeDuration -= clampedDt;
      if (this.screenShakeDuration <= 0) {
        this.screenShakeIntensity = 0;
      }
    }

    // 1. Spawning Routine
    this.updateSpawning(clampedDt);

    // 2. Hazard Pits Update
    this.updateHazards(clampedDt);

    // 3. Bot AI Decision Engine
    this.updateBotsAI(clampedDt, inputs);

    // 4. Player Physics, Abilities & Movement
    this.updatePlayers(clampedDt, inputs);

    // 5. Tackling & Player-to-Player Combat Collisions
    this.resolveCombatCollisions();

    // 6. Relic Physics & Magnet Aura Attractions
    this.updateRelics(clampedDt);

    // 7. Relic Collection by Players
    this.resolveRelicCollections();

    // 8. Particles, Shockwaves & Floating Text
    this.updateVisualFX(clampedDt);
  }

  // -------------------------------------------------------------------------
  // SPAWNING SYSTEM
  // -------------------------------------------------------------------------

  private updateSpawning(dt: number): void {
    // Relic batch refill
    this.relicSpawnTimer += dt;
    if (this.relicSpawnTimer > 3.0) {
      this.relicSpawnTimer = 0;
      const activeCount = this.relics.size;
      if (activeCount < this.config.maxRelicsCount) {
        const toSpawn = Math.min(4, this.config.maxRelicsCount - activeCount);
        for (let i = 0; i < toSpawn; i++) {
          this.spawnRandomRelic();
        }
      }
    }

    // Cosmic Core Spawning
    this.cosmicCoreTimer += dt;
    if (this.cosmicCoreTimer >= this.config.cosmicCoreInterval) {
      this.cosmicCoreTimer = 0;
      this.spawnCosmicCore();
    }

    // Powerup Spawns
    if (this.config.powerupsEnabled) {
      this.powerupSpawnTimer += dt;
      if (this.powerupSpawnTimer > 12.0) {
        this.powerupSpawnTimer = 0;
        let powerupCount = 0;
        this.relics.forEach((r) => {
          if (r.tier === 'powerup') powerupCount++;
        });
        if (powerupCount < 3) {
          this.spawnPowerupRelic();
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // HAZARD PITS
  // -------------------------------------------------------------------------

  private updateHazards(dt: number): void {
    this.hazardPits.forEach((pit) => {
      pit.pulsePhase += pit.pulseSpeed * dt;
      if (pit.pulsePhase > Math.PI * 2) {
        pit.pulsePhase -= Math.PI * 2;
      }
      pit.intensity = 0.5 + 0.5 * Math.sin(pit.pulsePhase);
    });
  }

  // -------------------------------------------------------------------------
  // BOT AI DECISION TREE
  // -------------------------------------------------------------------------

  private updateBotsAI(dt: number, inputs: Record<string, ControllerInput>): void {
    const playersList = Array.from(this.players.values());

    // Find current hoard leader
    let maxHoard = -1;
    let hoardLeader: PlayerRelicRushState | null = null;
    playersList.forEach((p) => {
      if (p.hoardedValue > maxHoard) {
        maxHoard = p.hoardedValue;
        hoardLeader = p;
      }
    });

    const diff =
      this.config.difficulty === 'easy'
        ? 'easy'
        : this.config.difficulty === 'hard' || this.config.difficulty === 'extreme'
        ? 'hard'
        : 'medium';

    playersList.forEach((bot) => {
      if (!bot.isBot) return;

      let inputX = 0;
      let inputY = 0;
      let action1 = false; // Tackle
      let action2 = false; // Powerup

      bot.aiDecisionTimer = (bot.aiDecisionTimer || 0) - dt;
      const archetype = bot.botArchetype || 'collector';

      // 1. THREAT DETECTION (Defensive Reaction)
      let incomingThreat = false;
      playersList.forEach((other) => {
        if (other.id === bot.id) return;
        const dx = other.x - bot.x;
        const dy = other.y - bot.y;
        const d = Math.hypot(dx, dy);

        if (other.isTackling && d < (diff === 'hard' ? 260 : 220)) {
          incomingThreat = true;
        }
      });

      // Defensive deployment
      if (incomingThreat) {
        if (bot.powerupInventory === 'shield' || (bot.shieldTimer <= 0 && archetype === 'defensive')) {
          action2 = true; // Activate shield
        } else if (bot.powerupInventory === 'warp') {
          action2 = true; // Warp away
        }
      }

      // 2. TARGET SELECTION (Greed vs Combat)
      let targetX = this.width / 2;
      let targetY = this.height / 2;
      let pursueCombat = false;

      // Aggression check: Hunt hoard leader if leader has valuable stash
      if (
        hoardLeader &&
        hoardLeader.id !== bot.id &&
        hoardLeader.hoardedValue >= (diff === 'hard' ? 20 : 30) &&
        (archetype === 'aggressive' || archetype === 'ambusher' || (bot.hoardedValue < 25 && maxHoard >= 50))
      ) {
        const dLeader = Math.hypot(hoardLeader.x - bot.x, hoardLeader.y - bot.y);
        const maxHuntDist = diff === 'hard' ? 750 : 600;
        if (dLeader < maxHuntDist) {
          pursueCombat = true;
          const leadFactor = diff === 'hard' ? 0.35 : 0.2;
          targetX = hoardLeader.x + hoardLeader.vx * leadFactor;
          targetY = hoardLeader.y + hoardLeader.vy * leadFactor;

          // Tackle trigger if in range and facing leader
          if (bot.tackleCooldown <= 0 && dLeader < (diff === 'hard' ? 280 : 240) && !hoardLeader.isShieldActive) {
            const angleToLeader = Math.atan2(hoardLeader.y - bot.y, hoardLeader.x - bot.x);
            const angleDiff = Math.abs(this.normalizeAngle(bot.angle - angleToLeader));
            const angleThreshold = diff === 'hard' ? 0.75 : 0.6;
            if (angleDiff < angleThreshold) {
              if (diff !== 'easy' || Math.random() < 0.25) {
                action1 = true; // Tackle slam!
              }
            }
          }
        }
      }

      // If not hunting combat leader, find highest value/distance relic
      if (!pursueCombat) {
        let bestScore = -Infinity;
        let bestRelic: RelicEntity | null = null;

        this.relics.forEach((relic) => {
          if (relic.pickupGraceTimer > 0) return;
          const dx = relic.x - bot.x;
          const dy = relic.y - bot.y;
          const dist = Math.hypot(dx, dy);

          // Greed valuation
          let valueWeight = relic.value;
          if (relic.tier === 'cosmic') valueWeight *= 3.0;
          if (relic.tier === 'diamond') valueWeight *= 1.8;
          if (relic.tier === 'powerup') {
            if (archetype === 'collector') valueWeight = 45;
            else if (archetype === 'defensive') valueWeight = 60;
            else valueWeight = 30;
          }

          const score = valueWeight / (dist + 35);
          if (score > bestScore) {
            bestScore = score;
            bestRelic = relic;
          }
        });

        if (bestRelic) {
          const targetRelic: RelicEntity = bestRelic;
          targetX = targetRelic.x;
          targetY = targetRelic.y;

          if (
            (archetype === 'collector' || archetype === 'chaotic') &&
            targetRelic.value >= 50 &&
            bestScore > 0.3 &&
            bot.tackleCooldown <= 0
          ) {
            const d = Math.hypot(targetRelic.x - bot.x, targetRelic.y - bot.y);
            if (d > 200 && d < 450) {
              action1 = true;
            }
          }
        }

        // Use Magnet powerup if lots of relics nearby
        if (bot.powerupInventory === 'magnet' && bot.magnetTimer <= 0) {
          action2 = true;
        }
      }

      // 3. HAZARD PIT AVOIDANCE
      this.hazardPits.forEach((pit) => {
        const dx = bot.x - pit.x;
        const dy = bot.y - pit.y;
        const d = Math.hypot(dx, dy);
        const dangerRadius = pit.radius + 60;
        if (d < dangerRadius && d > 0) {
          const repelStrength = (dangerRadius - d) / dangerRadius;
          targetX += (dx / d) * repelStrength * 350;
          targetY += (dy / d) * repelStrength * 350;
        }
      });

      // Directional steering vector
      const toTargetX = targetX - bot.x;
      const toTargetY = targetY - bot.y;
      const targetDist = Math.hypot(toTargetX, toTargetY);

      if (targetDist > 10) {
        inputX = toTargetX / targetDist;
        inputY = toTargetY / targetDist;
      }

      // Feed into synthetic input record
      inputs[bot.id] = {
        x: Math.max(-1, Math.min(1, inputX)),
        y: Math.max(-1, Math.min(1, inputY)),
        angle: Math.atan2(inputY, inputX),
        magnitude: Math.min(1, targetDist / 50),
        action1,
        action2,
        timestamp: Date.now(),
      };
    });
  }

  // -------------------------------------------------------------------------
  // PLAYER PHYSICS & ABILITY EXECUTION
  // -------------------------------------------------------------------------

  private updatePlayers(dt: number, inputs: Record<string, ControllerInput>): void {
    this.players.forEach((player) => {
      const input = inputs[player.id] || {
        x: 0,
        y: 0,
        angle: player.angle,
        magnitude: 0,
        action1: false,
        action2: false,
        timestamp: Date.now(),
      };

      // Stun Timer
      if (player.isStunned) {
        player.stunTimer -= dt;
        if (player.stunTimer <= 0) {
          player.isStunned = false;
          player.invulnerableTimer = 0.6; // grace period after stun recovery
        }
      }

      // Damage Flash Timer
      if (player.damageFlashTimer > 0) {
        player.damageFlashTimer = Math.max(0, player.damageFlashTimer - dt);
      }

      // Invulnerability grace timer
      if (player.invulnerableTimer > 0) {
        player.invulnerableTimer -= dt;
      }

      // Tackle Cooldown & Active Tackle Dash
      if (player.tackleCooldown > 0) {
        player.tackleCooldown = Math.max(0, player.tackleCooldown - dt);
      }

      if (player.isTackling) {
        player.tackleTimer -= dt;
        if (player.tackleTimer <= 0) {
          player.isTackling = false;
        }
      }

      // Powerup & Shield Timers
      if (player.shieldCooldown > 0) {
        player.shieldCooldown = Math.max(0, player.shieldCooldown - dt);
      }
      if (player.magnetTimer > 0) {
        player.magnetTimer = Math.max(0, player.magnetTimer - dt);
      }
      if (player.shieldTimer > 0) {
        player.shieldTimer = Math.max(0, player.shieldTimer - dt);
        player.isShieldActive = player.shieldTimer > 0;
      } else {
        player.isShieldActive = false;
      }

      // Holding score accumulation: players holding relics accumulate score over time
      if (player.hoardedValue > 0) {
        player.hoardAccumulator = (player.hoardAccumulator || 0) + player.hoardedValue * 0.15 * dt;
        if (player.hoardAccumulator >= 1) {
          const pts = Math.floor(player.hoardAccumulator);
          player.bankedScore += pts;
          player.hoardAccumulator -= pts;
        }
      }

      // Decoy Timer
      if (player.decoyActive && player.decoyTimer) {
        player.decoyTimer -= dt;
        if (player.decoyTimer <= 0) {
          player.decoyActive = false;
        }
      }

      // 1. ACTION 1: TACKLE SLAM
      if (input.action1 && player.tackleCooldown <= 0 && !player.isStunned && !player.isTackling) {
        this.executeTackle(player, input);
      }

      // 2. ACTION 2: ACTIVATE POWERUP / INVENTORY
      if (input.action2 && !player.isStunned) {
        this.activatePowerup(player);
      }

      // 3. MOVEMENT & ACCELERATION (Hoard Mass & Drag Physics)
      if (!player.isStunned) {
        // Carrying relics adds mass & drag: speed decreases slightly as hoard increases
        const hoardDragFactor = Math.max(0.68, 1.0 - (player.hoardedValue / 600) * 0.32);
        player.mass = 1.0 + (player.hoardedValue / 300) * 0.75;
        const currentMaxSpeed = player.maxSpeed * hoardDragFactor;

        if (player.isTackling) {
          // Tackle dash surge velocity
          const dashSpeed = 780;
          player.vx = Math.cos(player.tackleHeading) * dashSpeed;
          player.vy = Math.sin(player.tackleHeading) * dashSpeed;
          player.angle = player.tackleHeading;

          // Tackle motion trail
          if (Math.random() < 0.7) {
            this.addParticle({
              x: player.x,
              y: player.y,
              vx: -player.vx * 0.2 + (Math.random() - 0.5) * 50,
              vy: -player.vy * 0.2 + (Math.random() - 0.5) * 50,
              radius: 12 + Math.random() * 8,
              color: player.color,
              alpha: 0.85,
              maxLife: 0.25,
              life: 0.25,
              type: 'ring',
            });
          }
        } else {
          // Normal Analog Movement
          const inputMag = Math.min(1.0, Math.hypot(input.x, input.y));
          if (inputMag > 0.1) {
            const targetAngle = Math.atan2(input.y, input.x);
            player.targetAngle = targetAngle;
            player.angle = this.lerpAngle(player.angle, targetAngle, 14 * dt);

            // Accelerate
            const ax = Math.cos(player.angle) * player.acceleration * inputMag;
            const ay = Math.sin(player.angle) * player.acceleration * inputMag;
            player.vx += ax * dt;
            player.vy += ay * dt;
          }

          // Damping / Friction
          const friction = 3.8;
          player.vx *= Math.max(0, 1 - friction * dt);
          player.vy *= Math.max(0, 1 - friction * dt);

          // Speed Clamping
          const currentSpeed = Math.hypot(player.vx, player.vy);
          if (currentSpeed > currentMaxSpeed) {
            player.vx = (player.vx / currentSpeed) * currentMaxSpeed;
            player.vy = (player.vy / currentSpeed) * currentMaxSpeed;
          }
          player.speed = currentSpeed;
        }

        // Apply Velocity to Position
        player.x += player.vx * dt;
        player.y += player.vy * dt;

        // Arena Boundaries Clamp & Inward Bounce
        const shipRadius = 24;
        const margin = 40;
        if (player.x < margin + shipRadius) {
          player.x = margin + shipRadius;
          player.vx = Math.abs(player.vx) * 0.5;
        } else if (player.x > this.width - margin - shipRadius) {
          player.x = this.width - margin - shipRadius;
          player.vx = -Math.abs(player.vx) * 0.5;
        }

        if (player.y < margin + shipRadius) {
          player.y = margin + shipRadius;
          player.vy = Math.abs(player.vy) * 0.5;
        } else if (player.y > this.height - margin - shipRadius) {
          player.y = this.height - margin - shipRadius;
          player.vy = -Math.abs(player.vy) * 0.5;
        }
      }

      // Update Player Trail History
      if (player.speed > 30 || player.isTackling) {
        player.trail.unshift({
          x: player.x,
          y: player.y,
          alpha: player.isTackling ? 0.9 : 0.45,
          radius: player.isTackling ? 22 : 14,
        });
        if (player.trail.length > 8) player.trail.pop();
      } else if (player.trail.length > 0) {
        player.trail.pop();
      }

      // Hazard Pit Contact check
      this.checkHazardContact(player);
    });
  }

  private executeTackle(player: PlayerRelicRushState, input: ControllerInput): void {
    player.isTackling = true;
    player.tackleTimer = 0.38;
    player.tackleCooldown = player.maxTackleCooldown;

    // Use input direction or current ship angle
    if (Math.hypot(input.x, input.y) > 0.2) {
      player.tackleHeading = Math.atan2(input.y, input.x);
    } else {
      player.tackleHeading = player.angle;
    }

    this.triggerShockwave(player.x, player.y, 90, player.color, 4);

    if (this.onSound) {
      this.onSound('boost', 400);
    }
  }

  private activatePowerup(player: PlayerRelicRushState): void {
    const powerup = player.powerupInventory;
    if (powerup) {
      if (powerup === 'magnet') {
        player.magnetTimer = 8.0;
        this.bannerText = `${player.name} ACTIVATED MAGNET AURA!`;
        this.bannerTimer = 2.5;
        this.bannerColor = '#00E5FF';
        this.triggerShockwave(player.x, player.y, 160, '#00E5FF', 5);
        if (this.onSound) this.onSound('zap', 800);
      } else if (powerup === 'shield') {
        player.shieldTimer = 7.0;
        player.isShieldActive = true;
        player.shieldCooldown = player.maxShieldCooldown;
        this.bannerText = `${player.name} DEPLOYED KINETIC SHIELD!`;
        this.bannerTimer = 2.5;
        this.bannerColor = '#9D4EDD';
        this.triggerShockwave(player.x, player.y, 140, '#9D4EDD', 5);
        if (this.onSound) this.onSound('zap', 500);
      } else if (powerup === 'warp') {
        this.executeWarpDecoy(player);
      }
      player.powerupInventory = null;
      return;
    }

    // Default ability: Kinetic Shield (1.5s invulnerability to tackles)
    if (player.shieldCooldown <= 0 && player.shieldTimer <= 0) {
      player.shieldTimer = 1.5;
      player.isShieldActive = true;
      player.shieldCooldown = player.maxShieldCooldown;
      this.triggerShockwave(player.x, player.y, 130, '#9D4EDD', 5);
      this.addFloatingText(player.x, player.y - 30, '🛡️ KINETIC SHIELD!', '#9D4EDD', 20);
      if (this.onSound) this.onSound('zap', 650);
    }
  }

  private executeWarpDecoy(player: PlayerRelicRushState): void {
    // 1. Leave Decoy Hologram
    player.decoyActive = true;
    player.decoyX = player.x;
    player.decoyY = player.y;
    player.decoyTimer = 4.0;

    // Origin particle implosion
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 100;
      this.addParticle({
        x: player.x,
        y: player.y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        radius: 4 + Math.random() * 5,
        color: '#FFE600',
        alpha: 0.9,
        maxLife: 0.4,
        life: 0.4,
        type: 'warp',
      });
    }

    // 2. Warp to a safe quadrant away from players
    const safePos = this.findSafeWarpPosition(player.id);
    player.x = safePos.x;
    player.y = safePos.y;
    player.vx = 0;
    player.vy = 0;

    this.bannerText = `⚡ ${player.name} TRIGGERED WARP DECOY!`;
    this.bannerTimer = 2.5;
    this.bannerColor = '#FFE600';

    this.triggerShockwave(player.x, player.y, 180, '#FFE600', 6);
    this.addFloatingText(player.x, player.y - 30, '⚡ QUANTUM WARP!', '#FFE600', 20);

    if (this.onSound) {
      this.onSound('zap', 1100);
    }
  }

  private findSafeWarpPosition(playerId: string): { x: number; y: number } {
    const quadrants = [
      { x: this.width * 0.25, y: this.height * 0.25 },
      { x: this.width * 0.75, y: this.height * 0.25 },
      { x: this.width * 0.25, y: this.height * 0.75 },
      { x: this.width * 0.75, y: this.height * 0.75 },
    ];

    let bestQuad = quadrants[0];
    let maxMinDist = -1;

    quadrants.forEach((q) => {
      let minDist = 9999;
      this.players.forEach((p) => {
        if (p.id === playerId) return;
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < minDist) minDist = d;
      });
      if (minDist > maxMinDist) {
        maxMinDist = minDist;
        bestQuad = q;
      }
    });

    return {
      x: Math.max(this.minX + 40, Math.min(this.maxX - 40, bestQuad.x + (Math.random() - 0.5) * 120)),
      y: Math.max(this.minY + 40, Math.min(this.maxY - 40, bestQuad.y + (Math.random() - 0.5) * 120)),
    };
  }

  private checkHazardContact(player: PlayerRelicRushState): void {
    this.hazardPits.forEach((pit) => {
      const dx = player.x - pit.x;
      const dy = player.y - pit.y;
      const dist = Math.hypot(dx, dy);

      if (dist < pit.radius + 18) {
        if (player.isShieldActive) {
          // Shield absorbs hazard repelling force
          return;
        }

        // Repel player outward
        const repelAngle = Math.atan2(dy, dx);
        player.vx = Math.cos(repelAngle) * 450;
        player.vy = Math.sin(repelAngle) * 450;

        // Drop small gem penalty
        if (player.hoardedValue > 0 && player.invulnerableTimer <= 0) {
          const dropAmount = Math.min(25, Math.max(5, Math.floor(player.hoardedValue * 0.2)));
          player.hoardedValue -= dropAmount;
          player.bankedScore = Math.max(0, player.bankedScore - dropAmount);
          player.invulnerableTimer = 0.8;
          player.damageFlashTimer = 0.45;
          this.scatterGems(player.x, player.y, dropAmount);
          this.addFloatingText(player.x, player.y - 20, `-${dropAmount} GEMS!`, '#FF3366', 20);
          this.addScreenShake(5, 0.25);
          if (this.onSound) this.onSound('hit', 250);
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // COMBAT & TACKLING COLLISIONS
  // -------------------------------------------------------------------------

  private resolveCombatCollisions(): void {
    const playersList = Array.from(this.players.values());

    for (let i = 0; i < playersList.length; i++) {
      for (let j = i + 1; j < playersList.length; j++) {
        const p1 = playersList[i];
        const p2 = playersList[j];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const hitRadius = 48; // combined collision radii

        if (dist < hitRadius && dist > 0) {
          this.handlePlayerCollision(p1, p2, dx, dy, dist);
        }
      }
    }
  }

  private handlePlayerCollision(
    p1: PlayerRelicRushState,
    p2: PlayerRelicRushState,
    dx: number,
    dy: number,
    dist: number
  ): void {
    let nx = 1;
    let ny = 0;
    if (dist > 0.001) {
      nx = dx / dist;
      ny = dy / dist;
    } else {
      nx = Math.cos(p1.angle || 0);
      ny = Math.sin(p1.angle || 0);
    }

    // Case 1: Both tackling into each other (Head-to-head clash)
    if (p1.isTackling && p2.isTackling) {
      // Shield reflection checks during head-on clash
      if (p1.isShieldActive && !p2.isShieldActive) {
        this.resolveTackleImpact(p2, p1, -nx, -ny);
        return;
      }
      if (p2.isShieldActive && !p1.isShieldActive) {
        this.resolveTackleImpact(p1, p2, nx, ny);
        return;
      }

      // Both or neither have shield: Clash!
      p1.isTackling = false;
      p1.tackleTimer = 0;
      p2.isTackling = false;
      p2.tackleTimer = 0;

      p1.isStunned = true;
      p2.isStunned = true;
      p1.stunTimer = 0.45;
      p2.stunTimer = 0.45;

      p1.vx = -nx * 540;
      p1.vy = -ny * 540;
      p2.vx = nx * 540;
      p2.vy = ny * 540;

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      this.triggerShockwave(midX, midY, 190, '#FFB224', 6);
      this.addScreenShake(8, 0.4);
      this.addFloatingText(midX, midY - 20, '⚡ CLASH!', '#FFB224', 22);

      if (this.onSound) this.onSound('hit', 200);
      return;
    }

    // Case 2: P1 is Tackling P2
    if (p1.isTackling && !p2.isTackling) {
      this.resolveTackleImpact(p1, p2, nx, ny);
      return;
    }

    // Case 3: P2 is Tackling P1
    if (p2.isTackling && !p1.isTackling) {
      this.resolveTackleImpact(p2, p1, -nx, -ny);
      return;
    }

    // Case 4: Standard elastic body collision
    const overlap = 48 - dist;
    p1.x -= nx * overlap * 0.5;
    p1.y -= ny * overlap * 0.5;
    p2.x += nx * overlap * 0.5;
    p2.y += ny * overlap * 0.5;

    const relVx = p1.vx - p2.vx;
    const relVy = p1.vy - p2.vy;
    const impulse = (relVx * nx + relVy * ny) * 0.8;
    p1.vx -= nx * impulse;
    p1.vy -= ny * impulse;
    p2.vx += nx * impulse;
    p2.vy += ny * impulse;
  }

  private resolveTackleImpact(
    tackler: PlayerRelicRushState,
    victim: PlayerRelicRushState,
    nx: number,
    ny: number
  ): void {
    // Deduplication: Clear tackler dash state immediately so one tackle cannot multi-strip
    tackler.isTackling = false;
    tackler.tackleTimer = 0;

    // 1. KINETIC SHIELD REFLECTION: Absorbs tackle & reflects tackler with stun + recoil
    if (victim.isShieldActive) {
      tackler.isStunned = true;
      tackler.stunTimer = 0.8;
      tackler.invulnerableTimer = 0;
      tackler.vx = -nx * 650;
      tackler.vy = -ny * 650;

      this.triggerShockwave(victim.x, victim.y, 220, '#9D4EDD', 6);
      this.addFloatingText(victim.x, victim.y - 30, '🛡️ SHIELD REFLECT!', '#9D4EDD', 24);
      this.addScreenShake(6, 0.3);

      // Particle burst on shield reflect
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 100 + Math.random() * 160;
        this.addParticle({
          x: victim.x,
          y: victim.y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          radius: 3 + Math.random() * 4,
          color: '#9D4EDD',
          alpha: 1.0,
          maxLife: 0.45,
          life: 0.45,
          type: 'spark',
        });
      }

      if (this.onSound) this.onSound('zap', 450);
      return;
    }

    // 2. Invulnerability grace check: Victim cannot be multi-tackled repeatedly
    if (victim.invulnerableTimer > 0) {
      victim.vx = nx * 350;
      victim.vy = ny * 350;
      return;
    }

    // 3. SUCCESSFUL AUTHORITATIVE TACKLE SLAM
    tackler.tacklesLanded++;
    victim.tacklesReceived++;
    victim.isStunned = true;
    victim.stunTimer = 0.7;
    victim.invulnerableTimer = 1.2; // Grace period preventing successive sub-frame multi-hits
    victim.damageFlashTimer = 0.45;  // Red damage flash FX

    // Knockback
    victim.vx = nx * 720;
    victim.vy = ny * 720;
    tackler.vx = nx * 100;
    tackler.vy = ny * 100;

    // Dramatic Gem Explosion Scatter: Victim drops ALL held gems across the floor
    const droppedValue = victim.hoardedValue;
    if (droppedValue > 0) {
      victim.hoardedValue = 0;
      victim.bankedScore = Math.max(0, victim.bankedScore - droppedValue);
      this.scatterGems(victim.x, victim.y, droppedValue);
      this.addFloatingText(victim.x, victim.y - 35, `-${droppedValue} GEMS!`, '#FF3366', 24);
    } else {
      this.addFloatingText(victim.x, victim.y - 35, '💥 TACKLE SLAM!', '#FFB224', 20);
    }

    // Tackler earns instant tackle bounty score
    const tackleBounty = 15;
    tackler.bankedScore += tackleBounty;
    this.addFloatingText(tackler.x, tackler.y - 35, `+${tackleBounty} BOUNTY!`, '#00F5A0', 20);

    // Banner announcement for high value slam
    if (droppedValue >= 35) {
      this.bannerText = `💥 ${tackler.name} SHATTERED ${victim.name}'S HOARD (-${droppedValue} GEMS)!`;
      this.bannerTimer = 3.0;
      this.bannerColor = '#FF3366';
    }

    // Double shockwave on impact
    this.triggerShockwave(victim.x, victim.y, 240, '#FF3366', 7);
    this.triggerShockwave(victim.x, victim.y, 140, '#FFB224', 4);
    this.addScreenShake(12, 0.45);

    if (this.onSound) this.onSound('hit', 120);

    // Haptic & Hit feedback to victim controller
    if (this.onEvent) {
      this.onEvent({
        type: 'haptic',
        targetPlayerId: victim.id,
        payload: { intensity: 'heavy', duration: 400 },
      });
      this.onEvent({
        type: 'hit',
        targetPlayerId: victim.id,
        payload: { text: `Tackled by ${tackler.name}! Lost ${droppedValue} gems!` },
      });
    }
  }

  // -------------------------------------------------------------------------
  // SCATTER PHYSICS & BOUNDARY CLAMPING
  // -------------------------------------------------------------------------

  private scatterGems(x: number, y: number, totalValue: number): void {
    // Clamp scatter origin within arena boundaries
    const clampedSpawnX = Math.max(this.minX + 20, Math.min(this.maxX - 20, x));
    const clampedSpawnY = Math.max(this.minY + 20, Math.min(this.maxY - 20, y));

    // Decompose totalValue into tier denominations
    const pieces: { tier: RelicTier; value: number }[] = [];
    let rem = totalValue;

    while (rem >= 100 && Math.random() < 0.4) {
      pieces.push({ tier: 'cosmic', value: 100 });
      rem -= 100;
    }
    while (rem >= 50 && Math.random() < 0.6) {
      pieces.push({ tier: 'diamond', value: 50 });
      rem -= 50;
    }
    while (rem >= 25) {
      pieces.push({ tier: 'silver', value: 25 });
      rem -= 25;
    }
    while (rem >= 10) {
      pieces.push({ tier: 'bronze', value: 10 });
      rem -= 10;
    }
    if (rem > 0) {
      pieces.push({ tier: 'bronze', value: rem });
    }

    // Directional spread bias inward if near walls
    const centerAngle = Math.atan2(this.height / 2 - clampedSpawnY, this.width / 2 - clampedSpawnX);
    const distFromWall = Math.min(
      clampedSpawnX - this.minX,
      this.maxX - clampedSpawnX,
      clampedSpawnY - this.minY,
      this.maxY - clampedSpawnY
    );

    pieces.forEach((piece) => {
      let burstAngle: number;
      if (distFromWall < 120) {
        burstAngle = centerAngle + (Math.random() - 0.5) * Math.PI * 0.8;
      } else {
        burstAngle = Math.random() * Math.PI * 2;
      }

      const speed = 220 + Math.random() * 300;
      const vx = Math.cos(burstAngle) * speed;
      const vy = Math.sin(burstAngle) * speed;
      const vz = 10 + Math.random() * 12;

      const relic = this.spawnRelic(piece.tier, clampedSpawnX, clampedSpawnY, vx, vy, vz);
      relic.value = piece.value; // Exact value conservation
    });

    // Dramatic shatter particle explosion
    const particleColors = ['#FFB224', '#00E5FF', '#00F5A0', '#FF007F', '#FFFFFF'];
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 220;
      this.addParticle({
        x: clampedSpawnX,
        y: clampedSpawnY,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        radius: 3 + Math.random() * 5,
        color: particleColors[Math.floor(Math.random() * particleColors.length)],
        alpha: 1.0,
        maxLife: 0.55,
        life: 0.55,
        type: 'shatter',
      });
    }
  }

  // -------------------------------------------------------------------------
  // RELIC PHYSICS & MAGNET AURA
  // -------------------------------------------------------------------------

  private updateRelics(dt: number): void {
    const playersList = Array.from(this.players.values());

    this.relics.forEach((relic) => {
      // Rotation animation
      relic.rotation += relic.rotationSpeed * dt;
      relic.sparkleTimer += dt * 3;

      // Pickup grace period decay
      if (relic.pickupGraceTimer > 0) {
        relic.pickupGraceTimer = Math.max(0, relic.pickupGraceTimer - dt);
      }

      // 3D Bounce & Velocity Physics
      if (relic.vz !== 0 || relic.z > 0) {
        const gravity = 28;
        relic.vz -= gravity * dt * 60;
        relic.z += relic.vz * dt;

        if (relic.z <= 0) {
          relic.z = 0;
          if (Math.abs(relic.vz) > 3) {
            relic.vz = -relic.vz * 0.45; // restitution bounce
          } else {
            relic.vz = 0;
          }
        }
      }

      // Horizontal friction & movement
      if (relic.vx !== 0 || relic.vy !== 0) {
        relic.x += relic.vx * dt;
        relic.y += relic.vy * dt;
        relic.vx *= Math.max(0, 1 - 4.5 * dt);
        relic.vy *= Math.max(0, 1 - 4.5 * dt);

        // Wall boundary inward bounce & strict clamping
        if (relic.x < this.minX) {
          relic.x = this.minX;
          relic.vx = Math.abs(relic.vx) * 0.7;
        } else if (relic.x > this.maxX) {
          relic.x = this.maxX;
          relic.vx = -Math.abs(relic.vx) * 0.7;
        }
        if (relic.y < this.minY) {
          relic.y = this.minY;
          relic.vy = Math.abs(relic.vy) * 0.7;
        } else if (relic.y > this.maxY) {
          relic.y = this.maxY;
          relic.vy = -Math.abs(relic.vy) * 0.7;
        }
      }

      // MAGNET AURA ATTRACTION
      playersList.forEach((player) => {
        if (player.magnetTimer > 0 && relic.pickupGraceTimer <= 0) {
          const dx = player.x - relic.x;
          const dy = player.y - relic.y;
          const dist = Math.hypot(dx, dy);
          const magnetRadius = 280;

          if (dist < magnetRadius && dist > 5) {
            const pullForce = 450 * (1 - dist / magnetRadius) + 200;
            relic.vx += (dx / dist) * pullForce * dt;
            relic.vy += (dy / dist) * pullForce * dt;
            relic.isMagnetizedTo = player.id;
          }
        }
      });
    });
  }

  // -------------------------------------------------------------------------
  // RELIC COLLECTION
  // -------------------------------------------------------------------------

  private resolveRelicCollections(): void {
    const toDelete: string[] = [];

    this.players.forEach((player) => {
      this.relics.forEach((relic) => {
        if (relic.pickupGraceTimer > 0) return;

        const dx = player.x - relic.x;
        const dy = player.y - relic.y;
        const dist = Math.hypot(dx, dy);
        const collectionRadius = 34 + relic.radius;

        if (dist < collectionRadius) {
          toDelete.push(relic.id);
          this.handleRelicCollect(player, relic);
        }
      });
    });

    toDelete.forEach((id) => this.relics.delete(id));
  }

  private handleRelicCollect(player: PlayerRelicRushState, relic: RelicEntity): void {
    if (relic.tier === 'powerup') {
      // Powerup Pickup
      const pType = relic.type as PowerupType;
      player.powerupInventory = pType;

      let pLabel = 'MAGNET AURA';
      if (pType === 'shield') pLabel = 'KINETIC SHIELD';
      if (pType === 'warp') pLabel = 'WARP DECOY';

      this.addFloatingText(player.x, player.y - 25, `+${pLabel}!`, relic.color, 18);
      this.triggerShockwave(relic.x, relic.y, 80, relic.color, 3);

      if (this.onSound) this.onSound('pickup', 900);
      return;
    }

    // Standard Relic Value Collection
    player.hoardedValue += relic.value;
    player.bankedScore += relic.value;
    player.relicsCollectedCount++;

    if (relic.tier === 'cosmic') {
      player.cosmicCoresClaimed++;
      this.bannerText = `🌟 ${player.name} CLAIMED THE COSMIC CORE (+100 PTS)!`;
      this.bannerTimer = 3.5;
      this.bannerColor = '#FF007F';
      this.triggerShockwave(player.x, player.y, 240, '#FF007F', 6);
      this.addScreenShake(6, 0.35);
      this.addFloatingText(relic.x, relic.y - 20, `+100 COSMIC CORE!`, '#FF007F', 24);
      if (this.onSound) this.onSound('fanfare');
    } else {
      if (this.onSound) {
        const pitch = relic.tier === 'diamond' ? 880 : relic.tier === 'silver' ? 700 : 540;
        this.onSound('pickup', pitch);
      }
      this.addFloatingText(relic.x, relic.y - 18, `+${relic.value} PTS`, relic.color, relic.value >= 50 ? 22 : 16);
    }

    // Collection sparkle effect
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 50 + Math.random() * 100;
      this.addParticle({
        x: relic.x,
        y: relic.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        radius: 2 + Math.random() * 4,
        color: relic.color,
        alpha: 0.95,
        maxLife: 0.4,
        life: 0.4,
        type: 'spark',
      });
    }
  }

  // -------------------------------------------------------------------------
  // VISUAL EFFECTS (Particles, Shockwaves, Floating Texts)
  // -------------------------------------------------------------------------

  private triggerShockwave(
    x: number,
    y: number,
    maxRadius: number,
    color: string,
    lineWidth = 4
  ): void {
    this.shockwaves.push({
      id: `sw_${this.nextShockwaveId++}`,
      x,
      y,
      radius: 10,
      maxRadius,
      color,
      lineWidth,
      alpha: 1.0,
      speed: maxRadius * 3.5,
    });
  }

  private addParticle(p: Particle): void {
    this.particles.push(p);
  }

  private addFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    fontSize = 16
  ): void {
    this.floatingTexts.push({
      id: `txt_${this.nextTextId++}`,
      x,
      y,
      text,
      color,
      fontSize,
      alpha: 1.0,
      life: 0.85,
      maxLife: 0.85,
      vy: -48,
      scale: 1.0,
    });
  }

  private addScreenShake(intensity: number, duration: number): void {
    this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity);
    this.screenShakeDuration = Math.max(this.screenShakeDuration, duration);
  }

  private updateVisualFX(dt: number): void {
    // 1. Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed * dt;
      sw.alpha = Math.max(0, 1.0 - sw.radius / sw.maxRadius);
      if (sw.radius >= sw.maxRadius || sw.alpha <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }

    // 2. Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 3. Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const txt = this.floatingTexts[i];
      txt.life -= dt;
      txt.y += txt.vy * dt;
      txt.alpha = Math.max(0, txt.life / txt.maxLife);
      if (txt.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  // -------------------------------------------------------------------------
  // CANVAS 2D HIGH-PERFORMANCE RENDERER
  // -------------------------------------------------------------------------

  public render(ctx: CanvasRenderingContext2D, screenWidth: number, screenHeight: number): void {
    ctx.save();

    // Screen shake transform
    if (this.screenShakeDuration > 0 && this.screenShakeIntensity > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
      const shakeY = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
      ctx.translate(shakeX, shakeY);
    }

    // Scaling to fit viewport
    const scaleX = screenWidth / this.width;
    const scaleY = screenHeight / this.height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (screenWidth - this.width * scale) / 2;
    const offsetY = (screenHeight - this.height * scale) / 2;

    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // 1. Arena Background & Cyber Grid
    this.renderArenaGrid(ctx);

    // 2. Dynamic Vault Hazard Pits
    this.renderHazardPits(ctx);

    // 3. Relics & Gemstones (Ground Shadows + 3D Facets + Glints)
    this.renderRelics(ctx);

    // 4. Shockwaves
    this.renderShockwaves(ctx);

    // 5. Player Decoys
    this.renderDecoys(ctx);

    // 6. Players, Thrusters, Orbiting Backpack Gems, Damage Flash & Auras
    this.renderPlayers(ctx);

    // 7. Visual Particles
    this.renderParticles(ctx);

    // 8. Floating Texts
    this.renderFloatingTexts(ctx);

    // 9. Overhead HUD & Arena Leaderboard
    this.renderHUD(ctx);

    ctx.restore();
  }

  private renderArenaGrid(ctx: CanvasRenderingContext2D): void {
    // Dark void base
    ctx.fillStyle = '#08090D';
    ctx.fillRect(0, 0, this.width, this.height);

    // Isometric grid lines
    ctx.strokeStyle = 'rgba(255, 178, 36, 0.07)';
    ctx.lineWidth = 1;
    const step = 60;

    for (let x = 0; x <= this.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y <= this.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // Center arena vault dais
    const cx = this.width / 2;
    const cy = this.height / 2;
    const grad = ctx.createRadialGradient(cx, cy, 50, cx, cy, 550);
    grad.addColorStop(0, 'rgba(255, 178, 36, 0.08)');
    grad.addColorStop(0.5, 'rgba(0, 229, 255, 0.03)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 550, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Arena Border
    ctx.strokeStyle = '#FFB224';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#FFB224';
    ctx.shadowBlur = 15;
    ctx.strokeRect(30, 30, this.width - 60, this.height - 60);
    ctx.shadowBlur = 0;

    // Corner hazard diagonal stripes
    this.renderHazardCorners(ctx);
  }

  private renderHazardCorners(ctx: CanvasRenderingContext2D): void {
    const corners = [
      { x: 30, y: 30 },
      { x: this.width - 30, y: 30 },
      { x: 30, y: this.height - 30 },
      { x: this.width - 30, y: this.height - 30 },
    ];
    ctx.strokeStyle = 'rgba(255, 178, 36, 0.3)';
    ctx.lineWidth = 2;
    corners.forEach((c) => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 40, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  private renderHazardPits(ctx: CanvasRenderingContext2D): void {
    this.hazardPits.forEach((pit) => {
      ctx.save();
      ctx.translate(pit.x, pit.y);

      // Outer hazard ring
      ctx.strokeStyle = `rgba(255, 51, 102, ${0.4 + pit.intensity * 0.4})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, pit.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner pulsating plasma gradient
      const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, pit.radius);
      grad.addColorStop(0, `rgba(255, 51, 102, ${0.3 + pit.intensity * 0.4})`);
      grad.addColorStop(0.7, `rgba(255, 119, 0, ${0.2 + pit.intensity * 0.2})`);
      grad.addColorStop(1, 'rgba(255, 51, 102, 0.02)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, pit.radius, 0, Math.PI * 2);
      ctx.fill();

      // Rotating energy spokes
      ctx.rotate(pit.pulsePhase);
      ctx.strokeStyle = 'rgba(255, 51, 102, 0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(pit.radius - 8, 0);
        ctx.stroke();
      }

      // Center hazard core icon
      ctx.fillStyle = '#FF3366';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }

  private renderRelics(ctx: CanvasRenderingContext2D): void {
    this.relics.forEach((relic) => {
      ctx.save();

      // Floating sine wave animation for grounded gems
      const floatOffset = Math.sin(this.globalTime * 3 + relic.rotation) * 4;
      const renderY = relic.y - relic.z + floatOffset;

      // Ground Drop Shadow (scales with 3D height z)
      const shadowScale = Math.max(0.4, 1 - (relic.z + floatOffset) / 80);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(relic.x, relic.y + 8, relic.radius * shadowScale, relic.radius * 0.5 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ground glow
      ctx.fillStyle = relic.glowColor;
      ctx.shadowColor = relic.color;
      ctx.shadowBlur = relic.tier === 'cosmic' ? 25 : 12;
      ctx.beginPath();
      ctx.arc(relic.x, renderY, relic.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.translate(relic.x, renderY);
      ctx.rotate(relic.rotation);

      // Render Gem Facets based on Tier
      if (relic.tier === 'powerup') {
        this.renderPowerupIcon(ctx, relic.type as PowerupType, relic.radius, relic.color);
      } else if (relic.tier === 'bronze') {
        this.renderBronzeGem(ctx, relic.radius);
      } else if (relic.tier === 'silver') {
        this.renderSilverGem(ctx, relic.radius);
      } else if (relic.tier === 'diamond') {
        this.renderDiamondGem(ctx, relic.radius);
      } else if (relic.tier === 'cosmic') {
        this.renderCosmicCoreGem(ctx, relic.radius);
      }

      // Specular Jewel Glint Sparkles
      this.renderJewelGlint(ctx, relic.radius, relic.tier);

      ctx.restore();
    });
  }

  private renderJewelGlint(ctx: CanvasRenderingContext2D, r: number, tier: RelicTier | 'powerup'): void {
    if (tier === 'powerup') return;
    const glintPhase = Math.sin(this.globalTime * 5 + r);
    if (glintPhase > 0.3) {
      const glintSize = (glintPhase - 0.3) * (r * 0.7);
      ctx.save();
      ctx.translate(-r * 0.35, -r * 0.35);
      ctx.rotate(this.globalTime * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 6;

      // 4-pointed cross star sparkle
      ctx.beginPath();
      ctx.moveTo(-glintSize, 0);
      ctx.quadraticCurveTo(0, 0, 0, -glintSize);
      ctx.quadraticCurveTo(0, 0, glintSize, 0);
      ctx.quadraticCurveTo(0, 0, 0, glintSize);
      ctx.quadraticCurveTo(0, 0, -glintSize, 0);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderBronzeGem(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.fillStyle = '#E69500';
    ctx.strokeStyle = '#FFEAA7';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    const sides = 8;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFAA00';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderSilverGem(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.fillStyle = '#E0F7FA';
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, 0);
    ctx.lineTo(r * 0.5, 0);
    ctx.moveTo(0, -r * 0.5);
    ctx.lineTo(0, r * 0.5);
    ctx.stroke();
  }

  private renderDiamondGem(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.fillStyle = '#00F5A0';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;

    ctx.beginPath();
    const sides = 6;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#80FFDB';
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const px = Math.cos(a) * (r * 0.5);
      const py = Math.sin(a) * (r * 0.5);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private renderCosmicCoreGem(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.shadowColor = '#FF007F';
    ctx.shadowBlur = 20;

    // Outer rotating energy ring
    ctx.strokeStyle = '#FF007F';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Radiant Star Core
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    const points = 8;
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? r * 0.85 : r * 0.45;
      const a = (i / (points * 2)) * Math.PI * 2;
      const px = Math.cos(a) * radius;
      const py = Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Center Pulsing Orb
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  private renderPowerupIcon(
    ctx: CanvasRenderingContext2D,
    type: PowerupType,
    r: number,
    color: string
  ): void {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0B0D12';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (type === 'magnet') {
      ctx.fillText('🧲', 0, 1);
    } else if (type === 'shield') {
      ctx.fillText('🛡️', 0, 1);
    } else if (type === 'warp') {
      ctx.fillText('⚡', 0, 1);
    }
  }

  private renderShockwaves(ctx: CanvasRenderingContext2D): void {
    this.shockwaves.forEach((sw) => {
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.lineWidth;
      ctx.globalAlpha = sw.alpha;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 10;

      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    });
  }

  private renderDecoys(ctx: CanvasRenderingContext2D): void {
    this.players.forEach((p) => {
      if (p.decoyActive && p.decoyX !== undefined && p.decoyY !== undefined) {
        ctx.save();
        ctx.translate(p.decoyX, p.decoyY);
        ctx.globalAlpha = 0.5 + Math.sin(this.globalTime * 15) * 0.3;

        ctx.strokeStyle = '#FFE600';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#FFE600';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('[DECOY]', 0, -32);

        ctx.restore();
      }
    });
  }

  private renderPlayers(ctx: CanvasRenderingContext2D): void {
    this.players.forEach((player) => {
      ctx.save();

      // Motion Blur Trail
      player.trail.forEach((t) => {
        ctx.fillStyle = player.color;
        ctx.globalAlpha = t.alpha * 0.3;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // 1. Active Magnet Aura Visualization
      if (player.magnetTimer > 0) {
        ctx.save();
        const magRadius = 260;
        const grad = ctx.createRadialGradient(player.x, player.y, 20, player.x, player.y, magRadius);
        grad.addColorStop(0, 'rgba(0, 229, 255, 0.15)');
        grad.addColorStop(0.8, 'rgba(0, 229, 255, 0.05)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(player.x, player.y, magRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(player.x, player.y, magRadius * 0.65, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 2. Satellite Orbiting Relics (Hoard Backpack Expansion)
      this.renderOrbitingHoardGems(ctx, player);

      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);

      // 3. Red Damage Flash Halo (when tackled or taking damage)
      if (player.damageFlashTimer > 0) {
        const flashAlpha = player.damageFlashTimer / 0.45;
        ctx.save();
        ctx.strokeStyle = `rgba(255, 51, 102, ${flashAlpha * 0.9})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = '#FF0033';
        ctx.shadowBlur = 24 * flashAlpha;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 4. Ship Thruster Flames
      if (player.speed > 20 || player.isTackling) {
        const flameLength = player.isTackling ? 38 : 16 + (player.speed / player.maxSpeed) * 14;
        ctx.fillStyle = player.isTackling ? '#FF3366' : '#00E5FF';
        ctx.beginPath();
        ctx.moveTo(-18, -8);
        ctx.lineTo(-18 - flameLength, 0);
        ctx.lineTo(-18, 8);
        ctx.closePath();
        ctx.fill();
      }

      // 5. Futuristic Hovercraft Body
      ctx.fillStyle = player.damageFlashTimer > 0 ? '#551122' : '#1A1D26';
      ctx.strokeStyle = player.damageFlashTimer > 0 ? '#FF3366' : player.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = player.damageFlashTimer > 0 ? '#FF3366' : player.color;
      ctx.shadowBlur = player.isTackling ? 20 : 10;

      // Triangular Arrowhead Cybercraft
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(-16, -18);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-16, 18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Cockpit Canopy Glow
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // 6. Kinetic Shield Bubble
      if (player.isShieldActive) {
        ctx.restore();
        ctx.save();
        ctx.translate(player.x, player.y);

        ctx.strokeStyle = '#9D4EDD';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#9D4EDD';
        ctx.shadowBlur = 18;

        const pulseScale = 1.0 + Math.sin(this.globalTime * 12) * 0.08;
        ctx.beginPath();
        ctx.arc(0, 0, 36 * pulseScale, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(157, 78, 221, 0.2)';
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 7. Stunned Visual FX
      if (player.isStunned) {
        ctx.restore();
        ctx.save();
        ctx.translate(player.x, player.y - 32);
        ctx.fillStyle = '#FFE600';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💫 STUNNED', 0, 0);
      }

      ctx.restore();
    });
  }

  private renderOrbitingHoardGems(ctx: CanvasRenderingContext2D, player: PlayerRelicRushState): void {
    if (player.hoardedValue <= 0) return;

    // Dynamic Hoard Backpack Expansion:
    // Scale gem count and orbit radius with current hoarded value
    const hoardFactor = Math.min(1.0, player.hoardedValue / 300);
    const gemCount = Math.min(16, Math.max(1, Math.floor(player.hoardedValue / 20)));
    const innerRadius = 36 + hoardFactor * 14;
    const outerRadius = 56 + hoardFactor * 16;
    const baseAngle = this.globalTime * 2.8;

    // Rear cargo glow expanding with hoard value
    ctx.save();
    const cargoGlowRadius = 14 + hoardFactor * 18;
    ctx.fillStyle = `rgba(255, 178, 36, ${0.15 + hoardFactor * 0.25})`;
    ctx.shadowColor = '#FFB224';
    ctx.shadowBlur = 15 * hoardFactor;
    ctx.beginPath();
    ctx.arc(player.x - 12, player.y, cargoGlowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Layered Orbiting Gems
    for (let i = 0; i < gemCount; i++) {
      const isOuter = i % 2 === 1 && gemCount > 6;
      const radius = isOuter ? outerRadius : innerRadius;
      const speedMult = isOuter ? -0.8 : 1.0;
      const a = baseAngle * speedMult + (i / gemCount) * Math.PI * 2;

      const gx = player.x + Math.cos(a) * radius;
      const gy = player.y + Math.sin(a) * radius;

      // Color tier variety for large hoards
      let gemColor = '#FFB224'; // Bronze / Amber
      if (player.hoardedValue >= 150 && i % 4 === 0) gemColor = '#FF007F'; // Cosmic
      else if (player.hoardedValue >= 75 && i % 3 === 0) gemColor = '#00F5A0'; // Diamond
      else if (player.hoardedValue >= 40 && i % 2 === 0) gemColor = '#00E5FF'; // Silver

      // Glowing tether filament
      ctx.strokeStyle = `rgba(255, 178, 36, ${0.15 + hoardFactor * 0.15})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(gx, gy);
      ctx.stroke();

      // Orbiting gemstone
      ctx.fillStyle = gemColor;
      ctx.shadowColor = gemColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(gx, gy, isOuter ? 3.5 : 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    this.particles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    this.floatingTexts.forEach((txt) => {
      ctx.save();
      ctx.globalAlpha = txt.alpha;
      ctx.fillStyle = txt.color;
      ctx.shadowColor = txt.color;
      ctx.shadowBlur = 8;
      ctx.font = `bold ${txt.fontSize}px 'Press Start 2P', monospace, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(txt.text, txt.x, txt.y);
      ctx.restore();
    });
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    // 1. Overhead Player Counters & Cooldowns
    this.players.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y - 42);

      // Name Tag
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(p.name, 0, -8);

      // Hoarded Gem Score Pill
      ctx.fillStyle = 'rgba(11, 13, 18, 0.85)';
      ctx.strokeStyle = p.hoardedValue > 50 ? '#FFB224' : '#00F5A0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-28, -4, 56, 18, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.hoardedValue > 50 ? '#FFB224' : '#00F5A0';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`💎 ${p.hoardedValue}`, 0, 9);

      // Tackle Cooldown Arc Gauge
      if (p.tackleCooldown > 0) {
        const progress = 1 - p.tackleCooldown / p.maxTackleCooldown;
        ctx.strokeStyle = '#FF3366';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 24, 8, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    });

    // 2. Center Match Timer
    ctx.save();
    ctx.translate(this.width / 2, 50);

    const secondsLeft = Math.ceil(this.matchTimeRemaining);
    const isSuddenDeath = secondsLeft <= 15;

    ctx.fillStyle = 'rgba(11, 13, 18, 0.85)';
    ctx.strokeStyle = isSuddenDeath ? '#FF3366' : '#FFB224';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-90, -25, 180, 50, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#FF3366' : '#FFFFFF';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${secondsLeft}s`, 0, 8);

    ctx.restore();

    // 3. Top Arena Event Announcement Banner
    if (this.bannerTimer > 0) {
      ctx.save();
      ctx.translate(this.width / 2, 110);
      ctx.globalAlpha = Math.min(1.0, this.bannerTimer);

      ctx.fillStyle = 'rgba(11, 13, 18, 0.9)';
      ctx.strokeStyle = this.bannerColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = this.bannerColor;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.roundRect(-300, -20, 600, 40, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.bannerColor;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.bannerText, 0, 6);

      ctx.restore();
    }

    // 4. Live Vault Hoard Leaderboard (Top Right)
    this.renderLiveLeaderboard(ctx);
  }

  private renderLiveLeaderboard(ctx: CanvasRenderingContext2D): void {
    const sortedPlayers = Array.from(this.players.values()).sort(RelicRushEngine.comparePlayers);

    ctx.save();
    const boxX = this.width - 240;
    const boxY = 50;
    const boxHeight = 40 + sortedPlayers.length * 28;

    ctx.fillStyle = 'rgba(11, 13, 18, 0.85)';
    ctx.strokeStyle = '#FFB224';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, 210, boxHeight, 8);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#FFB224';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('VAULT LEADERBOARD', boxX + 16, boxY + 22);

    sortedPlayers.forEach((p, idx) => {
      const rowY = boxY + 50 + idx * 28;
      ctx.fillStyle = idx === 0 ? '#FFE600' : '#FFFFFF';
      ctx.font = '12px sans-serif';
      ctx.fillText(`${idx + 1}. ${p.name.slice(0, 10)}`, boxX + 16, rowY);

      ctx.fillStyle = '#00F5A0';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${p.bankedScore} pts`, boxX + 194, rowY);
      ctx.textAlign = 'left';
    });

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // HUD STATE & MATCH RESULTS
  // -------------------------------------------------------------------------

  public getPlayerHUDState(playerId: string): PlayerClientHUDState {
    const player = this.players.get(playerId);
    const sorted = Array.from(this.players.values()).sort(RelicRushEngine.comparePlayers);
    const rank = sorted.findIndex((p) => p.id === playerId) + 1 || 1;

    if (!player) {
      return {
        playerId,
        rank: 1,
        totalPlayers: this.players.size,
        score: 0,
        status: 'alive',
        action1Cooldown: 0,
        action2Cooldown: 0,
        customStatName: 'HOARDED LOOT',
        customStatValue: '0 GEMS',
        message: 'CONNECTING...',
      };
    }

    // Action 1 Cooldown (Tackle): 0.0 when ready, 0.0 to 1.0 when recharging
    const action1Cooldown = player.tackleCooldown > 0
      ? Math.max(0, Math.min(1, player.tackleCooldown / player.maxTackleCooldown))
      : 0;

    // Action 2 Cooldown & Active Powerup Status
    let action2Cooldown = 0.0;
    let customStatName = 'HOARDED LOOT';
    let customStatValue = `${player.hoardedValue} GEMS`;

    if (player.shieldTimer > 0) {
      action2Cooldown = player.shieldTimer / 1.5;
      customStatName = 'KINETIC SHIELD';
      customStatValue = `${player.shieldTimer.toFixed(1)}s`;
    } else if (player.magnetTimer > 0) {
      action2Cooldown = player.magnetTimer / 8.0;
      customStatName = 'MAGNET AURA';
      customStatValue = `${player.magnetTimer.toFixed(1)}s`;
    } else if (player.powerupInventory) {
      action2Cooldown = 0.0; // Ready to activate!
      customStatName = 'READY POWERUP';
      customStatValue = player.powerupInventory === 'magnet'
        ? 'MAGNET AURA'
        : player.powerupInventory === 'shield'
        ? 'KINETIC SHIELD'
        : 'WARP DECOY';
    } else if (player.shieldCooldown > 0) {
      action2Cooldown = Math.max(0, Math.min(1, player.shieldCooldown / player.maxShieldCooldown));
      customStatName = 'KINETIC SHIELD';
      customStatValue = `${player.shieldCooldown.toFixed(1)}s`;
    }

    let status: PlayerClientHUDState['status'] = 'alive';
    if (this.isGameOver) {
      status = rank === 1 ? 'winner' : 'alive';
    }

    let message = 'HUNT DIAMOND & COSMIC GEMS!';
    if (this.isGameOver) {
      message = rank === 1 ? '👑 VAULT CHAMPION!' : `MATCH FINISHED • RANK #${rank}`;
    } else if (player.isStunned) {
      message = '💫 STUNNED! IMPACT RECOVERY!';
    } else if (player.isTackling) {
      message = '⚡ TACKLE DASH SURGE!';
    } else if (player.shieldTimer > 0) {
      message = `🛡️ SHIELD ACTIVE (${player.shieldTimer.toFixed(1)}s)`;
    } else if (player.magnetTimer > 0) {
      message = `🧲 MAGNET ACTIVE (${player.magnetTimer.toFixed(1)}s)`;
    } else if (player.powerupInventory) {
      message = `READY: [${player.powerupInventory.toUpperCase()}] - TAP ACTION 2!`;
    } else if (player.shieldCooldown <= 0) {
      message = '🛡️ SHIELD READY (ACTION 2) • TACKLE (ACTION 1)';
    } else if (player.tackleCooldown <= 0) {
      message = '⚡ TACKLE READY - SLAM RIVALS!';
    } else {
      message = `TACKLE CHARGING (${player.tackleCooldown.toFixed(1)}s)`;
    }

    return {
      playerId: player.id,
      rank,
      totalPlayers: this.players.size,
      score: player.bankedScore,
      status,
      action1Cooldown,
      action2Cooldown,
      customStatName,
      customStatValue,
      message,
    };
  }

  public getResults(): MatchResults {
    const sorted = Array.from(this.players.values()).sort(RelicRushEngine.comparePlayers);
    const winner = sorted[0] || {
      id: 'p_none',
      name: 'Vault Hunter',
      avatar: 'crown',
      color: '#FFB224',
      bankedScore: 0,
    };

    let mvpTackler = sorted[0];
    sorted.forEach((p) => {
      if (p.tacklesLanded > (mvpTackler?.tacklesLanded || 0)) {
        mvpTackler = p;
      }
    });

    const rankings = sorted.map((p, index) => ({
      id: p.id,
      name: p.name,
      score: p.bankedScore,
      rank: index + 1,
      avatar: p.avatar,
      color: p.color,
      isBot: p.isBot,
      statSummary: `Tackles: ${p.tacklesLanded} | Cores: ${p.cosmicCoresClaimed} | Gems: ${p.relicsCollectedCount} | Tackled: ${p.tacklesReceived}`,
    }));

    return {
      gameId: 'relic-rush',
      winnerId: winner.id,
      winnerName: winner.name,
      winnerAvatar: winner.avatar,
      winnerColor: winner.color,
      rankings,
      durationSeconds: Math.round(this.matchDuration - this.matchTimeRemaining),
      mvpStat: mvpTackler && mvpTackler.tacklesLanded > 0
        ? `Top Enforcer: ${mvpTackler.name} with ${mvpTackler.tacklesLanded} Tackles Landed`
        : `Top Collector: ${winner.name} with ${winner.relicsCollectedCount} Relics Collected`,
    };
  }

  private finishMatch(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.isMatchOver = true;
    this.state = 'finished';
    this.matchTimeRemaining = 0;

    // Lock all players and clear movement
    this.players.forEach((p) => {
      p.vx = 0;
      p.vy = 0;
      p.speed = 0;
      p.isTackling = false;
      p.tackleTimer = 0;
      p.trail = [];
    });

    const sorted = Array.from(this.players.values()).sort(RelicRushEngine.comparePlayers);
    const winner = sorted[0];
    if (winner) {
      this.bannerText = `🏆 MATCH OVER! ${winner.name.toUpperCase()} WINS WITH ${winner.bankedScore} PTS!`;
      this.bannerColor = '#00F5A0';
    } else {
      this.bannerText = '🏁 MATCH FINISHED! VAULT EXTRACTING!';
      this.bannerColor = '#00F5A0';
    }
    this.bannerTimer = 10.0;

    if (this.onSound) {
      this.onSound('fanfare');
    }

    if (this.onEvent && winner) {
      this.onEvent({
        type: 'announcement',
        payload: {
          title: 'MATCH COMPLETE',
          description: `${winner.name} extracted from the vault with victory!`,
        },
      });
    }
  }

  // -------------------------------------------------------------------------
  // STATE ACCESSORS & MATH HELPERS
  // -------------------------------------------------------------------------

  public isMatchFinished(): boolean {
    return this.isGameOver;
  }

  public getTimeRemaining(): number {
    return this.matchTimeRemaining;
  }

  public getPlayer(id: string): PlayerRelicRushState | undefined {
    return this.players.get(id);
  }

  public getPlayers(): PlayerRelicRushState[] {
    return Array.from(this.players.values());
  }

  public getRelics(): RelicEntity[] {
    return Array.from(this.relics.values());
  }

  public getCameraCentroid(): { x: number; y: number; minX: number; maxX: number; minY: number; maxY: number; zoom: number } {
    const playersList = Array.from(this.players.values());
    if (playersList.length === 0) {
      return { x: this.width / 2, y: this.height / 2, minX: 0, maxX: this.width, minY: 0, maxY: this.height, zoom: 1.0 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let sumX = 0;
    let sumY = 0;

    for (const p of playersList) {
      sumX += p.x;
      sumY += p.y;
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    const count = playersList.length;
    const centroidX = sumX / count;
    const centroidY = sumY / count;
    const bboxCenterX = (minX + maxX) / 2;
    const bboxCenterY = (minY + maxY) / 2;

    const spanX = Math.max(400, maxX - minX + 200);
    const spanY = Math.max(300, maxY - minY + 200);
    const zoom = Math.max(0.6, Math.min(1.2, Math.min(this.width / spanX, this.height / spanY)));

    return {
      x: bboxCenterX * 0.7 + centroidX * 0.3,
      y: bboxCenterY * 0.7 + centroidY * 0.3,
      minX,
      maxX,
      minY,
      maxY,
      zoom,
    };
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  private lerpAngle(from: number, to: number, step: number): number {
    const diff = this.normalizeAngle(to - from);
    return from + diff * Math.min(1.0, step);
  }

  // -------------------------------------------------------------------------
  // DEV / QA SPECIALIST API
  // -------------------------------------------------------------------------

  public spawnBot(archetype?: 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic', name?: string, color?: string): string {
    const archetypes: Array<'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic'> = [
      'aggressive', 'defensive', 'collector', 'ambusher', 'chaotic'
    ];
    const chosenArchetype = archetype || archetypes[Math.floor(Math.random() * archetypes.length)];
    const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const botColors = ['#FF3366', '#FFB224', '#00E5FF', '#9D4EDD', '#00F5A0', '#FF7700'];
    const botColor = color || botColors[Math.floor(Math.random() * botColors.length)];
    const botName = name || `[AI] RELIC_${chosenArchetype.toUpperCase()}`;

    const cx = this.width / 2;
    const cy = this.height / 2;
    const angle = Math.random() * Math.PI * 2;
    const dist = 180 + Math.random() * 180;

    const botState: PlayerRelicRushState = {
      id: botId,
      name: botName,
      avatar: 'robot',
      color: botColor,
      isBot: true,
      botArchetype: chosenArchetype,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
      angle,
      targetAngle: angle,
      speed: 0,
      maxSpeed: (() => {
        const diff =
          this.config.difficulty === 'easy'
            ? 'easy'
            : this.config.difficulty === 'hard' || this.config.difficulty === 'extreme'
            ? 'hard'
            : 'medium';
        return diff === 'easy' ? 289 : diff === 'hard' ? 374 : 340;
      })(),
      acceleration: 850,
      mass: 1.0,
      hoardedValue: 0,
      bankedScore: 0,
      tacklesLanded: 0,
      tacklesReceived: 0,
      relicsCollectedCount: 0,
      cosmicCoresClaimed: 0,
      tackleCooldown: 0,
      maxTackleCooldown: 2.4,
      isTackling: false,
      tackleTimer: 0,
      tackleHeading: angle,
      activePowerup: null,
      powerupInventory: null,
      magnetTimer: 0,
      shieldTimer: 0,
      isShieldActive: false,
      shieldCooldown: 0,
      maxShieldCooldown: 6.0,
      hoardAccumulator: 0,
      isStunned: false,
      stunTimer: 0,
      damageFlashTimer: 0,
      invulnerableTimer: 0,
      trail: [],
      decoyActive: false,
      aiState: 'scavenge',
      aiDecisionTimer: Math.random() * 0.5,
    };

    this.players.set(botId, botState);
    this.triggerShockwave(botState.x, botState.y, 80, botColor, 0.4);
    return botId;
  }

  public forceEliminate(playerId: string): void {
    const p = this.players.get(playerId);
    if (p) {
      // Stun & scatter hoarded relics
      p.isStunned = true;
      p.stunTimer = 6.0;
      p.hoardedValue = Math.max(0, p.hoardedValue - 50);
      this.triggerShockwave(p.x, p.y, 180, '#FF3366', 0.8);
      if (this.onSound) this.onSound('elimination');
    }
  }

  public forceWin(playerId: string): void {
    const p = this.players.get(playerId);
    if (p) {
      p.bankedScore += 5000;
      this.matchTimeRemaining = 0;
      this.isGameOver = true;
      this.isMatchOver = true;
      this.state = 'finished';
      if (this.onSound) this.onSound('fanfare');
    }
  }

  public triggerEvent(type: 'gold_meteor' | 'cosmic_core' | 'magnetic_surge' = 'gold_meteor'): void {
    if (type === 'gold_meteor') {
      // Gold Meteor Shower: Spawns 12 high-tier relics falling from sky with massive shockwaves
      const cx = this.width / 2;
      const cy = this.height / 2;
      for (let i = 0; i < 12; i++) {
        const rx = cx + (Math.random() - 0.5) * (this.width * 0.6);
        const ry = cy + (Math.random() - 0.5) * (this.height * 0.6);
        const tier: RelicTier = Math.random() > 0.4 ? 'cosmic' : 'diamond';
        this.spawnRelic(tier, rx, ry, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 5);
      }
      this.spawnCosmicCore();
      this.bannerText = '☄️ GOLD METEOR SHOWER DETECTED! ☄️';
      this.bannerTimer = 4.5;
      this.bannerColor = '#FFD700';
      this.addScreenShake(18, 0.6);
      if (this.onSound) this.onSound('fanfare');
    } else if (type === 'cosmic_core') {
      this.spawnCosmicCore();
    } else {
      // Magnetic surge for all players
      for (const p of this.players.values()) {
        p.activePowerup = 'magnet';
        p.magnetTimer = 8.0;
      }
      this.bannerText = '🧲 GLOBAL MAGNETIC SURGE ACTIVE! 🧲';
      this.bannerTimer = 4.0;
      if (this.onSound) this.onSound('zap');
    }
  }

  public setModifiers(modifiers: Partial<{ turboSpeed: boolean; doubleGrowthOrScore: boolean; lowGravity: boolean; chaosMode: boolean }>): void {
    const speedScale = modifiers.turboSpeed ? 1.6 : 1.0;
    for (const p of this.players.values()) {
      p.maxSpeed = 340 * speedScale;
      p.acceleration = 850 * speedScale;
      if (modifiers.chaosMode) {
        p.maxTackleCooldown = 0.6;
      }
    }
  }

  public setPlayerConnected(playerId: string, connected: boolean): void {
    const p = this.players.get(playerId);
    if (p) {
      if (!connected) {
        p.isStunned = true;
        p.stunTimer = 999;
      } else {
        p.isStunned = false;
        p.stunTimer = 0;
      }
    }
  }
}
