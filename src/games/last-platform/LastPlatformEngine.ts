import {
  RoomState,
  Player,
  ControllerInput,
  PlayerClientHUDState,
  MatchResults,
  GameEventPayload,
  LastPlatformState,
} from '../../types';
import {
  PlayerPhysicsState,
  LastPlatformConfig,
  Point2D,
  ElectricFreezeProjectile,
} from './types';
import { HexGrid } from './HexGrid';
import { ParticleSystem } from './ParticleSystem';
import { LastPlatformRenderer } from './LastPlatformRenderer';
import { BotAI } from './BotAI';
import { soundManager } from '../../audio/SoundManager';

const DEFAULT_CONFIG: LastPlatformConfig = {
  gridRadius: 5, // 91 hex tiles
  tileSize: 46,
  tileHeight: 20,
  roundDuration: 75,
  suddenDeathThreshold: 25,
  playerMoveSpeed: 240,
  playerJumpForce: 360,
  playerAirHopForce: 280,
  playerDashForce: 380,
  gravity: 750,
  shockwaveRadius: 210,
  shockwaveForce: 680,
  shockwaveCooldown: 3.8,
  dashCooldown: 2.2,
  warningDuration: 1.5,    // Was 3.2 — much faster tile breaking
  crumblingDuration: 1.0,  // Was 2.2 — tiles collapse faster
  movingPlatformsCount: 3,
};

export class LastPlatformEngine {
  public roomState: RoomState;
  public config: LastPlatformConfig;
  public onGameEvent?: (event: GameEventPayload) => void;

  // Submodules
  public hexGrid: HexGrid;
  public particles: ParticleSystem;
  public renderer: LastPlatformRenderer;
  public bots: Map<string, BotAI> = new Map();

  // Match State
  public players: Record<string, PlayerPhysicsState> = {};
  public timeRemaining: number;
  public elapsedTime: number = 0;
  public isSuddenDeath: boolean = false;
  public suddenDeathTriggered: boolean = false;
  public isGameOver: boolean = false;
  public eliminationOrder: string[] = []; // First eliminated -> last eliminated

  // Electric Freeze Projectiles
  public projectiles: ElectricFreezeProjectile[] = [];

  // Jump & Shoot input edge-trigger tracking
  private prevAction1: Record<string, boolean> = {};
  private prevAction2: Record<string, boolean> = {};

  constructor(roomState: RoomState, onGameEvent?: (event: GameEventPayload) => void, customConfig?: Partial<LastPlatformConfig>) {
    this.roomState = roomState;
    this.onGameEvent = onGameEvent;
    this.config = { ...DEFAULT_CONFIG, ...customConfig };
    if (roomState.config?.roundDuration) {
      this.config.roundDuration = roomState.config.roundDuration;
    }

    this.timeRemaining = this.config.roundDuration;
    this.hexGrid = new HexGrid(this.config);
    this.particles = new ParticleSystem();
    this.renderer = new LastPlatformRenderer();

    this.initPlayers();
  }

  /**
   * Initializes player physics entities and bot AI instances.
   */
  private initPlayers(): void {
    this.players = {};
    this.bots.clear();
    this.eliminationOrder = [];

    const playerList = Object.values(this.roomState.players);
    const count = playerList.length;
    const spawnRadius = this.config.tileSize * (this.config.gridRadius - 1.5) * 0.75;

    playerList.forEach((p, index) => {
      // Spawn players distributed in a ring on safe inner platform tiles
      const angle = (index * 2 * Math.PI) / Math.max(1, count);
      const rawX = count === 1 ? 0 : Math.cos(angle) * spawnRadius;
      const rawY = count === 1 ? 0 : Math.sin(angle) * spawnRadius;

      // Snap spawn to guaranteed stable hex tile
      const safeTile = this.hexGrid.getTileAt(rawX, rawY) || this.hexGrid.getClosestSafeTile(rawX, rawY);
      const spawnX = safeTile ? safeTile.worldX : rawX;
      const spawnY = safeTile ? safeTile.worldY : rawY;
      const tileId = safeTile ? safeTile.id : null;

      const playerState: PlayerPhysicsState = {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        color: p.color || '#00F5A0',
        skin: p.skin,
        isBot: !!p.isBot,
        botArchetype: p.botArchetype || 'aggressive',

        x: spawnX,
        y: spawnY,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,

        facingAngle: angle + Math.PI, // Face towards center
        moveMagnitude: 0,
        isGrounded: true,
        isAirborne: false,
        isFallingIntoVoid: false,
        fallTumbleAngle: 0,
        fallTumbleSpeed: 0,

        canJump: true,
        jumpsRemaining: 2,
        maxJumps: 2,
        jumpCooldownTimer: 0,

        canDash: true,
        dashCooldown: 0,
        dashCooldownMax: this.config.dashCooldown,
        isDashing: false,
        dashDuration: 0,
        dashVector: { x: 0, y: 0 },

        shockwaveCooldown: 0.5, // Brief initial cooldown
        shockwaveCooldownMax: this.config.shockwaveCooldown,
        isShockwaving: false,
        shockwaveAnimTimer: 0,

        freezeShotCooldown: 0,
        freezeShotCooldownMax: 7.0, // 7-second cooldown
        isFrozen: false,
        freezeTimer: 0,

        isEliminated: false,
        eliminateTime: 0,
        placementRank: 1,
        score: 0,
        kills: 0,
        shovesLanded: 0,
        airHopsUsed: 0,
        timeSurvived: 0,

        currentTileId: tileId,
        lastSafeTileId: tileId,
        lastSafeX: spawnX,
        lastSafeY: spawnY,

        trail: [],
        hitFlashTimer: 0,
        scale: 1.0,
        opacity: 1.0,
      };

      this.players[p.id] = playerState;

      // Register Bot AI if player is a bot
      if (p.isBot) {
        this.bots.set(p.id, new BotAI(p.id, p.botArchetype, this.config));
      }
    });
  }

