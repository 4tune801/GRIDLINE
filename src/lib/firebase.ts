import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  CoinTransactionRecord,
  PlayerPublicProfile,
  RaceResultRecord,
  TrackId,
  UserPrivateProfile,
} from '../types/racing';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutDriver() {
  return signOut(auth);
}

function sanitizeDisplayName(raw: string | null | undefined, fallbackEmail: string | null | undefined): string {
  const candidate = (raw || fallbackEmail?.split('@')[0] || 'Driver').trim().slice(0, 64);
  return candidate.length > 0 ? candidate : 'Driver';
}

export function getTodayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayUtcDateString(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

function syncCoinLocalStorage(uid: string, balance: number) {
  try {
    const safe = Math.max(0, Math.round(balance));
    localStorage.setItem('coin_balance', String(safe));
    localStorage.setItem(`coin_balance_${uid}`, String(safe));
  } catch {
    // Ignore storage restrictions
  }
}

export async function ensureDriverAccount(
  uid: string,
  displayName: string | null,
  email: string | null,
  photoUrl: string | null
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const publicRef = doc(db, 'players', uid);
  const safeName = sanitizeDisplayName(displayName, email);
  const safeEmail = (email || `${uid}@gridline.app`).slice(0, 160);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        displayName: safeName,
        email: safeEmail,
        ...(photoUrl ? { photoUrl: photoUrl.slice(0, 512) } : {}),
        coinBalance: 0,
        racesWon: 0,
        racesPlayed: 0,
        rating: 1200,
        checkInStreak: 0,
        lastCheckInDate: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }

  try {
    const pubSnap = await getDoc(publicRef);
    if (!pubSnap.exists()) {
      await setDoc(publicRef, {
        uid,
        displayName: safeName,
        racesWon: 0,
        racesPlayed: 0,
        rating: 1200,
        isPublic: true,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `players/${uid}`);
  }
}

export function subscribeDriverProfile(
  uid: string,
  onData: (profile: UserPrivateProfile | null) => void,
  onErr: (err: Error) => void
) {
  const ref = doc(db, 'users', uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      const coinBalance = Number(d.coinBalance) || 0;
      syncCoinLocalStorage(uid, coinBalance);
      onData({
        uid: d.uid,
        displayName: d.displayName,
        email: d.email,
        photoUrl: d.photoUrl,
        coinBalance,
        racesWon: Number(d.racesWon) || 0,
        racesPlayed: Number(d.racesPlayed) || 0,
        rating: Number(d.rating) || 1200,
        checkInStreak: Number(d.checkInStreak) || 0,
        lastCheckInDate: typeof d.lastCheckInDate === 'string' ? d.lastCheckInDate : '',
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      } catch (e) {
        onErr(e as Error);
      }
    }
  );
}

export function subscribeTransactions(
  uid: string,
  onData: (rows: CoinTransactionRecord[]) => void,
  onErr: (err: Error) => void
) {
  const path = `users/${uid}/transactions`;
  const q = query(
    collection(db, 'users', uid, 'transactions'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(25)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: CoinTransactionRecord[] = snap.docs
        .map((d) => {
          const data = d.data();
          const ts = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
          return {
            id: d.id,
            userId: data.userId,
            type: data.type,
            coinsDelta: Number(data.coinsDelta) || 0,
            title: data.title,
            methodLabel: data.methodLabel,
            referenceId: data.referenceId,
            createdAtMs: ts,
          };
        })
        .filter((item) => item.type === 'coin_purchase' || item.type === 'daily_checkin' || item.type === 'race_reward');
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onErr(e as Error);
      }
    }
  );
}

export function subscribeLeaderboard(
  onData: (rows: PlayerPublicProfile[]) => void,
  onErr: (err: Error) => void
) {
  const q = query(
    collection(db, 'players'),
    where('isPublic', '==', true),
    orderBy('rating', 'desc'),
    limit(20)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: PlayerPublicProfile[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: data.uid,
          displayName: data.displayName,
          racesWon: Number(data.racesWon) || 0,
          racesPlayed: Number(data.racesPlayed) || 0,
          rating: Number(data.rating) || 1200,
          isPublic: Boolean(data.isPublic),
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'players');
      } catch (e) {
        onErr(e as Error);
      }
    }
  );
}

