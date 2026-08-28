import { SerpentArenaEngine } from './serpent-arena/SerpentArenaEngine';
import { SerpentAIBrain } from './serpent-arena/SerpentAIBrain';
import { NeonRelayEngine } from './neon-relay/NeonRelayEngine';
import { BotAIController } from './neon-relay/botAI';
import { VoidTagEngine } from './void-tag/VoidTagEngine';
import { VoidTagBotAI } from './void-tag/VoidTagBotAI';
import { RelicRushEngine } from './relic-rush/RelicRushEngine';
import { LastPlatformEngine } from './last-platform/LastPlatformEngine';
import { BotAI } from './last-platform/BotAI';
import { HexGrid } from './last-platform/HexGrid';
import { Player, RoomState, ControllerInput } from '../types';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    throw new Error(`Test failed: ${testName} - ${detail || ''}`);
  }
}

function checkNoNaN(obj: any, context: string) {
  if (typeof obj === 'number') {
    if (isNaN(obj)) throw new Error(`NaN found in ${context}`);
    if (!isFinite(obj)) throw new Error(`Infinite value found in ${context}`);
  } else if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      checkNoNaN(obj[key], `${context}.${key}`);
    }
  }
}

console.log('===============================================================');
console.log('🚀 HYPERCADE AUTONOMOUS BOT SIMULATION & AI QA AUDIT (5 GAMES)');
console.log('===============================================================\n');

// -----------------------------------------------------------------------------
// 1. SERPENT ARENA AUDIT
// -----------------------------------------------------------------------------
console.log('--- 1. AUDITING SERPENT ARENA (SerpentAIBrain.ts) ---');

const personalities: Array<'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic'> = [
  'aggressive',
  'defensive',
  'collector',
  'ambusher',
  'chaotic',
];
const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];

