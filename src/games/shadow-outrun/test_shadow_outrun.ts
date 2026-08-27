import { ShadowOutrunEngine } from './ShadowOutrunEngine';
import { Player } from '../../types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

console.log('--- TESTING SHADOW OUTRUN ENGINE ---');

const dummyPlayers: Record<string, Player> = {
  p1: {
    id: 'p1',
    socketId: 's1',
    name: 'Officer Ramu',
    avatar: '👮',
    color: '#FF3366',
    isHost: true,
    isReady: true,
    score: 0,
    ping: 10,
    connected: true,
    lastActive: Date.now(),
  },
  p2: {
    id: 'p2',
    socketId: 's2',
    name: 'Sly Thief',
    avatar: '🕶️',
    color: '#00E5FF',
    isHost: false,
    isBot: true,
    isReady: true,
    score: 0,
    ping: 15,
    connected: true,
    lastActive: Date.now(),
  },
  p3: {
    id: 'p3',
    socketId: 's3',
    name: 'Bandit Bot',
    avatar: '🥷',
    color: '#00F5A0',
    isHost: false,
    isBot: true,
    isReady: true,
    score: 0,
    ping: 20,
    connected: true,
    lastActive: Date.now(),
  },
};

// 1. Initialize Engine on Backrooms map
const engine = new ShadowOutrunEngine(dummyPlayers, {
  mapType: 'backrooms',
  roundDuration: 60,
});

assert(engine.players.size === 3, 'Initialized with 3 players');
assert(engine.coins.size > 0, 'Coins populated on map');
assert(engine.map.walls.length > 0, 'Walls initialized on map');

// Find the catcher and thief
const catcher = Array.from(engine.players.values()).find((p) => p.role === 'catcher');
const thieves = Array.from(engine.players.values()).filter((p) => p.role === 'thief');

assert(!!catcher, 'One player chosen as Catcher / Police');
assert(thieves.length === 2, 'Two players chosen as Thieves');
assert(catcher!.flashlightActive === true, 'Catcher has flashlight active');
assert(catcher!.baseSpeed === 207, 'Catcher speed is 207 px/s (90%)');
assert(thieves[0].baseSpeed === 230, 'Thief speed is 230 px/s (100%)');

// 2. Test Flashlight Cone Raycasting & 35% Slow Down
const thief = thieves[0];
catcher!.isBot = false;
thief.isBot = false;
catcher!.x = 100;
catcher!.y = 100;
catcher!.beamAngle = 0; // Facing right (angle = 0)
catcher!.angle = 0;

thief.x = 220; // In front, 120px away (within 260px beam)
thief.y = 100;

engine.tick(0.016);
assert(thief.isSlowed === true, 'Thief in unobstructed flashlight beam is slowed');
assert(thief.speedMultiplier === 0.65, 'Thief speed reduced by 35% (multiplier = 0.65)');
assert(Math.abs(thief.currentSpeed - 149.5) < 1.0, 'Thief speed equals 149.5 px/s');

// 3. Test Line of Sight Occlusion Behind Wall
// Place a wall obstacle between catcher and thief
catcher!.x = 100;
catcher!.y = 100;
catcher!.beamAngle = 0;
thief.x = 300;
thief.y = 100;
// Add temporary blocking wall
engine.map.walls.push({
  id: 'test_wall',
  x: 180,
  y: 50,
  width: 40,
  height: 100,
});

const los = engine.checkLineOfSight(100, 100, 300, 100, true);
assert(los === false, 'Solid wall successfully occludes Line of Sight raycast');

// 4. Test 60 FPS Multi-step Simulation Loop
for (let i = 0; i < 60; i++) {
  engine.tick(0.016);
}
assert(engine.matchTimeRemaining < 60, 'Match timer ticks down smoothly');

// 5. Test Coin Pickup by Thief
const coin = Array.from(engine.coins.values())[0];
coin.collected = false as boolean;
thief.x = coin.x;
thief.y = coin.y;
const oldScore = thief.score;
engine.tick(0.016);
assert(coin.collected === true, 'Coin picked up on contact');
assert(thief.score === oldScore + coin.value, `Thief gained +${coin.value} points`);

// 6. Test Arrest & Conversion to Deputy Catcher
catcher!.x = thief.x;
catcher!.y = thief.y; // Within 32px
engine.tick(0.016);
assert(thief.isArrested === true, 'Thief arrested on contact');
assert(thief.role === 'deputy', 'Captured thief converted to Deputy Police');
assert(thief.flashlightActive === true, 'Deputy equipped with flashlight');
assert(catcher!.thievesCaught >= 1, 'Catcher thievesCaught counter incremented');

// 7. Test HUD & Results
const hud = engine.getPlayerHUDState('p1');
assert(hud !== null && typeof hud.rank === 'number', 'PlayerClientHUDState generated correctly');

const results = engine.getResults();
assert(results.gameId === 'shadow-outrun', 'Results gameId is shadow-outrun');
assert(results.rankings.length === 3, 'All 3 players ranked');

console.log('🎉 ALL SHADOW OUTRUN ENGINE TESTS PASSED PERFECTLY!');
