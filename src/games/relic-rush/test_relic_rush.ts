import { RelicRushEngine } from './RelicRushEngine';
import { Player, ControllerInput } from '../../types';
import { PlayerRelicRushState } from './types';

console.log('=== RELIC RUSH COMPREHENSIVE QA & GAMEPLAY TEST SUITE ===');

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
// TEST 1: DETERMINISTIC COMPARATOR & TIE-BREAKER
// Rule: Score (desc) -> Gems Collected (desc) -> Least Times Tackled (asc) -> Player ID (asc)
// ---------------------------------------------------------------------------
console.log('\n--- TEST 1: DETERMINISTIC TIE-BREAKER ---');

const basePlayer = (id: string, score: number, gems: number, tacklesRec: number): PlayerRelicRushState => ({
  id,
  name: `Player_${id}`,
  avatar: 'ship',
  color: '#00F5A0',
  isBot: false,
  x: 500,
  y: 500,
  vx: 0,
  vy: 0,
  angle: 0,
  targetAngle: 0,
  speed: 0,
  maxSpeed: 340,
  acceleration: 850,
  mass: 1.0,
  hoardedValue: score,
  bankedScore: score,
  tacklesLanded: 0,
  tacklesReceived: tacklesRec,
  relicsCollectedCount: gems,
  cosmicCoresClaimed: 0,
  tackleCooldown: 0,
  maxTackleCooldown: 2.4,
  isTackling: false,
  tackleTimer: 0,
  tackleHeading: 0,
  activePowerup: null,
  powerupInventory: null,
  magnetTimer: 0,
  shieldTimer: 0,
  isShieldActive: false,
  shieldCooldown: 0,
  maxShieldCooldown: 6.0,
  isStunned: false,
  stunTimer: 0,
  damageFlashTimer: 0,
  invulnerableTimer: 0,
  trail: [],
  decoyActive: false,
});

// 1a. Score primary diff
const pA = basePlayer('p1', 120, 5, 2);
const pB = basePlayer('p2', 150, 4, 3);
assert(RelicRushEngine.comparePlayers(pA, pB) > 0, 'Higher score wins (pB > pA)');

// 1b. Equal score, gems collected tie-breaker
const pC = basePlayer('p3', 100, 8, 2);
const pD = basePlayer('p4', 100, 5, 2);
assert(RelicRushEngine.comparePlayers(pC, pD) < 0, 'Equal score: higher gems collected wins (pC > pD)');

// 1c. Equal score and gems, least times tackled tie-breaker
const pE = basePlayer('p5', 100, 5, 1);
const pF = basePlayer('p6', 100, 5, 3);
assert(RelicRushEngine.comparePlayers(pE, pF) < 0, 'Equal score & gems: least times tackled wins (pE > pF)');

// 1d. Equal score, gems, and tackles received: deterministic player ID tie-breaker
const pG = basePlayer('alpha', 100, 5, 2);
const pH = basePlayer('beta', 100, 5, 2);
assert(RelicRushEngine.comparePlayers(pG, pH) < 0, 'Equal all stats: alphabetical ID tie-breaker (alpha > beta)');

// ---------------------------------------------------------------------------
// TEST 2: AUTHORITATIVE WIN CONDITION & MATCH COMPLETION LOCK
// ---------------------------------------------------------------------------
console.log('\n--- TEST 2: WIN CONDITION & MATCH LOCK ---');

const dummyPlayers: Record<string, Player> = {
  p_1: {
    id: 'p_1',
    socketId: 's1',
    name: 'Alice',
    avatar: 'ship',
    color: '#00F5A0',
    isHost: true,
    isBot: false,
    isReady: true,
    score: 0,
    ping: 10,
    connected: true,
    lastActive: Date.now(),
  },
  p_2: {
    id: 'p_2',
    socketId: 's2',
    name: 'Bob',
    avatar: 'skull',
    color: '#FF3366',
    isHost: false,
    isBot: false,
    isReady: true,
    score: 0,
    ping: 10,
    connected: true,
    lastActive: Date.now(),
  },
};

const engine = new RelicRushEngine(dummyPlayers, { matchDuration: 10 });
assert(!engine.isMatchFinished(), 'Engine starts in playing state');
assert(engine.getTimeRemaining() === 10, 'Match time starts at duration');

// Advance time past 10 seconds (dt is clamped to 0.1s per tick to prevent physics tunneling)
const noInput: Record<string, ControllerInput> = {};
for (let f = 0; f < 110; f++) {
  engine.tick(0.1, noInput);
}

assert(engine.isMatchFinished(), 'Match completes when timer expires');
assert(engine.state === 'finished', 'Engine state transitions to finished');
assert(engine.getTimeRemaining() === 0, 'Time remaining clamped to 0');

