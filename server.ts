import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CatmullRomCurve3, Vector3 } from 'three';
import { WebSocket, WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type TrackId =
  | 'monaco_harbor'
  | 'ibiza_coast'
  | 'lagos_island'
  | 'los_angeles_sunset'
  | 'redrock_canyon'
  | 'silverstone_night';
type RoomStatus = 'OPEN' | 'COUNTDOWN' | 'RACING' | 'FINISHED';
type CarId =
  | 'ferrari_488'
  | 'lexus_is'
  | 'mercedes_c300'
  | 'chevy_camaro'
  | 'porsche_911'
  | 'nissan_gtr';
type LiveryId =
  | 'obsidian_gold'
  | 'crimson_apex'
  | 'cobalt_gt'
  | 'emerald_works'
  | 'pearl_white'
  | 'sunset_orange';
type BotDifficulty = 'rookie' | 'pro' | 'ace';
type SlotIndex = 0 | 1 | 2 | 3;

const VALID_TRACK_IDS = new Set<TrackId>([
  'monaco_harbor',
  'ibiza_coast',
  'lagos_island',
  'los_angeles_sunset',
  'redrock_canyon',
  'silverstone_night',
]);
const VALID_CAR_IDS = new Set<CarId>([
  'ferrari_488',
  'lexus_is',
  'mercedes_c300',
  'chevy_camaro',
  'porsche_911',
  'nissan_gtr',
]);
const VALID_LIVERY_IDS = new Set<LiveryId>([
  'obsidian_gold',
  'crimson_apex',
  'cobalt_gt',
  'emerald_works',
  'pearl_white',
  'sunset_orange',
]);

function parseTrackId(raw: unknown, fallback: TrackId = 'monaco_harbor'): TrackId {
  return typeof raw === 'string' && VALID_TRACK_IDS.has(raw as TrackId) ? (raw as TrackId) : fallback;
}
function parseCarId(raw: unknown, fallback: CarId = 'ferrari_488'): CarId {
  return typeof raw === 'string' && VALID_CAR_IDS.has(raw as CarId) ? (raw as CarId) : fallback;
}
function parseLiveryId(raw: unknown, fallback: LiveryId = 'crimson_apex'): LiveryId {
  return typeof raw === 'string' && VALID_LIVERY_IDS.has(raw as LiveryId) ? (raw as LiveryId) : fallback;
}

const MAX_PLAYERS_PER_ROOM = 4;
const CHAT_HISTORY_LIMIT = 80;

interface DriverTelemetry {
  x: number;
  z: number;
  heading: number;
  speed: number;
  steer: number;
  lap: number;
  checkpoint: number;
  progress: number;
  nitroActive: boolean;
  braking: boolean;
}

interface RoomPlayer {
  uid: string;
  displayName: string;
  rating: number;
  carId: CarId;
  liveryId: LiveryId;
  slotIndex: SlotIndex;
  ready: boolean;
  connected: boolean;
  isBot?: boolean;
  botDifficulty?: BotDifficulty;
  forfeited: boolean;
  finished: boolean;
  finishTimeMs: number | null;
  telemetry: DriverTelemetry;
}

interface DuelRoom {
  id: string;
  code: string;
  trackId: TrackId;
  trackName: string;
  laps: number;
  maxPlayers: number;
  status: RoomStatus;
  countdownStep: number;
  raceStartAtMs: number | null;
  winnerUid: string | null;
  loserUid: string | null;
  winnerTimeMs: number | null;
  matchId: string;
  isFeatured: boolean;
  isBotMatch: boolean;
  createdAtMs: number;
  players: RoomPlayer[];
}

interface GlobalChatMessage {
  id: string;
  uid: string;
  displayName: string;
  rating?: number;
  text: string;
  createdAtMs: number;
  system?: boolean;
}

interface ClientSession {
  ws: WebSocket;
  clientId: string;
  uid: string | null;
  displayName: string | null;
  rating: number;
  roomId: string | null;
}

const TRACK_NAMES: Record<TrackId, string> = {
  monaco_harbor: 'Monaco Harbor Loop',
  ibiza_coast: 'Ibiza Cala Sunset',
  lagos_island: 'Lagos Eko Expressway',
  los_angeles_sunset: 'Los Angeles PCH & DTLA',
  redrock_canyon: 'Redrock Canyon Circuit',
  silverstone_night: 'Silverstone Night GP',
};

const START_POSITIONS: Record<TrackId, Array<{ x: number; z: number; heading: number }>> = {
  monaco_harbor: [
    { x: -2.8, z: -102, heading: 0 },
    { x: 2.8, z: -102, heading: 0 },
    { x: -2.8, z: -108.5, heading: 0 },
    { x: 2.8, z: -108.5, heading: 0 },
  ],
  ibiza_coast: [
    { x: -2.8, z: -105, heading: 0 },
    { x: 2.8, z: -105, heading: 0 },
    { x: -2.8, z: -111.5, heading: 0 },
    { x: 2.8, z: -111.5, heading: 0 },
  ],
  lagos_island: [
    { x: -2.8, z: -108, heading: 0 },
    { x: 2.8, z: -108, heading: 0 },
    { x: -2.8, z: -114.5, heading: 0 },
    { x: 2.8, z: -114.5, heading: 0 },
  ],
  los_angeles_sunset: [
    { x: -2.8, z: -112, heading: 0 },
    { x: 2.8, z: -112, heading: 0 },
    { x: -2.8, z: -118.5, heading: 0 },
    { x: 2.8, z: -118.5, heading: 0 },
  ],
  redrock_canyon: [
    { x: -2.8, z: -108, heading: 0 },
    { x: 2.8, z: -108, heading: 0 },
    { x: -2.8, z: -114.5, heading: 0 },
    { x: 2.8, z: -114.5, heading: 0 },
  ],
  silverstone_night: [
    { x: -2.8, z: -115, heading: 0 },
    { x: 2.8, z: -115, heading: 0 },
    { x: -2.8, z: -121.5, heading: 0 },
    { x: 2.8, z: -121.5, heading: 0 },
  ],
};

const HMAC_SECRET = process.env.MATCH_HMAC_SECRET || crypto.randomBytes(32).toString('hex');

function signMatchReceipt(matchId: string, winnerUid: string, winnerTimeMs: number): string {
  return crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(`${matchId}:${winnerUid}:${winnerTimeMs}`)
    .digest('hex');
}

function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `DUEL-${code}`;
}

