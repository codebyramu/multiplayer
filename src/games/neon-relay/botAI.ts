import { HovercraftRacer, CircuitTrack, ControllerInput, Vector2D } from './types';
import { distanceToSegment } from './circuit';

export class BotAIController {
  public static computeInput(
    bot: HovercraftRacer,
    allRacers: HovercraftRacer[],
    track: CircuitTrack,
    dt: number,
    difficultyOverride?: 'easy' | 'medium' | 'hard'
  ): ControllerInput {
    if (!bot.botState) {
      bot.botState = {
        archetype: (bot.player.botArchetype as any) || 'aggressive',
        targetWaypointIndex: 0,
        laneOffset: (Math.random() - 0.5) * 45,
        nitroCheckCooldown: 0.5 + Math.random() * 0.5,
        hazardAvoidanceVector: { x: 0, y: 0 },
        reactionDelayTimer: 0,
        steerSmooth: 0,
        difficulty: difficultyOverride || 'medium',
      };
    }

    const state = bot.botState;
    if (difficultyOverride) {
      state.difficulty = difficultyOverride;
    }
    const difficulty: 'easy' | 'medium' | 'hard' = state.difficulty || 'medium';

    const waypoints = track.racingLineWaypoints;
    const numWaypoints = waypoints.length;

    // 1. Find closest waypoint and lookahead point
    let closestIndex = 0;
    let minDistSq = Infinity;
    for (let i = 0; i < numWaypoints; i++) {
      const wp = waypoints[i];
      const dSq = (wp.x - bot.x) ** 2 + (wp.y - bot.y) ** 2;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        closestIndex = i;
      }
    }

    // Dynamic lookahead based on speed & difficulty
    const speedRatio = Math.max(0.2, bot.speed / Math.max(1, bot.maxSpeed));
    const baseLookahead = difficulty === 'hard' ? 6 : difficulty === 'easy' ? 3 : 4;
    const lookaheadSteps = Math.floor(baseLookahead + speedRatio * (difficulty === 'hard' ? 8 : 6));
    const targetIndex = (closestIndex + lookaheadSteps) % numWaypoints;
    state.targetWaypointIndex = targetIndex;

    const baseTarget = waypoints[targetIndex];
    const prevWp = waypoints[(targetIndex - 1 + numWaypoints) % numWaypoints];
    const nextWp = waypoints[(targetIndex + 1) % numWaypoints];

    // Compute track tangent vector and normal vector for lane offset
    const tangentX = nextWp.x - prevWp.x;
    const tangentY = nextWp.y - prevWp.y;
    const tangentLen = Math.hypot(tangentX, tangentY) || 1;
    const normX = -tangentY / tangentLen;
    const normY = tangentX / tangentLen;

    // Adjust lane offset dynamically per archetype and difficulty
    // Easy bots wander across the track with slight sinusoidal wave
    // Hard bots stick tightly to the apex / optimal line
    const wanderOffset = difficulty === 'easy' ? Math.sin((bot.x + bot.y) * 0.005) * 18 : 0;
    const effectiveLaneOffset =
      difficulty === 'hard'
        ? state.laneOffset * 0.3
        : difficulty === 'easy'
        ? (state.laneOffset + wanderOffset) * 1.25
        : state.laneOffset;
    let targetX = baseTarget.x + normX * effectiveLaneOffset;
    let targetY = baseTarget.y + normY * effectiveLaneOffset;

    // 2. Seek nearby Boost Pads
    let boostPadTarget: Vector2D | null = null;
    let minPadDist = difficulty === 'hard' ? 350 : 280;
    for (const pad of track.boostPads) {
      const d = Math.hypot(pad.x - bot.x, pad.y - bot.y);
      if (d < minPadDist) {
        // Check if pad is roughly ahead in direction of travel
        const angleToPad = Math.atan2(pad.y - bot.y, pad.x - bot.x);
        let angleDiff = angleToPad - bot.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const maxAngleTolerance = difficulty === 'hard' ? Math.PI / 2.5 : Math.PI / 3;
        if (Math.abs(angleDiff) < maxAngleTolerance) {
          boostPadTarget = { x: pad.x, y: pad.y };
          minPadDist = d;
        }
      }
    }

