# VIP Key Activation Lifecycle & User Schema Synchronization

Update the VIP key generation and activation system so keys begin their 30-day countdown timer strictly when activated by a user, and standardize user profile storage in Firebase Firestore to the exact requested schema on user login and key activation.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed by the user in Phase 1:
> - **Expiration Timestamp String (`expire`)**: Formatted as `"YYYY-MM-DD HH:mm"` (e.g. `"2026-11-13 14:30"`).
> - **Active Plan Label (`plan`)**: Full pass title matching the plan tier, e.g. `"VIP Gold (99)"` or `"VIP Master (199)"`, and `"none"` when inactive.
> - **Expiry Reset Behavior**: When the 30-day VIP validity expires, `vip` resets to `false`, and fields reset back to `"none"` (`vipkey: "none"`, `expire: "none"`, `vipExpiresAt: 0`, `plan: "none"`).

---

### 1. Overview & Core Concept

Currently, when an Admin generates a VIP key in the Admin Console, the expiration date is pre-computed from the key creation timestamp (`createdAt`). This causes unredeemed keys to lose validity days while sitting in inventory before a user actually activates them.

Furthermore, user documents in Firestore (`users/{uid}`) must be formatted with a clean, standardized schema:
- **Default / Inactive State**:
  ```json
  {
    "uid": "USER_FIREBASE_UID",
    "email": "user@example.com",
    "displayName": "User Name",
    "vip": false,
    "vipkey": "none",
    "expire": "none",
    "vipExpiresAt": 0,
    "plan": "none",
    "updatedAt": 1791975890000
  }
  ```
- **Active State (Upon Key Activation)**:
  ```json
  {
    "uid": "USER_FIREBASE_UID",
    "email": "user@example.com",
    "displayName": "User Name",
    "vip": true,
    "vipkey": "7K9-MP4-2XA",
    "expire": "2026-11-13 14:30",
    "vipExpiresAt": 1791975890000,
    "plan": "VIP Gold (99)",
    "updatedAt": 1791975890000
  }
  ```

Whenever any user logs into the web app, their Firestore record is initialized or verified against this exact schema, and when an active VIP pass reaches its expiration timestamp, it cleanly transitions back to the inactive state.

---

### 2. User Experience & Visual Design

#### A. Admin Key Management Experience (`src/admin.tsx`)
- **Key Generation**: Admin selects ₹99 (VIP Gold) or ₹199 (VIP Master) and clicks Generate.
- **Validity State in Admin Registry**:
  - Unused keys clearly display `Status: Active (Unused)`, `Validity: 30 Days (Starts upon activation)`, and `Expires: Not yet activated`.
  - Activated keys display `Status: Redeemed`, `Activated by: user@email.com`, `Activated on: [date]`, and `Expires on: [YYYY-MM-DD HH:mm]`.
- **Zero Pill Discipline**: Statuses and timestamps in the Admin Key table are presented with clean, unboxed typographic hierarchy with subtle bullet separators.

#### B. User Experience & Account View (`src/App.tsx`)
- **Login / Account Sync**: When a user logs in, the app real-time listens to `users/{uid}`. If new, it creates the document with `vip: false`, `vipkey: "none"`, `expire: "none"`, `vipExpiresAt: 0`, `plan: "none"`.
- **VIP Key Activation Modal / Input**: User enters key (e.g. `7K9-MP4-2XA`). Upon clicking "Activate":
  - Validates key in `keys/{key}`.
  - Computes `vipExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000`.
  - Computes `expire = formatDateTime(vipExpiresAt)` (`"YYYY-MM-DD HH:mm"`).
  - Updates key document: `used: true, activatedAt: now, expiresAt: vipExpiresAt, expiresAtDate: expire`.
  - Updates user document with the active VIP payload.
  - Displays instant celebratory toast and active VIP status badge.
- **Expiration Guard**: Real-time listener checks if `vip === true` and `Date.now() > vipExpiresAt`. If expired, silently updates Firestore document back to default inactive schema.

---

### 3. Key Product Decisions & Trade-Offs

1. **Activation-Driven Expiration vs. Pre-Computed Expiration**:
   - *Chosen Approach*: Keys hold a `durationDays: 30` property. The actual expiration timestamp (`expiresAt`, `vipExpiresAt`) is computed at the exact millisecond the user activates the key.
   - *Why*: Fair to paying customers; keys can be pre-generated, distributed via WhatsApp/email, or held in stock without expiring before delivery.

2. **Schema Uniformity with Backwards Compatibility**:
   - *Chosen Approach*: The Firestore document writes the user's requested root fields (`vip`, `vipkey`, `expire`, `vipExpiresAt`, `plan`, `updatedAt`). The app client state also maps `isPro: profile.vip === true` and `proKey: profile.vipkey !== "none" ? profile.vipkey : undefined`.
   - *Why*: Guarantees all existing music player checks, audio quality switches (320kbps vs 128kbps), and download permissions continue working seamlessly without regressions while strictly fulfilling the requested Firestore data contract.

