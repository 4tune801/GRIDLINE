import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Camera, Flag, Gamepad2, Maximize2, Minimize2, RotateCcw, RotateCw, Smartphone, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { engineAudio } from '../audio/engineSound';
import { createRaceCar, type RaceCarRig } from '../game/carModel';
import { createRaceParticles } from '../game/particles';
import { buildTrackScene, TRACK_CATALOG, type BuiltTrack } from '../game/tracks';
import { detectSoftwareWebGL, scheduleAfterSoftwareDraw } from '../game/webglSupport';
import { SteeringWheelControl } from './SteeringWheelControl';
import type { CarId, DriverTelemetry, DuelRoom, RaceFinishedEvent, RoomPlayer } from '../types/racing';

interface RaceViewport3DProps {
  room: DuelRoom;
  currentUid: string;
  opponentsTelemetry: Record<string, DriverTelemetry>;
  finishedEvent: RaceFinishedEvent | null;
  onSendTelemetry: (telemetry: DriverTelemetry) => void;
  onForfeit: () => void;
  onRematch: () => void;
  onLeaveRoom: () => void;
}

type CameraMode = 'chase' | 'hood' | 'wide';

interface HudSnapshot {
  speedKmh: number;
  nitroPct: number;
  lap: number;
  position: number;
  totalPlayers: number;
  gapSeconds: number;
  elapsedMs: number;
  boostFlash: boolean;
  isSpeedSurging: boolean;
  collisionSeq: number;
}

const OPPONENT_COLORS = ['#38BDF8', '#A855F7', '#34D399'];

function getGridStartCoords(slotIndex: number, startZ: number): { x: number; z: number } {
  return {
    x: slotIndex % 2 === 0 ? -2.8 : 2.8,
    z: startZ - (slotIndex >= 2 ? 6.5 : 0),
  };
}

function formatOrdinal(pos: number): string {
  if (pos === 1) return '1ST';
  if (pos === 2) return '2ND';
  if (pos === 3) return '3RD';
  return `${pos}TH`;
}

const _camPosTarget = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();