// Verify actions are locked upon match completion
const player1 = engine.getPlayer('p_1')!;
const initialX = player1.x;
const initialY = player1.y;

// Send movement and tackle input after game over
const postInput: Record<string, ControllerInput> = {
  p_1: {
    x: 1.0,
    y: 0,
    angle: 0,
    magnitude: 1.0,
    action1: true,
    action2: false,
    timestamp: Date.now(),
  },
};

engine.tick(1.0, postInput);
assert(player1.x === initialX && player1.y === initialY, 'Player movement is completely locked after match completion');
assert(!player1.isTackling, 'Tackling action is blocked after match completion');

// Results structure verification
const results = engine.getResults();
assert(results.gameId === 'relic-rush', 'Results gameId is relic-rush');
assert(results.rankings.length === 2, 'Results includes all players in rankings');
assert(results.rankings[0].rank === 1 && results.rankings[1].rank === 2, 'Rankings are numbered properly');

// ---------------------------------------------------------------------------
// TEST 3: TACKLING COMBAT & DEDUPLICATION AUDIT
// ---------------------------------------------------------------------------
console.log('\n--- TEST 3: TACKLE COMBAT & DEDUPLICATION ---');

const combatEngine = new RelicRushEngine(dummyPlayers, { matchDuration: 90 });
// Clear random seeded relics from map for isolated combat test
(combatEngine as any).relics.clear();

const tackler = combatEngine.getPlayer('p_1')!;
const victim = combatEngine.getPlayer('p_2')!;

// Position them close for tackle hit
tackler.x = 500;
tackler.y = 500;
victim.x = 530;
victim.y = 500;

// Give victim 100 hoarded gems
victim.hoardedValue = 100;
victim.bankedScore = 100;
tackler.bankedScore = 0;

// Trigger tackle from P1 towards P2
const tackleInput: Record<string, ControllerInput> = {
  p_1: {
    x: 1.0,
    y: 0,
    angle: 0,
    magnitude: 1.0,
    action1: true,
    action2: false,
    timestamp: Date.now(),
  },
};

// Tick 1 frame (0.016s)
combatEngine.tick(0.016, tackleInput);

// Verify tackle impact:
assert(!tackler.isTackling, 'Tackler isTackling is immediately cleared upon impact (deduplication)');
assert(tackler.tacklesLanded === 1, 'Tackler recorded 1 tackle landed');
assert(victim.tacklesReceived === 1, 'Victim recorded 1 tackle received');
assert(victim.isStunned, 'Victim is stunned after tackle');
assert(victim.invulnerableTimer > 0, 'Victim received invulnerability grace period');
assert(victim.damageFlashTimer > 0, 'Victim has active damage flash timer');
assert(victim.hoardedValue === 0, 'Victim dropped all hoarded gems across the floor');
assert(victim.bankedScore === 0, 'Victim banked score reduced accurately by dropped amount');
assert(tackler.bankedScore === 15, 'Tackler received 15 pt tackle bounty');

const hoardedAfterFirstHit = victim.hoardedValue;

// Simulate successive sub-frames: victim should NOT be stripped of loot again while invulnerable
for (let i = 0; i < 5; i++) {
  combatEngine.tick(0.016, tackleInput);
}

assert(victim.hoardedValue === hoardedAfterFirstHit, 'Victim loot is NOT stripped again in successive sub-frames (Deduplication passed)');
assert(victim.tacklesReceived === 1, 'Victim tackles received count did not increment during grace period');

// ---------------------------------------------------------------------------
// TEST 4: KINETIC SHIELD REFLECTION MECHANICS
// ---------------------------------------------------------------------------
console.log('\n--- TEST 4: KINETIC SHIELD MECHANICS ---');

const shieldEngine = new RelicRushEngine(dummyPlayers, { matchDuration: 90 });
(shieldEngine as any).relics.clear();

const sTackler = shieldEngine.getPlayer('p_1')!;
const sDefender = shieldEngine.getPlayer('p_2')!;

sTackler.x = 400;
sTackler.y = 400;
sDefender.x = 430;
sDefender.y = 400;

// Activate shield on defender
sDefender.powerupInventory = 'shield';
sDefender.hoardedValue = 150;
sDefender.bankedScore = 150;

// Defender activates shield via action2
shieldEngine.tick(0.016, {
  p_2: { x: 0, y: 0, angle: 0, magnitude: 0, action1: false, action2: true, timestamp: Date.now() },
});

assert(sDefender.isShieldActive, 'Defender shield is now active');
assert(sDefender.shieldTimer > 0, 'Defender shield timer is running');

