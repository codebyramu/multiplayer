import { 
  Player, 
  ControllerInput, 
  PlayerClientHUDState, 
  MatchResults, 
  VoidTagState 
} from '../../types';
import { 
  VoidTagPlayerEntity, 
  SanctuaryZone, 
  NebulaZone, 
  SpaceDebris, 
  Particle, 
  ShockwaveFX, 
  FloatingCombatText, 
  VoidTagEngineConfig,
  VoidTagEventCallback 
} from './types';
import { VoidTagBotAI } from './VoidTagBotAI';
import { VoidTagRenderer } from './VoidTagRenderer';
import { soundManager } from '../../audio/SoundManager';

export class VoidTagEngine {
  public config: VoidTagEngineConfig;
  public players: Record<string, VoidTagPlayerEntity> = {};
  public sanctuaries: SanctuaryZone[] = [];
  public nebulae: NebulaZone[] = [];
  public debris: SpaceDebris[] = [];
  
  public particles: Particle[] = [];
  public shockwaves: ShockwaveFX[] = [];
  public floatingTexts: FloatingCombatText[] = [];

  public state: 'intro' | 'active' | 'sudden_death' | 'finished' = 'intro';
  public introTimer: number = 3.0;
  public timeRemaining: number = 90.0;
  public totalMatchDuration: number = 90.0;

  public initialHunterId: string | null = null;
  public localPlayerId?: string;

  private renderer: VoidTagRenderer;
  private onEventCallback?: VoidTagEventCallback;

  // Radar & Screen FX
  private radarTimer: number = 0;
  private radarPulseRadius: number = 0;
  private screenShake: { x: number; y: number; intensity: number } = { x: 0, y: 0, intensity: 0 };
  private screenFlash: { color: string; alpha: number; text?: string } = { color: '#000000', alpha: 0 };

  constructor(
    roomPlayers: Record<string, Player>,
    localPlayerId?: string,
    customConfig?: Partial<VoidTagEngineConfig>,
    onEvent?: VoidTagEventCallback
  ) {
    this.localPlayerId = localPlayerId;
    this.onEventCallback = onEvent;

    this.config = {
      arenaWidth: 1920,
      arenaHeight: 1080,
      roundDuration: 90,
      initialGracePeriod: 3.0,
      baseSurvivorSpeed: 285,
      baseHunterSpeed: 335,
      dashSpeedBonus: 210,
      empRadius: 190,
      empStunDuration: 1.5,
      tagDistance: 38,
      ...customConfig,
    };

    this.timeRemaining = this.config.roundDuration;
    this.totalMatchDuration = this.config.roundDuration;
    this.introTimer = this.config.initialGracePeriod;

    this.renderer = new VoidTagRenderer();

    this.initializeArena();
    this.initializePlayers(roomPlayers);
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------------------------
  private initializeArena(): void {
    const w = this.config.arenaWidth;
    const h = this.config.arenaHeight;

    // 1. Light Sanctuaries (4 balanced strategic safe-havens)
    this.sanctuaries = [
      {
        id: 1,
        x: w * 0.22,
        y: h * 0.25,
        radius: 105,
        energy: 100,
        maxEnergy: 100,
        isDepleted: false,
        rechargeRate: 6.0,
        drainRate: 15.0,
        rotationAngle: 0,
        pulsePhase: 0,
        glyphRadius: 95,
      },
      {
        id: 2,
        x: w * 0.78,
        y: h * 0.25,
        radius: 105,
        energy: 100,
        maxEnergy: 100,
        isDepleted: false,
        rechargeRate: 6.0,
        drainRate: 15.0,
        rotationAngle: 1.2,
        pulsePhase: 1.5,
        glyphRadius: 95,
      },
      {
        id: 3,
        x: w * 0.22,
        y: h * 0.75,
        radius: 105,
        energy: 100,
        maxEnergy: 100,
        isDepleted: false,
        rechargeRate: 6.0,
        drainRate: 15.0,
        rotationAngle: 2.4,
        pulsePhase: 3.0,
        glyphRadius: 95,
      },
      {
        id: 4,
        x: w * 0.78,
        y: h * 0.75,
        radius: 105,
        energy: 100,
        maxEnergy: 100,
        isDepleted: false,
        rechargeRate: 6.0,
        drainRate: 15.0,
        rotationAngle: 3.6,
        pulsePhase: 4.5,
        glyphRadius: 95,
      },
    ];

    // 2. Stealth Cosmic Nebulae (3 organic concealment gas zones)
    this.nebulae = [
      {
        id: 1,
        x: w * 0.5,
        y: h * 0.2,
        radius: 145,
        pulsePhase: 0,
        cloudOffsets: this.generateNebulaLobeOffsets(145),
      },
      {
        id: 2,
        x: w * 0.5,
        y: h * 0.8,
        radius: 145,
        pulsePhase: 2.1,
        cloudOffsets: this.generateNebulaLobeOffsets(145),
      },
      {
        id: 3,
        x: w * 0.5,
        y: h * 0.5,
        radius: 165,
        pulsePhase: 4.2,
        cloudOffsets: this.generateNebulaLobeOffsets(165),
      },
    ];

    // 3. Floating Space Debris (6 procedural asteroids for cover and deflection)
    this.debris = [
      this.createDebris(1, w * 0.35, h * 0.45, 42, '#1E293B', '#00E5FF'),
      this.createDebris(2, w * 0.65, h * 0.45, 42, '#1E293B', '#00E5FF'),
      this.createDebris(3, w * 0.35, h * 0.62, 48, '#1E293B', '#9D4EDD'),
      this.createDebris(4, w * 0.65, h * 0.62, 48, '#1E293B', '#9D4EDD'),
      this.createDebris(5, w * 0.5, h * 0.33, 36, '#0F172A', '#FF3366'),
      this.createDebris(6, w * 0.5, h * 0.67, 36, '#0F172A', '#FF3366'),
    ];
  }

  private generateNebulaLobeOffsets(radius: number) {
    const colors = ['rgba(157, 78, 221, 0.35)', 'rgba(90, 24, 154, 0.3)', 'rgba(255, 0, 128, 0.2)'];
    const lobes = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const dist = radius * (0.3 + Math.random() * 0.4);
      lobes.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        r: radius * (0.4 + Math.random() * 0.3),
        color: colors[i % colors.length],
        speed: 0.4 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return lobes;
  }

  private createDebris(
    id: number,
    x: number,
    y: number,
    radius: number,
    color: string,
    glowColor: string
  ): SpaceDebris {
    const vertCount = 8;
    const vertices = [];
    for (let i = 0; i < vertCount; i++) {
      const angle = (i / vertCount) * Math.PI * 2;
      const r = radius * (0.8 + Math.random() * 0.4);
      vertices.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
      });
    }

