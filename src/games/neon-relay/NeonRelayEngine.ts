import {
  Player,
  ControllerInput,
  PlayerClientHUDState,
  MatchResults,
  GameEventPayload,
  NeonRelayState,
  GameModifiers,
} from '../../types';
import {
  HovercraftRacer,
  CircuitTrack,
  NeonRelayConfig,
  CameraView,
  Vector2D,
} from './types';
import { createNeonSpeedwayCircuit, updateLasers } from './circuit';
import { ParticleSystem } from './particles';
import { NeonRelayPhysics } from './physics';
import { BotAIController } from './botAI';
import { NeonRelayRenderer } from './renderer';
import { soundManager } from '../../audio/SoundManager';

export class NeonRelayEngine {
  public track: CircuitTrack;
  public racers: HovercraftRacer[] = [];
  public racersMap: Record<string, HovercraftRacer> = {};
  public particles: ParticleSystem;
  public renderer: NeonRelayRenderer;
  public camera: CameraView;
  public config: NeonRelayConfig;

  public matchTime: number = 0;
  public state: 'waiting' | 'countdown' | 'racing' | 'finished' = 'racing';
  public finishedRacersCount: number = 0;
  public eventQueue: GameEventPayload[] = [];
  public nextSuperchargeEventTimer: number = 18; // First event around 18s into the match
  private fastestLapTime: number = Infinity;
  private fastestLapRacer: string = '';

  constructor(customConfig?: Partial<NeonRelayConfig>) {
    this.config = {
      totalLaps: 3,
      roundDuration: 90,
      baseMaxSpeed: 460,
      nitroMaxSpeed: 780,
      boostPadSpeed: 1020,
      baseThrust: 580,
      nitroThrust: 1450,
      turnSpeed: 6.2,
      driftFriction: 0.86,
      forwardFriction: 0.985,
      worldWidth: 2800,
      worldHeight: 1900,
      superchargeZoneInterval: 28,
      randomEventsEnabled: true,
      ...customConfig,
    };

    this.track = createNeonSpeedwayCircuit(this.config.modifiers);
    this.particles = new ParticleSystem();
    this.renderer = new NeonRelayRenderer();
    this.camera = {
      x: 1400,
      y: 950,
      zoom: 0.75,
      targetX: 1400,
      targetY: 950,
      targetZoom: 0.75,
    };
  }

  // Initialize engine with lobby players & AI bots
  public init(players: Record<string, Player>): void {
    this.reset();
    this.track = createNeonSpeedwayCircuit(this.config.modifiers);
    this.nextSuperchargeEventTimer = 18;

    const playerList = Object.values(players);
    const grid = this.track.startingGrid;

    const diff =
      this.config.difficulty === 'easy'
        ? 'easy'
        : this.config.difficulty === 'hard' || this.config.difficulty === 'extreme'
        ? 'hard'
        : 'medium';

    this.racers = playerList.map((player, idx) => {
      const slot = grid[idx % grid.length];
      const isBot = !!player.isBot;
      const speedMultiplier = isBot ? (diff === 'easy' ? 0.85 : diff === 'hard' ? 1.05 : 1.0) : 1.0;

      const racer: HovercraftRacer = {
        id: player.id,
        player,
        x: slot.x,
        y: slot.y,
        vx: 0,
        vy: 0,
        speed: 0,
        maxSpeed: this.config.baseMaxSpeed * speedMultiplier,
        angle: slot.angle,
        angularVelocity: 0,
        targetAngle: slot.angle,
        bankingAngle: 0,
        radius: 22,

        thrust: this.config.baseThrust * speedMultiplier,
        isAccelerating: false,
        isDrifting: false,
        driftFactor: 0,

        jumpZ: 0,
        jumpVz: 0,
        isJumping: false,
        jumpCooldown: 0,

        nitroEnergy: 100,
        maxNitroEnergy: 100,
        isBoosting: false,
        nitroBurnRate: 35, // Burns in ~2.8s
        nitroRechargeRate: 14, // Recharges in ~7s
        boostPadTimer: 0,
        boostPadCooldown: 0,
        lastBoostPadId: null,

        isDrafting: false,
        draftTargetId: null,
        draftTimer: 0,

        isStunned: false,
        stunTimer: 0,
        invulnerableTimer: 0,
        flashTimer: 0,
        wallImpactTimer: 0,

        currentLap: 1,
        nextCheckpointIndex: 1, // Start aiming for Checkpoint 1 after line
        lastCapturedCheckpointIndex: 0,
        lapTimes: [],
        currentLapStartTime: 0,
        raceStartTime: 0,
        finishTime: null,
        finished: false,
        finishRank: null,
        progressDistance: 0,

        trail: [],
        color: player.color || '#00F5A0',
        hoverBobPhase: Math.random() * Math.PI * 2,
        engineHumPitch: 120,

        botState: player.isBot
          ? {
              archetype: player.botArchetype || 'aggressive',
              targetWaypointIndex: 0,
              laneOffset: (Math.random() - 0.5) * 50,
              nitroCheckCooldown: 0.5 + Math.random() * 0.5,
              hazardAvoidanceVector: { x: 0, y: 0 },
              reactionDelayTimer: 0,
              steerSmooth: 0,
            }
          : undefined,
      };

      this.racersMap[player.id] = racer;
      return racer;
    });

    this.state = 'racing';
    this.matchTime = 0;
    this.finishedRacersCount = 0;
  }

