import { CircuitTrack, CheckpointData, BoostPadData, LaserBarrierData, Vector2D, LineSegment, NeonRelayModifierId, NeonRelayModifiersConfig, SuperchargeZone } from './types';

// Utility helper to create line segment
function seg(x1: number, y1: number, x2: number, y2: number): LineSegment {
  return { p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 } };
}

export function parseModifiers(modifiers?: NeonRelayModifierId[] | NeonRelayModifiersConfig): NeonRelayModifiersConfig {
  if (!modifiers) return {};
  if (Array.isArray(modifiers)) {
    return {
      overdriveNitro: modifiers.includes('overdrive_nitro'),
      laserHazardStorm: modifiers.includes('laser_hazard_storm'),
      mirroredCircuit: modifiers.includes('mirrored_circuit'),
    };
  }
  return modifiers;
}

export function createNeonSpeedwayCircuit(modifiersInput?: NeonRelayModifierId[] | NeonRelayModifiersConfig): CircuitTrack {
  const width = 2800;
  const height = 1900;
  const modifiers = parseModifiers(modifiersInput);
  const isMirrored = !!modifiers.mirroredCircuit;
  const isLaserStorm = !!modifiers.laserHazardStorm;

  // 8 Sequential Checkpoints around the circuit
  let checkpoints: CheckpointData[] = [
    {
      id: 0,
      name: 'GATE 0 / FINISH ARCH',
      x: 550,
      y: 350,
      radius: 130,
      width: 240,
      angle: Math.PI / 2, // Vertical gate (racer travels right)
      isFinishLine: true,
      pulsePhase: 0,
    },
    {
      id: 1,
      name: 'SECTOR 1 / HYPER STRAIGHT',
      x: 1300,
      y: 350,
      radius: 130,
      width: 240,
      angle: Math.PI / 2,
      isFinishLine: false,
      pulsePhase: 0.8,
    },
    {
      id: 2,
      name: 'SECTOR 2 / NEON SWEEP',
      x: 2150,
      y: 550,
      radius: 140,
      width: 260,
      angle: Math.PI / 4,
      isFinishLine: false,
      pulsePhase: 1.6,
    },
    {
      id: 3,
      name: 'SECTOR 3 / LASER CHICANE',
      x: 2350,
      y: 1150,
      radius: 130,
      width: 240,
      angle: 0, // Horizontal gate (racer travels down)
      isFinishLine: false,
      pulsePhase: 2.4,
    },
    {
      id: 4,
      name: 'SECTOR 4 / LOWER SPEEDWAY ENTRY',
      x: 1950,
      y: 1550,
      radius: 135,
      width: 250,
      angle: -Math.PI / 4,
      isFinishLine: false,
      pulsePhase: 3.2,
    },
    {
      id: 5,
      name: 'SECTOR 5 / PULSE STRAIGHT',
      x: 1200,
      y: 1550,
      radius: 130,
      width: 240,
      angle: -Math.PI / 2, // Racer travels left
      isFinishLine: false,
      pulsePhase: 4.0,
    },
    {
      id: 6,
      name: 'SECTOR 6 / COSMIC HAIRPIN',
      x: 450,
      y: 1400,
      radius: 140,
      width: 260,
      angle: -3 * Math.PI / 4,
      isFinishLine: false,
      pulsePhase: 4.8,
    },
    {
      id: 7,
      name: 'SECTOR 7 / FINAL APPROACH',
      x: 350,
      y: 750,
      radius: 130,
      width: 240,
      angle: 0, // Racer travels up
      isFinishLine: false,
      pulsePhase: 5.6,
    },
  ];

  // Directional Boost Pads embedded in track surface
  let boostPads: BoostPadData[] = [
    {
      id: 1,
      x: 950,
      y: 350,
      width: 140,
      height: 70,
      angle: 0, // Propels right
      boostMultiplier: 1.6,
      durationMs: 1200,
    },
    {
      id: 2,
      x: 2350,
      y: 850,
      width: 70,
      height: 140,
      angle: Math.PI / 2, // Propels down
      boostMultiplier: 1.5,
      durationMs: 1000,
    },
    {
      id: 3,
      x: 1550,
      y: 1550,
      width: 140,
      height: 70,
      angle: Math.PI, // Propels left
      boostMultiplier: 1.6,
      durationMs: 1200,
    },
    {
      id: 4,
      x: 350,
      y: 1050,
      width: 70,
      height: 140,
      angle: -Math.PI / 2, // Propels up
      boostMultiplier: 1.5,
      durationMs: 1100,
    },
  ];

  // Moving / Oscillating Laser Barriers
  const lasers: LaserBarrierData[] = [
    {
      id: 1,
      // Sector 2-3 Chicane: Linear oscillating barrier
      x1: 2200,
      y1: 950,
      x2: 2480,
      y2: 950,
      oscillationType: 'translate',
      periodSeconds: 3.5,
      phaseOffset: 0,
      amplitude: 120, // Moves up and down along y
      activeWindowStart: 0.1,
      activeWindowEnd: 0.8,
      currentP1: { x: 2200, y: 950 },
      currentP2: { x: 2480, y: 950 },
      isActive: true,
      isWarning: false,
    },
    {
      id: 2,
      // Sector 4-5 Crossfire: Rotating laser gate
      x1: 1550,
      y1: 1420,
      x2: 1550,
      y2: 1680,
      oscillationType: 'rotate',
      periodSeconds: 4.0,
      phaseOffset: Math.PI / 3,
      amplitude: 0.65, // Radians rotation sweep
      baseAngle: Math.PI / 2,
      center: { x: 1550, y: 1550 },
      activeWindowStart: 0.15,
      activeWindowEnd: 0.85,
      currentP1: { x: 1550, y: 1420 },
      currentP2: { x: 1550, y: 1680 },
      isActive: true,
      isWarning: false,
    },
    {
      id: 3,
      // Sector 7 Final Approach: Rhythmic cycle barrier
      x1: 220,
      y1: 650,
      x2: 480,
      y2: 650,
      oscillationType: 'cycle',
      periodSeconds: 2.8,
      phaseOffset: Math.PI,
      amplitude: 0,
      activeWindowStart: 0.0,
      activeWindowEnd: 0.6,
      currentP1: { x: 220, y: 650 },
      currentP2: { x: 480, y: 650 },
      isActive: true,
      isWarning: false,
    },
  ];

  // LASER HAZARD STORM: Add additional intense moving & rotating laser gates
  if (isLaserStorm) {
    lasers.push(
      {
        id: 4,
        // Sector 1 Hyper Straight Laser Gate
        x1: 1100,
        y1: 220,
        x2: 1100,
        y2: 480,
        oscillationType: 'translate',
        periodSeconds: 3.0,
        phaseOffset: 1.2,
        amplitude: 60,
        activeWindowStart: 0.1,
        activeWindowEnd: 0.75,
        currentP1: { x: 1100, y: 220 },
        currentP2: { x: 1100, y: 480 },
        isActive: true,
        isWarning: false,
      },
      {
        id: 5,
        // Sector 5 Pulse Straight Oscillating Gate
        x1: 950,
        y1: 1420,
        x2: 950,
        y2: 1680,
        oscillationType: 'translate',
        periodSeconds: 3.2,
        phaseOffset: 2.0,
        amplitude: 70,
        activeWindowStart: 0.2,
        activeWindowEnd: 0.8,
        currentP1: { x: 950, y: 1420 },
        currentP2: { x: 950, y: 1680 },
        isActive: true,
        isWarning: false,
      },
      {
        id: 6,
        // Sector 6 Cosmic Hairpin Rotating Sweeper
        x1: 450,
        y1: 1300,
        x2: 450,
        y2: 1500,
        oscillationType: 'rotate',
        periodSeconds: 3.8,
        phaseOffset: 0.5,
        amplitude: 0.8,
        baseAngle: 0,
        center: { x: 450, y: 1400 },
        activeWindowStart: 0.1,
        activeWindowEnd: 0.85,
        currentP1: { x: 450, y: 1300 },
        currentP2: { x: 450, y: 1500 },
        isActive: true,
        isWarning: false,
      },
      {
        id: 7,
        // Sector 2 Neon Sweep Cross-Gate
        x1: 1750,
        y1: 280,
        x2: 1850,
        y2: 520,
        oscillationType: 'cycle',
        periodSeconds: 2.5,
        phaseOffset: 1.8,
        amplitude: 0,
        activeWindowStart: 0.15,
        activeWindowEnd: 0.7,
        currentP1: { x: 1750, y: 280 },
        currentP2: { x: 1850, y: 520 },
        isActive: true,
        isWarning: false,
      }
    );
  }

  // Outer Boundary Wall Segments (Closed Loop Polygon)
  let outerPoly: Vector2D[] = [
    { x: 200, y: 220 },
    { x: 1500, y: 220 },
    { x: 2250, y: 380 },
    { x: 2580, y: 800 },
    { x: 2580, y: 1250 },
    { x: 2150, y: 1680 },
    { x: 1100, y: 1680 },
    { x: 320, y: 1600 },
    { x: 200, y: 1350 },
    { x: 200, y: 500 },
  ];

  // Inner Boundary Wall Segments (Central Island Obstacle)
  let innerPoly: Vector2D[] = [
    { x: 480, y: 480 },
    { x: 1400, y: 480 },
    { x: 1950, y: 620 },
    { x: 2200, y: 950 },
    { x: 2200, y: 1200 },
    { x: 1850, y: 1420 },
    { x: 1150, y: 1420 },
    { x: 580, y: 1280 },
    { x: 480, y: 1100 },
    { x: 480, y: 600 },
  ];

  // 48 Dense Racing Line Waypoints for precise AI navigation & distance tracking
  let basePoints: Vector2D[] = [
    { x: 400, y: 350 },
    { x: 750, y: 350 },
    { x: 1100, y: 350 },
    { x: 1450, y: 350 },
    { x: 1800, y: 400 },
    { x: 2100, y: 520 },
    { x: 2320, y: 720 },
    { x: 2390, y: 950 },
    { x: 2380, y: 1180 },
    { x: 2250, y: 1380 },
    { x: 2000, y: 1520 },
    { x: 1650, y: 1550 },
    { x: 1300, y: 1550 },
    { x: 950, y: 1550 },
    { x: 650, y: 1500 },
    { x: 420, y: 1380 },
    { x: 350, y: 1150 },
    { x: 350, y: 880 },
    { x: 350, y: 620 },
    { x: 380, y: 420 },
  ];

  // Staggered 8-player starting grid behind Gate 0
  let startingGrid: Array<{ x: number; y: number; angle: number }> = [
    { x: 420, y: 310, angle: 0 },
    { x: 380, y: 390, angle: 0 },
    { x: 340, y: 310, angle: 0 },
    { x: 300, y: 390, angle: 0 },
    { x: 260, y: 310, angle: 0 },
    { x: 220, y: 390, angle: 0 },
    { x: 180, y: 310, angle: 0 },
    { x: 140, y: 390, angle: 0 },
  ];

  // MIRRORED CIRCUIT MODIFIER: Invert horizontal layout
  if (isMirrored) {
    checkpoints = checkpoints.map((cp) => ({
      ...cp,
      x: width - cp.x,
      angle: Math.PI - cp.angle,
    }));

    boostPads = boostPads.map((pad) => ({
      ...pad,
      x: width - pad.x,
      angle: Math.PI - pad.angle,
    }));

    for (const laser of lasers) {
      const origX1 = laser.x1;
      const origX2 = laser.x2;
      laser.x1 = width - origX1;
      laser.x2 = width - origX2;
      laser.currentP1.x = width - laser.currentP1.x;
      laser.currentP2.x = width - laser.currentP2.x;
      if (laser.center) {
        laser.center.x = width - laser.center.x;
      }
      if (laser.baseAngle !== undefined) {
        laser.baseAngle = Math.PI - laser.baseAngle;
      }
    }

    outerPoly = outerPoly.map((p) => ({ x: width - p.x, y: p.y })).reverse();
    innerPoly = innerPoly.map((p) => ({ x: width - p.x, y: p.y })).reverse();
    basePoints = basePoints.map((p) => ({ x: width - p.x, y: p.y }));

    startingGrid = startingGrid.map((slot) => ({
      x: width - slot.x,
      y: slot.y,
      angle: Math.PI - slot.angle,
    }));
  }

  const outerBoundaries: LineSegment[] = [];
  for (let i = 0; i < outerPoly.length; i++) {
    const next = (i + 1) % outerPoly.length;
    outerBoundaries.push(seg(outerPoly[i].x, outerPoly[i].y, outerPoly[next].x, outerPoly[next].y));
  }

  const innerBoundaries: LineSegment[] = [];
  for (let i = 0; i < innerPoly.length; i++) {
    const next = (i + 1) % innerPoly.length;
    innerBoundaries.push(seg(innerPoly[i].x, innerPoly[i].y, innerPoly[next].x, innerPoly[next].y));
  }

  // Interpolate spline/linear points to produce smooth waypoints
  const waypoints: Vector2D[] = [];
  for (let i = 0; i < basePoints.length; i++) {
    const p0 = basePoints[(i - 1 + basePoints.length) % basePoints.length];
    const p1 = basePoints[i];
    const p2 = basePoints[(i + 1) % basePoints.length];
    const p3 = basePoints[(i + 2) % basePoints.length];

    for (let t = 0; t < 1.0; t += 0.33) {
      // Catmull-Rom spline interpolation
      const t2 = t * t;
      const t3 = t2 * t;

      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      );

      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      );

      waypoints.push({ x, y });
    }
  }

  // Predefined Supercharge Highway Zones available for dynamic activation
  const superchargeZones: SuperchargeZone[] = [
    {
      id: 'supercharge_sector_1',
      name: 'SECTOR 1 SUPERCHARGE HIGHWAY',
      x: isMirrored ? width - 1300 : 1300,
      y: 350,
      width: 650,
      height: 180,
      angle: isMirrored ? Math.PI : 0,
      speedMultiplier: 2.0,
      thrustMultiplier: 2.0,
      active: false,
      duration: 12,
      remainingTime: 0,
      pulsePhase: 0,
      sectorIndex: 1,
    },
    {
      id: 'supercharge_sector_5',
      name: 'SECTOR 5 HYPER CORRIDOR',
      x: isMirrored ? width - 1200 : 1200,
      y: 1550,
      width: 650,
      height: 180,
      angle: isMirrored ? 0 : Math.PI,
      speedMultiplier: 2.0,
      thrustMultiplier: 2.0,
      active: false,
      duration: 12,
      remainingTime: 0,
      pulsePhase: 1.5,
      sectorIndex: 5,
    },
  ];

  return {
    name: isMirrored ? 'NEON RELAY CIRCUIT - MIRRORED SPEEDWAY' : 'NEON RELAY CIRCUIT - ALPHA SPEEDWAY',
    width,
    height,
    innerBoundaries,
    outerBoundaries,
    racingLineWaypoints: waypoints,
    checkpoints,
    boostPads,
    lasers,
    startingGrid,
    superchargeZones,
    isMirrored,
  };
}