// Tackler now tackles into shielded defender
sTackler.tackleCooldown = 0;
shieldEngine.tick(0.016, {
  p_1: { x: 1.0, y: 0, angle: 0, magnitude: 1.0, action1: true, action2: false, timestamp: Date.now() },
});

assert(sDefender.hoardedValue === 150, 'Shield completely absorbed tackle - 0 gems lost by defender');
assert(!sDefender.isStunned, 'Shielded defender is NOT stunned');
assert(sTackler.isStunned, 'Tackler is stunned from shield reflection');
assert(sTackler.vx < 0, 'Tackler received recoil velocity away from shield');

// ---------------------------------------------------------------------------
// TEST 5: SCATTER PHYSICS & BOUNDARY CLAMPING
// ---------------------------------------------------------------------------
console.log('\n--- TEST 5: SCATTER PHYSICS & ARENA BOUNDARIES ---');

const scatterEngine = new RelicRushEngine(dummyPlayers, { matchDuration: 90 });
const edgeVictim = scatterEngine.getPlayer('p_1')!;
const edgeTackler = scatterEngine.getPlayer('p_2')!;

// Position victim right near top-left wall margin (e.g. x=75, y=75)
edgeVictim.x = 75;
edgeVictim.y = 75;
edgeVictim.hoardedValue = 200;
edgeVictim.bankedScore = 200;

edgeTackler.x = 100;
edgeTackler.y = 75;

// Tackle victim near the wall
scatterEngine.tick(0.016, {
  p_2: { x: -1.0, y: 0, angle: Math.PI, magnitude: 1.0, action1: true, action2: false, timestamp: Date.now() },
});

// Verify all spawned relics are strictly within arena boundaries
const allRelics = scatterEngine.getRelics();
assert(allRelics.length > 0, 'Relics spawned from gem scatter');

let allWithinBounds = true;
allRelics.forEach((r) => {
  if (r.x < scatterEngine.minX || r.x > scatterEngine.maxX || r.y < scatterEngine.minY || r.y > scatterEngine.maxY) {
    allWithinBounds = false;
    console.error(`Relic out of bounds: x=${r.x}, y=${r.y}, minX=${scatterEngine.minX}, maxX=${scatterEngine.maxX}`);
  }
});
assert(allWithinBounds, 'All scattered relics spawned strictly inside arena boundaries [minX, maxX, minY, maxY]');

// Simulate 60 physics frames of relic movement & wall bouncing
for (let f = 0; f < 60; f++) {
  scatterEngine.tick(0.016, noInput);
}

let allStillWithinBounds = true;
scatterEngine.getRelics().forEach((r) => {
  if (r.x < 60 || r.x > scatterEngine.width - 60 || r.y < 60 || r.y > scatterEngine.height - 60) {
    allStillWithinBounds = false;
  }
});
assert(allStillWithinBounds, 'All relics remain within arena walls after high velocity bouncing');

// ---------------------------------------------------------------------------
// TEST 6: ACCURATE getPlayerHUDState(playerId)
// ---------------------------------------------------------------------------
console.log('\n--- TEST 6: HUD STATE ACCURACY ---');

const hudEngine = new RelicRushEngine(dummyPlayers, { matchDuration: 90 });
const hudPlayer = hudEngine.getPlayer('p_1')!;
hudPlayer.bankedScore = 250;
hudPlayer.hoardedValue = 180;
hudPlayer.tackleCooldown = 1.2;
hudPlayer.shieldTimer = 4.5;
hudPlayer.isShieldActive = true;

const hudState = hudEngine.getPlayerHUDState('p_1');
assert(hudState.playerId === 'p_1', 'HUD state playerId matches');
assert(hudState.score === 250, 'HUD state score matches bankedScore');
assert(hudState.rank === 1, 'HUD state rank computed accurately');
assert(hudState.action1Cooldown > 0.4 && hudState.action1Cooldown < 0.6, 'Action 1 cooldown fraction computed accurately (1.2/2.4 = 0.5)');
assert(hudState.customStatName === 'KINETIC SHIELD', 'Custom stat reflects active shield powerup');
assert(hudState.customStatValue === '4.5s', 'Custom stat value shows active shield duration remaining');
assert(Boolean(hudState.message?.includes('SHIELD ACTIVE')), 'Message accurately reports active shield status');

// ---------------------------------------------------------------------------
// TEST 7: SCORE ACCUMULATION FOR HOLDING RELICS OVER TIME
// ---------------------------------------------------------------------------
console.log('\n--- TEST 7: SCORE ACCUMULATION OVER TIME ---');

const hoardEngine = new RelicRushEngine(dummyPlayers, { matchDuration: 90 });
const hoarder = hoardEngine.getPlayer('p_1')!;
hoarder.hoardedValue = 100;
hoarder.bankedScore = 100;

