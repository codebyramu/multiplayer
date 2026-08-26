import { LastPlatformEngine } from "./LastPlatformEngine";
import { HexGrid } from "./HexGrid";
import { BotAI } from "./BotAI";
import { RoomState } from "../../types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("❌ ASSERTION FAILED: " + message);
    process.exit(1);
  } else {
    console.log("✅ " + message);
  }
}

console.log("🧪 RUNNING LAST PLATFORM COMPREHENSIVE SIMULATION TESTS...\n");

// 1. HEX GRID TILE STATE MACHINE TEST
console.log("--- 1. Testing HexGrid State Machine & Respawn ---");
const hexGrid = new HexGrid({
  gridRadius: 4,
  tileSize: 46,
  tileHeight: 20,
  roundDuration: 75,
  suddenDeathThreshold: 25,
  playerMoveSpeed: 240,
  playerJumpForce: 360,
  playerAirHopForce: 280,
  playerDashForce: 380,
  gravity: 750,
  shockwaveRadius: 210,
  shockwaveForce: 680,
  shockwaveCooldown: 3.8,
  dashCooldown: 2.2,
  warningDuration: 1.0,
  crumblingDuration: 1.0,
  movingPlatformsCount: 2,
});

const testTile = hexGrid.tilesList.find(t => t.ring === 1)!;
assert(testTile !== null && (testTile.state as string) === "stable", "Ring 1 tile is generated and stable");

// Trigger state decay: stable -> warning -> crumbling -> collapsed -> respawning -> stable
testTile.state = "warning";
testTile.stateTimer = 0;
testTile.warningDuration = 0.5;
testTile.crumblingDuration = 0.5;

// Advance into crumbling
hexGrid.update(0.6, 0.1, false);
assert((testTile.state as string) === "crumbling", "Tile transitioned from warning -> crumbling");

// Advance into collapsed
hexGrid.update(0.6, 0.1, false);
assert((testTile.state as string) === "collapsed", "Tile transitioned from crumbling -> collapsed");
assert(hexGrid.getTileAt(testTile.worldX, testTile.worldY) === null, "getTileAt returns null when standing on collapsed tile");

// Advance through collapsed duration into respawning
hexGrid.update(6.5, 0.1, false);
assert((testTile.state as string) === "respawning", "Tile transitioned from collapsed -> respawning");
assert(hexGrid.getTileAt(testTile.worldX, testTile.worldY) === null, "getTileAt returns null while tile is respawning");

// Advance through respawn duration back to stable
hexGrid.update(2.0, 0.1, false);
assert((testTile.state as string) === "stable", "Tile transitioned from respawning -> stable");
assert(hexGrid.getTileAt(testTile.worldX, testTile.worldY) !== null, "getTileAt returns solid tile once restored to stable");

// 2. ENGINE INITIALIZATION & STABLE SPAWN
console.log("\n--- 2. Testing Player Spawning on Stable Tiles ---");
const mockRoom: RoomState = {
  code: "TEST1",
  hostSocketId: "host_1",
  selectedGame: "last-platform",
  state: "playing",
  players: {
    p1: { id: "p1", socketId: "s1", name: "Player 1", avatar: "🐱", color: "#00F5A0", isHost: true, isReady: true, score: 0, ping: 10, connected: true, lastActive: Date.now() },
    p2: { id: "p2", socketId: "s2", name: "Player 2", avatar: "🤖", color: "#FF3366", isHost: false, isReady: true, score: 0, ping: 15, connected: true, lastActive: Date.now() },
    bot1: { id: "bot1", socketId: "s3", name: "Bot Bravo", avatar: "robot", color: "#00E5FF", isHost: false, isBot: true, botArchetype: "aggressive", isReady: true, score: 0, ping: 0, connected: true, lastActive: Date.now() },
  },
  botCount: 1,
  config: { roundDuration: 75, difficulty: "normal", powerupsEnabled: true },
  createdAt: Date.now(),
};

const engine = new LastPlatformEngine(mockRoom);
const p1 = engine.players["p1"];
const p2 = engine.players["p2"];
const bot1 = engine.players["bot1"];

assert(!!p1 && p1.isGrounded && !p1.isFallingIntoVoid, "Player 1 spawned grounded on stable tile");
assert(!!p2 && p2.isGrounded && !p2.isFallingIntoVoid, "Player 2 spawned grounded on stable tile");
assert(!!bot1 && bot1.isGrounded && !bot1.isFallingIntoVoid, "Bot 1 spawned grounded on stable tile");

// 3. 3D JUMP & DOUBLE HOP (ACTION1)
console.log("\n--- 3. Testing 3D Jump & Air-Hop (action1) ---");
engine.tick(0.016, {
  p1: { x: 0, y: 0, angle: 0, magnitude: 0, action1: true, action2: false, timestamp: Date.now() }
});
assert(p1.isAirborne && p1.z > 0 && p1.jumpsRemaining === 1, "Player 1 ground jumped: airborne, z > 0, 1 hop remaining");