    return {
      id,
      x,
      y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      radius,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.25,
      vertices,
      color,
      glowColor,
      mass: radius * 2.0,
    };
  }

  private initializePlayers(roomPlayers: Record<string, Player>): void {
    VoidTagBotAI.reset();
    const pList = Object.values(roomPlayers);
    const playerCount = Math.max(1, pList.length);
    const centerX = this.config.arenaWidth * 0.5;
    const centerY = this.config.arenaHeight * 0.5;
    const spawnRadius = 360;

    // Pick 1 initial Void Hunter randomly (or prefer a bot if desired, or random player)
    const hunterIndex = Math.floor(Math.random() * playerCount);
    const designatedHunterId = pList[hunterIndex]?.id || 'p1';
    this.initialHunterId = designatedHunterId;

    pList.forEach((p, idx) => {
      const angle = (idx / playerCount) * Math.PI * 2;
      const spawnX = centerX + Math.cos(angle) * spawnRadius;
      const spawnY = centerY + Math.sin(angle) * spawnRadius;
      const isHunter = p.id === designatedHunterId;

      this.players[p.id] = {
        id: p.id,
        name: p.name,
        color: p.color || '#00F5A0',
        avatar: p.avatar || 'ship',
        isBot: !!p.isBot,
        botArchetype: p.botArchetype || (idx % 2 === 0 ? 'aggressive' : 'defensive'),

        x: spawnX,
        y: spawnY,
        vx: 0,
        vy: 0,
        angle,
        targetAngle: angle,
        radius: 19,
        mass: 1.0,

        isHunter,
        isInitialHunter: isHunter,
        isEliminated: false,
        transformationProgress: isHunter ? 1.0 : 0.0,
        transformationTimer: 0,
        isInvulnerable: false,
        invulnerableTimer: 0,

        isStunned: false,
        stunTimer: 0,

        dashCooldown: 0,
        dashMaxCooldown: isHunter ? 5.5 : 4.5,
        dashActiveTimer: 0,
        isDashing: false,

        empCooldown: 0,
        empMaxCooldown: 10.0,
        empActiveTimer: 0,
        isBlastingEMP: false,

        isStealthed: false,
        isInSanctuary: false,
        sanctuaryId: null,
        stealthAlpha: 1.0,

        score: 0,
        survivalTime: 0,
        tagCount: 0,
        empStunCount: 0,
        sanctuaryTime: 0,
        dashesUsed: 0,

        tentaclePhases: [0.1, 1.2, 2.5, 3.8, 5.0],
        trailHistory: [],
      };
    });

    this.emitEvent({
      type: 'hunter_chosen',
      playerId: designatedHunterId,
      text: `${this.players[designatedHunterId]?.name || 'Hunter'} is designated VOID HUNTER!`,
    });
  }

  // --------------------------------------------------------------------------
  // TICK LOOP (PHYSICS, STATE MACHINE, ABILITIES, BOT AI)
  // --------------------------------------------------------------------------
  public tick(dt: number, inputs: Record<string, ControllerInput>): void {
    // Clamp delta time to avoid large physics steps on tab-switch
    const safeDt = Math.min(Math.max(0.001, dt), 0.05);

    // 1. Screen Shake & Screen Flash Decay
    this.updateScreenFX(safeDt);

    // 2. State Machine Transitions
    if (this.state === 'intro') {
      const prevInt = Math.ceil(this.introTimer);
      this.introTimer -= safeDt;
      const currInt = Math.ceil(this.introTimer);
      if (currInt < prevInt && currInt > 0) {
        soundManager.playCountdownBeep(false);
      }
      if (this.introTimer <= 0) {
        this.state = 'active';
        this.triggerInitialHunterAwakening();
      }
      return;
    }

    if (this.state === 'finished') {
      return;
    }

    // Update match time
    this.timeRemaining -= safeDt;

    // Check Sudden Death (last 20s or 1 survivor remaining)
    const survivors = Object.values(this.players).filter(p => !p.isHunter && !p.isEliminated);
    if (survivors.length === 1 && this.state !== 'sudden_death') {
      this.state = 'sudden_death';
      this.emitEvent({
        type: 'last_survivor',
        playerId: survivors[0].id,
        text: `LAST SURVIVOR: ${survivors[0].name}! SURVIVE!`,
      });
      soundManager.playCountdownBeep(true);
    } else if (this.timeRemaining <= 20 && this.state !== 'sudden_death') {
      this.state = 'sudden_death';
    }

    // Check Win/End Conditions
    if (survivors.length === 0 || this.timeRemaining <= 0) {
      this.finishMatch();
      return;
    }

    // Check Sole Hunter Elimination / Disconnection -> Immediately designate new Hunter
    this.checkHunterDesignation();

    // 3. Update Arena Elements (Sanctuaries, Nebulae, Debris, Radar)
    this.updateSanctuaries(safeDt);
    this.updateNebulae(safeDt);
    this.updateSpaceDebris(safeDt);
    this.updateRadar(safeDt);

    // 4. Process Inputs & Bot AI
    const combinedInputs: Record<string, ControllerInput> = {};
    for (const p of Object.values(this.players)) {
      if (p.isBot) {
        combinedInputs[p.id] = VoidTagBotAI.computeBotInput(
          p,
          this.players,
          this.sanctuaries,
          this.nebulae,
          this.debris,
          this.config,
          safeDt
        );
      } else {
        combinedInputs[p.id] = inputs[p.id] || {
          x: 0,
          y: 0,
          angle: p.angle,
          magnitude: 0,
          action1: false,
          action2: false,
          timestamp: Date.now(),
        };
      }
    }

    // 5. Update Player Physics & Abilities
    for (const p of Object.values(this.players)) {
      this.updatePlayer(p, combinedInputs[p.id], safeDt);
    }

    // 6. Collision Detection (Player-Player Tagging, Player-Debris Deflection)
    this.handleCollisions();

    // 7. Update Particles, Shockwaves, and Floating Texts
    this.updateParticles(safeDt);
    this.updateShockwaves(safeDt);
    this.updateFloatingTexts(safeDt);
  }

  // --------------------------------------------------------------------------
  // PLAYER TICK & ABILITIES
  // --------------------------------------------------------------------------
  private updatePlayer(p: VoidTagPlayerEntity, input: ControllerInput, dt: number): void {
    if (p.isEliminated) return;

    // A. Update Timers & Cooldowns
    if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    if (p.empCooldown > 0) p.empCooldown = Math.max(0, p.empCooldown - dt);
    if (p.invulnerableTimer > 0) {
      p.invulnerableTimer = Math.max(0, p.invulnerableTimer - dt);
      if (p.invulnerableTimer === 0) p.isInvulnerable = false;
    }
    if (p.stunTimer > 0) {
      p.stunTimer = Math.min(1.5, Math.max(0, p.stunTimer - dt));
      if (p.stunTimer === 0) p.isStunned = false;
    }

    // Transformation Animation Progress
    if (p.transformationTimer > 0) {
      p.transformationTimer -= dt;
      p.transformationProgress = Math.min(1.0, 1.0 - p.transformationTimer / 1.0);
    }

    // Survival Scoring (Survivors gain score per second survived)
    if (!p.isHunter) {
      p.survivalTime += dt;
      p.score += Math.round(dt * 10);

      // Open arena bonus
      if (!p.isInSanctuary) {
        p.score += Math.round(dt * 5);
      } else {
        p.sanctuaryTime += dt;
      }
    }

    // B. Handle Stun / Transformation Lock
    if (p.isStunned || p.transformationTimer > 0) {
      p.vx *= 0.85;
      p.vy *= 0.85;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.clampArenaBounds(p);
      return;
    }

    // C. Ability 1: Phase Dash (Blink teleport / high-velocity warp)
    if (input.action1 && p.dashCooldown <= 0) {
      this.triggerPhaseDash(p);
    }

    // D. Ability 2: EMP Shockwave Pulse (Survivors only)
    if (input.action2 && !p.isHunter && p.empCooldown <= 0) {
      this.triggerEMPShockwave(p);
    }

    // E. Movement Physics & Steering
    let speed = p.isHunter ? this.config.baseHunterSpeed : this.config.baseSurvivorSpeed;
    if (p.isBot) {
      const diff =
        this.config.difficulty === 'easy'
          ? 'easy'
          : this.config.difficulty === 'hard' || this.config.difficulty === 'extreme'
          ? 'hard'
          : 'medium';
      const botSpeedScale = diff === 'easy' ? 0.85 : diff === 'hard' ? 1.10 : 1.0;
      speed *= botSpeedScale;
    }
    if (p.isDashing) {
      speed += this.config.dashSpeedBonus;
      p.dashActiveTimer -= dt;
      if (p.dashActiveTimer <= 0) p.isDashing = false;
    }

    const inputMag = Math.min(1.0, Math.hypot(input.x, input.y));
    if (inputMag > 0.05) {
      const targetAngle = input.angle !== undefined ? input.angle : Math.atan2(input.y, input.x);
      p.targetAngle = targetAngle;
      p.angle = this.lerpAngle(p.angle, targetAngle, 0.2);

      const targetVx = Math.cos(targetAngle) * speed * inputMag;
      const targetVy = Math.sin(targetAngle) * speed * inputMag;

      p.vx += (targetVx - p.vx) * 0.25;
      p.vy += (targetVy - p.vy) * 0.25;
    } else {
      p.vx *= 0.88;
      p.vy *= 0.88;
    }

    // Integrate position
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    this.clampArenaBounds(p);

    // F. Stealth & Sanctuary State Check
    this.checkSanctuaryInclusion(p, dt);
    this.checkNebulaInclusion(p);

    // Smooth stealth opacity transition
    const targetAlpha = p.isStealthed ? 0.2 : 1.0;
    p.stealthAlpha += (targetAlpha - p.stealthAlpha) * 0.15;

    // G. Visual Trails & Hunter Tentacles
    this.updatePlayerVisuals(p, dt);
  }

  private triggerPhaseDash(p: VoidTagPlayerEntity): void {
    p.dashCooldown = p.dashMaxCooldown;
    p.isDashing = true;
    p.dashActiveTimer = 0.25;
    p.dashesUsed++;

    // Warp distance offset
    const warpDist = 175;
    const targetX = p.x + Math.cos(p.angle) * warpDist;
    const targetY = p.y + Math.sin(p.angle) * warpDist;

    // Create warp streak particles along dash trajectory
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.particles.push({
        x: p.x + (targetX - p.x) * t,
        y: p.y + (targetY - p.y) * t,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        life: 0.35,
        maxLife: 0.35,
        size: 5,
        color: p.isHunter ? '#FF007F' : '#00E5FF',
        alpha: 0.9,
        decay: 2.5,
        type: 'dash_line',
      });
    }

    p.x = targetX;
    p.y = targetY;
    this.clampArenaBounds(p);

    // Sound & FX
    soundManager.playBoost();
    this.emitEvent({
      type: 'dash_used',
      playerId: p.id,
      x: p.x,
      y: p.y,
    });
  }

  private triggerEMPShockwave(survivor: VoidTagPlayerEntity): void {
    survivor.empCooldown = survivor.empMaxCooldown;
    survivor.isBlastingEMP = true;
    survivor.empActiveTimer = 0.4;

    const empRadius = this.config.empRadius;

    // Spawn Shockwave Visual FX
    this.shockwaves.push({
      x: survivor.x,
      y: survivor.y,
      radius: 10,
      maxRadius: empRadius,
      life: 0.45,
      maxLife: 0.45,
      color: '#00E5FF',
      sourcePlayerId: survivor.id,
    });

    // Stun all hunters caught in blast
    let stunnedAny = false;
    for (const hunter of Object.values(this.players)) {
      if (hunter.isHunter && !hunter.isEliminated && !hunter.isInvulnerable) {
        const dist = Math.hypot(hunter.x - survivor.x, hunter.y - survivor.y);
        if (dist <= empRadius) {
          hunter.isStunned = true;
          // Stun duration clamp: ensure stuns do not stack indefinitely (clamp max duration to 1.5s)
          hunter.stunTimer = Math.min(1.5, (hunter.stunTimer > 0 ? hunter.stunTimer : 0) + this.config.empStunDuration);
          hunter.vx *= 0.1;
          hunter.vy *= 0.1;
          survivor.empStunCount++;
          survivor.score += 75; // Stun bounty

          stunnedAny = true;
          this.triggerScreenShake(6);

          this.floatingTexts.push({
            id: `stun_${Date.now()}_${hunter.id}`,
            x: hunter.x,
            y: hunter.y - 25,
            text: 'EMP STUNNED! +75',
            color: '#00E5FF',
            fontSize: 14,
            life: 1.2,
            maxLife: 1.2,
            vy: -30,
          });

          this.emitEvent({
            type: 'emp_stun',
            playerId: survivor.id,
            targetId: hunter.id,
            text: `${survivor.name} stunned ${hunter.name}!`,
          });
        }
      }
    }

    soundManager.playZap();
  }

  // --------------------------------------------------------------------------
  // COLLISION & CORRUPTION TAGGING
  // --------------------------------------------------------------------------
  private handleCollisions(): void {
    const playerList = Object.values(this.players).filter(p => !p.isEliminated);

    // 1. Player vs Player (Tagging / Corruption)
    for (let i = 0; i < playerList.length; i++) {
      const p1 = playerList[i];
      for (let j = i + 1; j < playerList.length; j++) {
        const p2 = playerList[j];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p1.radius + p2.radius;

        if (dist < minDist && dist > 0.001) {
          // Elastic separation push
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          p1.x -= nx * overlap * 0.5;
          p1.y -= ny * overlap * 0.5;
          p2.x += nx * overlap * 0.5;
          p2.y += ny * overlap * 0.5;

          // Check Hunter Tagging Survivor
          if (p1.isHunter && !p2.isHunter) {
            this.attemptTagSurvivor(p1, p2);
          } else if (!p1.isHunter && p2.isHunter) {
            this.attemptTagSurvivor(p2, p1);
          }
        }
      }
    }

    // 2. Player vs Space Debris (Elastic deflection)
    for (const p of playerList) {
      for (const deb of this.debris) {
        const dx = p.x - deb.x;
        const dy = p.y - deb.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p.radius + deb.radius;

        if (dist < minDist && dist > 0.001) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          p.x += nx * overlap;
          p.y += ny * overlap;

          // Bounce velocity
          const dot = p.vx * nx + p.vy * ny;
          if (dot < 0) {
            p.vx = (p.vx - 2 * dot * nx) * 0.6;
            p.vy = (p.vy - 2 * dot * ny) * 0.6;
          }
        }
      }
    }
  }

  private attemptTagSurvivor(hunter: VoidTagPlayerEntity, survivor: VoidTagPlayerEntity): void {
    // If hunter is stunned or in transformation grace period, cannot tag
    if (hunter.isStunned || hunter.transformationTimer > 0) return;

    // If survivor is inside an active sanctuary, sanctuary shields them!
    if (survivor.isInSanctuary && survivor.sanctuaryId !== null) {
      const sanc = this.sanctuaries.find(s => s.id === survivor.sanctuaryId);
      if (sanc && !sanc.isDepleted && sanc.energy > 0) {
        // Shield bounce impact
        soundManager.playHit();
        this.floatingTexts.push({
          id: `shield_${Date.now()}`,
          x: survivor.x,
          y: survivor.y - 20,
          text: 'SANCTUARY SHIELDED!',
          color: '#00F5A0',
          fontSize: 12,
          life: 0.8,
          maxLife: 0.8,
          vy: -25,
        });
        return;
      }
    }

    // If survivor has invulnerability grace, skip
    if (survivor.isInvulnerable) return;

    // CORRUPTION TAG SUCCESS!
    this.corruptSurvivor(hunter, survivor);
  }

  private corruptSurvivor(hunter: VoidTagPlayerEntity, victim: VoidTagPlayerEntity): void {
    hunter.tagCount++;
    hunter.score += 150; // Hunter bounty

    // Transform victim into Void Hunter
    victim.isHunter = true;
    victim.transformationTimer = 1.0;
    victim.transformationProgress = 0.0;
    victim.isInvulnerable = true;
    victim.invulnerableTimer = 1.5; // 1.5s grace invulnerability right after being tagged

    // Adjust ability cooldowns for hunter role
    victim.dashMaxCooldown = 5.5;
    victim.dashCooldown = 2.0;

    // Screen Shake & Dramatic Transformation Flash
    this.triggerScreenShake(14);
    this.triggerScreenFlash('rgba(157, 78, 221, 0.45)', 'VOID CORRUPTION!');

    // Purple & magenta shockwave FX
    this.createShockwave(victim.x, victim.y, 190, '#9D4EDD', 0.6);
    this.createShockwave(victim.x, victim.y, 100, '#FF007F', 0.4);

    // Audio Stinger
    soundManager.playHunterStinger();

    // Floating text
    this.floatingTexts.push({
      id: `corrupt_${Date.now()}_${victim.id}`,
      x: victim.x,
      y: victim.y - 30,
      text: 'TAGGED! +150',
      color: '#FF0055',
      fontSize: 16,
      life: 1.5,
      maxLife: 1.5,
      vy: -35,
    });

    // Particle burst of corruption
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const speed = 80 + Math.random() * 120;
      this.particles.push({
        x: victim.x,
        y: victim.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.8,
        maxLife: 0.8,
        size: 6,
        color: '#FF007F',
        alpha: 1.0,
        decay: 1.25,
        type: 'corruption',
      });
    }

    this.emitEvent({
      type: 'player_tagged',
      playerId: hunter.id,
      targetId: victim.id,
      text: `${hunter.name} tagged and corrupted ${victim.name}!`,
    });
  }

  private triggerInitialHunterAwakening(): void {
    if (!this.initialHunterId || !this.players[this.initialHunterId]) return;
    const hunter = this.players[this.initialHunterId];

    this.triggerScreenShake(10);
    this.triggerScreenFlash('rgba(157, 78, 221, 0.4)', 'HUNT BEGINS!');
    soundManager.playHunterStinger();

    this.floatingTexts.push({
      id: `hunt_start_${Date.now()}`,
      x: hunter.x,
      y: hunter.y - 35,
      text: 'VOID HUNTER AWAKENED!',
      color: '#FF0055',
      fontSize: 16,
      life: 2.0,
      maxLife: 2.0,
      vy: -20,
    });
  }

  // --------------------------------------------------------------------------
  // HUNTER DESIGNATION / RE-DESIGNATION ON ELIMINATION OR DISCONNECT
  // --------------------------------------------------------------------------
  public checkHunterDesignation(): void {
    if (this.state !== 'active' && this.state !== 'sudden_death') return;

    const activeHunters = Object.values(this.players).filter(p => p.isHunter && !p.isEliminated);
    const activeSurvivors = Object.values(this.players).filter(p => !p.isHunter && !p.isEliminated);

    if (activeHunters.length === 0 && activeSurvivors.length > 0) {
      // Sole hunter is eliminated or disconnected: immediately and authoritatively designate new hunter
      // Pick the first active survivor (or highest score)
      const designatedSurvivor = activeSurvivors.sort((a, b) => b.score - a.score)[0];
      this.designateHunter(designatedSurvivor, `Hunter departed! ${designatedSurvivor.name} is designated NEW VOID HUNTER!`);
    }
  }

  public designateHunter(survivor: VoidTagPlayerEntity, announcementText?: string): void {
    survivor.isHunter = true;
    survivor.transformationTimer = 1.0;
    survivor.transformationProgress = 0.0;
    survivor.isInvulnerable = true;
    survivor.invulnerableTimer = 1.5;
    survivor.isStunned = false;
    survivor.stunTimer = 0;
    survivor.isInSanctuary = false;
    survivor.sanctuaryId = null;
    survivor.dashMaxCooldown = 5.5;
    survivor.dashCooldown = 2.0;

    this.triggerScreenShake(12);
    this.triggerScreenFlash('rgba(157, 78, 221, 0.45)', 'NEW VOID HUNTER!');
    soundManager.playHunterStinger();

    this.createShockwave(survivor.x, survivor.y, 190, '#9D4EDD', 0.6);
    this.createShockwave(survivor.x, survivor.y, 100, '#FF007F', 0.4);

    this.floatingTexts.push({
      id: `new_hunter_${Date.now()}_${survivor.id}`,
      x: survivor.x,
      y: survivor.y - 35,
      text: 'VOID HUNTER AWAKENED!',
      color: '#FF0055',
      fontSize: 16,
      life: 2.0,
      maxLife: 2.0,
      vy: -25,
    });

    this.emitEvent({
      type: 'hunter_chosen',
      playerId: survivor.id,
      text: announcementText || `${survivor.name} is designated NEW VOID HUNTER!`,
    });
  }

  // --------------------------------------------------------------------------
  // SANCTUARIES & NEBULAE STATE UPDATE
  // --------------------------------------------------------------------------
  private updateSanctuaries(dt: number): void {
    for (const sanc of this.sanctuaries) {
      sanc.rotationAngle += 0.25 * dt;

      // Count uninfected survivors inside this sanctuary
      const survivorsInside = Object.values(this.players).filter(
        p => !p.isHunter && !p.isEliminated && p.isInSanctuary && p.sanctuaryId === sanc.id
      );

      if (survivorsInside.length > 0 && !sanc.isDepleted) {
        // Drain sanctuary energy proportionally to occupant count
        sanc.energy = Math.max(0, sanc.energy - sanc.drainRate * survivorsInside.length * dt);

        if (sanc.energy <= 0) {
          sanc.energy = 0;
          sanc.isDepleted = true;

          // Collapse shield immediately for all occupants
          for (const p of survivorsInside) {
            p.isInSanctuary = false;
            p.sanctuaryId = null;
          }

          this.emitEvent({
            type: 'sanctuary_depleted',
            text: `Sanctuary #${sanc.id} energy depleted! Shield collapsed!`,
            x: sanc.x,
            y: sanc.y,
          });

          this.floatingTexts.push({
            id: `depleted_${sanc.id}_${Date.now()}`,
            x: sanc.x,
            y: sanc.y,
            text: 'SANCTUARY DRAINED!',
            color: '#FF3366',
            fontSize: 13,
            life: 1.2,
            maxLife: 1.2,
            vy: -20,
          });
        }
      } else if (survivorsInside.length === 0 && sanc.energy < sanc.maxEnergy) {
        // Slow recharge when unoccupied
        sanc.energy = Math.min(sanc.maxEnergy, sanc.energy + sanc.rechargeRate * dt);
        if (sanc.energy >= 20 && sanc.isDepleted) {
          sanc.isDepleted = false;
        }
      }
    }
  }

  private checkSanctuaryInclusion(p: VoidTagPlayerEntity, dt: number): void {
    p.isInSanctuary = false;
    p.sanctuaryId = null;

    if (p.isHunter) return; // Hunters don't gain sanctuary status

    for (const sanc of this.sanctuaries) {
      if (sanc.isDepleted || sanc.energy <= 0) continue; // Depleted sanctuary shield is collapsed

      const dist = Math.hypot(p.x - sanc.x, p.y - sanc.y);
      if (dist <= sanc.radius) {
        p.isInSanctuary = true;
        p.sanctuaryId = sanc.id;
        break;
      }
    }
  }

  private updateNebulae(dt: number): void {
    for (const neb of this.nebulae) {
      neb.pulsePhase += 0.5 * dt;
    }
  }

  private checkNebulaInclusion(p: VoidTagPlayerEntity): void {
    p.isStealthed = false;
    for (const neb of this.nebulae) {
      const dist = Math.hypot(p.x - neb.x, p.y - neb.y);
      if (dist <= neb.radius) {
        p.isStealthed = true;
        break;
      }
    }
  }

  private updateSpaceDebris(dt: number): void {
    const w = this.config.arenaWidth;
    const h = this.config.arenaHeight;

    for (const deb of this.debris) {
      deb.rotation += deb.rotSpeed * dt;
      deb.x += deb.vx * dt;
      deb.y += deb.vy * dt;

      // Soft boundary bounce
      if (deb.x < deb.radius || deb.x > w - deb.radius) {
        deb.vx *= -1;
        deb.x = Math.max(deb.radius, Math.min(w - deb.radius, deb.x));
      }
      if (deb.y < deb.radius || deb.y > h - deb.radius) {
        deb.vy *= -1;
        deb.y = Math.max(deb.radius, Math.min(h - deb.radius, deb.y));
      }
    }
  }

  private updateRadar(dt: number): void {
    this.radarTimer += dt;
    if (this.radarTimer >= 4.0) {
      this.radarTimer = 0;
      this.radarPulseRadius = 10;
    }

    if (this.radarPulseRadius > 0) {
      this.radarPulseRadius += 450 * dt;
      if (this.radarPulseRadius > 1400) {
        this.radarPulseRadius = 0;
      }
    }
  }

  private updatePlayerVisuals(p: VoidTagPlayerEntity, dt: number): void {
    // Add position to trail history
    p.trailHistory.unshift({ x: p.x, y: p.y, alpha: 1.0, angle: p.angle });
    if (p.trailHistory.length > 8) p.trailHistory.pop();

    for (const pt of p.trailHistory) {
      pt.alpha -= dt * 3.5;
    }

    // Hunter void wisp particles
    if (p.isHunter && Math.random() < 0.4) {
      this.particles.push({
        x: p.x + (Math.random() - 0.5) * p.radius * 1.5,
        y: p.y + (Math.random() - 0.5) * p.radius * 1.5,
        vx: (Math.random() - 0.5) * 20,
        vy: -20 - Math.random() * 30,
        life: 0.6,
        maxLife: 0.6,
        size: 3.5,
        color: '#9D4EDD',
        alpha: 0.8,
        decay: 1.4,
        type: 'void_wisp',
      });
    }
  }

  // --------------------------------------------------------------------------
  // PARTICLES, SHOCKWAVES & COMBAT TEXT UPDATES
  // --------------------------------------------------------------------------
  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.alpha -= pt.decay * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;

      if (pt.life <= 0 || pt.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private updateShockwaves(dt: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      const progress = 1.0 - sw.life / sw.maxLife;
      sw.radius = sw.maxRadius * progress;

      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }
  }

  private updateFloatingTexts(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y += ft.vy * dt;

      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private updateScreenFX(dt: number): void {
    if (this.screenShake.intensity > 0.05) {
      this.screenShake.intensity *= 0.9;
      this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity;
      this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity;
    } else {
      this.screenShake.intensity = 0;
      this.screenShake.x = 0;
      this.screenShake.y = 0;
    }

    if (this.screenFlash.alpha > 0.01) {
      this.screenFlash.alpha -= dt * 1.5;
    } else {
      this.screenFlash.alpha = 0;
      this.screenFlash.text = undefined;
    }
  }

  private triggerScreenShake(intensity: number): void {
    this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity);
  }

  private triggerScreenFlash(color: string, text?: string): void {
    this.screenFlash = { color, alpha: 0.8, text };
  }

  // --------------------------------------------------------------------------
  // MATCH COMPLETION & RESULTS
  // --------------------------------------------------------------------------
  private finishMatch(): void {
    this.state = 'finished';
    soundManager.playVictoryFanfare();

    this.emitEvent({
      type: 'game_over',
      text: 'MATCH CONCLUDED!',
    });
  }

  public static comparePlayers(a: VoidTagPlayerEntity, b: VoidTagPlayerEntity): number {
    if (a.isEliminated && !b.isEliminated) return 1;
    if (!a.isEliminated && b.isEliminated) return -1;
    if (!a.isHunter && b.isHunter) return -1;
    if (a.isHunter && !b.isHunter) return 1;
    return b.score - a.score;
  }

  public getResults(): MatchResults {
    const playerList = Object.values(this.players);
    playerList.sort(VoidTagEngine.comparePlayers);

    const winner = playerList[0] || {
      id: 'p1',
      name: 'Player',
      avatar: 'ship',
      color: '#00F5A0',
    };

    const rankings = playerList.map((p, idx) => {
      const roleStr = p.isHunter ? `Hunter (${p.tagCount} Tags)` : `Survivor (${Math.round(p.survivalTime)}s Survived)`;
      return {
        id: p.id,
        name: p.name,
        score: p.score,
        rank: idx + 1,
        avatar: p.avatar,
        color: p.color,
        isBot: p.isBot,
        statSummary: `${roleStr} • EMP Stuns: ${p.empStunCount}`,
      };
    });

    // Determine MVP
    let mvpText = `${winner.name} - Apex Survivor`;
    const topTagger = [...playerList].sort((a, b) => b.tagCount - a.tagCount)[0];
    if (topTagger && topTagger.tagCount >= 2) {
      mvpText = `Corrupter MVP: ${topTagger.name} with ${topTagger.tagCount} tags!`;
    }

    return {
      gameId: 'void-tag',
      winnerId: winner.id,
      winnerName: winner.name,
      winnerAvatar: winner.avatar,
      winnerColor: winner.color,
      rankings,
      durationSeconds: Math.round(this.totalMatchDuration - this.timeRemaining),
      mvpStat: mvpText,
    };
  }

  // --------------------------------------------------------------------------
  // HUD STATE GENERATION
  // --------------------------------------------------------------------------
  public getPlayerHUDState(playerId: string): PlayerClientHUDState {
    const p = this.players[playerId];
    const playerList = Object.values(this.players).sort(VoidTagEngine.comparePlayers);
    const rank = playerList.findIndex(item => item.id === playerId) + 1;
    const totalPlayers = playerList.length;

    if (!p) {
      return {
        playerId,
        rank: 1,
        totalPlayers,
        score: 0,
        status: 'survivor',
        action1Cooldown: 0,
        action2Cooldown: 0,
        customStatName: 'TIME LEFT',
        customStatValue: `${Math.ceil(this.timeRemaining)}s`,
      };
    }

    const action1Cooldown = p.dashCooldown / p.dashMaxCooldown;
    const action2Cooldown = p.empCooldown / p.empMaxCooldown;

    let statusStr: 'hunter' | 'survivor' | 'eliminated' | 'winner' = p.isHunter ? 'hunter' : 'survivor';
    if (p.isEliminated) {
      statusStr = 'eliminated';
    } else if (this.state === 'finished' && rank === 1) {
      statusStr = 'winner';
    }

    const customStatName = p.isHunter ? 'CORRUPTIONS' : 'SURVIVAL';
    const customStatValue = p.isHunter ? `${p.tagCount} Tags` : `${Math.floor(p.survivalTime)}s`;

    return {
      playerId,
      rank,
      totalPlayers,
      score: p.score,
      status: statusStr,
      action1Cooldown: Math.max(0, Math.min(1, action1Cooldown)),
      action2Cooldown: Math.max(0, Math.min(1, action2Cooldown)),
      customStatName,
      customStatValue,
      message: p.isStunned ? `STUNNED (${p.stunTimer.toFixed(1)}s)` : p.isStealthed ? 'STEALTHED' : undefined,
    };
  }

  // --------------------------------------------------------------------------
  // EXPORTED VOID TAG STATE (FOR MULTIPLAYER / NETWORK SYNC)
  // --------------------------------------------------------------------------
  public getState(): VoidTagState {
    const hunters: string[] = [];
    const survivors: string[] = [];
    const playerRecord: VoidTagState['players'] = {};

    for (const p of Object.values(this.players)) {
      if (p.isHunter) {
        hunters.push(p.id);
      } else {
        survivors.push(p.id);
      }

      playerRecord[p.id] = {
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        isHunter: p.isHunter,
        isEliminated: p.isEliminated,
        dashCooldown: p.dashCooldown,
        empCooldown: p.empCooldown,
        isStealthed: p.isStealthed,
        survivalTime: p.survivalTime,
      };
    }

    return {
      hunters,
      survivors,
      sanctuaries: this.sanctuaries.map(s => ({
        id: s.id,
        x: s.x,
        y: s.y,
        radius: s.radius,
        energy: s.energy,
        maxEnergy: s.maxEnergy,
      })),
      nebulae: this.nebulae.map(n => ({
        x: n.x,
        y: n.y,
        radius: n.radius,
      })),
      players: playerRecord,
    };
  }

  // --------------------------------------------------------------------------
  // RENDER DELEGATION
  // --------------------------------------------------------------------------
  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.renderer.render(
      ctx,
      width,
      height,
      this.players,
      this.sanctuaries,
      this.nebulae,
      this.debris,
      this.particles,
      this.shockwaves,
      this.floatingTexts,
      this.screenShake,
      this.screenFlash,
      this.radarPulseRadius,
      this.timeRemaining,
      this.state,
      this.localPlayerId,
      this.config,
      this.introTimer
    );
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------
  private clampArenaBounds(p: VoidTagPlayerEntity): void {
    const margin = p.radius + 2;
    p.x = Math.max(margin, Math.min(this.config.arenaWidth - margin, p.x));
    p.y = Math.max(margin, Math.min(this.config.arenaHeight - margin, p.y));
  }

  private lerpAngle(current: number, target: number, speed: number): number {
    let diff = target - current;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return current + diff * speed;
  }

  private emitEvent(event: Parameters<VoidTagEventCallback>[0]): void {
    if (this.onEventCallback) {
      this.onEventCallback(event);
    }
  }

  // --------------------------------------------------------------------------
  // DEV / QA SPECIALIST API
  // --------------------------------------------------------------------------

  public spawnBot(archetype?: 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic', name?: string, color?: string): string {
    const archetypes: Array<'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic'> = [
      'aggressive', 'defensive', 'collector', 'ambusher', 'chaotic'
    ];
    const chosenArchetype = archetype || archetypes[Math.floor(Math.random() * archetypes.length)];
    const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const botColors = ['#FF3366', '#FFB224', '#00E5FF', '#9D4EDD', '#00F5A0', '#FF7700'];
    const botColor = color || botColors[Math.floor(Math.random() * botColors.length)];
    const botName = name || `[AI] VOID_${chosenArchetype.toUpperCase()}`;

    const centerX = this.config.arenaWidth * 0.5;
    const centerY = this.config.arenaHeight * 0.5;
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = 200 + Math.random() * 200;

    const botEntity: VoidTagPlayerEntity = {
      id: botId,
      name: botName,
      color: botColor,
      avatar: 'robot',
      isBot: true,
      botArchetype: chosenArchetype,
      x: centerX + Math.cos(angle) * spawnDist,
      y: centerY + Math.sin(angle) * spawnDist,
      vx: 0,
      vy: 0,
      angle,
      targetAngle: angle,
      radius: 19,
      mass: 1.0,
      isHunter: false,
      isInitialHunter: false,
      isEliminated: false,
      transformationProgress: 0.0,
      transformationTimer: 0,
      isInvulnerable: false,
      invulnerableTimer: 0,
      isStunned: false,
      stunTimer: 0,
      dashCooldown: 0,
      dashMaxCooldown: 4.5,
      dashActiveTimer: 0,
      isDashing: false,
      empCooldown: 0,
      empMaxCooldown: 10.0,
      empActiveTimer: 0,
      isBlastingEMP: false,
      isStealthed: false,
      isInSanctuary: false,
      sanctuaryId: null,
      stealthAlpha: 1.0,
      score: 0,
      survivalTime: 0,
      tagCount: 0,
      empStunCount: 0,
      sanctuaryTime: 0,
      dashesUsed: 0,
      tentaclePhases: [0.1, 1.2, 2.5, 3.8, 5.0],
      trailHistory: [],
    };

    this.players[botId] = botEntity;
    this.createShockwave(botEntity.x, botEntity.y, 80, botColor, 0.4);
    return botId;
  }

  public forceEliminate(playerId: string): void {
    const player = this.players[playerId];
    if (player && !player.isEliminated) {
      const wasHunter = player.isHunter;
      player.isEliminated = true;
      player.isHunter = false;
      player.isStunned = true;
      this.createShockwave(player.x, player.y, 160, '#FF3366', 0.8);
      soundManager.playElimination();

      if (wasHunter) {
        this.checkHunterDesignation();
      }
    }
  }

  public forceWin(playerId: string): void {
    const player = this.players[playerId];
    if (player) {
      // Mark all others eliminated
      for (const pid in this.players) {
        if (pid !== playerId) {
          this.players[pid].isEliminated = true;
        }
      }
      player.isEliminated = false;
      player.isHunter = false;
      player.score += 500;
      this.finishMatch();
      soundManager.playVictoryFanfare();
    }
  }

  public triggerEvent(type: 'solar_flare' | 'emp_storm' | 'blackout' = 'solar_flare'): void {
    if (type === 'solar_flare') {
      // Solar Flare: Reveals all players, drains all sanctuaries, produces bright screen flash & cosmic shockwave
      this.screenFlash = { color: '#FFB224', alpha: 0.85, text: '☀️ SOLAR FLARE BURST DETECTED! ☀️' };
      this.screenShake = { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20, intensity: 22 };
      for (const s of this.sanctuaries) {
        s.energy = 0;
        s.isDepleted = true;
      }
      for (const p of Object.values(this.players)) {
        p.isStealthed = false;
        p.stealthAlpha = 1.0;
      }
      this.createShockwave(this.config.arenaWidth / 2, this.config.arenaHeight / 2, 800, '#FFB224', 1.2);
      soundManager.playHunterStinger();
      this.emitEvent({
        type: 'last_survivor',
        text: '☀️ SOLAR FLARE: ALL SANCTUARIES DRAINED & STEALTH PIERCED!',
      });
    } else {
      // EMP Storm
      for (const p of Object.values(this.players)) {
        if (p.isHunter) {
          p.isStunned = true;
          p.stunTimer = 1.5;
        }
      }
      this.screenFlash = { color: '#00E5FF', alpha: 0.7, text: '⚡ EMP STORM ENGAGED!' };
      soundManager.playZap();
    }
  }

  public setModifiers(modifiers: Partial<{ turboSpeed: boolean; doubleGrowthOrScore: boolean; lowGravity: boolean; chaosMode: boolean }>): void {
    if (modifiers.turboSpeed) {
      this.config.baseSurvivorSpeed = 440;
      this.config.baseHunterSpeed = 510;
    } else {
      this.config.baseSurvivorSpeed = 285;
      this.config.baseHunterSpeed = 335;
    }

    if (modifiers.chaosMode) {
      this.config.baseSurvivorSpeed = 500;
      this.config.baseHunterSpeed = 580;
      for (const p of Object.values(this.players)) {
        p.dashMaxCooldown = 1.0;
        p.empMaxCooldown = 2.0;
      }
    }
  }

  public setPlayerConnected(playerId: string, connected: boolean): void {
    const player = this.players[playerId];
    if (player) {
      if (!connected) {
        player.isStunned = true;
        player.stunTimer = 999;
        if (player.isHunter) {
          player.isEliminated = true;
          player.isHunter = false;
          this.checkHunterDesignation();
        }
      } else {
        player.isStunned = false;
        player.stunTimer = 0;
      }
    }
  }

  private createShockwave(x: number, y: number, maxRadius: number, color: string, duration: number = 0.6): void {
    this.shockwaves.push({
      x,
      y,
      radius: 10,
      maxRadius,
      color,
      life: duration,
      maxLife: duration,
      sourcePlayerId: 'system',
    });
  }
}
