/**
 * ProceduralRoomba
 * Builds high-fidelity 3-12 part procedural Three.js Roomba models
 * with customizable finishes, decals, spinning brushes, lidar turrets,
 * spring-loaded bumpers, and novelty 3D toppers. Zero external assets (zero 404s).
 */
import * as THREE from 'three';
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

  // 3. Central Power & Clean Button Disc
  const buttonMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.25,
    metalness: 0.6,
  });
  const buttonGeo = new THREE.CylinderGeometry(chassisRadius * 0.32, chassisRadius * 0.32, 0.015, 32);
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
  const ledGeo = new THREE.TorusGeometry(chassisRadius * 0.33, 0.012, 16, 32);
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
    chassis.material = getBodyMaterial(newSkin.primaryColor, newSkin.finish);
    chamferMat.color.set(newSkin.accentColor);
    ledMat.color.set(newSkin.primaryColor);
    ledMat.emissive.set(newSkin.primaryColor);
    underglowMat.color.set(newSkin.underglowColor);
    buildTopper(newSkin.topper);
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
