import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GameEngine } from '../src/game/GameEngine';
import { totalScore } from '../src/game/scoring';
import type { MatchStats, RobotProfile } from '../src/types/game';

// Only the GPU, canvas drawing and audio are replaced. Run the real arena,
// pickups, dog, floor score grid, physics and match scheduler.
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class Renderer {
    domElement = { parentNode: null };
    shadowMap = {};
    setSize() {} setPixelRatio() {} compile() {} dispose() {}
    setScissorTest() {} setViewport() {} setScissor() {} render() {}
  }
  return { ...actual, WebGLRenderer: Renderer, PMREMGenerator: class {
    compileEquirectangularShader() {} dispose() {}
    fromScene() { return { texture: new actual.Texture() }; }
  } };
});
vi.mock('../src/audio/SoundSynth', () => ({ soundSynth: new Proxy({}, { get: () => () => {} }) }));

const profiles: RobotProfile[] = ['p1', 'p2', 'bot1', 'bot2'].map((id, index) => ({
  id, name: id, isHuman: index === 0, playerIndex: index < 2 ? (index + 1) as 1 | 2 : undefined,
  skin: { primaryColor: '#00ccff', accentColor: '#ffffff', underglowColor: '#00ccff', finish: 'matte', decal: 'plain', topper: 'none' },
}));
let now: number;
let sequence: number;
let pending: Map<number, FrameRequestCallback>;
let engine: GameEngine;
function frame(milliseconds: number) {
  now += milliseconds;
  const scheduled = [...pending.entries()];
  pending.clear();
  scheduled.forEach(([, callback]) => callback(now));
}