function formatRaceTime(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const mins = Math.floor(safe / 60000);
  const secs = Math.floor((safe % 60000) / 1000);
  const hundredths = Math.floor((safe % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export function RaceViewport3D({
  room,
  currentUid,
  opponentsTelemetry,
  finishedEvent,
  onSendTelemetry,
  onForfeit,
  onRematch,
  onLeaveRoom,
}: RaceViewport3DProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [muted, setMuted] = useState(engineAudio.isMuted());
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [contextLost, setContextLost] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
  });
  const [showTouchControls, setShowTouchControls] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
  });
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>(() =>
    typeof window === 'undefined'
      ? { width: 1280, height: 720 }
      : { width: window.innerWidth, height: window.innerHeight }
  );
  const [rotateHintDismissed, setRotateHintDismissed] = useState(false);
  const [horizontalMode, setHorizontalMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
  });
  const [horizontalFlip, setHorizontalFlip] = useState(false);
  const [tiltSteerEnabled, setTiltSteerEnabled] = useState(false);
  const [pressedControls, setPressedControls] = useState({
    up: false,
    down: false,
    nitro: false,
  });
  const [collisionShakeActive, setCollisionShakeActive] = useState(false);
  const [minimapSvg, setMinimapSvg] = useState<{
    pathD: string;
    localPt: { x: number; y: number };
    oppPts: Array<{ uid: string; x: number; y: number; color: string }>;
  }>({
    pathD: '',
    localPt: { x: 50, y: 50 },
    oppPts: [],
  });

  const [hud, setHud] = useState<HudSnapshot>({
    speedKmh: 0,
    nitroPct: 100,
    lap: 1,
    position: 1,
    totalPlayers: Math.max(2, room.players.length),
    gapSeconds: 0,
    elapsedMs: 0,
    boostFlash: false,
    isSpeedSurging: false,
    collisionSeq: 0,
  });

  // Refs for stable WebGL loop (prevents React re-renders from tearing down Three.js)
  const roomRef = useRef(room);
  roomRef.current = room;
  const oppTelemetryRef = useRef(opponentsTelemetry);
  oppTelemetryRef.current = opponentsTelemetry;
  const cameraModeRef = useRef<CameraMode>(cameraMode);
  cameraModeRef.current = cameraMode;
  const onSendTelemetryRef = useRef(onSendTelemetry);
  onSendTelemetryRef.current = onSendTelemetry;
  const tiltSteerRef = useRef(0);
  const wheelSteerRef = useRef({ active: false, value: 0 });
  const visualSteerRef = useRef(0);

  // Input ref shared between keyboard, touch steering wheel/pedals, and optional tilt steering
  const keysRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    nitro: false,
  });

  const activePointersRef = useRef<{
    up: Set<number>;
    down: Set<number>;
    nitro: Set<number>;
  }>({
    up: new Set(),
    down: new Set(),
    nitro: new Set(),
  });

  const localPlayer = room.players.find((p) => p.uid === currentUid) || room.players[0];
  const opponentPlayers: RoomPlayer[] = room.players.filter((p) => p.uid !== currentUid);

  const isPortrait = viewportSize.height > viewportSize.width;
  const isCssRotated = horizontalMode && isPortrait;
  const effectiveWidth = isCssRotated ? viewportSize.height : viewportSize.width;
  const effectiveHeight = isCssRotated ? viewportSize.width : viewportSize.height;
  const effectivePortrait = effectiveHeight > effectiveWidth;
  const isCompactLandscape = !effectivePortrait && effectiveHeight <= 520;
  const canUseFullscreen =
    typeof document !== 'undefined' &&
    Boolean(document.fullscreenEnabled || (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled);

  const releaseAllTouchControls = useCallback(() => {
    const sets = activePointersRef.current;
    (['up', 'down', 'nitro'] as const).forEach((control) => {
      sets[control].clear();
      keysRef.current[control] = false;
    });
    wheelSteerRef.current.active = false;
    wheelSteerRef.current.value = 0;
    setPressedControls({ up: false, down: false, nitro: false });
  }, []);

  const handleWheelSteerChange = useCallback((steer: number, active: boolean) => {
    wheelSteerRef.current.value = steer;
    wheelSteerRef.current.active = active;
  }, []);

  const handleTouchControlDown = useCallback(
    (control: 'up' | 'down' | 'nitro', e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported
      }
      if (e.pointerType === 'touch') {
        setIsTouchDevice(true);
      }
      activePointersRef.current[control].add(e.pointerId);
      keysRef.current[control] = true;
      setPressedControls((prev) => (prev[control] ? prev : { ...prev, [control]: true }));
    },
    []
  );

  const handleTouchControlUp = useCallback(
    (control: 'up' | 'down' | 'nitro', e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      activePointersRef.current[control].delete(e.pointerId);
      const stillHeld = activePointersRef.current[control].size > 0;
      keysRef.current[control] = stillHeld;
      setPressedControls((prev) => (prev[control] === stillHeld ? prev : { ...prev, [control]: stillHeld }));
    },
    []
  );

  const toggleFullscreen = useCallback(async () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const el = (viewportRef.current?.parentElement || viewportRef.current) as (HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    }) | null;
    if (!el) return;

    const currentlyFullscreen = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
    try {
      if (currentlyFullscreen) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
        try {
          (screen.orientation as ScreenOrientation & { unlock?: () => void })?.unlock?.();
        } catch {
          // Orientation unlock not supported
        }
      } else {
        if (canUseFullscreen) {
          if (el.requestFullscreen) {
            await el.requestFullscreen({ navigationUI: 'hide' }).catch(() => el.requestFullscreen());
          } else if (el.webkitRequestFullscreen) {
            await el.webkitRequestFullscreen();
          }
        }
        if (isTouchDevice) {
          try {
            await (
              screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> }
            )?.lock?.('landscape');
          } catch {
            // Browser/OS may disallow orientation lock; CSS horizontal mode handles portrait-locked phones
          }
        }
      }
    } catch {
      // Fallback: keep CSS horizontal / full-dvh layout active
    }
  }, [canUseFullscreen, isTouchDevice]);

  const toggleHorizontalMode = useCallback(async () => {
    const next = !horizontalMode;
    setHorizontalMode(next);
    if (next) {
      setShowTouchControls(true);
      await toggleFullscreen();
    } else if (isFullscreen) {
      await toggleFullscreen();
    }
  }, [horizontalMode, isFullscreen, toggleFullscreen]);

  const toggleTiltSteer = useCallback(async () => {
    if (tiltSteerEnabled) {
      setTiltSteerEnabled(false);
      tiltSteerRef.current = 0;
      return;
    }
    const DevOrientation = typeof DeviceOrientationEvent !== 'undefined'
      ? (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> })
      : null;
    if (DevOrientation?.requestPermission) {
      try {
        const res = await DevOrientation.requestPermission();
        if (res !== 'granted') return;
      } catch {
        return;
      }
    }
    setTiltSteerEnabled(true);
  }, [tiltSteerEnabled]);

  // DeviceOrientation tilt-to-steer listener when user enables Tilt Steer
  useEffect(() => {
    if (!tiltSteerEnabled) {
      tiltSteerRef.current = 0;
      return;
    }
    const onOrientation = (e: DeviceOrientationEvent) => {
      const beta = typeof e.beta === 'number' ? e.beta : 0;
      const gamma = typeof e.gamma === 'number' ? e.gamma : 0;
      const screenAngle = (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) as number;

      let tiltDeg = 0;
      if (isCssRotated) {
        // CSS rotated 90deg CCW (default) or CW (flipped) while OS reports portrait
        tiltDeg = horizontalFlip ? beta : -beta;
      } else if (!isPortrait) {
        // Native horizontal landscape
        tiltDeg = screenAngle === 270 || screenAngle === -90 ? beta : -beta;
      } else {
        // Upright portrait tilt left/right
        tiltDeg = -gamma;
      }

      const deadzone = 4;
      const maxTilt = 30;
      if (Math.abs(tiltDeg) <= deadzone) {
        tiltSteerRef.current = 0;
      } else {
        const sign = tiltDeg > 0 ? 1 : -1;
        const norm = Math.min(1, (Math.abs(tiltDeg) - deadzone) / (maxTilt - deadzone));
        tiltSteerRef.current = sign * norm;
      }
    };

    window.addEventListener('deviceorientation', onOrientation);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      tiltSteerRef.current = 0;
    };
  }, [tiltSteerEnabled, isCssRotated, horizontalFlip, isPortrait]);

  // Track fullscreen, viewport dimensions, and phone orientation changes
  useEffect(() => {
    const syncViewport = () => {
      setViewportSize({
        width: window.visualViewport?.width || window.innerWidth,
        height: window.visualViewport?.height || window.innerHeight,
      });
    };
    let delayedTimer = 0;
    const onOrientationChange = () => {
      syncViewport();
      window.clearTimeout(delayedTimer);
      delayedTimer = window.setTimeout(syncViewport, 140);
    };
    const onFullscreenChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
      syncViewport();
    };
    const onFirstTouch = () => {
      setIsTouchDevice(true);
      setShowTouchControls(true);
      setHorizontalMode(true);
    };

    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', onOrientationChange);
    window.visualViewport?.addEventListener('resize', syncViewport);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    window.addEventListener('touchstart', onFirstTouch, { once: true, passive: true });
    window.addEventListener('blur', releaseAllTouchControls);

    return () => {
      window.clearTimeout(delayedTimer);
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', onOrientationChange);
      window.visualViewport?.removeEventListener('resize', syncViewport);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      window.removeEventListener('touchstart', onFirstTouch);
      window.removeEventListener('blur', releaseAllTouchControls);
    };
  }, [releaseAllTouchControls]);

  useEffect(() => {
    if (room.status !== 'RACING') {
      releaseAllTouchControls();
    }
  }, [room.status, releaseAllTouchControls]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
    return () => window.cancelAnimationFrame(id);
  }, [isCssRotated, horizontalFlip]);

  // Audio cues on countdown & finish transitions
  const prevStepRef = useRef<number>(room.countdownStep);
  const prevStatusRef = useRef(room.status);

  useEffect(() => {
    if (room.status === 'COUNTDOWN' && room.countdownStep !== prevStepRef.current && room.countdownStep > 0) {
      engineAudio.playCountdownTone(false);
    }
    if (room.status === 'RACING' && prevStatusRef.current === 'COUNTDOWN') {
      engineAudio.playCountdownTone(true);
      engineAudio.startEngine();
    }
    if (room.status === 'FINISHED' && prevStatusRef.current !== 'FINISHED') {
      engineAudio.stopEngine();
      engineAudio.playFinishFanfare(finishedEvent?.winnerUid === currentUid);
    }
    prevStepRef.current = room.countdownStep;
    prevStatusRef.current = room.status;
  }, [room.status, room.countdownStep, finishedEvent, currentUid]);

  useEffect(() => {
    return () => {
      engineAudio.stopEngine();
    };
  }, []);

  // Trigger brief CSS collision shake animation whenever collisionSeq increments
  useEffect(() => {
    if (hud.collisionSeq <= 0) return;
    setCollisionShakeActive(true);
    const id = window.setTimeout(() => setCollisionShakeActive(false), 260);
    return () => window.clearTimeout(id);
  }, [hud.collisionSeq]);

  // Keyboard listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') keysRef.current.up = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') keysRef.current.down = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') keysRef.current.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keysRef.current.right = true;
      if (e.code === 'Space') {
        e.preventDefault();
        keysRef.current.nitro = true;
      }
      if (e.code === 'KeyC' && !e.repeat) {
        setCameraMode((prev) => (prev === 'chase' ? 'hood' : prev === 'hood' ? 'wide' : 'chase'));
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') keysRef.current.up = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') keysRef.current.down = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') keysRef.current.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keysRef.current.right = false;
      if (e.code === 'Space') keysRef.current.nitro = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Main Three.js Simulation & Render Loop
  useEffect(() => {
    const container = mountRef.current;
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
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.domElement.className = 'w-full h-full block';

    const onLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => setContextLost(false);
    renderer.domElement.addEventListener('webglcontextlost', onLost);
    renderer.domElement.addEventListener('webglcontextrestored', onRestored);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      62,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.2,
      850
    );

    const trackMeta = TRACK_CATALOG[room.trackId] || TRACK_CATALOG.monaco_harbor;

    // Realistic Location Lighting Rig
    const hemi = new THREE.HemisphereLight(
      trackMeta.hemiSky,
      trackMeta.hemiGround,
      trackMeta.hemiIntensity
    );
    scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(trackMeta.sunColor, trackMeta.sunIntensity);
    sunLight.position.set(...trackMeta.sunDirection);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -75;
    sunLight.shadow.camera.right = 75;
    sunLight.shadow.camera.top = 75;
    sunLight.shadow.camera.bottom = -75;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 320;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const builtTrack: BuiltTrack = buildTrackScene(scene, room.trackId, renderer, isSoftwareGl);
    const particles = createRaceParticles(scene);

    // Precompute minimap SVG path + bounds
    const pathD =
      builtTrack.minimapPoints
        .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
        .join(' ') + ' Z';
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const s of builtTrack.samples) {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.z < minZ) minZ = s.z;
      if (s.z > maxZ) maxZ = s.z;
    }
    const span = Math.max(maxX - minX, maxZ - minZ, 1);

    // Build Player & Up to 3 Opponent Cartoon-Character Car Rigs
    const localSlot = localPlayer?.slotIndex ?? 0;
    const localCarId: CarId = localPlayer?.carId || 'ferrari_488';
    const localCar: RaceCarRig = createRaceCar(localPlayer?.liveryId || 'crimson_apex', isSoftwareGl, localCarId);
    scene.add(localCar.root);

    interface OppSimEntry {
      rig: RaceCarRig;
      carId: CarId;
      liveryId: RoomPlayer['liveryId'];
      color: string;
      state: {
        x: number;
        z: number;
        heading: number;
        speed: number;
        prevSpeed: number;
        accelIntensity: number;
        collisionImpulse: number;
        steer: number;
        lap: number;
        progress: number;
        nitroActive: boolean;
        braking: boolean;
      };
    }

    const oppRigs = new Map<string, OppSimEntry>();

    const syncOpponentRigs = (players: RoomPlayer[]) => {
      const activeOpps = players.filter((p) => p.uid !== currentUid);
      const activeIds = new Set(activeOpps.map((p) => p.uid));

      // Remove stale opponent rigs
      for (const [uid, entry] of oppRigs.entries()) {
        if (!activeIds.has(uid)) {
          scene.remove(entry.rig.root);
          entry.rig.dispose();
          oppRigs.delete(uid);
        }
      }

      activeOpps.forEach((p, idx) => {
        const oppCarId: CarId = p.carId || 'lexus_is';
        const existing = oppRigs.get(p.uid);
        if (existing && (existing.liveryId !== p.liveryId || existing.carId !== oppCarId)) {
          scene.remove(existing.rig.root);
          existing.rig.dispose();
          oppRigs.delete(p.uid);
        }
        if (!oppRigs.has(p.uid)) {
          const rig = createRaceCar(p.liveryId, isSoftwareGl, oppCarId);
          const coords = getGridStartCoords(p.slotIndex, builtTrack.meta.startZ);
          rig.root.position.set(coords.x, 0, coords.z);
          scene.add(rig.root);
          oppRigs.set(p.uid, {
            rig,
            carId: oppCarId,
            liveryId: p.liveryId,
            color: OPPONENT_COLORS[idx % OPPONENT_COLORS.length],
            state: {
              x: coords.x,
              z: coords.z,
              heading: 0,
              speed: 0,
              prevSpeed: 0,
              accelIntensity: 0,
              collisionImpulse: 0,
              steer: 0,
              lap: 1,
              progress: 0,
              nitroActive: false,
              braking: false,
            },
          });
        }
        const entry = oppRigs.get(p.uid)!;
        entry.color = OPPONENT_COLORS[idx % OPPONENT_COLORS.length];
        entry.rig.root.visible = !p.forfeited;
      });
    };

    syncOpponentRigs(room.players);

    // Physics state
    const localStart = getGridStartCoords(localSlot, builtTrack.meta.startZ);
    const state = {
      x: localStart.x,
      z: localStart.z,
      heading: 0,
      speed: 0,
      prevSpeed: 0,
      accelIntensity: 0,
      collisionImpulse: 0,
      cameraShake: 0,
      collisionSeq: 0,
      lastCollisionAt: 0,
      steerAngle: 0,
      nitroFuel: 100,
      nitroActive: false,
      boostCooldown: 0,
      lap: 1,
      checkpoint: 0,
      nearestIdx: 0,
      progress: 0,
      braking: false,
      offTrack: false,
    };

    localCar.root.position.set(state.x, 0, state.z);

    // Initialize camera behind local car
    camera.position.set(state.x, 4.2, state.z - 9.5);
    camera.lookAt(state.x, 1.2, state.z + 10);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const syncRendererSize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h);
      }
    };

    const resizeObserver = new ResizeObserver(syncRendererSize);
    resizeObserver.observe(container);
    let orientationTimer = 0;
    const handleOrientationResize = () => {
      syncRendererSize();
      window.clearTimeout(orientationTimer);
      orientationTimer = window.setTimeout(syncRendererSize, 140);
    };
    window.addEventListener('resize', syncRendererSize);
    window.addEventListener('orientationchange', handleOrientationResize);
    window.visualViewport?.addEventListener('resize', syncRendererSize);

    let disposed = false;
    let rafId = 0;
    let timerId = 0;
    let lastTelemetrySentAt = 0;
    let lastHudUpdateAt = 0;
    let lastRaceStateMatchId = room.matchId;
    const clock = new THREE.Clock();

    const findNearestTrackIndex = (x: number, z: number, hintIdx: number): { idx: number; distSq: number } => {
      const samples = builtTrack.samples;
      const n = samples.length;
      let bestIdx = hintIdx;
      let bestDistSq = Infinity;

      // Local window search (+/- 36 samples) for O(1) fast tracking
      for (let offset = -36; offset <= 36; offset++) {
        const i = (hintIdx + offset + n) % n;
        const dx = x - samples[i].x;
        const dz = z - samples[i].z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestIdx = i;
        }
      }

      // Fallback full scan if far from hint
      if (bestDistSq > 400) {
        for (let i = 0; i < n; i++) {
          const dx = x - samples[i].x;
          const dz = z - samples[i].z;
          const d2 = dx * dx + dz * dz;
          if (d2 < bestDistSq) {
            bestDistSq = d2;
            bestIdx = i;
          }
        }
      }

      return { idx: bestIdx, distSq: bestDistSq };
    };

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const now = performance.now();
      const currentRoom = roomRef.current;

      syncOpponentRigs(currentRoom.players);

      // Reset car coordinates if a new match / rematch started
      if (currentRoom.matchId !== lastRaceStateMatchId) {
        lastRaceStateMatchId = currentRoom.matchId;
        const slot = currentRoom.players.find((p) => p.uid === currentUid)?.slotIndex ?? 0;
        const resetCoords = getGridStartCoords(slot, builtTrack.meta.startZ);
        state.x = resetCoords.x;
        state.z = resetCoords.z;
        state.heading = 0;
        state.speed = 0;
        state.prevSpeed = 0;
        state.accelIntensity = 0;
        state.collisionImpulse = 0;
        state.cameraShake = 0;
        state.lap = 1;
        state.checkpoint = 0;
        state.nearestIdx = 0;
        state.progress = 0;
        state.nitroFuel = 100;

        for (const p of currentRoom.players) {
          if (p.uid === currentUid) continue;
          const entry = oppRigs.get(p.uid);
          if (entry) {
            const c = getGridStartCoords(p.slotIndex, builtTrack.meta.startZ);
            entry.state.x = c.x;
            entry.state.z = c.z;
            entry.state.heading = 0;
            entry.state.speed = 0;
            entry.state.prevSpeed = 0;
            entry.state.accelIntensity = 0;
            entry.state.collisionImpulse = 0;
            entry.state.steer = 0;
            entry.state.lap = 1;
            entry.state.progress = 0;
            entry.state.nitroActive = false;
            entry.state.braking = false;
          }
        }
      }

      // Update 5 Overhead Gantry Start Lights
      if (currentRoom.status === 'COUNTDOWN') {
        const litCount = Math.max(0, Math.min(5, 6 - currentRoom.countdownStep));
        builtTrack.startLights.forEach((bulb, idx) => {
          bulb.material = idx < litCount ? builtTrack.startLightMatOn : builtTrack.startLightMatOff;
        });
      } else if (currentRoom.status === 'RACING') {
        builtTrack.startLights.forEach((bulb) => {
          bulb.material = builtTrack.startLightMatGreen;
        });
      } else {
        builtTrack.startLights.forEach((bulb) => {
          bulb.material = builtTrack.startLightMatOff;
        });
      }

      const canDrive = currentRoom.status === 'RACING';
      const keys = keysRef.current;

      // 1. Local Car Physics Simulation
      if (canDrive) {
        const wantNitro = keys.nitro && state.nitroFuel > 1 && state.speed > 6;
        state.nitroActive = wantNitro || state.boostCooldown > 0;

        if (wantNitro) {
          state.nitroFuel = Math.max(0, state.nitroFuel - 34 * dt);
        } else {
          state.nitroFuel = Math.min(100, state.nitroFuel + 5.5 * dt);
        }
        if (state.boostCooldown > 0) {
          state.boostCooldown = Math.max(0, state.boostCooldown - dt);
        }

        const maxForward = state.nitroActive ? 82 : 65; // ~295 km/h boost, ~234 km/h standard
        const accelRate = state.nitroActive ? 46 : 30;
        state.braking = false;

        if (keys.up) {
          state.speed += accelRate * dt;
        } else if (keys.down) {
          if (state.speed > 1.5) {
            state.speed -= 56 * dt;
            state.braking = true;
          } else {
            state.speed -= 18 * dt;
          }
        } else {
          // Natural aerodynamic + rolling drag
          state.speed -= state.speed * 0.85 * dt;
          if (Math.abs(state.speed) < 0.15) state.speed = 0;
        }

        state.speed = THREE.MathUtils.clamp(state.speed, -16, maxForward);

        // Responsive speed-sensitive steering (supports Steering Wheel, keyboard A/D, and optional tilt gyro)
        const buttonSteer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
        const targetSteer = wheelSteerRef.current.active
          ? wheelSteerRef.current.value
          : buttonSteer !== 0
          ? buttonSteer
          : tiltSteerRef.current;
        state.steerAngle = THREE.MathUtils.damp(state.steerAngle, targetSteer * 0.5, 12, dt);
        visualSteerRef.current = THREE.MathUtils.clamp(state.steerAngle * 2.0, -1, 1);

        const steerStrength = 2.05 * Math.min(1, Math.abs(state.speed) / 9);
        const reverseSign = state.speed >= 0 ? 1 : -1;
        state.heading += state.steerAngle * steerStrength * reverseSign * dt * 2.1;

        const vx = Math.sin(state.heading) * state.speed;
        const vz = Math.cos(state.heading) * state.speed;
        state.x += vx * dt;
        state.z += vz * dt;

        // Track surface, guardrails & lap progress check
        const nearest = findNearestTrackIndex(state.x, state.z, state.nearestIdx);
        state.nearestIdx = nearest.idx;
        const sample = builtTrack.samples[nearest.idx];
        const dx = state.x - sample.x;
        const dz = state.z - sample.z;
        const radialDist = Math.hypot(dx, dz);

        // Off-asphalt kerb/shoulder detection & gentle drag
        state.offTrack = radialDist > builtTrack.roadHalfWidth;
        if (state.offTrack) {
          state.speed *= 1 - 0.55 * dt;
        }

        // Guardrail soft clamp, deflection & WebGL/CSS impact feedback
        const maxDist = builtTrack.roadHalfWidth + 1.65;
        if (radialDist > maxDist && radialDist > 0.001) {
          const nx = dx / radialDist;
          const nz = dz / radialDist;
          if (Math.abs(state.speed) > 10 && now - state.lastCollisionAt > 190) {
            const hitPower = THREE.MathUtils.clamp(Math.abs(state.speed) / 58, 0.35, 1);
            state.collisionImpulse = Math.max(state.collisionImpulse, hitPower);
            state.cameraShake = Math.max(state.cameraShake, hitPower * 0.65);
            state.collisionSeq += 1;
            state.lastCollisionAt = now;
            particles.emitCollisionSparks(state.x, 0.4, state.z, hitPower);
          }
          state.x = sample.x + nx * maxDist;
          state.z = sample.z + nz * maxDist;
          state.speed *= 0.68;

          // Gently nudge heading parallel to track tangent
          const trackHeading = Math.atan2(sample.tx, sample.tz);
          const diff = Math.atan2(Math.sin(trackHeading - state.heading), Math.cos(trackHeading - state.heading));
          state.heading += diff * 0.35;
        }

        // Boost pads trigger (with speed-gain scale surge)
        for (const pad of builtTrack.boostPads) {
          const pdx = state.x - pad.x;
          const pdz = state.z - pad.z;
          if (pdx * pdx + pdz * pdz < pad.radius * pad.radius) {
            state.boostCooldown = 1.15;
            state.nitroFuel = Math.min(100, state.nitroFuel + 38);
            state.speed = Math.max(state.speed, 76);
            state.accelIntensity = 1;
          }
        }

        // Car-to-car soft lateral separation & collision shake/sparks across active racers
        for (const entry of oppRigs.values()) {
          if (!entry.rig.root.visible) continue;
          const cdx = state.x - entry.state.x;
          const cdz = state.z - entry.state.z;
          const cDist = Math.hypot(cdx, cdz);
          if (cDist > 0.01 && cDist < 2.55) {
            const push = (2.55 - cDist) * 0.5;
            state.x += (cdx / cDist) * push;
            state.z += (cdz / cDist) * push;
            if (now - state.lastCollisionAt > 180) {
              const relSpeed = Math.abs(state.speed - entry.state.speed);
              const hitPower = THREE.MathUtils.clamp(0.45 + relSpeed / 38, 0.45, 1);
              state.collisionImpulse = Math.max(state.collisionImpulse, hitPower);
              entry.state.collisionImpulse = Math.max(entry.state.collisionImpulse, hitPower);
              state.cameraShake = Math.max(state.cameraShake, hitPower * 0.8);
              state.collisionSeq += 1;
              state.lastCollisionAt = now;
              particles.emitCollisionSparks(
                (state.x + entry.state.x) * 0.5,
                0.45,
                (state.z + entry.state.z) * 0.5,
                hitPower
              );
            }
            state.speed *= 0.96;
          }
        }

        // Track speed-gain intensity & decay collision impulse smoothly
        const rawAccel = dt > 0.001 ? Math.max(0, (state.speed - state.prevSpeed) / (dt * 36)) : 0;
        state.accelIntensity = THREE.MathUtils.damp(state.accelIntensity, Math.min(1, rawAccel), 10, dt);
        state.prevSpeed = state.speed;
        state.collisionImpulse = THREE.MathUtils.damp(state.collisionImpulse, 0, 8.5, dt);
        state.cameraShake = THREE.MathUtils.damp(state.cameraShake, 0, 12, dt);

        // Checkpoint & Lap Progression (4 sectors: 0 -> 1 -> 2 -> 3 -> next lap)
        const t = nearest.idx / builtTrack.samples.length;
        let checkpointChanged = false;
        if (state.checkpoint === 0 && t >= 0.22 && t < 0.48) {
          state.checkpoint = 1;
          checkpointChanged = true;
        } else if (state.checkpoint === 1 && t >= 0.48 && t < 0.72) {
          state.checkpoint = 2;
          checkpointChanged = true;
        } else if (state.checkpoint === 2 && t >= 0.72 && t < 0.95) {
          state.checkpoint = 3;
          checkpointChanged = true;
        } else if (state.checkpoint === 3 && (t >= 0.95 || t < 0.14)) {
          state.lap += 1;
          state.checkpoint = 0;
          checkpointChanged = true;
          if (state.lap <= currentRoom.laps) {
            engineAudio.playLapChime();
          }
        }

        state.progress = (state.lap - 1) + t;

        // Send telemetry to server (20Hz or immediately on checkpoint/lap transition)
        if (checkpointChanged || now - lastTelemetrySentAt >= 48) {
          lastTelemetrySentAt = now;
          onSendTelemetryRef.current({
            x: Math.round(state.x * 100) / 100,
            z: Math.round(state.z * 100) / 100,
            heading: Math.round(state.heading * 1000) / 1000,
            speed: Math.round(state.speed * 10) / 10,
            steer: Math.round(state.steerAngle * 100) / 100,
            lap: state.lap,
            checkpoint: state.checkpoint,
            progress: Math.round(t * 10000) / 10000,
            nitroActive: state.nitroActive,
            braking: state.braking,
          });
        }
      }

      if (!canDrive) {
        const buttonSteer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
        const idleTargetSteer = wheelSteerRef.current.active
          ? wheelSteerRef.current.value
          : buttonSteer !== 0
          ? buttonSteer
          : tiltSteerRef.current;
        state.steerAngle = THREE.MathUtils.damp(state.steerAngle, idleTargetSteer * 0.5, 12, dt);
        visualSteerRef.current = THREE.MathUtils.clamp(state.steerAngle * 2.0, -1, 1);
        state.collisionImpulse = THREE.MathUtils.damp(state.collisionImpulse, 0, 8.5, dt);
        state.cameraShake = THREE.MathUtils.damp(state.cameraShake, 0, 12, dt);
      }

      // Apply local car transforms, cartoon character animation, wheel spin & subtle drift/dust particles
      const elapsedSec = clock.elapsedTime;
      const fwdX = Math.sin(state.heading);
      const fwdZ = Math.cos(state.heading);
      const rightX = Math.cos(state.heading);
      const rightZ = -Math.sin(state.heading);

      localCar.root.position.set(state.x, 0, state.z);
      localCar.root.rotation.y = state.heading;
      localCar.frontLeftSteer.rotation.y = state.steerAngle * 0.85;
      localCar.frontRightSteer.rotation.y = state.steerAngle * 0.85;
      for (const w of localCar.wheelMeshes) {
        w.rotation.x += state.speed * dt * 2.5;
      }
      localCar.brakeMaterial.emissiveIntensity = state.braking ? 3.2 : 0.85;
      localCar.nitroFlames.forEach((f) => {
        f.visible = state.nitroActive && canDrive;
      });
      localCar.updateAnimation({
        steerRatio: state.steerAngle * 2.0,
        speed: state.speed,
        nitroActive: state.nitroActive && canDrive,
        braking: state.braking,
        dt,
        elapsedSec,
        accelIntensity: canDrive ? state.accelIntensity : 0,
        collisionImpulse: state.collisionImpulse,
      });

      // Subtle tire drift smoke, off-track dust & nitro exhaust vapor for local car
      if (canDrive) {
        const rearX = state.x - fwdX * 1.4;
        const rearZ = state.z - fwdZ * 1.4;
        const absSpeed = Math.abs(state.speed);
        const isDrifting =
          (Math.abs(state.steerAngle) > 0.14 && absSpeed > 18) || (state.braking && absSpeed > 20);
        const carVx = fwdX * state.speed;
        const carVz = fwdZ * state.speed;

        if (state.offTrack && absSpeed > 7) {
          const dustIntensity = Math.min(1, absSpeed / 45);
          if (Math.random() < 0.78) {
            particles.emitOffTrackDust(
              rearX + rightX * 0.96,
              0.08,
              rearZ + rightZ * 0.96,
              carVx,
              carVz,
              builtTrack.meta.dustColorHex,
              dustIntensity
            );
            particles.emitOffTrackDust(
              rearX - rightX * 0.96,
              0.08,
              rearZ - rightZ * 0.96,
              carVx,
              carVz,
              builtTrack.meta.dustColorHex,
              dustIntensity
            );
          }
        } else if (isDrifting) {
          const driftIntensity = Math.min(1, (Math.abs(state.steerAngle) * 2.2 + (state.braking ? 0.5 : 0)) * (absSpeed / 55));
          if (Math.random() < 0.65) {
            particles.emitDriftSmoke(
              rearX + rightX * 0.94,
              0.08,
              rearZ + rightZ * 0.94,
              carVx,
              carVz,
              driftIntensity
            );
            particles.emitDriftSmoke(
              rearX - rightX * 0.94,
              0.08,
              rearZ - rightZ * 0.94,
              carVx,
              carVz,
              driftIntensity
            );
          }
        }

        if (state.nitroActive && Math.random() < 0.55) {
          const exBaseX = state.x - fwdX * 2.28;
          const exBaseZ = state.z - fwdZ * 2.28;
          particles.emitNitroVapor(exBaseX + rightX * 0.42, 0.34, exBaseZ + rightZ * 0.42, fwdX, fwdZ);
          particles.emitNitroVapor(exBaseX - rightX * 0.42, 0.34, exBaseZ - rightZ * 0.42, fwdX, fwdZ);
        }
      }

      // 2. Remote Opponents Smooth Interpolation (up to 3 remote racers)
      const remoteMap = oppTelemetryRef.current;
      for (const [uid, entry] of oppRigs.entries()) {
        if (!entry.rig.root.visible) continue;
        const remote = remoteMap[uid];
        const oState = entry.state;
        const oRig = entry.rig;
        if (remote) {
          oState.x = THREE.MathUtils.damp(oState.x, remote.x, 14, dt);
          oState.z = THREE.MathUtils.damp(oState.z, remote.z, 14, dt);
          const hDiff = Math.atan2(Math.sin(remote.heading - oState.heading), Math.cos(remote.heading - oState.heading));
          oState.heading += hDiff * Math.min(1, dt * 14);
          oState.speed = THREE.MathUtils.damp(oState.speed, remote.speed, 12, dt);
          oState.steer = THREE.MathUtils.damp(oState.steer, remote.steer, 12, dt);
          oState.lap = remote.lap;
          oState.progress = remote.progress;
          oState.nitroActive = remote.nitroActive;
          oState.braking = remote.braking;
        }
        const oppRawAccel = dt > 0.001 ? Math.max(0, (oState.speed - oState.prevSpeed) / (dt * 36)) : 0;
        oState.accelIntensity = THREE.MathUtils.damp(oState.accelIntensity, Math.min(1, oppRawAccel), 10, dt);
        if (dt > 0.001 && oState.speed - oState.prevSpeed < -10 && Math.abs(oState.prevSpeed) > 16) {
          oState.collisionImpulse = Math.max(oState.collisionImpulse, 0.72);
        }
        oState.prevSpeed = oState.speed;
        oState.collisionImpulse = THREE.MathUtils.damp(oState.collisionImpulse, 0, 8.5, dt);

        oRig.root.position.set(oState.x, 0, oState.z);
        oRig.root.rotation.y = oState.heading;
        oRig.frontLeftSteer.rotation.y = oState.steer * 0.85;
        oRig.frontRightSteer.rotation.y = oState.steer * 0.85;
        for (const w of oRig.wheelMeshes) {
          w.rotation.x += oState.speed * dt * 2.5;
        }
        oRig.brakeMaterial.emissiveIntensity = oState.braking ? 3.2 : 0.85;
        oRig.nitroFlames.forEach((f) => {
          f.visible = oState.nitroActive && currentRoom.status === 'RACING';
        });
        oRig.updateAnimation({
          steerRatio: oState.steer * 2.0,
          speed: oState.speed,
          nitroActive: oState.nitroActive && currentRoom.status === 'RACING',
          braking: oState.braking,
          dt,
          elapsedSec,
          accelIntensity: oState.accelIntensity,
          collisionImpulse: oState.collisionImpulse,
        });

        // Subtle opponent drift smoke when cornering sharply
        if (currentRoom.status === 'RACING' && Math.abs(oState.steer) > 0.16 && Math.abs(oState.speed) > 20 && Math.random() < 0.35) {
          const oFwdX = Math.sin(oState.heading);
          const oFwdZ = Math.cos(oState.heading);
          const oRightX = Math.cos(oState.heading);
          const oRightZ = -Math.sin(oState.heading);
          const oRearX = oState.x - oFwdX * 1.4;
          const oRearZ = oState.z - oFwdZ * 1.4;
          particles.emitDriftSmoke(
            oRearX + oRightX * 0.9,
            0.08,
            oRearZ + oRightZ * 0.9,
            oFwdX * oState.speed,
            oFwdZ * oState.speed,
            0.5
          );
        }
      }

      particles.update(dt);

      // 3. Camera Choreography (Smooth Damped Follow + Dynamic FOV on Nitro)
      const mode = cameraModeRef.current;

      if (mode === 'hood') {
        _camPosTarget.set(state.x + fwdX * 0.65, 1.32, state.z + fwdZ * 0.65);
        _camLookTarget.set(state.x + fwdX * 28, 1.05, state.z + fwdZ * 28);
        camera.position.lerp(_camPosTarget, Math.min(1, dt * 22));
      } else if (mode === 'wide') {
        _camPosTarget.set(state.x - fwdX * 14.5, 6.8, state.z - fwdZ * 14.5);
        _camLookTarget.set(state.x + fwdX * 12, 1.0, state.z + fwdZ * 12);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camPosTarget.x, 7, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camPosTarget.y, 7, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camPosTarget.z, 7, dt);
      } else {
        _camPosTarget.set(state.x - fwdX * 8.8, 3.65, state.z - fwdZ * 8.8);
        _camLookTarget.set(state.x + fwdX * 14, 1.15, state.z + fwdZ * 14);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camPosTarget.x, 9, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camPosTarget.y, 9, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camPosTarget.z, 9, dt);
      }

      if (state.cameraShake > 0.01) {
        camera.position.x += Math.sin(elapsedSec * 62) * state.cameraShake * 0.3;
        camera.position.y += Math.cos(elapsedSec * 51) * state.cameraShake * 0.2;
      }

      camera.lookAt(_camLookTarget);

      const speedRatio = Math.min(1, Math.abs(state.speed) / 80);
      const portraitFovBoost = camera.aspect < 1 ? Math.min(18, (1 - camera.aspect) * 28) : 0;
      const targetFov = (mode === 'hood' ? 72 : 60) + portraitFovBoost + speedRatio * 12 + (state.nitroActive ? 6 : 0);
      if (Math.abs(camera.fov - targetFov) > 0.08) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
        camera.updateProjectionMatrix();
      }

      // Follow shadow frustum with player car along location sun angle
      sunLight.position.set(
        state.x + trackMeta.sunDirection[0],
        trackMeta.sunDirection[1],
        state.z + trackMeta.sunDirection[2]
      );
      sunLight.target.position.set(state.x, 0, state.z);
      sunLight.target.updateMatrixWorld();

      const speedKmh = Math.round(Math.abs(state.speed) * 3.6);
      engineAudio.updateEngine(canDrive ? speedKmh : 0, state.nitroActive);

      // Update React HUD & Minimap at ~15Hz
      if (now - lastHudUpdateAt >= 65) {
        lastHudUpdateAt = now;
        const myProg = state.progress;
        const activeEntries = Array.from(oppRigs.entries()).filter(([, e]) => e.rig.root.visible);
        const allProgs = activeEntries.map(([, e]) => e.state.progress);
        const aheadCount = allProgs.filter((p) => p > myProg).length;
        const position = 1 + aheadCount;
        const totalPlayers = Math.max(2, 1 + activeEntries.length);

        let gapSec = 0;
        if (allProgs.length > 0) {
          const maxOppProg = Math.max(...allProgs);
          gapSec = Math.round(((myProg - maxOppProg) * 26) * 100) / 100;
        }
        const elapsedMs = currentRoom.raceStartAtMs ? Date.now() - currentRoom.raceStartAtMs : 0;

        setHud({
          speedKmh,
          nitroPct: Math.round(state.nitroFuel),
          lap: Math.min(currentRoom.laps, state.lap),
          position,
          totalPlayers,
          gapSeconds: gapSec,
          elapsedMs,
          boostFlash: state.boostCooldown > 0.2,
          isSpeedSurging: state.nitroActive || state.boostCooldown > 0.2 || state.accelIntensity > 0.45,
          collisionSeq: state.collisionSeq,
        });

        setMinimapSvg({
          pathD,
          localPt: {
            x: 10 + ((state.x - minX) / span) * 80,
            y: 10 + ((state.z - minZ) / span) * 80,
          },
          oppPts: activeEntries.map(([uid, entry]) => ({
            uid,
            x: 10 + ((entry.state.x - minX) / span) * 80,
            y: 10 + ((entry.state.z - minZ) / span) * 80,
            color: entry.color,
          })),
        });
      }

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
      window.clearTimeout(orientationTimer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncRendererSize);
      window.removeEventListener('orientationchange', handleOrientationResize);
      window.visualViewport?.removeEventListener('resize', syncRendererSize);
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
      localCar.dispose();
      for (const entry of oppRigs.values()) {
        entry.rig.dispose();
      }
      oppRigs.clear();
      particles.dispose();
      builtTrack.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [room.trackId, currentUid, localPlayer?.carId, localPlayer?.liveryId]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    engineAudio.setMuted(next);
  };

  const didWin = finishedEvent?.winnerUid === currentUid;

  const stageStyle: CSSProperties | undefined = isCssRotated
    ? horizontalFlip
      ? {
          position: 'fixed',
          top: `${viewportSize.height}px`,
          left: 0,
          width: `${viewportSize.height}px`,
          height: `${viewportSize.width}px`,
          transformOrigin: 'top left',
          transform: 'rotate(-90deg)',
        }
      : {
          position: 'fixed',
          top: 0,
          left: `${viewportSize.width}px`,
          width: `${viewportSize.height}px`,
          height: `${viewportSize.width}px`,
          transformOrigin: 'top left',
          transform: 'rotate(90deg)',
        }
    : undefined;

  const hudSafeAreaStyle: CSSProperties | undefined = isCssRotated
    ? horizontalFlip
      ? {
          paddingTop: 'max(0.65rem, env(safe-area-inset-left))',
          paddingBottom: 'max(0.65rem, env(safe-area-inset-right))',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-bottom))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-top))',
        }
      : {
          paddingTop: 'max(0.65rem, env(safe-area-inset-right))',
          paddingBottom: 'max(0.65rem, env(safe-area-inset-left))',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-top))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-bottom))',
        }
    : undefined;

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#0B0F14] overflow-hidden select-none touch-none">
      <div
        ref={viewportRef}
        style={stageStyle}
        onContextMenu={(e) => e.preventDefault()}
        className={isCssRotated ? 'bg-[#0B0F14] overflow-hidden select-none touch-none' : 'relative w-full h-full bg-[#0B0F14] overflow-hidden select-none touch-none'}
      >
      {/* Dedicated Edge-to-Edge WebGL Mount + CSS Impact/Speed Shake Wrapper */}
      <div
        className={`absolute inset-0 w-full h-full will-change-transform ${
          collisionShakeActive ? 'race-collision-shake' : ''
        }`}
      >
        <div ref={mountRef} className="absolute inset-0 w-full h-full" />
      </div>

      {/* Subtle CSS High-Speed & Impact Edge Vignette (Zero backdrop-filter) */}
      {(hud.isSpeedSurging || collisionShakeActive) && (
        <div
          className="pointer-events-none absolute inset-0 z-[5] transition-opacity duration-150"
          style={{
            boxShadow: collisionShakeActive
              ? 'inset 0 0 72px rgba(245, 158, 11, 0.36)'
              : 'inset 0 0 64px rgba(56, 189, 248, 0.2)',
          }}
        />
      )}

      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0B0F14] text-slate-300 z-20 px-4 text-center">
          <p className="text-sm">3D graphics context interrupted. Reload to rejoin the track.</p>
        </div>
      )}

      {/* Safe-Area HUD & Touch Controls Shell */}
      <div
        style={hudSafeAreaStyle}
        className="pointer-events-none absolute inset-0 safe-race-inset flex flex-col justify-between z-10"
      >
        {/* Top Race Telemetry Strip */}
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className={`pointer-events-auto flex items-center rounded-xl bg-[#0B0F14]/92 border border-white/12 ${isCompactLandscape ? 'gap-3 px-3 py-1.5' : 'gap-3 sm:gap-6 px-3 sm:px-4 py-1.5 sm:py-2.5'}`}>
            <div>
              <p className="text-[10px] sm:text-[11px] text-slate-400">Pos</p>
              <p className={`font-display font-bold text-amber-400 tabular-nums leading-tight ${isCompactLandscape ? 'text-base' : 'text-lg sm:text-2xl'}`}>
                {formatOrdinal(hud.position)}{' '}
                <span className="text-xs sm:text-sm text-slate-400 font-normal">/ {hud.totalPlayers}</span>
              </p>
            </div>
            <div className="h-6 sm:h-8 w-px bg-white/10" />
            <div>
              <p className="text-[10px] sm:text-[11px] text-slate-400">Lap</p>
              <p className={`font-mono font-semibold text-white tabular-nums leading-tight ${isCompactLandscape ? 'text-sm' : 'text-base sm:text-xl'}`}>
                {hud.lap} <span className="text-slate-500">/ {room.laps}</span>
              </p>
            </div>
            <div className="h-6 sm:h-8 w-px bg-white/10" />
            <div>
              <p className="text-[10px] sm:text-[11px] text-slate-400">Time</p>
              <p className={`font-mono font-semibold text-white tabular-nums leading-tight ${isCompactLandscape ? 'text-sm' : 'text-sm sm:text-xl'}`}>
                {formatRaceTime(hud.elapsedMs)}
              </p>
            </div>
            {!isCompactLandscape && (
              <>
                <div className="h-6 sm:h-8 w-px bg-white/10 hidden md:block" />
                <div className="hidden md:block">
                  <p className="text-[11px] text-slate-400">Live Gap</p>
                  <p
                    className={`font-mono text-base font-semibold tabular-nums ${
                      hud.gapSeconds >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {hud.gapSeconds >= 0 ? `+${hud.gapSeconds.toFixed(2)}s Ahead` : `${hud.gapSeconds.toFixed(2)}s Behind`}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Right Track Status, Camera, Tilt, Horizontal, Fullscreen & Audio Header */}
          <div className={`pointer-events-auto flex items-center gap-1.5 rounded-xl bg-[#0B0F14]/92 border border-white/12 ${isCompactLandscape ? 'px-2 py-1' : 'sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2'}`}>
            {!isCompactLandscape && (
              <div className="text-right hidden sm:block pr-1">
                <p className="text-[10px] sm:text-[11px] text-slate-400 whitespace-nowrap">
                  {room.trackName}
                </p>
                <p className="font-mono text-sm sm:text-base font-bold text-amber-400 tabular-nums leading-tight">
                  {room.isBotMatch ? 'Free · vs Bot' : 'Free Multiplayer'}
                </p>
              </div>
            )}

            {showTouchControls && (
              <button
                onClick={() => setCameraMode((m) => (m === 'chase' ? 'hood' : m === 'hood' ? 'wide' : 'chase'))}
                aria-label="Switch camera view"
                title={`Camera: ${cameraMode}`}
                className="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}

            {isTouchDevice && (
              <button
                onClick={toggleTiltSteer}
                aria-label={tiltSteerEnabled ? 'Disable tilt steering' : 'Enable phone tilt steering'}
                title={tiltSteerEnabled ? 'Tilt Steer: ON' : 'Tilt Steer: OFF'}
                className={`min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] px-2 flex items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                  tiltSteerEnabled
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tilt</span>
              </button>
            )}

            <button
              onClick={() => setShowTouchControls((prev) => !prev)}
              aria-label={showTouchControls ? 'Hide touch controls' : 'Show touch controls'}
              title={showTouchControls ? 'Hide Touch Pad' : 'Show Touch Pad'}
              className={`min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-lg transition-colors ${
                showTouchControls
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
            </button>

            {(isTouchDevice || isCssRotated) && (
              <button
                onClick={toggleHorizontalMode}
                aria-label={horizontalMode ? 'Switch to portrait view' : 'Rotate to horizontal landscape'}
                title={horizontalMode ? 'Switch to Portrait' : 'Rotate Horizontal'}
                className={`min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] px-2 flex items-center justify-center gap-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  horizontalMode || !effectivePortrait
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                    : 'bg-amber-500 text-slate-950'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Horizontal</span>
              </button>
            )}

            {isCssRotated && (
              <button
                onClick={() => setHorizontalFlip((f) => !f)}
                aria-label="Flip horizontal side"
                title="Flip 180°"
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            {canUseFullscreen && (
              <button
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                className="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 transition-colors"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={toggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 transition-colors"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {room.status === 'RACING' && (
              <button
                onClick={onForfeit}
                className="min-h-[36px] sm:min-h-[40px] px-2.5 sm:px-3 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-medium whitespace-nowrap transition-colors"
              >
                Forfeit
              </button>
            )}
          </div>
        </div>

        {/* One-Tap Horizontal Widescreen Prompt on Portrait Touch Devices */}
        {isTouchDevice && effectivePortrait && !rotateHintDismissed && room.status !== 'FINISHED' && (
          <div className="pointer-events-auto mx-auto mt-2 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#0B0F14]/94 border border-amber-500/40 text-xs text-slate-200 max-w-md">
            <RotateCw className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="leading-snug">Play horizontally for full-screen widescreen view.</span>
            <button
              onClick={toggleHorizontalMode}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              Rotate Horizontal
            </button>
            <button
              onClick={() => setRotateHintDismissed(true)}
              aria-label="Dismiss rotation hint"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Compact Top-Left Minimap in Touch Mode so Center Road Stays Unobstructed */}
        {showTouchControls && (
          <div className="pointer-events-none flex justify-start mt-1.5">
            <div className="p-1.5 rounded-xl bg-[#0B0F14]/82 border border-white/12">
              <svg viewBox="0 0 100 100" className={isCompactLandscape ? 'w-12 h-12' : 'w-14 h-14'}>
                {minimapSvg.pathD && (
                  <path d={minimapSvg.pathD} fill="none" stroke="#334155" strokeWidth="6" strokeLinejoin="round" />
                )}
                {minimapSvg.oppPts.map((pt) => (
                  <circle key={pt.uid} cx={pt.x} cy={pt.y} r="4.5" fill={pt.color} stroke="#0B0F14" strokeWidth="1.5" />
                ))}
                <circle cx={minimapSvg.localPt.x} cy={minimapSvg.localPt.y} r="5.2" fill="#F59E0B" stroke="#0B0F14" strokeWidth="1.5" />
              </svg>
            </div>
          </div>
        )}

        {/* Bottom Dock: Two-Thumb Landscape/Touch Ergonomics OR Desktop Telemetry */}
        <div className="mt-auto pt-2">
          {showTouchControls ? (
            <div className="flex items-end justify-between gap-2 sm:gap-4">
              {/* Left Thumb Zone: Interactive Rotary Steering Wheel */}
              <SteeringWheelControl
                visualSteerRef={visualSteerRef}
                isCssRotated={isCssRotated}
                horizontalFlip={horizontalFlip}
                compact={isCompactLandscape}
                onSteerChange={handleWheelSteerChange}
              />

              {/* Bottom-Center Compact Speed & Nitro Strip */}
              <div
                className={`pointer-events-none flex items-center gap-3 px-3 sm:px-4 py-2 rounded-xl bg-[#0B0F14]/88 border ${
                  hud.isSpeedSurging ? 'border-sky-400/55 race-speed-surge' : 'border-white/12'
                }`}
              >
                <div className="w-20 sm:w-28">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="inline-flex items-center gap-1 text-sky-400 font-medium">
                      <Zap className="w-3 h-3" />
                      {hud.boostFlash ? 'BOOST' : 'Nitro'}
                    </span>
                    <span className="font-mono text-slate-200 tabular-nums">{hud.nitroPct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-sky-400 transition-all duration-75" style={{ width: `${hud.nitroPct}%` }} />
                  </div>
                </div>
                <div className="text-right min-w-[54px] sm:min-w-[68px]">
                  <p className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums leading-none">
                    {hud.speedKmh}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">KM/H</p>
                </div>
              </div>

              {/* Right Thumb Zone: Nitro, Brake & Throttle Pedals */}
              <div className="pointer-events-auto flex items-end gap-2 sm:gap-2.5">
                <button
                  type="button"
                  aria-label="Nitro Boost"
                  onPointerDown={(e) => handleTouchControlDown('nitro', e)}
                  onPointerUp={(e) => handleTouchControlUp('nitro', e)}
                  onPointerCancel={(e) => handleTouchControlUp('nitro', e)}
                  onLostPointerCapture={(e) => handleTouchControlUp('nitro', e)}
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 touch-none transition-transform active:scale-95 ${
                    pressedControls.nitro
                      ? 'bg-sky-400 border-sky-200 text-slate-950'
                      : hud.nitroPct > 10
                      ? 'bg-sky-950/90 border-sky-400/45 text-sky-200'
                      : 'bg-[#0B0F14]/85 border-white/12 text-slate-500'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>NITRO</span>
                </button>
                <button
                  type="button"
                  aria-label="Brake or Reverse"
                  onPointerDown={(e) => handleTouchControlDown('down', e)}
                  onPointerUp={(e) => handleTouchControlUp('down', e)}
                  onPointerCancel={(e) => handleTouchControlUp('down', e)}
                  onLostPointerCapture={(e) => handleTouchControlUp('down', e)}
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border text-xs font-bold flex items-center justify-center touch-none transition-transform active:scale-95 ${
                    pressedControls.down
                      ? 'bg-rose-500 border-rose-300 text-white'
                      : 'bg-rose-950/90 border-rose-500/35 text-rose-200'
                  }`}
                >
                  BRK
                </button>
                <button
                  type="button"
                  aria-label="Accelerate"
                  onPointerDown={(e) => handleTouchControlDown('up', e)}
                  onPointerUp={(e) => handleTouchControlUp('up', e)}
                  onPointerCancel={(e) => handleTouchControlUp('up', e)}
                  onLostPointerCapture={(e) => handleTouchControlUp('up', e)}
                  className={`w-16 h-[74px] sm:w-[76px] sm:h-20 rounded-2xl border text-xs font-bold flex items-center justify-center touch-none transition-transform active:scale-95 ${
                    pressedControls.up
                      ? 'bg-emerald-400 border-emerald-200 text-slate-950'
                      : 'bg-emerald-600/95 border-emerald-400/50 text-white'
                  }`}
                >
                  GAS
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-end justify-between gap-4">
              {/* Track Minimap (Desktop) */}
              <div className="pointer-events-auto p-3 rounded-xl bg-[#0B0F14]/92 border border-white/12 flex items-center gap-3">
                <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0">
                  {minimapSvg.pathD && (
                    <path d={minimapSvg.pathD} fill="none" stroke="#334155" strokeWidth="5.5" strokeLinejoin="round" />
                  )}
                  {minimapSvg.oppPts.map((pt) => (
                    <circle key={pt.uid} cx={pt.x} cy={pt.y} r="4.1" fill={pt.color} stroke="#0B0F14" strokeWidth="1.5" />
                  ))}
                  <circle cx={minimapSvg.localPt.x} cy={minimapSvg.localPt.y} r="4.8" fill="#F59E0B" stroke="#0B0F14" strokeWidth="1.5" />
                </svg>
                <div className="text-xs space-y-1.5 pr-1">
                  <div className="flex items-center gap-2 text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shrink-0" />
                    <span className="font-medium truncate max-w-[110px]">{localPlayer?.displayName || 'You'}</span>
                  </div>
                  {opponentPlayers.map((opp, idx) => (
                    <div
                      key={opp.uid}
                      className={`flex items-center gap-2 ${opp.forfeited ? 'text-slate-600 line-through' : 'text-slate-400'}`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: OPPONENT_COLORS[idx % OPPONENT_COLORS.length] }}
                      />
                      <span className="truncate max-w-[110px]">{opp.displayName}</span>
                    </div>
                  ))}
                  <button
                    onClick={() => setCameraMode((m) => (m === 'chase' ? 'hood' : m === 'hood' ? 'wide' : 'chase'))}
                    className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/8 hover:bg-white/14 text-slate-200 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span className="capitalize">{cameraMode} Cam (C)</span>
                  </button>
                </div>
              </div>

              {/* Speedometer & Nitro Boost Bar (Desktop) */}
              <div
                className={`pointer-events-auto px-5 py-3.5 rounded-xl bg-[#0B0F14]/92 border flex items-center gap-6 ${
                  hud.isSpeedSurging ? 'border-sky-400/55 race-speed-surge' : 'border-white/12'
                }`}
              >
                <div className="hidden lg:block text-xs text-slate-400 leading-relaxed">
                  <p className="text-slate-200 font-medium">Controls</p>
                  <p>W / S · Accelerate & Brake</p>
                  <p>A / D · Steer · Space · Nitro</p>
                </div>
                <div className="hidden lg:block h-10 w-px bg-white/10" />
                <div className="w-36">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="inline-flex items-center gap-1 text-sky-400 font-medium">
                      <Zap className="w-3.5 h-3.5" />
                      {hud.boostFlash ? 'PAD BOOST' : 'Nitro'}
                    </span>
                    <span className="font-mono text-slate-200 tabular-nums">{hud.nitroPct}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-sky-400 transition-all duration-75"
                      style={{ width: `${hud.nitroPct}%` }}
                    />
                  </div>
                </div>
                <div className="text-right min-w-[92px]">
                  <p className="font-mono text-3xl font-bold text-white tabular-nums leading-none">{hud.speedKmh}</p>
                  <p className="text-[11px] text-slate-400 mt-1">KM/H</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Synchronized FIA Starting Lights Overlay */}
      {room.status === 'COUNTDOWN' && (
        <div
          className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-20 flex flex-col items-center ${
            isCompactLandscape ? 'top-14' : 'top-24 sm:top-28'
          }`}
        >
          <div className="flex items-center gap-2.5 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-4 rounded-xl bg-[#0B0F14]/95 border border-white/15">
            {[0, 1, 2, 3, 4].map((idx) => {
              const lit = idx < 6 - room.countdownStep;
              return (
                <div
                  key={idx}
                  className={`w-5 h-5 sm:w-7 sm:h-7 rounded-full border ${
                    lit ? 'bg-red-500 border-red-300 shadow-[0_0_16px_rgba(239,68,68,0.8)]' : 'bg-slate-800 border-slate-700'
                  }`}
                />
              );
            })}
          </div>
          <p className="mt-2 font-display text-xs sm:text-sm tracking-wide text-amber-300 bg-[#0B0F14]/90 px-3 py-1 rounded whitespace-nowrap">
            Hold throttle — Lights out in {room.countdownStep}
          </p>
        </div>
      )}

      {/* Checkered Flag Post-Race Modal */}
      {room.status === 'FINISHED' && finishedEvent && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 safe-race-inset overflow-y-auto">
          <div className="my-auto w-full max-w-md rounded-2xl bg-[#111722] border border-white/15 p-4 sm:p-6 text-center">
            <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2.5 sm:mb-4">
              <Flag className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <p className="text-xs text-slate-400">
              {finishedEvent.reason === 'forfeit'
                ? 'Last Racer Standing'
                : `Checkered Flag · ${finishedEvent.playerCount}-Driver Race · ${room.laps} Laps`}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
              {didWin ? 'Victory' : 'Race Complete'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 sm:mt-2">
              {finishedEvent.winnerName} won the {finishedEvent.playerCount}-car grid ahead of {finishedEvent.loserName} in{' '}
              <span className="font-mono text-white tabular-nums">{formatRaceTime(finishedEvent.winnerTimeMs)}</span>
            </p>

            <div className="mt-3 sm:mt-5 py-3 sm:py-4 px-4 rounded-xl bg-[#0B0F14] border border-white/10 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {didWin
                  ? 'Victory Bonus (Non-Withdrawable)'
                  : 'Free-to-Play Grid'}
              </span>
              <span
                className={`font-mono text-lg sm:text-xl font-bold tabular-nums ${
                  didWin ? 'text-amber-400' : 'text-slate-200'
                }`}
              >
                {didWin
                  ? `+${finishedEvent.isBotMatch ? 20 : 50} Coins`
                  : 'Free Race'}
              </span>
            </div>

            <div className="mt-4 sm:mt-6 flex items-center gap-3">
              <button
                onClick={onRematch}
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap"
              >
                Rematch
              </button>
              <button
                onClick={onLeaveRoom}
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-lg bg-white/8 hover:bg-white/14 text-white font-medium text-sm transition-colors whitespace-nowrap"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