for (const diff of difficulties) {
  console.log(`\n  [Serpent Arena - Difficulty: ${diff.toUpperCase()}]`);

  const serpentPlayers: Record<string, Player> = {};
  personalities.forEach((pers, idx) => {
    serpentPlayers[`bot_${pers}`] = {
      id: `bot_${pers}`,
      socketId: `sock_${idx}`,
      name: `[AI] ${pers.toUpperCase()}`,
      avatar: 'snake',
      color: '#00F5A0',
      isHost: idx === 0,
      isBot: true,
      botArchetype: pers,
      isReady: true,
      score: 0,
      ping: 0,
      connected: true,
      lastActive: Date.now(),
    };
  });

  const engine = new SerpentArenaEngine(serpentPlayers, { difficulty: diff, roundDuration: 60 });
  assert(engine !== null, `SerpentArenaEngine created under ${diff}`);

  // Simulate 120 ticks (2 seconds) and check 0 NaNs and valid inputs
  let allInputsValid = true;
  for (let tick = 0; tick < 120; tick++) {
    const inputs: Record<string, ControllerInput> = {};
    engine.tick(0.016, inputs);

    for (const id in serpentPlayers) {
      const input = inputs[id];
      if (input) {
        checkNoNaN(input, `Serpent Arena bot ${id} input at tick ${tick}`);
        if (isNaN(input.x) || isNaN(input.y) || isNaN(input.angle) || isNaN(input.magnitude)) {
          allInputsValid = false;
        }
      }
    }
  }
  assert(allInputsValid, `All bot inputs are valid non-NaN vectors on ${diff}`);

  // Test Personality Specific Behaviors:
  // A. Collector seeking Golden Storm
  SerpentAIBrain.reset();
  const collectorBot = {
    id: 'test_collector',
    name: 'CollectorBot',
    color: '#00F5A0',
    skin: 'synth' as any,
    isBot: true,
    botPersonality: 'collector' as const,
    x: 100,
    y: 100,
    prevX: 100,
    prevY: 100,
    vx: 100,
    vy: 0,
    angle: 0,
    targetAngle: 0,
    angularVelocity: 0,
    speed: 195,
    baseSpeed: 195,
    boostSpeed: 351,
    turnSpeed: 4.2,
    headRadius: 18,
    score: 0,
    mass: 25,
    length: 25,
    targetLength: 25,
    energy: 100,
    maxEnergy: 100,
    isBoosting: false,
    boostDistanceAccumulator: 0,
    continuousBoostDuration: 0,
    isOverheating: false,
    body: [{ x: 100, y: 100, angle: 0, radius: 18 }],
    history: [{ x: 100, y: 100, angle: 0, distance: 0 }],
    totalDistanceTraveled: 0,
    isDead: false,
    kills: 0,
    deaths: 0,
    invulnerableTimer: 0,
    eyeBlinkTimer: 2,
    eyeBlinkState: 0,
    lookAtOffsetAngle: 0,
    pulseTime: 0,
    skinSeed: 0,
    difficulty: diff,
    hyperBoostTimer: 0,
    ghostHuntTimer: 0,
  };

  const storm = {
    id: 'storm_test',
    x: 600,
    y: 600,
    radius: 350,
    maxRadius: 350,
    duration: 15,
    remainingTime: 15,
    intensity: 1.0,
    pulsePhase: 0,
    lastSpawnTime: 0,
  };

  const collectorInput = SerpentAIBrain.computeBotInput(
    collectorBot,
    { [collectorBot.id]: collectorBot },
    [],
    storm,
    1350,
    0.016,
    null,
    diff
  );
  const angleToStorm = Math.atan2(storm.y - collectorBot.y, storm.x - collectorBot.x);
  const diffStormAngle = Math.abs((collectorInput.angle - angleToStorm + Math.PI * 3) % (Math.PI * 2) - Math.PI);
  assert(diffStormAngle < 0.25, `Collector bot directly targets active Golden Storm zone under ${diff}`);

  // B. Boost Backoff before Critical Overheat (3.5s)
  collectorBot.continuousBoostDuration = 3.0; // Overheat warning territory
  collectorBot.length = 30;
  const overheatInput = SerpentAIBrain.computeBotInput(
    collectorBot,
    { [collectorBot.id]: collectorBot },
    [],
    null,
    1350,
    0.016,
    null,
    diff
  );
  assert(!overheatInput.action1, `Bot backs off boost when near overheat duration (3.0s) under ${diff}`);

  // C. Wall Avoidance: Near perimeter facing outward
  collectorBot.x = 1260; // 90px from 1350 boundary
  collectorBot.y = 0;
  collectorBot.angle = 0; // Pointing directly towards wall
  collectorBot.continuousBoostDuration = 0;

  const wallAvoidanceInput = SerpentAIBrain.computeBotInput(
    collectorBot,
    { [collectorBot.id]: collectorBot },
    [],
    null,
    1350,
    0.016,
    null,
    diff
  );
  // Desired angle should turn significantly away from 0 (towards center Math.PI)
  const isTurningAwayFromWall = Math.abs(wallAvoidanceInput.angle) > 0.4;
  assert(isTurningAwayFromWall, `Bot steers away from perimeter wall when facing boundary under ${diff}`);
}

// D. Comparative Difficulty Stress Test: Boost & Trapping Differences
console.log('\n  [Serpent Arena - Comparative Behavioral Difference Test]');
SerpentAIBrain.reset();
const testPrey = {
  id: 'prey_target',
  name: 'Prey',
  color: '#FFFFFF',
  skin: 'synth' as any,
  isBot: false,
  botPersonality: 'collector' as const,
  x: 200,
  y: 0,
  prevX: 190,
  prevY: 0,
  vx: 195,
  vy: 0,
  angle: 0,
  targetAngle: 0,
  angularVelocity: 0,
  speed: 195,
  baseSpeed: 195,
  boostSpeed: 351,
  turnSpeed: 4.2,
  headRadius: 18,
  score: 0,
  mass: 20,
  length: 20,
  targetLength: 20,
  energy: 100,
  maxEnergy: 100,
  isBoosting: false,
  boostDistanceAccumulator: 0,
  continuousBoostDuration: 0,
  isOverheating: false,
  body: [{ x: 200, y: 0, angle: 0, radius: 18 }],
  history: [{ x: 200, y: 0, angle: 0, distance: 0 }],
  totalDistanceTraveled: 0,
  isDead: false,
  kills: 0,
  deaths: 0,
  invulnerableTimer: 0,
  eyeBlinkTimer: 2,
  eyeBlinkState: 0,
  lookAtOffsetAngle: 0,
  pulseTime: 0,
  skinSeed: 0,
  hyperBoostTimer: 0,
  ghostHuntTimer: 0,
};

