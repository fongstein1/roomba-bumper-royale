/**
 * ProceduralRoomba
 * Builds high-fidelity 3-12 part procedural Three.js Roomba models
 * with customizable finishes, decals, spinning brushes, lidar turrets,
 * spring-loaded bumpers, and novelty 3D toppers. Zero external assets (zero 404s).
 */
import * as THREE from 'three';
import { disposeObject } from './disposeObject';
import { RobotSkinConfig, TopperType, FinishType } from '../types/game';

export interface RoombaMeshParts {
  group: THREE.Group;
  chassis: THREE.Mesh;
  bumper: THREE.Group;
  bumperMesh: THREE.Mesh;
  brushLeft: THREE.Group;
  brushRight: THREE.Group;
  roller: THREE.Mesh;
  lidarRing: THREE.Mesh;
  ledHalo: THREE.Mesh;
  underglow: THREE.Mesh;
  topperGroup: THREE.Group;
  updateAnimation: (dt: number, speed: number, isBoosting: boolean) => void;
  triggerBumperCompression: () => void;
  updateSkin: (skin: RobotSkinConfig) => void;
}

export function createProceduralRoomba(skin: RobotSkinConfig, radius: number = 0.7): RoombaMeshParts {
  const group = new THREE.Group();
  group.name = 'RoombaRoot';

  // Overall height of Roomba
  const height = 0.22;
  const chassisRadius = radius * 0.92;

  // Material helpers based on chosen finish
  function getBodyMaterial(color: string, finish: FinishType): THREE.MeshStandardMaterial {
    let roughness = 0.45;
    let metalness = 0.15;
    if (finish === 'glossy') {
      roughness = 0.18;
      metalness = 0.25;
    } else if (finish === 'metallic') {
      roughness = 0.22;
      metalness = 0.88;
    } else if (finish === 'carbon') {
      roughness = 0.55;
      metalness = 0.40;
    }
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness,
      metalness,
    });
  }

  // 1. Main Cylindrical Chassis
  const chassisMat = getBodyMaterial(skin.primaryColor, skin.finish);
  const chassisGeo = new THREE.CylinderGeometry(chassisRadius, chassisRadius * 0.97, height, 48);
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.position.y = height / 2 + 0.05; // 5cm off ground for wheels
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // 2. Chassis Top Chamfer Ring (Secondary read)
  const chamferMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(skin.accentColor),
    roughness: 0.35,
    metalness: 0.3,
  });
  const chamferGeo = new THREE.TorusGeometry(chassisRadius * 0.88, 0.018, 16, 48);
  chamferGeo.rotateX(Math.PI / 2);
  const chamfer = new THREE.Mesh(chamferGeo, chamferMat);
  chamfer.position.y = height / 2 + 0.002;
  chassis.add(chamfer);

  // Helper to generate high-resolution procedural livery decals on the Roomba's top plate
  function createDecalCanvas(currentSkin: RobotSkinConfig): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const w = 512;
    const h = 512;
    const cx = w / 2;
    const cy = h / 2;

    // Base background matching primary color
    ctx.fillStyle = currentSkin.primaryColor;
    ctx.beginPath();
    ctx.arc(cx, cy, 250, 0, Math.PI * 2);
    ctx.fill();

    // Outer accent rim
    ctx.strokeStyle = currentSkin.accentColor;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, 240, 0, Math.PI * 2);
    ctx.stroke();

    // Decal graphics depending on type or Joyride sponsor
    const isJoyride = currentSkin.decal === 'joyride_fleet' || currentSkin.sponsor === 'joyride';

    if (isJoyride) {
      // OFFICIAL JOYRIDE FLEET GRAPHICS (joyride.city - Shared Scooter & Bike Fleet SaaS)
      // Tech grid background in subtle cyan/mint
      ctx.strokeStyle = 'rgba(0, 245, 160, 0.18)';
      ctx.lineWidth = 2;
      for (let x = 60; x <= w - 60; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 60);
        ctx.lineTo(x, h - 60);
        ctx.stroke();
      }
      for (let y = 60; y <= h - 60; y += 40) {
        ctx.beginPath();
        ctx.moveTo(60, y);
        ctx.lineTo(w - 60, y);
        ctx.stroke();
      }

      // Neon telemetry track arc
      ctx.strokeStyle = '#00f5a0';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, 192, -Math.PI * 0.75, Math.PI * 0.75);
      ctx.stroke();

      // Fleet Connected Waves (top arc)
      ctx.strokeStyle = '#00f5a0';
      ctx.lineWidth = 3;
      for (let r = 205; r <= 225; r += 10) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI * 0.35, Math.PI * 0.35);
        ctx.stroke();
      }

      // Central Joyride Emblem Shield
      ctx.fillStyle = '#003831'; // Joyride Signature Dark Forest Teal
      ctx.beginPath();
      ctx.arc(cx, cy + 10, 128, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00f5a0';
      ctx.lineWidth = 4.5;
      ctx.stroke();

      // Official Joyride Logo from image.png:
      // Teardrop / Map-marker pin with gear/sprocket cutout in center + "Joyride" Wordmark
      ctx.save();
      ctx.translate(cx, cy - 8);

      // Pin positioned above the wordmark (above the 'r' and 'i')
      const pinX = 36;
      const pinY = -34;
      const pinR = 28;

      ctx.save();
      ctx.translate(pinX, pinY);
      ctx.rotate(-Math.PI * 0.12);

      // Outer Teardrop Pin in Joyride White / Mint
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -6, pinR, -Math.PI * 0.28, Math.PI * 0.95, false);
      ctx.lineTo(-pinR * 0.95, pinR * 0.92);
      ctx.closePath();
      ctx.fill();

      // Gear / Sprocket cutout in center of pin
      ctx.fillStyle = '#003831';
      ctx.beginPath();
      const teeth = 12;
      const outerSpur = 14;
      const innerSpur = 10;
      for (let t = 0; t < teeth * 2; t++) {
        const angle = (t * Math.PI) / teeth;
        const rad = t % 2 === 0 ? outerSpur : innerSpur;
        const gx = Math.cos(angle) * rad;
        const gy = -6 + Math.sin(angle) * rad;
        if (t === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Bold "Joyride" brand wordmark
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 58px "Plus Jakarta Sans", "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.letterSpacing = '-1px';
      ctx.fillText('Joyride', 0, 18);

      // Micromobility tagline
      ctx.fillStyle = '#00f5a0';
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.letterSpacing = '1.5px';
      ctx.fillText('SHARED MOBILITY OS', 0, 62);
      ctx.restore();

      // Top badge
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SCOOTER & BIKE FLEET PLATFORM', cx, cy - 85);
    } else if (currentSkin.decal === 'racing_stripes') {
      // Dual high-speed racing stripes
      ctx.fillStyle = currentSkin.accentColor;
      ctx.fillRect(cx - 40, 20, 32, h - 40);
      ctx.fillRect(cx + 8, 20, 32, h - 40);

      // Pinstripes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 46, 20, 4, h - 40);
      ctx.fillRect(cx + 42, 20, 4, h - 40);

      // Racing roundel #01
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy + 40, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111827';
      ctx.font = '900 54px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('01', cx, cy + 42);
    } else if (currentSkin.decal === 'cyber_circuit') {
      // High-tech circuit traces
      ctx.strokeStyle = currentSkin.accentColor;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Concentric angular tracks
      ctx.beginPath();
      ctx.arc(cx, cy, 180, 0, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 140, Math.PI * 0.5, Math.PI * 2);
      ctx.stroke();

      // Nodes & IC CPU
      ctx.fillStyle = currentSkin.accentColor;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 160, cy + Math.sin(a) * 160, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillRect(cx - 36, cy + 10, 72, 72);
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CORE', cx, cy + 50);
    } else if (currentSkin.decal === 'clean_wave') {
      // Clean wave ripples
      ctx.strokeStyle = currentSkin.accentColor;
      ctx.lineWidth = 6;
      for (let r = 70; r <= 220; r += 32) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (currentSkin.decal === 'polka_dots') {
      // Retro pop dots
      ctx.fillStyle = currentSkin.accentColor;
      for (let x = 80; x < w - 60; x += 55) {
        for (let y = 80; y < h - 60; y += 55) {
          const dist = Math.hypot(x - cx, y - cy);
          if (dist < 210) {
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    return canvas;
  }

  // Decal mesh on top of the Roomba chassis
  const decalCanvas = createDecalCanvas(skin);
  const decalTexture = new THREE.CanvasTexture(decalCanvas);
  decalTexture.colorSpace = THREE.SRGBColorSpace;
  const decalGeo = new THREE.CircleGeometry(chassisRadius * 0.86, 48);
  decalGeo.rotateX(-Math.PI / 2);
  const decalMat = new THREE.MeshStandardMaterial({
    map: decalTexture,
    roughness: skin.finish === 'glossy' ? 0.2 : 0.5,
    metalness: skin.finish === 'metallic' ? 0.6 : 0.1,
  });
  const decalMesh = new THREE.Mesh(decalGeo, decalMat);
  decalMesh.position.y = height / 2 + 0.004;
  chassis.add(decalMesh);

  // 3. Central Power & Clean Button Disc
  const buttonMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.25,
    metalness: 0.6,
  });
  const buttonGeo = new THREE.CylinderGeometry(chassisRadius * 0.28, chassisRadius * 0.28, 0.015, 32);
  const button = new THREE.Mesh(buttonGeo, buttonMat);
  button.position.y = height / 2 + 0.008;
  chassis.add(button);

  // 4. LED Halo Status Ring (Emissive, glows with player color / boost)
  const ledMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(skin.primaryColor),
    emissive: new THREE.Color(skin.primaryColor),
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });
  const ledGeo = new THREE.TorusGeometry(chassisRadius * 0.29, 0.012, 16, 32);
  ledGeo.rotateX(Math.PI / 2);
  const ledHalo = new THREE.Mesh(ledGeo, ledMat);
  ledHalo.position.y = height / 2 + 0.012;
  chassis.add(ledHalo);

  // 5. LiDAR Turret (Top Sensor Dome with rotating laser emitter slit)
  const lidarTurret = new THREE.Group();
  lidarTurret.position.set(0, height / 2 + 0.02, -chassisRadius * 0.22);
  chassis.add(lidarTurret);

  const lidarBaseGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.045, 24);
  const lidarBaseMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4, metalness: 0.7 });
  const lidarBase = new THREE.Mesh(lidarBaseGeo, lidarBaseMat);
  lidarTurret.add(lidarBase);

  const lidarRingGeo = new THREE.TorusGeometry(0.07, 0.01, 12, 24);
  lidarRingGeo.rotateX(Math.PI / 2);
  const lidarRingMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00e5ff,
    emissiveIntensity: 0.9,
  });
  const lidarRing = new THREE.Mesh(lidarRingGeo, lidarRingMat);
  lidarRing.position.y = 0.015;
  lidarTurret.add(lidarRing);

  // 6. Spring-loaded Front Bumper Group
  const bumper = new THREE.Group();
  bumper.position.set(0, height / 2 + 0.05, 0);
  group.add(bumper);

  // Semicircular front bumper arc
  const bumperGeo = new THREE.CylinderGeometry(
    radius * 1.01,
    radius * 1.01,
    height * 0.88,
    32,
    1,
    false,
    -Math.PI * 0.52,
    Math.PI * 1.04
  );
  const bumperMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.7,
    metalness: 0.1,
  });
  const bumperMesh = new THREE.Mesh(bumperGeo, bumperMat);
  bumperMesh.rotation.y = Math.PI / 2;
  bumperMesh.castShadow = true;
  bumper.add(bumperMesh);

  // Rubber impact edge strip along bumper
  const rubberStripGeo = new THREE.TorusGeometry(radius * 1.02, 0.014, 12, 32, Math.PI * 1.02);
  rubberStripGeo.rotateX(Math.PI / 2);
  rubberStripGeo.rotateZ(Math.PI * 0.49);
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9, metalness: 0.05 });
  const rubberStrip = new THREE.Mesh(rubberStripGeo, rubberMat);
  rubberStrip.position.y = -height * 0.15;
  bumper.add(rubberStrip);

  // 7. Dual Spinning Front Edge Sweeper Brushes
  function createSweeperBrush(): THREE.Group {
    const brushGroup = new THREE.Group();
    // Center pin
    const pinGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8);
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.8, roughness: 0.3 });
    brushGroup.add(new THREE.Mesh(pinGeo, pinMat));

    // 3 arms of bristles
    const bristleGeo = new THREE.BoxGeometry(0.18, 0.006, 0.015);
    const bristleMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 }); // vibrant yellow bristles
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Mesh(bristleGeo, bristleMat);
      arm.rotation.y = (i * Math.PI * 2) / 3;
      arm.position.x = Math.cos((i * Math.PI * 2) / 3) * 0.08;
      arm.position.z = Math.sin((i * Math.PI * 2) / 3) * 0.08;
      brushGroup.add(arm);
    }
    return brushGroup;
  }

  const brushLeft = createSweeperBrush();
  brushLeft.position.set(-radius * 0.72, 0.03, radius * 0.65);
  group.add(brushLeft);

  const brushRight = createSweeperBrush();
  brushRight.position.set(radius * 0.72, 0.03, radius * 0.65);
  group.add(brushRight);

  // 8. Bottom Center Roller Brush
  const rollerGeo = new THREE.CylinderGeometry(0.04, 0.04, radius * 0.85, 16);
  rollerGeo.rotateZ(Math.PI / 2);
  const rollerMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 }); // green rubber spiral
  const roller = new THREE.Mesh(rollerGeo, rollerMat);
  roller.position.set(0, 0.04, 0);
  group.add(roller);

  // 9. Dual Rubber Tread Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.04, 24);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.85, metalness: 0.1 });
  const wheelLeft = new THREE.Mesh(wheelGeo, wheelMat);
  wheelLeft.position.set(-chassisRadius * 0.82, 0.075, -0.05);
  group.add(wheelLeft);

  const wheelRight = new THREE.Mesh(wheelGeo, wheelMat);
  wheelRight.position.set(chassisRadius * 0.82, 0.075, -0.05);
  group.add(wheelRight);

  // 10. Underglow Ground Projector
  const underglowGeo = new THREE.CircleGeometry(radius * 0.95, 24);
  underglowGeo.rotateX(-Math.PI / 2);
  const underglowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(skin.underglowColor),
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const underglow = new THREE.Mesh(underglowGeo, underglowMat);
  underglow.position.y = 0.015;
  group.add(underglow);

  // 11. Modular 3D Topper Accessory Group
  const topperGroup = new THREE.Group();
  topperGroup.position.set(0, height + 0.055, 0);
  group.add(topperGroup);

  function buildTopper(type: TopperType) {
    disposeObject(topperGroup);
    while (topperGroup.children.length > 0) {
      topperGroup.remove(topperGroup.children[0]);
    }
    if (type === 'none') return;

    if (type === 'cat_ears') {
      // Pair of angled triangular cat ears
      const earGeo = new THREE.ConeGeometry(0.08, 0.15, 4);
      earGeo.rotateY(Math.PI / 4);
      const outerMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(skin.primaryColor), roughness: 0.4 });
      const innerMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.6 }); // soft pink inner ear

      const earL = new THREE.Mesh(earGeo, outerMat);
      earL.position.set(-0.16, 0.06, 0.05);
      earL.rotation.set(-0.1, 0, 0.25);
      topperGroup.add(earL);

      const earR = new THREE.Mesh(earGeo, outerMat);
      earR.position.set(0.16, 0.06, 0.05);
      earR.rotation.set(-0.1, 0, -0.25);
      topperGroup.add(earR);

      // Inner pink inserts
      const innerGeo = new THREE.ConeGeometry(0.045, 0.1, 4);
      innerGeo.rotateY(Math.PI / 4);
      const inL = new THREE.Mesh(innerGeo, innerMat);
      inL.position.set(-0.16, 0.06, 0.07);
      inL.rotation.copy(earL.rotation);
      topperGroup.add(inL);

      const inR = new THREE.Mesh(innerGeo, innerMat);
      inR.position.set(0.16, 0.06, 0.07);
      inR.rotation.copy(earR.rotation);
      topperGroup.add(inR);
    } else if (type === 'crown') {
      // Golden royal crown with points
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.95, roughness: 0.15 });
      const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.05, 16), crownMat);
      topperGroup.add(crownBase);

      for (let i = 0; i < 5; i++) {
        const pointGeo = new THREE.ConeGeometry(0.025, 0.08, 4);
        const point = new THREE.Mesh(pointGeo, crownMat);
        const ang = (i * Math.PI * 2) / 5;
        point.position.set(Math.cos(ang) * 0.11, 0.05, Math.sin(ang) * 0.11);
        topperGroup.add(point);
      }
      // Center ruby gem
      const rubyGeo = new THREE.OctahedronGeometry(0.028);
      const rubyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.1, metalness: 0.8 });
      const ruby = new THREE.Mesh(rubyGeo, rubyMat);
      ruby.position.set(0, 0.03, 0.12);
      topperGroup.add(ruby);
    } else if (type === 'spoiler') {
      // Aerodynamic racing spoiler
      const carbonMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.6, roughness: 0.3 });
      // Dual struts
      const strutGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.14, 8);
      const strutL = new THREE.Mesh(strutGeo, carbonMat);
      strutL.position.set(-0.22, 0.05, -0.22);
      strutL.rotation.x = 0.2;
      topperGroup.add(strutL);

      const strutR = new THREE.Mesh(strutGeo, carbonMat);
      strutR.position.set(0.22, 0.05, -0.22);
      strutR.rotation.x = 0.2;
      topperGroup.add(strutR);

      // Wing blade
      const wingGeo = new THREE.BoxGeometry(0.62, 0.02, 0.14);
      const wingMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(skin.accentColor), roughness: 0.25 });
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(0, 0.12, -0.24);
      wing.rotation.x = -0.15;
      topperGroup.add(wing);
    } else if (type === 'party_hat') {
      // Colorful party cone with pom pom
      const hatGeo = new THREE.ConeGeometry(0.12, 0.26, 16);
      const hatMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.3 });
      const hat = new THREE.Mesh(hatGeo, hatMat);
      hat.position.y = 0.12;
      topperGroup.add(hat);

      const pomGeo = new THREE.SphereGeometry(0.035, 12, 12);
      const pomMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.7 });
      const pom = new THREE.Mesh(pomGeo, pomMat);
      pom.position.y = 0.26;
      topperGroup.add(pom);
    } else if (type === 'rubber_duck') {
      // Cute yellow rubber duck
      const duckMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25 });
      const bodyGeo = new THREE.SphereGeometry(0.09, 16, 16);
      bodyGeo.scale(1.1, 0.85, 1.25);
      const body = new THREE.Mesh(bodyGeo, duckMat);
      topperGroup.add(body);

      const headGeo = new THREE.SphereGeometry(0.06, 16, 16);
      const head = new THREE.Mesh(headGeo, duckMat);
      head.position.set(0, 0.08, 0.07);
      topperGroup.add(head);

      const billGeo = new THREE.ConeGeometry(0.035, 0.06, 8);
      billGeo.rotateX(Math.PI / 2);
      const billMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3 });
      const bill = new THREE.Mesh(billGeo, billMat);
      bill.position.set(0, 0.07, 0.13);
      topperGroup.add(bill);
    } else if (type === 'viking_horns') {
      // Viking warrior horns
      const hornCapMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hornCapMat);
      topperGroup.add(cap);

      const ivoryMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 });
      for (const side of [-1, 1]) {
        const hornGeo = new THREE.ConeGeometry(0.032, 0.16, 12);
        const horn = new THREE.Mesh(hornGeo, ivoryMat);
        horn.position.set(side * 0.11, 0.08, 0);
        horn.rotation.z = side * -0.65;
        topperGroup.add(horn);
      }
    } else if (type === 'joyride_scooter') {
      // Official Joyride Mini Fleet Electric Scooter Topper!
      const deckMat = new THREE.MeshStandardMaterial({ color: 0x0052ff, roughness: 0.2, metalness: 0.4 }); // Joyride royal blue
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x00f2fe, roughness: 0.25, metalness: 0.7 }); // Joyride neon cyan
      const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

      // Scooter Deck
      const deckGeo = new THREE.BoxGeometry(0.11, 0.02, 0.38);
      const deck = new THREE.Mesh(deckGeo, deckMat);
      deck.position.set(0, 0.04, 0);
      topperGroup.add(deck);

      // Grip tape stripe
      const gripGeo = new THREE.PlaneGeometry(0.07, 0.32);
      gripGeo.rotateX(-Math.PI / 2);
      const grip = new THREE.Mesh(gripGeo, new THREE.MeshBasicMaterial({ color: 0x00f2fe }));
      grip.position.set(0, 0.052, 0);
      topperGroup.add(grip);

      // Wheels
      const wGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16);
      wGeo.rotateZ(Math.PI / 2);
      const wheelFront = new THREE.Mesh(wGeo, tireMat);
      wheelFront.position.set(0, 0.035, 0.17);
      topperGroup.add(wheelFront);

      const wheelRear = new THREE.Mesh(wGeo, tireMat);
      wheelRear.position.set(0, 0.035, -0.17);
      topperGroup.add(wheelRear);

      // Steering Stem Column
      const stemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.28, 12);
      const stem = new THREE.Mesh(stemGeo, metalMat);
      stem.position.set(0, 0.17, 0.15);
      stem.rotation.x = -0.15;
      topperGroup.add(stem);

      // Handlebars T-bar
      const barGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.22, 12);
      barGeo.rotateZ(Math.PI / 2);
      const bar = new THREE.Mesh(barGeo, metalMat);
      bar.position.set(0, 0.30, 0.13);
      topperGroup.add(bar);

      // Rubber hand grips
      for (const gx of [-0.09, 0.09]) {
        const gripCap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.04, 8), tireMat);
        gripCap.rotation.z = Math.PI / 2;
        gripCap.position.set(gx, 0.30, 0.13);
        topperGroup.add(gripCap);
      }

      // Front Headlight LED
      const headLight = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), lightMat);
      headLight.position.set(0, 0.28, 0.155);
      topperGroup.add(headLight);
    }
  }

  buildTopper(skin.topper);

  // Dynamic spring compression state for bumper
  let bumperCompression = 0;

  function triggerBumperCompression() {
    bumperCompression = 0.08; // compress 8cm
  }

  function updateAnimation(dt: number, speed: number, isBoosting: boolean) {
    // 1. Spin side brushes
    const spinRate = Math.max(8, speed * 14 + 10);
    brushLeft.rotation.y += spinRate * dt;
    brushRight.rotation.y -= spinRate * dt;

    // 2. Spin roller brush
    roller.rotation.x += speed * 12 * dt;

    // 3. Wheel rotation
    wheelLeft.rotation.x += speed * 10 * dt;
    wheelRight.rotation.x += speed * 10 * dt;

    // 4. LiDAR scan turret rotation
    lidarRing.rotation.z += 6.0 * dt;

    // 5. Spring bumper restitution
    if (bumperCompression > 0) {
      bumperCompression = Math.max(0, bumperCompression - dt * 0.45);
      bumper.position.z = -bumperCompression;
    } else {
      bumper.position.z = 0;
    }

    // 6. LED halo & underglow boost flare
    if (isBoosting) {
      ledHalo.scale.set(1.08, 1.08, 1.08);
      (ledMat as THREE.MeshStandardMaterial).emissiveIntensity = 1.8;
      (underglowMat as THREE.MeshBasicMaterial).opacity = 0.85;
    } else {
      ledHalo.scale.set(1, 1, 1);
      (ledMat as THREE.MeshStandardMaterial).emissiveIntensity = 0.85;
      (underglowMat as THREE.MeshBasicMaterial).opacity = 0.45;
    }
  }

  function updateSkin(newSkin: RobotSkinConfig) {
    (chassis.material as THREE.Material).dispose();
    chassis.material = getBodyMaterial(newSkin.primaryColor, newSkin.finish);
    chamferMat.color.set(newSkin.accentColor);
    ledMat.color.set(newSkin.primaryColor);
    ledMat.emissive.set(newSkin.primaryColor);
    underglowMat.color.set(newSkin.underglowColor);
    buildTopper(newSkin.topper);

    // Update decal canvas texture
    const newCanvas = createDecalCanvas(newSkin);
    const newTex = new THREE.CanvasTexture(newCanvas);
    decalMat.map?.dispose();
    newTex.colorSpace = THREE.SRGBColorSpace;
    decalMat.map = newTex;
    decalMat.roughness = newSkin.finish === 'glossy' ? 0.2 : 0.5;
    decalMat.metalness = newSkin.finish === 'metallic' ? 0.6 : 0.1;
    decalMat.needsUpdate = true;
  }

  return {
    group,
    chassis,
    bumper,
    bumperMesh,
    brushLeft,
    brushRight,
    roller,
    lidarRing,
    ledHalo,
    underglow,
    topperGroup,
    updateAnimation,
    triggerBumperCompression,
    updateSkin,
  };
}
