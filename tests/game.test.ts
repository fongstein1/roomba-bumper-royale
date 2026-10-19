import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/game/GameEngine';
import { totalScore } from '../src/game/scoring';
import { soundSynth } from '../src/audio/SoundSynth';

// Exercise production physics/lifecycle without a GPU. Browser checks cover rendering.
const proto = GameEngine.prototype as any;
let oldRAF: any, oldCancel: any;
beforeEach(() => {
  oldRAF = globalThis.requestAnimationFrame;
  oldCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 42;
  globalThis.cancelAnimationFrame = () => {};
});
afterEach(() => {
  globalThis.requestAnimationFrame = oldRAF;
  globalThis.cancelAnimationFrame = oldCancel;
});
function fixture() {
  const engine: any = Object.create(GameEngine.prototype);
  engine.keysHeld = new Set();
  engine.virtualInputs = Object.fromEntries(['p1', 'p2'].map(id => [id, { up: false, down: false, left: false, right: false, boost: false }]));
  engine.profiles = ['p1', 'p2'].map((id, i) => ({ id, name: id, isHuman: true, playerIndex: i + 1, skin: { primaryColor: '#ffffff' } }));
  engine.states = new Map(engine.profiles.map((p: any, i: number) => [p.id, {
    id: p.id, x: i * 8, z: 0, vx: 0, vz: 0, heading: 0, speed: 0,
    boost: 100, isBoosting: false, isStunned: false, stunTimer: 0,
    spinoutTimer: 0, spinoutCooldown: 0, bumpsGiven: 0, bumpsReceived: 0,
    dustPoints: 0, coveragePercent: 0,
  }]));
  engine.meshes = new Map(engine.profiles.map((p: any) => [p.id, { updateAnimation() {}, triggerBumperCompression() {}, group: { position: { set() {} }, rotation: { y: 0 } } }]));
  engine.arena = { colliders: [], hazards: [], pickups: [], removePickupMesh() {}, spawnDroppedDust() {}, cleanHazard(id: string) { engine.arena.hazards.find((h: any) => h.id === id).cleaned = true; } };
  engine.floorManager = { sweep() {}, calculateCoverage: () => ({ playerPercents: {p1: 20, p2: 30}, totalCleanedPercent: 50 }) };
  engine.isRunning = true; engine.isPaused = false; engine.animationFrameId = 42;
  return engine;
}

