# Security Specification — Gridline Multiplayer Racing

## 1. Data Invariants
1. **PII Isolation**: Private email addresses (`users/{userId}.email`) and financial ledgers (`users/{userId}/transactions`, `payoutRequests`) are strictly restricted to the verified owner (`request.auth.uid == userId`). Public leaderboards and recent race feeds read exclusively from `/players/{playerId}` and `/raceResults/{resultId}`, which contain zero PII.
2. **Identity Integrity**: Every write requires `request.auth != null`, `request.auth.token.email_verified == true`, and `uid`/`userId == request.auth.uid`.
3. **Immutable Financial Ledger**: Wallet transactions (`transactions`), withdrawal requests (`payoutRequests`), and completed race records (`raceResults`) are append-only (`allow update, delete: if false`).
4. **Zero-Balance Initialization & Bounded Updates**: New user wallets initialize strictly with `walletBalanceUsd == 0`, `totalDepositedUsd == 0`, `totalWonUsd == 0`, `racesWon == 0`, `racesPlayed == 0`, `rating == 1200`. Action-gated updates enforce per-operation bounds on deposits (`<= $1000`), match stakes (`<= $500`), match payouts (`<= $1000`), and withdrawals (`>= $10`, `<= $5000`).
5. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps must equal `request.time`.
6. **Strict Schema & ID Validation**: Every create/update validates `keys().hasAll(...) && keys().hasOnly(...)` and `affectedKeys().hasOnly(...)`, string length bounds, and regex IDs (`^[a-zA-Z0-9_\-]+$`).

## 2. The "Dirty Dozen" Attack Payloads
1. **Identity Spoofing on User Create**: `alice` attempts to create `/users/bob` with `uid: "bob"`. -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: User with `email_verified: false` attempts to create `/users/alice`. -> `PERMISSION_DENIED`.
3. **PII Blanket Read**: `alice` attempts `get` or `list` on `/users/bob` or `/users`. -> `PERMISSION_DENIED`.
4. **Free Money on Create**: User creates `/users/alice` with `walletBalanceUsd: 10000`. -> `PERMISSION_DENIED` (`walletBalanceUsd == 0` required on create).
5. **Arbitrary Balance Inflation on Update**: User updates `/users/alice` jumping `walletBalanceUsd` by `+$50,000`. -> `PERMISSION_DENIED` (action delta capped).
6. **Negative Wallet Balance**: User updates `/users/alice` with `walletBalanceUsd: -50`. -> `PERMISSION_DENIED`.
7. **Shadow Field Injection**: User writes `/players/alice` with extra `isAdmin: true`. -> `PERMISSION_DENIED`.
8. **ID Poisoning**: User attempts to write `/users/alice/transactions/bad!id$%`. -> `PERMISSION_DENIED`.
9. **Timestamp Forgery**: User logs a `deposit` transaction with backdated `createdAt`. -> `PERMISSION_DENIED`.
10. **Ledger Tampering**: User attempts `update` or `delete` on `/users/alice/transactions/{txId}`. -> `PERMISSION_DENIED`.
11. **PII Leak in Public Profile**: User injects `email` into `/players/alice`. -> `PERMISSION_DENIED`.
12. **Spoofed Race Result**: Non-participant attempts to write `/raceResults/{id}`. -> `PERMISSION_DENIED` (`winnerId == request.auth.uid || loserId == request.auth.uid` required).
