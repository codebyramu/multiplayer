import { ControllerInput } from '../../types';
import { BotPersonality, FoodPellet, GoldenStormZone, SingularityVortexZone, SerpentPlayerEntity } from './types';

export class SerpentAIBrain {
  private static decisionTimers: Record<string, number> = {};
  private static botStates: Record<
    string,
    {
      stateTimer: number;
      targetAngle: number;
      targetId?: string;
      chaoticPhase: number;
      ambushWaitTimer: number;
      lastDecisionTime: number;
      cachedDesiredAngle: number;
      cachedWantsBoost: boolean;
    }
  > = {};

  /**
   * Main decision step for an AI-controlled snake bot
   */
  public static computeBotInput(
    bot: SerpentPlayerEntity,
    allSerpents: Record<string, SerpentPlayerEntity>,
    foods: FoodPellet[],
    goldenStorm: GoldenStormZone | null,
    arenaRadius: number,
    dt: number,
    singularityVortex?: SingularityVortexZone | null,
    difficultyOverride?: 'easy' | 'medium' | 'hard'
  ): ControllerInput {
    const botId = bot.id;
    if (!this.botStates[botId]) {
      this.botStates[botId] = {
        stateTimer: 0,
        targetAngle: bot.angle,
        chaoticPhase: Math.random() * Math.PI * 2,
        ambushWaitTimer: 0,
        lastDecisionTime: -999,
        cachedDesiredAngle: bot.angle,
        cachedWantsBoost: false,
      };
    }

    const state = this.botStates[botId];
    state.stateTimer += dt;
    state.chaoticPhase += dt * 3;

    // Resolve difficulty (defaults to medium)
    const rawDiff = difficultyOverride || bot.difficulty || 'medium';
    const difficulty: 'easy' | 'medium' | 'hard' =
      rawDiff === 'easy' ? 'easy' : rawDiff === 'hard' ? 'hard' : 'medium';

    // Difficulty Decision Interval:
    // Easy: slower reaction times (0.2-0.35s lag)
    // Medium: balanced reactions (0.08-0.12s)
    // Hard: razor-sharp reactions (0.01-0.03s)
    const decisionInterval = difficulty === 'easy' ? 0.25 : difficulty === 'medium' ? 0.10 : 0.02;

    let desiredAngle = state.cachedDesiredAngle;
    let wantsBoost = state.cachedWantsBoost;

    if (state.stateTimer - state.lastDecisionTime >= decisionInterval) {
      state.lastDecisionTime = state.stateTimer;

      const personality = bot.botPersonality || 'collector';

      // 1. ARCHETYPE INTENT COMPUTATION WITH DIFFICULTY SCALING
      switch (personality) {
        case 'aggressive':
          ({ desiredAngle, wantsBoost } = this.computeAggressive(bot, allSerpents, foods, state, difficulty));
          break;

        case 'defensive':
          ({ desiredAngle, wantsBoost } = this.computeDefensive(bot, allSerpents, foods, arenaRadius, difficulty));
          break;

        case 'collector':
          ({ desiredAngle, wantsBoost } = this.computeCollector(bot, foods, goldenStorm, difficulty));
          break;

        case 'ambusher':
          ({ desiredAngle, wantsBoost } = this.computeAmbusher(bot, allSerpents, foods, arenaRadius, state, dt, difficulty));
          break;

        case 'chaotic':
          ({ desiredAngle, wantsBoost } = this.computeChaotic(bot, foods, state, difficulty));
          break;
      }

      // Easy wandering & boost adjustments
      if (difficulty === 'easy') {
        // Easy: wanders with wandering noise
        desiredAngle += Math.sin(state.chaoticPhase * 0.7) * 0.25;
        // Easy: 20% boost chance
        wantsBoost = wantsBoost && Math.random() < 0.20;
      }

      state.cachedDesiredAngle = desiredAngle;
      state.cachedWantsBoost = wantsBoost;
    }

    // 2. WHISKER-BASED COLLISION AVOIDANCE & WALL RAYCASTING
    // Easy: wider collision margin (35px), relaxed turn
    // Medium: balanced collision margin (12px)
    // Hard: instant razor-sharp raycasts with surgical clearance (4px)
    const avoidance = this.computeCollisionAvoidance(bot, allSerpents, arenaRadius, difficulty);
    if (avoidance.needsAvoidance) {
      desiredAngle = avoidance.safeAngle;
      if (avoidance.urgency > 0.8 && bot.length > 20) {
        if (difficulty !== 'easy' || Math.random() < 0.20) {
          wantsBoost = true;
        }
      }
    }

    // Wrap desired angle to [0, 2*PI]
    const normalizedAngle = (desiredAngle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

    const isNearOverheat = (bot.continuousBoostDuration || 0) >= (difficulty === 'hard' ? 2.9 : 2.8);
    const minLengthForBoost = difficulty === 'hard' ? 12 : 14;
    const allowBoost = wantsBoost && bot.length > minLengthForBoost && (!isNearOverheat || avoidance.urgency > 0.85);

    return {
      x: Math.cos(normalizedAngle),
      y: Math.sin(normalizedAngle),
      angle: normalizedAngle,
      magnitude: 1.0,
      action1: allowBoost,
      action2: false,
      timestamp: Date.now(),
    };
  }

  // -------------------------------------------------------------
  // 1. AGGRESSIVE PERSONALITY
  // -------------------------------------------------------------
  private static computeAggressive(
    bot: SerpentPlayerEntity,
    allSerpents: Record<string, SerpentPlayerEntity>,
    foods: FoodPellet[],
    state: { targetId?: string; stateTimer: number },
    difficulty: 'easy' | 'medium' | 'hard'
  ): { desiredAngle: number; wantsBoost: boolean } {
    let closestPrey: SerpentPlayerEntity | null = null;
    let minDist = difficulty === 'hard' ? 950 : 700;

    for (const id in allSerpents) {
      const other = allSerpents[id];
      if (other.id === bot.id || other.isDead || other.invulnerableTimer > 0) continue;

      const dist = Math.hypot(other.x - bot.x, other.y - bot.y);
      const lengthThreshold = difficulty === 'hard' ? bot.length * 1.5 : bot.length * 1.3;
      if (dist < minDist && other.length <= lengthThreshold) {
        minDist = dist;
        closestPrey = other;
      }
    }

    if (closestPrey) {
      if (difficulty === 'hard') {
        // Hard: Aggressive Trapping & Head Interception
        // Compute forward position of opponent's head
        const leadMultiplier = 1.3;
        const leadTime = Math.min(1.5, minDist / Math.max(1, bot.speed * leadMultiplier));
        const preyHeadingX = Math.cos(closestPrey.angle) * closestPrey.speed * leadTime;
        const preyHeadingY = Math.sin(closestPrey.angle) * closestPrey.speed * leadTime;

        // Cut across their forward vector
        const targetX = closestPrey.x + preyHeadingX;
        const targetY = closestPrey.y + preyHeadingY;

        // If significantly longer, circle/trap the opponent
        let desiredAngle: number;
        if (bot.length > closestPrey.length * 1.4 && minDist < 280) {
          // Coil around prey
          const orbitAngle = Math.atan2(closestPrey.y - bot.y, closestPrey.x - bot.x) + 0.85;
          desiredAngle = orbitAngle;
        } else {
          desiredAngle = Math.atan2(targetY - bot.y, targetX - bot.x);
        }

        const angleDiff = Math.abs(this.angleDifference(bot.angle, desiredAngle));
        // Hard: aggressively boost to cut them off or close in the coil
        const wantsBoost = minDist < 360 && angleDiff < 1.15;
        return { desiredAngle, wantsBoost };
      }

      // Medium / Easy: Predict target forward position to intercept
      const leadTime = difficulty === 'easy' ? 0.3 : Math.min(1.2, minDist / (bot.speed * 1.5));
      const targetX = closestPrey.x + Math.cos(closestPrey.angle) * closestPrey.speed * leadTime;
      const targetY = closestPrey.y + Math.sin(closestPrey.angle) * closestPrey.speed * leadTime;

      const desiredAngle = Math.atan2(targetY - bot.y, targetX - bot.x);
      const angleDiff = Math.abs(this.angleDifference(bot.angle, desiredAngle));

      const wantsBoost = minDist < 240 && angleDiff < 0.6;
      return { desiredAngle, wantsBoost };
    }

    // Fallback: Seek nearest food
    return { desiredAngle: this.getNearestFoodAngle(bot, foods, difficulty), wantsBoost: false };
  }

  // -------------------------------------------------------------
  // 2. DEFENSIVE PERSONALITY
  // -------------------------------------------------------------
  private static computeDefensive(
    bot: SerpentPlayerEntity,
    allSerpents: Record<string, SerpentPlayerEntity>,
    foods: FoodPellet[],
    arenaRadius: number,
    difficulty: 'easy' | 'medium' | 'hard'
  ): { desiredAngle: number; wantsBoost: boolean } {
    let repelX = 0;
    let repelY = 0;
    let highestThreatDist = 9999;
    let threatFound = false;

    const threatDistance = difficulty === 'easy' ? 240 : difficulty === 'hard' ? 400 : 320;

    for (const id in allSerpents) {
      const other = allSerpents[id];
      if (other.id === bot.id || other.isDead) continue;

      const dist = Math.hypot(other.x - bot.x, other.y - bot.y);
      if (dist < threatDistance && other.length >= bot.length * (difficulty === 'hard' ? 0.8 : 0.9)) {
        const weight = (threatDistance - dist) / threatDistance;
        repelX += (bot.x - other.x) * weight;
        repelY += (bot.y - other.y) * weight;
        threatFound = true;
        if (dist < highestThreatDist) highestThreatDist = dist;
      }
    }

    // Repel from perimeter walls (keep near inner circle)
    const distFromCenter = Math.hypot(bot.x, bot.y);
    const wallMargin = difficulty === 'hard' ? 0.75 : 0.65;
    if (distFromCenter > arenaRadius * wallMargin) {
      const wallWeight = (distFromCenter - arenaRadius * wallMargin) / (arenaRadius * (1 - wallMargin));
      repelX += -bot.x * wallWeight * 2;
      repelY += -bot.y * wallWeight * 2;
    }

    if (threatFound && (Math.abs(repelX) > 1 || Math.abs(repelY) > 1)) {
      const desiredAngle = Math.atan2(repelY, repelX);
      const wantsBoost = highestThreatDist < (difficulty === 'hard' ? 200 : 160);
      return { desiredAngle, wantsBoost };
    }

    return { desiredAngle: this.getNearestFoodAngle(bot, foods, difficulty), wantsBoost: false };
  }

  // -------------------------------------------------------------
  // 3. COLLECTOR PERSONALITY (Optimal Food Routing)
  // -------------------------------------------------------------
  private static computeCollector(
    bot: SerpentPlayerEntity,
    foods: FoodPellet[],
    goldenStorm: GoldenStormZone | null,
    difficulty: 'easy' | 'medium' | 'hard'
  ): { desiredAngle: number; wantsBoost: boolean } {
    // If a Golden Storm is active, rush directly into it
    if (goldenStorm && goldenStorm.remainingTime > 1) {
      const distToStorm = Math.hypot(goldenStorm.x - bot.x, goldenStorm.y - bot.y);
      const maxStormSeekDist = difficulty === 'hard' ? 1600 : 1200;
      if (distToStorm < maxStormSeekDist) {
        const desiredAngle = Math.atan2(goldenStorm.y - bot.y, goldenStorm.x - bot.x);
        const wantsBoost = distToStorm > 100 && bot.length > 20;
        return { desiredAngle, wantsBoost };
      }
    }

    if (difficulty === 'hard') {
      // Hard: Optimal Food Routing via cluster density & high-value pellets
      let bestFood: FoodPellet | null = null;
      let highestScore = -9999;

      for (const food of foods) {
        const dist = Math.hypot(food.x - bot.x, food.y - bot.y);
        if (dist > 800) continue;

        // Base score from food value and proximity
        let score = (food.value * 60) / Math.max(15, dist);
        if (food.type === 'golden_orb') score *= 5;
        else if (food.type === 'jackpot') score *= 3.5;
        else if (food.type === 'magnetic') score *= 2.2;
        else if (food.type === 'shed') score *= 1.8;

        // Density heuristic: check how many pellets are near this candidate
        let nearbyCount = 0;
        for (const other of foods) {
          if (Math.hypot(other.x - food.x, other.y - food.y) < 90) {
            nearbyCount++;
          }
        }
        score += nearbyCount * 12;

        if (score > highestScore) {
          highestScore = score;
          bestFood = food;
        }
      }

      if (bestFood) {
        const desiredAngle = Math.atan2(bestFood.y - bot.y, bestFood.x - bot.x);
        const dist = Math.hypot(bestFood.x - bot.x, bestFood.y - bot.y);
        const wantsBoost = (bestFood.value >= 3.5 || dist > 220) && bot.length > 18;
        return { desiredAngle, wantsBoost };
      }
    } else {
      // Normal / Easy food scoring
      let bestFood: FoodPellet | null = null;
      let highestScore = -9999;

      for (const food of foods) {
        const dist = Math.hypot(food.x - bot.x, food.y - bot.y);
        if (dist > (difficulty === 'easy' ? 400 : 600)) continue;

        let score = (food.value * 40) / Math.max(20, dist);
        if (food.type === 'golden_orb') score *= 3;
        if (food.type === 'jackpot') score *= 2;

        if (score > highestScore) {
          highestScore = score;
          bestFood = food;
        }
      }

      if (bestFood) {
        const desiredAngle = Math.atan2(bestFood.y - bot.y, bestFood.x - bot.x);
        const wantsBoost = bestFood.value >= 4 && Math.hypot(bestFood.x - bot.x, bestFood.y - bot.y) < 200;
        return { desiredAngle, wantsBoost };
      }
    }

    return { desiredAngle: bot.angle, wantsBoost: false };
  }

  // -------------------------------------------------------------
  // 4. AMBUSHER PERSONALITY
  // -------------------------------------------------------------
  private static computeAmbusher(
    bot: SerpentPlayerEntity,
    allSerpents: Record<string, SerpentPlayerEntity>,
    foods: FoodPellet[],
    arenaRadius: number,
    state: { ambushWaitTimer: number },
    dt: number,
    difficulty: 'easy' | 'medium' | 'hard'
  ): { desiredAngle: number; wantsBoost: boolean } {
    state.ambushWaitTimer += dt;

    let stalkTarget: SerpentPlayerEntity | null = null;
    let minDist = 600;

    for (const id in allSerpents) {
      const other = allSerpents[id];
      if (other.id === bot.id || other.isDead || other.invulnerableTimer > 0) continue;

      const dist = Math.hypot(other.x - bot.x, other.y - bot.y);
      if (dist < minDist && other.length >= 20) {
        minDist = dist;
        stalkTarget = other;
      }
    }

    if (stalkTarget) {
      const dist = Math.hypot(stalkTarget.x - bot.x, stalkTarget.y - bot.y);

      // Cut in front with tactical boost
      const ambushTriggerDist = difficulty === 'hard' ? 240 : 180;
      const waitThreshold = difficulty === 'hard' ? 1.0 : 2.0;

      if (dist < ambushTriggerDist && state.ambushWaitTimer > waitThreshold) {
        state.ambushWaitTimer = 0;
        const leadDist = difficulty === 'hard' ? 120 : 90;
        const cutX = stalkTarget.x + Math.cos(stalkTarget.angle + 0.6) * leadDist;
        const cutY = stalkTarget.y + Math.sin(stalkTarget.angle + 0.6) * leadDist;
        return {
          desiredAngle: Math.atan2(cutY - bot.y, cutX - bot.x),
          wantsBoost: true,
        };
      }

      // Shadow behind their tail
      const tail = stalkTarget.body[stalkTarget.body.length - 1] || stalkTarget;
      const desiredAngle = Math.atan2(tail.y - bot.y, tail.x - bot.x);
      return { desiredAngle, wantsBoost: false };
    }

    // Patrol perimeter ring
    const orbitAngle = Math.atan2(bot.y, bot.x) + 0.4;
    const patrolX = Math.cos(orbitAngle) * (arenaRadius * 0.75);
    const patrolY = Math.sin(orbitAngle) * (arenaRadius * 0.75);

    return {
      desiredAngle: Math.atan2(patrolY - bot.y, patrolX - bot.x),
      wantsBoost: false,
    };
  }

  // -------------------------------------------------------------
  // 5. CHAOTIC PERSONALITY
  // -------------------------------------------------------------
  private static computeChaotic(
    bot: SerpentPlayerEntity,
    foods: FoodPellet[],
    state: { chaoticPhase: number; stateTimer: number },
    difficulty: 'easy' | 'medium' | 'hard'
  ): { desiredAngle: number; wantsBoost: boolean } {
    const oscSpeed = difficulty === 'hard' ? 1.6 : 1.2;
    const oscillation = Math.sin(state.chaoticPhase) * oscSpeed;
    let baseAngle = bot.angle + oscillation;

    if (Math.floor(state.stateTimer) % 3 === 0 && Math.sin(state.chaoticPhase * 2) > 0.7) {
      baseAngle += Math.PI * 0.6;
    }

    const wantsBoost = Math.sin(state.chaoticPhase * 1.5) > 0.4;
    return { desiredAngle: baseAngle, wantsBoost };
  }

  // -------------------------------------------------------------
  // WHISKER-BASED COLLISION AVOIDANCE & WALL RAYCASTING
  // -------------------------------------------------------------
  private static computeCollisionAvoidance(
    bot: SerpentPlayerEntity,
    allSerpents: Record<string, SerpentPlayerEntity>,
    arenaRadius: number,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ): { needsAvoidance: boolean; safeAngle: number; urgency: number } {
    // Whisker count & angular spreads scaled by difficulty
    const whiskerAngles =
      difficulty === 'hard'
        ? [-1.4, -1.0, -0.6, -0.25, 0, 0.25, 0.6, 1.0, 1.4]
        : difficulty === 'easy'
        ? [-1.1, -0.5, 0, 0.5, 1.1]
        : [-1.3, -0.8, -0.35, 0, 0.35, 0.8, 1.3];

    // Lookahead distance & safety margin by difficulty
    const lookaheadDist =
      difficulty === 'easy'
        ? Math.max(180, bot.speed * 0.85)
        : difficulty === 'hard'
        ? Math.max(110, bot.speed * 0.55)
        : Math.max(130, bot.speed * 0.65);

    // Collision buffer
    const collisionMargin =
      difficulty === 'easy' ? 35 : difficulty === 'hard' ? 4 : 12;

    const scores = new Array(whiskerAngles.length).fill(0);
    let maxThreatUrgency = 0;

    const inwardAngle = Math.atan2(-bot.y, -bot.x);
    const distFromCenter = Math.hypot(bot.x, bot.y);
    const nearWallDist = arenaRadius - bot.headRadius - collisionMargin - 40;
    const isNearWall = distFromCenter > nearWallDist;

    for (let w = 0; w < whiskerAngles.length; w++) {
      const checkAngle = bot.angle + whiskerAngles[w];
      const rayEndX = bot.x + Math.cos(checkAngle) * lookaheadDist;
      const rayEndY = bot.y + Math.sin(checkAngle) * lookaheadDist;

      let rayClearDist = lookaheadDist;

      // 1. Check arena boundary collision
      const rayCenterDist = Math.hypot(rayEndX, rayEndY);
      const wallBound = arenaRadius - bot.headRadius - collisionMargin;
      if (rayCenterDist > wallBound) {
        const wallThreat = (rayCenterDist - wallBound) / lookaheadDist;
        rayClearDist = Math.max(0, lookaheadDist * (1 - Math.min(1, wallThreat)));
        maxThreatUrgency = Math.max(maxThreatUrgency, Math.min(1.0, wallThreat));
      }

      // 2. Check enemy snake bodies
      for (const id in allSerpents) {
        const other = allSerpents[id];
        if (other.isDead) continue;

        const startSeg = other.id === bot.id ? 8 : 0; // Don't collide with own head/neck

        for (let s = startSeg; s < other.body.length; s += 2) {
          const seg = other.body[s];
          const d = this.distToSegment(bot.x, bot.y, rayEndX, rayEndY, seg.x, seg.y);
          const minSafeDist = bot.headRadius + seg.radius + collisionMargin;

          if (d < minSafeDist) {
            const hitDist = Math.hypot(seg.x - bot.x, seg.y - bot.y);
            rayClearDist = Math.min(rayClearDist, hitDist);
            const urgency = 1 - hitDist / lookaheadDist;
            maxThreatUrgency = Math.max(maxThreatUrgency, urgency);
          }
        }
      }

      // Penalty for boundary penetration + alignment with inward center vector
      const penetrationPenalty = Math.max(0, rayCenterDist - wallBound) * 1.5;
      let score = rayClearDist - penetrationPenalty - Math.abs(whiskerAngles[w]) * 15;
      if (isNearWall) {
        const inwardAlignment = Math.cos(checkAngle - inwardAngle);
        score += inwardAlignment * 45;
      }

      scores[w] = score;
    }

    if (isNearWall) {
      const wallUrgency = (distFromCenter - nearWallDist) / 40;
      maxThreatUrgency = Math.max(maxThreatUrgency, Math.min(1.0, wallUrgency));
    }

    const centerIdx = Math.floor(whiskerAngles.length / 2);
    const triggerThreshold = difficulty === 'easy' ? 0.85 : 0.70;
    const urgencyThreshold = difficulty === 'easy' ? 0.20 : 0.35;

    if (scores[centerIdx] < lookaheadDist * triggerThreshold || maxThreatUrgency > urgencyThreshold) {
      let bestWhiskerIndex = centerIdx;
      let highestScore = -Infinity;

      for (let w = 0; w < scores.length; w++) {
        if (scores[w] > highestScore) {
          highestScore = scores[w];
          bestWhiskerIndex = w;
        }
      }

      const safeAngle = bot.angle + whiskerAngles[bestWhiskerIndex];
      return {
        needsAvoidance: true,
        safeAngle: isNaN(safeAngle) ? bot.angle : safeAngle,
        urgency: maxThreatUrgency,
      };
    }

    return { needsAvoidance: false, safeAngle: bot.angle, urgency: 0 };
  }

  // -------------------------------------------------------------
  // MATH UTILITIES
  // -------------------------------------------------------------
  private static getNearestFoodAngle(
    bot: SerpentPlayerEntity,
    foods: FoodPellet[],
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ): number {
    let nearest: FoodPellet | null = null;
    let minDist = 9999;

    for (const f of foods) {
      const d = Math.hypot(f.x - bot.x, f.y - bot.y);
      if (d < minDist) {
        minDist = d;
        nearest = f;
      }
    }

    if (nearest) {
      return Math.atan2(nearest.y - bot.y, nearest.x - bot.x);
    }
    return bot.angle;
  }

  private static angleDifference(a: number, b: number): number {
    const diff = (b - a + Math.PI) % (Math.PI * 2) - Math.PI;
    return diff < -Math.PI ? diff + Math.PI * 2 : diff;
  }

  private static distToSegment(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    px: number,
    py: number
  ): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  public static reset(): void {
    this.decisionTimers = {};
    this.botStates = {};
  }
}