  /**
   * Main game loop tick called at 60 FPS.
   */
  public tick(dt: number, inputs: Record<string, ControllerInput> = {}): void {
    // 1. Authoritative freeze when match is over
    if (this.isGameOver) return;

    // Clamp dt to avoid physics exploding on frame lag
    const clampedDt = Math.min(0.05, dt);
    this.elapsedTime += clampedDt;
    this.timeRemaining = Math.max(0, this.timeRemaining - clampedDt);

    // 2. Check Sudden Death Trigger (time expired threshold or final 2 players in >2 player match)
    const alivePlayers = Object.values(this.players).filter((p) => !p.isEliminated && !p.isFallingIntoVoid);
    if (
      (!this.isSuddenDeath && this.timeRemaining <= this.config.suddenDeathThreshold) ||
      (!this.isSuddenDeath && alivePlayers.length === 2 && Object.keys(this.players).length > 2)
    ) {
      this.triggerSuddenDeath();
    }

    // 3. Update HexGrid Matrix (States, Danger Perimeter, Moving Platforms)
    const matchProgress = 1.0 - this.timeRemaining / this.config.roundDuration;
    this.hexGrid.update(clampedDt, matchProgress, this.isSuddenDeath);

    // 4. Update Bot AI Inputs
    const combinedInputs: Record<string, ControllerInput> = { ...inputs };
    for (const [botId, botAI] of this.bots.entries()) {
      const botPlayer = this.players[botId];
      if (botPlayer && !botPlayer.isEliminated && !botPlayer.isFallingIntoVoid) {
        combinedInputs[botId] = botAI.update(clampedDt, botPlayer, this.players, this.hexGrid);
      }
    }

    // 5. Update Player Physics & Abilities
    for (const pid in this.players) {
      const p = this.players[pid];
      if (p.isEliminated) continue;

      const input = combinedInputs[pid] || this.createDefaultInput();
      this.updatePlayerPhysics(p, input, clampedDt);
    }

    // 6. Update Electric Freeze Projectiles (7s Cooldown ability)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.x += proj.vx * clampedDt;
      proj.y += proj.vy * clampedDt;
      proj.lifetime -= clampedDt;

      // Check collision against other living players
      let hit = false;
      for (const pid in this.players) {
        const target = this.players[pid];
        if (target.id === proj.shooterId || target.isEliminated || target.isFallingIntoVoid) continue;

        const dist = Math.hypot(target.x - proj.x, target.y - proj.y);
        if (dist < 32 && target.z < 25) {
          hit = true;
          target.isFrozen = true;
          target.freezeTimer = 2.0; // 2-second freeze
          target.vx = 0;
          target.vy = 0;
          target.hitFlashTimer = 0.5;

          const shooter = this.players[proj.shooterId];
          if (shooter) {
            shooter.score += 150;
            shooter.shovesLanded += 1;
          }

          this.particles.addFloatingText(target.x, target.y, target.z + 40, '⚡ FROZEN (2s)! ⚡', '#00E5FF', 20);
          this.particles.emitShockwave('system', target.x, target.y, '#00E5FF', 90);
          this.particles.emitEliminationBurst(target.x, target.y, '#00E5FF');
          soundManager.playZap();

          // Radial splash shockwave shove knocking other nearby opponents away
          for (const otherId in this.players) {
            if (otherId === target.id) continue;
            const other = this.players[otherId];
            if (other.isEliminated || other.isFallingIntoVoid) continue;
            const blastDist = Math.hypot(other.x - target.x, other.y - target.y);
            if (blastDist < 110 && blastDist > 0.01) {
              const blastDirX = (other.x - target.x) / blastDist;
              const blastDirY = (other.y - target.y) / blastDist;
              other.vx += blastDirX * 380;
              other.vy += blastDirY * 380;
              other.vz = Math.max(other.vz, 120);
              other.isGrounded = false;
              other.isAirborne = true;
              other.hitFlashTimer = 0.25;
              this.particles.addFloatingText(other.x, other.y, other.z + 20, 'SHOCKED!', '#00E5FF', 13);
            }
          }

          // Trigger local haptic event
          if (this.onGameEvent) {
            this.onGameEvent({
              type: 'haptic',
              targetPlayerId: target.id,
              payload: { intensity: 'heavy', duration: 200 },
            });
          }
          break;
        }
      }

      if (hit || proj.lifetime <= 0) {
        this.projectiles.splice(i, 1);
      }
    }