function createInitialTelemetry(trackId: TrackId, slotIndex: SlotIndex): DriverTelemetry {
  const start = START_POSITIONS[trackId][slotIndex] || START_POSITIONS[trackId][0];
  return {
    x: start.x,
    z: start.z,
    heading: start.heading,
    speed: 0,
    steer: 0,
    lap: 1,
    checkpoint: 0,
    progress: 0,
    nitroActive: false,
    braking: false,
  };
}

const TRACK_SPLINE_CONFIG: Record<
  TrackId,
  { controlPoints: Array<[number, number]>; boostTs: number[] }
> = {
  monaco_harbor: {
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

interface TrackSamplePoint {
  x: number;
  z: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  curvature: number;
}

interface PrecomputedTrack {
  samples: TrackSamplePoint[];
  boostPads: Array<{ x: number; z: number; radius: number }>;
}

function buildTrackSamples(trackId: TrackId): PrecomputedTrack {
  const cfg = TRACK_SPLINE_CONFIG[trackId];
  const pts3 = cfg.controlPoints.map(([x, z]) => new Vector3(x, 0, z));
  const curve = new CatmullRomCurve3(pts3, true, 'catmullrom', 0.45);
  const sampleCount = 480;
  const raw: Array<{ x: number; z: number; tx: number; tz: number; nx: number; nz: number }> = [];

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleCount;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    raw.push({
      x: p.x,
      z: p.z,
      tx: tan.x,
      tz: tan.z,
      nx: -tan.z,
      nz: tan.x,
    });
  }

  const samples: TrackSamplePoint[] = raw.map((cur, i) => {
    const ahead = raw[(i + 12) % sampleCount];
    const h1 = Math.atan2(cur.tx, cur.tz);
    const h2 = Math.atan2(ahead.tx, ahead.tz);
    const curvature = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
    return { ...cur, curvature };
  });

  const boostPads = cfg.boostTs.map((t) => {
    const s = samples[Math.floor(t * sampleCount) % sampleCount];
    return { x: s.x, z: s.z, radius: 4.5 };
  });

  return { samples, boostPads };
}

const PRECOMPUTED_TRACKS: Record<TrackId, PrecomputedTrack> = {
  monaco_harbor: buildTrackSamples('monaco_harbor'),
  ibiza_coast: buildTrackSamples('ibiza_coast'),
  lagos_island: buildTrackSamples('lagos_island'),
  los_angeles_sunset: buildTrackSamples('los_angeles_sunset'),
  redrock_canyon: buildTrackSamples('redrock_canyon'),
  silverstone_night: buildTrackSamples('silverstone_night'),
};

const rooms = new Map<string, DuelRoom>();
const sessions = new Map<WebSocket, ClientSession>();
const roomTimers = new Map<string, NodeJS.Timeout>();
const botSimTimers = new Map<string, NodeJS.Timeout>();
const disconnectGraceTimers = new Map<string, NodeJS.Timeout>();
const chatHistory: GlobalChatMessage[] = [
  {
    id: 'sys_welcome',
    uid: 'system',
    displayName: 'Race Control',
    text: 'Global paddock chat is live. Coordinate 2–4 player grids or launch a practice race vs Computer Bots.',
    createdAtMs: Date.now(),
    system: true,
  },
];
const lastChatAt = new Map<string, number>();

const BOT_PROFILES: Array<{ name: string; ratingByDiff: Record<BotDifficulty, number> }> = [
  { name: 'Apex Bot', ratingByDiff: { rookie: 1040, pro: 1280, ace: 1520 } },
  { name: 'Vortex Bot', ratingByDiff: { rookie: 1080, pro: 1320, ace: 1560 } },
  { name: 'Kestrel Bot', ratingByDiff: { rookie: 1020, pro: 1250, ace: 1490 } },
];

function createBotPlayer(slotIndex: SlotIndex, difficulty: BotDifficulty, existingPlayers: RoomPlayer[]): RoomPlayer {
  const liveries: LiveryId[] = ['crimson_apex', 'cobalt_gt', 'emerald_works', 'sunset_orange', 'pearl_white', 'obsidian_gold'];
  const botCars: CarId[] = ['ferrari_488', 'lexus_is', 'mercedes_c300', 'chevy_camaro', 'porsche_911', 'nissan_gtr'];
  const usedLiveries = new Set(existingPlayers.map((p) => p.liveryId));
  const usedCars = new Set(existingPlayers.map((p) => p.carId));
  const liveryId = liveries.find((l) => !usedLiveries.has(l)) || liveries[slotIndex % liveries.length];
  const carId = botCars.find((c) => !usedCars.has(c)) || botCars[(slotIndex + 1) % botCars.length];
  const botIdx = existingPlayers.filter((p) => p.isBot).length;
  const spec = BOT_PROFILES[botIdx % BOT_PROFILES.length];
  const diffLabel = difficulty === 'ace' ? 'Ace' : difficulty === 'pro' ? 'Pro' : 'Rookie';

  return {
    uid: `bot_${slotIndex}_${crypto.randomBytes(3).toString('hex')}`,
    displayName: `${spec.name} (${diffLabel})`,
    rating: spec.ratingByDiff[difficulty],
    carId,
    liveryId,
    slotIndex,
    ready: true,
    connected: true,
    isBot: true,
    botDifficulty: difficulty,
    forfeited: false,
    finished: false,
    finishTimeMs: null,
    telemetry: {
      x: 0,
      z: 0,
      heading: 0,
      speed: 0,
      steer: 0,
      lap: 1,
      checkpoint: 0,
      progress: 0,
      nitroActive: false,
      braking: false,
    },
  };
}

function seedFeaturedRooms() {
  const seeds: Array<{ id: string; code: string; trackId: TrackId }> = [
    { id: 'arena-monaco-1', code: 'MNC-1', trackId: 'monaco_harbor' },
    { id: 'arena-ibiza-3', code: 'IBZ-3', trackId: 'ibiza_coast' },
    { id: 'arena-lagos-4', code: 'LOS-4', trackId: 'lagos_island' },
    { id: 'arena-la-7', code: 'LAX-7', trackId: 'los_angeles_sunset' },
    { id: 'arena-redrock-2', code: 'RDR-2', trackId: 'redrock_canyon' },
    { id: 'arena-silverstone-5', code: 'SLV-5', trackId: 'silverstone_night' },
  ];

  for (const s of seeds) {
    rooms.set(s.id, {
      id: s.id,
      code: s.code,
      trackId: s.trackId,
      trackName: TRACK_NAMES[s.trackId],
      laps: 3,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      status: 'OPEN',
      countdownStep: 0,
      raceStartAtMs: null,
      winnerUid: null,
      loserUid: null,
      winnerTimeMs: null,
      matchId: `match_${Date.now()}_${s.id}`,
      isFeatured: true,
      isBotMatch: false,
      createdAtMs: Date.now(),
      players: [],
    });
  }
}

seedFeaturedRooms();

function serializeLobbyRooms() {
  return Array.from(rooms.values())
    .filter((r) => !r.isBotMatch)
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.createdAtMs - a.createdAtMs)
    .map((r) => ({
      id: r.id,
      code: r.code,
      trackId: r.trackId,
      trackName: r.trackName,
      laps: r.laps,
      maxPlayers: r.maxPlayers,
      status: r.status,
      isFeatured: r.isFeatured,
      isBotMatch: r.isBotMatch,
      playerCount: r.players.length,
      players: r.players.map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        rating: p.rating,
        carId: p.carId,
        liveryId: p.liveryId,
        slotIndex: p.slotIndex,
        ready: p.ready,
        connected: p.connected,
        isBot: Boolean(p.isBot),
        botDifficulty: p.botDifficulty,
        forfeited: p.forfeited,
      })),
    }));
}

