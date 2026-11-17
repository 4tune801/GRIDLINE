import * as THREE from 'three';
import { CAR_CATALOG, LIVERY_CATALOG, type CarId, type LiveryId } from '../types/racing';

export interface RaceCarRig {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  frontLeftSteer: THREE.Group;
  frontRightSteer: THREE.Group;
  wheelMeshes: THREE.Object3D[];
  brakeMaterial: THREE.MeshStandardMaterial;
  nitroFlames: THREE.Mesh[];
  updateAnimation: (params: {
    steerRatio: number;
    speed: number;
    nitroActive: boolean;
    braking: boolean;
    dt: number;
    elapsedSec: number;
    accelIntensity?: number;
    collisionImpulse?: number;
  }) => void;
  dispose: () => void;
}

let cachedContactShadowTex: THREE.CanvasTexture | null = null;
let cachedToonGradient: THREE.DataTexture | null = null;

function getContactShadowTexture(): THREE.CanvasTexture {
  if (cachedContactShadowTex) return cachedContactShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 128, 14, 64, 128, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.38)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedContactShadowTex = tex;
  return tex;
}

function getToonGradientMap(): THREE.DataTexture {
  if (cachedToonGradient) return cachedToonGradient;
  // Crisp 4-band cartoon cel shading ramp
  const bands = new Uint8Array([82, 148, 212, 255]);
  const tex = new THREE.DataTexture(bands, 4, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  cachedToonGradient = tex;
  return tex;
}

function buildProfileBodyGeometry(
  points: Array<[number, number]>,
  width: number,
  bevelSize = 0.08
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -width / 2);
  geo.rotateY(-Math.PI / 2);
  return geo;
}

const CAR_SILHOUETTE_PROFILES: Record<CarId, Array<[number, number]>> = {
  // Low-slung wedge nose + sweeping cab-forward canopy + flat mid-engine rear deck
  ferrari_488: [
    [-2.08, 0.0],
    [2.16, 0.0],
    [2.24, 0.24],
    [1.62, 0.44],
    [0.82, 0.48],
    [0.14, 0.88],
    [-0.58, 0.86],
    [-1.42, 0.56],
    [-2.1, 0.52],
  ],
  // Balanced 4-door athletic sport sedan with defined trunk
  lexus_is: [
    [-2.12, 0.0],
    [2.14, 0.0],
    [2.2, 0.3],
    [1.45, 0.52],
    [0.72, 0.56],
    [0.18, 0.96],
    [-0.78, 0.94],
    [-1.48, 0.62],
    [-2.14, 0.58],
  ],
  // Sleek long-hood executive sport coupe
  mercedes_c300: [
    [-2.1, 0.0],
    [2.18, 0.0],
    [2.22, 0.32],
    [1.36, 0.54],
    [0.65, 0.58],
    [0.05, 0.95],
    [-0.86, 0.91],
    [-1.62, 0.62],
    [-2.12, 0.56],
  ],
  // Chunky high-beltline American muscle car with aggressive squared nose
  chevy_camaro: [
    [-2.12, 0.0],
    [2.18, 0.0],
    [2.22, 0.38],
    [1.48, 0.58],
    [0.68, 0.6],
    [0.1, 0.96],
    [-0.82, 0.92],
    [-1.56, 0.66],
    [-2.12, 0.62],
  ],
  // Iconic sloping teardrop Porsche 911 silhouette
  porsche_911: [
    [-2.05, 0.0],
    [2.1, 0.0],
    [2.15, 0.28],
    [1.42, 0.46],
    [0.74, 0.52],
    [0.18, 0.94],
    [-0.65, 0.9],
    [-1.72, 0.54],
    [-2.08, 0.46],
  ],
  // Muscular boxy JDM GT-R stance
  nissan_gtr: [
    [-2.12, 0.0],
    [2.16, 0.0],
    [2.22, 0.34],
    [1.42, 0.54],
    [0.68, 0.56],
    [0.12, 0.96],
    [-0.76, 0.94],
    [-1.52, 0.64],
    [-2.14, 0.6],
  ],
};

