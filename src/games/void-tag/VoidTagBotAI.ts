import { ControllerInput } from '../../types';
import { VoidTagPlayerEntity, SanctuaryZone, NebulaZone, SpaceDebris, VoidTagEngineConfig } from './types';

export class VoidTagBotAI {
  private static botStates: Record<
    string,
    {
      timer: number;
      cachedInput: ControllerInput;
    }
  > = {};

  /**
   * Generates synthetic ControllerInput for an AI bot entity.
   */
  public static computeBotInput(
    bot: VoidTagPlayerEntity,
    allPlayers: Record<string, VoidTagPlayerEntity>,
    sanctuaries: SanctuaryZone[],
    nebulae: NebulaZone[],
    debris: SpaceDebris[],
    config: VoidTagEngineConfig,
    dt: number
  ): ControllerInput {
    // If stunned or transforming, no movement
    if (bot.isStunned || bot.transformationTimer > 0 || bot.isEliminated) {
      return {
        x: 0,
        y: 0,
        angle: bot.angle,
        magnitude: 0,
        action1: false,
        action2: false,
        timestamp: Date.now(),
      };
    }

    const diff =
      config.difficulty === 'easy'
        ? 'easy'
        : config.difficulty === 'hard' || config.difficulty === 'extreme'
        ? 'hard'
        : 'medium';

    const decisionInterval = diff === 'easy' ? 0.22 : diff === 'medium' ? 0.08 : 0;

    if (!this.botStates[bot.id]) {
      this.botStates[bot.id] = {
        timer: 999,
        cachedInput: {
          x: 0,
          y: 0,
          angle: bot.angle,
          magnitude: 0,
          action1: false,
          action2: false,
          timestamp: Date.now(),
        },
      };
    }

    const state = this.botStates[bot.id];
    state.timer += dt;

    if (decisionInterval === 0 || state.timer >= decisionInterval) {
      state.timer = 0;
      if (bot.isHunter) {
        state.cachedInput = this.computeHunterInput(bot, allPlayers, sanctuaries, nebulae, debris, config);
      } else {
        state.cachedInput = this.computeSurvivorInput(bot, allPlayers, sanctuaries, nebulae, debris, config);
      }
    }

    return state.cachedInput;
  }

