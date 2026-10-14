# Fix Users Directory, Key Creation Loading State & Firestore Keys Schema

Ensure all registered users from the Firestore `users` collection are listed in the Admin Console, fix the persistent loading state on VIP key generation, and standardize key documents in the Firestore `keys` collection with clean, predictable schema fields (`code`, `plan`, `user`, `expire`, `status`, `createdAt`, `durationDays`).

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed based on user feedback:

- **Confirmed Decision 1 (Users Query)**: Fetch all user documents from `users` collection without strict creation date ordering, preventing query failures when missing ordering indexes or missing `createdAt` fields on older user records.
- **Confirmed Decision 2 (Unactivated Key Fields)**: Unactivated keys in the Firestore `keys` collection will explicitly store `user: "none"` and `expire: "none"` until redeemed by a user.
- **Confirmed Decision 3 (Key Document Structure)**: Keys in the Firestore `keys` collection will maintain the schema:
  - `code`: Random 9-character code (e.g. `X8N-P4M-Q2Z`)
  - `plan`: Number (`99` or `199`)
  - `user`: User email / UID or `"none"`
  - `expire`: Formatted expiration string (e.g. `"2026-11-13 14:30"`) or `"none"`
  - `status`: `"active"`, `"used"`, or `"disabled"`
  - `createdAt`: Timestamp
  - `durationDays`: `30`

---

## 1. Overview & Core Concept

- **What It Does**: Fixes data retrieval for registered users in the Admin Console, eliminates stuck "Generating Key..." UI state after key creation, and standardizes key records in the Firestore `keys` collection.
- **Target Audience**: App Administrators managing ZYNC user subscriptions and VIP passcodes.
- **Key Value**: Guarantees complete user visibility, immediate UI state updates, and accurate Firestore key persistence.

---

## 2. User Experience & Visual Design

- **Users Directory Tab**:
  - Displays all registered accounts directly from Firestore `users`.
  - Shows highlighted user email badges (`Mail` icon), display names, UIDs, and current VIP subscription tier.
  - Includes real-time search filter and 1-click VIP Grant/Revoke action buttons.
- **VIP Keys Manager**:
  - Clicking "Generate Key" instantly creates a random 9-character passcode (`code`).
  - Button state smoothly transitions from "Generating Key..." back to "Generate Key" immediately upon Firestore completion.
  - Activated keys prominently display `Activated by User: user@email.com` and `Expires on: YYYY-MM-DD HH:mm`.

---

## 3. Key Product Decisions & Trade-Offs

- **Unordered Firestore Users Fetch**:
  - *Chosen Approach*: Query `collection(db, "users")` directly without `orderBy("createdAt")` and sort in JavaScript memory.
  - *Why*: Eliminates composite index requirement errors and prevents older user records without a `createdAt` timestamp from being excluded.
- **Immediate State Reset on Key Creation**:
  - *Chosen Approach*: `await setDoc(doc(db, "keys", newKeyCode), keyPayload)` followed immediately by `setGeneratingKey(false)`.
  - *Why*: Prevents the UI button from remaining stuck in the loading state while providing clean error handling.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────┐
│                   Admin Console App                     │
└────────────┬──────────────────────────────┬─────────────┘
             │                              │
             ▼                              ▼
  ┌──────────────────────┐      ┌──────────────────────┐
  │  Users Directory     │      │   VIP Keys Manager   │
  │  (collection: users) │      │   (collection: keys) │
  └──────────┬───────────┘      └──────────┬───────────┘
             │                             │
             ▼                             ▼
┌─────────────────────────────────────────────────────────┐
│                Firebase Firestore Cloud                 │
│  - /users/{uid} : { email, vip, plan, expire, vipkey }  │
│  - /keys/{code} : { code, plan, user, expire, status }  │
└─────────────────────────────────────────────────────────┘
```

### Data Schema Mapping (`/keys/{code}` document):
```json
{
  "code": "X8N-P4M-Q2Z",
  "plan": 99,
  "user": "none",
  "expire": "none",
  "status": "active",
  "durationDays": 30,
  "createdAt": 1791200000000,
  "used": false
}
```

When activated by a user (`/keys/{code}` update):
```json
{
  "code": "X8N-P4M-Q2Z",
  "plan": 99,
  "user": "user@example.com",
  "expire": "2026-11-13 14:30",
  "status": "used",
  "usedBy": "user@example.com",
  "userId": "uid_123",
  "activatedAt": 1791200000000,
  "expiresAt": 1793792000000,
  "used": true
}
```
