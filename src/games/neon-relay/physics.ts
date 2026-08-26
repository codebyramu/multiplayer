import { HovercraftRacer, CircuitTrack, ControllerInput, NeonRelayConfig, Vector2D, BoostPadData, SuperchargeZone } from './types';
import { distanceToSegment } from './circuit';
import { ParticleSystem } from './particles';

export class NeonRelayPhysics {
  // 1. Update single hovercraft motion, thrust, dynamic drift, and nitro
  public static updateRacer(
    racer: HovercraftRacer,
    input: ControllerInput,
    config: NeonRelayConfig,
    dt: number,
    particles: ParticleSystem
  ): void {
    // Invulnerability & cooldown timers
    if (racer.invulnerableTimer > 0) racer.invulnerableTimer = Math.max(0, racer.invulnerableTimer - dt);
    if (racer.flashTimer > 0) racer.flashTimer = Math.max(0, racer.flashTimer - dt);
    if (racer.boostPadTimer > 0) racer.boostPadTimer = Math.max(0, racer.boostPadTimer - dt);
    if (racer.boostPadCooldown > 0) racer.boostPadCooldown = Math.max(0, racer.boostPadCooldown - dt);
    if (racer.wallImpactTimer > 0) racer.wallImpactTimer = Math.max(0, racer.wallImpactTimer - dt);

    // Stun Spinout handling with progressive recovery animation
    if (racer.isStunned) {
      racer.stunTimer -= dt;

      // Phase 1: High spin (stunTimer > 0.25s)
      // Phase 2: Decelerating spin with alignment recovery (stunTimer <= 0.25s)
      if (racer.stunTimer > 0.25) {
        racer.angularVelocity = 14 * Math.min(1.0, racer.stunTimer / 0.85);
        racer.angle += racer.angularVelocity * dt;
      } else if (racer.stunTimer > 0) {
        // Recovery steer phase: smoothly align towards motion velocity or target
        const motionAngle = Math.hypot(racer.vx, racer.vy) > 10 ? Math.atan2(racer.vy, racer.vx) : racer.targetAngle;
        let recoveryDiff = motionAngle - racer.angle;
        while (recoveryDiff > Math.PI) recoveryDiff -= Math.PI * 2;
        while (recoveryDiff < -Math.PI) recoveryDiff += Math.PI * 2;
        racer.angularVelocity = racer.angularVelocity * 0.7 + recoveryDiff * 8 * 0.3;
        racer.angle += racer.angularVelocity * dt;
      }

      racer.vx *= Math.pow(0.86, dt * 60);
      racer.vy *= Math.pow(0.86, dt * 60);
      racer.speed = Math.hypot(racer.vx, racer.vy);
      racer.x += racer.vx * dt;
      racer.y += racer.vy * dt;

      // Emit electrical arcs while spinning
      if (Math.random() < 0.3) {
        particles.emitLaserZap(racer.x + (Math.random() - 0.5) * 16, racer.y + (Math.random() - 0.5) * 16);
      }

      if (racer.stunTimer <= 0) {
        racer.isStunned = false;
        racer.angularVelocity = 0;
        particles.emitFloatingText(racer.x, racer.y - 25, '⚡ RECOVERED! ⚡', '#00F5A0');
      }
      return;
    }

    // Supercharge status timer decay
    if (racer.superchargeTimer && racer.superchargeTimer > 0) {
      racer.superchargeTimer = Math.max(0, racer.superchargeTimer - dt);
      if (racer.superchargeTimer === 0) {
        racer.isSupercharged = false;
      }
    }

    // Steering Angle
    if (input.magnitude > 0.1) {
      racer.targetAngle = input.angle;
    }

    // Compute shortest angular difference
    let angleDiff = racer.targetAngle - racer.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Smooth rotational interpolation with angular inertia
    const turnRate = config.turnSpeed * (input.magnitude > 0.1 ? input.magnitude : 0.6);
    racer.angularVelocity = racer.angularVelocity * 0.75 + angleDiff * turnRate * 0.25;
    racer.angle += racer.angularVelocity * dt;

    // Banking visual tilt
    racer.bankingAngle = racer.bankingAngle * 0.8 + Math.max(-0.4, Math.min(0.4, racer.angularVelocity * 0.12)) * 0.2;

    // Check Modifier: Overdrive Nitro (Infinite Nitro Boost)
    const isOverdriveNitro = typeof config.modifiers === 'object' && !Array.isArray(config.modifiers)
      ? !!config.modifiers.overdriveNitro
      : Array.isArray(config.modifiers) && config.modifiers.includes('overdrive_nitro');

    // 3D Jump & Hop Mechanics (action1: Jump over laser barriers & track obstacles)
    if (racer.jumpCooldown === undefined) racer.jumpCooldown = 0;
    if (racer.jumpZ === undefined) racer.jumpZ = 0;
    if (racer.jumpVz === undefined) racer.jumpVz = 0;

    racer.jumpCooldown = Math.max(0, racer.jumpCooldown - dt);

    if (input.action1 && racer.jumpCooldown <= 0 && racer.jumpZ <= 1) {
      racer.jumpVz = 340;
      racer.isJumping = true;
      racer.jumpCooldown = 0.75;
      particles.emitRingShockwave(racer.x, racer.y, racer.color, 45);
      particles.emitFloatingText(racer.x, racer.y - 30, '🚀 JUMP!', '#00F5A0');
    }

    if (racer.isJumping || racer.jumpZ > 0) {
      racer.jumpVz -= 750 * dt;
      racer.jumpZ = Math.max(0, racer.jumpZ + racer.jumpVz * dt);
      if (racer.jumpZ === 0) {
        racer.jumpVz = 0;
        racer.isJumping = false;
        particles.emitSparks(racer.x, racer.y, { x: 0, y: -1 }, racer.color, 10);
      }
    }

    // Nitro & Boost System (action2: Accelerate with nitro energy & trail effects)
    const wantsNitro = input.action2 && (isOverdriveNitro || racer.nitroEnergy > 2);
    if (wantsNitro) {
      racer.isBoosting = true;
      if (!isOverdriveNitro) {
        racer.nitroEnergy = Math.max(0, racer.nitroEnergy - racer.nitroBurnRate * dt);
      }
    } else {
      racer.isBoosting = false;
      const rechargeMult = racer.isDrafting ? 2.0 : 1.0;
      racer.nitroEnergy = Math.min(racer.maxNitroEnergy, racer.nitroEnergy + racer.nitroRechargeRate * rechargeMult * dt);
    }

    // Dynamic Top Speed & Thrust Computation
    let dynamicMaxSpeed = config.baseMaxSpeed;
    let dynamicThrust = config.baseThrust;

    if (racer.isBoosting) {
      dynamicMaxSpeed = config.nitroMaxSpeed;
      dynamicThrust = config.nitroThrust;
    }
    if (racer.boostPadTimer > 0) {
      dynamicMaxSpeed = Math.max(dynamicMaxSpeed, config.boostPadSpeed);
      dynamicThrust *= 1.6;
    }
    if (racer.isDrafting) {
      dynamicMaxSpeed *= 1.25;
      dynamicThrust *= 1.35;
    }
    // SUPERCHARGE ZONE: 2X Speed Highway Multiplier
    if (racer.isSupercharged || (racer.superchargeTimer && racer.superchargeTimer > 0)) {
      dynamicMaxSpeed = Math.max(dynamicMaxSpeed, config.baseMaxSpeed * 2.0);
      dynamicThrust *= 2.0;
    }

    racer.maxSpeed = dynamicMaxSpeed;

    // Forward Heading Vector
    const forwardX = Math.cos(racer.angle);
    const forwardY = Math.sin(racer.angle);
    const perpX = -forwardY;
    const perpY = forwardX;

    // Apply Forward Thrust
    const accelInput = input.magnitude > 0.05 ? input.magnitude : (wantsNitro ? 1.0 : 0.85);
    racer.isAccelerating = accelInput > 0.1;
    if (racer.isAccelerating) {
      racer.vx += forwardX * dynamicThrust * accelInput * dt;
      racer.vy += forwardY * dynamicThrust * accelInput * dt;
    }

    // Dynamic Drift Decomposition:
    // Project velocity into longitudinal (forward) and lateral (sideways) components
    const vForward = racer.vx * forwardX + racer.vy * forwardY;
    const vLateral = racer.vx * perpX + racer.vy * perpY;

    // Apply asymmetric friction (low forward drag, high lateral grip/drift resistance)
    const forwardFriction = Math.pow(config.forwardFriction, dt * 60);
    const lateralFriction = Math.pow(config.driftFriction, dt * 60);

    const newVForward = vForward * forwardFriction;
    const newVLateral = vLateral * lateralFriction;

    // Reconstruct velocity
    racer.vx = newVForward * forwardX + newVLateral * perpX;
    racer.vy = newVForward * forwardY + newVLateral * perpY;

    // Speed Clamping
    racer.speed = Math.hypot(racer.vx, racer.vy);
    if (racer.speed > dynamicMaxSpeed) {
      const scale = dynamicMaxSpeed / racer.speed;
      racer.vx *= scale;
      racer.vy *= scale;
      racer.speed = dynamicMaxSpeed;
    }

    // Integrate Position
    racer.x += racer.vx * dt;
    racer.y += racer.vy * dt;

    // Hover wobble & engine audio pitch
    racer.hoverBobPhase += dt * (5 + (racer.speed / config.baseMaxSpeed) * 8);
    racer.engineHumPitch = 120 + (racer.speed / config.baseMaxSpeed) * 220 + (racer.isBoosting ? 180 : 0);

    // Emit exhaust particles
    if (racer.speed > 25 || racer.isBoosting || racer.isSupercharged) {
      particles.emitExhaust(
        racer.x - forwardX * 18,
        racer.y - forwardY * 18,
        racer.angle,
        racer.isSupercharged ? '#FFE600' : racer.color,
        racer.isBoosting || !!racer.isSupercharged,
        racer.speed / dynamicMaxSpeed
      );
    }

    if (racer.isBoosting || racer.boostPadTimer > 0 || racer.isSupercharged) {
      const streakColor = racer.isSupercharged ? '#FFE600' : racer.isBoosting ? '#00E5FF' : '#FFB224';
      particles.emitSpeedStreak(racer.x, racer.y, racer.angle, streakColor);
    }
  }