  // --------------------------------------------------------------------------
  // HUNTER BOT LOGIC
  // --------------------------------------------------------------------------
  private static computeHunterInput(
    hunter: VoidTagPlayerEntity,
    allPlayers: Record<string, VoidTagPlayerEntity>,
    sanctuaries: SanctuaryZone[],
    nebulae: NebulaZone[],
    debris: SpaceDebris[],
    config: VoidTagEngineConfig
  ): ControllerInput {
    const survivors = Object.values(allPlayers).filter(p => !p.isHunter && !p.isEliminated);
    const otherHunters = Object.values(allPlayers).filter(p => p.isHunter && p.id !== hunter.id);

    if (survivors.length === 0) {
      // Wander around center if no survivors left
      return this.createIdleMovement(hunter, config);
    }

    // 1. Determine Target Survivor
    // Filter visible survivors (stealthed survivors in nebulae are hidden unless hunter is inside the same nebula)
    const visibleSurvivors = survivors.filter(s => {
      if (!s.isStealthed) return true;
      // Check if hunter is in the same nebula as the survivor
      return nebulae.some(neb => {
        const dHunter = Math.hypot(hunter.x - neb.x, hunter.y - neb.y);
        const dSurvivor = Math.hypot(s.x - neb.x, s.y - neb.y);
        return dHunter <= neb.radius && dSurvivor <= neb.radius;
      });
    });

    // Pick target: closest visible survivor, or fallback to closest survivor / sanctuary
    let targetSurvivor: VoidTagPlayerEntity | null = null;
    let minTargetDist = Infinity;

    const candidates = visibleSurvivors.length > 0 ? visibleSurvivors : survivors;

    for (const s of candidates) {
      const dist = Math.hypot(s.x - hunter.x, s.y - hunter.y);
      // Give slight penalty to survivors inside active sanctuaries
      const sanctuaryWeight = s.isInSanctuary ? 1.5 : 1.0;
      const weightedDist = dist * sanctuaryWeight;

      if (weightedDist < minTargetDist) {
        minTargetDist = weightedDist;
        targetSurvivor = s;
      }
    }

    if (!targetSurvivor) {
      targetSurvivor = survivors[0];
    }

    const distToTarget = Math.hypot(targetSurvivor.x - hunter.x, targetSurvivor.y - hunter.y);

    // 2. Flanking & Interception Logic
    // If multiple hunters, rank this hunter's distance to target compared to peer hunters
    let isPrimaryChaser = true;
    for (const peer of otherHunters) {
      const peerDist = Math.hypot(targetSurvivor.x - peer.x, targetSurvivor.y - peer.y);
      if (peerDist < distToTarget * 0.9) {
        isPrimaryChaser = false;
        break;
      }
    }

    let targetX = targetSurvivor.x;
    let targetY = targetSurvivor.y;

    if (!isPrimaryChaser && distToTarget > 140) {
      // Flanking behavior: Lead the target by predicting trajectory + cutting off nearest sanctuary
      const leadTime = Math.min(1.2, distToTarget / Math.max(1, config.baseHunterSpeed));
      targetX += targetSurvivor.vx * leadTime;
      targetY += targetSurvivor.vy * leadTime;

      // Find nearest active sanctuary to the survivor and flank between them
      let nearestSanc: SanctuaryZone | null = null;
      let minSancDist = Infinity;
      for (const s of sanctuaries) {
        if (!s.isDepleted && s.energy > 10) {
          const ds = Math.hypot(s.x - targetSurvivor.x, s.y - targetSurvivor.y);
          if (ds < minSancDist) {
            minSancDist = ds;
            nearestSanc = s;
          }
        }
      }

      if (nearestSanc && minSancDist < 350) {
        // Cut-off vector between survivor and sanctuary
        const midX = (targetSurvivor.x + nearestSanc.x) * 0.5;
        const midY = (targetSurvivor.y + nearestSanc.y) * 0.5;
        targetX = (targetX + midX) * 0.5;
        targetY = (targetY + midY) * 0.5;
      }
    }

    // 3. Compute Steering Vector
    let steerX = targetX - hunter.x;
    let steerY = targetY - hunter.y;
    const steerLen = Math.hypot(steerX, steerY);

    if (steerLen > 0.001) {
      steerX /= steerLen;
      steerY /= steerLen;
    }

    // 4. Obstacle Avoidance (Space Debris & Sanctuary Repulsion if active)
    const avoidance = this.computeObstacleAvoidance(hunter, debris, sanctuaries, steerX, steerY);
    steerX += avoidance.x * 1.6;
    steerY += avoidance.y * 1.6;

    // Wall repulsion
    const wallPush = this.computeWallRepulsion(hunter, config);
    steerX += wallPush.x * 1.5;
    steerY += wallPush.y * 1.5;

    // Normalize final move vector
    const finalLen = Math.hypot(steerX, steerY);
    const moveX = finalLen > 0.001 ? steerX / finalLen : Math.cos(hunter.angle);
    const moveY = finalLen > 0.001 ? steerY / finalLen : Math.sin(hunter.angle);
    const desiredAngle = Math.atan2(moveY, moveX);

    // 5. Abilities Decision: Phase Dash
    let action1 = false; // Phase Dash
    const action2 = false; // Hunters don't use EMP

    // Use Dash when closing in on a survivor in line of sight
    if (hunter.dashCooldown <= 0 && distToTarget > 110 && distToTarget < 260) {
      // Check angle alignment
      const angleToTarget = Math.atan2(targetSurvivor.y - hunter.y, targetSurvivor.x - hunter.x);
      const angleDiff = Math.abs(this.normalizeAngle(hunter.angle - angleToTarget));

      // Line of sight check through debris
      const hasLOS = this.hasLineOfSight(hunter.x, hunter.y, targetSurvivor.x, targetSurvivor.y, debris);

      if (angleDiff < 0.55 && hasLOS) {
        action1 = true;
      }
    }

    return {
      x: moveX,
      y: moveY,
      angle: desiredAngle,
      magnitude: 1.0,
      action1,
      action2,
      timestamp: Date.now(),
    };
  }