const createHunterBot = (diff: 'easy' | 'medium' | 'hard') => ({
  ...testPrey,
  id: `hunter_${diff}`,
  name: `Hunter_${diff}`,
  botPersonality: 'aggressive' as const,
  x: 0,
  y: 0,
  vx: 195,
  vy: 0,
  angle: 0,
  mass: 50,
  length: 50,
  difficulty: diff,
});

let easyBoostCount = 0;
let hardBoostCount = 0;
const testSamples = 100;

for (let i = 0; i < testSamples; i++) {
  SerpentAIBrain.reset();
  const easyBot = createHunterBot('easy');
  const hardBot = createHunterBot('hard');

  const easyInput = SerpentAIBrain.computeBotInput(easyBot, { [easyBot.id]: easyBot, [testPrey.id]: testPrey }, [], null, 1350, 0.3, null, 'easy');
  if (easyInput.action1) easyBoostCount++;

  const hardInput = SerpentAIBrain.computeBotInput(hardBot, { [hardBot.id]: hardBot, [testPrey.id]: testPrey }, [], null, 1350, 0.02, null, 'hard');
  if (hardInput.action1) hardBoostCount++;
}

assert(hardBoostCount > easyBoostCount, `Hard bots boost more aggressively than Easy bots (${hardBoostCount}% vs ${easyBoostCount}%)`);
assert(easyBoostCount <= 35, `Easy bots adhere to ~20% boost chance ceiling (${easyBoostCount}%)`);

// -----------------------------------------------------------------------------
// 2. NEON RELAY AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- 2. AUDITING NEON RELAY (botAI.ts) ---');

for (const diff of difficulties) {
  console.log(`\n  [Neon Relay - Difficulty: ${diff.toUpperCase()}]`);

  const relayPlayers: Record<string, Player> = {
    bot_r1: {
      id: 'bot_r1',
      socketId: 'sock_r1',
      name: '[AI] ApexPredator',
      avatar: 'ship',
      color: '#FF3366',
      isHost: true,
      isBot: true,
      botArchetype: 'aggressive',
      isReady: true,
      score: 0,
      ping: 0,
      connected: true,
      lastActive: Date.now(),
    },
    bot_r2: {
      id: 'bot_r2',
      socketId: 'sock_r2',
      name: '[AI] DriftKing',
      avatar: 'ship',
      color: '#00E5FF',
      isHost: false,
      isBot: true,
      botArchetype: 'chaotic',
      isReady: true,
      score: 0,
      ping: 0,
      connected: true,
      lastActive: Date.now(),
    },
  };

  const engine = new NeonRelayEngine({ difficulty: diff });
  engine.init(relayPlayers);
  assert(engine.racers.length === 2, `Neon Relay initialized with 2 racers under ${diff}`);

  // Test laser jump detection
  const racer = engine.racers[0];
  const laser = engine.track.lasers[0];
  laser.isActive = true;
  racer.x = laser.currentP1.x + 50;
  racer.y = laser.currentP1.y;
  racer.jumpCooldown = 0;
  racer.jumpZ = 0;

  const botInput = BotAIController.computeInput(racer, engine.racers, engine.track, 0.016, diff);
  checkNoNaN(botInput, `Neon Relay bot input under ${diff}`);
  assert(typeof botInput.action1 === 'boolean', `Laser jump decision is boolean under ${diff}`);

  // Run 100 simulation ticks and check racer physics & jump clearance
  for (let tick = 0; tick < 100; tick++) {
    engine.tick(0.016, {});
    checkNoNaN(racer.x, `racer.x tick ${tick}`);
    checkNoNaN(racer.y, `racer.y tick ${tick}`);
    checkNoNaN(racer.vx, `racer.vx tick ${tick}`);
    checkNoNaN(racer.vy, `racer.vy tick ${tick}`);
  }
  assert(!isNaN(racer.progressDistance), `Racer progress distance is valid number under ${diff}`);
}

