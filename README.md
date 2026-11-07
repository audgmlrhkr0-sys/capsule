# Capsule Claw

Stage 4 foundation for a multiplayer capsule-claw display and controller.

## Run locally

1. Copy `.env.example` to `.env`.
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

## Commands

- `npm run dev` — run shared type watching, server, and Vite client
- `npm run typecheck` — check all workspaces
- `npm run build` — build all workspaces
- `npm test` — run focused server tests

Prizes, robust queue/session lifecycle, and administration remain placeholders
for later stages.