    // 6.5. Player-to-Player Kinetic Collision & Air-Dash Shoving Resolution
    const livingPlayers = Object.values(this.players).filter((p) => !p.isEliminated && !p.isFallingIntoVoid);
    for (let i = 0; i < livingPlayers.length; i++) {
      for (let j = i + 1; j < livingPlayers.length; j++) {
        const p1 = livingPlayers[i];
        const p2 = livingPlayers[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 28;

        if (dist < minDist && Math.abs(p1.z - p2.z) < 22) {
          const overlap = (minDist - dist) * 0.5;
          const nx = dist > 0.001 ? dx / dist : 1;
          const ny = dist > 0.001 ? dy / dist : 0;

          p1.x -= nx * overlap;
          p1.y -= ny * overlap;
          p2.x += nx * overlap;
          p2.y += ny * overlap;

          // If one player was air-dashing into another, perform a heavy Kinetic Shove!
          if (p1.isDashing && !p2.isDashing) {
            p2.vx += nx * 460;
            p2.vy += ny * 460;
            p2.vz = Math.max(p2.vz, 160);
            p2.isGrounded = false;
            p2.isAirborne = true;
            p2.hitFlashTimer = 0.3;
            p1.shovesLanded++;
            p1.score += 60;
            this.particles.emitShockwave(p1.id, p2.x, p2.y, p1.color, 85);
            this.particles.addFloatingText(p2.x, p2.y, p2.z + 20, 'DASH SHOVE!', '#FFB224', 14);
            soundManager.playHit();
          } else if (p2.isDashing && !p1.isDashing) {
            p1.vx -= nx * 460;
            p1.vy -= ny * 460;
            p1.vz = Math.max(p1.vz, 160);
            p1.isGrounded = false;
            p1.isAirborne = true;
            p1.hitFlashTimer = 0.3;
            p2.shovesLanded++;
            p2.score += 60;
            this.particles.emitShockwave(p2.id, p1.x, p1.y, p2.color, 85);
            this.particles.addFloatingText(p1.x, p1.y, p1.z + 20, 'DASH SHOVE!', '#FFB224', 14);
            soundManager.playHit();
          }
        }
      }
    }

    // 7. Process Simultaneous Eliminations with Tie-Breaking
    this.processPendingEliminations();

    // 8. Update Particle Systems & Screen Trauma
    this.particles.update(clampedDt);

    // 9. Check Match End Conditions (authoritative single survivor standing on solid tile)
    this.checkMatchEnd();
  }