// Release action1 and advance physics for cooldown
engine.tick(0.05, {
  p1: { x: 0, y: 0, angle: 0, magnitude: 0, action1: false, action2: false, timestamp: Date.now() }
});
engine.tick(0.05, {
  p1: { x: 0, y: 0, angle: 0, magnitude: 0, action1: false, action2: false, timestamp: Date.now() }
});

// Trigger Air Hop / Air Dash
engine.tick(0.016, {
  p1: { x: 1, y: 0, angle: 0, magnitude: 1, action1: true, action2: false, timestamp: Date.now() }
});
assert(p1.jumpsRemaining === 0 && (p1.isDashing || p1.airHopsUsed >= 1), "Player 1 performed air hop / air-dash");

// 4. 7-SECOND FREEZE SHOT (ACTION2)
console.log("\n--- 4. Testing 7-Second Freeze Shot (action2) ---");
p1.z = 0;
p1.isAirborne = false;
p1.isGrounded = true;
p1.facingAngle = 0; // Face right towards p2
p1.x = 0;
p1.y = 0;
p2.x = 200;
p2.y = 0;
p2.z = 0;
p2.isFrozen = false;

// Trigger Freeze Shot
engine.tick(0.016, {
  p1: { x: 0, y: 0, angle: 0, magnitude: 0, action1: false, action2: true, timestamp: Date.now() }
});
assert(engine.projectiles.length > 0, "Freeze projectile created");
assert(p1.freezeShotCooldown === 7.0, "Freeze shot entered 7-second cooldown");

// Step projectile to travel and hit target p2
for (let i = 0; i < 6; i++) { engine.tick(0.05, {}); }
assert(p2.isFrozen && p2.freezeTimer > 1.5, "Player 2 was hit by freeze shot and frozen for 2.0s");
assert(p2.vx === 0 && p2.vy === 0, "Frozen player is immobilized");

// 5. BOT AI STABILITY EVALUATION & GAP LEAP
console.log("\n--- 5. Testing Bot AI Navigation & Hazard Evaluation ---");
const botAI = engine.bots.get("bot1");
assert(!!botAI, "Bot AI instance exists");

if (botAI) {
  const botInput = botAI.update(0.05, bot1, engine.players, engine.hexGrid);
  assert(typeof botInput.x === "number" && typeof botInput.y === "number", "Bot AI generates directional navigation input");
}

// 6. 3D PLATFORM PHYSICS (VOID PLUNGE)
console.log("\n--- 6. Testing 3D Platform Physics & Void Plunge ---");
// Position p2 on collapsed tile at ground level
p2.x = 2000; // Far out over the void
p2.y = 2000;
p2.z = 0;
p2.isAirborne = false;
p2.isGrounded = true;
p2.isFrozen = false;
engine.tick(0.05, {});
assert(p2.isFallingIntoVoid, "Player plunged into void when standing over void at z <= 0");

// 7. SUDDEN DEATH & WINNER DECLARATION
console.log("\n--- 7. Testing Sudden Death & Winner Declaration ---");
engine.triggerSuddenDeath();
assert(engine.isSuddenDeath, "Sudden Death triggered successfully");

// Eliminate remaining bot to leave p1 as sole survivor
bot1.isFallingIntoVoid = true;
bot1.z = -300;
engine.tick(0.05, {});
engine.tick(0.05, {});

assert(engine.isGameOver, "Match ended when only 1 survivor remained");
assert(p1.placementRank === 1, "Sole survivor is crowned Rank #1 Winner");

// 8. GET PLAYER HUD STATE
console.log("\n--- 8. Testing getPlayerHUDState() ---");
const hudP1 = engine.getPlayerHUDState("p1");
const hudP2 = engine.getPlayerHUDState("p2");

assert(hudP1.rank === 1 && hudP1.status === "winner", "Player 1 HUD state reports winner");
assert(hudP2.status === "eliminated", "Player 2 HUD state reports eliminated");
assert(typeof hudP1.action2Cooldown === "number", "HUD state contains action2Cooldown");

// 9. EDGE CASE 1: FREEZE SHOT HITTING AIRBORNE PLAYER (PRESERVE GRAVITY FALL)
console.log("\n--- 9. Testing Freeze Shot on Airborne Player (Preserve Gravity Fall) ---");
const jumpEngine = new LastPlatformEngine(mockRoom);
const jumper = jumpEngine.players["p1"];
jumper.x = 0;
jumper.y = 0;
jumper.z = 80;
jumper.vz = 0;
jumper.vx = 150;
jumper.vy = 100;
jumper.isAirborne = true;
jumper.isGrounded = false;
jumper.isFrozen = true;
jumper.freezeTimer = 2.0;

