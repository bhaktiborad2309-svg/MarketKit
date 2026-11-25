# Changelog

Every release of MarketKit, newest first.

A **Pro** licence includes updates released in the 12 months after purchase.
Look for the version on your receipt, then read down to see what you have and
what a renewal adds. Starter keeps the version it bought — see `LICENSE.md`.

Versions follow [semantic versioning](https://semver.org): the middle number
adds features, the last number fixes things. A major bump means an upgrade that
needs work on your side, and it will say so here in full.

---

## [Unreleased]

Work landed since 1.0.0, shipping in the next release.

### Fixed

- **The admin panel dev server now starts on port 5173**, matching what
  `docs/INSTALL.md`, the `Makefile`, `scripts/bootstrap.sh` and the dev
  `CORS_ORIGIN` all told you it would. It had been coming up on 8080, so the
  URL printed on first run did not open anything.

### Added

- `DEV_SKIP_OTP_EMAILS` — admins listed here sign in with their password alone,
  skipping the emailed OTP. Read only when `APP_ENV=development`, so a copy
  left in a deployed `.env` cannot weaken production login. Off by default.
- `LICENSE.md` — the Starter and Pro terms, previously nowhere in the download.
- **Add-on packs are now separable.** Packs self-register their routes, so the
  core names no pack anywhere and removing one is deleting files rather than
  editing the route map. `make pack-starter` and `make pack-pro` build the
  release trees, and refuse to package anything that does not compile. The
  Flutter app still ships whole in every tier — see `PACKS.md` in a build.
- This changelog.

---

## [1.0.0] — 2026-08-12

First public release. A marketplace app across three tiers, with the money
paths built and tested.

### The kit

- **Go API** (Fiber v2, GORM, PostgreSQL 16) — 27 modules, ~387 routes,
  Swagger docs at `/docs/index.html`.
- **Flutter app** (Riverpod, GoRouter) — 15 features, Android and iOS.
- **React admin panel** (Vite, TypeScript, shadcn/ui, TanStack Query) —
  27 pages.
- **Docker Compose** for all of it, plus `make quickstart`: generates `.env`
  files with random secrets, starts the stack, seeds demo data.

### Money

- **Append-only wallet ledger**, user and platform, each row carrying a
  `balance_after_minor` snapshot so any historical balance is reconstructable.
- **Integer minor units throughout** — no floats touch money, so the platform
  fee and the seller's net add back to the price exactly.
- **Invariant checks** — the seeder verifies that ledger sums match cached
  balances and refuses to report success if they drift. The query is in
  `docs/WALLET.md`; run it against your own data any time.
- Seller payouts, withdrawals, platform fee, refund requests and approvals,
  subscriptions with expiry cron.

### Payments

- Pluggable provider interface with **Razorpay and Stripe** behind it.
- Webhook handling with signature verification, and idempotent capture.

### Included packs

Video (upload, transcode, HLS playback, progress, reactions), Community
(posts, replies), and Photos ship in 1.0.0.

### Documentation

`INSTALL`, `WALLET`, `CUSTOMIZE`, `DEPLOY`, `ARCHITECTURE`, `TESTING`,
`FIREBASE_SETUP`, `PUSH_NOTIFICATIONS`.

### Notable fixes before release

- Closed unauthenticated access to paid product files — a buyer's download URL
  no longer works without a session that owns the purchase.
- Fixed a double-charge race on wallet purchases under concurrent requests.
- Background tasks no longer crash the API process when they panic.

---

<!--
Keeping this file:

Add to [Unreleased] as you merge, in the buyer's language — what changed for
them, not which function you renamed. On release, retitle that section with the
version and date and open a fresh [Unreleased].

Anything that needs action on the buyer's side goes under a **Breaking**
heading with the migration steps written out. That heading is the difference
between a renewal and a refund.
-->