  /**
   * Updates an individual player's movement, jumps, air-dashes, shockwave abilities, and void fall.
   */
  private updatePlayerPhysics(p: PlayerPhysicsState, input: ControllerInput, dt: number): void {
    if (!p.isEliminated && !p.isFallingIntoVoid) {
      p.timeSurvived += dt;
    }

    // Decay cooldown timers
    if (p.hitFlashTimer > 0) p.hitFlashTimer -= dt;
    if (p.jumpCooldownTimer > 0) p.jumpCooldownTimer -= dt;
    if (p.dashCooldown > 0) p.dashCooldown -= dt;
    if (p.shockwaveCooldown > 0) p.shockwaveCooldown -= dt;
    if (p.freezeShotCooldown > 0) p.freezeShotCooldown -= dt;

    // --- A. VOID FALL & COSMIC PLUNGE STATE --- //
    // Once falling into the void, inputs are locked
    if (p.isFallingIntoVoid) {
      p.vz -= 850 * dt; // Void gravitational plunge
      p.z += p.vz * dt;
      p.fallTumbleAngle += p.fallTumbleSpeed * dt;

      // Scale & opacity decay
      const fallDepth = Math.abs(p.z);
      p.scale = Math.max(0.1, 1.0 - fallDepth / 150);
      p.opacity = Math.max(0, 1.0 - fallDepth / 200);

      // Trailing cosmic vortex sparks
      this.particles.emitVoidVortexSparks(p.x, p.y, p.z, p.color);
      return;
    }

    // --- B. ELECTRIC FROZEN STUN STATE (2 Seconds Freeze) --- //
    if (p.isFrozen) {
      p.freezeTimer = Math.max(0, p.freezeTimer - dt);
      p.vx = 0;
      p.vy = 0;
      if (p.freezeTimer <= 0) {
        p.isFrozen = false;
        this.particles.addFloatingText(p.x, p.y, p.z + 30, 'UNFROZEN!', '#00F5A0', 14);
      }
      // Horizontal movement is frozen, but gravity & vertical elevation continues below!
    } else {
      // --- C. AIR-DASH STATE --- //
      if (p.isDashing) {
        p.dashDuration -= dt;
        p.x += p.dashVector.x * this.config.playerDashForce * dt;
        p.y += p.dashVector.y * this.config.playerDashForce * dt;

        // Emit dash streak
        this.particles.emitAirDashStreak(p.x, p.y, p.z, p.dashVector, p.color);

        if (p.dashDuration <= 0) {
          p.isDashing = false;
        }
      }

      // --- D. DIRECTIONAL MOVEMENT & INERTIA --- //
      const moveX = input.x || 0;
      const moveY = input.y || 0;
      const magnitude = Math.min(1.0, Math.hypot(moveX, moveY));
      p.moveMagnitude = magnitude;

      if (magnitude > 0.15) {
        p.facingAngle = Math.atan2(moveY, moveX);
        const diff =
          this.config.difficulty === 'easy'
            ? 'easy'
            : this.config.difficulty === 'hard' || this.config.difficulty === 'extreme'
            ? 'hard'
            : 'medium';
        const botSpeedScale = p.isBot ? (diff === 'easy' ? 0.85 : diff === 'hard' ? 1.08 : 1.0) : 1.0;
        const moveSpeed = this.config.playerMoveSpeed * botSpeedScale;

        const targetVx = (moveX / magnitude) * moveSpeed * magnitude;
        const targetVy = (moveY / magnitude) * moveSpeed * magnitude;

        // Ground vs Air control acceleration
        const accel = p.isGrounded ? 12.0 : 6.0;
        p.vx += (targetVx - p.vx) * Math.min(1.0, accel * dt);
        p.vy += (targetVy - p.vy) * Math.min(1.0, accel * dt);
      } else {
        // Friction deceleration
        const friction = p.isGrounded ? 10.0 : 3.0;
        p.vx += (0 - p.vx) * Math.min(1.0, friction * dt);
        p.vy += (0 - p.vy) * Math.min(1.0, friction * dt);
      }

      // Position integration
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // --- E. JUMP & AIR HOP INPUT (Edge Triggered action1) --- //
      const prevA1 = !!this.prevAction1[p.id];
      const currA1 = !!input.action1;
      this.prevAction1[p.id] = currA1;

      const isJumpPressed = currA1 && !prevA1;

      if (isJumpPressed && p.jumpCooldownTimer <= 0) {
        if (p.isGrounded) {
          // 1. Ground Jump
          p.vz = this.config.playerJumpForce;
          p.z = 6;
          p.isGrounded = false;
          p.isAirborne = true;
          p.jumpsRemaining = 1; // 1 air hop remaining per ground departure
          p.jumpCooldownTimer = 0.08;

          this.particles.emitJumpPuff(p.x, p.y, p.color);
          soundManager.playBoost();
        } else if (p.isAirborne && p.jumpsRemaining > 0 && p.z > 3) {
          // 2. Air Hop / Air Dash (consumes remaining hop)
          p.vz = this.config.playerAirHopForce;
          p.jumpsRemaining = 0;
          p.jumpCooldownTimer = 0.15;
          p.airHopsUsed++;

          // If holding directional stick, activate directional Air-Dash!
          if (magnitude > 0.2 && p.dashCooldown <= 0) {
            p.isDashing = true;
            p.dashDuration = 0.18;
            p.dashVector = { x: moveX / magnitude, y: moveY / magnitude };
            p.dashCooldown = p.dashCooldownMax;
            this.particles.addFloatingText(p.x, p.y, p.z + 20, 'AIR DASH!', '#00E5FF', 14);
          } else {
            this.particles.addFloatingText(p.x, p.y, p.z + 20, 'AIR HOP!', '#00F5A0', 13);
          }

          this.particles.emitJumpPuff(p.x, p.y - p.z, '#00E5FF');
          soundManager.playBoost();
        }
      }

      // --- F. ⚡ ELECTRIC FREEZE SHOT (7-Second Cooldown on action2) --- //
      const prevA2 = !!this.prevAction2[p.id];
      const currA2 = !!input.action2;
      this.prevAction2[p.id] = currA2;

      const isShootPressed = currA2 && !prevA2;

      if (isShootPressed && p.freezeShotCooldown <= 0) {
        this.projectiles.push({
          id: `proj_${Date.now()}_${Math.random()}`,
          shooterId: p.id,
          x: p.x + Math.cos(p.facingAngle) * 26,
          y: p.y + Math.sin(p.facingAngle) * 26,
          vx: Math.cos(p.facingAngle) * 780,
          vy: Math.sin(p.facingAngle) * 780,
          color: '#00E5FF',
          lifetime: 1.8,
          radius: 12,
        });

        p.freezeShotCooldown = 7.0; // 7s cooldown
        this.particles.addFloatingText(p.x, p.y, p.z + 28, '⚡ FREEZE SHOT!', '#00E5FF', 15);
        this.particles.emitShockwave(p.id, p.x, p.y, '#00E5FF', 45);
        soundManager.playZap();
      }
    }

    // Ensure air-hop is clamped to at most 1 when departing ground by means other than ground jump
    if ((p.isAirborne || p.z > 0) && p.jumpsRemaining > 1) {
      p.jumpsRemaining = 1;
    }

    // --- G. Z-AXIS ELEVATION & TILE COLLISION AUDIT --- //
    // Rule: Players only fall when standing on a collapsed tile (or outside storm perimeter) while NOT in an active mid-air jump (z > 5)
    if (p.isAirborne || p.z > 0) {
      p.vz -= this.config.gravity * dt;
      p.z += p.vz * dt;

      // Landing check when reaching ground level (z <= 0)
      if (p.z <= 0) {
        const tileUnderneath = this.hexGrid.getTileAt(p.x, p.y);
        const distFromCenter = Math.hypot(p.x, p.y);
        const isOutsideStorm = distFromCenter > this.hexGrid.currentDangerRadius && !tileUnderneath?.isMoving;

        if (tileUnderneath && tileUnderneath.state !== 'collapsed' && !isOutsideStorm) {
          // Successful landing on solid/warning/crumbling tile!
          p.z = 0;
          p.vz = 0;
          p.isGrounded = true;
          p.isAirborne = false;
          p.jumpsRemaining = p.maxJumps;
          p.currentTileId = tileUnderneath.id;
          p.lastSafeTileId = tileUnderneath.id;
          p.lastSafeX = p.x;
          p.lastSafeY = p.y;

          this.hexGrid.stepOnTile(tileUnderneath.id);
          this.particles.emitJumpPuff(p.x, p.y, p.color);
        } else {
          // Missed platform or outside storm -> Plunge into Void Abyss!
          p.isFallingIntoVoid = true;
          p.isGrounded = false;
          p.isAirborne = true;
          p.vz = Math.min(p.vz, -90);
          p.fallTumbleSpeed = (Math.random() - 0.5) * 8;
          this.particles.emitTileCrumbleDebris(p.x, p.y, p.color);
          this.particles.addFloatingText(p.x, p.y, 0, 'VOID PLUNGE!', '#FF3366', 14);
          soundManager.playZap();
        }
      }
    } else {
      // Grounded state tile checks
      const tileUnderneath = this.hexGrid.getTileAt(p.x, p.y);
      const distFromCenter = Math.hypot(p.x, p.y);
      const isOutsideStorm = distFromCenter > this.hexGrid.currentDangerRadius && !tileUnderneath?.isMoving;

      if (!tileUnderneath || tileUnderneath.state === 'collapsed' || isOutsideStorm) {
        // Platform dissolved from under player or walked off edge / outside storm!
        p.isFallingIntoVoid = true;
        p.isGrounded = false;
        p.isAirborne = true;
        p.vz = -90; // Immediate downward drop
        p.fallTumbleSpeed = (Math.random() - 0.5) * 6;
        this.particles.emitTileCrumbleDebris(p.x, p.y, p.color);
        this.particles.addFloatingText(p.x, p.y, 0, 'VOID SLIP!', '#FF3366', 14);
        soundManager.playZap();
      } else {
        p.currentTileId = tileUnderneath.id;
        p.lastSafeTileId = tileUnderneath.id;
        p.lastSafeX = p.x;
        p.lastSafeY = p.y;
        this.hexGrid.stepOnTile(tileUnderneath.id);
      }
    }

    // Record motion trail for visual polish
    if (p.isDashing || Math.hypot(p.vx, p.vy) > 220) {
      p.trail.unshift({ x: p.x, y: p.y, z: p.z, alpha: 0.8, color: p.color });
      if (p.trail.length > 6) p.trail.pop();
    } else {
      p.trail = [];
    }
  }