test('combined score rewards coverage, pickups and bumps', () => {
  assert.equal(totalScore({ coveragePercent: 12.5, dustPoints: 150, bumpsGiven: 2 }), 325);
});
test('pause cancels the frame and releases keyboard and virtual controls', () => {
  const e = fixture(); let cancelled: any;
  globalThis.cancelAnimationFrame = id => { cancelled = id; };
  e.keysHeld.add('KeyW'); e.setVirtualInput('p1', 'up', true); e.pauseMatch();
  assert.equal(cancelled, 42); assert.equal(e.animationFrameId, null);
  assert.equal(e.keysHeld.size, 0); assert.equal(e.virtualInputs.p1.up, false);
});
test('repeated resume starts exactly one loop', () => {
  const e = fixture(); let loops = 0; e.loop = () => { loops++; };
  const original = soundSynth.ensureContext; soundSynth.ensureContext = () => {};
  try { e.pauseMatch(); e.resumeMatch(); e.resumeMatch(); assert.equal(loops, 1); }
  finally { soundSynth.ensureContext = original; }
});
test('restart stops the old loop, resets arena and transient timers, publishes fresh HUD', () => {
  const e = fixture(); let reset = 0, init = 0, published = 0, loops = 0;
  e.arena.resetMatch = () => { reset++; }; e.floorManager.resetDust = () => {};
  e.initRobots = () => { init++; }; e.calculateMatchScores = () => { published++; }; e.loop = () => { loops++; };
  e.highValueTimer = 17; e.hitstopDuration = 1; e.virtualInputs.p2.boost = true;
  const original = soundSynth.ensureContext; soundSynth.ensureContext = () => {};
  try { e.startMatch(90); assert.equal(reset, 1); assert.equal(init, 1); assert.equal(published, 1); assert.equal(loops, 1); assert.equal(e.highValueTimer, 0); assert.equal(e.hitstopDuration, 0); assert.equal(e.matchTimeRemaining, 90); assert.equal(e.virtualInputs.p2.boost, false); }
  finally { soundSynth.ensureContext = original; }
});
test('P1 WASD moves, reverses and steers', () => {
  const e = fixture(); const p = e.states.get('p1'); e.keysHeld.add('KeyW'); proto.updatePhysics.call(e, 0.05); assert.ok(p.z > 0);
  e.keysHeld.clear(); p.vz = 0; e.keysHeld.add('KeyS'); proto.updatePhysics.call(e, 0.05); assert.ok(p.vz < 0);
  e.keysHeld.add('KeyA'); proto.updatePhysics.call(e, 0.05); assert.ok(p.heading < 0);
});
test('P2 arrows and Enter work simultaneously with P1', () => {
  const e = fixture(); ['KeyW', 'ArrowUp', 'Enter'].forEach(key => e.keysHeld.add(key));
  proto.updatePhysics.call(e, 0.05);
  assert.ok(e.states.get('p1').z > 0); assert.ok(e.states.get('p2').z > 0);
  assert.equal(e.states.get('p2').isBoosting, true); assert.ok(e.states.get('p2').boost < 100);
});
test('touch forward + steering + boost apply together and release', () => {
  const e = fixture(); ['up', 'right', 'boost'].forEach(action => e.setVirtualInput('p1', action, true));
  proto.updatePhysics.call(e, 0.05); const p = e.states.get('p1'); assert.ok(p.z > 0); assert.ok(p.heading > 0); assert.ok(p.boost < 100);
  e.clearInputs(); assert.equal(e.virtualInputs.p1.boost, false); assert.equal(e.virtualInputs.p1.up, false);
});
test('an exactly centered furniture collision pushes out rather than trapping the robot', () => {
  const e = fixture(); e.arena.colliders = [{x:0,z:0,width:2,depth:2}]; proto.updatePhysics.call(e, 0.05);
  const p = e.states.get('p1'); assert.ok(Math.abs(p.x) >= 1.65 || Math.abs(p.z) >= 1.65);
});
test('arena boundaries contain a speeding vacuum', () => {
  const e = fixture(); const p = e.states.get('p1'); p.x = 14.4; p.vx = 22;
  proto.updatePhysics.call(e, 0.05); assert.ok(p.x <= 14.3); assert.ok(p.vx < 0);
});
test('a pickup awards points once', () => {
  const e = fixture(); e.arena.pickups = [{id:'crumb',x:0,z:0,radius:0.5,collected:false,type:'mega_crumb',value:40}];
  proto.updatePhysics.call(e, 0.05); proto.updatePhysics.call(e, 0.05); assert.equal(e.states.get('p1').dustPoints, 40);
});
test('battery restores boost without adding dust points', () => {
  const e = fixture(); e.states.get('p1').boost = 20; e.arena.pickups = [{id:'battery',x:0,z:0,radius:0.5,collected:false,type:'battery_boost',value:100}];
  proto.updatePhysics.call(e, 0.05); assert.equal(e.states.get('p1').boost, 100); assert.equal(e.states.get('p1').dustPoints, 0);
});
test('wet spill awards its bonus once and allows escape', () => {
  const e = fixture(); e.arena.hazards = [{id:'spill',x:0,z:0,radius:1}];
  proto.updatePhysics.call(e, 0.05); assert.equal(e.states.get('p1').dustPoints, 35); assert.equal(e.arena.hazards[0].cleaned, true);
  proto.updatePhysics.call(e, 0.05); assert.equal(e.states.get('p1').dustPoints, 35);
});
test('carried vacuum does not collide with players on the floor', () => {
  const e = fixture(); const p1 = e.states.get('p1'), p2 = e.states.get('p2'); p1.isDogGrabbed = true; p2.x = 0.5;
  proto.updatePhysics.call(e, 0.05); assert.equal(p1.x, 0); assert.equal(p2.x, 0.5);
});
test('final standings use the same score, include every robot, and stop the match', () => {
  const e = fixture(); e.states.get('p1').dustPoints = 200; e.matchTotalTime = 90; e.calculateMatchScores = () => {};
  let stats: any; e.onMatchEnd = (s: any) => {stats=s;};
  proto.endMatch.call(e); assert.equal(e.isRunning, false); assert.equal(stats.winnerId, 'p1'); assert.equal(stats.leaderboard.length, 2); assert.deepEqual(stats.leaderboard.map((p: any) => p.rank), [1,2]);
});

test('a complete 90-second simulated match ends once, publishes results, and rematches cleanly', () => {
  const e = fixture(); let ended = 0, resets = 0;
  e.floorManager.resetDust = () => {};
  e.arena.resetMatch = () => { resets++; };
  e.arena.updateDog = () => ({ dogStatus: 'patrol', grabbedRobotId: null, droppedRobotId: null });
  e.arena.updatePickups = () => {}; e.arena.spawnDynamicHighValueSpot = () => null;
  e.arena.dogGroup = {position:{x:0,z:-2}}; e.render = () => {};
  e.initRobots = () => { e.states.forEach((s: any) => { s.dustPoints = 0; }); };
  e.onMatchEnd = () => {ended++;};
  const original = soundSynth.ensureContext; soundSynth.ensureContext = () => {};
  try {
    e.startMatch(90);
    for (let i = 0; i < 1802; i++) { e.lastTime = performance.now() - 50; e.loop(); }
    assert.equal(ended, 1); assert.equal(e.isRunning, false); assert.equal(e.animationFrameId, null);
    e.states.get('p1').dustPoints = 200;
    e.startMatch(90); assert.equal(resets, 2); assert.equal(e.isRunning, true); assert.equal(e.states.get('p1').dustPoints, 0);
    assert.ok(e.matchTimeRemaining > 89); e.stopMatch();
  } finally { soundSynth.ensureContext = original; }
});

test('turbo actually increases travel speed rather than only changing the cap and camera', () => {
  const normal = fixture(), boosted = fixture();
  normal.setVirtualInput('p1', 'up', true);
  boosted.setVirtualInput('p1', 'up', true); boosted.setVirtualInput('p1', 'boost', true);
  // Keep the second robot and furniture away from the one-second straight drive.
  normal.states.get('p2').x = -12; boosted.states.get('p2').x = -12;
  for (let i = 0; i < 20; i++) { proto.updatePhysics.call(normal, 0.05); proto.updatePhysics.call(boosted, 0.05); }
  assert.ok(boosted.states.get('p1').speed > normal.states.get('p1').speed * 1.5);
});