// Comparative Laser Jump Reaction Test for Neon Relay
console.log('\n  [Neon Relay - Comparative Laser Reaction Test]');
const relayEngineTest = new NeonRelayEngine({ difficulty: 'hard' });
relayEngineTest.init({
  bot_test: {
    id: 'bot_test',
    socketId: 'sock_t',
    name: 'TestRacer',
    avatar: 'ship',
    color: '#FF3366',
    isHost: true,
    isBot: true,
    isReady: true,
    score: 0,
    ping: 0,
    connected: true,
    lastActive: Date.now(),
  },
});
const testRacer = relayEngineTest.racers[0];
const testLaser = relayEngineTest.track.lasers[0];
testLaser.isActive = true;
testRacer.x = testLaser.currentP1.x + 130;
testRacer.y = testLaser.currentP1.y;
testRacer.jumpCooldown = 0;
testRacer.jumpZ = 0;

// Hard bot instant reaction
testRacer.botState = undefined;
const hardJumpInput = BotAIController.computeInput(testRacer, relayEngineTest.racers, relayEngineTest.track, 0.016, 'hard');
assert(hardJumpInput.action1 === true, 'Hard bot jumps laser barrier instantly (0ms delay)');

// Easy bot delayed reaction on first tick
testRacer.botState = undefined;
const easyJumpInputFirstTick = BotAIController.computeInput(testRacer, relayEngineTest.racers, relayEngineTest.track, 0.016, 'easy');
assert(easyJumpInputFirstTick.action1 === false, 'Easy bot hesitates on laser jump on initial tick (0.2-0.35s delay window)');

// -----------------------------------------------------------------------------
// 3. VOID TAG AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- 3. AUDITING VOID TAG (VoidTagBotAI.ts) ---');

for (const diff of difficulties) {
  console.log(`\n  [Void Tag - Difficulty: ${diff.toUpperCase()}]`);

  const tagPlayers: Record<string, Player> = {
    p_hunter: {
      id: 'p_hunter',
      socketId: 'sock_h',
      name: '[AI] VoidHunter',
      avatar: 'skull',
      color: '#FF007F',
      isHost: true,
      isBot: true,
      botArchetype: 'aggressive',
      isReady: true,
      score: 0,
      ping: 0,
      connected: true,
      lastActive: Date.now(),
    },
    p_survivor: {
      id: 'p_survivor',
      socketId: 'sock_s',
      name: '[AI] SurvivorOne',
      avatar: 'ship',
      color: '#00F5A0',
      isHost: false,
      isBot: true,
      botArchetype: 'defensive',
      isReady: true,
      score: 0,
      ping: 0,
      connected: true,
      lastActive: Date.now(),
    },
  };

  const engine = new VoidTagEngine(tagPlayers, undefined, { difficulty: diff, initialGracePeriod: 0 });
  engine.state = 'active';

  // Force one hunter and one survivor
  const hunter = engine.players['p_hunter'];
  const survivor = engine.players['p_survivor'];
  hunter.isHunter = true;
  survivor.isHunter = false;

  // Position hunter 200px away from survivor
  hunter.x = 800;
  hunter.y = 500;
  survivor.x = 600;
  survivor.y = 500;

  const survivorInput = VoidTagBotAI.computeBotInput(
    survivor,
    engine.players,
    engine.sanctuaries,
    engine.nebulae,
    engine.debris,
    engine.config,
    0.016
  );

  checkNoNaN(survivorInput, `Void Tag survivor input under ${diff}`);
  // Threat vector should steer survivor away from hunter (moveX should be negative / leftwards)
  assert(survivorInput.x < 0.2, `Survivor flees away from approaching hunter under ${diff}`);

  const hunterInput = VoidTagBotAI.computeBotInput(
    hunter,
    engine.players,
    engine.sanctuaries,
    engine.nebulae,
    engine.debris,
    engine.config,
    0.016
  );
  checkNoNaN(hunterInput, `Void Tag hunter input under ${diff}`);
  // Hunter should steer towards survivor (moveX should be negative / leftwards towards 600)
  assert(hunterInput.x < 0, `Hunter executes trajectory intercept towards survivor under ${diff}`);

  // Test memory cleanup
  VoidTagBotAI.reset();
  assert(true, `VoidTagBotAI.reset() executes cleanly`);
}

