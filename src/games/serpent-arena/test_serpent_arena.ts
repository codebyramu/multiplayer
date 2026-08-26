import { SerpentArenaEngine } from './SerpentArenaEngine';
import { Player, ControllerInput } from '../../types';
import { SerpentPlayerEntity } from './types';

console.log('=== SERPENT ARENA COMPREHENSIVE QA & PHYSICS TEST SUITE ===\n');

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
// TEST 1: SIMULTANEOUS HEAD-ON COLLISION BETWEEN 2 BOOSTING SNAKES
// Requirement: Must eliminate BOTH snakes cleanly with dual explosion jackpots
// ---------------------------------------------------------------------------
console.log('--- TEST 1: SIMULTANEOUS BOOST HEAD-ON COLLISION ---');

{
  const players: Record<string, Player> = {
    p1: { id: 'p1', socketId: 's1', name: 'Alpha', avatar: 'snake', color: '#00F5A0', isHost: true, isReady: true, score: 0, ping: 0, connected: true, lastActive: Date.now() },
    p2: { id: 'p2', socketId: 's2', name: 'Omega', avatar: 'snake', color: '#FF3366', isHost: false, isReady: true, score: 0, ping: 0, connected: true, lastActive: Date.now() },
  };

  const engine = new SerpentArenaEngine(players);
  const snake1 = (engine as any).serpents['p1'] as SerpentPlayerEntity;
  const snake2 = (engine as any).serpents['p2'] as SerpentPlayerEntity;

  // Position both snakes head-on, facing each other, both boosting
  snake1.x = -15;
  snake1.y = 0;
  snake1.prevX = -30;
  snake1.prevY = 0;
  snake1.angle = 0; // Moving right
  snake1.isBoosting = true;
  snake1.invulnerableTimer = 0;
  snake1.length = 35;

  snake2.x = 15;
  snake2.y = 0;
  snake2.prevX = 30;
  snake2.prevY = 0;
  snake2.angle = Math.PI; // Moving left
  snake2.isBoosting = true;
  snake2.invulnerableTimer = 0;
  snake2.length = 20; // Different lengths: boosting head-on must STILL destroy both!

  const foodCountBefore = (engine as any).foods.length;

  // Process collisions
  (engine as any).processCollisions();

  assert(snake1.isDead, 'Snake 1 eliminated in simultaneous boosting head-on collision');
  assert(snake2.isDead, 'Snake 2 eliminated in simultaneous boosting head-on collision');
  assert(snake1.killedBy !== undefined, 'Snake 1 has recorded elimination attribution');
  assert(snake2.killedBy !== undefined, 'Snake 2 has recorded elimination attribution');

  const foodCountAfter = (engine as any).foods.length;
  const spawnedJackpots = foodCountAfter - foodCountBefore;
  assert(spawnedJackpots >= 20, `Dual jackpot pellets spawned after mutual explosion (Spawned: ${spawnedJackpots})`);
}

// ---------------------------------------------------------------------------
// TEST 2: MASS BURNING AT > 3.5S CONTINUOUS BOOST
// Requirement: Must spawn food pellets strictly within arena boundaries & min length 5
// ---------------------------------------------------------------------------
console.log('\n--- TEST 2: MASS BURNING & CRITICAL OVERHEAT ---');

{
  const players: Record<string, Player> = {
    p1: { id: 'p1', socketId: 's1', name: 'Booster', avatar: 'snake', color: '#00E5FF', isHost: true, isReady: true, score: 500, ping: 0, connected: true, lastActive: Date.now() },
  };

  const engine = new SerpentArenaEngine(players);
  const snake = (engine as any).serpents['p1'] as SerpentPlayerEntity;
  snake.x = 0;
  snake.y = 0;
  snake.invulnerableTimer = 0;
  snake.length = 15;
  snake.targetLength = 15;

  // Simulate 4.5 seconds of continuous boosting while steering in circle around center
  for (let i = 0; i < 280; i++) {
    const turnAngle = (i * 0.05) % (Math.PI * 2);
    const boostInput: Record<string, ControllerInput> = {
      p1: { x: Math.cos(turnAngle), y: Math.sin(turnAngle), angle: turnAngle, magnitude: 1.0, action1: true, action2: false, timestamp: Date.now() },
    };
    engine.tick(0.016, boostInput);
  }

  assert(snake.continuousBoostDuration >= 3.5, 'Continuous boost duration exceeded 3.5s threshold');
  assert(snake.isOverheating, 'Snake is flagged in overheating state');
  assert(snake.length >= 5, `Snake length cannot burn below min length 5 (Current: ${snake.length.toFixed(2)})`);
  assert(snake.targetLength >= 5, `Snake targetLength cannot drop below min length 5 (Current: ${snake.targetLength.toFixed(2)})`);

  // Verify all spawned food pellets are strictly within arena boundaries
  const foods = (engine as any).foods;
  const arenaR = (engine as any).config.arenaRadius;
  let allInside = true;
  let maxFoodDist = 0;

  for (const f of foods) {
    const dist = Math.hypot(f.x, f.y);
    if (dist > maxFoodDist) maxFoodDist = dist;
    if (dist > arenaR - 20) {
      allInside = false;
      break;
    }
  }

  assert(allInside, `All food pellets spawned strictly within arena boundaries (Max dist: ${maxFoodDist.toFixed(1)} / Arena: ${arenaR})`);
}