  public reset(): void {
    this.racers = [];
    this.racersMap = {};
    this.particles.reset();
    this.eventQueue = [];
    this.matchTime = 0;
    this.state = 'racing';
    this.finishedRacersCount = 0;
    this.fastestLapTime = Infinity;
    this.fastestLapRacer = '';
  }

  // --- DETERMINISTIC RACER SORTING --- //
  public static sortRacersDeterministic(a: HovercraftRacer, b: HovercraftRacer): number {
    // 1. Both finished: compare finishRank or finishTime
    if (a.finished && b.finished) {
      if (a.finishRank !== null && b.finishRank !== null && a.finishRank !== b.finishRank) {
        return a.finishRank - b.finishRank;
      }
      if (a.finishTime !== null && b.finishTime !== null && a.finishTime !== b.finishTime) {
        return a.finishTime - b.finishTime;
      }
    }
    // 2. Finished racers are always ahead of unfinished
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;

    // 3. Unfinished racers: compare lap -> checkpoint -> progressDistance -> total lap times -> deterministic ID
    if (a.currentLap !== b.currentLap) {
      return b.currentLap - a.currentLap;
    }
    if (a.lastCapturedCheckpointIndex !== b.lastCapturedCheckpointIndex) {
      return b.lastCapturedCheckpointIndex - a.lastCapturedCheckpointIndex;
    }
    if (Math.abs(b.progressDistance - a.progressDistance) > 0.01) {
      return b.progressDistance - a.progressDistance;
    }
    const aTotalLapTime = a.lapTimes.reduce((acc, t) => acc + t, 0);
    const bTotalLapTime = b.lapTimes.reduce((acc, t) => acc + t, 0);
    if (a.lapTimes.length > 0 && b.lapTimes.length > 0 && a.lapTimes.length === b.lapTimes.length && Math.abs(aTotalLapTime - bTotalLapTime) > 0.001) {
      return aTotalLapTime - bTotalLapTime;
    }
    return a.id.localeCompare(b.id);
  }

  public getSortedRacers(): HovercraftRacer[] {
    return [...this.racers].sort((a, b) => NeonRelayEngine.sortRacersDeterministic(a, b));
  }

  // --- RANDOM EVENT: SUPERCHARGE ZONE (Temporary 2X Speed Highway) --- //
  public triggerSuperchargeZone(sectorIndex?: number, duration: number = 12): void {
    if (!this.track.superchargeZones || this.track.superchargeZones.length === 0) return;

    let targetZone = this.track.superchargeZones[0];
    if (sectorIndex !== undefined) {
      const found = this.track.superchargeZones.find((z) => z.sectorIndex === sectorIndex);
      if (found) targetZone = found;
    } else {
      // Pick random inactive zone or alternate
      const available = this.track.superchargeZones.filter((z) => !z.active);
      if (available.length > 0) {
        targetZone = available[Math.floor(Math.random() * available.length)];
      }
    }

    targetZone.active = true;
    targetZone.duration = duration;
    targetZone.remainingTime = duration;

    // Visual & audio fanfare for event activation
    this.renderer.triggerScreenShake(8);
    this.particles.emitRingShockwave(targetZone.x, targetZone.y, '#FFE600', 160);
    this.particles.emitFloatingText(targetZone.x, targetZone.y - 40, '⚡ SUPERCHARGE HIGHWAY OPEN! (2X SPEED) ⚡', '#FFE600');

    this.eventQueue.push({
      type: 'announcement',
      payload: {
        title: '⚡ SUPERCHARGE HIGHWAY ACTIVE! ⚡',
        description: `Temporary 2X Speed Zone active on ${targetZone.name}!`,
        duration: 4000,
      },
    });

    this.eventQueue.push({
      type: 'haptic',
      payload: { intensity: 'heavy', duration: 250, text: 'SUPERCHARGE HIGHWAY' },
    });
  }

