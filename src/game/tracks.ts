import * as THREE from 'three';
import type { TrackId } from '../types/racing';

export interface TrackMetadata {
  id: TrackId;
  name: string;
  location: string;
  lengthLabel: string;
  corners: number;
  surface: string;
  description: string;
  skyTopColor: number;
  skyHorizonColor: number;
  sunDiscColor: number;
  fogColor: number;
  fogDensity: number;
  groundColor: number;
  groundAccentColor: number;
  dustColorHex: number;
  curbPrimary: number;
  curbSecondary: number;
  accentHex: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sunColor: number;
  sunIntensity: number;
  sunDirection: [number, number, number];
  hasWater: boolean;
  waterColor: number;
  waterSide: 1 | -1;
  isNight: boolean;
  startZ: number;
  controlPoints: Array<[number, number]>;
  boostTs: number[];
}

export const TRACK_CATALOG: Record<TrackId, TrackMetadata> = {
  monaco_harbor: {
    id: 'monaco_harbor',
    name: 'Monaco Harbor Loop',
    location: 'Monte Carlo Waterfront',
    lengthLabel: '1.42 km · 3 Laps',
    corners: 8,
    surface: 'Coastal Street Asphalt',
    description: 'Tight marina chicane and sweeping Mediterranean waterfront straight built for late-braking overtakes.',
    skyTopColor: 0x1d4e89,
    skyHorizonColor: 0x9bd0eb,
    sunDiscColor: 0xfff5d6,
    fogColor: 0x9bd0eb,
    fogDensity: 0.0014,
    groundColor: 0x3b4d3e,
    groundAccentColor: 0x4c5d4c,
    dustColorHex: 0xa8a29e,
    curbPrimary: 0xdc2626,
    curbSecondary: 0xf8fafc,
    accentHex: 0xf59e0b,
    hemiSky: 0xdbeafe,
    hemiGround: 0x334155,
    hemiIntensity: 0.85,
    sunColor: 0xfff4dc,
    sunIntensity: 2.35,
    sunDirection: [85, 115, 65],
    hasWater: true,
    waterColor: 0x0c5b82,
    waterSide: -1,
    isNight: false,
    startZ: -102,
    controlPoints: [
      [0, -110],
      [0, 0],
      [0, 82],
      [-45, 132],
      [-115, 112],
      [-148, 52],
      [-92, 6],
      [-150, -48],
      [-132, -124],
      [-54, -148],
      [0, -138],
    ],
    boostTs: [0.13, 0.56, 0.84],
  },
  ibiza_coast: {
    id: 'ibiza_coast',
    name: 'Ibiza Cala Sunset',
    location: 'Balearic Coastline, Spain',
    lengthLabel: '1.54 km · 3 Laps',
    corners: 7,
    surface: 'Sun-Warmed Coastal Tarmac',
    description: 'Golden-hour Balearic cliffside sweepers overlooking turquoise coves, whitewashed villas, and swaying palms.',
    skyTopColor: 0x2b4570,
    skyHorizonColor: 0xf6a973,
    sunDiscColor: 0xffe49e,
    fogColor: 0xe8a57a,
    fogDensity: 0.0015,
    groundColor: 0xa3875c,
    groundAccentColor: 0x7b854d,
    dustColorHex: 0xd6b888,
    curbPrimary: 0x0284c7,
    curbSecondary: 0xfef3c7,
    accentHex: 0xf97316,
    hemiSky: 0xfde68a,
    hemiGround: 0x5c4734,
    hemiIntensity: 0.88,
    sunColor: 0xffcfa0,
    sunIntensity: 2.45,
    sunDirection: [140, 52, 75],
    hasWater: true,
    waterColor: 0x0e8aa6,
    waterSide: 1,
    isNight: false,
    startZ: -105,
    controlPoints: [
      [0, -112],
      [0, 0],
      [0, 88],
      [55, 138],
      [128, 122],
      [156, 56],
      [98, 10],
      [148, -58],
      [114, -132],
      [44, -152],
      [0, -140],
    ],
    boostTs: [0.14, 0.48, 0.81],
  },
  lagos_island: {
    id: 'lagos_island',
    name: 'Lagos Eko Expressway',
    location: 'Victoria Island & Lekki, Nigeria',
    lengthLabel: '1.66 km · 3 Laps',
    corners: 8,
    surface: 'Coastal Bridge & Lagoon Tarmac',
    description: 'High-speed waterfront expressway crossing the shimmering Lagos lagoon beside cable-stayed towers and palms.',
    skyTopColor: 0x1a5f9c,
    skyHorizonColor: 0xaedbf2,
    sunDiscColor: 0xfff8dc,
    fogColor: 0xa7d4ec,
    fogDensity: 0.0013,
    groundColor: 0x3b6938,
    groundAccentColor: 0x6b7c47,
    dustColorHex: 0xc29b6c,
    curbPrimary: 0x16a34a,
    curbSecondary: 0xf8fafc,
    accentHex: 0x10b981,
    hemiSky: 0xe0f2fe,
    hemiGround: 0x2f4d2c,
    hemiIntensity: 0.92,
    sunColor: 0xfff6e0,
    sunIntensity: 2.5,
    sunDirection: [75, 125, -55],
    hasWater: true,
    waterColor: 0x0d7377,
    waterSide: 1,
    isNight: false,
    startZ: -108,
    controlPoints: [
      [0, -116],
      [0, 0],
      [0, 96],
      [-62, 148],
      [-148, 136],
      [-184, 58],
      [-130, -8],
      [-178, -76],
      [-132, -148],
      [-52, -158],
      [0, -142],
    ],
    boostTs: [0.13, 0.51, 0.83],
  },
  los_angeles_sunset: {
    id: 'los_angeles_sunset',
    name: 'Los Angeles PCH & DTLA',
    location: 'Santa Monica to Downtown LA',
    lengthLabel: '1.70 km · 3 Laps',
    corners: 8,
    surface: 'Pacific Boulevard Asphalt',
    description: 'Sun-drenched Pacific coast straightaways curving past palm-lined boulevards and Downtown LA glass towers.',
    skyTopColor: 0x354075,
    skyHorizonColor: 0xf4a261,
    sunDiscColor: 0xffd180,
    fogColor: 0xeb9c64,
    fogDensity: 0.0014,
    groundColor: 0x877250,
    groundAccentColor: 0x5c6d42,
    dustColorHex: 0xcbb086,
    curbPrimary: 0xef4444,
    curbSecondary: 0xfef08a,
    accentHex: 0xf59e0b,
    hemiSky: 0xfef3c7,
    hemiGround: 0x473a2c,
    hemiIntensity: 0.86,
    sunColor: 0xffbe7b,
    sunIntensity: 2.45,
    sunDirection: [-140, 48, 80],
    hasWater: true,
    waterColor: 0x15658c,
    waterSide: -1,
    isNight: false,
    startZ: -112,
    controlPoints: [
      [0, -120],
      [0, 0],
      [0, 102],
      [68, 154],
      [158, 124],
      [182, 42],
      [124, -16],
      [172, -88],
      [122, -154],
      [42, -162],
      [0, -144],
    ],
    boostTs: [0.15, 0.47, 0.79],
  },
  redrock_canyon: {
    id: 'redrock_canyon',
    name: 'Redrock Canyon Circuit',
    location: 'Utah High Desert',
    lengthLabel: '1.58 km · 3 Laps',
    corners: 7,
    surface: 'Sun-Baked Canyon Tarmac',
    description: 'High-velocity desert straightaways feeding into technical sandstone switchbacks.',
    skyTopColor: 0x2c4b78,
    skyHorizonColor: 0xe6b587,
    sunDiscColor: 0xfff0c2,
    fogColor: 0xd9a273,
    fogDensity: 0.0016,
    groundColor: 0x8b4628,
    groundAccentColor: 0xa66138,
    dustColorHex: 0xd17e52,
    curbPrimary: 0xf59e0b,
    curbSecondary: 0x1e293b,
    accentHex: 0xf59e0b,
    hemiSky: 0xfde68a,
    hemiGround: 0x5c2e1c,
    hemiIntensity: 0.82,
    sunColor: 0xffdfad,
    sunIntensity: 2.45,
    sunDirection: [100, 95, 70],
    hasWater: false,
    waterColor: 0x0c5b82,
    waterSide: 1,
    isNight: false,
    startZ: -108,
    controlPoints: [
      [0, -116],
      [0, 0],
      [0, 92],
      [62, 146],
      [152, 110],
      [174, 24],
      [104, -22],
      [164, -86],
      [118, -150],
      [34, -158],
      [0, -142],
    ],
    boostTs: [0.12, 0.44, 0.78],
  },
  silverstone_night: {
    id: 'silverstone_night',
    name: 'Silverstone Night GP',
    location: 'Northamptonshire Floodlit',
    lengthLabel: '1.72 km · 3 Laps',
    corners: 9,
    surface: 'Floodlit Grand Prix Tarmac',
    description: 'Fast flowing S-bends under stadium floodlights with high-speed nitro zones.',
    skyTopColor: 0x050914,
    skyHorizonColor: 0x16243d,
    sunDiscColor: 0xcfe8ff,
    fogColor: 0x0d1729,
    fogDensity: 0.0021,
    groundColor: 0x1d2b22,
    groundAccentColor: 0x26382b,
    dustColorHex: 0x64748b,
    curbPrimary: 0x0ea5e9,
    curbSecondary: 0xf1f5f9,
    accentHex: 0x38bdf8,
    hemiSky: 0x93c5fd,
    hemiGround: 0x0f172a,
    hemiIntensity: 0.65,
    sunColor: 0xe0f2fe,
    sunIntensity: 1.7,
    sunDirection: [60, 110, 50],
    hasWater: false,
    waterColor: 0x0c5b82,
    waterSide: 1,
    isNight: true,
    startZ: -115,
    controlPoints: [
      [0, -124],
      [0, 0],
      [0, 98],
      [-55, 154],
      [-136, 138],
      [-174, 68],
      [-108, 18],
      [-168, -46],
      [-142, -130],
      [-64, -162],
      [0, -150],
    ],
    boostTs: [0.14, 0.49, 0.82],
  },
};