    if (boostPadTarget && (difficulty === 'hard' || state.archetype === 'precision' || state.archetype === 'collector' || state.archetype === 'aggressive')) {
      const padWeight = difficulty === 'hard' ? 0.75 : 0.6;
      targetX = targetX * (1 - padWeight) + boostPadTarget.x * padWeight;
      targetY = targetY * (1 - padWeight) + boostPadTarget.y * padWeight;
    }

    // 3. Slipstream Drafting Navigation & Optimization
    // Hard bots aggressively seek and lock onto slipstream cones ahead, then slingshot overtake
    let draftingTarget: Vector2D | null = null;
    let closestRacerAheadDist = difficulty === 'hard' ? 380 : 260;
    let targetDraftRacer: HovercraftRacer | null = null;

    for (const other of allRacers) {
      if (other.id === bot.id || other.finished) continue;
      const d = Math.hypot(other.x - bot.x, other.y - bot.y);
      if (d < closestRacerAheadDist && d > 30) {
        const angleToOther = Math.atan2(other.y - bot.y, other.x - bot.x);
        let angleDiff = angleToOther - bot.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const coneTolerance = difficulty === 'hard' ? Math.PI / 3 : Math.PI / 4;
        if (Math.abs(angleDiff) < coneTolerance) {
          draftingTarget = { x: other.x, y: other.y };
          closestRacerAheadDist = d;
          targetDraftRacer = other;
        }
      }
    }

    if (draftingTarget) {
      if (difficulty === 'hard') {
        // Hard: Draft optimization - lock right behind opponent's tail cone until speed boost peaks
        if (bot.isDrafting && bot.draftTimer > 1.8 && closestRacerAheadDist < 100) {
          // Slingshot maneuver! Steer slightly lateral to overtake cleanly
          const overtakeSide = (bot.id.charCodeAt(0) % 2 === 0) ? 1 : -1;
          targetX = draftingTarget.x + normX * (35 * overtakeSide);
          targetY = draftingTarget.y + normY * (35 * overtakeSide);
        } else {
          // Lock directly into their draft line
          targetX = targetX * 0.3 + draftingTarget.x * 0.7;
          targetY = targetY * 0.3 + draftingTarget.y * 0.7;
        }
      } else if (difficulty === 'medium' && (state.archetype === 'ambusher' || state.archetype === 'aggressive')) {
        targetX = targetX * 0.5 + draftingTarget.x * 0.5;
        targetY = targetY * 0.5 + draftingTarget.y * 0.5;
      }
    }

    // 4. Laser Barrier Obstacle Jump & Avoidance
    let avoidForceX = 0;
    let avoidForceY = 0;
    let wantsJump = false;

    // Laser jump timing by difficulty:
    // Easy: slower reaction times (0.2-0.35s lag), 20% jump chance on hazard detection
    // Medium: balanced reactions (0.08-0.12s lag)
    // Hard: instant laser jump reaction (dist < 210, 0.01-0.03s razor-sharp reaction, clean leap)
    const jumpDetectionDist = difficulty === 'hard' ? 210 : difficulty === 'easy' ? 140 : 170;

    for (const laser of track.lasers) {
      if (!laser.isActive && !laser.isWarning) continue;

      const p1 = laser.currentP1;
      const p2 = laser.currentP2;
      const { dist, normal } = distanceToSegment({ x: bot.x, y: bot.y }, p1, p2);

      if (dist < jumpDetectionDist && (bot.jumpCooldown || 0) <= 0 && (bot.jumpZ || 0) <= 2) {
        if (difficulty === 'easy') {
          // Slower reaction times (0.2-0.35s delay) with 20% jump execution chance
          state.reactionDelayTimer = (state.reactionDelayTimer || 0) + dt;
          if (state.reactionDelayTimer > 0.25 || (dist < 85 && Math.random() < 0.20)) {
            wantsJump = true;
            state.reactionDelayTimer = 0;
          }
        } else if (difficulty === 'medium') {
          state.reactionDelayTimer = (state.reactionDelayTimer || 0) + dt;
          if (state.reactionDelayTimer > 0.09 || dist < 140) {
            wantsJump = true;
            state.reactionDelayTimer = 0;
          }
        } else {
          // Hard: Instant razor-sharp reaction
          wantsJump = true;
        }
      }

      const dangerThreshold = laser.isActive ? (difficulty === 'hard' ? 240 : 200) : 150;
      if (dist < dangerThreshold) {
        const forceMultiplier = difficulty === 'hard' ? 3.0 : 2.0;
        const force = (1.0 - dist / dangerThreshold) * (laser.isActive ? forceMultiplier : 1.2);
        avoidForceX += normal.x * force;
        avoidForceY += normal.y * force;
      }
    }