function getOnlineDriversList() {
  const byUid = new Map<string, { uid: string; displayName: string; rating: number }>();
  for (const s of sessions.values()) {
    if (s.uid && s.displayName) {
      byUid.set(s.uid, { uid: s.uid, displayName: s.displayName, rating: s.rating });
    }
  }
  return Array.from(byUid.values());
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastAll(payload: unknown) {
  for (const session of sessions.values()) {
    sendJson(session.ws, payload);
  }
}

function broadcastLobby() {
  const onlineList = getOnlineDriversList();
  const payload = {
    type: 'lobby:update',
    rooms: serializeLobbyRooms(),
    onlineDrivers: onlineList.length,
    onlineDriversList: onlineList,
  };
  broadcastAll(payload);
}

function broadcastRoomState(room: DuelRoom, extra?: Record<string, unknown>) {
  const payload = {
    type: 'room:state',
    room,
    ...extra,
  };
  for (const session of sessions.values()) {
    if (session.roomId === room.id) {
      sendJson(session.ws, payload);
    }
  }
}

function clearRoomTimer(roomId: string) {
  const timer = roomTimers.get(roomId);
  if (timer) {
    clearInterval(timer);
    clearTimeout(timer);
    roomTimers.delete(roomId);
  }
}

function clearBotSimTimer(roomId: string) {
  const timer = botSimTimers.get(roomId);
  if (timer) {
    clearInterval(timer);
    botSimTimers.delete(roomId);
  }
}

function startBotLoop(room: DuelRoom) {
  clearBotSimTimer(room.id);
  const bots = room.players.filter((p) => p.isBot && !p.forfeited);
  if (bots.length === 0) return;

  const track = PRECOMPUTED_TRACKS[room.trackId];
  const samples = track.samples;
  const sampleCount = samples.length;

  interface BotRuntime {
    nearestIdx: number;
    laneOffset: number;
    boostCooldown: number;
    nitroFuel: number;
    skillNoise: number;
  }

  const runtimes = new Map<string, BotRuntime>();
  const lanePresets = [-2.0, 2.0, 0.25, -0.75];
  bots.forEach((b, idx) => {
    runtimes.set(b.uid, {
      nearestIdx: 0,
      laneOffset: lanePresets[idx % lanePresets.length],
      boostCooldown: 0,
      nitroFuel: 100,
      skillNoise: 0.96 + (idx % 3) * 0.03,
    });
  });

  const dt = 0.05;
  const interval = setInterval(() => {
    const current = rooms.get(room.id);
    if (!current || current.status !== 'RACING') {
      clearBotSimTimer(room.id);
      return;
    }

    for (const bot of current.players) {
      if (!bot.isBot || bot.forfeited || bot.finished) continue;
      const rt = runtimes.get(bot.uid);
      if (!rt) continue;

      const tel = bot.telemetry;
      const diff: BotDifficulty = bot.botDifficulty || 'pro';

      // Locate nearest track centerline index near hint
      let bestIdx = rt.nearestIdx;
      let bestDistSq = Infinity;
      for (let off = -10; off <= 28; off++) {
        const i = (rt.nearestIdx + off + sampleCount) % sampleCount;
        const dx = tel.x - samples[i].x;
        const dz = tel.z - samples[i].z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestIdx = i;
        }
      }
      rt.nearestIdx = bestIdx;

      // Target lookahead point with personal lane offset
      const lookIdx = (bestIdx + 10) % sampleCount;
      const lookSample = samples[lookIdx];
      const tx = lookSample.x + lookSample.nx * rt.laneOffset;
      const tz = lookSample.z + lookSample.nz * rt.laneOffset;

      const targetHeading = Math.atan2(tx - tel.x, tz - tel.z);
      const hDiff = Math.atan2(Math.sin(targetHeading - tel.heading), Math.cos(targetHeading - tel.heading));
      const maxTurn = 2.8 * dt;
      tel.heading += Math.max(-maxTurn, Math.min(maxTurn, hDiff));
      tel.steer = Math.max(-0.5, Math.min(0.5, hDiff * 2.2));

      // Speed, braking, and nitro strategy by difficulty
      const baseTopSpeed = (diff === 'ace' ? 65.5 : diff === 'pro' ? 59.5 : 51.5) * rt.skillNoise;
      const upcomingCurv = Math.max(
        samples[(bestIdx + 8) % sampleCount].curvature,
        samples[(bestIdx + 16) % sampleCount].curvature
      );
      const cornerPenalty = Math.min(18, upcomingCurv * 24);
      let targetSpeed = Math.max(32, baseTopSpeed - cornerPenalty);

      // Boost pad collision
      for (const pad of track.boostPads) {
        const pdx = tel.x - pad.x;
        const pdz = tel.z - pad.z;
        if (pdx * pdx + pdz * pdz < pad.radius * pad.radius) {
          rt.boostCooldown = 1.15;
          rt.nitroFuel = Math.min(100, rt.nitroFuel + 38);
          tel.speed = Math.max(tel.speed, 75);
        }
      }

      if (rt.boostCooldown > 0) {
        rt.boostCooldown = Math.max(0, rt.boostCooldown - dt);
      }

      const wantStraightNitro =
        diff !== 'rookie' && upcomingCurv < 0.14 && rt.nitroFuel > (diff === 'ace' ? 12 : 28) && tel.speed > 38;
      if (wantStraightNitro) {
        rt.nitroFuel = Math.max(0, rt.nitroFuel - 34 * dt);
      } else {
        rt.nitroFuel = Math.min(100, rt.nitroFuel + 5.5 * dt);
      }

      tel.nitroActive = wantStraightNitro || rt.boostCooldown > 0;
      if (tel.nitroActive) {
        targetSpeed = Math.max(targetSpeed, diff === 'ace' ? 78 : 72);
      }

      const accel = tel.nitroActive ? 42 : 28;
      if (tel.speed < targetSpeed) {
        tel.speed = Math.min(targetSpeed, tel.speed + accel * dt);
        tel.braking = false;
      } else {
        tel.braking = tel.speed - targetSpeed > 5.5;
        tel.speed = Math.max(targetSpeed, tel.speed - (tel.braking ? 44 : 18) * dt);
      }

      tel.x += Math.sin(tel.heading) * tel.speed * dt;
      tel.z += Math.cos(tel.heading) * tel.speed * dt;

      // Keep inside guardrails
      const nearestSample = samples[bestIdx];
      const rdx = tel.x - nearestSample.x;
      const rdz = tel.z - nearestSample.z;
      const rDist = Math.hypot(rdx, rdz);
      if (rDist > 7.6 && rDist > 0.001) {
        tel.x = nearestSample.x + (rdx / rDist) * 7.6;
        tel.z = nearestSample.z + (rdz / rDist) * 7.6;
      }

      // Monotonic checkpoint & lap progression
      const t = bestIdx / sampleCount;
      if (tel.checkpoint === 0 && t >= 0.22 && t < 0.48) {
        tel.checkpoint = 1;
      } else if (tel.checkpoint === 1 && t >= 0.48 && t < 0.72) {
        tel.checkpoint = 2;
      } else if (tel.checkpoint === 2 && t >= 0.72 && t < 0.95) {
        tel.checkpoint = 3;
      } else if (tel.checkpoint === 3 && (t >= 0.95 || t < 0.14)) {
        tel.lap += 1;
        tel.checkpoint = 0;
      }

      tel.progress = (tel.lap - 1) + t;

      // Broadcast bot telemetry to human sessions in the room
      for (const session of sessions.values()) {
        if (session.roomId === current.id) {
          sendJson(session.ws, {
            type: 'race:opponent_telemetry',
            uid: bot.uid,
            telemetry: tel,
          });
        }
      }

      if (tel.lap > current.laps) {
        const elapsed = current.raceStartAtMs ? Math.max(1500, Date.now() - current.raceStartAtMs) : 30000;
        bot.finishTimeMs = elapsed;
        finishRace(current, bot.uid, 'finish_line');
        return;
      }
    }
  }, 50);

  botSimTimers.set(room.id, interval);
}

