import {
  Player,
  ControllerInput,
  PlayerClientHUDState,
  MatchResults,
  GameEventPayload,
} from '../../types';
import {
  ShadowOutrunPlayer,
  ShadowRole,
  CoinEntity,
  WallObstacle,
  ShadowParticle,
  ShadowFloatingText,
  ShadowShockwave,
  ShadowOutrunMap,
  ShadowOutrunEngineConfig,
  MapType,
} from './types';
import { SHADOW_MAPS } from './maps';

// Line-segment intersection helper
function lineIntersectsLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number
): { hit: boolean; x: number; y: number; t: number } {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (Math.abs(denom) < 1e-6) return { hit: false, x: 0, y: 0, t: 1 };

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      hit: true,
      x: x1 + ua * (x2 - x1),
      y: y1 + ua * (y2 - y1),
      t: ua,
    };
  }
  return { hit: false, x: 0, y: 0, t: 1 };
}

// Ray vs Wall Box Intersection (ignoring glass for light if specified)
function raycastWall(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  wall: WallObstacle,
  ignoreGlass: boolean = false
): { hit: boolean; x: number; y: number; dist: number } {
  if (ignoreGlass && wall.isGlass) {
    return { hit: false, x: x2, y: y2, dist: 1 };
  }

  const left = wall.x;
  const right = wall.x + wall.width;
  const top = wall.y;
  const bottom = wall.y + wall.height;

  // Check 4 segments of the AABB
  const segments = [
    { x3: left, y3: top, x4: right, y4: top }, // Top
    { x3: right, y3: top, x4: right, y4: bottom }, // Right
    { x3: left, y3: bottom, x4: right, y4: bottom }, // Bottom
    { x3: left, y3: top, x4: left, y4: bottom }, // Left
  ];

  let nearestHit = { hit: false, x: x2, y: y2, dist: 1 };
  for (const seg of segments) {
    const res = lineIntersectsLine(x1, y1, x2, y2, seg.x3, seg.y3, seg.x4, seg.y4);
    if (res.hit && res.t < nearestHit.dist) {
      nearestHit = { hit: true, x: res.x, y: res.y, dist: res.t };
    }
  }

  return nearestHit;
}

export class ShadowOutrunEngine {
  // Arena & Map
  public readonly map: ShadowOutrunMap;
  public readonly width: number;
  public readonly height: number;
  public config: ShadowOutrunEngineConfig;

  // Match State
  public state: 'playing' | 'finished' = 'playing';
  public isMatchOver: boolean = false;
  public isGameOver: boolean = false;
  public matchTimeRemaining: number;
  public totalMatchDuration: number;
  private globalTime: number = 0;
  private coinRespawnTimer: number = 0;
  private passiveSurvivalTimer: number = 0;

  // Entities
  public players: Map<string, ShadowOutrunPlayer> = new Map();
  public coins: Map<string, CoinEntity> = new Map();
  public particles: ShadowParticle[] = [];
  public floatingTexts: ShadowFloatingText[] = [];
  public shockwaves: ShadowShockwave[] = [];

  // Local Player / Camera
  public localPlayerId?: string;
  public camera = { x: 1200, y: 800, zoom: 1.0, targetZoom: 1.0 };

  // Callbacks
  public onSound?: (
    sound: 'click' | 'pickup' | 'boost' | 'zap' | 'hit' | 'elimination' | 'fanfare' | 'stinger',
    pitch?: number
  ) => void;
  public onEvent?: (event: GameEventPayload) => void;

  // Next IDs
  private nextCoinId: number = 1;
  private nextParticleId: number = 1;
  private nextTextId: number = 1;
  private nextShockwaveId: number = 1;

  constructor(
    playersMap: Record<string, Player>,
    configOverrides?: Partial<ShadowOutrunEngineConfig>
  ) {
    const selectedMapType: MapType = configOverrides?.mapType || 'backrooms';
    this.map = SHADOW_MAPS[selectedMapType] || SHADOW_MAPS.backrooms;
    this.width = this.map.width;
    this.height = this.map.height;

    this.totalMatchDuration = configOverrides?.roundDuration || 90;
    this.matchTimeRemaining = this.totalMatchDuration;

    this.config = {
      arenaWidth: this.width,
      arenaHeight: this.height,
      mapType: selectedMapType,
      roundDuration: this.totalMatchDuration,
      thiefSpeed: configOverrides?.thiefSpeed || 230,
      catcherSpeed: configOverrides?.catcherSpeed || 207, // 90%
      slowDownMultiplier: configOverrides?.slowDownMultiplier || 0.65, // 35% speed drop
      tagDistance: configOverrides?.tagDistance || 32,
      flashlightRange: configOverrides?.flashlightRange || 260,
      flashlightConeSpread: configOverrides?.flashlightConeSpread || Math.PI / 3, // 60 deg
      maxCoins: configOverrides?.maxCoins || 36,
      coinValue: 50,
      diamondValue: 100,
      arrestValue: 150,
      difficulty: configOverrides?.difficulty || 'normal',
    };

    this.initPlayers(playersMap);
    this.initCoins();
  }