  /**
   * Activates the Gravity Shockwave AoE push ability.
   * Pushes nearby opponents away with inverse-distance force; clamps impulse to prevent infinite velocity spikes.
   */
  private triggerShockwaveBlast(attacker: PlayerPhysicsState): void {
    const shockwaveRange = this.config.shockwaveRadius;
    const cooldownDuration = this.isSuddenDeath ? 2.0 : this.config.shockwaveCooldown;

    attacker.shockwaveCooldown = cooldownDuration;
    attacker.shockwaveCooldownMax = cooldownDuration;

    // Visual shockwave ring & screen shake
    this.particles.emitShockwave(attacker.id, attacker.x, attacker.y - attacker.z, attacker.color, shockwaveRange);
    this.particles.addFloatingText(attacker.x, attacker.y, attacker.z + 25, 'GRAVITY BLAST!', '#00E5FF', 15);
    soundManager.playZap();

    // Trigger local haptic feedback for attacker
    if (this.onGameEvent) {
      this.onGameEvent({
        type: 'haptic',
        targetPlayerId: attacker.id,
        payload: { intensity: 'heavy', duration: 150 },
      });
    }

    // Find and blast all nearby opponents
    let rivalsHit = 0;
    for (const pid in this.players) {
      if (pid === attacker.id) continue;
      const victim = this.players[pid];
      if (victim.isEliminated || victim.isFallingIntoVoid) continue;

      const dx = victim.x - attacker.x;
      const dy = victim.y - attacker.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= shockwaveRange) {
        rivalsHit++;

        // Inverse-distance force calculation with safe clamping:
        // Force scales higher the closer victim is to blast center, but clamped to avoid infinite spikes
        const normDist = Math.max(0.08, dist / shockwaveRange);
        const inverseScale = Math.min(2.0, 1.0 / (0.35 + 0.65 * normDist));
        const impulseForce = Math.min(850, Math.max(220, this.config.shockwaveForce * inverseScale * 0.8));

        // Direction normalization with zero-distance fallback
        let dirX: number;
        let dirY: number;
        if (dist > 0.001) {
          dirX = dx / dist;
          dirY = dy / dist;
        } else {
          const randAngle = Math.random() * Math.PI * 2;
          dirX = Math.cos(randAngle);
          dirY = Math.sin(randAngle);
        }

        // Apply kinetic knockback impulse
        victim.vx += dirX * impulseForce;
        victim.vy += dirY * impulseForce;

        // Clamp maximum velocity to prevent runaway physics glitches
        const currentSpeed = Math.hypot(victim.vx, victim.vy);
        const MAX_SPEED = 900;
        if (currentSpeed > MAX_SPEED) {
          victim.vx = (victim.vx / currentSpeed) * MAX_SPEED;
          victim.vy = (victim.vy / currentSpeed) * MAX_SPEED;
        }

        victim.vz = Math.max(victim.vz, 150); // Pop into air slightly so they fly over gaps
        victim.isGrounded = false;
        victim.isAirborne = true;
        victim.hitFlashTimer = 0.25;

        // Visual text & particles on victim
        this.particles.addFloatingText(victim.x, victim.y, victim.z + 20, 'SHOVED!', '#FF3366', 13);
        this.particles.emitJumpPuff(victim.x, victim.y, '#FF3366');

        // Trigger haptic rumble on victim controller
        if (this.onGameEvent) {
          this.onGameEvent({
            type: 'haptic',
            targetPlayerId: victim.id,
            payload: { intensity: 'heavy', duration: 250 },
          });
        }
      }
    }