  // --------------------------------------------------------------------------
  // SURVIVOR BOT LOGIC
  // --------------------------------------------------------------------------
  private static computeSurvivorInput(
    survivor: VoidTagPlayerEntity,
    allPlayers: Record<string, VoidTagPlayerEntity>,
    sanctuaries: SanctuaryZone[],
    nebulae: NebulaZone[],
    debris: SpaceDebris[],
    config: VoidTagEngineConfig
  ): ControllerInput {
    const hunters = Object.values(allPlayers).filter(p => p.isHunter && !p.isEliminated);
    const archetype = survivor.botArchetype || 'defensive';

    // 1. Calculate Threat & Threat Vectors from all Hunters
    let threatVectorX = 0;
    let threatVectorY = 0;
    let closestHunterDist = Infinity;
    let closestHunter: VoidTagPlayerEntity | null = null;
    let totalThreatWeight = 0;

    for (const hunter of hunters) {
      const dx = survivor.x - hunter.x;
      const dy = survivor.y - hunter.y;
      const dist = Math.hypot(dx, dy);

      if (dist < closestHunterDist) {
        closestHunterDist = dist;
        closestHunter = hunter;
      }

      // Stunned hunters pose much lower immediate threat
      const stunMultiplier = hunter.isStunned ? 0.15 : 1.0;
      const dangerThreshold = 480;

      if (dist < dangerThreshold) {
        const weight = (1 - dist / dangerThreshold) * stunMultiplier;
        const normDx = dx / Math.max(1, dist);
        const normDy = dy / Math.max(1, dist);

        threatVectorX += normDx * weight * weight * 3.0;
        threatVectorY += normDy * weight * weight * 3.0;
        totalThreatWeight += weight;
      }
    }

    // 2. Sanctuary Evaluation
    let bestSanctuary: SanctuaryZone | null = null;
    let bestSanctuaryScore = -Infinity;

    for (const sanc of sanctuaries) {
      if (sanc.isDepleted || sanc.energy < 12) continue;

      const dist = Math.hypot(sanc.x - survivor.x, sanc.y - survivor.y);
      let score = (sanc.energy / 100) * 200 - dist * 0.4;

      // Penalize sanctuaries if a hunter is standing right in/near them
      for (const h of hunters) {
        const hDist = Math.hypot(sanc.x - h.x, sanc.y - h.y);
        if (hDist < sanc.radius + 60) {
          score -= 150;
        }
      }

      if (score > bestSanctuaryScore) {
        bestSanctuaryScore = score;
        bestSanctuary = sanc;
      }
    }

    // 3. Inside Sanctuary Behavior
    let goalX = 0;
    let goalY = 0;
    let hasGoal = false;

    if (survivor.isInSanctuary && survivor.sanctuaryId !== null) {
      const currentSanc = sanctuaries.find(s => s.id === survivor.sanctuaryId);
      if (currentSanc && !currentSanc.isDepleted && currentSanc.energy > 15) {
        // Hunter outside? Stay safely anchored near center of sanctuary
        const distFromCenter = Math.hypot(currentSanc.x - survivor.x, currentSanc.y - survivor.y);
        if (distFromCenter > currentSanc.radius * 0.4) {
          goalX = currentSanc.x - survivor.x;
          goalY = currentSanc.y - survivor.y;
          hasGoal = true;
        } else {
          // Jitter/idle inside sanctuary
          return {
            x: 0,
            y: 0,
            angle: survivor.angle,
            magnitude: 0,
            action1: false,
            action2: false,
            timestamp: Date.now(),
          };
        }
      } else {
        // Energy running low! Time to evacuate to next sanctuary or nebula
        if (bestSanctuary && bestSanctuary.id !== survivor.sanctuaryId) {
          goalX = bestSanctuary.x - survivor.x;
          goalY = bestSanctuary.y - survivor.y;
          hasGoal = true;
        }
      }
    } else if (bestSanctuary && closestHunterDist < 380) {
      // Flee toward sanctuary
      goalX = bestSanctuary.x - survivor.x;
      goalY = bestSanctuary.y - survivor.y;
      hasGoal = true;
    } else if (nebulae.length > 0 && closestHunterDist < 420) {
      // Seek stealth in nearest nebula
      let nearestNeb: NebulaZone | null = null;
      let minNebDist = Infinity;
      for (const neb of nebulae) {
        const d = Math.hypot(neb.x - survivor.x, neb.y - survivor.y);
        if (d < minNebDist) {
          minNebDist = d;
          nearestNeb = neb;
        }
      }
      if (nearestNeb && !survivor.isStealthed) {
        goalX = nearestNeb.x - survivor.x;
        goalY = nearestNeb.y - survivor.y;
        hasGoal = true;
      }
    }

    // 4. Combine Forces: Threat Repulsion + Safe Zone Attraction + Obstacle Cover
    let steerX = threatVectorX * 2.5;
    let steerY = threatVectorY * 2.5;

    if (hasGoal) {
      const gLen = Math.hypot(goalX, goalY);
      if (gLen > 0.001) {
        const goalWeight = totalThreatWeight > 0.6 ? 1.2 : 2.0;
        steerX += (goalX / gLen) * goalWeight;
        steerY += (goalY / gLen) * goalWeight;
      }
    }

    // If no threat and no active goal, patrol/wander
    if (totalThreatWeight < 0.1 && !hasGoal) {
      steerX = Math.cos(survivor.angle + 0.05);
      steerY = Math.sin(survivor.angle + 0.05);
    }

    // 5. Line-of-Sight Break using Space Debris
    if (closestHunter && closestHunterDist < 300) {
      for (const deb of debris) {
        const dSurvivor = Math.hypot(deb.x - survivor.x, deb.y - survivor.y);
        const dHunter = Math.hypot(deb.x - closestHunter.x, deb.y - closestHunter.y);

        // If debris is roughly between hunter and survivor
        if (dSurvivor < 220 && dHunter > dSurvivor) {
          // Steer behind the debris
          const behindX = deb.x + (deb.x - closestHunter.x) / Math.max(1, dHunter) * (deb.radius + 35);
          const behindY = deb.y + (deb.y - closestHunter.y) / Math.max(1, dHunter) * (deb.radius + 35);
          const dx = behindX - survivor.x;
          const dy = behindY - survivor.y;
          const len = Math.hypot(dx, dy);
          if (len > 0.001) {
            steerX += (dx / len) * 1.4;
            steerY += (dy / len) * 1.4;
          }
        }
      }
    }

    // 6. Obstacle Avoidance (don't ram debris head-on)
    const avoidance = this.computeObstacleAvoidance(survivor, debris, sanctuaries, steerX, steerY);
    steerX += avoidance.x * 1.5;
    steerY += avoidance.y * 1.5;

    // 7. Wall Repulsion
    const wallPush = this.computeWallRepulsion(survivor, config);
    steerX += wallPush.x * 2.0;
    steerY += wallPush.y * 2.0;

    // Normalize
    const finalLen = Math.hypot(steerX, steerY);
    const moveX = finalLen > 0.001 ? steerX / finalLen : Math.cos(survivor.angle);
    const moveY = finalLen > 0.001 ? steerY / finalLen : Math.sin(survivor.angle);
    const desiredAngle = Math.atan2(moveY, moveX);

    // 8. Abilities: EMP Shockwave & Phase Dash
    let action1 = false; // Dash
    let action2 = false; // EMP

    if (closestHunter) {
      const isApproaching = this.isEntityApproaching(closestHunter, survivor);

      // EMP Shockwave Trigger: Hunter is close (< 175px), not already stunned, and approaching
      if (
        survivor.empCooldown <= 0 &&
        closestHunterDist < config.empRadius * 0.9 &&
        !closestHunter.isStunned &&
        !closestHunter.isInvulnerable
      ) {
        action2 = true;
      }

      // Phase Dash Trigger: Emergency blink when hunter is in critical tag proximity (< 130px)
      if (
        survivor.dashCooldown <= 0 &&
        closestHunterDist < 135 &&
        !closestHunter.isStunned &&
        isApproaching
      ) {
        action1 = true;
      }
    }

    return {
      x: moveX,
      y: moveY,
      angle: desiredAngle,
      magnitude: 1.0,
      action1,
      action2,
      timestamp: Date.now(),
    };
  }

