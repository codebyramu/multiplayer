import { NeonRelayEngine } from './NeonRelayEngine';
import { NeonRelayPhysics } from './physics';
import { Player, ControllerInput } from '../../types';
import { HovercraftRacer } from './types';

console.log('=== NEON RELAY COMPREHENSIVE QA & PHYSICS TEST SUITE ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

// ---------------------------------------------------------------------------
// TEST 1: REVERSE FINISH LINE CROSSING / CHECKPOINT SEQUENCE VALIDATION
// Requirement: Crossing finish line backwards must NOT increment lap count
// ---------------------------------------------------------------------------
console.log('--- TEST 1: REVERSE FINISH LINE CROSSING VALIDATION ---');

{
  const players: Record<string, Player> = {
    r1: { id: 'r1', socketId: 's1', name: 'Racer1', avatar: 'ship', color: '#00F5A0', isHost: true, isReady: true, score: 0, ping: 0, connected: true, lastActive: Date.now() },
  };

  const engine = new NeonRelayEngine();
  engine.init(players);
  const racer = engine.racers[0];

  assert(racer.currentLap === 1, 'Racer starts on Lap 1');
  assert(racer.lastCapturedCheckpointIndex === 0, 'Initial checkpoint captured is 0');
  assert(racer.nextCheckpointIndex === 1, 'Awaiting Checkpoint 1');

  // Move racer backwards directly through Gate 0 (Finish Line)
  const finishCp = engine.track.checkpoints[0];
  racer.x = finishCp.x;
  racer.y = finishCp.y;

  // Try triggering checkpoint detection
  (engine as any).updateRacerCheckpoints(racer);

  assert(racer.currentLap === 1, 'Crossing finish line backwards did NOT increment lap count (still Lap 1)');
  assert(racer.lastCapturedCheckpointIndex === 0, 'lastCapturedCheckpointIndex remained 0');
  assert(racer.nextCheckpointIndex === 1, 'nextCheckpointIndex still points to 1');

  // Now simulate valid full circuit completion (0 -> 1 -> 2 -> ... -> N-1 -> 0)
  const numCp = engine.track.checkpoints.length;
  for (let i = 1; i < numCp; i++) {
    const cp = engine.track.checkpoints[i];
    racer.x = cp.x;
    racer.y = cp.y;
    (engine as any).updateRacerCheckpoints(racer);
    assert(racer.lastCapturedCheckpointIndex === i, `Captured intermediate CP ${i}`);
  }

  assert(racer.lastCapturedCheckpointIndex === numCp - 1, 'Reached final approach checkpoint N-1');
  assert(racer.nextCheckpointIndex === 0, 'Targeting finish gate Checkpoint 0');

  // Now cross finish line forward
  racer.x = finishCp.x;
  racer.y = finishCp.y;
  (engine as any).updateRacerCheckpoints(racer);

  assert(racer.currentLap === 2, 'Valid lap completion incremented currentLap to 2');
  assert(racer.lapTimes.length === 1, 'Recorded lap 1 completion time');
}

// ---------------------------------------------------------------------------
// TEST 2: 3D JUMP (jumpZ > 12) LASER IMMUNITY
// Requirement: Verify bounding box laser clearance during jumps
// ---------------------------------------------------------------------------
console.log('\n--- TEST 2: 3D JUMP LASER IMMUNITY ---');

{
  const players: Record<string, Player> = {
    r1: { id: 'r1', socketId: 's1', name: 'Jumper', avatar: 'ship', color: '#00E5FF', isHost: true, isReady: true, score: 0, ping: 0, connected: true, lastActive: Date.now() },
  };

  const engine = new NeonRelayEngine();
  engine.init(players);
  const racer = engine.racers[0];
  const laser = engine.track.lasers[0];
  laser.isActive = true;

  // Case 2a: Grounded (jumpZ = 0) -> Laser hits and stuns racer
  racer.x = (laser.currentP1.x + laser.currentP2.x) / 2;
  racer.y = (laser.currentP1.y + laser.currentP2.y) / 2;
  racer.jumpZ = 0;
  racer.invulnerableTimer = 0;
  racer.isStunned = false;

  NeonRelayPhysics.checkLasers(racer, engine.track.lasers, engine.particles);
  assert(racer.isStunned, 'Grounded racer (jumpZ = 0) was stunned by laser');

  // Case 2b: Mid-Air 3D Jump (jumpZ = 25 > 12) -> Laser immunity granted!
  racer.isStunned = false;
  racer.stunTimer = 0;
  racer.invulnerableTimer = 0;
  racer.jumpZ = 25; // In air above 12px threshold

  NeonRelayPhysics.checkLasers(racer, engine.track.lasers, engine.particles);
  assert(!racer.isStunned, 'Airborne racer (jumpZ = 25 > 12) jumped cleanly over laser with full immunity');
}

// ---------------------------------------------------------------------------
// TEST 3: WALL COLLISION DAMPED BOUNCE & HIGH-SPEED NON-PENETRATION
// Requirement: Ensure hovercrafts bounce off barriers with damping and never penetrate walls at 780 px/s
// ---------------------------------------------------------------------------
console.log('\n--- TEST 3: WALL COLLISION & HIGH-SPEED NON-PENETRATION ---');

{
  const players: Record<string, Player> = {
    r1: { id: 'r1', socketId: 's1', name: 'Speeder', avatar: 'ship', color: '#FF3366', isHost: true, isReady: true, score: 0, ping: 0, connected: true, lastActive: Date.now() },
  };

  const engine = new NeonRelayEngine();
  engine.init(players);
  const racer = engine.racers[0];

  // Position racer near top outer boundary (y = 200) moving upwards at max nitro speed (780 px/s)
  const topWall = engine.track.outerBoundaries.find(b => Math.abs(b.p1.y - b.p2.y) < 10 && b.p1.y < 300);
  const wallY = topWall ? topWall.p1.y : 225;

  racer.x = 1000;
  racer.y = wallY + 10;
  racer.vx = 0;
  racer.vy = -780; // High-velocity crash into wall
  racer.speed = 780;

  // Integrate and resolve collision
  NeonRelayPhysics.resolveWallCollisions(racer, engine.track, engine.particles);

  assert(racer.y >= wallY + racer.radius - 1, `Racer stopped at boundary (racer.y = ${racer.y.toFixed(1)} >= ${wallY + racer.radius - 1})`);
  assert(racer.vy >= 0, `Velocity reflected away from wall (racer.vy = ${racer.vy.toFixed(1)} >= 0)`);
  assert(racer.speed < 780, `Velocity damped upon impact (speed = ${racer.speed.toFixed(1)} < 780)`);

  // Run 100 rapid high-speed steps directly against walls
  for (let i = 0; i < 100; i++) {
    racer.vy = -780;
    NeonRelayPhysics.resolveWallCollisions(racer, engine.track, engine.particles);
    assert(racer.y >= wallY + racer.radius - 2, `Step ${i}: Never penetrated through wall`);
  }
}

// ---------------------------------------------------------------------------
// TEST 4: DRAFTING SLIPSTREAM & ZERO-DISTANCE OVERLAP PROTECTION
// Requirement: Ensure drafting calculations don't divide by zero when racers overlap
// ---------------------------------------------------------------------------
console.log('\n--- TEST 4: DRAFTING SLIPSTREAM DIVIDE-BY-ZERO GUARD ---');

{
  const players: Record<string, Player> = {
    r1: { id: 'r1', socketId: 's1', name: 'Leader', avatar: 'ship', color: '#00F5A0', isHost: true, isReady: true, score: 0, ping: 0, connected: true, lastActive: Date.now() },
    r2: { id: 'r2', socketId: 's2', name: 'Follower', avatar: 'ship', color: '#00E5FF', isHost: false, isReady: true, score: 0, ping: 0, connected: true, lastActive: Date.now() },
  };

  const engine = new NeonRelayEngine();
  engine.init(players);
  const r1 = engine.racers[0];
  const r2 = engine.racers[1];

  // Case 4a: Exact identical positions (overlap: dx=0, dy=0, dist=0)
  r1.x = 500;
  r1.y = 500;
  r1.speed = 300;
  r1.angle = 0;

  r2.x = 500;
  r2.y = 500;
  r2.speed = 300;
  r2.angle = 0;

  NeonRelayPhysics.updateDrafting(engine.racers, engine.particles);
  assert(!isNaN(r2.draftTimer), 'Drafting timer is valid number on exact craft overlap');
  assert(!r2.isDrafting, 'Cannot draft while overlapping at 0 distance');

  // Case 4b: Valid drafting cone (follower 120px directly behind leader)
  r1.x = 650;
  r1.y = 500;
  r1.speed = 300;
  r1.angle = 0; // Heading right

  r2.x = 530; // 120px behind
  r2.y = 500;
  r2.speed = 300;
  r2.angle = 0; // Heading right

  NeonRelayPhysics.updateDrafting(engine.racers, engine.particles);
  assert(r2.isDrafting, 'Follower correctly triggered slipstream drafting behind leader');
  assert(r2.draftTargetId === r1.id, 'Drafting target correctly bound to leader');
}

// ---------------------------------------------------------------------------
// TEST 5: DETERMINISTIC PODIUM RANKING
// ---------------------------------------------------------------------------
console.log('\n--- TEST 5: DETERMINISTIC PODIUM RANKING ---');

{
  const rA: HovercraftRacer = {
    id: 'rA',
    currentLap: 3,
    lastCapturedCheckpointIndex: 4,
    progressDistance: 25000,
    finished: true,
    finishRank: 1,
    finishTime: 42.5,
    lapTimes: [14.0, 14.2, 14.3],
  } as any;

  const rB: HovercraftRacer = {
    id: 'rB',
    currentLap: 3,
    lastCapturedCheckpointIndex: 4,
    progressDistance: 24500,
    finished: true,
    finishRank: 2,
    finishTime: 44.1,
    lapTimes: [14.5, 14.6, 15.0],
  } as any;

  assert(NeonRelayEngine.sortRacersDeterministic(rA, rB) < 0, 'Finished Rank 1 beats Finished Rank 2');
}

console.log(`\n========================================`);
console.log(`NEON RELAY: ${passedTests}/${totalTests} TESTS PASSED!`);
console.log(`========================================\n`);