    if (rivalsHit > 0) {
      attacker.shovesLanded += rivalsHit;
      attacker.score += rivalsHit * 50;
      soundManager.playHit();
    }
  }

  /**
   * Evaluates all falling players reaching deep void threshold and processes simultaneous eliminations with tie-breaking.
   * Tie-break order: higher survival time, then smaller distance to center hex (0,0).
   */
  private processPendingEliminations(): void {
    const candidates: PlayerPhysicsState[] = [];

    for (const pid in this.players) {
      const p = this.players[pid];
      if (p.isEliminated) continue;

      // Deep void threshold: z <= -150 or y/radial distance beyond arena boundary
      const isDeepInVoid = p.isFallingIntoVoid && p.z <= -150;
      const isBeyondAbyssBounds = Math.hypot(p.x, p.y) > this.hexGrid.arenaRadius * 1.6;

      if (isDeepInVoid || isBeyondAbyssBounds) {
        candidates.push(p);
      }
    }

    if (candidates.length === 0) return;

    // Tie-break sorting:
    // Better player: higher timeSurvived, then smaller distance to (0,0)
    // We sort so that WORST performer is at index 0 and gets eliminated FIRST (lower placement rank).
    candidates.sort((a, b) => {
      // 1. Survival time (lower survival time is worse -> index 0)
      if (Math.abs(a.timeSurvived - b.timeSurvived) > 0.01) {
        return a.timeSurvived - b.timeSurvived;
      }
      // 2. Distance to center (further from center is worse -> index 0)
      const distA = Math.hypot(a.x, a.y);
      const distB = Math.hypot(b.x, b.y);
      return distB - distA;
    });

    // Eliminate in order
    for (const candidate of candidates) {
      this.eliminatePlayer(candidate);
    }
  }

  /**
   * Eliminates a player who plunged into the void abyss.
   */
  private eliminatePlayer(p: PlayerPhysicsState): void {
    if (p.isEliminated) return;

    p.isEliminated = true;
    p.eliminateTime = this.elapsedTime;
    p.opacity = 0;

    this.eliminationOrder.push(p.id);

    const totalPlayers = Object.keys(this.players).length;
    // Calculate placement rank: e.g. 1st eliminated out of 4 gets Rank 4, 2nd gets Rank 3, 3rd gets Rank 2
    p.placementRank = Math.max(2, totalPlayers - (this.eliminationOrder.length - 1));

    // Survival score
    p.score += Math.floor(p.timeSurvived * 10) + (totalPlayers - p.placementRank) * 120;

    // FX & SFX
    this.particles.emitEliminationBurst(p.x, p.y, p.color);
    this.particles.addFloatingText(p.x, p.y, 0, 'ELIMINATED!', '#FF3366', 18);
    this.particles.addEliminationBanner(p.id, p.name, p.color, p.placementRank, totalPlayers);
    soundManager.playElimination();

    if (this.onGameEvent) {
      this.onGameEvent({
        type: 'eliminate',
        targetPlayerId: p.id,
        payload: {
          title: `RANK #${p.placementRank} - ELIMINATED!`,
          description: `${p.name} plunged into the Void Abyss!`,
          intensity: 'heavy',
        },
      });
    }
  }

  /**
   * Triggers the dramatic Sudden Death mode.
   */
  public triggerSuddenDeath(): void {
    if (this.isSuddenDeath) return;
    this.isSuddenDeath = true;
    this.suddenDeathTriggered = true;

    this.particles.addTrauma(0.85);
    this.particles.addFloatingText(0, 0, 40, '⚡ SUDDEN DEATH ⚡', '#FF3366', 26);
    soundManager.playHunterStinger();

    if (this.onGameEvent) {
      this.onGameEvent({
        type: 'announcement',
        payload: {
          title: 'SUDDEN DEATH!',
          description: 'The platform matrix is destabilizing! Only the core remains!',
        },
      });
    }
  }

  /**
   * Checks if match has ended (authoritative win condition: last surviving player standing on non-collapsed tiles wins!).
   */
  private checkMatchEnd(): void {
    const alivePlayers = Object.values(this.players).filter((p) => !p.isEliminated && !p.isFallingIntoVoid);
    const totalCount = Object.keys(this.players).length;

    // Match ends when:
    // 1. Single player game & player fell
    // 2. Multi-player game & 1 or fewer players alive
    // 3. Round timer reaches 0
    if (
      (totalCount > 1 && alivePlayers.length <= 1) ||
      (totalCount === 1 && alivePlayers.length === 0) ||
      this.timeRemaining <= 0
    ) {
      this.isGameOver = true;

      // Crown last survivor as Rank 1 Winner immediately
      if (alivePlayers.length === 1) {
        const winner = alivePlayers[0];
        winner.placementRank = 1;
        winner.timeSurvived = this.elapsedTime;
        winner.score += 600 + Math.floor(winner.timeSurvived * 25);

        soundManager.playVictoryFanfare();

        if (this.onGameEvent) {
          this.onGameEvent({
            type: 'announcement',
            payload: {
              title: 'VICTORY!',
              description: `👑 ${winner.name} is the Last Survivor standing!`,
            },
          });
        }
      } else if (alivePlayers.length === 0 && this.eliminationOrder.length > 0) {
        // Fallback: If all fell on final tick, the tie-break winner (last eliminated) is crowned
        const lastId = this.eliminationOrder[this.eliminationOrder.length - 1];
        const winner = this.players[lastId];
        if (winner) {
          winner.placementRank = 1;
          soundManager.playVictoryFanfare();
        }
      }
    }
  }

  /**
   * Renders the complete game scene to HTML5 Canvas.
   */
  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.renderer.render(
      ctx,
      width,
      height,
      this.hexGrid,
      this.players,
      this.particles,
      this.timeRemaining,
      this.isSuddenDeath,
      this.config.roundDuration,
      this.projectiles
    );
  }

  /**
   * Returns personal HUD state formatted for mobile controller client synchronization.
   */
  public getPlayerHUDState(playerId: string): PlayerClientHUDState {
    const p = this.players[playerId];
    const totalPlayers = Object.keys(this.players).length;
    if (!p) {
      return {
        playerId,
        rank: 1,
        totalPlayers,
        score: 0,
        status: 'eliminated',
        action1Cooldown: 0,
        action2Cooldown: 0,
      };
    }

    let status: 'alive' | 'eliminated' | 'winner' = (p.isEliminated || p.isFallingIntoVoid) ? 'eliminated' : 'alive';
    if (this.isGameOver && p.placementRank === 1 && !p.isEliminated) {
      status = 'winner';
    }

    const a1Cooldown = p.jumpCooldownTimer > 0 ? p.jumpCooldownTimer / 0.2 : 0;
    const a2Cooldown = p.freezeShotCooldown > 0 ? p.freezeShotCooldown / p.freezeShotCooldownMax : 0;

    let message = p.isFrozen ? `⚡ FROZEN! (${Math.ceil(p.freezeTimer)}s)` : 'SURVIVE ON PLATFORMS';
    if (status === 'eliminated') {
      message = `PLUNGED INTO VOID (RANK #${p.placementRank})`;
    } else if (status === 'winner') {
      message = '🏆 ARENA CHAMPION 🏆';
    } else if (this.isSuddenDeath) {
      message = '⚡ SUDDEN DEATH - HOLD THE CORE ⚡';
    }

    return {
      playerId,
      rank: p.placementRank,
      totalPlayers,
      score: p.score,
      status,
      action1Cooldown: Math.max(0, Math.min(1, a1Cooldown)),
      action2Cooldown: Math.max(0, Math.min(1, a2Cooldown)),
      customStatName: 'SHOVES',
      customStatValue: `${p.shovesLanded}`,
      message,
    };
  }

  /**
   * Returns the final match results and leaderboard.
   */
  public getResults(): MatchResults {
    const playerArray = Object.values(this.players);

    // Sort by rank (rank 1 first), then by score descending
    playerArray.sort((a, b) => {
      if (a.placementRank !== b.placementRank) {
        return a.placementRank - b.placementRank;
      }
      return b.score - a.score;
    });

    const winner = playerArray[0] || {
      id: 'none',
      name: 'Unknown',
      avatar: 'crown',
      color: '#00F5A0',
    };

    // Determine MVP
    let maxShoves = -1;
    let mvpPlayer = winner;
    for (const pl of playerArray) {
      if (pl.shovesLanded > maxShoves) {
        maxShoves = pl.shovesLanded;
        mvpPlayer = pl;
      }
    }

    return {
      gameId: 'last-platform',
      winnerId: winner.id,
      winnerName: winner.name,
      winnerAvatar: winner.avatar,
      winnerColor: winner.color,
      rankings: playerArray.map((p, idx) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        rank: idx + 1,
        avatar: p.avatar,
        color: p.color,
        isBot: p.isBot,
        statSummary: `${p.shovesLanded} Shoves | ${Math.floor(p.timeSurvived)}s Survived`,
      })),
      durationSeconds: Math.floor(this.elapsedTime),
      mvpStat: `Gravity Master: ${mvpPlayer.name} with ${mvpPlayer.shovesLanded} ring-out shoves!`,
    };
  }

  /**
   * Returns the serializable LastPlatformState for networking sync.
   */
  public getState(): LastPlatformState {
    const tilesPayload = this.hexGrid.tilesList.map((t) => ({
      id: t.id,
      row: t.q,
      col: t.r,
      x: t.worldX,
      y: t.worldY,
      size: t.size,
      state: t.state,
      fallProgress: t.fallProgress,
      warningTimer: t.stateTimer,
    }));

    const playersPayload: LastPlatformState['players'] = {};
    for (const pid in this.players) {
      const p = this.players[pid];
      playersPayload[pid] = {
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        isGrounded: p.isGrounded,
        isJumping: p.isAirborne,
        jumpZ: p.z,
        jumpVz: p.vz,
        isEliminated: p.isEliminated,
        eliminateTime: p.eliminateTime,
        pushCooldown: p.shockwaveCooldown,
        isShockwaving: p.isShockwaving,
      };
    }

    return {
      tiles: tilesPayload,
      players: playersPayload,
      dangerRadius: this.hexGrid.currentDangerRadius,
      suddenDeath: this.isSuddenDeath,
    };
  }

  private createDefaultInput(): ControllerInput {
    return {
      x: 0,
      y: 0,
      angle: 0,
      magnitude: 0,
      action1: false,
      action2: false,
      timestamp: Date.now(),
    };
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
    const botName = name || `[AI] HEX_${chosenArchetype.toUpperCase()}`;

    const angle = Math.random() * Math.PI * 2;
    const spawnRadius = this.config.tileSize * (this.config.gridRadius - 2) * 0.6;
    const rawX = Math.cos(angle) * spawnRadius;
    const rawY = Math.sin(angle) * spawnRadius;

    // Snap bot to safe stable hex tile
    const safeTile = this.hexGrid.getTileAt(rawX, rawY) || this.hexGrid.getClosestSafeTile(rawX, rawY);
    const spawnX = safeTile ? safeTile.worldX : rawX;
    const spawnY = safeTile ? safeTile.worldY : rawY;
    const tileId = safeTile ? safeTile.id : null;

    const playerState: PlayerPhysicsState = {
      id: botId,
      name: botName,
      avatar: 'robot',
      color: botColor,
      isBot: true,
      botArchetype: chosenArchetype,
      x: spawnX,
      y: spawnY,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      facingAngle: angle + Math.PI,
      moveMagnitude: 0,
      isGrounded: true,
      isAirborne: false,
      isFallingIntoVoid: false,
      fallTumbleAngle: 0,
      fallTumbleSpeed: 0,
      canJump: true,
      jumpsRemaining: 2,
      maxJumps: 2,
      jumpCooldownTimer: 0,
      canDash: true,
      dashCooldown: 0,
      dashCooldownMax: this.config.dashCooldown,
      isDashing: false,
      dashDuration: 0,
      dashVector: { x: 0, y: 0 },
      shockwaveCooldown: 0.5,
      shockwaveCooldownMax: this.config.shockwaveCooldown,
      isShockwaving: false,
      shockwaveAnimTimer: 0,
      freezeShotCooldown: 0,
      freezeShotCooldownMax: 7.0,
      isFrozen: false,
      freezeTimer: 0,
      isEliminated: false,
      eliminateTime: 0,
      placementRank: 1,
      score: 0,
      kills: 0,
      shovesLanded: 0,
      airHopsUsed: 0,
      timeSurvived: 0,
      currentTileId: tileId,
      lastSafeTileId: tileId,
      lastSafeX: spawnX,
      lastSafeY: spawnY,
      trail: [],
      hitFlashTimer: 0,
      scale: 1.0,
      opacity: 1.0,
    };

    this.players[botId] = playerState;
    this.bots.set(botId, new BotAI(botId, chosenArchetype, this.config));
    this.particles.emitJumpPuff(spawnX, spawnY, botColor);
    return botId;
  }

  public forceEliminate(playerId: string): void {
    const p = this.players[playerId];
    if (p && !p.isEliminated) {
      p.isFallingIntoVoid = true;
      p.z = -200;
      this.eliminatePlayer(p);
    }
  }

  public forceWin(playerId: string): void {
    const p = this.players[playerId];
    if (p) {
      // Eliminate all other players
      for (const pid in this.players) {
        if (pid !== playerId && !this.players[pid].isEliminated) {
          this.eliminatePlayer(this.players[pid]);
        }
      }
      p.isEliminated = false;
      p.score += 2000;
      this.isGameOver = true;
      soundManager.playVictoryFanfare();
    }
  }

  public triggerEvent(type: 'quake' | 'sudden_death' | 'anti_gravity' = 'quake'): void {
    if (type === 'quake') {
      // Platform Quake: Crumble 8 random stable tiles immediately & launch shockwave
      const stableTiles = Array.from(this.hexGrid.tiles.values()).filter((t: any) => t.state === 'stable');
      const count = Math.min(8, stableTiles.length);
      for (let i = 0; i < count; i++) {
        const randTile = stableTiles[Math.floor(Math.random() * stableTiles.length)];
        if (randTile) {
          randTile.state = 'warning';
          randTile.stateTimer = 0;
        }
      }
      for (const p of Object.values(this.players)) {
        if (!p.isEliminated) {
          p.vz = 220;
          p.isGrounded = false;
          p.isAirborne = true;
        }
      }
      this.particles.addFloatingText(0, 0, 40, '💥 PLATFORM QUAKE! 💥', '#FFB224', 22);
      soundManager.playHunterStinger();
    } else if (type === 'sudden_death') {
      this.triggerSuddenDeath();
    } else {
      // Anti-gravity bounce
      for (const p of Object.values(this.players)) {
        if (!p.isEliminated) {
          p.vz = 450;
          p.isGrounded = false;
          p.isAirborne = true;
        }
      }
      soundManager.playBoost();
    }
  }

  public setModifiers(modifiers: Partial<{ turboSpeed: boolean; doubleGrowthOrScore: boolean; lowGravity: boolean; chaosMode: boolean }>): void {
    if (modifiers.turboSpeed) {
      this.config.playerMoveSpeed = 380;
      this.config.playerDashForce = 580;
    } else {
      this.config.playerMoveSpeed = 240;
      this.config.playerDashForce = 380;
    }

    if (modifiers.lowGravity) {
      this.config.gravity = 350;
      this.config.playerJumpForce = 460;
    } else {
      this.config.gravity = 750;
      this.config.playerJumpForce = 360;
    }

    if (modifiers.chaosMode) {
      this.config.shockwaveCooldown = 1.0;
      this.config.dashCooldown = 0.8;
      this.config.warningDuration = 1.5;
      this.config.crumblingDuration = 1.0;
    }
  }

  public setPlayerConnected(playerId: string, connected: boolean): void {
    const p = this.players[playerId];
    if (p) {
      if (!connected) {
        p.opacity = 0.4;
      } else {
        p.opacity = 1.0;
      }
    }
  }
}
