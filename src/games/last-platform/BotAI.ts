import { ControllerInput } from '../../types';
import { PlayerPhysicsState, PlatformTileData, LastPlatformConfig } from './types';
import { HexGrid } from './HexGrid';

export class BotAI {
  private botId: string;
  private config: LastPlatformConfig;
  private archetype: 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic';
  
  // Tactical reaction timers
  private decisionTimer: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;
  private targetTileId: number | null = null;
  private reactionDelay: number = 0.08;
  private lastJumpAttempt: number = 0;

  constructor(
    botId: string,
    archetype: 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic' = 'aggressive',
    config: LastPlatformConfig
  ) {
    this.botId = botId;
    this.archetype = archetype;
    this.config = config;

    const diff =
      config.difficulty === 'easy'
        ? 'easy'
        : config.difficulty === 'hard' || config.difficulty === 'extreme'
        ? 'hard'
        : 'medium';

    this.reactionDelay =
      diff === 'easy'
        ? 0.22 + Math.random() * 0.08
        : diff === 'hard'
        ? 0.01
        : 0.05 + Math.random() * 0.05;
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
    const now = Date.now();

    // 1. Spatial Perception & Safety Evaluation
    const currentTile = hexGrid.getTileAt(botState.x, botState.y);
    const distFromCenter = Math.hypot(botState.x, botState.y);
    const isOutsideStorm = distFromCenter > hexGrid.currentDangerRadius && !currentTile?.isMoving;
    const isCurrentTileDangerous = !!(
      isOutsideStorm ||
      !currentTile ||
      (currentTile && (
        currentTile.state === 'crumbling' ||
        currentTile.state === 'respawning' ||
        (currentTile.state === 'warning' && currentTile.stateTimer / currentTile.warningDuration > 0.35) ||
        (hexGrid.suddenDeath && currentTile.ring >= 2)
      ))
    );
    const isOverVoid = !currentTile || isOutsideStorm;

    // Make tactical decision periodically or immediately upon high hazard
    if (this.decisionTimer >= this.reactionDelay || isOverVoid || isCurrentTileDangerous) {
      this.decisionTimer = 0;
      this.evaluateTargetPosition(botState, allPlayers, hexGrid, currentTile, isCurrentTileDangerous, isOverVoid);
    }

    // 2. Compute Movement Vector towards Target
    const dx = this.targetX - botState.x;
    const dy = this.targetY - botState.y;
    const distToTarget = Math.hypot(dx, dy);

    let moveX = 0;
    let moveY = 0;
    let moveAngle = botState.facingAngle;
    let magnitude = 0;

    if (distToTarget > 8) {
      moveX = dx / distToTarget;
      moveY = dy / distToTarget;
      moveAngle = Math.atan2(dy, dx);
      magnitude = Math.min(1.0, distToTarget / 40);
    }

    // 3. Jump & Air Hop Timing (Leaping gaps and escaping crumbling tiles)
    let action1 = false; // Jump / Air-hop / Dash

    // Check if intermediate point in movement direction is over a void pit / gap
    const midStepX = botState.x + moveX * 35;
    const midStepY = botState.y + moveY * 35;
    const midTile = hexGrid.getTileAt(midStepX, midStepY);
    const isMidGapVoid = !midTile || midTile.state === 'collapsed' || midTile.state === 'respawning';

    // Condition A: Stepping on a crumbling tile, over void, or facing a gap ahead
    if (isOverVoid || isCurrentTileDangerous || isMidGapVoid) {
      if (botState.isGrounded && botState.canJump) {
        action1 = true;
        this.lastJumpAttempt = now;
      } else if (botState.isAirborne && botState.jumpsRemaining > 0 && (botState.z < 16 || botState.vz < 0)) {
        // Airborne recovery air hop
        action1 = true;
      }
    }

    // Condition B: Leaping over a long distance gap between tiles
    if (distToTarget > 50 && botState.isGrounded && Math.random() < 0.35) {
      action1 = true;
    }

    // 4. Tactical 7-Second Electric Freeze Shot (action2)
    let action2 = false;
    if (botState.freezeShotCooldown <= 0 && !botState.isFrozen) {
      const nearestRival = this.findNearestRival(botState, allPlayers);
      if (nearestRival && !nearestRival.isFrozen) {
        const rivalDist = Math.hypot(nearestRival.x - botState.x, nearestRival.y - botState.y);
        if (rivalDist < 420 && Math.abs(nearestRival.z - botState.z) < 30) {
          // Aim directly at opponent and fire freeze bolt
          moveAngle = Math.atan2(nearestRival.y - botState.y, nearestRival.x - botState.x);
          action2 = true;
        }
      }
    }

    return {
      x: moveX,
      y: moveY,
      angle: moveAngle,
      magnitude,
      action1,
      action2,
      timestamp: now,
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
          // Position slightly behind the rival relative to arena center to push them outwards
          const rivalDistFromCenter = Math.hypot(nearestRival.x, nearestRival.y);
          const angleToRival = Math.atan2(nearestRival.y, nearestRival.x);
          
          // Stand on safe side of rival
          const offsetDist = 45;
          const approachX = nearestRival.x - Math.cos(angleToRival) * offsetDist;
          const approachY = nearestRival.y - Math.sin(angleToRival) * offsetDist;

          // Verify approach position is on safe tile
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
        // Camp at ring 0 or 1 (center of the arena), away from edges and rivals
        const safeTile = hexGrid.getClosestSafeTile(0, 0);
        if (safeTile) {
          this.targetX = safeTile.worldX + (Math.random() - 0.5) * 20;
          this.targetY = safeTile.worldY + (Math.random() - 0.5) * 20;
          return;
        }
        break;
      }

      case 'ambusher': {
        // Wait near outer safe perimeter, then charge when rival approaches
        const nearestRival = this.findNearestRival(botState, allPlayers);
        if (nearestRival && Math.hypot(nearestRival.x - botState.x, nearestRival.y - botState.y) < 160) {
          this.targetX = nearestRival.x;
          this.targetY = nearestRival.y;
          return;
        }
        break;
      }

      case 'chaotic': {
        // Rapidly leap between random stable tiles
        if (Math.random() < 0.3 || !this.targetTileId) {
          const candidateTiles = hexGrid.tilesList.filter(t => t.state === 'stable' && t.ring <= 3);
          if (candidateTiles.length > 0) {
            const randomTile = candidateTiles[Math.floor(Math.random() * candidateTiles.length)];
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
        // Hold the highest stability tile cluster
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
   * Evaluates whether to activate Gravity Shockwave Push (action2) to blast rivals off edges.
   */
  private evaluateShockwaveAttack(
    botState: PlayerPhysicsState,
    allPlayers: Record<string, PlayerPhysicsState>,
    hexGrid: HexGrid
  ): boolean {
    const shockwaveRange = this.config.shockwaveRadius * 0.9;

    for (const pid in allPlayers) {
      if (pid === botState.id) continue;
      const rival = allPlayers[pid];
      if (rival.isEliminated || rival.isFallingIntoVoid) continue;

      const dx = rival.x - botState.x;
      const dy = rival.y - botState.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= shockwaveRange) {
        // 1. Is rival close to arena perimeter?
        const rivalDistFromCenter = Math.hypot(rival.x, rival.y);
        const botDistFromCenter = Math.hypot(botState.x, botState.y);

        // Vector from bot to rival
        const blastAngle = Math.atan2(dy, dx);
        // Vector from center to rival
        const outAngle = Math.atan2(rival.y, rival.x);

        // Dot product / angle alignment: is blast pushing rival outward?
        const angleDiff = Math.abs(blastAngle - outAngle);
        const isPushingOutward = angleDiff < Math.PI * 0.45;

        // 2. Is rival standing on a crumbling / warning tile?
        const rivalTile = hexGrid.getTileAt(rival.x, rival.y);
        const isRivalTileWeak = rivalTile && (rivalTile.state === 'crumbling' || rivalTile.state === 'warning');

        // Aggressive condition: Rival is pushed outward or rival is on weak ground
        if (isPushingOutward && (rivalDistFromCenter > hexGrid.currentDangerRadius * 0.45 || isRivalTileWeak)) {
          return true;
        }

        // Defensive panic condition: If rival is too close to me and I am near edge
        if (dist < 60 && botDistFromCenter > hexGrid.currentDangerRadius * 0.7) {
          return true;
        }

        // Archetype aggression
        if (this.archetype === 'aggressive' && dist < shockwaveRange * 0.8) {
          return Math.random() < 0.6;
        }
      }
    }

    return false;
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