export function subscribeRecentRaces(
  onData: (rows: RaceResultRecord[]) => void,
  onErr: (err: Error) => void
) {
  const q = query(
    collection(db, 'raceResults'),
    where('isPublic', '==', true),
    orderBy('createdAt', 'desc'),
    limit(15)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: RaceResultRecord[] = snap.docs.map((d) => {
        const data = d.data();
        const ts = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
        return {
          id: d.id,
          matchId: data.matchId,
          trackId: data.trackId,
          trackName: data.trackName,
          winnerId: data.winnerId,
          winnerName: data.winnerName,
          loserId: data.loserId,
          loserName: data.loserName,
          winnerTimeMs: Number(data.winnerTimeMs) || 0,
          playerCount: Number(data.playerCount) || 2,
          createdAtMs: ts,
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'raceResults');
      } catch (e) {
        onErr(e as Error);
      }
    }
  );
}

export async function creditShopCoins(params: {
  uid: string;
  coins: number;
  gatewayLabel: string;
  priceLabel: string;
  referenceId: string;
}): Promise<number> {
  const { uid, coins, gatewayLabel, priceLabel, referenceId } = params;
  const cleanCoins = Math.round(coins);
  if (cleanCoins < 1000 || cleanCoins > 12000) {
    throw new Error('Invalid Shop coin package quantity.');
  }

  const cleanRef = referenceId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120) || `coin_${Date.now()}`;
  const txId = `coin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const userRef = doc(db, 'users', uid);
  const txRef = doc(db, 'users', uid, 'transactions', txId);

  try {
    const nextCoins = await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error('Driver profile not initialized.');
      const curCoins = Number(snap.data().coinBalance) || 0;
      const updatedCoins = curCoins + cleanCoins;

      tx.update(userRef, {
        coinBalance: updatedCoins,
        updatedAt: serverTimestamp(),
      });

      tx.set(txRef, {
        userId: uid,
        type: 'coin_purchase',
        amountUsd: 0,
        coinsDelta: cleanCoins,
        title: `Shop: +${cleanCoins.toLocaleString()} Coins (${priceLabel}) · Non-Withdrawable`.slice(0, 120),
        methodLabel: gatewayLabel.slice(0, 120),
        referenceId: cleanRef,
        createdAt: serverTimestamp(),
      });

      return updatedCoins;
    });

    syncCoinLocalStorage(uid, nextCoins);
    return nextCoins;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/transactions/${txId}`);
  }
}

export async function claimDailyCheckIn(uid: string): Promise<{
  bonusCoins: number;
  nextStreak: number;
  nextBalance: number;
}> {
  const today = getTodayUtcDateString();
  const yesterday = getYesterdayUtcDateString();
  const userRef = doc(db, 'users', uid);
  const txId = `chk_${today.replace(/-/g, '')}_${uid.slice(0, 6)}`;
  const txRef = doc(db, 'users', uid, 'transactions', txId);

  try {
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error('Driver profile not initialized.');
      const cur = snap.data();
      const curLast = typeof cur.lastCheckInDate === 'string' ? cur.lastCheckInDate : '';
      if (curLast === today) {
        throw new Error('Daily check-in reward already claimed today. Come back tomorrow!');
      }

      const curStreak = Number(cur.checkInStreak) || 0;
      const nextStreak = curLast === yesterday ? curStreak + 1 : 1;
      const bonusCoins = nextStreak >= 7 ? 150 : nextStreak >= 3 ? 100 : 50;
      const curCoins = Number(cur.coinBalance) || 0;
      const nextBalance = curCoins + bonusCoins;

      tx.update(userRef, {
        coinBalance: nextBalance,
        checkInStreak: nextStreak,
        lastCheckInDate: today,
        updatedAt: serverTimestamp(),
      });

      tx.set(txRef, {
        userId: uid,
        type: 'daily_checkin',
        amountUsd: 0,
        coinsDelta: bonusCoins,
        title: `Daily Check-In Day ${nextStreak} (+${bonusCoins} Non-Withdrawable Coins)`.slice(0, 120),
        methodLabel: 'Daily Visit Bonus',
        referenceId: txId,
        createdAt: serverTimestamp(),
      });

      return { bonusCoins, nextStreak, nextBalance };
    });

    syncCoinLocalStorage(uid, result.nextBalance);
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('already claimed')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}