    // Apply avoidance bias to target
    targetX += avoidForceX * 180;
    targetY += avoidForceY * 180;

    // 5. Compute Steer Angle & Analog Vectors
    const desiredAngle = Math.atan2(targetY - bot.y, targetX - bot.x);
    let angleDelta = desiredAngle - bot.angle;
    while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;

    // Steering smoothing factor (reaction speed)
    const smoothFactor = difficulty === 'hard' ? 0.45 : difficulty === 'easy' ? 0.85 : 0.7;
    state.steerSmooth = state.steerSmooth * smoothFactor + angleDelta * (1 - smoothFactor);
    const steerMag = Math.min(1.0, Math.abs(state.steerSmooth) * (difficulty === 'hard' ? 2.5 : 2.0));

    const inputAngle = desiredAngle;
    const inputX = Math.cos(inputAngle) * steerMag;
    const inputY = Math.sin(inputAngle) * steerMag;

    // 6. Strategic Nitro Timing (action2: Nitro Boost)
    let action2 = false; // Nitro Boost
    state.nitroCheckCooldown -= dt;

    if (state.nitroCheckCooldown <= 0 && bot.nitroEnergy >= (difficulty === 'hard' ? 20 : 25) && !bot.isStunned) {
      // Check track straightness ahead
      const upcomingWp1 = waypoints[(closestIndex + 5) % numWaypoints];
      const upcomingWp2 = waypoints[(closestIndex + 12) % numWaypoints];
      const angle1 = Math.atan2(upcomingWp1.y - bot.y, upcomingWp1.x - bot.x);
      const angle2 = Math.atan2(upcomingWp2.y - upcomingWp1.y, upcomingWp2.x - upcomingWp1.x);
      let trackCurve = Math.abs(angle2 - angle1);
      while (trackCurve > Math.PI) trackCurve -= Math.PI * 2;
      while (trackCurve < -Math.PI) trackCurve += Math.PI * 2;

      const isStraightway = Math.abs(trackCurve) < (difficulty === 'hard' ? 0.6 : 0.45);
      const isDrafting = bot.isDrafting;
      const isFinalLap = bot.currentLap >= 3;

      if (difficulty === 'hard') {
        // Hard: Draft optimization slingshots, straightway blitz, and aggressive nitro dumping on final lap
        action2 =
          (isStraightway && bot.nitroEnergy > 20) ||
          (isDrafting && bot.draftTimer > 1.2) ||
          (isFinalLap && bot.nitroEnergy > 15) ||
          (closestRacerAheadDist < 180 && Math.abs(angleDelta) < 0.3);
      } else if (difficulty === 'easy') {
        // Easy: 20% boost chance on straightways
        action2 = isStraightway && bot.nitroEnergy > 60 && Math.random() < 0.20;
      } else {
        // Medium: Balanced tactical nitro
        if (state.archetype === 'aggressive') {
          action2 = (isStraightway && bot.nitroEnergy > 30) || isDrafting || (isFinalLap && bot.nitroEnergy > 15);
        } else if (state.archetype === 'nitro-junkie') {
          action2 = bot.nitroEnergy > 35;
        } else if (state.archetype === 'precision') {
          action2 = isStraightway && bot.nitroEnergy > 45 && Math.abs(angleDelta) < 0.25;
        } else if (state.archetype === 'ambusher') {
          action2 = isDrafting || (isStraightway && closestRacerAheadDist < 200);
        } else if (state.archetype === 'defensive') {
          action2 = isStraightway && bot.nitroEnergy > 60;
        } else {
          action2 = Math.random() > 0.4 && bot.nitroEnergy > 30;
        }
      }

      state.nitroCheckCooldown = difficulty === 'hard' ? 0.02 + Math.random() * 0.02 : difficulty === 'easy' ? 0.25 + Math.random() * 0.1 : 0.10 + Math.random() * 0.05;
    }

    return {
      x: inputX,
      y: inputY,
      angle: inputAngle,
      magnitude: 1.0,
      action1: wantsJump,
      action2,
      timestamp: Date.now(),
    };
  }
}
