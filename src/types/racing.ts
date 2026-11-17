export type TrackId =
  | 'monaco_harbor'
  | 'ibiza_coast'
  | 'lagos_island'
  | 'los_angeles_sunset'
  | 'redrock_canyon'
  | 'silverstone_night';

export type CarId =
  | 'ferrari_488'
  | 'lexus_is'
  | 'mercedes_c300'
  | 'chevy_camaro'
  | 'porsche_911'
  | 'nissan_gtr';

export type LiveryId =
  | 'obsidian_gold'
  | 'crimson_apex'
  | 'cobalt_gt'
  | 'emerald_works'
  | 'pearl_white'
  | 'sunset_orange';

export type RoomStatus = 'OPEN' | 'COUNTDOWN' | 'RACING' | 'FINISHED';
export type BotDifficulty = 'rookie' | 'pro' | 'ace';

export interface DriverTelemetry {
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

export interface RoomPlayer {
  uid: string;
  displayName: string;
  rating: number;
  carId?: CarId;
  liveryId: LiveryId;
  slotIndex: 0 | 1 | 2 | 3;
  ready: boolean;
  connected: boolean;
  isBot?: boolean;
  botDifficulty?: BotDifficulty;
  forfeited?: boolean;
  finished?: boolean;
  finishTimeMs?: number | null;
  telemetry?: DriverTelemetry;
}

export interface DuelRoomSummary {
  id: string;
  code: string;
  trackId: TrackId;
  trackName: string;
  laps: number;
  maxPlayers?: number;
  status: RoomStatus;
  isFeatured: boolean;
  isBotMatch?: boolean;
  playerCount: number;
  players: RoomPlayer[];
}

export interface DuelRoom extends DuelRoomSummary {
  countdownStep: number;
  raceStartAtMs: number | null;
  winnerUid: string | null;
  loserUid: string | null;
  winnerTimeMs: number | null;
  matchId: string;
  createdAtMs: number;
}

export interface GlobalChatMessage {
  id: string;
  uid: string;
  displayName: string;
  rating?: number;
  text: string;
  createdAtMs: number;
  system?: boolean;
}

export interface RaceFinishedEvent {
  matchId: string;
  reason: 'finish_line' | 'forfeit';
  winnerUid: string;
  winnerName: string;
  loserUid: string;
  loserName: string;
  winnerTimeMs: number;
  playerCount: number;
  isBotMatch?: boolean;
  receipt: string;
}

export interface UserPrivateProfile {
  uid: string;
  displayName: string;
  email: string;
  photoUrl?: string;
  coinBalance: number;
  racesWon: number;
  racesPlayed: number;
  rating: number;
  checkInStreak: number;
  lastCheckInDate: string;
}

export interface PlayerPublicProfile {
  uid: string;
  displayName: string;
  racesWon: number;
  racesPlayed: number;
  rating: number;
  isPublic: boolean;
}

export interface CoinTransactionRecord {
  id: string;
  userId: string;
  type: 'coin_purchase' | 'daily_checkin' | 'race_reward' | 'deposit' | 'withdrawal' | 'match_stake' | 'match_win' | 'match_refund';
  coinsDelta: number;
  title: string;
  methodLabel: string;
  referenceId: string;
  createdAtMs: number;
}

export interface RaceResultRecord {
  id: string;
  matchId: string;
  trackId: TrackId;
  trackName: string;
  winnerId: string;
  winnerName: string;
  loserId: string;
  loserName: string;
  winnerTimeMs: number;
  playerCount: number;
  createdAtMs: number;
}

export interface CarModelSpec {
  id: CarId;
  name: string;
  brand: string;
  styleTag: string;
  defaultLivery: LiveryId;
  eyeColorHex: number;
  eyeSwatch: string;
}

export const CAR_CATALOG: Record<CarId, CarModelSpec> = {
  ferrari_488: {
    id: 'ferrari_488',
    name: 'Ferrari 488 GT',
    brand: 'Ferrari',
    styleTag: 'Mid-Engine Supercar',
    defaultLivery: 'crimson_apex',
    eyeColorHex: 0x38bdf8,
    eyeSwatch: '#DC2626',
  },
  lexus_is: {
    id: 'lexus_is',
    name: 'Lexus IS F-Sport',
    brand: 'Lexus',
    styleTag: 'Spindle Sport Sedan',
    defaultLivery: 'pearl_white',
    eyeColorHex: 0x0ea5e9,
    eyeSwatch: '#E2E8F0',
  },
  mercedes_c300: {
    id: 'mercedes_c300',
    name: 'Mercedes C300 AMG',
    brand: 'Mercedes-Benz',
    styleTag: 'Executive Sport Coupe',
    defaultLivery: 'obsidian_gold',
    eyeColorHex: 0xf59e0b,
    eyeSwatch: '#1E293B',
  },
  chevy_camaro: {
    id: 'chevy_camaro',
    name: 'Camaro SS',
    brand: 'Chevrolet',
    styleTag: 'V8 Muscle Performer',
    defaultLivery: 'sunset_orange',
    eyeColorHex: 0x10b981,
    eyeSwatch: '#F97316',
  },
  porsche_911: {
    id: 'porsche_911',
    name: 'Porsche 911 GT3',
    brand: 'Porsche',
    styleTag: 'Rear-Engine Track Icon',
    defaultLivery: 'cobalt_gt',
    eyeColorHex: 0x60a5fa,
    eyeSwatch: '#2563EB',
  },
  nissan_gtr: {
    id: 'nissan_gtr',
    name: 'Nissan GT-R Nismo',
    brand: 'Nissan',
    styleTag: 'Twin-Turbo AWD Legend',
    defaultLivery: 'emerald_works',
    eyeColorHex: 0xf43f5e,
    eyeSwatch: '#059669',
  },
};

export const LIVERY_CATALOG: Record<
  LiveryId,
  { name: string; primaryHex: number; accentHex: number; swatch: string; accentSwatch: string }
> = {
  crimson_apex: {
    name: 'Rosso Corsa',
    primaryHex: 0xdc2626,
    accentHex: 0xfef3c7,
    swatch: '#DC2626',
    accentSwatch: '#FEF3C7',
  },
  pearl_white: {
    name: 'Pearl Bianco',
    primaryHex: 0xf1f5f9,
    accentHex: 0xef4444,
    swatch: '#F1F5F9',
    accentSwatch: '#EF4444',
  },
  obsidian_gold: {
    name: 'Obsidian Gold',
    primaryHex: 0x18202c,
    accentHex: 0xf59e0b,
    swatch: '#18202C',
    accentSwatch: '#F59E0B',
  },
  sunset_orange: {
    name: 'Rally Sunset',
    primaryHex: 0xf97316,
    accentHex: 0x111827,
    swatch: '#F97316',
    accentSwatch: '#111827',
  },
  cobalt_gt: {
    name: 'Cobalt GT',
    primaryHex: 0x2563eb,
    accentHex: 0x38bdf8,
    swatch: '#2563EB',
    accentSwatch: '#38BDF8',
  },
  emerald_works: {
    name: 'Emerald Works',
    primaryHex: 0x059669,
    accentHex: 0xd9f99d,
    swatch: '#059669',
    accentSwatch: '#D9F99D',
  },
};
