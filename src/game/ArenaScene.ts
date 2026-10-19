/**
 * ArenaScene
 * Sets up the high-detail 3D Designer Penthouse environment, studio lighting,
 * Joyride wall sponsorship billboard, rich furniture textures, corner dog bed,
 * and an interactive chasing dog that grabs Roombas and carries them to the corner!
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FurnitureCollider, DustPickup, HazardZone } from '../types/game';
import { FloorTextureManager } from './FloorTextureManager';
import { soundSynth } from '../audio/SoundSynth';

export interface DogUpdateResult {
  grabbedRobotId: string | null;
  droppedRobotId: string | null;
  mouthPos: { x: number; z: number };
  dogStatus: 'patrol' | 'chasing' | 'carrying' | 'cooldown';
}

export interface ArenaComponents {
  scene: THREE.Scene;
  floorMesh: THREE.Mesh;
  colliders: FurnitureCollider[];
  pickups: DustPickup[];
  pickupMeshes: Map<string, THREE.Group>;
  hazards: HazardZone[];
  hazardMeshes: Map<string, THREE.Mesh>;
  dogGroup: THREE.Group;
  updateDog: (dt: number, robotPositions: { id: string; x: number; z: number }[]) => DogUpdateResult;
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

  // Atmospheric distance fog
  scene.fog = new THREE.Fog(0xdce7f0, 32, 60);

  // 1. Studio Lighting Rig
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xc7d2fe, 0.85);
  hemiLight.position.set(0, 30, 0);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff6ea, 1.7);
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
  const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.5);
  fillLight.position.set(-15, 18, -12);
  scene.add(fillLight);

  // 2. Floor Plane (uses dynamic FloorTextureManager)
  const floorGeo = new THREE.PlaneGeometry(arenaSize, arenaSize);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorManager.texture,
    roughness: 0.32,
    metalness: 0.12,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // 3. Penthouse Walls & Perimeter Baseboards
  const wallHeight = 2.4;
  const half = arenaSize / 2;

  // Baseboards along perimeter
  const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.35 });
  const bbThickness = 0.12;
  const bbHeight = 0.18;

  function createBaseboard(x: number, z: number, w: number, depth: number) {
    const geo = new THREE.BoxGeometry(w, bbHeight, depth);
    const m = new THREE.Mesh(geo, baseboardMat);
    m.position.set(x, bbHeight / 2, z);
    scene.add(m);
  }
  createBaseboard(0, -half, arenaSize, bbThickness);
  createBaseboard(0, half, arenaSize, bbThickness);
  createBaseboard(-half, 0, bbThickness, arenaSize);
  createBaseboard(half, 0, bbThickness, arenaSize);

  // Floor-to-ceiling glass wall on North (z = -half)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xecfdf5,
    transmission: 0.92,
    opacity: 0.35,
    transparent: true,
    roughness: 0.05,
    metalness: 0.1,
    ior: 1.5,
  });
  const windowGeo = new THREE.PlaneGeometry(arenaSize, wallHeight + 1.8);
  const northWindow = new THREE.Mesh(windowGeo, glassMat);
  northWindow.position.set(0, (wallHeight + 1.8) / 2, -half);
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

  // Interior drywall with FrontSide so camera outside looking in never gets blocked
  const interiorWallMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.85,
    side: THREE.FrontSide,
  });
  const southWall = new THREE.Mesh(new THREE.BoxGeometry(arenaSize, wallHeight, 0.2), interiorWallMat);
  southWall.position.set(0, wallHeight / 2, half + 0.1);
  southWall.receiveShadow = true;
  scene.add(southWall);

  const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, wallHeight, arenaSize), interiorWallMat);
  westWall.position.set(-half - 0.1, wallHeight / 2, 0);
  westWall.receiveShadow = true;
  scene.add(westWall);

  const eastWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, wallHeight, arenaSize), interiorWallMat);
  eastWall.position.set(half + 0.1, wallHeight / 2, 0);
  eastWall.receiveShadow = true;
  scene.add(eastWall);

  // ==============================================================
  // OFFICIAL SPONSORSHIP WALL BILLBOARD: JOYRIDE (Micromobility OS)
  // Mounted centrally on the South Gallery Wall
  // ==============================================================
  const sponsorBillboardGroup = new THREE.Group();
  sponsorBillboardGroup.position.set(0, 1.4, half - 0.05);

  // Backing Frame (Anodized Satin Black Aluminum)
  const frameGeo = new THREE.BoxGeometry(6.6, 1.5, 0.12);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.35, metalness: 0.85 });
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  sponsorBillboardGroup.add(frameMesh);

  // Illuminated Face (Joyride Royal Blue Acrylic with soft emissive)
  const boardFaceGeo = new THREE.PlaneGeometry(6.3, 1.25);
  boardFaceGeo.rotateY(Math.PI); // face into the room
  const boardFaceMat = new THREE.MeshStandardMaterial({
    color: 0x0052ff,
    emissive: 0x003bcc,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.1,
  });
  const boardFace = new THREE.Mesh(boardFaceGeo, boardFaceMat);
  boardFace.position.z = -0.065;
  sponsorBillboardGroup.add(boardFace);

  // 3D Raised "JOYRIDE" Lettering
  const textMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.45,
    roughness: 0.1,
  });
  const cyanGlowMat = new THREE.MeshStandardMaterial({
    color: 0x00f2fe,
    emissive: 0x00f2fe,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });

  // Scooter silhouette on billboard
  const scGroup = new THREE.Group();
  scGroup.position.set(-1.9, 0, -0.08);
  const scWheelGeo = new THREE.TorusGeometry(0.12, 0.025, 8, 16);
  const scW1 = new THREE.Mesh(scWheelGeo, cyanGlowMat);
  scW1.position.set(-0.35, -0.2, 0);
  scGroup.add(scW1);
  const scW2 = new THREE.Mesh(scWheelGeo, cyanGlowMat);
  scW2.position.set(0.35, -0.2, 0);
  scGroup.add(scW2);

  // Deck & handlebar line
  const scDeck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.02), cyanGlowMat);
  scDeck.position.set(0, -0.18, 0);
  scGroup.add(scDeck);
  const scStem = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 0.02), cyanGlowMat);
  scStem.position.set(0.32, 0.1, 0);
  scStem.rotation.z = -0.12;
  scGroup.add(scStem);
  const scBar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.02), cyanGlowMat);
  scBar.position.set(0.26, 0.38, 0);
  scGroup.add(scBar);
  sponsorBillboardGroup.add(scGroup);

  // Bold JOYRIDE blocks
  const joyridePlateGeo = new THREE.BoxGeometry(2.8, 0.45, 0.02);
  const joyridePlate = new THREE.Mesh(joyridePlateGeo, textMat);
  joyridePlate.position.set(0.4, 0.12, -0.08);
  sponsorBillboardGroup.add(joyridePlate);

  // Subtitle banner bar
  const subBarGeo = new THREE.BoxGeometry(3.6, 0.18, 0.02);
  const subBar = new THREE.Mesh(subBarGeo, cyanGlowMat);
  subBar.position.set(0.4, -0.22, -0.08);
  sponsorBillboardGroup.add(subBar);

  scene.add(sponsorBillboardGroup);

  // Soft cyan/blue light wash in front of billboard
  const boardLight = new THREE.PointLight(0x00f2fe, 1.2, 8);
  boardLight.position.set(0, 1.8, half - 1.5);
  scene.add(boardLight);

  // ==============================================================
  // ADDITIONAL WALL SPONSORSHIP DISPLAYS: EAST & WEST GALLERY POSTERS
  // ==============================================================
  // Helper to create glowing acrylic poster displays
  function createWallSponsorPoster(
    x: number,
    y: number,
    z: number,
    rotY: number,
    title: string,
    subtitle: string,
    isCyan: boolean
  ) {
    const posterGroup = new THREE.Group();
    posterGroup.position.set(x, y, z);
    posterGroup.rotation.y = rotY;

    // Metal Frame
    const pFrameGeo = new THREE.BoxGeometry(2.8, 1.8, 0.06);
    const pFrameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 });
    const pFrame = new THREE.Mesh(pFrameGeo, pFrameMat);
    posterGroup.add(pFrame);

    // Glowing Poster Face
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Tech gradient
      const grad = ctx.createLinearGradient(0, 0, 512, 320);
      grad.addColorStop(0, isCyan ? '#002b66' : '#0a192f');
      grad.addColorStop(1, isCyan ? '#001433' : '#020c1b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 320);

      // Border glow
      ctx.strokeStyle = isCyan ? '#00f2fe' : '#38bdf8';
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 10, 492, 300);

      // Joyride brand
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, 256, 100);

      // Subtitle
      ctx.fillStyle = '#00f2fe';
      ctx.font = 'bold 15px "JetBrains Mono", monospace';
      ctx.fillText(subtitle, 256, 145);

      // Connected fleet graphic
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(120 + i * 90, 220, 22, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.fillText('• 250+ CITIES • SMART FLEET IOT • 99.9% UPTIME •', 256, 280);
    }

    const pTex = new THREE.CanvasTexture(canvas);
    pTex.colorSpace = THREE.SRGBColorSpace;
    const pFaceMat = new THREE.MeshStandardMaterial({
      map: pTex,
      emissive: new THREE.Color(isCyan ? 0x0044aa : 0x002255),
      emissiveIntensity: 0.5,
      roughness: 0.25,
      metalness: 0.1,
    });
    const pFace = new THREE.Mesh(new THREE.PlaneGeometry(2.65, 1.65), pFaceMat);
    pFace.position.z = 0.035;
    posterGroup.add(pFace);

    // Subtle edge light
    const pLight = new THREE.PointLight(isCyan ? 0x00f2fe : 0x38bdf8, 0.7, 5);
    pLight.position.set(0, 0, 0.4);
    posterGroup.add(pLight);

    scene.add(posterGroup);
  }

  // East Wall Joyride Fleet Display
  createWallSponsorPoster(
    half - 0.08,
    1.5,
    -1.5,
    -Math.PI / 2,
    'JOYRIDE FLEET OS',
    'MICROMOBILITY PLATFORM FOR BIKES & SCOOTERS',
    true
  );

  // West Wall Smart Cities Poster
  createWallSponsorPoster(
    -half + 0.08,
    1.5,
    -1.5,
    Math.PI / 2,
    'POWERED BY JOYRIDE',
    'CONNECTING FLEETS ACROSS GLOBAL CITIES',
    false
  );

  // Architectural Dark Walnut Ceiling Beams running east-west
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x1c120c, roughness: 0.6 });
  for (let bz = -half + 5; bz <= half - 3; bz += 6) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(arenaSize, 0.35, 0.22), beamMat);
    beam.position.set(0, wallHeight + 1.2, bz);
    scene.add(beam);

    // Warm recessed spotlight
    const spot = new THREE.SpotLight(0xfff1e0, 0.8, 12, Math.PI / 5, 0.4);
    spot.position.set(0, wallHeight + 1.0, bz);
    spot.target.position.set(0, 0, bz);
    scene.add(spot);
    scene.add(spot.target);
  }

  // ==============================================================
  // 4. FURNITURE COLLIDERS & DETAILED OBSTACLE TEXTURES
  // ==============================================================
  const colliders: FurnitureCollider[] = [];

  // A. Modern Sectional Couch (Lounge Area: Center-Left)
  const couchGroup = new THREE.Group();
  couchGroup.position.set(-6, 0, 5);
  // High-detail woven linen fabric material with deep weave tone
  const couchMat = new THREE.MeshStandardMaterial({
    color: 0x3b4758,
    roughness: 0.88,
    metalness: 0.05,
  });
  const cushionMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.82,
    metalness: 0.05,
  });

  // Wood plinth base
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(4.85, 0.08, 2.05), plinthMat);
  plinth.position.y = 0.04;
  couchGroup.add(plinth);

  // Main seating bench
  const seatGeo = new THREE.BoxGeometry(4.8, 0.38, 2.0);
  const seat = new THREE.Mesh(seatGeo, couchMat);
  seat.position.y = 0.27;
  seat.castShadow = true;
  seat.receiveShadow = true;
  couchGroup.add(seat);

  // 3 Distinct Seat Cushions with bevels
  for (let i = 0; i < 3; i++) {
    const cGeo = new THREE.BoxGeometry(1.5, 0.12, 1.8);
    const cushion = new THREE.Mesh(cGeo, cushionMat);
    cushion.position.set(-1.6 + i * 1.6, 0.48, 0);
    cushion.castShadow = true;
    couchGroup.add(cushion);
  }

  // Lumbar Throw Pillows (Joyride Cyan Accent Pillow & Golden Ochre Cushion)
  const pillowCyanMat = new THREE.MeshStandardMaterial({ color: 0x00f2fe, roughness: 0.65 });
  const pillowGoldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 });
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.2), pillowCyanMat);
  p1.position.set(-1.5, 0.62, 0.65);
  p1.rotation.set(-0.25, 0.35, 0.1);
  couchGroup.add(p1);
  const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.2), pillowGoldMat);
  p2.position.set(1.5, 0.62, 0.65);
  p2.rotation.set(-0.25, -0.35, -0.1);
  couchGroup.add(p2);

  // Backrest with angled pillows
  const backGeo = new THREE.BoxGeometry(4.8, 0.65, 0.35);
  const back = new THREE.Mesh(backGeo, couchMat);
  back.position.set(0, 0.72, 0.85);
  back.castShadow = true;
  couchGroup.add(back);

  // Armrests
  const armGeo = new THREE.BoxGeometry(0.4, 0.65, 2.0);
  const armL = new THREE.Mesh(armGeo, couchMat);
  armL.position.set(-2.2, 0.65, 0);
  armL.castShadow = true;
  couchGroup.add(armL);

  const armR = new THREE.Mesh(armGeo, couchMat);
  armR.position.set(2.2, 0.65, 0);
  armR.castShadow = true;
  couchGroup.add(armR);

  scene.add(couchGroup);
  colliders.push({ id: 'couch', x: -6, z: 5, width: 5.0, depth: 2.2, name: 'Linen Sectional Sofa' });

  // B. Coffee Table (Carrara Marble Top & Brushed Brass Tripod Legs)
  const tableGroup = new THREE.Group();
  tableGroup.position.set(-6, 0, 1.8);

  // High-detail procedural marble canvas
  const marbleCanvas = document.createElement('canvas');
  marbleCanvas.width = 512;
  marbleCanvas.height = 512;
  const mCtx = marbleCanvas.getContext('2d');
  if (mCtx) {
    mCtx.fillStyle = '#f8fafc';
    mCtx.fillRect(0, 0, 512, 512);
    // Soft grey and gold veins
    mCtx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    mCtx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      mCtx.beginPath();
      mCtx.moveTo(0, i * 80);
      mCtx.bezierCurveTo(150, i * 80 + 40, 350, i * 80 - 50, 512, i * 80 + 20);
      mCtx.stroke();
    }
    mCtx.strokeStyle = 'rgba(217, 119, 6, 0.2)';
    mCtx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      mCtx.beginPath();
      mCtx.moveTo(i * 120, 0);
      mCtx.bezierCurveTo(i * 120 + 30, 200, i * 120 - 40, 350, i * 120 + 50, 512);
      mCtx.stroke();
    }
  }
  const marbleTex = new THREE.CanvasTexture(marbleCanvas);
  marbleTex.colorSpace = THREE.SRGBColorSpace;

  const marbleTopMat = new THREE.MeshStandardMaterial({
    map: marbleTex,
    roughness: 0.14,
    metalness: 0.2,
  });
  const topMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.08, 32), marbleTopMat);
  topMesh.position.y = 0.44;
  topMesh.castShadow = true;
  tableGroup.add(topMesh);

  // Joyride Fleet Magazine / Book on coffee table
  const bookGeo = new THREE.BoxGeometry(0.45, 0.03, 0.32);
  const bookMat = new THREE.MeshStandardMaterial({ color: 0x0052ff, roughness: 0.3 });
  const book = new THREE.Mesh(bookGeo, bookMat);
  book.position.set(-0.25, 0.495, 0.15);
  book.rotation.y = 0.25;
  tableGroup.add(book);

  // Ceramic Coffee Cup
  const cupGeo = new THREE.CylinderGeometry(0.065, 0.05, 0.1, 16);
  const cupMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const cup = new THREE.Mesh(cupGeo, cupMat);
  cup.position.set(0.25, 0.53, -0.15);
  tableGroup.add(cup);

  // Brass tripod legs
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.92, roughness: 0.18 });
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.44, 12), brassMat);
    const ang = (i * Math.PI * 2) / 3;
    leg.position.set(Math.cos(ang) * 0.85, 0.22, Math.sin(ang) * 0.85);
    leg.castShadow = true;
    tableGroup.add(leg);
  }
  scene.add(tableGroup);
  colliders.push({ id: 'coffee_table', x: -6, z: 1.8, width: 2.5, depth: 2.5, name: 'Carrara Coffee Table' });

  // C. Modern Kitchen Island (Waterfall Marble & Fluted Walnut Base)
  const islandGroup = new THREE.Group();
  islandGroup.position.set(7.5, 0, -6.5);

  const quartzTopMat = new THREE.MeshStandardMaterial({
    map: marbleTex,
    roughness: 0.12,
    metalness: 0.2,
  });
  const islandTop = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.14, 2.5), quartzTopMat);
  islandTop.position.y = 1.08;
  islandTop.castShadow = true;
  islandTop.receiveShadow = true;
  islandGroup.add(islandTop);

  // Fluted Walnut base cabinet with physical 3D vertical slats
  const walnutMat = new THREE.MeshStandardMaterial({ color: 0x3d2010, roughness: 0.55 });
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(3.9, 1.01, 2.1), walnutMat);
  cabinet.position.y = 1.01 / 2;
  cabinet.castShadow = true;
  islandGroup.add(cabinet);

  // 3D vertical wood slats for authentic fluted architectural texture
  const slatMat = new THREE.MeshStandardMaterial({ color: 0x271408, roughness: 0.65 });
  for (let sx = -1.85; sx <= 1.85; sx += 0.15) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.98, 0.04), slatMat);
    slat.position.set(sx, 0.5, 1.07);
    islandGroup.add(slat);
  }

  // Stainless faucet on island
  const faucetMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 });
  const faucet = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 10, 16, Math.PI), faucetMat);
  faucet.position.set(0.6, 1.25, -0.4);
  faucet.rotation.x = Math.PI / 2;
  islandGroup.add(faucet);

  // Barstools
  const stoolMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.3 });
  for (const sx of [-1.2, 1.2]) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.65, 16), stoolMat);
    stool.position.set(sx, 0.325, 1.45);
    stool.castShadow = true;
    islandGroup.add(stool);
  }
  for (const sx of [-1.2, 1.2]) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.65, 16), stoolMat);
    stool.position.set(sx, 0.325, 1.45);
    stool.castShadow = true;
    islandGroup.add(stool);
  }

  scene.add(islandGroup);
  colliders.push({ id: 'kitchen_island', x: 7.5, z: -6.5, width: 4.5, depth: 2.7, name: 'Fluted Kitchen Island' });

  // D. Honey Oak Dining Table & Chairs
  const diningGroup = new THREE.Group();
  diningGroup.position.set(6.5, 0, 5.5);
  const oakMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.35 });
  const diningTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 1.8), oakMat);
  diningTop.position.y = 0.88;
  diningTop.castShadow = true;
  diningGroup.add(diningTop);

  const dLegMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.25 });
  [[-1.6, -0.75], [1.6, -0.75], [-1.6, 0.75], [1.6, 0.75]].forEach(([lx, lz]) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.88, 12), dLegMat);
    l.position.set(lx, 0.88 / 2, lz);
    l.castShadow = true;
    diningGroup.add(l);
  });
  scene.add(diningGroup);
  colliders.push({ id: 'dining_table', x: 6.5, z: 5.5, width: 3.8, depth: 2.0, name: 'Honey Oak Dining Table' });

  // E. Large Fluted Ceramic Planters with Monstera & Fig
  function createPlanter(px: number, pz: number, plantRadius: number) {
    const pGroup = new THREE.Group();
    pGroup.position.set(px, 0, pz);

    const potMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.1 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.85, 24), potMat);
    pot.position.y = 0.425;
    pot.castShadow = true;
    pGroup.add(pot);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 }));
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    pGroup.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.35 });
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

  // F. CORNER PENALTY DOG BED at (-12.5, -12.5)
  // This is where the dog carries caught Roombas!
  const dogBedGroup = new THREE.Group();
  dogBedGroup.position.set(-12.5, 0, -12.5);

  const bedMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 }); // cozy red tartan
  const bedCushionMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
  const bedBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.14, 24), bedMat);
  bedBase.position.y = 0.07;
  dogBedGroup.add(bedBase);

  const bedRim = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.18, 12, 24), bedMat);
  bedRim.rotateX(Math.PI / 2);
  bedRim.position.y = 0.22;
  dogBedGroup.add(bedRim);

  const bedCushion = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.1, 24), bedCushionMat);
  bedCushion.position.y = 0.12;
  dogBedGroup.add(bedCushion);

  scene.add(dogBedGroup);

  // Stainless steel water and food bowls with kibble
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.2 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.1 });
  const kibbleMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });

  const waterBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.14, 16), bowlMat);
  waterBowl.position.set(-10.8, 0.07, -12.5);
  waterBowl.castShadow = true;
  scene.add(waterBowl);
  const waterSurface = new THREE.Mesh(new THREE.CircleGeometry(0.21, 16), waterMat);
  waterSurface.rotateX(-Math.PI / 2);
  waterSurface.position.set(-10.8, 0.13, -12.5);
  scene.add(waterSurface);

  const foodBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.14, 16), bowlMat);
  foodBowl.position.set(-10.8, 0.07, -11.8);
  foodBowl.castShadow = true;
  scene.add(foodBowl);
  const kibble = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), kibbleMat);
  kibble.position.set(-10.8, 0.11, -11.8);
  scene.add(kibble);

  // Chew Bone toy
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4 });
  const boneGroup = new THREE.Group();
  boneGroup.position.set(-11.5, 0.04, -11.1);
  boneGroup.rotation.y = 0.6;
  const boneShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.32, 10), boneMat);
  boneShaft.rotateZ(Math.PI / 2);
  boneGroup.add(boneShaft);
  for (const bx of [-0.16, 0.16]) {
    for (const bz of [-0.04, 0.04]) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), boneMat);
      knob.position.set(bx, 0, bz);
      boneGroup.add(knob);
    }
  }
  scene.add(boneGroup);

  // ==============================================================
  // 5. ANIMATED CHASING GOLDEN RETRIEVER DOG
  // State Machine: Patrol -> Chase -> Grab -> Carry to Corner -> Drop
  // ==============================================================
  const dogGroup = new THREE.Group();
  dogGroup.position.set(0, 0, -2);
  scene.add(dogGroup);

  // Dog Materials
  const furMat = new THREE.MeshStandardMaterial({ color: 0xd99b26, roughness: 0.85 }); // golden wheat fur
  const chestMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.85 }); // cream chest
  const noseMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3 }); // shiny black nose
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.1 });
  const tongueMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 });
  const collarMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 }); // red leather
  const tagMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.2 }); // gold tag

  // Dog Torso
  const dogBody = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.85, 16), furMat);
  dogBody.rotation.x = Math.PI / 2;
  dogBody.position.y = 0.48;
  dogBody.castShadow = true;
  dogGroup.add(dogBody);

  // Cream chest patch
  const dogChest = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), chestMat);
  dogChest.scale.set(0.85, 0.7, 0.9);
  dogChest.position.set(0, 0.44, 0.32);
  dogGroup.add(dogChest);

  // Dog Head Group (pivoted for bobs and turns)
  const dogHeadGroup = new THREE.Group();
  dogHeadGroup.position.set(0, 0.68, 0.42);
  dogGroup.add(dogHeadGroup);

  const dogHead = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), furMat);
  dogHead.castShadow = true;
  dogHeadGroup.add(dogHead);

  // Snout
  const dogSnout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.24), furMat);
  dogSnout.position.set(0, -0.04, 0.2);
  dogHeadGroup.add(dogSnout);

  // Black Nose tip
  const dogNose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), noseMat);
  dogNose.position.set(0, 0.02, 0.32);
  dogHeadGroup.add(dogNose);

  // Tongue
  const dogTongue = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.12), tongueMat);
  dogTongue.position.set(0, -0.1, 0.22);
  dogTongue.rotation.x = 0.2;
  dogHeadGroup.add(dogTongue);

  // Eyes
  for (const eyeSide of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), eyeMat);
    eye.position.set(eyeSide, 0.08, 0.18);
    dogHeadGroup.add(eye);
  }

  // Floppy Golden Ears
  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.12), furMat);
  earL.position.set(-0.24, 0.02, 0);
  earL.rotation.z = 0.25;
  dogHeadGroup.add(earL);

  const earR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.12), furMat);
  earR.position.set(0.24, 0.02, 0);
  earR.rotation.z = -0.25;
  dogHeadGroup.add(earR);

  // Red Collar & Golden Tag
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 20), collarMat);
  collar.position.set(0, -0.1, 0.02);
  collar.rotateX(Math.PI / 2);
  dogHeadGroup.add(collar);

  const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 12), tagMat);
  tag.position.set(0, -0.18, 0.2);
  tag.rotateX(Math.PI / 2);
  dogHeadGroup.add(tag);

  // 4 Animated Trotting Legs
  function createDogLeg(): { group: THREE.Group; paw: THREE.Mesh } {
    const legG = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.32, 10), furMat);
    upper.position.y = -0.16;
    upper.castShadow = true;
    legG.add(upper);

    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), furMat);
    paw.scale.set(1.0, 0.65, 1.3);
    paw.position.set(0, -0.32, 0.04);
    legG.add(paw);

    return { group: legG, paw };
  }

  const legFL = createDogLeg();
  legFL.group.position.set(-0.18, 0.36, 0.32);
  dogGroup.add(legFL.group);

  const legFR = createDogLeg();
  legFR.group.position.set(0.18, 0.36, 0.32);
  dogGroup.add(legFR.group);

  const legRL = createDogLeg();
  legRL.group.position.set(-0.18, 0.36, -0.32);
  dogGroup.add(legRL.group);

  const legRR = createDogLeg();
  legRR.group.position.set(0.18, 0.36, -0.32);
  dogGroup.add(legRR.group);

  // Wagging Golden Tail
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.52, -0.42);
  dogGroup.add(tailGroup);

  const tailGeo = new THREE.CylinderGeometry(0.05, 0.03, 0.48, 8);
  const tailMesh = new THREE.Mesh(tailGeo, furMat);
  tailMesh.position.set(0, 0.18, -0.15);
  tailMesh.rotation.x = -0.7;
  tailGroup.add(tailMesh);

  // ==============================================================
  // DOG BEHAVIOR STATE & SIMULATION LOOP
  // ==============================================================
  let dogX = 0;
  let dogZ = -2;
  let dogHeading = 0;
  let dogStatus: 'patrol' | 'chasing' | 'carrying' | 'cooldown' = 'patrol';
  let grabbedRobotId: string | null = null;
  let cooldownTimer = 0;
  let walkPhase = 0;
  let barkCooldown = 0;

  const cornerTarget = { x: -12.5, z: -12.5 };

  function updateDog(
    dt: number,
    robotPositions: { id: string; x: number; z: number }[]
  ): DogUpdateResult {
    let droppedRobotId: string | null = null;

    if (barkCooldown > 0) barkCooldown -= dt;
    if (cooldownTimer > 0) {
      cooldownTimer -= dt;
      if (cooldownTimer <= 0) dogStatus = 'patrol';
    }

    let targetX = dogX;
    let targetZ = dogZ;
    let targetSpeed = 2.4;

    if (dogStatus === 'carrying') {
      // Running with Roomba straight to corner bed!
      targetX = cornerTarget.x;
      targetZ = cornerTarget.z;
      targetSpeed = 5.2;

      const distToCorner = Math.hypot(cornerTarget.x - dogX, cornerTarget.z - dogZ);
      if (distToCorner < 1.3) {
        // Drop the Roomba at the corner!
        droppedRobotId = grabbedRobotId;
        grabbedRobotId = null;
        dogStatus = 'cooldown';
        cooldownTimer = 7.0; // 7 seconds cooldown before chasing again
        soundSynth.playDogDrop();
        soundSynth.playDogBark();
      }
    } else if (dogStatus === 'chasing' && grabbedRobotId === null) {
      // Find closest robot to chase
      let closestRobot: { id: string; x: number; z: number } | null = null;
      let minDist = 999;

      robotPositions.forEach((r) => {
        const d = Math.hypot(r.x - dogX, r.z - dogZ);
        if (d < minDist) {
          minDist = d;
          closestRobot = r;
        }
      });

      if (closestRobot && minDist < 12.0) {
        targetX = (closestRobot as { id: string; x: number; z: number }).x;
        targetZ = (closestRobot as { id: string; x: number; z: number }).z;
        targetSpeed = 7.2; // Fast exciting sprint!

        // Catch check
        if (minDist < 1.15) {
          // Grab Roomba!
          grabbedRobotId = (closestRobot as { id: string; x: number; z: number }).id;
          dogStatus = 'carrying';
          soundSynth.playDogBark();
        }
      } else {
        dogStatus = 'patrol';
      }
    } else if (dogStatus === 'cooldown') {
      // Trot back to center room peacefully
      targetX = 0;
      targetZ = -1;
      targetSpeed = 3.0;
    } else {
      // PATROL MODE: check if any Roomba is within detection trigger radius (4.6m)
      let detectedRobot: { id: string; x: number; z: number } | null = null;
      for (const r of robotPositions) {
        const d = Math.hypot(r.x - dogX, r.z - dogZ);
        if (d < 4.6) {
          detectedRobot = r;
          break;
        }
      }

      if (detectedRobot) {
        dogStatus = 'chasing';
        if (barkCooldown <= 0) {
          soundSynth.playDogBark();
          barkCooldown = 2.5;
        }
        targetX = detectedRobot.x;
        targetZ = detectedRobot.z;
        targetSpeed = 7.0;
      } else {
        // Idle gentle patrol around center living room
        walkPhase += dt * 1.5;
        targetX = Math.sin(walkPhase * 0.3) * 4.5;
        targetZ = Math.cos(walkPhase * 0.25) * 3.5 - 1.0;
        targetSpeed = 2.2;
      }
    }

    // Direction & Movement
    const toTargetX = targetX - dogX;
    const toTargetZ = targetZ - dogZ;
    const distToTarget = Math.hypot(toTargetX, toTargetZ);

    if (distToTarget > 0.1) {
      const desiredHeading = Math.atan2(toTargetX, toTargetZ);
      let headingDiff = desiredHeading - dogHeading;
      while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
      while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;

      dogHeading += headingDiff * Math.min(1.0, 6.0 * dt);

      const moveStep = Math.min(distToTarget, targetSpeed * dt);
      dogX += Math.sin(dogHeading) * moveStep;
      dogZ += Math.cos(dogHeading) * moveStep;

      // Leg trot animation
      walkPhase += targetSpeed * 2.8 * dt;
      const swing = Math.min(0.65, targetSpeed * 0.1);
      legFL.group.rotation.x = Math.sin(walkPhase) * swing;
      legFR.group.rotation.x = -Math.sin(walkPhase) * swing;
      legRL.group.rotation.x = -Math.sin(walkPhase) * swing;
      legRR.group.rotation.x = Math.sin(walkPhase) * swing;

      // Tail wag speed increases when chasing or carrying
      const tailWagSpeed = dogStatus === 'chasing' || dogStatus === 'carrying' ? 18 : 7;
      tailGroup.rotation.y = Math.sin(walkPhase * tailWagSpeed * 0.2) * 0.55;

      // Head bob & ear swing
      dogHeadGroup.position.y = 0.68 + Math.sin(walkPhase * 2) * 0.04;
      earL.rotation.x = Math.sin(walkPhase * 2) * 0.2;
      earR.rotation.x = Math.sin(walkPhase * 2) * 0.2;
    }

    // Sync dog 3D group position
    dogGroup.position.set(dogX, 0, dogZ);
    dogGroup.rotation.y = dogHeading;

    // Calculate mouth position in front of dog's snout
    const mouthPos = {
      x: dogX + Math.sin(dogHeading) * 0.95,
      z: dogZ + Math.cos(dogHeading) * 0.95,
    };

    return {
      grabbedRobotId,
      droppedRobotId,
      mouthPos,
      dogStatus,
    };
  }

  // ==============================================================
  // 6. HAZARDS & COLLECTIBLE CRUMBS
  // ==============================================================
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

  // Pickups
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

      const ringGeo = new THREE.TorusGeometry(0.24, 0.02, 8, 16);
      ringGeo.rotateX(Math.PI / 2);
      pGroup.add(new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 })));
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
    dogGroup,
    updateDog,
    updatePickups,
    removePickupMesh,
    cleanHazard,
    spawnDroppedDust,
  };
}