  // --- 60FPS TICK STEP --- //
  public tick(dt: number, inputs: Record<string, ControllerInput> = {}): void {
    if (this.state === 'finished' && this.finishedRacersCount >= this.racers.length) {
      return;
    }

    // Cap delta time for stability
    const stepDt = Math.min(0.05, Math.max(0.001, dt));
    this.matchTime += stepDt;

    // 1. Update Dynamic Lasers
    updateLasers(this.track.lasers, this.matchTime);

    // 2. Update Active Supercharge Highway Zones & Timers
    if (this.track.superchargeZones) {
      for (const zone of this.track.superchargeZones) {
        if (zone.active) {
          zone.remainingTime -= stepDt;
          zone.pulsePhase += stepDt * 4;
          if (zone.remainingTime <= 0) {
            zone.active = false;
            this.eventQueue.push({
              type: 'announcement',
              payload: {
                title: 'SUPERCHARGE CLOSED',
                description: `${zone.name} has returned to standard speed.`,
                duration: 2500,
              },
            });
          }
        }
      }
    }

    // 3. Random Event Periodic Scheduler (Supercharge Zone)
    if (this.config.randomEventsEnabled !== false && this.state === 'racing') {
      this.nextSuperchargeEventTimer -= stepDt;
      if (this.nextSuperchargeEventTimer <= 0) {
        this.nextSuperchargeEventTimer = this.config.superchargeZoneInterval || 28;
        this.triggerSuperchargeZone();
      }
    }

    // 4. Process Inputs & Update Hovercraft Racers
    for (const racer of this.racers) {
      if (racer.finished) {
        // Slow down smoothly after crossing finish line
        racer.vx *= Math.pow(0.96, stepDt * 60);
        racer.vy *= Math.pow(0.96, stepDt * 60);
        racer.speed = Math.hypot(racer.vx, racer.vy);
        racer.x += racer.vx * stepDt;
        racer.y += racer.vy * stepDt;
        racer.isBoosting = false;
        // Emit celebratory trail sparkles
        this.particles.emitCelebratorySparkles(racer.x, racer.y, racer.color);
        continue;
      }

      // Compute input: Human controller vs Autonomous Bot AI
      let input: ControllerInput;
      if (racer.player.isBot) {
        const diff =
          this.config.difficulty === 'easy'
            ? 'easy'
            : this.config.difficulty === 'hard' || this.config.difficulty === 'extreme'
            ? 'hard'
            : 'medium';
        input = BotAIController.computeInput(racer, this.racers, this.track, stepDt, diff);
      } else {
        const rawInput = inputs[racer.id];
        input = rawInput || {
          x: 0,
          y: 0,
          angle: racer.angle,
          magnitude: 0,
          action1: false,
          action2: false,
          timestamp: Date.now(),
        };
      }

      // Physics integration (thrust, drift friction, speed clamping, nitro)
      NeonRelayPhysics.updateRacer(racer, input, this.config, stepDt, this.particles);

      // Boundary wall collisions
      NeonRelayPhysics.resolveWallCollisions(racer, this.track, this.particles);

      // Boost pad triggers
      NeonRelayPhysics.checkBoostPads(racer, this.track.boostPads, this.particles, () => {
        this.eventQueue.push({
          type: 'haptic',
          targetPlayerId: racer.id,
          payload: { intensity: 'heavy', duration: 150, text: 'SUPER BOOST' },
        });
      });

      // Supercharge Zone Highway Detection (2X speed)
      NeonRelayPhysics.checkSuperchargeZones(racer, this.track.superchargeZones, this.particles, (rId) => {
        this.eventQueue.push({
          type: 'haptic',
          targetPlayerId: rId,
          payload: { intensity: 'medium', duration: 120, text: '2X SPEED HIGHWAY' },
        });
      });

      // Laser hazard collision check
      NeonRelayPhysics.checkLasers(racer, this.track.lasers, this.particles, (hitId) => {
        this.renderer.triggerScreenShake(14);
        this.eventQueue.push({
          type: 'hit',
          targetPlayerId: hitId,
          payload: { intensity: 'heavy', duration: 300, text: 'LASER IMPACT!' },
        });
      });

      // Checkpoint sequence validation & progression
      this.updateRacerCheckpoints(racer);
    }

    // 5. Hovercraft-to-Hovercraft Elastic Bumping & Collision
    NeonRelayPhysics.resolveRacerCollisions(this.racers, this.particles);

    // 4. Slipstream Drafting Calculations
    NeonRelayPhysics.updateDrafting(this.racers, this.particles);

    // 5. Update Particle System
    this.particles.update(stepDt);

    // 6. Update Camera Viewport (Smart tracking)
    this.updateCamera(stepDt);

    // 7. Check Match Completion
    this.checkMatchEnd();
  }

