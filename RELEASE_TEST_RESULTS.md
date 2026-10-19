# Release candidate validation — 2026-10-19

## Scope

Preserved the existing Three.js penthouse, procedural vacuums and skins, chasing dog, pickups, wet spills, solo bots and local split screen. This branch is a preview candidate, not an approved production release.

## Fixed

- Pause/resume and restart no longer create concurrent animation loops. Inputs clear on pause, stop and focus loss.
- Rematches reset floor, pickups, hazards, dog, effects and bounty timers; fresh scores publish immediately.
- Boost now increases acceleration as well as its speed limit, so drag no longer prevents the turbo from making the vacuum faster.
- Spawn points avoid the existing large furniture and face inward. A collision exactly on a furniture axis now pushes out correctly. Carried vacuums do not collide with floor-level players.
- Live leader and results share the same scoring calculation; results show total score and explain the rules.
- Pointer capture/cancellation supports reliable held controls. Touch targets enlarged; touch controls show automatically on coarse pointers. Scrollable menus, dynamic viewport height, compact layouts and a WebGL compatibility screen added.
- Removed unused server/AI dependencies and the incompatible direct esbuild pin. npm lockfile and Vercel test/build gate added. Removed stale Bun lockfile.
- GPU resources are released when rebuilding vacuums and resetting pickups; default audio reduced and pre-initialization mute respected.

## Automated checks — 20 passed

Run in an isolated Vercel build environment with the checked npm lockfile. Production physics is exercised with lightweight renderer/arena substitutes. UI contracts use React server rendering.

- Clean npm installation, dependency audit, TypeScript and production Vite build: PASS.
- Engine regression tests: scoring, pause/repeated resume, restart reset, P1 WASD/reverse/steer, simultaneous P1/P2 arrows and Enter, virtual forward/steer/boost, boundaries, centered furniture collision, one-time pickup scoring, batteries, wet spills, dog carry collision exclusion, standings and complete simulated 90-second match/rematch.
- Menu/HUD checks: objective and controls, both players' touch control labels, total-score live leader, editable garage name, results score/rematch/menu exits.
- `git diff --check`: PASS.

## Browser/deployment checks and release limits

The available cloud Chrome browser explicitly reports `GL_VENDOR = Disabled, GL_RENDERER = Disabled` and cannot create a WebGL context. The built app loads and displays the compatibility message correctly. This is an environment limitation, not evidence that the game runs visually.

**Visual gameplay acceptance is outstanding:** solo and split-screen rendering, actual keyboard/touch play, menu reachability at physical phone sizes, real-time 90-second completion, audio balance, and GPU performance need testing in a WebGL 2 capable browser. Do not describe simulated engine tests or server-rendered menu checks as completed physical-device playtests.

The Three.js bundle remains about 904 kB minified / 243 kB gzipped and produces Vite's chunk-size advisory. No online multiplayer, gamepads, persistence or device performance guarantee. Two-player phone play is best in landscape on a larger device. Existing branding/artwork are preserved and have not received a rights/endorsement review.

A publicly accessible preview is deployed separately from the protected production project. Deployment identity, URL and final test count are recorded in the pull request.