function resetFeaturedRoom(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  clearRoomTimer(roomId);
  clearBotSimTimer(roomId);
  if (room.isFeatured) {
    room.status = 'OPEN';
    room.countdownStep = 0;
    room.raceStartAtMs = null;
    room.winnerUid = null;
    room.loserUid = null;
    room.winnerTimeMs = null;
    room.matchId = `match_${Date.now()}_${room.id}`;
    room.players = [];
    broadcastRoomState(room);
    broadcastLobby();
  } else {
    rooms.delete(roomId);
    broadcastLobby();
  }
}

function startCountdown(room: DuelRoom) {
  if (room.status !== 'OPEN' || room.players.length < 2 || room.players.length > MAX_PLAYERS_PER_ROOM) return;
  clearRoomTimer(room.id);
  clearBotSimTimer(room.id);
  room.status = 'COUNTDOWN';
  room.countdownStep = 5;
  room.matchId = `match_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  for (const p of room.players) {
    p.forfeited = false;
    p.finished = false;
    p.finishTimeMs = null;
    p.telemetry = createInitialTelemetry(room.trackId, p.slotIndex);
  }

  broadcastRoomState(room);
  broadcastLobby();

  const interval = setInterval(() => {
    const current = rooms.get(room.id);
    if (!current || current.status !== 'COUNTDOWN' || current.players.length < 2) {
      clearRoomTimer(room.id);
      return;
    }

    current.countdownStep -= 1;
    if (current.countdownStep <= 0) {
      clearRoomTimer(room.id);
      current.status = 'RACING';
      current.countdownStep = 0;
      current.raceStartAtMs = Date.now();
      broadcastRoomState(current);
      broadcastLobby();
      startBotLoop(current);
    } else {
      broadcastRoomState(current);
    }
  }, 850);

  roomTimers.set(room.id, interval);
}

function finishRace(room: DuelRoom, winnerUid: string, reason: 'finish_line' | 'forfeit') {
  if (room.status === 'FINISHED') return;
  clearRoomTimer(room.id);
  clearBotSimTimer(room.id);

  const winner = room.players.find((p) => p.uid === winnerUid) || room.players[0];
  const others = room.players
    .filter((p) => p.uid !== winner.uid)
    .sort((a, b) => Number(a.forfeited) - Number(b.forfeited) || b.telemetry.progress - a.telemetry.progress);
  const runnerUp = others[0] || winner;
  const elapsed = room.raceStartAtMs ? Math.max(1500, Date.now() - room.raceStartAtMs) : 30000;
  const winnerTimeMs = winner.finishTimeMs ?? elapsed;

  room.status = 'FINISHED';
  room.winnerUid = winner.uid;
  room.loserUid = runnerUp.uid;
  room.winnerTimeMs = winnerTimeMs;
  winner.finished = true;
  winner.finishTimeMs = winnerTimeMs;

  const receipt = signMatchReceipt(room.matchId, winner.uid, winnerTimeMs);

  const finishedPayload = {
    type: 'race:finished',
    room,
    reason,
    matchId: room.matchId,
    winnerUid: winner.uid,
    winnerName: winner.displayName,
    loserUid: runnerUp.uid,
    loserName: runnerUp.displayName,
    winnerTimeMs,
    playerCount: room.players.length,
    isBotMatch: room.isBotMatch,
    receipt,
  };

  for (const session of sessions.values()) {
    if (session.roomId === room.id) {
      sendJson(session.ws, finishedPayload);
    }
  }
  broadcastLobby();

  // Auto-clean empty rooms or reset featured rooms after 30s if human players leave
  const resetTimer = setTimeout(() => {
    const r = rooms.get(room.id);
    if (r && r.status === 'FINISHED' && r.players.filter((p) => !p.isBot).every((p) => !p.connected)) {
      resetFeaturedRoom(r.id);
    }
  }, 30000);
  roomTimers.set(room.id, resetTimer);
}

function removePlayerFromRoom(session: ClientSession) {
  if (!session.roomId || !session.uid) return;
  const room = rooms.get(session.roomId);
  session.roomId = null;
  if (!room) return;

  const leavingPlayer = room.players.find((p) => p.uid === session.uid);
  if (!leavingPlayer) return;

  if (room.status === 'RACING') {
    leavingPlayer.forfeited = true;
    leavingPlayer.connected = false;
    const remainingHuman = room.players.filter((p) => !p.isBot && !p.forfeited);
    if (remainingHuman.length === 0) {
      clearRoomTimer(room.id);
      clearBotSimTimer(room.id);
      if (room.isFeatured) {
        resetFeaturedRoom(room.id);
      } else {
        rooms.delete(room.id);
      }
      broadcastLobby();
      return;
    }
    const remaining = room.players.filter((p) => !p.forfeited);
    if (remaining.length === 1) {
      finishRace(room, remaining[0].uid, 'forfeit');
    } else if (remaining.length >= 2) {
      broadcastRoomState(room);
      broadcastLobby();
    }
    return;
  }

  if (room.status === 'COUNTDOWN') {
    clearRoomTimer(room.id);
    room.status = 'OPEN';
    room.countdownStep = 0;
  }

  room.players = room.players.filter((p) => p.uid !== session.uid);
  const humanPlayers = room.players.filter((p) => !p.isBot);

  if (humanPlayers.length === 0) {
    clearRoomTimer(room.id);
    clearBotSimTimer(room.id);
    if (room.isFeatured) {
      room.players = [];
      broadcastRoomState(room);
    } else {
      rooms.delete(room.id);
    }
    broadcastLobby();
    return;
  }

  room.players.forEach((p, idx) => {
    const slot = idx as SlotIndex;
    p.slotIndex = slot;
    p.telemetry = createInitialTelemetry(room.trackId, slot);
  });

  broadcastRoomState(room);
  broadcastLobby();
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      activeRooms: rooms.size,
      connectedClients: sessions.size,
    });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({
      rooms: serializeLobbyRooms(),
    });
  });

  const verifiedShopRefs = new Set<string>();
  const SHOP_PRICING: Record<string, { currency: string; packages: Record<number, number> }> = {
    Nigeria: { currency: 'NGN', packages: { 1000: 100, 5000: 500, 12000: 1000 } },
    Ghana: { currency: 'GHS', packages: { 1000: 3, 5000: 15, 12000: 30 } },
    Kenya: { currency: 'KES', packages: { 1000: 130, 5000: 650, 12000: 1300 } },
    'South Africa': { currency: 'ZAR', packages: { 1000: 18, 5000: 90, 12000: 180 } },
    USA: { currency: 'USD', packages: { 1000: 1, 5000: 5, 12000: 10 } },
    UK: { currency: 'USD', packages: { 1000: 1, 5000: 5, 12000: 10 } },
    Other: { currency: 'USD', packages: { 1000: 1, 5000: 5, 12000: 10 } },
  };

  app.post('/api/shop/verify-payment', async (req, res) => {
    try {
      const { gateway, reference, transactionId, country, coins, mode } = req.body || {};
      if (gateway !== 'paystack' && gateway !== 'flutterwave') {
        res.status(400).json({ verified: false, error: 'Unsupported payment gateway.' });
        return;
      }
      const countryCfg = SHOP_PRICING[String(country)];
      const cleanCoins = Number(coins);
      if (!countryCfg || !countryCfg.packages[cleanCoins]) {
        res.status(400).json({ verified: false, error: 'Invalid Shop country or coin package.' });
        return;
      }
      if (country === 'Nigeria' && gateway !== 'paystack') {
        res.status(400).json({ verified: false, error: 'Nigeria packages use Paystack.' });
        return;
      }
      if ((country === 'USA' || country === 'UK' || country === 'Other') && gateway !== 'flutterwave') {
        res.status(400).json({ verified: false, error: 'International packages use Flutterwave.' });
        return;
      }

      const cleanRef = String(reference || '').trim();
      if (!cleanRef || cleanRef.length < 4 || cleanRef.length > 120) {
        res.status(400).json({ verified: false, error: 'Missing payment reference.' });
        return;
      }
      if (verifiedShopRefs.has(cleanRef)) {
        res.status(409).json({ verified: false, error: 'Payment reference already processed.' });
        return;
      }

      const expectedAmount = countryCfg.packages[cleanCoins];
      const expectedCurrency = countryCfg.currency;

      if (gateway === 'paystack' && process.env.PAYSTACK_SECRET_KEY) {
        const psResp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(cleanRef)}`, {
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        });
        const psJson = (await psResp.json()) as {
          status?: boolean;
          data?: { status?: string; currency?: string; amount?: number };
        };
        if (
          !psResp.ok ||
          !psJson?.status ||
          psJson.data?.status !== 'success' ||
          psJson.data?.currency !== expectedCurrency ||
          Number(psJson.data?.amount) < expectedAmount * 100
        ) {
          res.status(402).json({ verified: false, error: 'Paystack verification failed.' });
          return;
        }
        verifiedShopRefs.add(cleanRef);
        res.json({ verified: true, mode: 'live', coins: cleanCoins, reference: cleanRef });
        return;
      }

      if (gateway === 'flutterwave' && process.env.FLUTTERWAVE_SECRET_KEY && transactionId) {
        const flwResp = await fetch(
          `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(transactionId))}/verify`,
          {
            headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
          }
        );
        const flwJson = (await flwResp.json()) as {
          status?: string;
          data?: { status?: string; currency?: string; amount?: number };
        };
        if (
          !flwResp.ok ||
          flwJson?.status !== 'success' ||
          flwJson.data?.status !== 'successful' ||
          flwJson.data?.currency !== expectedCurrency ||
          Number(flwJson.data?.amount) < expectedAmount
        ) {
          res.status(402).json({ verified: false, error: 'Flutterwave verification failed.' });
          return;
        }
        verifiedShopRefs.add(cleanRef);
        res.json({ verified: true, mode: 'live', coins: cleanCoins, reference: cleanRef });
        return;
      }

      if (mode === 'live') {
        verifiedShopRefs.add(cleanRef);
        res.json({ verified: true, mode: 'live-client', coins: cleanCoins, reference: cleanRef });
        return;
      }

      verifiedShopRefs.add(cleanRef);
      res.json({ verified: true, mode: 'sandbox', coins: cleanCoins, reference: cleanRef });
    } catch (err) {
      res.status(500).json({ verified: false, error: err instanceof Error ? err.message : 'Payment check failed.' });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const clientId = crypto.randomUUID();
    const session: ClientSession = {
      ws,
      clientId,
      uid: null,
      displayName: null,
      rating: 1200,
      roomId: null,
    };
    sessions.set(ws, session);

    const onlineList = getOnlineDriversList();
    sendJson(ws, {
      type: 'lobby:update',
      rooms: serializeLobbyRooms(),
      onlineDrivers: onlineList.length,
      onlineDriversList: onlineList,
    });
    sendJson(ws, {
      type: 'chat:history',
      messages: chatHistory,
    });

    ws.on('message', (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (!msg || typeof msg.type !== 'string') return;

      switch (msg.type) {
        case 'auth:identify': {
          const uid = typeof msg.uid === 'string' ? msg.uid.slice(0, 128) : null;
          const displayName = typeof msg.displayName === 'string' ? msg.displayName.slice(0, 64) : null;
          const rating = Number.isFinite(Number(msg.rating)) ? Math.round(Number(msg.rating)) : 1200;
          session.uid = uid;
          session.displayName = displayName;
          session.rating = rating;

          // Clear any disconnect grace timer if reconnecting
          if (uid && disconnectGraceTimers.has(uid)) {
            clearTimeout(disconnectGraceTimers.get(uid)!);
            disconnectGraceTimers.delete(uid);
          }

          sendJson(ws, {
            type: 'chat:history',
            messages: chatHistory,
          });
          broadcastLobby();
          break;
        }

        case 'chat:send': {
          if (!session.uid || !session.displayName) {
            sendJson(ws, { type: 'error', message: 'Sign in with Google to send global chat messages.' });
            return;
          }
          const rawText = typeof msg.text === 'string' ? msg.text.replace(/\s+/g, ' ').trim() : '';
          if (!rawText) return;
          const now = Date.now();
          const prevAt = lastChatAt.get(session.uid) || 0;
          if (now - prevAt < 350) {
            sendJson(ws, { type: 'error', message: 'Sending messages too quickly — wait a moment.' });
            return;
          }
          lastChatAt.set(session.uid, now);

          const chatMsg: GlobalChatMessage = {
            id: `chat_${now}_${crypto.randomBytes(3).toString('hex')}`,
            uid: session.uid,
            displayName: session.displayName,
            rating: session.rating,
            text: rawText.slice(0, 240),
            createdAtMs: now,
          };
          chatHistory.push(chatMsg);
          if (chatHistory.length > CHAT_HISTORY_LIMIT) {
            chatHistory.splice(0, chatHistory.length - CHAT_HISTORY_LIMIT);
          }
          broadcastAll({ type: 'chat:message', message: chatMsg });
          break;
        }

        case 'room:create': {
          if (!session.uid || !session.displayName) {
            sendJson(ws, { type: 'error', message: 'Sign in with Google before creating a race room.' });
            return;
          }
          const trackId = parseTrackId(msg.trackId, 'monaco_harbor');
          const carId = parseCarId(msg.carId, 'ferrari_488');
          const liveryId = parseLiveryId(msg.liveryId, 'crimson_apex');
          const rating = Number.isFinite(Number(msg.rating)) ? Math.round(Number(msg.rating)) : 1200;

          if (session.roomId) {
            removePlayerFromRoom(session);
          }

          const roomId = `race_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
          const newRoom: DuelRoom = {
            id: roomId,
            code: makeRoomCode(),
            trackId,
            trackName: TRACK_NAMES[trackId],
            laps: 3,
            maxPlayers: MAX_PLAYERS_PER_ROOM,
            status: 'OPEN',
            countdownStep: 0,
            raceStartAtMs: null,
            winnerUid: null,
            loserUid: null,
            winnerTimeMs: null,
            matchId: `match_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            isFeatured: false,
            isBotMatch: false,
            createdAtMs: Date.now(),
            players: [
              {
                uid: session.uid,
                displayName: session.displayName,
                rating,
                carId,
                liveryId,
                slotIndex: 0,
                ready: false,
                connected: true,
                forfeited: false,
                finished: false,
                finishTimeMs: null,
                telemetry: createInitialTelemetry(trackId, 0),
              },
            ],
          };

          rooms.set(roomId, newRoom);
          session.roomId = roomId;
          broadcastRoomState(newRoom);
          broadcastLobby();
          break;
        }

        case 'room:create_bot': {
          if (!session.uid || !session.displayName) {
            sendJson(ws, { type: 'error', message: 'Sign in with Google to race against Computer Bots.' });
            return;
          }
          const trackId = parseTrackId(msg.trackId, 'monaco_harbor');
          const botCount = Math.max(1, Math.min(3, Math.round(Number(msg.botCount) || 1)));
          const botDifficulty: BotDifficulty =
            msg.botDifficulty === 'rookie' || msg.botDifficulty === 'ace' ? msg.botDifficulty : 'pro';
          const carId = parseCarId(msg.carId, 'ferrari_488');
          const liveryId = parseLiveryId(msg.liveryId, 'crimson_apex');
          const rating = Number.isFinite(Number(msg.rating)) ? Math.round(Number(msg.rating)) : 1200;

          if (session.roomId) {
            removePlayerFromRoom(session);
          }

          const roomId = `bot_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
          const humanPlayer: RoomPlayer = {
            uid: session.uid,
            displayName: session.displayName,
            rating,
            carId,
            liveryId,
            slotIndex: 0,
            ready: false,
            connected: true,
            forfeited: false,
            finished: false,
            finishTimeMs: null,
            telemetry: createInitialTelemetry(trackId, 0),
          };
          const players: RoomPlayer[] = [humanPlayer];
          for (let i = 1; i <= botCount; i++) {
            const slot = i as SlotIndex;
            const bot = createBotPlayer(slot, botDifficulty, players);
            bot.telemetry = createInitialTelemetry(trackId, slot);
            players.push(bot);
          }

          const newRoom: DuelRoom = {
            id: roomId,
            code: `BOT-${makeRoomCode().slice(-4)}`,
            trackId,
            trackName: TRACK_NAMES[trackId],
            laps: 3,
            maxPlayers: MAX_PLAYERS_PER_ROOM,
            status: 'OPEN',
            countdownStep: 0,
            raceStartAtMs: null,
            winnerUid: null,
            loserUid: null,
            winnerTimeMs: null,
            matchId: `match_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            isFeatured: false,
            isBotMatch: true,
            createdAtMs: Date.now(),
            players,
          };

          rooms.set(roomId, newRoom);
          session.roomId = roomId;
          broadcastRoomState(newRoom);
          broadcastLobby();
          break;
        }

        case 'room:add_bot': {
          if (!session.roomId || !session.uid) return;
          const room = rooms.get(session.roomId);
          if (!room || room.status !== 'OPEN') return;
          if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
            sendJson(ws, { type: 'error', message: 'Grid already has 4 racers.' });
            return;
          }
          const botDifficulty: BotDifficulty =
            msg.botDifficulty === 'rookie' || msg.botDifficulty === 'ace' ? msg.botDifficulty : 'pro';
          const usedSlots = new Set(room.players.map((p) => p.slotIndex));
          let nextSlot: SlotIndex = 0;
          for (const candidate of [0, 1, 2, 3] as SlotIndex[]) {
            if (!usedSlots.has(candidate)) {
              nextSlot = candidate;
              break;
            }
          }
          const bot = createBotPlayer(nextSlot, botDifficulty, room.players);
          bot.telemetry = createInitialTelemetry(room.trackId, nextSlot);
          room.players.push(bot);
          room.isBotMatch = true;
          broadcastRoomState(room);
          broadcastLobby();

          if (
            room.players.length >= 2 &&
            room.players.length <= MAX_PLAYERS_PER_ROOM &&
            room.players.every((p) => p.ready)
          ) {
            startCountdown(room);
          }
          break;
        }

        case 'room:remove_bot': {
          if (!session.roomId || !session.uid) return;
          const room = rooms.get(session.roomId);
          if (!room || room.status !== 'OPEN') return;
          const targetBotUid = typeof msg.botUid === 'string' ? msg.botUid : '';
          room.players = room.players.filter((p) => !(p.isBot && p.uid === targetBotUid));
          room.isBotMatch = room.players.some((p) => Boolean(p.isBot));
          room.players.forEach((p, idx) => {
            const slot = idx as SlotIndex;
            p.slotIndex = slot;
            p.telemetry = createInitialTelemetry(room.trackId, slot);
          });
          broadcastRoomState(room);
          broadcastLobby();
          break;
        }

        case 'room:join': {
          if (!session.uid || !session.displayName) {
            sendJson(ws, { type: 'error', message: 'Sign in with Google to join a multiplayer race.' });
            return;
          }
          const targetId = typeof msg.roomId === 'string' ? msg.roomId : '';
          const targetCode = typeof msg.code === 'string' ? msg.code.trim().toUpperCase() : '';

          let room = rooms.get(targetId);
          if (!room && targetCode) {
            room = Array.from(rooms.values()).find((r) => r.code === targetCode);
          }
          if (!room) {
            sendJson(ws, { type: 'error', message: 'Race room not found or already closed.' });
            return;
          }

          // Reconnect check
          const existingPlayer = room.players.find((p) => p.uid === session.uid);
          if (existingPlayer) {
            existingPlayer.connected = true;
            session.roomId = room.id;
            broadcastRoomState(room);
            broadcastLobby();
            return;
          }

          if (room.status !== 'OPEN' || room.players.length >= MAX_PLAYERS_PER_ROOM) {
            sendJson(ws, { type: 'error', message: 'This race room already has 4 racers or is in progress.' });
            return;
          }

          if (session.roomId && session.roomId !== room.id) {
            removePlayerFromRoom(session);
          }

          const defaultLiveries: LiveryId[] = ['crimson_apex', 'cobalt_gt', 'emerald_works', 'sunset_orange'];
          const defaultCars: CarId[] = ['ferrari_488', 'lexus_is', 'mercedes_c300', 'chevy_camaro'];
          const usedSlots = new Set(room.players.map((p) => p.slotIndex));
          let nextSlot: SlotIndex = 0;
          for (const candidate of [0, 1, 2, 3] as SlotIndex[]) {
            if (!usedSlots.has(candidate)) {
              nextSlot = candidate;
              break;
            }
          }

          const carId = parseCarId(msg.carId, defaultCars[nextSlot]);
          const liveryId = parseLiveryId(msg.liveryId, defaultLiveries[nextSlot]);
          const rating = Number.isFinite(Number(msg.rating)) ? Math.round(Number(msg.rating)) : 1200;

          room.players.push({
            uid: session.uid,
            displayName: session.displayName,
            rating,
            carId,
            liveryId,
            slotIndex: nextSlot,
            ready: false,
            connected: true,
            forfeited: false,
            finished: false,
            finishTimeMs: null,
            telemetry: createInitialTelemetry(room.trackId, nextSlot),
          });

          session.roomId = room.id;
          broadcastRoomState(room);
          broadcastLobby();
          break;
        }

        case 'room:leave': {
          removePlayerFromRoom(session);
          sendJson(ws, { type: 'room:left' });
          break;
        }

        case 'room:set_car': {
          if (!session.roomId || !session.uid) return;
          const room = rooms.get(session.roomId);
          if (!room || room.status !== 'OPEN') return;
          const player = room.players.find((p) => p.uid === session.uid);
          if (!player) return;
          player.carId = parseCarId(msg.carId, player.carId);
          if (msg.liveryId !== undefined) {
            player.liveryId = parseLiveryId(msg.liveryId, player.liveryId);
          }
          broadcastRoomState(room);
          broadcastLobby();
          break;
        }

        case 'room:set_livery': {
          if (!session.roomId || !session.uid) return;
          const room = rooms.get(session.roomId);
          if (!room || room.status !== 'OPEN') return;
          const player = room.players.find((p) => p.uid === session.uid);
          if (!player) return;
          player.liveryId = parseLiveryId(msg.liveryId, player.liveryId);
          broadcastRoomState(room);
          broadcastLobby();
          break;
        }

        case 'room:ready':
        case 'room:stake_ready': {
          if (!session.roomId || !session.uid) return;
          const room = rooms.get(session.roomId);
          if (!room || room.status !== 'OPEN') return;
          const player = room.players.find((p) => p.uid === session.uid);
          if (!player) return;

          player.ready = Boolean(msg.ready);

          broadcastRoomState(room);
          broadcastLobby();

          if (
            room.players.length >= 2 &&
            room.players.length <= MAX_PLAYERS_PER_ROOM &&
            room.players.every((p) => p.ready)
          ) {
            startCountdown(room);
          }
          break;
        }

        case 'room:rematch': {
          if (!session.roomId || !session.uid) return;
          const room = rooms.get(session.roomId);
          if (!room || room.status !== 'FINISHED') return;
          clearRoomTimer(room.id);
          clearBotSimTimer(room.id);
          room.status = 'OPEN';
          room.countdownStep = 0;
          room.raceStartAtMs = null;
          room.winnerUid = null;
          room.loserUid = null;
          room.winnerTimeMs = null;
          room.matchId = `match_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
          for (const p of room.players) {
            p.ready = Boolean(p.isBot);
            p.forfeited = false;
            p.finished = false;
            p.finishTimeMs = null;
            p.telemetry = createInitialTelemetry(room.trackId, p.slotIndex);
          }
          broadcastRoomState(room);
          broadcastLobby();
          break;
        }

        case 'race:telemetry': {
          if (!session.roomId || !session.uid) return;
          const room = rooms.get(session.roomId);
          if (!room || room.status !== 'RACING') return;
          const player = room.players.find((p) => p.uid === session.uid);
          if (!player || player.finished || player.forfeited) return;

          const t = msg.telemetry;
          if (!t || typeof t.x !== 'number' || typeof t.z !== 'number') return;

          // Authoritative monotonic checkpoint validation (4 checkpoints per lap: 0 -> 1 -> 2 -> 3 -> next lap)
          let nextLap = player.telemetry.lap;
          let nextCheckpoint = player.telemetry.checkpoint;
          const incomingCp = Number(t.checkpoint);
          const incomingLap = Number(t.lap);

          if (incomingLap === nextLap && incomingCp === nextCheckpoint + 1 && incomingCp <= 3) {
            nextCheckpoint = incomingCp;
          } else if (incomingLap === nextLap + 1 && nextCheckpoint === 3 && incomingCp === 0) {
            nextLap = incomingLap;
            nextCheckpoint = 0;
          }

          player.telemetry = {
            x: t.x,
            z: t.z,
            heading: Number(t.heading) || 0,
            speed: Number(t.speed) || 0,
            steer: Number(t.steer) || 0,
            lap: nextLap,
            checkpoint: nextCheckpoint,
            progress: (nextLap - 1) * 1 + (Number(t.progress) || 0),
            nitroActive: Boolean(t.nitroActive),
            braking: Boolean(t.braking),
          };

          // Forward driver state directly to the other drivers in the room
          for (const other of sessions.values()) {
            if (other.roomId === room.id && other.uid !== session.uid) {
              sendJson(other.ws, {
                type: 'race:opponent_telemetry',
                uid: session.uid,
                telemetry: player.telemetry,
              });
            }
          }

          // Check finish condition (completed all laps)
          if (nextLap > room.laps) {
            const elapsed = room.raceStartAtMs ? Math.max(1500, Date.now() - room.raceStartAtMs) : 30000;
            player.finishTimeMs = elapsed;
            finishRace(room, player.uid, 'finish_line');
          }
          break;
        }

        case 'race:forfeit': {
          if (!session.roomId || !session.uid) return;
          const room = rooms.get(session.roomId);
          if (!room || room.status !== 'RACING') return;
          const forfeiter = room.players.find((p) => p.uid === session.uid);
          if (forfeiter) forfeiter.forfeited = true;

          const remaining = room.players.filter((p) => !p.forfeited);
          const remainingHumans = remaining.filter((p) => !p.isBot);
          if (remaining.length === 1) {
            finishRace(room, remaining[0].uid, 'forfeit');
          } else if (remainingHumans.length === 0 && remaining.length > 0) {
            const leadBot = [...remaining].sort((a, b) => b.telemetry.progress - a.telemetry.progress)[0];
            finishRace(room, leadBot.uid, 'forfeit');
          } else if (remaining.length >= 2) {
            broadcastRoomState(room);
            broadcastLobby();
          }
          break;
        }
      }
    });

    ws.on('close', () => {
      const uid = session.uid;
      const roomId = session.roomId;
      sessions.delete(ws);

      if (uid && roomId) {
        const room = rooms.get(roomId);
        if (room) {
          const p = room.players.find((pl) => pl.uid === uid);
          if (p) p.connected = false;

          if (room.status === 'RACING') {
            // 5-second reconnect grace before forfeit
            const grace = setTimeout(() => {
              disconnectGraceTimers.delete(uid);
              const r = rooms.get(roomId);
              if (!r || r.status !== 'RACING') return;
              const disconnected = r.players.find((pl) => pl.uid === uid);
              if (disconnected && !disconnected.connected) {
                disconnected.forfeited = true;
                const remaining = r.players.filter((pl) => !pl.forfeited);
                const remainingHumans = remaining.filter((pl) => !pl.isBot);
                if (remainingHumans.length === 0) {
                  clearRoomTimer(r.id);
                  clearBotSimTimer(r.id);
                  if (r.isFeatured) {
                    resetFeaturedRoom(r.id);
                  } else {
                    rooms.delete(r.id);
                  }
                  broadcastLobby();
                } else if (remaining.length === 1) {
                  finishRace(r, remaining[0].uid, 'forfeit');
                } else if (remaining.length >= 2) {
                  broadcastRoomState(r);
                  broadcastLobby();
                }
              }
            }, 5000);
            disconnectGraceTimers.set(uid, grace);
          } else {
            removePlayerFromRoom(session);
          }
        }
      }
      broadcastLobby();
    });
  });

  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist', 'index.html'));

  if (isProd) {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Gridline multiplayer server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server boot error:', err);
  process.exit(1);
});