  // --------------------------------------------------------------------------
  // UTILITY / GEOMETRY HELPERS
  // --------------------------------------------------------------------------
  private static computeObstacleAvoidance(
    entity: VoidTagPlayerEntity,
    debris: SpaceDebris[],
    sanctuaries: SanctuaryZone[],
    dirX: number,
    dirY: number
  ): { x: number; y: number } {
    let avoidX = 0;
    let avoidY = 0;

    // Debris avoidance
    for (const deb of debris) {
      const dx = entity.x - deb.x;
      const dy = entity.y - deb.y;
      const dist = Math.hypot(dx, dy);
      const safeRadius = deb.radius + entity.radius + 35;

      if (dist < safeRadius && dist > 0.001) {
        const force = (safeRadius - dist) / safeRadius;
        // Tangential evasion
        const tangentX = -dy / dist;
        const tangentY = dx / dist;
        const dot = dirX * tangentX + dirY * tangentY;
        const sign = dot >= 0 ? 1 : -1;

        avoidX += (dx / dist) * force * 1.5 + tangentX * sign * force * 1.2;
        avoidY += (dy / dist) * force * 1.5 + tangentY * sign * force * 1.2;
      }
    }

    // For hunters: avoid bumping into active light sanctuaries if survivors are shielded inside
    if (entity.isHunter) {
      for (const sanc of sanctuaries) {
        if (!sanc.isDepleted && sanc.energy > 5) {
          const dx = entity.x - sanc.x;
          const dy = entity.y - sanc.y;
          const dist = Math.hypot(dx, dy);
          const safeRadius = sanc.radius + entity.radius + 10;

          if (dist < safeRadius && dist > 0.001) {
            const force = (safeRadius - dist) / safeRadius;
            avoidX += (dx / dist) * force * 2.0;
            avoidY += (dy / dist) * force * 2.0;
          }
        }
      }
    }

    return { x: avoidX, y: avoidY };
  }