  // ---------------------------------------------------------------------------
  // DETERMINISTIC COMPARATOR & TIE-BREAKER
  // Rule: Score (desc) -> Thieves Caught / Coins (desc) -> Survival Time (desc) -> ID (asc)
  // ---------------------------------------------------------------------------
  public static comparePlayers(a: ShadowOutrunPlayer, b: ShadowOutrunPlayer): number {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.thievesCaught !== a.thievesCaught) {
      return b.thievesCaught - a.thievesCaught;
    }
    if (b.coinsCollected !== a.coinsCollected) {
      return b.coinsCollected - a.coinsCollected;
    }
    if (b.survivalTime !== a.survivalTime) {
      return b.survivalTime - a.survivalTime;
    }
    return a.id.localeCompare(b.id);
  }

  // ---------------------------------------------------------------------------
  // INITIALIZATION
  // ---------------------------------------------------------------------------
  private initPlayers(playersMap: Record<string, Player>): void {
    const playerList = Object.values(playersMap);
    if (playerList.length === 0) return;

    // Pick 1 random player/bot as Chief Police/Catcher
    const catcherIndex = Math.floor(Math.random() * playerList.length);
    const catcherPlayerId = playerList[catcherIndex].id;

    let thiefSpawnIdx = 1;
    playerList.forEach((p, idx) => {
      const isCatcher = p.id === catcherPlayerId;
      const role: ShadowRole = isCatcher ? 'catcher' : 'thief';

      let spawnPos = { x: 1200, y: 800 };
      if (isCatcher) {
        spawnPos = this.map.spawnPoints[0] || { x: 1200, y: 800 };
      } else {
        const pt = this.map.spawnPoints[thiefSpawnIdx % this.map.spawnPoints.length];
        spawnPos = pt ? { x: pt.x, y: pt.y } : { x: 400 + (idx * 200) % 1600, y: 300 + (idx * 150) % 1000 };
        thiefSpawnIdx++;
      }

      const entity: ShadowOutrunPlayer = {
        id: p.id,
        name: p.name || `Player ${idx + 1}`,
        avatar: p.avatar || '🕶️',
        color: isCatcher ? '#FF3366' : p.color || '#00E5FF',
        isBot: !!p.isBot,
        botArchetype: p.botArchetype || 'collector',
        role,
        isArrested: false,
        x: spawnPos.x,
        y: spawnPos.y,
        vx: 0,
        vy: 0,
        angle: isCatcher ? 0 : Math.random() * Math.PI * 2,
        targetAngle: 0,
        radius: 18,
        baseSpeed: isCatcher ? this.config.catcherSpeed : this.config.thiefSpeed,
        currentSpeed: isCatcher ? this.config.catcherSpeed : this.config.thiefSpeed,
        isSlowed: false,
        slowTimer: 0,
        speedMultiplier: 1.0,
        flashlightActive: isCatcher,
        beamRange: this.config.flashlightRange,
        coneSpread: this.config.flashlightConeSpread,
        beamAngle: isCatcher ? 0 : 0,
        flashlightColor: '#FFF275',
        dashCooldown: 0,
        maxDashCooldown: 4.0,
        isDashing: false,
        dashTimer: 0,
        score: 0,
        coinsCollected: 0,
        thievesCaught: 0,
        survivalTime: 0,
        lastScoreTime: 0,
        trail: [],
        footstepTimer: 0,
        aiState: isCatcher ? 'hunt' : 'scavenge',
        aiDecisionTimer: Math.random() * 0.5,
      };

      this.players.set(p.id, entity);
    });

    // Notify initial role awakening
    if (this.onEvent) {
      this.onEvent({
        type: 'announcement',
        payload: {
          title: 'POLICE PATROL STARTED!',
          description: `Watch out for the flashlight beam!`,
          color: '#FFB224',
        },
      });
    }
  }

  private initCoins(): void {
    this.coins.clear();
    const spawnPoints = this.map.coinSpawnPoints;

    spawnPoints.forEach((sp) => {
      const type = sp.type || 'coin';
      const value = type === 'diamond' ? this.config.diamondValue : type === 'loot_bag' ? 75 : this.config.coinValue;
      const coin: CoinEntity = {
        id: `coin_${this.nextCoinId++}`,
        x: sp.x,
        y: sp.y,
        value,
        radius: type === 'diamond' ? 12 : 9,
        type,
        pulsePhase: Math.random() * Math.PI * 2,
        collected: false,
        sparkleTimer: Math.random() * 2,
      };
      this.coins.set(coin.id, coin);
    });
  }

  // ---------------------------------------------------------------------------
  // CONTROLLER INPUT HANDLING
  // ---------------------------------------------------------------------------
  public handleInput(playerId: string, input: ControllerInput): void {
    const player = this.players.get(playerId);
    if (!player || player.isArrested) return;

    if (input.magnitude > 0.05) {
      player.targetAngle = input.angle;
      player.angle = input.angle;
      if (player.role === 'catcher' || player.role === 'deputy') {
        player.beamAngle = input.angle;
      }
      const speed = player.currentSpeed * Math.min(1.0, input.magnitude);
      player.vx = Math.cos(input.angle) * speed;
      player.vy = Math.sin(input.angle) * speed;
    } else {
      player.vx = 0;
      player.vy = 0;
    }

    // Action 1: Tactical Sprint / Flashlight Boost
    if (input.action1 && player.dashCooldown <= 0 && !player.isDashing) {
      player.isDashing = true;
      player.dashTimer = 0.6;
      player.dashCooldown = player.maxDashCooldown;
      this.addShockwave(player.x, player.y, 45, player.role === 'catcher' ? '#FF3366' : '#00E5FF');
      if (this.onSound) this.onSound('boost', 800);
    }
  }

  // ---------------------------------------------------------------------------
  // FLASHLIGHT CONE & LINE-OF-SIGHT RAYCASTING
  // ---------------------------------------------------------------------------
  public checkLineOfSight(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    ignoreGlass: boolean = true
  ): boolean {
    for (const wall of this.map.walls) {
      const hitRes = raycastWall(x1, y1, x2, y2, wall, ignoreGlass);
      if (hitRes.hit && hitRes.dist < 0.99) {
        return false; // Solid wall blocks line of sight
      }
    }
    return true; // Clear line of sight
  }

  public isPointInFlashlightCone(
    sourceX: number,
    sourceY: number,
    beamAngle: number,
    range: number,
    coneSpread: number,
    targetX: number,
    targetY: number
  ): boolean {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const distSq = dx * dx + dy * dy;

    if (distSq > range * range) return false;

    const angleToTarget = Math.atan2(dy, dx);
    let angleDiff = angleToTarget - beamAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const halfCone = coneSpread / 2;
    if (Math.abs(angleDiff) > halfCone) return false;

    // Check raycast against solid walls (light passes through glass)
    return this.checkLineOfSight(sourceX, sourceY, targetX, targetY, true);
  }

  // Compute 2D polygon rays for realistic flashlight lighting and shadow projection
  public computeFlashlightRays(
    sourceX: number,
    sourceY: number,
    beamAngle: number,
    range: number,
    coneSpread: number,
    numRays: number = 24
  ): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [{ x: sourceX, y: sourceY }];
    const halfCone = coneSpread / 2;
    const startAngle = beamAngle - halfCone;
    const step = coneSpread / numRays;

    for (let i = 0; i <= numRays; i++) {
      const angle = startAngle + i * step;
      const maxTargetX = sourceX + Math.cos(angle) * range;
      const maxTargetY = sourceY + Math.sin(angle) * range;

      let nearestX = maxTargetX;
      let nearestY = maxTargetY;
      let nearestDist = 1.0;

      for (const wall of this.map.walls) {
        const hit = raycastWall(sourceX, sourceY, maxTargetX, maxTargetY, wall, true);
        if (hit.hit && hit.dist < nearestDist) {
          nearestDist = hit.dist;
          nearestX = hit.x;
          nearestY = hit.y;
        }
      }

      points.push({ x: nearestX, y: nearestY });
    }

    return points;
  }

  // ---------------------------------------------------------------------------
  // MAIN TICK LOOP (60FPS Physics & Gameplay)
  // ---------------------------------------------------------------------------
  public tick(dt: number): void {
    if (this.isGameOver || this.state === 'finished') return;

    // Clamp dt
    const safeDt = Math.min(dt, 0.05);
    this.globalTime += safeDt;
    this.matchTimeRemaining -= safeDt;

    // 1. Check Match Timer Expiration
    if (this.matchTimeRemaining <= 0) {
      this.matchTimeRemaining = 0;
      this.concludeMatch('time_expired');
      return;
    }

    // 2. Update Map Lights & Lasers
    this.updateMapHazards(safeDt);

    // 3. Update Bots AI
    this.updateBotAI(safeDt);

    // 4. Update Player Physics, Abilities & Flashlight Slow Checks
    this.updatePlayers(safeDt);

    // 5. Coin Collection & Spawning
    this.updateCoins(safeDt);

    // 6. Passive Survival Score for Active Thieves
    this.passiveSurvivalTimer += safeDt;
    if (this.passiveSurvivalTimer >= 2.0) {
      this.passiveSurvivalTimer = 0;
      this.players.forEach((p) => {
        if (p.role === 'thief' && !p.isArrested) {
          p.score += 5;
          p.survivalTime += 2.0;
        }
      });
    }

    // 7. Update Particles, Shockwaves, and Floating Texts
    this.updateFX(safeDt);

    // 8. Update Camera Position
    this.updateCamera(safeDt);

    // 9. Win condition: If 0 remaining active thieves, catchers win!
    const activeThieves = Array.from(this.players.values()).filter(
      (p) => p.role === 'thief' && !p.isArrested
    );
    if (activeThieves.length === 0 && this.players.size > 1) {
      this.concludeMatch('all_caught');
    }
  }

  // ---------------------------------------------------------------------------
  // MAP HAZARDS & LASERS
  // ---------------------------------------------------------------------------
  private updateMapHazards(dt: number): void {
    // Flickering lights
    this.map.flickerLights.forEach((light) => {
      light.flickerPhase += dt * light.flickerSpeed;
      const noise = (Math.sin(light.flickerPhase) + Math.cos(light.flickerPhase * 2.3)) * 0.5;
      light.intensity = Math.max(0.2, Math.min(1.0, light.baseIntensity + noise * 0.25));
    });

    // Cyber Lasers
    if (this.map.lasers) {
      this.map.lasers.forEach((laser) => {
        laser.cycleTimer += dt;
        if (laser.state === 'pulsing') {
          const mod = laser.cycleTimer % laser.cycleDuration;
          const isOn = mod < laser.cycleDuration * 0.65;
          // Check collision with players if laser is on
          if (isOn) {
            this.players.forEach((p) => {
              const res = lineIntersectsLine(
                laser.x1,
                laser.y1,
                laser.x2,
                laser.y2,
                p.x - p.radius,
                p.y,
                p.x + p.radius,
                p.y
              );
              if (res.hit && p.role === 'thief' && !p.isArrested) {
                // Laser trips alert and slows player
                p.isSlowed = true;
                p.slowTimer = 1.0;
                p.alertState = 'alert';
                p.alertTimer = 1.2;
                this.addFloatingText(p.x, p.y - 20, '⚡ LASER TRIP!', '#FF0055');
              }
            });
          }
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // BOT AI (Catcher vs Thief Personalities)
  // ---------------------------------------------------------------------------
  private updateBotAI(dt: number): void {
    const catchers = Array.from(this.players.values()).filter(
      (p) => (p.role === 'catcher' || p.role === 'deputy') && !p.isArrested
    );
    const thieves = Array.from(this.players.values()).filter(
      (p) => p.role === 'thief' && !p.isArrested
    );

    this.players.forEach((bot) => {
      if (!bot.isBot || bot.isArrested) return;

      bot.aiDecisionTimer = (bot.aiDecisionTimer || 0) - dt;
      const needsDecision = (bot.aiDecisionTimer || 0) <= 0;

      // ----------------- CATCHER / DEPUTY BOT AI -----------------
      if (bot.role === 'catcher' || bot.role === 'deputy') {
        if (needsDecision) {
          bot.aiDecisionTimer = 0.2 + Math.random() * 0.15;

          // 1. Look for nearest visible thief
          let bestTarget: ShadowOutrunPlayer | null = null;
          let minTargetDist = Infinity;

          for (const thief of thieves) {
            const dx = thief.x - bot.x;
            const dy = thief.y - bot.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Direct line of sight or within proximity radar
            const hasLOS = this.checkLineOfSight(bot.x, bot.y, thief.x, thief.y, true);
            if ((hasLOS && dist < 650) || dist < 180) {
              if (dist < minTargetDist) {
                minTargetDist = dist;
                bestTarget = thief;
              }
            }
          }

          if (bestTarget) {
            bot.aiState = 'hunt';
            bot.aiTargetPlayerId = bestTarget.id;
            // Lead target slightly
            bot.aiTargetX = bestTarget.x + bestTarget.vx * 0.3;
            bot.aiTargetY = bestTarget.y + bestTarget.vy * 0.3;
          } else {
            bot.aiState = 'patrol';
            bot.aiTargetPlayerId = undefined;
            // Patrol towards random coin spawn location or center
            if (!bot.aiTargetX || Math.hypot(bot.aiTargetX - bot.x, bot.aiTargetY! - bot.y) < 60) {
              const randPoint = this.map.coinSpawnPoints[
                Math.floor(Math.random() * this.map.coinSpawnPoints.length)
              ];
              bot.aiTargetX = randPoint.x + (Math.random() - 0.5) * 80;
              bot.aiTargetY = randPoint.y + (Math.random() - 0.5) * 80;
            }
          }
        }

        // Steer & aim flashlight torch directly at target/waypoint
        if (bot.aiTargetX !== undefined && bot.aiTargetY !== undefined) {
          const dx = bot.aiTargetX - bot.x;
          const dy = bot.aiTargetY - bot.y;
          const targetHeading = Math.atan2(dy, dx);

          bot.beamAngle = targetHeading;
          bot.angle = targetHeading;
          bot.vx = Math.cos(targetHeading) * bot.currentSpeed;
          bot.vy = Math.sin(targetHeading) * bot.currentSpeed;

          // Catcher dash when close to target (< 160px)
          if (
            bot.aiState === 'hunt' &&
            Math.hypot(dx, dy) < 160 &&
            bot.dashCooldown <= 0 &&
            !bot.isDashing
          ) {
            bot.isDashing = true;
            bot.dashTimer = 0.5;
            bot.dashCooldown = bot.maxDashCooldown;
            this.addShockwave(bot.x, bot.y, 40, '#FF3366');
            if (this.onSound) this.onSound('boost', 900);
          }
        }
      }

      // ----------------- THIEF BOT AI -----------------
      else if (bot.role === 'thief') {
        if (needsDecision) {
          bot.aiDecisionTimer = 0.15 + Math.random() * 0.15;

          // 1. Check danger from nearest catcher
          let nearestCatcher: ShadowOutrunPlayer | null = null;
          let minCatcherDist = Infinity;

          for (const catcher of catchers) {
            const dist = Math.hypot(catcher.x - bot.x, catcher.y - bot.y);
            if (dist < minCatcherDist) {
              minCatcherDist = dist;
              nearestCatcher = catcher;
            }
          }

          // In danger if catcher is close (< 380px) or bot is currently slowed by flashlight
          if (nearestCatcher && (minCatcherDist < 380 || bot.isSlowed)) {
            bot.aiState = 'flee';
            bot.alertState = 'danger';
            bot.alertTimer = 1.0;

            // Flee vector away from catcher
            const fleeAngle = Math.atan2(bot.y - nearestCatcher.y, bot.x - nearestCatcher.x);

            // Add side-step jitter to maneuver around walls
            const jitter = (Math.random() - 0.5) * 0.8;
            bot.aiTargetX = bot.x + Math.cos(fleeAngle + jitter) * 350;
            bot.aiTargetY = bot.y + Math.sin(fleeAngle + jitter) * 350;

            // Thief panic dash if in flashlight cone
            if (bot.isSlowed && bot.dashCooldown <= 0 && !bot.isDashing) {
              bot.isDashing = true;
              bot.dashTimer = 0.6;
              bot.dashCooldown = bot.maxDashCooldown;
              this.addShockwave(bot.x, bot.y, 40, '#00E5FF');
              if (this.onSound) this.onSound('boost', 1000);
            }
          } else {
            // Safe: scavenge for nearest uncollected coin
            bot.aiState = 'scavenge';
            let nearestCoin: CoinEntity | null = null;
            let minCoinDist = Infinity;

            for (const coin of this.coins.values()) {
              if (!coin.collected) {
                const dist = Math.hypot(coin.x - bot.x, coin.y - bot.y);
                if (dist < minCoinDist) {
                  minCoinDist = dist;
                  nearestCoin = coin;
                }
              }
            }

            if (nearestCoin) {
              bot.aiTargetX = nearestCoin.x;
              bot.aiTargetY = nearestCoin.y;
            } else {
              // Roam around map
              bot.aiTargetX = 200 + Math.random() * (this.width - 400);
              bot.aiTargetY = 200 + Math.random() * (this.height - 400);
            }
          }
        }

        // Steer towards target waypoint
        if (bot.aiTargetX !== undefined && bot.aiTargetY !== undefined) {
          const dx = bot.aiTargetX - bot.x;
          const dy = bot.aiTargetY - bot.y;
          const angle = Math.atan2(dy, dx);

          bot.angle = angle;
          bot.vx = Math.cos(angle) * bot.currentSpeed;
          bot.vy = Math.sin(angle) * bot.currentSpeed;
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // PLAYER PHYSICS, FLASHLIGHT SLOW CALCULATIONS & ARREST LOGIC
  // ---------------------------------------------------------------------------
  private updatePlayers(dt: number): void {
    const catchers = Array.from(this.players.values()).filter(
      (p) => (p.role === 'catcher' || p.role === 'deputy') && !p.isArrested
    );
    const thieves = Array.from(this.players.values()).filter(
      (p) => p.role === 'thief' && !p.isArrested
    );

    // 1. Reset & Calculate Flashlight Cone Slow for all Thieves
    thieves.forEach((thief) => {
      let isIlluminated = false;

      for (const catcher of catchers) {
        if (
          this.isPointInFlashlightCone(
            catcher.x,
            catcher.y,
            catcher.beamAngle,
            catcher.beamRange,
            catcher.coneSpread,
            thief.x,
            thief.y
          )
        ) {
          isIlluminated = true;
          break;
        }
      }

      if (isIlluminated) {
        thief.isSlowed = true;
        thief.slowTimer = 0.25; // Keep slowed for a brief grace moment
        thief.speedMultiplier = this.config.slowDownMultiplier; // 35% speed drop (65% base speed)
        thief.alertState = 'danger';
        thief.alertTimer = 0.5;

        // Spawn slow dust particles
        if (Math.random() < 0.3) {
          this.addParticle({
            x: thief.x + (Math.random() - 0.5) * 20,
            y: thief.y + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.5) * 20,
            size: 3 + Math.random() * 3,
            color: '#FFE600',
            alpha: 0.8,
            decay: 2.5,
            life: 0,
            maxLife: 0.4,
            type: 'dust',
          });
        }
      } else {
        if (thief.slowTimer > 0) {
          thief.slowTimer -= dt;
        } else {
          thief.isSlowed = false;
          thief.speedMultiplier = 1.0;
        }
      }
    });

    // 2. Movement, Wall Collision Resolution & Ability Updates
    this.players.forEach((player) => {
      if (player.isArrested) return;

      // Dash cooldowns & active state
      if (player.dashCooldown > 0) {
        player.dashCooldown = Math.max(0, player.dashCooldown - dt);
      }
      if (player.isDashing) {
        player.dashTimer -= dt;
        if (player.dashTimer <= 0) {
          player.isDashing = false;
        }
      }

      // Calculate final speed
      const dashBonus = player.isDashing ? 1.6 : 1.0;
      player.currentSpeed = player.baseSpeed * player.speedMultiplier * dashBonus;

      // Update velocity if player is moving
      if (player.vx !== 0 || player.vy !== 0) {
        const moveDist = Math.hypot(player.vx, player.vy);
        if (moveDist > 0) {
          player.vx = (player.vx / moveDist) * player.currentSpeed;
          player.vy = (player.vy / moveDist) * player.currentSpeed;
        }

        // Apply movement
        const nextX = player.x + player.vx * dt;
        const nextY = player.y + player.vy * dt;

        // Resolve Circle vs AABB Wall Collisions (separate X and Y for smooth sliding)
        let resolvedX = nextX;
        let resolvedY = nextY;

        // X movement check
        for (const wall of this.map.walls) {
          if (this.checkCircleBoxCollision(resolvedX, player.y, player.radius, wall)) {
            if (player.vx > 0) resolvedX = wall.x - player.radius;
            else if (player.vx < 0) resolvedX = wall.x + wall.width + player.radius;
          }
        }

        // Y movement check
        for (const wall of this.map.walls) {
          if (this.checkCircleBoxCollision(player.x, resolvedY, player.radius, wall)) {
            if (player.vy > 0) resolvedY = wall.y - player.radius;
            else if (player.vy < 0) resolvedY = wall.y + wall.height + player.radius;
          }
        }

        // Arena boundary clamping
        const margin = player.radius + 40;
        player.x = Math.max(margin, Math.min(this.width - margin, resolvedX));
        player.y = Math.max(margin, Math.min(this.height - margin, resolvedY));

        // Motion trail particles
        player.footstepTimer += dt;
        if (player.footstepTimer > 0.08) {
          player.footstepTimer = 0;
          player.trail.unshift({
            x: player.x,
            y: player.y,
            alpha: 0.5,
            size: player.radius,
          });
          if (player.trail.length > 8) player.trail.pop();
        }
      }

      // Decay trail alphas
      for (const t of player.trail) {
        t.alpha -= dt * 3.0;
      }
      player.trail = player.trail.filter((t) => t.alpha > 0);

      // Alert timer decay
      if (player.alertTimer && player.alertTimer > 0) {
        player.alertTimer -= dt;
        if (player.alertTimer <= 0) player.alertState = undefined;
      }
    });

    // 3. Arrest Check: Catcher vs Thief within 32px
    catchers.forEach((catcher) => {
      thieves.forEach((thief) => {
        if (thief.isArrested) return;

        const dist = Math.hypot(catcher.x - thief.x, catcher.y - thief.y);
        if (dist <= this.config.tagDistance) {
          // ARRESTED!
          thief.isArrested = true;
          thief.role = 'deputy'; // Converted to Deputy Police!
          thief.flashlightActive = true;
          thief.beamRange = this.config.flashlightRange * 0.9;
          thief.coneSpread = this.config.flashlightConeSpread;
          thief.baseSpeed = this.config.catcherSpeed;
          thief.currentSpeed = this.config.catcherSpeed;
          thief.color = '#FFAA00'; // Deputy golden badge color
          thief.arrestedAt = this.globalTime;
          thief.arrestedBy = catcher.name;

          // Award score to arresting catcher
          catcher.score += this.config.arrestValue;
          catcher.thievesCaught++;

          // Visual & Audio fanfare
          this.addShockwave(thief.x, thief.y, 80, '#FF3366');
          this.addFloatingText(thief.x, thief.y - 25, '🚨 ARRESTED!', '#FF3366');
          this.addFloatingText(catcher.x, catcher.y - 45, `+${this.config.arrestValue} ARREST`, '#FFB224');

          // Burst siren arrest particles
          for (let i = 0; i < 20; i++) {
            const pAngle = Math.random() * Math.PI * 2;
            const pSpeed = 60 + Math.random() * 120;
            this.addParticle({
              x: thief.x,
              y: thief.y,
              vx: Math.cos(pAngle) * pSpeed,
              vy: Math.sin(pAngle) * pSpeed,
              size: 4 + Math.random() * 4,
              color: i % 2 === 0 ? '#FF3366' : '#00E5FF',
              alpha: 1.0,
              decay: 1.8,
              life: 0,
              maxLife: 0.6,
              type: 'siren',
            });
          }

          if (this.onSound) {
            this.onSound('stinger');
            this.onSound('zap');
          }

          if (this.onEvent) {
            this.onEvent({
              type: 'eliminate',
              targetPlayerId: thief.id,
              payload: {
                title: 'ARREST MADE!',
                text: `${thief.name} was arrested by ${catcher.name}!`,
                color: '#FF3366',
              },
            });
          }
        }
      });
    });
  }

  private checkCircleBoxCollision(
    cx: number,
    cy: number,
    radius: number,
    box: WallObstacle
  ): boolean {
    const closestX = Math.max(box.x, Math.min(cx, box.x + box.width));
    const closestY = Math.max(box.y, Math.min(cy, box.y + box.height));
    const distX = cx - closestX;
    const distY = cy - closestY;
    return distX * distX + distY * distY < radius * radius;
  }

  // ---------------------------------------------------------------------------
  // COINS & HEISTS
  // ---------------------------------------------------------------------------
  private updateCoins(dt: number): void {
    // 1. Coin pickups by active thieves
    const activeThieves = Array.from(this.players.values()).filter(
      (p) => p.role === 'thief' && !p.isArrested
    );

    this.coins.forEach((coin) => {
      if (coin.collected) return;

      coin.pulsePhase += dt * 3.0;
      coin.sparkleTimer -= dt;
      if (coin.sparkleTimer <= 0) {
        coin.sparkleTimer = 1.0 + Math.random() * 1.5;
        this.addParticle({
          x: coin.x + (Math.random() - 0.5) * 12,
          y: coin.y + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 10,
          vy: -15 - Math.random() * 15,
          size: 2.5,
          color: coin.type === 'diamond' ? '#00FFFF' : '#FFE600',
          alpha: 0.9,
          decay: 2.0,
          life: 0,
          maxLife: 0.5,
          type: 'sparkle',
        });
      }

      for (const thief of activeThieves) {
        const dist = Math.hypot(thief.x - coin.x, thief.y - coin.y);
        if (dist < thief.radius + coin.radius + 6) {
          // Loot Coin!
          coin.collected = true;
          coin.collectedBy = thief.id;
          thief.score += coin.value;
          thief.coinsCollected++;
          thief.alertState = 'coin';
          thief.alertTimer = 0.6;

          this.addFloatingText(coin.x, coin.y - 15, `+${coin.value}`, coin.type === 'diamond' ? '#00FFFF' : '#FFD700');
          this.addShockwave(coin.x, coin.y, 30, coin.type === 'diamond' ? '#00FFFF' : '#FFD700');

          if (this.onSound) {
            this.onSound('pickup', coin.type === 'diamond' ? 950 : 650);
          }

          if (this.onEvent) {
            this.onEvent({
              type: 'score',
              targetPlayerId: thief.id,
              payload: {
                points: coin.value,
                title: 'COIN HEIST!',
              },
            });
          }
          break;
        }
      }
    });

    // 2. Periodic Coin Respawn if count is low
    this.coinRespawnTimer += dt;
    const uncollectedCount = Array.from(this.coins.values()).filter((c) => !c.collected).length;

    if (uncollectedCount < this.config.maxCoins && this.coinRespawnTimer >= 3.0) {
      this.coinRespawnTimer = 0;
      const candidates = this.map.coinSpawnPoints;
      const sp = candidates[Math.floor(Math.random() * candidates.length)];
      if (sp) {
        const type = sp.type || 'coin';
        const value = type === 'diamond' ? this.config.diamondValue : this.config.coinValue;
        const newCoin: CoinEntity = {
          id: `coin_${this.nextCoinId++}`,
          x: sp.x + (Math.random() - 0.5) * 40,
          y: sp.y + (Math.random() - 0.5) * 40,
          value,
          radius: type === 'diamond' ? 12 : 9,
          type,
          pulsePhase: Math.random() * Math.PI * 2,
          collected: false,
          sparkleTimer: 0.5,
        };
        this.coins.set(newCoin.id, newCoin);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // FX, PARTICLES & FLOATING TEXTS
  // ---------------------------------------------------------------------------
  private addParticle(p: ShadowParticle): void {
    p.id = `p_${this.nextParticleId++}`;
    this.particles.push(p);
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      id: `txt_${this.nextTextId++}`,
      x,
      y,
      text,
      color,
      alpha: 1.0,
      size: 16,
      life: 0,
      maxLife: 1.2,
      vy: -35,
    });
  }

  private addShockwave(x: number, y: number, maxRadius: number, color: string): void {
    this.shockwaves.push({
      id: `sw_${this.nextShockwaveId++}`,
      x,
      y,
      radius: 5,
      maxRadius,
      color,
      alpha: 0.9,
      speed: 120,
    });
  }

  private updateFX(dt: number): void {
    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife || p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const txt = this.floatingTexts[i];
      txt.life += dt;
      txt.y += txt.vy * dt;
      txt.alpha = Math.max(0, 1 - txt.life / txt.maxLife);
      if (txt.life >= txt.maxLife) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed * dt;
      sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
      if (sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // AUTHORITATIVE DYNAMIC CAMERA SYSTEM
  // ---------------------------------------------------------------------------
  private updateCamera(dt: number): void {
    let targetX = this.width / 2;
    let targetY = this.height / 2;

    const localPlayer = this.localPlayerId ? this.players.get(this.localPlayerId) : undefined;
    if (localPlayer) {
      targetX = localPlayer.x;
      targetY = localPlayer.y;
      this.camera.targetZoom = localPlayer.isDashing ? 1.05 : 1.15;
    } else {
      // Spectator / Host View: Focus on centroid of active players
      const activePlayers = Array.from(this.players.values()).filter((p) => !p.isArrested);
      if (activePlayers.length > 0) {
        let sumX = 0;
        let sumY = 0;
        activePlayers.forEach((p) => {
          sumX += p.x;
          sumY += p.y;
        });
        targetX = sumX / activePlayers.length;
        targetY = sumY / activePlayers.length;
      }
    }

    // Smooth LERP camera tracking
    const lerpFactor = 1 - Math.exp(-6 * dt);
    this.camera.x += (targetX - this.camera.x) * lerpFactor;
    this.camera.y += (targetY - this.camera.y) * lerpFactor;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * lerpFactor;
  }

  // ---------------------------------------------------------------------------
  // MATCH CONCLUSION & RESULTS
  // ---------------------------------------------------------------------------
  private concludeMatch(reason: 'time_expired' | 'all_caught'): void {
    this.state = 'finished';
    this.isGameOver = true;
    this.isMatchOver = true;

    if (this.onSound) {
      this.onSound('fanfare');
    }

    if (this.onEvent) {
      this.onEvent({
        type: 'announcement',
        payload: {
          title: reason === 'all_caught' ? 'POLICE SWEEP VICTORY!' : 'HEIST COMPLETED!',
          description: reason === 'all_caught' ? 'All fugitives were apprehended!' : 'Time has expired!',
          color: '#FFB224',
        },
      });
    }
  }

  public getResults(): MatchResults {
    const sorted = Array.from(this.players.values()).sort(ShadowOutrunEngine.comparePlayers);
    const winner = sorted[0];

    return {
      gameId: 'shadow-outrun',
      winnerId: winner?.id || '',
      winnerName: winner?.name || 'No Winner',
      winnerAvatar: winner?.avatar || '🕶️',
      winnerColor: winner?.color || '#FFB224',
      rankings: sorted.map((p, idx) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        rank: idx + 1,
        avatar: p.avatar,
        color: p.color,
        isBot: p.isBot,
        statSummary:
          p.role === 'catcher' || p.role === 'deputy'
            ? `Arrests: ${p.thievesCaught} | Score: ${p.score}`
            : `Coins: ${p.coinsCollected} | Survived: ${Math.round(p.survivalTime)}s`,
      })),
      durationSeconds: Math.round(this.totalMatchDuration - this.matchTimeRemaining),
      mvpStat: winner
        ? `${winner.name} (${winner.score} pts / ${winner.role.toUpperCase()})`
        : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // CLIENT HUD STATE
  // ---------------------------------------------------------------------------
  public getPlayerHUDState(playerId: string): PlayerClientHUDState {
    const player = this.players.get(playerId);
    const sorted = Array.from(this.players.values()).sort(ShadowOutrunEngine.comparePlayers);
    const rank = player ? sorted.findIndex((p) => p.id === playerId) + 1 : 1;

    let status: PlayerClientHUDState['status'] = 'alive';
    if (player?.role === 'catcher') status = 'hunter';
    else if (player?.isArrested) status = 'eliminated';
    else status = 'survivor';

    return {
      playerId,
      rank,
      totalPlayers: this.players.size,
      score: player?.score || 0,
      status,
      action1Cooldown: player ? player.dashCooldown / player.maxDashCooldown : 0,
      action2Cooldown: 0,
      customStatName: player?.role === 'catcher' ? 'ARRESTS' : 'COINS',
      customStatValue: player?.role === 'catcher' ? player.thievesCaught : player?.coinsCollected || 0,
      message: player?.isSlowed
        ? '⚠️ ILLUMINATED & SLOWED 35%!'
        : player?.role === 'catcher'
        ? '🔦 ILLUMINATE & CATCH FUGITIVES'
        : '💰 LOOT COINS & EVADE TORCH',
    };
  }

  // ---------------------------------------------------------------------------
  // 2D CANVAS RENDERING
  // ---------------------------------------------------------------------------
  public render(ctx: CanvasRenderingContext2D, screenWidth: number, screenHeight: number): void {
    ctx.save();

    // 1. Clear Screen
    ctx.fillStyle = this.map.ambientColor;
    ctx.fillRect(0, 0, screenWidth, screenHeight);

    // 2. Setup Camera Transform
    ctx.save();
    ctx.translate(screenWidth / 2, screenHeight / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // 3. Render Floor Grid
    this.renderFloor(ctx);

    // 4. Render Laser Barriers (Under darkness)
    this.renderLasers(ctx);

    // 5. Render Coins & Collectibles
    this.renderCoins(ctx);

    // 6. Render Walls
    this.renderWalls(ctx);

    // 7. Render Player Trails
    this.renderPlayerTrails(ctx);

    // 8. Dynamic Lighting & Darkness Pass (Fog of War + Flashlight Beams)
    this.renderLightingAndShadows(ctx);

    // 9. Render Characters & Flashlights on top
    this.renderPlayers(ctx);

    // 10. Render Particles & Shockwaves
    this.renderFX(ctx);

    ctx.restore(); // Restore Camera Transform

    // 11. Render Screen Space HUD & Radar
    this.renderHUD(ctx, screenWidth, screenHeight);

    ctx.restore();
  }

  // Render Themed Floor
  private renderFloor(ctx: CanvasRenderingContext2D): void {
    const { width, height, floorColor1, floorColor2, gridSize } = this.map;

    ctx.fillStyle = floorColor1;
    ctx.fillRect(0, 0, width, height);

    // Grid pattern
    ctx.strokeStyle = floorColor2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Ambient carpet/tile noise or decor
    if (this.map.id === 'backrooms') {
      ctx.fillStyle = 'rgba(212, 190, 106, 0.05)';
      for (let x = 40; x < width; x += gridSize * 2) {
        for (let y = 40; y < height; y += gridSize * 2) {
          ctx.fillRect(x + 10, y + 10, gridSize - 20, gridSize - 20);
        }
      }
    }
  }

  // Render Laser Fields
  private renderLasers(ctx: CanvasRenderingContext2D): void {
    if (!this.map.lasers) return;

    this.map.lasers.forEach((laser) => {
      const mod = laser.cycleTimer % laser.cycleDuration;
      const isOn = laser.state === 'on' || mod < laser.cycleDuration * 0.65;
      if (!isOn) return;

      ctx.save();
      ctx.strokeStyle = laser.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = laser.color;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();

      // Core white laser beam
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    });
  }

  // Render Coins
  private renderCoins(ctx: CanvasRenderingContext2D): void {
    this.coins.forEach((coin) => {
      if (coin.collected) return;

      const bounceY = Math.sin(coin.pulsePhase) * 4;
      const y = coin.y + bounceY;

      ctx.save();
      ctx.translate(coin.x, y);

      if (coin.type === 'diamond') {
        // Cyan Diamond
        ctx.fillStyle = '#00FFFF';
        ctx.shadowColor = '#00FFFF';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, -coin.radius * 1.3);
        ctx.lineTo(coin.radius, 0);
        ctx.lineTo(0, coin.radius * 1.3);
        ctx.lineTo(-coin.radius, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (coin.type === 'loot_bag') {
        // Green Loot Bag
        ctx.fillStyle = '#10B981';
        ctx.shadowColor = '#10B981';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 0);
      } else {
        // Gold Coin
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = '#FFB224';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#FFF8DC';
        ctx.beginPath();
        ctx.arc(0, 0, coin.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  }

  // Render Map Walls
  private renderWalls(ctx: CanvasRenderingContext2D): void {
    const { wallFillColor, wallBorderColor } = this.map;

    this.map.walls.forEach((wall) => {
      ctx.save();

      if (wall.isGlass) {
        // Cyber Glass Partition (Translucent cyan/blue)
        ctx.fillStyle = 'rgba(0, 229, 255, 0.18)';
        ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 2;
        ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
      } else {
        // 3D Drop Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(wall.x + 6, wall.y + 6, wall.width, wall.height);

        // Solid Wall Body
        ctx.fillStyle = wall.color || wallFillColor;
        ctx.fillRect(wall.x, wall.y, wall.width, wall.height);

        // Wall Border & Highlight
        ctx.strokeStyle = wall.borderColor || wallBorderColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);

        // Wall Bevel Top-Left Accent
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wall.x, wall.y + wall.height);
        ctx.lineTo(wall.x, wall.y);
        ctx.lineTo(wall.x + wall.width, wall.y);
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  // Render Player Motion Trails
  private renderPlayerTrails(ctx: CanvasRenderingContext2D): void {
    this.players.forEach((p) => {
      if (p.isArrested) return;

      p.trail.forEach((t) => {
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = t.alpha * 0.4;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    });
  }

  // Dynamic Lighting & Darkness Pass (Fog of War + Flashlight Cutouts)
  private renderLightingAndShadows(ctx: CanvasRenderingContext2D): void {
    // 1. Draw Ambient Darkness Mask
    ctx.save();
    ctx.fillStyle = `rgba(5, 5, 8, ${this.map.fogAlpha})`;
    ctx.fillRect(0, 0, this.width, this.height);

    // Use lighter/destination-out composite operation for light cutouts
    ctx.globalCompositeOperation = 'destination-out';

    // 2. Cutout Map Ambient Flickering Lights
    this.map.flickerLights.forEach((light) => {
      const grad = ctx.createRadialGradient(
        light.x,
        light.y,
        0,
        light.x,
        light.y,
        light.radius
      );
      grad.addColorStop(0, `rgba(0, 0, 0, ${light.intensity * 0.9})`);
      grad.addColorStop(0.6, `rgba(0, 0, 0, ${light.intensity * 0.4})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. Cutout Player Ambient Proximity Radiance (Small glow around everyone)
    this.players.forEach((p) => {
      if (p.isArrested) return;
      const glowRadius = p.role === 'catcher' ? 70 : 55;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Cutout Flashlight Beams (Raycasted 2D Cones for Catchers & Deputies)
    this.players.forEach((p) => {
      if (!p.flashlightActive || p.isArrested) return;

      const rays = this.computeFlashlightRays(
        p.x,
        p.y,
        p.beamAngle,
        p.beamRange,
        p.coneSpread,
        32
      );

      if (rays.length > 2) {
        const grad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, p.beamRange);
        grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.85)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(rays[0].x, rays[0].y);
        for (let i = 1; i < rays.length; i++) {
          ctx.lineTo(rays[i].x, rays[i].y);
        }
        ctx.closePath();
        ctx.fill();
      }
    });

    ctx.restore(); // Restore composite mode

    // 5. Draw Warm Luminous Glow on top of the Flashlight Beams
    ctx.save();
    this.players.forEach((p) => {
      if (!p.flashlightActive || p.isArrested) return;

      const rays = this.computeFlashlightRays(
        p.x,
        p.y,
        p.beamAngle,
        p.beamRange,
        p.coneSpread,
        24
      );

      if (rays.length > 2) {
        const glowGrad = ctx.createRadialGradient(p.x, p.y, 5, p.x, p.y, p.beamRange);
        glowGrad.addColorStop(0, 'rgba(255, 242, 117, 0.45)');
        glowGrad.addColorStop(0.7, 'rgba(255, 242, 117, 0.15)');
        glowGrad.addColorStop(1, 'rgba(255, 242, 117, 0)');

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.moveTo(rays[0].x, rays[0].y);
        for (let i = 1; i < rays.length; i++) {
          ctx.lineTo(rays[i].x, rays[i].y);
        }
        ctx.closePath();
        ctx.fill();
      }
    });
    ctx.restore();
  }

  // Render Players & Character Sprites
  private renderPlayers(ctx: CanvasRenderingContext2D): void {
    this.players.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);

      // Status Frost / Glow if slowed
      if (p.isSlowed) {
        ctx.strokeStyle = '#FFE600';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#FFE600';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Base Body Circle
      ctx.fillStyle = p.isArrested ? '#4B5563' : p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.isArrested ? 0 : 12;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Outer border
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Heading Indicator Pointer / Flashlight Torch
      ctx.save();
      ctx.rotate(p.role === 'catcher' || p.role === 'deputy' ? p.beamAngle : p.angle);

      if (p.role === 'catcher' || p.role === 'deputy') {
        // Police Flashlight Torch Graphic
        ctx.fillStyle = '#222222';
        ctx.fillRect(p.radius - 2, -4, 14, 8);
        ctx.fillStyle = '#FFE600';
        ctx.fillRect(p.radius + 10, -5, 4, 10);
      } else {
        // Fugitive Direction Pointer
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(p.radius + 4, 0);
        ctx.lineTo(p.radius - 4, -4);
        ctx.lineTo(p.radius - 4, 4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Character Avatar / Role Icon
      ctx.font = `${p.radius * 1.1}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon =
        p.role === 'catcher'
          ? '👮'
          : p.role === 'deputy'
          ? '⭐'
          : p.isArrested
          ? '⛓️'
          : p.avatar || '🕶️';
      ctx.fillText(icon, 0, 0);

      // Name Label above head
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(p.name, 0, -p.radius - 8);

      // Alert Bubble
      if (p.alertState) {
        ctx.font = '16px sans-serif';
        const alertIcon =
          p.alertState === 'danger'
            ? '🚨'
            : p.alertState === 'coin'
            ? '💰'
            : p.alertState === 'alert'
            ? '⚡'
            : '❓';
        ctx.fillText(alertIcon, 0, -p.radius - 24);
      }

      ctx.restore();
    });
  }

  // Render FX Particles, Shockwaves, and Floating Texts
  private renderFX(ctx: CanvasRenderingContext2D): void {
    // Shockwaves
    this.shockwaves.forEach((sw) => {
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = sw.alpha;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // Particles
    this.particles.forEach((p) => {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Floating Texts
    this.floatingTexts.forEach((txt) => {
      ctx.save();
      ctx.font = `bold ${txt.size}px monospace`;
      ctx.fillStyle = txt.color;
      ctx.globalAlpha = txt.alpha;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText(txt.text, txt.x, txt.y);
      ctx.restore();
    });
  }

  // Render In-Game HUD & Minimap Radar
  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Top-Center Match Timer & Stats Bar
    const ceilRem = Math.ceil(this.matchTimeRemaining);
    const mins = Math.floor(ceilRem / 60);
    const secs = ceilRem % 60;
    const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    const catchersCount = Array.from(this.players.values()).filter(
      (p) => (p.role === 'catcher' || p.role === 'deputy') && !p.isArrested
    ).length;
    const thievesCount = Array.from(this.players.values()).filter(
      (p) => p.role === 'thief' && !p.isArrested
    ).length;

    // Header Pill
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#FFB224';
    ctx.lineWidth = 2;
    const pillW = 320;
    const pillH = 44;
    const pillX = width / 2 - pillW / 2;
    const pillY = 16;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 22);
    ctx.fill();
    ctx.stroke();

    // Timer & Counters
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = ceilRem <= 10 ? '#FF3366' : '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`⏱️ ${timeStr}`, width / 2, pillY + pillH / 2);

    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#FF3366';
    ctx.textAlign = 'left';
    ctx.fillText(`👮 ${catchersCount}`, pillX + 20, pillY + pillH / 2);

    ctx.fillStyle = '#00E5FF';
    ctx.textAlign = 'right';
    ctx.fillText(`🏃 ${thievesCount}`, pillX + pillW - 20, pillY + pillH / 2);
    ctx.restore();

    // Radar Minimap (Bottom-Right)
    const radarSize = 140;
    const radarX = width - radarSize - 20;
    const radarY = height - radarSize - 20;
    const scaleX = radarSize / this.width;
    const scaleY = radarSize / this.height;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(radarX, radarY, radarSize, radarSize);
    ctx.strokeRect(radarX, radarY, radarSize, radarSize);

    // Walls on radar
    ctx.fillStyle = '#475569';
    this.map.walls.forEach((w) => {
      ctx.fillRect(radarX + w.x * scaleX, radarY + w.y * scaleY, w.width * scaleX, w.height * scaleY);
    });

    // Coins on radar
    ctx.fillStyle = '#FFD700';
    this.coins.forEach((c) => {
      if (!c.collected) {
        ctx.fillRect(radarX + c.x * scaleX - 1, radarY + c.y * scaleY - 1, 2, 2);
      }
    });

    // Players on radar
    this.players.forEach((p) => {
      if (p.isArrested) return;
      ctx.fillStyle = p.role === 'catcher' ? '#FF3366' : p.role === 'deputy' ? '#FFAA00' : '#00E5FF';
      ctx.beginPath();
      ctx.arc(radarX + p.x * scaleX, radarY + p.y * scaleY, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }
}
