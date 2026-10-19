# Roomba Bumper Royale

A browser game for one player against three bots, or two players sharing one device against two bots. Drive customizable robot vacuums through the original penthouse arena, claim floor territory, collect bounties, and bump rivals. No accounts, server, API keys, or downloads are required to play.

## Play

- **Player 1:** W/S forward/reverse, A/D steer, Space boost.
- **Player 2:** arrow keys to drive, Enter or right Shift boost.
- **Touch:** hold Forward while steering; hold Boost at the same time for turbo. Two players can use their own on-screen pads. Landscape is recommended for shared-device play.
- **Pause:** Escape or the pause button. Leaving the tab pauses automatically; resume when ready.
- **Win:** after 90 seconds, highest total score wins: coverage percentage × 10 + dust points + heavy bumps × 25. Equal scores retain starting order. The live leader and final table use the same rule.
- Use the garage to choose names, colors, decals, finishes, and toppers. Garage changes last for the current page session.

## Local development

Use Node 22.12+ (Node 24 is used for release validation) and npm. npm is the release package manager; `package-lock.json` is authoritative.

```sh
npm ci
npm run dev
```

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser suite serves the production build and runs actual 90-second solo and multiplayer matches. It also checks touch emulation, responsive menus, scores, restart/rematch, and the unsupported-WebGL error screen. To exercise a deployed preview, set `BASE_URL` to its HTTPS origin before running `npm run test:e2e`.

## Vercel preview

Framework: Vite; install: `npm ci`; build: `npm run build`; output: `dist`; Node: 24.x. No environment variables are needed. Deploy the release branch to the separate `roomba-bumper-royale-public-preview` project in Starfall Hollow, with the deployment target set to **preview**. The existing production project is separate. Do not promote or merge without owner approval.

## Practical limits

Requires WebGL 2 and working graphics acceleration. The detailed procedural 3D scene can be demanding on older phones. Touch tests use Chromium device emulation; physical iOS/Android devices and Safari/Firefox still need human checks. Multiplayer is local only. Sound is synthesized after a user gesture. Google Fonts is optional; system fonts work offline or when font requests are blocked. No claim of affiliation with the brands depicted in the existing game is made by this release work.