  private static computeWallRepulsion(
    entity: VoidTagPlayerEntity,
    config: VoidTagEngineConfig
  ): { x: number; y: number } {
    const margin = 80;
    let pushX = 0;
    let pushY = 0;

    if (entity.x < margin) {
      pushX += Math.pow((margin - entity.x) / margin, 2);
    } else if (entity.x > config.arenaWidth - margin) {
      pushX -= Math.pow((entity.x - (config.arenaWidth - margin)) / margin, 2);
    }

    if (entity.y < margin) {
      pushY += Math.pow((margin - entity.y) / margin, 2);
    } else if (entity.y > config.arenaHeight - margin) {
      pushY -= Math.pow((entity.y - (config.arenaHeight - margin)) / margin, 2);
    }

    return { x: pushX, y: pushY };
  }

  private static hasLineOfSight(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    debris: SpaceDebris[]
  ): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return true;

    const dirX = dx / dist;
    const dirY = dy / dist;

    for (const deb of debris) {
      // Project circle center onto line segment
      const toDebX = deb.x - x1;
      const toDebY = deb.y - y1;
      const t = toDebX * dirX + toDebY * dirY;

      if (t > 0 && t < dist) {
        const projX = x1 + dirX * t;
        const projY = y1 + dirY * t;
        const dProj = Math.hypot(deb.x - projX, deb.y - projY);

        if (dProj < deb.radius + 15) {
          return false; // Line of sight blocked by debris
        }
      }
    }

    return true;
  }

  private static isEntityApproaching(source: VoidTagPlayerEntity, target: VoidTagPlayerEntity): boolean {
    const toTargetX = target.x - source.x;
    const toTargetY = target.y - source.y;
    const dot = source.vx * toTargetX + source.vy * toTargetY;
    return dot > 0;
  }

  private static createIdleMovement(bot: VoidTagPlayerEntity, config: VoidTagEngineConfig): ControllerInput {
    const angle = bot.angle + (Math.sin(Date.now() * 0.002) * 0.05);
    return {
      x: Math.cos(angle) * 0.5,
      y: Math.sin(angle) * 0.5,
      angle,
      magnitude: 0.5,
      action1: false,
      action2: false,
      timestamp: Date.now(),
    };
  }

  private static normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  public static reset(): void {
    this.botStates = {};
  }
}