export interface TrackSample {
  t: number;
  x: number;
  z: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
}

export interface BoostPad {
  x: number;
  z: number;
  radius: number;
}

export interface BuiltTrack {
  meta: TrackMetadata;
  roadHalfWidth: number;
  samples: TrackSample[];
  boostPads: BoostPad[];
  startLights: THREE.Mesh[];
  startLightMatOn: THREE.MeshStandardMaterial;
  startLightMatGreen: THREE.MeshStandardMaterial;
  startLightMatOff: THREE.MeshStandardMaterial;
  minimapPoints: Array<{ x: number; y: number }>;
  dispose: () => void;
}

function createAsphaltTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2a2e36';
  ctx.fillRect(0, 0, 512, 512);

  // Fine stone aggregate grain for realistic close-up tarmac texture
  for (let i = 0; i < 9500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 30 + Math.floor(Math.random() * 34);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(x, y, 1.8, 1.8);
  }

  // Subtle weathered tar seams
  ctx.strokeStyle = 'rgba(14, 16, 20, 0.36)';
  ctx.lineWidth = 1.5;
  for (let s = 0; s < 5; s++) {
    ctx.beginPath();
    let sx = 40 + Math.random() * 432;
    let sy = Math.random() * 512;
    ctx.moveTo(sx, sy);
    for (let k = 0; k < 5; k++) {
      sx += (Math.random() - 0.5) * 44;
      sy += 24 + Math.random() * 20;
      ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  // Darkened rubbered racing groove lanes
  const groove = ctx.createLinearGradient(0, 0, 512, 0);
  groove.addColorStop(0, 'rgba(0,0,0,0)');
  groove.addColorStop(0.24, 'rgba(10,12,16,0.34)');
  groove.addColorStop(0.5, 'rgba(10,12,16,0.12)');
  groove.addColorStop(0.76, 'rgba(10,12,16,0.34)');
  groove.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = groove;
  ctx.fillRect(0, 0, 512, 512);

  // Crisp edge white track limit lines
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(14, 0, 10, 512);
  ctx.fillRect(488, 0, 10, 512);

  // Dashed center lane line
  ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
  ctx.fillRect(253, 30, 6, 190);
  ctx.fillRect(253, 286, 6, 190);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 56);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createTerrainTexture(baseHex: number, accentHex: number, maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const base = new THREE.Color(baseHex);
  const accent = new THREE.Color(accentHex);

  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, 512, 512);

  // Organic ground variation patches + fine natural grit
  for (let i = 0; i < 650; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 6 + Math.random() * 28;
    const mix = base.clone().lerp(accent, 0.25 + Math.random() * 0.65);
    ctx.fillStyle = `rgba(${Math.round(mix.r * 255)}, ${Math.round(mix.g * 255)}, ${Math.round(mix.b * 255)}, 0.16)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(42, 42);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createWaterNormalTexture(): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const dx = Math.cos(u * 4 + v * 2) * 0.25 + Math.cos(u * 9 - v * 5) * 0.12;
      const dy = Math.sin(v * 5 + u * 3) * 0.25 + Math.sin(v * 11 + u * 2) * 0.12;
      data[idx] = Math.floor((dx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.floor((dy * 0.5 + 0.5) * 255);
      data[idx + 2] = 240;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  tex.needsUpdate = true;
  return tex;
}

function createCheckeredTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const size = 16;
  for (let y = 0; y < 64; y += size) {
    for (let x = 0; x < 256; x += size) {
      const dark = (x / size + y / size) % 2 === 0;
      ctx.fillStyle = dark ? '#0F172A' : '#F8FAFC';
      ctx.fillRect(x, y, size, size);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createCurbTexture(primary: number, secondary: number, maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const c1 = `#${primary.toString(16).padStart(6, '0')}`;
  const c2 = `#${secondary.toString(16).padStart(6, '0')}`;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? c1 : c2;
    ctx.fillRect(0, i * 32, 64, 32);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 36);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createBuildingFacadeTexture(isNight: boolean, maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = isNight ? '#1e293b' : '#cbd5e1';
  ctx.fillRect(0, 0, 256, 256);

  const cols = 6;
  const rows = 8;
  const padX = 10;
  const padY = 8;
  const winW = (256 - padX * (cols + 1)) / cols;
  const winH = (256 - padY * (rows + 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = isNight ? Math.random() > 0.45 : Math.random() > 0.25;
      if (isNight) {
        ctx.fillStyle = lit ? '#fde68a' : '#0f172a';
      } else {
        ctx.fillStyle = lit ? '#475569' : '#64748b';
      }
      ctx.fillRect(padX + c * (winW + padX), padY + r * (winH + padY), winW, winH);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function buildRibbonGeometry(
  samples: TrackSample[],
  innerOffset: number,
  outerOffset: number,
  yHeight: number
): THREE.BufferGeometry {
  const count = samples.length;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= count; i++) {
    const s = samples[i % count];
    const v = i / count;

    positions.push(s.x + s.nx * innerOffset, yHeight, s.z + s.nz * innerOffset);
    normals.push(0, 1, 0);
    uvs.push(0, v);

    positions.push(s.x + s.nx * outerOffset, yHeight, s.z + s.nz * outerOffset);
    normals.push(0, 1, 0);
    uvs.push(1, v);
  }

  for (let i = 0; i < count; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c);
    indices.push(b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export function buildTrackScene(
  scene: THREE.Scene,
  trackId: TrackId,
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean
): BuiltTrack {
  const meta = TRACK_CATALOG[trackId] || TRACK_CATALOG.monaco_harbor;
  const roadHalfWidth = 8.4;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  scene.background = new THREE.Color(meta.skyHorizonColor);
  scene.fog = new THREE.FogExp2(meta.fogColor, meta.fogDensity);

  // 0. Atmospheric Sky Dome with Realistic Horizon Gradient & Sun/Moon Disc
  const sunDirVec = new THREE.Vector3(...meta.sunDirection).normalize();
  const skyGeo = trackGeo(new THREE.SphereGeometry(920, 32, 20));
  const skyMat = trackMat(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTopColor: { value: new THREE.Color(meta.skyTopColor) },
        uHorizonColor: { value: new THREE.Color(meta.skyHorizonColor) },
        uSunColor: { value: new THREE.Color(meta.sunDiscColor) },
        uSunDir: { value: sunDirVec },
        uIsNight: { value: meta.isNight ? 1.0 : 0.0 },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform float uIsNight;
        varying vec3 vWorldDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.52));

          // Soft atmospheric horizon scatter + sun/moon glow
          float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
          col += uSunColor * pow(sunAmt, 8.0) * (uIsNight > 0.5 ? 0.16 : 0.36);
          col += uSunColor * smoothstep(0.996, 0.9992, sunAmt) * (uIsNight > 0.5 ? 0.9 : 1.15);

          // Soft cloud bands or stars
          if (uIsNight > 0.5 && h > 0.08) {
            float starCell = hash21(floor(dir.xz / max(0.18, dir.y) * 90.0));
            if (starCell > 0.994) {
              col += vec3(0.85, 0.92, 1.0) * smoothstep(0.08, 0.35, h) * 0.75;
            }
          } else if (h > 0.05) {
            float cloudWave = sin(dir.x * 9.0 + dir.z * 6.0) * cos(dir.z * 7.0 - dir.x * 4.0);
            float cloudMask = smoothstep(0.28, 0.75, cloudWave) * smoothstep(0.05, 0.28, h) * (1.0 - smoothstep(0.45, 0.85, h));
            col = mix(col, mix(uHorizonColor, vec3(1.0), 0.65), cloudMask * 0.22);
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyDome);

  const pts3 = meta.controlPoints.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts3, true, 'catmullrom', 0.45);

  const sampleCount = 480;
  const samples: TrackSample[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleCount;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const nx = -tan.z;
    const nz = tan.x;
    samples.push({ t, x: p.x, z: p.z, tx: tan.x, tz: tan.z, nx, nz });
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const s of samples) {
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.z < minZ) minZ = s.z;
    if (s.z > maxZ) maxZ = s.z;
  }
  const span = Math.max(maxX - minX, maxZ - minZ, 1);
  const minimapPoints: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < sampleCount; i += 6) {
    const s = samples[i];
    minimapPoints.push({
      x: 10 + ((s.x - minX) / span) * 80,
      y: 10 + ((s.z - minZ) / span) * 80,
    });
  }

  // 1. Extended Procedural PBR Ground Terrain (never boxed in an empty void)
  const terrainTex = trackTex(createTerrainTexture(meta.groundColor, meta.groundAccentColor, maxAniso));
  const groundGeo = trackGeo(new THREE.CircleGeometry(1400, 64));
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: terrainTex,
      roughness: 0.92,
      metalness: 0.03,
    })
  );
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.y = -0.05;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Shimmering Coastal Sea / Lagoon Water Plane for Coastal Circuits
  if (meta.hasWater) {
    const waterNormals = trackTex(createWaterNormalTexture());
    const waterGeo = trackGeo(new THREE.PlaneGeometry(1800, 2200));
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: meta.waterColor,
        normalMap: waterNormals,
        normalScale: new THREE.Vector2(0.35, 0.35),
        roughness: 0.14,
        metalness: 0.24,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      })
    );
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    // Place ocean/lagoon on the open coastal side of the circuit
    const waterOffsetX =
      trackId === 'monaco_harbor'
        ? 915
        : trackId === 'ibiza_coast'
        ? 1095
        : trackId === 'lagos_island'
        ? 915
        : -915;
    waterMesh.position.set(waterOffsetX, -0.02, 0);
    waterMesh.receiveShadow = true;
    scene.add(waterMesh);

    // Coastal seawall / promenade edge separating land & water
    const wallGeo = trackGeo(new THREE.BoxGeometry(2.2, 0.65, 920));
    const wallMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd6d3d1,
        roughness: 0.78,
        metalness: 0.05,
      })
    );
    const seawall = new THREE.Mesh(wallGeo, wallMat);
    const wallX =
      trackId === 'monaco_harbor'
        ? 15
        : trackId === 'ibiza_coast'
        ? 195
        : trackId === 'lagos_island'
        ? 16
        : -16;
    seawall.position.set(wallX, 0.25, 0);
    seawall.receiveShadow = true;
    scene.add(seawall);
  }

  // 2. Main Asphalt Track Ribbon
  const asphaltTex = trackTex(createAsphaltTexture(maxAniso));
  const roadGeo = trackGeo(buildRibbonGeometry(samples, -roadHalfWidth, roadHalfWidth, 0.01));
  const roadMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.74,
      metalness: 0.06,
    })
  );
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);

  // 3. FIA Apex Kerbs
  const curbTex = trackTex(createCurbTexture(meta.curbPrimary, meta.curbSecondary, maxAniso));
  const curbMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: curbTex,
      roughness: 0.65,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const leftCurbGeo = trackGeo(buildRibbonGeometry(samples, roadHalfWidth, roadHalfWidth + 1.35, 0.025));
  const rightCurbGeo = trackGeo(buildRibbonGeometry(samples, -roadHalfWidth - 1.35, -roadHalfWidth, 0.025));
  scene.add(new THREE.Mesh(leftCurbGeo, curbMat), new THREE.Mesh(rightCurbGeo, curbMat));

  // 4. Outer & Inner Steel Guardrails
  const railPostGeo = trackGeo(new THREE.BoxGeometry(0.35, 0.95, 2.8));
  const railMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.72,
      roughness: 0.32,
    })
  );

  const railSteps = 160;
  const railInstanced = new THREE.InstancedMesh(railPostGeo, railMat, railSteps * 2);
  railInstanced.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let rIdx = 0;
  for (let i = 0; i < railSteps; i++) {
    const s = samples[Math.floor((i / railSteps) * sampleCount)];
    const angle = Math.atan2(s.tx, s.tz);
    for (const side of [-1, 1]) {
      const dist = roadHalfWidth + 2.2;
      dummy.position.set(s.x + s.nx * dist * side, 0.46, s.z + s.nz * dist * side);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      railInstanced.setMatrixAt(rIdx++, dummy.matrix);
    }
  }
  railInstanced.computeBoundingSphere();
  scene.add(railInstanced);

  // 5. Checkered Start/Finish Line & Overhead Starting Gantry
  const startSample = samples[0];
  const checkerTex = trackTex(createCheckeredTexture(maxAniso));
  const finishGeo = trackGeo(new THREE.PlaneGeometry(roadHalfWidth * 2, 3.2));
  finishGeo.rotateX(-Math.PI / 2);
  const finishMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: checkerTex,
      roughness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  const finishLine = new THREE.Mesh(finishGeo, finishMat);
  finishLine.position.set(startSample.x, 0.035, meta.startZ + 8);
  scene.add(finishLine);

  const gantryGroup = new THREE.Group();
  gantryGroup.position.set(startSample.x, 0, meta.startZ + 8);
  const pillarGeo = trackGeo(new THREE.BoxGeometry(1.1, 7.6, 1.1));
  const beamGeo = trackGeo(new THREE.BoxGeometry(roadHalfWidth * 2 + 5.2, 1.4, 1.2));
  const gantryMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.72,
      roughness: 0.3,
    })
  );

  const leftPillar = new THREE.Mesh(pillarGeo, gantryMat);
  leftPillar.position.set(roadHalfWidth + 2.1, 3.8, 0);
  const rightPillar = new THREE.Mesh(pillarGeo, gantryMat);
  rightPillar.position.set(-(roadHalfWidth + 2.1), 3.8, 0);
  const topBeam = new THREE.Mesh(beamGeo, gantryMat);
  topBeam.position.set(0, 7.1, 0);
  gantryGroup.add(leftPillar, rightPillar, topBeam);

  const lightBulbGeo = trackGeo(new THREE.SphereGeometry(0.42, 14, 14));
  const startLightMatOff = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      emissive: 0x000000,
      roughness: 0.3,
    })
  );
  const startLightMatOn = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    })
  );
  const startLightMatGreen = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    })
  );

  const startLights: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const bulb = new THREE.Mesh(lightBulbGeo, startLightMatOff);
    bulb.position.set(-4.4 + i * 2.2, 7.1, -0.62);
    gantryGroup.add(bulb);
    startLights.push(bulb);
  }
  scene.add(gantryGroup);

  // 6. Track Boost Pads (Speed Strips)
  const boostPads: BoostPad[] = [];
  const boostGeo = trackGeo(new THREE.PlaneGeometry(4.2, 7.2));
  boostGeo.rotateX(-Math.PI / 2);
  const boostMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.35,
      roughness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );

  for (const t of meta.boostTs) {
    const idx = Math.floor(t * sampleCount) % sampleCount;
    const s = samples[idx];
    const pad = new THREE.Mesh(boostGeo, boostMat);
    pad.position.set(s.x, 0.032, s.z);
    pad.rotation.y = Math.atan2(s.tx, s.tz);
    scene.add(pad);
    boostPads.push({ x: s.x, z: s.z, radius: 4.5 });
  }

  // 7. Realistic Location-Specific Palm Trees, Architecture & Signature Landmarks
  const colorHelper = new THREE.Color();

  // Instanced Palm Trees for Coastal Cities (Monaco, Ibiza, Lagos, Los Angeles)
  if (
    trackId === 'monaco_harbor' ||
    trackId === 'ibiza_coast' ||
    trackId === 'lagos_island' ||
    trackId === 'los_angeles_sunset'
  ) {
    const palmCount = 54;
    const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.36, 9.5, 7));
    trunkGeo.translate(0, 4.75, 0);
    const trunkMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x7c5b3e,
        roughness: 0.9,
        metalness: 0.02,
      })
    );
    const frondGeo = trackGeo(new THREE.ConeGeometry(3.4, 2.2, 6));
    frondGeo.translate(0, 9.6, 0);
    const frondMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x2f7d32,
        roughness: 0.78,
        metalness: 0.02,
      })
    );

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
    const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmCount);
    trunks.castShadow = !isSoftwareGl;
    fronds.castShadow = !isSoftwareGl;

    for (let i = 0; i < palmCount; i++) {
      const s = samples[Math.floor(((i + 0.35) / palmCount) * sampleCount) % sampleCount];
      const side = i % 2 === 0 ? 1 : -1;
      const offset = roadHalfWidth + 6.5 + (i % 3) * 3.5;
      const px = s.x + s.nx * offset * side;
      const pz = s.z + s.nz * offset * side;
      const scaleH = trackId === 'los_angeles_sunset' ? 1.15 + (i % 4) * 0.14 : 0.85 + (i % 4) * 0.11;

      dummy.position.set(px, 0, pz);
      dummy.rotation.set((i % 3) * 0.04, i * 1.1, ((i % 2) - 0.5) * 0.05);
      dummy.scale.set(0.95, scaleH, 0.95);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      fronds.setMatrixAt(i, dummy.matrix);

      colorHelper.setHex(i % 2 === 0 ? 0x2e7d32 : 0x3b8c3f);
      fronds.setColorAt(i, colorHelper);
    }
    trunks.computeBoundingSphere();
    fronds.computeBoundingSphere();
    scene.add(trunks, fronds);
  }

  // City Architecture / Canyon Cliffs / Floodlights
  const facadeTex = trackTex(createBuildingFacadeTexture(meta.isNight, maxAniso));
  if (trackId === 'redrock_canyon') {
    const mesaGeo = trackGeo(new THREE.CylinderGeometry(8, 16, 26, 7));
    mesaGeo.translate(0, 13, 0);
    const mesaMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x9a4a2b,
        roughness: 0.9,
        metalness: 0.04,
      })
    );
    const mesaCount = 38;
    const mesas = new THREE.InstancedMesh(mesaGeo, mesaMat, mesaCount);
    mesas.castShadow = !isSoftwareGl;
    for (let i = 0; i < mesaCount; i++) {
      const s = samples[Math.floor((i / mesaCount) * sampleCount)];
      const side = i % 2 === 0 ? 1 : -1;
      const offset = roadHalfWidth + 28 + (i % 3) * 16;
      const hScale = 0.75 + ((i * 23) % 10) * 0.09;
      dummy.position.set(s.x + s.nx * offset * side, -0.05, s.z + s.nz * offset * side);
      dummy.rotation.set(0, i * 0.8, 0);
      dummy.scale.set(0.9 + (i % 3) * 0.25, hScale, 0.9 + (i % 4) * 0.2);
      dummy.updateMatrix();
      mesas.setMatrixAt(i, dummy.matrix);
      colorHelper.setHex(i % 2 === 0 ? 0xa34f2f : 0x7c361e);
      mesas.setColorAt(i, colorHelper);
    }
    mesas.computeBoundingSphere();
    scene.add(mesas);
  } else if (trackId === 'silverstone_night') {
    const towerCount = 36;
    const poleGeo = trackGeo(new THREE.CylinderGeometry(0.35, 0.55, 18, 8));
    poleGeo.translate(0, 9, 0);
    const poleMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.75, roughness: 0.3 }));
    const headGeo = trackGeo(new THREE.BoxGeometry(3.4, 1.4, 0.8));
    const headMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xe0f2fe,
        emissiveIntensity: 2.0,
      })
    );
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, towerCount);
    const heads = new THREE.InstancedMesh(headGeo, headMat, towerCount);
    for (let i = 0; i < towerCount; i++) {
      const s = samples[Math.floor((i / towerCount) * sampleCount)];
      const side = i % 2 === 0 ? 1 : -1;
      const offset = roadHalfWidth + 10;
      const angle = Math.atan2(s.tx, s.tz);
      dummy.position.set(s.x + s.nx * offset * side, 0, s.z + s.nz * offset * side);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);

      dummy.position.y = 18;
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
    }
    poles.computeBoundingSphere();
    heads.computeBoundingSphere();
    scene.add(poles, heads);
  } else {
    // Realistic City Skyline / Riviera / Balearic Villas (Monaco, Ibiza, Lagos, Los Angeles)
    const bCount = 46;
    const bGeo = trackGeo(new THREE.BoxGeometry(10, 26, 10));
    bGeo.translate(0, 13, 0);
    const bMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: facadeTex,
        roughness: trackId === 'lagos_island' || trackId === 'los_angeles_sunset' ? 0.25 : 0.65,
        metalness: trackId === 'lagos_island' || trackId === 'los_angeles_sunset' ? 0.55 : 0.15,
      })
    );
    const buildings = new THREE.InstancedMesh(bGeo, bMat, bCount);
    buildings.castShadow = !isSoftwareGl;

    for (let i = 0; i < bCount; i++) {
      const s = samples[Math.floor((i / bCount) * sampleCount)];
      // Place buildings inland (away from the ocean/lagoon edge)
      const landSide = trackId === 'monaco_harbor' ? -1 : trackId === 'los_angeles_sunset' ? 1 : -1;
      const side = i % 3 === 0 ? -landSide : landSide;
      const offset = roadHalfWidth + 24 + (i % 4) * 14;
      const bx = s.x + s.nx * offset * side;
      // Keep buildings off the water side
      if (trackId === 'monaco_harbor' && bx > 8) continue;
      if (trackId === 'ibiza_coast' && bx > 186) continue;
      if (trackId === 'lagos_island' && bx > 8) continue;
      if (trackId === 'los_angeles_sunset' && bx < -8) continue;

      const bz = s.z + s.nz * offset * side;
      const hScale =
        trackId === 'ibiza_coast'
          ? 0.35 + (i % 3) * 0.16 // Low whitewashed villas
          : trackId === 'los_angeles_sunset' || trackId === 'lagos_island'
          ? 0.9 + (i % 5) * 0.45 // Tall skyline towers
          : 0.65 + (i % 4) * 0.28;

      dummy.position.set(bx, 0, bz);
      dummy.rotation.set(0, (i * 0.65) % Math.PI, 0);
      dummy.scale.set(0.9 + (i % 3) * 0.22, hScale, 0.9 + (i % 2) * 0.28);
      dummy.updateMatrix();
      buildings.setMatrixAt(i, dummy.matrix);

      if (trackId === 'ibiza_coast') {
        colorHelper.setHex(i % 2 === 0 ? 0xf8fafc : 0xfef3c7);
      } else if (trackId === 'lagos_island') {
        colorHelper.setHex(i % 2 === 0 ? 0xcbd5e1 : 0x94a3b8);
      } else if (trackId === 'los_angeles_sunset') {
        colorHelper.setHex(i % 2 === 0 ? 0xe2e8f0 : 0x94a3b8);
      } else {
        colorHelper.setHex(i % 2 === 0 ? 0xe2e8f0 : 0xcbd5e1);
      }
      buildings.setColorAt(i, colorHelper);
    }
    buildings.computeBoundingSphere();
    scene.add(buildings);
  }

  // Iconic Location Hero Props:
  // A. Lagos Lagoon Cable-Stayed Twin-Pylon Bridge Landmark
  if (trackId === 'lagos_island') {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(42, 0, 15);
    const pylonMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45, metalness: 0.15 }));
    const cableMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.8 }));
    const pylonGeo = trackGeo(new THREE.BoxGeometry(2.6, 52, 3.2));
    const deckGeo = trackGeo(new THREE.BoxGeometry(18, 1.8, 220));
    const deckMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 }));

    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(0, 6.5, 0);
    bridgeGroup.add(deck);

    for (const pz of [-22, 22]) {
      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.set(0, 26, pz);
      pylon.castShadow = !isSoftwareGl;
      bridgeGroup.add(pylon);

      for (const czOffset of [-55, -35, -16, 16, 35, 55]) {
        const len = Math.hypot(42, czOffset);
        const cableGeo = trackGeo(new THREE.CylinderGeometry(0.12, 0.12, len, 6));
        const cable = new THREE.Mesh(cableGeo, cableMat);
        cable.position.set(0, 27, pz + czOffset * 0.5);
        cable.rotation.x = Math.atan2(czOffset, 42);
        bridgeGroup.add(cable);
      }
    }
    scene.add(bridgeGroup);
  }

  // B. Docked Coastal Yachts on Water (Monaco Harbor & Ibiza Coast)
  if (trackId === 'monaco_harbor' || trackId === 'ibiza_coast') {
    const hullGeo = trackGeo(new THREE.BoxGeometry(4.4, 2.2, 13.5));
    const cabinGeo = trackGeo(new THREE.BoxGeometry(3.2, 2.1, 6.5));
    const yachtWhite = trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.12 }));
    const yachtGlass = trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.6 }));

    const yachtPositions =
      trackId === 'monaco_harbor'
        ? [
            [36, -65],
            [44, -18],
            [38, 34],
            [52, 78],
          ]
        : [
            [216, -42],
            [225, 18],
            [218, 76],
          ];
    for (const [yx, yz] of yachtPositions) {
      const yGroup = new THREE.Group();
      yGroup.position.set(yx, 0.85, yz);
      yGroup.rotation.y = 0.15;
      const hull = new THREE.Mesh(hullGeo, yachtWhite);
      const cabin = new THREE.Mesh(cabinGeo, yachtGlass);
      cabin.position.set(0, 1.8, -0.8);
      yGroup.add(hull, cabin);
      scene.add(yGroup);
    }
  }

  return {
    meta,
    roadHalfWidth,
    samples,
    boostPads,
    startLights,
    startLightMatOn,
    startLightMatGreen,
    startLightMatOff,
    minimapPoints,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