export function createRaceCar(
  liveryId: LiveryId,
  isSoftwareGl = false,
  carId: CarId = 'ferrari_488'
): RaceCarRig {
  const palette = LIVERY_CATALOG[liveryId] || LIVERY_CATALOG.crimson_apex;
  const carSpec = CAR_CATALOG[carId] || CAR_CATALOG.ferrari_488;
  const toonGradient = getToonGradientMap();

  const root = new THREE.Group();
  const chassisGroup = new THREE.Group();
  root.add(chassisGroup);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Cartoon Cel-Shaded Body & Accent Materials + Ink Contour Outline
  const paintMat = trackMat(
    new THREE.MeshToonMaterial({
      color: palette.primaryHex,
      gradientMap: toonGradient,
    })
  );

  const accentMat = trackMat(
    new THREE.MeshToonMaterial({
      color: palette.accentHex,
      gradientMap: toonGradient,
    })
  );

  const outlineMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x090b10,
      side: THREE.BackSide,
    })
  );

  const carbonMat = trackMat(
    new THREE.MeshToonMaterial({
      color: 0x1e2430,
      gradientMap: toonGradient,
    })
  );

  const chromeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.16,
    })
  );

  const glassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0e1726,
      metalness: 0.18,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    })
  );

  const scleraMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
    })
  );

  const irisMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: carSpec.eyeColorHex,
    })
  );

  const pupilMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x090b10,
    })
  );

  const catchlightMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
    })
  );

  const tireMat = trackMat(
    new THREE.MeshToonMaterial({
      color: 0x181a20,
      gradientMap: toonGradient,
    })
  );

  const headlightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff5d6,
      emissiveIntensity: 1.8,
      roughness: 0.15,
    })
  );

  const brakeMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 0.95,
      roughness: 0.2,
    })
  );

  const mouthGrilleMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x101319,
    })
  );

  const mouthTeethMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf1f5f9,
    })
  );

  const nitroMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
    })
  );

  // 1. Soft radial contact shadow plane grounded at y = 0.02
  const shadowGeo = trackGeo(new THREE.PlaneGeometry(2.85, 5.4));
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.62,
    })
  );
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  // 2. Lower Chassis Floor & Diffuser (attached to chassisGroup so it tilts/bounces)
  const floorGeo = trackGeo(new THREE.BoxGeometry(2.04, 0.16, 4.44));
  const floorMesh = new THREE.Mesh(floorGeo, carbonMat);
  floorMesh.position.set(0, 0.3, 0);
  floorMesh.castShadow = !isSoftwareGl;
  floorMesh.receiveShadow = true;
  chassisGroup.add(floorMesh);

  // 3. Sculpted Cartoon Character Body + Ink Silhouette Outline
  const profilePoints = CAR_SILHOUETTE_PROFILES[carId];
  const bodyWidth = carId === 'chevy_camaro' || carId === 'nissan_gtr' ? 1.46 : 1.38;
  const bodyGeo = trackGeo(buildProfileBodyGeometry(profilePoints, bodyWidth, 0.09));
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
  bodyMesh.position.set(0, 0.32, 0);
  bodyMesh.castShadow = !isSoftwareGl;
  bodyMesh.receiveShadow = true;
  chassisGroup.add(bodyMesh);

  // Bold cartoon ink contour shell around primary silhouette
  const bodyOutline = new THREE.Mesh(bodyGeo, outlineMat);
  bodyOutline.position.set(0, 0.32, 0);
  bodyOutline.scale.set(1.035, 1.045, 1.02);
  chassisGroup.add(bodyOutline);

  // 4. Chunky Cartoon Wheel-Arch Fenders & Side Skirts
  const fenderGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.36, 1.05));
  const fenderOffsets: Array<[number, number]> = [
    [0.9, 1.35],
    [-0.9, 1.35],
    [0.92, -1.35],
    [-0.92, -1.35],
  ];
  for (const [fx, fz] of fenderOffsets) {
    const fMesh = new THREE.Mesh(fenderGeo, paintMat);
    fMesh.position.set(fx, 0.56, fz);
    fMesh.castShadow = !isSoftwareGl;
    const fOutline = new THREE.Mesh(fenderGeo, outlineMat);
    fOutline.position.copy(fMesh.position);
    fOutline.scale.set(1.06, 1.07, 1.04);
    chassisGroup.add(fMesh, fOutline);
  }

  const sidePodGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.3, 1.85));
  for (const side of [1, -1]) {
    const pod = new THREE.Mesh(sidePodGeo, paintMat);
    pod.position.set(side * 0.86, 0.45, 0);
    pod.castShadow = !isSoftwareGl;
    chassisGroup.add(pod);
  }

  // Side Cartoon Door Mirrors (like cute ears!)
  const mirrorStemGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.06, 0.06));
  const mirrorCapGeo = trackGeo(new THREE.BoxGeometry(0.22, 0.14, 0.16));
  for (const side of [1, -1]) {
    const stem = new THREE.Mesh(mirrorStemGeo, carbonMat);
    stem.position.set(side * 0.86, 0.9, 0.52);
    const cap = new THREE.Mesh(mirrorCapGeo, paintMat);
    cap.position.set(side * 0.98, 0.94, 0.5);
    const capOutline = new THREE.Mesh(mirrorCapGeo, outlineMat);
    capOutline.position.copy(cap.position);
    capOutline.scale.set(1.12, 1.15, 1.12);
    chassisGroup.add(stem, cap, capOutline);
  }

  // 5. Rear & Side Windows (Dark Tinted Glass) + Cartoon Windshield Eyes Face
  const sideGlassGeo = trackGeo(new THREE.BoxGeometry(1.36, 0.34, 1.38));
  const sideGlass = new THREE.Mesh(sideGlassGeo, glassMat);
  sideGlass.position.set(0, 0.98, -0.22);
  chassisGroup.add(sideGlass);

  // Expressive Pixar-style White Windshield Visor (slanted forward)
  const visorGroup = new THREE.Group();
  const visorZ = carId === 'ferrari_488' ? 0.56 : carId === 'porsche_911' ? 0.5 : 0.48;
  const visorY = carId === 'ferrari_488' ? 0.94 : 1.02;
  visorGroup.position.set(0, visorY, visorZ);
  visorGroup.rotation.x = -0.62;
  chassisGroup.add(visorGroup);

  const visorGeo = trackGeo(new THREE.BoxGeometry(1.18, 0.44, 0.09));
  const visorBg = new THREE.Mesh(visorGeo, scleraMat);
  visorGroup.add(visorBg);

  const visorFrame = new THREE.Mesh(visorGeo, outlineMat);
  visorFrame.scale.set(1.04, 1.08, 0.9);
  visorFrame.position.z = -0.02;
  visorGroup.add(visorFrame);

  // Center bridge divider between left and right cartoon eyes
  const noseBridgeGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.45, 0.12));
  const noseBridge = new THREE.Mesh(noseBridgeGeo, paintMat);
  noseBridge.position.set(0, 0, 0.02);
  visorGroup.add(noseBridge);

  // Two Animated Cartoon Eyes (Iris + Pupil + Glossy Catchlight + Expressive Eyelid)
  const irisGeo = trackGeo(new THREE.CircleGeometry(0.135, 20));
  const pupilGeo = trackGeo(new THREE.CircleGeometry(0.078, 16));
  const catchGeo = trackGeo(new THREE.CircleGeometry(0.028, 10));
  const eyelidGeo = trackGeo(new THREE.BoxGeometry(0.54, 0.22, 0.12));

  const createEye = (xOffset: number) => {
    const eyeSocket = new THREE.Group();
    eyeSocket.position.set(xOffset, -0.01, 0.055);
    visorGroup.add(eyeSocket);

    const pupilGroup = new THREE.Group();
    eyeSocket.add(pupilGroup);

    const iris = new THREE.Mesh(irisGeo, irisMat);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.z = 0.008;
    const catchlight = new THREE.Mesh(catchGeo, catchlightMat);
    catchlight.position.set(0.045, 0.048, 0.016);
    pupilGroup.add(iris, pupil, catchlight);

    const eyelid = new THREE.Mesh(eyelidGeo, paintMat);
    eyelid.position.set(xOffset, 0.22, 0.06);
    visorGroup.add(eyelid);

    return { pupilGroup, eyelid };
  };

  const leftEye = createEye(0.28);
  const rightEye = createEye(-0.28);

  // 6. Signature Model-Specific Styling, Grilles (Cartoon Mouth!) & Spoilers
  const stripeGeo = trackGeo(new THREE.BoxGeometry(0.16, 0.03, 3.3));
  if (carId === 'chevy_camaro' || carId === 'ferrari_488' || carId === 'porsche_911') {
    const sL = new THREE.Mesh(stripeGeo, accentMat);
    sL.position.set(0.15, 0.87, 0.1);
    const sR = new THREE.Mesh(stripeGeo, accentMat);
    sR.position.set(-0.15, 0.87, 0.1);
    chassisGroup.add(sL, sR);
  }

  // Expressive Cartoon Mouth / Front Grille + Model-Specific Trim
  if (carId === 'ferrari_488') {
    // Wide smiling Ferrari aero mouth with twin vertical fang strakes
    const mouthGeo = trackGeo(new THREE.BoxGeometry(1.16, 0.18, 0.1));
    const mouth = new THREE.Mesh(mouthGeo, mouthGrilleMat);
    mouth.position.set(0, 0.36, 2.24);
    const teethGeo = trackGeo(new THREE.BoxGeometry(0.76, 0.04, 0.11));
    const smileBar = new THREE.Mesh(teethGeo, mouthTeethMat);
    smileBar.position.set(0, 0.34, 2.25);
    // Scuderia side intake scoops
    const scoopGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.24, 0.62));
    for (const side of [1, -1]) {
      const scoop = new THREE.Mesh(scoopGeo, carbonMat);
      scoop.position.set(side * 1.0, 0.56, -0.58);
      chassisGroup.add(scoop);
    }
    // Engine glass louver on rear deck
    const engGlassGeo = trackGeo(new THREE.BoxGeometry(0.84, 0.06, 0.82));
    const engGlass = new THREE.Mesh(engGlassGeo, glassMat);
    engGlass.position.set(0, 0.84, -1.25);
    // Iconic twin round Ferrari tail lights
    const roundTailGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 16));
    roundTailGeo.rotateX(Math.PI / 2);
    for (const xPos of [0.68, 0.42, -0.42, -0.68]) {
      const lamp = new THREE.Mesh(roundTailGeo, brakeMaterial);
      lamp.position.set(xPos, 0.68, -2.14);
      chassisGroup.add(lamp);
    }
    chassisGroup.add(mouth, smileBar, engGlass);
  } else if (carId === 'lexus_is') {
    // Signature Hourglass Spindle Grille + Chrome Surround
    const upperSpindle = trackGeo(new THREE.CylinderGeometry(0.42, 0.24, 0.18, 4));
    upperSpindle.rotateY(Math.PI / 4);
    upperSpindle.rotateX(Math.PI / 2);
    const lowerSpindle = trackGeo(new THREE.CylinderGeometry(0.24, 0.48, 0.2, 4));
    lowerSpindle.rotateY(Math.PI / 4);
    lowerSpindle.rotateX(Math.PI / 2);
    const m1 = new THREE.Mesh(upperSpindle, mouthGrilleMat);
    m1.position.set(0, 0.48, 2.21);
    const m2 = new THREE.Mesh(lowerSpindle, mouthGrilleMat);
    m2.position.set(0, 0.34, 2.21);
    const lipGeo = trackGeo(new THREE.BoxGeometry(0.56, 0.04, 0.1));
    const smile = new THREE.Mesh(lipGeo, chromeMat);
    smile.position.set(0, 0.39, 2.24);
    // Sleek trunk lip spoiler
    const lipWingGeo = trackGeo(new THREE.BoxGeometry(1.62, 0.08, 0.22));
    const lipWing = new THREE.Mesh(lipWingGeo, carbonMat);
    lipWing.position.set(0, 0.92, -2.06);
    chassisGroup.add(m1, m2, smile, lipWing);
  } else if (carId === 'mercedes_c300') {
    // Wide Panamericana/Twin-Bar Chrome Grille + Central 3-Pointed Star Ring
    const grilleGeo = trackGeo(new THREE.BoxGeometry(1.06, 0.28, 0.1));
    const grille = new THREE.Mesh(grilleGeo, mouthGrilleMat);
    grille.position.set(0, 0.48, 2.21);
    const barGeo = trackGeo(new THREE.BoxGeometry(1.02, 0.04, 0.12));
    const chromeBar = new THREE.Mesh(barGeo, chromeMat);
    chromeBar.position.set(0, 0.48, 2.22);
    const starRingGeo = trackGeo(new THREE.TorusGeometry(0.11, 0.022, 8, 20));
    const starRing = new THREE.Mesh(starRingGeo, chromeMat);
    starRing.position.set(0, 0.48, 2.27);
    // Hood power domes
    const domeGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.05, 0.95));
    for (const side of [1, -1]) {
      const dome = new THREE.Mesh(domeGeo, paintMat);
      dome.position.set(side * 0.32, 0.89, 1.15);
      chassisGroup.add(dome);
    }
    const trunkLipGeo = trackGeo(new THREE.BoxGeometry(1.64, 0.08, 0.24));
    const trunkLip = new THREE.Mesh(trunkLipGeo, accentMat);
    trunkLip.position.set(0, 0.92, -2.04);
    chassisGroup.add(grille, chromeBar, starRing, trunkLip);
  } else if (carId === 'chevy_camaro') {
    // Muscular V8 Power-Bulge Hood Scoop + Deep Confident Muscle Snarl Grille
    const hoodScoopGeo = trackGeo(new THREE.BoxGeometry(0.68, 0.14, 1.05));
    const hoodScoop = new THREE.Mesh(hoodScoopGeo, carbonMat);
    hoodScoop.position.set(0, 0.94, 1.15);
    const scoopOutline = new THREE.Mesh(hoodScoopGeo, outlineMat);
    scoopOutline.position.copy(hoodScoop.position);
    scoopOutline.scale.set(1.06, 1.1, 1.04);
    const grilleGeo = trackGeo(new THREE.BoxGeometry(1.24, 0.26, 0.12));
    const grille = new THREE.Mesh(grilleGeo, mouthGrilleMat);
    grille.position.set(0, 0.44, 2.22);
    const smirkGeo = trackGeo(new THREE.BoxGeometry(0.84, 0.05, 0.13));
    const smirk = new THREE.Mesh(smirkGeo, accentMat);
    smirk.position.set(0, 0.41, 2.23);
    // Beefy Muscle Spoiler
    const wingGeo = trackGeo(new THREE.BoxGeometry(1.94, 0.09, 0.36));
    const wing = new THREE.Mesh(wingGeo, carbonMat);
    wing.position.set(0, 1.05, -2.02);
    chassisGroup.add(hoodScoop, scoopOutline, grille, smirk, wing);
  } else if (carId === 'porsche_911') {
    // Cheerful wide GT3 grin + iconic upright round frog-eye headlights + Swan-Neck Rear Wing
    const mouthGeo = trackGeo(new THREE.BoxGeometry(1.18, 0.2, 0.1));
    const mouth = new THREE.Mesh(mouthGeo, mouthGrilleMat);
    mouth.position.set(0, 0.36, 2.15);
    const smileGeo = trackGeo(new THREE.BoxGeometry(0.86, 0.04, 0.11));
    const smile = new THREE.Mesh(smileGeo, mouthTeethMat);
    smile.position.set(0, 0.35, 2.16);
    const podGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.2, 0.36, 16));
    podGeo.rotateX(Math.PI / 2);
    for (const side of [1, -1]) {
      const pod = new THREE.Mesh(podGeo, paintMat);
      pod.position.set(side * 0.66, 0.72, 1.56);
      const lens = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(0.15, 16)), headlightMat);
      lens.position.set(side * 0.66, 0.72, 1.75);
      chassisGroup.add(pod, lens);
    }
    chassisGroup.add(mouth, smile);
  } else {
    // Nissan GT-R: Wide trapezoidal JDM mouth + iconic quad circular Skyline taillights
    const mouthGeo = trackGeo(new THREE.BoxGeometry(1.18, 0.28, 0.1));
    const mouth = new THREE.Mesh(mouthGeo, mouthGrilleMat);
    mouth.position.set(0, 0.42, 2.22);
    const smileGeo = trackGeo(new THREE.BoxGeometry(0.92, 0.05, 0.11));
    const smile = new THREE.Mesh(smileGeo, accentMat);
    smile.position.set(0, 0.44, 2.23);
    const ringGeo = trackGeo(new THREE.TorusGeometry(0.12, 0.035, 8, 18));
    for (const [rx, rScale] of [
      [0.68, 1.0],
      [0.42, 0.82],
      [-0.42, 0.82],
      [-0.68, 1.0],
    ] as Array<[number, number]>) {
      const ring = new THREE.Mesh(ringGeo, brakeMaterial);
      ring.position.set(rx, 0.74, -2.14);
      ring.scale.setScalar(rScale);
      chassisGroup.add(ring);
    }
    chassisGroup.add(mouth, smile);
  }

  // Front Aero Splitter (All Cars)
  const frontWingGeo = trackGeo(new THREE.BoxGeometry(2.14, 0.07, 0.44));
  const frontWing = new THREE.Mesh(frontWingGeo, carbonMat);
  frontWing.position.set(0, 0.24, 2.08);
  frontWing.castShadow = !isSoftwareGl;
  chassisGroup.add(frontWing);

  // Rear GT Wing for Ferrari, Porsche 911, Nissan GT-R
  if (carId === 'ferrari_488' || carId === 'porsche_911' || carId === 'nissan_gtr') {
    const pylonGeo = trackGeo(new THREE.BoxGeometry(0.07, 0.36, 0.26));
    const pylonL = new THREE.Mesh(pylonGeo, carbonMat);
    pylonL.position.set(0.46, 0.96, -1.92);
    const pylonR = new THREE.Mesh(pylonGeo, carbonMat);
    pylonR.position.set(-0.46, 0.96, -1.92);

    const rearWingGeo = trackGeo(new THREE.BoxGeometry(2.08, 0.08, 0.4));
    const rearWing = new THREE.Mesh(rearWingGeo, accentMat);
    rearWing.position.set(0, 1.16, -1.98);
    rearWing.rotation.x = 0.14;
    rearWing.castShadow = !isSoftwareGl;
    const wingOutline = new THREE.Mesh(rearWingGeo, outlineMat);
    wingOutline.position.copy(rearWing.position);
    wingOutline.rotation.copy(rearWing.rotation);
    wingOutline.scale.set(1.03, 1.28, 1.08);

    chassisGroup.add(pylonL, pylonR, rearWing, wingOutline);
  }

  // Headlights (skip standard block lamps for Porsche since it has frog-eye pods)
  if (carId !== 'porsche_911') {
    const headGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.11, 0.1));
    const headL = new THREE.Mesh(headGeo, headlightMat);
    headL.position.set(0.68, 0.58, 2.16);
    const headR = new THREE.Mesh(headGeo, headlightMat);
    headR.position.set(-0.68, 0.58, 2.16);
    chassisGroup.add(headL, headR);
  }

  // Tail/Brake Light Bar (for Lexus, Mercedes, Camaro, Porsche)
  if (carId !== 'ferrari_488' && carId !== 'nissan_gtr') {
    const tailGeo = trackGeo(new THREE.BoxGeometry(1.58, 0.1, 0.08));
    const tailBar = new THREE.Mesh(tailGeo, brakeMaterial);
    tailBar.position.set(0, 0.72, -2.14);
    chassisGroup.add(tailBar);
  }

  // Twin Chrome Exhausts & Nitro Flames
  const exhaustGeo = trackGeo(new THREE.CylinderGeometry(0.085, 0.095, 0.28, 12));
  exhaustGeo.rotateX(Math.PI / 2);
  const exL = new THREE.Mesh(exhaustGeo, chromeMat);
  exL.position.set(0.42, 0.34, -2.18);
  const exR = new THREE.Mesh(exhaustGeo, chromeMat);
  exR.position.set(-0.42, 0.34, -2.18);
  chassisGroup.add(exL, exR);

  const flameGeo = trackGeo(new THREE.ConeGeometry(0.13, 0.85, 10));
  flameGeo.rotateX(-Math.PI / 2);
  const flameL = new THREE.Mesh(flameGeo, nitroMat);
  flameL.position.set(0.42, 0.34, -2.68);
  flameL.visible = false;
  const flameR = new THREE.Mesh(flameGeo, nitroMat);
  flameR.position.set(-0.42, 0.34, -2.68);
  flameR.visible = false;
  chassisGroup.add(flameL, flameR);

  // 7. Chunky Cartoon Wheel-and-Tire Assemblies (radius = 0.40 for expressive cartoon stance!)
  const tireGeo = trackGeo(new THREE.CylinderGeometry(0.4, 0.4, 0.34, 22));
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.355, 12));
  rimGeo.rotateZ(Math.PI / 2);
  const hubGeo = trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.37, 8));
  hubGeo.rotateZ(Math.PI / 2);

  const wheelMeshes: THREE.Object3D[] = [];
  const createWheel = (x: number, z: number): { steerGroup: THREE.Group; spinGroup: THREE.Group } => {
    const steerGroup = new THREE.Group();
    steerGroup.position.set(x, 0.4, z);

    const spinGroup = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = !isSoftwareGl;
    const rim = new THREE.Mesh(rimGeo, chromeMat);
    const hub = new THREE.Mesh(hubGeo, accentMat);
    spinGroup.add(tire, rim, hub);
    steerGroup.add(spinGroup);
    root.add(steerGroup);
    wheelMeshes.push(spinGroup);
    return { steerGroup, spinGroup };
  };

  const fl = createWheel(1.0, 1.35);
  const fr = createWheel(-1.0, 1.35);
  createWheel(1.0, -1.35);
  createWheel(-1.0, -1.35);

  return {
    root,
    chassisGroup,
    frontLeftSteer: fl.steerGroup,
    frontRightSteer: fr.steerGroup,
    wheelMeshes,
    brakeMaterial,
    nitroFlames: [flameL, flameR],
    updateAnimation: ({
      steerRatio,
      speed,
      nitroActive,
      braking,
      dt,
      elapsedSec,
      accelIntensity = 0,
      collisionImpulse = 0,
    }) => {
      // Cartoon eye gaze tracks turn direction; widens in comic surprise on collision
      const gazeX = THREE.MathUtils.clamp(steerRatio * 0.14, -0.09, 0.09);
      const blinkCycle = elapsedSec % 4.6;
      const isBlinking = blinkCycle > 4.44 && collisionImpulse < 0.08;
      const shocked = collisionImpulse > 0.14;
      const eyeOpenScaleY = isBlinking
        ? 0.08
        : shocked
        ? 1.32
        : nitroActive
        ? 0.72
        : braking
        ? 1.12
        : 1.0;

      leftEye.pupilGroup.position.x = THREE.MathUtils.damp(leftEye.pupilGroup.position.x, gazeX, 14, dt);
      rightEye.pupilGroup.position.x = THREE.MathUtils.damp(rightEye.pupilGroup.position.x, gazeX, 14, dt);
      leftEye.pupilGroup.scale.y = THREE.MathUtils.damp(leftEye.pupilGroup.scale.y, eyeOpenScaleY, 22, dt);
      rightEye.pupilGroup.scale.y = THREE.MathUtils.damp(rightEye.pupilGroup.scale.y, eyeOpenScaleY, 22, dt);

      // Expressive eyebrow/eyelid tilt (raised on impact, determined race brow on nitro)
      const lidDrop = isBlinking ? 0.02 : shocked ? 0.28 : nitroActive ? 0.11 : braking ? 0.25 : 0.2;
      const browTilt = shocked ? -0.18 : nitroActive ? 0.18 : braking ? -0.1 : 0.04;
      leftEye.eyelid.position.y = THREE.MathUtils.damp(leftEye.eyelid.position.y, lidDrop, 16, dt);
      rightEye.eyelid.position.y = THREE.MathUtils.damp(rightEye.eyelid.position.y, lidDrop, 16, dt);
      leftEye.eyelid.rotation.z = THREE.MathUtils.damp(leftEye.eyelid.rotation.z, -browTilt, 14, dt);
      rightEye.eyelid.rotation.z = THREE.MathUtils.damp(rightEye.eyelid.rotation.z, browTilt, 14, dt);

      // Expressive cartoon suspension roll, pitch, speed rumble & collision shake
      const absSpeed = Math.abs(speed);
      const speedRatio = Math.min(1, absSpeed / 72);
      const clampAccel = THREE.MathUtils.clamp(accelIntensity, 0, 1);
      const clampHit = THREE.MathUtils.clamp(collisionImpulse, 0, 1);

      const hitShakeX = clampHit > 0.01 ? Math.sin(elapsedSec * 58) * clampHit * 0.12 : 0;
      const hitShakeRoll = clampHit > 0.01 ? Math.cos(elapsedSec * 48) * clampHit * 0.16 : 0;
      const hitHopY = clampHit > 0.01 ? Math.abs(Math.sin(elapsedSec * 42)) * clampHit * 0.13 : 0;

      const highSpeedTremorX =
        (nitroActive || speedRatio > 0.55) && absSpeed > 10
          ? Math.sin(elapsedSec * 44) * (0.008 + (nitroActive ? 0.014 : 0) + clampAccel * 0.012)
          : 0;

      const targetRoll =
        THREE.MathUtils.clamp(-steerRatio * (absSpeed / 60) * 0.14, -0.11, 0.11) + hitShakeRoll;
      const targetPitch = braking ? 0.058 : nitroActive ? -0.052 : -clampAccel * 0.036;
      const bounceY = Math.sin(elapsedSec * (absSpeed > 4 ? 18 : 4.2)) * (absSpeed > 4 ? 0.015 : 0.008);

      chassisGroup.rotation.z = THREE.MathUtils.damp(chassisGroup.rotation.z, targetRoll, 12, dt);
      chassisGroup.rotation.x = THREE.MathUtils.damp(chassisGroup.rotation.x, targetPitch, 12, dt);
      chassisGroup.position.x = hitShakeX + highSpeedTremorX;
      chassisGroup.position.y = bounceY + hitHopY;

      // Speed-gain scale-up / cartoon squash-and-stretch + collision pop
      const targetScaleX =
        1 + speedRatio * 0.02 + (nitroActive ? 0.035 : 0) + clampAccel * 0.025 + clampHit * 0.09;
      const targetScaleY =
        1 + speedRatio * 0.015 + (nitroActive ? 0.02 : 0) - clampAccel * 0.02 + clampHit * 0.08;
      const targetScaleZ =
        1 + speedRatio * 0.035 + (nitroActive ? 0.065 : 0) + clampAccel * 0.06 - clampHit * 0.05;

      chassisGroup.scale.x = THREE.MathUtils.damp(chassisGroup.scale.x, targetScaleX, 14, dt);
      chassisGroup.scale.y = THREE.MathUtils.damp(chassisGroup.scale.y, targetScaleY, 14, dt);
      chassisGroup.scale.z = THREE.MathUtils.damp(chassisGroup.scale.z, targetScaleZ, 14, dt);
    },
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
