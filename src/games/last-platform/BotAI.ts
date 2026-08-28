import { ControllerInput } from '../../types';
import { PlayerPhysicsState, PlatformTileData, LastPlatformConfig } from './types';
import { HexGrid } from './HexGrid';

export class BotAI {
  private botId: string;
  private config: LastPlatformConfig;
  private archetype: 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic';
  public readonly difficulty: 'easy' | 'medium' | 'hard';
  
  // Tactical reaction timers
  private decisionTimer: number = 0;
  private tickCount: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;
  private currentMoveX: number = 0;
  private currentMoveY: number = 0;
  private currentAngle: number = 0;
  private targetTileId: number | null = null;
  private reactionDelay: number = 0.08;
  
  // Easy difficulty delayed perception of crumbling tiles
  private crumblePerceptionTimer: number = 0;

  // Pulse edge triggers for jump/dash (action1) and freeze shot (action2)
  private prevAction1: boolean = false;
  private prevAction2: boolean = false;
  private jumpPulseCooldown: number = 0;
  private shotPulseCooldown: number = 0;

  constructor(
    botId: string,
    archetype: 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic' = 'aggressive',
    config: LastPlatformConfig
  ) {
    this.botId = botId;
    this.archetype = archetype;
    this.config = config;

    this.difficulty =
      config.difficulty === 'easy'
        ? 'easy'
        : config.difficulty === 'hard' || config.difficulty === 'extreme'
        ? 'hard'
        : 'medium';

    this.reactionDelay =
      this.difficulty === 'easy'
        ? 0.30
        : this.difficulty === 'hard'
        ? 0.01
        : 0.08;

    this.tickCount = (botId.charCodeAt(botId.length - 1) || 0) % 5;
  }