// Simulate 2 seconds of match time
for (let f = 0; f < 20; f++) {
  hoardEngine.tick(0.1, noInput);
}

assert(hoarder.bankedScore > 100, 'Score accumulated over time while holding gems');

// ---------------------------------------------------------------------------
// TEST 8: BASE KINETIC SHIELD (ACTION 2) WITHOUT POWERUP
// ---------------------------------------------------------------------------
console.log('\n--- TEST 8: BASE KINETIC SHIELD (ACTION 2) ---');

const baseShieldEngine = new RelicRushEngine(dummyPlayers, { matchDuration: 90 });
const shielder = baseShieldEngine.getPlayer('p_1')!;
shielder.powerupInventory = null;
shielder.shieldCooldown = 0;

baseShieldEngine.tick(0.016, {
  p_1: { x: 0, y: 0, angle: 0, magnitude: 0, action1: false, action2: true, timestamp: Date.now() },
});

assert(shielder.isShieldActive, 'Base kinetic shield activated on action2 without powerup');
assert(shielder.shieldTimer > 1.4 && shielder.shieldTimer <= 1.5, 'Base kinetic shield provides ~1.5s invulnerability duration');
assert(shielder.shieldCooldown === 6.0, 'Kinetic shield triggered cooldown');

// ---------------------------------------------------------------------------
// TEST 9: CAMERA CENTROID COMPUTATION
// ---------------------------------------------------------------------------
console.log('\n--- TEST 9: CAMERA CENTROID ---');

const cameraCentroid = baseShieldEngine.getCameraCentroid();
assert(typeof cameraCentroid.x === 'number' && typeof cameraCentroid.y === 'number', 'Centroid x and y are valid numbers');
assert(cameraCentroid.minX <= cameraCentroid.maxX, 'Centroid minX <= maxX');
assert(cameraCentroid.minY <= cameraCentroid.maxY, 'Centroid minY <= maxY');
assert(cameraCentroid.zoom >= 0.5 && cameraCentroid.zoom <= 1.5, 'Centroid zoom is within reasonable bounds');

// ---------------------------------------------------------------------------
// TEST 10: PACKED MULTI-PLAYER TACKLE CLUSTER COLLISION
// ---------------------------------------------------------------------------
console.log('\n--- TEST 10: PACKED CLUSTER TACKLE COLLISION ---');

const fourPlayers: Record<string, Player> = {
  p_1: { id: 'p_1', socketId: 's1', name: 'P1', avatar: 'ship', color: '#00F5A0', isHost: true, isBot: false, isReady: true, score: 0, ping: 10, connected: true, lastActive: Date.now() },
  p_2: { id: 'p_2', socketId: 's2', name: 'P2', avatar: 'ship', color: '#FF3366', isHost: false, isBot: false, isReady: true, score: 0, ping: 10, connected: true, lastActive: Date.now() },
  p_3: { id: 'p_3', socketId: 's3', name: 'P3', avatar: 'ship', color: '#00E5FF', isHost: false, isBot: false, isReady: true, score: 0, ping: 10, connected: true, lastActive: Date.now() },
  p_4: { id: 'p_4', socketId: 's4', name: 'P4', avatar: 'ship', color: '#9D4EDD', isHost: false, isBot: false, isReady: true, score: 0, ping: 10, connected: true, lastActive: Date.now() },
};

const clusterEngine = new RelicRushEngine(fourPlayers, { matchDuration: 90 });
const cp1 = clusterEngine.getPlayer('p_1')!;
const cp2 = clusterEngine.getPlayer('p_2')!;
const cp3 = clusterEngine.getPlayer('p_3')!;
const cp4 = clusterEngine.getPlayer('p_4')!;

// Place all 4 players in a tight packed cluster at (500, 500)
cp1.x = 500; cp1.y = 500;
cp2.x = 510; cp2.y = 500;
cp3.x = 500; cp3.y = 510;
cp4.x = 510; cp4.y = 510;

cp2.hoardedValue = 50;
cp3.hoardedValue = 50;
cp4.hoardedValue = 50;

// P1 tackles into the cluster
clusterEngine.tick(0.016, {
  p_1: { x: 1.0, y: 0, angle: 0, magnitude: 1.0, action1: true, action2: false, timestamp: Date.now() },
});

assert(!cp1.isTackling, 'P1 tackle state was cleanly resolved and terminated upon hitting cluster');
assert(cp1.tacklesLanded === 1, 'P1 landed exactly 1 prioritized tackle (single-target resolution)');
assert(typeof cp1.x === 'number' && !isNaN(cp1.x), 'Position coordinates remain valid numbers without NaN');

console.log(`\n========================================`);
console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log(`========================================\n`);