  // --- CHECKPOINT SEQUENCE & PROGRESSION --- //
  private updateRacerCheckpoints(racer: HovercraftRacer): void {
    if (racer.finished) return;

    const checkpoints = this.track.checkpoints;
    const numCheckpoints = checkpoints.length;
    const targetCp = checkpoints[racer.nextCheckpointIndex];

    const dx = racer.x - targetCp.x;
    const dy = racer.y - targetCp.y;
    const dist = Math.hypot(dx, dy);

    // Capture checkpoint when within radius
    if (dist < targetCp.radius) {
      const capturedIndex = racer.nextCheckpointIndex;
      const prevCapturedIndex = racer.lastCapturedCheckpointIndex;

      // Finish / Lap crossing logic (Gate 0)
      if (capturedIndex === 0) {
        // Strict sequence validation: Must have completed entire circuit (last checkpoint was N-1)
        if (prevCapturedIndex !== numCheckpoints - 1) {
          return; // Ignore backward or out-of-order crossing
        }

        racer.lastCapturedCheckpointIndex = 0;
        racer.nextCheckpointIndex = 1;

        const lapDuration = this.matchTime - racer.currentLapStartTime;
        racer.lapTimes.push(lapDuration);
        racer.currentLapStartTime = this.matchTime;

        if (lapDuration < this.fastestLapTime && racer.currentLap >= 1) {
          this.fastestLapTime = lapDuration;
          this.fastestLapRacer = racer.player.name;
        }

        if (racer.currentLap >= this.config.totalLaps) {
          // --- RACER FINISHED AUTHORITATIVELY! --- //
          if (!racer.finished) {
            racer.finished = true;
            this.finishedRacersCount++;
            racer.finishRank = this.finishedRacersCount;
            racer.finishTime = this.matchTime;

            const rankText = racer.finishRank === 1 ? '1ST PLACE WINNER!' : `POSITION #${racer.finishRank}`;
            this.particles.emitFinishCheckeredBurst(targetCp.x, targetCp.y, racer.color, rankText);
            this.eventQueue.push({
              type: 'announcement',
              payload: {
                title: `${racer.player.name} Finished!`,
                description: `Crossed line in Rank #${racer.finishRank} (${this.matchTime.toFixed(2)}s)!`,
                points: Math.max(100, 1000 - (racer.finishRank - 1) * 200),
              },
            });
            this.eventQueue.push({
              type: 'score',
              targetPlayerId: racer.id,
              payload: { points: Math.max(100, 1000 - (racer.finishRank - 1) * 200), text: `FINISH P${racer.finishRank}` },
            });
          }
        } else {
          // --- NEXT LAP --- //
          racer.currentLap++;
          this.particles.emitCheckpointCapture(targetCp.x, targetCp.y, '#FFB224', `⚡ LAP ${racer.currentLap}/${this.config.totalLaps}! ⚡`);
          this.eventQueue.push({
            type: 'score',
            targetPlayerId: racer.id,
            payload: { points: 250, text: `LAP ${racer.currentLap}` },
          });
        }
      } else {
        // --- INTERMEDIATE CHECKPOINT CAPTURE --- //
        racer.lastCapturedCheckpointIndex = capturedIndex;
        racer.nextCheckpointIndex = (capturedIndex + 1) % numCheckpoints;
        this.particles.emitCheckpointCapture(targetCp.x, targetCp.y, '#00E5FF', `+CHECKPOINT 0${capturedIndex}`);
        this.eventQueue.push({
          type: 'haptic',
          targetPlayerId: racer.id,
          payload: { intensity: 'light', duration: 40 },
        });
      }
    }

    // Compute continuous progress score for leaderboard ranking
    const nextCp = checkpoints[racer.nextCheckpointIndex];
    const dNext = Math.hypot(nextCp.x - racer.x, nextCp.y - racer.y);
    const lapProgress = (racer.currentLap - 1) * (numCheckpoints * 2000);
    const cpProgress = racer.lastCapturedCheckpointIndex * 2000;
    const distanceBonus = Math.max(0, 2000 - dNext);

    racer.progressDistance = lapProgress + cpProgress + distanceBonus;
  }