3. **Date String Formatting (`YYYY-MM-DD HH:mm`)**:
   - *Chosen Approach*: Helper function `formatVipExpireDate(timestamp)` produces zero-padded `"YYYY-MM-DD HH:mm"` in local time, ensuring exact compliance with `"2026-11-13 14:30"`.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ADMIN CONSOLE (admin.tsx)                       │
│                                                                        │
│  [Generate Key Button] ──> writes keys/{code}:                         │
│                           { code: "...", durationDays: 30,             │
│                             used: false, status: "active",             │
│                             usedAt: 0, expiresAt: 0,                   │
│                             createdAt: timestamp }                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   FIREBASE FIRESTORE DATABASE (db)                     │
│                                                                        │
│   /keys/{code}                   /users/{uid}                          │
│   ├── code                       ├── uid                               │
│   ├── durationDays: 30           ├── email                             │
│   ├── status: "active"|"used"    ├── displayName                       │
│   ├── used: boolean              ├── vip: true | false                 │
│   ├── usedBy: string             ├── vipkey: "CODE" | "none"           │
│   ├── activatedAt: timestamp     ├── expire: "YYYY-MM-DD HH:mm"|"none" │
│   └── expiresAt: timestamp       ├── vipExpiresAt: timestamp | 0       │
│                                  ├── plan: "VIP Gold (99)" | "none"    │
│                                  └── updatedAt: timestamp              │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │
                                    │ onLogin() / onActivateKey()
┌───────────────────────────────────┴────────────────────────────────────┐
│                        WEB APP CLIENT (App.tsx)                        │
│                                                                        │
│  1. onAuthStateChanged:                                                │
│     - Document missing? Set default { vip: false, vipkey: "none", ... }│
│     - Active VIP expired? Reset to { vip: false, vipkey: "none", ... } │
│                                                                        │
│  2. handleActivateProKey:                                              │
│     - Reads keys/{code}                                                │
│     - Calculates: now + durationDays (30 days)                         │
│     - Atomically updates keys/{code} & users/{uid}                     │
└────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Schema Definitions

##### Default User Document (`users/{uid}`)
```json
{
  "uid": "c0X39Z...",
  "email": "user@example.com",
  "displayName": "User Name",
  "vip": false,
  "vipkey": "none",
  "expire": "none",
  "vipExpiresAt": 0,
  "plan": "none",
  "updatedAt": 1791975890000
}
```

##### Active VIP User Document (`users/{uid}`)
```json
{
  "uid": "c0X39Z...",
  "email": "user@example.com",
  "displayName": "User Name",
  "vip": true,
  "vipkey": "7K9-MP4-2XA",
  "expire": "2026-11-13 14:30",
  "vipExpiresAt": 1791975890000,
  "plan": "VIP Gold (99)",
  "updatedAt": 1791975890000
}
```

##### Admin Key Document (`keys/{code}`)
- **On Generation (Unused)**:
  `code`, `plan`: `99 | 199`, `planName`: `"VIP Gold (99)" | "VIP Master (199)"`, `price`: `99 | 199`, `durationDays`: `30`, `status`: `"active"`, `used`: `false`, `usedBy`: `""`, `usedAt`: `0`, `activatedAt`: `0`, `expiresAt`: `0`, `expiresAtDate`: `"none"`, `expiresAtFormatted`: `"Not yet activated"`, `createdAt`: `Date.now()`.
- **On Activation (Redeemed)**:
  `used`: `true`, `status`: `"used"`, `userId`: `uid`, `usedBy`: `email`, `activatedAt`: `Date.now()`, `expiresAt`: `Date.now() + 30 * 86400000`, `expiresAtDate`: `"YYYY-MM-DD HH:mm"`, `expiresAtFormatted`: `"YYYY-MM-DD HH:mm"`.

---

### 5. Implementation Steps (Planned for Execution Turn)

1. **Update `src/types.ts`**:
   - Update `UserProfile` interface to include `vip: boolean`, `vipkey: string`, `expire: string`, `vipExpiresAt: number`, `plan: string`, `updatedAt: number`.
   - Update `SubscriptionKey` interface to support activation-time expiration.
2. **Update Admin Console (`src/admin.tsx`)**:
   - Modify `handleGenerateVipKey` so it does NOT calculate `expiresAt` at creation time.
   - Set initial key expiry status as unredeemed with duration 30 days.
   - Update Admin key registry table rendering to show activation status and proper dates.
3. **Update Web App (`src/App.tsx`)**:
   - Add `formatVipExpireDate(timestamp)` helper for `"YYYY-MM-DD HH:mm"`.
   - Update `onAuthStateChanged` profile sync to initialize user documents with the exact requested schema on login.
   - Add automatic expiry check in real-time profile listener to reset expired VIPs back to `"none"`.
   - Update `handleActivateProKey` to compute 30 days from activation moment, format date, and write exact payload to `users/{uid}` and `keys/{code}`.
4. **Verification**:
   - Compile applet with `compile_applet`.
   - Run linter with `lint_applet` to ensure zero type or lint errors.
