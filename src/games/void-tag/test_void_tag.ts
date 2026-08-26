import { VoidTagEngine } from './VoidTagEngine';
import { Player, ControllerInput } from '../../types';

console.log('--- STARTING VOID TAG SIMULATION TEST ---');

const dummyPlayers: Record<string, Player> = {
  p_host: {
    id: 'p_host',
    socketId: 'sock_1',
    name: 'NeoPilot',
    avatar: 'ship',
    color: '#00F5A0',
    isHost: true,
    isBot: false,
    isReady: true,
    score: 0,
    ping: 15,
    connected: true,
    lastActive: Date.now(),
  },
  bot_1: {
    id: 'bot_1',
    socketId: 'sock_b1',
    name: '[AI] VoidStalker',
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
  bot_2: {
    id: 'bot_2',
    socketId: 'sock_b2',
    name: '[AI] NeonGlider',
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
  bot_3: {
    id: 'bot_3',
    socketId: 'sock_b3',
    name: '[AI] CyberGhost',
    avatar: 'alien',
    color: '#9D4EDD',
    isHost: false,
    isBot: true,
    botArchetype: 'ambusher',
    isReady: true,
    score: 0,
    ping: 0,
    connected: true,
    lastActive: Date.now(),
  },
};

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

const engine = new VoidTagEngine(dummyPlayers, 'p_host', { roundDuration: 30, initialGracePeriod: 3.0 }, (event) => {
  console.log(`[EVENT] ${event.type}: ${event.text || ''}`);
});

// 1. Initial Hunter Selection & Grace Period
assert(engine.state === 'intro', 'Engine starts in intro grace countdown');
assert(engine.introTimer === 3.0, '3s initial grace period timer is set');
assert(Boolean(engine.initialHunterId), 'A random Void Hunter was designated');
assert(engine.sanctuaries.length === 4, '4 strategic light sanctuaries initialized');
assert(engine.nebulae.length === 3, '3 stealth nebulae initialized');
assert(engine.debris.length === 6, '6 floating space debris initialized');

// Tick through 3s intro countdown
for (let i = 0; i < 95; i++) {
  engine.tick(0.033, {});
}
assert(engine.state === 'active', 'Engine transitioned from intro to active after 3s');

// 2. Abilities Test: Phase Dash (action1) and EMP Stun Pulse (action2)
const survivorPlayer = Object.values(engine.players).find(p => !p.isHunter)!;
const hunterPlayer = Object.values(engine.players).find(p => p.isHunter)!;
survivorPlayer.isBot = false;
hunterPlayer.isBot = false;

// Position hunter within 150px of survivor for EMP test
hunterPlayer.x = survivorPlayer.x + 100;
hunterPlayer.y = survivorPlayer.y;
hunterPlayer.isStunned = false;
hunterPlayer.isInvulnerable = false;
hunterPlayer.transformationTimer = 0;
survivorPlayer.empCooldown = 0;
survivorPlayer.dashCooldown = 0;

const empInput: Record<string, ControllerInput> = {
  [survivorPlayer.id]: {
    x: 0,
    y: 0,
    angle: 0,
    magnitude: 0,
    action1: false,
    action2: true, // EMP Blast
    timestamp: Date.now(),
  },
};

engine.tick(0.033, empInput);
assert(survivorPlayer.empCooldown > 0, 'Survivor EMP cooldown triggered');
assert(hunterPlayer.isStunned, 'Hunter caught in 190px EMP blast is stunned');
assert(hunterPlayer.stunTimer > 1.3 && hunterPlayer.stunTimer <= 1.5, 'Hunter stun duration is ~1.5s');
assert(engine.shockwaves.some(sw => sw.color === '#00E5FF'), 'EMP shockwave spawned');

// Phase Dash Test
const dashInput: Record<string, ControllerInput> = {
  [survivorPlayer.id]: {
    x: 1.0,
    y: 0,
    angle: 0,
    magnitude: 1.0,
    action1: true, // Dash
    action2: false,
    timestamp: Date.now(),
  },
};
engine.tick(0.033, dashInput);
assert(survivorPlayer.dashCooldown > 0, 'Phase dash triggered cooldown');
assert(survivorPlayer.isDashing, 'Player is dashing');

// 3. Tagging Collision Test: Touching a survivor corrupts them, triggers shockwave, TAGGED text, and 1.5s grace
const testSurvivor = Object.values(engine.players).find(p => !p.isHunter && !p.isEliminated)!;
hunterPlayer.isStunned = false;
hunterPlayer.stunTimer = 0;
hunterPlayer.transformationTimer = 0;
hunterPlayer.x = 800;
hunterPlayer.y = 800;
testSurvivor.x = 810;
testSurvivor.y = 800;
testSurvivor.isInSanctuary = false;
testSurvivor.isInvulnerable = false;

engine.tick(0.016, {});
assert(testSurvivor.isHunter, 'Survivor corrupted into Void Hunter upon collision');
assert(testSurvivor.isInvulnerable, 'Corrupted player gained invulnerability');
assert(testSurvivor.invulnerableTimer === 1.5, '1.5s grace invulnerability applied');
assert(engine.floatingTexts.some(t => t.text.includes('TAGGED')), 'Floating TAGGED text spawned');
assert(engine.shockwaves.some(sw => sw.color === '#9D4EDD'), 'Purple shockwave spawned on corruption');

// 4. Light Sanctuary Test: Survivors inside active sanctuary are immune to tags
const shieldedSurvivor = Object.values(engine.players).find(p => !p.isHunter && !p.isEliminated);
if (shieldedSurvivor) {
  const sanc = engine.sanctuaries[0];
  shieldedSurvivor.x = sanc.x;
  shieldedSurvivor.y = sanc.y;
  shieldedSurvivor.isInSanctuary = true;
  shieldedSurvivor.sanctuaryId = sanc.id;
  shieldedSurvivor.isInvulnerable = false;

  hunterPlayer.x = sanc.x + 10;
  hunterPlayer.y = sanc.y;
  hunterPlayer.isStunned = false;

  engine.tick(0.016, {});
  assert(!shieldedSurvivor.isHunter, 'Survivor inside active Light Sanctuary is immune to tags');
}

// 5. getPlayerHUDState role testing
const hunterHUD = engine.getPlayerHUDState(hunterPlayer.id);
assert(hunterHUD.status === 'hunter', 'Hunter HUD state status is hunter');

engine.forceEliminate('bot_3');
const elimHUD = engine.getPlayerHUDState('bot_3');
assert(elimHUD.status === 'eliminated', 'Eliminated player HUD state status is eliminated');

// 6. EDGE CASE 1: Hunter Elimination / Disconnection Redesignation
console.log('\n--- 6. Testing Hunter Elimination & Disconnection Redesignation ---');
const redestEngine = new VoidTagEngine(dummyPlayers, 'p_host', { roundDuration: 60, initialGracePeriod: 0 });
redestEngine.state = 'active';

const currentHunters = Object.values(redestEngine.players).filter(p => p.isHunter && !p.isEliminated);
assert(currentHunters.length === 1, 'Exactly one initial Void Hunter active');
const originalHunter = currentHunters[0];

// Eliminate the sole hunter
redestEngine.forceEliminate(originalHunter.id);
assert(originalHunter.isEliminated, 'Original Hunter is now eliminated');

const newHuntersAfterElim = Object.values(redestEngine.players).filter(p => p.isHunter && !p.isEliminated);
assert(newHuntersAfterElim.length === 1, 'Another survivor immediately and authoritatively designated as NEW Void Hunter');
assert(newHuntersAfterElim[0].id !== originalHunter.id, 'New Void Hunter is a different player');
assert(newHuntersAfterElim[0].invulnerableTimer === 1.5, 'New Void Hunter receives 1.5s grace invulnerability');

// Test disconnect redesignation
const currentHunter2 = newHuntersAfterElim[0];
redestEngine.setPlayerConnected(currentHunter2.id, false);
assert(currentHunter2.isEliminated, 'Disconnected hunter marked eliminated');

const newHuntersAfterDisconnect = Object.values(redestEngine.players).filter(p => p.isHunter && !p.isEliminated);
assert(newHuntersAfterDisconnect.length === 1, 'New Void Hunter designated upon hunter disconnection');

// 7. EDGE CASE 2: Sanctuary Multi-Occupant Energy Drain & Shield Collapse
console.log('\n--- 7. Testing Sanctuary Proportional Energy Drain & Collapse ---');
const sancEngine = new VoidTagEngine(dummyPlayers, 'p_host', { roundDuration: 60, initialGracePeriod: 0 });
sancEngine.state = 'active';
const testSanc = sancEngine.sanctuaries[0];
testSanc.energy = 100;
testSanc.isDepleted = false;

const survivorsList = Object.values(sancEngine.players).filter(p => !p.isHunter && !p.isEliminated);
assert(survivorsList.length >= 2, 'At least 2 survivors available for sanctuary test');
const s1 = survivorsList[0];
const s2 = survivorsList[1];

// Place 2 survivors inside sanctuary #1
s1.x = testSanc.x;
s1.y = testSanc.y;
s1.isInSanctuary = true;
s1.sanctuaryId = testSanc.id;

s2.x = testSanc.x + 5;
s2.y = testSanc.y + 5;
s2.isInSanctuary = true;
s2.sanctuaryId = testSanc.id;

// Tick 1 second: Drain rate is 15.0/sec per occupant -> 2 occupants = 30.0 energy drained
for (let t = 0; t < 20; t++) {
  sancEngine.tick(0.05, {});
}
assert(Math.abs(testSanc.energy - 70) < 1.0, '2 survivors inside sanctuary drain energy proportionally (100 -> ~70 energy in 1s)');

// Deplete sanctuary energy to 0 and verify shield collapse
testSanc.energy = 1.0;
sancEngine.tick(0.05, {});
assert(testSanc.energy === 0 && testSanc.isDepleted, 'Sanctuary energy depleted to 0 and marked isDepleted');
assert(!s1.isInSanctuary && !s2.isInSanctuary, 'Shield collapsed: occupants sanctuary status revoked');

// Verify depleted sanctuary no longer protects from tags
const activeHunter = Object.values(sancEngine.players).find(p => p.isHunter && !p.isEliminated)!;
activeHunter.x = s1.x + 10;
activeHunter.y = s1.y;
activeHunter.isStunned = false;
activeHunter.transformationTimer = 0;
s1.isInvulnerable = false;
sancEngine.tick(0.016, {});
assert(s1.isHunter, 'Survivor inside depleted/collapsed sanctuary is no longer shielded and got tagged');

// 8. EDGE CASE 3: EMP Stun Max Duration Clamping (1.5s Max)
console.log('\n--- 8. Testing EMP Stun Max Duration Clamping (1.5s max) ---');
const stunHunter = Object.values(sancEngine.players).find(p => p.isHunter && !p.isEliminated)!;
stunHunter.isStunned = true;
stunHunter.stunTimer = 1.2;
stunHunter.isInvulnerable = false;

// Trigger another EMP stun from nearby survivor
const stunSurvivor = Object.values(sancEngine.players).find(p => !p.isHunter && !p.isEliminated)!;
stunSurvivor.x = stunHunter.x + 50;
stunSurvivor.y = stunHunter.y;
stunSurvivor.empCooldown = 0;

sancEngine.tick(0.016, {
  [stunSurvivor.id]: {
    x: 0,
    y: 0,
    angle: 0,
    magnitude: 0,
    action1: false,
    action2: true, // Blast EMP
    timestamp: Date.now(),
  },
});

assert(stunHunter.stunTimer <= 1.5, 'Stun duration is clamped to maximum 1.5s and does not stack indefinitely');

// Complete match and test winner status
engine.timeRemaining = 0;
for (let i = 0; i < 5; i++) {
  engine.tick(0.033, {});
}
assert(engine.state === 'finished', 'Match concluded');
const results = engine.getResults();
assert(Boolean(results.winnerId), 'Winner determined');
const winnerHUD = engine.getPlayerHUDState(results.winnerId);
assert(winnerHUD.status === 'winner', 'Winner HUD state status is winner');

console.log(`\n========================================`);
console.log(`ALL ${passedTests}/${totalTests} VOID TAG TESTS PASSED!`);
console.log(`========================================\n`);