// Advance physics while frozen in the air
const initialZ = jumper.z;
jumpEngine.tick(0.05, {});
assert(jumper.isFrozen, "Player is frozen");
assert(jumper.vx === 0 && jumper.vy === 0, "Horizontal movement is frozen (vx=0, vy=0)");
assert(jumper.z < initialZ, "Vertical gravity fall is preserved (z dropped under gravity)");
assert(jumper.vz < 0, "Vertical velocity accumulated downward gravity pull");

// Step until landing on center tile
for (let i = 0; i < 30; i++) {
  jumpEngine.tick(0.05, {});
}
assert(jumper.z === 0 && jumper.isGrounded, "Frozen airborne player safely fell and landed on solid ground tile");

// 10. EDGE CASE 2: DOUBLE-JUMP TIMING (AIR-HOP ONLY ONCE PER GROUND DEPARTURE)
console.log("\n--- 10. Testing Double-Jump Timing (Single Air-Hop per Ground Departure) ---");
const hopEngine = new LastPlatformEngine(mockRoom);
const hopper = hopEngine.players["p1"];
hopper.x = 0;
hopper.y = 0;
hopper.z = 0;
hopper.isGrounded = true;
hopper.isAirborne = false;
hopper.jumpsRemaining = 2;

// 1. Ground jump
hopEngine.tick(0.016, {
  p1: { x: 0, y: 0, angle: 0, magnitude: 0, action1: true, action2: false, timestamp: Date.now() }
});
assert(hopper.isAirborne && hopper.jumpsRemaining === 1, "Ground jump performed, exactly 1 air-hop remaining");

// Release jump key and step
hopEngine.tick(0.05, { p1: { x: 0, y: 0, angle: 0, magnitude: 0, action1: false, action2: false, timestamp: Date.now() } });
hopEngine.tick(0.05, { p1: { x: 0, y: 0, angle: 0, magnitude: 0, action1: false, action2: false, timestamp: Date.now() } });

// 2. Air hop (consumes remaining hop)
const vzBeforeAirHop = hopper.vz;
hopEngine.tick(0.016, {
  p1: { x: 0, y: 0, angle: 0, magnitude: 0, action1: true, action2: false, timestamp: Date.now() }
});
assert(hopper.jumpsRemaining === 0, "Air-hop consumed remaining jumps (0 remaining)");

// Release jump key and step
hopEngine.tick(0.05, { p1: { x: 0, y: 0, angle: 0, magnitude: 0, action1: false, action2: false, timestamp: Date.now() } });
hopEngine.tick(0.05, { p1: { x: 0, y: 0, angle: 0, magnitude: 0, action1: false, action2: false, timestamp: Date.now() } });

// 3. Attempt second air hop in mid-air (must fail!)
const vzBeforeIllegalHop = hopper.vz;
hopEngine.tick(0.016, {
  p1: { x: 0, y: 0, angle: 0, magnitude: 0, action1: true, action2: false, timestamp: Date.now() }
});
assert(hopper.jumpsRemaining === 0, "Second air-hop blocked while airborne");
assert(hopper.vz <= vzBeforeIllegalHop, "No upward impulse imparted from illegal second air hop");

// 11. EDGE CASE 3: SUDDEN DEATH PERIMETER COLLAPSE IMMUNITY FOR CENTER HEX TILE
console.log("\n--- 11. Testing Sudden Death Center Hex Tile Immunity ---");
const sdHexGrid = new HexGrid({
  gridRadius: 4,
  tileSize: 46,
  tileHeight: 20,
  roundDuration: 75,
  suddenDeathThreshold: 25,
  playerMoveSpeed: 240,
  playerJumpForce: 360,
  playerAirHopForce: 280,
  playerDashForce: 380,
  gravity: 750,
  shockwaveRadius: 210,
  shockwaveForce: 680,
  shockwaveCooldown: 3.8,
  dashCooldown: 2.2,
  warningDuration: 0.2,
  crumblingDuration: 0.2,
  movingPlatformsCount: 0,
});

// Run 20 seconds of Sudden Death update ticks
for (let i = 0; i < 200; i++) {
  sdHexGrid.update(0.1, 0.95, true);
}

const centerTileAfterSD = sdHexGrid.getTileAt(0, 0);
assert(centerTileAfterSD !== null && centerTileAfterSD.state === "stable", "Center hex tile (ring 0) remains permanently stable throughout Sudden Death");

// Step on center tile repeatedly
for (let i = 0; i < 10; i++) {
  sdHexGrid.stepOnTile(centerTileAfterSD!.id);
  sdHexGrid.update(0.1, 0.95, true);
}
assert(centerTileAfterSD!.state === "stable", "Center hex tile is immune to step destabilization");

// Hazard strike directly on center tile
sdHexGrid.triggerHazardStrike(0, 0, 100);
sdHexGrid.update(0.5, 0.95, true);
assert(centerTileAfterSD!.state === "stable", "Center hex tile is immune to hazard strike collapse");

console.log("\n🎉 ALL LAST PLATFORM SIMULATION TESTS PASSED WITH ZERO ERRORS!\n");
