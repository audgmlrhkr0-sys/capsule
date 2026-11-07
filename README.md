# Capsule Claw

Complete seven-stage multiplayer capsule-claw exhibition app.

## Run locally

1. Copy `.env.example` to `.env` and replace `ADMIN_PASSWORD`.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:5173/display`.

The display creates a four-digit room and stores its display token in
`sessionStorage`, so refreshing reconnects to the same room.
Each room runs a server-authoritative Matter.js simulation with 36 capsules.
The display receives 20 Hz snapshots and interpolates them on Canvas 2D.
Up to three players can join from `/play/:roomCode`; additional players see
their basic queue position. Joined players receive a landscape touch controller.
Each occupied slot gets a server-timed 30-second claw turn with continuous
movement, deterministic capsule capture, and drop/lift/dispense/result phases.
Successful captures draw from validated weighted prize inventory, show a
three-second synchronized reveal, and append an escaped UTF-8 CSV win log.
FIFO promotion, reconnect grace, inactivity eviction, cooldowns, duplicate
session protection, and safe capsule refill harden the controller lifecycle.
The authenticated `/admin` dashboard provides live operations, inventory,
reset/refill/kick controls, and escaped UTF-8 CSV export.

## Environment

- `PORT` — Express and Socket.IO port
- `PUBLIC_URL` — public visitor-facing client URL used in display QR codes
- `CLIENT_ORIGIN` — exact browser origin allowed by CORS and admin mutations
- `VITE_SERVER_URL` — server URL embedded in the Vite client
- `ADMIN_PASSWORD` — required server-only admin password (minimum 8 characters)

The admin password is never sent to the client except during the login request
and is not stored in browser storage.

## Commands

- `npm run dev` — run shared type watching, server, and Vite client
- `npm run typecheck` — check all workspaces
- `npm run build` — build all workspaces
- `npm test` — run focused server tests

## Exhibition deployment

Serve the client and API over HTTPS, set `PUBLIC_URL` to the externally
reachable exhibition URL, and set `CLIENT_ORIGIN` to that exact HTTPS origin.
Run the server with `NODE_ENV=production` so the signed admin cookie is marked
`Secure`. Keep `server/data` on persistent writable storage if win CSV history
must survive deployments.