  /**
   * Generates synthetic ControllerInput for this bot frame.
   */
  public update(
    dt: number,
    botState: PlayerPhysicsState,
    allPlayers: Record<string, PlayerPhysicsState>,
    hexGrid: HexGrid
  ): ControllerInput {
    if (botState.isEliminated || botState.isFallingIntoVoid) {
      return this.createIdleInput();
    }

    this.decisionTimer += dt;
    this.tickCount++;
    if (this.jumpPulseCooldown > 0) this.jumpPulseCooldown -= dt;
    if (this.shotPulseCooldown > 0) this.shotPulseCooldown -= dt;

    // 1. Spatial Perception & Safety Evaluation
    const currentTile = hexGrid.getTileAt(botState.x, botState.y);
    const distFromCenter = Math.hypot(botState.x, botState.y);
    const isOutsideStorm = distFromCenter > hexGrid.currentDangerRadius && !currentTile?.isMoving;

    let isCurrentTileDangerous = false;
    if (isOutsideStorm || !currentTile) {
      isCurrentTileDangerous = true;
    } else {
      const tileIsDecaying =
        currentTile.state === 'crumbling' ||
        currentTile.state === 'respawning' ||
        (currentTile.state === 'warning' && currentTile.stateTimer / currentTile.warningDuration > 0.35) ||
        (hexGrid.suddenDeath && currentTile.ring >= 2);

      if (tileIsDecaying) {
        if (this.difficulty === 'easy') {
          // Easy: 0.3s delayed reaction to crumbling tiles
          this.crumblePerceptionTimer += dt;
          if (this.crumblePerceptionTimer >= 0.30) {
            isCurrentTileDangerous = true;
          }
        } else {
          // Medium & Hard: Immediate evaluation of tile decay states
          isCurrentTileDangerous = true;
        }
      } else {
        this.crumblePerceptionTimer = 0;
      }
    }

    const isOverVoid = !currentTile || isOutsideStorm;

    // Staggered tactical decision timing (every 5 ticks or on critical danger)
    const isPerceptionTick = (this.tickCount % 5 === 0) || (this.decisionTimer >= this.reactionDelay) || isOverVoid || (isCurrentTileDangerous && this.difficulty !== 'easy');
    if (isPerceptionTick) {
      this.decisionTimer = 0;
      this.evaluateTargetPosition(botState, allPlayers, hexGrid, currentTile, isCurrentTileDangerous, isOverVoid);
    }

    // 2. Compute Movement Vector towards Target with smooth lerp
    const dx = this.targetX - botState.x;
    const dy = this.targetY - botState.y;
    const distToTarget = Math.hypot(dx, dy);

    let targetMoveX = 0;
    let targetMoveY = 0;
    let targetAngle = botState.facingAngle;
    let targetMagnitude = 0;

    if (distToTarget > 8) {
      targetMoveX = dx / distToTarget;
      targetMoveY = dy / distToTarget;
      targetAngle = Math.atan2(dy, dx);
      targetMagnitude = Math.min(1.0, distToTarget / 40);
    }

    const lerpRate = this.difficulty === 'hard' ? 18.0 : 12.0;
    this.currentMoveX += (targetMoveX - this.currentMoveX) * Math.min(1.0, dt * lerpRate);
    this.currentMoveY += (targetMoveY - this.currentMoveY) * Math.min(1.0, dt * lerpRate);

    let angleDelta = targetAngle - this.currentAngle;
    while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
    this.currentAngle += angleDelta * Math.min(1.0, dt * lerpRate);

    let moveX = this.currentMoveX;
    let moveY = this.currentMoveY;
    let moveAngle = this.currentAngle;
    let magnitude = Math.min(1.0, Math.hypot(moveX, moveY) * (targetMagnitude > 0 ? 1.0 : 0));

    // 3. Jump, Air Hop, and Offensive Dash Shoves (action1)
    let wantAction1 = false;

    // Check intermediate point in movement direction
    const midStepX = botState.x + moveX * 35;
    const midStepY = botState.y + moveY * 35;
    const midTile = hexGrid.getTileAt(midStepX, midStepY);
    const isMidGapVoid = !midTile || midTile.state === 'collapsed' || midTile.state === 'respawning';

    // A. Ground Jump & Air-Hop across gaps and collapsing tiles
    if (isOverVoid || isCurrentTileDangerous || isMidGapVoid) {
      if (botState.isGrounded && botState.canJump) {
        wantAction1 = true;
      } else if (this.difficulty !== 'easy') {
        // Medium & Hard: Air-Hop / Air-Dash across collapsing voids
        if (botState.isAirborne && botState.jumpsRemaining > 0) {
          if (this.difficulty === 'hard') {
            // Hard: Frame-perfect air hop at optimal trajectory (peak or descending)
            if (botState.z < 20 || botState.vz <= 0) {
              wantAction1 = true;
            }
          } else {
            // Medium: Air hop when falling
            if (botState.z < 15 || botState.vz < -50) {
              wantAction1 = true;
            }
          }
        }
      }
    }

    // B. Long distance gap jumping
    if (distToTarget > 50 && botState.isGrounded && Math.random() < (this.difficulty === 'hard' ? 0.6 : 0.3)) {
      wantAction1 = true;
    }

    // C. Hard Difficulty: Offensive Dash Shoves against rivals near edges
    if (this.difficulty === 'hard' && botState.dashCooldown <= 0) {
      const nearestRival = this.findNearestRival(botState, allPlayers);
      if (nearestRival && !nearestRival.isFallingIntoVoid) {
        const rivalDist = Math.hypot(nearestRival.x - botState.x, nearestRival.y - botState.y);
        const rivalDistFromCenter = Math.hypot(nearestRival.x, nearestRival.y);

        // If rival is within dash-shove strike distance (40-130px) and near perimeter or on weak tile
        if (rivalDist > 30 && rivalDist < 130 && Math.abs(nearestRival.z - botState.z) < 25) {
          const rivalTile = hexGrid.getTileAt(nearestRival.x, nearestRival.y);
          const isRivalVulnerable = rivalDistFromCenter > hexGrid.currentDangerRadius * 0.45 || (rivalTile && rivalTile.state !== 'stable');

          if (isRivalVulnerable) {
            // Align dash vector directly into rival
            moveX = (nearestRival.x - botState.x) / rivalDist;
            moveY = (nearestRival.y - botState.y) / rivalDist;
            moveAngle = Math.atan2(moveY, moveX);
            magnitude = 1.0;
            wantAction1 = true; // Trigger Air-Dash Shove!
          }
        }
      }
    }

    // Edge pulse action1
    let action1 = false;
    if (wantAction1 && this.jumpPulseCooldown <= 0 && !this.prevAction1) {
      action1 = true;
      this.jumpPulseCooldown = 0.12;
    }
    this.prevAction1 = action1;

    // 4. Tactical 7-Second Electric Freeze Shot (action2)
    let wantAction2 = false;
    if (botState.freezeShotCooldown <= 0 && !botState.isFrozen) {
      const nearestRival = this.findNearestRival(botState, allPlayers);
      if (nearestRival && !nearestRival.isFrozen && !nearestRival.isFallingIntoVoid) {
        const rivalDist = Math.hypot(nearestRival.x - botState.x, nearestRival.y - botState.y);

        if (rivalDist < 440 && Math.abs(nearestRival.z - botState.z) < 32) {
          if (this.difficulty === 'hard') {
            // Hard: Predicts rival movement with freeze projectile (speed = 780)
            const projectileSpeed = 780;
            const timeToHit = rivalDist / projectileSpeed;
            const predX = nearestRival.x + (nearestRival.vx || 0) * timeToHit;
            const predY = nearestRival.y + (nearestRival.vy || 0) * timeToHit;

            moveAngle = Math.atan2(predY - botState.y, predX - botState.x);
            wantAction2 = true;
          } else if (this.difficulty === 'medium') {
            // Medium: Fires freeze shot directly at close rivals
            if (rivalDist < 380) {
              moveAngle = Math.atan2(nearestRival.y - botState.y, nearestRival.x - botState.x);
              wantAction2 = true;
            }
          } else {
            // Easy: Low frequency and close range only
            if (rivalDist < 200 && Math.random() < 0.25) {
              moveAngle = Math.atan2(nearestRival.y - botState.y, nearestRival.x - botState.x);
              wantAction2 = true;
            }
          }
        }
      }
    }

    // Edge pulse action2
    let action2 = false;
    if (wantAction2 && this.shotPulseCooldown <= 0 && !this.prevAction2) {
      action2 = true;
      this.shotPulseCooldown = 0.2;
    }
    this.prevAction2 = action2;

    return {
      x: moveX,
      y: moveY,
      angle: moveAngle,
      magnitude,
      action1,
      action2,
      timestamp: Date.now(),
    };
  }

