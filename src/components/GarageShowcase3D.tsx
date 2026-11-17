import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRaceCar, type RaceCarRig } from '../game/carModel';
import { detectSoftwareWebGL, scheduleAfterSoftwareDraw } from '../game/webglSupport';
import { CAR_CATALOG, LIVERY_CATALOG, type CarId, type LiveryId } from '../types/racing';

interface GarageShowcase3DProps {
  carId: CarId;
  liveryId: LiveryId;
}

export function GarageShowcase3D({ carId, liveryId }: GarageShowcase3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const carRef = useRef<CarId>(carId);
  const liveryRef = useRef<LiveryId>(liveryId);
  const rebuildCarRef = useRef<((nextCar: CarId, nextLivery: LiveryId) => void) | null>(null);

  useEffect(() => {
    carRef.current = carId;
    liveryRef.current = liveryId;
    rebuildCarRef.current?.(carId, liveryId);
  }, [carId, liveryId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setContextLost(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || 640, container.clientHeight || 360);
    renderer.domElement.className = 'w-full h-full block';

    const handleLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleRestored = () => setContextLost(false);
    renderer.domElement.addEventListener('webglcontextlost', handleLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleRestored);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f151e);
    scene.fog = new THREE.FogExp2(0x0f151e, 0.032);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      38,
      (container.clientWidth || 640) / (container.clientHeight || 360),
      0.1,
      100
    );
    camera.position.set(4.5, 2.25, 5.1);
    camera.lookAt(0, 0.6, 0);

    // Three-Point Studio Lighting Rig
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.72);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.25);
    keyLight.position.set(5, 8, 6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
    rimLight.position.set(-6, 4, -5);
    scene.add(rimLight);

    // Showroom Floor & Turntable Disc
    const floorGeo = new THREE.CircleGeometry(28, 48);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0b0f14,
      roughness: 0.72,
      metalness: 0.25,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    scene.add(floor);

    const plinthGeo = new THREE.CylinderGeometry(3.2, 3.35, 0.08, 48);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x18212f,
      roughness: 0.35,
      metalness: 0.78,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -0.04;
    plinth.receiveShadow = true;
    scene.add(plinth);

    const ringGeo = new THREE.RingGeometry(3.12, 3.22, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.005;
    scene.add(ring);

    const turntable = new THREE.Group();
    scene.add(turntable);

    let carRig: RaceCarRig = createRaceCar(liveryRef.current, isSoftwareGl, carRef.current);
    turntable.add(carRig.root);

    rebuildCarRef.current = (nextCar: CarId, nextLivery: LiveryId) => {
      turntable.remove(carRig.root);
      carRig.dispose();
      carRig = createRaceCar(nextLivery, isSoftwareGl, nextCar);
      turntable.add(carRig.root);
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    let disposed = false;
    let rafId = 0;
    let timerId = 0;
    const clock = new THREE.Clock();

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.08);
      const elapsedSec = clock.elapsedTime;
      turntable.rotation.y += dt * 0.42;
      for (const w of carRig.wheelMeshes) {
        w.rotation.x += dt * 1.4;
      }
      // Subtle playful cartoon character idle gaze + engine bounce
      const idleGlance = Math.sin(elapsedSec * 1.15) * 0.45;
      carRig.updateAnimation({
        steerRatio: idleGlance,
        speed: 0,
        nitroActive: false,
        braking: false,
        dt,
        elapsedSec,
      });

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        scheduleAfterSoftwareDraw(
          renderer,
          (id) => {
            timerId = id;
          },
          tick
        );
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleRestored);
      carRig.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      plinthGeo.dispose();
      plinthMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const carSpec = CAR_CATALOG[carId] || CAR_CATALOG.ferrari_488;
  const liveryInfo = LIVERY_CATALOG[liveryId] || LIVERY_CATALOG.crimson_apex;

  return (
    <div className="relative w-full h-full min-h-[260px] rounded-xl overflow-hidden bg-[#0F151E] border border-white/10">
      <div ref={containerRef} className="w-full h-full" />
      {contextLost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0F151E] to-[#1A2230] p-6 text-center">
          <div
            className="w-12 h-12 rounded-full mb-3 border border-white/20"
            style={{ backgroundColor: liveryInfo.swatch }}
          />
          <p className="font-display text-lg font-semibold text-white">{carSpec.name}</p>
          <p className="text-xs text-slate-400 mt-1">{liveryInfo.name} · 3D Garage Preview paused</p>
        </div>
      )}
      <div className="pointer-events-none absolute top-3 left-3 px-2.5 py-1 rounded bg-[#0B0F14]/85 border border-white/10 text-xs text-slate-200 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: liveryInfo.swatch }} />
        <span className="font-semibold">{carSpec.name}</span>
        <span className="text-slate-500">·</span>
        <span className="text-slate-400">{liveryInfo.name}</span>
      </div>
    </div>
  );
}
