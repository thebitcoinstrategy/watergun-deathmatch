# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multiplayer 3D water gun deathmatch game — blocky Roblox-style characters, playable in browser and on mobile. Built with Three.js (rendering), Colyseus 0.15 (multiplayer), TypeScript, and Vite.

## Commands

```bash
# Development (run both from repo root)
npm run dev -w @watergun/server    # Server on port 2567 (tsx watch)
npm run dev -w @watergun/client    # Client on port 3000 (vite, host mode for mobile)

# Build
npm run build -w @watergun/server  # tsc → dist/
npm run build -w @watergun/client  # vite build

# Type-check (no test framework configured)
npx tsc --noEmit -p packages/server/tsconfig.json
npx tsc --noEmit -p packages/client/tsconfig.json
```

## Architecture

**Monorepo with npm workspaces** — three packages:

- **`packages/shared`** — Constants and TypeScript interfaces shared by client and server. No build step; imported directly via path aliases.
- **`packages/server`** — Express + Colyseus server. CommonJS output (required by Colyseus 0.15). Uses `experimentalDecorators` for `@type()` schema decorators.
- **`packages/client`** — Three.js game client. Vite bundles it. Supports offline (vs AI bots) and online (Colyseus multiplayer) modes.

### Multiplayer Model

- **Server-authoritative** for other players, bots, projectiles, health, kills, respawns
- **Client-side prediction** for local player movement and visual shooting — `updateOnline()` in Game.ts runs the same movement/shooting code as offline mode, then sends inputs to server
- Colyseus state sync uses `@colyseus/schema` with `MapSchema` (players, bots) and `ArraySchema` (projectiles)
- Rooms matched by simple string `roomCode` via Colyseus `filterBy(['roomCode'])` + `joinOrCreate`
- Server game tick: 20Hz (50ms interval)

### Key Files

| File | Role |
|------|------|
| `server/src/rooms/DeathMatchRoom.ts` | Server game loop, physics, bot AI, hit detection |
| `server/src/schemas/GameState.ts` | Colyseus schema definitions (PlayerSchema, BotSchema, ProjectileSchema) |
| `client/src/Game.ts` | Main game class — offline/online update loops, HUD, shooting, movement |
| `client/src/rendering/SceneManager.ts` | Three.js scene, map geometry, collision boxes, water/slide zones |
| `client/src/networking/Client.ts` | Colyseus client wrapper — room join, input sending, state access |
| `client/src/input/InputManager.ts` | Keyboard, mouse (pointer lock), and touch input |

### Rendering

- Blocky characters built from `BoxGeometry` (no external models/assets)
- First-person viewmodel gun rendered with `depthTest=false, renderOrder=999` as camera child
- Camera toggle between first-person and third-person (V key)
- Water projectiles are visual particles via `WaterEffect`

### Collision & Physics

- AABB collision boxes in `SceneManager.collisionBoxes` for walls and cover objects
- `resolveCollision(x, z, radius)` pushes entities out of boxes
- Slide ramps with height interpolation and push forces via `getSlideInfo()`
- Gravity, jumping, grounding check (`y <= 0` means grounded)

## Important Constraints

- Colyseus 0.15 requires CommonJS on the server — server tsconfig outputs `"module": "commonjs"`
- `@colyseus/schema` decorators require `experimentalDecorators: true` in server tsconfig
- Server movement formula must match client: signs in the trig (`-input.dz * Math.sin`, `-input.dz * Math.cos`) must be identical
- `InputManager.getMouseDelta()` consumes the delta on read (resets to zero) — call only once per frame
- `InputManager.getMovementVector()` does NOT consume on read — safe to call multiple times
