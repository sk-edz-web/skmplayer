# Implementation Plan: Single ₹99 VIP Plan & Firestore Keys Activation Tracking

## User Context & Requirements
- **Remove ₹199 Plan Completely**: Eliminate all references to the ₹199 plan across the application, including the Admin Key Generator, User Subscription Plans modal, and key redemption logic. Only the ₹99 VIP Plan will remain.
- **Firestore `keys` Collection Structure**:
  - Keys must be stored in the `keys/{keyCode}` collection in Firestore.
  - **Unactivated Keys**: Must set `user: "none"`, `usedBy: "none"`, `expire: "none"`, and `activatedAt: "none"`.
  - **Activated Keys**: When a user redeems a key, update the key's database document with the user's email, the exact activation date (`activatedAt`), and the expiration date (`expire`) calculated strictly as **30 days from the activation date**.

---

## Proposed Changes

### 1. Key Generation & Admin Interface (`src/admin.tsx`)
- Remove the ₹199 plan selection dropdown/toggle from the VIP Key Generator. Default strictly to ₹99 ("VIP Pass").
- Store new keys directly into the `keys` collection in Firestore with the following initial document schema:
  - `code`: Random opaque code (e.g. `K8N-P4M-Q2Z`)
  - `plan`: 99
  - `price`: 99
  - `planName`: "VIP Pass (₹99)"
  - `status`: "active"
  - `used`: false
  - `user`: "none"
  - `usedBy`: "none"
  - `expire`: "none"
  - `activatedAt`: "none"
  - `createdAt`: Timestamp
- In the Keys List table:
  - Remove ₹199 filter tab.
  - Display user email (`user`), activation date (`activatedAt`), and expiration date (`expire`).

### 2. User App & Key Activation Logic (`src/App.tsx`)
- Update the **Subscription Plans Modal** to display strictly the **₹99 VIP Pass (30 Days)** card and remove the ₹199 card.
- Update `handleActivateProKey` function:
  - Read key document from Firestore `keys/{keyCode}` collection.
  - Calculate `now` = current date/time when key is redeemed.
  - Calculate `expiresAt` = `now + 30 days`.
  - Format `activatedAt` date string (e.g., `14/10/2026, 06:40 AM`).
  - Format `expire` date string (e.g., `13/11/2026, 06:40 AM`).
  - Update `keys/{keyCode}` document in Firestore with:
    - `user`: `currentUser.email`
    - `usedBy`: `currentUser.email`
    - `activatedAt`: formatted activation date string
    - `expire`: formatted 30-day expiration date string
    - `status`: "used"
    - `used`: true
  - Update `users/{userId}` profile document in Firestore with user VIP status, activation date, and 30-day expiration date.

---

## Verification Plan

### Automated Build & Lint Verification
1. Run `compile_applet` to ensure there are no TypeScript or compilation errors.
2. Run `lint_applet` to ensure syntax cleanliness.

### Functional Verification
1. Check Admin Panel VIP Key creation to confirm key document is created in Firestore `keys` collection with `user: "none"` and `expire: "none"`.
2. Test key activation in the user app to confirm 30-day calculation from the exact day of redemption, updating `user`, `activatedAt`, and `expire` in Firestore.