// Distance from point to line segment
export function distanceToSegment(p: Vector2D, a: Vector2D, b: Vector2D): { dist: number; closest: Vector2D; normal: Vector2D } {
  const l2 = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
  if (l2 === 0) {
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    return { dist: d, closest: { ...a }, normal: { x: 0, y: -1 } };
  }
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const closest: Vector2D = {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  };
  const dist = Math.hypot(p.x - closest.x, p.y - closest.y);
  const normal: Vector2D = dist > 0.001
    ? { x: (p.x - closest.x) / dist, y: (p.y - closest.y) / dist }
    : { x: -(b.y - a.y) / Math.sqrt(l2), y: (b.x - a.x) / Math.sqrt(l2) };

  return { dist, closest, normal };
}

// Update oscillating lasers
export function updateLasers(lasers: LaserBarrierData[], timeElapsedSeconds: number): void {
  for (const laser of lasers) {
    const cyclePos = ((timeElapsedSeconds + laser.phaseOffset) % laser.periodSeconds) / laser.periodSeconds;
    
    // Check if active or in warning state (0.5s prior to activation)
    const warningLead = 0.12; // 12% of cycle is warning
    let warningStart = laser.activeWindowStart - warningLead;
    if (warningStart < 0) warningStart += 1.0;

    const inActive = cyclePos >= laser.activeWindowStart && cyclePos <= laser.activeWindowEnd;
    const inWarning = !inActive && (
      (laser.activeWindowStart >= warningLead && cyclePos >= (laser.activeWindowStart - warningLead) && cyclePos < laser.activeWindowStart) ||
      (laser.activeWindowStart < warningLead && (cyclePos >= (1.0 + laser.activeWindowStart - warningLead) || cyclePos < laser.activeWindowStart))
    );

    laser.isActive = inActive;
    laser.isWarning = inWarning;

    if (laser.oscillationType === 'translate') {
      const shift = Math.sin((timeElapsedSeconds + laser.phaseOffset) * (2 * Math.PI / laser.periodSeconds)) * laser.amplitude;
      laser.currentP1 = { x: laser.x1, y: laser.y1 + shift };
      laser.currentP2 = { x: laser.x2, y: laser.y2 + shift };
    } else if (laser.oscillationType === 'rotate' && laser.center) {
      const rotAngle = (laser.baseAngle || 0) + Math.sin((timeElapsedSeconds + laser.phaseOffset) * (2 * Math.PI / laser.periodSeconds)) * laser.amplitude;
      const halfLen = Math.hypot(laser.x2 - laser.x1, laser.y2 - laser.y1) / 2;
      laser.currentP1 = {
        x: laser.center.x - Math.cos(rotAngle) * halfLen,
        y: laser.center.y - Math.sin(rotAngle) * halfLen,
      };
      laser.currentP2 = {
        x: laser.center.x + Math.cos(rotAngle) * halfLen,
        y: laser.center.y + Math.sin(rotAngle) * halfLen,
      };
    } else {
      laser.currentP1 = { x: laser.x1, y: laser.y1 };
      laser.currentP2 = { x: laser.x2, y: laser.y2 };
    }
  }
}
