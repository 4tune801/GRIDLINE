import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Bot,
  Calendar,
  Check,
  Coins,
  Copy,
  Flag,
  Gift,
  Lock,
  LogOut,
  MessageSquare,
  Plus,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { CoinShop } from './components/CoinShop';
import { GarageShowcase3D } from './components/GarageShowcase3D';
import { GlobalChatSidebar } from './components/GlobalChatSidebar';
import { RaceViewport3D } from './components/RaceViewport3D';
import { TRACK_CATALOG } from './game/tracks';
import {
  auth,
  claimDailyCheckIn,
  ensureDriverAccount,
  getTodayUtcDateString,
  settleRaceResultInFirestore,
  signInWithGoogle,
  signOutDriver,
  subscribeDriverProfile,
  subscribeLeaderboard,
  subscribeRecentRaces,
  subscribeTransactions,
} from './lib/firebase';
import { readLocalCoinBalance } from './lib/shopPayments';
import {
  CAR_CATALOG,
  LIVERY_CATALOG,
  type BotDifficulty,
  type CarId,
  type CoinTransactionRecord,
  type DriverTelemetry,
  type DuelRoom,
  type DuelRoomSummary,
  type GlobalChatMessage,
  type LiveryId,
  type PlayerPublicProfile,
  type RaceFinishedEvent,
  type RaceResultRecord,
  type TrackId,
  type UserPrivateProfile,
} from './types/racing';

type ActiveSection = 'lobby' | 'circuits' | 'shop' | 'leaderboard' | 'profile';

const TRACK_ENTRIES = Object.values(TRACK_CATALOG);

