/**
 * GameEngine
 * Manages Roomba kinematics, circle-to-circle elastic bumper collisions,
 * furniture colliders, pickups, AI bots, floor sweeping, camera tracking,
 * and local split-screen dual viewports.
 */
import * as THREE from 'three';
import {
  GameMode,
  RobotProfile,
  RobotLiveState,
  MatchStats,
  DustPickup,
} from '../types/game';
import { createProceduralRoomba, RoombaMeshParts } from './ProceduralRoomba';
import { createDesignerPenthouse, ArenaComponents } from './ArenaScene';
import { FloorTextureManager } from './FloorTextureManager';
import { soundSynth } from '../audio/SoundSynth';
import { totalScore } from './scoring';
import { disposeObject } from './disposeObject';

export class GameEngine {
  public canvasContainer: HTMLElement;
  public renderer: THREE.WebGLRenderer;
  public floorManager: FloorTextureManager;
  public arena: ArenaComponents;

  public camera1: THREE.PerspectiveCamera;
  public camera2: THREE.PerspectiveCamera;
  public garageCamera: THREE.PerspectiveCamera;

  public gameMode: GameMode = 'solo';
  public profiles: RobotProfile[] = [];
  public states: Map<string, RobotLiveState> = new Map();
  public meshes: Map<string, RoombaMeshParts> = new Map();

  // Input states
  private keysHeld: Set<string> = new Set();
  public virtualInputs: {
    p1: { up: boolean; down: boolean; left: boolean; right: boolean; boost: boolean };
    p2: { up: boolean; down: boolean; left: boolean; right: boolean; boost: boolean };
  } = {
    p1: { up: false, down: false, left: false, right: false, boost: false },
    p2: { up: false, down: false, left: false, right: false, boost: false },
  };

  public setVirtualInput(
    player: 'p1' | 'p2',
    action: 'up' | 'down' | 'left' | 'right' | 'boost',
    active: boolean
  ) {
    if (this.virtualInputs[player]) {
      this.virtualInputs[player][action] = active;
    }
  }

  public clearInputs() {
    this.keysHeld.clear();
    for (const input of Object.values(this.virtualInputs)) {
      for (const action of Object.keys(input)) input[action as keyof typeof input] = false;
    }
  }

  // Match loop
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private animationFrameId: number | null = null;
  private lastTime: number = 0;
  private scoreUpdateTime = 0;
  private lowGraphics = false;
  public matchTimeRemaining: number = 90; // 90 second matches
  public matchTotalTime: number = 90;

  // Camera shake & hitstop
  private cameraShake: number = 0;
  private hitstopDuration: number = 0;

  // High Value Spot Spawning & Tracking
  private highValueTimer: number = 0;
  private lastDogStatus: string = 'patrol';

  // Callbacks to React UI
  public onTimeUpdate?: (remaining: number) => void;
  public onScoresUpdate?: (
    coverage: Record<string, number>,
    dirtRemaining: number,
    stats: RobotLiveState[],
    pickups?: DustPickup[],
    dogPos?: { x: number; z: number; status: string }
  ) => void;
  public onHighValueCleaned?: (cleanerName: string, label: string, color: string) => void;
  public onHighValueSpawned?: (label: string) => void;
  public onMatchEnd?: (stats: MatchStats) => void;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundResize: () => void;
  private boundBlur: () => void;

