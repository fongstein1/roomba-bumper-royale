/**
 * ArenaScene
 * Sets up the 3D Designer Penthouse environment, studio lighting,
 * furniture colliders, roaming pet obstacle, and collectible crumbs/power-ups.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FurnitureCollider, DustPickup, HazardZone } from '../types/game';
import { FloorTextureManager } from './FloorTextureManager';

export interface ArenaComponents {
  scene: THREE.Scene;
  floorMesh: THREE.Mesh;
  colliders: FurnitureCollider[];
  pickups: DustPickup[];
  pickupMeshes: Map<string, THREE.Group>;
  hazards: HazardZone[];
  hazardMeshes: Map<string, THREE.Mesh>;
  petGroup: THREE.Group;
  updatePet: (dt: number) => void;
  updatePickups: (dt: number) => void;
  removePickupMesh: (id: string) => void;
  cleanHazard: (id: string) => void;
  spawnDroppedDust: (x: number, z: number, count: number) => void;
}

export function createDesignerPenthouse(
  renderer: THREE.WebGLRenderer,
  floorManager: FloorTextureManager,
  arenaSize: number = 30
): ArenaComponents {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdce7f0); // soft morning daylight sky

  // Procedural Studio Environment for PBR reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  pmremGenerator.dispose();

  // Subtle atmospheric distance fog
  scene.fog = new THREE.Fog(0xdce7f0, 28, 55);

  // 1. Studio Lighting Rig
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xc7d2fe, 0.75); // cool sky & warm bounce
  hemiLight.position.set(0, 30, 0);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff6ea, 1.6); // warm morning sunlight
  sunLight.position.set(18, 24, 14);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  const d = arenaSize * 0.7;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 70;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight);

  // Ambient soft fill
  const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.45);
  fillLight.position.set(-15, 18, -12);
  scene.add(fillLight);

  // 2. Floor Plane (uses dynamic FloorTextureManager)
  const floorGeo = new THREE.PlaneGeometry(arenaSize, arenaSize);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorManager.texture,
    roughness: 0.35,
    metalness: 0.1,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // 3. Penthouse Walls & Panoramic Window Frames
  const wallHeight = 4.2;
  const half = arenaSize / 2;

  // Baseboards along perimeter
  const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.4 });
  const bbThickness = 0.12;
  const bbHeight = 0.18;

  function createBaseboard(x: number, z: number, w: number, d: number) {
    const geo = new THREE.BoxGeometry(w, bbHeight, d);
    const m = new THREE.Mesh(geo, baseboardMat);
    m.position.set(x, bbHeight / 2, z);
    scene.add(m);
  }
  createBaseboard(0, -half, arenaSize, bbThickness);
  createBaseboard(0, half, arenaSize, bbThickness);
  createBaseboard(-half, 0, bbThickness, arenaSize);
  createBaseboard(half, 0, bbThickness, arenaSize);

  // Floor-to-ceiling glass wall on North (top z = -half)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xecfdf5,
    transmission: 0.92,
    opacity: 0.35,
    transparent: true,
    roughness: 0.05,
    metalness: 0.1,
    ior: 1.5,
  });
  const windowGeo = new THREE.PlaneGeometry(arenaSize, wallHeight);
  const northWindow = new THREE.Mesh(windowGeo, glassMat);
  northWindow.position.set(0, wallHeight / 2, -half);
  scene.add(northWindow);

  // Distant city skyline backdrop behind window
  const cityGroup = new THREE.Group();
  cityGroup.position.set(0, 0, -half - 8);
  for (let i = -12; i <= 12; i++) {
    const bh = 8 + ((Math.abs(i) * 7) % 18) + Math.sin(i * 1.5) * 6;
    const bw = 2.4 + ((i * 13) % 2);
    const bGeo = new THREE.BoxGeometry(bw, bh, 3);
    const bMat = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? 0x94a3b8 : 0x64748b,
      roughness: 0.6,
    });
    const building = new THREE.Mesh(bGeo, bMat);
    building.position.set(i * 3.2, bh / 2 - 2, 0);
    cityGroup.add(building);
  }
  scene.add(cityGroup);

  // Interior drywall on South, West and East:
  // Using FrontSide so if camera is ever at or behind wall, it looks straight through with zero occlusion
  const interiorWallMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.85,
    side: THREE.FrontSide, // Backfaces are completely transparent
  });
  // Wall height lowered to modern 2.2m architectural perimeter
  const archWallHeight = 2.2;
  const southWall = new THREE.Mesh(new THREE.BoxGeometry(arenaSize, archWallHeight, 0.2), interiorWallMat);
  southWall.position.set(0, archWallHeight / 2, half + 0.1);
  southWall.receiveShadow = true;
  scene.add(southWall);

  const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, archWallHeight, arenaSize), interiorWallMat);
  westWall.position.set(-half - 0.1, archWallHeight / 2, 0);
  westWall.receiveShadow = true;
  scene.add(westWall);

  const eastWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, archWallHeight, arenaSize), interiorWallMat);
  eastWall.position.set(half + 0.1, archWallHeight / 2, 0);
  eastWall.receiveShadow = true;
  scene.add(eastWall);

  // 4. Furniture Colliders & Procedural 3D Props
  const colliders: FurnitureCollider[] = [];

  // A. Modern Sectional Couch (Lounge Area: Center-Left)
  const couchGroup = new THREE.Group();
  couchGroup.position.set(-6, 0, 5);
  const couchMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 }); // slate fabric

  // Main seating bench
  const seatGeo = new THREE.BoxGeometry(4.8, 0.45, 2.0);
  const seat = new THREE.Mesh(seatGeo, couchMat);
  seat.position.set(0, 0.45 / 2, 0);
  seat.castShadow = true;
  seat.receiveShadow = true;
  couchGroup.add(seat);

  // Backrest
  const backGeo = new THREE.BoxGeometry(4.8, 0.65, 0.35);
  const back = new THREE.Mesh(backGeo, couchMat);
  back.position.set(0, 0.45 + 0.65 / 2, 0.85);
  back.castShadow = true;
  couchGroup.add(back);

  // Armrests
  const armGeo = new THREE.BoxGeometry(0.4, 0.65, 2.0);
  const armL = new THREE.Mesh(armGeo, couchMat);
  armL.position.set(-2.2, 0.45 + 0.2, 0);
  armL.castShadow = true;
  couchGroup.add(armL);

  const armR = new THREE.Mesh(armGeo, couchMat);
  armR.position.set(2.2, 0.45 + 0.2, 0);
  armR.castShadow = true;
  couchGroup.add(armR);

  scene.add(couchGroup);
  colliders.push({ id: 'couch', x: -6, z: 5, width: 5.0, depth: 2.2, name: 'Designer Sofa' });

  // B. Coffee Table
  const tableGroup = new THREE.Group();
  tableGroup.position.set(-6, 0, 1.8);
  const tableTopMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.5 });
  const topMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.08, 32), tableTopMat);
  topMesh.position.y = 0.42;
  topMesh.castShadow = true;
  tableGroup.add(topMesh);

  // Table tripod legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 }); // brass legs
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 12), legMat);
    const ang = (i * Math.PI * 2) / 3;
    leg.position.set(Math.cos(ang) * 0.85, 0.21, Math.sin(ang) * 0.85);
    leg.castShadow = true;
    tableGroup.add(leg);
  }
  scene.add(tableGroup);
  colliders.push({ id: 'coffee_table', x: -6, z: 1.8, width: 2.5, depth: 2.5, name: 'Round Coffee Table' });

  // C. Modern Kitchen Island (Top-Right Zone)
  const islandGroup = new THREE.Group();
  islandGroup.position.set(7.5, 0, -6.5);
  // Marble top
  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.15, metalness: 0.2 });
  const islandTop = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.14, 2.4), marbleMat);
  islandTop.position.y = 1.05;
  islandTop.castShadow = true;
  islandTop.receiveShadow = true;
  islandGroup.add(islandTop);

  // Wood base cabinet
  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.5 });
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.98, 2.1), cabinetMat);
  cabinet.position.y = 0.98 / 2;
  cabinet.castShadow = true;
  islandGroup.add(cabinet);

  scene.add(islandGroup);
  colliders.push({ id: 'kitchen_island', x: 7.5, z: -6.5, width: 4.4, depth: 2.6, name: 'Kitchen Island' });

  // D. Dining Table & Chairs (Center-Right Zone)
  const diningGroup = new THREE.Group();
  diningGroup.position.set(6.5, 0, 5.5);
  const oakMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.35 });
  const diningTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 1.8), oakMat);
  diningTop.position.y = 0.85;
  diningTop.castShadow = true;
  diningGroup.add(diningTop);

  // 4 Legs
  const dLegMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.7, roughness: 0.3 });
  [[-1.6, -0.75], [1.6, -0.75], [-1.6, 0.75], [1.6, 0.75]].forEach(([lx, lz]) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 12), dLegMat);
    l.position.set(lx, 0.85 / 2, lz);
    l.castShadow = true;
    diningGroup.add(l);
  });
  scene.add(diningGroup);
  colliders.push({ id: 'dining_table', x: 6.5, z: 5.5, width: 3.8, depth: 2.0, name: 'Dining Table' });

  // E. Large Ceramic Planters with Fiddle Leaf Fig
  function createPlanter(px: number, pz: number, plantRadius: number) {
    const pGroup = new THREE.Group();
    pGroup.position.set(px, 0, pz);

    const potMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.8, 24), potMat);
    pot.position.y = 0.4;
    pot.castShadow = true;
    pGroup.add(pot);

    // Plant trunk and leaves
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 }));
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    pGroup.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 });
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), leafMat);
      leaf.scale.set(1.4, 0.25, 0.9);
      const ang = (i * Math.PI * 2) / 7;
      leaf.position.set(Math.cos(ang) * 0.5, 1.4 + (i * 0.12), Math.sin(ang) * 0.5);
      leaf.rotation.set(0.3, ang, 0.2);
      leaf.castShadow = true;
      pGroup.add(leaf);
    }
    scene.add(pGroup);
    colliders.push({ id: `planter_${px}_${pz}`, x: px, z: pz, width: plantRadius * 2, depth: plantRadius * 2, name: 'Indoor Potted Fig' });
  }

  createPlanter(-12, -11, 0.8);
  createPlanter(12, 11, 0.8);
  createPlanter(-12, 11, 0.8);

  // 5. Dynamic Pet Hazard: Playful Tuxedo Cat on a roaming Roomba-safe Cushion
  const petGroup = new THREE.Group();
  petGroup.position.set(0, 0, -4);
  const petMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 }); // black tuxedo fur
  const whiteFurMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85 });

  // Pet round body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), petMat);
  body.scale.set(1.1, 0.8, 1.3);
  body.position.y = 0.35;
  body.castShadow = true;
  petGroup.add(body);

  // Pet white chest patch
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), whiteFurMat);
  chest.scale.set(0.8, 0.6, 0.9);
  chest.position.set(0, 0.3, 0.25);
  petGroup.add(chest);

  // Pet head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), petMat);
  head.position.set(0, 0.55, 0.32);
  head.castShadow = true;
  petGroup.add(head);

  // Cat ears
  const earMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 4), earMat);
  earL.position.set(-0.12, 0.72, 0.32);
  earL.rotation.z = 0.3;
  petGroup.add(earL);

  const earR = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 4), earMat);
  earR.position.set(0.12, 0.72, 0.32);
  earR.rotation.z = -0.3;
  petGroup.add(earR);

  // Wagging tail
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.45, 8), petMat);
  tail.position.set(0, 0.45, -0.45);
  tail.rotation.x = -0.7;
  petGroup.add(tail);

  scene.add(petGroup);

  let petTime = 0;
  function updatePet(dt: number) {
    petTime += dt;
    // Slow playful patrol around living room
    const targetX = Math.sin(petTime * 0.4) * 5.0;
    const targetZ = Math.cos(petTime * 0.3) * 4.0 - 2.0;

    petGroup.position.x = THREE.MathUtils.damp(petGroup.position.x, targetX, 2.0, dt);
    petGroup.position.z = THREE.MathUtils.damp(petGroup.position.z, targetZ, 2.0, dt);

    const angle = Math.atan2(Math.cos(petTime * 0.4) * 0.4 * 5.0, -Math.sin(petTime * 0.3) * 0.3 * 4.0);
    petGroup.rotation.y = THREE.MathUtils.damp(petGroup.rotation.y, angle, 4.0, dt);

    // Subtle breathing bounce & tail wag
    body.position.y = 0.35 + Math.sin(petTime * 4) * 0.02;
    tail.rotation.z = Math.sin(petTime * 6) * 0.4;
  }

  // 6. Hazards: Spilled Water Puddles (Causes Roomba spin-out)
  const hazards: HazardZone[] = [
    { id: 'spill_1', x: 2.5, z: -1.5, radius: 1.2, type: 'wet_spill' },
    { id: 'spill_2', x: -3.5, z: -8.0, radius: 1.1, type: 'wet_spill' },
  ];

  const hazardMeshes = new Map<string, THREE.Mesh>();

  hazards.forEach((hz) => {
    const puddleGeo = new THREE.CircleGeometry(hz.radius, 24);
    puddleGeo.rotateX(-Math.PI / 2);
    const puddleMat = new THREE.MeshPhysicalMaterial({
      color: 0x60a5fa,
      transmission: 0.85,
      roughness: 0.02,
      opacity: 0.7,
      transparent: true,
      depthWrite: false,
    });
    const puddle = new THREE.Mesh(puddleGeo, puddleMat);
    puddle.position.set(hz.x, 0.02, hz.z);
    scene.add(puddle);
    hazardMeshes.set(hz.id, puddle);
  });

  function cleanHazard(id: string) {
    const m = hazardMeshes.get(id);
    if (m) {
      scene.remove(m);
      hazardMeshes.delete(id);
    }
    const h = hazards.find((hz) => hz.id === id);
    if (h) {
      h.cleaned = true;
    }
  }

  // 7. Pickups: Golden Mega-Crumbs & Turbo Battery Packs
  const pickups: DustPickup[] = [
    { id: 'crumb_1', x: -1.5, z: 8.5, type: 'mega_crumb', value: 50, radius: 0.65, collected: false },
    { id: 'crumb_2', x: 10.5, z: -1.5, type: 'mega_crumb', value: 50, radius: 0.65, collected: false },
    { id: 'crumb_3', x: -9.5, z: -5.5, type: 'mega_crumb', value: 50, radius: 0.65, collected: false },
    { id: 'batt_1', x: 0, z: 0, type: 'battery_boost', value: 100, radius: 0.65, collected: false },
    { id: 'batt_2', x: -10, z: 8.5, type: 'battery_boost', value: 100, radius: 0.65, collected: false },
    { id: 'batt_3', x: 8, z: 10, type: 'battery_boost', value: 100, radius: 0.65, collected: false },
  ];

  const pickupMeshes = new Map<string, THREE.Group>();

  function createPickupMesh(pickup: DustPickup): THREE.Group {
    const pGroup = new THREE.Group();
    pGroup.position.set(pickup.x, 0.35, pickup.z);

    if (pickup.type === 'mega_crumb' || pickup.type === 'dropped_dust') {
      // Golden glowing crumb octahedron cluster
      const crumbGeo = new THREE.DodecahedronGeometry(pickup.type === 'dropped_dust' ? 0.22 : 0.32);
      const crumbMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.8,
      });
      const crumbMesh = new THREE.Mesh(crumbGeo, crumbMat);
      crumbMesh.castShadow = true;
      pGroup.add(crumbMesh);
    } else {
      // Glowing Turbo Battery Canister
      const cylGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.42, 16);
      const cylMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        emissiveIntensity: 0.8,
        roughness: 0.25,
        metalness: 0.7,
      });
      const battMesh = new THREE.Mesh(cylGeo, cylMat);
      battMesh.castShadow = true;
      pGroup.add(battMesh);

      // Lightning bolt or ring
      const ringGeo = new THREE.TorusGeometry(0.24, 0.02, 8, 16);
      ringGeo.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      pGroup.add(new THREE.Mesh(ringGeo, ringMat));
    }

    scene.add(pGroup);
    return pGroup;
  }

  pickups.forEach((p) => {
    pickupMeshes.set(p.id, createPickupMesh(p));
  });

  function removePickupMesh(id: string) {
    const m = pickupMeshes.get(id);
    if (m) {
      scene.remove(m);
      pickupMeshes.delete(id);
    }
  }

  function spawnDroppedDust(x: number, z: number, count: number) {
    for (let i = 0; i < count; i++) {
      const dropId = `drop_${Date.now()}_${Math.random()}`;
      const ang = Math.random() * Math.PI * 2;
      const dist = 0.8 + Math.random() * 1.6;
      const drop: DustPickup = {
        id: dropId,
        x: Math.max(-half + 1, Math.min(half - 1, x + Math.cos(ang) * dist)),
        z: Math.max(-half + 1, Math.min(half - 1, z + Math.sin(ang) * dist)),
        type: 'dropped_dust',
        value: 20,
        radius: 0.55,
        collected: false,
      };
      pickups.push(drop);
      pickupMeshes.set(dropId, createPickupMesh(drop));
    }
  }

  let pickupAnimTime = 0;
  function updatePickups(dt: number) {
    pickupAnimTime += dt;
    pickups.forEach((p) => {
      const mesh = pickupMeshes.get(p.id);
      if (mesh) {
        mesh.rotation.y += 2.2 * dt;
        mesh.position.y = 0.35 + Math.sin(pickupAnimTime * 3 + p.x) * 0.08;
      }
    });
  }

  return {
    scene,
    floorMesh,
    colliders,
    pickups,
    pickupMeshes,
    hazards,
    hazardMeshes,
    petGroup,
    updatePet,
    updatePickups,
    removePickupMesh,
    cleanHazard,
    spawnDroppedDust,
  };
}