function formatDurationMs(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const mins = Math.floor(safe / 60000);
  const secs = Math.floor((safe % 60000) / 1000);
  const hundredths = Math.floor((safe % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export default function App() {
  const [section, setSection] = useState<ActiveSection>('lobby');
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserPrivateProfile | null>(null);
  const [transactions, setTransactions] = useState<CoinTransactionRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<PlayerPublicProfile[]>([]);
  const [recentRaces, setRecentRaces] = useState<RaceResultRecord[]>([]);

  // Lobby, Chat & Multiplayer WebSocket State
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [onlineDrivers, setOnlineDrivers] = useState(0);
  const [onlineDriversList, setOnlineDriversList] = useState<
    Array<{ uid: string; displayName: string; rating?: number }>
  >([]);
  const [chatMessages, setChatMessages] = useState<GlobalChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : true
  );
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [lobbyRooms, setLobbyRooms] = useState<DuelRoomSummary[]>([]);
  const [activeRoom, setActiveRoom] = useState<DuelRoom | null>(null);
  const [opponentsTelemetry, setOpponentsTelemetry] = useState<Record<string, DriverTelemetry>>({});
  const [finishedEvent, setFinishedEvent] = useState<RaceFinishedEvent | null>(null);

  // Create Room & Bot State
  const [hostMode, setHostMode] = useState<'multiplayer' | 'bot'>('multiplayer');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('pro');
  const [botCount, setBotCount] = useState<number>(1);
  const [selectedCar, setSelectedCar] = useState<CarId>('ferrari_488');
  const [selectedLivery, setSelectedLivery] = useState<LiveryId>('crimson_apex');
  const [createTrack, setCreateTrack] = useState<TrackId>('monaco_harbor');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Notices & Daily Check-in State
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [claimingCheckIn, setClaimingCheckIn] = useState(false);

  const settledMatchesRef = useRef<Set<string>>(new Set());
  const activeProfileRef = useRef<UserPrivateProfile | null>(null);
  activeProfileRef.current = profile;
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const selectedCarRef = useRef<CarId>(selectedCar);
  selectedCarRef.current = selectedCar;
  const selectedLiveryRef = useRef<LiveryId>(selectedLivery);
  selectedLiveryRef.current = selectedLivery;

  // 1. Firebase Auth & Profile Lifecycle
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (user) {
        try {
          await ensureDriverAccount(user.uid, user.displayName, user.email, user.photoURL);
        } catch (err) {
          setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Account sync failed.' });
        }
      } else {
        setProfile(null);
        setTransactions([]);
      }
    });
    return () => unsub();
  }, []);

  // 2. User-scoped Firestore Listeners
  useEffect(() => {
    if (!authUser) return;
    const unsubProfile = subscribeDriverProfile(
      authUser.uid,
      (p) => setProfile(p),
      (err) => setNotice({ kind: 'error', text: err.message })
    );
    const unsubTx = subscribeTransactions(
      authUser.uid,
      (rows) => setTransactions(rows),
      () => {}
    );
    return () => {
      unsubProfile();
      unsubTx();
    };
  }, [authUser]);

  // 3. Public Leaderboard & Match Feed Listeners
  useEffect(() => {
    const unsubLb = subscribeLeaderboard(
      (rows) => setLeaderboard(rows),
      () => {}
    );
    const unsubRaces = subscribeRecentRaces(
      (rows) => setRecentRaces(rows),
      () => {}
    );
    return () => {
      unsubLb();
      unsubRaces();
    };
  }, []);

  // 4. Real-Time Multiplayer WebSocket Connection (Auto-Reconnect)
  useEffect(() => {
    let closedByUnmount = false;
    let reconnectTimer = 0;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        const p = activeProfileRef.current;
        if (p) {
          ws.send(
            JSON.stringify({ type: 'auth:identify', uid: p.uid, displayName: p.displayName, rating: p.rating })
          );
        }
        const params = new URLSearchParams(window.location.search);
        const inviteCode = params.get('room');
        if (inviteCode && p) {
          ws.send(
            JSON.stringify({
              type: 'room:join',
              code: inviteCode,
              carId: selectedCarRef.current,
              liveryId: selectedLiveryRef.current,
              rating: p.rating,
            })
          );
        }
      };

      ws.onmessage = async (event) => {
        let msg: any;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === 'lobby:update') {
          setLobbyRooms(msg.rooms || []);
          setOnlineDrivers(Number(msg.onlineDrivers) || 0);
          if (Array.isArray(msg.onlineDriversList)) {
            setOnlineDriversList(msg.onlineDriversList);
          }
        } else if (msg.type === 'chat:history') {
          if (Array.isArray(msg.messages)) {
            setChatMessages(msg.messages);
          }
        } else if (msg.type === 'chat:message') {
          if (msg.message && typeof msg.message.id === 'string') {
            setChatMessages((prev) =>
              prev.some((m) => m.id === msg.message.id) ? prev : [...prev.slice(-79), msg.message]
            );
            if (!chatOpenRef.current || sectionRef.current !== 'lobby') {
              setUnreadChatCount((c) => c + 1);
            }
          }
        } else if (msg.type === 'room:state') {
          setActiveRoom(msg.room);
          if (msg.room?.status === 'OPEN') {
            setFinishedEvent(null);
            setOpponentsTelemetry({});
          }
        } else if (msg.type === 'room:left') {
          setActiveRoom(null);
          setFinishedEvent(null);
          setOpponentsTelemetry({});
        } else if (msg.type === 'race:opponent_telemetry') {
          if (typeof msg.uid === 'string' && msg.telemetry) {
            setOpponentsTelemetry((prev) => ({
              ...prev,
              [msg.uid]: msg.telemetry,
            }));
          }
        } else if (msg.type === 'race:finished') {
          setActiveRoom(msg.room);
          const playerCount = Number(msg.playerCount) || msg.room?.players?.length || 2;
          const isBotMatch = Boolean(msg.isBotMatch ?? msg.room?.isBotMatch);
          const fin: RaceFinishedEvent = {
            matchId: msg.matchId,
            reason: msg.reason,
            winnerUid: msg.winnerUid,
            winnerName: msg.winnerName,
            loserUid: msg.loserUid,
            loserName: msg.loserName,
            winnerTimeMs: msg.winnerTimeMs,
            playerCount,
            isBotMatch,
            receipt: msg.receipt,
          };
          setFinishedEvent(fin);

          const curProfile = activeProfileRef.current;
          if (curProfile && !settledMatchesRef.current.has(msg.matchId)) {
            settledMatchesRef.current.add(msg.matchId);
            const didWin = msg.winnerUid === curProfile.uid;
            try {
              await settleRaceResultInFirestore({
                uid: curProfile.uid,
                didWin,
                matchId: msg.matchId,
                trackId: msg.room.trackId,
                trackName: msg.room.trackName,
                winnerId: msg.winnerUid,
                winnerName: msg.winnerName,
                loserId: msg.loserUid,
                loserName: msg.loserName,
                winnerTimeMs: msg.winnerTimeMs,
                playerCount,
                isBotMatch,
              });
            } catch (err) {
              setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Race record sync failed.' });
            }
          }
        } else if (msg.type === 'error') {
          setNotice({ kind: 'error', text: msg.message || 'Multiplayer error.' });
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!closedByUnmount) {
          reconnectTimer = window.setTimeout(connect, 1800);
        }
      };
    };

    connect();
    return () => {
      closedByUnmount = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  // Re-identify on WS whenever profile becomes available
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && profile) {
      wsRef.current.send(
        JSON.stringify({
          type: 'auth:identify',
          uid: profile.uid,
          displayName: profile.displayName,
          rating: profile.rating,
        })
      );
    }
  }, [profile?.uid, profile?.displayName, profile?.rating]);

  // Clear unread badge when viewing open chat in lobby
  useEffect(() => {
    if (section === 'lobby' && chatOpen && unreadChatCount > 0) {
      setUnreadChatCount(0);
    }
  }, [section, chatOpen, unreadChatCount]);

  const sendWs = useCallback((payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      setNotice({ kind: 'error', text: 'Reconnecting to multiplayer server...' });
    }
  }, []);

  const handleSignIn = async () => {
    setNotice(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Sign-in cancelled.' });
    }
  };

  const todayUtc = getTodayUtcDateString();
  const checkedInToday = Boolean(profile && profile.lastCheckInDate === todayUtc);
  const displayedCoinBalance = Math.max(profile?.coinBalance ?? 0, readLocalCoinBalance(profile?.uid));

  const handleClaimDailyCheckIn = async () => {
    if (!profile) {
      handleSignIn();
      return;
    }
    if (claimingCheckIn) return;
    setClaimingCheckIn(true);
    setNotice(null);
    try {
      const { bonusCoins, nextStreak } = await claimDailyCheckIn(profile.uid);
      setNotice({
        kind: 'info',
        text: `Day ${nextStreak} check-in claimed! +${bonusCoins} non-withdrawable bonus Coins added to your balance.`,
      });
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Daily check-in failed.' });
    } finally {
      setClaimingCheckIn(false);
    }
  };

  const handleSendChatMessage = (text: string) => {
    if (!profile) {
      handleSignIn();
      return;
    }
    sendWs({ type: 'chat:send', text });
  };

  const requestHorizontalFullscreenOnPlay = useCallback(() => {
    if (typeof window === 'undefined') return;
    const isTouch =
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    try {
      if (!document.fullscreenElement) {
        if (docEl.requestFullscreen) {
          Promise.resolve(docEl.requestFullscreen({ navigationUI: 'hide' }))
            .catch(() => docEl.requestFullscreen?.())
            .catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
          Promise.resolve(docEl.webkitRequestFullscreen()).catch(() => {});
        }
      }
      Promise.resolve(
        (screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> })?.lock?.('landscape')
      ).catch(() => {});
    } catch {
      // Ignore if browser or iframe blocks fullscreen/orientation lock
    }
  }, []);

  const handleCreateBotRoom = () => {
    if (!profile) {
      handleSignIn();
      return;
    }
    requestHorizontalFullscreenOnPlay();
    sendWs({
      type: 'room:create_bot',
      trackId: createTrack,
      botCount,
      botDifficulty,
      carId: selectedCar,
      liveryId: selectedLivery,
      rating: profile.rating,
    });
  };

  const handleAddBotToRoom = () => {
    sendWs({ type: 'room:add_bot', botDifficulty });
  };

  const handleRemoveBotFromRoom = (botUid: string) => {
    sendWs({ type: 'room:remove_bot', botUid });
  };

  const handleCreateRoom = () => {
    if (!profile) {
      handleSignIn();
      return;
    }
    sendWs({
      type: 'room:create',
      trackId: createTrack,
      carId: selectedCar,
      liveryId: selectedLivery,
      rating: profile.rating,
    });
  };

  const handleJoinRoom = (roomId?: string, code?: string) => {
    if (!profile) {
      handleSignIn();
      return;
    }
    sendWs({
      type: 'room:join',
      roomId,
      code,
      carId: selectedCar,
      liveryId: selectedLivery,
      rating: profile.rating,
    });
  };

  const handleToggleReady = () => {
    if (!activeRoom || !profile) return;
    const me = activeRoom.players.find((p) => p.uid === profile.uid);
    if (!me) return;
    if (!me.ready) {
      requestHorizontalFullscreenOnPlay();
    }
    sendWs({ type: 'room:ready', ready: !me.ready });
  };

  const handleCopyInvite = () => {
    if (!activeRoom) return;
    const url = `${window.location.origin}/?room=${activeRoom.code}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleSelectCar = (carId: CarId) => {
    const nextLivery = CAR_CATALOG[carId].defaultLivery;
    setSelectedCar(carId);
    setSelectedLivery(nextLivery);
    if (activeRoom && activeRoom.status === 'OPEN') {
      sendWs({ type: 'room:set_car', carId, liveryId: nextLivery });
    }
  };

  const handleSelectLivery = (liveryId: LiveryId) => {
    setSelectedLivery(liveryId);
    if (activeRoom && activeRoom.status === 'OPEN') {
      sendWs({ type: 'room:set_livery', liveryId });
    }
  };

  // Full-Viewport 3D Race when Countdown / Racing / Finished
  if (activeRoom && profile && activeRoom.status !== 'OPEN') {
    return (
      <RaceViewport3D
        room={activeRoom}
        currentUid={profile.uid}
        opponentsTelemetry={opponentsTelemetry}
        finishedEvent={finishedEvent}
        onSendTelemetry={(telemetry) => sendWs({ type: 'race:telemetry', telemetry })}
        onForfeit={() => sendWs({ type: 'race:forfeit' })}
        onRematch={() => sendWs({ type: 'room:rematch' })}
        onLeaveRoom={() => sendWs({ type: 'room:leave' })}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0B0F14] text-slate-100 flex flex-col">
      {/* Top Bar Contract: Exactly 3 Zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-[#0B0F14]/95 border-b border-white/8">
        <div className="max-w-[1280px] mx-auto px-6 py-4 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#lobby"
            onClick={(e) => {
              e.preventDefault();
              setSection('lobby');
            }}
            className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Gridline
          </a>

          {/* Zone 2: 5 Single-line Navigation Links */}
          <nav className="hidden sm:flex items-center gap-6 md:gap-7 text-sm font-medium text-slate-400">
            {(
              [
                ['lobby', 'Lobby'],
                ['circuits', 'Circuits'],
                ['shop', 'Shop'],
                ['leaderboard', 'Leaderboard'],
                ['profile', 'Profile'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors border-b ${
                  section === key
                    ? 'text-white border-amber-500'
                    : 'border-transparent hover:text-slate-100 hover:border-white/30'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Single Primary Action Button */}
          <div className="flex items-center shrink-0">
            {profile ? (
              <button
                onClick={() => setSection('shop')}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold font-mono tabular-nums transition-colors whitespace-nowrap shrink-0"
              >
                {displayedCoinBalance.toLocaleString()} Coins · Shop
              </button>
            ) : (
              <button
                onClick={handleSignIn}
                disabled={!authReady}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                Sign In with Google
              </button>
            )}
          </div>
        </div>

        {/* Mobile Portrait Nav Row */}
        <div className="sm:hidden border-t border-white/8 px-6 py-2 flex items-center justify-between text-xs text-slate-400">
          {(
            [
              ['lobby', 'Lobby'],
              ['circuits', 'Circuits'],
              ['shop', 'Shop'],
              ['leaderboard', 'Leaderboard'],
              ['profile', 'Profile'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`py-1 whitespace-nowrap ${section === key ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`flex-1 w-full mx-auto px-6 py-8 space-y-10 ${
          section === 'lobby' && chatOpen ? 'max-w-[1440px]' : 'max-w-[1280px]'
        }`}
      >
        {notice && (
          <div
            className={`px-4 py-3 rounded-xl border text-xs flex items-center justify-between gap-4 ${
              notice.kind === 'error'
                ? 'bg-rose-950/50 border-rose-500/30 text-rose-200'
                : 'bg-emerald-950/50 border-emerald-500/30 text-emerald-200'
            }`}
          >
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white shrink-0">
              Dismiss
            </button>
          </div>
        )}

        {section === 'lobby' && (
          <div className="flex flex-col xl:flex-row items-start gap-8">
            <div className="flex-1 min-w-0 w-full space-y-10">
              {/* Daily Check-In & Global Chat Utility Bar */}
              <section className="rounded-xl bg-[#111722] border border-white/10 p-3.5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-mono tabular-nums text-slate-300">
                    Daily Streak: <strong className="text-white">{profile ? profile.checkInStreak : 0}d</strong>
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400">
                    Free-to-play 3D racing · Shop Coins are non-withdrawable
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {!profile ? (
                    <button
                      type="button"
                      onClick={handleSignIn}
                      className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/16 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Gift className="w-3.5 h-3.5 text-amber-400" />
                      Sign In for Daily Coins
                    </button>
                  ) : checkedInToday ? (
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Check className="w-3.5 h-3.5" />
                      Checked In Today
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleClaimDailyCheckIn}
                      disabled={claimingCheckIn}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Gift className="w-3.5 h-3.5" />
                      {claimingCheckIn ? 'Claiming...' : 'Claim Daily Check-In'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setChatOpen((v) => !v)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap font-mono tabular-nums ${
                      chatOpen
                        ? 'bg-white/14 text-white border border-white/15'
                        : 'bg-white/8 hover:bg-white/14 text-slate-200 border border-white/10'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    <span>{chatOpen ? 'Hide Chat' : 'Global Chat'}</span>
                    {!chatOpen && unreadChatCount > 0 && (
                      <span className="text-amber-300">({unreadChatCount})</span>
                    )}
                  </button>
                </div>
              </section>

              {/* Hero Split + Live 3D Showroom */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-6 flex flex-col justify-between py-2">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-amber-400">
                      Free-to-Play 3D Multiplayer Racing · Up to 4 Players & Computer Bots
                    </p>
                    <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mt-3 leading-[1.1] text-balance">
                      Race up to 4 drivers live on Grand Prix circuits.
                    </h1>
                    <p className="text-base text-slate-400 mt-4 max-w-xl leading-relaxed">
                      Every race is 100% free to enter — battle up to 4 live rivals or sharpen your lap times against
                      Computer Bots. Visit the Coin Shop anytime to buy non-withdrawable virtual Coins.
                    </p>
                  </div>

                  {/* Character Car + Paint Livery Picker + Quick Actions */}
                  <div className="mt-7 space-y-5">
                    <div>
                      <p className="text-xs font-medium text-slate-400 mb-2">Cartoon Character Car</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(Object.keys(CAR_CATALOG) as CarId[]).map((cid) => {
                          const car = CAR_CATALOG[cid];
                          const active = selectedCar === cid;
                          return (
                            <button
                              key={cid}
                              type="button"
                              onClick={() => handleSelectCar(cid)}
                              className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                                active
                                  ? 'bg-[#17202E] border-amber-500 text-white'
                                  : 'bg-[#121822] border-white/8 text-slate-400 hover:border-white/20 hover:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-sm border border-white/25 shrink-0"
                                  style={{ backgroundColor: car.eyeSwatch }}
                                />
                                <span className="text-xs font-semibold truncate">{car.name}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{car.styleTag}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-400 mb-2">Paint Livery</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(Object.keys(LIVERY_CATALOG) as LiveryId[]).map((lid) => {
                          const liv = LIVERY_CATALOG[lid];
                          const active = selectedLivery === lid;
                          return (
                            <button
                              key={lid}
                              type="button"
                              onClick={() => handleSelectLivery(lid)}
                              className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                                active
                                  ? 'bg-[#17202E] border-amber-500 text-white'
                                  : 'bg-[#121822] border-white/8 text-slate-400 hover:border-white/20 hover:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-3 h-3 rounded-sm border border-white/20 shrink-0"
                                  style={{ backgroundColor: liv.swatch }}
                                />
                                <span className="text-xs font-medium truncate">{liv.name}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {!profile ? (
                        <button
                          onClick={handleSignIn}
                          className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap"
                        >
                          Sign In to Race Free
                        </button>
                      ) : (
                        <button
                          onClick={() => setSection('shop')}
                          className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                        >
                          <Coins className="w-4 h-4" />
                          Open Coin Shop
                        </button>
                      )}
                      <button
                        onClick={handleCreateBotRoom}
                        className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/16 text-white font-medium text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                      >
                        <Bot className="w-4 h-4 text-sky-400" />
                        Race vs Bot
                      </button>
                      <button
                        onClick={() => setSection('circuits')}
                        className="px-5 py-2.5 rounded-lg bg-white/8 hover:bg-white/14 text-white font-medium text-sm transition-colors whitespace-nowrap"
                      >
                        Inspect Circuits
                      </button>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6 min-h-[340px] lg:min-h-[420px]">
                  <GarageShowcase3D carId={selectedCar} liveryId={selectedLivery} />
                </div>
              </section>

              {/* Full-Width 4-Column KPI Strip */}
              <section className="grid grid-cols-2 lg:grid-cols-4 border-y border-white/10 py-5 gap-6">
                <div>
                  <p className="text-xs text-slate-400">Multiplayer Grid</p>
                  <p className="font-mono text-xl font-semibold text-white mt-1 tabular-nums">
                    {wsConnected ? `${onlineDrivers} Drivers Online` : 'Connecting...'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Open Race Rooms</p>
                  <p className="font-mono text-xl font-semibold text-white mt-1 tabular-nums">
                    {lobbyRooms.filter((r) => r.status === 'OPEN').length} Active
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Coin Balance (Non-Withdrawable)</p>
                  <p className="font-mono text-xl font-semibold text-amber-400 mt-1 tabular-nums">
                    {displayedCoinBalance.toLocaleString()} Coins
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Daily Check-In & Rating</p>
                  <p className="font-mono text-xl font-semibold text-white mt-1 tabular-nums">
                    {profile ? `Day ${profile.checkInStreak} · ${profile.rating} ELO` : 'Day 0 · 1200 ELO'}
                  </p>
                </div>
              </section>

              {/* Staged Active Race Grid Panel (2–4 Human / Bot Racers) */}
              {activeRoom && profile && (
                <section className="rounded-2xl bg-[#121822] border border-amber-500/35 p-6 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 pb-4">
                    <div>
                      <p className="text-xs font-medium text-amber-400">
                        {activeRoom.isBotMatch ? 'Computer Bot Practice Grid' : 'Free 4-Car Multiplayer Grid'} · Code{' '}
                        {activeRoom.code} · {activeRoom.players.length} / 4 Racers · Min 2 Ready to Start
                      </p>
                      <h2 className="font-display text-2xl font-bold text-white mt-0.5">{activeRoom.trackName}</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right pr-2">
                        <p className="text-xs text-slate-400">Entry / Format</p>
                        <p className="font-mono text-base font-bold text-emerald-400 tabular-nums">
                          Free · {activeRoom.laps} Laps
                        </p>
                      </div>
                      {!activeRoom.isBotMatch && (
                        <button
                          onClick={handleCopyInvite}
                          className="px-3.5 py-2 rounded-lg bg-white/8 hover:bg-white/14 text-slate-200 text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          {copiedInvite ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedInvite ? 'Invite Copied' : 'Copy Invite Link'}
                        </button>
                      )}
                      <button
                        onClick={() => sendWs({ type: 'room:leave' })}
                        className="px-3.5 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-medium transition-colors whitespace-nowrap"
                      >
                        Leave Grid
                      </button>
                    </div>
                  </div>

                  {/* 4 Driver Grid Slots */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[0, 1, 2, 3].map((slotIdx) => {
                      const occupant = activeRoom.players.find((p) => p.slotIndex === slotIdx);
                      const isMe = occupant?.uid === profile.uid;

                      if (!occupant) {
                        return (
                          <div
                            key={slotIdx}
                            className="p-5 rounded-xl bg-[#0B0F14]/70 border border-dashed border-white/10 flex items-center justify-between gap-4"
                          >
                            <div>
                              <p className="text-xs text-slate-500">Grid Slot {slotIdx + 1} · Open Seat</p>
                              <p className="text-sm font-medium text-slate-300 mt-1">
                                Waiting for racer ({activeRoom.code}) or add a Computer Bot
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleAddBotToRoom}
                              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/16 text-sky-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                            >
                              <Bot className="w-3.5 h-3.5" />
                              + Add Bot
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={slotIdx}
                          className={`p-5 rounded-xl bg-[#0B0F14] border flex items-center justify-between gap-4 ${
                            isMe ? 'border-amber-500/40' : 'border-white/10'
                          }`}
                        >
                          <div>
                            <p className="text-xs text-slate-400">
                              Grid Slot {slotIdx + 1} · {isMe ? 'You' : occupant.isBot ? 'Computer Bot' : 'Racer'}
                            </p>
                            <p className="font-display text-lg font-semibold text-white mt-1">{occupant.displayName}</p>
                            <p className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
                              {CAR_CATALOG[occupant.carId || 'ferrari_488'].name} ·{' '}
                              {LIVERY_CATALOG[occupant.liveryId].name} · ELO {occupant.rating}
                            </p>
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                            {isMe ? (
                              <button
                                type="button"
                                onClick={handleToggleReady}
                                className={`px-4 py-2.5 rounded-lg font-semibold text-xs transition-colors whitespace-nowrap ${
                                  occupant.ready
                                    ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30'
                                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                }`}
                              >
                                {occupant.ready ? 'Ready · Click to Cancel' : 'Ready to Race'}
                              </button>
                            ) : (
                              <>
                                <span
                                  className={`text-xs font-semibold ${
                                    occupant.ready ? 'text-emerald-400' : 'text-amber-400'
                                  }`}
                                >
                                  {occupant.ready ? (occupant.isBot ? 'Bot Ready' : 'Ready') : 'Waiting to Ready'}
                                </span>
                                {occupant.isBot && activeRoom.players.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBotFromRoom(occupant.uid)}
                                    className="text-[11px] text-slate-400 hover:text-rose-300 transition-colors"
                                  >
                                    Remove Bot
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Multiplayer Matchmaking Grid: Open Rooms + Host Custom Race */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Open Race Rooms Table */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-white">Open Multiplayer Race Grids</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        2 to 4 drivers per track · 100% free entry · Real-time WebSocket physics
                      </p>
                    </div>

                    {/* Join by Room Code */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (joinCodeInput.trim()) {
                          handleJoinRoom(undefined, joinCodeInput.trim());
                        }
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value)}
                        placeholder="Code (e.g. MNC-1)"
                        className="px-3 py-2 rounded-lg bg-[#121822] border border-white/12 text-xs text-white font-mono uppercase placeholder:normal-case placeholder:text-slate-500 focus:outline-none focus:border-amber-500 w-44"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/16 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        Join Code
                      </button>
                    </form>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#111722] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-[11px] text-slate-400">
                            <th className="py-3 px-4 font-medium">Circuit & Code</th>
                            <th className="py-3 px-4 font-medium">Racers</th>
                            <th className="py-3 px-4 font-medium text-right">Entry</th>
                            <th className="py-3 px-4 font-medium text-right">Victory Bonus</th>
                            <th className="py-3 px-4 font-medium text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/6 text-sm">
                          {lobbyRooms.map((r) => {
                            const maxPlayers = r.maxPlayers || 4;
                            const isSeatedHere = activeRoom?.id === r.id;
                            const canJoin = r.status === 'OPEN' && r.playerCount < maxPlayers && !isSeatedHere;
                            const hostName = r.players[0]?.displayName;
                            return (
                              <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="py-3.5 px-4">
                                  <p className="font-medium text-white">{r.trackName}</p>
                                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                                    {r.code} · {r.laps} Laps{hostName ? ` · Host: ${hostName}` : ''}
                                  </p>
                                </td>
                                <td className="py-3.5 px-4 font-mono text-xs tabular-nums text-slate-300">
                                  {r.playerCount} / {maxPlayers} · {r.status}
                                </td>
                                <td className="py-3.5 px-4 font-mono text-right text-emerald-400 font-semibold">
                                  Free
                                </td>
                                <td className="py-3.5 px-4 font-mono text-right tabular-nums font-semibold text-amber-400">
                                  +50 Coins
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  {isSeatedHere ? (
                                    <span className="text-xs font-medium text-amber-400">Seated</span>
                                  ) : canJoin ? (
                                    <button
                                      onClick={() => handleJoinRoom(r.id)}
                                      className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
                                    >
                                      Enter Grid
                                    </button>
                                  ) : (
                                    <span className="text-xs text-slate-500">{r.status === 'RACING' ? 'Live' : 'Full'}</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {lobbyRooms.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                                Connecting to matchmaking server...
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Create Custom 4-Car Multiplayer OR vs Computer Bot Race */}
                <div className="lg:col-span-4">
                  <div className="rounded-xl border border-white/10 bg-[#111722] p-5 space-y-5">
                    <div className="inline-flex w-full rounded-lg bg-[#0B0F14] p-1 border border-white/8">
                      <button
                        type="button"
                        onClick={() => setHostMode('multiplayer')}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                          hostMode === 'multiplayer' ? 'bg-white/14 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Multiplayer (2–4)
                      </button>
                      <button
                        type="button"
                        onClick={() => setHostMode('bot')}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap inline-flex items-center justify-center gap-1.5 ${
                          hostMode === 'bot' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Bot className="w-3.5 h-3.5" />
                        vs Computer (Bot)
                      </button>
                    </div>

                    {hostMode === 'multiplayer' ? (
                      <>
                        <div>
                          <h3 className="font-display text-lg font-bold text-white">Host a 4-Car Free Race</h3>
                          <p className="text-xs text-slate-400 mt-1">
                            Pick a circuit and invite up to 3 friends or online drivers to race for free.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1.5">Circuit</label>
                          <select
                            value={createTrack}
                            onChange={(e) => setCreateTrack(e.target.value as TrackId)}
                            className="w-full px-3 py-2.5 rounded-lg bg-[#0B0F14] border border-white/12 text-sm text-white focus:outline-none focus:border-amber-500"
                          >
                            {TRACK_ENTRIES.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="rounded-lg border border-white/8 bg-[#0B0F14] p-3.5 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Entry Cost</span>
                            <span className="font-mono font-semibold text-emerald-400">Free ($0.00)</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Grid Size</span>
                            <span className="font-mono text-slate-200">2 to 4 Racers · 3 Laps</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Winner Reward</span>
                            <span className="font-mono text-amber-400">+50 Coins + ELO</span>
                          </div>
                        </div>

                        <button
                          onClick={handleCreateRoom}
                          className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Create Free Race Room
                        </button>
                      </>
                    ) : (
                      <>
                        <div>
                          <h3 className="font-display text-lg font-bold text-white">Race vs Computer Bots</h3>
                          <p className="text-xs text-slate-400 mt-1">
                            Instant solo race against 1–3 AI opponents on any circuit — completely free.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1.5">Circuit</label>
                          <select
                            value={createTrack}
                            onChange={(e) => setCreateTrack(e.target.value as TrackId)}
                            className="w-full px-3 py-2.5 rounded-lg bg-[#0B0F14] border border-white/12 text-sm text-white focus:outline-none focus:border-sky-500"
                          >
                            {TRACK_ENTRIES.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-2">Bot Difficulty</label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['rookie', 'pro', 'ace'] as const).map((diff) => (
                              <button
                                key={diff}
                                type="button"
                                onClick={() => setBotDifficulty(diff)}
                                className={`py-2 rounded-lg text-xs font-semibold capitalize border transition-colors ${
                                  botDifficulty === diff
                                    ? 'bg-sky-500/15 border-sky-400 text-sky-300'
                                    : 'bg-[#0B0F14] border-white/10 text-slate-300 hover:border-white/25'
                                }`}
                              >
                                {diff}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-2">Computer Opponents</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[1, 2, 3].map((cnt) => (
                              <button
                                key={cnt}
                                type="button"
                                onClick={() => setBotCount(cnt)}
                                className={`py-2 rounded-lg font-mono text-xs font-semibold tabular-nums border transition-colors ${
                                  botCount === cnt
                                    ? 'bg-sky-500/15 border-sky-400 text-sky-300'
                                    : 'bg-[#0B0F14] border-white/10 text-slate-300 hover:border-white/25'
                                }`}
                              >
                                {cnt} {cnt === 1 ? 'Bot' : 'Bots'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/8 flex items-center justify-between text-xs">
                          <span className="text-slate-400">Grid ({1 + botCount} Cars)</span>
                          <span className="font-mono text-sm font-bold text-sky-400 tabular-nums">
                            Free · +20 Coins on Win
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={handleCreateBotRoom}
                          className="w-full py-2.5 px-4 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors"
                        >
                          <Bot className="w-4 h-4" />
                          Start Race vs Bot
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Desktop Sticky Global Chat Sidebar */}
            {chatOpen && (
              <div className="hidden xl:block w-[340px] shrink-0 sticky top-24 h-[calc(100vh-7.5rem)]">
                <GlobalChatSidebar
                  messages={chatMessages}
                  onlineDriversCount={onlineDrivers}
                  onlineDriversList={onlineDriversList}
                  wsConnected={wsConnected}
                  currentUid={profile?.uid || null}
                  onSendMessage={handleSendChatMessage}
                  onSignIn={handleSignIn}
                  onClose={() => setChatOpen(false)}
                  className="h-full"
                />
              </div>
            )}
          </div>
        )}

        {section === 'circuits' && (
          <section className="space-y-6">
            <div>
              <h1 className="font-display text-3xl font-bold text-white">Grand Prix Circuits</h1>
              <p className="text-sm text-slate-400 mt-1">
                Six procedural 3D circuits across Monaco, Ibiza, Lagos, Los Angeles, Redrock Canyon, and Silverstone.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {TRACK_ENTRIES.map((t) => (
                <div key={t.id} className="rounded-xl border border-white/10 bg-[#111722] p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-xs text-amber-400 font-medium">
                      {t.location} · {t.corners} Corners
                    </p>
                    <h2 className="font-display text-xl font-bold text-white mt-1.5">{t.name}</h2>
                    <p className="text-xs text-slate-400 mt-1 font-mono">{t.lengthLabel} · {t.surface}</p>
                    <p className="text-sm text-slate-300 mt-4 leading-relaxed">{t.description}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/8 flex items-center justify-between">
                    <span className="text-xs text-slate-400">3 Boost Strips</span>
                    <button
                      onClick={() => {
                        setCreateTrack(t.id);
                        setSection('lobby');
                      }}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      Race on Circuit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {section === 'leaderboard' && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display text-3xl font-bold text-white">Top Drivers</h1>
                  <p className="text-xs text-slate-400 mt-1">Verified multiplayer ELO ratings and race records</p>
                </div>
                <Trophy className="w-6 h-6 text-amber-400" />
              </div>

              <div className="rounded-xl border border-white/10 bg-[#111722] overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] text-slate-400">
                      <th className="py-3 px-4 font-medium">Rank</th>
                      <th className="py-3 px-4 font-medium">Driver</th>
                      <th className="py-3 px-4 font-medium text-right">Record</th>
                      <th className="py-3 px-4 font-medium text-right">Win Rate</th>
                      <th className="py-3 px-4 font-medium text-right">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6 text-sm">
                    {leaderboard.map((row, idx) => {
                      const winRate =
                        row.racesPlayed > 0 ? `${Math.round((row.racesWon / row.racesPlayed) * 100)}%` : '0%';
                      return (
                        <tr key={row.uid}>
                          <td className="py-3 px-4 font-mono text-xs text-slate-400 tabular-nums">#{idx + 1}</td>
                          <td className="py-3 px-4 font-medium text-white">{row.displayName}</td>
                          <td className="py-3 px-4 font-mono text-right text-slate-300 tabular-nums">
                            {row.racesWon}W / {row.racesPlayed}R
                          </td>
                          <td className="py-3 px-4 font-mono text-right text-slate-300 tabular-nums">{winRate}</td>
                          <td className="py-3 px-4 font-mono text-right font-semibold text-amber-400 tabular-nums">
                            {row.rating} ELO
                          </td>
                        </tr>
                      );
                    })}
                    {leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                          Complete a multiplayer race to appear on the verified standings.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white">Recent Races</h2>
                  <p className="text-xs text-slate-400 mt-1">Completed multiplayer results</p>
                </div>
                <Flag className="w-5 h-5 text-slate-400" />
              </div>

              <div className="rounded-xl border border-white/10 bg-[#111722] divide-y divide-white/8">
                {recentRaces.map((r) => (
                  <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {r.winnerName} def. {r.loserName}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">
                        {r.trackName} · {r.playerCount}P · {formatDurationMs(r.winnerTimeMs)}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-emerald-400 shrink-0">Free Race</span>
                  </div>
                ))}
                {recentRaces.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No multiplayer races recorded yet. Host a free room in the Lobby to start.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {section === 'shop' && (
          <CoinShop
            profile={profile}
            onSignIn={handleSignIn}
            onCoinsCredited={(coinsAdded, _newBalance, priceLabel, gatewayLabel) => {
              setNotice({
                kind: 'info',
                text: `Shop purchase confirmed: +${coinsAdded.toLocaleString()} non-withdrawable coins (${priceLabel} via ${gatewayLabel}).`,
              });
            }}
          />
        )}

        {section === 'profile' && (
          <section className="space-y-8">
            {!profile ? (
              <div className="rounded-2xl border border-white/10 bg-[#111722] p-10 text-center max-w-lg mx-auto">
                <ShieldCheck className="w-8 h-8 text-amber-400 mx-auto mb-3" />
                <h1 className="font-display text-2xl font-bold text-white">Sign In to View Your Driver Profile</h1>
                <p className="text-sm text-slate-400 mt-2">
                  Track your racing ELO, daily check-in streak, and non-withdrawable Shop Coin balance across devices.
                </p>
                <button
                  onClick={handleSignIn}
                  className="mt-6 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors"
                >
                  Sign In with Google
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
                  <div>
                    <p className="text-xs text-slate-400">Driver Account · {profile.email}</p>
                    <h1 className="font-display text-3xl font-bold text-white mt-1">{profile.displayName}</h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setSection('shop')}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      Buy Coins in Shop
                    </button>
                    <button
                      onClick={signOutDriver}
                      className="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/12 text-slate-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>

                {/* 4-Column Driver Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 border-b border-white/10 pb-6">
                  <div>
                    <p className="text-xs text-slate-400">Coin Balance (Non-Withdrawable)</p>
                    <p className="font-mono text-2xl font-bold text-amber-400 mt-1 tabular-nums">
                      {displayedCoinBalance.toLocaleString()} Coins
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Driver ELO Rating</p>
                    <p className="font-mono text-2xl font-bold text-white mt-1 tabular-nums">{profile.rating} ELO</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Races Won</p>
                    <p className="font-mono text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
                      {profile.racesWon}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Races Completed</p>
                    <p className="font-mono text-2xl font-bold text-white mt-1 tabular-nums">
                      {profile.racesPlayed}
                    </p>
                  </div>
                </div>

                {/* Daily Check-In & Non-Withdrawable Policy Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-xl border border-white/10 bg-[#111722] p-5 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="font-display text-lg font-bold text-white">Daily Check-In Coin Bonus</h2>
                        <Calendar className="w-4 h-4 text-amber-400" />
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Visit daily to earn +50 to +150 free non-withdrawable Coins based on your streak.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-6 text-xs">
                        <div>
                          <span className="text-slate-400 block">Current Streak</span>
                          <span className="font-mono text-base font-bold text-white tabular-nums">
                            {profile.checkInStreak} Days
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Last Check-In</span>
                          <span className="font-mono text-sm text-slate-200 tabular-nums">
                            {profile.lastCheckInDate || 'Never'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {checkedInToday ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                          <Check className="w-4 h-4" />
                          Today’s coins claimed — return tomorrow to grow your streak.
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleClaimDailyCheckIn}
                          disabled={claimingCheckIn}
                          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Gift className="w-3.5 h-3.5" />
                          {claimingCheckIn ? 'Claiming...' : 'Claim Daily Check-In'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-500/25 bg-[#111722] p-5 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="font-display text-lg font-bold text-white">Virtual Coin Policy</h2>
                        <span className="text-[11px] font-mono text-amber-400 inline-flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Non-Withdrawable
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Gridline is a free-to-play racing game with zero wagering or cash payouts. Coins purchased in
                        the Shop or earned from daily check-ins are strictly non-withdrawable virtual items.
                      </p>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setSection('shop')}
                        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        Go to Coin Shop
                      </button>
                    </div>
                  </div>
                </div>

                {/* Coin & Race Activity History */}
                <div className="space-y-3">
                  <h2 className="font-display text-xl font-bold text-white">Coin & Activity History</h2>
                  <div className="rounded-xl border border-white/10 bg-[#111722] overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-[11px] text-slate-400">
                          <th className="py-3 px-4 font-medium">Event</th>
                          <th className="py-3 px-4 font-medium">Channel / Circuit</th>
                          <th className="py-3 px-4 font-medium text-right">Coins</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6 text-sm">
                        {transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="py-3 px-4">
                              <p className="font-medium text-white">{tx.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                                {new Date(tx.createdAtMs).toLocaleString()}
                              </p>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-400">{tx.methodLabel}</td>
                            <td className="py-3 px-4 font-mono text-right font-semibold text-amber-400 tabular-nums">
                              {tx.coinsDelta > 0 ? `+${tx.coinsDelta.toLocaleString()} Coins` : 'Synced'}
                            </td>
                          </tr>
                        ))}
                        {transactions.length === 0 && (
                          <tr>
                            <td colSpan={3} className="py-8 text-center text-xs text-slate-400">
                              No coin activity yet. Claim a daily check-in, win a race, or visit the Coin Shop.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {section === 'lobby' && chatOpen && (
        <div
          className="xl:hidden fixed inset-0 z-50 flex justify-end bg-black/65"
          onClick={() => setChatOpen(false)}
        >
          <div className="w-full max-w-sm h-full p-3" onClick={(e) => e.stopPropagation()}>
            <GlobalChatSidebar
              messages={chatMessages}
              onlineDriversCount={onlineDrivers}
              onlineDriversList={onlineDriversList}
              wsConnected={wsConnected}
              currentUid={profile?.uid || null}
              onSendMessage={handleSendChatMessage}
              onSignIn={handleSignIn}
              onClose={() => setChatOpen(false)}
              className="h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