  /**
   * Evaluates navigation target: seeks safe central hexes, escapes crumbling tiles, or tracks rivals.
   */
  private evaluateTargetPosition(
    botState: PlayerPhysicsState,
    allPlayers: Record<string, PlayerPhysicsState>,
    hexGrid: HexGrid,
    currentTile: PlatformTileData | null,
    isCurrentDangerous: boolean,
    isOverVoid: boolean
  ): void {
    // If falling over void or tile is crumbling, find nearest solid safe tile immediately
    if (isOverVoid || isCurrentDangerous) {
      const safeTile = hexGrid.getClosestSafeTile(botState.x, botState.y);
      if (safeTile) {
        this.targetX = safeTile.worldX;
        this.targetY = safeTile.worldY;
        this.targetTileId = safeTile.id;
        return;
      }
    }

    // Archetype specific behaviors
    switch (this.archetype) {
      case 'aggressive': {
        // Hunt the nearest alive rival to shove them off
        const nearestRival = this.findNearestRival(botState, allPlayers);
        if (nearestRival) {
          const angleToRival = Math.atan2(nearestRival.y, nearestRival.x);
          const offsetDist = this.difficulty === 'hard' ? 35 : 50;
          const approachX = nearestRival.x - Math.cos(angleToRival) * offsetDist;
          const approachY = nearestRival.y - Math.sin(angleToRival) * offsetDist;

          const approachTile = hexGrid.getTileAt(approachX, approachY);
          if (approachTile && approachTile.state !== 'collapsed') {
            this.targetX = approachX;
            this.targetY = approachY;
            return;
          }
        }
        break;
      }

      case 'defensive': {
        // Patrol across stable tiles in rings 1 and 3, actively moving rather than camping
        let randTile: PlatformTileData | null = null;
        let count = 0;
        for (let i = 0; i < hexGrid.tilesList.length; i++) {
          const t = hexGrid.tilesList[i];
          if ((t.state === 'stable' || t.state === 'warning') && t.ring >= 1 && t.ring <= 3) {
            count++;
            if (Math.random() < 1 / count) {
              randTile = t;
            }
          }
        }
        if (randTile) {
          this.targetX = randTile.worldX;
          this.targetY = randTile.worldY;
          this.targetTileId = randTile.id;
          return;
        }
        const safeTile = hexGrid.getClosestSafeTile(botState.x, botState.y);
        if (safeTile) {
          this.targetX = safeTile.worldX;
          this.targetY = safeTile.worldY;
          this.targetTileId = safeTile.id;
          return;
        }
        break;
      }

      case 'ambusher': {
        const nearestRival = this.findNearestRival(botState, allPlayers);
        if (nearestRival && Math.hypot(nearestRival.x - botState.x, nearestRival.y - botState.y) < 160) {
          this.targetX = nearestRival.x;
          this.targetY = nearestRival.y;
          return;
        }
        break;
      }

      case 'chaotic': {
        if (Math.random() < 0.3 || !this.targetTileId) {
          let randomTile: PlatformTileData | null = null;
          let count = 0;
          for (let i = 0; i < hexGrid.tilesList.length; i++) {
            const t = hexGrid.tilesList[i];
            if (t.state === 'stable' && t.ring <= 3) {
              count++;
              if (Math.random() < 1 / count) {
                randomTile = t;
              }
            }
          }
          if (randomTile) {
            this.targetX = randomTile.worldX;
            this.targetY = randomTile.worldY;
            this.targetTileId = randomTile.id;
            return;
          }
        }
        break;
      }

      case 'collector':
      default: {
        const centerSafe = hexGrid.getClosestSafeTile(0, 0);
        if (centerSafe) {
          this.targetX = centerSafe.worldX;
          this.targetY = centerSafe.worldY;
          return;
        }
      }
    }

    // Default fallback: Move toward center of the arena
    this.targetX = 0;
    this.targetY = 0;
  }

  /**
   * Helper: Finds closest active opponent.
   */
  private findNearestRival(
    botState: PlayerPhysicsState,
    allPlayers: Record<string, PlayerPhysicsState>
  ): PlayerPhysicsState | null {
    let nearest: PlayerPhysicsState | null = null;
    let minDist = Infinity;

    for (const pid in allPlayers) {
      if (pid === botState.id) continue;
      const rival = allPlayers[pid];
      if (rival.isEliminated || rival.isFallingIntoVoid) continue;

      const dist = Math.hypot(rival.x - botState.x, rival.y - botState.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = rival;
      }
    }

    return nearest;
  }

  private createIdleInput(): ControllerInput {
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
}

