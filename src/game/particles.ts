import * as THREE from 'three';

const MAX_PARTICLES = 280;

let cachedPuffTex: THREE.CanvasTexture | null = null;

function getSoftPuffTexture(): THREE.CanvasTexture {
  if (cachedPuffTex) return cachedPuffTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.48)');
  grad.addColorStop(0.78, 'rgba(255, 255, 255, 0.14)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedPuffTex = tex;
  return tex;
}

export interface RaceParticleSystem {
  emitDriftSmoke: (
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number,
    intensity: number
  ) => void;
  emitOffTrackDust: (
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number,
    colorHex: number,
    intensity: number
  ) => void;
  emitNitroVapor: (x: number, y: number, z: number, fwdX: number, fwdZ: number) => void;
  emitCollisionSparks: (x: number, y: number, z: number, intensity: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

const _tmpColor = new THREE.Color();

export function createRaceParticles(scene: THREE.Scene): RaceParticleSystem {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const sizes = new Float32Array(MAX_PARTICLES);
  const alphas = new Float32Array(MAX_PARTICLES);

  // Per-particle CPU pool arrays (pre-allocated, zero GC per frame)
  const vxArr = new Float32Array(MAX_PARTICLES);
  const vyArr = new Float32Array(MAX_PARTICLES);
  const vzArr = new Float32Array(MAX_PARTICLES);
  const ageArr = new Float32Array(MAX_PARTICLES);
  const lifeArr = new Float32Array(MAX_PARTICLES);
  const startSizeArr = new Float32Array(MAX_PARTICLES);
  const endSizeArr = new Float32Array(MAX_PARTICLES);
  const peakAlphaArr = new Float32Array(MAX_PARTICLES);

  for (let i = 0; i < MAX_PARTICLES; i++) {
    positions[i * 3 + 1] = -999;
    lifeArr[i] = 0;
  }

  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  const colAttr = new THREE.BufferAttribute(colors, 3);
  const sizeAttr = new THREE.BufferAttribute(sizes, 1);
  const alphaAttr = new THREE.BufferAttribute(alphas, 1);

  posAttr.setUsage(THREE.DynamicDrawUsage);
  colAttr.setUsage(THREE.DynamicDrawUsage);
  sizeAttr.setUsage(THREE.DynamicDrawUsage);
  alphaAttr.setUsage(THREE.DynamicDrawUsage);

  geometry.setAttribute('position', posAttr);
  geometry.setAttribute('aColor', colAttr);
  geometry.setAttribute('aSize', sizeAttr);
  geometry.setAttribute('aAlpha', alphaAttr);

  const puffTex = getSoftPuffTexture();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: puffTex },
      uPixelScale: { value: 260 },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      attribute vec3 aColor;
      varying float vAlpha;
      varying vec3 vColor;
      uniform float uPixelScale;

      void main() {
        vAlpha = aAlpha;
        vColor = aColor;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = max(1.2, -mvPosition.z);
        gl_PointSize = clamp(aSize * (uPixelScale / dist), 1.0, 96.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        if (vAlpha <= 0.005) discard;
        vec4 tex = texture2D(uMap, gl_PointCoord);
        float alpha = tex.a * vAlpha;
        if (alpha <= 0.005) discard;
        gl_FragColor = vec4(vColor * tex.rgb, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 4;
  scene.add(points);

  let cursor = 0;

  const spawn = (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    r: number,
    g: number,
    b: number,
    startSize: number,
    endSize: number,
    peakAlpha: number,
    life: number
  ) => {
    const i = cursor;
    cursor = (cursor + 1) % MAX_PARTICLES;

    const i3 = i * 3;
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    colors[i3] = r;
    colors[i3 + 1] = g;
    colors[i3 + 2] = b;

    vxArr[i] = vx;
    vyArr[i] = vy;
    vzArr[i] = vz;
    ageArr[i] = 0;
    lifeArr[i] = life;
    startSizeArr[i] = startSize;
    endSizeArr[i] = endSize;
    peakAlphaArr[i] = peakAlpha;
    sizes[i] = startSize;
    alphas[i] = 0;
  };

  return {
    emitDriftSmoke(x, y, z, vx, vz, intensity) {
      const clamped = Math.min(1, Math.max(0.15, intensity));
      const shade = 0.86 + Math.random() * 0.1;
      spawn(
        x + (Math.random() - 0.5) * 0.28,
        y + 0.08 + Math.random() * 0.06,
        z + (Math.random() - 0.5) * 0.28,
        vx * 0.12 + (Math.random() - 0.5) * 1.1,
        0.55 + Math.random() * 0.55,
        vz * 0.12 + (Math.random() - 0.5) * 1.1,
        shade,
        shade,
        Math.min(1, shade + 0.03),
        0.55 + clamped * 0.35,
        2.1 + clamped * 1.4,
        0.18 + clamped * 0.2,
        0.52 + Math.random() * 0.3
      );
    },

    emitOffTrackDust(x, y, z, vx, vz, colorHex, intensity) {
      const clamped = Math.min(1, Math.max(0.2, intensity));
      _tmpColor.setHex(colorHex);
      const jitter = 0.9 + Math.random() * 0.18;
      spawn(
        x + (Math.random() - 0.5) * 0.36,
        y + 0.08 + Math.random() * 0.08,
        z + (Math.random() - 0.5) * 0.36,
        vx * 0.16 + (Math.random() - 0.5) * 1.8,
        0.75 + Math.random() * 0.85,
        vz * 0.16 + (Math.random() - 0.5) * 1.8,
        Math.min(1, _tmpColor.r * jitter),
        Math.min(1, _tmpColor.g * jitter),
        Math.min(1, _tmpColor.b * jitter),
        0.65 + clamped * 0.4,
        2.5 + clamped * 1.5,
        0.24 + clamped * 0.24,
        0.48 + Math.random() * 0.32
      );
    },

    emitNitroVapor(x, y, z, fwdX, fwdZ) {
      const warm = Math.random() > 0.35;
      spawn(
        x + (Math.random() - 0.5) * 0.18,
        y + (Math.random() - 0.5) * 0.1,
        z + (Math.random() - 0.5) * 0.18,
        -fwdX * (2.5 + Math.random() * 2) + (Math.random() - 0.5) * 0.7,
        0.25 + Math.random() * 0.35,
        -fwdZ * (2.5 + Math.random() * 2) + (Math.random() - 0.5) * 0.7,
        warm ? 0.45 : 0.98,
        warm ? 0.85 : 0.72,
        warm ? 1.0 : 0.32,
        0.42,
        1.15,
        0.28,
        0.24 + Math.random() * 0.12
      );
    },

    emitCollisionSparks(x, y, z, intensity) {
      const count = Math.max(4, Math.min(12, Math.round(4 + intensity * 8)));
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3.5 + Math.random() * 6.5 * Math.max(0.5, intensity);
        const hot = Math.random() > 0.35;
        spawn(
          x + (Math.random() - 0.5) * 0.4,
          y + 0.35 + Math.random() * 0.3,
          z + (Math.random() - 0.5) * 0.4,
          Math.cos(angle) * speed,
          1.8 + Math.random() * 3.8,
          Math.sin(angle) * speed,
          1.0,
          hot ? 0.72 + Math.random() * 0.25 : 0.38,
          hot ? 0.22 : 0.08,
          0.32 + intensity * 0.16,
          0.08,
          0.95,
          0.22 + Math.random() * 0.18
        );
      }
    },

    update(dt) {
      let anyActive = false;
      const drag = Math.max(0, 1 - 1.6 * dt);

      for (let i = 0; i < MAX_PARTICLES; i++) {
        const life = lifeArr[i];
        if (life <= 0) continue;

        ageArr[i] += dt;
        const age = ageArr[i];
        if (age >= life) {
          lifeArr[i] = 0;
          alphas[i] = 0;
          positions[i * 3 + 1] = -999;
          anyActive = true;
          continue;
        }

        anyActive = true;
        const i3 = i * 3;
        positions[i3] += vxArr[i] * dt;
        positions[i3 + 1] += vyArr[i] * dt;
        positions[i3 + 2] += vzArr[i] * dt;

        vxArr[i] *= drag;
        vzArr[i] *= drag;
        vyArr[i] = Math.max(0.15, vyArr[i] - 0.35 * dt);

        const p = age / life;
        // Soft quick rise (0..0.18) then smooth cubic fade out
        const fade = p < 0.18 ? p / 0.18 : Math.pow(1 - (p - 0.18) / 0.82, 1.45);
        alphas[i] = peakAlphaArr[i] * fade;
        sizes[i] = startSizeArr[i] + (endSizeArr[i] - startSizeArr[i]) * Math.pow(p, 0.75);
      }

      if (anyActive) {
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;
        alphaAttr.needsUpdate = true;
      }
    },

    dispose() {
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    },
  };
}