  // --- DYNAMIC MULTIPLAYER GROUP CAMERA --- //
  private updateCamera(dt: number): void {
    if (this.racers.length === 0) return;

    // Find dynamic centroid & bounding box of active racing pack
    const activeRacers = this.racers.filter((r) => !r.finished);
    const targetGroup = activeRacers.length > 0 ? activeRacers : this.racers;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let sumX = 0;
    let sumY = 0;
    let sumVx = 0;
    let sumVy = 0;

    for (const r of targetGroup) {
      const vx = r.vx !== undefined && !isNaN(r.vx) ? r.vx : Math.cos(r.angle) * r.speed;
      const vy = r.vy !== undefined && !isNaN(r.vy) ? r.vy : Math.sin(r.angle) * r.speed;

      // Lookahead point for individual racer
      const rLookX = r.x + vx * 0.35;
      const rLookY = r.y + vy * 0.35;

      minX = Math.min(minX, r.x, rLookX);
      maxX = Math.max(maxX, r.x, rLookX);
      minY = Math.min(minY, r.y, rLookY);
      maxY = Math.max(maxY, r.y, rLookY);

      sumX += r.x;
      sumY += r.y;
      sumVx += vx;
      sumVy += vy;
    }

    // 1. Centroid of all active racers
    const midX = sumX / targetGroup.length;
    const midY = sumY / targetGroup.length;
    const avgVx = sumVx / targetGroup.length;
    const avgVy = sumVy / targetGroup.length;

    // 2. Forward lookahead vector based on average velocity/heading
    const lookaheadTime = 0.45;
    const lookaheadX = avgVx * lookaheadTime;
    const lookaheadY = avgVy * lookaheadTime;

    const targetCenterX = midX + lookaheadX * 0.6;
    const targetCenterY = midY + lookaheadY * 0.6;

    // 3. Find max distance from group center to any racer
    let maxDistFromMid = 0;
    for (const r of targetGroup) {
      const d = Math.hypot(r.x - midX, r.y - midY);
      maxDistFromMid = Math.max(maxDistFromMid, d);
    }

    // 4. Bounding box with 380px margin buffer
    const spanX = Math.max((maxDistFromMid * 2) + 380, (maxX - minX) + 380);
    const spanY = Math.max((maxDistFromMid * 2) + 380, (maxY - minY) + 380);

    // 5. Dynamic zoom clamped smoothly between 0.38x and 1.0x
    const zoomX = 1600 / Math.max(spanX, 600);
    const zoomY = 950 / Math.max(spanY, 450);
    const calculatedZoom = Math.min(zoomX, zoomY);
    const targetZoom = Math.max(0.38, Math.min(1.0, calculatedZoom));

    // 6. Smooth Damped Interpolation
    this.camera.targetX = targetCenterX;
    this.camera.targetY = targetCenterY;
    this.camera.targetZoom = targetZoom;

    const lerpRate = Math.min(1.0, dt * 3.2);
    this.camera.x += (this.camera.targetX - this.camera.x) * lerpRate;
    this.camera.y += (this.camera.targetY - this.camera.y) * lerpRate;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * (lerpRate * 0.75);
  }