// Comparative Ability Trigger Rates in Void Tag
console.log('\n  [Void Tag - Comparative Ability Activation Test]');
const tagEngineCompare = new VoidTagEngine({
  p_h: { id: 'p_h', socketId: 's1', name: 'H', avatar: 'skull', color: '#F00', isHost: true, isBot: true, isReady: true, score: 0, ping: 0, connected: true, lastActive: Date.now() },
  p_s: { id: 'p_s', socketId: 's2', name: 'S', avatar: 'ship', color: '#0F0', isHost: false, isBot: true, isReady: true, score: 0, ping: 0, connected: true, lastActive: Date.now() },
}, undefined, { difficulty: 'easy', initialGracePeriod: 0 });

const hunterC = tagEngineCompare.players['p_h'];
const survivorC = tagEngineCompare.players['p_s'];
hunterC.isHunter = true;
survivorC.isHunter = false;
hunterC.x = 200; hunterC.y = 200; hunterC.angle = 0; hunterC.dashCooldown = 0;
survivorC.x = 350; survivorC.y = 200; survivorC.dashCooldown = 0; survivorC.empCooldown = 0;

let easyHunterDashCount = 0;
let hardHunterDashCount = 0;

for (let i = 0; i < 100; i++) {
  VoidTagBotAI.reset();
  tagEngineCompare.config.difficulty = 'easy';
  const easyIn = VoidTagBotAI.computeBotInput(hunterC, tagEngineCompare.players, [], [], [], tagEngineCompare.config, 0.3);
  if (easyIn.action1) easyHunterDashCount++;

  VoidTagBotAI.reset();
  tagEngineCompare.config.difficulty = 'hard';
  const hardIn = VoidTagBotAI.computeBotInput(hunterC, tagEngineCompare.players, [], [], [], tagEngineCompare.config, 0.02);
  if (hardIn.action1) hardHunterDashCount++;
}

assert(hardHunterDashCount > easyHunterDashCount, `Hard hunters dash on line-of-sight more reliably than Easy (${hardHunterDashCount}% vs ${easyHunterDashCount}%)`);
assert(easyHunterDashCount <= 35, `Easy hunters adhere to ~20% dash probability (${easyHunterDashCount}%)`);

// -----------------------------------------------------------------------------
// 4. RELIC RUSH AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- 4. AUDITING RELIC RUSH (RelicRushEngine.ts) ---');

for (const diff of difficulties) {
  console.log(`\n  [Relic Rush - Difficulty: ${diff.toUpperCase()}]`);

  const rushPlayers: Record<string, Player> = {
    bot_rush1: {
      id: 'bot_rush1',
      socketId: 'sock_rr1',
      name: '[AI] RelicHunter',
      avatar: 'robot',
      color: '#00F5A0',
      isHost: true,
      isBot: true,
      botArchetype: 'collector',
      isReady: true,
      score: 0,
      ping: 0,
      connected: true,
      lastActive: Date.now(),
    },
    bot_rush2: {
      id: 'bot_rush2',
      socketId: 'sock_rr2',
      name: '[AI] HoardSlammer',
      avatar: 'skull',
      color: '#FF3366',
      isHost: false,
      isBot: true,
      botArchetype: 'aggressive',
      isReady: true,
      score: 0,
      ping: 0,
      connected: true,
      lastActive: Date.now(),
    },
  };

  const engine = new RelicRushEngine(rushPlayers, { difficulty: diff, matchDuration: 60 });
  assert(engine !== null, `RelicRushEngine initialized under ${diff}`);

  // Simulate 120 ticks
  for (let tick = 0; tick < 120; tick++) {
    const inputs: Record<string, ControllerInput> = {};
    engine.tick(0.016, inputs);

    for (const pid in rushPlayers) {
      if (inputs[pid]) {
        checkNoNaN(inputs[pid], `Relic Rush input ${pid} tick ${tick}`);
      }
    }
  }
  assert(true, `Relic Rush bot simulation ran 120 ticks with 0 NaNs under ${diff}`);
}