beforeEach(() => {
  now = 100; sequence = 0; pending = new Map();
  const ctx = new Proxy({}, { get: (_target, key) => {
    if (key === 'getImageData') return () => ({ data: new Uint8ClampedArray(1024 * 1024 * 4) });
    if (key === 'measureText') return () => ({ width: 50 });
    if (String(key).startsWith('create')) return () => ({ addColorStop() {} });
    return () => {};
  } });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
  vi.stubGlobal('window', { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { pending.set(++sequence, callback); return sequence; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id));
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const container = { clientWidth: 1280, clientHeight: 720, appendChild() {} } as unknown as HTMLElement;
  engine = new GameEngine(container, structuredClone(profiles));
  vi.spyOn(engine, 'render').mockImplementation(() => {});
});
afterEach(() => { engine?.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('release regressions', () => {
  it('spawns every robot clear of furniture and aimed toward the center', () => {
    for (const state of engine.states.values()) {
      for (const collider of engine.arena.colliders) {
        const overlaps = Math.abs(state.x - collider.x) < collider.width / 2 + 0.7 && Math.abs(state.z - collider.z) < collider.depth / 2 + 0.7;
        expect(overlaps, `${state.id} inside ${collider.id}`).toBe(false);
      }
      expect(Math.sin(state.heading) * -state.x + Math.cos(state.heading) * -state.z).toBeGreaterThan(14);
    }
  });
  it('uses the original score weights with an independent expected result', () => {
    expect(totalScore({ coveragePercent: 12.3, dustPoints: 150, bumpsGiven: 2 })).toBe(323);
    expect(totalScore({ coveragePercent: 0, dustPoints: 0, bumpsGiven: 0 })).toBe(0);
  });
  it('keeps exactly one frame loop across repeated pause/resume/restart', () => {
    engine.startMatch();
    for (let i = 0; i < 8; i++) {
      engine.pauseMatch(); frame(1000); engine.resumeMatch(); engine.resumeMatch();
      expect(pending.size).toBe(1);
    }
    expect(engine.matchTimeRemaining).toBe(90);
    engine.startMatch();
    expect(pending.size).toBe(1);
    frame(1000);
    expect(engine.matchTimeRemaining).toBe(89);
    engine.stopMatch();
    expect(pending.size).toBe(0);
  });
  it('finishes once at 90 real seconds even at a low rendering rate', () => {
    const ended = vi.fn(); engine.onMatchEnd = ended;
    engine.startMatch();
    frame(1000);
    expect(engine.matchTimeRemaining).toBe(89);
    frame(89000); frame(1000);
    expect(ended).toHaveBeenCalledTimes(1);
    expect(engine.matchTimeRemaining).toBe(0);
    expect(pending.size).toBe(0);
  });
  it('starts the timer after the first scene render has finished warming up', () => {
    vi.mocked(engine.render).mockImplementationOnce(() => { now += 30000; });
    engine.startMatch();
    expect(engine.matchTimeRemaining).toBe(90);
    frame(1000);
    expect(engine.matchTimeRemaining).toBe(89);
  });
  it('moves the same distance for a 200ms frame as four 50ms frames', () => {
    engine.startMatch();
    engine.setVirtualInput('p1', 'up', true);
    frame(200);
    const slow = { ...engine.states.get('p1')! };
    engine.startMatch();
    engine.setVirtualInput('p1', 'up', true);
    for (let i = 0; i < 4; i++) frame(50);
    const normal = engine.states.get('p1')!;
    expect(slow.x).toBeCloseTo(normal.x, 8);
    expect(slow.z).toBeCloseTo(normal.z, 8);
    expect(slow.speed).toBeCloseTo(normal.speed, 8);
  });
  it('clears both players held controls on pause, quit and restart', () => {
    engine.startMatch();
    for (const transition of [() => engine.pauseMatch(), () => engine.stopMatch(), () => engine.startMatch()]) {
      engine.setVirtualInput('p1', 'up', true); engine.setVirtualInput('p2', 'boost', true);
      transition();
      expect(Object.values(engine.virtualInputs).flatMap(Object.values).every((held) => !held)).toBe(true);
    }
  });
  it('restores pickups, hazards, dust, dog and dynamic spawns on a rematch', () => {
    engine.startMatch();
    const expectedIds = engine.arena.pickups.map((p) => p.id);
    engine.arena.pickups[0].collected = true;
    engine.arena.removePickupMesh(expectedIds[0]);
    engine.arena.cleanHazard(engine.arena.hazards[0].id);
    engine.arena.spawnDroppedDust(0, 0, 3);
    engine.arena.dogGroup.position.set(12, 3, 12);
    engine.floorManager.grid.fill(1);
    engine.startMatch();
    expect(engine.arena.pickups.map((p) => p.id)).toEqual(expectedIds);
    expect(engine.arena.pickups.every((p) => !p.collected)).toBe(true);
    expect(engine.arena.pickupMeshes.size).toBe(expectedIds.length);
    expect(engine.arena.hazards.every((h) => !h.cleaned)).toBe(true);
    expect([...engine.arena.hazardMeshes.values()].every((m) => m.visible)).toBe(true);
    expect(engine.floorManager.calculateCoverage().totalCleanedPercent).toBe(0);
    expect(engine.arena.dogGroup.position.toArray()).toEqual([0, 0, -2]);
  });
  it('awards one pickup only once and resets that award opportunity next round', () => {
    engine.startMatch();
    const pickup = engine.arena.pickups.find((p) => p.id === 'crumb_1')!;
    const robot = engine.states.get('p1')!;
    robot.x = pickup.x; robot.z = pickup.z;
    (engine as any).updatePhysics(0);
    expect(robot.dustPoints).toBe(40);
    (engine as any).updatePhysics(0);
    expect(robot.dustPoints).toBe(40);
  });
  it('computes coverage from independently populated cells, including stolen territory', () => {
    engine.floorManager.grid.fill(0);
    engine.floorManager.grid.fill(1, 0, 2304);
    engine.floorManager.grid.fill(2, 2304, 4608);
    expect(engine.floorManager.calculateCoverage()).toEqual({ playerPercents: { p1: 25, p2: 25, bot1: 0, bot2: 0 }, dirtRemainingPercent: 50, totalCleanedPercent: 50 });
    engine.floorManager.grid.fill(2, 0, 2304);
    expect(engine.floorManager.calculateCoverage().playerPercents).toEqual({ p1: 0, p2: 50, bot1: 0, bot2: 0 });
  });
  it('ranks dust and bumps in results rather than declaring the coverage leader winner', () => {
    engine.startMatch();
    engine.floorManager.grid.fill(1, 0, 2304); // p1: 25% => 250 pts
    engine.states.get('p2')!.dustPoints = 225;
    engine.states.get('p2')!.bumpsGiven = 2; // p2: 275 pts
    let result: MatchStats | undefined;
    engine.onMatchEnd = (stats) => { result = stats; };
    frame(90000);
    expect(result!.winnerId).toBe('p2');
    expect(result!.leaderboard.map((p) => p.id)).toEqual(['p2', 'p1', 'bot1', 'bot2']);
    expect(result!.leaderboard.map((p) => p.rank)).toEqual([1, 2, 3, 4]);
  });
  it('steers and accelerates the two human players independently', () => {
    engine.updateProfiles(profiles.map((p) => ({ ...p, isHuman: p.id === 'p1' || p.id === 'p2' })));
    engine.startMatch();
    engine.setVirtualInput('p1', 'up', true);
    engine.setVirtualInput('p2', 'right', true);
    const p1 = engine.states.get('p1')!; const p2 = engine.states.get('p2')!;
    const originalHeading = p2.heading;
    (engine as any).updatePhysics(0.05);
    expect(p1.speed).toBeGreaterThan(0);
    expect(p2.heading).toBeGreaterThan(originalHeading);
    expect(p2.speed).toBe(0);
    expect(engine.arena.scene).toBeInstanceOf(THREE.Scene);
  });
});