// ---------------------------------------------------------------------------
// TEST 3: SINGULARITY VORTEX & GRAVITATIONAL ATTRACTION PERIMETER SAFETY
// Requirement: Gravitational attraction must never throw snakes outside arena wall boundaries
// ---------------------------------------------------------------------------
console.log('\n--- TEST 3: SINGULARITY VORTEX BOUNDARY SAFETY ---');

{
  const players: Record<string, Player> = {
    p1: { id: 'p1', socketId: 's1', name: 'GravTester', avatar: 'snake', color: '#FFB224', isHost: true, isReady: true, score: 0, ping: 0, connected: true, lastActive: Date.now() },
  };

  const engine = new SerpentArenaEngine(players);
  const snake = (engine as any).serpents['p1'] as SerpentPlayerEntity;
  const arenaR = (engine as any).config.arenaRadius;

  // Place Singularity Vortex near the perimeter
  (engine as any).singularityVortex = {
    id: 'vortex_test',
    x: arenaR * 0.7,
    y: 0,
    radius: 75,
    pullRadius: 500,
    duration: 14,
    remainingTime: 14,
    intensity: 2.0, // High intensity
    pulsePhase: 0,
    rotationAngle: 0,
  };

  // Position snake right near vortex & outer wall
  snake.x = arenaR * 0.85;
  snake.y = 50;
  snake.invulnerableTimer = 0;
  snake.isDead = false;

  // Tick simulation with vortex active
  for (let i = 0; i < 60; i++) {
    (engine as any).updateSingularityVortex(0.016);
  }

  const finalDist = Math.hypot(snake.x, snake.y);
  assert(finalDist <= arenaR - snake.headRadius, `Vortex pull cleanly constrained snake within boundary (Dist: ${finalDist.toFixed(1)} <= ${arenaR - snake.headRadius})`);
  assert(!snake.isDead, 'Snake was not thrown into perimeter energy barrier by gravitational attraction');
}

// ---------------------------------------------------------------------------
// TEST 4: CENTROID CAMERA RESILIENCE UPON SNAKE DEATH
// Requirement: Camera must smoothly re-center without snapping or NaN zoom
// ---------------------------------------------------------------------------
console.log('\n--- TEST 4: CENTROID CAMERA RESILIENCE ---');

{
  const players: Record<string, Player> = {
    p1: { id: 'p1', socketId: 's1', name: 'P1', avatar: 'snake', color: '#00F5A0', isHost: true, isReady: true, score: 0, ping: 0, connected: true, lastActive: Date.now() },
    p2: { id: 'p2', socketId: 's2', name: 'P2', avatar: 'snake', color: '#FF3366', isHost: false, isReady: true, score: 0, ping: 0, connected: true, lastActive: Date.now() },
  };

  const engine = new SerpentArenaEngine(players);
  const snake1 = (engine as any).serpents['p1'];
  const snake2 = (engine as any).serpents['p2'];

  // Test camera with 2 living snakes
  (engine as any).updateCamera(1600, 900);
  assert(!isNaN((engine as any).camera.zoom) && isFinite((engine as any).camera.zoom), 'Camera zoom is valid number with 2 players');
  assert(!isNaN((engine as any).camera.x) && !isNaN((engine as any).camera.y), 'Camera coords are valid numbers with 2 players');

  // Eliminate snake 1 (1 survivor left)
  snake1.isDead = true;
  (engine as any).updateCamera(1600, 900, 'p1'); // Focused on dead player -> falls back cleanly
  assert(!isNaN((engine as any).camera.zoom) && isFinite((engine as any).camera.zoom), 'Camera zoom is valid number when focused player dies');
  assert(!isNaN((engine as any).camera.x) && !isNaN((engine as any).camera.y), 'Camera coords are valid when focused player dies');

  // Eliminate snake 2 (0 survivors left)
  snake2.isDead = true;
  (engine as any).updateCamera(1600, 900);
  assert(!isNaN((engine as any).camera.zoom) && isFinite((engine as any).camera.zoom), 'Camera zoom is valid number with 0 living snakes');
  assert(!isNaN((engine as any).camera.x) && !isNaN((engine as any).camera.y), 'Camera coords valid with 0 living snakes');

  // Edge case: zero or negative viewport dimensions
  (engine as any).updateCamera(0, 0);
  assert(!isNaN((engine as any).camera.zoom) && isFinite((engine as any).camera.zoom), 'Camera handles zero viewport dimensions gracefully');
}

// ---------------------------------------------------------------------------
// TEST 5: LAST MAN STANDING MATCH VICTORY
// ---------------------------------------------------------------------------
console.log('\n--- TEST 5: LAST MAN STANDING MATCH VICTORY ---');

{
  const players: Record<string, Player> = {
    p1: { id: 'p1', socketId: 's1', name: 'WinnerSnake', avatar: 'snake', color: '#00F5A0', isHost: true, isReady: true, score: 200, ping: 0, connected: true, lastActive: Date.now() },
    p2: { id: 'p2', socketId: 's2', name: 'LoserSnake', avatar: 'snake', color: '#FF3366', isHost: false, isReady: true, score: 50, ping: 0, connected: true, lastActive: Date.now() },
  };

  const engine = new SerpentArenaEngine(players);
  const s2 = (engine as any).serpents['p2'];
  (engine as any).eliminateSnake(s2, undefined, 'CRASH');
  (engine as any).checkMatchConditions();

  assert(engine.isMatchOver, 'Match concludes when 1 survivor remains');
  assert(engine.winnerId === 'p1', 'Sole survivor declared winner');
}

console.log(`\n========================================`);
console.log(`SERPENT ARENA: ${passedTests}/${totalTests} TESTS PASSED!`);
console.log(`========================================\n`);