  constructor(container: HTMLElement, profiles: RobotProfile[], mode: GameMode = 'solo') {
    this.canvasContainer = container;
    this.gameMode = mode;
    this.profiles = profiles;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Initialize WebGLRenderer
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false,
    });
    const gl = this.renderer.getContext?.();
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    const rendererName = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';
    this.lowGraphics = !!window.matchMedia?.('(pointer: coarse)').matches || /swiftshader|llvmpipe|software/i.test(rendererName);
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.lowGraphics ? 1 : 2));
    this.renderer.shadowMap.enabled = !this.lowGraphics;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    // Dynamic Floor
    this.floorManager = new FloorTextureManager(30);

    // Arena Scene
    this.arena = createDesignerPenthouse(this.renderer, this.floorManager, 30);
    if (this.lowGraphics) {
      this.arena.scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          if (material instanceof THREE.MeshPhysicalMaterial) material.transmission = 0;
        }
      });
    }

    // Cameras
    const aspect = width / height;
    this.camera1 = new THREE.PerspectiveCamera(65, aspect, 0.1, 150);
    this.camera2 = new THREE.PerspectiveCamera(65, aspect / 2, 0.1, 150);
    this.garageCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    this.garageCamera.position.set(0, 1.8, 3.2);
    this.garageCamera.lookAt(0, 0.2, 0);

    // Setup Roombas
    this.initRobots();

    // Bind event handlers
    this.boundKeyDown = (e: KeyboardEvent) => {
      if (!this.isRunning || this.isPaused || (e.target instanceof HTMLElement && e.target.closest('input, textarea, select'))) return;
      // Prevent browser default scrolling on arrow keys and space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
      }
      this.keysHeld.add(e.code);
    };
    this.boundKeyUp = (e: KeyboardEvent) => {
      this.keysHeld.delete(e.code);
    };
    this.boundBlur = () => {
      this.clearInputs();
      soundSynth.stopEngineHum();
    };
    this.boundResize = () => {
      this.handleResize();
    };

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('blur', this.boundBlur);
    window.addEventListener('resize', this.boundResize);

    // Precompile scene shaders
    this.renderer.compile(this.arena.scene, this.camera1);
  }

  public setGameMode(mode: GameMode) {
    this.gameMode = mode;
    this.handleResize();
  }

  public initRobots() {
    // Clear existing
    this.meshes.forEach((m) => {
      this.arena.scene.remove(m.group);
      disposeObject(m.group);
    });
    this.meshes.clear();
    this.states.clear();

    const spawnRadius = Math.sqrt(200); // Clear corner lanes at (+/-10, +/-10).
    const count = this.profiles.length;

    this.profiles.forEach((profile, index) => {
      this.floorManager.registerPlayer(profile.id, index + 1);

      // Distribute spawn points in a circle around arena center
      const angle = (index * Math.PI * 2) / count + Math.PI / 4;
      const sx = Math.cos(angle) * spawnRadius;
      const sz = Math.sin(angle) * spawnRadius;

      const liveState: RobotLiveState = {
        id: profile.id,
        x: sx,
        z: sz,
        vx: 0,
        vz: 0,
        heading: Math.atan2(-sx, -sz), // face toward arena center
        speed: 0,
        angularVelocity: 0,
        boost: 100,
        isBoosting: false,
        isStunned: false,
        stunTimer: 0,
        dustPoints: 0,
        cleanedTiles: 0,
        coveragePercent: 0,
        bumpsGiven: 0,
        bumpsReceived: 0,
        spinoutTimer: 0,
        spinoutCooldown: 0,
      };
      this.states.set(profile.id, liveState);

      const parts = createProceduralRoomba(profile.skin, 0.7);
      parts.group.position.set(sx, 0, sz);
      parts.group.rotation.y = liveState.heading;
      this.arena.scene.add(parts.group);
      this.meshes.set(profile.id, parts);
    });
  }

  public updateProfiles(newProfiles: RobotProfile[]) {
    const previousProfiles = this.profiles;
    this.profiles = newProfiles;
    this.profiles.forEach((p) => {
      const meshParts = this.meshes.get(p.id);
      if (meshParts && previousProfiles.find((old) => old.id === p.id)?.skin !== p.skin) {
        meshParts.updateSkin(p.skin);
      }
    });
  }

  public startMatch(durationSeconds: number = 90) {
    this.stopMatch();
    this.arena.resetMatch();
    this.highValueTimer = 0;
    this.scoreUpdateTime = 0;
    this.cameraShake = 0;
    this.hitstopDuration = 0;
    this.lastDogStatus = 'patrol';
    this.matchTimeRemaining = durationSeconds;
    this.matchTotalTime = durationSeconds;
    this.floorManager.resetDust();
    this.initRobots();
    // Warm the restored scene before starting the clock: shader compilation can
    // otherwise consume a large part of a rematch on software/mobile renderers.
    this.render();
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    soundSynth.ensureContext();
    this.onTimeUpdate?.(durationSeconds);
    this.calculateMatchScores();
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  public pauseMatch() {
    this.isPaused = true;
    this.clearInputs();
    soundSynth.stopEngineHum();
  }

  public resumeMatch() {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.lastTime = performance.now();
    soundSynth.ensureContext();
  }

  public stopMatch() {
    this.isRunning = false;
    this.clearInputs();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    soundSynth.stopEngineHum();
  }

  private loop = () => {
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame(this.loop);

    const now = performance.now();
    const elapsed = Math.max(0, (now - this.lastTime) / 1000);
    let dt = elapsed;
    this.lastTime = now;

    // Clamp dt to avoid physics tunnelling
    dt = Math.min(dt, 0.05);

    if (this.isPaused) {
      this.render();
      return;
    }

    // Wall-clock match duration is independent of rendering rate and collision hitstop.
    this.matchTimeRemaining = Math.max(0, this.matchTimeRemaining - elapsed);
    this.onTimeUpdate?.(Math.ceil(this.matchTimeRemaining));
    if (this.matchTimeRemaining <= 0) {
      this.calculateMatchScores();
      this.endMatch();
      return;
    }

    // Hitstop micro-dilation
    if (this.hitstopDuration > 0) {
      this.hitstopDuration -= dt;
      this.render();
      return;
    }

    // Catch up short slow frames in safe collision steps instead of slowing the game.
    const simulationTime = Math.min(elapsed, 0.5);
    const steps = Math.max(1, Math.ceil(simulationTime / 0.05));
    for (let step = 0; step < steps; step++) this.updateSimulation(simulationTime / steps);
    this.render();

    this.scoreUpdateTime += elapsed;
    if (this.scoreUpdateTime >= 0.1) {
      this.scoreUpdateTime = 0;
      this.calculateMatchScores();
    }
  };

  private updateSimulation(dt: number) {
    // Physics & Actor Updates
    this.updatePhysics(dt);

    // Update Arena Props & Dynamic Chasing Dog
    const robotPositions = Array.from(this.states.values()).map((st) => ({
      id: st.id,
      x: st.x,
      z: st.z,
    }));
    const dogResult = this.arena.updateDog(dt, robotPositions);
    this.lastDogStatus = dogResult.dogStatus;

    if (dogResult.grabbedRobotId) {
      const gState = this.states.get(dogResult.grabbedRobotId);
      const gParts = this.meshes.get(dogResult.grabbedRobotId);
      if (gState && gParts) {
        gState.isDogGrabbed = true;
        gState.x = dogResult.mouthPos.x;
        gState.z = dogResult.mouthPos.z;
        gState.vx = 0;
        gState.vz = 0;
        gState.speed = 0;
        // Roomba held up in dog's jaws with comical tilt and struggle wobble
        gParts.group.position.set(gState.x, 0.38, gState.z);
        gParts.group.rotation.x = 0.25;
        gParts.group.rotation.z = Math.sin(Date.now() * 0.02) * 0.2;
      }
    }

    if (dogResult.droppedRobotId) {
      const dState = this.states.get(dogResult.droppedRobotId);
      const dParts = this.meshes.get(dogResult.droppedRobotId);
      if (dState && dParts) {
        dState.isDogGrabbed = false;
        dState.x = -11.0;
        dState.z = -11.0;
        dState.vx = 4.0;
        dState.vz = 4.0;
        dParts.group.position.set(dState.x, 0, dState.z);
        dParts.group.rotation.set(0, dState.heading, 0);
      }
    }

    this.arena.updatePickups(dt);

    // Periodic High Value Spot dynamic spawn check (every 18s)
    this.highValueTimer += dt;
    if (this.highValueTimer >= 18.0) {
      this.highValueTimer = 0;
      const spawned = this.arena.spawnDynamicHighValueSpot();
      if (spawned) {
        soundSynth.playHighValueSpawn();
        this.onHighValueSpawned?.(spawned.label || '★ HIGH VALUE SPOT DETECTED!');
      }
    }

    // Update Camera Shake
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 4.5);
    }

    // Update Audio Hum
    const p1State = this.states.get('p1');
    if (p1State) {
      soundSynth.updateEngineHum(p1State.speed / 8.0, p1State.isBoosting);
    }

  }

  private updatePhysics(dt: number) {
    const arenaBound = 14.3; // Half arena size minus Roomba radius
    // Significantly faster and snappier arcade speeds
    const standardMaxSpeed = 13.5; // was 7.2
    const boostMaxSpeed = 22.5; // was 12.8
    const accelRate = 34.0; // was 18.0
    const turnRate = 5.2; // was 3.8
    const dragCoeff = 3.0; // was 3.6

    this.profiles.forEach((profile) => {
      const state = this.states.get(profile.id);
      const parts = this.meshes.get(profile.id);
      if (!state || !parts) return;

      // Handle Dog Grab (carried by dog to corner)
      if (state.isDogGrabbed) {
        parts.updateAnimation(dt, 0, false);
        return;
      }

      // Handle Stun
      if (state.stunTimer > 0) {
        state.stunTimer -= dt;
        if (state.stunTimer <= 0) state.isStunned = false;
      }

      // Handle Hazard Spinout Cooldown
      if (state.spinoutCooldown > 0) {
        state.spinoutCooldown -= dt;
      }

      // Handle Spinout (from wet floor puddle)
      if (state.spinoutTimer > 0) {
        state.spinoutTimer -= dt;
        state.heading += 9.0 * dt;
        // Keep moving with slide momentum so the robot naturally slides clear of the spot
        state.x += state.vx * dt;
        state.z += state.vz * dt;
        state.vx *= 0.96;
        state.vz *= 0.96;
        parts.group.position.set(state.x, 0, state.z);
        parts.group.rotation.y = state.heading;
        parts.updateAnimation(dt, state.speed, false);
        return;
      }

      let throttle = 0;
      let steer = 0;
      let wantsBoost = false;

      // Input Processing (combines keyboard + on-screen virtual touch controls)
      if (profile.isHuman) {
        if (profile.playerIndex === 1) {
          const v = this.virtualInputs.p1;
          if (this.keysHeld.has('KeyW') || v.up) throttle += 1;
          if (this.keysHeld.has('KeyS') || v.down) throttle -= 0.6;
          if (this.keysHeld.has('KeyA') || v.left) steer -= 1;
          if (this.keysHeld.has('KeyD') || v.right) steer += 1;
          wantsBoost = this.keysHeld.has('Space') || v.boost;
        } else if (profile.playerIndex === 2) {
          const v = this.virtualInputs.p2;
          if (this.keysHeld.has('ArrowUp') || v.up) throttle += 1;
          if (this.keysHeld.has('ArrowDown') || v.down) throttle -= 0.6;
          if (this.keysHeld.has('ArrowLeft') || v.left) steer -= 1;
          if (this.keysHeld.has('ArrowRight') || v.right) steer += 1;
          wantsBoost = this.keysHeld.has('Enter') || this.keysHeld.has('ShiftRight') || v.boost;
        }
      } else {
        // AI Bot Controller
        const botInput = this.computeBotInput(state);
        throttle = botInput.throttle;
        steer = botInput.steer;
        wantsBoost = botInput.boost;
      }

      // Boost Management
      if (wantsBoost && state.boost > 5 && !state.isStunned && throttle > 0.1) {
        state.isBoosting = true;
        state.boost = Math.max(0, state.boost - dt * 32);
        if (Math.random() < 0.14 && profile.playerIndex === 1) {
          soundSynth.playBoostWhoosh();
        }
      } else {
        state.isBoosting = false;
        // Faster passive boost recharge for continuous action
        state.boost = Math.min(100, state.boost + dt * 12.0);
      }

      // Steering & Heading
      if (!state.isStunned) {
        state.heading += steer * turnRate * dt;
      }

      // Acceleration along heading
      const forwardX = Math.sin(state.heading);
      const forwardZ = Math.cos(state.heading);
      const effectiveMaxSpeed = state.isBoosting ? boostMaxSpeed : standardMaxSpeed;

      if (!state.isStunned && Math.abs(throttle) > 0.01) {
        state.vx += forwardX * throttle * accelRate * dt;
        state.vz += forwardZ * throttle * accelRate * dt;
      }

      // Drag / Friction
      state.vx -= state.vx * dragCoeff * dt;
      state.vz -= state.vz * dragCoeff * dt;

      // Speed clamping
      state.speed = Math.hypot(state.vx, state.vz);
      if (state.speed > effectiveMaxSpeed) {
        const scale = effectiveMaxSpeed / state.speed;
        state.vx *= scale;
        state.vz *= scale;
        state.speed = effectiveMaxSpeed;
      }

      // Apply displacement
      state.x += state.vx * dt;
      state.z += state.vz * dt;

      // Arena boundary collision
      if (Math.abs(state.x) > arenaBound) {
        state.x = Math.sign(state.x) * arenaBound;
        state.vx = -state.vx * 0.45;
        parts.triggerBumperCompression();
        if (profile.isHuman) soundSynth.playBump(0.6);
      }
      if (Math.abs(state.z) > arenaBound) {
        state.z = Math.sign(state.z) * arenaBound;
        state.vz = -state.vz * 0.45;
        parts.triggerBumperCompression();
        if (profile.isHuman) soundSynth.playBump(0.6);
      }

      // Furniture colliders
      this.arena.colliders.forEach((col) => {
        const halfW = col.width / 2 + 0.65;
        const halfD = col.depth / 2 + 0.65;
        const dx = state.x - col.x;
        const dz = state.z - col.z;

        if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
          // Push out along shallowest penetration axis
          const overlapX = halfW - Math.abs(dx);
          const overlapZ = halfD - Math.abs(dz);

          if (overlapX < overlapZ) {
            state.x = col.x + (Math.sign(dx) || 1) * halfW;
            state.vx = -state.vx * 0.5;
          } else {
            state.z = col.z + (Math.sign(dz) || 1) * halfD;
            state.vz = -state.vz * 0.5;
          }
          parts.triggerBumperCompression();
          if (profile.isHuman) soundSynth.playBump(0.7);
        }
      });

      // Hazard Zones (Wet floor puddle - cleanable by Roomba!)
      this.arena.hazards.forEach((haz) => {
        if (haz.cleaned) return;
        const dist = Math.hypot(state.x - haz.x, state.z - haz.z);
        if (dist < haz.radius + 0.4 && state.spinoutTimer <= 0 && state.spinoutCooldown <= 0) {
          // Snappy 0.45s 360-spin drift
          state.spinoutTimer = 0.45;
          state.spinoutCooldown = 6.0; // 6 seconds immunity so you NEVER get trapped
          soundSynth.playHazardStun();

          // Roomba vacuums & mops up the spill!
          this.arena.cleanHazard(haz.id);
          state.dustPoints += 35; // Bonus for cleaning up the water spill!
          if (profile.isHuman) {
            soundSynth.playVacuumPop();
          }
        }
      });

      // Pickups & High Value Spots collision
      this.arena.pickups.forEach((pickup) => {
        if (pickup.collected) return;
        const dist = Math.hypot(state.x - pickup.x, state.z - pickup.z);
        if (dist < pickup.radius + 0.7) {
          pickup.collected = true;
          this.arena.removePickupMesh(pickup.id);

          if (pickup.isHighValue) {
            // HIGH-VALUE SPOT CLEANED!
            state.dustPoints += pickup.value;
            state.boost = 100; // instant turbo recharge
            this.arena.spawnHighValueCleanBurst(pickup.x, pickup.z);
            this.floorManager.stampHighValueClean(
              pickup.x,
              pickup.z,
              profile.skin.primaryColor,
              pickup.value,
              pickup.label
            );
            soundSynth.playHighValueChime();
            this.onHighValueCleaned?.(
              profile.name,
              pickup.label || `★ +${pickup.value} PTS`,
              profile.skin.primaryColor
            );
          } else if (pickup.type === 'battery_boost') {
            state.boost = 100;
            if (profile.isHuman) {
              soundSynth.playVacuumPop();
            }
          } else {
            state.dustPoints += pickup.value;
            if (profile.isHuman) {
              soundSynth.playVacuumPop();
            }
          }
        }
      });

      // Dynamic floor vacuum sweep
      this.floorManager.sweep({
        x: state.x,
        z: state.z,
        radius: 0.68,
        playerId: profile.id,
        color: profile.skin.primaryColor,
      });

      // Sync 3D Mesh
      parts.group.position.set(state.x, 0, state.z);
      parts.group.rotation.y = state.heading;
      parts.updateAnimation(dt, state.speed, state.isBoosting);
    });

    // Elastic Circle-to-Circle Bumper Collisions between all Roombas
    const robotList = Array.from(this.states.values());
    const bumperRadius = 0.7;

    for (let i = 0; i < robotList.length; i++) {
      for (let j = i + 1; j < robotList.length; j++) {
        const r1 = robotList[i];
        const r2 = robotList[j];

        const dx = r2.x - r1.x;
        const dz = r2.z - r1.z;
        const dist = Math.hypot(dx, dz);
        const minDist = bumperRadius * 2;

        if (dist < minDist && dist > 0.001) {
          // Normal vector
          const nx = dx / dist;
          const nz = dz / dist;

          // Separate overlapping spheres
          const overlap = minDist - dist;
          r1.x -= nx * overlap * 0.5;
          r1.z -= nz * overlap * 0.5;
          r2.x += nx * overlap * 0.5;
          r2.z += nz * overlap * 0.5;

          // Relative velocity
          const rvx = r1.vx - r2.vx;
          const rvz = r1.vz - r2.vz;
          const velAlongNormal = rvx * nx + rvz * nz;

          if (velAlongNormal > 0) {
            // Elastic collision restitution
            const restitution = 1.35; // springy arcade bounce
            const impulse = (restitution * velAlongNormal) / 2;

            r1.vx -= impulse * nx;
            r1.vz -= impulse * nz;
            r2.vx += impulse * nx;
            r2.vz += impulse * nz;

            // Trigger bumper compression animations
            const mesh1 = this.meshes.get(r1.id);
            const mesh2 = this.meshes.get(r2.id);
            mesh1?.triggerBumperCompression();
            mesh2?.triggerBumperCompression();

            const impactSpeed = Math.abs(velAlongNormal);
            soundSynth.playBump(impactSpeed * 0.25);

            // Heavy Bumper Royale Hit
            if (impactSpeed > 3.8) {
              this.hitstopDuration = 0.04; // 40ms hitstop
              this.cameraShake = 0.35;

              // Determine aggressor based on speed
              const speed1 = Math.hypot(r1.vx, r1.vz);
              const speed2 = Math.hypot(r2.vx, r2.vz);
              const victim = speed1 > speed2 ? r2 : r1;
              const attacker = speed1 > speed2 ? r1 : r2;

              victim.isStunned = true;
              victim.stunTimer = 0.45;
              victim.bumpsReceived += 1;
              attacker.bumpsGiven += 1;

              // Victim drops loose dust crumbs!
              this.arena.spawnDroppedDust(victim.x, victim.z, 3);
            }
          }
        }
      }
    }
  }

  /**
   * Smart AI Bot Logic:
   * Target selection (crumbs, batteries, or rival leader), obstacle avoidance, and aggressive bumping
   */
  private computeBotInput(bot: RobotLiveState): { throttle: number; steer: number; boost: boolean } {
    let targetX = 0;
    let targetZ = 0;
    let minTargetDist = 999;
    let foundPickup = false;

    // 1. Look for uncollected pickups, giving HIGH-VALUE spots 3.5x priority
    this.arena.pickups.forEach((p) => {
      if (p.collected) return;
      const d = Math.hypot(p.x - bot.x, p.z - bot.z);
      // High value spots appear 3.5x closer to AI bots so they aggressively rush to contest them!
      const effectiveDist = p.isHighValue ? d / 3.5 : d;
      if (effectiveDist < minTargetDist) {
        minTargetDist = effectiveDist;
        targetX = p.x;
        targetZ = p.z;
        foundPickup = true;
      }
    });

    // 2. If no nearby pickup, target human players to bump them!
    if (!foundPickup || minTargetDist > 14) {
      const p1 = this.states.get('p1');
      if (p1) {
        targetX = p1.x;
        targetZ = p1.z;
      }
    }

    // Direction to target
    const toTargetX = targetX - bot.x;
    const toTargetZ = targetZ - bot.z;
    const desiredHeading = Math.atan2(toTargetX, toTargetZ);

    let angleDiff = desiredHeading - bot.heading;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const steer = Math.max(-1, Math.min(1, angleDiff * 2.2));
    const throttle = Math.abs(angleDiff) < 0.6 ? 1.0 : 0.6;
    const boost = Math.abs(angleDiff) < 0.25 && minTargetDist < 6.0 && bot.boost > 30;

    return { throttle, steer, boost };
  }

  private calculateMatchScores() {
    const coverageData = this.floorManager.calculateCoverage();
    const liveStats = Array.from(this.states.values());

    liveStats.forEach((st) => {
      st.coveragePercent = coverageData.playerPercents[st.id] || 0;
    });

    if (this.onScoresUpdate) {
      const activePickups = this.arena.pickups.filter((p) => !p.collected);
      const dogPos = {
        x: this.arena.dogGroup.position.x,
        z: this.arena.dogGroup.position.z,
        status: this.lastDogStatus,
      };
      this.onScoresUpdate(
        coverageData.playerPercents,
        coverageData.dirtRemainingPercent,
        liveStats,
        activePickups,
        dogPos
      );
    }
  }

  private endMatch() {
    this.stopMatch();
    soundSynth.playVictory();

    const coverageData = this.floorManager.calculateCoverage();
    const liveStats = Array.from(this.states.values());

    const leaderboard = this.profiles
      .map((p) => {
        const state = this.states.get(p.id)!;
        const coverage = coverageData.playerPercents[p.id] || 0;
        return {
          id: p.id,
          name: p.name,
          isHuman: p.isHuman,
          coveragePercent: coverage,
          dustPoints: state.dustPoints,
          bumpsGiven: state.bumpsGiven,
          rank: 1,
        };
      })
      .sort((a, b) => {
        return totalScore(b) - totalScore(a);
      })
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    const winner = leaderboard[0];

    const matchStats: MatchStats = {
      duration: this.matchTotalTime,
      winnerId: winner.id,
      winnerName: winner.name,
      leaderboard,
      totalDirtCleanedPercent: coverageData.totalCleanedPercent,
    };

    if (this.onMatchEnd) {
      this.onMatchEnd(matchStats);
    }
  }

  private updateCamera(camera: THREE.PerspectiveCamera, targetState: RobotLiveState, dt: number) {
    // Dynamic chase camera with smart wall boundary clamping & auto-elevation
    const cameraDist = targetState.isBoosting ? 5.6 : 4.6;
    let cameraHeight = 3.6;

    const backX = -Math.sin(targetState.heading) * cameraDist;
    const backZ = -Math.cos(targetState.heading) * cameraDist;

    const desiredX = targetState.x + backX;
    const desiredZ = targetState.z + backZ;

    // Interior room safety boundary (walls are at +-15.0).
    // Clamping at +-12.8 strictly guarantees the camera NEVER exits the room or goes behind any wall!
    const maxBound = 12.8;
    const clampedX = Math.max(-maxBound, Math.min(maxBound, desiredX));
    const clampedZ = Math.max(-maxBound, Math.min(maxBound, desiredZ));

    // When the camera is pushed closer to the Roomba by an arena wall,
    // dynamically elevate the camera height and angle down over the Roomba!
    const horizontalDistance = Math.hypot(clampedX - targetState.x, clampedZ - targetState.z);
    if (horizontalDistance < cameraDist) {
      const compressionRatio = 1 - (horizontalDistance / cameraDist);
      cameraHeight += compressionRatio * 4.2; // smoothly climbs up to ~7.8m high-angle overhead view
    }

    const targetPos = new THREE.Vector3(
      clampedX + (Math.random() - 0.5) * this.cameraShake,
      cameraHeight + (Math.random() - 0.5) * this.cameraShake,
      clampedZ
    );

    camera.position.lerp(targetPos, 0.16);

    const lookTarget = new THREE.Vector3(
      targetState.x + Math.sin(targetState.heading) * 1.6,
      0.25,
      targetState.z + Math.cos(targetState.heading) * 1.6
    );
    camera.lookAt(lookTarget);

    // FOV dynamic expansion on boost
    const targetFov = targetState.isBoosting ? 76 : 64;
    camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6.0, dt);
    camera.updateProjectionMatrix();
  }

  public render() {
    const width = this.canvasContainer.clientWidth;
    const height = this.canvasContainer.clientHeight;
    const p1 = this.states.get('p1');
    const p2 = this.states.get('p2');

    if (this.gameMode === 'splitscreen' && p1 && p2) {
      // 2-Player Local Split-Screen with Scissor Test
      this.renderer.setScissorTest(true);
      const halfW = Math.floor(width / 2);

      // Left Viewport (Player 1)
      this.camera1.aspect = halfW / height;
      this.camera1.updateProjectionMatrix();
      this.updateCamera(this.camera1, p1, 0.016);
      this.renderer.setViewport(0, 0, halfW, height);
      this.renderer.setScissor(0, 0, halfW, height);
      this.renderer.render(this.arena.scene, this.camera1);

      // Right Viewport (Player 2)
      this.camera2.aspect = halfW / height;
      this.camera2.updateProjectionMatrix();
      this.updateCamera(this.camera2, p2, 0.016);
      this.renderer.setViewport(halfW, 0, width - halfW, height);
      this.renderer.setScissor(halfW, 0, width - halfW, height);
      this.renderer.render(this.arena.scene, this.camera2);

      this.renderer.setScissorTest(false);
    } else {
      // Solo Mode (Single Full Viewport)
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, width, height);
      if (p1) {
        this.camera1.aspect = width / height;
        this.camera1.updateProjectionMatrix();
        this.updateCamera(this.camera1, p1, 0.016);
        this.renderer.render(this.arena.scene, this.camera1);
      }
    }
  }

  /**
   * Turntable render for Garage Customizer screen
   */
  public renderGarageTurntable(robotId: string, rotAngle: number) {
    const parts = this.meshes.get(robotId);
    if (!parts) return;

    const width = this.canvasContainer.clientWidth;
    const height = this.canvasContainer.clientHeight;
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, width, height);

    this.garageCamera.aspect = width / height;
    this.garageCamera.updateProjectionMatrix();

    // Center selected robot and spin
    parts.group.position.set(0, 0, 0);
    parts.group.rotation.y = rotAngle;
    parts.updateAnimation(0.016, 2.0, false);

    this.renderer.render(this.arena.scene, this.garageCamera);
  }

  private handleResize() {
    if (!this.canvasContainer) return;
    const width = this.canvasContainer.clientWidth;
    const height = this.canvasContainer.clientHeight;

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.lowGraphics ? 1 : 2));

    if (this.gameMode === 'splitscreen') {
      this.camera1.aspect = (width / 2) / height;
      this.camera2.aspect = (width / 2) / height;
    } else {
      this.camera1.aspect = width / height;
    }
    this.camera1.updateProjectionMatrix();
    this.camera2.updateProjectionMatrix();
    this.garageCamera.aspect = width / height;
    this.garageCamera.updateProjectionMatrix();
  }

  public dispose() {
    this.stopMatch();
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundBlur);
    window.removeEventListener('resize', this.boundResize);

    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.floorManager.dispose();
    disposeObject(this.arena.scene);
    this.arena.scene.environment?.dispose();
    this.renderer.dispose();
  }
}