  // 2. Multi-craft Elastic Collisions & Bumping
  public static resolveRacerCollisions(racers: HovercraftRacer[], particles: ParticleSystem): void {
    for (let i = 0; i < racers.length; i++) {
      const r1 = racers[i];
      for (let j = i + 1; j < racers.length; j++) {
        const r2 = racers[j];

        const dx = r2.x - r1.x;
        const dy = r2.y - r1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = r1.radius + r2.radius;

        if (dist < minDist && dist > 0.001) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart equally
          r1.x -= nx * overlap * 0.5;
          r1.y -= ny * overlap * 0.5;
          r2.x += nx * overlap * 0.5;
          r2.y += ny * overlap * 0.5;

          // Elastic collision impulse
          const kx = r1.vx - r2.vx;
          const ky = r1.vy - r2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2; // Equal mass

          r1.vx -= p * nx * 0.8;
          r1.vy -= p * ny * 0.8;
          r2.vx += p * nx * 0.8;
          r2.vy += p * ny * 0.8;

          // Emit collision sparks at impact contact point
          const midX = (r1.x + r2.x) / 2;
          const midY = (r1.y + r2.y) / 2;
          particles.emitSparks(midX, midY, { x: nx, y: ny }, '#FFB224', 10);
        }
      }
    }
  }

  // 3. Track Barrier Collisions
  public static resolveWallCollisions(
    racer: HovercraftRacer,
    track: CircuitTrack,
    particles: ParticleSystem
  ): void {
    const allBoundaries = [...track.outerBoundaries, ...track.innerBoundaries];

    // Multi-pass iterative solver to prevent penetration at maximum speed (780 - 1020 px/s)
    for (let iter = 0; iter < 3; iter++) {
      let hasCollided = false;

      for (const seg of allBoundaries) {
        const { dist, closest, normal } = distanceToSegment({ x: racer.x, y: racer.y }, seg.p1, seg.p2);

        if (dist < racer.radius) {
          hasCollided = true;
          const penetration = racer.radius - dist;
          racer.x += normal.x * penetration;
          racer.y += normal.y * penetration;

          // Reflect velocity with restitution damping
          const dot = racer.vx * normal.x + racer.vy * normal.y;
          if (dot < 0) {
            const impactSpeed = Math.abs(dot);
            const restitution = 0.55;
            racer.vx = (racer.vx - (1 + restitution) * dot * normal.x) * 0.85;
            racer.vy = (racer.vy - (1 + restitution) * dot * normal.y) * 0.85;
            racer.speed = Math.hypot(racer.vx, racer.vy);

            // Trigger impact flash and spark effects on wall grind/impact
            if (iter === 0) {
              if (impactSpeed > 180) {
                racer.flashTimer = Math.max(racer.flashTimer, 0.25);
                racer.wallImpactTimer = 0.3;
                racer.bankingAngle += (Math.random() - 0.5) * 0.4;
                particles.emitSparks(closest.x, closest.y, normal, '#FFB224', 16);
                if (impactSpeed > 320) {
                  particles.emitRingShockwave(closest.x, closest.y, '#FFB224', 60);
                }
              } else {
                particles.emitSparks(closest.x, closest.y, normal, racer.color, 8);
              }
            }
          }
        }
      }

      if (!hasCollided) break;
    }

    // World canvas boundary clamping
    const worldW = track.width || 2800;
    const worldH = track.height || 1900;
    racer.x = Math.max(racer.radius, Math.min(worldW - racer.radius, racer.x));
    racer.y = Math.max(racer.radius, Math.min(worldH - racer.radius, racer.y));
  }

  // 4. Check & Apply Boost Pads with One-Shot Propulsion & Cooldown
  public static checkBoostPads(
    racer: HovercraftRacer,
    boostPads: BoostPadData[],
    particles: ParticleSystem,
    onBoost?: () => void
  ): void {
    for (const pad of boostPads) {
      // Check distance to pad center
      const dx = racer.x - pad.x;
      const dy = racer.y - pad.y;
      const dist = Math.hypot(dx, dy);
      const isInside = dist < pad.width * 0.6;

      if (isInside) {
        // One-shot velocity kick: only triggers if pad cooldown has elapsed
        if (racer.boostPadCooldown <= 0 && racer.boostPadTimer <= 0.1) {
          racer.boostPadTimer = pad.durationMs / 1000;
          racer.boostPadCooldown = pad.durationMs / 1000 + 0.6; // Prevents glitching/continuous kicking while standing on pad
          racer.lastBoostPadId = pad.id;
          
          // Propel strongly in pad direction
          const padAngle = pad.angle;
          const boostSpeed = 1020;
          racer.vx = Math.cos(padAngle) * boostSpeed;
          racer.vy = Math.sin(padAngle) * boostSpeed;
          racer.angle = padAngle;
          racer.targetAngle = padAngle;
          racer.flashTimer = Math.max(racer.flashTimer, 0.2);

          particles.emitFloatingText(racer.x, racer.y - 25, '⚡ HYPER BOOST! ⚡', '#00E5FF');
          particles.emitCheckpointCapture(racer.x, racer.y, '#00E5FF');
          particles.emitRingShockwave(pad.x, pad.y, '#00E5FF', 75);
          if (onBoost) onBoost();
        }
      } else {
        if (racer.lastBoostPadId === pad.id) {
          racer.lastBoostPadId = null;
        }
      }
    }
  }

  // 5. Slipstream / Drafting Detection (Active Moving Opponents Only)
  public static updateDrafting(racers: HovercraftRacer[], particles: ParticleSystem): void {
    for (const follower of racers) {
      if (follower.finished || follower.isStunned || follower.speed < 80) {
        follower.isDrafting = false;
        follower.draftTargetId = null;
        follower.draftTimer = 0;
        continue;
      }

      let foundLeader: HovercraftRacer | null = null;
      let minDistance = 240;

      for (const leader of racers) {
        // Must be an active, moving opponent craft (not finished, not stunned, speed >= 120)
        if (leader.id === follower.id || leader.finished || leader.isStunned || leader.speed < 120) {
          continue;
        }

        const dx = leader.x - follower.x;
        const dy = leader.y - follower.y;
        const dist = Math.hypot(dx, dy);

        // Guard against zero/near-zero distance (overlap) to avoid divide-by-zero
        if (dist >= 45 && dist <= minDistance) {
          // Angle from follower to leader
          const angleToLeader = Math.atan2(dy, dx);
          let angleDiff = angleToLeader - follower.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          // Check heading alignment
          let headingDiff = leader.angle - follower.angle;
          while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
          while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;

          if (Math.abs(angleDiff) < Math.PI / 4 && Math.abs(headingDiff) < Math.PI / 3) {
            foundLeader = leader;
            minDistance = dist;
          }
        }
      }

      if (foundLeader) {
        follower.isDrafting = true;
        follower.draftTargetId = foundLeader.id;
        follower.draftTimer += 0.016;

        if (follower.draftTimer > 0.25) {
          particles.emitSlipstream(foundLeader.x, foundLeader.y, follower.x, follower.y, follower.color);
        }
      } else {
        follower.isDrafting = false;
        follower.draftTargetId = null;
        follower.draftTimer = 0;
      }
    }
  }

  // 6. Laser Collision & Hazard Detection (Invulnerability Cooldown Protection)
  public static checkLasers(
    racer: HovercraftRacer,
    lasers: CircuitTrack['lasers'],
    particles: ParticleSystem,
    onHitLaser?: (racerId: string) => void
  ): void {
    // Check invulnerability cooldown and jump clearance (jumping over lasers: jumpZ > 12)
    if (racer.invulnerableTimer > 0 || racer.isStunned || (racer.jumpZ !== undefined && racer.jumpZ > 12)) return;

    for (const laser of lasers) {
      if (!laser.isActive) continue;

      const { dist, closest } = distanceToSegment({ x: racer.x, y: racer.y }, laser.currentP1, laser.currentP2);

      if (dist < racer.radius + 6) {
        // Lethal laser hit
        racer.isStunned = true;
        racer.stunTimer = 0.9;
        racer.invulnerableTimer = 2.2; // Grace period so racer can clear hazard area safely
        racer.flashTimer = 0.6;

        // Velocity damping & energy penalty
        racer.vx *= 0.25;
        racer.vy *= 0.25;
        racer.nitroEnergy = Math.max(0, racer.nitroEnergy - 30);

        // Zap explosion & shockwave
        particles.emitLaserZap(closest.x, closest.y);
        particles.emitRingShockwave(racer.x, racer.y, '#FF3366', 95);
        particles.emitFloatingText(racer.x, racer.y - 30, '⚡ LASER STUN! ⚡', '#FF3366');

        if (onHitLaser) onHitLaser(racer.id);
        break; // Ensure only one laser hit is registered this frame
      }
    }
  }

  // 7. Supercharge Highway Zone Detection (Temporary 2X Speed Highway)
  public static checkSuperchargeZones(
    racer: HovercraftRacer,
    zones: SuperchargeZone[] | undefined,
    particles: ParticleSystem,
    onSupercharge?: (racerId: string) => void
  ): void {
    if (!zones || zones.length === 0) return;

    for (const zone of zones) {
      if (!zone.active) continue;

      // Check if racer is inside rectangular oriented highway zone
      const dx = racer.x - zone.x;
      const dy = racer.y - zone.y;

      // Rotate point into zone local space
      const cos = Math.cos(-zone.angle);
      const sin = Math.sin(-zone.angle);
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;

      const halfW = zone.width / 2;
      const halfH = zone.height / 2;

      if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
        const wasSupercharged = racer.isSupercharged;
        racer.isSupercharged = true;
        racer.superchargeTimer = 0.35; // Hysteresis grace while cruising through zone

        if (!wasSupercharged) {
          particles.emitFloatingText(racer.x, racer.y - 30, '⚡ 2X SUPERCHARGED! ⚡', '#FFE600');
          particles.emitRingShockwave(racer.x, racer.y, '#FFE600', 80);
          if (onSupercharge) onSupercharge(racer.id);
        }

        // Emit high-energy golden particles while on highway
        if (Math.random() < 0.4) {
          particles.emitSpeedStreak(racer.x, racer.y, racer.angle, '#FFE600');
        }
      }
    }
  }
}