  // --- MATCH END CONDITION (Deterministic, Triggers Once) --- //
  private checkMatchEnd(): void {
    const allFinished = this.racers.length > 0 && this.racers.every((r) => r.finished);
    const timeExpired = this.matchTime >= this.config.roundDuration;

    if ((allFinished || timeExpired) && this.state !== 'finished') {
      this.state = 'finished';

      // Auto-rank any remaining unfinished racers deterministically based on progress
      const unfinished = this.racers
        .filter((r) => !r.finished)
        .sort((a, b) => NeonRelayEngine.sortRacersDeterministic(a, b));

      for (const r of unfinished) {
        this.finishedRacersCount++;
        r.finishRank = this.finishedRacersCount;
        r.finishTime = this.matchTime;
        r.finished = true;
      }

      this.eventQueue.push({
        type: 'announcement',
        payload: {
          title: 'RACE FINISHED!',
          description: 'Podium awards ready!',
        },
      });
    }
  }

  // --- RENDER PASS --- //
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    focusedPlayerId?: string
  ): void {
    this.renderer.render(
      ctx,
      width,
      height,
      this.track,
      this.racers,
      this.particles,
      this.camera,
      focusedPlayerId
    );
  }

  // --- PLAYER HUD STATE (Mobile Controller / Light Sync) --- //
  public getPlayerHUDState(playerId: string): PlayerClientHUDState {
    const racer = this.racersMap[playerId];
    if (!racer) {
      return {
        playerId,
        rank: 1,
        totalPlayers: this.racers.length || 1,
        score: 0,
        status: 'racing',
        action1Cooldown: 0,
        action2Cooldown: 0,
        customStatName: 'LAP / SPEED',
        customStatValue: `LAP 1/${this.config.totalLaps} • 0 KPH`,
        message: 'CONNECTING...',
      };
    }

    // Compute live deterministic rank
    const sorted = this.getSortedRacers();
    const rank = sorted.findIndex((r) => r.id === playerId) + 1;
    const kph = Math.round(racer.speed * 0.8);
    const jumpCooldownRatio = Math.min(1.0, (racer.jumpCooldown || 0) / 0.75);
    const nitroCooldownRatio = 1.0 - Math.max(0, Math.min(1.0, racer.nitroEnergy / 100));

    let status: PlayerClientHUDState['status'] = 'racing';
    if (racer.finished) {
      status = racer.finishRank === 1 ? 'winner' : 'finished';
    } else if (this.state === 'finished' && !racer.finished) {
      status = 'eliminated';
    }

    let message = 'PRESS [JUMP] • HOLD [NITRO]';
    if (racer.isStunned) message = '⚡ STUNNED! RECOVERING...';
    else if (racer.jumpZ > 12) message = '🚀 3D JUMP ACTIVE! (CLEARING HAZARDS)';
    else if (racer.isDrafting) message = '💨 SLIPSTREAM DRAFT ACTIVE! +SPEED';
    else if (racer.boostPadTimer > 0) message = '⚡ HYPER SPEED BOOST!';
    else if (racer.currentLap >= this.config.totalLaps && !racer.finished) message = '🏁 FINAL LAP! SPRINT TO LINE!';
    else if (racer.finished) message = racer.finishRank === 1 ? '🏆 1ST PLACE WINNER!' : `🏁 FINISHED POSITION #${racer.finishRank}!`;

    const lapText = racer.finished
      ? `FINISHED (P${racer.finishRank})`
      : `LAP ${Math.min(this.config.totalLaps, racer.currentLap)}/${this.config.totalLaps}`;

    return {
      playerId,
      rank,
      totalPlayers: this.racers.length,
      score: Math.round(racer.progressDistance / 10),
      status,
      action1Cooldown: jumpCooldownRatio,
      action2Cooldown: nitroCooldownRatio,
      customStatName: 'LAP / SPEED',
      customStatValue: `${lapText} • ${kph} KPH`,
      message,
    };
  }

  // --- MATCH RESULTS (Post-Race Podium) --- //
  public getResults(): MatchResults {
    const sorted = this.getSortedRacers();
    const winner = sorted[0];
    const rankings = sorted.map((r, idx) => {
      const finalRank = r.finishRank || idx + 1;
      const score = Math.max(50, 1000 - (finalRank - 1) * 150);
      const bestLap = r.lapTimes.length > 0 ? `${Math.min(...r.lapTimes).toFixed(2)}s` : '--';

      return {
        id: r.id,
        name: r.player.name,
        score,
        rank: finalRank,
        avatar: r.player.avatar,
        color: r.color,
        isBot: r.player.isBot,
        statSummary: `Rank #${finalRank} • Best Lap: ${bestLap}`,
      };
    });

    const mvp = this.fastestLapRacer
      ? `Fastest Lap: ${this.fastestLapTime.toFixed(2)}s (${this.fastestLapRacer})`
      : `Circuit Champion: ${winner?.player.name || 'None'}`;

    return {
      gameId: 'neon-relay',
      winnerId: winner ? winner.id : '',
      winnerName: winner ? winner.player.name : 'Unknown Pilot',
      winnerAvatar: winner ? winner.player.avatar : 'ship',
      winnerColor: winner ? winner.color : '#00F5A0',
      rankings,
      durationSeconds: Math.round(this.matchTime),
      mvpStat: mvp,
    };
  }

  // --- GAME STATE EXPORT (Network Sync) --- //
  public getState(): NeonRelayState {
    const racersState: NeonRelayState['racers'] = {};
    for (const r of this.racers) {
      racersState[r.id] = {
        x: Math.round(r.x),
        y: Math.round(r.y),
        vx: Math.round(r.vx),
        vy: Math.round(r.vy),
        angle: parseFloat(r.angle.toFixed(2)),
        speed: Math.round(r.speed),
        boostEnergy: Math.round(r.nitroEnergy),
        isBoosting: r.isBoosting,
        nextCheckpointIndex: r.nextCheckpointIndex,
        lap: r.currentLap,
        finished: r.finished,
        finishRank: r.finishRank || undefined,
        trail: r.trail.map((t) => ({ x: Math.round(t.x), y: Math.round(t.y), alpha: t.alpha })),
      };
    }

    return {
      checkpoints: this.track.checkpoints.map((cp) => ({
        id: cp.id,
        x: cp.x,
        y: cp.y,
        radius: cp.radius,
        activeSequenceIndex: cp.id,
      })),
      racers: racersState,
      boostPads: this.track.boostPads.map((p) => ({
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        angle: p.angle,
      })),
      lasers: this.track.lasers.map((l) => ({
        x1: Math.round(l.currentP1.x),
        y1: Math.round(l.currentP1.y),
        x2: Math.round(l.currentP2.x),
        y2: Math.round(l.currentP2.y),
        speed: l.periodSeconds,
        offset: l.phaseOffset,
      })),
    };
  }

  // --- DRAIN EVENT QUEUE --- //
  public getEvents(): GameEventPayload[] {
    const events = [...this.eventQueue];
    this.eventQueue = [];
    return events;
  }

  // -------------------------------------------------------------
  // DEV / QA SPECIALIST API
  // -------------------------------------------------------------

  public spawnBot(archetype?: 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic', name?: string, color?: string): string {
    const archetypes: Array<'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic'> = [
      'aggressive', 'defensive', 'collector', 'ambusher', 'chaotic'
    ];
    const chosenArchetype = archetype || archetypes[Math.floor(Math.random() * archetypes.length)];
    const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const botColors = ['#FF3366', '#FFB224', '#00E5FF', '#9D4EDD', '#00F5A0', '#FF7700'];
    const botColor = color || botColors[Math.floor(Math.random() * botColors.length)];
    const botName = name || `[AI] RACER_${chosenArchetype.toUpperCase()}`;

    const slot = this.track.startingGrid[this.racers.length % this.track.startingGrid.length];
    const racer: HovercraftRacer = {
      id: botId,
      player: {
        id: botId,
        socketId: `socket_${botId}`,
        name: botName,
        avatar: 'robot',
        color: botColor,
        isHost: false,
        isBot: true,
        botArchetype: chosenArchetype,
        isReady: true,
        score: 0,
        ping: 0,
        connected: true,
        lastActive: Date.now(),
      },
      x: slot.x + (Math.random() - 0.5) * 40,
      y: slot.y + (Math.random() - 0.5) * 40,
      vx: 0,
      vy: 0,
      speed: 0,
      maxSpeed: this.config.baseMaxSpeed,
      angle: slot.angle,
      angularVelocity: 0,
      targetAngle: slot.angle,
      bankingAngle: 0,
      radius: 22,
      thrust: this.config.baseThrust,
      isAccelerating: false,
      isDrifting: false,
      driftFactor: 0,
      jumpZ: 0,
      jumpVz: 0,
      isJumping: false,
      jumpCooldown: 0,
      nitroEnergy: 100,
      maxNitroEnergy: 100,
      isBoosting: false,
      nitroBurnRate: 35,
      nitroRechargeRate: 14,
      boostPadTimer: 0,
      boostPadCooldown: 0,
      lastBoostPadId: null,
      isDrafting: false,
      draftTargetId: null,
      draftTimer: 0,
      isStunned: false,
      stunTimer: 0,
      invulnerableTimer: 0,
      flashTimer: 0,
      wallImpactTimer: 0,
      currentLap: 1,
      nextCheckpointIndex: 1,
      lastCapturedCheckpointIndex: 0,
      lapTimes: [],
      currentLapStartTime: this.matchTime,
      raceStartTime: this.matchTime,
      finishTime: null,
      finished: false,
      finishRank: null,
      progressDistance: 0,
      trail: [],
      color: botColor,
      hoverBobPhase: Math.random() * Math.PI * 2,
      engineHumPitch: 120,
      botState: {
        archetype: chosenArchetype,
        targetWaypointIndex: 0,
        laneOffset: (Math.random() - 0.5) * 50,
        nitroCheckCooldown: 0.5,
        hazardAvoidanceVector: { x: 0, y: 0 },
        reactionDelayTimer: 0,
        steerSmooth: 0,
      },
    };

    this.racers.push(racer);
    this.racersMap[botId] = racer;
    this.particles.emitCelebratorySparkles(racer.x, racer.y, botColor);
    return botId;
  }

  public forceEliminate(playerId: string): void {
    const racer = this.racersMap[playerId];
    if (racer && !racer.finished) {
      racer.isStunned = true;
      racer.stunTimer = 999;
      racer.speed = 0;
      racer.vx = 0;
      racer.vy = 0;
      this.particles.emitSparks(racer.x, racer.y, { x: 0, y: -1 }, '#FF3366');
      soundManager.playElimination();
    }
  }

  public forceWin(playerId: string): void {
    const racer = this.racersMap[playerId];
    if (racer) {
      racer.currentLap = this.config.totalLaps;
      racer.finished = true;
      racer.finishRank = 1;
      racer.finishTime = this.matchTime;
      this.finishedRacersCount++;
      this.state = 'finished';
      soundManager.playVictoryFanfare();
    }
  }

  public triggerEvent(type: 'laser_overdrive' | 'super_charge' | 'hyper_boost' = 'laser_overdrive'): void {
    if (type === 'laser_overdrive') {
      for (const laser of this.track.lasers) {
        laser.periodSeconds = Math.max(1.2, laser.periodSeconds * 0.4);
      }
      this.renderer.triggerScreenShake(20);
      soundManager.playHunterStinger();
      this.eventQueue.push({
        type: 'announcement',
        payload: {
          title: '🚨 LASER OVERDRIVE ACTIVE! 🚨',
          description: 'Circuit defense grid energized to maximum frequency!',
        },
      });
    } else {
      // Super charge: give all racers instant full nitro and speed boost
      for (const r of this.racers) {
        r.nitroEnergy = 100;
        r.boostPadTimer = 4.0;
        this.particles.emitCelebratorySparkles(r.x, r.y, '#00F5A0');
      }
      soundManager.playBoost();
    }
  }

  public setModifiers(modifiers: Partial<GameModifiers>): void {
    if (modifiers.turboSpeed) {
      this.config.baseMaxSpeed = 700;
      this.config.nitroMaxSpeed = 1100;
      this.config.baseThrust = 950;
    } else {
      this.config.baseMaxSpeed = 460;
      this.config.nitroMaxSpeed = 780;
      this.config.baseThrust = 580;
    }

    if (modifiers.chaosMode) {
      this.config.baseMaxSpeed = 800;
      this.config.nitroMaxSpeed = 1300;
      for (const laser of this.track.lasers) {
        laser.periodSeconds = 1.5;
      }
    }
  }

  public setPlayerConnected(playerId: string, connected: boolean): void {
    const racer = this.racersMap[playerId];
    if (racer) {
      racer.player.connected = connected;
      if (!connected) {
        racer.isStunned = true;
        racer.stunTimer = 999;
      } else {
        racer.isStunned = false;
        racer.stunTimer = 0;
      }
    }
  }
}