export async function settleRaceResultInFirestore(params: {
  uid: string;
  didWin: boolean;
  matchId: string;
  trackId: TrackId;
  trackName: string;
  winnerId: string;
  winnerName: string;
  loserId: string;
  loserName: string;
  winnerTimeMs: number;
  playerCount: number;
  isBotMatch?: boolean;
}): Promise<{ rewardCoins: number; nextCoins: number }> {
  const {
    uid,
    didWin,
    matchId,
    trackId,
    trackName,
    winnerId,
    winnerName,
    loserId,
    loserName,
    winnerTimeMs,
    playerCount,
    isBotMatch = false,
  } = params;

  const cleanMatchId = matchId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  const userRef = doc(db, 'users', uid);
  const publicRef = doc(db, 'players', uid);
  const txId = `win_${cleanMatchId}_${uid.slice(0, 8)}`;
  const txRef = doc(db, 'users', uid, 'transactions', txId);
  const resultRef = doc(db, 'raceResults', cleanMatchId);
  const rewardCoins = didWin ? (isBotMatch ? 20 : 50) : 0;

  try {
    const out = await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userRef);
      const pubSnap = await tx.get(publicRef);
      if (!userSnap.exists()) return { rewardCoins: 0, nextCoins: 0 };
      const cur = userSnap.data();

      const curCoins = Number(cur.coinBalance) || 0;
      const curWins = Number(cur.racesWon) || 0;
      const curPlayed = Number(cur.racesPlayed) || 0;
      const curRating = Number(cur.rating) || 1200;

      const nextCoins = curCoins + rewardCoins;
      const nextWins = curWins + (didWin ? 1 : 0);
      const nextPlayed = curPlayed + 1;
      const ratingDelta = isBotMatch ? (didWin ? 8 : -4) : didWin ? 24 : -16;
      const nextRating = Math.max(400, Math.min(9999, curRating + ratingDelta));

      tx.update(userRef, {
        coinBalance: nextCoins,
        racesWon: nextWins,
        racesPlayed: nextPlayed,
        rating: nextRating,
        updatedAt: serverTimestamp(),
      });

      if (pubSnap.exists()) {
        tx.update(publicRef, {
          displayName: cur.displayName,
          racesWon: nextWins,
          racesPlayed: nextPlayed,
          rating: nextRating,
          isPublic: true,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(publicRef, {
          uid,
          displayName: cur.displayName,
          racesWon: nextWins,
          racesPlayed: nextPlayed,
          rating: nextRating,
          isPublic: true,
          updatedAt: serverTimestamp(),
        });
      }

      if (didWin && rewardCoins > 0) {
        tx.set(txRef, {
          userId: uid,
          type: 'race_reward',
          amountUsd: 0,
          coinsDelta: rewardCoins,
          title: `Race Victory (+${rewardCoins} Bonus Coins · Non-Withdrawable)`.slice(0, 120),
          methodLabel: trackName.slice(0, 120),
          referenceId: cleanMatchId,
          createdAt: serverTimestamp(),
        });
      }

      if (didWin && !isBotMatch) {
        tx.set(resultRef, {
          matchId: cleanMatchId,
          trackId,
          trackName: trackName.slice(0, 80),
          stakeUsd: 0,
          potUsd: 0,
          winnerId,
          winnerName: winnerName.slice(0, 64),
          loserId,
          loserName: loserName.slice(0, 64),
          winnerTimeMs: Math.max(1000, Math.round(winnerTimeMs)),
          playerCount: Math.max(2, Math.min(4, Math.round(playerCount))),
          isPublic: true,
          createdAt: serverTimestamp(),
        });
      }

      return { rewardCoins, nextCoins };
    });

    syncCoinLocalStorage(uid, out.nextCoins);
    return out;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}