// -----------------------------------------------------------------------------
// 5. LAST PLATFORM AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- 5. AUDITING LAST PLATFORM (BotAI.ts) ---');

for (const diff of difficulties) {
  console.log(`\n  [Last Platform - Difficulty: ${diff.toUpperCase()}]`);

  const roomState: RoomState = {
    code: 'ROOM1',
    hostSocketId: 'sock_lp1',
    selectedGame: 'last-platform',
    state: 'playing',
    players: {
      bot_lp1: {
        id: 'bot_lp1',
        socketId: 'sock_lp1',
        name: '[AI] HexMaster',
        avatar: 'robot',
        color: '#00F5A0',
        isHost: true,
        isBot: true,
        botArchetype: 'aggressive',
        isReady: true,
        score: 0,
        ping: 0,
        connected: true,
        lastActive: Date.now(),
      },
      bot_lp2: {
        id: 'bot_lp2',
        socketId: 'sock_lp2',
        name: '[AI] PlatformSurvivor',
        avatar: 'spark',
        color: '#00E5FF',
        isHost: false,
        isBot: true,
        botArchetype: 'defensive',
        isReady: true,
        score: 0,
        ping: 0,
        connected: true,
        lastActive: Date.now(),
      },
    },
    botCount: 2,
    config: {
      roundDuration: 60,
      difficulty: diff,
      powerupsEnabled: true,
    },
    createdAt: Date.now(),
  };

  const engine = new LastPlatformEngine(roomState, undefined, { difficulty: diff });
  assert(engine.bots.size === 2, `Last Platform registered 2 BotAI instances under ${diff}`);

  // Test hex tile stability evaluation and freeze shot
  const botState1 = engine.players['bot_lp1'];
  const botState2 = engine.players['bot_lp2'];
  botState1.x = 0;
  botState1.y = 0;
  botState1.z = 0;
  botState1.freezeShotCooldown = 0;
  botState1.isFrozen = false;

  botState2.x = 100;
  botState2.y = 0;
  botState2.z = 0;
  botState2.isFrozen = false;

  const botAI = engine.bots.get('bot_lp1')!;
  let freezeShotFired = false;
  for (let sample = 0; sample < 30; sample++) {
    (botAI as any).prevAction2 = false;
    (botAI as any).shotPulseCooldown = 0;
    const input = botAI.update(0.016, botState1, engine.players, engine.hexGrid);
    checkNoNaN(input, `Last Platform BotAI input under ${diff}`);
    if (input.action2) {
      freezeShotFired = true;
      break;
    }
  }

  assert(freezeShotFired, `Bot fires Electric Freeze Shot at rival within range (100px) under ${diff}`);

  // Test leaping over gap
  // Set current tile to crumbling
  const centerTile = engine.hexGrid.getTileAt(0, 0);
  if (centerTile) {
    centerTile.state = 'crumbling';
  }
  (botAI as any).prevAction1 = false;
  (botAI as any).jumpPulseCooldown = 0;
  botState1.isGrounded = true;
  botState1.canJump = true;
  const leapInput = botAI.update(0.35, botState1, engine.players, engine.hexGrid);
  assert(leapInput.action1 === true, `Bot initiates jump when tile is crumbling under ${diff}`);

  // Run 100 ticks of full game simulation
  for (let tick = 0; tick < 100; tick++) {
    engine.tick(0.016, {});
    checkNoNaN(botState1.x, `botState1.x tick ${tick}`);
    checkNoNaN(botState1.y, `botState1.y tick ${tick}`);
    checkNoNaN(botState1.z, `botState1.z tick ${tick}`);
  }
  assert(true, `Last Platform ran 100 ticks with 0 NaNs and stable physics under ${diff}`);
}

console.log('\n===============================================================');
console.log(`🎉 ALL ${passedTests}/${totalTests} AUTONOMOUS BOT SIMULATION TESTS PASSED!`);
console.log('===============================================================\n');
